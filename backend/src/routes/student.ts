import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission, selfOrPerm } from '../middleware/auth.js';
import { normalizeNumbers } from '../utils/searchEngine.js';
import { checkOverlap, daysOverlap } from './section.js';

const router = express.Router();

// ==========================================
// Normalize Arabic/Eastern Arabic digits
// ==========================================
function normalizeDigits(str: string): string {
  return String(str || '')
    .replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06f0-\u06f9]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48));
}

function tryParse(str: string, fallback: any) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ==========================================
// Generate Student System ID: YYYYMMrrrSSSS
// ==========================================
async function generateSystemId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seqKey = `student_${year}_${month}`;

  // Atomic increment of sequence
  const seq = await prisma.systemSequence.upsert({
    where: { key: seqKey },
    update: { current: { increment: 1 } },
    create: { key: seqKey, current: 1 },
  });

  const random3 = String(Math.floor(Math.random() * 900) + 100);
  const seqNum = String(seq.current).padStart(4, '0');
  return `${year}${month}${random3}${seqNum}`;
}

// ==========================================
// GET ALL / SEARCH
// ==========================================
router.get('/', authMiddleware, requirePermission('students.view'), async (req, res) => {
  try {
    const {
      query, status, studentType, nationality,
      dateFrom, dateTo, dobFrom, dobTo,
      universityName, systemId, nationalId,
      nameAr, nameEn, highSchoolPassed,
      sectionId, courseId, diplomaId, markerEmployeeId,
      supervisorEmployeeId, registeredByUserId, noSubscriptions,
      noCourseSubscriptions, noDiplomaSubscriptions,
      hasCourseSubscriptions, hasDiplomaSubscriptions,
      teamLeaderUserId, gradeResult, paymentStatus,
      page, limit
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string) || 50));

    // Build Prisma where clause (push filters to DB)
    const where: any = { AND: [] as any[] };

    // Role-based visibility
    const authUser = (req as any).user;
    if (!authUser?.isAdmin && authUser?.role !== 'ADMIN') {
      let userFilterIds: number[] = [];
      if (authUser?.role === 'SUPERVISOR') {
        const subordinates = await prisma.user.findMany({
          where: { supervisorId: authUser.id },
          select: { id: true }
        });
        userFilterIds = [authUser.id, ...subordinates.map(s => s.id)];
      } else if (authUser?.role === 'TEAM_LEADER') {
        const teamMembers = await prisma.user.findMany({
          where: { teamLeaderId: authUser.id },
          select: { id: true }
        });
        const memberIds = teamMembers.map(m => m.id);
        const subordinates = memberIds.length > 0 ? await prisma.user.findMany({
          where: { supervisorId: { in: memberIds } },
          select: { id: true }
        }) : [];
        userFilterIds = [authUser.id, ...memberIds];
        subordinates.forEach(s => { if (!userFilterIds.includes(s.id)) userFilterIds.push(s.id); });
      } else if (authUser?.role === 'REGISTRAR' || authUser?.role === 'EMPLOYEE') {
        userFilterIds = [authUser.id];
      }

      if (userFilterIds.length > 0) {
        const orConditions: any[] = [{ registeredByUserId: { in: userFilterIds } }];
        if (authUser?.employeeId) {
          const employeeIds: number[] = [authUser.employeeId];
          if (authUser.role === 'SUPERVISOR' || authUser.role === 'TEAM_LEADER') {
            const empSubords = await prisma.user.findMany({
              where: { id: { in: userFilterIds } },
              select: { employeeId: true }
            });
            empSubords.forEach(u => { if (u.employeeId && !employeeIds.includes(u.employeeId)) employeeIds.push(u.employeeId); });
          }
          if (authUser.role === 'REGISTRAR' || authUser.role === 'SUPERVISOR' || authUser.role === 'TEAM_LEADER' || authUser.role === 'EMPLOYEE') {
            orConditions.push({ markerEmployeeId: { in: employeeIds } });
          }
        }
        where.AND.push({ OR: orConditions });
      }
    }

    // Basic filters — pushed to DB
    if (status) where.AND.push({ status });
    if (studentType) where.AND.push({ studentType });
    if (nationality) where.AND.push({ nationality });
    if (highSchoolPassed !== undefined && highSchoolPassed !== '') {
      where.AND.push({ highSchoolPassed: highSchoolPassed === 'true' });
    }
    if (markerEmployeeId) where.AND.push({ markerEmployeeId: parseInt(markerEmployeeId as string) });
    if (supervisorEmployeeId) where.AND.push({ supervisorEmployeeId: parseInt(supervisorEmployeeId as string) });
    if (registeredByUserId) where.AND.push({ registeredByUserId: parseInt(registeredByUserId as string) });
    if (noSubscriptions === 'true') {
      where.AND.push({ courseSubscriptions: { none: {} }, diplomaSubscriptions: { none: {} } });
    }
    if (noCourseSubscriptions === 'true') {
      where.AND.push({ courseSubscriptions: { none: {} } });
    }
    if (noDiplomaSubscriptions === 'true') {
      where.AND.push({ diplomaSubscriptions: { none: {} } });
    }
    if (hasCourseSubscriptions === 'true') {
      where.AND.push({ courseSubscriptions: { some: {} } });
    }
    if (hasDiplomaSubscriptions === 'true') {
      where.AND.push({ diplomaSubscriptions: { some: {} } });
    }
    if (teamLeaderUserId) {
      const tlId = parseInt(teamLeaderUserId as string);
      const teamMembers = await prisma.user.findMany({
        where: { teamLeaderId: tlId },
        select: { id: true, employeeId: true }
      });
      const memberIds = teamMembers.map(m => m.id);
      const subordinates = memberIds.length > 0 ? await prisma.user.findMany({
        where: { supervisorId: { in: memberIds } },
        select: { id: true }
      }) : [];
      const allIds = [tlId, ...memberIds];
      subordinates.forEach(s => { if (!allIds.includes(s.id)) allIds.push(s.id); });
      const employeeIds: number[] = [];
      teamMembers.forEach(m => { if (m.employeeId && !employeeIds.includes(m.employeeId)) employeeIds.push(m.employeeId); });
      where.AND.push({
        OR: [
          { registeredByUserId: { in: allIds } },
          ...(employeeIds.length > 0 ? [{ markerEmployeeId: { in: employeeIds } }] : []),
        ]
      });
    }
    if (universityName) where.AND.push({ universityName: { contains: String(universityName).trim() } });
    if (systemId) where.AND.push({ id: { contains: String(systemId).trim() } });
    if (nationalId) {
      const nid = String(nationalId).trim();
      where.AND.push({
        OR: [
          { nationalId: { contains: nid } },
          { passportId: { contains: nid } },
          { personalId: { contains: nid } },
        ]
      });
    }

    // Name search — push to DB
    if (nameAr) where.AND.push({ fullNameAr: { contains: String(nameAr).trim() } });
    if (nameEn) where.AND.push({ fullNameEn: { contains: String(nameEn).trim(), mode: 'insensitive' } });

    // Date filters
    if (dateFrom) where.AND.push({ registrationDate: { gte: new Date(dateFrom as string) } });
    if (dateTo) where.AND.push({ registrationDate: { lte: new Date(dateTo as string) } });
    if (dobFrom) where.AND.push({ dob: { gte: new Date(dobFrom as string) } });
    if (dobTo) where.AND.push({ dob: { lte: new Date(dobTo as string) } });

    // Complex filters via subqueries
    if (sectionId) {
      const sid = parseInt(sectionId as string);
      where.AND.push({ sections: { some: { sectionId: sid } } });
    }
    if (courseId) {
      where.AND.push({ courseSubscriptions: { some: { courseId: String(courseId) } } });
    }
    if (diplomaId) {
      where.AND.push({ diplomaSubscriptions: { some: { diplomaId: String(diplomaId) } } });
    }
    if (gradeResult) {
      if (gradeResult === 'NO_GRADE') {
        where.AND.push({ sections: { some: { result: null } } });
      } else {
        where.AND.push({ sections: { some: { result: String(gradeResult) } } });
      }
    }
    if (paymentStatus) {
      if (paymentStatus === 'PAID') {
        where.AND.push({
          AND: [
            { courseSubscriptions: { some: { status: 'COMPLETED' } } },
            { diplomaSubscriptions: { some: { status: 'COMPLETED' } } },
          ]
        });
      } else if (paymentStatus === 'PARTIAL') {
        where.AND.push({
          OR: [
            { courseSubscriptions: { some: { status: 'ACTIVE' } } },
            { diplomaSubscriptions: { some: { status: 'ACTIVE' } } },
          ]
        });
      } else if (paymentStatus === 'UNPAID') {
        where.AND.push({
          AND: [
            { courseSubscriptions: { none: {} } },
            { diplomaSubscriptions: { none: {} } },
          ]
        });
      }
    }

    // Simple query search — push to DB as OR across multiple fields
    if (query && typeof query === 'string' && query.trim()) {
      const q = normalizeNumbers(query.trim());
      // Re-create AND if it was cleaned up
      if (!where.AND) where.AND = [];
      where.AND.push({
        OR: [
          { fullNameAr: { contains: q } },
          { fullNameEn: { contains: q, mode: 'insensitive' } },
          { nationalId: { contains: q } },
          { passportId: { contains: q } },
          { personalId: { contains: q } },
          { id: { contains: q } },
        ]
      });
    }

    // Clean up empty AND
    if (where.AND && where.AND.length === 0) delete where.AND;

    // Count total matching records (fast, with indexes)
    const total = await prisma.student.count({ where });

    // Paginated query with minimal includes
    const data = await prisma.student.findMany({
      where,
      include: {
        markerEmployee: { select: { id: true, fullName: true } },
        supervisorEmployee: { select: { id: true, fullName: true } },
        registeredByUser: { select: { id: true, fullName: true, points: true } },
        sections: {
          select: {
            id: true,
            sectionId: true,
            result: true,
            grade: true,
            isProject: true,
            status: true,
            section: {
              select: {
                id: true,
                name: true,
                courseId: true,
                course: { select: { id: true, name: true, categoryId: true, category: { select: { id: true, name: true, nameAr: true } } } },
                instructor: { select: { id: true, name: true } },
                room: { select: { id: true, name: true } },
              }
            }
          },
          orderBy: { enrollDate: 'desc' }
        },
        diplomaSubscriptions: {
          select: { id: true, diplomaId: true, status: true, diploma: { select: { id: true, name: true } }, entity: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        courseSubscriptions: {
          select: { id: true, courseId: true, status: true, course: { select: { id: true, name: true } }, entity: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
      },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    });

    // Parse JSON fields
    const parsed = data.map(s => ({
      ...s,
      phones: tryParse(s.phones, []),
      phoneCodes: tryParse(s.phoneCodes, []),
      whatsappOnly: tryParse(s.whatsappOnly, []),
      isIdNumber: tryParse(s.isIdNumber, []),
    }));

    return res.json({ data: parsed, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'خطأ في جلب الطلاب' });
  }
});

// ==========================================
// CHECK NATIONAL ID UNIQUENESS
// ==========================================
router.get('/check-id', authMiddleware, async (req, res) => {
  try {
    const { nationalId, excludeId } = req.query;
    if (!nationalId) return res.json({ exists: false });

    const student = await prisma.student.findFirst({
      where: {
        nationalId: String(nationalId),
        id: excludeId ? { not: String(excludeId) } : undefined,
      },
      select: { id: true, fullNameAr: true }
    });

    return res.json({
      exists: !!student,
      studentName: student?.fullNameAr || null,
    });
  } catch {
    return res.json({ exists: false });
  }
});

// ==========================================
// GET MY (student portal)
// ==========================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.studentId) return res.status(404).json({ error: 'لم يتم ربط حسابك ببيانات طالب' });

    const student = await prisma.student.findUnique({
      where: { id: user.studentId },
      include: {
        diplomaSubscriptions: { include: { diploma: true, entity: true } },
        courseSubscriptions: { include: { course: true, entity: true } },
        sections: { include: { section: { include: { course: true, room: true, instructor: true } } } },
        financialTransactions: { orderBy: { createdAt: 'desc' } },
        installments: { orderBy: { dueDate: 'asc' } },
        attendances: { orderBy: { date: 'desc' }, take: 100 },
      }
    });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    return res.json({
      ...student,
      phones: tryParse(student.phones, []),
      phoneCodes: tryParse(student.phoneCodes, []),
      whatsappOnly: tryParse(student.whatsappOnly, []),
      isIdNumber: tryParse(student.isIdNumber, []),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'خطأ في جلب بيانات الطالب' });
  }
});

// ==========================================
// GET user hierarchy for student stat cards
// ==========================================
router.get('/users/hierarchy', authMiddleware, requirePermission('students.view'), async (req, res) => {
  const authUser = (req as any).user;
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.permissions?.some((p: any) => p.permission?.name === 'ADMIN_ALL');

  let teamLeaders: any[] = [];
  let supervisors: any[] = [];
  let registrars: any[] = [];

  if (isAdmin) {
    teamLeaders = await prisma.user.findMany({
      where: { role: 'TEAM_LEADER', status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true }
    });
    supervisors = await prisma.user.findMany({
      where: { role: 'SUPERVISOR', status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true, supervisorId: true, teamLeaderId: true, employeeId: true }
    });
    registrars = await prisma.user.findMany({
      where: { role: { in: ['REGISTRAR', 'EMPLOYEE'] }, status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true, supervisorId: true, teamLeaderId: true, employeeId: true }
    });
  } else if (authUser.role === 'TEAM_LEADER') {
    const tlResult = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, fullName: true, role: true }
    });
    if (tlResult) teamLeaders = [tlResult];
    const members = await prisma.user.findMany({
      where: { teamLeaderId: authUser.id, status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true, supervisorId: true, teamLeaderId: true, employeeId: true }
    });
    supervisors = members.filter(u => u.role === 'SUPERVISOR');
    registrars = members.filter(u => u.role === 'REGISTRAR' || u.role === 'EMPLOYEE');
  } else if (authUser.role === 'SUPERVISOR') {
    if (authUser.teamLeaderId) {
      const tl = await prisma.user.findUnique({
        where: { id: authUser.teamLeaderId },
        select: { id: true, fullName: true, role: true }
      });
      if (tl) teamLeaders = [tl];
    }
    const self = { id: authUser.id, fullName: authUser.fullName, role: authUser.role, supervisorId: authUser.supervisorId, teamLeaderId: authUser.teamLeaderId, employeeId: authUser.employeeId };
    supervisors = [self];
    const subordinates = await prisma.user.findMany({
      where: { supervisorId: authUser.id, status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true, supervisorId: true, teamLeaderId: true, employeeId: true }
    });
    registrars = subordinates.filter(u => u.role === 'REGISTRAR' || u.role === 'EMPLOYEE');
  } else if (authUser.role === 'REGISTRAR' || authUser.role === 'EMPLOYEE') {
    if (authUser.teamLeaderId) {
      const tl = await prisma.user.findUnique({
        where: { id: authUser.teamLeaderId },
        select: { id: true, fullName: true, role: true }
      });
      if (tl) teamLeaders = [tl];
    }
    if (authUser.supervisorId) {
      const sup = await prisma.user.findUnique({
        where: { id: authUser.supervisorId },
        select: { id: true, fullName: true, role: true, supervisorId: true, teamLeaderId: true, employeeId: true }
      });
      if (sup) supervisors = [sup];
    }
    registrars = [{ id: authUser.id, fullName: authUser.fullName, role: authUser.role, supervisorId: authUser.supervisorId, teamLeaderId: authUser.teamLeaderId, employeeId: authUser.employeeId }];
  }

  res.json({ teamLeaders, supervisors, registrars });
});

// ==========================================
// GET ONE
// ==========================================
router.get('/:id', authMiddleware, selfOrPerm('students.view'), async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: (req.params.id as string) },
      include: {
        markerEmployee: { select: { id: true, fullName: true } },
        supervisorEmployee: { select: { id: true, fullName: true } },
        registeredByUser: { select: { id: true, fullName: true, points: true } },
        diplomaSubscriptions: { include: { diploma: true, entity: true } },
        courseSubscriptions: { include: { course: true, entity: true } },
        sections: { include: { section: { include: { course: true, room: true, instructor: true } } } },
        financialTransactions: { orderBy: { createdAt: 'desc' } },
        installments: { orderBy: { dueDate: 'asc' } },
        attendances: { orderBy: { date: 'desc' }, take: 100, include: { section: { select: { id: true, course: { select: { name: true } } } } } },
        transferLogs: { orderBy: { transferredAt: 'desc' } },
      }
    });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    return res.json({
      ...student,
      phones: tryParse(student.phones, []),
      phoneCodes: tryParse(student.phoneCodes, []),
      whatsappOnly: tryParse(student.whatsappOnly, []),
      isIdNumber: tryParse(student.isIdNumber, []),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'خطأ في جلب الطالب' });
  }
});

// ==========================================
// CREATE
// ==========================================
router.post('/', authMiddleware, requirePermission('students.add'), async (req, res) => {
  try {
    const STUDENT_SCALAR_FIELDS = [
      'fullNameAr', 'fullNameEn', 'dob', 'gender', 'nationality', 'nationalityName',
      'nationalId', 'passportId', 'personalId', 'phones', 'phoneCodes',
      'whatsappOnly', 'isIdNumber', 'address', 'governorate', 'studentType',
      'universityName', 'universityId', 'highSchoolPassed', 'status',
      'marketerName', 'markerEmployeeId', 'supervisorEmployeeId', 'registeredByUserId', 'notes', 'registrationDate'
    ];
    const data: any = {};
    for (const key of STUDENT_SCALAR_FIELDS) {
      if (key in req.body) data[key] = req.body[key];
    }

    // Normalize digits
    if (data.nationalId) data.nationalId = normalizeDigits(data.nationalId);
    if (data.passportId) data.passportId = normalizeDigits(data.passportId);
    if (data.personalId) data.personalId = normalizeDigits(data.personalId);
    if (data.universityId) data.universityId = normalizeDigits(data.universityId);
    if (Array.isArray(data.phones)) {
      data.phones = JSON.stringify(data.phones.map((p: string) => normalizeDigits(String(p || ''))));
    }
    if (Array.isArray(data.phoneCodes)) data.phoneCodes = JSON.stringify(data.phoneCodes);
    if (Array.isArray(data.whatsappOnly)) data.whatsappOnly = JSON.stringify(data.whatsappOnly);
    if (Array.isArray(data.isIdNumber)) data.isIdNumber = JSON.stringify(data.isIdNumber);

    // Auto-set markerEmployeeId from current user's employee link
    if (!data.markerEmployeeId && (req as any).user?.employeeId) {
      data.markerEmployeeId = (req as any).user.employeeId;
    }

    const authUser = (req as any).user;
    const isAdminOrTL = authUser.role === 'ADMIN' || authUser.role === 'TEAM_LEADER'
      || authUser.permissions?.some((p: any) => p.permission?.name === 'ADMIN_ALL');

    // Assign supervisor + registrar based on role (cascading: admin/TL → supervisor → registrar)
    if (isAdminOrTL) {
      if (req.body.supervisorEmployeeId != null) data.supervisorEmployeeId = parseInt(req.body.supervisorEmployeeId) || null;
      if (req.body.registeredByUserId != null) data.registeredByUserId = parseInt(req.body.registeredByUserId) || null;
      if (!data.registeredByUserId) data.registeredByUserId = authUser.id;
    } else if (authUser.role === 'SUPERVISOR') {
      // Supervisor: force supervisorEmployeeId to self
      if (authUser.employeeId) data.supervisorEmployeeId = authUser.employeeId;
      if (req.body.registeredByUserId != null && parseInt(req.body.registeredByUserId) !== authUser.id) {
        const sub = await prisma.user.findFirst({
          where: { id: parseInt(req.body.registeredByUserId), supervisorId: authUser.id, status: 'ACTIVE' }
        });
        data.registeredByUserId = sub ? sub.id : authUser.id;
      } else {
        data.registeredByUserId = authUser.id;
      }
    } else {
      // Registrar/Employee: only self
      delete data.supervisorEmployeeId;
      delete data.registeredByUserId;
      data.registeredByUserId = authUser.id || null;
    }

    // Auto-set supervisorEmployeeId from marker employee's supervisor (fallback)
    if (!data.supervisorEmployeeId && data.markerEmployeeId) {
      const markerEmp = await prisma.employee.findUnique({
        where: { id: parseInt(data.markerEmployeeId) },
        select: { supervisorId: true }
      });
      if (markerEmp?.supervisorId) {
        data.supervisorEmployeeId = markerEmp.supervisorId;
      }
    }

    // Required validations
    if (!data.fullNameAr) return res.status(400).json({ error: 'الاسم بالعربي مطلوب' });
    if (!data.dob) return res.status(400).json({ error: 'تاريخ الميلاد مطلوب' });

    // Nationality-based validation
    if (data.nationality === 'JO') {
      if (!data.nationalId || !/^\d{10}$/.test(data.nationalId)) {
        return res.status(400).json({ error: 'الرقم الوطني للأردنيين يجب أن يكون 10 أرقام إنجليزية' });
      }
      // Check uniqueness
      const existing = await prisma.student.findFirst({ where: { nationalId: data.nationalId } });
      if (existing) {
        return res.status(400).json({ error: `الرقم الوطني مسجّل مسبقاً للطالب: ${existing.fullNameAr}` });
      }
    } else {
      // Non-Jordanian: must have passport OR 10-digit personal ID
      const hasPassport = data.passportId?.trim();
      const hasPersonal = data.personalId?.trim() && /^\d{10}$/.test(data.personalId);
      if (!hasPassport && !hasPersonal) {
        return res.status(400).json({ error: 'لغير الأردنيين: يجب تعبئة رقم الجواز أو الرقم الشخصي (10 أرقام)' });
      }
      // Check uniqueness for non-Jordanians too
      if (data.passportId) {
        const ex = await prisma.student.findFirst({ where: { passportId: data.passportId } });
        if (ex) return res.status(400).json({ error: `رقم الجواز مسجّل مسبقاً للطالب: ${ex.fullNameAr}` });
      }
      if (data.personalId) {
        const ex = await prisma.student.findFirst({ where: { personalId: data.personalId } });
        if (ex) return res.status(400).json({ error: `الرقم الشخصي مسجّل مسبقاً للطالب: ${ex.fullNameAr}` });
      }
    }

    data.dob = new Date(data.dob);

    // Generate system ID
    const id = await generateSystemId();

    // Remove fields not in schema
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    const student = await prisma.student.create({ data: { ...data, id } });

    // Audit
    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'CREATE',
        entity: 'Student',
        details: JSON.stringify({ id, fullNameAr: data.fullNameAr, nationalId: data.nationalId }),
        ipAddress: req.ip,
      }
    });

    return res.json({
      ...student,
      phones: tryParse(student.phones, []),
      phoneCodes: tryParse(student.phoneCodes, []),
      whatsappOnly: tryParse(student.whatsappOnly, []),
      isIdNumber: tryParse(student.isIdNumber, []),
    });
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'فشل إنشاء الطالب' });
  }
});

// ==========================================
// UPDATE
// ==========================================
router.put('/:id', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const STUDENT_SCALAR_FIELDS = [
      'fullNameAr', 'fullNameEn', 'dob', 'gender', 'nationality', 'nationalityName',
      'nationalId', 'passportId', 'personalId', 'phones', 'phoneCodes',
      'whatsappOnly', 'isIdNumber', 'address', 'governorate', 'studentType',
      'universityName', 'universityId', 'highSchoolPassed', 'status',
      'marketerName', 'markerEmployeeId', 'supervisorEmployeeId', 'registeredByUserId', 'notes', 'registrationDate'
    ];
    const data: any = {};
    for (const key of STUDENT_SCALAR_FIELDS) {
      if (key in req.body) data[key] = req.body[key];
    }
    delete data.id;

    if (data.nationalId) data.nationalId = normalizeDigits(data.nationalId);
    if (data.passportId) data.passportId = normalizeDigits(data.passportId);
    if (data.personalId) data.personalId = normalizeDigits(data.personalId);
    if (data.universityId) data.universityId = normalizeDigits(data.universityId);
    if (Array.isArray(data.phones)) data.phones = JSON.stringify(data.phones.map((p: string) => normalizeDigits(String(p || ''))));
    if (Array.isArray(data.phoneCodes)) data.phoneCodes = JSON.stringify(data.phoneCodes);
    if (Array.isArray(data.whatsappOnly)) data.whatsappOnly = JSON.stringify(data.whatsappOnly);
    if (Array.isArray(data.isIdNumber)) data.isIdNumber = JSON.stringify(data.isIdNumber);
    if (data.dob) data.dob = new Date(data.dob);

    // Role-aware supervisor/registrar assignment (mirrors create logic)
    const authUser = (req as any).user;
    const isAdminOrTL = authUser.role === 'ADMIN' || authUser.role === 'TEAM_LEADER'
      || authUser.permissions?.some((p: any) => p.permission?.name === 'ADMIN_ALL');
    if (data.supervisorEmployeeId != null) data.supervisorEmployeeId = parseInt(data.supervisorEmployeeId) || null;
    if (data.registeredByUserId != null) data.registeredByUserId = parseInt(data.registeredByUserId) || null;
    if (!isAdminOrTL) {
      if (authUser.role === 'SUPERVISOR') {
        if (authUser.employeeId) data.supervisorEmployeeId = authUser.employeeId;
        if (data.registeredByUserId != null && data.registeredByUserId !== authUser.id) {
          const sub = await prisma.user.findFirst({
            where: { id: data.registeredByUserId, supervisorId: authUser.id, status: 'ACTIVE' }
          });
          if (!sub) delete data.registeredByUserId;
        }
      } else {
        // Registrar/Employee cannot change the assignee links
        delete data.supervisorEmployeeId;
        delete data.registeredByUserId;
      }
    }

    // Check national ID uniqueness on update
    if (data.nationality === 'JO' && data.nationalId) {
      const existing = await prisma.student.findFirst({
        where: { nationalId: data.nationalId, id: { not: (req.params.id as string) } }
      });
      if (existing) {
        return res.status(400).json({ error: `الرقم الوطني مسجّل مسبقاً للطالب: ${existing.fullNameAr}` });
      }
    }

    const student = await prisma.student.update({ where: { id: (req.params.id as string) }, data });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'UPDATE',
        entity: 'Student',
        details: JSON.stringify({ id: (req.params.id as string), fullNameAr: data.fullNameAr }),
        ipAddress: req.ip,
      }
    });

    return res.json({
      ...student,
      phones: tryParse(student.phones, []),
      phoneCodes: tryParse(student.phoneCodes, []),
      whatsappOnly: tryParse(student.whatsappOnly, []),
      isIdNumber: tryParse(student.isIdNumber, []),
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل تحديث الطالب' });
  }
});

// ==========================================
// DELETE
// ==========================================
router.delete('/:id', authMiddleware, requirePermission('students.delete'), async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: (req.params.id as string) } });
    await prisma.student.delete({ where: { id: (req.params.id as string) } });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'DELETE',
        entity: 'Student',
        details: JSON.stringify({ id: (req.params.id as string), fullNameAr: student?.fullNameAr }),
        ipAddress: req.ip,
      }
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: 'فشل حذف الطالب' });
  }
});

// ==========================================
// TRANSFER student to another registrar
// ==========================================
router.put('/:id/transfer', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const { targetEmployeeId } = req.body;
    if (!targetEmployeeId) {
      return res.status(400).json({ error: 'الموظف المستهدف مطلوب' });
    }

    const student = await prisma.student.findUnique({ where: { id: (req.params.id as string) } });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const targetEmp = await prisma.employee.findUnique({ where: { id: parseInt(targetEmployeeId) } });
    if (!targetEmp) return res.status(404).json({ error: 'الموظف المستهدف غير موجود' });

    const prevMarkerId = student.markerEmployeeId;

    await prisma.student.update({
      where: { id: (req.params.id as string) },
      data: { markerEmployeeId: parseInt(targetEmployeeId) }
    });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'TRANSFER',
        entity: 'Student',
        details: JSON.stringify({
          id: (req.params.id as string),
          fullNameAr: student.fullNameAr,
          from: prevMarkerId,
          to: targetEmployeeId
        }),
        ipAddress: req.ip,
      }
    });

    return res.json({ success: true, message: 'تم نقل الطالب بنجاح' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل نقل الطالب' });
  }
});

// ==========================================
// BULK end course subscriptions
// ==========================================
router.post('/bulk/end-course', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد طالب واحد على الأقل' });
    }
    const updated = await prisma.courseSubscription.updateMany({
      where: { studentId: { in: studentIds }, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    return res.json({ success: true, count: updated.count, message: `تم إنهاء ${updated.count} دورة` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل إنهاء الدورات' });
  }
});

// ==========================================
// BULK end diploma subscriptions
// ==========================================
router.post('/bulk/end-diploma', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد طالب واحد على الأقل' });
    }
    const updated = await prisma.diplomaSubscription.updateMany({
      where: { studentId: { in: studentIds }, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    return res.json({ success: true, count: updated.count, message: `تم إنهاء ${updated.count} دبلوم` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل إنهاء الدبلومات' });
  }
});

// ==========================================
// BULK change student status
// ==========================================
router.post('/bulk/change-status', authMiddleware, requirePermission('students.edit'), async (req, res) => {
  try {
    const { studentIds, newStatus } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد طالب واحد على الأقل' });
    }
    const validStatuses = ['ACTIVE', 'POSTPONED', 'WITHDRAWN', 'CANCELED', 'FINISHED'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }
    const updated = await prisma.student.updateMany({
      where: { id: { in: studentIds } },
      data: { status: newStatus },
    });
    return res.json({ success: true, count: updated.count, message: `تم تحديث حالة ${updated.count} طالب` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل تحديث الحالة' });
  }
});

// ==========================================
// GET available sections for a student (based on subscriptions, minus enrolled, with conflicts)
// ==========================================
router.get('/:id/available-sections', authMiddleware, requirePermission('students.view'), async (req, res) => {
  try {
    const studentId = req.params.id as string;

    // Get student's course subscriptions (active)
    const subs = await prisma.courseSubscription.findMany({
      where: { studentId, status: 'ACTIVE' },
      select: { courseId: true }
    });
    const courseIds = subs.map(s => s.courseId);

    // Get diploma subscriptions
    const diplomas = await prisma.diplomaSubscription.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: { diploma: { include: { courses: { select: { courseId: true } } } } }
    });
    for (const d of diplomas) {
      for (const dc of d.diploma.courses) {
        if (!courseIds.includes(dc.courseId)) courseIds.push(dc.courseId);
      }
    }

    if (courseIds.length === 0) return res.json([]);

    // Get student's enrolled section IDs (exclude ENROLLED only — TRANSFERRED can be re-transferred to)
    const enrolledSS = await prisma.studentSection.findMany({
      where: { studentId, status: 'ENROLLED' },
      select: { sectionId: true }
    });
    const enrolledIds = new Set(enrolledSS.map(e => e.sectionId));

    // Get enrolled sections for conflict checking
    const enrolledSections = await prisma.section.findMany({
      where: { id: { in: Array.from(enrolledIds) } },
    });

    // Get available sections (exclude only ENROLLED — TRANSFERRED sections are available for re-transfer)
    const sections = await prisma.section.findMany({
      where: {
        courseId: { in: courseIds },
        id: { notIn: Array.from(enrolledIds) },
        status: 'OPEN',
      },
      include: {
        course: { select: { id: true, name: true, minPayment: true } },
        room: { select: { id: true, name: true, learningType: true, address: true } },
        instructor: { select: { id: true, name: true } },
      },
      orderBy: [{ courseId: 'asc' }, { startTime: 'asc' }],
    });

    // Count enrolled students per section (exclude TRANSFERRED/WITHDRAWN)
    const sectionIds = sections.map(s => s.id);
    const enrolledCounts = await prisma.studentSection.groupBy({
      by: ['sectionId'],
      where: { sectionId: { in: sectionIds }, status: 'ENROLLED' },
      _count: true,
    });
    const enrolledCountMap = new Map(enrolledCounts.map(e => [e.sectionId, e._count]));

    // Map conflicts per section
    const result = sections.map(s => {
      const conflicts: { sectionId: number; name: string | null; days: string[]; startTime: string; endTime: string }[] = [];
      for (const es of enrolledSections) {
        if (daysOverlap(s.days, es.days) && checkOverlap(s.startTime, s.endTime, es.startTime, es.endTime)) {
          conflicts.push({
            sectionId: es.id,
            name: es.name,
            days: safeParseJSON(es.days, []),
            startTime: es.startTime,
            endTime: es.endTime,
          });
        }
      }
      return {
        id: s.id,
        name: s.name,
        courseName: s.course.name,
        courseId: s.courseId,
        days: safeParseJSON(s.days, []),
        startTime: s.startTime,
        endTime: s.endTime,
        startDate: s.startDate,
        endDate: s.endDate,
        roomName: s.room?.name || '',
        roomLearningType: s.room?.learningType || null,
        roomAddress: s.room?.address || '',
        instructorName: s.instructor?.name || '',
        capacity: s.capacity,
        enrolledCount: enrolledCountMap.get(s.id) || 0,
        minPayment: s.course.minPayment,
        hasConflict: conflicts.length > 0,
        conflicts,
      };
    });

    res.json(result);
  } catch (e: any) {
    console.error('available-sections error', e?.message || e, e?.code, e?.meta);
    res.status(500).json({ error: 'خطأ في جلب الشعب المتاحة' });
  }
});

// ==========================================
// GET user hierarchy for student stat cards
// ==========================================
function safeParseJSON(str: string, fallback: any) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export default router;
