import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, CreditCard, Plus, X, RefreshCw,
  Clock, FileText, Trash2, Save, Printer,
  Calendar, AlertTriangle, Award,
  ChevronRight, ChevronLeft, SlidersHorizontal, ExternalLink, Wallet, ListChecks
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { DateField } from '../components/DateField';
import { formatDate } from '../utils/dateFormat';
import { toNumber } from '../utils/arabicNumbers';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface Sub { id: number | string; studentId: string; baseFee: number; totalCost: number; paymentType: string; installmentsCount: number; date: string; status: string; notes?: string; diploma?: { id: string; name: string }; course?: { id: string; name: string }; entity?: { id: number; name: string }; }
interface Inst { id: number; studentId: string; subscriptionId: string; subscriptionType: string; installmentNumber: number; totalInstallments: number; dueDate: string; amount: number; paidAmount: number; remainingAmount: number; status: string; paymentDate?: string; paymentMethod?: string; referenceNumber?: string; notes?: string; paymentWallet?: string; paymentBank?: string; senderInfo?: string; paymentDest?: string; programName?: string | null; entityName?: string | null; student?: { id: string; fullNameAr: string; fullNameEn?: string; phones?: any }; subscription?: { id: number; totalCost: number; status: string; installmentsCount: number } | null; transactions?: any[]; remaining?: number; }
interface Student { id: string; fullNameAr: string; fullNameEn?: string; phones?: any }

const ST: Record<string, { label: string; cls: string }> = { PENDING: { label: 'بانتظار', cls: 'warning' }, PAID: { label: 'مدفوع', cls: 'success' }, PARTIAL: { label: 'دفع جزئي', cls: 'teal' }, OVERDUE: { label: 'متأخر', cls: 'danger' } };
const PML: Record<string, string> = { CASH: 'نقدي', BANK: 'حوالة بنكية', CARD: 'بطاقة', TRANSFER: 'تحويل إلكتروني', WALLET: 'محفظة إلكترونية', CLICK: 'حوالة كليك', ENTITY: 'جهة', CHECK: 'شيك' };
const WL: Record<string, string> = { UMNIAH: 'أمنية كاش', ORANGE: 'أورانج موني', ZAIN: 'زين كاش', DINARAK: 'دينارك', ALAWNEH: 'علاونه' };
const BL: Record<string, string> = { Jordan_Ahli: 'الأهلي الأردني', Arab_Bank: 'العربي', Housing_Bank: 'الإسكان', Cairo_Amman: 'القاهرة عمان', Jordan_Kuwait: 'الأردني الكويتي', Islamic_Bank: 'الإسلامي الأردني', Safwa_Islamic: 'صفوة الإسلامي', Etihad: 'الاتحاد', Societe_Generale: 'سوسيتيه جنرال', Bank_of_Jordan: 'الأردن', Investbank: 'الاستثمار', Jordan_Commercial: 'التجاري الأردني', ABC: 'ABC', Standard_Chartered: 'ستاندارد تشارترد', BLOM: 'بلوم', Al_Rajhi: 'الراجحي', OTHER: 'آخر' };
const CATEGORIES = [
  { value: 'SUBSCRIPTION', label: 'قسط اشتراك', cls: 'primary' },
  { value: 'PENALTY', label: 'بدل مخالفة', cls: 'danger' },
  { value: 'FINE', label: 'بدل غرامات', cls: 'danger' },
  { value: 'PRIVILEGE', label: 'بدل امتيازات', cls: 'warning' },
  { value: 'OTHER', label: 'بدل أخرى', cls: 'secondary' },
] as const;
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c])) as Record<string, typeof CATEGORIES[number]>;

const subName = (sub: Sub) => sub.diploma?.name || sub.course?.name || `#${sub.id}`;
const getPhone = (p: any) => { try { return (typeof p === 'string' ? JSON.parse(p) : p)?.[0] || '—'; } catch { return '—'; } };
const remOf = (i: Inst) => Math.max(0, (i.amount || 0) - (i.paidAmount || 0));
const catLabel = (inst: Inst) => {
  if (inst.subscriptionType !== 'EXTRA') return null;
  return CATEGORIES.find(c => inst.subscriptionId === `EXTRA-${c.value}`);
};

interface Filters { query: string; status: string; subscriptionType: string; paymentDest: string; entityId: string; courseId: string; diplomaId: string; dateFrom: string; dateTo: string; studentId: string; }
const EMPTY_FILTERS: Filters = { query: '', status: '', subscriptionType: '', paymentDest: '', entityId: '', courseId: '', diplomaId: '', dateFrom: '', dateTo: '', studentId: '' };

export const FinInstallmentsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canEdit = hasPermission('finance.installments');
  const canPay = hasPermission('finance.receipts');

  /* ── Filters + pagination ── */
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rows, setRows] = useState<Inst[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ── Dropdown lists for filters ── */
  const [entities, setEntities] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [diplomas, setDiplomas] = useState<any[]>([]);

  /* ── Detail drawer (lazy) ── */
  const [selId, setSelId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<Inst | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [subInsts, setSubInsts] = useState<Inst[]>([]);

  /* ── Add installment modal ── */
  const [addOpen, setAddOpen] = useState(false);
  const [addStudent, setAddStudent] = useState<Student | null>(null);
  const [addSubs, setAddSubs] = useState<Sub[]>([]);
  const [addSelSub, setAddSelSub] = useState<Sub | null>(null);
  const [aAmt, setAAmt] = useState('');
  const [aDue, setADue] = useState('');
  const [aNotes, setANotes] = useState('');
  const [aCategory, setACategory] = useState('SUBSCRIPTION');

  /* ── Edit installment ── */
  const [eAmt, setEAmt] = useState('');
  const [eDue, setEDue] = useState('');
  const [eNotes, setENotes] = useState('');

  /* ── Payment form (unified with receipts page) ── */
  const [payActive, setPayActive] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDest, setPayDest] = useState<'' | 'ENTITY' | 'US'>('');
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [paySubMethod, setPaySubMethod] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payWalletRef, setPayWalletRef] = useState('');
  const [payBank, setPayBank] = useState('');
  const [payCheckNum, setPayCheckNum] = useState('');
  const [payHawalaNum, setPayHawalaNum] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  /* ── Schedule modal ── */
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [scheduleMin, setScheduleMin] = useState(1);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [scheduleData, setScheduleData] = useState<{ id: number | null; amount: number; dueDate: string }[]>([]);

  const [isDeep, setIsDeep] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Load dropdown lists once ── */
  useEffect(() => {
    Promise.all([
      apiFetch('/educational-entities').catch(() => []),
      apiFetch('/courses').catch(() => []),
      apiFetch('/diplomas').catch(() => [])
    ]).then(([e, c, d]) => {
      setEntities(Array.isArray(e) ? e : []);
      setCourses(Array.isArray(c) ? c : []);
      setDiplomas(Array.isArray(d) ? d : []);
    });
  }, [apiFetch]);

  /* ── Preselect student from ?studentId= (quick access) ── */
  useEffect(() => {
    const sid = searchParams.get('studentId');
    if (sid) setF(prev => ({ ...prev, studentId: sid }));
  }, [searchParams]);

  const buildParams = useCallback((withPage: boolean) => {
    const p = new URLSearchParams();
    if (withPage) { p.set('page', String(page)); p.set('pageSize', String(pageSize)); p.set('sortBy', sortBy); p.set('sortDir', sortDir); }
    for (const k of Object.keys(EMPTY_FILTERS) as (keyof Filters)[]) {
      const v = f[k];
      if (v) p.set(k, v);
    }
    return p.toString();
  }, [f, page, pageSize, sortBy, sortDir]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/installments?${buildParams(true)}`);
      setRows(r?.items || []);
      setTotal(r?.total || 0);
      setTotalPages(Math.max(1, r?.totalPages || 1));
    } catch (err: any) { toast.error('فشل تحميل الأقساط', err.message); }
    finally { setLoading(false); }
  }, [buildParams, apiFetch]);

  const loadStats = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const s = await apiFetch(`/installments/stats?${buildParams(false)}`);
      setSummary(s || null);
    } catch { setSummary(null); }
    finally { setSummaryLoading(false); }
  }, [buildParams, apiFetch]);

  /* Debounced load on any filter/page/sort change (no full page reload) */
  useEffect(() => {
    const t = setTimeout(() => { loadList(); loadStats(); }, 300);
    return () => clearTimeout(t);
  }, [loadList, loadStats]);

  const updateF = (patch: Partial<Filters>) => { setF(prev => ({ ...prev, ...patch })); setPage(1); };
  const clearFilters = () => { setF(EMPTY_FILTERS); setPage(1); };

  /* ── Detail drawer ── */
  const refreshDetail = useCallback(async () => {
    if (!selId) return;
    setDetailLoading(true);
    try {
      const d = await apiFetch(`/installments/${selId}`);
      setDetail(d || null);
      if (d && d.subscriptionType !== 'EXTRA') {
        const r = await apiFetch(`/installments?subscriptionId=${d.subscriptionId}`);
        setSubInsts(Array.isArray(r) ? r : []);
      } else setSubInsts([]);
    } catch (err: any) { toast.error('فشل تحديث التفاصيل', err.message); }
    finally { setDetailLoading(false); }
  }, [selId, apiFetch]);

  const openDetail = useCallback(async (id: number) => {
    setSelId(id);
    setDrawerOpen(true);
    setPayActive(false);
    await refreshDetail();
  }, [refreshDetail]);

  const closeDetail = () => { setDrawerOpen(false); setSelId(null); setDetail(null); setSubInsts([]); };

  /* Reset payment form for a fresh payment */
  const resetPay = () => {
    setPayActive(false);
    setPayAmount('');
    setPayDest('');
    setPayMethod('CASH');
    setPaySubMethod('');
    setPayRef('');
    setPayWalletRef('');
    setPayBank('');
    setPayCheckNum('');
    setPayHawalaNum('');
    setPayNotes('');
  };

  /* ── Derived ── */
  const isU = !!detail && (detail.status === 'PENDING' || detail.status === 'PARTIAL' || detail.status === 'OVERDUE');
  const subTotalPaid = subInsts.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const subRemaining = Math.max(0, (detail?.subscription?.totalCost || 0) - subTotalPaid);
  const unpaidSubInsts = subInsts.filter(i => remOf(i) > 0);

  /* ── Add installment ── */
  const openAdd = async (s: Student) => {
    setAddStudent(s);
    setAddSelSub(null);
    setAAmt(''); setADue(''); setANotes(''); setACategory('SUBSCRIPTION');
    setAddOpen(true);
    try {
      const [d, c] = await Promise.all([
        apiFetch(`/subscriptions/diploma?studentId=${s.id}`),
        apiFetch(`/subscriptions/course?studentId=${s.id}`)
      ]);
      setAddSubs([...(Array.isArray(d) ? d : []), ...(Array.isArray(c) ? c : [])]);
    } catch { setAddSubs([]); }
  };

  const handleAdd = async () => {
    if (!addStudent) return false;
    if (aCategory === 'SUBSCRIPTION' && !addSelSub) { toast.error('اختر الاشتراك أولاً'); return false; }
    const amt = toNumber(aAmt);
    if (!amt || amt <= 0) { toast.error('المبلغ مطلوب'); return false; }
    if (!aDue) { toast.error('التاريخ مطلوب'); return false; }
    if (aCategory === 'SUBSCRIPTION' && addSelSub) {
      try {
        const existing = await apiFetch(`/installments?subscriptionId=${String(addSelSub.id)}`);
        const existingTotal = (Array.isArray(existing) ? existing : []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
        const cap = (addSelSub.totalCost || 0);
        if (existingTotal + amt > cap + 0.001) {
          toast.error(`لا يمكن زيادة الأقساط عن قيمة الاشتراك: المجموع الحالي ${existingTotal.toFixed(2)} + ${amt.toFixed(2)} يتجاوز ${cap.toFixed(2)} د.أ`);
          return false;
        }
      } catch { /* allow server to reject if fetch fails */ }
    }
    setSaving(true);
    try {
      const body: any = { studentId: addStudent.id, dueDate: aDue, amount: amt, notes: aNotes || undefined, category: aCategory };
      if (aCategory === 'SUBSCRIPTION' && addSelSub) {
        body.subscriptionType = (addSelSub as any).diploma ? 'DIPLOMA' : 'COURSE';
        body.subscriptionId = String(addSelSub.id);
      }
      await apiFetch('/installments', { method: 'POST', body: JSON.stringify(body) });
      toast.success('تم إضافة القسط');
      setAddOpen(false);
      loadList(); loadStats();
      if (selId) refreshDetail();
      return true;
    } catch (err: any) { toast.error('فشل', err.message); return false; }
    finally { setSaving(false); }
  };

  /* ── Edit installment ── */
  const handleEdit = async () => {
    if (!detail) return;
    const newAmt = toNumber(eAmt);
    if (!newAmt || newAmt <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (detail.subscriptionType && detail.subscriptionType !== 'EXTRA') {
      const cap = detail.subscription?.totalCost || 0;
      const subInsts_ = subInsts.filter(i => String(i.subscriptionId) === String(detail.subscriptionId) && i.subscriptionType === detail.subscriptionType);
      const newTotal = subInsts_.reduce((s, i) => s + i.amount, 0) - detail.amount + newAmt;
      if (cap > 0 && newTotal < cap - 0.001) {
        toast.error(`لا يمكن التعديل: إجمالي الأقساط سيصبح (${newTotal.toFixed(2)}) أقل من قيمة الاشتراك (${cap.toFixed(2)})`);
        return;
      }
      if (cap > 0 && newTotal > cap + 0.001) {
        toast.error(`لا يمكن التعديل: إجمالي الأقساط سيصبح (${newTotal.toFixed(2)}) أكبر من قيمة الاشتراك (${cap.toFixed(2)})`);
        return;
      }
    }
    setSaving(true);
    try {
      await apiFetch(`/installments/${detail.id}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: newAmt, dueDate: eDue, notes: eNotes || undefined })
      });
      toast.success('تم الحفظ');
      loadList(); loadStats(); refreshDetail();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── Delete installment ── */
  const handleDelete = async () => {
    if (!detail) return;
    if (detail.subscriptionType && detail.subscriptionType !== 'EXTRA') {
      const cap = detail.subscription?.totalCost || 0;
      const subInsts_ = subInsts.filter(i => String(i.subscriptionId) === String(detail.subscriptionId) && i.subscriptionType === detail.subscriptionType);
      const newTotal = subInsts_.reduce((s, i) => s + i.amount, 0) - detail.amount;
      if (cap > 0 && newTotal < cap - 0.001) {
        toast.error(`لا يمكن حذف القسط: إجمالي الأقساط سيصبح (${newTotal.toFixed(2)}) أقل من قيمة الاشتراك (${cap.toFixed(2)})`);
        return;
      }
    }
    if (!window.confirm('حذف القسط؟')) return;
    setSaving(true);
    try {
      await apiFetch(`/installments/${detail.id}`, { method: 'DELETE' });
      toast.success('تم الحذف');
      closeDetail();
      loadList(); loadStats();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── Void a completed payment (سحب) ── */
  const voidPayment = async () => {
    if (!detail) return;
    if (!window.confirm('إلغاء كل الدفعات المكتملة لهذا القسط؟')) return;
    setSaving(true);
    try {
      await apiFetch(`/installments/${detail.id}/void-payment`, { method: 'POST' });
      toast.success('تم إلغاء الدفعات');
      loadList(); loadStats(); refreshDetail();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── Payment (same contract as FinReceiptsPage — /financial/pay-student) ── */
  const handlePay = async () => {
    if (!detail) return;
    const amt = toNumber(payAmount);
    if (!amt || amt <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (!payDest) { toast.error('اختر جهة الدفع (جهة التعليم أو لدينا)'); return; }
    if (!payRef.trim()) { toast.error('رقم المرجع مطلوب'); return; }
    if (payDest === 'US') {
      if (payMethod === 'TRANSFER' && !paySubMethod) { toast.error('يرجى اختيار نوع المحفظة الإلكترونية'); return; }
      if (payMethod === 'CHECK') { if (!payBank) { toast.error('يرجى اختيار البنك'); return; } if (!payCheckNum.trim()) { toast.error('رقم الشيك مطلوب'); return; } }
      if (payMethod === 'MONEY_TRANSFER') { if (!paySubMethod) { toast.error('يرجى اختيار نوع الحوالة'); return; } if (!payHawalaNum.trim()) { toast.error('رقم الحوالة مطلوب'); return; } }
    }
    const balance = detail.subscriptionType === 'EXTRA' ? detail.remaining! : subRemaining;
    if (balance > 0 && amt > balance) {
      toast.error(`المبلغ (${amt}) أكبر من الرصيد المستحق (${balance.toFixed(2)})`);
      return;
    }
    setPayLoading(true);
    try {
      let finalMethod = payMethod;
      if (payDest === 'ENTITY') {
        finalMethod = 'ENTITY';
      } else {
        if (payMethod === 'TRANSFER') finalMethod = 'WALLET';
        else if (payMethod === 'MONEY_TRANSFER') finalMethod = 'TRANSFER';
      }
      const body: any = {
        amount: amt,
        paymentMethod: finalMethod,
        paymentDest: payDest,
        referenceNumber: payRef,
      };
      // Sub-method fields attached by payment method — identical to FinReceiptsPage
      if (payMethod === 'TRANSFER') { body.paymentSubMethod = paySubMethod; if (payWalletRef) body.paymentWalletRef = payWalletRef; }
      if (payMethod === 'CHECK') { body.paymentBank = payBank; body.checkNumber = payCheckNum; }
      if (payMethod === 'MONEY_TRANSFER') { body.paymentSubMethod = paySubMethod; body.hawalaNumber = payHawalaNum; }
      if (payNotes) body.notes = payNotes;

      // Unified payment path: /financial/pay-student (same as receipts page).
      // EXTRA fees keep their targeted endpoint since they are not part of a subscription.
      if (detail.subscriptionType === 'EXTRA') {
        await apiFetch(`/installments/${detail.id}/pay`, { method: 'POST', body: JSON.stringify(body) });
      } else {
        body.studentId = detail.studentId;
        await apiFetch('/financial/pay-student', { method: 'POST', body: JSON.stringify(body) });
      }
      toast.success('تم تسجيل الدفعة');
      resetPay();
      loadList(); loadStats(); refreshDetail();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setPayLoading(false); }
  };

  /* ── Rescheduling (same logic as SubscriptionPage plan) ── */
  const distributeSchedule = useCallback((count: number, total: number, baseData: typeof scheduleData, unpaid: Inst[] = unpaidSubInsts) => {
    if (count < 1) return;
    // Mirror SubscriptionPage.baseAmounts: the first installment keeps its
    // "دفعة أولى" value when it is installment #1 and still fully unpaid.
    const firstUnpaid = unpaid[0];
    const firstIsDownPayment = !!firstUnpaid && firstUnpaid.installmentNumber === 1 && firstUnpaid.paidAmount === 0;
    const downAmount = firstIsDownPayment ? firstUnpaid.amount : null;

    let amounts: number[] = [];
    if (downAmount !== null && downAmount < total) {
      const remaining = total - downAmount;
      const restCount = count - 1;
      const perRest = restCount > 0 ? Math.round(remaining / restCount) : 0;
      amounts = [downAmount];
      for (let i = 1; i < count; i++) amounts.push(perRest);
      const sumPrev = amounts.slice(0, -1).reduce((s, a) => s + a, 0);
      amounts[count - 1] = Math.round((total - sumPrev) * 100) / 100;
    } else {
      const perInst = Math.round((total / count) * 100) / 100;
      amounts = new Array(count).fill(perInst);
      const sumPrev = amounts.slice(0, -1).reduce((s, a) => s + a, 0);
      amounts[count - 1] = Math.round((total - sumPrev) * 100) / 100;
    }

    const earliestDate = baseData.length > 0 ? baseData[0].dueDate : new Date().toISOString().split('T')[0];
    const data: { id: number | null; amount: number; dueDate: string }[] = [];
    for (let i = 0; i < count; i++) {
      const existing = i < baseData.length ? baseData[i] : null;
      const nextDate = existing?.dueDate || new Date(new Date(earliestDate).getTime() + i * 30 * 86400000).toISOString().split('T')[0];
      data.push({ id: existing?.id || null, amount: amounts[i], dueDate: nextDate });
    }
    return data;
  }, [unpaidSubInsts]);

  const openSchedule = async () => {
    if (!detail || detail.subscriptionType === 'EXTRA') return;
    const r = await apiFetch(`/installments?subscriptionId=${detail.subscriptionId}`);
    const list: Inst[] = Array.isArray(r) ? r : [];
    setSubInsts(list);
    const totalPaid = list.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const total = Math.max(0, (detail.subscription?.totalCost || 0) - totalPaid);
    if (total <= 0) { toast.info('لا توجد أقساط متبقية لهذا الاشتراك'); return; }
    const unpaid = list.filter(i => remOf(i) > 0);
    const cnt = Math.max(unpaid.length, 1);
    const baseData = unpaid.length > 0 ? unpaid.map(i => ({ id: i.id, amount: i.amount, dueDate: i.dueDate.split('T')[0] })) : [];
    setScheduleData(distributeSchedule(cnt, total, baseData, unpaid) ?? []);
    setScheduleCount(cnt);
    setScheduleMin(Math.max(1, unpaid.filter(i => i.paidAmount > 0).length));
    setScheduleTotal(total);
    setShowSchedule(true);
  };

  const handleScheduleSave = async () => {
    if (!detail || detail.subscriptionType === 'EXTRA') return;
    if (scheduleData.some(d => !d.amount || d.amount <= 0)) { toast.error('جميع مبالغ الأقساط يجب أن تكون أكبر من صفر'); return; }
    const sum = scheduleData.reduce((s, d) => s + d.amount, 0);
    if (Math.abs(sum - scheduleTotal) > 0.01) {
      toast.error(`مجموع الأقساط (${sum.toFixed(2)}) لا يساوي المبلغ المتبقي (${scheduleTotal.toFixed(2)})`);
      return;
    }
    const currentUnpaid = subInsts.filter(i => remOf(i) > 0);
    const newCount = scheduleData.length;
    setSaving(true);
    try {
      // Update existing installments (keep paid portion locked in total)
      for (let i = 0; i < Math.min(newCount, currentUnpaid.length); i++) {
        const s = scheduleData[i];
        if (s.id) {
          const inst = currentUnpaid[i];
          const amountToSend = inst && inst.paidAmount > 0 ? inst.paidAmount + s.amount : s.amount;
          await apiFetch(`/installments/${s.id}`, {
            method: 'PUT',
            body: JSON.stringify({ amount: amountToSend, dueDate: s.dueDate })
          });
        }
      }

      // Create new installments if count increased
      const toCreate = scheduleData.filter(s => s.id === null);
      for (const s of toCreate) {
        await apiFetch('/installments', {
          method: 'POST',
          body: JSON.stringify({
            studentId: detail.studentId,
            subscriptionType: detail.subscriptionType,
            subscriptionId: String(detail.subscriptionId),
            dueDate: s.dueDate,
            amount: s.amount,
          })
        });
      }

      // Delete excess unpaid installments if count decreased
      if (newCount < currentUnpaid.length) {
        const toDelete = currentUnpaid.slice(newCount);
        if (toDelete.some(i => i.paidAmount > 0)) {
          toast.error('لا يمكن تقليص عدد الأقساط لأن بعض الأقساط المراد حذفها مدفوعة جزئياً');
          setSaving(false);
          return;
        }
        for (const inst of toDelete) {
          try { await apiFetch(`/installments/${inst.id}?merge=true`, { method: 'DELETE' }); } catch { /* ignore */ }
        }
      }

      toast.success('تم تحديث جدولة الأقساط');
      setShowSchedule(false);
      loadList(); loadStats(); refreshDetail();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── Print receipt ── */
  const printReceipt = (tx: any) => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>سند قبض #${tx.receiptNumber}</title>
<style>body{font-family:'Traditional Arabic',Tahoma,sans-serif;padding:40px;max-width:700px;margin:auto}
h1{text-align:center;font-size:22px;margin-bottom:5px} h2{text-align:center;font-size:14px;color:#666;margin-bottom:30px;font-weight:400}
.receipt{border:2px solid #333;padding:30px;border-radius:8px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd}
.total{font-size:18px;font-weight:700;color:#1a5632;text-align:center;padding:15px 0}
.footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
@media print{body{padding:20px}}</style></head><body>
<button onclick="window.print()" style="padding:10px 20px;margin-bottom:20px;cursor:pointer">طباعة</button>
<h1>سند قبض</h1><h2>مركز LHC للتدريب</h2>
<div class="receipt"><div class="row"><span>رقم السند</span><span>${tx.receiptNumber}</span></div>
<div class="row"><span>التاريخ</span><span>${formatDate(tx.date)}</span></div>
${tx.student ? `<div class="row"><span>الطالب</span><span>${tx.student.fullNameAr}</span></div>` : ''}
<div class="row"><span>المبلغ</span><span>${tx.amount.toFixed(2)} د.أ</span></div>
<div class="row"><span>طريقة الدفع</span><span>${PML[tx.paymentMethod] || tx.paymentMethod}</span></div>
${tx.referenceNumber ? `<div class="row"><span>رقم المرجع</span><span>${tx.referenceNumber}</span></div>` : ''}
${tx.notes ? `<div class="row"><span>ملاحظات</span><span>${tx.notes}</span></div>` : ''}
<div class="total">${tx.amount.toFixed(2)} دينار أردني</div></div>
<div class="footer">شكراً لثقتكم — LHC للتدريب</div>
</body></html>`); w.document.close();
  };

  /* ── Pagination helpers ── */
  const pageNumbers = () => {
    const pages: (number | '…')[] = [];
    const totalShown = Math.min(totalPages, 7);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(page - 2, totalPages - 6));
      for (let i = start; i < start + totalShown; i++) pages.push(i);
      if (start > 1) pages.unshift('…');
      if (start + totalShown - 1 < totalPages) pages.push('…');
    }
    return pages;
  };

  const goPage = (p: number) => { if (p >= 1 && p <= totalPages) setPage(p); };

  const activeFilterCount = () => {
    let n = 0;
    for (const k of Object.keys(EMPTY_FILTERS) as (keyof Filters)[]) { if (k !== 'query' && f[k]) n++; }
    return n;
  };
  const hasActiveFilters = () => activeFilterCount() > 0;

  const programOptions = () => {
    const opts: { value: string; label: string; type: string }[] = [];
    if (f.subscriptionType !== 'COURSE') for (const d of diplomas) opts.push({ value: `D-${d.id}`, label: `دبلوم: ${d.name}`, type: 'DIPLOMA' });
    if (f.subscriptionType !== 'DIPLOMA') for (const c of courses) opts.push({ value: `C-${c.id}`, label: `دورة: ${c.name}`, type: 'COURSE' });
    return opts;
  };

  const selProgramValue = () => {
    if (f.courseId) return `C-${f.courseId}`;
    if (f.diplomaId) return `D-${f.diplomaId}`;
    return '';
  };
  const onProgramChange = (v: string) => {
    if (!v) { setF(prev => ({ ...prev, courseId: '', diplomaId: '' })); setPage(1); return; }
    const [type, id] = v.split('-');
    if (type === 'C') { setF(prev => ({ ...prev, courseId: id, diplomaId: '' })); setPage(1); }
    else { setF(prev => ({ ...prev, courseId: '', diplomaId: id })); setPage(1); }
  };

  /* ── Render ── */
  return (
    <div style={{ padding: '4px 2px', maxWidth: 1500, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>
          <CreditCard size={18} color="var(--secondary)" />
          إدارة الأقساط
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginRight: 4 }}>({total})</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="glass-btn icon-btn" onClick={() => { loadList(); loadStats(); }} title="تحديث"><RefreshCw size={16} /></button>
          <button className="glass-btn" onClick={() => setIsDeep(true)} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={15} /> بحث عميق
          </button>
          <button
            className={`glass-btn ${filtersOpen ? '' : 'secondary'}`}
            onClick={() => setFiltersOpen(o => !o)}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <SlidersHorizontal size={15} /> الفلاتر
            <span className={`badge ${hasActiveFilters() ? 'warning' : 'secondary'}`} style={{ fontSize: '0.5rem', padding: '1px 6px' }}>{activeFilterCount()}</span>
          </button>
        </div>
      </div>

      {/* ── Stat cards (filter-aware, aggregates from server) ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="stat-card blue" style={{ flex: '1 1 160px', minWidth: 160, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <div className="stat-icon" style={{ marginBottom: 0, width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}><CreditCard size={18} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.78rem' }}>إجمالي الأقساط</div>
            <div className="stat-value" style={{ fontSize: '1.35rem' }}>{summaryLoading ? '…' : (summary?.totalInstallments ?? 0)}</div>
            <div className="stat-sub" style={{ marginTop: 0, fontSize: '0.72rem' }}>{summaryLoading ? '' : `${(summary?.totalAmount ?? 0).toFixed(2)} د.أ`}</div>
          </div>
        </div>
        <div className="stat-card green" style={{ flex: '1 1 160px', minWidth: 160, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <div className="stat-icon" style={{ marginBottom: 0, width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}><Wallet size={18} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.78rem' }}>المدفوع</div>
            <div className="stat-value" style={{ fontSize: '1.35rem', color: 'var(--success)' }}>{summaryLoading ? '…' : `${(summary?.totalPaid ?? 0).toFixed(2)}`}</div>
            <div className="stat-sub" style={{ marginTop: 0, fontSize: '0.72rem' }}>د.أ</div>
          </div>
        </div>
        <div className="stat-card purple" style={{ flex: '1 1 160px', minWidth: 160, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <div className="stat-icon" style={{ marginBottom: 0, width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}><ListChecks size={18} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.78rem' }}>المتبقي</div>
            <div className="stat-value" style={{ fontSize: '1.35rem', color: 'var(--secondary)' }}>{summaryLoading ? '…' : `${(summary?.totalRemaining ?? 0).toFixed(2)}`}</div>
            <div className="stat-sub" style={{ marginTop: 0, fontSize: '0.72rem' }}>د.أ</div>
          </div>
        </div>
        <div className="stat-card amber" style={{ flex: '1 1 160px', minWidth: 160, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <div className="stat-icon" style={{ marginBottom: 0, width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}><Clock size={18} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.78rem' }}>متأخر</div>
            <div className="stat-value" style={{ fontSize: '1.35rem', color: 'var(--accent)' }}>{summaryLoading ? '…' : (summary?.overdueCount ?? 0)}</div>
            <div className="stat-sub" style={{ marginTop: 0, fontSize: '0.72rem' }}>{summaryLoading ? '' : `${(summary?.overdueAmount ?? 0).toFixed(2)} د.أ`}</div>
          </div>
        </div>
      </div>

      {/* ── Filters panel ── */}
      {(filtersOpen || hasActiveFilters()) && (
        <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ flex: '1 1 260px', position: 'relative', minWidth: 200 }}>
              <Search className="search-icon" size={16} />
              <input
                type="text" className="glass-input" placeholder="بحث بالاسم، الرقم، أو الهاتف..."
                value={f.query} onChange={e => updateF({ query: e.target.value })}
                style={{ paddingRight: 40, fontSize: '0.8rem', width: '100%' }}
              />
            </div>
            {f.query && (
              <button className="glass-btn icon-btn sm" onClick={() => updateF({ query: '' })} title="مسح البحث"><X size={14} /></button>
            )}
            <button className="glass-btn sm secondary" onClick={clearFilters} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <X size={13} /> مسح الفلاتر
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">الحالة</label>
              <select className="glass-input" value={f.status} onChange={e => updateF({ status: e.target.value })} style={{ fontSize: '0.78rem' }}>
                <option value="">الكل</option>
                <option value="PENDING">بانتظار</option>
                <option value="PARTIAL">دفع جزئي</option>
                <option value="OVERDUE">متأخر</option>
                <option value="PAID">مدفوع</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">النوع</label>
              <select className="glass-input" value={f.subscriptionType} onChange={e => updateF({ subscriptionType: e.target.value, courseId: '', diplomaId: '' })} style={{ fontSize: '0.78rem' }}>
                <option value="">الكل</option>
                <option value="DIPLOMA">دبلوم</option>
                <option value="COURSE">دورة</option>
                <option value="EXTRA">رسوم إضافية</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">جهة الدفع</label>
              <select className="glass-input" value={f.paymentDest} onChange={e => updateF({ paymentDest: e.target.value })} style={{ fontSize: '0.78rem' }}>
                <option value="">الكل</option>
                <option value="ENTITY">جهة التعليم</option>
                <option value="US">لدينا</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">جهة التعليم</label>
              <select className="glass-input" value={f.entityId} onChange={e => updateF({ entityId: e.target.value })} style={{ fontSize: '0.78rem' }}>
                <option value="">الكل</option>
                {entities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">البرنامج</label>
              <select className="glass-input" value={selProgramValue()} onChange={e => onProgramChange(e.target.value)} style={{ fontSize: '0.78rem' }}>
                <option value="">الكل</option>
                {programOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">من تاريخ</label>
              <DateField value={f.dateFrom} onChange={v => updateF({ dateFrom: v })} selectStyle={{ fontSize: '0.78rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">إلى تاريخ</label>
              <DateField value={f.dateTo} onChange={v => updateF({ dateTo: v })} selectStyle={{ fontSize: '0.78rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">فرز حسب</label>
              <select className="glass-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: '0.78rem' }}>
                <option value="dueDate">الاستحقاق</option>
                <option value="amount">المبلغ</option>
                <option value="paidAmount">المدفوع</option>
                <option value="createdAt">تاريخ الإضافة</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">الاتجاه</label>
              <select className="glass-input" value={sortDir} onChange={e => setSortDir(e.target.value as 'asc' | 'desc')} style={{ fontSize: '0.78rem' }}>
                <option value="asc">تصاعدي</option>
                <option value="desc">تنازلي</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="glass-panel" style={{ padding: '14px 14px', marginBottom: 16 }}>
        {rows.length === 0 && !loading ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <CreditCard size={44} />
            <p style={{ fontSize: '0.88rem' }}>لا توجد أقساط مطابقة للفلاتر</p>
          </div>
        ) : (
          <div className="glass-table-container">
            <table className="glass-table" style={{ fontSize: '0.74rem' }}>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>البرنامج</th>
                  <th>القسط</th>
                  <th style={{ textAlign: 'center' }}>المبلغ</th>
                  <th style={{ textAlign: 'center' }}>المدفوع</th>
                  <th style={{ textAlign: 'center' }}>المتبقي</th>
                  <th>الاستحقاق</th>
                  <th>جهة الدفع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                      <tr key={`sk-${i}`} style={{ height: 46 }}>
                        <td colSpan={9}>
                          <div style={{ height: 12, width: '55%', borderRadius: 6, background: 'var(--glass-border)', animation: 'pulse 1.2s ease-in-out infinite', opacity: 0.35 }} />
                        </td>
                      </tr>
                    ))
                  : rows.map(r => {
                      const st = ST[r.status] || { label: r.status, cls: 'secondary' };
                      const cat = catLabel(r);
                      const isActive = selId === r.id;
                      return (
                        <tr key={r.id} onClick={() => openDetail(r.id)} style={{ cursor: 'pointer' }} className={isActive ? 'active' : ''}>
                          <td style={{ minWidth: 150 }}>
                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.student?.fullNameAr || '—'}</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              #{r.studentId} {r.student?.phones ? `• ${getPhone(r.student.phones)}` : ''}
                            </div>
                          </td>
                          <td style={{ minWidth: 120 }}>
                            {cat ? (
                              <span className={`badge ${cat.cls}`} style={{ fontSize: '0.56rem' }}>{cat.label}</span>
                            ) : (
                              <>
                                <span style={{ fontWeight: 500 }}>{r.programName || '—'}</span>
                                <span className={`badge ${r.subscriptionType === 'DIPLOMA' ? 'primary' : 'success'}`} style={{ fontSize: '0.5rem', marginRight: 4 }}>
                                  {r.subscriptionType === 'DIPLOMA' ? 'دبلوم' : 'دورة'}
                                </span>
                              </>
                            )}
                            {r.entityName && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{r.entityName}</div>}
                          </td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.installmentNumber}/{r.totalInstallments}</td>
                          <td style={{ direction: 'ltr', fontFamily: 'monospace', textAlign: 'center' }}>{r.amount.toFixed(2)}</td>
                          <td style={{ direction: 'ltr', fontFamily: 'monospace', textAlign: 'center', color: r.paidAmount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                            {r.paidAmount > 0 ? r.paidAmount.toFixed(2) : '—'}
                          </td>
                          <td style={{ direction: 'ltr', fontFamily: 'monospace', textAlign: 'center', color: remOf(r) > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {remOf(r) > 0 ? remOf(r).toFixed(2) : '—'}
                          </td>
                          <td style={{ fontSize: '0.66rem', whiteSpace: 'nowrap' }}>{formatDate(r.dueDate)}</td>
                          <td>
                            {r.paymentDest ? (
                              <span className={`badge ${r.paymentDest === 'ENTITY' ? 'primary' : 'teal'}`} style={{ fontSize: '0.52rem' }}>
                                {r.paymentDest === 'ENTITY' ? 'جهة التعليم' : 'لدينا'}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>—</span>}
                          </td>
                          <td><span className={`badge ${st.cls}`} style={{ fontSize: '0.56rem' }}>{st.label}</span></td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination footer ── */}
        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>عرض</span>
              <select className="glass-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '4px 8px', fontSize: '0.72rem', width: 'auto' }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>— {((page - 1) * pageSize + 1)}–{Math.min(page * pageSize, total)} من {total}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="glass-btn icon-btn xs" onClick={() => goPage(page - 1)} disabled={page <= 1} title="السابق"><ChevronRight size={14} /></button>
              {pageNumbers().map((p, i) => (
                p === '…'
                  ? <span key={`e-${i}`} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 4px' }}>…</span>
                  : <button key={p} onClick={() => goPage(p as number)}
                      style={{
                        minWidth: 30, height: 30, borderRadius: 8, padding: '0 8px', cursor: 'pointer', fontSize: '0.75rem',
                        border: `1px solid ${p === page ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: p === page ? 'var(--primary)' : 'transparent',
                        color: p === page ? '#fff' : 'inherit', fontWeight: p === page ? 700 : 400,
                      }}>
                      {p}
                    </button>
              ))}
              <button className="glass-btn icon-btn xs" onClick={() => goPage(page + 1)} disabled={page >= totalPages} title="التالي"><ChevronLeft size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ DETAIL DRAWER (lazy) ═══════════════ */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={closeDetail} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: 'min(520px, 100vw)',
            background: 'var(--modal-bg)', backdropFilter: 'blur(32px)',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.35)',
            borderLeft: '1px solid var(--glass-border)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Drawer header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0,
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={16} />
                </div>
                تفاصيل القسط
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="glass-btn icon-btn sm" onClick={() => { loadList(); loadStats(); refreshDetail(); }} title="تحديث"><RefreshCw size={15} /></button>
                <button className="modal-close" onClick={closeDetail}><X size={18} /></button>
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {detailLoading && !detail ? (
                <div>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ height: 40, borderRadius: 10, marginBottom: 10, background: 'var(--glass-border)', opacity: 0.3, animation: 'pulse 1.2s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : detail && (
                <>
                  {/* Student card + quick access */}
                  <div style={{
                    padding: '12px 14px', marginBottom: 14, borderRadius: 12,
                    background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.05rem', flexShrink: 0 }}>
                        {(detail.student?.fullNameAr || '؟').charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{detail.student?.fullNameAr || '—'}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          #{detail.studentId}{detail.student?.phones ? ` • ${getPhone(detail.student.phones)}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="glass-btn icon-btn sm" title="ملف الطالب" onClick={() => navigate(`/student-profile?studentId=${detail.studentId}`)}><ExternalLink size={14} /></button>
                        <button className="glass-btn icon-btn sm" title="التسجيل / اشتراك جديد" onClick={() => navigate(`/subscriptions?studentId=${detail.studentId}`)}><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Installment summary */}
                  <div className="glass-panel" style={{ padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        قسط #{detail.installmentNumber}/{detail.totalInstallments}
                        {(() => {
                          const cat = catLabel(detail);
                          return cat
                            ? <span className={`badge ${cat.cls}`} style={{ fontSize: '0.5rem' }}>{cat.label}</span>
                            : detail.programName
                              ? <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>— {detail.programName}</span>
                              : null;
                        })()}
                      </span>
                      <span className={`badge ${ST[detail.status]?.cls || 'secondary'}`} style={{ fontSize: '0.6rem', padding: '3px 10px' }}>
                        {ST[detail.status]?.label || detail.status}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.78rem' }}>
                      <div><span className="text-muted">المبلغ:</span> <strong style={{ direction: 'ltr', fontFamily: 'monospace' }}>{detail.amount.toFixed(2)}</strong></div>
                      <div><span className="text-muted">المدفوع:</span> <strong style={{ color: 'var(--success)', direction: 'ltr', fontFamily: 'monospace' }}>{detail.paidAmount.toFixed(2)}</strong></div>
                      <div><span className="text-muted">المتبقي:</span> <strong style={{ color: 'var(--danger)', direction: 'ltr', fontFamily: 'monospace' }}>{remOf(detail).toFixed(2)}</strong></div>
                      <div><span className="text-muted">الاستحقاق:</span> <strong>{formatDate(detail.dueDate)}</strong></div>
                      {detail.entityName && <div><span className="text-muted">جهة التعليم:</span> <strong>{detail.entityName}</strong></div>}
                      {detail.paymentDest && <div><span className="text-muted">جهة الدفع:</span> <strong>{detail.paymentDest === 'ENTITY' ? 'جهة التعليم' : 'لدينا'}</strong></div>}
                      {detail.paymentDate && <div><span className="text-muted">تاريخ الدفع:</span> <strong>{formatDate(detail.paymentDate)}</strong></div>}
                      {detail.paymentMethod && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span className="text-muted">طريقة الدفع:</span>
                          <strong> {PML[detail.paymentMethod] || detail.paymentMethod}</strong>
                          {detail.paymentMethod === 'WALLET' && detail.paymentWallet && <span className="text-muted" style={{ fontSize: '0.7rem' }}> ({WL[detail.paymentWallet] || detail.paymentWallet})</span>}
                          {detail.paymentMethod === 'CLICK' && detail.paymentBank && (
                            <span className="text-muted" style={{ fontSize: '0.7rem' }}> ({BL[detail.paymentBank] || detail.paymentBank}{detail.senderInfo ? ` — ${detail.senderInfo}` : ''})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subscription balance strip (non-EXTRA) */}
                  {detail.subscriptionType !== 'EXTRA' && detail.subscription && (
                    <div style={{
                      display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14,
                      padding: '10px 14px', borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                    }}>
                      <div style={{ flex: 1, minWidth: 90 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2 }}>قيمة الاشتراك</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', direction: 'ltr', fontFamily: 'monospace' }}>{(detail.subscription.totalCost || 0).toFixed(2)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 90 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2 }}>المدفوع</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)', direction: 'ltr', fontFamily: 'monospace' }}>{subTotalPaid.toFixed(2)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 90 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2 }}>المتبقي</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: subRemaining > 0 ? 'var(--danger)' : 'var(--success)', direction: 'ltr', fontFamily: 'monospace' }}>
                          {subRemaining > 0 ? subRemaining.toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {canEdit && (
                      <button className="glass-btn" onClick={() => { const st = detail.student; if (st) openAdd(st); else openAdd({ id: detail.studentId, fullNameAr: 'طالب' }); }}
                        style={{ flex: 1, minWidth: 120, justifyContent: 'center', fontSize: '0.76rem', padding: '9px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', color: '#fff' }}>
                        <Plus size={14} /> إضافة قسط
                      </button>
                    )}
                    {canEdit && detail.subscriptionType !== 'EXTRA' && subRemaining > 0 && (
                      <button className="glass-btn" onClick={openSchedule}
                        style={{ flex: 1, minWidth: 120, justifyContent: 'center', fontSize: '0.76rem', padding: '9px', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
                        <Calendar size={14} /> إعادة جدولة
                      </button>
                    )}
                    {canEdit && (
                      <button className="glass-btn secondary sm" onClick={() => { setEAmt(String(detail.amount)); setEDue(detail.dueDate.split('T')[0]); setENotes(detail.notes || ''); }}
                        style={{ fontSize: '0.72rem', padding: '9px 12px' }}>
                        <Save size={13} /> تعديل
                      </button>
                    )}
                    {canEdit && (
                      <button className="glass-btn secondary sm" onClick={handleDelete} disabled={saving} style={{ fontSize: '0.72rem', padding: '9px 12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                        <Trash2 size={13} /> حذف
                      </button>
                    )}
                  </div>

                  {/* Payment form */}
                  {isU && canPay && (
                    <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
                      <div className="section-title" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
                        <CreditCard size={14} color="var(--success)" />
                        تسديد الدفعة
                      </div>

                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <label className="form-label">المبلغ (د.أ) <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={payAmount}
                          onChange={e => setPayAmount(e.target.value)} style={{ direction: 'ltr', fontSize: '0.82rem', fontWeight: 600 }} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: payActive ? 14 : 0 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>حالة الدفع</span>
                        <button type="button" onClick={() => { if (payActive) { resetPay(); } else { setPayActive(true); setPayDest(''); setPayAmount(String(remOf(detail))); } }}
                          style={{
                            fontSize: '0.82rem', padding: '7px 20px', borderRadius: 8, border: '1.5px solid',
                            fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                            background: payActive ? '#25D366' : 'transparent',
                            color: payActive ? '#fff' : 'var(--text)',
                            borderColor: payActive ? '#25D366' : 'var(--glass-border)',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                          {payActive ? '✓ مدفوع' : '○ غير مدفوع'}
                        </button>
                      </div>

                      {!payActive ? (
                        <div style={{ padding: '8px 0 2px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          سيتم تسجيل الدفعة كـ <strong>غير مدفوعة</strong> — يمكن تحديث حالة الدفع لاحقاً
                        </div>
                      ) : (<>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                          {[
                            { value: 'ENTITY', label: '🏫 جهة التعليم' },
                            { value: 'US', label: '🏢 لدينا' },
                          ].map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => {
                                setPayDest(opt.value as 'ENTITY' | 'US');
                                setPayMethod('CASH');
                                setPaySubMethod('');
                                setPayBank('');
                                setPayCheckNum('');
                                setPayHawalaNum('');
                              }}
                              style={{
                                flex: 1, padding: '10px 16px', borderRadius: 10, border: '1.5px solid', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.82rem', transition: 'all .2s',
                                background: payDest === opt.value ? 'var(--primary)' : 'transparent',
                                color: payDest === opt.value ? '#fff' : 'var(--text)',
                                borderColor: payDest === opt.value ? 'var(--primary)' : (!payDest ? 'var(--danger)' : 'var(--glass-border)'),
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {!payDest && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={12} /> مطلوب — اختر جهة الدفع
                          </div>
                        )}

                        {payDest === 'ENTITY' ? (<>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="رقم الإيصال" style={{ fontSize: '0.82rem' }} />
                          </div>
                        </>) : (<>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">طريقة الدفع <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select className="glass-input" value={payMethod}
                              onChange={e => {
                                setPayMethod(e.target.value);
                                setPaySubMethod('');
                                setPayBank('');
                                setPayCheckNum('');
                                setPayHawalaNum('');
                              }}
                              style={{ fontSize: '0.82rem' }}>
                              <option value="CASH">💰 نقداً</option>
                              <option value="TRANSFER">📲 إلكتروني</option>
                              <option value="CHECK">📄 شيك</option>
                              <option value="MONEY_TRANSFER">🌍 حوالة مالية</option>
                            </select>
                          </div>

                          {payMethod === 'TRANSFER' && (<>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label">نوع المحفظة الإلكترونية <span style={{ color: 'var(--danger)' }}>*</span></label>
                              <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.82rem' }}>
                                <option value="">— اختر المحفظة —</option>
                                <option value="CLICK">Click كليك</option>
                                <option value="ZAIN_CASH">زين كاش (Zain Cash)</option>
                                <option value="ORANGE_MONEY">اورنج موني (Orange Money)</option>
                                <option value="U_WALLET">محفظة أمنية (UWallet)</option>
                                <option value="DINARAK">دينارك (Dinarak)</option>
                                <option value="ALAWNEH">علاونة</option>
                                <option value="FAWATEERKOM">فواتيركم (مدفوعاتكم)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label">رقم الحوالة</label>
                              <input type="text" className="glass-input" value={payWalletRef} onChange={e => setPayWalletRef(e.target.value)}
                                placeholder="اختياري — رقم العملية من المحفظة" style={{ fontSize: '0.82rem', direction: 'ltr' }} />
                            </div>
                          </>)}

                          {payMethod === 'CHECK' && (<>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label">البنك <span style={{ color: 'var(--danger)' }}>*</span></label>
                              <select className="glass-input" value={payBank} onChange={e => setPayBank(e.target.value)} style={{ fontSize: '0.82rem' }}>
                                <option value="">— اختر البنك —</option>
                                {Object.entries(BL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label">رقم الشيك <span style={{ color: 'var(--danger)' }}>*</span></label>
                              <input type="text" className="glass-input" value={payCheckNum} onChange={e => setPayCheckNum(e.target.value)}
                                placeholder="رقم الشيك" style={{ fontSize: '0.82rem', direction: 'ltr' }} />
                            </div>
                          </>)}

                          {payMethod === 'MONEY_TRANSFER' && (<>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label">نوع الحوالة المالية <span style={{ color: 'var(--danger)' }}>*</span></label>
                              <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.82rem' }}>
                                <option value="">— اختر نوع الحوالة —</option>
                                <option value="WESTERN_UNION">ويسترن يونيون (Western Union)</option>
                                <option value="MONEYGRAM">MoneyGram</option>
                                <option value="RIA_MONEY">RIA Money</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label">رقم الحوالة <span style={{ color: 'var(--danger)' }}>*</span></label>
                              <input type="text" className="glass-input" value={payHawalaNum} onChange={e => setPayHawalaNum(e.target.value)}
                                placeholder="رقم الحوالة المالية" style={{ fontSize: '0.82rem', direction: 'ltr' }} />
                            </div>
                          </>)}

                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)}
                              placeholder="إلزامي — رقم الإيصال أو التحويل" style={{ fontSize: '0.82rem' }} />
                          </div>
                        </>)}

                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label">ملاحظات الدفع</label>
                          <input type="text" className="glass-input" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                            placeholder="أي ملاحظات إضافية..." style={{ fontSize: '0.82rem' }} />
                        </div>

                        <button className="glass-btn" onClick={handlePay} disabled={payLoading}
                          style={{ width: '100%', background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' }}>
                          {payLoading ? 'جارٍ تسجيل الدفعة...' : `تسديد ${toNumber(payAmount).toFixed(2)} د.أ`}
                        </button>
                      </>)}
                    </div>
                  )}

                  {/* Edit form */}
                  {canEdit && (
                    <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
                      <div className="section-title" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
                        <Save size={14} color="var(--primary)" />
                        تعديل القسط
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label">المبلغ</label>
                          <input type="text" inputMode="decimal" className="glass-input" value={eAmt} onChange={e => setEAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.82rem' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label">تاريخ الاستحقاق</label>
                          <DateField value={eDue} onChange={v => setEDue(v)} selectStyle={{ fontSize: '0.82rem' }} />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <textarea className="glass-input" rows={2} value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="ملاحظات" style={{ fontSize: '0.82rem' }} />
                      </div>
                      <button className="glass-btn" onClick={handleEdit} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                        <Save size={14} /> {saving ? 'جارٍ...' : 'حفظ التعديلات'}
                      </button>
                    </div>
                  )}

                  {/* Transactions timeline */}
                  <div className="section-title" style={{ fontSize: '0.82rem' }}>
                    <Clock size={13} color="var(--primary)" />
                    سجل الدفعات ({(detail.transactions || []).length})
                  </div>
                  {(detail.transactions || []).length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px 16px', background: 'var(--glass-bg)', borderRadius: 10, marginTop: 8 }}>
                      <p style={{ fontSize: '0.8rem' }}>لا توجد دفعات سابقة لهذا القسط</p>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', paddingRight: 22, marginTop: 10 }}>
                      <div style={{ position: 'absolute', right: 8, top: 4, bottom: 4, width: 2, background: 'var(--glass-border)', borderRadius: 2 }} />
                      {(detail.transactions || []).map(tx => (
                        <div key={tx.id} style={{ position: 'relative', paddingBottom: 12, paddingRight: 18 }}>
                          <div style={{ position: 'absolute', right: -14, top: 4, width: 11, height: 11, borderRadius: '50%', background: tx.status === 'COMPLETED' ? 'var(--success)' : 'var(--danger)', border: '2.5px solid var(--card-bg)', zIndex: 1, boxShadow: '0 0 0 2px var(--glass-border)' }} />
                          <div className="glass-panel" style={{ padding: '8px 12px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>
                                {tx.type === 'RECEIPT' ? 'دفعة' : tx.type === 'REFUND' ? 'مرتجع' : 'تعديل'}
                                <span className={`badge ${tx.status === 'COMPLETED' ? 'success' : 'secondary'}`} style={{ fontSize: '0.48rem', marginRight: 4, padding: '1px 6px' }}>{tx.status === 'COMPLETED' ? 'مكتمل' : 'ملغي'}</span>
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{formatDate(tx.date)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.68rem', alignItems: 'center' }}>
                              <span><strong>{tx.amount.toFixed(2)}</strong> د.أ</span>
                              <span style={{ color: 'var(--text-muted)' }}>{PML[tx.paymentMethod] || tx.paymentMethod}</span>
                              {tx.receiptNumber && (
                                <button onClick={() => printReceipt(tx)} style={{ padding: '0 6px', fontSize: '0.58rem', cursor: 'pointer', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--primary)', background: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Printer size={8} /> سند #{tx.receiptNumber}
                                </button>
                              )}
                              {canEdit && tx.status === 'COMPLETED' && (
                                <button onClick={voidPayment} title="إلغاء الدفعات (سحب)" style={{ padding: '0 6px', fontSize: '0.58rem', cursor: 'pointer', border: '1px solid var(--danger)', borderRadius: 4, color: 'var(--danger)', background: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Trash2 size={8} /> سحب
                                </button>
                              )}
                            </div>
                            {tx.notes && <div style={{ marginTop: 3, fontSize: '0.65rem', color: 'var(--text-muted)' }}>{tx.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ADD INSTALLMENT MODAL ═══════════════ */}
      {addOpen && addStudent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div style={{
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            background: 'var(--modal-bg)', backdropFilter: 'blur(32px)',
            borderRadius: 20, border: '1px solid var(--glass-border)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.35)', padding: 0, direction: 'rtl',
          }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={16} />
                </div>
                إضافة قسط جديد — {addStudent.fullNameAr}
              </h3>
              <button className="modal-close" onClick={() => setAddOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ padding: '16px 24px' }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 6 }}>نوع القسط</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => {
                    const sel = aCategory === cat.value;
                    const colors: Record<string, string> = {
                      SUBSCRIPTION: '#6366f1', PENALTY: '#ef4444', FINE: '#f97316', PRIVILEGE: '#eab308', OTHER: '#6b7280'
                    };
                    const bgColors: Record<string, string> = {
                      SUBSCRIPTION: 'rgba(99,102,241,0.1)', PENALTY: 'rgba(239,68,68,0.1)',
                      FINE: 'rgba(249,115,22,0.1)', PRIVILEGE: 'rgba(234,179,8,0.1)', OTHER: 'rgba(107,114,128,0.1)'
                    };
                    return (
                      <div key={cat.value} onClick={() => { setACategory(cat.value); if (cat.value !== 'SUBSCRIPTION') setAddSelSub(prev => prev || null); }}
                        style={{
                          padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.74rem', fontWeight: sel ? 700 : 500,
                          border: `2px solid ${sel ? colors[cat.value] : 'var(--glass-border)'}`,
                          background: sel ? bgColors[cat.value] : 'transparent',
                          color: sel ? colors[cat.value] : 'inherit',
                          transform: sel ? 'scale(1.04)' : 'scale(1)',
                          boxShadow: sel ? `0 2px 10px ${colors[cat.value]}33` : 'none',
                          transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        {cat.value === 'PENALTY' || cat.value === 'FINE' ? <AlertTriangle size={12} /> :
                         cat.value === 'PRIVILEGE' ? <Award size={12} /> :
                         cat.value === 'SUBSCRIPTION' ? <CreditCard size={12} /> : <FileText size={12} />}
                        {cat.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {aCategory === 'SUBSCRIPTION' && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>الاشتراك</label>
                  {addSubs.length === 0 ? (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '6px 0' }}>لا يوجد اشتراكات</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {addSubs.map(sub => {
                        const isD = !!(sub as any).diploma;
                        const active = addSelSub?.id === sub.id;
                        return (
                          <div key={String(sub.id)} onClick={() => setAddSelSub({ ...sub, id: sub.id } as Sub)}
                            style={{
                              padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '0.68rem',
                              border: `1.5px solid ${active ? 'var(--primary)' : 'var(--glass-border)'}`,
                              background: active ? 'var(--primary-light)' : 'transparent',
                              color: active ? 'var(--primary)' : 'inherit', fontWeight: active ? 600 : 400,
                            }}>
                            {isD ? 'دبلوم' : 'دورة'}: {subName(sub)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {aCategory !== 'SUBSCRIPTION' && (
                <div style={{ padding: '6px 10px', marginBottom: 10, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.68rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={11} />
                  {CAT_MAP[aCategory]?.label} — مبلغ إضافي خارج الاشتراكات
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>المبلغ (د.أ)</label>
                  <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={aAmt} onChange={e => setAAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.78rem', padding: '9px 12px' }} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>تاريخ الاستحقاق</label>
                  <DateField value={aDue} onChange={v => setADue(v)} selectStyle={{ padding: '9px 12px', fontSize: '0.78rem' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <textarea className="glass-input" rows={2} placeholder={aCategory === 'SUBSCRIPTION' ? 'ملاحظات (اختياري)' : 'بيان (اختياري)'} value={aNotes} onChange={e => setANotes(e.target.value)} style={{ fontSize: '0.78rem', padding: '9px 12px' }} />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 10 }}>
              {canEdit && (
                <button className="glass-btn" onClick={async () => { const ok = await handleAdd(); if (ok) setAddOpen(false); }} disabled={saving}
                  style={{
                    flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '11px',
                    background: aCategory !== 'SUBSCRIPTION' ? 'var(--warning)' : 'var(--primary)',
                    borderColor: aCategory !== 'SUBSCRIPTION' ? 'var(--warning)' : 'var(--primary)',
                    color: '#fff',
                  }}>
                  <Plus size={14} /> {saving ? 'جارٍ...' : `إضافة ${CAT_MAP[aCategory]?.label || 'قسط'}`}
                </button>
              )}
              <button className="glass-btn secondary" onClick={() => setAddOpen(false)} style={{ fontSize: '0.82rem', padding: '11px 20px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SCHEDULE MODAL ═══════════════ */}
      {showSchedule && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setShowSchedule(false); }}>
          <div style={{
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            background: 'var(--modal-bg)', backdropFilter: 'blur(32px)',
            borderRadius: 20, border: '1px solid var(--glass-border)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.35)', padding: 0, direction: 'rtl',
          }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </div>
                جدولة الأقساط
              </h3>
              <button className="modal-close" onClick={() => setShowSchedule(false)}><X size={18} /></button>
            </div>

            <div style={{ padding: '14px 24px', background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>إجمالي المبلغ</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{scheduleTotal.toFixed(2)} د.أ</div>
                  </div>
                  <div style={{ width: 1, height: 32, background: 'var(--glass-border)' }} />
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>عدد الدفعات</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="glass-btn icon-btn xs" onClick={() => {
                        const cnt = Math.max(scheduleMin, scheduleCount - 1);
                        setScheduleCount(cnt);
                        setScheduleData(distributeSchedule(cnt, scheduleTotal, scheduleData) ?? []);
                      }} style={{ width: 26, height: 26, borderRadius: 6, fontSize: '1rem', lineHeight: 1, padding: 0, fontWeight: 700 }}>−</button>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{scheduleCount}</span>
                      <button className="glass-btn icon-btn xs" onClick={() => {
                        const cnt = scheduleCount + 1;
                        setScheduleCount(cnt);
                        setScheduleData(distributeSchedule(cnt, scheduleTotal, scheduleData) ?? []);
                      }} style={{ width: 26, height: 26, borderRadius: 6, fontSize: '1rem', lineHeight: 1, padding: 0, fontWeight: 700 }}>+</button>
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '6px 14px', borderRadius: 8,
                  background: scheduleData.reduce((s, d) => s + d.amount, 0) === scheduleTotal ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: scheduleData.reduce((s, d) => s + d.amount, 0) === scheduleTotal ? 'var(--success)' : 'var(--danger)',
                  fontSize: '0.7rem', fontWeight: 600,
                }}>
                  {scheduleData.reduce((s, d) => s + d.amount, 0).toFixed(2)} / {scheduleTotal.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', maxHeight: 420, overflowY: 'auto' }}>
              {scheduleData.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 20px' }}>
                  <p style={{ fontSize: '0.82rem' }}>لا توجد أقساط للجدولة</p>
                </div>
              ) : (
                scheduleData.map((s, idx) => (
                  <div key={s.id || `new-${idx}`} style={{
                    padding: '12px 14px', marginBottom: 10, borderRadius: 12,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--glass-border)',
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: s.id ? 'var(--primary)' : 'var(--success)',
                          color: '#fff', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                        }}>{idx + 1}</span>
                        {s.id ? `القسط الحالي #${idx + 1}` : 'قسط جديد'}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {scheduleData.slice(0, idx + 1).reduce((sum, x) => sum + x.amount, 0).toFixed(2)} تراكمي
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">المبلغ (د.أ)</label>
                        <input type="text" inputMode="decimal" className="glass-input" value={s.amount}
                          onChange={e => {
                            const newData = [...scheduleData];
                            newData[idx] = { ...newData[idx], amount: toNumber(e.target.value) };
                            setScheduleData(newData);
                          }}
                          style={{ direction: 'ltr', fontSize: '0.82rem', fontWeight: 600 }} />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">تاريخ الاستحقاق</label>
                        <DateField value={s.dueDate}
                          onChange={v => {
                            const newData = [...scheduleData];
                            newData[idx] = { ...newData[idx], dueDate: v };
                            setScheduleData(newData);
                          }}
                          selectStyle={{ fontSize: '0.82rem' }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 10 }}>
              {canEdit && (
                <button className="glass-btn" onClick={handleScheduleSave} disabled={saving || scheduleData.length === 0}
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem', padding: '12px', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
                  <Save size={15} /> {saving ? 'جارٍ الحفظ...' : 'حفظ جدولة الأقساط'}
                </button>
              )}
              <button className="glass-btn secondary" onClick={() => setShowSchedule(false)} style={{ fontSize: '0.85rem', padding: '12px 20px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <DeepSearchModal
        isOpen={isDeep}
        onClose={() => setIsDeep(false)}
        onSearch={() => {}}
        onSelectStudent={(s: any) => { updateF({ studentId: s.id }); setIsDeep(false); }}
        initialFilters={{}}
      />
    </div>
  );
};