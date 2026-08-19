import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { generateReceiptNumber } from '../utils/generateReceiptNumber.js';

const router = express.Router();

// ============================================================================
// FINANCIAL SETTLEMENT (التسوية المالية) بين المركز وجهات التعليم
//
// Single Source of Truth: كل الحسابات هنا تُشتق من البيانات الحقيقية
// (الاشتراكات + الأقساط المدفوعة + سندات القبض) وبنفس معادلة التقسيم الموجودة
// في صفحة سند القبض (financial.ts / fin-accounts.ts) — لا توجد أرقام يدوية.
// ============================================================================

type EntityConfig = { commissionType: string; uniPercentage: number; fixedAmount: number; roomAmount: number };

// نفس معادلة حصة الجهة المستخدمة في إنشاء سند القبض ومولد المطالبات القديم.
export function entityShareOf(amount: number, entity: EntityConfig): number {
  switch (entity.commissionType) {
    case 'PERCENTAGE':
      return (amount * entity.uniPercentage) / 100;
    case 'FIXED_PER_STUDENT':
      return entity.fixedAmount;
    case 'PER_ROOM':
      return entity.roomAmount;
    case 'PERCENTAGE_AND_FIXED':
      return (amount * entity.uniPercentage) / 100 + entity.fixedAmount;
    case 'PERCENTAGE_AND_ROOM':
      return (amount * entity.uniPercentage) / 100 + entity.roomAmount;
    case 'FIXED_AND_ROOM':
      return entity.fixedAmount + entity.roomAmount;
    default:
      return (amount * entity.uniPercentage) / 100;
  }
}

const normalizeDigits = (v: string) =>
  String(v || '')
    .replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06f0-\u06f9]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48))
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();

// ============================================================================
// HELPERS: جلب كل ما يخص الاشتراكات المطلوبة في 3 استعلامات فقط (لا N+1)
// ============================================================================

async function loadFinancialData(subKeys: { id: number; type: 'DIPLOMA' | 'COURSE' }[]) {
  if (subKeys.length === 0) {
    return { instMap: new Map<string, any[]>(), txMap: new Map<string, any[]>(), claimMap: new Map<string, any[]>(), payMap: new Map<number, any[]>(), claimIdToSub: new Map<number, string>() };
  }

  const diagIds = subKeys.filter(s => s.type === 'DIPLOMA').map(s => String(s.id));
  const courseIds = subKeys.filter(s => s.type === 'COURSE').map(s => String(s.id));
  const makeOr = (ids: string[], type: string) => ids.length ? [{ subscriptionId: { in: ids }, subscriptionType: type }] : [];

  const [installs, txs, claims] = await Promise.all([
    prisma.installment.findMany({
      where: { OR: [...makeOr(diagIds, 'DIPLOMA'), ...makeOr(courseIds, 'COURSE')] },
      orderBy: [{ installmentNumber: 'asc' }],
    }),
    prisma.financialTransaction.findMany({
      where: {
        type: 'RECEIPT',
        status: 'COMPLETED',
        OR: [...makeOr(diagIds, 'DIPLOMA'), ...makeOr(courseIds, 'COURSE')],
      },
      orderBy: { date: 'desc' },
    }),
    prisma.entityClaim.findMany({
      where: {
        status: { not: 'VOIDED' },
        OR: [...makeOr(diagIds, 'DIPLOMA'), ...makeOr(courseIds, 'COURSE')],
      },
    }),
  ]);

  const instMap = new Map<string, any[]>();
  const txMap = new Map<string, any[]>();
  const claimMap = new Map<string, any[]>();
  const claimIdToSub = new Map<number, string>();
  for (const i of installs) {
    const k = `${i.subscriptionType}:${i.subscriptionId}`;
    if (!instMap.has(k)) instMap.set(k, []);
    instMap.get(k)!.push(i);
  }
  for (const t of txs) {
    if (t.installmentId) continue; // مبلغه محسوب أصلاً ضمن paidAmount للقسط
    const k = `${t.subscriptionType}:${t.subscriptionId}`;
    if (!txMap.has(k)) txMap.set(k, []);
    txMap.get(k)!.push(t);
  }
  for (const c of claims) {
    const k = `${c.subscriptionType}:${c.subscriptionId}`;
    if (!claimMap.has(k)) claimMap.set(k, []);
    claimMap.get(k)!.push(c);
    claimIdToSub.set(c.id, k);
  }

  // PAYMENT transactions = المبالغ المدفوعة فعلياً لجهة التعليم (مقيدة بالمطالبات)
  const claimIds = [...claimIdToSub.keys()];
  const pays = claimIds.length
    ? await prisma.financialTransaction.findMany({
        where: { type: 'PAYMENT', status: 'COMPLETED', entityClaimId: { in: claimIds } },
        orderBy: { date: 'asc' },
      })
    : [];
  const payMap = new Map<number, any[]>();
  for (const p of pays) {
    const subKey = claimIdToSub.get(p.entityClaimId!);
    if (!subKey) continue;
    if (!payMap.has(p.entityClaimId!)) payMap.set(p.entityClaimId!, []);
    payMap.get(p.entityClaimId!)!.push(p);
  }

  return { instMap, txMap, claimMap, payMap, claimIdToSub };
}

function computeRow(sub: any, type: 'DIPLOMA' | 'COURSE', data: Awaited<ReturnType<typeof loadFinancialData>>) {
  const k = `${type}:${sub.id}`;
  const insts = data.instMap.get(k) || [];
  const txs = data.txMap.get(k) || [];
  const claimLines = data.claimMap.get(k) || [];
  const entity = sub.entity;

  const totalFees = sub.totalCost || 0;

  // المال المحصَّل = ما دُفع على الأقساط + سندات قبض مستقلة (بدون ربط قسط)
  const totalPaid = insts.reduce((s, i) => s + (i.paidAmount || 0), 0) +
    txs.reduce((s, t) => s + (t.amount || 0), 0);

  const paidToEntity = insts
      .filter(i => i.paymentDest === 'ENTITY')
      .reduce((s, i) => s + (i.paidAmount || 0), 0) +
    txs.filter(t => t.paymentDest === 'ENTITY').reduce((s, t) => s + (t.amount || 0), 0);
  const paidToCenter = totalPaid - paidToEntity;

  // حصة الجهة حسب نفس المعادلة في سند القبض (على إجمالي رسوم التسجيل)
  const entityShare = entity ? entityShareOf(totalFees, entity) : 0;
  const centerShare = Math.max(0, totalFees - entityShare);

  // ما يستحقه جهة التعليم فعلياً من المال المحصَّل = min(الحصة، المحصَّل)
  const claimable = Math.max(0, Math.min(entityShare, totalPaid));

  // المدفوع فعلياً لجهة التعليم عبر المطالبات (سندات صرف مرتبطة بالمطالبة)
  const paidToEntityTotal = claimLines.reduce((s, c) => {
    return s + (data.payMap.get(c.id) || []).reduce((x, p) => x + (p.amount || 0), 0);
  }, 0);

  const remaining = Math.max(0, claimable - paidToEntityTotal);

  let status = 'NO_COLLECTION';
  if (totalPaid > 0.005) {
    if (remaining <= 0.005) status = 'SETTLED';
    else if (paidToEntityTotal > 0.005) status = 'PARTIAL';
    else status = 'UNSETTLED';
  }

  const lastPaidDate = insts
    .filter(i => i.paymentDate)
    .map(i => new Date(i.paymentDate).getTime())
    .concat(txs.map(t => new Date(t.date).getTime()))
    .sort((a, b) => b - a)[0];

  return {
    key: k,
    type,
    subscriptionId: String(sub.id),
    totalFees: round2(totalFees),
    totalPaid: round2(totalPaid),
    paidToEntity: round2(paidToEntity),
    paidToCenter: round2(paidToCenter),
    entityShare: round2(entityShare),
    centerShare: round2(centerShare),
    claimable: round2(claimable),
    paidToEntityTotal: round2(paidToEntityTotal),
    remaining: round2(remaining),
    status,
    lastPaidDate: lastPaidDate ? new Date(lastPaidDate).toISOString() : null,
    paymentStatus: totalPaid <= 0.005 ? 'UNPAID' : (totalPaid >= totalFees - 0.005 ? 'PAID' : 'PARTIAL'),
    hasClaim: claimLines.length > 0,
    entity: entity ? { id: entity.id, name: entity.name, commissionType: entity.commissionType, uniPercentage: entity.uniPercentage, fixedAmount: entity.fixedAmount, roomAmount: entity.roomAmount } : null,
    student: sub.student ? { id: sub.student.id, fullNameAr: sub.student.fullNameAr, fullNameEn: sub.student.fullNameEn || '' } : null,
    programName: sub.diploma?.name || sub.course?.name || null,
    programId: sub.diplomaId || sub.courseId || null,
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function entityScope(req: any) {
  const user = (req as any).user;
  if (user?.isAdmin || user?.role === 'ADMIN') return [];
  try { return JSON.parse(user?.assignedEntityIds || '[]') as number[]; } catch { return []; }
}

// ============================================================================
// GET /api/settlements  — جدول التسوية (Server-side filters + pagination)
// ============================================================================
router.get('/', authMiddleware, requirePermission('finance.settlements'), async (req, res) => {
  try {
    const {
      entityId, studentId, query, programType, diplomaId, courseId, sectionId,
      subscriptionId, dateFrom, dateTo, paymentStatus, settlementStatus, claimStatus,
      markerEmployeeId, page, limit,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 25));

    const scoped = entityScope(req);
    const entityWhere = entityId ? { id: parseInt(entityId as string) } : undefined;

    // بناء where للاشتراكات (دبلومات ودورات)
    const mkWhere = (type: 'DIPLOMA' | 'COURSE') => {
      const w: any = {};
      if (type === 'DIPLOMA') { if (diplomaId) w.diplomaId = diplomaId as string; }
      else { if (courseId) w.courseId = courseId as string; }
      if (scoped.length) w.entityId = { in: scoped };
      if (entityWhere) w.entityId = entityWhere.id;
      if (subscriptionId && programType === type) w.id = parseInt(subscriptionId as string);
      if (markerEmployeeId) w.student = { markerEmployeeId: parseInt(markerEmployeeId as string) };
      if (sectionId) w.student = { ...(w.student || {}), sections: { some: { sectionId: parseInt(sectionId as string) } } };
      if (studentId) w.studentId = studentId as string;
      if (query && String(query).trim()) {
        const q = String(query).trim();
        w.student = {
          ...(w.student || {}),
          OR: [
            { fullNameAr: { contains: q } },
            { fullNameEn: { contains: q } },
            { id: { contains: normalizeDigits(q) } },
          ],
        };
      }
      if (programType === 'DIPLOMA' && type === 'COURSE') return null;
      if (programType === 'COURSE' && type === 'DIPLOMA') return null;
      return w;
    };

    const [diplomaSubs, courseSubs] = await Promise.all([
      prisma.diplomaSubscription.findMany({
        where: mkWhere('DIPLOMA') || { id: -1 },
        include: { student: { select: { id: true, fullNameAr: true, fullNameEn: true } }, entity: true, diploma: { select: { id: true, name: true } } },
      }),
      prisma.courseSubscription.findMany({
        where: mkWhere('COURSE') || { id: -1 },
        include: { student: { select: { id: true, fullNameAr: true, fullNameEn: true } }, entity: true, course: { select: { id: true, name: true } } },
      }),
    ]);

    const subs: { sub: any; type: 'DIPLOMA' | 'COURSE' }[] = [
      ...diplomaSubs.map(sub => ({ sub, type: 'DIPLOMA' as const })),
      ...courseSubs.map(sub => ({ sub, type: 'COURSE' as const })),
    ].filter(x => x.sub.entityId);

    const data = await loadFinancialData(subs.map(x => ({ id: x.sub.id, type: x.type })));
    let rows = subs.map(x => computeRow(x.sub, x.type, data));

    // فلاتر مالية (تُطبق على الصفوف المحسوبة — مصدر الحقيقة)
    const periodFrom = dateFrom ? new Date(dateFrom as string).getTime() : null;
    const periodTo = dateTo ? new Date(dateTo as string).getTime() + 86399999 : null;
    if (periodFrom || periodTo) {
      rows = rows.filter(r => r.lastPaidDate && (!periodFrom || new Date(r.lastPaidDate).getTime() >= periodFrom) && (!periodTo || new Date(r.lastPaidDate).getTime() <= periodTo));
    }
    if (paymentStatus) rows = rows.filter(r => r.paymentStatus === paymentStatus);
    if (settlementStatus) rows = rows.filter(r => r.status === settlementStatus);
    if (claimStatus) rows = rows.filter(r => (claimStatus === 'WITH_CLAIM' ? r.hasClaim : !r.hasClaim));

    // الإجماليات على كل الصفوف المطابقة (وليس الصفحة فقط)
    const summary = {
      totalFees: round2(rows.reduce((s, r) => s + r.totalFees, 0)),
      totalPaid: round2(rows.reduce((s, r) => s + r.totalPaid, 0)),
      entityShare: round2(rows.reduce((s, r) => s + r.entityShare, 0)),
      centerShare: round2(rows.reduce((s, r) => s + r.centerShare, 0)),
      paidToEntity: round2(rows.reduce((s, r) => s + r.paidToEntityTotal, 0)),
      remaining: round2(rows.reduce((s, r) => s + r.remaining, 0)),
      unsettled: round2(rows.filter(r => r.status === 'UNSETTLED' || r.status === 'PARTIAL').reduce((s, r) => s + r.remaining, 0)),
      centerDue: round2(rows.reduce((s, r) => s + Math.max(0, r.totalPaid - r.claimable), 0)),
      count: rows.length,
      unsettledCount: rows.filter(r => r.status === 'UNSETTLED').length,
    };

    rows.sort((a, b) => (b.lastPaidDate || '').localeCompare(a.lastPaidDate || ''));
    const total = rows.length;
    const pageRows = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({ summary, rows: pageRows, total, page: pageNum, limit: limitNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'خطأ في حساب التسوية' });
  }
});

// ============================================================================
// GET /api/settlements/meta — خيارات الفلاتر
// ============================================================================
router.get('/meta', authMiddleware, requirePermission('finance.settlements'), async (req, res) => {
  try {
    const scoped = entityScope(req);
    const entityWhere = scoped.length ? { id: { in: scoped } } : {};
    const [entities, employees, sections, courses, diplomas, subscriptions] = await Promise.all([
      prisma.educationalEntity.findMany({ where: entityWhere, orderBy: { name: 'asc' } }),
      prisma.employee.findMany({ where: { status: 'ACTIVE' }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
      prisma.section.findMany({ where: { status: { not: 'CLOSED' } }, select: { id: true, name: true, courseId: true }, orderBy: { name: 'asc' } }),
      prisma.course.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.diploma.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.courseSubscription.findMany({ where: entityWhere, select: { id: true }, distinct: ['id'] }),
    ]);
    res.json({
      entities: entities.map(e => ({ id: e.id, name: e.name, commissionType: e.commissionType, uniPercentage: e.uniPercentage, fixedAmount: e.fixedAmount, roomAmount: e.roomAmount })),
      employees, sections, courses, diplomas,
      subscriptionCount: subscriptions.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/settlements/row/:type/:id — تفاصيل صف واحد (Lazy Loading)
// ============================================================================
router.get('/row/:type/:id', authMiddleware, requirePermission('finance.settlements'), async (req, res) => {
  try {
    const { type, id } = req.params;
    const subKey = { id: parseInt(id as string), type: type === 'DIPLOMA' ? 'DIPLOMA' as const : 'COURSE' as const };
    const data = await loadFinancialData([subKey]);
    const k = `${subKey.type}:${subKey.id}`;
    const sub = subKey.type === 'DIPLOMA'
      ? await prisma.diplomaSubscription.findUnique({ where: { id: subKey.id }, include: { student: true, entity: true, diploma: true } })
      : await prisma.courseSubscription.findUnique({ where: { id: subKey.id }, include: { student: true, entity: true, course: true } });
    if (!sub) return res.status(404).json({ error: 'الاشتراك غير موجود' });

    const row = computeRow(sub, subKey.type, data);
    const installments = (data.instMap.get(k) || []).map(i => ({
      id: i.id, installmentNumber: i.installmentNumber, totalInstallments: i.totalInstallments,
      dueDate: i.dueDate, amount: i.amount, paidAmount: i.paidAmount, remainingAmount: i.remainingAmount,
      status: i.status, paymentDate: i.paymentDate, paymentMethod: i.paymentMethod,
      referenceNumber: i.referenceNumber, paymentDest: i.paymentDest, notes: i.notes,
    }));
    const transactions = (data.txMap.get(k) || []).map(t => ({
      id: t.id, type: t.type, amount: t.amount, paymentMethod: t.paymentMethod,
      date: t.date, status: t.status, receiptNumber: t.receiptNumber, referenceNumber: t.referenceNumber,
      paymentDest: t.paymentDest, paymentSubMethod: t.paymentSubMethod, notes: t.notes, universityShare: t.universityShare, centerShare: t.centerShare,
    }));
    const claimLines = (data.claimMap.get(k) || []).map(c => ({
      id: c.id, claimAmount: c.claimAmount, status: c.status, periodMonth: c.periodMonth, periodYear: c.periodYear,
      entityShare: c.entityShare, centerShare: c.centerShare, totalPaid: c.totalPaid, totalFees: c.totalFees,
      paid: (data.payMap.get(c.id) || []).reduce((s, p) => s + (p.amount || 0), 0),
    }));
    return res.json({ row, installments, transactions, claimLines });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// المطالبات المالية (EntitySettlement = دفعة مطالبة لكل جهة/فترة، EntityClaim = سطورها)
// ============================================================================

const CLAIM_STATUS: Record<string, { label: string }> = {
  DRAFT: { label: 'مسودة' }, APPROVED: { label: 'معتمدة' }, SENT: { label: 'مطالبة مرسلة' },
  PARTIAL: { label: 'مدفوعة جزئياً' }, PAID: { label: 'مدفوعة' }, CLOSED: { label: 'مغلقة' }, VOIDED: { label: 'ملغاة' },
};
const claimNo = (id: number, year: number) => `CLM-${year}-${String(id).padStart(5, '0')}`;

// GET /api/settlements/claims — قائمة المطالبات (دفعات)
router.get('/claims', authMiddleware, requirePermission('finance.claims'), async (req, res) => {
  try {
    const { entityId, status, page, limit } = req.query;
    const where: any = {};
    if (entityId) where.entityId = parseInt(entityId as string);
    if (status) where.status = status as string;
    const scoped = entityScope(req);
    if (scoped.length) where.entityId = { in: scoped };
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 25));

    const [settlements, total] = await Promise.all([
      prisma.entitySettlement.findMany({
        where,
        include: {
          entity: { select: { id: true, name: true, commissionType: true, uniPercentage: true } },
          payments: { orderBy: { date: 'asc' } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.entitySettlement.count({ where }),
    ]);

    const list = settlements.map(s => ({
      ...s,
      claimNumber: claimNo(s.id, s.year),
      statusLabel: CLAIM_STATUS[s.status]?.label || s.status,
    }));
    res.json({ claims: list, total, page: pageNum, limit: limitNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/settlements/claims/:id — تفاصيل المطالبة + سطورها + مدفوعاتها
router.get('/claims/:id', authMiddleware, requirePermission('finance.claims'), async (req, res) => {
  try {
    const settlement = await prisma.entitySettlement.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: { entity: { select: { id: true, name: true, commissionType: true, uniPercentage: true, fixedAmount: true, roomAmount: true } }, payments: { orderBy: { date: 'asc' } } },
    });
    if (!settlement) return res.status(404).json({ error: 'المطالبة غير موجودة' });

    const lines = await prisma.entityClaim.findMany({
      where: {
        entityId: settlement.entityId,
        periodMonth: settlement.month,
        periodYear: settlement.year,
        status: { not: 'VOIDED' },
      },
      include: { student: { select: { id: true, fullNameAr: true } } },
      orderBy: { id: 'asc' },
    });

    const claimIds = lines.map(l => l.id);
    const payTxs = claimIds.length
      ? await prisma.financialTransaction.findMany({
          where: { entityClaimId: { in: claimIds }, type: 'PAYMENT', status: 'COMPLETED' },
          orderBy: { date: 'asc' },
        })
      : [];
    const paidByLine = new Map<number, number>();
    for (const p of payTxs) paidByLine.set(p.entityClaimId!, (paidByLine.get(p.entityClaimId!) || 0) + p.amount);

    const lineRows = lines.map(l => ({
      ...l,
      paid: round2(paidByLine.get(l.id) || 0),
      remaining: round2(Math.max(0, l.claimAmount - (paidByLine.get(l.id) || 0))),
      statusLabel: CLAIM_STATUS[l.status]?.label || l.status,
    }));

    res.json({
      claim: { ...settlement, claimNumber: claimNo(settlement.id, settlement.year), statusLabel: CLAIM_STATUS[settlement.status]?.label || settlement.status },
      lines: lineRows,
      payments: payTxs.map(p => ({
        id: p.id, amount: p.amount, paymentMethod: p.paymentMethod, date: p.date,
        receiptNumber: p.receiptNumber, referenceNumber: p.referenceNumber,
        paymentSubMethod: p.paymentSubMethod, paymentWalletRef: p.paymentWalletRef,
        checkNumber: p.checkNumber, hawalaNumber: p.hawalaNumber, notes: p.notes,
        entityClaimId: p.entityClaimId,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/settlements/claims/preview — حساب مسبق للمطالبة دون إنشائها
router.post('/claims/preview', authMiddleware, requirePermission('finance.claims'), async (req, res) => {
  try {
    const { entityId, periodMonth, periodYear } = req.body;
    if (!entityId || !periodMonth || !periodYear) {
      return res.status(400).json({ error: 'entityId و periodMonth و periodYear مطلوبون' });
    }
    const entity = await prisma.educationalEntity.findUnique({ where: { id: parseInt(entityId) } });
    if (!entity) return res.status(404).json({ error: 'الجهة غير موجودة' });

    const existing = await prisma.entitySettlement.findUnique({
      where: { entityId_month_year: { entityId: entity.id, month: parseInt(periodMonth), year: parseInt(periodYear) } },
    });

    const [diplomaSubs, courseSubs] = await Promise.all([
      prisma.diplomaSubscription.findMany({ where: { entityId: entity.id }, include: { student: true } }),
      prisma.courseSubscription.findMany({ where: { entityId: entity.id }, include: { student: true } }),
    ]);
    const subs: { sub: any; type: 'DIPLOMA' | 'COURSE' }[] = [
      ...diplomaSubs.map(sub => ({ sub, type: 'DIPLOMA' as const })),
      ...courseSubs.map(sub => ({ sub, type: 'COURSE' as const })),
    ];
    const data = await loadFinancialData(subs.map(x => ({ id: x.sub.id, type: x.type })));
    const lines = subs.map(x => computeRow(x.sub, x.type, data))
      .filter(r => r.remaining > 0.005)
      .map(r => ({
        subscriptionId: r.subscriptionId,
        studentName: r.student?.fullNameAr || r.student?.id,
        programName: r.programName || '—',
        totalPaid: r.totalPaid,
        claimable: r.claimable,
        paidToEntityTotal: r.paidToEntityTotal,
        remaining: r.remaining,
      }))
      .sort((a, b) => b.remaining - a.remaining);

    return res.json({
      entityName: entity.name,
      periodMonth: parseInt(periodMonth),
      periodYear: parseInt(periodYear),
      totalDue: round2(lines.reduce((s, l) => s + l.remaining, 0)),
      lines,
      blocked: existing && existing.status !== 'VOIDED' ? claimNo(existing.id, existing.year) : null,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/settlements/claims — إنشاء مطالبة جديدة (تلقائي الحسابات + منع التكرار)
router.post('/claims', authMiddleware, requirePermission('finance.claims'), async (req, res) => {
  try {
    const { entityId, periodMonth, periodYear, notes } = req.body;
    if (!entityId || !periodMonth || !periodYear) {
      return res.status(400).json({ error: 'entityId و periodMonth و periodYear مطلوبون' });
    }
    const entity = await prisma.educationalEntity.findUnique({ where: { id: parseInt(entityId) } });
    if (!entity) return res.status(404).json({ error: 'الجهة غير موجودة' });

    const existing = await prisma.entitySettlement.findUnique({
      where: { entityId_month_year: { entityId: entity.id, month: parseInt(periodMonth), year: parseInt(periodYear) } },
    });
    if (existing && existing.status !== 'VOIDED') {
      return res.status(409).json({ error: `توجد مطالبة بالفعل لجهة «${entity.name}» عن ${periodMonth}/${periodYear} (${claimNo(existing.id, existing.year)})` });
    }
    if (existing && existing.status === 'VOIDED') {
      // مطالبة ملغاة بلا أي سندات صرف — تُحذف لتتاح الفترة من جديد (يبقى أثرها في سجل التدقيق)
      await prisma.entityClaim.deleteMany({
        where: { entityId: entity.id, periodMonth: parseInt(periodMonth), periodYear: parseInt(periodYear) },
      });
      await prisma.entitySettlement.delete({ where: { id: existing.id } });
    }

    // حساب الأسطر المستحقة للجهة في الفترة
    const [diplomaSubs, courseSubs] = await Promise.all([
      prisma.diplomaSubscription.findMany({ where: { entityId: entity.id }, include: { student: true } }),
      prisma.courseSubscription.findMany({ where: { entityId: entity.id }, include: { student: true } }),
    ]);
    const subs: { sub: any; type: 'DIPLOMA' | 'COURSE' }[] = [
      ...diplomaSubs.map(sub => ({ sub, type: 'DIPLOMA' as const })),
      ...courseSubs.map(sub => ({ sub, type: 'COURSE' as const })),
    ];

    const data = await loadFinancialData(subs.map(x => ({ id: x.sub.id, type: x.type })));
    const rows = subs.map(x => computeRow(x.sub, x.type, data))
      .filter(r => r.remaining > 0.005);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'لا توجد مبالغ غير مسواة لجهة التعليم في هذه الفترة' });
    }

    const totalDue = round2(rows.reduce((s, r) => s + r.remaining, 0));

    const settlement = await prisma.entitySettlement.create({
      data: {
        entityId: entity.id,
        month: parseInt(periodMonth),
        year: parseInt(periodYear),
        totalDue,
        totalPaid: 0,
        balance: totalDue,
        status: 'DRAFT',
        notes: notes || null,
      },
    });

    // إنشاء/تحديث سطر مطالبة لكل طالب/اشتراك (يمنع التكرار تلقائياً)
    const claimLines = [];
    for (const r of rows) {
      const claimData = {
        entityId: entity.id,
        studentId: r.student.id,
        subscriptionId: r.subscriptionId,
        subscriptionType: r.type,
        totalFees: r.totalFees,
        entityShare: r.entityShare,
        centerShare: r.centerShare,
        paidInstallments: 0,
        totalPaid: r.totalPaid,
        claimAmount: r.remaining,
        status: 'DRAFT' as const,
        periodMonth: parseInt(periodMonth),
        periodYear: parseInt(periodYear),
      };
      const found = await prisma.entityClaim.findFirst({
        where: { entityId: entity.id, studentId: r.student.id, subscriptionId: r.subscriptionId, subscriptionType: r.type, periodMonth: parseInt(periodMonth), periodYear: parseInt(periodYear) },
      });
      claimLines.push(found
        ? await prisma.entityClaim.update({ where: { id: found.id }, data: claimData })
        : await prisma.entityClaim.create({ data: claimData }));
    }

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id, action: 'CREATE', entity: 'EntityClaim',
        details: JSON.stringify({ claimNumber: claimNo(settlement.id, settlement.year), entityId: entity.id, periodMonth, periodYear, totalDue, lines: claimLines.length }),
      },
    });

    res.json({ claim: { ...settlement, claimNumber: claimNo(settlement.id, settlement.year) }, lines: claimLines.map(l => ({ id: l.id, studentId: l.studentId, subscriptionId: l.subscriptionId, subscriptionType: l.subscriptionType, claimAmount: l.claimAmount, status: l.status })) });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/settlements/claims/:id/status — اعتماد / إرسال / إغلاق / إلغاء
router.put('/claims/:id/status', authMiddleware, requirePermission('finance.settlements'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const allowed = ['DRAFT', 'APPROVED', 'SENT', 'CLOSED', 'VOIDED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });

    const settlement = await prisma.entitySettlement.findUnique({ where: { id: parseInt(req.params.id as string) } });
    if (!settlement) return res.status(404).json({ error: 'المطالبة غير موجودة' });

    if ((status === 'VOIDED') && (settlement.totalPaid > 0.005)) {
      return res.status(400).json({ error: 'لا يمكن إلغاء مطالبة تم تسديد جزء منها — سجّل السداد ثم أغلقها' });
    }

    const updated = await prisma.entitySettlement.update({
      where: { id: settlement.id },
      data: { status, notes: notes !== undefined ? (notes || null) : settlement.notes },
    });

    await prisma.entityClaim.updateMany({
      where: { entityId: settlement.entityId, periodMonth: settlement.month, periodYear: settlement.year },
      data: { status },
    });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id, action: 'UPDATE', entity: 'EntityClaim',
        details: JSON.stringify({ claimNumber: claimNo(settlement.id, settlement.year), from: settlement.status, to: status }),
      },
    });

    res.json({ ...updated, claimNumber: claimNo(updated.id, updated.year) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/settlements/claims/:id/pay — تسديد لجهة التعليم (يُسجل سند صرف مالي فعلي)
router.post('/claims/:id/pay', authMiddleware, requirePermission('finance.payments'), async (req, res) => {
  try {
    const { amount, paymentMethod, referenceNumber, notes, paymentSubMethod, paymentWalletRef, checkNumber, hawalaNumber } = req.body;
    const settlement = await prisma.entitySettlement.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: { entity: true },
    });
    if (!settlement) return res.status(404).json({ error: 'المطالبة غير موجودة' });
    if (settlement.status === 'CLOSED' || settlement.status === 'VOIDED') {
      return res.status(400).json({ error: 'لا يمكن السداد على مطالبة مغلقة أو ملغاة' });
    }

    const payAmount = parseFloat(normalizeDigits(String(amount)));
    if (isNaN(payAmount) || payAmount <= 0) return res.status(400).json({ error: 'مبلغ غير صالح' });
    const finalRef = referenceNumber ? normalizeDigits(String(referenceNumber)) : null;
    if (finalRef) {
      const dup = await prisma.financialTransaction.findFirst({ where: { referenceNumber: finalRef } });
      if (dup) return res.status(400).json({ error: 'رقم المرجع مستخدم مسبقاً في معاملة أخرى' });
    }

    const remaining = Math.max(0, settlement.balance - payAmount);
    if (remaining < -0.005) {
      return res.status(400).json({ error: `المبلغ (${payAmount}) أكبر من رصيد المطالبة المتبقي (${settlement.balance})` });
    }

    const claimNoVal = claimNo(settlement.id, settlement.year);

    // 1) سطر سداد في المطالبة
    const settlementPayment = await prisma.settlementPayment.create({
      data: {
        settlementId: settlement.id,
        amount: payAmount,
        method: paymentMethod || 'BANK',
        reference: finalRef || null,
        notes: notes || null,
      },
    });

    // 2) سند صرف فعلي في الدفتر المالي (نفس نظام توليد أرقام السندات)
    const receiptNumber = await generateReceiptNumber('PAYMENT');
    const txn = await prisma.financialTransaction.create({
      data: {
        type: 'PAYMENT',
        amount: payAmount,
        paymentMethod: paymentMethod || 'BANK',
        status: 'COMPLETED',
        receiptNumber,
        referenceNumber: finalRef || null,
        paymentDest: 'ENTITY',
        paymentSubMethod: paymentSubMethod || null,
        paymentWalletRef: paymentWalletRef || null,
        checkNumber: checkNumber || null,
        hawalaNumber: hawalaNumber || null,
        notes: notes || `تسديد مطالبة ${claimNoVal} — ${settlement.entity.name}`,
      },
    });

    // 3) توزيع المبلغ على سطور المطالبة FIFO وتحديث حالاتها
    const lines = await prisma.entityClaim.findMany({
      where: { entityId: settlement.entityId, periodMonth: settlement.month, periodYear: settlement.year, status: { not: 'VOIDED' } },
      orderBy: { id: 'asc' },
    });
    const paidByLine = new Map<number, number>();
    if (lines.length) {
      const payTxs = await prisma.financialTransaction.findMany({
        where: { entityClaimId: { in: lines.map(l => l.id) }, type: 'PAYMENT', status: 'COMPLETED' },
      });
      for (const p of payTxs) paidByLine.set(p.entityClaimId!, (paidByLine.get(p.entityClaimId!) || 0) + p.amount);
    }
    let toAllocate = payAmount;
    let linkedLineId: number | null = null;
    for (const line of lines) {
      if (toAllocate <= 0) break;
      const linePaid = paidByLine.get(line.id) || 0;
      const lineRem = Math.max(0, line.claimAmount - linePaid);
      const alloc = Math.min(toAllocate, lineRem);
      if (alloc <= 0) continue;
      if (!linkedLineId) linkedLineId = line.id;
      const newLinePaid = linePaid + alloc;
      const newStatus = lineRem - alloc <= 0.005 ? 'PAID' : 'PARTIAL';
      await prisma.entityClaim.update({ where: { id: line.id }, data: { status: newStatus } });
      toAllocate -= alloc;
    }
    if (linkedLineId) {
      await prisma.financialTransaction.update({ where: { id: txn.id }, data: { entityClaimId: linkedLineId } });
    }

    // 4) تحديث المطالبة
    const newTotalPaid = round2(settlement.totalPaid + payAmount);
    const newBalance = round2(Math.max(0, settlement.totalDue - newTotalPaid));
    const newStatus = newBalance <= 0.005 ? 'PAID' : 'PARTIAL';
    const updatedSettlement = await prisma.entitySettlement.update({
      where: { id: settlement.id },
      data: { totalPaid: newTotalPaid, balance: newBalance, status: newStatus },
    });

    const actingUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id, action: 'CREATE', entity: 'EntitySettlementPayment',
        details: JSON.stringify({ claimNumber: claimNoVal, settlementPaymentId: settlementPayment.id, transactionId: txn.id, amount: payAmount, method: paymentMethod, reference: finalRef }),
      },
    });

    res.json({
      payment: { id: settlementPayment.id, amount: payAmount, method: paymentMethod, reference: finalRef, receiptNumber },
      settlement: { ...updatedSettlement, claimNumber: claimNoVal, statusLabel: CLAIM_STATUS[newStatus]?.label || newStatus },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;