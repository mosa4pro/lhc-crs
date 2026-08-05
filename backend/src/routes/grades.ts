import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission, selfOrPerm } from '../middleware/auth.js';

const router = express.Router();

// GET sections for instructor (already exists, updated)
router.get('/sections', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { courseId } = req.query;
    const where: any = {};
    if (courseId) where.courseId = courseId as string;

    let sections;

    if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
      sections = await prisma.section.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: {
          course: { include: { category: true } },
          room: true,
          instructor: true,
          _count: { select: { students: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else if (user.role === 'INSTRUCTOR') {
      const instructor = await prisma.instructor.findUnique({ where: { id: user.instructorId } });
      if (!instructor) return res.status(400).json({ error: 'حساب المحاضر غير مرتبط بملف محاضر' });
      sections = await prisma.section.findMany({
        where: { ...where, instructorId: instructor.id },
        include: {
          course: { include: { category: true } },
          room: true,
          instructor: true,
          _count: { select: { students: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      return res.status(403).json({ error: 'غير مصرّح' });
    }

    return res.json(sections);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET enrolled students for a section (with grades)
router.get('/section/:sectionId/students', authMiddleware, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    const user = (req as any).user;
    if (user.role === 'INSTRUCTOR' && user.instructorId !== section.instructorId) {
      return res.status(403).json({ error: 'هذه الشعبة ليست من شعبك' });
    }

    const enrollments = await prisma.studentSection.findMany({
      where: { sectionId },
      include: { student: true },
      orderBy: { enrollDate: 'asc' }
    });
    return res.json({ enrollments, instructorCanEdit: section.instructorCanEditGrades });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST bulk save grades for a section
router.post('/bulk', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const { sectionId, records } = req.body;
    if (!sectionId || !Array.isArray(records)) {
      return res.status(400).json({ error: 'sectionId و records مطلوبان' });
    }

    const secId = parseInt(sectionId);
    const section = await prisma.section.findUnique({ where: { id: secId } });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });
    if (!section.instructorCanEditGrades) return res.status(403).json({ error: 'تم اعتماد العلامات، لا يمكن التعديل' });

    const results = [];
    for (const rec of records) {
      const { studentId, grade, isProject, projectResult, supervisorApproved } = rec;
      const data: any = {};
      if (grade !== undefined) data.grade = parseFloat(grade);
      if (isProject !== undefined) data.isProject = isProject;
      if (projectResult !== undefined) data.result = projectResult;
      if (supervisorApproved !== undefined && (req as any).user.role !== 'INSTRUCTOR') {
        data.supervisorApproved = supervisorApproved;
      }

      // Auto-calculate result for grades (not projects)
      if (data.isProject === undefined) data.isProject = false;
      if (!data.isProject && data.grade !== undefined) {
        data.result = data.grade >= 50 ? 'PASS' : 'FAIL';
      } else if (!data.isProject && data.grade === undefined && projectResult === undefined) {
        // No grade, no project result — leave result unchanged
      }

      const enrollment = await prisma.studentSection.upsert({
        where: { studentId_sectionId: { studentId, sectionId: secId } },
        update: data,
        create: { studentId, sectionId: secId, ...data }
      });

      // If supervisor approved (admin only) and passing, mark as COMPLETED
      if (data.supervisorApproved && data.result === 'PASS') {
        await prisma.studentSection.update({
          where: { id: enrollment.id },
          data: { status: 'COMPLETED' }
        });
      }

      results.push(enrollment);
    }
    return res.json(results);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل الحفظ الجماعي للعلامات' });
  }
});

// POST approve instructor grades — instructor locks their grades
router.post('/approve-instructor/:sectionId', authMiddleware, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });

    const user = (req as any).user;
    if (user.role === 'INSTRUCTOR' && user.instructorId !== section.instructorId) {
      return res.status(403).json({ error: 'لا تملك صلاحية على هذه الشعبة' });
    }

    // Lock grades for instructor editing
    await prisma.section.update({
      where: { id: sectionId },
      data: { instructorCanEditGrades: false }
    });

    // Mark all enrollments as grade-approved-by-instructor
    await prisma.studentSection.updateMany({
      where: { sectionId },
      data: { gradeApprovedByInstructor: true, gradeEditable: false }
    });

    res.json({ success: true, message: 'تم اعتماد العلامات من قبل المحاضر' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST approve admin grades — admin final approval
router.post('/approve-admin/:sectionId', authMiddleware, requirePermission('grades.approve'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);
    await prisma.studentSection.updateMany({
      where: { sectionId },
      data: { gradeApprovedByAdmin: true }
    });
    // Mark passing students as COMPLETED
    await prisma.studentSection.updateMany({
      where: { sectionId, result: 'PASS' },
      data: { status: 'COMPLETED' }
    });
    res.json({ success: true, message: 'تم اعتماد العلامات نهائياً' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST unlock instructor grades — admin re-opens grades
router.post('/unlock-instructor/:sectionId', authMiddleware, requirePermission('grades.approve'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId as string);
    await prisma.section.update({
      where: { id: sectionId },
      data: { instructorCanEditGrades: true }
    });
    await prisma.studentSection.updateMany({
      where: { sectionId },
      data: { gradeApprovedByInstructor: false, gradeEditable: true }
    });
    res.json({ success: true, message: 'تم فتح العلامات للتعديل' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update grades for a student enrollment
router.put('/section/:sectionId/student/:studentId', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const { grade, isProject, projectResult, supervisorApproved } = req.body;
    const sectionId = parseInt(req.params.sectionId as string);

    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return res.status(404).json({ error: 'الشعبة غير موجودة' });
    if (!section.instructorCanEditGrades) return res.status(403).json({ error: 'العلامات مؤمنة، لا يمكن التعديل' });

    const data: any = {};

    if (grade !== undefined) data.grade = parseFloat(grade);
    if (isProject !== undefined) data.isProject = isProject;
    if (projectResult !== undefined) data.result = projectResult;
    if (supervisorApproved !== undefined && (req as any).user.role !== 'INSTRUCTOR') {
      data.supervisorApproved = supervisorApproved;
    }

    // Auto-calculate result
    const current = await prisma.studentSection.findUnique({
      where: { studentId_sectionId: { studentId: (req.params.studentId as string), sectionId } }
    });

    const isProj = data.isProject ?? current?.isProject ?? false;
    if (isProj) {
      // Project: result already set from projectResult above
    } else {
      const grd = data.grade ?? current?.grade;
      if (grd !== null && grd !== undefined) {
        data.result = grd >= 50 ? 'PASS' : 'FAIL';
      } else {
        data.result = null; // no grade = no result
      }
    }

    const enrollment = await prisma.studentSection.upsert({
      where: { studentId_sectionId: { studentId: (req.params.studentId as string), sectionId } },
      update: data,
      create: { studentId: (req.params.studentId as string), sectionId, ...data }
    });

    return res.json(enrollment);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل تحديث العلامات' });
  }
});

// GET my grades (student portal)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.studentId) return res.status(404).json({ error: 'لم يتم ربط حسابك ببيانات طالب' });
    const sections = await prisma.studentSection.findMany({
      where: { studentId: user.studentId },
      include: { section: { include: { course: true } } },
      orderBy: { enrollDate: 'asc' }
    });
    return res.json(sections);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET student sections with grades for a student
router.get('/student/:studentId', authMiddleware, selfOrPerm('students.view'), async (req, res) => {
  try {
    const sections = await prisma.studentSection.findMany({
      where: { studentId: (req.params.studentId as string) },
      include: { section: { include: { course: true } } },
      orderBy: { enrollDate: 'asc' }
    });
    return res.json(sections);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET admin view of student sections with grades
router.get('/admin/student-sections', authMiddleware, requirePermission('students.view'), async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId query parameter is required' });
    const sections = await prisma.studentSection.findMany({
      where: { studentId: studentId as string },
      include: { section: { include: { course: true, room: true } } },
      orderBy: { enrollDate: 'asc' }
    });
    return res.json(sections);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET search grades across sections with filters
router.get('/admin/search', authMiddleware, requirePermission('students.view'), async (req, res) => {
  try {
    const { course, section: sectionName, instructor, student, sectionId, categoryId, diplomaId, courseId } = req.query;

    const where: any = {};
    if (sectionId) {
      where.sectionId = parseInt(sectionId as string);
    }

    const sectionWhere: any = {};
    if (categoryId) sectionWhere.course = { categoryId: parseInt(categoryId as string) };
    if (courseId) sectionWhere.courseId = courseId as string;
    if (course) sectionWhere.course = { ...sectionWhere.course, name: { contains: course as string } };
    if (sectionName) sectionWhere.name = { contains: sectionName as string };
    if (instructor) {
      sectionWhere.instructor = {
        OR: [
          { nameAr: { contains: instructor as string } },
          { nameEn: { contains: instructor as string } },
        ]
      };
    }

    if (diplomaId) {
      const dc = await prisma.diplomaCourse.findMany({
        where: { diplomaId: diplomaId as string },
        select: { courseId: true }
      });
      const cids = dc.map(d => d.courseId);
      sectionWhere.courseId = sectionWhere.courseId
        ? { in: [sectionWhere.courseId, ...cids] }
        : { in: cids };
    }

    if (Object.keys(sectionWhere).length > 0) {
      where.section = sectionWhere;
    }

    if (student) {
      where.student = {
        OR: [
          { fullNameAr: { contains: student as string } },
          { fullNameEn: { contains: student as string } },
          { id: { contains: student as string } },
        ]
      };
    }

    const enrollments = await prisma.studentSection.findMany({
      where,
      include: {
        student: true,
        section: {
          include: {
            course: { include: { category: true } },
            instructor: true,
            room: true,
          }
        }
      },
      orderBy: [
        { section: { course: { name: 'asc' } } },
        { section: { name: 'asc' } },
        { student: { fullNameAr: 'asc' } },
      ],
      take: 500,
    });

    return res.json(enrollments);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
