import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Check if two sections have overlapping schedules (accounts for per-day schedule)
const sectionsOverlap = (a: any, b: any) => {
  const aPerDay = a.perDaySchedule && a.scheduleDetails;
  const bPerDay = b.perDaySchedule && b.scheduleDetails;
  if (!aPerDay && !bPerDay) {
    return daysOverlap(a.days, b.days) && checkOverlap(a.startTime, b.startTime, a.endTime, b.endTime);
  }
  // Use schedule details
  const aSlots = aPerDay ? safeParseJSON(a.scheduleDetails, []) : [{ day: '', startTime: a.startTime, endTime: a.endTime }];
  const bSlots = bPerDay ? safeParseJSON(b.scheduleDetails, []) : [{ day: '', startTime: b.startTime, endTime: b.endTime }];
  const aDays = aSlots.map((s: any) => s.day);
  const bDays = bSlots.map((s: any) => s.day);
  const commonDays = aDays.filter((d: string) => bDays.includes(d));
  if (commonDays.length === 0) return false;
  for (const day of commonDays) {
    const aSlot = aSlots.find((s: any) => s.day === day) || aSlots[0];
    const bSlot = bSlots.find((s: any) => s.day === day) || bSlots[0];
    if (checkOverlap(aSlot.startTime, aSlot.endTime, bSlot.startTime, bSlot.endTime)) return true;
  }
  return false;
};

// Safe JSON parse helper
const safeParseJSON = (val: any, fallback: any) => {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
};

router.get('/', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  try {
    const { status, entityId, categoryId, courseId, diplomaId } = req.query;
    const where: any = {};
    if (status) where.status = status as string;
    if (courseId) where.courseId = courseId as string;
    const courseFilter: any = {};
    if (entityId) courseFilter.entityId = parseInt(entityId as string);
    if (categoryId) courseFilter.categoryId = parseInt(categoryId as string);
    if (diplomaId) {
      const diplomaCourses = await prisma.diplomaCourse.findMany({
        where: { diplomaId: diplomaId as string },
        select: { courseId: true }
      });
      courseFilter.id = { in: diplomaCourses.map(dc => dc.courseId) };
    }
    if (Object.keys(courseFilter).length) where.course = courseFilter;

    const sections = await prisma.section.findMany({
      where,
      include: {
        course: { include: { category: true } }, room: { include: { entity: true } }, instructor: true,
        _count: { select: { students: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sections);
  } catch { res.status(500).json({ error: 'خطأ في جلب الشعب' }); }
});

router.get('/:id', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: {
        course: true, room: { include: { entity: true } }, instructor: true,
        students: { include: { student: true } },
        attendances: { orderBy: { date: 'desc' }, take: 100 }
      }
    });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });
    res.json(section);
  } catch { res.status(500).json({ error: 'خطأ في جلب الشعبة' }); }
});

// Helper overlap checks — exported for reuse
export const checkOverlap = (s1: string, e1: string, s2: string, e2: string) => s1 < e2 && e1 > s2;
export const daysOverlap = (d1str: string, d2str: string) => {
  try {
    const d1: string[] = JSON.parse(d1str), d2: string[] = JSON.parse(d2str);
    return d1.some(d => d2.includes(d));
  } catch { return false; }
};

router.get('/:id/conflicts', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: { course: true, room: true, instructor: true }
    });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    const conflicts = await prisma.section.findMany({
      where: {
        id: { not: section.id },
        status: 'OPEN',
        OR: [
          { roomId: section.roomId },
          { instructorId: section.instructorId }
        ]
      },
      include: { course: true, room: true, instructor: true, students: true }
    });

    const result = conflicts.filter(s => 
      daysOverlap(section.days, s.days) && checkOverlap(section.startTime, section.endTime, s.startTime, s.endTime)
    ).map(s => ({
      id: s.id,
      name: s.name,
      courseName: s.course.name,
      days: JSON.parse(s.days),
      startTime: s.startTime,
      endTime: s.endTime,
      roomName: s.room.name,
      instructorName: s.instructor.name,
      studentCount: s.students.length,
      conflictType: s.roomId === section.roomId ? 'ROOM' : 'INSTRUCTOR'
    }));

    res.json(result);
  } catch { res.status(500).json({ error: 'خطأ في جلب التعارضات' }); }
});

router.post('/', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  const { courseId, roomId, instructorId, days, startTime, endTime, startDate, endDate, capacity, name, maxAbsences, perDaySchedule, scheduleDetails } = req.body;
  if (!courseId || !roomId || !instructorId) {
    return res.status(400).json({ error: 'الدورة والقاعة والمدرّس إجبارية' });
  }
  if (!perDaySchedule && (!days || !startTime || !endTime)) {
    return res.status(400).json({ error: 'الأيام والوقت إجباريان' });
  }
  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });

    // Auto-generate section name: "{courseName} {nextNumber}" if not provided
    let sectionName = name;
    if (!sectionName) {
      // Find all existing sections for this course and extract numbers
      const existing = await prisma.section.findMany({
        where: { courseId },
        select: { name: true },
        orderBy: { createdAt: 'desc' }
      });
      const numbers = existing
        .map(s => s.name ? parseInt(s.name.replace(/^.*\s+(\d+)$/, '$1')) : 0)
        .filter(n => !isNaN(n) && n > 0);
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      sectionName = `${course.name} ${nextNumber}`;
    } else {
      // If user provided a name, check it doesn't conflict with a non-COMPLETED section
      const conflict = await prisma.section.findFirst({
        where: { courseId, name: sectionName, status: { notIn: ['COMPLETED', 'CLOSED'] } }
      });
      if (conflict) {
        return res.status(409).json({ error: `يوجد شعبة بنفس الاسم "${sectionName}" غير منتهية. اختر رقماً آخر.` });
      }
    }

    // Room conflict check — use effective schedule
    const roomSections = await prisma.section.findMany({ where: { roomId: parseInt(roomId), status: 'OPEN' } });
    for (const rs of roomSections) {
      if (sectionsOverlap({ days, startTime, endTime, perDaySchedule, scheduleDetails }, rs)) {
        return res.status(409).json({ error: `تعارض في القاعة مع الشعبة: ${rs.name || rs.id}` });
      }
    }
    // Instructor conflict check
    const instSections = await prisma.section.findMany({ where: { instructorId: parseInt(instructorId), status: 'OPEN' } });
    for (const is of instSections) {
      if (sectionsOverlap({ days, startTime, endTime, perDaySchedule, scheduleDetails }, is)) {
        return res.status(409).json({ error: `تعارض في جدول المدرّس مع الشعبة: ${is.name || is.id}` });
      }
    }
    const section = await prisma.section.create({
      data: {
        name: sectionName, courseId, roomId: parseInt(roomId), instructorId: parseInt(instructorId),
        days: perDaySchedule ? '[]' : days,
        startTime: perDaySchedule ? '' : startTime,
        endTime: perDaySchedule ? '' : endTime,
        perDaySchedule: !!perDaySchedule,
        scheduleDetails: perDaySchedule ? scheduleDetails : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        capacity: parseInt(capacity) || 30,
        maxAbsences: parseInt(maxAbsences) || 3
      },
      include: { course: true, room: true, instructor: true }
    });

    // Auto-create pending lecturer payment
    const instructor = await prisma.instructor.findUnique({ where: { id: parseInt(instructorId) } });
    if (instructor && instructor.courseRate > 0) {
      await prisma.instructorPayment.upsert({
        where: { instructorId_sectionId: { instructorId: parseInt(instructorId), sectionId: section.id } },
        update: {},
        create: {
          instructorId: parseInt(instructorId),
          sectionId: section.id,
          courseId,
          amount: instructor.courseRate,
          status: 'PENDING'
        }
      });
    }

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: { userId: actingUser.id, action: 'CREATE', entity: 'Section', details: JSON.stringify({ courseId, name }) }
    });
    res.json(section);
  } catch (err: any) { res.status(400).json({ error: err.message || 'فشل إنشاء الشعبة' }); }
});

router.put('/:id', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.capacity) data.capacity = parseInt(data.capacity);
    const section = await prisma.section.update({ where: { id: parseInt(req.params.id as string) }, data });
    res.json(section);
  } catch { res.status(400).json({ error: 'فشل تحديث الشعبة' }); }
});

router.delete('/:id', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  try {
    await prisma.section.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'فشل حذف الشعبة' }); }
});

// Add student to section (with time conflict check)
router.post('/:id/students', authMiddleware, requirePermission('sections.assign'), async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'الطالب مطلوب' });
  const sectionId = parseInt(req.params.id as string);
  if (isNaN(sectionId)) return res.status(400).json({ error: 'معرف الشعبة غير صالح' });
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: true }
    }).catch(e => { console.error('step1 section.findUnique', e?.message, e?.code); throw e; });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });
    const enrolledCount = await prisma.studentSection.count({
      where: { sectionId: section.id, status: 'ENROLLED' }
    }).catch(e => { console.error('step2 count', e?.message, e?.code); throw e; });
    if (enrolledCount >= section.capacity) {
      return res.status(400).json({ error: 'الشعبة ممتلئة' });
    }

    // Check time conflict with student's existing sections
    const existingSections = await prisma.studentSection.findMany({
      where: { studentId, status: 'ENROLLED', section: { status: 'OPEN' } },
      include: { section: { include: { course: true } } }
    }).catch(e => { console.error('step3 existingSections', e?.message, e?.code); throw e; });
    for (const es of existingSections) {
      const sec = es.section as any;
      if (sectionsOverlap(section, sec)) {
        const courseName = sec.course?.name || '';
        const esDays = sec.perDaySchedule && sec.scheduleDetails
          ? safeParseJSON(sec.scheduleDetails, []).map((s: any) => s.day)
          : safeParseJSON(sec.days, []);
        const esTime = sec.perDaySchedule && sec.scheduleDetails
          ? safeParseJSON(sec.scheduleDetails, []).map((s: any) => `${s.startTime}-${s.endTime}`).join(', ')
          : `${sec.startTime}-${sec.endTime}`;
        return res.status(409).json({
          error: `تعارض في الموعد: الطالب مسجل في شعبة "${sec.name || sec.id}" لدورة "${courseName}" (${Array.isArray(esDays) ? esDays.join(' - ') : esDays} ${esTime})`,
          conflict: {
            sectionId: sec.id,
            sectionName: sec.name,
            courseName,
            days: esDays,
            startTime: sec.startTime,
            endTime: sec.endTime,
          }
        });
      }
    }

    // Check min payment
    const minPayment = section.course?.minPayment || 0;
    if (minPayment > 0) {
      // Check if student has diploma subscription whose diploma includes this course
      const diplomaSubs = await prisma.diplomaSubscription.findMany({
        where: { studentId, diploma: { courses: { some: { courseId: section.courseId } } } },
        select: { id: true, diplomaId: true, minPaymentException: true }
      }).catch(e => { console.error('step4 diplomaSubs', e?.message, e?.code); throw e; });

      let exempt = diplomaSubs.some(s => s.minPaymentException);

      // If not exempt via exception, check if diploma min payment has been met
      if (!exempt && diplomaSubs.length > 0) {
        const dipSubIds = diplomaSubs.map(s => String(s.id));
        const diplomaIds = diplomaSubs.map(s => s.diplomaId);
        const [diplomaPaid, diplomas] = await Promise.all([
          prisma.installment.aggregate({
            where: { studentId, subscriptionId: { in: dipSubIds }, status: 'PAID' },
            _sum: { amount: true }
          }).catch(e => { console.error('step5a installment.aggregate', e?.message, e?.code); throw e; }),
          prisma.diploma.findMany({
            where: { id: { in: diplomaIds }, courses: { some: { courseId: section.courseId } } },
            select: { id: true, minPayment: true }
          }).catch(e => { console.error('step5b diploma.findMany', e?.message, e?.code); throw e; }),
        ]);
        const totalPaid = diplomaPaid._sum.amount || 0;
        const diplomaMin = Math.max(...diplomas.map(d => d.minPayment), 0);
        if (totalPaid >= diplomaMin) exempt = true;
      }

      if (!exempt) {
        // Only check course min payment for non-diploma or unexempt students
        const courseSubs = await prisma.courseSubscription.findMany({
          where: { studentId, courseId: section.courseId, status: 'ACTIVE' },
        select: { id: true, minPaymentException: true }
        }).catch(e => { console.error('step6 courseSubs', e?.message, e?.code); throw e; });
        const hasException = courseSubs.some(s => s.minPaymentException);
        if (!hasException) {
          const subIds = courseSubs.map(s => String(s.id));
          const paidInsts = await prisma.installment.findMany({
            where: { studentId, subscriptionId: { in: subIds }, subscriptionType: 'COURSE', status: 'PAID' }
          }).catch(e => { console.error('step7 paidInsts', e?.message, e?.code); throw e; });
          const paid = paidInsts.reduce((sum, inst) => sum + inst.amount, 0);
          if (paid < minPayment) {
            return res.status(400).json({
              error: `لم يتم دفع الحد الأدنى (${minPayment} د). المدفوع: ${paid} د. يجب دفع ${minPayment - paid} د إضافية أو تفعيل استثناء الدفع`,
              minPayment: { required: minPayment, paid, remaining: minPayment - paid }
            });
          }
        }
      }
    }

    // Check if student has existing record (e.g., TRANSFERRED) — reactivate instead of creating new
    const existingSS = await prisma.studentSection.findUnique({
      where: { studentId_sectionId: { studentId, sectionId } }
    }).catch(e => { console.error('step8 findUnique', e?.message, e?.code); throw e; });
    let ss;
    if (existingSS) {
      ss = await prisma.studentSection.update({
        where: { studentId_sectionId: { studentId, sectionId } },
        data: { status: 'ENROLLED', enrollDate: new Date() },
        include: { student: true, section: { include: { course: true } } }
      }).catch(e => { console.error('step9 update', e?.message, e?.code); throw e; });
    } else {
      ss = await prisma.studentSection.create({
        data: { studentId, sectionId },
        include: { student: true, section: { include: { course: true } } }
      }).catch(e => { console.error('step10 create', e?.message, e?.code); throw e; });
    }
    res.json(ss);
  } catch (err: any) {
    console.error('POST /sections/:id/students error', err?.message || err, err?.code, err?.meta);
    if (err.code === 'P2002') return res.status(400).json({ error: 'الطالب مسجّل في هذه الشعبة مسبقاً' });
    res.status(400).json({ error: 'فشل إضافة الطالب للشعبة' });
  }
});

// Remove student from section
router.delete('/:id/students/:studentId', authMiddleware, requirePermission('sections.assign'), async (req, res) => {
  try {
    await prisma.studentSection.deleteMany({
      where: { sectionId: parseInt(req.params.id as string), studentId: (req.params.studentId as string) }
    });
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'فشل إزالة الطالب' }); }
});

// Get a student's enrolled sections with schedule info
router.get('/students/:studentId/enrolled-sections', authMiddleware, requirePermission('sections.manage'), async (req, res) => {
  try {
    const studentId = req.params.studentId as string;
    const records = await prisma.studentSection.findMany({
      where: { studentId, status: 'ENROLLED', section: { status: 'OPEN' } },
      include: { section: { include: { course: true, instructor: true, room: { include: { entity: true } } } } }
    });
    res.json(records.map(ss => ({
      id: ss.section.id,
      name: ss.section.name,
      courseId: ss.section.courseId,
      courseName: ss.section.course?.name || '',
      days: ss.section.days,
      startTime: ss.section.startTime,
      endTime: ss.section.endTime,
      instructorName: ss.section.instructor?.name || '',
      roomName: ss.section.room?.name || '',
      roomLearningType: ss.section.room?.learningType || null,
      roomModality: ss.section.room?.modality || null,
      roomEntityName: ss.section.room?.entity?.name || '',
      roomAddress: ss.section.room?.address || '',
      startDate: ss.section.startDate,
      endDate: ss.section.endDate,
      enrollDate: ss.enrollDate,
    })));
  } catch {
    res.status(500).json({ error: 'خطأ في جلب شعب الطالب' });
  }
});

// Transfer student between sections (moves attendance + grades)
router.post('/transfer', authMiddleware, requirePermission('sections.assign'), async (req, res) => {
  const { studentId, fromSectionId, toSectionId } = req.body;
  if (!studentId || !fromSectionId || !toSectionId) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  const fromId = parseInt(fromSectionId);
  const toId = parseInt(toSectionId);
  if (fromId === toId) return res.status(400).json({ error: 'نفس الشعبة' });

  try {
    // 1. Check source enrollment exists
    const sourceSS = await prisma.studentSection.findUnique({
      where: { studentId_sectionId: { studentId, sectionId: fromId } }
    });
    if (!sourceSS) return res.status(404).json({ error: 'الطالب غير مسجل في الشعبة المصدر' });

    // 2. Check target section (count only ENROLLED for capacity)
    const target = await prisma.section.findUnique({
      where: { id: toId }
    });
    if (!target) return res.status(404).json({ error: 'الشعبة الهدف غير موجودة' });
    if (target.status !== 'OPEN') return res.status(400).json({ error: 'الشعبة الهدف غير مفتوحة' });
    const enrolledCount = await prisma.studentSection.count({
      where: { sectionId: toId, status: 'ENROLLED' }
    });
    if (enrolledCount >= target.capacity) return res.status(400).json({ error: 'الشعبة الهدف ممتلئة' });

    // 3. Same course check
    const source = await prisma.section.findUnique({
      where: { id: fromId }, select: { courseId: true }
    });
    if (!source || source.courseId !== target.courseId) {
      return res.status(400).json({ error: 'يجب أن تكون الشعبتان لنفس الدورة' });
    }

    // 4. Check if student can transfer to target
    const inTarget = await prisma.studentSection.findUnique({
      where: { studentId_sectionId: { studentId, sectionId: toId } }
    });
    if (inTarget && inTarget.status === 'ENROLLED') {
      return res.status(400).json({ error: 'الطالب مسجل بالفعل في الشعبة الهدف' });
    }

    // 5. Time conflict with other enrolled sections (excl. current and target)
    const others = await prisma.studentSection.findMany({
      where: { studentId, status: 'ENROLLED', sectionId: { notIn: [fromId, toId] } },
      include: { section: true }
    });
    for (const o of others) {
      if (daysOverlap(target.days, o.section.days) && checkOverlap(target.startTime, target.endTime, o.section.startTime, o.section.endTime)) {
        return res.status(409).json({
          error: `تعارض في الموعد مع الشعبة: ${o.section.name || o.section.id}`
        });
      }
    }

    // 6. Execute transfer
    const ops = [
      prisma.studentSection.update({
        where: { studentId_sectionId: { studentId, sectionId: fromId } },
        data: { status: 'TRANSFERRED' }
      }),
      prisma.transferLog.create({
        data: { studentId, fromSectionId: fromId, toSectionId: toId }
      }),
    ];

    if (inTarget) {
      // Re-activate existing record (was TRANSFERRED, WITHDRAWN, etc.)
      ops.push(
        prisma.studentSection.update({
          where: { studentId_sectionId: { studentId, sectionId: toId } },
          data: { status: 'ENROLLED', enrollDate: new Date() }
        })
      );
    } else {
      // No existing record — create new
      ops.push(
        prisma.studentSection.create({
          data: { studentId, sectionId: toId, status: 'ENROLLED' }
        })
      );
    }

    await prisma.$transaction(ops);

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'TRANSFER',
        entity: 'StudentSection',
        details: JSON.stringify({ studentId, fromSectionId: fromId, toSectionId: toId })
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'الطالب مسجل بالفعل في الشعبة الهدف' });
    res.status(400).json({ error: err.message || 'فشل نقل الطالب' });
  }
});

// Get transfer log for a student
router.get('/students/:studentId/transfer-log', authMiddleware, requirePermission('students.view'), async (req, res) => {
  try {
    const studentId = req.params.studentId as string;
    const logs = await prisma.transferLog.findMany({
      where: { studentId },
      include: {
        fromSection: { include: { course: true, instructor: true, room: { include: { entity: true } } } },
        toSection: { include: { course: true, instructor: true, room: { include: { entity: true } } } },
      },
      orderBy: { transferredAt: 'desc' }
    });
    res.json(logs.map(log => ({
      id: log.id,
      transferredAt: log.transferredAt,
      from: {
        id: log.fromSection.id,
        name: log.fromSection.name,
        courseName: log.fromSection.course?.name || '',
        days: log.fromSection.days,
        startTime: log.fromSection.startTime,
        endTime: log.fromSection.endTime,
        instructorName: log.fromSection.instructor?.name || '',
        roomName: log.fromSection.room?.name || '',
        roomLearningType: log.fromSection.room?.learningType || null,
        roomModality: log.fromSection.room?.modality || null,
        roomEntityName: log.fromSection.room?.entity?.name || '',
      },
      to: {
        id: log.toSection.id,
        name: log.toSection.name,
        courseName: log.toSection.course?.name || '',
        days: log.toSection.days,
        startTime: log.toSection.startTime,
        endTime: log.toSection.endTime,
        instructorName: log.toSection.instructor?.name || '',
        roomName: log.toSection.room?.name || '',
        roomLearningType: log.toSection.room?.learningType || null,
        roomModality: log.toSection.room?.modality || null,
        roomEntityName: log.toSection.room?.entity?.name || '',
      },
    })));
  } catch {
    res.status(500).json({ error: 'خطأ في جلب سجل التنقلات' });
  }
});

export default router;
