import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, CreditCard, Plus, X, RefreshCw,
  Clock, FileText, Trash2, Save, Printer,
  Calendar, AlertTriangle, Award,
  ChevronRight, ChevronLeft, SlidersHorizontal, ExternalLink, Wallet, ListChecks, User, Filter, Banknote, BookOpen, GraduationCap
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

const STATUS_TABS = [
  { key: '', label: 'الكل' },
  { key: 'PENDING', label: 'بانتظار' },
  { key: 'OVERDUE', label: 'متأخر' },
  { key: 'PARTIAL', label: 'جزئي' },
  { key: 'PAID', label: 'مدفوع' },
];

const subName = (sub: Sub) => sub.diploma?.name || sub.course?.name || `#${sub.id}`;
const getPhone = (p: any) => { try { return (typeof p === 'string' ? JSON.parse(p) : p)?.[0] || '—'; } catch { return '—'; } };
const remOf = (i: Inst) => Math.max(0, (i.amount || 0) - (i.paidAmount || 0));
const catLabel = (inst: Inst) => {
  if (inst.subscriptionType !== 'EXTRA') return null;
  return CATEGORIES.find(c => inst.subscriptionId === `EXTRA-${c.value}`);
};
const fmt = (n: number | undefined | null) => (n || 0).toFixed(2);
const num = (n: number | undefined | null) => n ?? 0;

interface Filters { query: string; status: string; subscriptionType: string; paymentDest: string; entityId: string; courseId: string; diplomaId: string; dateFrom: string; dateTo: string; studentId: string; }
const EMPTY_FILTERS: Filters = { query: '', status: '', subscriptionType: '', paymentDest: '', entityId: '', courseId: '', diplomaId: '', dateFrom: '', dateTo: '', studentId: '' };

const sx = { position: 'fixed' as const, inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 20 };
const mbox: React.CSSProperties = { background: 'var(--modal-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', borderRadius: 22, border: '1px solid var(--glass-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)', direction: 'rtl' };
const gl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 };
const rq: React.CSSProperties = { color: 'var(--danger)', marginRight: 2 };

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
  const [filtersOpen, setFiltersOpen] = useState(true);

  /* ── Student search (filter) ── */
  const [fStudentName, setFStudentName] = useState('');
  const [stuResults, setStuResults] = useState<any[]>([]);
  const [showStuDrop, setShowStuDrop] = useState(false);
  const stuRef = useRef<HTMLDivElement>(null);

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
    if (sid) {
      setF(prev => ({ ...prev, studentId: sid }));
      apiFetch(`/students/${sid}`).then((s: any) => { if (s) setFStudentName(s.fullNameAr); }).catch(() => {});
    }
  }, [searchParams, apiFetch]);

  /* Close student dropdown on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => { if (stuRef.current && !stuRef.current.contains(e.target as Node)) setShowStuDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

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

  const clearFilters = () => {
    setF(EMPTY_FILTERS); setPage(1); setFStudentName(''); setStuResults([]); setShowStuDrop(false);
  };

  const activeFilterCount = () => {
    let n = 0;
    for (const k of Object.keys(EMPTY_FILTERS) as (keyof Filters)[]) { if (k !== 'query' && f[k]) n++; }
    return n;
  };
  const hasActiveFilters = () => activeFilterCount() > 0;

  const searchStudents = useCallback(async (q: string) => {
    if (!q.trim()) { setStuResults([]); return; }
    try {
      const r = await apiFetch(`/students?query=${encodeURIComponent(q)}&limit=8`);
      setStuResults(Array.isArray(r) ? r : r?.data || []);
      setShowStuDrop(true);
    } catch { setStuResults([]); }
  }, [apiFetch]);

  const pickStudent = (s: any) => {
    setFStudentName(s.fullNameAr);
    updateF({ studentId: s.id });
    setShowStuDrop(false);
  };

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
  const subPaidPct = (detail?.subscription?.totalCost || 0) > 0
    ? Math.min(100, Math.round((subTotalPaid / (detail?.subscription?.totalCost || 1)) * 100))
    : 0;

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
      if (payMethod === 'TRANSFER') { body.paymentSubMethod = paySubMethod; if (payWalletRef) body.paymentWalletRef = payWalletRef; }
      if (payMethod === 'CHECK') { body.paymentBank = payBank; body.checkNumber = payCheckNum; }
      if (payMethod === 'MONEY_TRANSFER') { body.paymentSubMethod = paySubMethod; body.hawalaNumber = payHawalaNum; }
      if (payNotes) body.notes = payNotes;

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
  const distributeSchedule = useCallback((count: number, total: number, baseData: typeof scheduleData, unpaid: Inst[] = subInsts.filter(i => remOf(i) > 0)) => {
    if (count < 1) return;
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
  }, [subInsts]);

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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Traditional Arabic',Tahoma,sans-serif;padding:48px;max-width:750px;margin:auto;color:#222}
h1{text-align:center;font-size:24px;margin-bottom:2px;letter-spacing:1px}
.sub{text-align:center;font-size:13px;color:#888;margin-bottom:32px}
.rc{border:2px solid #1a5632;padding:32px;border-radius:10px;background:#fafdfb}
.r{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #ddd}
.r:last-child{border-bottom:none}
.l{color:#555;font-weight:700;font-size:14px}
.v{font-weight:400;font-size:14px;direction:ltr;text-align:left}
.tt{font-size:20px;font-weight:700;color:#1a5632;text-align:center;padding:18px 0 8px;border-top:2px solid #1a5632;margin-top:12px}
.ft{text-align:center;margin-top:28px;color:#aaa;font-size:11px}
button{padding:10px 24px;margin-bottom:24px;cursor:pointer;font-size:14px;border:1px solid #1a5632;background:#fff;border-radius:6px;color:#1a5632;transition:.2s}
button:hover{background:#1a5632;color:#fff}
@media print{body{padding:24px}button{display:none}}
</style></head><body>
<button onclick="window.print()">🖨️ طباعة السند</button>
<h1>سند قبض</h1>
<div class="sub">مركز LHC للتدريب — ${formatDate(new Date())}</div>
<div class="rc">
<div class="r"><span class="l">رقم السند</span><span class="v">${tx.receiptNumber}</span></div>
<div class="r"><span class="l">التاريخ</span><span class="v">${formatDate(tx.date)}</span></div>
${tx.student ? `<div class="r"><span class="l">الطالب</span><span class="v">${tx.student.fullNameAr} (${tx.student.id})</span></div>` : ''}
<div class="r"><span class="l">المبلغ</span><span class="v">${tx.amount.toFixed(2)} د.أ</span></div>
<div class="r"><span class="l">طريقة الدفع</span><span class="v">${PML[tx.paymentMethod] || tx.paymentMethod}</span></div>
${tx.referenceNumber ? `<div class="r"><span class="l">رقم المرجع</span><span class="v">${tx.referenceNumber}</span></div>` : ''}
${tx.notes ? `<div class="r"><span class="l">ملاحظات</span><span class="v">${tx.notes}</span></div>` : ''}
<div class="tt">المبلغ: ${tx.amount.toFixed(2)} دينار أردني</div>
</div>
<div class="ft">شكراً لثقتكم — LHC للتدريب</div>
</body></html>`); w.document.close();
  };

  /* ── Pagination helpers ── */
  const pageNumbers = () => {
    const pages: (number | '…')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(page - 2, totalPages - 6));
      for (let i = start; i < start + 7; i++) pages.push(i);
      if (start > 1) pages.unshift('…');
      if (start + 6 < totalPages) pages.push('…');
    }
    return pages;
  };
  const goPage = (p: number) => { if (p >= 1 && p <= totalPages) setPage(p); };

  const programOptions = () => {
    const opts: { value: string; label: string; type: string }[] = [];
    if (f.subscriptionType !== 'COURSE') for (const d of diplomas) opts.push({ value: `D-${d.id}`, label: `دبلوم: ${d.name}`, type: 'DIPLOMA' });
    if (f.subscriptionType !== 'DIPLOMA') for (const c of courses) opts.push({ value: `C-${c.id}`, label: `دورة: ${c.name}`, type: 'COURSE' });
    return opts;
  };
  const selProgramValue = () => (f.courseId ? `C-${f.courseId}` : f.diplomaId ? `D-${f.diplomaId}` : '');
  const onProgramChange = (v: string) => {
    if (!v) { setF(prev => ({ ...prev, courseId: '', diplomaId: '' })); setPage(1); return; }
    const [type, id] = v.split('-');
    if (type === 'C') { setF(prev => ({ ...prev, courseId: id, diplomaId: '' })); setPage(1); }
    else { setF(prev => ({ ...prev, courseId: '', diplomaId: id })); setPage(1); }
  };

  const STAT_CARDS = [
    { cls: 'blue', color: '#3b82f6', ico: <CreditCard size={17} />, label: 'إجمالي الأقساط', val: summaryLoading ? '…' : String(num(summary?.totalInstallments)), sub: summaryLoading ? '' : `${fmt(summary?.totalAmount)} د.أ` },
    { cls: 'green', color: '#10b981', ico: <Wallet size={17} />, label: 'المدفوع', val: summaryLoading ? '…' : fmt(summary?.totalPaid), sub: 'د.أ' },
    { cls: 'purple', color: '#6366f1', ico: <ListChecks size={17} />, label: 'المتبقي', val: summaryLoading ? '…' : fmt(summary?.totalRemaining), sub: 'د.أ' },
    { cls: 'amber', color: '#f59e0b', ico: <Clock size={17} />, label: 'متأخر', val: summaryLoading ? '…' : String(num(summary?.overdueCount)), sub: summaryLoading ? '' : `${fmt(summary?.overdueAmount)} د.أ` },
  ];

  const statusTab = STATUS_TABS.find(t => t.key === f.status)?.label;

  const filterChips: { label: string; onClear?: () => void }[] = [];
  if (statusTab && statusTab !== 'الكل') filterChips.push({ label: `الحالة: ${statusTab}`, onClear: () => updateF({ status: '' }) });
  if (fStudentName) filterChips.push({ label: fStudentName, onClear: () => { updateF({ studentId: '' }); setFStudentName(''); } });
  if (f.subscriptionType) filterChips.push({ label: `النوع: ${f.subscriptionType === 'DIPLOMA' ? 'دبلوم' : f.subscriptionType === 'COURSE' ? 'دورة' : 'رسوم إضافية'}`, onClear: () => updateF({ subscriptionType: '', courseId: '', diplomaId: '' }) });
  if (f.paymentDest) filterChips.push({ label: `جهة الدفع: ${f.paymentDest === 'ENTITY' ? 'جهة التعليم' : 'لدينا'}`, onClear: () => updateF({ paymentDest: '' }) });
  if (f.entityId) filterChips.push({ label: `جهة: ${entities.find(e => String(e.id) === f.entityId)?.name || ''}`, onClear: () => updateF({ entityId: '' }) });
  if (f.courseId || f.diplomaId) filterChips.push({ label: `برنامج: ${programOptions().find(o => o.value === selProgramValue())?.label.replace(/^(دبلوم|دورة): /, '') || ''}`, onClear: () => updateF({ courseId: '', diplomaId: '' }) });
  if (f.dateFrom || f.dateTo) filterChips.push({ label: `الاستحقاق: ${f.dateFrom || '...'} ← ${f.dateTo || '...'}`, onClear: () => updateF({ dateFrom: '', dateTo: '' }) });

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div style={{ minHeight: 'calc(100vh - 140px)', maxWidth: 1500, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>إدارة الأقساط</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{total} {total === 1 ? 'قسط' : 'قسط'} • جلب من الخادم</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="glass-btn icon-btn" onClick={() => { loadList(); loadStats(); }} title="تحديث"><RefreshCw size={16} /></button>
          <button className="glass-btn" onClick={() => setIsDeep(true)} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={15} /> بحث عميق
          </button>
          <button className={`glass-btn ${filtersOpen ? '' : 'secondary'}`} onClick={() => setFiltersOpen(o => !o)} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <SlidersHorizontal size={15} /> الفلاتر
            <span style={{
              minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.58rem', fontWeight: 700,
              background: hasActiveFilters() ? 'var(--primary)' : 'var(--glass-border)', color: hasActiveFilters() ? '#fff' : 'var(--text-muted)',
            }}>{activeFilterCount()}</span>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, marginBottom: 20 }}>
        {STAT_CARDS.map((s, i) => (
          <div key={i} className={`stat-card ${s.cls}`} style={{ padding: '12px 14px', border: '1px solid var(--glass-border)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, borderRadius: '50%', background: `${s.color}08`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.ico}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.15, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{s.val}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1 }}>{s.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      {filtersOpen && (
        <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: 14, border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Student search */}
            <div ref={stuRef} style={{ flex: '1 1 220px', minWidth: 200, position: 'relative' }}>
              <label style={{ ...gl, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> بحث عن طالب</label>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
                  <input type="text" className="glass-input" placeholder="الاسم، الرقم، أو الهاتف..."
                    value={fStudentName || f.query}
                    onChange={e => {
                      const v = e.target.value;
                      setFStudentName('');
                      updateF({ query: v, studentId: '' });
                      searchStudents(v);
                    }}
                    onFocus={() => { if (stuResults.length > 0) setShowStuDrop(true); }}
                    style={{ fontSize: '0.8rem', paddingRight: 26, paddingLeft: fStudentName ? 90 : 8 }}
                  />
                  {fStudentName && (
                    <span style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', fontSize: '0.58rem', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 1, fontWeight: 500 }}>
                      {fStudentName}
                      <X size={9} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => { setFStudentName(''); updateF({ studentId: '', query: '' }); }} />
                    </span>
                  )}
                </div>
                <button className="glass-btn icon-btn sm" onClick={() => setIsDeep(true)} title="بحث عميق"><Search size={13} /></button>
              </div>
              {showStuDrop && stuResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--card-bg)', borderRadius: 8, marginTop: 3, border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: 180, overflowY: 'auto' }}>
                  {stuResults.map((s: any) => (
                    <div key={s.id} onClick={() => pickStudent(s)}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background .12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700 }}>{s.fullNameAr?.charAt(0)}</div>
                        <span style={{ fontSize: '0.8rem' }}>{s.fullNameAr}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'monospace' }}>#{s.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>جهة التعليم</label>
              <select className="glass-input" value={f.entityId} onChange={e => updateF({ entityId: e.target.value })} style={{ fontSize: '0.8rem' }}>
                <option value="">الكل</option>
                {entities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select>
            </div>

            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>البرنامج</label>
              <select className="glass-input" value={selProgramValue()} onChange={e => onProgramChange(e.target.value)} style={{ fontSize: '0.8rem' }}>
                <option value="">الكل</option>
                {programOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ minWidth: 110 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>النوع</label>
              <select className="glass-input" value={f.subscriptionType} onChange={e => updateF({ subscriptionType: e.target.value, courseId: '', diplomaId: '' })} style={{ fontSize: '0.8rem' }}>
                <option value="">الكل</option>
                <option value="DIPLOMA">دبلوم</option>
                <option value="COURSE">دورة</option>
                <option value="EXTRA">رسوم إضافية</option>
              </select>
            </div>

            <div style={{ minWidth: 110 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>جهة الدفع</label>
              <select className="glass-input" value={f.paymentDest} onChange={e => updateF({ paymentDest: e.target.value })} style={{ fontSize: '0.8rem' }}>
                <option value="">الكل</option>
                <option value="ENTITY">جهة التعليم</option>
                <option value="US">لدينا</option>
              </select>
            </div>

            <div style={{ minWidth: 130 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>من تاريخ</label>
              <DateField value={f.dateFrom} onChange={v => updateF({ dateFrom: v })} style={{ minWidth: 250 }} selectStyle={{ fontSize: '0.8rem', padding: '6px 9px' }} />
            </div>
            <div style={{ minWidth: 130 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>إلى تاريخ</label>
              <DateField value={f.dateTo} onChange={v => updateF({ dateTo: v })} style={{ minWidth: 250 }} selectStyle={{ fontSize: '0.8rem', padding: '6px 9px' }} />
            </div>

            <div style={{ minWidth: 110 }}>
              <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>الفرز</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <select className="glass-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: '0.8rem', flex: 1 }}>
                  <option value="dueDate">الاستحقاق</option>
                  <option value="amount">المبلغ</option>
                  <option value="paidAmount">المدفوع</option>
                  <option value="createdAt">الإضافة</option>
                </select>
                <select className="glass-input" value={sortDir} onChange={e => setSortDir(e.target.value as 'asc' | 'desc')} style={{ fontSize: '0.8rem', width: 54 }}>
                  <option value="asc">↑</option>
                  <option value="desc">↓</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', paddingBottom: 1 }}>
              <button className="glass-btn icon-btn sm" onClick={clearFilters} title="مسح الفلاتر" style={{ opacity: hasActiveFilters() ? 1 : 0.35, transition: 'opacity .15s' }}><X size={13} /></button>
              <button className="glass-btn icon-btn sm" onClick={() => { loadList(); loadStats(); }} title="تحديث"><RefreshCw size={13} /></button>
            </div>
          </div>

          {hasActiveFilters() && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--glass-border)', alignItems: 'center' }}>
              {filterChips.map((c, i) => (
                <span key={i} style={{ fontSize: '0.58rem', background: c.onClear ? 'var(--primary-light)' : 'var(--glass-bg)', color: c.onClear ? 'var(--primary)' : undefined, padding: '2px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                  <Filter size={9} /> {c.label}
                  {c.onClear && <X size={9} style={{ cursor: 'pointer' }} onClick={c.onClear} />}
                </span>
              ))}
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginRight: 'auto', fontWeight: 500 }}>{total} {total === 1 ? 'نتيجة' : 'نتيجة'}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Status tabs + actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {STATUS_TABS.map(t => (
            <button key={t.key} className={`glass-btn sm ${f.status === t.key ? '' : 'secondary'}`}
              onClick={() => updateF({ status: t.key })}
              style={{ fontSize: '0.74rem', padding: '5px 12px', background: f.status === t.key ? 'var(--primary)' : undefined, color: f.status === t.key ? '#fff' : undefined, fontWeight: f.status === t.key ? 600 : 400, borderRadius: 7, transition: 'all .12s' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Banknote size={13} /> المبالغ بالدينار الأردني
        </div>
      </div>

      {/* ── Table ── */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="glass-table" style={{ fontSize: '0.72rem', width: '100%', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{ padding: '9px 12px', fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>الطالب</th>
                <th style={{ padding: '9px 12px', fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>البرنامج</th>
                <th style={{ padding: '9px 12px', width: 70, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>القسط</th>
                <th style={{ padding: '9px 12px', width: 75, textAlign: 'center', fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>المبلغ</th>
                <th style={{ padding: '9px 12px', width: 75, textAlign: 'center', fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>المدفوع</th>
                <th style={{ padding: '9px 12px', width: 75, textAlign: 'center', fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>المتبقي</th>
                <th style={{ padding: '9px 12px', width: 85, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>الاستحقاق</th>
                <th style={{ padding: '9px 12px', width: 95, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>جهة الدفع</th>
                <th style={{ padding: '9px 12px', width: 70, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                  <tr key={`sk-${i}`} style={{ height: 48 }}>
                    <td colSpan={9}>
                      <div style={{ height: 12, width: '55%', borderRadius: 6, background: 'var(--glass-border)', animation: 'pulse 1.2s ease-in-out infinite', opacity: 0.35 }} />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <CreditCard size={24} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} /> لا توجد أقساط مطابقة للفلاتر
                  </td>
                </tr>
              ) : rows.map(r => {
                const st = ST[r.status] || { label: r.status, cls: 'secondary' };
                const cat = catLabel(r);
                const isActive = selId === r.id;
                return (
                  <tr key={r.id} onClick={() => openDetail(r.id)} className={isActive ? 'active' : ''} style={{ cursor: 'pointer', transition: 'background .12s' }}>
                    <td style={{ padding: '9px 12px', minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.56rem', fontWeight: 700, flexShrink: 0 }}>{r.student?.fullNameAr?.charAt(0) || '؟'}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{r.student?.fullNameAr || '—'}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
                            #{r.studentId}{r.student?.phones ? ` • ${getPhone(r.student.phones)}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', minWidth: 120 }}>
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
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', whiteSpace: 'nowrap', fontSize: '0.68rem' }}>{r.installmentNumber}/{r.totalInstallments}</td>
                    <td style={{ padding: '9px 12px', direction: 'ltr', fontFamily: 'monospace', textAlign: 'center', fontWeight: 600 }}>{fmt(r.amount)}</td>
                    <td style={{ padding: '9px 12px', direction: 'ltr', fontFamily: 'monospace', textAlign: 'center', color: r.paidAmount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {r.paidAmount > 0 ? fmt(r.paidAmount) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', direction: 'ltr', fontFamily: 'monospace', textAlign: 'center', color: remOf(r) > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {remOf(r) > 0 ? fmt(remOf(r)) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: '0.66rem', whiteSpace: 'nowrap' }}>{formatDate(r.dueDate)}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {r.paymentDest ? (
                        <span className={`badge ${r.paymentDest === 'ENTITY' ? 'primary' : 'teal'}`} style={{ fontSize: '0.52rem' }}>
                          {r.paymentDest === 'ENTITY' ? 'جهة التعليم' : 'لدينا'}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.64rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span className={`badge ${st.cls}`} style={{ fontSize: '0.56rem', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>عرض</span>
              <select className="glass-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '4px 8px', fontSize: '0.7rem', width: 'auto' }}>
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

      {/* ═══════════════ DETAIL DRAWER ═══════════════ */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={closeDetail} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: 'min(520px, 100vw)',
            background: 'var(--modal-bg)', backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.35)',
            borderLeft: '1px solid var(--glass-border)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0,
            }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={14} /></span>
                تفاصيل القسط
                {detail && <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)' }}>#{detail.id}</span>}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="glass-btn icon-btn sm" onClick={() => { loadList(); loadStats(); refreshDetail(); }} title="تحديث"><RefreshCw size={15} /></button>
                <button className="modal-close" onClick={closeDetail}><X size={18} /></button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {detailLoading && !detail ? (
                <div>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ height: 42, borderRadius: 10, marginBottom: 10, background: 'var(--glass-border)', opacity: 0.3, animation: 'pulse 1.2s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : detail && (
                <>
                  {/* Student card */}
                  <div style={{
                    padding: '14px 16px', marginBottom: 14, borderRadius: 12,
                    background: 'var(--primary-light)', border: '1px solid var(--primary)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.05rem', flexShrink: 0 }}>
                      {(detail.student?.fullNameAr || '؟').charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{detail.student?.fullNameAr || '—'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
                        #{detail.studentId}{detail.student?.phones ? ` • ${getPhone(detail.student.phones)}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="glass-btn icon-btn sm" title="ملف الطالب" onClick={() => navigate(`/student-profile?studentId=${detail.studentId}`)}><ExternalLink size={14} /></button>
                      <button className="glass-btn icon-btn sm" title="التسجيل / اشتراك جديد" onClick={() => navigate(`/subscriptions?studentId=${detail.studentId}`)}><Plus size={14} /></button>
                    </div>
                  </div>

                  {/* Installment summary */}
                  <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', fontSize: '0.8rem' }}>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>المبلغ</div><div style={{ fontWeight: 700, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(detail.amount)}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>المدفوع</div><div style={{ fontWeight: 600, color: 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(detail.paidAmount)}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>المتبقي</div><div style={{ fontWeight: 600, color: 'var(--danger)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(remOf(detail))}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>الاستحقاق</div><div style={{ fontWeight: 600 }}>{formatDate(detail.dueDate)}</div></div>
                      {detail.entityName && <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>جهة التعليم</div><div style={{ fontWeight: 600 }}>{detail.entityName}</div></div>}
                      {detail.paymentDest && <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>جهة الدفع</div><div style={{ fontWeight: 600 }}>{detail.paymentDest === 'ENTITY' ? 'جهة التعليم' : 'لدينا'}</div></div>}
                      {detail.paymentDate && <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>تاريخ الدفع</div><div style={{ fontWeight: 600 }}>{formatDate(detail.paymentDate)}</div></div>}
                      {detail.paymentMethod && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>طريقة الدفع</div>
                          <div style={{ fontWeight: 600 }}>
                            {PML[detail.paymentMethod] || detail.paymentMethod}
                            {detail.paymentMethod === 'WALLET' && detail.paymentWallet && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> ({WL[detail.paymentWallet] || detail.paymentWallet})</span>}
                            {detail.paymentMethod === 'CLICK' && detail.paymentBank && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> ({BL[detail.paymentBank] || detail.paymentBank}{detail.senderInfo ? ` — ${detail.senderInfo}` : ''})</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subscription balance + progress */}
                  {detail.subscriptionType !== 'EXTRA' && detail.subscription && (
                    <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <GraduationCap size={13} color="var(--secondary)" />
                          {detail.subscriptionType === 'DIPLOMA' ? 'اشتراك الدبلوم' : 'اشتراك الدورة'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{detail.subscription?.installmentsCount || 0} دفعة</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 90 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginBottom: 2, fontWeight: 500 }}>قيمة الاشتراك</div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(detail.subscription?.totalCost)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 90 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginBottom: 2, fontWeight: 500 }}>المدفوع</div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(subTotalPaid)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 90 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginBottom: 2, fontWeight: 500 }}>المتبقي</div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: subRemaining > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
                            {fmt(subRemaining)}
                          </div>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--glass-border)', overflow: 'hidden' }}>
                        <div style={{ width: `${subPaidPct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--success), var(--teal))', transition: 'width .4s ease' }} />
                      </div>
                      <div style={{ marginTop: 5, fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{subPaidPct}% مدفوع</span>
                        {subRemaining > 0 && <span>{subInsts.filter(i => remOf(i) > 0).length} قسط غير مدفوع</span>}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {canEdit && (
                      <button className="glass-btn" onClick={() => { const st = detail.student; if (st) openAdd(st); else openAdd({ id: detail.studentId, fullNameAr: 'طالب' }); }}
                        style={{ flex: 1, minWidth: 110, justifyContent: 'center', fontSize: '0.76rem', padding: '9px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', color: '#fff' }}>
                        <Plus size={14} /> إضافة قسط
                      </button>
                    )}
                    {canEdit && detail.subscriptionType !== 'EXTRA' && subRemaining > 0 && (
                      <button className="glass-btn" onClick={openSchedule}
                        style={{ flex: 1, minWidth: 110, justifyContent: 'center', fontSize: '0.76rem', padding: '9px', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Wallet size={13} color="var(--success)" /> تسديد الدفعة
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>المتبقي: <strong style={{ color: 'var(--danger)', fontFamily: 'monospace' }}>{fmt(remOf(detail))}</strong></span>
                      </div>

                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <label style={gl}>المبلغ (د.أ) <span style={rq}>*</span></label>
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
                              onClick={() => { setPayDest(opt.value as 'ENTITY' | 'US'); setPayMethod('CASH'); setPaySubMethod(''); setPayBank(''); setPayCheckNum(''); setPayHawalaNum(''); }}
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
                            <label style={gl}>رقم المرجع <span style={rq}>*</span></label>
                            <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="رقم الإيصال" style={{ fontSize: '0.82rem' }} />
                          </div>
                        </>) : (<>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label style={gl}>طريقة الدفع <span style={rq}>*</span></label>
                            <select className="glass-input" value={payMethod}
                              onChange={e => { setPayMethod(e.target.value); setPaySubMethod(''); setPayBank(''); setPayCheckNum(''); setPayHawalaNum(''); }}
                              style={{ fontSize: '0.82rem' }}>
                              <option value="CASH">💰 نقداً</option>
                              <option value="TRANSFER">📲 إلكتروني</option>
                              <option value="CHECK">📄 شيك</option>
                              <option value="MONEY_TRANSFER">🌍 حوالة مالية</option>
                            </select>
                          </div>

                          {payMethod === 'TRANSFER' && (<>
                            <div style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                              <div style={{ marginBottom: 6 }}>
                                <label style={{ ...gl, fontSize: '0.72rem' }}>نوع المحفظة الإلكترونية <span style={rq}>*</span></label>
                                <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.78rem', padding: '5px 8px' }}>
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
                              <div>
                                <label style={{ ...gl, fontSize: '0.72rem' }}>رقم الحوالة</label>
                                <input type="text" className="glass-input" value={payWalletRef} onChange={e => setPayWalletRef(e.target.value)}
                                  placeholder="اختياري — رقم العملية من المحفظة" style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr' }} />
                              </div>
                            </div>
                          </>)}

                          {payMethod === 'CHECK' && (<>
                            <div style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                              <div style={{ marginBottom: 6 }}>
                                <label style={{ ...gl, fontSize: '0.72rem' }}>البنك <span style={rq}>*</span></label>
                                <select className="glass-input" value={payBank} onChange={e => setPayBank(e.target.value)} style={{ fontSize: '0.78rem', padding: '5px 8px' }}>
                                  <option value="">— اختر البنك —</option>
                                  {Object.entries(BL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ ...gl, fontSize: '0.72rem' }}>رقم الشيك <span style={rq}>*</span></label>
                                <input type="text" className="glass-input" value={payCheckNum} onChange={e => setPayCheckNum(e.target.value)}
                                  placeholder="رقم الشيك" style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr' }} />
                              </div>
                            </div>
                          </>)}

                          {payMethod === 'MONEY_TRANSFER' && (<>
                            <div style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                              <div style={{ marginBottom: 6 }}>
                                <label style={{ ...gl, fontSize: '0.72rem' }}>نوع الحوالة المالية <span style={rq}>*</span></label>
                                <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.78rem', padding: '5px 8px' }}>
                                  <option value="">— اختر نوع الحوالة —</option>
                                  <option value="WESTERN_UNION">ويسترن يونيون (Western Union)</option>
                                  <option value="MONEYGRAM">MoneyGram</option>
                                  <option value="RIA_MONEY">RIA Money</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ ...gl, fontSize: '0.72rem' }}>رقم الحوالة <span style={rq}>*</span></label>
                                <input type="text" className="glass-input" value={payHawalaNum} onChange={e => setPayHawalaNum(e.target.value)}
                                  placeholder="رقم الحوالة المالية" style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr' }} />
                              </div>
                            </div>
                          </>)}

                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label style={gl}>رقم المرجع <span style={rq}>*</span></label>
                            <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)}
                              placeholder="إلزامي — رقم الإيصال أو التحويل" style={{ fontSize: '0.82rem' }} />
                          </div>
                        </>)}

                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label style={gl}>ملاحظات الدفع</label>
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
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Save size={13} color="var(--primary)" /> تعديل القسط
                      </span>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label style={{ ...gl, fontSize: '0.72rem' }}>المبلغ</label>
                          <input type="text" inputMode="decimal" className="glass-input" value={eAmt} onChange={e => setEAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.82rem' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label style={{ ...gl, fontSize: '0.72rem' }}>تاريخ الاستحقاق</label>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} color="var(--primary)" /> سجل الدفعات
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{(detail.transactions || []).length} معاملة</span>
                  </div>
                  {(detail.transactions || []).length === 0 ? (
                    <div style={{ padding: '24px 16px', background: 'var(--glass-bg)', borderRadius: 10, marginBottom: 10, textAlign: 'center' }}>
                      <FileText size={20} style={{ opacity: 0.25, margin: '0 auto 6px', display: 'block' }} />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>لا توجد دفعات سابقة لهذا القسط</div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', paddingRight: 22 }}>
                      <div style={{ position: 'absolute', right: 8, top: 4, bottom: 4, width: 2, background: 'var(--glass-border)', borderRadius: 2 }} />
                      {(detail.transactions || []).map(tx => (
                        <div key={tx.id} style={{ position: 'relative', paddingBottom: 12, paddingRight: 18 }}>
                          <div style={{ position: 'absolute', right: -14, top: 4, width: 11, height: 11, borderRadius: '50%', background: tx.status === 'COMPLETED' ? 'var(--success)' : 'var(--danger)', border: '2.5px solid var(--card-bg)', zIndex: 1, boxShadow: '0 0 0 2px var(--glass-border)' }} />
                          <div className="glass-panel" style={{ padding: '9px 12px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>
                                {tx.type === 'RECEIPT' ? 'دفعة' : tx.type === 'REFUND' ? 'مرتجع' : 'تعديل'}
                                <span className={`badge ${tx.status === 'COMPLETED' ? 'success' : 'secondary'}`} style={{ fontSize: '0.48rem', marginRight: 4, padding: '1px 6px' }}>{tx.status === 'COMPLETED' ? 'مكتمل' : 'ملغي'}</span>
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{formatDate(tx.date)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.68rem', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'monospace', direction: 'ltr' }}>{fmt(tx.amount)} د.أ</span>
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
        <div style={sx} onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div style={{ ...mbox, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#6366f1', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={13} /></span>
                إضافة قسط — {addStudent.fullNameAr}
              </h3>
              <button className="modal-close" onClick={() => setAddOpen(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: '16px 22px 18px' }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ ...gl, fontSize: '0.72rem', marginBottom: 6 }}>نوع القسط</label>
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
                  <label style={{ ...gl, fontSize: '0.72rem' }}>الاشتراك</label>
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
                  <label style={gl}>المبلغ (د.أ)</label>
                  <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={aAmt} onChange={e => setAAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.78rem', padding: '9px 12px' }} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label style={gl}>تاريخ الاستحقاق</label>
                  <DateField value={aDue} onChange={v => setADue(v)} selectStyle={{ padding: '9px 12px', fontSize: '0.78rem' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <textarea className="glass-input" rows={2} placeholder={aCategory === 'SUBSCRIPTION' ? 'ملاحظات (اختياري)' : 'بيان (اختياري)'} value={aNotes} onChange={e => setANotes(e.target.value)} style={{ fontSize: '0.78rem', padding: '9px 12px' }} />
              </div>
            </div>

            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8, background: 'var(--card-bg)', borderRadius: '0 0 22px 22px' }}>
              {canEdit && (
                <button className="glass-btn" onClick={async () => { const ok = await handleAdd(); if (ok) setAddOpen(false); }} disabled={saving}
                  style={{
                    flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '11px',
                    background: aCategory !== 'SUBSCRIPTION' ? 'var(--warning)' : 'var(--primary)',
                    borderColor: aCategory !== 'SUBSCRIPTION' ? 'var(--warning)' : 'var(--primary)',
                    color: '#fff',
                  }}>
                  <Plus size={14} /> {saving ? 'جارٍ...' : `إضافة ${CAT_MAP[aCategory]?.label || 'قسط'}`}
                </button>
              )}
              <button className="glass-btn secondary" onClick={() => setAddOpen(false)} style={{ fontSize: '0.8rem', padding: '11px 18px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SCHEDULE MODAL ═══════════════ */}
      {showSchedule && (
        <div style={sx} onClick={e => { if (e.target === e.currentTarget) setShowSchedule(false); }}>
          <div style={{ ...mbox, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={13} /></span>
                جدولة الأقساط
              </h3>
              <button className="modal-close" onClick={() => setShowSchedule(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: '14px 22px', background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>إجمالي المبلغ</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', direction: 'ltr' }}>{fmt(scheduleTotal)} د.أ</div>
                  </div>
                  <div style={{ width: 1, height: 32, background: 'var(--glass-border)' }} />
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>عدد الدفعات</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="glass-btn icon-btn xs" onClick={() => {
                        const cnt = Math.max(scheduleMin, scheduleCount - 1);
                        setScheduleCount(cnt);
                        setScheduleData(distributeSchedule(cnt, scheduleTotal, scheduleData) ?? []);
                      }} style={{ width: 26, height: 26, borderRadius: 6, fontSize: '1rem', lineHeight: 1, padding: 0, fontWeight: 700 }}>−</button>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{scheduleCount}</span>
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
                  fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace',
                }}>
                  {scheduleData.reduce((s, d) => s + d.amount, 0).toFixed(2)} / {fmt(scheduleTotal)}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 22px', maxHeight: 420, overflowY: 'auto' }}>
              {scheduleData.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Calendar size={22} style={{ opacity: 0.25, margin: '0 auto 6px', display: 'block' }} />
                  <div style={{ fontSize: '0.82rem' }}>لا توجد أقساط للجدولة</div>
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
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
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

            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8, background: 'var(--card-bg)', borderRadius: '0 0 22px 22px' }}>
              {canEdit && (
                <button className="glass-btn" onClick={handleScheduleSave} disabled={saving || scheduleData.length === 0}
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '11px', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
                  <Save size={15} /> {saving ? 'جارٍ الحفظ...' : 'حفظ جدولة الأقساط'}
                </button>
              )}
              <button className="glass-btn secondary" onClick={() => setShowSchedule(false)} style={{ fontSize: '0.82rem', padding: '11px 18px' }}>
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
        onSelectStudent={(s: any) => { pickStudent(s); setIsDeep(false); }}
        initialFilters={{}}
      />
    </div>
  );
};