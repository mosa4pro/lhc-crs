import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, CreditCard, Plus, X,
  Clock, FileText, Trash2, Save, Printer,
  User, Calendar, AlertTriangle, Award, FileWarning
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { formatDate } from '../utils/dateFormat';
import { toNumber } from '../utils/arabicNumbers';
import { useSearchParams } from 'react-router-dom';

interface Sub { id: number | string; studentId: string; baseFee: number; totalCost: number; paymentType: string; installmentsCount: number; date: string; status: string; notes?: string; diploma?: { id: string; name: string }; course?: { id: string; name: string }; entity?: { id: number; name: string }; }
interface Inst { id: number; studentId: string; subscriptionId: string; subscriptionType: string; installmentNumber: number; totalInstallments: number; dueDate: string; amount: number; paidAmount: number; remainingAmount: number; status: string; paymentDate?: string; paymentMethod?: string; referenceNumber?: string; notes?: string; paymentWallet?: string; paymentBank?: string; senderInfo?: string; }
interface Student { id: string; fullNameAr: string; fullNameEn?: string; }

const ST: Record<string, { label: string; cls: string }> = { PENDING: { label: 'بانتظار', cls: 'warning' }, PAID: { label: 'مدفوع', cls: 'success' }, PARTIAL: { label: 'دفع جزئي', cls: 'teal' }, OVERDUE: { label: 'متأخر', cls: 'danger' } };
const PML: Record<string, string> = { CASH: 'نقدي', BANK: 'حوالة بنكية', CARD: 'بطاقة', TRANSFER: 'تحويل إلكتروني', WALLET: 'محفظة إلكترونية', CLICK: 'حوالة كليك', ENTITY: 'جهة', CHECK: 'شيك' };
const WL: Record<string, string> = { UMNIAH: 'أمنية كاش', ORANGE: 'أورانج موني', ZAIN: 'زين كاش', DINARAK: 'دينارك', ALAWNEH: 'علاونه' };
const BL: Record<string, string> = { Jordan_Ahli: 'الأهلي الأردني', Arab_Bank: 'العربي', Housing_Bank: 'الإسكان', Cairo_Amman: 'القاهرة عمان', Jordan_Kuwait: 'الأردني الكويتي', Islamic_Bank: 'الإسلامي الأردني', Safwa_Islamic: 'صفوة الإسلامي', Etihad: 'الاتحاد', Societe_Generale: 'سوسيتيه جنرال', Bank_of_Jordan: 'الأردن', Investbank: 'الاستثمار', Jordan_Commercial: 'التجاري الأردني', ABC: 'ABC', Standard_Chartered: 'ستاندارد تشارترد', BLOM: 'بلوم', Al_Rajhi: 'الراجحي', OTHER: 'آخر' };
const CATEGORIES = [
  { value: 'SUBSCRIPTION', label: 'قسط اشتراك', icon: 'CreditCard', cls: 'primary' },
  { value: 'PENALTY', label: 'بدل مخالفة', icon: 'AlertTriangle', cls: 'danger' },
  { value: 'FINE', label: 'بدل غرامات', icon: 'FileWarning', cls: 'danger' },
  { value: 'PRIVILEGE', label: 'بدل امتيازات', icon: 'Award', cls: 'warning' },
  { value: 'OTHER', label: 'بدل أخرى', icon: 'FileText', cls: 'secondary' },
] as const;
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c])) as Record<string, typeof CATEGORIES[number]>;

const EXTRA_SUB: Sub = { id: 'EXTRA', studentId: '', baseFee: 0, totalCost: 0, paymentType: '', installmentsCount: 0, date: '', status: '' };
const subName = (sub: Sub) => sub.diploma?.name || sub.course?.name || `#${sub.id}`;

export const FinInstallmentsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [sq, setSq] = useState('');
  const [sRes, setSRes] = useState<Student[]>([]);
  const [sShow, setSShow] = useState(false);
  const sRef = useRef<HTMLDivElement>(null);
  const [isDeep, setIsDeep] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balC, setBalC] = useState(0);

  const [subs, setSubs] = useState<Sub[]>([]);
  const [selSub, setSelSub] = useState<Sub | null>(null);
  const [insts, setInsts] = useState<Inst[]>([]);
  const [allInsts, setAllInsts] = useState<Inst[]>([]);
  const [selInst, setSelInst] = useState<Inst | null>(null);
  const [txs, setTxs] = useState<any[]>([]);

  const [eAmt, setEAmt] = useState('');
  const [eDue, setEDue] = useState('');
  const [eNotes, setENotes] = useState('');

  const [aAmt, setAAmt] = useState('');
  const [aDue, setADue] = useState('');
  const [aNotes, setANotes] = useState('');
  const [aCategory, setACategory] = useState('SUBSCRIPTION');

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [scheduleData, setScheduleData] = useState<{ id: number | null; amount: number; dueDate: string }[]>([]);
  const [addMode, setAddMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Payment form state (matching SubscriptionPage pattern)
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

  const searchStudents = useCallback(async (q: string) => {
    if (!q.trim()) { setSRes([]); return; }
    try { const r = await apiFetch(`/students?query=${encodeURIComponent(q)}&limit=10`); const list = Array.isArray(r) ? r : r?.data || []; setSRes(list); setSShow(list.length > 0); } catch { setSRes([]); }
  }, [apiFetch]);

  const loadSubs = useCallback(async (id: string) => {
    try { const [d, c] = await Promise.all([apiFetch(`/subscriptions/diploma?studentId=${id}`), apiFetch(`/subscriptions/course?studentId=${id}`)]); setSubs([...(Array.isArray(d) ? d : []), ...(Array.isArray(c) ? c : [])]); } catch { setSubs([]); }
  }, [apiFetch]);

  const loadInsts = useCallback(async (subId?: string, stuId?: string, subType?: string) => {
    try {
      if (stuId && subType) {
        const r = await apiFetch(`/installments?studentId=${stuId}&subscriptionType=${subType}`);
        setInsts(Array.isArray(r) ? r : []);
      } else if (subId) {
        const r = await apiFetch(`/installments?subscriptionId=${subId}`);
        setInsts(Array.isArray(r) ? r : []);
      }
    } catch { setInsts([]); }
  }, [apiFetch]);

  const loadTxs = useCallback(async (id: number) => {
    try { const r = await apiFetch(`/installments/${id}/transactions`); setTxs(Array.isArray(r) ? r : []); } catch { setTxs([]); }
  }, [apiFetch]);

  const loadAllInsts = useCallback(async (sid: string) => {
    try { const r = await apiFetch(`/installments?studentId=${sid}`); setAllInsts(Array.isArray(r) ? r : []); } catch { setAllInsts([]); }
  }, [apiFetch]);

  const fetchBal = useCallback(async (sid: string) => {
    try { const r = await apiFetch(`/financial/students/${sid}/installment-balance`); if (r) { setBalance(r.balance); setBalC(r.totalInstallments); } else { setBalance(null); setBalC(0); } } catch { setBalance(null); setBalC(0); }
  }, [apiFetch]);

  const selectStudent = useCallback((s: Student) => {
    setStudent(s); setSShow(false); setSq(s.fullNameAr);
    setSelSub(null); setInsts([]); setSelInst(null); setTxs([]);
    setAAmt(''); setADue(''); setANotes(''); setACategory('SUBSCRIPTION');
    setAddMode(false);
    loadSubs(s.id); fetchBal(s.id); loadAllInsts(s.id);
  }, [loadSubs, fetchBal, loadAllInsts]);

  // ── Open with preselected student (from student profile quick access) ──
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const sid = searchParams.get('studentId');
    if (sid) {
      apiFetch(`/students/${sid}`).then((s: any) => { if (s) selectStudent(s); }).catch(() => {});
    }
  }, [searchParams, selectStudent]);

  const selectSub = useCallback((sub: Sub) => {
    if (selSub?.id === sub.id) { setSelSub(null); setInsts([]); setSelInst(null); setTxs([]); return; }
    setSelSub(sub); setSelInst(null); setTxs([]);
    setAAmt(''); setADue(''); setANotes('');
    if (sub.id === 'EXTRA' && student) {
      loadInsts(undefined, student.id, 'EXTRA');
    } else {
      loadInsts(String(sub.id));
    }
  }, [selSub, loadInsts, student]);

  const selectInst = useCallback((inst: Inst) => {
    setAddMode(false);
    setSelInst(inst);
    setEAmt(String(inst.amount)); setEDue(inst.dueDate.split('T')[0]); setENotes(inst.notes || '');
    loadTxs(inst.id);
    setPayActive(false);
    setPayAmount(String(inst.remainingAmount));
    setPayDest('');
    setPayMethod('CASH');
    setPaySubMethod('');
    setPayRef('');
    setPayWalletRef('');
    setPayBank('');
    setPayCheckNum('');
    setPayHawalaNum('');
    setPayNotes('');
  }, [loadTxs]);

  const refresh = useCallback(() => {
    if (!student) return;
    if (selSub) {
      if (selSub.id === 'EXTRA') {
        loadInsts(undefined, student.id, 'EXTRA');
      } else {
        loadInsts(String(selSub.id));
      }
    }
    fetchBal(student.id);
    loadAllInsts(student.id);
  }, [student, selSub, loadInsts, fetchBal, loadAllInsts]);

  const handleAdd = async () => {
    if (!student) return false;
    if (aCategory === 'SUBSCRIPTION' && !selSub) { toast.error('اختر الاشتراك أولاً'); return false; }
    const amt = toNumber(aAmt);
    if (!amt || amt <= 0) { toast.error('المبلغ مطلوب'); return false; }
    if (!aDue) { toast.error('التاريخ مطلوب'); return false; }
    if (aCategory === 'SUBSCRIPTION' && selSub) {
      try {
        const existing = await apiFetch(`/installments?subscriptionId=${String(selSub.id)}`);
        const existingTotal = (Array.isArray(existing) ? existing : []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
        const cap = (selSub.totalCost || 0);
        if (existingTotal + amt > cap + 0.001) {
          toast.error(`لا يمكن زيادة الأقساط عن قيمة الاشتراك: المجموع الحالي ${existingTotal.toFixed(2)} + ${amt.toFixed(2)} يتجاوز ${cap.toFixed(2)} د.أ`);
          return false;
        }
      } catch { /* allow server to reject if fetch fails */ }
    }
    setLoading(true);
    try {
      const body: any = { studentId: student.id, dueDate: aDue, amount: amt, notes: aNotes || undefined, category: aCategory };
      if (aCategory === 'SUBSCRIPTION' && selSub) {
        body.subscriptionType = (selSub as any).diploma ? 'DIPLOMA' : 'COURSE';
        body.subscriptionId = String(selSub.id);
      }
      await apiFetch('/installments', { method: 'POST', body: JSON.stringify(body) });
      toast.success('تم إضافة القسط'); setAAmt(''); setADue(''); setANotes('');
      if (selSub) {
        if (selSub.id === 'EXTRA') loadInsts(undefined, student.id, 'EXTRA');
        else loadInsts(String(selSub.id));
      }
      fetchBal(student.id);
      return true;
    } catch (err: any) { toast.error('فشل', err.message); return false; }
    finally { setLoading(false); }
  };

  const handleEdit = async () => {
    if (!selInst) return;
    const newAmt = toNumber(eAmt);
    if (!newAmt || newAmt <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (selInst.subscriptionType && selInst.subscriptionType !== 'EXTRA') {
      const sub = subs.find(s => String(s.id) === String(selInst.subscriptionId));
      const cap = (sub as any)?.totalCost || 0;
      const subInsts = insts.filter(i => String(i.subscriptionId) === String(selInst.subscriptionId) && i.subscriptionType === selInst.subscriptionType);
      const newTotal = subInsts.reduce((s, i) => s + i.amount, 0) - selInst.amount + newAmt;
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
      await apiFetch(`/installments/${selInst.id}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: newAmt, dueDate: eDue, notes: eNotes || undefined })
      });
      toast.success('تم الحفظ'); refresh();
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  const handleScheduleSave = async () => {
    if (!selSub || !student) return;
    if (scheduleData.some(d => !d.amount || d.amount <= 0)) { toast.error('جميع مبالغ الأقساط يجب أن تكون أكبر من صفر'); return; }
    const sum = scheduleData.reduce((s, d) => s + d.amount, 0);
    if (Math.abs(sum - scheduleTotal) > 0.01) {
      toast.error(`مجموع الأقساط (${sum.toFixed(2)}) لا يساوي المبلغ المتبقي (${scheduleTotal.toFixed(2)})`);
      return;
    }
    const currentUnpaid = unpaidInsts;
    const newCount = scheduleData.length;
    setSaving(true);
    try {
      // Update existing installments
      for (let i = 0; i < Math.min(newCount, currentUnpaid.length); i++) {
        const s = scheduleData[i];
        if (s.id) {
          await apiFetch(`/installments/${s.id}`, {
            method: 'PUT',
            body: JSON.stringify({ amount: s.amount, dueDate: s.dueDate })
          });
        }
      }

      // Create new installments if count increased
      const toCreate = scheduleData.filter(s => s.id === null);
      for (const s of toCreate) {
        await apiFetch('/installments', {
          method: 'POST',
          body: JSON.stringify({
            studentId: student.id,
            subscriptionType: (selSub as any).diploma ? 'DIPLOMA' : 'COURSE',
            subscriptionId: String(selSub.id),
            dueDate: s.dueDate,
            amount: s.amount,
          })
        });
      }

      // Delete excess unpaid installments if count decreased
      if (newCount < currentUnpaid.length) {
        const toDelete = currentUnpaid.slice(newCount);
        for (const inst of toDelete) {
          try { await apiFetch(`/installments/${inst.id}?merge=true`, { method: 'DELETE' }); } catch {}
        }
      }

      toast.success('تم تحديث جدولة الأقساط');
      setShowSchedule(false);
      loadInsts(String(selSub.id));
      fetchBal(student.id);
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selInst) return;
    if (selInst.subscriptionType && selInst.subscriptionType !== 'EXTRA') {
      const sub = subs.find(s => String(s.id) === String(selInst.subscriptionId));
      const cap = (sub as any)?.totalCost || 0;
      const subInsts = insts.filter(i => String(i.subscriptionId) === String(selInst.subscriptionId) && i.subscriptionType === selInst.subscriptionType);
      const newTotal = subInsts.reduce((s, i) => s + i.amount, 0) - selInst.amount;
      if (cap > 0 && newTotal < cap - 0.001) {
        toast.error(`لا يمكن حذف القسط: إجمالي الأقساط سيصبح (${newTotal.toFixed(2)}) أقل من قيمة الاشتراك (${cap.toFixed(2)})`);
        return;
      }
    }
    if (!window.confirm('حذف القسط؟')) return;
    setSaving(true);
    try { await apiFetch(`/installments/${selInst.id}`, { method: 'DELETE' }); toast.success('تم الحذف'); setSelInst(null); refresh(); } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  const handlePay = async () => {
    if (!selInst || !student) return;
    const amt = toNumber(payAmount);
    if (!amt || amt <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (!payDest) { toast.error('اختر جهة الدفع (جهة التعليم أو لدينا)'); return; }
    if (!payRef.trim()) { toast.error('رقم المرجع مطلوب'); return; }
    if (payDest === 'US') {
      if (payMethod === 'TRANSFER' && !paySubMethod) { toast.error('يرجى اختيار نوع المحفظة الإلكترونية'); return; }
      if (payMethod === 'CHECK') { if (!payBank) { toast.error('يرجى اختيار البنك'); return; } if (!payCheckNum.trim()) { toast.error('رقم الشيك مطلوب'); return; } }
      if (payMethod === 'MONEY_TRANSFER') { if (!paySubMethod) { toast.error('يرجى اختيار نوع الحوالة'); return; } if (!payHawalaNum.trim()) { toast.error('رقم الحوالة مطلوب'); return; } }
    }
    if (balance !== null && amt > balance) {
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
      if (payDest === 'US' && payMethod === 'TRANSFER') { body.paymentSubMethod = paySubMethod; if (payWalletRef) body.paymentWalletRef = payWalletRef; }
      if (payDest === 'US' && payMethod === 'CHECK') { body.paymentBank = payBank; body.checkNumber = payCheckNum; }
      if (payDest === 'US' && payMethod === 'MONEY_TRANSFER') { body.paymentSubMethod = paySubMethod; body.hawalaNumber = payHawalaNum; }
      if (payNotes) body.notes = payNotes;

      // Unified payment path: use /financial/pay-student (same as receipts page).
      // EXTRA fees keep their targeted endpoint since they are not part of a subscription.
      if (selSub?.id === 'EXTRA') {
        await apiFetch(`/installments/${selInst.id}/pay`, { method: 'POST', body: JSON.stringify(body) });
      } else {
        body.studentId = student.id;
        await apiFetch('/financial/pay-student', { method: 'POST', body: JSON.stringify(body) });
      }
      toast.success('تم تسجيل الدفعة');
      if (selSub?.id === 'EXTRA') {
        loadInsts(undefined, student.id, 'EXTRA');
      } else if (selSub) {
        loadInsts(String(selSub.id));
      }
      fetchBal(student.id);
      loadTxs(selInst.id);
      setPayActive(false);
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setPayLoading(false); }
  };

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

  const catLabel = (inst: Inst) => {
    if (inst.subscriptionType !== 'EXTRA') return null;
    return CATEGORIES.find(c => inst.subscriptionId === `EXTRA-${c.value}`);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => { if (sRef.current && !sRef.current.contains(e.target as Node)) setSShow(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const isU = selInst && (selInst.status === 'PENDING' || selInst.status === 'PARTIAL' || selInst.status === 'OVERDUE');
  const unpaidInsts = insts.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE');

  const distributeSchedule = useCallback((count: number, total: number, baseData: typeof scheduleData) => {
    if (count < 1) return;
    // Mirror SubscriptionPage.baseAmounts: the first installment keeps its
    // "دفعة أولى" value when it is installment #1 and still fully unpaid.
    const firstUnpaid = unpaidInsts[0];
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
      data.push({
        id: existing?.id || null,
        amount: amounts[i],
        dueDate: nextDate,
      });
    }
    return data;
  }, [unpaidInsts]);

  return (
    <div className="split-layout" style={{ gap: 0, alignItems: 'stretch', minHeight: 'calc(100vh - 140px)' }}>

      {/* ===== LEFT PANEL ===== */}
      <div className="glass-panel split-panel" style={{ flex: '0 0 36%', minWidth: 0, borderRadius: '0 var(--radius-lg) var(--radius-lg) 0', margin: 0 }}>

        {/* Search */}
        <div ref={sRef} style={{ position: 'relative', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 0, maxWidth: 'none' }}>
              <Search className="search-icon" size={18} />
              <input type="text" className="glass-input" placeholder="بحث عن طالب بالاسم، الهاتف، أو الرقم..." value={sq}
                onChange={e => { setSq(e.target.value); searchStudents(e.target.value); }}
                onFocus={() => { if (sRes.length > 0) setSShow(true); }}
                style={{ paddingRight: 44, fontSize: '0.82rem' }} />
              {sShow && sRes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--card-bg)', backdropFilter: 'var(--glass-blur)', borderRadius: 10, marginTop: 4, border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', maxHeight: 260, overflowY: 'auto' }}>
                  {sRes.map(s => (
                    <div key={s.id} onClick={() => selectStudent(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontWeight: 600 }}>{s.fullNameAr}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' }}>#{s.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="glass-btn icon-btn" onClick={() => setIsDeep(true)} title="بحث عميق"><Search size={18} /></button>
            {student && <button className="glass-btn icon-btn sm" onClick={() => { setStudent(null); setSubs([]); setSelSub(null); setInsts([]); setSelInst(null); setTxs([]); setSq(''); setBalance(null); }} style={{ color: 'var(--danger)' }}><X size={16} /></button>}
          </div>
        </div>

        {!student && (
          <div className="empty-state">
            <User size={48} />
            <p style={{ fontSize: '0.9rem' }}>ابحث عن طالب للبدء في إدارة الأقساط</p>
          </div>
        )}

        {student && (
          <>

            {/* Student card + Add button */}
            <div style={{ padding: '12px 16px', marginBottom: 18, background: 'var(--primary-light)', borderRadius: 12, border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                {student.fullNameAr.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{student.fullNameAr}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontFamily: 'monospace' }}>#{student.id}</span>
                  {balance !== null && (
                    <span className={`badge ${balance > 0 ? 'warning' : 'success'}`} style={{ fontSize: '0.55rem' }}>
                      الرصيد: {balance.toFixed(2)} د.أ ({balC})
                    </span>
                  )}
                </div>
              </div>
              {hasPermission('finance.installments') && (
                <button onClick={() => setAddMode(true)}
                  style={{
                    padding: '8px 22px', borderRadius: 10, cursor: 'pointer', border: 'none', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#fff', fontWeight: 700, fontSize: '0.78rem',
                    display: 'flex', alignItems: 'center', gap: 7,
                    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.55)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.4)'; }}>
                  <Plus size={16} /> إضافة قسط
                </button>
              )}
            </div>

            {/* إضافة قسط (in left panel) */}
            {addMode ? (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div className="section-title" style={{ margin: 0, fontSize: '0.8rem' }}>
                    <CreditCard size={15} color="var(--secondary)" />
                    إضافة قسط جديد
                  </div>
                  <button className="glass-btn icon-btn sm" onClick={() => { setAddMode(false); setACategory('SUBSCRIPTION'); setAAmt(''); setADue(''); setANotes(''); }} style={{ color: 'var(--text-muted)' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Category chips */}
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
                        <div key={cat.value} onClick={() => { setACategory(cat.value); if (cat.value !== 'SUBSCRIPTION') setSelSub(prev => prev || null); }}
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

                {/* Subscription selector */}
                {aCategory === 'SUBSCRIPTION' && (
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>الاشتراك</label>
                    {subs.length === 0 ? (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '6px 0' }}>لا يوجد اشتراكات</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {subs.map(sub => {
                          const isD = !!(sub as any).diploma;
                          const active = selSub?.id === sub.id && selSub?.id !== 'EXTRA';
                          return (
                            <div key={String(sub.id)} onClick={() => setSelSub(prev => prev?.id === sub.id ? prev : { ...sub, id: sub.id } as Sub)}
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

                {/* EXTRA hint */}
                {aCategory !== 'SUBSCRIPTION' && (
                  <div style={{ padding: '6px 10px', marginBottom: 10, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.68rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={11} />
                    {CAT_MAP[aCategory]?.label} — مبلغ إضافي خارج الاشتراكات
                  </div>
                )}

                {/* Amount + Date */}
                <div className="form-row" style={{ gap: 10, marginBottom: 10 }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>المبلغ (د.أ)</label>
                    <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={aAmt} onChange={e => setAAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.78rem', padding: '9px 12px' }} />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>تاريخ الاستحقاق</label>
                    <input type="date" className="glass-input" value={aDue} onChange={e => setADue(e.target.value)} style={{ fontSize: '0.78rem', padding: '9px 12px' }} />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <textarea className="glass-input" rows={2} placeholder={aCategory === 'SUBSCRIPTION' ? 'ملاحظات (اختياري)' : 'بيان (اختياري)'} value={aNotes} onChange={e => setANotes(e.target.value)} style={{ fontSize: '0.78rem', padding: '9px 12px' }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {hasPermission('finance.installments') && (
                    <button className="glass-btn" onClick={async () => {
                      const ok = await handleAdd();
                      if (ok) setAddMode(false);
                    }} disabled={loading}
                      style={{
                        flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '10px',
                        background: aCategory !== 'SUBSCRIPTION' ? 'var(--warning)' : 'var(--primary)',
                        borderColor: aCategory !== 'SUBSCRIPTION' ? 'var(--warning)' : 'var(--primary)',
                        color: '#fff',
                      }}>
                      <Plus size={14} /> {loading ? 'جارٍ...' : `إضافة ${CAT_MAP[aCategory]?.label || 'قسط'}`}
                    </button>
                  )}
                  <button className="glass-btn secondary" onClick={() => { setAddMode(false); setACategory('SUBSCRIPTION'); setAAmt(''); setADue(''); setANotes(''); }}
                    style={{ fontSize: '0.8rem', padding: '10px 18px' }}>
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (<>

            {/* تعديل القسط */}
            {selInst && (
              <>

                {/* Summary card */}
                <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CreditCard size={15} color="var(--secondary)" />
                      قسط #{selInst.installmentNumber}/{selInst.totalInstallments}
                      {(() => {
                        const cat = catLabel(selInst);
                        return cat
                          ? <span className={`badge ${cat.cls}`} style={{ fontSize: '0.5rem' }}>{cat.label}</span>
                          : <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>— {subName(subs.find(s => String(s.id) === selInst.subscriptionId) || selSub!)}</span>;
                      })()}
                    </span>
                    <span className={`badge ${ST[selInst.status]?.cls || 'secondary'}`} style={{ fontSize: '0.6rem', padding: '3px 10px' }}>
                      {ST[selInst.status]?.label || selInst.status}
                    </span>
                  </div>
                  <div className="grid-2" style={{ gap: '6px 16px', fontSize: '0.78rem' }}>
                    <div><span className="text-muted">المبلغ:</span> <strong>{selInst.amount.toFixed(2)}</strong></div>
                    <div><span className="text-muted">المدفوع:</span> <strong style={{ color: 'var(--success)' }}>{selInst.paidAmount.toFixed(2)}</strong></div>
                    <div><span className="text-muted">المتبقي:</span> <strong style={{ color: 'var(--danger)' }}>{selInst.remainingAmount.toFixed(2)}</strong></div>
                    <div><span className="text-muted">الاستحقاق:</span> <strong>{formatDate(selInst.dueDate)}</strong></div>
                    {selInst.paymentDate && <div><span className="text-muted">تاريخ الدفع:</span> <strong>{formatDate(selInst.paymentDate)}</strong></div>}
                    {selInst.paymentMethod && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="text-muted">طريقة الدفع:</span>
                        <strong> {PML[selInst.paymentMethod] || selInst.paymentMethod}</strong>
                        {selInst.paymentMethod === 'WALLET' && selInst.paymentWallet && <span className="text-muted" style={{ fontSize: '0.72rem' }}> ({WL[selInst.paymentWallet] || selInst.paymentWallet})</span>}
                        {selInst.paymentMethod === 'CLICK' && selInst.paymentBank && (
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}> ({BL[selInst.paymentBank] || selInst.paymentBank}{selInst.senderInfo ? ` — ${selInst.senderInfo}` : ''})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment form — SubscriptionPage pattern */}
                {isU && hasPermission('finance.installments') && (
                  <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
                    <div className="section-title" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
                      <CreditCard size={14} color="var(--success)" />
                      تسديد الدفعة
                    </div>

                    {/* Amount */}
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">المبلغ (د.أ) <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ direction: 'ltr', fontSize: '0.82rem', fontWeight: 600 }} />
                    </div>

                    {/* Paid/Unpaid toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: payActive ? 14 : 0 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>حالة الدفع</span>
                      <button type="button"
                        onClick={() => {
                          if (payActive) {
                            setPayActive(false);
                          } else {
                            setPayActive(true);
                            setPayDest('');
                            setPayMethod('CASH');
                            setPaySubMethod('');
                            setPayRef('');
                            setPayWalletRef('');
                            setPayBank('');
                            setPayCheckNum('');
                            setPayHawalaNum('');
                            setPayNotes('');
                          }
                        }}
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
                      {/* Payment destination */}
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
                        {/* ENTITY — just reference + notes */}
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label">رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="رقم الإيصال" style={{ fontSize: '0.82rem' }} />
                        </div>
                      </>) : (<>
                        {/* US — payment method selection */}
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

                        {/* TRANSFER — wallet type */}
                        {payMethod === 'TRANSFER' && (<>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">نوع المحفظة الإلكترونية <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select className="glass-input" value={paySubMethod}
                              onChange={e => setPaySubMethod(e.target.value)}
                              style={{ fontSize: '0.82rem' }}>
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

                        {/* CHECK — bank + check number */}
                        {payMethod === 'CHECK' && (<>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">البنك <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select className="glass-input" value={payBank}
                              onChange={e => setPayBank(e.target.value)}
                              style={{ fontSize: '0.82rem' }}>
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

                        {/* MONEY_TRANSFER — hawala type + number */}
                        {payMethod === 'MONEY_TRANSFER' && (<>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">نوع الحوالة المالية <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select className="glass-input" value={paySubMethod}
                              onChange={e => setPaySubMethod(e.target.value)}
                              style={{ fontSize: '0.82rem' }}>
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

                        {/* Reference number required for all US methods */}
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label">رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <input type="text" className="glass-input" value={payRef} onChange={e => setPayRef(e.target.value)}
                            placeholder="إلزامي — رقم الإيصال أو التحويل" style={{ fontSize: '0.82rem' }} />
                        </div>
                      </>)}

                      {/* Notes */}
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">ملاحظات الدفع</label>
                        <input type="text" className="glass-input" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                          placeholder="أي ملاحظات إضافية..." style={{ fontSize: '0.82rem' }} />
                      </div>

                      {/* Submit */}
                      <button className="glass-btn" onClick={handlePay} disabled={payLoading} style={{ width: '100%', background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' }}>
                        {payLoading ? 'جارٍ...' : `تسديد ${toNumber(payAmount).toFixed(2)} د.أ`}
                      </button>
                    </>)}
                  </div>
                )}

                {/* Edit form */}
                <div className="glass-panel" style={{ padding: '14px 16px' }}>
                  <div className="section-title" style={{ fontSize: '0.8rem' }}>
                    <Save size={14} color="var(--primary)" />
                    تعديل القسط
                  </div>
                  <div className="form-row" style={{ gap: 10, marginBottom: 10 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label">المبلغ</label>
                      <input type="text" inputMode="decimal" className="glass-input" value={eAmt} onChange={e => setEAmt(e.target.value)} style={{ direction: 'ltr', fontSize: '0.82rem' }} />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label">تاريخ الاستحقاق</label>
                      <input type="date" className="glass-input" value={eDue} onChange={e => setEDue(e.target.value)} style={{ fontSize: '0.82rem' }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <textarea className="glass-input" rows={2} value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="ملاحظات" style={{ fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    {hasPermission('finance.installments') && (
                      <button className="glass-btn" onClick={handleEdit} disabled={saving} style={{ flex: 1 }}>
                        <Save size={14} /> {saving ? 'جارٍ...' : 'حفظ التعديلات'}
                      </button>
                    )}
                    {hasPermission('finance.installments') && (
                      <button className="glass-btn sm secondary" onClick={handleDelete} disabled={saving} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                        <Trash2 size={14} /> حذف
                      </button>
                    )}
                  </div>
                </div>

              </>
            )}

            </>)}

          </>
        )}
      </div>

      {/* ===== DIVIDER ===== */}
      <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 3, height: 50, borderRadius: 4, background: 'var(--glass-border)', opacity: 0.5 }} />
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="glass-panel split-panel" style={{ flex: 1, minWidth: 0, borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)', margin: 0 }}>

        {!student && (
          <div className="empty-state">
            <User size={48} />
            <p style={{ fontSize: '0.9rem' }}>ابحث عن طالب من القائمة اليمنى</p>
          </div>
        )}

        {student && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">
                <FileText size={15} color="var(--secondary)" />
                الاشتراكات
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginRight: 4 }}>({subs.length})</span>
              </div>
              {subs.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <p style={{ fontSize: '0.82rem' }}>لا يوجد اشتراكات</p>
                </div>
              ) : (
                <div className="glass-table-container" style={{ marginBottom: 12 }}>
                  <table className="glass-table" style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr><th>النوع</th><th>الاسم</th><th>الكلفة</th><th>دفعات</th><th>المتبقي</th><th>التاريخ</th></tr>
                      </thead>
                      <tbody>
                        {subs.map(sub => {
                          const isD = !!(sub as any).diploma;
                          const active = selSub?.id === sub.id && selSub?.id !== 'EXTRA';
                          const subInsts = allInsts.filter(i => String(i.subscriptionId) === String(sub.id));
                          const remainingAmt = subInsts.reduce((s, i) => s + i.remainingAmount, 0);
                          const unpaidCount = subInsts.filter(i => i.remainingAmount > 0).length;
                          return (
                          <tr key={String(sub.id)} onClick={() => selectSub(sub)} style={{ cursor: 'pointer' }} className={active ? 'active' : ''}>
                            <td><span className={`badge ${isD ? 'primary' : 'success'}`} style={{ fontSize: '0.55rem' }}>{isD ? 'دبلوم' : 'دورة'}</span></td>
                            <td style={{ fontWeight: active ? 600 : 400 }}>{subName(sub)}</td>
                            <td style={{ direction: 'ltr', fontFamily: 'monospace' }}>{(sub as any).totalCost || (sub as any).baseFee || 0}</td>
                            <td>{(sub as any).installmentsCount || 0}</td>
                            <td style={{ textAlign: 'center' }}>
                              {remainingAmt > 0 ? (
                                <span style={{ color: 'var(--danger)', fontSize: '0.68rem', fontWeight: 600, direction: 'ltr', fontFamily: 'monospace' }}>
                                  {remainingAmt.toFixed(2)}
                                  {unpaidCount > 1 && <span style={{ color: 'var(--text-muted)', marginRight: 3, fontSize: '0.6rem' }}>({unpaidCount})</span>}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 600 }}>✓</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.68rem' }}>{formatDate(sub.date)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* قسم الرسوم الإضافية */}
              <div style={{
                padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${selSub?.id === 'EXTRA' ? 'var(--warning)' : 'var(--glass-border)'}`,
                background: selSub?.id === 'EXTRA' ? 'rgba(245,158,11,0.08)' : 'transparent',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12,
              }} onClick={() => selectSub(EXTRA_SUB)}
                onMouseEnter={e => { if (selSub?.id !== 'EXTRA') e.currentTarget.style.borderColor = 'var(--warning)'; }}
                onMouseLeave={e => { if (selSub?.id !== 'EXTRA') e.currentTarget.style.borderColor = 'var(--glass-border)'; }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: selSub?.id === 'EXTRA' ? 'var(--warning)' : 'rgba(245,158,11,0.12)',
                  color: selSub?.id === 'EXTRA' ? '#fff' : 'var(--warning)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: selSub?.id === 'EXTRA' ? 'var(--warning)' : 'inherit' }}>
                    رسوم إضافية
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    مخالفات، غرامات، امتيازات، وغيرها
                  </div>
                </div>
                <div style={{
                  padding: '2px 10px', borderRadius: 20,
                  background: selSub?.id === 'EXTRA' ? 'var(--warning)' : 'var(--glass-border)',
                  color: selSub?.id === 'EXTRA' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.65rem', fontWeight: 600,
                }}>
                  {selSub?.id === 'EXTRA' ? insts.length : (allInsts.filter(i => i.subscriptionType === 'EXTRA').length || 0)}
                </div>
              </div>
            </div>

            {/* 2. أقساط الاشتراك */}
            {selSub && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <CreditCard size={14} color="var(--secondary)" />
                  <span>{selSub.id === 'EXTRA' ? 'الرسوم الإضافية' : `أقساط ${subName(selSub)}`}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>({insts.length})</span>
                  {unpaidInsts.length > 1 && selSub.id !== 'EXTRA' && (
                    <button onClick={() => {
                      const cnt = unpaidInsts.length;
                      const total = unpaidInsts.reduce((s, i) => s + i.remainingAmount, 0);
                      setScheduleData(distributeSchedule(cnt, total, unpaidInsts.map(i => ({ id: i.id, amount: i.amount, dueDate: i.dueDate.split('T')[0] }))) ?? []);
                      setScheduleCount(cnt);
                      setScheduleTotal(total);
                      setShowSchedule(true);
                    }} style={{
                      marginRight: 'auto', padding: '8px 24px', borderRadius: 12, cursor: 'pointer',
                      fontSize: '0.82rem', fontWeight: 700, border: 'none',
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #6366f1 100%)',
                      backgroundSize: '200% 100%',
                      color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 6px 24px rgba(99,102,241,0.45)',
                      letterSpacing: '0.3px',
                    }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.04)';
                        e.currentTarget.style.backgroundPosition = '100% 0';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.backgroundPosition = '0% 0';
                      }}>
                      <Calendar size={18} /> جدولة الأقساط
                    </button>
                  )}
                </div>
                {insts.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 20px', background: 'var(--glass-bg)', borderRadius: 10 }}>
                    <p style={{ fontSize: '0.82rem' }}>{selSub.id === 'EXTRA' ? 'لا توجد رسوم إضافية' : 'لا توجد أقساط'}</p>
                  </div>
                ) : (
                  <div className="glass-table-container">
                    <table className="glass-table" style={{ fontSize: '0.72rem' }}>
                      <thead>
                        <tr><th>#</th><th>النوع</th><th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>الاستحقاق</th><th>الحالة</th></tr>
                      </thead>
                      <tbody>
                        {insts.map(inst => {
                          const st = ST[inst.status] || { label: inst.status, cls: 'secondary' };
                          const active = selInst?.id === inst.id;
                          const cat = catLabel(inst);
                          return (
                            <tr key={inst.id} onClick={() => selectInst(inst)} style={{ cursor: 'pointer' }} className={active ? 'active' : ''}>
                              <td style={{ fontFamily: 'monospace' }}>{inst.installmentNumber}/{inst.totalInstallments}</td>
                              <td>{cat ? <span className={`badge ${cat.cls}`} style={{ fontSize: '0.5rem' }}>{cat.label}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>—</span>}</td>
                              <td style={{ direction: 'ltr', fontFamily: 'monospace' }}>{inst.amount.toFixed(2)}</td>
                              <td style={{ direction: 'ltr', fontFamily: 'monospace', color: inst.paidAmount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{inst.paidAmount > 0 ? inst.paidAmount.toFixed(2) : '—'}</td>
                              <td style={{ direction: 'ltr', fontFamily: 'monospace', color: inst.remainingAmount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{inst.remainingAmount > 0 ? inst.remainingAmount.toFixed(2) : '—'}</td>
                              <td style={{ fontSize: '0.65rem' }}>{formatDate(inst.dueDate)}</td>
                              <td><span className={`badge ${st.cls}`} style={{ fontSize: '0.52rem' }}>{st.label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. سجل الدفعات */}
            {selInst && txs.length > 0 && (
              <div>
                <div className="section-title">
                  <Clock size={13} color="var(--primary)" />
                  سجل الدفعات ({txs.length})
                </div>
                <div style={{ position: 'relative', paddingRight: 22 }}>
                  <div style={{ position: 'absolute', right: 8, top: 4, bottom: 4, width: 2, background: 'var(--glass-border)', borderRadius: 2 }} />
                  {txs.map(tx => (
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
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.68rem' }}>
                          <span><strong>{tx.amount.toFixed(2)}</strong> د.أ</span>
                          <span style={{ color: 'var(--text-muted)' }}>{PML[tx.paymentMethod] || tx.paymentMethod}</span>
                          {tx.receiptNumber && (
                            <button onClick={() => printReceipt(tx)} style={{ padding: '0 6px', fontSize: '0.58rem', cursor: 'pointer', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--primary)', background: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Printer size={8} /> سند #{tx.receiptNumber}
                            </button>
                          )}
                        </div>
                        {tx.notes && <div style={{ marginTop: 3, fontSize: '0.65rem', color: 'var(--text-muted)' }}>{tx.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selInst && txs.length === 0 && !isU && (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <p style={{ fontSize: '0.82rem' }}>لا توجد دفعات سابقة لهذا القسط</p>
              </div>
            )}

            </>
        )}

      </div>

      {/* ===== Schedule Modal ===== */}
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
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </div>
                جدولة الأقساط
              </h3>
              <button className="modal-close" onClick={() => setShowSchedule(false)}><X size={18}/></button>
            </div>

            {/* Summary bar */}
            <div style={{
              padding: '14px 24px',
              background: 'var(--glass-bg)',
              borderBottom: '1px solid var(--glass-border)',
            }}>
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
                        const cnt = Math.max(1, scheduleCount - 1);
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

            {/* Installment rows */}
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
                        <input type="date" className="glass-input" value={s.dueDate}
                          onChange={e => {
                            const newData = [...scheduleData];
                            newData[idx] = { ...newData[idx], dueDate: e.target.value };
                            setScheduleData(newData);
                          }}
                          style={{ fontSize: '0.82rem' }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex', gap: 10,
            }}>
              {hasPermission('finance.installments') && (
                <button className="glass-btn" onClick={handleScheduleSave} disabled={saving || scheduleData.length === 0}
                  style={{
                    flex: 1, justifyContent: 'center', fontSize: '0.85rem', padding: '12px',
                    background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff'
                  }}>
                  <Save size={15} /> {saving ? 'جارٍ الحفظ...' : 'حفظ جدولة الأقساط'}
                </button>
              )}
              <button className="glass-btn secondary" onClick={() => setShowSchedule(false)}
                style={{ fontSize: '0.85rem', padding: '12px 20px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <DeepSearchModal isOpen={isDeep} onClose={() => setIsDeep(false)} onSearch={() => {}} onSelectStudent={(s: any) => { selectStudent(s); setIsDeep(false); }} initialFilters={{}} />

    </div>
  );
};
