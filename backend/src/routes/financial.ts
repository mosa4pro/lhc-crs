import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission, selfOrPerm } from '../middleware/auth.js';
import { generateReceiptNumber } from '../utils/generateReceiptNumber.js';

const router = express.Router();

// ==================== GET ALL TRANSACTIONS ====================
router.get('/', authMiddleware, requirePermission('finance.view'), async (req, res) => {
  try {
    const { studentId, type, status, dateFrom, dateTo } = req.query;
    const where: any = {};
    if (studentId) where.studentId = studentId as string;
    if (type) where.type = type as string;
    if (status) where.status = status as string;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom as string);
      if (dateTo) where.date.lte = new Date(dateTo as string);
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      include: { student: { select: { id: true, fullNameAr: true, fullNameEn: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(transactions);
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في جلب المعاملات' });
  }
});

// ==================== FINANCIAL SUMMARY ====================
router.get('/summary', authMiddleware, requirePermission('finance.view'), async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.toDateString());

    const [totalReceived, totalPayments, monthlyReceipts, todayReceipts, pendingInstallments, overdueInstallments] = await Promise.all([
      prisma.financialTransaction.aggregate({ where: { type: 'RECEIPT', status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.financialTransaction.aggregate({ where: { type: 'PAYMENT', status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.financialTransaction.aggregate({ where: { type: 'RECEIPT', status: 'COMPLETED', date: { gte: startOfMonth } }, _sum: { amount: true }, _count: true }),
      prisma.financialTransaction.aggregate({ where: { type: 'RECEIPT', status: 'COMPLETED', date: { gte: startOfDay } }, _sum: { amount: true }, _count: true }),
      prisma.installment.aggregate({ where: { status: 'PENDING' }, _sum: { remainingAmount: true }, _count: true }),
      prisma.installment.aggregate({ where: { status: 'OVERDUE' }, _sum: { remainingAmount: true }, _count: true })
    ]);

    return res.json({
      totalReceived: totalReceived._sum.amount || 0,
      totalPayments: totalPayments._sum.amount || 0,
      netRevenue: (totalReceived._sum.amount || 0) - (totalPayments._sum.amount || 0),
      monthlyReceipts: { amount: monthlyReceipts._sum.amount || 0, count: monthlyReceipts._count },
      todayReceipts: { amount: todayReceipts._sum.amount || 0, count: todayReceipts._count },
      pendingInstallments: { amount: pendingInstallments._sum.remainingAmount || 0, count: pendingInstallments._count },
      overdueInstallments: { amount: overdueInstallments._sum.remainingAmount || 0, count: overdueInstallments._count }
    });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في الملخص المالي' });
  }
});

// ==================== GET COMPREHENSIVE REPORTS ====================
router.get('/reports', authMiddleware, requirePermission('finance.view'), async (req, res) => {
  try {
    const { dateFrom, dateTo, entityId, paymentStatus, programType, studentType, minAmount, maxAmount } = req.query;

    // 1. Fetch Students matching studentType filter
    const studentFilter: any = {};
    if (studentType) {
      studentFilter.studentType = studentType as string;
    }
    const students = await prisma.student.findMany({
      where: studentFilter,
      select: { id: true, fullNameAr: true, markerEmployeeId: true }
    });
    const studentIds = students.map(s => s.id);
    const studentMap = new Map(students.map(s => [s.id, s]));

    // 2. Fetch Subscriptions matching filters (entityId, studentId in studentIds, date range if applicable)
    const diplomaSubWhere: any = { studentId: { in: studentIds } };
    const courseSubWhere: any = { studentId: { in: studentIds } };
    if (entityId) {
      diplomaSubWhere.entityId = parseInt(entityId as string);
      courseSubWhere.entityId = parseInt(entityId as string);
    }

    const [diplomaSubs, courseSubs] = await Promise.all([
      prisma.diplomaSubscription.findMany({
        where: diplomaSubWhere,
        include: { student: true, diploma: true, entity: true }
      }),
      prisma.courseSubscription.findMany({
        where: courseSubWhere,
        include: { student: true, course: true, entity: true }
      })
    ]);

    let activeDiplomaSubs = programType === 'COURSE' ? [] : diplomaSubs;
    let activeCourseSubs = programType === 'DIPLOMA' ? [] : courseSubs;

    const subMap = new Map<string, any>();
    activeDiplomaSubs.forEach(sub => {
      subMap.set(String(sub.id), {
        id: sub.id,
        type: 'DIPLOMA',
        name: sub.diploma?.name || 'دبلوم غير معروف',
        entityId: sub.entityId,
        entityName: sub.entity?.name || 'مركز خارجي / مستقل',
        totalCost: sub.totalCost,
        studentId: sub.studentId
      });
    });
    activeCourseSubs.forEach(sub => {
      subMap.set(String(sub.id), {
        id: sub.id,
        type: 'COURSE',
        name: sub.course?.name || 'دورة غير معروفة',
        entityId: sub.entityId,
        entityName: sub.entity?.name || 'مركز خارجي / مستقل',
        totalCost: sub.totalCost,
        studentId: sub.studentId
      });
    });

    // Handle paymentStatus filter if provided
    if (paymentStatus) {
      const subIds = Array.from(subMap.keys());
      const installments = await prisma.installment.findMany({
        where: { subscriptionId: { in: subIds } }
      });
      const subInstallmentsMap = new Map<string, typeof installments>();
      installments.forEach(inst => {
        if (!subInstallmentsMap.has(inst.subscriptionId)) {
          subInstallmentsMap.set(inst.subscriptionId, []);
        }
        subInstallmentsMap.get(inst.subscriptionId)!.push(inst);
      });

      for (const subId of subMap.keys()) {
        const insts = subInstallmentsMap.get(subId) || [];
        const totalAmount = insts.reduce((sum, i) => sum + i.amount, 0);
        const totalPaid = insts.reduce((sum, i) => sum + i.paidAmount, 0);
        const totalRemaining = insts.reduce((sum, i) => sum + i.remainingAmount, 0);

        let status = 'UNPAID';
        if (totalRemaining === 0 && totalAmount > 0) {
          status = 'PAID';
        } else if (totalPaid > 0) {
          status = 'PARTIAL';
        }

        if (status !== paymentStatus) {
          subMap.delete(subId);
        }
      }
    }

    // 3. Fetch Financial Transactions (Receipts) matching date, amount and student filters
    const txWhere: any = {
      type: 'RECEIPT',
      status: 'COMPLETED',
      studentId: { in: studentIds }
    };

    if (dateFrom || dateTo) {
      txWhere.date = {};
      if (dateFrom) txWhere.date.gte = new Date(dateFrom as string);
      if (dateTo) txWhere.date.lte = new Date(dateTo as string);
    }

    if (minAmount) {
      txWhere.amount = { ...txWhere.amount, gte: parseFloat(minAmount as string) };
    }
    if (maxAmount) {
      txWhere.amount = { ...txWhere.amount, lte: parseFloat(maxAmount as string) };
    }

    const transactions = await prisma.financialTransaction.findMany({
      where: txWhere,
      include: { student: true }
    });

    const hasSubFilter = !!(entityId || paymentStatus || programType);
    const filteredReceipts = transactions.filter(tx => {
      if (tx.subscriptionId) {
        return subMap.has(tx.subscriptionId);
      }
      return !hasSubFilter;
    });

    // 4. Fetch Financial Transactions (Payments/Expenses) matching date filter
    const paymentWhere: any = {
      type: 'PAYMENT',
      status: 'COMPLETED'
    };
    if (dateFrom || dateTo) {
      paymentWhere.date = {};
      if (dateFrom) paymentWhere.date.gte = new Date(dateFrom as string);
      if (dateTo) paymentWhere.date.lte = new Date(dateTo as string);
    }
    const payments = await prisma.financialTransaction.findMany({
      where: paymentWhere
    });

    // 5. Calculate Summary Stats
    const totalRevenue = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = payments.reduce((sum, p) => sum + p.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    const studentIdSet = new Set<string>();
    filteredReceipts.forEach(r => studentIdSet.add(r.studentId));
    for (const sub of subMap.values()) {
      studentIdSet.add(sub.studentId);
    }
    const totalStudents = studentIdSet.size;

    const totalCommissions = filteredReceipts.reduce((sum, r) => sum + r.employeeCommission, 0);
    const entityShare = filteredReceipts.reduce((sum, r) => sum + r.universityShare, 0);
    const centerShare = filteredReceipts.reduce((sum, r) => sum + r.centerShare, 0);

    const summary = {
      totalRevenue,
      totalExpenses,
      netProfit,
      totalStudents,
      totalCommissions,
      entityShare,
      centerShare
    };

    // 6. Revenue by Program
    const programStats = new Map<string, { programName: string, type: string, students: Set<string>, totalRevenue: number, collected: number }>();

    for (const sub of subMap.values()) {
      const key = `${sub.type}-${sub.name}`;
      if (!programStats.has(key)) {
        programStats.set(key, {
          programName: sub.name,
          type: sub.type,
          students: new Set<string>(),
          totalRevenue: 0,
          collected: 0
        });
      }
      const stats = programStats.get(key)!;
      stats.students.add(sub.studentId);
      stats.totalRevenue += sub.totalCost;
    }

    filteredReceipts.forEach(r => {
      if (r.subscriptionId && subMap.has(r.subscriptionId)) {
        const sub = subMap.get(r.subscriptionId)!;
        const key = `${sub.type}-${sub.name}`;
        if (!programStats.has(key)) {
          programStats.set(key, {
            programName: sub.name,
            type: sub.type,
            students: new Set<string>(),
            totalRevenue: 0,
            collected: 0
          });
        }
        const stats = programStats.get(key)!;
        stats.students.add(r.studentId);
        stats.collected += r.amount;
      }
    });

    const revenueByProgram = Array.from(programStats.values()).map(p => ({
      programName: p.programName,
      type: p.type,
      studentCount: p.students.size,
      totalRevenue: p.totalRevenue,
      collected: p.collected
    }));

    // 7. Revenue by Entity
    const entityStats = new Map<string, { entityName: string, students: Set<string>, totalRevenue: number, entityShare: number, centerShare: number }>();

    filteredReceipts.forEach(r => {
      let entityName = 'مركز خارجي / مستقل';
      if (r.subscriptionId && subMap.has(r.subscriptionId)) {
        entityName = subMap.get(r.subscriptionId)!.entityName;
      }

      if (!entityStats.has(entityName)) {
        entityStats.set(entityName, {
          entityName,
          students: new Set<string>(),
          totalRevenue: 0,
          entityShare: 0,
          centerShare: 0
        });
      }

      const stats = entityStats.get(entityName)!;
      stats.students.add(r.studentId);
      stats.totalRevenue += r.amount;
      stats.entityShare += r.universityShare;
      stats.centerShare += r.centerShare;
    });

    const revenueByEntity = Array.from(entityStats.values()).map(e => ({
      entityName: e.entityName,
      studentCount: e.students.size,
      totalRevenue: e.totalRevenue,
      entityShare: e.entityShare,
      centerShare: e.centerShare
    }));

    // 8. Commissions by Employee
    const employees = await prisma.employee.findMany();
    const dbCommissions = await prisma.commission.findMany();

    const commissionsByEmployee = employees.map(emp => {
      const empStudents = students.filter(s => s.markerEmployeeId === emp.id);
      const studentCount = empStudents.length;

      const empComms = dbCommissions.filter(c => c.employeeId === emp.id);
      const dbTotal = empComms.reduce((sum, c) => sum + c.amount, 0);
      const dbPaid = empComms.filter(c => c.status === 'PAID').reduce((sum, c) => sum + c.amount, 0);

      // Commissions from transaction records
      const empTx = filteredReceipts.filter(t => t.employeeId === emp.id || (t.student && t.student.markerEmployeeId === emp.id));
      const txTotal = empTx.reduce((sum, t) => sum + t.employeeCommission, 0);

      const totalCommission = dbTotal + txTotal;
      const paid = dbPaid;
      const remaining = totalCommission - paid;

      return {
        employeeName: emp.fullName,
        studentCount,
        totalCommission,
        paid,
        remaining
      };
    }).filter(e => e.studentCount > 0 || e.totalCommission > 0);

    return res.json({
      summary,
      revenueByProgram,
      revenueByEntity,
      commissionsByEmployee
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'خطأ في توليد التقرير المالي' });
  }
});

// ==================== GET MY FINANCIAL PROFILE (student portal) ====================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.studentId) return res.status(404).json({ error: 'لم يتم ربط حسابك ببيانات طالب' });
    const [transactions, installments, student] = await Promise.all([
      prisma.financialTransaction.findMany({ where: { studentId: user.studentId }, orderBy: { createdAt: 'desc' } }),
      prisma.installment.findMany({ where: { studentId: user.studentId }, orderBy: [{ subscriptionId: 'asc' }, { installmentNumber: 'asc' }] }),
      prisma.student.findUnique({ where: { id: user.studentId }, include: { diplomaSubscriptions: { include: { diploma: true } }, courseSubscriptions: { include: { course: true } } } })
    ]);

    const totalCost = [
      ...((student?.diplomaSubscriptions || []).map(s => s.totalCost)),
      ...((student?.courseSubscriptions || []).map(s => s.totalCost))
    ].reduce((a, b) => a + b, 0);
    const totalPaid = transactions.filter(t => t.type === 'RECEIPT' && t.status === 'COMPLETED').reduce((a, t) => a + t.amount, 0);
    const totalRemaining = installments.filter(i => i.status !== 'PAID').reduce((a, i) => a + i.remainingAmount, 0);

    return res.json({ student, transactions, installments, summary: { totalCost, totalPaid, totalRemaining } });
  } catch {
    return res.status(500).json({ error: 'خطأ في جلب الملف المالي' });
  }
});

// ==================== GET STUDENT FINANCIAL PROFILE ====================
router.get('/student/:studentId', authMiddleware, selfOrPerm('finance.view'), async (req, res) => {
  try {
    const [transactions, installments, studentResult] = await Promise.all([
      prisma.financialTransaction.findMany({ where: { studentId: (req.params.studentId as string) }, orderBy: { createdAt: 'desc' } }),
      prisma.installment.findMany({ where: { studentId: (req.params.studentId as string) }, orderBy: [{ subscriptionId: 'asc' }, { installmentNumber: 'asc' }] }),
      prisma.student.findUnique({ where: { id: (req.params.studentId as string) }, include: { diplomaSubscriptions: { include: { diploma: true } }, courseSubscriptions: { include: { course: true } } } })
    ]);
    const student = studentResult as any;

    const totalCost = [
      ...((student?.diplomaSubscriptions || []).map(s => s.totalCost)),
      ...((student?.courseSubscriptions || []).map(s => s.totalCost))
    ].reduce((a, b) => a + b, 0);
    const totalPaid = transactions.filter(t => t.type === 'RECEIPT' && t.status === 'COMPLETED').reduce((a, t) => a + t.amount, 0);
    const totalRemaining = installments.filter(i => i.status !== 'PAID').reduce((a, i) => a + i.remainingAmount, 0);

    return res.json({ student, transactions, installments, summary: { totalCost, totalPaid, totalRemaining } });
  } catch {
    return res.status(500).json({ error: 'خطأ في جلب الملف المالي' });
  }
});

// ==================== CREATE RECEIPT (سند قبض) ====================
router.post('/receipt', authMiddleware, requirePermission('finance.receipts'), async (req, res) => {
  try {
    const { studentId, subscriptionId, subscriptionType, amount, paymentMethod, notes, entityId, sectionId, paymentWallet, paymentBank, senderInfo, referenceNumber, paymentDest, paymentSubMethod, paymentWalletRef, checkNumber, hawalaNumber } = req.body;
    if (!amount) return res.status(400).json({ error: 'المبلغ مطلوب' });

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'مبلغ غير صالح' });

    if (!referenceNumber) return res.status(400).json({ error: 'رقم المرجع مطلوب' });
    const existing = await prisma.financialTransaction.findFirst({ where: { referenceNumber } });
    if (existing) return res.status(400).json({ error: 'رقم المرجع مستخدم مسبقاً في معاملة أخرى' });

    const receiptNumber = await generateReceiptNumber('RECEIPT');

    // Calculate revenue split based on entity commission type
    let universityShare = 0, centerShare = 0, commission = 0, lecturerCost = 0;
    if (entityId && studentId) {
      const entity = await prisma.educationalEntity.findUnique({ where: { id: parseInt(entityId) } });
      if (entity) {
        switch (entity.commissionType) {
          case 'PERCENTAGE':
            universityShare = (parsedAmount * entity.uniPercentage) / 100;
            break;
          case 'FIXED_PER_STUDENT':
            universityShare = entity.fixedAmount;
            break;
          case 'PER_ROOM':
            universityShare = entity.roomAmount;
            break;
          case 'PERCENTAGE_AND_FIXED':
            universityShare = (parsedAmount * entity.uniPercentage) / 100 + entity.fixedAmount;
            break;
          case 'PERCENTAGE_AND_ROOM':
            universityShare = (parsedAmount * entity.uniPercentage) / 100 + entity.roomAmount;
            break;
          case 'FIXED_AND_ROOM':
            universityShare = entity.fixedAmount + entity.roomAmount;
            break;
          default:
            universityShare = (parsedAmount * entity.uniPercentage) / 100;
        }
        centerShare = parsedAmount - universityShare;
        commission = centerShare * 0.05; // 5% center commission to marketer
      }
    }

    // Calculate lecturer cost if section provided
    if (sectionId) {
      const section = await prisma.section.findUnique({
        where: { id: parseInt(sectionId as string) },
        include: { instructor: true }
      });
      if (section?.instructor?.courseRate) {
        lecturerCost = section.instructor.courseRate;
      }
    }

    // Get the student's marketer/employee ID if present
    let employeeId: number | null = null;
    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId as string } });
      employeeId = student?.markerEmployeeId || null;
    }

    const transaction = await prisma.financialTransaction.create({
      data: {
        studentId: studentId || null,
        subscriptionId: subscriptionId || null,
        subscriptionType: subscriptionType || null,
        type: 'RECEIPT',
        amount: parsedAmount,
        paymentMethod: paymentMethod || 'CASH',
        status: 'COMPLETED',
        receiptNumber,
        referenceNumber: referenceNumber || null,
        universityShare,
        centerShare,
        employeeCommission: commission,
        employeeId,
        lecturerCost,
        paymentWallet: paymentWallet || null,
        paymentBank: paymentBank || null,
        senderInfo: senderInfo || null,
        paymentDest: paymentDest || null,
        paymentSubMethod: paymentSubMethod || null,
        paymentWalletRef: paymentWalletRef || null,
        checkNumber: checkNumber || null,
        hawalaNumber: hawalaNumber || null,
        notes: notes || null
      },
      include: { student: { select: { id: true, fullNameAr: true } } }
    });

    // Audit
    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id, action: 'CREATE', entity: 'Receipt',
        details: JSON.stringify({ receiptNumber, studentId: studentId || null, amount: parsedAmount })
      }
    });

    return res.json(transaction);
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'فشل إنشاء سند القبض' });
  }
});

// ==================== CREATE PAYMENT (سند صرف) ====================
router.post('/payment', authMiddleware, requirePermission('finance.payments'), async (req, res) => {
  try {
    const { studentId, amount, paymentMethod, notes, beneficiary, expenseCategory } = req.body;
    if (!amount) return res.status(400).json({ error: 'المبلغ مطلوب' });

    const parsedAmount = parseFloat(amount);
    const receiptNumber = await generateReceiptNumber('PAYMENT');

    const transaction = await prisma.financialTransaction.create({
      data: {
        studentId: studentId || null,
        type: 'PAYMENT',
        amount: parsedAmount,
        paymentMethod: paymentMethod || 'CASH',
        status: 'COMPLETED',
        receiptNumber,
        expenseCategory: expenseCategory || null,
        notes: `${beneficiary ? 'المستفيد: ' + beneficiary + ' — ' : ''}${notes || ''}`
      }
    });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id, action: 'CREATE', entity: 'Payment',
        details: JSON.stringify({ receiptNumber, amount: parsedAmount, beneficiary })
      }
    });

    return res.json(transaction);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشل إنشاء سند الصرف' });
  }
});

// ==================== VOID TRANSACTION ====================
router.put('/:id/void', authMiddleware, requirePermission('finance.receipts'), async (req, res) => {
  try {
    const tx = await prisma.financialTransaction.update({
      where: { id: parseInt(req.params.id as string) },
      data: { status: 'VOIDED', notes: (req.body.reason ? 'ملغاة: ' + req.body.reason : 'ملغاة') }
    });
    return res.json(tx);
  } catch {
    return res.status(400).json({ error: 'فشل إلغاء المعاملة' });
  }
});

// ==================== STUDENT INSTALLMENT BALANCE ====================
router.get('/students/:studentId/installment-balance', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const studentId = req.params.studentId as string;
    const installments = await prisma.installment.findMany({
      where: { studentId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' }
    });
    const balance = installments.reduce((sum, inst) => sum + inst.remainingAmount, 0);
    return res.json({ balance, installments, totalInstallments: installments.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'خطأ في جلب رصيد الطالب' });
  }
});

// ==================== PAY STUDENT (خصم من الدفعات) ====================
router.post('/pay-student', authMiddleware, requirePermission('finance.receipts'), async (req, res) => {
  try {
    const { amount, paymentMethod, paymentWallet, paymentBank, senderInfo, referenceNumber, notes, paymentDest, paymentSubMethod, paymentWalletRef, checkNumber, hawalaNumber } = req.body;
    const studentId = req.body.studentId as string;
    if (!studentId || !amount) return res.status(400).json({ error: 'الطالب والمبلغ مطلوبان' });

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) return res.status(400).json({ error: 'مبلغ غير صالح' });

    if (!referenceNumber) return res.status(400).json({ error: 'رقم المرجع مطلوب' });
    const existing = await prisma.financialTransaction.findFirst({ where: { referenceNumber } });
    if (existing) return res.status(400).json({ error: 'رقم المرجع مستخدم مسبقاً في معاملة أخرى' });

    // Get unpaid installments ordered by due date (FIFO)
    const installments = await prisma.installment.findMany({
      where: { studentId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' }
    });

    if (installments.length === 0) return res.status(400).json({ error: 'لا توجد دفعات مستحقة لهذا الطالب' });

    const totalRemaining = installments.reduce((s, i) => s + i.remainingAmount, 0);
    if (payAmount > totalRemaining) return res.status(400).json({ error: `المبلغ المدفوع (${payAmount}) أكبر من الرصيد المستحق (${totalRemaining})` });

    let remaining = payAmount;
    const updatedInsts: any[] = [];

    // Deduct from installments FIFO
    for (const inst of installments) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, inst.remainingAmount);
      const newPaid = inst.paidAmount + deduct;
      const newRemaining = inst.remainingAmount - deduct;
      const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';

      await prisma.installment.update({
        where: { id: inst.id },
        data: {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentDate: newStatus === 'PAID' ? new Date() : inst.paymentDate,
          paymentMethod: paymentMethod || 'CASH',
          paymentWallet: (paymentMethod === 'WALLET' && paymentWallet) ? paymentWallet : inst.paymentWallet,
          paymentBank: (paymentMethod === 'CLICK' && paymentBank) ? paymentBank : inst.paymentBank,
          senderInfo: (paymentMethod === 'CLICK' && senderInfo) ? senderInfo : inst.senderInfo,
          referenceNumber: referenceNumber || inst.referenceNumber,
        }
      });

      updatedInsts.push({ id: inst.id, installmentNumber: inst.installmentNumber, totalInstallments: inst.totalInstallments, amount: inst.amount, paidAmount: newPaid, remainingAmount: newRemaining, status: newStatus });
      remaining -= deduct;
    }

    // Create one financial transaction for the total payment
    const receiptNumber = await generateReceiptNumber('RECEIPT');

    const transaction = await prisma.financialTransaction.create({
      data: {
        studentId,
        installmentId: updatedInsts.length > 0 ? updatedInsts[0].id : null,
        type: 'RECEIPT',
        amount: payAmount,
        paymentMethod: paymentMethod || 'CASH',
        status: 'COMPLETED',
        receiptNumber,
        referenceNumber: referenceNumber || null,
        paymentWallet: paymentMethod === 'WALLET' ? (paymentWallet || null) : null,
        paymentBank: paymentMethod === 'CLICK' ? (paymentBank || null) : null,
        senderInfo: paymentMethod === 'CLICK' ? (senderInfo || null) : null,
        paymentDest: paymentDest || null,
        paymentSubMethod: paymentSubMethod || null,
        paymentWalletRef: paymentWalletRef || null,
        checkNumber: checkNumber || null,
        hawalaNumber: hawalaNumber || null,
        notes: notes || `دفع على ${updatedInsts.length} دفعات`
      },
      include: { student: { select: { id: true, fullNameAr: true } } }
    });

    // Audit
    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id, action: 'CREATE', entity: 'Receipt',
        details: JSON.stringify({ receiptNumber, studentId, amount: payAmount, method: paymentMethod, installments: updatedInsts.length })
      }
    });

    return res.json({ transaction, installments: updatedInsts, paidAmount: payAmount, balanceBefore: totalRemaining, balanceAfter: totalRemaining - payAmount });
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'فشل دفع الطالب' });
  }
});

// ==================== STUDENTS FINANCIAL LIST ====================
router.get('/students-list', authMiddleware, requirePermission('finance.view'), async (req, res) => {
  try {
    const {
      query, status, studentType, nationality,
      dateFrom, dateTo,
      paymentStatus, entityId, programType,
      markerEmployeeId, diplomaId, courseId, sectionId,
      page, limit
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string) || 50));

    // Build where clause for students
    const where: any = {};
    if (status) where.status = status as string;
    if (studentType) where.studentType = studentType as string;
    if (nationality) where.nationality = nationality as string;
    if (markerEmployeeId) where.markerEmployeeId = parseInt(markerEmployeeId as string);
    if (dateFrom || dateTo) {
      where.registrationDate = {};
      if (dateFrom) where.registrationDate.gte = new Date(dateFrom as string);
      if (dateTo) where.registrationDate.lte = new Date(dateTo as string);
    }

    // If sectionId is specified, filter students by section enrollment
    if (sectionId) {
      where.sections = { some: { sectionId: parseInt(sectionId as string) } };
    }

    let students = await prisma.student.findMany({
      where,
      include: {
        markerEmployee: { select: { id: true, fullName: true } },
        diplomaSubscriptions: { include: { diploma: true, entity: true } },
        courseSubscriptions: { include: { course: true, entity: true } },
        sections: { include: { section: { select: { id: true, courseId: true } } } },
      },
      orderBy: { createdAt: 'desc' }
    });

    // Apply query filter
    if (query && typeof query === 'string' && query.trim()) {
      const { normalizeNumbers, normalizeArabic, smartFilter } = await import('../utils/searchEngine.js');
      const q = normalizeNumbers(query.trim());
      students = smartFilter(students, q, [
        'fullNameAr', 'fullNameEn', 'nationalId', 'passportId',
        'personalId', 'phones', 'universityId', 'id'
      ]);
    }

    // Filter by program type
    if (programType === 'DIPLOMA') {
      students = students.filter(s => s.diplomaSubscriptions.length > 0);
    } else if (programType === 'COURSE') {
      students = students.filter(s => s.courseSubscriptions.length > 0);
    }

    // Filter by entity
    if (entityId) {
      students = students.filter(s =>
        s.diplomaSubscriptions.some(sub => sub.entityId === parseInt(entityId as string)) ||
        s.courseSubscriptions.some(sub => sub.entityId === parseInt(entityId as string))
      );
    }

    // Filter by diploma
    if (diplomaId) {
      students = students.filter(s =>
        s.diplomaSubscriptions.some(sub => sub.diplomaId === diplomaId)
      );
    }

    // Filter by course
    if (courseId) {
      students = students.filter(s =>
        s.courseSubscriptions.some(sub => sub.courseId === courseId) ||
        s.sections.some(ss => ss.section.courseId === courseId)
      );
    }

    // Get installment and transaction summaries for filtered students
    const studentIds = students.map(s => s.id);

    const [installmentGroups, transactionGroups] = await Promise.all([
      prisma.installment.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _sum: { amount: true, paidAmount: true, remainingAmount: true },
        _count: { id: true },
      }),
      prisma.financialTransaction.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, type: 'RECEIPT', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const instMap = new Map(installmentGroups.map(g => [g.studentId, g]));
    const txMap = new Map(transactionGroups.map(g => [g.studentId, g]));

    // Compute per-student financial data
    const data = students.map(s => {
      const ig = instMap.get(s.id);
      const tg = txMap.get(s.id);

      const totalSubscriptionCost = [
        ...s.diplomaSubscriptions,
        ...s.courseSubscriptions,
      ].reduce((sum, sub) => sum + sub.totalCost, 0);

      const totalDiscount = [
        ...s.diplomaSubscriptions,
        ...s.courseSubscriptions,
      ].reduce((sum, sub) => {
        if (sub.discountType === 'FIXED') return sum + sub.discountValue;
        if (sub.discountType === 'PERCENTAGE') return sum + (sub.totalCost * sub.discountValue / 100);
        return sum;
      }, 0);

      const totalAmount = ig?._sum.amount || 0;
      const totalPaid = ig?._sum.paidAmount || 0;
      const totalRemaining = ig?._sum.remainingAmount || 0;
      const installmentCount = ig?._count.id || 0;
      const paymentCount = tg?._count.id || 0;

      const entities = [
        ...new Set([
          ...s.diplomaSubscriptions.map(sub => sub.entity?.name).filter(Boolean),
          ...s.courseSubscriptions.map(sub => sub.entity?.name).filter(Boolean),
        ])
      ] as string[];

      const programs = [
        ...s.diplomaSubscriptions.map(sub => sub.diploma?.name).filter(Boolean),
        ...s.courseSubscriptions.map(sub => sub.course?.name).filter(Boolean),
      ] as string[];

      return {
        id: s.id,
        systemId: s.id,
        fullNameAr: s.fullNameAr,
        fullNameEn: s.fullNameEn,
        phones: (() => { try { return JSON.parse(s.phones); } catch { return []; } })(),
        status: s.status,
        studentType: s.studentType,
        nationality: s.nationality,
        markerEmployeeName: s.markerEmployee?.fullName || '',
        markerEmployeeId: s.markerEmployeeId ?? '',
        totalSubscriptionCost: Math.round(totalSubscriptionCost * 1000) / 1000,
        totalDiscount: Math.round(totalDiscount * 1000) / 1000,
        totalAmount: Math.round(totalAmount * 1000) / 1000,
        totalPaid: Math.round(totalPaid * 1000) / 1000,
        totalRemaining: Math.round(totalRemaining * 1000) / 1000,
        installmentCount,
        paymentCount,
        entities,
        programs,
        hasDiploma: s.diplomaSubscriptions.length > 0,
        hasCourse: s.courseSubscriptions.length > 0,
      };
    });

    // Filter by payment status
    let filtered = data;
    if (paymentStatus === 'PAID') {
      filtered = data.filter(s => s.totalRemaining <= 0 && s.totalAmount > 0);
    } else if (paymentStatus === 'UNPAID') {
      filtered = data.filter(s => s.totalRemaining > 0);
    } else if (paymentStatus === 'PARTIAL') {
      filtered = data.filter(s => s.totalPaid > 0 && s.totalRemaining > 0);
    } else if (paymentStatus === 'NO_INSTALLMENTS') {
      filtered = data.filter(s => s.installmentCount === 0);
    }

    // Summary stats
    const summary = {
      totalStudents: filtered.length,
      totalCost: Math.round(filtered.reduce((s, d) => s + d.totalAmount, 0) * 1000) / 1000,
      totalPaid: Math.round(filtered.reduce((s, d) => s + d.totalPaid, 0) * 1000) / 1000,
      totalRemaining: Math.round(filtered.reduce((s, d) => s + d.totalRemaining, 0) * 1000) / 1000,
      totalDiscount: Math.round(filtered.reduce((s, d) => s + d.totalDiscount, 0) * 1000) / 1000,
      studentsWithBalance: filtered.filter(s => s.totalRemaining > 0).length,
      paidInFull: filtered.filter(s => s.totalRemaining <= 0 && s.totalAmount > 0).length,
      noInstallments: filtered.filter(s => s.installmentCount === 0).length,
    };

    const total = filtered.length;
    const paged = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({ data: paged, total, page: pageNum, limit: limitNum, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'خطأ في جلب القائمة المالية للطلاب' });
  }
});

export default router;
