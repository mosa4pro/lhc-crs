import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Column definitions grouped by category
const COLUMN_DEFS: Record<string, { field: string; label: string; table: string; sql: string; group: string }[]> = {
  ACADEMIC: [
    // Student info
    { group: 'معلومات الطالب', field: 'student.id', label: 'رقم الطالب', table: 's', sql: 's.id' },
    { group: 'معلومات الطالب', field: 'student.fullNameAr', label: 'الاسم (عربي)', table: 's', sql: 's."fullNameAr"' },
    { group: 'معلومات الطالب', field: 'student.fullNameEn', label: 'الاسم (إنجليزي)', table: 's', sql: 's."fullNameEn"' },
    { group: 'معلومات الطالب', field: 'student.status', label: 'حالة الطالب', table: 's', sql: 's.status' },
    { group: 'معلومات الطالب', field: 'student.gender', label: 'الجنس', table: 's', sql: 's.gender' },
    { group: 'معلومات الطالب', field: 'student.studentType', label: 'صفة الطالب', table: 's', sql: 's."studentType"' },
    { group: 'معلومات الطالب', field: 'student.nationality', label: 'الجنسية', table: 's', sql: 's.nationality' },
    { group: 'معلومات الطالب', field: 'student.nationalId', label: 'الرقم الوطني', table: 's', sql: 's."nationalId"' },
    { group: 'معلومات الطالب', field: 'student.dob', label: 'تاريخ الميلاد', table: 's', sql: 's.dob' },
    { group: 'معلومات الطالب', field: 'student.phone', label: 'رقم الهاتف', table: 's', sql: 's.phones' },
    { group: 'معلومات الطالب', field: 'student.address', label: 'العنوان', table: 's', sql: 's.address' },
    { group: 'معلومات الطالب', field: 'student.universityName', label: 'الجامعة', table: 's', sql: 's."universityName"' },
    { group: 'معلومات الطالب', field: 'student.universityId', label: 'الرقم الجامعي', table: 's', sql: 's."universityId"' },
    { group: 'معلومات الطالب', field: 'student.highSchoolPassed', label: 'تخرج ثانوي', table: 's', sql: 's."highSchoolPassed"' },
    { group: 'معلومات الطالب', field: 'student.registrationDate', label: 'تاريخ التسجيل', table: 's', sql: 's."registrationDate"' },
    { group: 'معلومات الطالب', field: 'student.marketerName', label: 'المسوق', table: 's', sql: 's."marketerName"' },
    // Registrar & Supervisor
    { group: 'المسؤولون', field: 'registrar.name', label: 'اسم المسجل', table: 'reg_emp', sql: 'reg_emp."fullName"' },
    { group: 'المسؤولون', field: 'supervisor.name', label: 'اسم المشرف', table: 'sup_emp', sql: 'sup_emp."fullName"' },
    // Course info
    { group: 'المساق', field: 'course.name', label: 'اسم المساق', table: 'co', sql: 'co.name' },
    { group: 'المساق', field: 'course.category', label: 'تصنيف المساق', table: 'co', sql: 'co.category' },
    { group: 'المساق', field: 'course.hours', label: 'ساعات المساق', table: 'co', sql: 'co.hours' },
    { group: 'المساق', field: 'course.price', label: 'سعر المساق', table: 'co', sql: 'co.price' },
    // Diploma info
    { group: 'الدبلوم', field: 'diploma.name', label: 'اسم الدبلوم', table: 'd', sql: 'd.name' },
    { group: 'الدبلوم', field: 'diploma.totalHours', label: 'ساعات الدبلوم', table: 'd', sql: 'd."totalHours"' },
    { group: 'الدبلوم', field: 'diploma.totalPrice', label: 'سعر الدبلوم', table: 'd', sql: 'd."totalPrice"' },
    // Section info
    { group: 'الشعبة', field: 'section.name', label: 'اسم الشعبة', table: 'sec', sql: 'sec.name' },
    { group: 'الشعبة', field: 'section.days', label: 'أيام الشعبة', table: 'sec', sql: 'sec.days' },
    { group: 'الشعبة', field: 'section.startTime', label: 'وقت البداية', table: 'sec', sql: 'sec."startTime"' },
    { group: 'الشعبة', field: 'section.endTime', label: 'وقت النهاية', table: 'sec', sql: 'sec."endTime"' },
    { group: 'الشعبة', field: 'section.startDate', label: 'تاريخ بدء الشعبة', table: 'sec', sql: 'sec."startDate"' },
    { group: 'الشعبة', field: 'section.capacity', label: 'سعة الشعبة', table: 'sec', sql: 'sec.capacity' },
    // Instructor
    { group: 'المحاضر', field: 'instructor.name', label: 'اسم المحاضر', table: 'ins', sql: 'ins.name' },
    // Room
    { group: 'القاعة', field: 'room.name', label: 'اسم القاعة', table: 'r', sql: 'r.name' },
    { group: 'القاعة', field: 'room.learningType', label: 'مكان الانعقاد', table: 'r', sql: 'r."learningType"' },
    { group: 'القاعة', field: 'room.address', label: 'عنوان القاعة', table: 'r', sql: 'r.address' },
    // Grade
    { group: 'العلامات', field: 'grade.grade', label: 'العلامة', table: 'ss', sql: 'ss.grade' },
    { group: 'العلامات', field: 'grade.isProject', label: 'تسليم مشروع', table: 'ss', sql: 'ss."isProject"' },
    { group: 'العلامات', field: 'grade.result', label: 'النتيجة', table: 'ss', sql: 'ss.result' },
    // Subscription
    { group: 'الاشتراك', field: 'subscription.totalCost', label: 'التكلفة الإجمالية', table: 'sub', sql: 'sub."totalCost"' },
    { group: 'الاشتراك', field: 'subscription.status', label: 'حالة الاشتراك', table: 'sub', sql: 'sub.status' },
    { group: 'الاشتراك', field: 'subscription.paymentType', label: 'نوع الدفع', table: 'sub', sql: 'sub."paymentType"' },
    // Entity
    { group: 'الجهة التعليمية', field: 'entity.name', label: 'الجهة التعليمية', table: 'ent', sql: 'ent.name' },
  ],
  FINANCIAL: [
    // Transaction
    { group: 'المعاملة', field: 'transaction.id', label: 'رقم المعاملة', table: 'ft', sql: 'ft.id' },
    { group: 'المعاملة', field: 'transaction.type', label: 'نوع المعاملة', table: 'ft', sql: 'ft.type' },
    { group: 'المعاملة', field: 'transaction.amount', label: 'المبلغ', table: 'ft', sql: 'ft.amount' },
    { group: 'المعاملة', field: 'transaction.paymentMethod', label: 'طريقة الدفع', table: 'ft', sql: 'ft."paymentMethod"' },
    { group: 'المعاملة', field: 'transaction.date', label: 'التاريخ', table: 'ft', sql: 'ft.date' },
    { group: 'المعاملة', field: 'transaction.status', label: 'حالة المعاملة', table: 'ft', sql: 'ft.status' },
    { group: 'المعاملة', field: 'transaction.receiptNumber', label: 'رقم الإيصال', table: 'ft', sql: 'ft."receiptNumber"' },
    { group: 'المعاملة', field: 'transaction.referenceNumber', label: 'رقم المرجع', table: 'ft', sql: 'ft."referenceNumber"' },
    { group: 'المعاملة', field: 'transaction.universityShare', label: 'حصة الجهة', table: 'ft', sql: 'ft."universityShare"' },
    { group: 'المعاملة', field: 'transaction.centerShare', label: 'حصة المركز', table: 'ft', sql: 'ft."centerShare"' },
    { group: 'المعاملة', field: 'transaction.employeeCommission', label: 'عمولة الموظف', table: 'ft', sql: 'ft."employeeCommission"' },
    // Student
    { group: 'معلومات الطالب', field: 'student.id', label: 'رقم الطالب', table: 's', sql: 's.id' },
    { group: 'معلومات الطالب', field: 'student.fullNameAr', label: 'اسم الطالب', table: 's', sql: 's."fullNameAr"' },
    { group: 'معلومات الطالب', field: 'student.studentType', label: 'صفة الطالب', table: 's', sql: 's."studentType"' },
    { group: 'معلومات الطالب', field: 'student.nationality', label: 'الجنسية', table: 's', sql: 's.nationality' },
    // Subscription
    { group: 'البرنامج', field: 'subscription.type', label: 'نوع البرنامج', table: 'sub', sql: 'sub."type"' },
    { group: 'البرنامج', field: 'subscription.name', label: 'اسم البرنامج', table: 'sub', sql: 'sub."name"' },
    { group: 'البرنامج', field: 'subscription.totalCost', label: 'تكلفة البرنامج', table: 'sub', sql: 'sub."totalCost"' },
    // Installment
    { group: 'الأقساط', field: 'installment.installmentNumber', label: 'رقم القسط', table: 'inst', sql: 'inst."installmentNumber"' },
    { group: 'الأقساط', field: 'installment.dueDate', label: 'تاريخ استحقاق القسط', table: 'inst', sql: 'inst."dueDate"' },
    { group: 'الأقساط', field: 'installment.amount', label: 'قيمة القسط', table: 'inst', sql: 'inst.amount' },
    { group: 'الأقساط', field: 'installment.paidAmount', label: 'المدفوع من القسط', table: 'inst', sql: 'inst."paidAmount"' },
    { group: 'الأقساط', field: 'installment.remainingAmount', label: 'المتبقي من القسط', table: 'inst', sql: 'inst."remainingAmount"' },
    { group: 'الأقساط', field: 'installment.status', label: 'حالة القسط', table: 'inst', sql: 'inst.status' },
    // Commission
    { group: 'العمولة', field: 'commission.amount', label: 'قيمة العمولة', table: 'comm', sql: 'comm.amount' },
    { group: 'العمولة', field: 'commission.type', label: 'نوع العمولة', table: 'comm', sql: 'comm.type' },
    // Employee
    { group: 'الموظفون', field: 'employee.fullName', label: 'اسم الموظف', table: 'emp', sql: 'emp."fullName"' },
    { group: 'الموظفون', field: 'registrar.name', label: 'اسم المسجل', table: 'reg_emp', sql: 'reg_emp."fullName"' },
    { group: 'الموظفون', field: 'supervisor.name', label: 'اسم المشرف', table: 'sup_emp', sql: 'sup_emp."fullName"' },
    // Entity
    { group: 'الجهة التعليمية', field: 'entity.name', label: 'الجهة التعليمية', table: 'ent', sql: 'ent.name' },
  ],
};

// ═══════════════════════════════
// GET all templates
// ═══════════════════════════════
router.get('/', authMiddleware, async (req, res) => {
  try {
    const templates = await prisma.reportTemplate.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(templates.map(t => {
      let cols = [];
      try { cols = JSON.parse(t.columns); } catch { cols = typeof t.columns === 'string' ? [t.columns] : []; }
      let flt = null;
      if (t.filters) { try { flt = JSON.parse(t.filters); } catch { flt = null; } }
      return { ...t, columns: cols, filters: flt };
    }));
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════
// POST create template
// ═══════════════════════════════
router.post('/', authMiddleware, requirePermission('finance.reports'), async (req, res) => {
  try {
    const { name, type, description, columns, filters, sortBy } = req.body;
    if (!name || !columns) return res.status(400).json({ error: 'الاسم والأعمدة مطلوبان' });
    const user = (req as any).user;
    const template = await prisma.reportTemplate.create({
      data: {
        name,
        type,
        description,
        columns: JSON.stringify(columns),
        filters: filters ? JSON.stringify(filters) : null,
        sortBy,
        createdBy: user.fullName,
      },
    });
    return res.json({ ...template, columns: JSON.parse(template.columns), filters: template.filters ? JSON.parse(template.filters) : null });
  } catch (err: any) { return res.status(400).json({ error: err.message }); }
});

// ═══════════════════════════════
// PUT update template
// ═══════════════════════════════
router.put('/:id', authMiddleware, requirePermission('finance.reports'), async (req, res) => {
  try {
    const { name, type, description, columns, filters, sortBy } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (type) data.type = type;
    if (description !== undefined) data.description = description;
    if (columns) data.columns = JSON.stringify(columns);
    if (filters !== undefined) data.filters = filters ? JSON.stringify(filters) : null;
    if (sortBy !== undefined) data.sortBy = sortBy;
    const template = await prisma.reportTemplate.update({ where: { id: parseInt(req.params.id as string) }, data });
    return res.json({ ...template, columns: JSON.parse(template.columns), filters: template.filters ? JSON.parse(template.filters) : null });
  } catch (err: any) { return res.status(400).json({ error: err.message }); }
});

// ═══════════════════════════════
// DELETE template
// ═══════════════════════════════
router.delete('/:id', authMiddleware, requirePermission('finance.reports'), async (req, res) => {
  try {
    await prisma.reportTemplate.delete({ where: { id: parseInt(req.params.id as string) } });
    return res.json({ success: true });
  } catch (err: any) { return res.status(400).json({ error: err.message }); }
});

// ═══════════════════════════════
// POST execute — run dynamic report
// ═══════════════════════════════
router.post('/execute', authMiddleware, async (req, res) => {
  try {
    const { type, columns, filters, sortBy } = req.body;
    if (!type || !columns) return res.status(400).json({ error: 'النوع والأعمدة مطلوبان' });

    const defs = COLUMN_DEFS[type];
    if (!defs) return res.status(400).json({ error: 'نوع تقرير غير مدعوم' });

    // Validate requested columns
    const selectedCols = columns.map((c: string) => defs.find(d => d.field === c)).filter(Boolean);

    // Build SQL query
    const selectClause = selectedCols.map(c => `${c.sql} as "${c!.field.replace('.', '_')}"`).join(', ');
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Apply filters
    if (filters) {
      // Filter by date range
      if (filters.dateFrom) {
        whereClauses.push(`s."registrationDate" >= $${paramIdx}`);
        params.push(new Date(filters.dateFrom));
        paramIdx++;
      }
      if (filters.dateTo) {
        whereClauses.push(`s."registrationDate" <= $${paramIdx}`);
        params.push(new Date(filters.dateTo));
        paramIdx++;
      }
      // Filter by student type
      if (filters.studentType) {
        whereClauses.push(`s."studentType" = $${paramIdx}`);
        params.push(filters.studentType);
        paramIdx++;
      }
      // Filter by nationality
      if (filters.nationality) {
        whereClauses.push(`s.nationality = $${paramIdx}`);
        params.push(filters.nationality);
        paramIdx++;
      }
      // Filter by status
      if (filters.status) {
        whereClauses.push(`s.status = $${paramIdx}`);
        params.push(filters.status);
        paramIdx++;
      }
      // Filter by transaction type (financial)
      if (filters.transactionType) {
        whereClauses.push(`ft.type = $${paramIdx}`);
        params.push(filters.transactionType);
        paramIdx++;
      }
      // Filter by payment method (financial)
      if (filters.paymentMethod) {
        whereClauses.push(`ft."paymentMethod" = $${paramIdx}`);
        params.push(filters.paymentMethod);
        paramIdx++;
      }
      // Filter by date range on transactions
      if (filters.transactionDateFrom) {
        whereClauses.push(`ft.date >= $${paramIdx}`);
        params.push(new Date(filters.transactionDateFrom));
        paramIdx++;
      }
      if (filters.transactionDateTo) {
        whereClauses.push(`ft.date <= $${paramIdx}`);
        params.push(new Date(filters.transactionDateTo));
        paramIdx++;
      }
      // Filter by program type
      if (filters.programType) {
        whereClauses.push(`sub.type = $${paramIdx}`);
        params.push(filters.programType);
        paramIdx++;
      }
      // Filter by section status
      if (filters.sectionStatus) {
        whereClauses.push(`sec.status = $${paramIdx}`);
        params.push(filters.sectionStatus);
        paramIdx++;
      }
      // Filter by grade result
      if (filters.gradeResult) {
        whereClauses.push(`ss.result = $${paramIdx}`);
        params.push(filters.gradeResult);
        paramIdx++;
      }
      // Amount range
      if (filters.minAmount) {
        whereClauses.push(`ft.amount >= $${paramIdx}`);
        params.push(parseFloat(filters.minAmount));
        paramIdx++;
      }
      if (filters.maxAmount) {
        whereClauses.push(`ft.amount <= $${paramIdx}`);
        params.push(parseFloat(filters.maxAmount));
        paramIdx++;
      }
      // subscription payment status
      if (filters.subscriptionStatus) {
        whereClauses.push(`sub.status = $${paramIdx}`);
        params.push(filters.subscriptionStatus);
        paramIdx++;
      }
      // University name
      if (filters.universityName) {
        whereClauses.push(`s."universityName" ILIKE $${paramIdx}`);
        params.push(`%${filters.universityName}%`);
        paramIdx++;
      }
      // Filter by section ID
      if (filters.sectionId) {
        whereClauses.push(`sec.id = $${paramIdx}`);
        params.push(parseInt(filters.sectionId));
        paramIdx++;
      }
      // Filter by learning location
      if (filters.learningType) {
        whereClauses.push(`r."learningType" = $${paramIdx}`);
        params.push(filters.learningType);
        paramIdx++;
      }
      // Filter by course ID
      if (filters.courseId) {
        whereClauses.push(`co.id = $${paramIdx}`);
        params.push(parseInt(filters.courseId));
        paramIdx++;
      }
      // Filter by registrar (markerEmployeeId)
      if (filters.markerEmployeeId) {
        whereClauses.push(`s."markerEmployeeId" = $${paramIdx}`);
        params.push(parseInt(filters.markerEmployeeId));
        paramIdx++;
      }
      // Filter by supervisor
      if (filters.supervisorEmployeeId) {
        whereClauses.push(`s."supervisorEmployeeId" = $${paramIdx}`);
        params.push(parseInt(filters.supervisorEmployeeId));
        paramIdx++;
      }
      // Filter by gender
      if (filters.gender) {
        whereClauses.push(`s.gender = $${paramIdx}`);
        params.push(filters.gender);
        paramIdx++;
      }
      // Filter by date of birth range
      if (filters.dobFrom) {
        whereClauses.push(`s.dob >= $${paramIdx}`);
        params.push(new Date(filters.dobFrom));
        paramIdx++;
      }
      if (filters.dobTo) {
        whereClauses.push(`s.dob <= $${paramIdx}`);
        params.push(new Date(filters.dobTo));
        paramIdx++;
      }
      // Filter by high school passed
      if (filters.highSchoolPassed) {
        whereClauses.push(`s."highSchoolPassed" = $${paramIdx}`);
        params.push(filters.highSchoolPassed === 'true');
        paramIdx++;
      }
      // Filter by national ID
      if (filters.nationalId) {
        whereClauses.push(`s."nationalId" ILIKE $${paramIdx}`);
        params.push(`%${filters.nationalId}%`);
        paramIdx++;
      }
      // Filter by marketer name
      if (filters.marketerName) {
        whereClauses.push(`s."marketerName" ILIKE $${paramIdx}`);
        params.push(`%${filters.marketerName}%`);
        paramIdx++;
      }
      // Filter by address
      if (filters.address) {
        whereClauses.push(`s.address ILIKE $${paramIdx}`);
        params.push(`%${filters.address}%`);
        paramIdx++;
      }
      // Filter by diploma ID
      if (filters.diplomaId) {
        whereClauses.push(`d.id = $${paramIdx}`);
        params.push(parseInt(filters.diplomaId));
        paramIdx++;
      }
      // Filter by instructor
      if (filters.instructorId) {
        whereClauses.push(`ins.id = $${paramIdx}`);
        params.push(parseInt(filters.instructorId));
        paramIdx++;
      }
      // Filter by room
      if (filters.roomId) {
        whereClauses.push(`r.id = $${paramIdx}`);
        params.push(parseInt(filters.roomId));
        paramIdx++;
      }
      // Filter by educational entity
      if (filters.entityId) {
        whereClauses.push(`ent.id = $${paramIdx}`);
        params.push(parseInt(filters.entityId));
        paramIdx++;
      }
      // Filter by price range
      if (filters.priceFrom) {
        whereClauses.push(`sub."totalCost" >= $${paramIdx}`);
        params.push(parseFloat(filters.priceFrom));
        paramIdx++;
      }
      if (filters.priceTo) {
        whereClauses.push(`sub."totalCost" <= $${paramIdx}`);
        params.push(parseFloat(filters.priceTo));
        paramIdx++;
      }
      // Text search
      if (filters.query) {
        whereClauses.push(`(s."fullNameAr" ILIKE $${paramIdx} OR s."fullNameEn" ILIKE $${paramIdx} OR s.id ILIKE $${paramIdx})`);
        params.push(`%${filters.query}%`);
        paramIdx++;
      }
      // Deep search across all fields
      if (filters.deepSearch) {
        const q = `%${filters.deepSearch}%`;
        const baseFields = `s."fullNameAr" ILIKE $${paramIdx} OR s."fullNameEn" ILIKE $${paramIdx} OR s.id ILIKE $${paramIdx}
          OR s."nationalId" ILIKE $${paramIdx} OR s."passportId" ILIKE $${paramIdx} OR s."personalId" ILIKE $${paramIdx}
          OR s.phones ILIKE $${paramIdx} OR s.address ILIKE $${paramIdx} OR s."universityName" ILIKE $${paramIdx}
          OR s."universityId" ILIKE $${paramIdx} OR s."marketerName" ILIKE $${paramIdx} OR ent.name ILIKE $${paramIdx}`;
        if (type === 'ACADEMIC') {
          whereClauses.push(`(${baseFields} OR co.name ILIKE $${paramIdx} OR d.name ILIKE $${paramIdx} OR sec.name ILIKE $${paramIdx} OR ins.name ILIKE $${paramIdx})`);
        } else {
          whereClauses.push(`(${baseFields} OR sub."name" ILIKE $${paramIdx} OR emp."fullName" ILIKE $${paramIdx})`);
        }
        params.push(q);
        paramIdx++;
      }
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let sql: string;

    if (type === 'ACADEMIC') {
      sql = `
        SELECT ${selectClause}
        FROM "Student" s
        LEFT JOIN "CourseSubscription" cs ON cs."studentId" = s.id
        LEFT JOIN "DiplomaSubscription" ds ON ds."studentId" = s.id
        LEFT JOIN "StudentSection" ss ON ss."studentId" = s.id
        LEFT JOIN "Section" sec ON sec.id = ss."sectionId"
        LEFT JOIN "Course" co ON co.id = sec."courseId"
        LEFT JOIN "Diploma" d ON d.id = ds."diplomaId"
        LEFT JOIN "Instructor" ins ON ins.id = sec."instructorId"
        LEFT JOIN "Room" r ON r.id = sec."roomId"
        LEFT JOIN "EducationalEntity" ent ON ent.id = cs."entityId" OR ent.id = ds."entityId"
        LEFT JOIN "Employee" reg_emp ON reg_emp.id = s."markerEmployeeId"
        LEFT JOIN "Employee" sup_emp ON sup_emp.id = s."supervisorEmployeeId"
        ${whereSQL}
        ORDER BY s."fullNameAr" ASC
        LIMIT 500
      `;
    } else if (type === 'FINANCIAL') {
      sql = `
        WITH subs AS (
          SELECT cs.id, cs."studentId", cs."totalCost", cs.status, cs."paymentType", cs."entityId", 'COURSE' as "type", co.name
          FROM "CourseSubscription" cs
          JOIN "Course" co ON co.id = cs."courseId"
          UNION ALL
          SELECT ds.id, ds."studentId", ds."totalCost", ds.status, ds."paymentType", ds."entityId", 'DIPLOMA' as "type", d.name
          FROM "DiplomaSubscription" ds
          JOIN "Diploma" d ON d.id = ds."diplomaId"
        )
        SELECT ${selectClause}
        FROM "FinancialTransaction" ft
        JOIN "Student" s ON s.id = ft."studentId"
        LEFT JOIN subs sub ON sub.id = ft."subscriptionId"::int
        LEFT JOIN "Installment" inst ON inst.id = ft."installmentId"
        LEFT JOIN "Commission" comm ON comm."studentId" = s.id AND comm."subscriptionId" = ft."subscriptionId"
        LEFT JOIN "Employee" emp ON emp.id = ft."employeeId"
        LEFT JOIN "EducationalEntity" ent ON ent.id = sub."entityId"
        LEFT JOIN "Employee" reg_emp ON reg_emp.id = s."markerEmployeeId"
        LEFT JOIN "Employee" sup_emp ON sup_emp.id = s."supervisorEmployeeId"
        ${whereSQL}
        ORDER BY ft.date DESC
        LIMIT 500
      `;
    } else {
      return res.status(400).json({ error: 'نوع تقرير غير مدعوم' });
    }

    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    return res.json({ columns: selectedCols.map(c => ({ field: c.field, label: c.label })), rows });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'فشل تنفيذ التقرير: ' + err.message });
  }
});

// ═══════════════════════════════
// GET column definitions for a type
// ═══════════════════════════════
router.get('/columns/:type', authMiddleware, async (req, res) => {
  try {
    const defs = COLUMN_DEFS[(req.params.type as string) as string] || COLUMN_DEFS.ACADEMIC;
    return res.json(defs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════
// GET filter definitions with options for a report type
// ═══════════════════════════════
router.get('/filter-defs/:type', authMiddleware, async (req, res) => {
  try {
    const type = (req.params.type as string);
    const [employees, sections, courses, entities, diplomas, instructors, rooms] = await Promise.all([
      prisma.employee.findMany({ where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } }),
      prisma.section.findMany({ where: { status: 'OPEN' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.course.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.educationalEntity.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.diploma.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.instructor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.room.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

    const FILTER_DEFS = {
      ACADEMIC: [
        // بحث
        { group: 'بحث', field: 'query', label: 'بحث نصي', type: 'text', placeholder: 'اسم، رقم وطني، هاتف...' },
        { group: 'بحث', field: 'deepSearch', label: 'بحث عميق', type: 'text', placeholder: 'بحث في جميع الحقول...' },
        // معلومات الطالب
        { group: 'معلومات الطالب', field: 'status', label: 'حالة الطالب', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'ACTIVE', label: 'نشط' }, { value: 'POSTPONED', label: 'متأخر' },
          { value: 'WITHDRAWN', label: 'منسحب' }, { value: 'CANCELED', label: 'ملغي' }, { value: 'FINISHED', label: 'منتهي' },
        ]},
        { group: 'معلومات الطالب', field: 'studentType', label: 'صفة الطالب', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'UNIVERSITY', label: 'طالب جامعة' }, { value: 'HIGH_SCHOOL', label: 'طالب ثانوي' },
          { value: 'EMPLOYEE', label: 'موظف' }, { value: 'OTHER', label: 'أخرى' },
        ]},
        { group: 'معلومات الطالب', field: 'nationality', label: 'الجنسية', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'JO', label: 'أردني' }, { value: 'OTHER', label: 'غير أردني' },
        ]},
        { group: 'معلومات الطالب', field: 'gender', label: 'الجنس', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'MALE', label: 'ذكر' }, { value: 'FEMALE', label: 'أنثى' },
        ]},
        { group: 'معلومات الطالب', field: 'highSchoolPassed', label: 'تخرج ثانوي', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'true', label: 'نعم' }, { value: 'false', label: 'لا' },
        ]},
        { group: 'معلومات الطالب', field: 'nationalId', label: 'الرقم الوطني', type: 'text', placeholder: 'بحث بالرقم الوطني...' },
        { group: 'معلومات الطالب', field: 'marketerName', label: 'المسوق', type: 'text', placeholder: 'اسم المسوق...' },
        { group: 'معلومات الطالب', field: 'address', label: 'العنوان', type: 'text', placeholder: 'بحث بالعنوان...' },
        { group: 'معلومات الطالب', field: 'universityName', label: 'اسم الجامعة', type: 'text', placeholder: 'مثال: الجامعة الأردنية', showIf: { field: 'studentType', value: 'UNIVERSITY' } },
        // التاريخ
        { group: 'التاريخ', field: 'dateFrom', label: 'من تاريخ التسجيل', type: 'date' },
        { group: 'التاريخ', field: 'dateTo', label: 'إلى تاريخ التسجيل', type: 'date' },
        { group: 'التاريخ', field: 'dobFrom', label: 'من تاريخ الميلاد', type: 'date' },
        { group: 'التاريخ', field: 'dobTo', label: 'إلى تاريخ الميلاد', type: 'date' },
        // البرنامج
        { group: 'البرنامج', field: 'programType', label: 'نوع البرنامج', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'DIPLOMA', label: 'دبلوم' }, { value: 'COURSE', label: 'دورة' },
        ]},
        { group: 'البرنامج', field: 'courseId', label: 'الدورة', type: 'select', options: courses.map(c => ({ value: String(c.id), label: c.name })) },
        { group: 'البرنامج', field: 'diplomaId', label: 'الدبلوم', type: 'select', options: diplomas.map(d => ({ value: String(d.id), label: d.name })) },
        { group: 'البرنامج', field: 'sectionId', label: 'الشعبة', type: 'select', options: sections.map(s => ({ value: String(s.id), label: s.name })) },
        { group: 'البرنامج', field: 'sectionStatus', label: 'حالة الشعبة', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'ACTIVE', label: 'نشطة' }, { value: 'COMPLETED', label: 'منتهية' },
          { value: 'CANCELED', label: 'ملغية' },
        ]},
        { group: 'البرنامج', field: 'gradeResult', label: 'نتيجة العلامات', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'PASS', label: 'ناجح' }, { value: 'FAIL', label: 'راسب' },
        ]},
        { group: 'البرنامج', field: 'learningType', label: 'مكان الانعقاد', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'INSIDE_CENTER', label: 'داخل المركز' }, { value: 'VIRTUAL_ROOM', label: 'قاعة وهمية' },
          { value: 'ONLINE', label: 'قاعة Online' }, { value: 'EXTERNAL_ENTITY', label: 'جهة تعلم خارجية' },
        ]},
        // الأشخاص
        { group: 'الأشخاص', field: 'instructorId', label: 'المحاضر', type: 'select', options: instructors.map(i => ({ value: String(i.id), label: i.name })) },
        { group: 'الأشخاص', field: 'roomId', label: 'القاعة', type: 'select', options: rooms.map(r => ({ value: String(r.id), label: r.name })) },
        { group: 'الأشخاص', field: 'entityId', label: 'الجهة التعليمية', type: 'select', options: entities.map(e => ({ value: String(e.id), label: e.name })) },
        { group: 'الأشخاص', field: 'markerEmployeeId', label: 'المسجل', type: 'select', options: employees.map(e => ({ value: String(e.id), label: e.fullName })) },
        { group: 'الأشخاص', field: 'supervisorEmployeeId', label: 'المشرف', type: 'select', options: employees.map(e => ({ value: String(e.id), label: e.fullName })) },
        // الاشتراك
        { group: 'الاشتراك', field: 'subscriptionStatus', label: 'حالة الاشتراك', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'ACTIVE', label: 'نشط' }, { value: 'COMPLETED', label: 'مكتمل' },
          { value: 'CANCELED', label: 'ملغي' },
        ]},
        { group: 'الاشتراك', field: 'priceFrom', label: 'التكلفة من', type: 'number', placeholder: '0' },
        { group: 'الاشتراك', field: 'priceTo', label: 'التكلفة إلى', type: 'number', placeholder: '∞' },
      ],
      FINANCIAL: [
        // بحث
        { group: 'بحث', field: 'deepSearch', label: 'بحث عميق', type: 'text', placeholder: 'بحث في جميع الحقول...' },
        // التاريخ
        { group: 'التاريخ', field: 'transactionDateFrom', label: 'من تاريخ المعاملة', type: 'date' },
        { group: 'التاريخ', field: 'transactionDateTo', label: 'إلى تاريخ المعاملة', type: 'date' },
        // المعاملة
        { group: 'المعاملة', field: 'transactionType', label: 'نوع المعاملة', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'PAYMENT', label: 'دفع' }, { value: 'EXPENSE', label: 'مصروف' },
          { value: 'REFUND', label: 'استرداد' }, { value: 'TRANSFER', label: 'تحويل' },
        ]},
        { group: 'المعاملة', field: 'paymentMethod', label: 'طريقة الدفع', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'CASH', label: 'نقداً' }, { value: 'CARD', label: 'بطاقة' },
          { value: 'BANK_TRANSFER', label: 'تحويل بنكي' }, { value: 'CHECK', label: 'شيك' },
        ]},
        { group: 'المعاملة', field: 'paymentStatus', label: 'حالة الدفع', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'PAID', label: 'مدفوع بالكامل' },
          { value: 'PARTIAL', label: 'دفع جزئي' }, { value: 'UNPAID', label: 'لم يدفع' },
        ]},
        { group: 'المعاملة', field: 'minAmount', label: 'المبلغ الأدنى', type: 'number', placeholder: '0' },
        { group: 'المعاملة', field: 'maxAmount', label: 'المبلغ الأعلى', type: 'number', placeholder: '∞' },
        // البرنامج
        { group: 'البرنامج', field: 'programType', label: 'نوع البرنامج', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'DIPLOMA', label: 'دبلوم' }, { value: 'COURSE', label: 'دورة' },
        ]},
        { group: 'البرنامج', field: 'entityId', label: 'الجهة التعليمية', type: 'select', options: entities.map(e => ({ value: String(e.id), label: e.name })) },
        { group: 'البرنامج', field: 'subscriptionStatus', label: 'حالة الاشتراك', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'ACTIVE', label: 'نشط' }, { value: 'COMPLETED', label: 'مكتمل' },
        ]},
        // معلومات الطالب
        { group: 'معلومات الطالب', field: 'studentType', label: 'صفة الطالب', type: 'select', options: [
          { value: '', label: 'الكل' }, { value: 'UNIVERSITY', label: 'طالب جامعة' },
          { value: 'HIGH_SCHOOL', label: 'طالب ثانوي' }, { value: 'EMPLOYEE', label: 'موظف' }, { value: 'OTHER', label: 'أخرى' },
        ]},
        // الأشخاص
        { group: 'الأشخاص', field: 'markerEmployeeId', label: 'المسجل', type: 'select', options: employees.map(e => ({ value: String(e.id), label: e.fullName })) },
        { group: 'الأشخاص', field: 'supervisorEmployeeId', label: 'المشرف', type: 'select', options: employees.map(e => ({ value: String(e.id), label: e.fullName })) },
      ],
    };

    return res.json(FILTER_DEFS[type as keyof typeof FILTER_DEFS] || FILTER_DEFS.ACADEMIC);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
