import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, User, FileText, Calendar, CreditCard, GraduationCap, Printer, Filter, Image, MessageCircle, ArrowLeftRight, Wallet, ChevronDown, ChevronUp, X, Plus, AlertTriangle, CheckCircle2, RefreshCw, Info, Send, Pin, PinOff, Banknote } from 'lucide-react';
import { useApi, useAuth, fileUrl } from '../context/AuthContext';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { LearningTypeBadge, learningTypeLabel, modalityLabel } from '../components/LearningTypeBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useChat } from '../context/ChatContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateFormat';
import { printHeaderHTML } from '../utils/print';
import { useToast } from '../components/Toast';
import { toNumber, cleanDecimal } from '../utils/arabicNumbers';
import { normalizeDigits } from '../utils/constants';
import { parseStudentNotes } from '../utils/studentNotes';

const BL: Record<string, string> = { Jordan_Ahli: 'الأهلي الأردني', Arab_Bank: 'العربي', Housing_Bank: 'الإسكان', Cairo_Amman: 'القاهرة عمان', Jordan_Kuwait: 'الأردني الكويتي', Islamic_Bank: 'الإسلامي الأردني', Safwa_Islamic: 'صفوة الإسلامي', Etihad: 'الاتحاد', Societe_Generale: 'سوسيتيه جنرال', Bank_of_Jordan: 'الأردن', Investbank: 'الاستثمار', Jordan_Commercial: 'التجاري الأردني', ABC: 'ABC', Standard_Chartered: 'ستاندارد تشارترد', BLOM: 'بلوم', Al_Rajhi: 'الراجحي', OTHER: 'آخر' };

const pmBase: Record<string, string> = { CASH: 'نقدي', BANK: 'حوالة بنكية', CARD: 'بطاقة', TRANSFER: 'تحويل', WALLET: 'محفظة', ENTITY: 'جهة', CHECK: 'شيك' };
const pmLabel = (t: any) => {
  const parts: string[] = [pmBase[t?.paymentMethod] || t?.paymentMethod || '—'];
  if (t?.paymentSubMethod) parts.push(t.paymentSubMethod);
  return parts.join(' / ');
};
const ATT_PRINT_LABEL: Record<string, string> = { PRESENT: 'حاضر', ABSENT: 'غائب', LATE: 'متأخر', EXCUSED: 'بعذر' };

// Remaining balance of an installment.
const remOf = (i: any) => Math.max(0, (i?.amount || 0) - (i?.paidAmount || 0));

// Normalize a reference number: convert Arabic/Persian digits to English and strip
// invisible bidi/zero-width characters so values typed on any keyboard are comparable.
const cleanRefVal = (v?: string) => normalizeDigits((v || '').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')).trim();

// Inline live status under the reference field: checking / taken / available.
const refStatusLine = (checking: boolean, used: boolean, hasValue: boolean) => {
  if (!hasValue) return null;
  if (checking) {
    return (
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ التحقق من توفر الرقم المرجع...
      </div>
    );
  }
  if (used) {
    return (
      <div style={{ fontSize: '0.62rem', color: 'var(--danger)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={10} /> الرقم المرجع مستخدم مسبقاً — أدخل رقماً جديداً
      </div>
    );
  }
  return (
    <div style={{ fontSize: '0.62rem', color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      <CheckCircle2 size={10} /> الرقم المرجع متاح
    </div>
  );
};

// Build the distribution plan for a payment amount across the subscription's installments.
// Used by BOTH the live preview and the submit validation so they can never disagree.
const buildPayPlan = (amt: number, current: any, installs: any[]) => {
  const mainRemain = remOf(current);
  const pool = installs.length > 0 ? installs : [current];
  const total = pool.reduce((s: number, i: any) => s + remOf(i), 0);
  let rest = Math.max(0, amt - mainRemain);
  const targets: { id: number; no: number; totalCount: number; amount: number; remain: number }[] = [];
  const others = pool.filter(i => i.id !== current.id).sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
  for (const i of others) {
    if (rest <= 0) break;
    const r = remOf(i);
    if (r <= 0) continue;
    const paid = Math.min(rest, r);
    targets.push({ id: i.id, no: i.installmentNumber, totalCount: i.totalInstallments, amount: paid, remain: r });
    rest -= paid;
  }
  return {
    main: Math.min(amt, mainRemain),
    excess: Math.max(0, amt - mainRemain),
    targets,
    cap: total,
    over: total > 0 && amt > total,
  };
};

const DAY_ABBR: Record<string, string> = {
  SAT: 'السبت', SUN: 'الأحد', MON: 'الإثنين', TUE: 'الثلاثاء',
  WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة',
  saturday: 'السبت', sunday: 'الأحد', monday: 'الإثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة',
};

const getDayName = (d: string | Date) => {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return DAY_ABBR[date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()] || '';
  } catch { return ''; }
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  value ? <span><span style={{ color: 'var(--text-muted)' }}>{label}: </span><strong>{value}</strong></span> : null
);

const formatDays = (days: any) => {
  if (!days) return '—';
  try {
    const d = typeof days === 'string' ? JSON.parse(days) : days;
    if (Array.isArray(d)) return d.map((day: string) => DAY_ABBR[day.trim().toUpperCase()] || day).join('، ');
    return String(d);
  } catch { return String(days); }
};

const parseScheduleDetails = (sec: any): { day: string; startTime: string; endTime: string }[] => {
  if (!sec?.scheduleDetails) return [];
  try {
    const d = typeof sec.scheduleDetails === 'string' ? JSON.parse(sec.scheduleDetails) : sec.scheduleDetails;
    return Array.isArray(d) ? d : [];
  } catch { return []; }
};

const scheduleDays = (sec: any) => {
  if (sec?.perDaySchedule) {
    const dets = parseScheduleDetails(sec);
    if (dets.length) return dets.map(s => DAY_ABBR[s.day?.trim().toUpperCase()] || s.day).join('، ');
  }
  return formatDays(sec?.days);
};

const scheduleTime = (sec: any) => {
  if (sec?.perDaySchedule) {
    const dets = parseScheduleDetails(sec);
    if (dets.length) return dets.map(s => `${s.startTime}-${s.endTime}`).join(' | ');
  }
  return sec?.startTime && sec?.endTime ? `${sec.startTime} - ${sec.endTime}` : '—';
};

export const StudentProfilePage = () => {
  const { apiFetch } = useApi();
  const { centerName, centerNameEn, centerLogo, user, hasPermission } = useAuth();
  const toast = useToast();
  const { setPendingShareStudent, setOpen } = useChat();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeepOpen, setIsDeepOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [openAttSec, setOpenAttSec] = useState<number | null>(null);
  const [openInstId, setOpenInstId] = useState<number | null>(null);
  const [pinAttendance, setPinAttendance] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [printSections, setPrintSections] = useState<Record<string, boolean>>({ subs: true, installments: true, notes: true, schedule: true, attendance: true });

  /* ── Notes log state ── */
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  /* ── Quick payment state (mirrors FinInstallmentsPage pay flow) ── */
  const [payOpen, setPayOpen] = useState(false);
  const [payInst, setPayInst] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDest, setPayDest] = useState<'ENTITY' | 'US' | ''>('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [paySubMethod, setPaySubMethod] = useState('');
  const [payBank, setPayBank] = useState('');
  const [payCheckNum, setPayCheckNum] = useState('');
  const [payHawalaNum, setPayHawalaNum] = useState('');
  const [payWalletRef, setPayWalletRef] = useState('');
  const [payRef, setPayRef] = useState('');
  const [refUsed, setRefUsed] = useState(false);
  const [refChecking, setRefChecking] = useState(false);
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const togglePrintSection = (key: string) => setPrintSections(prev => ({ ...prev, [key]: !prev[key] }));
  const getPhone = (p: any) => { try { return (typeof p === 'string' ? JSON.parse(p) : p)?.[0] || '—'; } catch { return '—'; } };
  const getSections = () => selectedStudent?.sections || [];
  const getAttendances = () => selectedStudent?.attendances || [];
  const getActiveSections = () => getSections().filter((ss: any) => ss.status !== 'TRANSFERRED' && ss.status !== 'WITHDRAWN');
  const secToDisplay = (ss: any) => ss.section || ss;
  const transferLog = selectedStudent?.transferLogs || [];
  const getTransferDate = (sectionId: number, isCurrent: boolean) => {
    if (isCurrent) return null;
    const log = transferLog.find((l: any) => l.fromSectionId === sectionId);
    return log ? log.transferredAt : null;
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setShowDropdown(false); return; }
    try { const res = await apiFetch(`/students?query=${encodeURIComponent(q)}&limit=8`); setSearchResults(Array.isArray(res) ? res : (res.data || [])); setShowDropdown(true); } catch { /* ignore */ }
  };

  const selectStudent = async (s: any) => {
    setSelectedStudent(s);
    setSearchQuery(s.fullNameAr);
    setShowDropdown(false);
    setIsLoading(true);
    try {
      const [full, fin] = await Promise.all([apiFetch(`/students/${s.id}`), apiFetch(`/financial/student/${s.id}`)]);
      setSelectedStudent(full);
      setProfile(fin);
    } catch { setProfile(null); }
    finally { setIsLoading(false); }
  };

  const handleDeepSearch = (student: any) => { selectStudent(student); setIsDeepOpen(false); };

  // Auto-select student from shared link or quick access (?studentId=)
  const sidParam = searchParams.get('studentId') || searchParams.get('shareId');
  useEffect(() => {
    if (sidParam) {
      apiFetch(`/students/${sidParam}`).then(s => { if (s) selectStudent(s); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidParam]);

  const handleShare = () => {
    if (!selectedStudent) return;
    setPendingShareStudent({
      id: selectedStudent.id,
      fullNameAr: selectedStudent.fullNameAr,
    });
    setOpen(true);
  };

  /* ── Add a note to the student's notes log (author + job title captured server-side) ── */
  const addNote = async () => {
    if (!selectedStudent) return;
    const text = noteText.trim();
    if (!text) { toast.error('اكتب نص الملاحظة أولاً'); return; }
    setNoteSaving(true);
    try {
      const res = await apiFetch(`/students/${selectedStudent.id}/notes`, { method: 'POST', body: JSON.stringify({ content: text }) });
      toast.success('تمت إضافة الملاحظة');
      setNoteText('');
      const full = await apiFetch(`/students/${selectedStudent.id}`);
      setSelectedStudent(full);
      if (res?.notes) setSelectedStudent((prev: any) => ({ ...prev, notes: JSON.stringify(res.notes) }));
    } catch (err: any) { toast.error('فشل إضافة الملاحظة', err.message); }
    finally { setNoteSaving(false); }
  };

  /* ── Quick payment: open modal pre-selected with an installment ── */
  const openPay = (inst: any) => {
    setPayInst(inst);
    setPayAmount('');
    setPayDest('');
    setPayMethod('CASH');
    setPaySubMethod('');
    setPayBank('');
    setPayCheckNum('');
    setPayHawalaNum('');
    setPayWalletRef('');
    setPayRef('');
    setRefUsed(false);
    setRefChecking(false);
    setPayNotes('');
    setPayOpen(true);
  };

  const closePay = () => setPayOpen(false);

  const paySiblings = (inst: any) => {
    const all = profile?.installments || [];
    if (!inst) return [];
    return all.filter((i: any) => String(i.subscriptionId) === String(inst.subscriptionId) && i.subscriptionType === inst.subscriptionType)
      .sort((a: any, b: any) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
  };

  /* ── Live duplicate check on the payment reference ── */
  useEffect(() => {
    const ref = cleanRefVal(payRef);
    if (!ref) { setRefUsed(false); setRefChecking(false); return; }
    setRefChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/financial/check-reference?ref=${encodeURIComponent(ref)}`);
        setRefUsed(!!res?.used);
      } catch { setRefUsed(false); }
      finally { setRefChecking(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [payRef, apiFetch]);

  /* ── Quick payment submit — same endpoint and rules as the installments page ── */
  const handleQuickPay = async () => {
    if (!payInst) return;
    const amt = toNumber(payAmount);
    if (!amt || amt <= 0) { toast.error('المبلغ مطلوب'); return; }
    if (!payDest) { toast.error('اختر جهة الدفع (جهة التعليم أو لدينا)'); return; }
    const refVal = cleanRefVal(payRef) || cleanRefVal(payWalletRef) || cleanRefVal(payCheckNum) || cleanRefVal(payHawalaNum);
    if (!refVal) { toast.error('رقم المرجع مطلوب — أدخله بأي لغة'); return; }
    if (refUsed) { toast.error('رقم المرجع مستخدم مسبقاً في معاملة أخرى — أدخل رقماً جديداً'); return; }
    if (payDest === 'US') {
      if (payMethod === 'TRANSFER' && !paySubMethod) { toast.error('يرجى اختيار نوع المحفظة الإلكترونية'); return; }
      if (payMethod === 'CHECK') { if (!payBank) { toast.error('يرجى اختيار البنك'); return; } if (!payCheckNum.trim()) { toast.error('رقم الشيك مطلوب'); return; } }
      if (payMethod === 'MONEY_TRANSFER') { if (!paySubMethod) { toast.error('يرجى اختيار نوع الحوالة'); return; } if (!payHawalaNum.trim()) { toast.error('رقم الحوالة مطلوب'); return; } }
    }
    const plan = buildPayPlan(amt, payInst, paySiblings(payInst));
    if (plan.over) {
      toast.error(`المبلغ (${amt}) أكبر من إجمالي المتبقي على أقساط هذا الاشتراك (${plan.cap.toFixed(2)})`);
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
      };
      if (refVal) body.referenceNumber = refVal;
      if (payMethod === 'TRANSFER') { body.paymentSubMethod = paySubMethod; if (payWalletRef) body.paymentWalletRef = payWalletRef; }
      if (payMethod === 'CHECK') { body.paymentBank = payBank; body.checkNumber = payCheckNum; }
      if (payMethod === 'MONEY_TRANSFER') { body.paymentSubMethod = paySubMethod; body.hawalaNumber = payHawalaNum; }
      if (payNotes) body.notes = payNotes;

      const payRes = await apiFetch(`/installments/${payInst.id}/pay`, { method: 'POST', body: JSON.stringify(body) });
      const dist = Array.isArray(payRes?.distributedTo) && payRes.distributedTo.length > 0 ? payRes.distributedTo : null;
      if (dist) {
        const distSum = dist.reduce((s: number, d: any) => s + (d.amount || 0), 0);
        toast.success('تم تسجيل الدفعة', `خُصم فائض (${distSum.toFixed(2)} د.أ) من ${dist.length} قسط آخر`);
      } else {
        toast.success('تم تسجيل الدفعة');
      }
      closePay();
      const [full, fin] = await Promise.all([apiFetch(`/students/${selectedStudent?.id}`), apiFetch(`/financial/student/${selectedStudent?.id}`)]);
      if (full) setSelectedStudent(full);
      if (fin) setProfile(fin);
    } catch (err: any) { toast.error('فشل', err.message); }
    finally { setPayLoading(false); }
  };

  const ins = profile?.installments || [];
  const paid = ins.filter((i: any) => i.status === 'PAID').reduce((s: number, i: any) => s + i.paidAmount, 0);
  const remaining = ins.filter((i: any) => i.status !== 'PAID').reduce((s: number, i: any) => s + i.remainingAmount, 0);

  // Map subscription id -> entity name (for showing payment destination entity in installments table)
  const entityBySub = useMemo(() => {
    const m = new Map<number, string>();
    (selectedStudent?.diplomaSubscriptions || []).forEach((sub: any) => { if (sub?.entity?.name) m.set(Number(sub.id), sub.entity.name); });
    (selectedStudent?.courseSubscriptions || []).forEach((sub: any) => { if (sub?.entity?.name) m.set(Number(sub.id), sub.entity.name); });
    return m;
  }, [selectedStudent]);
  const instEntityName = (inst: any) => {
    const subId = inst.diplomaSubId || inst.courseSubId;
    return subId ? entityBySub.get(Number(subId)) : undefined;
  };

  // Full destination text: entity name when "جهة التعليم", center name when "لدينا".
  const destFull = (dest?: string, subId?: any) => {
    if (dest === 'ENTITY') {
      const en = subId != null ? entityBySub.get(Number(subId)) : undefined;
      return en ? `جهة التعليم — ${en}` : 'جهة التعليم';
    }
    if (dest === 'US') return `لدينا — ${centerName || 'المركز'}`;
    return undefined;
  };
  const txDestText = (t: any) => destFull(t?.paymentDest, t?.subscriptionId);

  const subs = [
    ...(selectedStudent?.diplomaSubscriptions || []).map((s: any) => ({ ...s, _type: 'diploma' })),
    ...(selectedStudent?.courseSubscriptions || []).map((s: any) => ({ ...s, _type: 'course' })),
  ];

  const secList = getSections();
  const attList = getAttendances();

  const attGrouped: Record<string, any[]> = {};
  attList.forEach((a: any) => { if (!attGrouped[a.sectionId]) attGrouped[a.sectionId] = []; attGrouped[a.sectionId].push(a); });
  const attStatus = (r: any) => String(r?.status || '').toUpperCase();
  const attStats = (secId: string) => {
    const rows = attGrouped[secId] || [];
    const total = rows.length;
    const present = rows.filter((r: any) => attStatus(r) === 'PRESENT').length;
    const absent = rows.filter((r: any) => attStatus(r) === 'ABSENT').length;
    const late = rows.filter((r: any) => attStatus(r) === 'LATE').length;
    const excused = rows.filter((r: any) => attStatus(r) === 'EXCUSED').length;
    return { total, present, absent, late, excused, pct: total ? Math.round((present / total) * 100) : 0 };
  };

  const ATT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    PRESENT: { label: 'حاضر', cls: 'success' },
    ABSENT: { label: 'غائب', cls: 'danger' },
    LATE: { label: 'متأخر', cls: 'warning' },
    EXCUSED: { label: 'بعذر', cls: 'secondary' },
  };
  const parseDaysArr = (days: any): string[] => {
    if (!days) return [];
    try {
      const d = typeof days === 'string' ? JSON.parse(days) : days;
      if (Array.isArray(d)) return d.map((x: string) => String(x).trim().toUpperCase());
      return [String(d).trim().toUpperCase()];
    } catch { return []; }
  };
  const attDetailRows = (item: any) => {
    const sec = secToDisplay(item);
    const dayCodes = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const secDays = parseDaysArr(sec.days);
    if (!secDays.length) return [];
    const byDate = new Map<string, any>();
    (attGrouped[String(sec.id)] || []).forEach((r: any) => { byDate.set(new Date(r.date).toISOString().slice(0, 10), r); });
    const isCurrent = item.status === 'ENROLLED' || item.status === 'ACTIVE';
    const transferDate = getTransferDate(sec.id, isCurrent);
    const start = item.enrollDate ? new Date(item.enrollDate) : new Date(sec.createdAt || 0);
    const end = transferDate ? new Date(transferDate) : new Date();
    if (start > end) return [];
    const rows: { key: string; date: Date; dayName: string; record: any }[] = [];
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= end) {
      const code = dayCodes[d.getDay()];
      if (secDays.includes(code)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        rows.push({ key, date: new Date(d), dayName: DAY_ABBR[code] || code, record: byDate.get(key) || null });
      }
      d.setDate(d.getDate() + 1);
    }
    return rows.reverse();
  };

  const buildPrintHTML = () => {
    const s = selectedStudent;
    if (!s) return '';
    let html = '';
    html += `<div class="section"><h4>المعلومات الشخصية</h4><table><tr><th>الاسم</th><td>${s.fullNameAr || ''}</td><th>الهاتف</th><td>0${getPhone(s.phones)}</td></tr>
      <tr><th>الحالة</th><td>${s.status === 'ACTIVE' ? 'مستمر' : s.status || ''}</td>
      ${s.fullNameEn ? `<th>الاسم (إنج)</th><td>${s.fullNameEn}</td>` : '<td></td><td></td>'}
      </tr>${s.email ? `<tr><th>البريد</th><td colspan="3">${s.email}</td></tr>` : ''}
      ${s.address ? `<tr><th>العنوان</th><td colspan="3">${s.address}</td></tr>` : ''}
      ${s.dob ? `<tr><th>تاريخ الميلاد</th><td colspan="3">${formatDate(s.dob)}</td></tr>` : ''}
    </table></div>`;
    if (printSections.schedule) { const secs = getActiveSections(); if (secs.length) {
      const fmtDate = (d: any) => d ? formatDate(d) : '—';
      const fmtEnroll = (item: any) => item.enrollDate ? fmtDate(item.enrollDate) : '—';
      const fmtEnd = (item: any) => {
        const sec2 = secToDisplay(item);
        const isCur = item.status === 'ENROLLED' || item.status === 'ACTIVE';
        const td = getTransferDate(sec2.id, isCur);
        return td ? fmtDate(td) : isCur ? 'الآن' : '—';
      };
      html += `<div class="section"><h4>الجدول الدراسي</h4><table><thead><tr><th>المادة</th><th>رقم الشعبة</th><th>الأيام</th><th>الوقت</th><th>القاعة</th><th>المدرب</th></tr></thead><tbody>`;
      secs.forEach((item: any) => { const sec = secToDisplay(item); const room = sec.room?.name || '—'; const ltParts: string[] = []; const lt = sec.room?.learningType; const loc = learningTypeLabel(lt); const en = sec.room?.entity?.name; if (lt === 'EXTERNAL_ENTITY') ltParts.push(en || 'جهة تعلم خارجية'); else ltParts.push(loc); const mod = sec.room?.modality; if (mod && mod !== 'PHYSICAL') ltParts.push(modalityLabel(mod)); html += `<tr><td>${sec.course?.name || sec.diploma?.name || '—'}</td><td>${sec.name || '—'}</td><td>${scheduleDays(sec)}</td><td>${scheduleTime(sec)}</td><td>${room}${ltParts.length ? ' (' + ltParts.join('، ') + ')' : ''}</td><td>${sec.instructor?.name || '—'}</td></tr>`; });
      html += `</tbody></table></div>`; }
    }
    const printSubs = [
      ...(s?.diplomaSubscriptions || []),
      ...(s?.courseSubscriptions || []),
    ];
    if (printSections.subs && printSubs.length) {
      html += `<div class="section"><h4>الاشتراكات</h4><table><thead><tr><th>النوع</th><th>الاشتراك</th><th>التكلفة</th></tr></thead><tbody>`;
      printSubs.forEach((sub: any) => { const type = sub.diploma ? 'دبلوم' : 'دورة'; html += `<tr><td>${type}</td><td>${sub.diploma?.name || sub.course?.name || 'اشتراك'}</td><td>${sub.totalCost?.toFixed(3)} د</td></tr>`; });
      html += `</tbody></table></div>`;
    }
    const ins = profile?.installments || [];
    if (printSections.installments && ins.length) {
      html += `<div class="section"><h4>جدول الأقساط</h4><table><thead><tr><th>القسط</th><th>المبلغ</th><th>تاريخ الاستحقاق</th><th>جهة الدفع</th><th>الحالة</th></tr></thead><tbody>`;
      ins.forEach((inst: any) => { const st = inst.status === 'PAID' ? 'مدفوع' : inst.status === 'OVERDUE' ? 'متأخر' : 'معلق'; const cls = inst.status === 'PAID' ? 'success' : inst.status === 'OVERDUE' ? 'danger' : 'warning'; const destParts: string[] = []; if (inst.paymentDest) { if (inst.paymentDest === 'ENTITY') { destParts.push('جهة التعليم'); const ien = instEntityName(inst); if (ien) destParts.push(ien); } else { destParts.push(`لدينا — ${centerName || 'المركز'}`); } } html += `<tr><td>${inst.installmentNumber}</td><td>${inst.amount?.toFixed(3)} د</td><td>${formatDate(inst.dueDate)}</td><td>${destParts.length ? destParts.join(' / ') : '—'}</td><td><span class="badge ${cls}">${st}</span></td></tr>`; });
      html += `</tbody></table></div>`;
    }
    if (printSections.attendance) { const secs = getSections(); if (secs.length) {
      const atts = getAttendances();
      const pGrouped: Record<string, any[]> = {}; atts.forEach((a: any) => { if (!pGrouped[a.sectionId]) pGrouped[a.sectionId] = []; pGrouped[a.sectionId].push(a); });
      const pStats = (secId: string) => { const rows = pGrouped[secId] || []; const total = rows.length; const present = rows.filter((r: any) => String(r.status || '').toUpperCase() === 'PRESENT').length; const absent = rows.filter((r: any) => String(r.status || '').toUpperCase() === 'ABSENT').length; const late = rows.filter((r: any) => String(r.status || '').toUpperCase() === 'LATE').length; const excused = rows.filter((r: any) => String(r.status || '').toUpperCase() === 'EXCUSED').length; return { total, present, absent, late, excused, pct: total ? Math.round((present / total) * 100) : 0 }; };
      const pFmtDate = (d: any) => d ? formatDate(d) : '—';
      html += `<div class="section"><h4>الحضور والغياب</h4><table><thead><tr><th>المادة</th><th>رقم الشعبة</th><th>الأيام</th><th>الوقت</th><th>من تاريخ</th><th>إلى تاريخ</th><th>عدد أيام الدوام</th><th>الحضور</th><th>الغياب</th><th>نسبة الحضور</th></tr></thead><tbody>`;
      secs.forEach((item: any) => { const sec = secToDisplay(item); const st = pStats(String(sec.id)); const enroll = item.enrollDate ? pFmtDate(item.enrollDate) : '—'; const isCur = item.status === 'ENROLLED' || item.status === 'ACTIVE'; const td = getTransferDate(sec.id, isCur); const end = td ? pFmtDate(td) : (isCur ? 'الآن' : '—'); html += `<tr><td>${sec.course?.name || sec.diploma?.name || '—'}</td><td>${sec.name || '—'}</td><td>${scheduleDays(sec)}</td><td>${scheduleTime(sec)}</td><td>${enroll}</td><td>${end}</td><td>${st.total}</td><td>${st.present}</td><td>${st.absent + st.late}</td><td>${st.total ? st.pct + '%' : '—'}</td></tr>`; });
      html += `</tbody></table>`;
      if (pinAttendance) {
        html += secs.map((item: any) => {
          const sec = secToDisplay(item);
          const rows = attDetailRows(item);
          const detailRows = rows.map((r: any) => {
            const code = r.record ? String(r.record.status || '').toUpperCase() : '';
            const cls = code === 'ABSENT' ? 'danger' : code === 'LATE' ? 'warning' : code === 'PRESENT' ? 'success' : code === 'EXCUSED' ? 'secondary' : '';
            return `<tr><td>${pFmtDate(r.date)}</td><td>${r.dayName}</td><td>${code ? `<span class="badge ${cls}">${ATT_PRINT_LABEL[code] || code}</span>` : 'غير مسجل'}</td><td>${r.record?.notes || ''}</td></tr>`;
          }).join('');
          return `<h5 style="margin:10px 0 6px;font-size:12px;color:#333">${sec.course?.name || sec.diploma?.name || 'مادة'} (${sec.name || ''}) — سجل كامل</h5>
            <table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${detailRows || '<tr><td colspan="4">لا توجد أيام دوام</td></tr>'}</tbody></table>`;
        }).join('');
      }
      html += `</div>`; }
    }
    if (printSections.notes && s.notes) { html += `<div class="section"><h4>ملاحظات</h4>${parseStudentNotes(s.notes).map((n, i) => `<p style="white-space:pre-line;margin:4px 0">${(n.content || '').replace(/</g, '&lt;')}</p>`).join('')}</div>`; }
    return html;
  };

  const handlePrint = () => {
    const content = buildPrintHTML();
    if (!content) { alert('لا توجد أقسام محددة للطباعة'); return; }
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    const s = selectedStudent;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 15mm; }
      body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; color: #333; background: #fff; }
      .section { margin-bottom: 12px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
      .section h4 { margin: 0 0 8px 0; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: center; }
      th { background: #f5f5f5; font-weight: 600; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
      .badge.success { background: #d4edda; color: #155724; }
      .badge.danger { background: #f8d7da; color: #721c24; }
      .badge.warning { background: #fff3cd; color: #856404; }
      .header-card { text-align: center; margin-bottom: 16px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
      .header-card h2 { margin: 0 0 4px 0; }
      .header-card p { margin: 0; color: #666; }
    </style></head><body>
    ${printHeaderHTML({ name: centerName, nameEn: centerNameEn, logo: centerLogo ? fileUrl(centerLogo) : '' })}
    <div class="header-card"><h2>${s?.fullNameAr || ''}</h2><p>0${s ? getPhone(s.phones) : ''}</p></div>${content}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const handlePrintCard = () => {
    const s = selectedStudent;
    if (!s) return;
    const secNames = secList.length > 0 ? secList.map((x: any) => x.course?.name || x.diploma?.name).join('، ') : '';
    const w = window.open('', '_blank', 'width=400,height=620');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>بطاقة الطالب</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Cairo', 'Segoe UI', sans-serif; background: #f3f4f6; padding: 24px; color: #222; }
      .idcard { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 20px 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
      .avatar { width: 84px; height: 84px; margin: 0 auto 10px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 2rem; font-weight: 700; }
      .sname { text-align: center; font-size: 1.15rem; font-weight: 700; }
      .sename { text-align: center; font-size: 0.78rem; color: #6b7280; direction: ltr; }
      .badge { display: inline-block; margin-top: 6px; padding: 2px 12px; border-radius: 20px; font-size: 0.68rem; font-weight: 600; background: #d1fae5; color: #065f46; }
      .grid { margin-top: 16px; border-top: 1px dashed #e5e7eb; padding-top: 12px; display: grid; grid-template-columns: 1fr; gap: 8px; }
      .row { display: flex; justify-content: space-between; font-size: 0.82rem; }
      .row .l { color: #6b7280; }
      .row .v { font-weight: 600; }
      .foot { margin-top: 16px; text-align: center; font-size: 0.72rem; color: #9ca3af; }
      button { padding: 10px 24px; margin-bottom: 20px; cursor: pointer; font-size: 14px; border: 1px solid #111827; background: #fff; border-radius: 8px; }
      @media print { body { background: #fff; padding: 12px; } .idcard { box-shadow: none; } button { display: none; } }
    </style></head><body>
    <button onclick="window.print()">🖨️ طباعة البطاقة</button>
    ${printHeaderHTML({ name: centerName, nameEn: centerNameEn, logo: centerLogo ? fileUrl(centerLogo) : '' })}
    <div class="idcard">
      <div class="avatar">${s.fullNameAr?.trim().charAt(0) || 'ط'}</div>
      <div class="sname">${s.fullNameAr || ''}</div>
      ${s.fullNameEn ? `<div class="sename">${s.fullNameEn}</div>` : ''}
      <div style="text-align:center"><span class="badge">${s.status === 'ACTIVE' ? 'طالب مستمر' : s.status}</span></div>
      <div class="grid">
        <div class="row"><span class="l">رقم الطالب</span><span class="v">${s.id}</span></div>
        <div class="row"><span class="l">رقم الهاتف</span><span class="v">0${getPhone(s.phones)}</span></div>
        ${secNames ? `<div class="row"><span class="l">المسجل في</span><span class="v">${secNames}</span></div>` : ''}
      </div>
    </div>
    <div class="foot">${formatDate(new Date())}</div>
    </body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  const tdStyle = { padding: '7px 10px', border: '1px solid var(--glass-border)', textAlign: 'center' as const, fontSize: '0.8rem' };
  const thStyle = { ...tdStyle, background: 'var(--primary-light)', fontWeight: 600 };

  return (
    <ErrorBoundary>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <input type="text" className="glass-input" placeholder="ابحث بالاسم أو الهاتف..." value={searchQuery}
                onChange={e => handleSearch(e.target.value)} />
              {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 100, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, maxHeight: 220, overflowY: 'auto', backdropFilter: 'var(--glass-blur)', marginTop: 4 }}>
                  {searchResults.map(s => (
                    <div key={s.id} onClick={() => selectStudent(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <User size={14} color="var(--primary-color)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.fullNameAr}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>0{getPhone(s.phones)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="glass-btn" onClick={() => setIsDeepOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Search size={16} /> بحث عميق
            </button>
          </div>
        </div>

        {selectedStudent && (
          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>👤</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedStudent.fullNameAr}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>0{getPhone(selectedStudent.phones)}</div>
                  <span className={`badge ${selectedStudent.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '0.72rem' }}>
                    {selectedStudent.status === 'ACTIVE' ? 'مستمر' : selectedStudent.status}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="glass-btn" onClick={() => navigate(`/add-to-section?studentId=${selectedStudent.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowLeftRight size={15} /> السحب والإضافة
                </button>
                <button className="glass-btn" onClick={() => navigate(`/installments?studentId=${selectedStudent.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wallet size={15} /> الأقساط والدفع
                </button>
                <button className="glass-btn" onClick={() => { const next = ins.find((i: any) => remOf(i) > 0); if (next) openPay(next); else toast.info('لا توجد أقساط مستحقة', 'جميع الأقساط مسددة'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' }}>
                  <CreditCard size={15} /> سداد سريع
                </button>
                <button className="glass-btn secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Printer size={15} /> طباعة A4
                </button>
                <button className="glass-btn secondary" onClick={() => setShowCard(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Image size={15} /> بطاقة الطالب
                </button>
                <button className="glass-btn secondary" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={15} /> مشاركة
                </button>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--glass-border)', margin: '12px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Filter size={15} color="var(--secondary-color)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>أقسام الطباعة:</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ padding: '5px 12px', borderRadius: 8, fontSize: '0.82rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={13} /> المعلومات الشخصية <span style={{ opacity: 0.5 }}>•</span> إلزامي
              </span>
              {[{ key: 'schedule', label: 'الجدول الدراسي', icon: <Calendar size={13} /> },
                { key: 'subs', label: 'الاشتراكات', icon: <GraduationCap size={13} /> },
                { key: 'installments', label: 'جدول الأقساط', icon: <CreditCard size={13} /> },
                { key: 'attendance', label: 'الحضور والغياب', icon: <Calendar size={13} /> },
                { key: 'notes', label: 'الملاحظات', icon: <FileText size={13} /> }
              ].map(s => {
                const active = printSections[s.key as keyof typeof printSections];
                return (
                  <label key={s.key} onClick={() => togglePrintSection(s.key)}
                    style={{
                      padding: '5px 12px', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none',
                      display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                      background: active ? 'var(--primary)' : 'var(--glass-bg)',
                      color: active ? '#fff' : 'var(--text-color)',
                      border: active ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                      boxShadow: active ? '0 2px 8px rgba(59,130,246,0.25)' : 'none',
                    }}>
                    {s.icon} {s.label}
                  </label>
                );
              })}
            </div>
            <div style={{ height: 1, background: 'var(--glass-border)', margin: '10px 0' }} />
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>إجمالي المدفوع: </span><strong style={{ color: 'var(--success)' }}>{paid.toFixed(3)} د</strong></div>
              <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>المتبقي: </span><strong style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>{remaining.toFixed(3)} د</strong></div>
              <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>عدد الأقساط: </span><strong>{ins.length}</strong></div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>جارٍ تحميل البيانات...</div>
        ) : !selectedStudent ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 40px', opacity: 0.4 }}>
            <Search size={48} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: '1rem' }}>ابحث عن طالب لعرض ملفه</p>
          </div>
        ) : (
          <div ref={printRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                <User size={17} color="var(--primary-color)" /> المعلومات الشخصية
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px 28px', fontSize: '0.85rem', lineHeight: 1.8 }}>
                <Field label="الاسم (عربي)" value={selectedStudent.fullNameAr} />
                <Field label="الهاتف" value={`0${getPhone(selectedStudent.phones)}`} />
                <Field label="رقم الطالب" value={selectedStudent.id} />
                <Field label="تاريخ الميلاد" value={selectedStudent.dob ? formatDate(selectedStudent.dob) : null} />
                <Field label="الجنس" value={selectedStudent.gender === 'MALE' ? 'ذكر' : selectedStudent.gender === 'FEMALE' ? 'أنثى' : null} />
                <Field label="الجنسية" value={selectedStudent.nationality === 'JO' ? 'أردني' : selectedStudent.nationality === 'OTHER' ? 'غير أردني' : selectedStudent.nationality} />
                {selectedStudent.fullNameEn && <Field label="الاسم (إنج)" value={selectedStudent.fullNameEn} />}
                {selectedStudent.email && <Field label="البريد" value={selectedStudent.email} />}
                {(selectedStudent.nationalId || selectedStudent.passportId || selectedStudent.personalId) && (
                  <Field label="الرقم الوطني" value={selectedStudent.nationalId || selectedStudent.passportId || selectedStudent.personalId} />
                )}
                {selectedStudent.address && <Field label="العنوان" value={selectedStudent.address} />}
                {selectedStudent.governorate && <Field label="المحافظة" value={selectedStudent.governorate} />}
                <Field label="صفة الطالب" value={
                  selectedStudent.studentType === 'UNIVERSITY' ? 'طالب جامعة' :
                  selectedStudent.studentType === 'HIGH_SCHOOL' ? 'طالب ثانوي' :
                  selectedStudent.studentType === 'EMPLOYEE' ? 'موظف' :
                  selectedStudent.studentType === 'OTHER' ? 'غير ذلك' : selectedStudent.studentType
                } />
                {selectedStudent.universityName && <Field label="الجامعة" value={selectedStudent.universityName} />}
                {selectedStudent.universityId && <Field label="الرقم الجامعي" value={selectedStudent.universityId} />}
                <Field label="الحالة" value={selectedStudent.status === 'ACTIVE' ? 'مستمر' : selectedStudent.status === 'POSTPONED' ? 'مؤجل' : selectedStudent.status === 'WITHDRAWN' ? 'منسحب' : selectedStudent.status === 'CANCELED' ? 'ملغي' : selectedStudent.status === 'FINISHED' ? 'أنهى الدراسة' : selectedStudent.status} />
                {selectedStudent.markerEmployee?.fullName && <Field label="المسوّق" value={selectedStudent.markerEmployee.fullName} />}
                {selectedStudent.registrationDate && <Field label="تاريخ التسجيل" value={formatDate(selectedStudent.registrationDate)} />}
              </div>
            </div>

            {secList.length > 0 && printSections.schedule && (
              <div className="glass-panel" style={{ padding: '18px 22px' }}>
                <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                  <Calendar size={17} color="var(--secondary-color)" /> الجدول الدراسي
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr><th style={thStyle}>المادة</th><th style={thStyle}>رقم الشعبة</th><th style={thStyle}>الأيام</th><th style={thStyle}>الوقت</th><th style={thStyle}>القاعة</th><th style={thStyle}>المدرب</th></tr></thead>
                    <tbody>{getActiveSections().map((item: any) => {
                      const sec = secToDisplay(item);
                      return (
                      <tr key={sec.id}>
                        <td style={tdStyle}>{sec.course?.name || sec.diploma?.name || '—'}</td>
                        <td style={tdStyle}>{sec.name || '—'}</td>
                        <td style={tdStyle}>{scheduleDays(sec)}</td>
                        <td style={tdStyle}>{scheduleTime(sec)}</td>
                      <td style={tdStyle}>
                        <div>{sec.room?.name || '—'}</div>
                        <LearningTypeBadge room={sec.room} style={{ marginTop: 2 }} />
                      </td>
                      <td style={tdStyle}>{sec.instructor?.name || '—'}</td>
                      </tr>
                    )})}</tbody>
                  </table>
                </div>
              </div>
            )}

            {printSections.subs && (
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                <GraduationCap size={17} color="var(--secondary-color)" /> الاشتراكات
              </h4>
              {subs.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr><th style={thStyle}>النوع</th><th style={thStyle}>الاشتراك</th><th style={thStyle}>التكلفة</th></tr></thead>
                  <tbody>{subs.map((sub: any) => (
                    <tr key={sub.id}>
                      <td style={tdStyle}><span className="badge" style={{ background: sub._type === 'diploma' ? 'var(--primary-light)' : 'var(--secondary-light)', color: sub._type === 'diploma' ? 'var(--primary)' : 'var(--secondary)', fontSize: '0.75rem' }}>{sub._type === 'diploma' ? 'دبلوم' : 'دورة'}</span></td>
                      <td style={tdStyle}>{sub.diploma?.name || sub.course?.name || 'اشتراك'}</td>
                      <td style={{ ...tdStyle, color: 'var(--success)', fontWeight: 600 }}>{sub.totalCost?.toFixed(3)} د</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', opacity: 0.4 }}>
                  <GraduationCap size={32} style={{ marginBottom: 8 }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد اشتراكات بعد</p>
                </div>
              )}
            </div>
            )}

            {printSections.installments && (
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                <CreditCard size={17} color="var(--warning)" /> جدول الأقساط
              </h4>
              {ins.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr><th style={thStyle}>القسط</th><th style={thStyle}>المبلغ</th><th style={thStyle}>تاريخ الاستحقاق</th><th style={thStyle}>جهة الدفع</th><th style={thStyle}>الحالة</th><th style={thStyle}>دفع</th></tr></thead>
                  <tbody>{ins.slice(0, 8).map((inst: any) => {
                    const open = openInstId === inst.id;
                    const pays = (profile?.transactions || []).filter((t: any) => Number(t.installmentId) === Number(inst.id) && t.status !== 'VOIDED');
                    return (
                    <>
                    <tr key={inst.id} onClick={() => setOpenInstId(open ? null : inst.id)}
                      style={{ cursor: 'pointer', background: open ? 'var(--primary-light)' : 'transparent', transition: 'background 0.15s' }}
                      title="اضغط لعرض دفعات هذا القسط">
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          قسط {inst.installmentNumber}
                          {pays.length > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 400 }}>({pays.length} دفعة)</span>}
                        </span>
                      </td>
                      <td style={tdStyle}>{inst.amount?.toFixed(3)} د</td>
                      <td style={tdStyle}>{formatDate(inst.dueDate)}</td>
                      <td style={tdStyle}>
                        {inst.paymentDest ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span className={`badge ${inst.paymentDest === 'ENTITY' ? 'warning' : 'secondary'}`} style={{ fontSize: '0.68rem', alignSelf: 'flex-start' }}>
                              {inst.paymentDest === 'ENTITY' ? 'جهة التعليم' : 'لدينا'}
                            </span>
                            {(() => { const full = destFull(inst.paymentDest, inst.subscriptionId); const nm = full ? full.split('—')[1]?.trim() : null; return nm ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{nm}</span> : null; })()}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>
                        <span className={`badge ${inst.status === 'PAID' ? 'success' : inst.status === 'OVERDUE' ? 'danger' : 'warning'}`}>
                          {inst.status === 'PAID' ? 'مدفوع' : inst.status === 'OVERDUE' ? 'متأخر' : 'معلق'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, width: 70 }} onClick={e => e.stopPropagation()}>
                        {remOf(inst) > 0 ? (
                          <button onClick={() => openPay(inst)}
                            style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                            <CreditCard size={12} /> دفع
                          </button>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>}
                      </td>
                    </tr>
                    {open && (
                      <tr key={`pays-${inst.id}`}>
                        <td colSpan={6} style={{ background: 'var(--glass-bg)', padding: '12px 14px', border: '1px solid var(--glass-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--secondary-color)' }}>
                              <Banknote size={13} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} /> دفعات قسط #{inst.installmentNumber}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>إجمالي المسدد: <strong style={{ color: 'var(--success)', fontFamily: 'monospace' }}>{(inst.paidAmount || 0).toFixed(3)} د</strong></span>
                          </div>
                          {pays.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                                <thead>
                                  <tr>
                                    <th style={thStyle}>#</th>
                                    <th style={thStyle}>التاريخ</th>
                                    <th style={thStyle}>النوع</th>
                                    <th style={thStyle}>المبلغ</th>
                                    <th style={thStyle}>طريقة الدفع</th>
                                    <th style={thStyle}>الجهة</th>
                                    <th style={thStyle}>المرجع / الإيصال</th>
                                    <th style={thStyle}>ملاحظات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pays.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((p: any, i: number) => (
                                    <tr key={p.id}>
                                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.68rem' }}>{i + 1}</td>
                                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{formatDate(p.date)}</td>
                                      <td style={tdStyle}>
                                        <span className={`badge ${p.type === 'RECEIPT' ? 'success' : p.type === 'PAYMENT' ? 'danger' : 'secondary'}`} style={{ fontSize: '0.62rem' }}>
                                          {p.type === 'RECEIPT' ? 'قبض' : p.type === 'PAYMENT' ? 'صرف' : p.type}
                                        </span>
                                      </td>
                                      <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace', direction: 'ltr', color: p.type === 'PAYMENT' ? 'var(--danger)' : 'var(--success)' }}>
                                        {p.amount?.toFixed(3)} د
                                      </td>
                                      <td style={tdStyle}>{pmLabel(p)}</td>
                                      <td style={{ ...tdStyle, fontSize: '0.7rem' }}>{txDestText(p) || '—'}</td>
                                      <td style={{ ...tdStyle, fontSize: '0.7rem', direction: 'ltr' }}>{p.referenceNumber || p.receiptNumber || '—'}</td>
                                      <td style={{ ...tdStyle, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              لا توجد دفعات مسجلة على هذا القسط
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </>
                    );
                  })}</tbody>
                </table>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد أقساط</p>}
            </div>
            )}

            {printSections.attendance && (
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
                <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                  <Calendar size={17} color="var(--primary-color)" /> الحضور والغياب
                  <button onClick={() => setPinAttendance(p => !p)}
                    title={pinAttendance ? 'مثبّت — سيظهر السجل الكامل للغياب في الطباعة' : 'ثبّت لعرض السجل الكامل للغياب في الطباعة'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      padding: '4px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                      border: `1.5px solid ${pinAttendance ? 'var(--primary)' : 'var(--glass-border)'}`,
                      background: pinAttendance ? 'var(--primary)' : 'var(--glass-bg)',
                      color: pinAttendance ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                    }}>
                    {pinAttendance ? <Pin size={12} /> : <PinOff size={12} />}
                    {pinAttendance ? 'مثبّت — سجل كامل في الطباعة' : 'تثبيت السجل الكامل للطباعة'}
                  </button>
                </h4>
                {secList.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>المادة / الشعبة</th>
                        <th style={thStyle}>رقم الشعبة</th>
                        <th style={thStyle}>الأيام</th>
                        <th style={thStyle}>الوقت</th>
                        <th style={thStyle}>من تاريخ</th>
                        <th style={thStyle}>إلى تاريخ</th>
                        <th style={thStyle}>عدد أيام الدوام</th>
                        <th style={thStyle}>الحضور</th>
                        <th style={thStyle}>الغياب</th>
                        <th style={thStyle}>نسبة الحضور</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secList.map((item: any) => {
                        const sec = secToDisplay(item);
                        const st = attStats(String(sec.id));
                        const enrollDate = item.enrollDate;
                        const isCurrent = item.status === 'ENROLLED' || item.status === 'ACTIVE';
                        const transferDate = getTransferDate(sec.id, isCurrent);
                        return (
                          <>
                          <tr key={sec.id} onClick={() => setOpenAttSec(openAttSec === sec.id ? null : sec.id)}
                            style={{ cursor: 'pointer', background: openAttSec === sec.id ? 'var(--primary-light)' : 'transparent', transition: 'background 0.15s' }}
                            title="اضغط لعرض تفاصيل أيام الحضور والغياب">
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                {openAttSec === sec.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                {sec.course?.name || sec.diploma?.name || '—'}
                              </span>
                            </td>
                            <td style={tdStyle}>{sec.name || '—'}</td>
                            <td style={tdStyle}>{scheduleDays(sec)}</td>
                            <td style={tdStyle}>{scheduleTime(sec)}</td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                              {enrollDate ? formatDate(enrollDate) : '—'}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                              {transferDate ? formatDate(transferDate) : isCurrent ? 'الآن' : '—'}
                            </td>
                            <td style={tdStyle}>{st.total}</td>
                            <td style={tdStyle}>{st.present}</td>
                            <td style={tdStyle}>
                              <button onClick={e => { e.stopPropagation(); setOpenAttSec(openAttSec === sec.id ? null : sec.id); }}
                                title="عرض تفاصيل أيام الحضور والغياب"
                                style={{
                                  background: 'none', border: '1px solid var(--glass-border)', borderRadius: 8,
                                  padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                                  color: st.absent + st.late > 0 ? 'var(--danger)' : 'var(--text-muted)',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                                }}>
                                {st.absent + st.late}
                                {openAttSec === sec.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ color: st.total ? (st.pct >= 75 ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-muted)', fontWeight: 600 }}>
                                {st.total ? `${st.pct}%` : '—'}
                              </span>
                            </td>
                          </tr>
                          {openAttSec === sec.id && (
                            <tr key={`att-detail-${sec.id}`}>
                              <td colSpan={10} style={{ background: 'var(--glass-bg)', padding: '12px 14px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                                    سجل الحضور والغياب — {sec.course?.name || sec.diploma?.name || '—'} ({sec.name || '—'})
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {st.total} يوم مسجل • حضور {st.present} • غياب {st.absent} • متأخر {st.late} • بعذر {st.excused}
                                  </span>
                                </div>
                                <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>التاريخ</th>
                                        <th style={thStyle}>اليوم</th>
                                        <th style={thStyle}>الحالة</th>
                                        <th style={thStyle}>ملاحظات</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {attDetailRows(item).length === 0 ? (
                                        <tr>
                                          <td colSpan={5} style={{ ...tdStyle, color: 'var(--text-muted)', padding: '18px' }}>
                                            لا توجد أيام دوام لهذه الشعبة
                                          </td>
                                        </tr>
                                      ) : attDetailRows(item).map((r: any, i: number) => {
                                        const stInfo = r.record ? ATT_STATUS_LABEL[attStatus(r.record)] : null;
                                        return (
                                          <tr key={r.key}>
                                            <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.7rem' }}>{i + 1}</td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                                              {formatDate(r.date)}
                                            </td>
                                            <td style={tdStyle}>{r.dayName}</td>
                                            <td style={tdStyle}>
                                              {stInfo ? (
                                                <span className={`badge ${stInfo.cls}`} style={{ fontSize: '0.65rem' }}>{stInfo.label}</span>
                                              ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                                                  لم يتم تسجيل الحضور بعد
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                              {r.record?.notes || '—'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', opacity: 0.4 }}>
                    <Calendar size={32} style={{ marginBottom: 8 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد شعب مسجلة للطالب</p>
                  </div>
                )}
              </div>
            )}

            {printSections.notes && (
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
                <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                  <FileText size={17} color="var(--text-muted)" /> ملاحظات
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 400 }}>يظهر اسم الكاتب وصفته في النظام فقط — لا يظهران في الطباعة</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {parseStudentNotes(selectedStudent.notes).length > 0 ? parseStudentNotes(selectedStudent.notes).map((n, i) => (
                    <div key={i} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '9px 12px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{n.content}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {n.authorName ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--secondary)', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                            <User size={11} /> {n.authorName}
                            {n.authorJobTitle ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {n.authorJobTitle}</span> : null}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>ملاحظة قديمة</span>
                        )}
                        {n.createdAt && <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{formatDate(n.createdAt)}</span>}
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '12px 0', opacity: 0.35 }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد ملاحظات</p>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" className="glass-input" style={{ flex: 1, fontSize: '0.8rem' }} value={noteText}
                    onInput={e => setNoteText((e.target as HTMLInputElement).value)}
                    placeholder="أضف ملاحظة جديدة..." />
                  <button className="glass-btn" onClick={addNote} disabled={noteSaving || !noteText.trim()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    <Send size={14} /> {noteSaving ? 'جارٍ الإضافة...' : 'إضافة'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <DeepSearchModal isOpen={isDeepOpen} onClose={() => setIsDeepOpen(false)} onSearch={() => {}} onSelectStudent={handleDeepSearch} />
        {showCard && selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowCard(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: 380, color: '#333', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Image size={16} color="#6366f1" />
                  <strong style={{ fontSize: '0.95rem' }}>بطاقة الطالب</strong>
                </div>
                <button onClick={() => setShowCard(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ flex: 1, textAlign: 'right', direction: 'rtl' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>{centerName || 'المركز التعليمي'}</div>
                  </div>
                  <div style={{ width: 46, height: 46, borderRadius: 8, background: centerLogo ? `url(${fileUrl(centerLogo)}) center/contain no-repeat` : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {!centerLogo && <GraduationCap size={20} style={{ color: '#fff', opacity: 0.7 }} />}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', direction: 'ltr' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#374151' }}>{centerNameEn}</div>
                  </div>
                </div>
                <div style={{ padding: '16px 14px' }}>
                  <div style={{ width: 70, height: 70, margin: '0 auto 10px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.6rem', fontWeight: 700 }}>
                    {selectedStudent.fullNameAr?.trim().charAt(0) || 'ط'}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedStudent.fullNameAr}</div>
                  {selectedStudent.fullNameEn && <div style={{ fontSize: '0.72rem', color: '#6b7280', direction: 'ltr' }}>{selectedStudent.fullNameEn}</div>}
                  <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 12px', borderRadius: 20, fontSize: '0.66rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>
                    {selectedStudent.status === 'ACTIVE' ? 'طالب مستمر' : selectedStudent.status}
                  </span>
                  <div style={{ marginTop: 14, borderTop: '1px dashed #e5e7eb', paddingTop: 10, textAlign: 'right', fontSize: '0.78rem', lineHeight: 2.1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>رقم الطالب</span><strong>{selectedStudent.id}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>رقم الهاتف</span><strong>0{getPhone(selectedStudent.phones)}</strong></div>
                    {secList.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#6b7280' }}>المسجل في</span><strong style={{ textAlign: 'left' }}>{secList.map((s: any) => s.course?.name || s.diploma?.name).join('، ')}</strong></div>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="glass-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }} onClick={handlePrintCard}>
                  <Printer size={13} /> طباعة البطاقة
                </button>
                <button className="glass-btn secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => setShowCard(false)}>إغلاق</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick payment modal — same steps/principle as the installments page ── */}
        {payOpen && payInst && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={closePay}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 20, width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', color: 'var(--text)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={17} color="var(--success)" />
                  <strong style={{ fontSize: '0.95rem' }}>سداد سريع — {selectedStudent?.fullNameAr}</strong>
                </div>
                <button onClick={closePay} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                قسط #{payInst.installmentNumber}/{payInst.totalInstallments} — المتبقي: <strong style={{ color: 'var(--danger)', fontFamily: 'monospace' }}>{remOf(payInst).toFixed(3)} د</strong>
                {' · '}استحقاق {formatDate(payInst.dueDate)}
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: 4 }}>المبلغ (د.أ) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" inputMode="decimal" className="glass-input" placeholder="0.00" value={payAmount}
                  onInput={e => setPayAmount(cleanDecimal((e.target as HTMLInputElement).value))} style={{ direction: 'ltr', fontSize: '0.82rem', fontWeight: 600 }} />
                {(() => {
                  const v = toNumber(payAmount);
                  if (payAmount.trim() && !(v > 0)) {
                    return (
                      <div style={{ fontSize: '0.66rem', color: 'var(--danger)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AlertTriangle size={11} /> لم يُحتسب المبلغ المدخل — تأكد من كتابة رقم صحيح
                      </div>
                    );
                  }
                  if (!v || v <= 0) return null;
                  const plan = buildPayPlan(v, payInst, paySiblings(payInst));
                  const balance = remOf(payInst);
                  if (plan.over) {
                    return (
                      <div style={{ fontSize: '0.66rem', color: 'var(--danger)', marginTop: 6, padding: '7px 9px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                        <span>المبلغ ({v.toFixed(2)} د.أ) يتجاوز إجمالي المتبقي على أقساط هذا الاشتراك ({plan.cap.toFixed(2)} د.أ) — لن تُقبل الدفعة</span>
                      </div>
                    );
                  }
                  if (plan.excess <= 0) {
                    const full = v >= balance;
                    return (
                      <div style={{ fontSize: '0.66rem', color: full ? 'var(--success)' : 'var(--text-muted)', marginTop: 6, padding: '7px 9px', borderRadius: 8, background: full ? 'rgba(22,163,74,0.08)' : 'var(--glass-bg)', border: `1px solid ${full ? 'rgba(22,163,74,0.25)' : 'var(--glass-border)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                        <span>{full ? `سيُسدَّد هذا القسط بالكامل (${v.toFixed(2)} د.أ)` : `دفعة جزئية على هذا القسط — المتبقي بعدها (${(balance - v).toFixed(2)} د.أ)`}</span>
                      </div>
                    );
                  }
                  return (
                    <div style={{ fontSize: '0.66rem', marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.28)', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 5 }}>
                        <Info size={13} color="var(--secondary)" style={{ flexShrink: 0 }} />
                        <span>سيُسدَّد هذا القسط بالكامل ({plan.main.toFixed(2)} د.أ) ويُوزَّع الفائض ({plan.excess.toFixed(2)} د.أ) على {plan.targets.length} قسط آخر:</span>
                      </div>
                      {plan.targets.map((t: any) => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0', fontSize: '0.63rem', borderTop: '1px dashed rgba(13,148,136,0.2)' }}>
                          <span>قسط #{t.no}/{t.totalCount} — المتبقي ({t.remain.toFixed(2)})</span>
                          <span style={{ fontWeight: 700, color: 'var(--secondary)', fontFamily: 'monospace', direction: 'ltr' }}>{t.amount.toFixed(2)} د.أ</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[{ value: 'ENTITY', label: '🏫 جهة التعليم' }, { value: 'US', label: '🏢 لدينا' }].map(opt => (
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
              {!payDest && <div style={{ fontSize: '0.64rem', color: 'var(--danger)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> مطلوب — اختر جهة الدفع</div>}

              {payDest === 'ENTITY' ? (<>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: 4 }}>رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" className={`glass-input ${refUsed ? 'error-field' : ''}`} value={payRef} onInput={e => setPayRef(normalizeDigits((e.target as HTMLInputElement).value))} placeholder="رقم الإيصال — يُقبل بأي لغة" style={{ fontSize: '0.8rem' }} />
                  {refStatusLine(refChecking, refUsed, !!cleanRefVal(payRef))}
                </div>
              </>) : (<>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: 4 }}>طريقة الدفع <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select className="glass-input" value={payMethod} onChange={e => { setPayMethod(e.target.value); setPaySubMethod(''); setPayBank(''); setPayCheckNum(''); setPayHawalaNum(''); }} style={{ fontSize: '0.8rem' }}>
                    <option value="CASH">💰 نقداً</option>
                    <option value="TRANSFER">📲 إلكتروني</option>
                    <option value="CHECK">📄 شيك</option>
                    <option value="MONEY_TRANSFER">🌍 حوالة مالية</option>
                  </select>
                </div>

                {payMethod === 'TRANSFER' && (<>
                  <div style={{ marginBottom: 10, padding: '9px 11px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: 3 }}>نوع المحفظة الإلكترونية <span style={{ color: 'var(--danger)' }}>*</span></label>
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
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: 3 }}>رقم الحوالة</label>
                      <input type="text" className="glass-input" value={payWalletRef} onChange={e => setPayWalletRef(normalizeDigits(e.target.value))} placeholder="اختياري — رقم العملية من المحفظة" style={{ fontSize: '0.74rem', padding: '5px 8px', direction: 'ltr' }} />
                    </div>
                  </div>
                </>)}

                {payMethod === 'CHECK' && (<>
                  <div style={{ marginBottom: 10, padding: '9px 11px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: 3 }}>البنك <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select className="glass-input" value={payBank} onChange={e => setPayBank(e.target.value)} style={{ fontSize: '0.74rem', padding: '5px 8px' }}>
                        <option value="">— اختر البنك —</option>
                        {Object.entries(BL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: 3 }}>رقم الشيك <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" className="glass-input" value={payCheckNum} onChange={e => setPayCheckNum(normalizeDigits(e.target.value))} placeholder="رقم الشيك" style={{ fontSize: '0.74rem', padding: '5px 8px', direction: 'ltr' }} />
                    </div>
                  </div>
                </>)}

                {payMethod === 'MONEY_TRANSFER' && (<>
                  <div style={{ marginBottom: 10, padding: '9px 11px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: 3 }}>نوع الحوالة المالية <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select className="glass-input" value={paySubMethod} onChange={e => setPaySubMethod(e.target.value)} style={{ fontSize: '0.74rem', padding: '5px 8px' }}>
                        <option value="">— اختر نوع الحوالة —</option>
                        <option value="WESTERN_UNION">ويسترن يونيون (Western Union)</option>
                        <option value="MONEYGRAM">MoneyGram</option>
                        <option value="RIA_MONEY">RIA Money</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: 3 }}>رقم الحوالة <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" className="glass-input" value={payHawalaNum} onChange={e => setPayHawalaNum(normalizeDigits(e.target.value))} placeholder="رقم الحوالة المالية" style={{ fontSize: '0.74rem', padding: '5px 8px', direction: 'ltr' }} />
                    </div>
                  </div>
                </>)}

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: 4 }}>رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" className={`glass-input ${refUsed ? 'error-field' : ''}`} value={payRef} onInput={e => setPayRef(normalizeDigits((e.target as HTMLInputElement).value))} placeholder="رقم الإيصال أو التحويل — يُقبل بأي لغة" style={{ fontSize: '0.8rem' }} />
                  {refStatusLine(refChecking, refUsed, !!cleanRefVal(payRef))}
                </div>
              </>)}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: 4 }}>ملاحظات الدفع</label>
                <input type="text" className="glass-input" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." style={{ fontSize: '0.8rem' }} />
              </div>

              <button className="glass-btn" onClick={handleQuickPay} disabled={payLoading || (toNumber(payAmount) > 0 && buildPayPlan(toNumber(payAmount), payInst, paySiblings(payInst)).over)}
                style={{ width: '100%', justifyContent: 'center', background: 'var(--success)', color: '#fff', borderColor: 'var(--success)', fontSize: '0.8rem', ...(toNumber(payAmount) > 0 && buildPayPlan(toNumber(payAmount), payInst, paySiblings(payInst)).over ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                {payLoading ? 'جارٍ تسجيل الدفعة...' : (toNumber(payAmount) > 0 && buildPayPlan(toNumber(payAmount), payInst, paySiblings(payInst)).over ? 'المبلغ غير مقبول — أعلى من المتبقي' : `تسديد ${toNumber(payAmount).toFixed(2)} د.أ`)}
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
