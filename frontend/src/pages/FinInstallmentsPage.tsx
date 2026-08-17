import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, CreditCard, Plus, X, RefreshCw,
  Clock, FileText, Trash2, Save, Printer,
  Calendar, AlertTriangle, Award, Minus,
  ChevronLeft, ChevronRight, Undo2, ExternalLink, Wallet, Banknote, GraduationCap, BookOpen, CheckCircle2
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { DateField } from '../components/DateField';
import { formatDate } from '../utils/dateFormat';
import { printHeaderHTML } from '../utils/print';
import { toNumber } from '../utils/arabicNumbers';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface Sub { id: number | string; studentId: string; baseFee: number; totalCost: number; paymentType: string; installmentsCount: number; date: string; status: string; notes?: string; diploma?: { id: string; name: string }; course?: { id: string; name: string }; entity?: { id: number; name: string }; }
interface Inst { id: number; studentId: string; subscriptionId: string; subscriptionType: string; installmentNumber: number; totalInstallments: number; dueDate: string; amount: number; paidAmount: number; remainingAmount: number; status: string; paymentDate?: string; paymentMethod?: string; referenceNumber?: string; notes?: string; paymentWallet?: string; paymentBank?: string; senderInfo?: string; paymentDest?: string; programName?: string | null; entityName?: string | null; student?: { id: string; fullNameAr: string; fullNameEn?: string; phones?: any }; subscription?: { id: number; totalCost: number; status: string; installmentsCount: number } | null; transactions?: any[]; remaining?: number; }
interface Student { id: string; fullNameAr: string; fullNameEn?: string; phones?: any }

const ST: Record<string, { label: string; cls: string }> = { PENDING: { label: 'بانتظار', cls: 'warning' }, PAID: { label: 'مكتمل', cls: 'success' }, PARTIAL: { label: 'دفع جزئي', cls: 'teal' }, OVERDUE: { label: 'متأخر', cls: 'danger' }, REFUNDED: { label: 'مسترجع', cls: 'secondary' } };
const SUB_ST: Record<string, { label: string; cls: string }> = { ACTIVE: { label: 'نشط', cls: 'success' }, GRADUATED: { label: 'متخرج', cls: 'primary' }, WITHDRAWN: { label: 'منسحب', cls: 'warning' }, CANCELED: { label: 'ملغي', cls: 'danger' } };
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
const fmt = (n: number | undefined | null) => (n || 0).toFixed(2);

// جهة الدفع with actual names: "لدينا — <center>" / "جهة التعليم — <entity>"
const destText = (d: any, centerName?: string) => {
  if (!d?.paymentDest) return null;
  return d.paymentDest === 'ENTITY'
    ? (d.entityName ? `جهة التعليم — ${d.entityName}` : 'جهة التعليم')
    : `لدينا — ${centerName || 'المركز'}`;
};

const sx = { position: 'fixed' as const, inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 20 };
const mbox: React.CSSProperties = { background: 'var(--modal-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', borderRadius: 22, border: '1px solid var(--glass-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)', direction: 'rtl' };
const gl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 };
const rq: React.CSSProperties = { color: 'var(--danger)', marginRight: 2 };

export const FinInstallmentsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission, centerName, centerNameEn, centerLogo } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canEdit = hasPermission('finance.installments');
  const canPay = hasPermission('finance.receipts');
  const canRefund = hasPermission('finance.payments');

  /* ── Student selection ── */
  const [fStudentName, setFStudentName] = useState('');
  const [stuResults, setStuResults] = useState<any[]>([]);
  const [showStuDrop, setShowStuDrop] = useState(false);
  const stuRef = useRef<HTMLDivElement>(null);
  const [student, setStudent] = useState<any>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  /* ── Subscriptions + installments (workspace) ── */
  const [subs, setSubs] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [selSub, setSelSub] = useState<any>(null);
  const [subInstalls, setSubInstalls] = useState<Inst[]>([]);
  const [subInstLoading, setSubInstLoading] = useState(false);
  const [allInstalls, setAllInstalls] = useState<Inst[]>([]);

  /* ── Right-panel installment detail (replaces the old drawer) ── */
  const [selInstId, setSelInstId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Inst | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);

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

  /* ── Reschedule panel (fixed on the right) ── */
  const [scheduleCount, setScheduleCount] = useState(0);
  const [scheduleMin, setScheduleMin] = useState(1);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [scheduleData, setScheduleData] = useState<{ id: number | null; amount: number; dueDate: string }[]>([]);

  const [isDeep, setIsDeep] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Close student dropdown on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => { if (stuRef.current && !stuRef.current.contains(e.target as Node)) setShowStuDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Rescheduling distribution (same logic as SubscriptionPage plan) ── */
  const distributeSchedule = useCallback((count: number, total: number, baseData: { id: number | null; amount: number; dueDate: string }[], unpaid: Inst[]) => {
    if (count < 1) return [];
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
  }, []);

  /* ── Load a student + all their subscriptions + all installments ── */
  const loadStudentSubs = useCallback(async (sid: string): Promise<any[]> => {
    setStudentLoading(true);
    setSubsLoading(true);
    try {
      const [stu, d, c, insts] = await Promise.all([
        apiFetch(`/students/${sid}`),
        apiFetch(`/subscriptions/diploma?studentId=${sid}`).catch(() => []),
        apiFetch(`/subscriptions/course?studentId=${sid}`).catch(() => []),
        apiFetch(`/installments?studentId=${sid}`).catch(() => [])
      ]);
      setStudent(stu || null);
      setFStudentName(stu?.fullNameAr || '');
      const merged = [
        ...(Array.isArray(d) ? d : []).map((s: any) => ({ ...s, _type: 'DIPLOMA', _name: s.diploma?.name || `دبلوم #${s.id}`, _progId: s.diplomaId })),
        ...(Array.isArray(c) ? c : []).map((s: any) => ({ ...s, _type: 'COURSE', _name: s.course?.name || `دورة #${s.id}`, _progId: s.courseId }))
      ];
      setSubs(merged);
      setAllInstalls(Array.isArray(insts) ? insts : insts?.data || []);
      return merged;
    } catch (err: any) { toast.error('فشل تحميل بيانات الطالب', err.message); return []; }
    finally { setStudentLoading(false); setSubsLoading(false); }
  }, [apiFetch, toast]);

  /* ── Select a subscription → load its installments + init schedule ── */
  const selectSub = useCallback(async (sub: any) => {
    setSelSub(sub);
    setSubInstLoading(true);
    try {
      const r = await apiFetch(`/installments?subscriptionId=${String(sub.id)}&subscriptionType=${sub._type}`);
      const list: Inst[] = Array.isArray(r) ? r : [];
      setSubInstalls(list);
      const totalPaid = list.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const total = Math.max(0, (sub.totalCost || 0) - totalPaid);
      if (total <= 0) {
        setScheduleTotal(0); setScheduleCount(0); setScheduleData([]);
      } else {
        const unpaid = list.filter(i => remOf(i) > 0);
        const cnt = Math.max(unpaid.length, 1);
        const baseData = unpaid.length > 0 ? unpaid.map(i => ({ id: i.id, amount: i.amount, dueDate: i.dueDate.split('T')[0] })) : [];
        setScheduleTotal(total);
        setScheduleMin(Math.max(1, unpaid.filter(i => i.paidAmount > 0).length));
        setScheduleData(distributeSchedule(cnt, total, baseData, unpaid) ?? []);
        setScheduleCount(cnt);
      }
    } catch (err: any) { toast.error('فشل تحميل أقساط الاشتراك', err.message); }
    finally { setSubInstLoading(false); }
  }, [apiFetch, distributeSchedule, toast]);

  const pickStudent = useCallback(async (s: any) => {
    setShowStuDrop(false);
    setSelSub(null); setSubInstalls([]); setScheduleData([]); setAllInstalls([]);
    setSelInstId(null); setDetail(null); resetPay();
    await loadStudentSubs(s.id);
  }, [loadStudentSubs]);

  const clearStudent = () => {
    setStudent(null); setSubs([]); setSelSub(null); setSubInstalls([]); setAllInstalls([]);
    setScheduleData([]); setScheduleCount(0); setScheduleTotal(0);
    setSelInstId(null); setDetail(null); resetPay();
  };

  const resetSearch = () => { clearStudent(); setFStudentName(''); setStuResults([]); setShowStuDrop(false); };

  /* ── Quick access via ?studentId= ── */
  useEffect(() => {
    const sid = searchParams.get('studentId');
    if (sid) pickStudent({ id: sid });
  }, [searchParams, pickStudent]);

  /* Refresh workspace (subs + selected sub installments) after mutations */
  const refreshWorkspace = useCallback(async () => {
    if (!student) return;
    const merged = await loadStudentSubs(String(student.id));
    const target = selSub;
    const fresh = merged.find(s => String(s.id) === String(target?.id) && s._type === target?._type);
    if (fresh) await selectSub(fresh);
  }, [student, selSub, loadStudentSubs, selectSub]);

  /* ── Student search ── */
  const searchStudents = useCallback(async (q: string) => {
    if (!q.trim()) { setStuResults([]); return; }
    try {
      const r = await apiFetch(`/students?query=${encodeURIComponent(q)}&limit=8`);
      setStuResults(Array.isArray(r) ? r : r?.data || []);
      setShowStuDrop(true);
    } catch { setStuResults([]); }
  }, [apiFetch]);

  /* ── Right-panel installment detail ── */
  const refreshDetail = useCallback(async () => {
    if (!selInstId) return;
    setDetailLoading(true);
    try {
      const d = await apiFetch(`/installments/${selInstId}`);
      setDetail(d || null);
    } catch (err: any) { toast.error('فشل تحديث التفاصيل', err.message); }
    finally { setDetailLoading(false); }
  }, [selInstId, apiFetch, toast]);

  const openPanel = useCallback(async (id: number) => {
    setSelInstId(id);
    resetPay();
    setEditOpen(false);
    setDetailLoading(true);
    try {
      const d = await apiFetch(`/installments/${id}`);
      setDetail(d || null);
      if (d && d.status !== 'PAID') {
        setPayAmount(String(Math.max(0, (d.amount || 0) - (d.paidAmount || 0))));
      }
    } catch (err: any) { toast.error('فشل تحميل تفاصيل القسط', err.message); }
    finally { setDetailLoading(false); }
  }, [apiFetch, toast]);

  const backToSchedule = () => { setSelInstId(null); setDetail(null); setEditOpen(false); resetPay(); };

  const resetPay = () => {
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

  /* ── Derived (right-panel detail) ── */
  const isU = !!detail && (detail.status === 'PENDING' || detail.status === 'PARTIAL' || detail.status === 'OVERDUE' || detail.status === 'REFUNDED');
  const isRefundable = !!detail && (detail.paidAmount || 0) > 0 && detail.status !== 'REFUNDED';
  const subTotalPaid = subInstalls.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const subRemaining = Math.max(0, (detail?.subscription?.totalCost || 0) - subTotalPaid);
  const subPaidPct = (detail?.subscription?.totalCost || 0) > 0
    ? Math.min(100, Math.round((subTotalPaid / (detail?.subscription?.totalCost || 1)) * 100))
    : 0;

  /* ── Derived (workspace selected subscription) ── */
  const wsTotalPaid = subInstalls.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const wsRemaining = Math.max(0, (selSub?.totalCost || 0) - wsTotalPaid);
  const wsPaidPct = (selSub?.totalCost || 0) > 0
    ? Math.min(100, Math.round((wsTotalPaid / (selSub?.totalCost || 1)) * 100))
    : 0;

  /* ── Derived (student-level aggregates across all subscriptions) ── */
  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = useCallback((i: Inst) =>
    i.status === 'OVERDUE' || (i.status === 'PENDING' && (i.dueDate?.split('T')[0] || '') < todayStr), [todayStr]);
  const stStats = useMemo(() => {
    const base = { totalCount: 0, totalAmount: 0, paid: 0, remaining: 0, paidCount: 0, overdueCount: 0, overdueAmount: 0 };
    if (!student) return base;
    for (const i of allInstalls) {
      const amt = i.amount || 0;
      const paid = i.paidAmount || 0;
      base.totalCount += 1;
      base.totalAmount += amt;
      base.paid += paid;
      base.remaining += Math.max(0, amt - paid);
      if (paid > 0) base.paidCount += 1;
      if (isOverdue(i)) { base.overdueCount += 1; base.overdueAmount += Math.max(0, amt - paid); }
    }
    return base;
  }, [student, allInstalls, isOverdue]);
  const stPaidPct = stStats.totalAmount > 0 ? Math.min(100, Math.round((stStats.paid / stStats.totalAmount) * 100)) : 0;

  /* ── Per-subscription aggregates (live status without opening the sub) ── */
  const subAgg = useMemo(() => {
    const m: Record<string, { count: number; total: number; paid: number; remaining: number; overdue: number }> = {};
    for (const i of allInstalls) {
      const k = `${i.subscriptionType}:${i.subscriptionId}`;
      const e = m[k] || (m[k] = { count: 0, total: 0, paid: 0, remaining: 0, overdue: 0 });
      e.count += 1;
      e.total += i.amount || 0;
      e.paid += i.paidAmount || 0;
      e.remaining += remOf(i);
      if (isOverdue(i)) e.overdue += 1;
    }
    return m;
  }, [allInstalls, isOverdue]);

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
        const subType = (addSelSub as any).diploma ? 'DIPLOMA' : 'COURSE';
        const existing = await apiFetch(`/installments?subscriptionId=${String(addSelSub.id)}&subscriptionType=${subType}`);
        const existingTotal = (Array.isArray(existing) ? existing : []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
        const cap = (addSelSub.totalCost || 0);
        if (existingTotal + amt > cap + 0.001) {
          toast.error(`لا يمكن زيادة الأقساط عن قيمة الاشتراك: المجموع الحالي ${existingTotal.toFixed(2)} + ${amt.toFixed(2)} يتجاوز ${cap.toFixed(2)} د.أ`);
          return false;
        }
      } catch { /* allow server to reject if fetch fails */ }
    }
    const usedSubId = addSelSub ? String(addSelSub.id) : null;
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
      const merged = await loadStudentSubs(addStudent.id);
      if (usedSubId) {
        const fresh = merged.find(s => String(s.id) === usedSubId);
        if (fresh) await selectSub(fresh);
      }
      if (selInstId) refreshDetail();
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
      const subInsts_ = subInstalls.filter(i => String(i.subscriptionId) === String(detail.subscriptionId) && i.subscriptionType === detail.subscriptionType);
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
      setEditOpen(false);
      refreshDetail(); refreshWorkspace();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── Delete installment ── */
  const handleDelete = async () => {
    if (!detail) return;
    if (detail.subscriptionType && detail.subscriptionType !== 'EXTRA') {
      const cap = detail.subscription?.totalCost || 0;
      const subInsts_ = subInstalls.filter(i => String(i.subscriptionId) === String(detail.subscriptionId) && i.subscriptionType === detail.subscriptionType);
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
      setSelInstId(null); setDetail(null); setEditOpen(false);
      refreshWorkspace();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── Refund installment (استرجاع بسند صرف) ── */
  const handleRefund = async () => {
    if (!detail) return;
    if (!window.confirm(`استرجاع مبلغ (${fmt(detail.paidAmount)} د.أ) بسند صرف؟ سيتم إلغاء سندات القبض المرتبطة بالقسط وتسجيل سند صرف جديد.`)) return;
    setRefunding(true);
    try {
      await apiFetch(`/installments/${detail.id}/refund`, { method: 'POST' });
      toast.success('تم الاسترجاع بسند صرف');
      refreshDetail(); refreshWorkspace();
    } catch (err: any) { toast.error('فشل الاسترجاع', err.message); }
    finally { setRefunding(false); }
  };

  /* ── Payment (targets the selected installment via /installments/:id/pay) ── */
  const handlePay = async () => {
    if (!detail) return;
    const amt = toNumber(payAmount);
    if (!amt || amt <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (!payDest) { toast.error('اختر جهة الدفع (جهة التعليم أو لدينا)'); return; }
    const refVal = payRef.trim() || payWalletRef?.trim() || payCheckNum?.trim() || payHawalaNum?.trim();
    if (!refVal) { toast.error('رقم المرجع مطلوب'); return; }
    if (payDest === 'US') {
      if (payMethod === 'TRANSFER' && !paySubMethod) { toast.error('يرجى اختيار نوع المحفظة الإلكترونية'); return; }
      if (payMethod === 'CHECK') { if (!payBank) { toast.error('يرجى اختيار البنك'); return; } if (!payCheckNum.trim()) { toast.error('رقم الشيك مطلوب'); return; } }
      if (payMethod === 'MONEY_TRANSFER') { if (!paySubMethod) { toast.error('يرجى اختيار نوع الحوالة'); return; } if (!payHawalaNum.trim()) { toast.error('رقم الحوالة مطلوب'); return; } }
    }
    const balance = remOf(detail);
    if (balance > 0 && amt > balance) {
      toast.error(`المبلغ (${amt}) أكبر من المتبقي على هذا القسط (${balance.toFixed(2)})`);
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
        referenceNumber: refVal,
      };
      if (payMethod === 'TRANSFER') { body.paymentSubMethod = paySubMethod; if (payWalletRef) body.paymentWalletRef = payWalletRef; }
      if (payMethod === 'CHECK') { body.paymentBank = payBank; body.checkNumber = payCheckNum; }
      if (payMethod === 'MONEY_TRANSFER') { body.paymentSubMethod = paySubMethod; body.hawalaNumber = payHawalaNum; }
      if (payNotes) body.notes = payNotes;

      await apiFetch(`/installments/${detail.id}/pay`, { method: 'POST', body: JSON.stringify(body) });
      toast.success('تم تسجيل الدفعة');
      resetPay();
      refreshDetail(); refreshWorkspace();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setPayLoading(false); }
  };

  /* ── Reschedule save ── */
  const handleScheduleSave = async () => {
    if (!selSub) return;
    if (scheduleData.some(d => !d.amount || d.amount <= 0)) { toast.error('جميع مبالغ الأقساط يجب أن تكون أكبر من صفر'); return; }
    const sum = scheduleData.reduce((s, d) => s + d.amount, 0);
    if (Math.abs(sum - scheduleTotal) > 0.01) {
      toast.error(`مجموع الأقساط (${sum.toFixed(2)}) لا يساوي المبلغ المتبقي (${scheduleTotal.toFixed(2)})`);
      return;
    }
    const currentUnpaid = subInstalls.filter(i => remOf(i) > 0);
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
            studentId: selSub.studentId,
            subscriptionType: selSub._type,
            subscriptionId: String(selSub.id),
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
      await selectSub(selSub);
      if (selInstId) refreshDetail();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  /* ── From panel detail → open the fixed reschedule panel for the same subscription ── */
  const goReschedule = async () => {
    if (!detail || detail.subscriptionType === 'EXTRA') return;
    let merged = subs;
    if (!student || String(student.id) !== String(detail.studentId)) {
      merged = await loadStudentSubs(String(detail.studentId));
    }
    const sub = merged.find(s => String(s.id) === String(detail.subscriptionId) && s._type === detail.subscriptionType);
    if (sub) await selectSub(sub);
    backToSchedule();
  };

  /* ── Reschedule panel row actions ── */
  const unpaidOf = () => subInstalls.filter(i => remOf(i) > 0);
  const stepCount = (dir: 1 | -1) => {
    if (scheduleTotal <= 0) return;
    const cnt = Math.max(scheduleMin, scheduleCount + dir);
    setScheduleCount(cnt);
    setScheduleData(distributeSchedule(cnt, scheduleTotal, scheduleData, unpaidOf()) ?? []);
  };
  const addRow = () => {
    if (scheduleTotal <= 0) return;
    const cnt = scheduleCount + 1;
    setScheduleCount(cnt);
    setScheduleData(distributeSchedule(cnt, scheduleTotal, scheduleData, unpaidOf()) ?? []);
  };
  const removeRow = (idx: number) => {
    if (scheduleData.length <= scheduleMin) return;
    const cnt = scheduleData.length - 1;
    setScheduleCount(cnt);
    setScheduleData(distributeSchedule(cnt, scheduleTotal, scheduleData, unpaidOf()) ?? []);
  };
  const updateRow = (idx: number, patch: Partial<{ amount: number; dueDate: string }>) => {
    setScheduleData(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  /* ── Print voucher (receipt / expense) ── */
  const printReceipt = (tx: any, entityName?: string | null) => {
    const isPayment = tx.type === 'PAYMENT';
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${isPayment ? 'سند صرف' : 'سند قبض'} #${tx.receiptNumber}</title>
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
<button onclick="window.print()">🖨️ طباعة ${isPayment ? 'سند الصرف' : 'السند'}</button>
${printHeaderHTML({ name: centerName, nameEn: centerNameEn, logo: centerLogo })}
<h1>${isPayment ? 'سند صرف' : 'سند قبض'}</h1>
<div class="sub">${formatDate(new Date())}</div>
<div class="rc">
<div class="r"><span class="l">رقم السند</span><span class="v">${tx.receiptNumber}</span></div>
<div class="r"><span class="l">التاريخ</span><span class="v">${formatDate(tx.date)}</span></div>
${tx.student ? `<div class="r"><span class="l">الطالب</span><span class="v">${tx.student.fullNameAr} (${tx.student.id})</span></div>` : ''}
<div class="r"><span class="l">المبلغ</span><span class="v">${tx.amount.toFixed(2)} د.أ</span></div>
<div class="r"><span class="l">طريقة الدفع</span><span class="v">${PML[tx.paymentMethod] || tx.paymentMethod}</span></div>
${tx.paymentDest ? `<div class="r"><span class="l">جهة الدفع</span><span class="v">${tx.paymentDest === 'ENTITY' ? 'جهة التعليم — ' + (entityName || '') : 'لدينا — ' + (centerName || 'المركز')}</span></div>` : ''}
${tx.referenceNumber ? `<div class="r"><span class="l">رقم المرجع</span><span class="v">${tx.referenceNumber}</span></div>` : ''}
${tx.notes ? `<div class="r"><span class="l">ملاحظات</span><span class="v">${tx.notes}</span></div>` : ''}
<div class="tt">المبلغ: ${tx.amount.toFixed(2)} دينار أردني</div>
</div>
<div class="ft">شكراً لثقتكم — ${centerName || 'مركزنا التعليمي'}</div>
</body></html>`); w.document.close();
  };

  const typeBadge = (t: string) => t === 'DIPLOMA'
    ? <span className="badge primary" style={{ fontSize: '0.52rem' }}>دبلوم</span>
    : <span className="badge success" style={{ fontSize: '0.52rem' }}>دورة</span>;

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="fade-in" style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(1rem, 3vw, 1.3rem)' }}>
            <CreditCard size={22} color="var(--primary)" /> إدارة الأقساط
          </h2>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {student ? `${student.fullNameAr} — ${subs.length} ${subs.length === 1 ? 'اشتراك' : 'اشتراكات'}` : 'لوحة عمل — اختر طالباً للبدء'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="glass-btn secondary" onClick={() => { if (student) { loadStudentSubs(String(student.id)); if (selSub) selectSub(selSub); } }} disabled={studentLoading || subsLoading}
            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} className={studentLoading || subsLoading ? 'spin' : ''} /> تحديث
          </button>
          <button className="glass-btn secondary" onClick={() => setIsDeep(true)} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={15} /> بحث عميق
          </button>
        </div>
      </div>

      {/* ── Student search bar ── */}
      <div ref={stuRef} style={{ position: 'relative' }}>
        <div className="glass-panel" style={{ padding: '14px 16px', border: '1px solid var(--glass-border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="glass-input"
              placeholder="ابحث عن طالب بالاسم، رقم النظام، أو الهاتف — ثم اختر اشتراكاً من الجدول"
              value={fStudentName}
              onChange={e => {
                const v = e.target.value;
                clearStudent();
                setFStudentName(v);
                searchStudents(v);
              }}
              onFocus={() => { if (stuResults.length > 0) setShowStuDrop(true); }}
              style={{ paddingRight: 36, paddingLeft: student ? 150 : 8, fontSize: '0.88rem' }}
            />
            {student && (
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap', maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 1 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0 }}>
                  {(student.fullNameAr || '؟').charAt(0)}
                </span>
                {student.fullNameAr}
                <X size={12} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={resetSearch} />
              </span>
            )}
          </div>
        </div>

        {showStuDrop && stuResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 120, background: 'var(--card-bg)', borderRadius: 12, marginTop: 4, border: '1px solid var(--glass-border)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', maxHeight: 260, overflowY: 'auto' }}>
            {stuResults.map((s: any) => (
              <div key={s.id} onClick={() => pickStudent(s)}
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>{s.fullNameAr?.charAt(0)}</div>
                  <span style={{ fontWeight: 500 }}>{s.fullNameAr}</span>
                  {s.phones && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace', direction: 'ltr' }}>0{getPhone(s.phones)}</span>}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'monospace' }}>#{s.id}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Student financial summary (live aggregates) ── */}
      {student && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
          {[
            { cls: 'blue', ico: <CreditCard size={17} />, c: '#6366f1', label: 'إجمالي الأقساط', val: studentLoading ? '…' : fmt(stStats.totalAmount), sub: `${stStats.totalCount} قسط` },
            { cls: 'green', ico: <CheckCircle2 size={17} />, c: '#10b981', label: 'المدفوع', val: studentLoading ? '…' : fmt(stStats.paid), sub: `${stPaidPct}% من القيمة` },
            { cls: 'amber', ico: <Clock size={17} />, c: '#f59e0b', label: 'المتبقي', val: studentLoading ? '…' : fmt(stStats.remaining), sub: `${stStats.totalCount - stStats.paidCount} قسط غير مسدد` },
            { cls: '', ico: <AlertTriangle size={17} />, c: '#ef4444', label: 'أقساط متأخرة', val: studentLoading ? '…' : fmt(stStats.overdueAmount), sub: `${stStats.overdueCount} قسط متأخر` },
          ].map((s, i) => (
            <div key={i} className={`stat-card ${s.cls}`} style={{ padding: '12px 14px', border: '1px solid var(--glass-border)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, borderRadius: '50%', background: `${s.c}08`, pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c, flexShrink: 0 }}>{s.ico}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.15, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{s.val}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {student ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ═════════════ RIGHT: WORKSPACE PANEL (reschedule OR installment detail) ═════════════ */}
          <aside style={{ flex: selInstId ? '0 0 400px' : '0 0 340px', minWidth: 300, position: 'sticky', top: 14, order: 1 }}>
            <div className="glass-panel" style={{ overflow: 'hidden', border: '1px solid var(--glass-border)', borderRadius: 14 }}>
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--glass-border)',
                background: 'linear-gradient(135deg, var(--primary-light), transparent)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selInstId ? <CreditCard size={16} /> : <Calendar size={16} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{selInstId ? 'تفاصيل الدفعة' : 'إعادة جدولة الأقساط'}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                    {selInstId ? 'لوحة ثابتة — تفاصيل الدفعة المحددة' : 'لوحة مثبتة — الخيارات ثابتة أثناء التمرير'}
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 16px' }}>
                {selInstId ? (
                  <div>
                    <button className="glass-btn secondary sm" onClick={backToSchedule} style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem', marginBottom: 10, borderStyle: 'dashed' }}>
                      <ChevronRight size={14} /> الرجوع إلى لوحة الجدولة
                    </button>

                    {detailLoading && !detail ? (
                      <div>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{ height: 44, borderRadius: 10, marginBottom: 10, background: 'var(--glass-border)', opacity: 0.3, animation: 'pulse 1.2s ease-in-out infinite' }} />
                        ))}
                      </div>
                    ) : detail ? (
                      <>
                        {/* Refunded banner */}
                        {detail.status === 'REFUNDED' && (
                          <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.7rem', color: 'var(--warning)', display: 'flex', gap: 6, marginBottom: 10, alignItems: 'flex-start' }}>
                            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> تم استرجاع هذا القسط بسند صرف — المبلغ مسترد للطالب
                          </div>
                        )}

                        {/* Detail header */}
                        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                              قسط #{detail.installmentNumber}/{detail.totalInstallments}
                              {(() => {
                                const cat = catLabel(detail);
                                return cat
                                  ? <span className={`badge ${cat.cls}`} style={{ fontSize: '0.48rem', marginRight: 5 }}>{cat.label}</span>
                                  : null;
                              })()}
                            </span>
                            <span className={`badge ${ST[detail.status]?.cls || 'secondary'}`} style={{ fontSize: '0.55rem' }}>{ST[detail.status]?.label || detail.status}</span>
                          </div>
                          {detail.programName && (
                            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              {detail.subscriptionType === 'DIPLOMA' ? <GraduationCap size={11} /> : <BookOpen size={11} />}
                              {detail.programName}{detail.entityName ? ` — ${detail.entityName}` : ''}
                            </div>
                          )}
                          {detail.paymentDest && (
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              جهة الدفع: <strong style={{ color: detail.paymentDest === 'ENTITY' ? 'var(--primary)' : 'var(--success)' }}>{destText(detail, centerName)}</strong>
                            </div>
                          )}
                        </div>

                        {/* Summary grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px', fontSize: '0.74rem', padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', marginBottom: 10 }}>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>المبلغ</div><div style={{ fontWeight: 700, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(detail.amount)}</div></div>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>المدفوع</div><div style={{ fontWeight: 600, color: 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(detail.paidAmount)}</div></div>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>المتبقي</div><div style={{ fontWeight: 600, color: remOf(detail) > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(remOf(detail))}</div></div>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>الاستحقاق</div><div style={{ fontWeight: 600 }}>{formatDate(detail.dueDate)}</div></div>
                          {detail.paymentDate && <div><div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>تاريخ الدفع</div><div style={{ fontWeight: 600 }}>{formatDate(detail.paymentDate)}</div></div>}
                          {detail.paymentMethod && detail.status !== 'PENDING' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>طريقة الدفع</div>
                              <div style={{ fontWeight: 600 }}>
                                {PML[detail.paymentMethod] || detail.paymentMethod}
                                {detail.paymentMethod === 'WALLET' && detail.paymentWallet && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> ({WL[detail.paymentWallet] || detail.paymentWallet})</span>}
                                {detail.paymentMethod === 'CLICK' && detail.paymentBank && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> ({BL[detail.paymentBank] || detail.paymentBank}{detail.senderInfo ? ` — ${detail.senderInfo}` : ''})</span>
                                )}
                              </div>
                            </div>
                          )}
                          {detail.notes && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 2, fontWeight: 500 }}>ملاحظات</div>
                              <div style={{ fontWeight: 500, fontSize: '0.7rem', whiteSpace: 'pre-line' }}>{detail.notes}</div>
                            </div>
                          )}
                        </div>

                        {/* Subscription progress */}
                        {detail.subscriptionType !== 'EXTRA' && detail.subscription && (
                          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <GraduationCap size={12} color="var(--secondary)" />
                                {detail.subscriptionType === 'DIPLOMA' ? 'اشتراك الدبلوم' : 'اشتراك الدورة'}
                              </span>
                              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{detail.subscription?.installmentsCount || 0} دفعة</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                              <div style={{ flex: 1 }}><div style={{ color: 'var(--text-muted)', fontSize: '0.56rem' }}>القيمة</div><div style={{ fontWeight: 700, fontSize: '0.74rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(detail.subscription?.totalCost)}</div></div>
                              <div style={{ flex: 1 }}><div style={{ color: 'var(--text-muted)', fontSize: '0.56rem' }}>المدفوع</div><div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(subTotalPaid)}</div></div>
                              <div style={{ flex: 1 }}><div style={{ color: 'var(--text-muted)', fontSize: '0.56rem' }}>المتبقي</div><div style={{ fontWeight: 700, fontSize: '0.74rem', color: subRemaining > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(subRemaining)}</div></div>
                            </div>
                            <div style={{ height: 5, borderRadius: 3, background: 'var(--glass-border)', overflow: 'hidden' }}>
                              <div style={{ width: `${subPaidPct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--success), var(--teal))', transition: 'width .4s ease' }} />
                            </div>
                            <div style={{ marginTop: 4, fontSize: '0.6rem', color: 'var(--text-muted)' }}>{subPaidPct}% مدفوع • {subInstalls.filter(i => remOf(i) > 0).length} قسط غير مدفوع</div>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {canEdit && (
                            <button className="glass-btn sm" onClick={() => { const st = detail.student; if (st) openAdd(st); else openAdd({ id: detail.studentId, fullNameAr: 'طالب' }); }}
                              style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: '0.7rem', padding: '7px 10px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', color: '#fff' }}>
                              <Plus size={13} /> إضافة قسط
                            </button>
                          )}
                          {canEdit && detail.subscriptionType !== 'EXTRA' && subRemaining > 0 && (
                            <button className="glass-btn sm" onClick={goReschedule}
                              style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: '0.7rem', padding: '7px 10px', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
                              <Calendar size={13} /> الجدولة
                            </button>
                          )}
                          {canRefund && isRefundable && (
                            <button className="glass-btn sm danger" onClick={handleRefund} disabled={refunding}
                              style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: '0.7rem', padding: '7px 10px' }}>
                              <Undo2 size={13} /> {refunding ? 'جارٍ الاسترجاع...' : 'استرجاع بسند صرف'}
                            </button>
                          )}
                          {canEdit && (
                            <button className="glass-btn secondary sm" onClick={() => { if (!editOpen) { setEAmt(String(detail.amount)); setEDue(detail.dueDate.split('T')[0]); setENotes(detail.notes || ''); } setEditOpen(v => !v); }}
                              style={{ fontSize: '0.7rem', padding: '7px 10px' }}>
                              <Save size={12} /> تعديل
                            </button>
                          )}
                          {canEdit && detail.status !== 'PAID' && (
                            <button className="glass-btn secondary sm" onClick={handleDelete} disabled={saving}
                              style={{ fontSize: '0.7rem', padding: '7px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                              <Trash2 size={12} /> حذف
                            </button>
                          )}
                        </div>

                        {/* Payment form (unpaid / partially paid / refunded → re-pay) */}
                        {isU && canPay && (
                          <div style={{ padding: '12px 13px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Wallet size={13} color="var(--success)" /> تسديد الدفعة
                              </span>
                              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>المتبقي: <strong style={{ color: 'var(--danger)', fontFamily: 'monospace' }}>{fmt(remOf(detail))}</strong></span>
                            </div>

                            <div className="form-group" style={{ marginBottom: 9 }}>
                              <label style={gl}>المبلغ (د.أ) <span style={rq}>*</span></label>
                              <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={payAmount}
                                onChange={e => setPayAmount(e.target.value)} style={{ direction: 'ltr', fontSize: '0.8rem', fontWeight: 600 }} />
                            </div>

                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              {[
                                { value: 'ENTITY', label: '🏫 جهة التعليم' },
                                { value: 'US', label: '🏢 لدينا' },
                              ].map(opt => (
                                <button key={opt.value} type="button"
                                  onClick={() => { setPayDest(opt.value as 'ENTITY' | 'US'); setPayMethod('CASH'); setPaySubMethod(''); setPayBank(''); setPayCheckNum(''); setPayHawalaNum(''); }}
                                  style={{
                                    flex: 1, padding: '8px 10px', borderRadius: 9, border: '1.5px solid', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.74rem', transition: 'all .2s',
                                    background: payDest === opt.value ? 'var(--primary)' : 'transparent',
                                    color: payDest === opt.value ? '#fff' : 'var(--text)',
                                    borderColor: payDest === opt.value ? 'var(--primary)' : (!payDest ? 'var(--danger)' : 'var(--glass-border)'),
                                  }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {!payDest && (
                              <div style={{ fontSize: '0.66rem', color: 'var(--danger)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={11} /> مطلوب — اختر جهة الدفع
                              </div>
                            )}
                            {payDest && (
                              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 7, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                <CheckCircle2 size={11} color="var(--success)" />
                                سيتم تسجيل الدفعة على: <strong style={{ color: 'var(--text-primary)' }}>{payDest === 'ENTITY' ? (detail.entityName ? `جهة التعليم — ${detail.entityName}` : 'جهة التعليم') : `لدينا — ${centerName || 'المركز'}`}</strong>
                              </div>
                            )}

                            {payDest === 'ENTITY' ? (<>
                              <div className="form-group" style={{ marginBottom: 8 }}>
                                <label style={gl}>رقم المرجع <span style={rq}>*</span></label>
                                <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="رقم الإيصال" style={{ fontSize: '0.8rem' }} />
                              </div>
                            </>) : (<>
                              <div className="form-group" style={{ marginBottom: 8 }}>
                                <label style={gl}>طريقة الدفع <span style={rq}>*</span></label>
                                <select className="glass-input" value={payMethod}
                                  onChange={e => { setPayMethod(e.target.value); setPaySubMethod(''); setPayBank(''); setPayCheckNum(''); setPayHawalaNum(''); }}
                                  style={{ fontSize: '0.8rem' }}>
                                  <option value="CASH">💰 نقداً</option>
                                  <option value="TRANSFER">📲 إلكتروني</option>
                                  <option value="CHECK">📄 شيك</option>
                                  <option value="MONEY_TRANSFER">🌍 حوالة مالية</option>
                                </select>
                              </div>

                              {payMethod === 'TRANSFER' && (<>
                                <div style={{ marginBottom: 8, padding: '9px 11px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ ...gl, fontSize: '0.7rem' }}>نوع المحفظة الإلكترونية <span style={rq}>*</span></label>
                                    <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.74rem', padding: '5px 8px' }}>
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
                                    <label style={{ ...gl, fontSize: '0.7rem' }}>رقم الحوالة</label>
                                    <input type="text" className="glass-input" value={payWalletRef} onChange={e => setPayWalletRef(e.target.value)}
                                      placeholder="اختياري — رقم العملية من المحفظة" style={{ fontSize: '0.74rem', padding: '5px 8px', direction: 'ltr' }} />
                                  </div>
                                </div>
                              </>)}

                              {payMethod === 'CHECK' && (<>
                                <div style={{ marginBottom: 8, padding: '9px 11px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ ...gl, fontSize: '0.7rem' }}>البنك <span style={rq}>*</span></label>
                                    <select className="glass-input" value={payBank} onChange={e => setPayBank(e.target.value)} style={{ fontSize: '0.74rem', padding: '5px 8px' }}>
                                      <option value="">— اختر البنك —</option>
                                      {Object.entries(BL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ ...gl, fontSize: '0.7rem' }}>رقم الشيك <span style={rq}>*</span></label>
                                    <input type="text" className="glass-input" value={payCheckNum} onChange={e => setPayCheckNum(e.target.value)}
                                      placeholder="رقم الشيك" style={{ fontSize: '0.74rem', padding: '5px 8px', direction: 'ltr' }} />
                                  </div>
                                </div>
                              </>)}

                              {payMethod === 'MONEY_TRANSFER' && (<>
                                <div style={{ marginBottom: 8, padding: '9px 11px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ ...gl, fontSize: '0.7rem' }}>نوع الحوالة المالية <span style={rq}>*</span></label>
                                    <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.74rem', padding: '5px 8px' }}>
                                      <option value="">— اختر نوع الحوالة —</option>
                                      <option value="WESTERN_UNION">ويسترن يونيون (Western Union)</option>
                                      <option value="MONEYGRAM">MoneyGram</option>
                                      <option value="RIA_MONEY">RIA Money</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ ...gl, fontSize: '0.7rem' }}>رقم الحوالة <span style={rq}>*</span></label>
                                    <input type="text" className="glass-input" value={payHawalaNum} onChange={e => setPayHawalaNum(e.target.value)}
                                      placeholder="رقم الحوالة المالية" style={{ fontSize: '0.74rem', padding: '5px 8px', direction: 'ltr' }} />
                                  </div>
                                </div>
                              </>)}

                              <div className="form-group" style={{ marginBottom: 8 }}>
                                <label style={gl}>رقم المرجع <span style={rq}>*</span></label>
                                <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)}
                                  placeholder="إلزامي — رقم الإيصال أو التحويل" style={{ fontSize: '0.8rem' }} />
                              </div>
                            </>)}

                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label style={gl}>ملاحظات الدفع</label>
                              <input type="text" className="glass-input" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                                placeholder="أي ملاحظات إضافية..." style={{ fontSize: '0.8rem' }} />
                            </div>

                            <button className="glass-btn" onClick={handlePay} disabled={payLoading}
                              style={{ width: '100%', justifyContent: 'center', background: 'var(--success)', color: '#fff', borderColor: 'var(--success)', fontSize: '0.8rem' }}>
                              {payLoading ? 'جارٍ تسجيل الدفعة...' : `تسديد ${toNumber(payAmount).toFixed(2)} د.أ`}
                            </button>
                          </div>
                        )}

                        {/* Edit form */}
                        {editOpen && canEdit && (
                          <div style={{ padding: '12px 13px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', marginBottom: 10 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
                              <Save size={13} color="var(--primary)" /> تعديل القسط
                            </span>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label style={{ ...gl, fontSize: '0.7rem' }}>المبلغ</label>
                                <input type="text" inputMode="decimal" className="glass-input" value={eAmt} onChange={e => setEAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.8rem' }} />
                              </div>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label style={{ ...gl, fontSize: '0.7rem' }}>تاريخ الاستحقاق</label>
                                <DateField value={eDue} onChange={v => setEDue(v)} selectStyle={{ fontSize: '0.8rem' }} />
                              </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 9 }}>
                              <textarea className="glass-input" rows={2} value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="ملاحظات" style={{ fontSize: '0.8rem' }} />
                            </div>
                            <button className="glass-btn" onClick={handleEdit} disabled={saving} style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
                              <Save size={14} /> {saving ? 'جارٍ...' : 'حفظ التعديلات'}
                            </button>
                          </div>
                        )}

                        {/* Transactions timeline */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={13} color="var(--primary)" /> سجل الدفعات
                          </span>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{(detail.transactions || []).length} معاملة</span>
                        </div>
                        {(detail.transactions || []).length === 0 ? (
                          <div style={{ padding: '20px 14px', background: 'var(--glass-bg)', borderRadius: 10, marginBottom: 6, textAlign: 'center' }}>
                            <FileText size={18} style={{ opacity: 0.25, margin: '0 auto 6px', display: 'block' }} />
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>لا توجد دفعات سابقة لهذا القسط</div>
                          </div>
                        ) : (
                          <div style={{ position: 'relative', paddingRight: 20 }}>
                            <div style={{ position: 'absolute', right: 7, top: 4, bottom: 4, width: 2, background: 'var(--glass-border)', borderRadius: 2 }} />
                            {(detail.transactions || []).map(tx => (
                              <div key={tx.id} style={{ position: 'relative', paddingBottom: 10, paddingRight: 16 }}>
                                <div style={{ position: 'absolute', right: -13, top: 4, width: 10, height: 10, borderRadius: '50%', background: tx.status === 'COMPLETED' ? 'var(--success)' : 'var(--danger)', border: '2.5px solid var(--card-bg)', zIndex: 1, boxShadow: '0 0 0 2px var(--glass-border)' }} />
                                <div className="glass-panel" style={{ padding: '8px 11px', border: '1px solid var(--glass-border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 4 }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.68rem' }}>
                                      {tx.type === 'RECEIPT' ? 'دفعة (قبض)' : tx.type === 'PAYMENT' ? 'استرجاع (صرف)' : tx.type === 'EXPENSE' ? 'مصروف' : 'تعديل'}
                                      <span className={`badge ${tx.status === 'COMPLETED' ? 'success' : 'secondary'}`} style={{ fontSize: '0.46rem', marginRight: 4, padding: '1px 6px' }}>{tx.status === 'COMPLETED' ? 'مكتمل' : 'ملغي'}</span>
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>{formatDate(tx.date)}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.66rem', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontFamily: 'monospace', direction: 'ltr' }}>{fmt(tx.amount)} د.أ</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{PML[tx.paymentMethod] || tx.paymentMethod}</span>
                                    {tx.receiptNumber && (
                                      <button onClick={() => printReceipt(tx, detail?.entityName)} style={{ padding: '0 6px', fontSize: '0.56rem', cursor: 'pointer', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--primary)', background: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <Printer size={8} /> سند #{tx.receiptNumber}
                                      </button>
                                    )}
                                  </div>
                                  {tx.notes && <div style={{ marginTop: 3, fontSize: '0.62rem', color: 'var(--text-muted)' }}>{tx.notes}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                ) : !selSub ? (
                  <div style={{ padding: '26px 14px', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <Calendar size={22} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>اختر اشتراكاً</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                      انقر على أي اشتراك في جدول <strong>الجهة المقابلة</strong> لعرض أقساطه وبدء إعادة الجدولة هنا
                    </div>
                  </div>
                ) : wsRemaining <= 0 ? (
                  <div style={{ padding: '26px 14px', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <CheckCircle2 size={22} color="var(--success)" />
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>مدفوع بالكامل</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>لا توجد أقساط متبقية لإعادة جدولتها</div>
                  </div>
                ) : (
                  <>
                    {/* Selected subscription summary */}
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {typeBadge(selSub._type)}
                        <span style={{ fontWeight: 700, fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selSub._name}</span>
                      </div>
                      {selSub.entity?.name && <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: 6 }}>{selSub.entity.name}</div>}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 1, fontWeight: 500 }}>القيمة</div>
                          <div style={{ fontWeight: 700, fontSize: '0.74rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(selSub.totalCost)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 1, fontWeight: 500 }}>المدفوع</div>
                          <div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--success)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(wsTotalPaid)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginBottom: 1, fontWeight: 500 }}>المتبقي</div>
                          <div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--danger)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(wsRemaining)}</div>
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--glass-border)', overflow: 'hidden' }}>
                        <div style={{ width: `${wsPaidPct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--success), var(--teal))', transition: 'width .4s ease' }} />
                      </div>
                      <div style={{ marginTop: 4, fontSize: '0.6rem', color: 'var(--text-muted)' }}>{wsPaidPct}% مدفوع • {unpaidOf().length} قسط غير مدفوع</div>
                    </div>

                    {/* Fixed options */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>المبلغ المتبقي للجدولة</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{fmt(scheduleTotal)} د.أ</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>عدد الدفعات</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button className="glass-btn icon-btn xs" onClick={() => stepCount(-1)} disabled={scheduleCount <= scheduleMin} style={{ width: 26, height: 26, borderRadius: 6, fontSize: '0.9rem', lineHeight: 1, padding: 0, fontWeight: 700 }}><Minus size={13} /></button>
                          <span style={{ fontSize: '1rem', fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{scheduleCount}</span>
                          <button className="glass-btn icon-btn xs" onClick={() => stepCount(1)} style={{ width: 26, height: 26, borderRadius: 6, fontSize: '0.9rem', lineHeight: 1, padding: 0, fontWeight: 700 }}><Plus size={13} /></button>
                        </div>
                      </div>
                    </div>

                    {/* Editable rows */}
                    <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <ListChip /> الدفعات (يمكن تعديل المبلغ والتاريخ لكل دفعة)
                    </div>
                    <div style={{ maxHeight: 'min(38vh, 300px)', overflowY: 'auto', marginBottom: 8 }}>
                      {scheduleData.map((s, idx) => (
                        <div key={s.id || `new-${idx}`} style={{ padding: '9px 11px', marginBottom: 8, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--glass-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 18, height: 18, borderRadius: '50%', background: s.id ? 'var(--primary)' : 'var(--success)', color: '#fff', fontSize: '0.55rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{idx + 1}</span>
                              {s.id ? `القسط الحالي #${idx + 1}` : 'قسط جديد'}
                            </span>
                            <button className="glass-btn icon-btn xs" onClick={() => removeRow(idx)} disabled={scheduleData.length <= scheduleMin} title="حذف هذه الدفعة" style={{ width: 24, height: 24, borderRadius: 6, padding: 0, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                              <X size={12} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <label style={{ ...gl, fontSize: '0.62rem' }}>المبلغ (د.أ)</label>
                              <input type="text" inputMode="decimal" className="glass-input" value={s.amount}
                                onChange={e => updateRow(idx, { amount: toNumber(e.target.value) })}
                                style={{ direction: 'ltr', fontSize: '0.78rem', fontWeight: 600 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <label style={{ ...gl, fontSize: '0.62rem' }}>تاريخ الاستحقاق</label>
                              <DateField value={s.dueDate} onChange={v => updateRow(idx, { dueDate: v })} selectStyle={{ fontSize: '0.78rem' }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button className="glass-btn secondary sm" onClick={addRow} style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem', borderStyle: 'dashed', padding: '8px', marginBottom: 10 }}>
                      <Plus size={13} /> إضافة دفعة جديدة
                    </button>

                    {/* Sum check + save */}
                    <div style={{
                      padding: '8px 12px', borderRadius: 8, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600,
                      background: Math.abs(scheduleData.reduce((s2, d) => s2 + d.amount, 0) - scheduleTotal) <= 0.01 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: Math.abs(scheduleData.reduce((s2, d) => s2 + d.amount, 0) - scheduleTotal) <= 0.01 ? 'var(--success)' : 'var(--danger)',
                    }}>
                      <span>المجموع</span>
                      <span style={{ fontFamily: 'monospace', direction: 'ltr' }}>
                        {scheduleData.reduce((s2, d) => s2 + d.amount, 0).toFixed(2)} / {fmt(scheduleTotal)}
                      </span>
                    </div>

                    {canEdit ? (
                      <button className="glass-btn" onClick={handleScheduleSave} disabled={saving || scheduleData.length === 0}
                        style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '10px', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
                        <Save size={15} /> {saving ? 'جارٍ الحفظ...' : 'حفظ جدولة الأقساط'}
                      </button>
                    ) : (
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>ليست لديك صلاحية تعديل الجدولة</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* ═════════════ LEFT: SUBSCRIPTIONS (TABLE) + INSTALLMENTS ═════════════ */}
          <section style={{ flex: '1 1 480px', minWidth: 0, order: 2 }}>

            {/* Student card */}
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14, border: '1px solid var(--glass-border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.05rem', flexShrink: 0 }}>
                  {(student.fullNameAr || '؟').charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{student.fullNameAr}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
                    #{student.id}{student.phones ? ` • ${getPhone(student.phones)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="glass-btn sm" onClick={() => navigate(`/student-profile?studentId=${student.id}`)} style={{ fontSize: '0.7rem' }}>
                    <ExternalLink size={13} /> ملف الطالب
                  </button>
                  <button className="glass-btn sm secondary" onClick={() => navigate(`/subscriptions?studentId=${student.id}`)} style={{ fontSize: '0.7rem' }}>
                    <Plus size={13} /> اشتراك جديد
                  </button>
                </div>
              </div>
            </div>

            {/* Subscriptions table */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <GraduationCap size={15} color="var(--primary)" /> اشتراكات الطالب
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 400 }}>{subs.length} اشتراك</span>
              </span>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>انقر على اشتراك لعرض أقساطه وإعادة جدولتها</span>
            </div>

            {subsLoading ? (
              <div style={{ padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ height: 44, borderRadius: 10, marginBottom: 8, background: 'var(--glass-border)', opacity: 0.3, animation: 'pulse 1.2s ease-in-out infinite' }} />
                ))}
              </div>
            ) : subs.length === 0 ? (
              <div className="glass-panel" style={{ padding: '30px 20px', textAlign: 'center', border: '1px dashed var(--glass-border)' }}>
                <BookOpen size={24} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>لا توجد اشتراكات لهذا الطالب</div>
                <button className="glass-btn sm" onClick={() => navigate(`/subscriptions?studentId=${student.id}`)} style={{ marginTop: 8, fontSize: '0.72rem' }}>
                  <Plus size={13} /> تسجيل اشتراك جديد
                </button>
              </div>
            ) : (
              <div className="glass-table-container" style={{ maxHeight: 'min(42vh, 340px)', overflowY: 'auto', marginBottom: 18 }}>
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }}>#</th>
                      <th>البرنامج</th>
                      <th>جهة التعليم</th>
                      <th>القيمة</th>
                      <th>المدفوع</th>
                      <th>المتبقي</th>
                      <th>التقدم</th>
                      <th>الحالة</th>
                      <th style={{ width: 34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((sub, idx) => {
                      const isActive = String(selSub?.id) === String(sub.id) && selSub?._type === sub._type;
                      const stBadge = SUB_ST[sub.status] || { label: sub.status, cls: 'secondary' };
                      const agg = subAgg[`${sub._type}:${sub.id}`];
                      const paid = agg?.paid || 0;
                      const remaining = Math.max(0, (sub.totalCost || 0) - paid);
                      const pct = (sub.totalCost || 0) > 0 ? Math.min(100, Math.round((paid / (sub.totalCost || 1)) * 100)) : 0;
                      const overdueN = agg?.overdue || 0;
                      return (
                        <tr key={`${sub._type}-${sub.id}`} className={`clickable ${isActive ? 'active' : ''}`}
                          onClick={() => { selectSub(sub); setSelInstId(null); setDetail(null); setEditOpen(false); resetPay(); }}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {sub._type === 'DIPLOMA'
                                ? <GraduationCap size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                                : <BookOpen size={13} color="var(--success)" style={{ flexShrink: 0 }} />}
                              <span style={{ fontWeight: 600, fontSize: '0.74rem', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub._name}</span>
                              {typeBadge(sub._type)}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{sub.entity?.name || '—'}</td>
                          <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(sub.totalCost)}</td>
                          <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', fontSize: '0.72rem', color: 'var(--success)', whiteSpace: 'nowrap' }}>{fmt(paid)}</td>
                          <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', fontSize: '0.72rem', color: remaining > 0 ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(remaining)}</td>
                          <td style={{ minWidth: 86 }}>
                            <div style={{ height: 4, borderRadius: 3, background: 'var(--glass-border)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--success), var(--teal))' }} />
                            </div>
                            <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', marginTop: 2 }}>{pct}%</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 3, flexDirection: 'column', alignItems: 'flex-start' }}>
                              <span className={`badge ${stBadge.cls}`} style={{ fontSize: '0.46rem' }}>{stBadge.label}</span>
                              {overdueN > 0 && <span className="badge danger" style={{ fontSize: '0.42rem' }}>{overdueN} متأخر</span>}
                            </div>
                          </td>
                          <td><ChevronLeft size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Installments of selected subscription */}
            {selSub && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={15} color="var(--success)" /> أقساط {selSub._name}
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 400 }}>{subInstalls.length} قسط</span>
                  </span>
                  {canEdit && (
                    <button className="glass-btn sm" onClick={() => openAdd(student)} style={{ fontSize: '0.7rem', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', color: '#fff' }}>
                      <Plus size={13} /> إضافة قسط
                    </button>
                  )}
                </div>

                <div className="glass-table-container" style={{ maxHeight: 'min(52vh, 460px)', overflowY: 'auto' }}>
                  {subInstLoading ? (
                    <div style={{ padding: 16 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ height: 48, borderRadius: 10, marginBottom: 8, background: 'var(--glass-border)', opacity: 0.3, animation: 'pulse 1.2s ease-in-out infinite' }} />
                      ))}
                    </div>
                  ) : subInstalls.length === 0 ? (
                    <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                      <FileText size={22} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>لا توجد أقساط بعد لهذا الاشتراك</div>
                    </div>
                  ) : (
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>القسط</th>
                          <th>الحالة</th>
                          <th>الاستحقاق</th>
                          <th>المبلغ</th>
                          <th>المدفوع</th>
                          <th>المتبقي</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subInstalls.map(inst => {
                          const st = ST[inst.status] || { label: inst.status, cls: 'secondary' };
                          const isOpen = selInstId === inst.id;
                          return (
                            <tr key={inst.id} className={`clickable ${isOpen ? 'active' : ''}`} onClick={() => openPanel(inst.id)}>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{inst.installmentNumber}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>/{inst.totalInstallments}</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                                  <span className={`badge ${st.cls}`} style={{ fontSize: '0.58rem' }}>{st.label}</span>
                                  {inst.paymentDest && (
                                    <span className={`badge ${inst.paymentDest === 'ENTITY' ? 'primary' : 'teal'}`} style={{ fontSize: '0.48rem', whiteSpace: 'normal', lineHeight: 1.5, textAlign: 'right' }}
                                      title={destText(inst, centerName) || ''}>
                                      {destText(inst, centerName)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDate(inst.dueDate)}</td>
                              <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmt(inst.amount)}</td>
                              <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', fontSize: '0.8rem', color: 'var(--success)', whiteSpace: 'nowrap' }}>{fmt(inst.paidAmount)}</td>
                              <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', fontSize: '0.8rem', color: remOf(inst) > 0 ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(remOf(inst))}</td>
                              <td><ChevronLeft size={15} style={{ color: 'var(--text-muted)', opacity: 0.5 }} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '56px 24px', textAlign: 'center', border: '1px dashed var(--glass-border)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <CreditCard size={30} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>ابدأ باختيار طالب</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.8 }}>
            استخدم حقل البحث بالأعلى للعثور على الطالب — ثم اختر اشتراكاً من <strong>جدول الجهة المقابلة</strong><br />
            لعرض أقساطه وإعادة جدولتها من اللوحة الثابتة على اليمين.
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

const ListChip = () => (
  <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--primary-light)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <Banknote size={9} />
  </span>
);
