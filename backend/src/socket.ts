import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './index.js';
import { corsOrigins } from './config/env.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ems-super-secret-2026';

const onlineUsers = new Map<number, { sockets: Set<string>; lastSeen?: Date }>();

export function setupSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins(),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token as string, JWT_SECRET) as any;
      const session = await prisma.loginSession.findUnique({
        where: { token: token as string },
        include: { user: true },
      });
      if (!session || session.status === 'REVOKED' || session.user.status !== 'ACTIVE') {
        return next(new Error('Invalid session'));
      }
      (socket as any).user = session.user;
      (socket as any).dbUserId = session.user.id;
      next();
    } catch {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).dbUserId as number;

    // Track online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, { sockets: new Set() });
    onlineUsers.get(userId)!.sockets.add(socket.id);
    socket.join(`user:${userId}`);

    const user = (socket as any).user;
    const prevEntry = onlineUsers.get(userId);
    // Load lastSeen from DB if not in memory
    let lastSeen = prevEntry?.lastSeen?.toISOString();
    if (!lastSeen) {
      try {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } });
        if (dbUser?.lastSeenAt) lastSeen = dbUser.lastSeenAt.toISOString();
      } catch {}
    }
    io.emit('user:online', { userId, fullName: user.fullName, online: true, lastSeen });

    // Send current online status of all tracked users + DB fallback to the client
    const allStatus: { userId: number; online: boolean; lastSeen?: string }[] = [];
    for (const [uid, entry] of onlineUsers) {
      allStatus.push({ userId: uid, online: entry.sockets.size > 0, lastSeen: entry.lastSeen?.toISOString() });
    }
    // Query lastSeenAt from DB for all chat users to fill gaps
    try {
      const dbUsers = await prisma.user.findMany({
        where: { status: 'ACTIVE', role: { in: ['ADMIN','SUPERVISOR','EMPLOYEE','TRAINEE'] } },
        select: { id: true, lastSeenAt: true },
      });
      for (const du of dbUsers) {
        const existing = allStatus.find(s => s.userId === du.id);
        if (existing) {
          if (!existing.lastSeen && du.lastSeenAt) existing.lastSeen = du.lastSeenAt.toISOString();
        } else {
          allStatus.push({ userId: du.id, online: false, lastSeen: du.lastSeenAt?.toISOString() });
        }
      }
    } catch {}
    socket.emit('online:status-all', allStatus);

    // ... existing handlers ...

    // Handle joining conversation rooms
    socket.on('conversation:join', (convId: number) => {
      socket.join(`conv:${convId}`);
    });

    socket.on('conversation:leave', (convId: number) => {
      socket.leave(`conv:${convId}`);
    });

    // Handle new message
    socket.on('message:send', async (data: { conversationId: number; content?: string; imageUrl?: string; clientId?: number }) => {
      try {
        const msg = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: userId,
            content: data.content || null,
            imageUrl: data.imageUrl || null,
          },
          include: {
            sender: { select: { id: true, fullName: true } },
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { updatedAt: new Date() },
        });

        // Create SENT status for sender
        await prisma.messageStatus.create({
          data: { messageId: msg.id, userId, status: 'SENT' },
        });

        // Include statuses and optional clientId for optimistic matching
        const payload: any = {
          ...msg,
          statuses: [{ id: 0, messageId: msg.id, userId, status: 'SENT', readAt: null }],
        };
        if (data.clientId !== undefined) payload._clientId = data.clientId;

        io.to(`conv:${data.conversationId}`).emit('message:new', payload);
      } catch (e) {
        console.error('socket message error', e);
        socket.emit('message:error', { error: 'فشل إرسال الرسالة' });
      }
    });

    // Handle delivery acknowledgment
    socket.on('message:delivered', async (data: { messageId: number; conversationId: number }) => {
      try {
        await prisma.messageStatus.upsert({
          where: { messageId_userId: { messageId: data.messageId, userId } },
          create: { messageId: data.messageId, userId, status: 'DELIVERED' },
          update: { status: 'DELIVERED' },
        });
        io.to(`conv:${data.conversationId}`).emit('message:delivered-receipt', {
          messageId: data.messageId,
          conversationId: data.conversationId,
          userId,
        });
      } catch (e) {
        console.error('socket delivery error', e);
      }
    });

    // Handle typing
    socket.on('typing:start', (data: { conversationId: number }) => {
      socket.to(`conv:${data.conversationId}`).emit('typing:update', {
        conversationId: data.conversationId,
        userId,
        fullName: user.fullName,
        typing: true,
      });
    });

    socket.on('typing:stop', (data: { conversationId: number }) => {
      socket.to(`conv:${data.conversationId}`).emit('typing:update', {
        conversationId: data.conversationId,
        userId,
        fullName: user.fullName,
        typing: false,
      });
    });

    // Handle read receipt
    socket.on('message:read', async (data: { conversationId: number; messageIds: number[] }) => {
      try {
        for (const msgId of data.messageIds) {
          await prisma.messageStatus.upsert({
            where: { messageId_userId: { messageId: msgId, userId } },
            create: { messageId: msgId, userId, status: 'READ', readAt: new Date() },
            update: { status: 'READ', readAt: new Date() },
          });
        }
        await prisma.conversationParticipant.updateMany({
          where: { conversationId: data.conversationId, userId },
          data: { lastReadAt: new Date() },
        });
        io.to(`conv:${data.conversationId}`).emit('message:read-receipt', {
          conversationId: data.conversationId,
          userId,
          fullName: user.fullName,
          messageIds: data.messageIds,
          readAt: new Date(),
        });
      } catch (e) {
        console.error('socket read receipt error', e);
      }
    });

    // Handle message delete (sender only, verified by route — but also check here)
    socket.on('message:delete', async (data: { messageId: number; conversationId: number }) => {
      try {
        const msg = await prisma.message.findUnique({ where: { id: data.messageId } });
        if (!msg || msg.senderId !== userId) return;
        await prisma.message.update({
          where: { id: data.messageId },
          data: { content: null, imageUrl: null },
        });
        io.to(`conv:${data.conversationId}`).emit('message:deleted', {
          messageId: data.messageId,
          conversationId: data.conversationId,
        });
      } catch (e) {
        console.error('socket message delete error', e);
      }
    });

    // Bizz / nudge with rate limit: max 3 per 5 minutes
    const bizzTimestamps = new Map<number, number[]>();

    socket.on('bizz:send', async (data: { conversationId: number }) => {
      try {
        const now = Date.now();
        const timestamps = bizzTimestamps.get(userId) || [];
        const recent = timestamps.filter(t => now - t < 300000);
        const remaining = 3 - recent.length;
        if (remaining <= 0) {
          const nextAvailable = Math.ceil((recent[0] + 300000 - now) / 1000);
          socket.emit('bizz:limit', { message: `⏱️ لا يمكنك النكز الآن. انتظر ${Math.ceil(nextAvailable / 60)} دقيقة` });
          return;
        }
        recent.push(now);
        bizzTimestamps.set(userId, recent);

        const conv = await prisma.conversation.findUnique({
          where: { id: data.conversationId },
          include: { participants: { include: { user: { select: { id: true, fullName: true } } } } },
        });
        if (!conv) return;
        const others = conv.participants.filter(p => p.userId !== userId);
        for (const p of others) {
          const msg = await prisma.message.create({
            data: {
              conversationId: data.conversationId,
              senderId: userId,
              content: `🚀 قام ${user.fullName} بنكز ${p.user.fullName}`,
              imageUrl: null,
            },
            include: { sender: { select: { id: true, fullName: true } } },
          });
          await prisma.conversation.update({
            where: { id: data.conversationId },
            data: { updatedAt: new Date() },
          });
          await prisma.messageStatus.create({
            data: { messageId: msg.id, userId, status: 'SENT' },
          });
          const payload = { ...msg, statuses: [{ id: 0, messageId: msg.id, userId, status: 'SENT', readAt: null }] };
          io.to(`conv:${data.conversationId}`).emit('message:new', payload);
          io.to(`user:${p.userId}`).emit('bizz:received', {
            conversationId: data.conversationId,
            fromUserId: userId,
            fromFullName: user.fullName,
          });
        }
      } catch (e) {
        console.error('bizz error', e);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const entry = onlineUsers.get(userId);
      if (entry) {
        entry.sockets.delete(socket.id);
        if (entry.sockets.size === 0) {
          entry.lastSeen = new Date();
          io.emit('user:online', { userId, online: false, lastSeen: entry.lastSeen.toISOString() });
          // persist to DB
          try { await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: entry.lastSeen } }); } catch {}
          // keep entry in map so reconnect can read lastSeen
        }
      }
    });
  });

  return io;
}

export function getOnlineStatus(userId: number): { online: boolean; lastSeen?: string } {
  const entry = onlineUsers.get(userId);
  return { online: !!entry && entry.sockets.size > 0, lastSeen: entry?.lastSeen?.toISOString() };
}
