import express from 'express';
import { prisma } from '../index.js';
import { generateReceiptNumber } from '../utils/generateReceiptNumber.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// ==================== GENERATE INSTALLMENTS (helper) ====================
export async function generateInstallments(
  studentId: string,
  subscriptionId: string,
  subscriptionType: 'DIPLOMA' | 'COURSE',
  totalAmount: number,
  installmentsCount: number,
  startDate: Date = new Date(),
  firstAmount?: number,
  dates?: string[],
  customAmounts?: number[]
) {
  const installments = [];

  for (let i = 1; i <= installmentsCount; i++) {
    const idx = i - 1;
    const amount = customAmounts?.[idx] !== undefined
      ? customAmounts[idx]
      : (i === 1 && firstAmount !== undefined
        ? firstAmount!
        : Math.round(((totalAmount - (firstAmount || 0)) / Math.max(installmentsCount - 1, 1)) * 100) / 100);
    const dueDate = dates?.[idx]
      ? new Date(dates[idx])
      : new Date(startDate.getTime() + idx * 30 * 86400000);

    installments.push(
      await prisma.installment.create({
        data: {
          studentId,
          subscriptionId,
          subscriptionType,
          installmentNumber: i,
          totalInstallments: installmentsCount,
          dueDate,
          amount,
          remainingAmount: amount,
          status: 'PENDING'
        }
      })
    );
  }
  return installments;
}

// ==================== GET ALL INSTALLMENTS ====================
router.get('/', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const { status, studentId, subscriptionId, subscriptionType, overdueOnly, upcomingDays } = req.query;
    const where: any = {};

    if (status) where.status = status;
    if (studentId) where.studentId = studentId as string;
    if (subscriptionId) where.subscriptionId = subscriptionId as string;
    if (subscriptionType) where.subscriptionType = subscriptionType as string;
    if (overdueOnly === 'true') {
      where.status = 'PENDING';
      where.dueDate = { lt: new Date() };
    }
    if (upcomingDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(upcomingDays as string));
      where.dueDate = { lte: futureDate, gte: new Date() };
      where.status = 'PENDING';
    }

    const installments = await prisma.installment.findMany({
      where,
      include: { student: { select: { id: true, fullNameAr: true, fullNameEn: true, phones: true } } },
      orderBy: { dueDate: 'asc' }
    });

    // Auto-mark overdue
    const now = new Date();
    const overdueIds = installments
      .filter(i => i.status === 'PENDING' && new Date(i.dueDate) < now)
      .map(i => i.id);
    if (overdueIds.length > 0) {
      await prisma.installment.updateMany({ where: { id: { in: overdueIds } }, data: { status: 'OVERDUE' } });
    }

    return res.json(installments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'خطأ في جلب الأقساط' });
  }
});

// ==================== GET SUMMARY (dashboard cards) ====================
router.get('/summary', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const now = new Date();
    const [pending, overdue, paidToday, total] = await Promise.all([
      prisma.installment.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: true }),
      prisma.installment.aggregate({ where: { status: 'OVERDUE' }, _sum: { amount: true }, _count: true }),
      prisma.installment.aggregate({ where: { status: 'PAID', paymentDate: { gte: new Date(now.toDateString()) } }, _sum: { paidAmount: true }, _count: true }),
      prisma.installment.aggregate({ _sum: { amount: true }, _count: true })
    ]);
    return res.json({ pending, overdue, paidToday, total });
  } catch {
    return res.status(500).json({ error: 'خطأ في الملخص' });
  }
});

// ==================== GET STUDENT INSTALLMENTS ====================
router.get('/student/:studentId', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const installments = await prisma.installment.findMany({
      where: { studentId: (req.params.studentId as string) },
      orderBy: [{ subscriptionId: 'asc' }, { installmentNumber: 'asc' }]
    });
    return res.json(installments);
  } catch {
    return res.status(500).json({ error: 'خطأ في جلب أقساط الطالب' });
  }
});

// ==================== CREATE INSTALLMENT ====================
router.post('/', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const { studentId, subscriptionType, subscriptionId, dueDate, amount, notes, category } = req.body;

    let subType = subscriptionType as string;
    let subId = subscriptionId as string;

    if (category && category !== 'SUBSCRIPTION') {
      subType = 'EXTRA';
      subId = `EXTRA-${category}`;
    }

    if (!studentId || !subType || !subId || !dueDate || !amount) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة: الطالب، النوع، الاشتراك، تاريخ الاستحقاق، المبلغ' });
    }

    // Get count and max totalInstallments for this subscription
    const [count, maxAgg] = await Promise.all([
      prisma.installment.count({ where: { subscriptionId: subId } }),
      prisma.installment.aggregate({ where: { subscriptionId: subId }, _max: { totalInstallments: true } }),
    ]);
    const totalInsts = maxAgg._max.totalInstallments || count;

    const installment = await prisma.installment.create({
      data: {
        studentId,
        subscriptionType: subType,
        subscriptionId: subId,
        installmentNumber: count + 1,
        totalInstallments: totalInsts,
        dueDate: new Date(dueDate),
        amount: parseFloat(amount),
        remainingAmount: parseFloat(amount),
        status: 'PENDING',
        notes: notes || null,
      }
    });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'CREATE',
        entity: 'Installment',
        details: JSON.stringify({ installmentId: installment.id, studentId, subscriptionId: subId, amount, category: category || 'SUBSCRIPTION' })
      }
    });

    return res.status(201).json(installment);
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'فشل إضافة القسط' });
  }
});

// ==================== PAY INSTALLMENT ====================
router.post('/:id/pay', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const { amount, paymentMethod, notes, expenses, expenseCategory, referenceNumber, paymentWallet, paymentBank, senderInfo, paymentDest, paymentSubMethod, paymentWalletRef, checkNumber, hawalaNumber } = req.body;
    const id = parseInt(req.params.id as string);
    const installment = await prisma.installment.findUnique({ where: { id } });
    if (!installment) return res.status(404).json({ error: 'القسط غير موجود' });
    if (installment.status === 'PAID') return res.status(400).json({ error: 'هذا القسط مدفوع بالفعل' });

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) return res.status(400).json({ error: 'مبلغ غير صالح' });

    if (referenceNumber) {
      const existing = await prisma.financialTransaction.findFirst({ where: { referenceNumber } });
      if (existing) return res.status(400).json({ error: 'رقم المرجع مستخدم مسبقاً في معاملة أخرى' });
    }

    const expensesAmount = parseFloat(expenses) || 0;
    const netAmount = payAmount - expensesAmount;
    if (netAmount < 0) return res.status(400).json({ error: 'المصروفات أكبر من المبلغ المدفوع' });

    const newPaid = installment.paidAmount + netAmount;
    const remaining = Math.max(0, installment.amount - newPaid);
    const newStatus = remaining === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : installment.status);

    const updated = await prisma.installment.update({
      where: { id: parseInt(req.params.id as string) },
      data: {
        paidAmount: newPaid,
        remainingAmount: remaining,
        status: newStatus,
        paymentDate: newStatus === 'PAID' ? new Date() : installment.paymentDate,
        paymentMethod: paymentMethod || 'CASH',
        referenceNumber: referenceNumber || installment.referenceNumber,
        paymentWallet: paymentWallet || installment.paymentWallet,
        paymentBank: paymentBank || installment.paymentBank,
        senderInfo: senderInfo || installment.senderInfo,
        paymentDest: paymentDest || installment.paymentDest,
        paymentSubMethod: paymentSubMethod || installment.paymentSubMethod,
        paymentWalletRef: paymentWalletRef || installment.paymentWalletRef,
        checkNumber: checkNumber || installment.checkNumber,
        hawalaNumber: hawalaNumber || installment.hawalaNumber,
        notes: notes || installment.notes
      }
    });

    // Create financial transaction record(s)
    const actingUser = (req as any).user;
    const receiptNumber = await generateReceiptNumber('RECEIPT');

    // Main receipt for net amount (payAmount - expenses)
    await prisma.financialTransaction.create({
      data: {
        studentId: installment.studentId,
        subscriptionId: installment.subscriptionId,
        subscriptionType: installment.subscriptionType,
        installmentId: installment.id,
        type: 'RECEIPT',
        amount: netAmount,
        paymentMethod: paymentMethod || 'CASH',
        status: 'COMPLETED',
        receiptNumber,
        referenceNumber: referenceNumber || null,
        notes: notes || `دفع قسط ${installment.installmentNumber}/${installment.totalInstallments}`,
        paymentWallet: paymentMethod === 'WALLET' ? (paymentWallet || null) : null,
        paymentBank: paymentMethod === 'CLICK' ? (paymentBank || null) : null,
        senderInfo: paymentMethod === 'CLICK' ? (senderInfo || null) : null,
        paymentDest: paymentDest || null,
        paymentSubMethod: paymentSubMethod || null,
        paymentWalletRef: paymentWalletRef || null,
        checkNumber: checkNumber || null,
        hawalaNumber: hawalaNumber || null,
      }
    });

    // Separate expense transaction if there are expenses
    if (expensesAmount > 0) {
      const expenseReceipt = await generateReceiptNumber('PAYMENT');
      await prisma.financialTransaction.create({
        data: {
          studentId: installment.studentId,
          type: 'EXPENSE',
          amount: expensesAmount,
          paymentMethod: paymentMethod || 'CASH',
          status: 'COMPLETED',
          receiptNumber: expenseReceipt,
          expenseCategory: expenseCategory || 'OTHER',
          notes: `مصروفات من قسط ${installment.installmentNumber}/${installment.totalInstallments} — ${notes || ''}`
        }
      });
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'PAY',
        entity: 'Installment',
        details: JSON.stringify({ installmentId: (req.params.id as string), amount: payAmount, netAmount, expenses: expensesAmount, paymentMethod })
      }
    });

    return res.json(updated);
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'فشل دفع القسط' });
  }
});

// ==================== UPDATE INSTALLMENT (reschedule) ====================
router.put('/:id', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const { dueDate, notes, amount, paymentMethod, referenceNumber, paymentWallet, paymentBank, senderInfo, status, paidAmount, remainingAmount, paymentDate } = req.body;
    const id = parseInt(req.params.id as string);
    const existingInst = await prisma.installment.findUnique({ where: { id } });
    if (!existingInst) return res.status(404).json({ error: 'القسط غير موجود' });
    const data: any = {};
    if (dueDate) data.dueDate = new Date(dueDate);
    if (notes !== undefined) data.notes = notes;
    if (amount) {
      const newAmt = parseFloat(amount);
      data.amount = newAmt;
      data.remainingAmount = Math.max(0, newAmt - (existingInst.paidAmount || 0));
    }
    if (paymentMethod) data.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) data.referenceNumber = referenceNumber;
    if (paymentWallet !== undefined) data.paymentWallet = paymentWallet;
    if (paymentBank !== undefined) data.paymentBank = paymentBank;
    if (senderInfo !== undefined) data.senderInfo = senderInfo;
    if (status) data.status = status;
    if (paidAmount !== undefined) data.paidAmount = parseFloat(paidAmount);
    if (remainingAmount !== undefined) data.remainingAmount = parseFloat(remainingAmount);
    if (paymentDate !== undefined) data.paymentDate = paymentDate ? new Date(paymentDate) : null;

    const updated = await prisma.installment.update({ where: { id: parseInt(req.params.id as string) }, data });
    return res.json(updated);
  } catch {
    return res.status(400).json({ error: 'فشل تعديل القسط' });
  }
});

// ==================== VOID PAYMENT ====================
router.post('/:id/void-payment', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const installment = await prisma.installment.findUnique({ where: { id } });
    if (!installment) return res.status(404).json({ error: 'القسط غير موجود' });
    if (installment.status === 'PENDING') return res.status(400).json({ error: 'هذا القسط غير مدفوع أصلاً' });

    // Void linked financial transactions
    await prisma.financialTransaction.updateMany({
      where: { installmentId: id, status: 'COMPLETED' },
      data: {
        status: 'VOIDED',
        notes: `ملغاة بسبب إلغاء دفع القسط #${installment.installmentNumber}`
      }
    });

    const updated = await prisma.installment.update({
      where: { id },
      data: {
        status: 'PENDING',
        paidAmount: 0,
        remainingAmount: installment.amount,
        paymentDate: null,
        paymentMethod: null,
        referenceNumber: null,
        paymentWallet: null,
        paymentBank: null,
        senderInfo: null,
      }
    });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'VOID_PAYMENT',
        entity: 'Installment',
        details: JSON.stringify({ installmentId: id, oldStatus: installment.status, paidAmount: installment.paidAmount })
      }
    });

    return res.json(updated);
  } catch {
    return res.status(400).json({ error: 'فشل إلغاء الدفع' });
  }
});

// ==================== DELETE INSTALLMENT ====================
router.delete('/:id', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const installment = await prisma.installment.findUnique({ where: { id } });
    if (!installment) return res.status(404).json({ error: 'القسط غير موجود' });
    if (installment.status === 'PAID') return res.status(400).json({ error: 'لا يمكن حذف قسط مدفوع' });

    // Guard: deleting a subscription installment must not reduce the total below the subscription price
    // (skipped when merge=true — the reschedule redistributes the removed amounts onto other installments first)
    if (!(req.query.merge === 'true') && installment.subscriptionType && installment.subscriptionType !== 'EXTRA') {
      const subId = parseInt(installment.subscriptionId);
      const [sub, subInsts] = await Promise.all([
        installment.subscriptionType === 'DIPLOMA'
          ? prisma.diplomaSubscription.findUnique({ where: { id: subId } })
          : prisma.courseSubscription.findUnique({ where: { id: subId } }),
        prisma.installment.findMany({ where: { subscriptionId: installment.subscriptionId } }),
      ]);
      const cap = (sub as any)?.totalCost || 0;
      const newTotal = subInsts.reduce((s, i) => s + i.amount, 0) - installment.amount;
      if (cap > 0 && newTotal < cap - 0.001) {
        return res.status(400).json({ error: `لا يمكن حذف القسط: إجمالي الأقساط سيصبح (${newTotal.toFixed(2)}) أقل من قيمة الاشتراك (${cap.toFixed(2)})` });
      }
    }

    // Delete related financial transactions
    await prisma.financialTransaction.deleteMany({ where: { installmentId: id } });
    await prisma.installment.delete({ where: { id } });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'DELETE',
        entity: 'Installment',
        details: JSON.stringify({ installmentId: (req.params.id as string), subscriptionId: installment.subscriptionId })
      }
    });

    return res.json({ success: true });
  } catch {
    return res.status(400).json({ error: 'فشل حذف القسط' });
  }
});

// ==================== GET INSTALLMENT TRANSACTIONS ====================
router.get('/:id/transactions', authMiddleware, requirePermission('finance.installments'), async (req, res) => {
  try {
    const transactions = await prisma.financialTransaction.findMany({
      where: { installmentId: parseInt(req.params.id as string) },
      include: { student: { select: { id: true, fullNameAr: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(transactions);
  } catch {
    return res.status(500).json({ error: 'خطأ في جلب معاملات القسط' });
  }
});

export default router;
