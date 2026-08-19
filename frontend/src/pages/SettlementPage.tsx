import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText, Building2, Search, Plus, X, RefreshCw, ChevronDown, ChevronUp,
  DollarSign, Landmark, Wallet, CheckCircle2, Clock, Send, Ban, Lock,
  FileCheck, CreditCard, AlertTriangle, Filter, Layers, Users, Calendar,
  Printer, ExternalLink, TrendingUp, PiggyBank, CircleDollarSign
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/dateFormat';
import { toNumber, cleanDecimal } from '../utils/arabicNumbers';
import { normalizeDigits } from '../utils/constants';

const PML: Record<string, string> = { CASH: 'نقداً', BANK: 'حوالة بنكية', CARD: 'بطاقة', TRANSFER: 'تحويل إلكتروني', WALLET: 'محفظة إلكترونية', CLICK: 'حوالة كليك', ENTITY: 'جهة', CHECK: 'شيك', MONEY_TRANSFER: 'حوالة مالية' };
const BL: Record<string, string> = { Jordan_Ahli: 'الأهلي الأردني', Arab_Bank: 'العربي', Housing_Bank: 'الإسكان', Cairo_Amman: 'القاهرة عمان', Jordan_Kuwait: 'الأردني الكويتي', Islamic_Bank: 'الإسلامي الأردني', Safwa_Islamic: 'صفوة الإسلامي', Etihad: 'الاتحاد', Societe_Generale: 'سوسيتيه جنرال', Bank_of_Jordan: 'الأردن', Investbank: 'الاستثمار', Jordan_Commercial: 'التجاري الأردني', ABC: 'ABC', Standard_Chartered: 'ستاندارد تشارترد', BLOM: 'بلوم', Al_Rajhi: 'الراجحي', OTHER: 'آخر' };

const ST: Record<string, { label: string; cls: string }> = {
  UNSETTLED: { label: 'غير مسوى', cls: 'danger' },
  PARTIAL: { label: 'مسوى جزئياً', cls: 'warning' },
  SETTLED: { label: 'مسوى', cls: 'success' },
  NO_COLLECTION: { label: 'لا تحصيل', cls: 'secondary' },
};
const PT: Record<string, { label: string; cls: string }> = {
  UNPAID: { label: 'غير مدفوع', cls: 'secondary' },
  PARTIAL: { label: 'دفع جزئي', cls: 'warning' },
  PAID: { label: 'مدفوع بالكامل', cls: 'success' },
};
const CS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'مسودة', cls: 'secondary' },
  APPROVED: { label: 'معتمدة', cls: 'primary' },
  SENT: { label: 'مطالبة مرسلة', cls: 'teal' },
  PARTIAL: { label: 'مدفوعة جزئياً', cls: 'warning' },
  PAID: { label: 'مدفوعة', cls: 'success' },
  CLOSED: { label: 'مغلقة', cls: 'primary' },
  VOIDED: { label: 'ملغاة', cls: 'danger' },
  PENDING: { label: 'بانتظار', cls: 'warning' },
};

const fmt = (n: number | null | undefined) => (n === null || n === undefined || isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 }));
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

interface Meta {
  entities: any[]; employees: any[]; sections: any[]; courses: any[]; diplomas: any[]; subscriptionCount: number;
}
interface Summary {
  totalFees: number; totalPaid: number; entityShare: number; centerShare: number;
  paidToEntity: number; remaining: number; unsettled: number; centerDue: number; count: number; unsettledCount: number;
}
interface Row {
  key: string; type: string; subscriptionId: string; totalFees: number; totalPaid: number;
  paidToEntity: number; paidToCenter: number; entityShare: number; centerShare: number;
  claimable: number; paidToEntityTotal: number; remaining: number; status: string; lastPaidDate: string | null;
  paymentStatus: string; hasClaim: boolean; entity: any; student: any; programName: string | null; programId: string | null;
}

const emptySummary: Summary = { totalFees: 0, totalPaid: 0, entityShare: 0, centerShare: 0, paidToEntity: 0, remaining: 0, unsettled: 0, centerDue: 0, count: 0, unsettledCount: 0 };

export const SettlementPage: React.FC = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // filters (server-side)
  const [f, setF] = useState<any>({ query: '', programType: '' });
  const [queryDraft, setQueryDraft] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [rowDetail, setRowDetail] = useState<any>(null);
  const [rowLoading, setRowLoading] = useState(false);
  const debounceRef = useRef<any>(null);

  // claims
  const [claims, setClaims] = useState<any[]>([]);
  const [showClaims, setShowClaims] = useState(false);
  const [showCreateClaim, setShowCreateClaim] = useState(false);
  const [claimEntity, setClaimEntity] = useState('');
  const [claimMonth, setClaimMonth] = useState(String(new Date().getMonth() + 1));
  const [claimYear, setClaimYear] = useState(String(new Date().getFullYear()));
  const [claimNotes, setClaimNotes] = useState('');
  const [claimPreview, setClaimPreview] = useState<any>(null);
  const [claimDetail, setClaimDetail] = useState<any>(null);
  const [payClaimId, setPayClaimId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const data = await apiFetch('/settlements/meta');
      setMeta(data);
    } catch (e: any) { toast.error('فشل تحميل خيارات الفلاتر', e.message); }
  }, [apiFetch]);

  const loadRows = useCallback(async (filters: any, pageNum: number) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) qs.set(k, String(v)); });
      qs.set('page', String(pageNum));
      const data = await apiFetch(`/settlements?${qs.toString()}`);
      setRows(data.rows || []);
      setSummary(data.summary || emptySummary);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
    } catch (e: any) { toast.error('فشل تحميل التسوية', e.message); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const applyFilters = useCallback((pageNum = 1) => {
    const clean = { ...f, query: queryDraft.trim() };
    Object.keys(clean).forEach(k => { if (clean[k] === '' || clean[k] === null) delete clean[k]; });
    loadRows(clean, pageNum);
  }, [f, queryDraft, loadRows]);

  useEffect(() => { applyFilters(1); }, [f]);

  const onQueryChange = (v: string) => {
    setQueryDraft(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setF((prev: any) => ({ ...prev, query: v.trim() }));
    }, 500);
  };

  const loadClaims = useCallback(async () => {
    try {
      const data = await apiFetch('/settlements/claims?limit=50');
      setClaims(data.claims || []);
    } catch (e: any) { toast.error('فشل تحميل المطالبات', e.message); }
  }, [apiFetch]);

  useEffect(() => { if (showClaims) loadClaims(); }, [showClaims, loadClaims]);

  // ── Row lazy detail ──
  const toggleRow = async (key: string, type: string, id: string) => {
    if (openRow === key) { setOpenRow(null); setRowDetail(null); return; }
    setOpenRow(key);
    setRowLoading(true);
    try {
      const data = await apiFetch(`/settlements/row/${type}/${id}`);
      setRowDetail(data);
    } catch (e: any) { toast.error('فشل تحميل التفاصيل', e.message); setOpenRow(null); }
    finally { setRowLoading(false); }
  };

  // ── Create claim preview (server-side) ──
  const previewClaim = async () => {
    if (!claimEntity) return toast.warning('اختر جهة التعليم أولاً');
    setBusy(true);
    try {
      const data = await apiFetch('/settlements/claims/preview', {
        method: 'POST',
        body: JSON.stringify({ entityId: parseInt(claimEntity), periodMonth: parseInt(claimMonth), periodYear: parseInt(claimYear) }),
      });
      setClaimPreview(data);
    } catch (e: any) { toast.error('تعذر حساب المطالبة', e.message); setClaimPreview(null); }
    finally { setBusy(false); }
  };

  const createClaim = async () => {
    if (!claimEntity || !claimPreview) return;
    setBusy(true);
    try {
      const data = await apiFetch('/settlements/claims', {
        method: 'POST',
        body: JSON.stringify({ entityId: parseInt(claimEntity), periodMonth: parseInt(claimMonth), periodYear: parseInt(claimYear), notes: claimNotes || undefined }),
      });
      toast.success('تم إنشاء المطالبة', `${data.claim.claimNumber} — ${fmt(data.claim.totalDue)} د`);
      setShowCreateClaim(false); setClaimPreview(null); setClaimNotes('');
      await loadClaims();
      await loadRows(f, page);
    } catch (e: any) { toast.error('فشل إنشاء المطالبة', e.message); }
    finally { setBusy(false); }
  };

  const openClaim = async (id: number) => {
    setBusy(true);
    try {
      const data = await apiFetch(`/settlements/claims/${id}`);
      setClaimDetail(data);
    } catch (e: any) { toast.error('فشل تحميل المطالبة', e.message); }
    finally { setBusy(false); }
  };

  const changeClaimStatus = async (id: number, status: string) => {
    setBusy(true);
    try {
      const data = await apiFetch(`/settlements/claims/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      toast.success('تم تحديث حالة المطالبة', `${data.claimNumber || ''} → ${CS[status]?.label || status}`);
      setClaimDetail((prev: any) => ({ ...prev, claim: { ...prev.claim, ...data } }));
      await loadClaims();
    } catch (e: any) { toast.error('فشل تحديث الحالة', e.message); }
    finally { setBusy(false); }
  };

  const submitClaimPay = async (id: number, body: any) => {
    setBusy(true);
    try {
      const data = await apiFetch(`/settlements/claims/${id}/pay`, { method: 'POST', body: JSON.stringify(body) });
      toast.success('تم تسجيل سند الصرف', `${data.settlement.claimNumber} — ${fmt(data.payment.amount)} د (${data.payment.receiptNumber})`);
      setPayClaimId(null);
      const fresh = await apiFetch(`/settlements/claims/${id}`);
      setClaimDetail(fresh);
      await loadClaims();
      await loadRows(f, page);
    } catch (e: any) { toast.error('فشل تسجيل السداد', e.message); }
    finally { setBusy(false); }
  };

  const voidPayment = async (txId: number) => {
    if (!window.confirm('إلغاء سند الصرف؟ سيبقى السجل في التدقيق ويُوسَم ملغى، وتُعاد حساب المطالبة.')) return;
    setBusy(true);
    try {
      await apiFetch(`/settlements/payments/${txId}/void`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('تم إلغاء السند وتحديث المطالبة');
      const id = claimDetail?.claim?.id;
      if (id) {
        const fresh = await apiFetch(`/settlements/claims/${id}`);
        setClaimDetail(fresh);
      }
      await loadClaims();
      await loadRows(f, page);
    } catch (e: any) { toast.error('فشل إلغاء السند', e.message); }
    finally { setBusy(false); }
  };

  // Cards configuration
  const cards = useMemo(() => [
    { key: 'totalFees', label: 'إجمالي قيمة التسجيلات', icon: <FileText size={18} />, value: summary.totalFees, sub: `${summary.count} اشتراك`, cls: 'blue' },
    { key: 'totalPaid', label: 'إجمالي المبالغ المدفوعة', icon: <Wallet size={18} />, value: summary.totalPaid, sub: 'ما تم تحصيله فعلياً', cls: 'green' },
    { key: 'entityShare', label: 'حصة جهة التعليم', icon: <Landmark size={18} />, value: summary.entityShare, sub: 'من إجمالي قيمة التسجيلات', cls: 'purple' },
    { key: 'centerShare', label: 'حصة المركز', icon: <Building2 size={18} />, value: summary.centerShare, sub: 'من إجمالي قيمة التسجيلات', cls: 'amber' },
    { key: 'paidToEntity', label: 'المدفوع لجهة التعليم', icon: <Send size={18} />, value: summary.paidToEntity, sub: 'سندات صرف مسجلة', cls: 'teal' },
    { key: 'remaining', label: 'المتبقي لجهة التعليم', icon: <Clock size={18} />, value: summary.remaining, sub: 'مستحق السداد', cls: 'danger' },
    { key: 'centerDue', label: 'المبلغ المستحق للمركز', icon: <PiggyBank size={18} />, value: summary.centerDue, sub: 'حصة المركز من المحصَّل', cls: 'green' },
    { key: 'unsettled', label: 'إجمالي غير المسوى', icon: <AlertTriangle size={18} />, value: summary.unsettled, sub: `${summary.unsettledCount} اشتراك غير مسوى`, cls: 'red' },
  ], [summary]);

  const perOfEntity = useCallback((r: Row) => {
    const e = r.entity;
    if (!e) return { pct: null, fixed: 0, label: '—' };
    const pct = e.commissionType === 'PERCENTAGE' || e.commissionType === 'PERCENTAGE_AND_FIXED' || e.commissionType === 'PERCENTAGE_AND_ROOM' ? e.uniPercentage : null;
    return { pct, fixed: (e.fixedAmount || 0) + (e.roomAmount || 0), label: e.commissionType };
  }, []);

  const selF = (key: string) => f[key] || '';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ===== Header ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CircleDollarSign size={20} color="var(--primary-color)" /> التسوية المالية
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>تسوية حسابات المركز وجهات التعليم — تُحسب مباشرة من الأقساط والسندات (مصدر حقيقة واحد)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasPermission('finance.claims') && (
            <button className="glass-btn primary" onClick={() => setShowCreateClaim(true)} style={{ fontSize: '0.8rem' }}>
              <Plus size={15} /> إنشاء مطالبة مالية
            </button>
          )}
          <button className={`glass-btn ${showClaims ? 'secondary' : ''}`} onClick={() => setShowClaims(s => !s)} style={{ fontSize: '0.8rem' }}>
            <FileText size={15} /> المطالبات المالية {showClaims ? '▲' : '▼'}
          </button>
          <button className="glass-btn" onClick={() => applyFilters(page)} style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> تحديث
          </button>
        </div>
      </div>

      {/* ===== Claims panel ===== */}
      {showClaims && (
        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}><FileCheck size={16} color="var(--primary-color)" /> المطالبات المالية</h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{claims.length} مطالبة</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={thStyle}>رقم المطالبة</th><th style={thStyle}>جهة التعليم</th><th style={thStyle}>الفترة</th>
                  <th style={thStyle}>المستحق</th><th style={thStyle}>المدفوع</th><th style={thStyle}>المتبقي</th>
                  <th style={thStyle}>الحالة</th><th style={thStyle}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 && (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد مطالبات بعد</td></tr>
                )}
                {claims.map(c => {
                  const cs = CS[c.status] || CS.PENDING;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, direction: 'ltr', fontFamily: 'monospace', fontSize: '0.72rem' }}>{c.claimNumber}</td>
                      <td style={tdStyle}>{c.entity?.name}</td>
                      <td style={tdStyle}>{MONTHS[c.month - 1]} {c.year}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--primary-color)' }}>{fmt(c.totalDue)}</td>
                      <td style={{ ...tdStyle, color: 'var(--success)' }}>{fmt(c.totalPaid)}</td>
                      <td style={{ ...tdStyle, color: c.balance > 0.005 ? 'var(--danger)' : 'var(--success)' }}>{fmt(c.balance)}</td>
                      <td style={tdStyle}><span className={`badge ${cs.cls}`}>{cs.label}</span></td>
                      <td style={tdStyle}>
                        <button className="glass-btn" onClick={() => openClaim(c.id)} style={{ fontSize: '0.68rem', padding: '3px 10px' }}>
                          <ExternalLink size={12} /> تفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Filters ===== */}
      <div className="glass-panel" style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <div>
            <label style={lblStyle}>بحث بالطالب</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', right: 8, top: 9, color: 'var(--text-muted)' }} />
              <input className="glass-input" style={{ paddingRight: 28, fontSize: '0.75rem' }} placeholder="اسم / رقم الطالب" value={queryDraft} onChange={e => onQueryChange(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={lblStyle}>جهة التعليم</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('entityId')} onChange={e => setF((p: any) => ({ ...p, entityId: e.target.value }))}>
              <option value="">الكل</option>
              {meta?.entities?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>نوع البرنامج</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('programType')} onChange={e => setF((p: any) => ({ ...p, programType: e.target.value, diplomaId: '', courseId: '' }))}>
              <option value="">الكل</option>
              <option value="DIPLOMA">دبلوم</option>
              <option value="COURSE">دورة</option>
            </select>
          </div>
          <div>
            <label style={lblStyle}>{selF('programType') === 'DIPLOMA' ? 'الدبلوم' : 'الدورة / المادة'}</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF(selF('programType') === 'DIPLOMA' ? 'diplomaId' : 'courseId')}
              onChange={e => setF((p: any) => ({ ...p, [selF('programType') === 'DIPLOMA' ? 'diplomaId' : 'courseId']: e.target.value }))}>
              <option value="">الكل</option>
              {(selF('programType') === 'DIPLOMA' ? meta?.diplomas : meta?.courses)?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>الشعبة</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('sectionId')} onChange={e => setF((p: any) => ({ ...p, sectionId: e.target.value }))}>
              <option value="">الكل</option>
              {meta?.sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>الموظف المسجل</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('markerEmployeeId')} onChange={e => setF((p: any) => ({ ...p, markerEmployeeId: e.target.value }))}>
              <option value="">الكل</option>
              {meta?.employees?.map(em => <option key={em.id} value={em.id}>{em.fullName}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>حالة الدفع</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('paymentStatus')} onChange={e => setF((p: any) => ({ ...p, paymentStatus: e.target.value }))}>
              <option value="">الكل</option>
              {Object.entries(PT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>حالة التسوية</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('settlementStatus')} onChange={e => setF((p: any) => ({ ...p, settlementStatus: e.target.value }))}>
              <option value="">الكل</option>
              {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>المطالبات المالية</label>
            <select className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('claimStatus')} onChange={e => setF((p: any) => ({ ...p, claimStatus: e.target.value }))}>
              <option value="">الكل</option>
              <option value="WITH_CLAIM">داخلة في مطالبة</option>
              <option value="WITHOUT_CLAIM">بدون مطالبة</option>
            </select>
          </div>
          <div>
            <label style={lblStyle}>من تاريخ الدفع</label>
            <input type="date" className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('dateFrom')} onChange={e => setF((p: any) => ({ ...p, dateFrom: e.target.value }))} />
          </div>
          <div>
            <label style={lblStyle}>إلى تاريخ الدفع</label>
            <input type="date" className="glass-input" style={{ fontSize: '0.75rem' }} value={selF('dateTo')} onChange={e => setF((p: any) => ({ ...p, dateTo: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="glass-btn secondary" onClick={() => { setF({ query: '' }); setQueryDraft(''); setPage(1); }} style={{ fontSize: '0.75rem', width: '100%' }}>
              <X size={13} /> مسح الفلاتر
            </button>
          </div>
        </div>
      </div>

      {/* ===== Summary cards ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {cards.map(c => (
          <div key={c.key} className={`glass-panel stat-card ${c.cls}`} style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{c.icon}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
              {fmt(c.value)} <span style={{ fontSize: '0.6rem', fontWeight: 400, color: 'var(--text-muted)' }}>د</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ===== Settlement table ===== */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--glass-border)' }}>
          <h4 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Layers size={16} color="var(--primary-color)" /> تفاصيل التسوية
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>({total} اشتراك)</span>
          </h4>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: 1080 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'var(--glass-bg)' }}>
                <th style={thStyle}></th>
                <th style={thStyle}>الطالب</th>
                <th style={thStyle}>جهة التعليم</th>
                <th style={thStyle}>الدورة / البرنامج</th>
                <th style={thStyle}>قيمة التسجيل</th>
                <th style={thStyle}>المدفوع</th>
                <th style={thStyle}>نسبة الجهة</th>
                <th style={thStyle}>حصة الجهة</th>
                <th style={thStyle}>حصة المركز</th>
                <th style={thStyle}>المدفوع للجهة</th>
                <th style={thStyle}>المتبقي</th>
                <th style={thStyle}>حالة التسوية</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: 28 }}><RefreshCw size={18} className="spin" style={{ color: 'var(--primary-color)' }} /> جارٍ حساب التسوية...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>لا توجد سجلات مطابقة للفلاتر</td></tr>
              )}
              {rows.map(r => {
                const st = ST[r.status] || ST.NO_COLLECTION;
                const per = perOfEntity(r);
                const isOpen = openRow === r.key;
                return (
                  <React.Fragment key={r.key}>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', background: isOpen ? 'var(--primary-light)' : undefined }}
                      onClick={() => toggleRow(r.key, r.type, r.subscriptionId)}>
                      <td style={{ ...tdStyle, width: 30, textAlign: 'center' }}>
                        {rowLoading && isOpen ? <RefreshCw size={12} className="spin" /> : isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.student?.fullNameAr || r.student?.id}<div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>{r.student?.id}</div></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{r.entity?.name || '—'}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{r.entity?.commissionType?.replace(/_/g, ' ')}</div>
                      </td>
                      <td style={tdStyle}>{r.programName || '—'}<div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{r.type === 'DIPLOMA' ? 'دبلوم' : 'دورة'}</div></td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(r.totalFees)}</td>
                      <td style={{ ...tdStyle, color: r.totalPaid > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>{fmt(r.totalPaid)}</td>
                      <td style={tdStyle}>
                        {per.pct != null ? <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{per.pct}%</span> : per.fixed > 0 ? `${fmt(per.fixed)} ثابت` : '—'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--secondary-color)' }}>{fmt(r.claimable)}</td>
                      <td style={{ ...tdStyle, color: 'var(--teal)' }}>{fmt(Math.max(0, r.totalPaid - r.claimable))}</td>
                      <td style={{ ...tdStyle, color: r.paidToEntityTotal > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{fmt(r.paidToEntityTotal)}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: r.remaining > 0.005 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.remaining)}</td>
                      <td style={tdStyle}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                    {isOpen && rowDetail && rowDetail.row?.key === r.key && (
                      <tr>
                        <td colSpan={12} style={{ background: 'var(--glass-bg)', padding: '10px 14px' }}>
                          <RowDetailView detail={rowDetail} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>صفحة {page} من {pages} — {total} سجل</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="glass-btn" disabled={page <= 1} onClick={() => applyFilters(page - 1)} style={{ fontSize: '0.7rem', padding: '3px 10px' }}>السابق</button>
              <button className="glass-btn" disabled={page >= pages} onClick={() => applyFilters(page + 1)} style={{ fontSize: '0.7rem', padding: '3px 10px' }}>التالي</button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Create claim modal ===== */}
      {showCreateClaim && (
        <Modal title="إنشاء مطالبة مالية" onClose={() => { setShowCreateClaim(false); setClaimPreview(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lblStyle}>جهة التعليم <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="glass-input" style={{ fontSize: '0.78rem' }} value={claimEntity} onChange={e => { setClaimEntity(e.target.value); setClaimPreview(null); }}>
                <option value="">— اختر الجهة —</option>
                {meta?.entities?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={lblStyle}>الشهر</label>
                <select className="glass-input" style={{ fontSize: '0.78rem' }} value={claimMonth} onChange={e => { setClaimMonth(e.target.value); setClaimPreview(null); }}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>السنة</label>
                <input type="number" className="glass-input" style={{ fontSize: '0.78rem' }} value={claimYear} onChange={e => { setClaimYear(e.target.value); setClaimPreview(null); }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={lblStyle}>ملاحظات</label>
            <input className="glass-input" style={{ fontSize: '0.78rem' }} value={claimNotes} onChange={e => setClaimNotes(e.target.value)} placeholder="اختياري" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="glass-btn secondary" onClick={previewClaim} disabled={busy} style={{ fontSize: '0.75rem', flex: 1 }}>
              <Search size={13} /> حساب المبالغ المستحقة
            </button>
            {claimPreview && (
              <button className="glass-btn primary" onClick={createClaim} disabled={busy} style={{ fontSize: '0.75rem', flex: 1 }}>
                <Plus size={13} /> إنشاء المطالبة
              </button>
            )}
          </div>
          {claimPreview && (
            <div style={{ marginTop: 12, background: 'var(--glass-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{claimPreview.entityName}</span>
                <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>المستحق: {fmt(claimPreview.totalDue)} د</span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {claimPreview.lines.map((l: any) => (
                  <div key={l.subscriptionId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '4px 0', borderBottom: '1px dashed var(--glass-border)' }}>
                    <span>{l.studentName} — {l.programName}</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(l.remaining)} د</span>
                  </div>
                ))}
              </div>
              {claimPreview.blocked && (
                <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} /> توجد مطالبة سابقة لنفس الجهة/الفترة ({claimPreview.blocked})
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ===== Claim detail modal ===== */}
      {claimDetail && <ClaimDetailModal detail={claimDetail} onClose={() => setClaimDetail(null)} busy={busy} onStatus={changeClaimStatus} onPay={setPayClaimId} onVoidPay={voidPayment} can={hasPermission} />}

      {/* ===== Pay modal ===== */}
      {payClaimId && claimDetail && <PayModal detail={claimDetail} onClose={() => setPayClaimId(null)} busy={busy} onSubmit={submitClaimPay} />}
    </div>
  );
};

/* ============================================================================ */

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { textAlign: 'right', padding: '7px 10px', borderBottom: '1px solid transparent', whiteSpace: 'nowrap' };
const lblStyle: React.CSSProperties = { fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={17} color="var(--primary-color)" /> {title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const RowDetailView: React.FC<{ detail: any }> = ({ detail }) => {
  const d = detail.row;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem' }}>
        <span>قيمة التسجيل: <b>{fmt(d.totalFees)}</b></span>
        <span>المدفوع: <b style={{ color: 'var(--success)' }}>{fmt(d.totalPaid)}</b></span>
        <span>حصة الجهة المستحقة: <b style={{ color: 'var(--secondary-color)' }}>{fmt(d.claimable)}</b></span>
        <span>المدفوع للجهة: <b style={{ color: 'var(--success)' }}>{fmt(d.paidToEntityTotal)}</b></span>
        <span>المتبقي: <b style={{ color: 'var(--danger)' }}>{fmt(d.remaining)}</b></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        <div style={{ background: 'var(--glass-bg)', borderRadius: 8, padding: 10, border: '1px solid var(--glass-border)' }}>
          <h5 style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>الأقساط ({detail.installments?.length})</h5>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
              <tbody>
                {detail.installments?.map((i: any) => (
                  <tr key={i.id} style={{ borderBottom: '1px dashed var(--glass-border)' }}>
                    <td style={{ padding: '3px 4px' }}>{i.installmentNumber}/{i.totalInstallments}</td>
                    <td style={{ padding: '3px 4px' }}>{fmt(i.amount)}</td>
                    <td style={{ padding: '3px 4px' }}>{i.paymentDest === 'ENTITY' ? 'لجهة' : i.paymentDest === 'US' ? 'لدينا' : '—'}</td>
                    <td style={{ padding: '3px 4px' }}>{i.paymentDate ? formatDate(i.paymentDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ background: 'var(--glass-bg)', borderRadius: 8, padding: 10, border: '1px solid var(--glass-border)' }}>
          <h5 style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>سندات القبض ({detail.transactions?.length})</h5>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
              <tbody>
                {detail.transactions?.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px dashed var(--glass-border)' }}>
                    <td style={{ padding: '3px 4px', direction: 'ltr' }}>{t.receiptNumber}</td>
                    <td style={{ padding: '3px 4px' }}>{fmt(t.amount)}</td>
                    <td style={{ padding: '3px 4px' }}>{PML[t.paymentMethod] || t.paymentMethod}</td>
                    <td style={{ padding: '3px 4px' }}>{t.paymentDest === 'ENTITY' ? 'لجهة' : t.paymentDest === 'US' ? 'لدينا' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {detail.claimLines?.length > 0 && (
          <div style={{ background: 'var(--glass-bg)', borderRadius: 8, padding: 10, border: '1px solid var(--glass-border)' }}>
            <h5 style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>المطالبات المرتبطة ({detail.claimLines.length})</h5>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
              <tbody>
                {detail.claimLines.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px dashed var(--glass-border)' }}>
                    <td style={{ padding: '3px 4px' }}>{MONTHS[c.periodMonth - 1]} {c.periodYear}</td>
                    <td style={{ padding: '3px 4px' }}>{fmt(c.claimAmount)}</td>
                    <td style={{ padding: '3px 4px' }}>{fmt(c.paid)}</td>
                    <td style={{ padding: '3px 4px' }}><span className={`badge ${(CS[c.status] || CS.PENDING).cls}`}>{(CS[c.status] || CS.PENDING).label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ClaimDetailModal: React.FC<{ detail: any; onClose: () => void; busy: boolean; onStatus: (id: number, s: string) => void; onPay: (id: number) => void; onVoidPay: (txId: number) => void; can: (p: string) => boolean }> = ({ detail, onClose, busy, onStatus, onPay, onVoidPay, can }) => {
  const c = detail.claim;
  const cs = CS[c.status] || CS.PENDING;
  const paid = c.totalPaid > 0.005;
  return (
    <Modal title={`المطالبة ${c.claimNumber}`} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{c.entity?.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{MONTHS[c.month - 1]} {c.year} — نسبة الجهة: {c.entity?.uniPercentage}%</div>
        </div>
        <span className={`badge ${cs.cls}`} style={{ fontSize: '0.75rem' }}>{cs.label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8, marginBottom: 10 }}>
        <MiniStat label="المستحق" value={fmt(c.totalDue)} color="var(--primary-color)" />
        <MiniStat label="المدفوع" value={fmt(c.totalPaid)} color="var(--success)" />
        <MiniStat label="المتبقي" value={fmt(c.balance)} color={c.balance > 0.005 ? 'var(--danger)' : 'var(--success)'} />
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10, border: '1px solid var(--glass-border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead><tr style={{ background: 'var(--glass-bg)' }}>
            <th style={{ ...thStyle, padding: '6px 8px' }}>الطالب</th><th style={{ ...thStyle, padding: '6px 8px' }}>المبلغ</th>
            <th style={{ ...thStyle, padding: '6px 8px' }}>المدفوع</th><th style={{ ...thStyle, padding: '6px 8px' }}>المتبقي</th><th style={{ ...thStyle, padding: '6px 8px' }}>الحالة</th>
          </tr></thead>
          <tbody>
            {detail.lines?.map((l: any) => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <td style={{ ...tdStyle, padding: '5px 8px' }}>{l.student?.fullNameAr || l.studentId}</td>
                <td style={{ ...tdStyle, padding: '5px 8px' }}>{fmt(l.claimAmount)}</td>
                <td style={{ ...tdStyle, padding: '5px 8px', color: 'var(--success)' }}>{fmt(l.paid)}</td>
                <td style={{ ...tdStyle, padding: '5px 8px', color: 'var(--danger)' }}>{fmt(l.remaining)}</td>
                <td style={{ ...tdStyle, padding: '5px 8px' }}><span className={`badge ${(CS[l.status] || CS.PENDING).cls}`}>{(CS[l.status] || CS.PENDING).label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail.payments?.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <b>سندات الصرف المسجلة:</b>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {detail.payments.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', background: 'var(--glass-bg)', borderRadius: 6, padding: '4px 8px' }}>
                <span style={{ direction: 'ltr' }}>{p.receiptNumber}</span>
                <span>{PML[p.paymentMethod] || p.paymentMethod} — {fmt(p.amount)} د</span>
                <span>{formatDate(p.date)}</span>
                {can('finance.accounts') && (
                  <button className="glass-btn danger" disabled={busy} onClick={() => onVoidPay(p.id)} style={{ fontSize: '0.62rem', padding: '1px 7px' }}>
                    <Ban size={10} /> إلغاء السند
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {c.status === 'DRAFT' && can('finance.settlements') && <button className="glass-btn primary" disabled={busy} onClick={() => onStatus(c.id, 'APPROVED')} style={{ fontSize: '0.72rem' }}><FileCheck size={13} /> اعتماد</button>}
        {c.status === 'APPROVED' && can('finance.settlements') && <button className="glass-btn teal" disabled={busy} onClick={() => onStatus(c.id, 'SENT')} style={{ fontSize: '0.72rem' }}><Send size={13} /> إرسال المطالبة</button>}
        {!['CLOSED', 'VOIDED', 'PAID'].includes(c.status) && can('finance.payments') && (
          <button className="glass-btn success" disabled={busy} onClick={() => onPay(c.id)} style={{ fontSize: '0.72rem' }}><CreditCard size={13} /> تسجيل سداد</button>
        )}
        {c.status === 'PAID' && can('finance.settlements') && <button className="glass-btn" disabled={busy} onClick={() => onStatus(c.id, 'CLOSED')} style={{ fontSize: '0.72rem' }}><Lock size={13} /> إغلاق</button>}
        {!paid && !['CLOSED', 'VOIDED'].includes(c.status) && can('finance.accounts') && (
          <button className="glass-btn danger" disabled={busy} onClick={() => onStatus(c.id, 'VOIDED')} style={{ fontSize: '0.72rem' }}><Ban size={13} /> إلغاء</button>
        )}
      </div>
    </Modal>
  );
};

const PayModal: React.FC<{ detail: any; onClose: () => void; busy: boolean; onSubmit: (id: number, body: any) => void }> = ({ detail, onClose, busy, onSubmit }) => {
  const c = detail.claim;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK');
  const [subMethod, setSubMethod] = useState('');
  const [ref, setRef] = useState('');
  const [checkNum, setCheckNum] = useState('');
  const [hawalaNum, setHawalaNum] = useState('');
  const [notes, setNotes] = useState('');

  const amt = toNumber(cleanDecimal(amount));
  const over = amt > c.balance + 0.005;

  return (
    <Modal title={`تسديد لجهة التعليم — ${c.claimNumber}`} onClose={onClose}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
        تسجيل سند صرف فعلي في الدفتر المالي وربطه بالمطالبة والحركات المالية. المتبقي الحالي: <b style={{ color: 'var(--danger)' }}>{fmt(c.balance)} د</b>
      </p>
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label style={lblStyle}>المبلغ <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input type="text" inputMode="decimal" className={`glass-input ${over ? 'error-field' : ''}`} value={amount}
          onInput={e => setAmount((e.target as HTMLInputElement).value)}
          placeholder="0.00 — يُقبل بأرقام عربية أو إنجليزية" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }} />
        {over && <div style={{ fontSize: '0.66rem', color: 'var(--danger)', marginTop: 3 }}>المبلغ أكبر من رصيد المطالبة ({fmt(c.balance)} د)</div>}
        {amount && !over && <div style={{ fontSize: '0.66rem', color: 'var(--success)', marginTop: 3 }}>سيتبقى بعد السداد: {fmt(c.balance - amt)} د</div>}
      </div>
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label style={lblStyle}>طريقة الدفع <span style={{ color: 'var(--danger)' }}>*</span></label>
        <select className="glass-input" style={{ fontSize: '0.78rem' }} value={method} onChange={e => { setMethod(e.target.value); setSubMethod(''); }}>
          <option value="BANK">حوالة بنكية</option>
          <option value="CASH">نقداً</option>
          <option value="TRANSFER">تحويل إلكتروني</option>
          <option value="CHECK">شيك</option>
          <option value="MONEY_TRANSFER">حوالة مالية</option>
        </select>
      </div>
      {(method === 'TRANSFER' || method === 'MONEY_TRANSFER') && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label style={lblStyle}>النوع</label>
          <select className="glass-input" style={{ fontSize: '0.78rem' }} value={subMethod} onChange={e => setSubMethod(e.target.value)}>
            <option value="">— اختر —</option>
            {method === 'TRANSFER'
              ? ['CLICK', 'ZAIN_CASH', 'ORANGE_MONEY', 'U_WALLET', 'DINARAK', 'ALAWNEH', 'FAWATEERKOM'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)
              : ['WESTERN_UNION', 'MONEYGRAM', 'RIA_MONEY'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}
      {method === 'CHECK' && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label style={lblStyle}>رقم الشيك</label>
          <input className="glass-input" style={{ fontSize: '0.78rem' }} value={checkNum} onChange={e => setCheckNum(normalizeDigits(e.target.value))} placeholder="اختياري" />
        </div>
      )}
      {method === 'MONEY_TRANSFER' && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label style={lblStyle}>رقم الحوالة</label>
          <input className="glass-input" style={{ fontSize: '0.78rem' }} value={hawalaNum} onChange={e => setHawalaNum(normalizeDigits(e.target.value))} placeholder="اختياري" />
        </div>
      )}
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label style={lblStyle}>رقم المرجع / السند</label>
        <input className="glass-input" style={{ fontSize: '0.78rem' }} value={ref} onInput={e => setRef(normalizeDigits((e.target as HTMLInputElement).value))} placeholder="اختياري — يُقبل بأي لغة" />
      </div>
      <div className="form-group" style={{ marginBottom: 10 }}>
        <label style={lblStyle}>ملاحظات</label>
        <input className="glass-input" style={{ fontSize: '0.78rem' }} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <button className="glass-btn primary" disabled={busy || amt <= 0 || over} onClick={() => onSubmit(c.id, { amount: String(amt), paymentMethod: method, referenceNumber: ref || undefined, paymentSubMethod: subMethod || undefined, checkNumber: checkNum || undefined, hawalaNumber: hawalaNum || undefined, notes: notes || undefined })} style={{ fontSize: '0.78rem', width: '100%' }}>
        {busy ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} تسجيل السداد وإصدار السند ({fmt(amt)} د)
      </button>
    </Modal>
  );
};

const MiniStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: 'var(--glass-bg)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--glass-border)' }}>
    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'monospace', color, direction: 'ltr', textAlign: 'right' }}>{value}</div>
  </div>
);