import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission, selfOrPerm } from '../middleware/auth.js';

const router = express.Router();

// GET /api/attendance/instructor-sections — sections for the logged-in instructor
router.get('/instructor-sections', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    let sections;
    if (user.role === 'INSTRUCTOR' && user.instructorId) {
      sections = await prisma.section.findMany({
        where: { instructorId: user.instructorId },
        include: {
          course: { include: { category: true } },
          room: true, instructor: true,
          _count: { select: { students: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      return res.status(403).json({ error: 'يجب أن تكون محاضراً' });
    }
    res.json(sections);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance?sectionId=...&date=...
router.get('/', authMiddleware, selfOrPerm('attendance.manage'), async (req, res) => {
  try {
    const { sectionId, date, studentId } = req.query as any;
    const where: any = {};
    if (sectionId) where.sectionId = parseInt(sectionId as string);
    if (studentId) where.studentId = studentId;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, fullNameAr: true } },
        section: { include: { course: { select: { name: true } } } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(records.map(r => ({
      ...r,
      student: r.student ? { id: r.student.id, fullName: r.student.fullNameAr, studentCode: r.student.id } : null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'خطأ في جلب سجلات الحضور' });
  }
});

// GET /api/attendance/section/:sectionId  — full attendance list for a section
router.get('/section/:sectionId', authMiddleware, async (req, res) => {
  try {
    const sectionId = req.params.sectionId as string;
    const { date } = req.query as any;

    const section = await prisma.section.findUnique({
      where: { id: parseInt(sectionId) },
      include: {
        course: true,
        instructor: true,
        room: true,
        students: {
          where: { status: 'ENROLLED' },
          include: {
            student: { select: { id: true, fullNameAr: true, phones: true } }
          }
        }
      }
    });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    // Check instructor access: if user is INSTRUCTOR, must own this section
    const user = (req as any).user;
    if (user.role === 'INSTRUCTOR' && user.instructorId !== section.instructorId) {
      return res.status(403).json({ error: 'هذه الشعبة ليست من شعبك' });
    }

    let attendanceForDate: any[] = [];
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      attendanceForDate = await prisma.attendance.findMany({
        where: { sectionId: parseInt(sectionId), date: { gte: d, lt: nextDay } }
      });
    }

    const attendanceMap = Object.fromEntries(attendanceForDate.map(a => [a.studentId, a]));

    res.json({
      section,
      instructorCanEdit: section.instructorCanEditAttendance,
      students: section.students.map(ss => ({
        id: ss.student.id,
        fullName: ss.student.fullNameAr,
        studentCode: ss.student.id,
        phone: ss.student.phones,
        attendance: attendanceMap[ss.student.id] || null
      }))
    });
  } catch (err: any) {
    console.error('Error fetching section attendance:', err.message);
    res.status(500).json({ error: 'خطأ في جلب بيانات الشعبة' });
  }
});

// GET /api/attendance/student/:studentId — all attendance for a student
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const records = await prisma.attendance.findMany({
      where: { studentId: (req.params.studentId as string) },
      include: {
        section: { include: { course: { select: { name: true } } } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch {
    res.status(500).json({ error: 'خطأ في جلب سجلات الطالب' });
  }
});

// GET /api/attendance/me — attendance for currently logged-in student (portal use)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.studentId) return res.status(404).json({ error: 'لم يتم ربط حسابك ببيانات طالب' });
    const { sectionId } = req.query as any;
    const where: any = { studentId: user.studentId };
    if (sectionId) where.sectionId = parseInt(sectionId as string);

    const records = await prisma.attendance.findMany({
      where,
      include: {
        section: { include: { course: { select: { name: true } } } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch {
    res.status(500).json({ error: 'خطأ في جلب سجلات الحضور' });
  }
});

// POST /api/attendance — record single attendance
router.post('/', authMiddleware, requirePermission('attendance.manage'), async (req, res) => {
  const { sectionId, studentId, date, status, notes } = req.body;
  if (!sectionId || !studentId || !date || !status) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة (sectionId, studentId, date, status)' });
  }
  try {
    const sec = await prisma.section.findUnique({ where: { id: parseInt(sectionId) } });
    if (!sec) return res.status(404).json({ error: 'الشعبة غير موجودة' });
    if (!sec.instructorCanEditAttendance) return res.status(403).json({ error: 'تم تأمين الحضور، لا يمكن التعديل' });

    // Validate day (skipped for per-day schedule sections where days is empty)
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const day = dayNames[new Date(date).getDay()];
    const sectionDays: string[] = JSON.parse(sec.days);
    if (sectionDays.length > 0 && !sectionDays.includes(day)) return res.status(400).json({ error: `اليوم المحدد ليس من أيام انعقاد الشعبة` });

    const record = await prisma.attendance.upsert({
      where: {
        sectionId_studentId_date: {
          sectionId: parseInt(sectionId),
          studentId,
          date: new Date(date)
        }
      },
      update: { status, notes: notes || null },
      create: { sectionId: parseInt(sectionId), studentId, date: new Date(date), status, notes: notes || null }
    });
    res.json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'فشل تسجيل الحضور' });
  }
});

// POST /api/attendance/bulk — record attendance for multiple students at once
router.post('/bulk', authMiddleware, requirePermission('attendance.manage'), async (req, res) => {
  const { sectionId, date, records } = req.body as {
    sectionId: string;
    date: string;
    records: Array<{ studentId: string; status: string; notes?: string }>;
  };

  if (!sectionId || !date || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  try {
    const sec = await prisma.section.findUnique({ where: { id: parseInt(sectionId) } });
    if (!sec) return res.status(404).json({ error: 'الشعبة غير موجودة' });
    if (!sec.instructorCanEditAttendance) return res.status(403).json({ error: 'تم تأمين الحضور، لا يمكن التعديل' });

    // Validate day (skipped for per-day schedule sections where days is empty)
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const day = dayNames[new Date(date).getDay()];
    const sectionDays: string[] = JSON.parse(sec.days);
    if (sectionDays.length > 0 && !sectionDays.includes(day)) return res.status(400).json({ error: `اليوم "${day}" ليس من أيام انعقاد الشعبة (${sectionDays.join(', ')})` });

    const secId = parseInt(sectionId);
    const attendanceDate = new Date(date);
    const ops = records.map(r =>
      prisma.attendance.upsert({
        where: {
          sectionId_studentId_date: {
            sectionId: secId,
            studentId: r.studentId,
            date: attendanceDate
          }
        },
        update: { status: r.status, notes: r.notes || null },
        create: { sectionId: secId, studentId: r.studentId, date: attendanceDate, status: r.status, notes: r.notes || null }
      })
    );
    await prisma.$transaction(ops);

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'CREATE',
        entity: 'Attendance',
        details: JSON.stringify({ sectionId, date, count: ops.length })
      }
    });
    res.json({ success: true, count: ops.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'فشل تسجيل الحضور الجماعي' });
  }
});

// POST /api/attendance/lock/:sectionId — admin/instructor locks attendance editing
router.post('/lock/:sectionId', authMiddleware, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);
    const sec = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!sec) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    const user = (req as any).user;
    if (user.role === 'INSTRUCTOR' && user.instructorId !== sec.instructorId) {
      return res.status(403).json({ error: 'لا تملك صلاحية على هذه الشعبة' });
    }

    await prisma.section.update({
      where: { id: sectionId },
      data: { instructorCanEditAttendance: false }
    });
    res.json({ success: true, message: 'تم تأمين الحضور' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/unlock/:sectionId — admin re-opens attendance editing
router.post('/unlock/:sectionId', authMiddleware, requirePermission('attendance.admin'), async (req, res) => {
  try {
    await prisma.section.update({
      where: { id: parseInt(req.params.sectionId as string) },
      data: { instructorCanEditAttendance: true }
    });
    res.json({ success: true, message: 'تم فتح الحضور للتعديل' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/recalculate-deprivation/:sectionId
router.post('/recalculate-deprivation/:sectionId', authMiddleware, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        students: { select: { studentId: true, attendanceOverride: true, attendanceOverrideReason: true } }
      }
    });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    const allRecords = await prisma.attendance.findMany({
      where: { sectionId },
      select: { studentId: true, status: true }
    });

    const absentCounts: Record<string, number> = {};
    allRecords.forEach(r => {
      if (r.status === 'ABSENT' || r.status === 'LATE') {
        absentCounts[r.studentId] = (absentCounts[r.studentId] || 0) + 1;
      }
    });

    const updates = section.students.map(ss => {
      let status: string;
      if (ss.attendanceOverride) {
        status = 'EXEMPTED';
      } else {
        const absences = absentCounts[ss.studentId] || 0;
        status = absences > section.maxAbsences ? 'DEPRIVED' : 'ELIGIBLE';
      }
      return prisma.studentSection.updateMany({
        where: { studentId: ss.studentId, sectionId },
        data: { attendanceStatus: status }
      });
    });

    await prisma.$transaction(updates);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/override-deprivation/:sectionId/student/:studentId
router.post('/override-deprivation/:sectionId/student/:studentId', authMiddleware, requirePermission('attendance.admin'), async (req, res) => {
  try {
    const sectionId = req.params.sectionId as string;
    const studentId = req.params.studentId as string;
    const { reason } = req.body;
    await prisma.studentSection.update({
      where: { studentId_sectionId: { studentId, sectionId: parseInt(sectionId) } },
      data: {
        attendanceOverride: true,
        attendanceOverrideReason: reason || 'تجاوز يدوي',
        attendanceStatus: 'EXEMPTED'
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/remove-override/:sectionId/student/:studentId
router.post('/remove-override/:sectionId/student/:studentId', authMiddleware, requirePermission('attendance.admin'), async (req, res) => {
  try {
    const sectionId = req.params.sectionId as string;
    const studentId = req.params.studentId as string;
    await prisma.studentSection.update({
      where: { studentId_sectionId: { studentId, sectionId: parseInt(sectionId) } },
      data: {
        attendanceOverride: false,
        attendanceOverrideReason: null,
        attendanceStatus: null // will be recalculated
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/section-summary/:sectionId  — per-student summary across all dates
router.get('/section-summary/:sectionId', authMiddleware, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        course: true,
        students: {
          where: { status: 'ENROLLED' },
          include: { student: { select: { id: true, fullNameAr: true, phones: true } } }
        }
      }
    });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    // Check instructor access
    const user = (req as any).user;
    if (user.role === 'INSTRUCTOR' && user.instructorId !== section.instructorId) {
      return res.status(403).json({ error: 'هذه الشعبة ليست من شعبك' });
    }

    const sessions = await prisma.attendance.groupBy({
      by: ['date'],
      where: { sectionId },
      _count: { id: true },
      orderBy: { date: 'desc' }
    });

    const allRecords = await prisma.attendance.findMany({
      where: { sectionId },
      select: { studentId: true, status: true }
    });

    const studentStats = section.students.map(ss => {
      const records = allRecords.filter(r => r.studentId === ss.student.id);
      return {
        id: ss.student.id,
        fullName: ss.student.fullNameAr,
        phone: ss.student.phones,
        totalSessions: sessions.length,
        present: records.filter(r => r.status === 'PRESENT').length,
        absent: records.filter(r => r.status === 'ABSENT').length,
        late: records.filter(r => r.status === 'LATE').length,
        excused: records.filter(r => r.status === 'EXCUSED').length
      };
    });

    res.json({
      section,
      totalSessions: sessions.length,
      sessionDates: sessions.map(s => s.date),
      students: studentStats,
      maxAbsences: section.maxAbsences
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطأ في جلب ملخص الحضور' });
  }
});

// DELETE /api/attendance/:id
router.delete('/:id', authMiddleware, requirePermission('attendance.admin'), async (req, res) => {
  try {
    await prisma.attendance.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'فشل حذف السجل' });
  }
});

export default router;
