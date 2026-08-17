import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ems-super-secret-2026';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET); // throws if invalid

    const session = await prisma.loginSession.findUnique({
      where: { token },
      include: { user: { include: { permissions: { include: { permission: true } } } } }
    });

    if (!session || session.status === 'REVOKED') {
      return res.status(401).json({ error: 'الجلسة منتهية. يرجى تسجيل الدخول مجدداً.' });
    }
    if (session.user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'تم تعطيل هذا الحساب.' });
    }

    // Update lastActive async (don't block)
    prisma.loginSession.update({
      where: { id: session.id },
      data: { lastActive: new Date() }
    }).catch(() => {});

    (req as any).user = session.user;
    (req as any).token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'غير مصرح: رمز غير صالح' });
  }
};

export const requirePermission = (permissionName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'غير مصرح' });

    const permKeys = user.permissions.map((p: any) => p.permission.name);
    // ADMIN_ALL grants everything
    const hasIt = permKeys.includes('ADMIN_ALL') || permKeys.includes(permissionName) || user.role === 'ADMIN';

    if (!hasIt) {
      // Bare admin.X grants from any granular admin.X.* permission (e.g. admin.users ← admin.users.manage)
      const bare = /^admin\.[a-zA-Z]+$/.exec(permissionName);
      if (bare && permKeys.some(p => p.startsWith(`${bare[0]}.`))) {
        return next();
      }
      return res.status(403).json({ error: `ليس لديك صلاحية: ${permissionName}` });
    }
    next();
  };
};

// Allow access if user has the required permission OR is a student accessing their own data
export const selfOrPerm = (permissionName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'غير مصرح' });

    const permKeys = user.permissions.map((p: any) => p.permission.name);
    if (permKeys.includes('ADMIN_ALL') || permKeys.includes(permissionName) || user.role === 'ADMIN') {
      return next();
    }

    // Allow student role to access own data
    if (user.role === 'STUDENT' && user.studentId) {
      const targetIds = [(req.params.id as string), (req.params.studentId as string), req.query.studentId].filter(Boolean).map(String);
      if (targetIds.some(id => id === user.studentId)) {
        return next();
      }
    }

    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  };
};
