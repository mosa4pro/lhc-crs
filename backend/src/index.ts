import express from 'express';
import cors from 'cors';
import compression from 'compression';
import responseTime from 'response-time';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import { fileURLToPath } from 'url';
import { corsOrigins } from './config/env.js';

import studentRoutes from './routes/student.js';
import subscriptionRoutes from './routes/subscription.js';
import diplomaRoutes from './routes/diploma.js';
import courseRoutes from './routes/course.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/educational-entity.js';
import roomRoutes from './routes/room.js';
import instructorRoutes from './routes/instructor.js';
import sectionRoutes from './routes/section.js';
import financialRoutes from './routes/financial.js';
import requestCourseRoutes from './routes/request-course.js';
import auditRoutes from './routes/audit.js';
import installmentRoutes from './routes/installment.js';
import employeeRoutes from './routes/employee.js';
import employeeImageRoutes from './routes/employee-images.js';
import salaryRoutes from './routes/salary.js';
import reportTemplateRoutes from './routes/report-template.js';
import attendanceRoutes from './routes/attendance.js';
import gradesRoutes from './routes/grades.js';
import settingsRoutes from './routes/settings.js';
import backgroundRoutes from './routes/backgrounds.js';
import whatsappRoutes from './routes/whatsapp.js';
import announcementRoutes from './routes/announcements.js';
import finAccountsRoutes from './routes/fin-accounts.js';
import settlementRoutes from './routes/settlement.js';
import userFilesRoutes from './routes/user-files.js';
import sharedFilesRoutes from './routes/shared-files.js';
import userNotesRoutes from './routes/user-notes.js';
import userDocumentsRoutes from './routes/user-documents.js';
import chatRoutes from './routes/chat.js';
import { setupSocket } from './socket.js';

// ===== Infrastructure =====
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler.js';
import { requestLogger } from './shared/middleware/request-logger.js';
// New v2 routes
import { financialV2Routes } from './modules/financial/financial.routes.js';

dotenv.config();

const app = express();
export const prisma = new PrismaClient();

// ===== Performance Middleware (first) =====
app.use(compression({ level: 5, threshold: 256 }));
app.use(responseTime((req, res, time) => {
  res.setHeader('X-Response-Time', `${time.toFixed(1)}ms`);
}));

app.use(cors({
  origin: corsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ===== Request Logging =====
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/educational-entities', entityRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/diplomas', diplomaRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/request-course', requestCourseRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/employees', employeeImageRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backgrounds', backgroundRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/fin-accounts', finAccountsRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/user-files', userFilesRoutes);
app.use('/api/shared-files', sharedFilesRoutes);
app.use('/api/user-notes', userNotesRoutes);
app.use('/api/user-documents', userDocumentsRoutes);
app.use('/api/chat', chatRoutes);

// ===== New Architecture Routes (v2) =====
app.use('/api/v2/financial', financialV2Routes);

const httpServer = http.createServer(app);
export const io = setupSocket(httpServer);

// ===== File serving (inline to avoid circular imports) =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const ALLOWED_FILE_DIRS = ['logos', 'backgrounds', 'announcements', 'profiles', 'chat', 'employees'];
for (const d of ALLOWED_FILE_DIRS) {
  const p = path.join(UPLOADS_DIR, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function isPathSafe(subDir: string, filename: string): string | null {
  if (!ALLOWED_FILE_DIRS.includes(subDir)) return null;
  const baseDir = path.resolve(UPLOADS_DIR, subDir);
  const fullPath = path.resolve(baseDir, filename);
  if (!fullPath.startsWith(baseDir) || filename.includes('..')) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

const JWT_SECRET = process.env.JWT_SECRET || 'ems-super-secret-2026';

async function fileAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET);
    const session = await prisma.loginSession.findUnique({
      where: { token },
      include: { user: { include: { permissions: { include: { permission: true } } } } }
    });
    if (!session || session.status === 'REVOKED') return res.status(401).json({ error: 'الجلسة منتهية.' });
    if (session.user.status !== 'ACTIVE') return res.status(403).json({ error: 'تم تعطيل هذا الحساب.' });
    prisma.loginSession.update({ where: { id: session.id }, data: { lastActive: new Date() } }).catch(() => {});
    (req as any).user = session.user;
    (req as any).token = token;
    next();
  } catch { return res.status(401).json({ error: 'غير مصرح: رمز غير صالح' }); }
}

function filePerm(permissionName: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'غير مصرح' });
    const permKeys = user.permissions.map((p: any) => p.permission.name);
    if (permKeys.includes('ADMIN_ALL') || permKeys.includes(permissionName) || user.role === 'ADMIN') return next();
    return res.status(403).json({ error: `ليس لديك صلاحية: ${permissionName}` });
  };
}

const fileUploader = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, (req.params as any).subDir)),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || '.bin'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Public — logo & profile files (needed for login page & <img> tags)
app.get('/api/files/logos/:filename', (req, res) => {
  const fp = isPathSafe('logos', (req.params.filename as string));
  if (!fp) return res.status(404).json({ error: 'الملف غير موجود' });
  res.sendFile(fp);
});

app.get('/api/files/profiles/:filename', (req, res) => {
  const fp = isPathSafe('profiles', (req.params.filename as string));
  if (!fp) return res.status(404).json({ error: 'الملف غير موجود' });
  res.sendFile(fp);
});

// Protected — serve file
app.get('/api/files/:subDir/:filename', fileAuth, (req, res) => {
  if (!['backgrounds', 'announcements', 'chat', 'employees'].includes(req.params.subDir as string)) {
    return res.status(400).json({ error: 'المجلد غير صالح' });
  }
  const fp = isPathSafe(req.params.subDir as string, (req.params.filename as string));
  if (!fp) return res.status(404).json({ error: 'الملف غير موجود' });
  res.sendFile(fp);
});

// Upload
app.post('/api/files/upload/:subDir', fileAuth, filePerm('admin.settings'), (req, res) => {
  if (!ALLOWED_FILE_DIRS.includes(req.params.subDir as string)) return res.status(400).json({ error: 'المجلد غير صالح' });
  const handler = fileUploader.single('file');
  handler(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'فشل رفع الملف' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف' });
    res.json({
      url: path.join('/uploads', (req.params.subDir as string), req.file.filename),
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });
});

// Delete
app.delete('/api/files/:subDir/:filename', fileAuth, filePerm('admin.settings'), (req, res) => {
  if (!ALLOWED_FILE_DIRS.includes(req.params.subDir as string)) return res.status(400).json({ error: 'المجلد غير صالح' });
  const fp = isPathSafe(req.params.subDir as string, (req.params.filename as string));
  if (fp) fs.unlinkSync(fp);
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0' });
});

// ===== Error Handling (last) =====
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
// Initialize lastSeenAt for users with null value (use most recent login session)
(async () => {
  try {
    const nullUsers = await prisma.user.findMany({
      where: { lastSeenAt: null, status: 'ACTIVE', role: { in: ['ADMIN','SUPERVISOR','EMPLOYEE','TRAINEE'] } },
      select: { id: true },
    });
    if (nullUsers.length > 0) {
      const ids = nullUsers.map(u => u.id);
      // Try to use most recent login session lastActive
      const sessions = await prisma.loginSession.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _max: { lastActive: true },
      });
      for (const s of sessions) {
        if (s._max.lastActive) {
          await prisma.user.update({
            where: { id: s.userId },
            data: { lastSeenAt: s._max.lastActive },
          });
        }
      }
      const updatedIds = new Set(sessions.filter(s => s._max.lastActive).map(s => s.userId));
      for (const uid of ids) {
        if (!updatedIds.has(uid)) {
          await prisma.user.update({ where: { id: uid }, data: { lastSeenAt: new Date(0) } });
        }
      }
      console.log(`   Initialized lastSeenAt for ${ids.length} users`);
    }
  } catch (e) { console.error('lastSeenAt init error', e); }
})();
httpServer.listen(PORT, () => {
  console.log(`\n🚀 LHC-CRS Backend v3 running on http://localhost:${PORT}`);
  console.log(`   PostgreSQL database connected.\n`);
});
