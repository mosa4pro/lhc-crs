import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, FileText, Plus, X, DollarSign, Printer,
  Clock, AlertTriangle, CreditCard, Calendar, User, Filter, Banknote, Building2, Briefcase, GraduationCap
} from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PAYMENT_METHODS, BANK_OPTIONS } from '../utils/constants';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { DateField } from '../components/DateField';
import { printHeaderHTML } from '../utils/print';


interface FinTx {
  id: number;
  studentId: string | null;
  subscriptionId: string | null;
  subscriptionType: string | null;
  installmentId: number | null;
  type: string;
  amount: number;
  paymentMethod: string;
  date: string;
  status: string;
  receiptNumber: string;
  referenceNumber: string | null;
  universityShare: number;
  centerShare: number;
  employeeCommission: number;
  lecturerCost: number;
  expenseCategory: string | null;
  notes: string | null;
  student?: { id: string; fullNameAr: string; fullNameEn?: string } | null;
  createdAt: string;
}

interface FinSummary {
  totalReceived: number;
  totalPayments: number;
  netRevenue: number;
  monthlyReceipts: { amount: number; count: number };
  todayReceipts: { amount: number; count: number };
  pendingInstallments: { amount: number; count: number };
  overdueInstallments: { amount: number; count: number };
}

const EXPENSE_CATEGORIES = [
  { value: 'SALARY', label: 'رواتب' },
  { value: 'RENT', label: 'إيجار' },
  { value: 'UTILITIES', label: 'فواتير' },
  { value: 'SUPPLIES', label: 'لوازم' },
  { value: 'MARKETING', label: 'تسويق' },
  { value: 'MAINTENANCE', label: 'صيانة' },
  { value: 'REFUND', label: 'استرجاع مبلغ لطالب' },
  { value: 'OTHER', label: 'أخرى' },
];

const TX_LABEL: Record<string, string> = {
  RECEIPT: 'سند قبض', PAYMENT: 'سند صرف', ADJUSTMENT: 'تسوية', EXPENSE: 'مصروف',
};
const TX_CLASS: Record<string, string> = {
  RECEIPT: 'success', PAYMENT: 'danger', ADJUSTMENT: 'warning', EXPENSE: 'danger',
};
const PML: Record<string, string> = {
  CASH: 'نقدي', BANK: 'حوالة بنكية', CARD: 'بطاقة', TRANSFER: 'تحويل إلكتروني',
  WALLET: 'محفظة إلكترونية', CLICK: 'حوالة كليك', ENTITY: 'جهة', CHECK: 'شيك',
};

const mI: Record<string, string> = {
  CASH: '💵', TRANSFER: '📲', WALLET: '📱',
  CHECK: '📄', ENTITY: '🏫', CARD: '💳',
};

const PAYER_TYPES = [
  { value: 'STUDENT', label: 'طالب', icon: <GraduationCap size={14} /> },
  { value: 'EMPLOYEE', label: 'موظف', icon: <Briefcase size={14} /> },
  { value: 'ENTITY', label: 'جهة تعليم', icon: <Building2 size={14} /> },
];

const MET = [
  { value: 'CASH', label: '💰 نقداً' },
  { value: 'TRANSFER', label: '📲 إلكتروني' },
  { value: 'CHECK', label: '📄 شيك' },
  { value: 'MONEY_TRANSFER', label: '🌍 حوالة مالية' },
];

const WALLET_OPTS = [
  { value: 'CLICK', label: 'Click كليك' },
  { value: 'ZAIN_CASH', label: 'زين كاش (Zain Cash)' },
  { value: 'ORANGE_MONEY', label: 'اورنج موني (Orange Money)' },
  { value: 'U_WALLET', label: 'محفظة أمنية (UWallet)' },
  { value: 'DINARAK', label: 'دينارك (Dinarak)' },
  { value: 'ALAWNEH', label: 'علاونة' },
  { value: 'FAWATEERKOM', label: 'فواتيركم (مدفوعاتكم)' },
];

const HAWALA_OPTS = [
  { value: 'WESTERN_UNION', label: 'ويسترن يونيون (Western Union)' },
  { value: 'MONEYGRAM', label: 'MoneyGram' },
  { value: 'RIA_MONEY', label: 'RIA Money' },
];

const sx = { position: 'fixed' as const, inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 20 };
const mbox: React.CSSProperties = { background: 'var(--modal-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', borderRadius: 22, border: '1px solid var(--glass-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)', direction: 'rtl' };
const gl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 };
const rq: React.CSSProperties = { color: 'var(--danger)', marginRight: 2 };
const dd: React.CSSProperties = { height: 1, background: 'var(--glass-border)', border: 'none', margin: '12px 0' };

export const FinReceiptsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission, centerName, centerNameEn, centerLogo } = useAuth();
  const toast = useToast();

  const [summary, setSummary] = useState<FinSummary | null>(null);
  const [transactions, setTransactions] = useState<FinTx[]>([]);
  const [filterTab, setFilterTab] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [filterStudentName, setFilterStudentName] = useState('');
  const [students, setStudents] = useState<FinTx['student'][]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [selectedTx, setSelectedTx] = useState<FinTx | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<'RECEIPT' | 'PAYMENT' | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Receipt form
  const [rPayerType, setRPayerType] = useState<'STUDENT' | 'EMPLOYEE' | 'ENTITY'>('STUDENT');
  const [rPayerId, setRPayerId] = useState('');
  const [rPayerName, setRPayerName] = useState('');
  const [rPayerResults, setRPayerResults] = useState<any[]>([]);
  const [showRPayer, setShowRPayer] = useState(false);
  const rPayerRef = useRef<HTMLDivElement>(null);
  const [rAmount, setRAmount] = useState('');
  const [rDest, setRDest] = useState<'ENTITY' | 'US'>('ENTITY');
  const [rMethod, setRMethod] = useState('CASH');
  const [rSubMethod, setRSubMethod] = useState('');
  const [rRef, setRRef] = useState('');
  const [rWalletRef, setRWalletRef] = useState('');
  const [rBank, setRBank] = useState('');
  const [rCheckNum, setRCheckNum] = useState('');
  const [rHawalaNum, setRHawalaNum] = useState('');
  const [rNotes, setRNotes] = useState('');
  const [rDeduct, setRDeduct] = useState(true);
  const [rBalance, setRBalance] = useState<number | null>(null);
  const [rInstCount, setRInstCount] = useState(0);

  // Deep search
  const [isDeepSearchOpen, setIsDeepSearchOpen] = useState(false);
  const [deepSearchTarget, setDeepSearchTarget] = useState<'RECEIPT' | 'REFUND'>('RECEIPT');

  // Payer search (entities cache for select dropdown)
  const [entities, setEntities] = useState<any[]>([]);

  // Payment form
  const [pAmount, setPAmount] = useState('');
  const [pMethod, setPMethod] = useState('CASH');
  const [pCategory, setPCategory] = useState('OTHER');
  const [pBeneficiary, setPBeneficiary] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pStudentId, setPStudentId] = useState('');
  const [pStudentName, setPStudentName] = useState('');
  const [pSearchResults, setPSearchResults] = useState<any[]>([]);
  const [showPSearch, setShowPSearch] = useState(false);
  const pSearchRef = useRef<HTMLDivElement>(null);

  const [voidTarget, setVoidTarget] = useState<FinTx | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const r = await apiFetch('/financial/summary');
      if (r) setSummary(r);
    } catch {}
  }, [apiFetch]);

  const loadTransactions = useCallback(async (filters?: string) => {
    setLoading(true);
    try {
      const q = filters || '';
      const r = await apiFetch(`/financial${q}`);
      setTransactions(Array.isArray(r) ? r : []);
    } catch { setTransactions([]); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => {
    loadSummary();
    loadTransactions();
  }, [loadSummary, loadTransactions]);

  const fetchBalance = useCallback(async (sid: string) => {
    try {
      const r = await apiFetch(`/financial/students/${sid}/installment-balance`);
      if (r) { setRBalance(r.balance); setRInstCount(r.totalInstallments); }
    } catch { setRBalance(null); setRInstCount(0); }
  }, [apiFetch]);

  // Load entities for payer select dropdown
  useEffect(() => {
    apiFetch('/educational-entities').then(r => setEntities(Array.isArray(r) ? r : [])).catch(() => {});
  }, [apiFetch]);

  const buildFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (filterTab !== 'ALL') {
      if (filterTab === 'REFUND') params.set('type', 'PAYMENT');
      else params.set('type', filterTab);
    }
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (studentQuery) params.set('studentId', studentQuery);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filterTab, dateFrom, dateTo, studentQuery]);

  useEffect(() => {
    loadTransactions(buildFilters());
  }, [buildFilters, loadTransactions]);

  const searchStudents = useCallback(async (q: string) => {
    if (!q.trim()) { setStudents([]); return; }
    try {
      const res = await apiFetch(`/students?query=${encodeURIComponent(q)}&limit=10`);
      setStudents(Array.isArray(res) ? res : res?.data || []);
      setShowDropdown(true);
    } catch { setStudents([]); }
  }, [apiFetch]);

  const handleDeepSelectStudent = useCallback((s: any) => {
    if (deepSearchTarget === 'RECEIPT') {
      setRPayerId(s.id);
      setRPayerName(s.fullNameAr);
      fetchBalance(s.id);
    } else {
      setPStudentId(s.id);
      setPStudentName(s.fullNameAr);
    }
    setIsDeepSearchOpen(false);
  }, [deepSearchTarget, fetchBalance]);

  const handleCreateReceipt = async () => {
    if (rPayerType === 'STUDENT') {
      if (!rPayerId) { toast.error('اختر الطالب'); return; }
    } else if (!rPayerName.trim()) { toast.error('الرجاء إدخال اسم الدافع'); return; }
    if (!rAmount || parseFloat(rAmount) <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (!rRef.trim()) { toast.error('رقم المرجع مطلوب'); return; }
    if (rMethod === 'TRANSFER' && !rSubMethod) { toast.error('يرجى اختيار نوع المحفظة'); return; }
    if (rMethod === 'CHECK') { if (!rBank) { toast.error('يرجى اختيار البنك'); return; } if (!rCheckNum.trim()) { toast.error('رقم الشيك مطلوب'); return; } }
    if (rMethod === 'MONEY_TRANSFER') { if (!rSubMethod) { toast.error('يرجى اختيار نوع الحوالة'); return; } if (!rHawalaNum.trim()) { toast.error('رقم الحوالة مطلوب'); return; } }
    setSaving(true);
    try {
      let finalMethod = rMethod;
      if (rDest === 'ENTITY') finalMethod = 'ENTITY';
      else if (rMethod === 'TRANSFER') finalMethod = 'WALLET';
      else if (rMethod === 'MONEY_TRANSFER') finalMethod = 'TRANSFER';

      const body: any = {
        amount: parseFloat(rAmount),
        paymentMethod: finalMethod,
        referenceNumber: rRef,
        paymentDest: rDest,
        notes: rNotes || undefined,
      };
      if (rPayerType === 'STUDENT') {
        body.studentId = rPayerId;
      } else {
        const payerLabel = rPayerType === 'EMPLOYEE' ? 'موظف' : 'جهة تعليم';
        body.notes = `مدفوع من ${payerLabel}: ${rPayerName}${rNotes ? ' — ' + rNotes : ''}`;
      }
      if (rMethod === 'TRANSFER') { body.paymentSubMethod = rSubMethod; if (rWalletRef) body.paymentWalletRef = rWalletRef; }
      if (rMethod === 'CHECK') { body.paymentBank = rBank; body.checkNumber = rCheckNum; }
      if (rMethod === 'MONEY_TRANSFER') { body.paymentSubMethod = rSubMethod; body.hawalaNumber = rHawalaNum; }

      if (rDeduct && rBalance && rBalance > 0 && rPayerType === 'STUDENT') {
        await apiFetch('/financial/pay-student', { method: 'POST', body: JSON.stringify(body) });
        toast.success('تم الدفع وخصم المبلغ من الدفعات');
      } else {
        await apiFetch('/financial/receipt', { method: 'POST', body: JSON.stringify(body) });
        toast.success('تم إنشاء سند القبض');
      }
      setShowCreateModal(null);
      resetReceiptForm();
      loadSummary();
      loadTransactions(buildFilters());
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  const handleCreatePayment = async () => {
    if (!pAmount || parseFloat(pAmount) <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (pCategory === 'REFUND' && !pStudentId) { toast.error('اختر الطالب المستحق له المرتجع'); return; }
    setSaving(true);
    try {
      const body: any = { amount: parseFloat(pAmount), paymentMethod: pMethod, expenseCategory: pCategory, beneficiary: pBeneficiary || undefined, notes: pNotes || undefined };
      if (pCategory === 'REFUND' && pStudentId) body.studentId = pStudentId;
      await apiFetch('/financial/payment', { method: 'POST', body: JSON.stringify(body) });
      toast.success('تم إنشاء سند الصرف');
      setShowCreateModal(null);
      resetPaymentForm();
      loadSummary();
      loadTransactions(buildFilters());
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/financial/${voidTarget.id}/void`, { method: 'PUT', body: JSON.stringify({ reason: voidReason || undefined }) });
      toast.success('تم إلغاء المعاملة');
      setVoidTarget(null); setVoidReason(''); setSelectedTx(null);
      loadSummary(); loadTransactions(buildFilters());
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setSaving(false); }
  };

  const searchPayer = useCallback((q: string) => {
    if (!q.trim()) { setRPayerResults([]); return; }
    if (rPayerType === 'STUDENT') {
      apiFetch(`/students?query=${encodeURIComponent(q)}&limit=10`).then(r => {
        const list = Array.isArray(r) ? r : r?.data || [];
        setRPayerResults(list); setShowRPayer(list.length > 0);
      }).catch(() => setRPayerResults([]));
    } else if (rPayerType === 'EMPLOYEE') {
      apiFetch(`/employees?query=${encodeURIComponent(q)}`).then(r => {
        const list = Array.isArray(r) ? r : [];
        setRPayerResults(list); setShowRPayer(list.length > 0);
      }).catch(() => setRPayerResults([]));
    }
  }, [rPayerType, apiFetch]);

  const selectPayer = useCallback((s: any) => {
    setRPayerId(rPayerType === 'STUDENT' ? s.id : String(s.id));
    setRPayerName(s.fullNameAr || s.fullName || s.name);
    setShowRPayer(false);
    if (rPayerType === 'STUDENT') fetchBalance(s.id);
  }, [rPayerType, fetchBalance]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (rPayerRef.current && !rPayerRef.current.contains(e.target as Node)) setShowRPayer(false);
      if (pSearchRef.current && !pSearchRef.current.contains(e.target as Node)) setShowPSearch(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const resetReceiptForm = () => {
    setRPayerType('STUDENT'); setRPayerId(''); setRPayerName(''); setRAmount('');
    setRDest('ENTITY'); setRMethod('CASH'); setRSubMethod(''); setRRef(''); setRWalletRef('');
    setRBank(''); setRCheckNum(''); setRHawalaNum('');
    setRNotes(''); setRBalance(null); setRInstCount(0); setRDeduct(true);
  };
  const resetPaymentForm = () => {
    setPAmount(''); setPMethod('CASH'); setPCategory('OTHER');
    setPBeneficiary(''); setPNotes(''); setPStudentId(''); setPStudentName('');
  };

  const filtered = filterTab === 'REFUND'
    ? transactions.filter(t => t.type === 'PAYMENT' && t.expenseCategory === 'REFUND')
    : transactions;

  const clearFilters = () => { setStudentQuery(''); setFilterStudentName(''); setDateFrom(''); setDateTo(''); setFilterTab('ALL'); };
  const hasActiveFilters = studentQuery || dateFrom || dateTo || filterTab !== 'ALL';

  const printReceipt = (tx: FinTx) => {
    const w = window.open('', '_blank');
    if (!w) return;
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
${printHeaderHTML({ name: centerName, nameEn: centerNameEn, logo: centerLogo })}
<h1>سند قبض</h1>
<div class="sub">${formatDate(new Date())}</div>
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
<div class="ft">شكراً لثقتكم — ${centerName || 'مركزنا التعليمي'}</div>
<script>setTimeout(()=>{window.print()},600)</script>
</body></html>`);
    w.document.close();
  };

  const TABS = [
    { key: 'ALL', label: 'الكل' }, { key: 'RECEIPT', label: 'سندات قبض' },
    { key: 'PAYMENT', label: 'مصروفات' }, { key: 'REFUND', label: 'مرتجعات' },
  ];

  const SubFields = () => rMethod === 'TRANSFER' ? (
    <div style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
      <div style={{ marginBottom: 6 }}>
        <label style={{ ...gl, fontSize: '0.72rem' }}>نوع المحفظة <span style={rq}>*</span></label>
        <select className="glass-input" value={rSubMethod} onChange={e => setRSubMethod(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '5px 8px' }}>
          <option value="">— اختر —</option>
          {WALLET_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ ...gl, fontSize: '0.72rem' }}>رقم العملية</label>
        <input type="text" className="glass-input" value={rWalletRef} onChange={e => setRWalletRef(e.target.value)}
          placeholder="اختياري" style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr' }} />
      </div>
    </div>
  ) : rMethod === 'CHECK' ? (
    <div style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
      <div style={{ marginBottom: 6 }}>
        <label style={{ ...gl, fontSize: '0.72rem' }}>البنك <span style={rq}>*</span></label>
        <select className="glass-input" value={rBank} onChange={e => setRBank(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '5px 8px' }}>
          <option value="">— اختر —</option>
          {BANK_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ ...gl, fontSize: '0.72rem' }}>رقم الشيك <span style={rq}>*</span></label>
        <input type="text" className="glass-input" value={rCheckNum} onChange={e => setRCheckNum(e.target.value)}
          placeholder="رقم الشيك" style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr' }} />
      </div>
    </div>
  ) : rMethod === 'MONEY_TRANSFER' ? (
    <div style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
      <div style={{ marginBottom: 6 }}>
        <label style={{ ...gl, fontSize: '0.72rem' }}>نوع الحوالة <span style={rq}>*</span></label>
        <select className="glass-input" value={rSubMethod} onChange={e => setRSubMethod(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '5px 8px' }}>
          <option value="">— اختر —</option>
          {HAWALA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ ...gl, fontSize: '0.72rem' }}>رقم الحوالة <span style={rq}>*</span></label>
        <input type="text" className="glass-input" value={rHawalaNum} onChange={e => setRHawalaNum(e.target.value)}
          placeholder="رقم الحوالة" style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr' }} />
      </div>
    </div>
  ) : null;

  return (
    <div style={{ minHeight: 'calc(100vh - 140px)' }}>

      {/* ═══════ Stats ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { cls: 'green', ico: <DollarSign size={17} />, c: '#10b981', label: 'مدفوع اليوم', val: summary?.todayReceipts.amount.toFixed(2) || '0.00', sub: `${summary?.todayReceipts.count || 0} معاملة` },
          { cls: 'blue', ico: <Calendar size={17} />, c: '#3b82f6', label: 'الشهر الحالي', val: summary?.monthlyReceipts.amount.toFixed(2) || '0.00', sub: `${summary?.monthlyReceipts.count || 0} معاملة` },
          { cls: 'amber', ico: <Clock size={17} />, c: '#f59e0b', label: 'قسط بانتظار', val: (summary?.pendingInstallments.amount || 0).toFixed(2), sub: `${summary?.pendingInstallments.count || 0} قسط` },
          { cls: '', ico: <Banknote size={17} />, c: '#6366f1', label: 'صافي الإيرادات', val: (summary?.netRevenue || 0).toFixed(2), sub: 'د.أ' },
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

      {/* ═══════ Filters ═══════ */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: 14, border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div ref={searchRef} style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <label style={{ ...gl, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> بحث عن طالب</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
              <input type="text" className="glass-input" placeholder="اسم الطالب أو الرقم..."
                value={filterStudentName || studentQuery}
                onChange={e => { setFilterStudentName(''); setStudentQuery(e.target.value); searchStudents(e.target.value); }}
                onFocus={() => { if (students.length > 0) setShowDropdown(true); }}
                style={{ fontSize: '0.8rem', paddingRight: 26, paddingLeft: filterStudentName ? 90 : 8 }}
              />
              {filterStudentName && (
                <span style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', fontSize: '0.58rem', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 1, fontWeight: 500 }}>
                  {filterStudentName}
                  <X size={9} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => { setFilterStudentName(''); setStudentQuery(''); }} />
                </span>
              )}
            </div>
            {showDropdown && students.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--card-bg)', borderRadius: 8, marginTop: 3, border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: 180, overflowY: 'auto' }}>
                {students.map((s: any) => (
                  <div key={s.id} onClick={() => { setStudentQuery(s.id); setFilterStudentName(s.fullNameAr); setShowDropdown(false); }}
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
          <div style={{ minWidth: 130 }}>
            <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>من تاريخ</label>
            <DateField value={dateFrom} onChange={v => setDateFrom(v)} style={{ minWidth: 250 }} selectStyle={{ fontSize: '0.8rem', padding: '6px 9px' }} />
          </div>
          <div style={{ minWidth: 130 }}>
            <label style={{ ...gl, fontSize: '0.7rem', marginBottom: 3 }}>إلى تاريخ</label>
            <DateField value={dateTo} onChange={v => setDateTo(v)} style={{ minWidth: 250 }} selectStyle={{ fontSize: '0.8rem', padding: '6px 9px' }} />
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', paddingBottom: 1 }}>
            <button className="glass-btn icon-btn sm" onClick={clearFilters} title="مسح الفلاتر" style={{ opacity: hasActiveFilters ? 1 : 0.35, transition: 'opacity .15s' }}><X size={13} /></button>
            <button className="glass-btn icon-btn sm" onClick={() => { loadSummary(); loadTransactions(buildFilters()); }} title="تحديث"><RefreshCw size={13} /></button>
          </div>
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--glass-border)', alignItems: 'center' }}>
            {filterTab !== 'ALL' && <span style={{ fontSize: '0.58rem', background: 'var(--glass-bg)', padding: '2px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}><Filter size={9} /> {TABS.find(t => t.key === filterTab)?.label}</span>}
            {filterStudentName && <span style={{ fontSize: '0.58rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}><User size={9} /> {filterStudentName}</span>}
            {(dateFrom || dateTo) && <span style={{ fontSize: '0.58rem', background: 'var(--glass-bg)', padding: '2px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}><Calendar size={9} /> {dateFrom || '...'} → {dateTo || '...'}</span>}
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginRight: 'auto', fontWeight: 500 }}>{filtered.length} {filtered.length === 1 ? 'نتيجة' : 'نتائج'}</span>
          </div>
        )}
      </div>

      {/* ═══════ Tabs + Actions ═══════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} className={`glass-btn sm ${filterTab === t.key ? '' : 'secondary'}`}
              onClick={() => setFilterTab(t.key)}
              style={{ fontSize: '0.74rem', padding: '5px 12px', background: filterTab === t.key ? 'var(--primary)' : undefined, color: filterTab === t.key ? '#fff' : undefined, fontWeight: filterTab === t.key ? 600 : 400, borderRadius: 7, transition: 'all .12s' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasPermission('finance.receipts') && (
            <button className="glass-btn sm" onClick={() => setShowCreateModal('RECEIPT')}
              style={{ fontSize: '0.74rem', borderColor: 'var(--success)', color: 'var(--success)', background: 'rgba(16,185,129,0.08)', borderRadius: 7 }}>
              <Plus size={12} /> سند قبض جديد
            </button>
          )}
          {hasPermission('finance.payments') && (
            <button className="glass-btn sm secondary" onClick={() => setShowCreateModal('PAYMENT')}
              style={{ fontSize: '0.74rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', borderRadius: 7 }}>
              <Plus size={12} /> سند صرف
            </button>
          )}
        </div>
      </div>

      {/* ═══════ Transactions Table ═══════ */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          <table className="glass-table" style={{ fontSize: '0.72rem', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '9px 12px', width: 70, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}># السند</th>
                <th style={{ padding: '9px 12px', width: 80, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>التاريخ</th>
                <th style={{ padding: '9px 12px', width: 60, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>النوع</th>
                <th style={{ padding: '9px 12px', fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>الطالب/الدافع</th>
                <th style={{ padding: '9px 12px', width: 80, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>المبلغ</th>
                <th style={{ padding: '9px 12px', width: 75, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>طريقة الدفع</th>
                <th style={{ padding: '9px 12px', width: 75, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>رقم المرجع</th>
                <th style={{ padding: '9px 12px', width: 50, fontWeight: 600, fontSize: '0.66rem', color: 'var(--text-muted)' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><RefreshCw size={18} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 8px', display: 'block', opacity: 0.5 }} /> جارٍ التحميل...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><FileText size={24} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} /> لا توجد معاملات</td></tr>
              ) : filtered.map(tx => (
                <tr key={tx.id} onClick={() => setSelectedTx(tx)} className={selectedTx?.id === tx.id ? 'active' : ''} style={{ cursor: 'pointer', transition: 'background .12s' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.66rem', padding: '9px 12px', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>{tx.receiptNumber}</td>
                  <td style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', padding: '9px 12px' }}>{formatDate(tx.date)}</td>
                  <td style={{ padding: '9px 12px' }}><span className={`badge ${TX_CLASS[tx.type] || 'secondary'}`} style={{ fontSize: '0.56rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{TX_LABEL[tx.type] || tx.type}</span></td>
                  <td style={{ fontSize: '0.7rem', padding: '9px 12px' }}>
                    {tx.student?.fullNameAr ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 700, flexShrink: 0 }}>{tx.student.fullNameAr.charAt(0)}</div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{tx.student.fullNameAr}</span>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{tx.notes?.startsWith('مدفوع من') ? tx.notes.split('—')[0].trim() : '—'}</span>}
                  </td>
                  <td style={{ direction: 'ltr', fontFamily: 'monospace', fontWeight: 700, padding: '9px 12px', fontSize: '0.76rem', color: tx.type === 'RECEIPT' ? 'var(--success)' : 'var(--danger)' }}>{tx.type === 'RECEIPT' ? '+' : '-'}{tx.amount.toFixed(2)}</td>
                  <td style={{ fontSize: '0.68rem', padding: '9px 12px' }}><span style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>{mI[tx.paymentMethod] && <span>{mI[tx.paymentMethod]}</span>}{PML[tx.paymentMethod] || tx.paymentMethod}</span></td>
                  <td style={{ fontSize: '0.68rem', padding: '9px 12px', color: tx.referenceNumber ? undefined : 'var(--text-muted)' }}>{tx.referenceNumber || '—'}</td>
                  <td style={{ padding: '9px 12px' }}><span className={`badge ${tx.status === 'COMPLETED' ? 'success' : 'secondary'}`} style={{ fontSize: '0.56rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{tx.status === 'COMPLETED' ? 'مكتمل' : 'ملغي'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ Transaction Detail Modal ═══════ */}
      {selectedTx && (
        <div style={sx} onClick={e => { if (e.target === e.currentTarget) setSelectedTx(null); }}>
          <div style={{ ...mbox, width: '100%', maxWidth: 580, maxHeight: '80vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 28, height: 28, borderRadius: 7, background: selectedTx.type === 'RECEIPT' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: selectedTx.type === 'RECEIPT' ? '#10b981' : '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} /></span>
                {TX_LABEL[selectedTx.type] || 'معاملة'} <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{selectedTx.receiptNumber}</span>
              </h3>
              <button className="modal-close" onClick={() => setSelectedTx(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ padding: '14px 16px', background: 'var(--glass-bg)', borderRadius: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '0.8rem' }}>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>التاريخ</div><div style={{ fontWeight: 600 }}>{formatDate(selectedTx.date)}</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>الحالة</div><span className={`badge ${selectedTx.status === 'COMPLETED' ? 'success' : 'secondary'}`} style={{ fontSize: '0.6rem', padding: '2px 7px' }}>{selectedTx.status === 'COMPLETED' ? 'مكتمل' : 'ملغي'}</span></div>
                  {selectedTx.student && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>الطالب</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0 }}>{selectedTx.student.fullNameAr.charAt(0)}</div>
                        {selectedTx.student.fullNameAr}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 400 }}>#{selectedTx.student.id}</span>
                      </div>
                    </div>
                  )}
                  <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>المبلغ</div><div style={{ fontWeight: 700, fontSize: '1.1rem', color: selectedTx.type === 'RECEIPT' ? 'var(--success)' : 'var(--danger)' }}>{selectedTx.amount.toFixed(2)} د.أ</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>طريقة الدفع</div><div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>{mI[selectedTx.paymentMethod] && <span>{mI[selectedTx.paymentMethod]}</span>}{PML[selectedTx.paymentMethod] || selectedTx.paymentMethod}</div></div>
                  {selectedTx.referenceNumber && <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>رقم المرجع</div><div style={{ fontWeight: 500, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{selectedTx.referenceNumber}</div></div>}
                  {selectedTx.expenseCategory && <div><div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 2, fontWeight: 500 }}>التصنيف</div><div style={{ fontWeight: 500 }}>{EXPENSE_CATEGORIES.find(c => c.value === selectedTx.expenseCategory)?.label || selectedTx.expenseCategory}</div></div>}
                </div>
                {selectedTx.notes && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 7, fontSize: '0.78rem', border: '1px solid var(--glass-border)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginBottom: 3, fontWeight: 500 }}>ملاحظات</div>
                    {selectedTx.notes.startsWith('مدفوع من') ? <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{selectedTx.notes}</span> : selectedTx.notes}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--card-bg)', borderRadius: '0 0 22px 22px' }}>
              {selectedTx.type === 'RECEIPT' && selectedTx.status === 'COMPLETED' && <button className="glass-btn" onClick={() => printReceipt(selectedTx)} style={{ fontSize: '0.8rem' }}><Printer size={13} /> طباعة</button>}
              {selectedTx.status === 'COMPLETED' && <button className="glass-btn secondary" onClick={() => { setVoidTarget(selectedTx); }} style={{ color: 'var(--danger)', fontSize: '0.8rem', borderColor: 'var(--danger)' }}><X size={13} /> إلغاء</button>}
              <button className="glass-btn secondary" onClick={() => setSelectedTx(null)} style={{ fontSize: '0.8rem', marginRight: 'auto' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Create Receipt Modal ═══════ */}
      {showCreateModal === 'RECEIPT' && (
        <div style={sx} onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(null); }}>
          <div style={{ ...mbox, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#10b981', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} /></span>
                سند قبض جديد
              </h3>
              <button className="modal-close" onClick={() => setShowCreateModal(null)}><X size={16} /></button>
            </div>

            <div style={{ padding: '16px 22px 18px' }}>
              {/* Payer type selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {PAYER_TYPES.map(pt => (
                  <button key={pt.value} type="button" onClick={() => { setRPayerType(pt.value as typeof rPayerType); setRPayerId(''); setRPayerName(''); setRBalance(null); setRInstCount(0); }}
                    style={{
                      flex: 1, padding: '7px 8px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer',
                      fontSize: '0.74rem', fontWeight: 600, transition: 'all .12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      background: rPayerType === pt.value ? 'var(--primary)' : 'transparent',
                      color: rPayerType === pt.value ? '#fff' : 'var(--text)',
                      borderColor: rPayerType === pt.value ? 'var(--primary)' : 'var(--glass-border)',
                    }}>
                    {pt.icon} {pt.label}
                  </button>
                ))}
              </div>

              {/* Payer search / select */}
              {rPayerType === 'ENTITY' ? (
                <div ref={rPayerRef} style={{ marginBottom: 10, position: 'relative' }}>
                  <label style={gl}>الجهة التعليمية <span style={rq}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select className="glass-input" value={rPayerId}
                      onChange={e => {
                        const id = e.target.value;
                        const entity = entities.find((en: any) => String(en.id) === id);
                        setRPayerId(id);
                        setRPayerName(entity ? entity.name : '');
                      }}
                      style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                      <option value="">-- اختر الجهة --</option>
                      {entities.map((en: any) => (
                        <option key={en.id} value={en.id}>{en.name}</option>
                      ))}
                    </select>
                    {rPayerId && (
                      <span style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', fontSize: '0.58rem', background: 'var(--success)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap', zIndex: 1 }}>
                        ✓ تم
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div ref={rPayerRef} style={{ marginBottom: 10, position: 'relative' }}>
                  <label style={gl}>
                    {rPayerType === 'STUDENT' ? 'الطالب' : 'الموظف'} <span style={rq}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input type="text" className="glass-input"
                        placeholder={rPayerType === 'STUDENT' ? 'اسم الطالب...' : 'اسم الموظف...'}
                        value={rPayerName}
                        onChange={e => { setRPayerName(e.target.value); searchPayer(e.target.value); }}
                        onFocus={() => { if (rPayerResults.length > 0) setShowRPayer(true); }}
                        style={{ fontSize: '0.8rem', paddingLeft: rPayerId ? 100 : 8 }}
                      />
                      {rPayerId && (
                        <span style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', fontSize: '0.58rem', background: 'var(--success)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap', zIndex: 1 }}>
                          ✓ تم
                        </span>
                      )}
                    </div>
                    {rPayerType === 'STUDENT' && (
                      <button onClick={e => {
                          e.preventDefault();
                          setDeepSearchTarget('RECEIPT'); setIsDeepSearchOpen(true);
                        }}
                        style={{
                          padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                          border: '1.5px solid var(--danger)', background: 'rgba(239,68,68,0.08)',
                          borderRadius: 8, color: 'var(--danger)', fontWeight: 600, fontSize: '0.76rem',
                          display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}>
                        <Search size={13} /> بحث عميق
                      </button>
                    )}
                  </div>
                  {showRPayer && rPayerResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--card-bg)', borderRadius: 8, marginTop: 3, border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: 170, overflowY: 'auto' }}>
                      {rPayerResults.map((s: any) => (
                        <div key={s.id} onClick={() => selectPayer(s)}
                          style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', transition: 'background .12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700 }}>
                              {(s.fullNameAr || s.fullName || s.name)?.charAt(0)}
                            </div>
                            <span>{s.fullNameAr || s.fullName || s.name}</span>
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'monospace' }}>#{s.id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {rPayerType === 'STUDENT' && rPayerId && rBalance !== null && (
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${rBalance > 0 ? 'amber' : 'success'}`} style={{ fontSize: '0.58rem', padding: '2px 7px' }}>الرصيد: {rBalance.toFixed(2)} د.أ</span>
                      {rBalance > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox" checked={rDeduct} onChange={e => setRDeduct(e.target.checked)} /> خصم تلقائي
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Two-column: Amount + Destination */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={gl}>المبلغ (د.أ) <span style={rq}>*</span></label>
                  <input type="number" className="glass-input" placeholder="0.00" value={rAmount} onChange={e => setRAmount(e.target.value)}
                    step="0.01" min="0" style={{ fontSize: '1rem', direction: 'ltr', textAlign: 'center', fontWeight: 700, padding: '8px 10px', letterSpacing: '0.5px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={gl}>الوجهة <span style={rq}>*</span></label>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['ENTITY', 'US'].map(opt => (
                      <button key={opt} type="button" onClick={() => { setRDest(opt as 'ENTITY' | 'US'); setRMethod('CASH'); setRSubMethod(''); setRBank(''); setRCheckNum(''); setRHawalaNum(''); }}
                        style={{
                          flex: 1, padding: '7px 8px', borderRadius: 7, border: '1.5px solid', cursor: 'pointer',
                          fontSize: '0.72rem', fontWeight: 600, transition: 'all .12s',
                          background: rDest === opt ? 'var(--primary)' : 'transparent',
                          color: rDest === opt ? '#fff' : 'var(--text)',
                          borderColor: rDest === opt ? 'var(--primary)' : 'var(--glass-border)',
                        }}>
                        {opt === 'ENTITY' ? '🏫 جهة' : '🏢 لدينا'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment method grid */}
              <div style={{ marginBottom: 8 }}>
                <label style={gl}>طريقة الدفع <span style={rq}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {MET.map(m => (
                    <button key={m.value} type="button" onClick={() => { setRMethod(m.value); setRSubMethod(''); setRBank(''); setRCheckNum(''); setRHawalaNum(''); }}
                      style={{
                        padding: '7px 8px', borderRadius: 7, border: '1.5px solid', cursor: 'pointer',
                        fontSize: '0.76rem', fontWeight: 500, transition: 'all .12s',
                        background: rMethod === m.value ? 'var(--primary)' : 'transparent',
                        color: rMethod === m.value ? '#fff' : 'var(--text)',
                        borderColor: rMethod === m.value ? 'var(--primary)' : 'var(--glass-border)',
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-fields + Reference in a 2-column row */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SubFields />
                </div>
                <div style={{ width: rMethod === 'CASH' ? '100%' : '50%', minWidth: 0 }}>
                  <label style={gl}>رقم المرجع <span style={rq}>*</span></label>
                  <input type="text" className="glass-input" value={rRef} onChange={e => setRRef(e.target.value)}
                    placeholder="رقم الإيصال أو التحويل" style={{ fontSize: '0.8rem', padding: '7px 10px' }} />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginTop: 8 }}>
                <label style={gl}>ملاحظات</label>
                <textarea className="glass-input" rows={1} value={rNotes} onChange={e => setRNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..." style={{ fontSize: '0.8rem', padding: '7px 10px', resize: 'none' }} />
              </div>

              {/* Submit */}
              {hasPermission('finance.receipts') && (
                <button className="glass-btn" onClick={handleCreateReceipt} disabled={saving}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '10px', justifyContent: 'center', borderRadius: 8, marginTop: 12,
                    background: rDeduct && rBalance && rBalance > 0 && rPayerType === 'STUDENT' ? 'var(--primary)' : '#10b981',
                    borderColor: rDeduct && rBalance && rBalance > 0 && rPayerType === 'STUDENT' ? 'var(--primary)' : '#10b981',
                    color: '#fff', fontWeight: 600 }}>
                  <FileText size={14} /> {saving ? 'جارٍ...' : rDeduct && rBalance && rBalance > 0 && rPayerType === 'STUDENT' ? 'دفع وخصم من الدفعات' : 'إنشاء سند القبض'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Create Payment Modal ═══════ */}
      {showCreateModal === 'PAYMENT' && (
        <div style={sx} onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(null); }}>
          <div style={{ ...mbox, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#ef4444', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></span>
                سند صرف / مصروف
              </h3>
              <button className="modal-close" onClick={() => setShowCreateModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ marginBottom: 10 }}>
                <label style={gl}>المبلغ (د.أ)</label>
                <input type="number" className="glass-input" placeholder="0.00" value={pAmount} onChange={e => setPAmount(e.target.value)}
                  step="0.01" min="0" style={{ fontSize: '1rem', direction: 'ltr', textAlign: 'center', fontWeight: 700, padding: '8px 10px' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={gl}>التصنيف</label>
                <select className="glass-input" value={pCategory} onChange={e => setPCategory(e.target.value)} style={{ fontSize: '0.8rem', padding: '7px 10px' }}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {pCategory === 'REFUND' && (
                <div ref={pSearchRef} style={{ marginBottom: 10, position: 'relative' }}>
                  <label style={{ ...gl, color: 'var(--danger)' }}>الطالب المستحق</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                    <input type="text" className="glass-input" placeholder="اسم الطالب..." value={pStudentName}
                      onChange={e => { setPStudentName(e.target.value); searchStudents(e.target.value); }}
                      onFocus={() => { if (pSearchResults.length > 0) setShowPSearch(true); }}
                      style={{ fontSize: '0.8rem', flex: 1, padding: '7px 10px' }}
                    />
                    <button onClick={e => { e.preventDefault(); setDeepSearchTarget('REFUND'); setIsDeepSearchOpen(true); }}
                      style={{ padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: '1.5px solid var(--danger)', background: 'rgba(239,68,68,0.08)', borderRadius: 8, color: 'var(--danger)', fontWeight: 600, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}>
                      <Search size={13} /> بحث عميق
                    </button>
                  </div>
                  {showPSearch && pSearchResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--card-bg)', borderRadius: 8, marginTop: 3, border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: 160, overflowY: 'auto' }}>
                      {pSearchResults.map((s: any) => (
                        <div key={s.id} onClick={() => { setPStudentId(s.id); setPStudentName(s.fullNameAr); setShowPSearch(false); }}
                          style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', transition: 'background .12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span>{s.fullNameAr}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>#{s.id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {pStudentId && <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>✓ تم اختيار {pStudentName}</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <select className="glass-input" value={pMethod} onChange={e => setPMethod(e.target.value)} style={{ fontSize: '0.78rem', flex: 1, padding: '7px 10px' }}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input type="text" className="glass-input" placeholder="المستفيد (اختياري)" value={pBeneficiary} onChange={e => setPBeneficiary(e.target.value)} style={{ fontSize: '0.78rem', flex: 1, padding: '7px 10px' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <textarea className="glass-input" rows={1} placeholder="البيان (اختياري)" value={pNotes} onChange={e => setPNotes(e.target.value)} style={{ fontSize: '0.8rem', padding: '7px 10px', resize: 'none' }} />
              </div>
              {hasPermission('finance.payments') && (
                <button className="glass-btn" onClick={handleCreatePayment} disabled={saving}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '10px', justifyContent: 'center', borderRadius: 8, background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 600 }}>
                  <FileText size={14} /> {saving ? 'جارٍ...' : 'إنشاء سند الصرف'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Void Modal ═══════ */}
      {voidTarget && (
        <div style={sx} onClick={e => { if (e.target === e.currentTarget) setVoidTarget(null); }}>
          <div style={{ ...mbox, width: '100%', maxWidth: 400, padding: 22 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <AlertTriangle size={38} color="var(--danger)" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>إلغاء المعاملة</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                هل أنت متأكد من إلغاء {TX_LABEL[voidTarget.type]} رقم <strong>{voidTarget.receiptNumber}</strong> بقيمة <strong>{voidTarget.amount.toFixed(2)} د.أ</strong>؟
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...gl, fontSize: '0.78rem' }}>سبب الإلغاء</label>
              <textarea className="glass-input" rows={1} placeholder="اختياري" value={voidReason} onChange={e => setVoidReason(e.target.value)} style={{ fontSize: '0.8rem', padding: '7px 10px', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="glass-btn" onClick={handleVoid} disabled={saving}
                style={{ flex: 1, fontSize: '0.82rem', background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)', borderRadius: 8, padding: '9px' }}>
                {saving ? 'جارٍ...' : 'تأكيد الإلغاء'}
              </button>
              <button className="glass-btn secondary" onClick={() => setVoidTarget(null)} style={{ fontSize: '0.82rem', borderRadius: 8, padding: '9px 16px' }}>رجوع</button>
            </div>
          </div>
        </div>
      )}

      <DeepSearchModal
        isOpen={isDeepSearchOpen}
        onClose={() => setIsDeepSearchOpen(false)}
        onSelectStudent={handleDeepSelectStudent}
        onSearch={() => {}}
        showResultsInline={true}
      />

    </div>
  );
};
