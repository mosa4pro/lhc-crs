import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Save, GraduationCap, BookOpen, DollarSign, Filter,
  CheckCircle, X, Pin, PinOff, CreditCard, Calendar, Plus, Minus, AlertTriangle
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { cleanNum, toNumber } from '../utils/arabicNumbers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = API_BASE + '/api';

export const SubscriptionPage = () => {
  const { apiFetch } = useApi();
  const { token, hasPermission } = useAuth();
  const toast = useToast();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── State ── */
  const [subType, setSubType]               = useState<'DIPLOMA' | 'COURSE'>('DIPLOMA');
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<any[]>([]);
  const [pinnedResults, setPinnedResults]   = useState<any[]>([]);
  const [isPinned, setIsPinned]             = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [diplomas, setDiplomas]             = useState<any[]>([]);
  const [courses, setCourses]               = useState<any[]>([]);
  const [categories, setCategories]         = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading]           = useState(false);
  const [isDeepOpen, setIsDeepOpen]         = useState(false);
  const [successMsg, _setSuccessMsg]         = useState('');

  /* Student's existing subscriptions */
  const [studentDiplomas, setStudentDiplomas] = useState<any[]>([]);
  const [studentCourses, setStudentCourses]   = useState<any[]>([]);
  const [existingTab, setExistingTab]         = useState<'DIPLOMA' | 'COURSE'>('DIPLOMA');

  const [financials, setFinancials] = useState({
    baseFee: 500,
    hasTransport: false,
    transportFee: 50,
    hasSupplies: false,
    suppliesFee: 30,
    discountType: 'NONE' as 'NONE' | 'FIXED' | 'PERCENTAGE',
    discountValue: 0
  });

  const totalCost = (() => {
    let t = financials.baseFee;
    if (financials.hasTransport) t += financials.transportFee;
    if (financials.hasSupplies)  t += financials.suppliesFee;
    if (financials.discountType === 'FIXED')      t -= financials.discountValue;
    else if (financials.discountType === 'PERCENTAGE') t -= (t * financials.discountValue) / 100;
    return t > 0 ? t : 0;
  })();

  const subtotal = (() => {
    let t = financials.baseFee;
    if (financials.hasTransport) t += financials.transportFee;
    if (financials.hasSupplies)  t += financials.suppliesFee;
    return t;
  })();

  const discountAmount = financials.discountType === 'FIXED'
    ? Math.min(financials.discountValue, subtotal)
    : financials.discountType === 'PERCENTAGE'
    ? Math.min((subtotal * financials.discountValue) / 100, subtotal)
    : 0;

  const [form, setForm] = useState({
    programId: '',
    studyType: 'FACE_TO_FACE',
    date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    installmentsCount: 1,
    notes: '',
    minPaymentException: false
  });

  const [installmentPlan, setInstallmentPlan] = useState({
    firstAmount: totalCost,
    firstPaid: false,
    firstPaymentDest: '' as '' | 'ENTITY' | 'US',
    firstPaymentMethod: 'CASH' as 'CASH' | 'TRANSFER' | 'CHECK' | 'MONEY_TRANSFER',
    firstPaymentSubMethod: '' as string, // wallet type (TRANSFER) or transfer type (MONEY_TRANSFER)
    firstPaymentRef: '',
    firstPaymentWalletRef: '', // optional for electronic
    firstPaymentBank: '',
    firstPaymentCheckNum: '',
    firstPaymentHawalaNum: '',
    firstPaymentNotes: '',
    dates: [new Date().toISOString().split('T')[0]],
  });

  // Manual overrides for installment amounts (null = use base calculation)
  const [manualAmounts, setManualAmounts] = useState<number[] | null>(null);
  const [amountError, setAmountError] = useState('');

  const effectiveCount = (() => {
    const first = installmentPlan.firstAmount || totalCost;
    if (first >= totalCost) return 1;
    return Math.max(form.installmentsCount, 2);
  })();

  const baseAmounts = (() => {
    const count = effectiveCount;
    if (count <= 0) return [];
    const first = installmentPlan.firstAmount || totalCost;
    if (first >= totalCost) return [totalCost];
    const remaining = totalCost - first;
    if (remaining <= 0 || !isFinite(remaining)) return [totalCost];
    const restCount = count - 1;
    if (restCount <= 0) return [totalCost];
    const perRest = Math.round(remaining / restCount);
    const amounts: number[] = [first];
    for (let i = 1; i < count; i++) amounts.push(perRest);
    const sumPrev = amounts.slice(0, -1).reduce((s, a) => s + a, 0);
    amounts[count - 1] = Math.round((totalCost - sumPrev) * 100) / 100;
    return amounts;
  })();

  const calcKey = `${totalCost}-${installmentPlan.firstAmount}-${effectiveCount}`;
  const manualCalcKey = useRef(calcKey);
  const displayAmounts = (() => {
    if (manualAmounts !== null && manualCalcKey.current === calcKey) {
      return manualAmounts;
    }
    return baseAmounts;
  })();

  function setManualAmountsSync(amounts: number[] | null) {
    if (amounts !== null) manualCalcKey.current = calcKey;
    setManualAmounts(amounts);
    setAmountError('');
  }

  // Shared helper for editing an installment at `index` with a new `value`.
  // Recalculates the last installment to absorb the remainder.
  // Returns true on success, false if invalid (error message set).
  function editInstallment(index: number, value: number) {
    if (value < 0 || !isFinite(value)) { setAmountError('المبلغ غير صالح'); return false; }
    const newAmounts = [...displayAmounts];
    newAmounts[index] = Math.round(value);
    const lastIdx = effectiveCount - 1;
    if (index === lastIdx) {
      const sumPrev = newAmounts.slice(0, -1).reduce((s, a) => s + a, 0);
      if (sumPrev + newAmounts[index] > totalCost) {
        setAmountError(`أقصى مبلغ للدفعة الأخيرة: ${(totalCost - sumPrev).toFixed(0)} د.أ`);
        return false;
      }
    } else {
      const sumOthers = newAmounts.reduce((s, a, idx) => idx === lastIdx ? s : s + a, 0);
      const lastAmount = totalCost - sumOthers;
      if (lastAmount < 0) {
        setAmountError('المبلغ يتجاوز التكلفة المتبقية');
        return false;
      }
      newAmounts[lastIdx] = Math.round(lastAmount);
    }
    setManualAmountsSync(newAmounts);
    return true;
  }

  // Unified firstAmount setter — syncs cash mode instantly
  const setFirstAmount = (val: number) => {
    const clamped = Math.max(0, val);
    setInstallmentPlan(prev => ({ ...prev, firstAmount: clamped }));
    if (clamped >= totalCost) {
      setForm(prev => prev.installmentsCount !== 1 ? { ...prev, installmentsCount: 1 } : prev);
    }
  };

  /* ── Load reference data ── */
  useEffect(() => {
    Promise.all([
      apiFetch('/diplomas').then(setDiplomas).catch(() => {}),
      apiFetch('/courses').then(setCourses).catch(() => {}),
      apiFetch('/courses/categories').then(setCategories).catch(() => {})
    ]);
  }, []);

  /* Reset program and set default fee when subType changes */
  useEffect(() => {
    setForm(f => ({ ...f, programId: '' }));
    setSelectedCategory('');
    setFinancials(f => ({
      ...f,
      baseFee: subType === 'DIPLOMA' ? 500 : 150,
      hasTransport: false,
      hasSupplies: false,
      discountType: 'NONE',
      discountValue: 0
    }));
  }, [subType]);

  /* Auto-set cash mode when firstAmount = 100% of totalCost */
  useEffect(() => {
    if (totalCost > 0 && installmentPlan.firstAmount >= totalCost) {
      setForm(f => f.installmentsCount !== 1 ? { ...f, installmentsCount: 1 } : f);
    }
  }, [installmentPlan.firstAmount, totalCost]);

  /* ── Quick search ── */
  const handleSearch = async (q: string) => {
    const cleaned = cleanNum(q);
    setSearchQuery(q);
    if (cleaned.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`${API}/students?query=${encodeURIComponent(cleaned)}&limit=10`, { headers });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  /* ── Select student ── */
  const selectStudent = async (s: any) => {
    setSelectedStudent(s);
    setSearchQuery('');
    setSearchResults([]);
    loadStudentSubscriptions(s.id);
  };

  const loadStudentSubscriptions = async (studentId: string) => {
    try {
      const [dipRes, crsRes] = await Promise.all([
        fetch(`${API}/subscriptions/diploma?studentId=${studentId}&limit=50`, { headers }),
        fetch(`${API}/subscriptions/course?studentId=${studentId}&limit=50`, { headers })
      ]);
      if (dipRes.ok) setStudentDiplomas(await dipRes.json());
      if (crsRes.ok) setStudentCourses(await crsRes.json());
    } catch {}
  };

  const handleDeepSelect = (st: any) => selectStudent(st);

  const handlePin = () => {
    if (!isPinned) {
      setPinnedResults(searchResults);
      setIsPinned(true);
    } else {
      setPinnedResults([]);
      setIsPinned(false);
    }
  };

  const getPhone = (phones: any) => {
    try { return (typeof phones === 'string' ? JSON.parse(phones) : phones)?.[0] || '—'; } catch { return '—'; }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-JO') : '—';

  /* ── Save subscription ── */
  // Validation state
  const [refError, setRefError] = useState('');

  const handleSave = async () => {
    if (!selectedStudent) return toast.error('تنبيه', 'الرجاء اختيار طالب أولاً');
    if (!form.programId) return toast.error('تنبيه', subType === 'DIPLOMA' ? 'يرجى اختيار الدبلوم' : 'يرجى اختيار الدورة');
    if (totalCost <= 0) return toast.error('تنبيه', 'التكلفة يجب أن تكون أكبر من صفر');
    if (installmentPlan.firstPaid) {
      if (!installmentPlan.firstPaymentDest) {
        setRefError('يرجى اختيار جهة الدفع (جهة التعليم أو لدينا)');
        return;
      }
      if (!installmentPlan.firstPaymentRef.trim()) {
        setRefError('رقم المرجع مطلوب عند تأكيد الدفع');
        return;
      }
      if (installmentPlan.firstPaymentMethod === 'TRANSFER' && !installmentPlan.firstPaymentSubMethod) {
        setRefError('يرجى اختيار نوع المحفظة الإلكترونية');
        return;
      }
      if (installmentPlan.firstPaymentMethod === 'MONEY_TRANSFER') {
        if (!installmentPlan.firstPaymentSubMethod) {
          setRefError('يرجى اختيار نوع الحوالة المالية');
          return;
        }
        if (!installmentPlan.firstPaymentHawalaNum.trim()) {
          setRefError('رقم الحوالة مطلوب للحوالة المالية');
          return;
        }
      }
      if (installmentPlan.firstPaymentMethod === 'CHECK') {
        if (!installmentPlan.firstPaymentBank) {
          setRefError('يرجى اختيار البنك للدفع بشيك');
          return;
        }
        if (!installmentPlan.firstPaymentCheckNum.trim()) {
          setRefError('رقم الشيك مطلوب');
          return;
        }
      }
    }
    setRefError('');
    setIsLoading(true);

    const firstAmt = installmentPlan.firstAmount || totalCost;
    const isCash = firstAmt >= totalCost;
    const payload: any = {
      studentId: selectedStudent.id,
      studyType: form.studyType,
      baseFee: financials.baseFee,
      hasTransport: financials.hasTransport,
      transportFee: financials.transportFee,
      hasSupplies: financials.hasSupplies,
      suppliesFee: financials.suppliesFee,
      discountType: financials.discountType,
      discountValue: financials.discountValue,
      totalCost,
      paymentType: isCash ? 'FULL' : 'INSTALLMENTS',
      installmentsCount: isCash ? 1 : form.installmentsCount,
      firstInstallmentAmount: firstAmt,
      firstInstallmentPaid: installmentPlan.firstPaid,
      firstPaymentDest: installmentPlan.firstPaid ? installmentPlan.firstPaymentDest : undefined,
      firstPaymentMethod: installmentPlan.firstPaid ? installmentPlan.firstPaymentMethod : undefined,
      firstPaymentSubMethod: installmentPlan.firstPaid && (installmentPlan.firstPaymentMethod === 'TRANSFER' || installmentPlan.firstPaymentMethod === 'MONEY_TRANSFER') ? installmentPlan.firstPaymentSubMethod : undefined,
      firstPaymentRef: installmentPlan.firstPaid ? installmentPlan.firstPaymentRef : undefined,
      firstPaymentWalletRef: installmentPlan.firstPaid && installmentPlan.firstPaymentMethod === 'TRANSFER' ? installmentPlan.firstPaymentWalletRef : undefined,
      firstPaymentBank: installmentPlan.firstPaid && installmentPlan.firstPaymentMethod === 'CHECK' ? installmentPlan.firstPaymentBank : undefined,
      firstPaymentCheckNum: installmentPlan.firstPaid && installmentPlan.firstPaymentMethod === 'CHECK' ? installmentPlan.firstPaymentCheckNum : undefined,
      firstPaymentHawalaNum: installmentPlan.firstPaid && installmentPlan.firstPaymentMethod === 'MONEY_TRANSFER' ? installmentPlan.firstPaymentHawalaNum : undefined,
      installmentDates: isCash ? [] : installmentPlan.dates,
      installmentAmounts: isCash ? [] : displayAmounts,
      status: form.status,
      notes: form.notes,
      minPaymentException: form.minPaymentException
    };

    if (subType === 'DIPLOMA') {
      payload.diplomaId = form.programId;
    } else {
      payload.courseId = form.programId;
    }

    try {
      const endpoint = subType === 'DIPLOMA' ? '/subscriptions/diploma' : '/subscriptions/course';
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast.success('تم التسجيل', `تم تسجيل ${selectedStudent.fullNameAr} في ${subType === 'DIPLOMA' ? 'الدبلوم' : 'الدورة'} بنجاح`);

      // Reset form program selection
      setForm(f => ({ ...f, programId: '', notes: '' }));
      loadStudentSubscriptions(selectedStudent.id);
    } catch (e: any) {
      toast.error('خطأ', e.message || 'تعذر الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  const displayResults = isPinned ? pinnedResults : searchResults;
  const selectedProgramDetails = subType === 'DIPLOMA'
    ? diplomas.find(d => d.id === form.programId)
    : courses.find(c => c.id === form.programId);

  // Collect all course IDs that are part of the student's existing diploma subscriptions
  const diplomaCourseIds = new Set<string>();
  studentDiplomas.forEach(sub => {
    (sub.diploma?.courses || []).forEach((dc: any) => diplomaCourseIds.add(dc.courseId));
  });

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><GraduationCap className="text-primary" size={22}/> إدارة تسجيل واشتراكات الطلاب</h2>
        
        {/* Toggle Switch */}
        <div style={{
          display: 'flex',
          background: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '30px',
          padding: '4px',
          gap: '4px'
        }}>
          <button
            onClick={() => setSubType('DIPLOMA')}
            style={{
              padding: '8px 20px',
              borderRadius: '26px',
              border: 'none',
              background: subType === 'DIPLOMA' ? 'var(--primary)' : 'transparent',
              color: subType === 'DIPLOMA' ? '#fff' : 'var(--text)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <GraduationCap size={16} /> تسجيل في دبلوم
          </button>
          <button
            onClick={() => setSubType('COURSE')}
            style={{
              padding: '8px 20px',
              borderRadius: '26px',
              border: 'none',
              background: subType === 'COURSE' ? 'var(--primary)' : 'transparent',
              color: subType === 'COURSE' ? '#fff' : 'var(--text)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <BookOpen size={16} /> تسجيل في دورة
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>

        {/* ═══ Right: Student search & Current Subscriptions list ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Search Panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={18} className="text-secondary"/> البحث عن طالب
            </h3>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
                <input
                  type="text" className="glass-input" style={{ paddingRight: 38 }}
                  placeholder="ابحث بالاسم أو الهاتف أو رقم النظام..."
                  value={searchQuery}
                  onInput={e => handleSearch((e.target as HTMLInputElement).value)}
                />
              </div>
              <button className="glass-btn secondary" onClick={() => setIsDeepOpen(true)} title="بحث عميق">
                <Filter size={16}/> بحث عميق
              </button>
            </div>

            {/* Quick results */}
            {(displayResults.length > 0 || (searchResults.length > 0 && !isPinned)) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <button
                    className="glass-btn secondary sm"
                    onClick={handlePin}
                    style={{ fontSize: '0.78rem', gap: 4 }}
                    title={isPinned ? 'إلغاء التثبيت' : 'تثبيت القائمة'}
                  >
                    {isPinned ? <><PinOff size={13}/> إلغاء التثبيت</> : <><Pin size={13}/> تثبيت القائمة</>}
                  </button>
                </div>
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {displayResults.map(s => (
                    <div
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'background 0.15s',
                        background: selectedStudent?.id === s.id ? 'var(--primary-light)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (selectedStudent?.id !== s.id) e.currentTarget.style.background = 'var(--table-hover)'; }}
                      onMouseLeave={e => { if (selectedStudent?.id !== s.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="profile-avatar" style={{ width: 32, height: 32, fontSize: '0.85rem', flexShrink: 0 }}>
                        {s.fullNameAr?.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{s.fullNameAr}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.id} • 0{getPhone(s.phones)}
                        </div>
                      </div>
                      {selectedStudent?.id === s.id && <CheckCircle size={15} color="var(--success)"/>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected student card */}
            {selectedStudent && (
              <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{selectedStudent.fullNameAr}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    رقم النظام: <strong style={{ color: 'var(--primary)' }}>{selectedStudent.id}</strong>
                    {' '} • 0{getPhone(selectedStudent.phones)}
                  </div>
                </div>
                <button className="glass-btn secondary icon-only" onClick={() => { setSelectedStudent(null); setStudentDiplomas([]); setStudentCourses([]); }}>
                  <X size={15}/>
                </button>
              </div>
            )}
          </div>

          {/* Current Subscriptions Panel */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {existingTab === 'DIPLOMA' ? <GraduationCap size={17} className="text-secondary"/> : <BookOpen size={17} className="text-secondary"/>}
                الاشتراكات المسجلة الحالية
              </h4>

              {/* Subscriptions Switch */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-muted)', padding: 3, borderRadius: 8 }}>
                <button
                  onClick={() => setExistingTab('DIPLOMA')}
                  className={`glass-btn sm ${existingTab === 'DIPLOMA' ? '' : 'secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  الدبلومات ({studentDiplomas.length})
                </button>
                <button
                  onClick={() => setExistingTab('COURSE')}
                  className={`glass-btn sm ${existingTab === 'COURSE' ? '' : 'secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  الدورات ({studentCourses.length})
                </button>
              </div>
            </div>

            {!selectedStudent ? (
              <div className="empty-state" style={{ padding: '28px 0' }}>
                <Search size={36}/><p>اختر طالباً لعرض اشتراكاته الحالية</p>
              </div>
            ) : existingTab === 'DIPLOMA' ? (
              studentDiplomas.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <GraduationCap size={28}/><p>لا توجد اشتراكات دبلوم مسجّلة لهذا الطالب</p>
                </div>
              ) : (
                <div className="glass-table-container">
                    <table className="glass-table">
                    <thead>
                      <tr>
                        <th>الدبلوم</th>
                        <th>تاريخ التسجيل</th>
                        <th>التكلفة الإجمالية</th>
                        <th>الدفع</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                    {studentDiplomas.map((sub: any) => {
                      const diplomaCourses = sub.diploma?.courses || [];
                      return (
                        <React.Fragment key={sub.id}>
                          <tr>
                            <td style={{ fontWeight: 700 }}>
                              {sub.diploma?.name || '—'}
                              {diplomaCourses.length > 0 && (
                                <div style={{ marginTop: 6, fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                  {diplomaCourses.map((dc: any) => (
                                    <div key={dc.id} style={{ padding: '2px 0' }}>• {dc.course?.name || '—'}</div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>{formatDate(sub.date || sub.createdAt)}</td>
                            <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                              {Number(sub.totalCost || 0).toFixed(2)} د.أ
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>
                              {sub.paymentType === 'FULL' ? 'كامل' : `أقساط (${sub.installmentsCount})`}
                            </td>
                            <td>
                              <span className={`badge ${sub.status === 'ACTIVE' ? 'success' : sub.status === 'CANCELED' ? 'danger' : 'warning'}`}>
                                {sub.status === 'ACTIVE' ? 'فعال' : sub.status === 'CANCELED' ? 'ملغي' : 'معلق'}
                              </span>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              studentCourses.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <BookOpen size={28}/><p>لا توجد اشتراكات دورات مسجّلة لهذا الطالب</p>
                </div>
              ) : (
                <div className="glass-table-container">
                    <table className="glass-table">
                    <thead>
                      <tr>
                        <th>الدورة</th>
                        <th>تاريخ التسجيل</th>
                        <th>التكلفة الإجمالية</th>
                        <th>الدفع</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentCourses.map((sub: any) => (
                        <tr key={sub.id}>
                          <td style={{ fontWeight: 700 }}>{sub.course?.name || '—'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{formatDate(sub.date || sub.createdAt)}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                            {Number(sub.totalCost || 0).toFixed(2)} د.أ
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {sub.paymentType === 'FULL' ? 'كامل' : `أقساط (${sub.installmentsCount})`}
                          </td>
                          <td>
                            <span className={`badge ${sub.status === 'ACTIVE' ? 'success' : sub.status === 'CANCELED' ? 'danger' : 'warning'}`}>
                              {sub.status === 'ACTIVE' ? 'فعال' : sub.status === 'CANCELED' ? 'ملغي' : 'معلق'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* ═══ Left: Subscription Registration Form ═══ */}
        <div className="glass-panel" style={{ opacity: selectedStudent ? 1 : 0.55, pointerEvents: selectedStudent ? 'auto' : 'none' }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            {subType === 'DIPLOMA' ? <GraduationCap size={22} className="text-secondary"/> : <BookOpen size={22} className="text-secondary"/>}
            تسجيل {subType === 'DIPLOMA' ? 'دبلوم جديد' : 'دورة جديدة'}
          </h3>

          

          <div className="form-group">
            <label className="form-label">نوع الدراسة</label>
            <select className="glass-input" value={form.studyType} onChange={e => setForm(prev => ({ ...prev, studyType: e.target.value }))}>
              <option value="FACE_TO_FACE">وجاهي</option>
              <option value="HYBRID">مدمج</option>
              <option value="ONLINE">إلكتروني</option>
              </select>
            </div>

          {subType === 'COURSE' && (
            <div className="form-group">
              <label className="form-label">تصنيف الدورة</label>
              <select className="glass-input" value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setForm(prev => ({ ...prev, programId: '' })); }}>
                <option value="">-- جميع التصنيفات --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label"><span className="required-star">*</span> اختيار {subType === 'DIPLOMA' ? 'الدبلوم' : 'الدورة'}</label>
            <select
              className="glass-input"
              value={form.programId}
              onChange={e => {
                const val = e.target.value;
                setForm(prev => ({ ...prev, programId: val }));
                if (subType === 'DIPLOMA') {
                  const d = diplomas.find(x => x.id === val);
                  if (d) {
                    const price = d.totalPrice || 500;
                    setFinancials(prev => ({ ...prev, baseFee: price }));
                    setFirstAmount(price);
                  }
                } else {
                  const c = courses.find(x => x.id === val);
                  if (c) {
                    const price = c.price || 150;
                    setFinancials(prev => ({ ...prev, baseFee: price }));
                    setFirstAmount(price);
                  }
                }
              }}
            >
              <option value="">-- اختر من القائمة --</option>
              {subType === 'DIPLOMA' ? (
                diplomas.map(d => <option key={d.id} value={d.id}>[{d.id || '—'}] {d.name}{d.totalPrice ? ` — ${d.totalPrice} د.أ` : ''}</option>)
              ) : (
                courses
                  .filter(c => !selectedCategory || c.categoryId === Number(selectedCategory))
                  .map(c => {
                    const inDiploma = diplomaCourseIds.has(c.id);
                    return (
                      <option key={c.id} value={c.id} style={inDiploma ? { color: 'var(--warning)', fontWeight: 700 } : {}}>
                        [{c.id || '—'}] {c.name}{c.price ? ` — ${c.price} د.أ` : ''}{inDiploma ? ' ⚠️ موجود في الدبلوم' : ''}
                      </option>
                    );
                  })
              )}
            </select>
          </div>

          {selectedProgramDetails?.description && (
            <div style={{ padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 10, marginBottom: 14, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {selectedProgramDetails.description}
            </div>
          )}

          <div className="divider"/>

          <h4 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} className="text-success"/> الرسوم المالية والخصومات
          </h4>

          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">الرسوم الأساسية للبرنامج</label>
              <input type="text" inputMode="decimal" className="glass-input" value={financials.baseFee}
                onFocus={e => e.target.select()}
                onInput={e => setFinancials(prev => ({ ...prev, baseFee: toNumber((e.target as HTMLInputElement).value) }))}/>
            </div>
            <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', flex: 1 }}>
                  <input type="checkbox" checked={financials.hasTransport}
                    onChange={e => setFinancials(prev => ({ ...prev, hasTransport: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  مواصلات
                </label>
                <input type="text" inputMode="decimal"
                  disabled={!financials.hasTransport}
                  style={{
                    width: 110, textAlign: 'center', direction: 'ltr',
                    opacity: financials.hasTransport ? 1 : 0.5,
                    background: financials.hasTransport ? 'var(--card-bg)' : 'var(--bg-muted)',
                    transition: 'all 0.2s'
                  }}
                  className="glass-input"
                  value={financials.transportFee}
                  onFocus={e => e.target.select()}
                  onInput={e => setFinancials(prev => ({ ...prev, transportFee: toNumber((e.target as HTMLInputElement).value) }))}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 28 }}>د.أ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', flex: 1 }}>
                  <input type="checkbox" checked={financials.hasSupplies}
                    onChange={e => setFinancials(prev => ({ ...prev, hasSupplies: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  مستلزمات
                </label>
                <input type="text" inputMode="decimal"
                  disabled={!financials.hasSupplies}
                  style={{
                    width: 110, textAlign: 'center', direction: 'ltr',
                    opacity: financials.hasSupplies ? 1 : 0.5,
                    background: financials.hasSupplies ? 'var(--card-bg)' : 'var(--bg-muted)',
                    transition: 'all 0.2s'
                  }}
                  className="glass-input"
                  value={financials.suppliesFee}
                  onFocus={e => e.target.select()}
                  onInput={e => setFinancials(prev => ({ ...prev, suppliesFee: toNumber((e.target as HTMLInputElement).value) }))}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 28 }}>د.أ</span>
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">نوع الخصم</label>
              <select className="glass-input" value={financials.discountType} onChange={e => setFinancials(prev => ({ ...prev, discountType: e.target.value as any }))}>
                <option value="NONE">بدون خصم</option>
                <option value="FIXED">قيمة ثابتة</option>
                <option value="PERCENTAGE">نسبة مئوية (%)</option>
              </select>
            </div>
            {financials.discountType !== 'NONE' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">قيمة الخصم</label>
                <input type="text" inputMode="decimal" className="glass-input" value={financials.discountValue}
                  onFocus={e => e.target.select()}
                  onInput={e => setFinancials(prev => ({ ...prev, discountValue: toNumber((e.target as HTMLInputElement).value) }))}/>
              </div>
            )}
          </div>

          {discountAmount > 0 ? (
            <div key={'tc-' + totalCost} style={{
              background: 'linear-gradient(135deg, var(--success), #059669)', borderRadius: 14,
              padding: '16px 20px', margin: '14px 0', color: '#fff',
              boxShadow: '0 4px 16px rgba(0,150,0,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 600 }}>المجموع قبل الخصم</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.9, textDecoration: 'line-through' }}>
                    {subtotal.toFixed(2)} د.أ
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 600 }}>قيمة الخصم</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>
                    -{discountAmount.toFixed(2)} د.أ
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 600 }}>التكلفة النهائية</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                    {totalCost.toFixed(2)} د.أ
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div key={'tc-' + totalCost} style={{
              background: 'var(--success-light)', border: '1px solid var(--success)',
              borderRadius: 12, padding: '14px 20px', textAlign: 'center',
              margin: '14px 0', fontSize: '1.25rem', fontWeight: 900, color: 'var(--success)',
              transition: 'all 0.15s',
            }}>
              التكلفة الإجمالية: {totalCost.toFixed(2)} دينار أردني
            </div>
          )}

          <div className="divider"/>

          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">تاريخ التسجيل</label>
              <input type="date" className="glass-input" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}/>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">حالة الاشتراك</label>
               <select className="glass-input" value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
                <option value="ACTIVE">فعال</option>
                <option value="PENDING">قيد الانتظار</option>
                <option value="CANCELED">ملغي</option>
              </select>
            </div>
          </div>

          <div className="divider"/>

          {/* ═══ Professional Installment Plan ═══ */}
          <h4 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} className="text-primary"/> خطة الدفع والتقسيط
          </h4>

          <div style={{
            background: 'var(--card-bg)', borderRadius: 14, padding: '18px 16px',
            border: '1.5px solid var(--glass-border)', marginBottom: 14,
          }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  💰 الدفعة الأولى
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr' }}>
                  <button type="button" tabIndex={-1}
                    onClick={() => {
                      const step = Math.max(10, Math.round(totalCost * 0.05));
                      const next = Math.max(0, (installmentPlan.firstAmount || totalCost) - step);
                      setFirstAmount(Math.round(next * 100) / 100);
                    }}
                    style={{
                      background: 'var(--bg-muted)', border: 'none', borderRadius: '8px 0 0 8px',
                      padding: '8px 10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700,
                      color: 'var(--text-muted)', lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--glass-border)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'var(--bg-muted)'}
                  >−</button>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input type="text" inputMode="decimal" className="glass-input"
                      style={{ paddingLeft: 44, fontWeight: 700, fontSize: '1rem', textAlign: 'center', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}
                      value={installmentPlan.firstAmount}
                      placeholder={totalCost ? `${totalCost.toFixed(2)} د.أ` : ''}
                      onFocus={e => e.target.select()}
                      onInput={e => {
                        const val = toNumber((e.target as HTMLInputElement).value);
                        setFirstAmount(val);
                      }}/>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>د.أ</span>
                  </div>
                  <button type="button" tabIndex={-1}
                    onClick={() => {
                      const step = Math.max(10, Math.round(totalCost * 0.05));
                      const next = Math.min(totalCost, (installmentPlan.firstAmount || 0) + step);
                      setFirstAmount(Math.round(next * 100) / 100);
                    }}
                    style={{
                      background: 'var(--bg-muted)', border: 'none', borderRadius: '0 8px 8px 0',
                      padding: '8px 10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700,
                      color: 'var(--primary)', lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--primary-light)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'var(--bg-muted)'}
                  >+</button>
                </div>
                {/* Quick presets + percentage bar */}
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-muted)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: installmentPlan.firstAmount >= totalCost ? 'var(--success)' : 'var(--primary)',
                      width: `${Math.min(100, ((installmentPlan.firstAmount || 0) / (totalCost || 1)) * 100)}%`,
                      transition: 'width .2s ease',
                    }}/>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>
                    {totalCost > 0 ? `${Math.round(((installmentPlan.firstAmount || 0) / totalCost) * 100)}%` : '—'}
                  </span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[25, 50, 75, 100].map(pct => (
                    <button key={pct} type="button" tabIndex={-1}
                      onClick={() => setFirstAmount(Math.round(totalCost * pct / 100 * 100) / 100)}
                      style={{
                        flex: 1, padding: '4px 0', fontSize: '0.7rem', fontWeight: 700, borderRadius: 6,
                        border: '1px solid var(--glass-border)', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-muted)', transition: 'all .15s',
                      }}
                      onMouseEnter={e => {
                        (e.target as HTMLElement).style.background = 'var(--primary-light)';
                        (e.target as HTMLElement).style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.background = 'transparent';
                        (e.target as HTMLElement).style.borderColor = 'var(--glass-border)';
                      }}
                    >{pct}%</button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  📊 عدد الدفعات (الإجمالي)
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  background: 'var(--card-bg)', borderRadius: 10,
                  border: '1.5px solid var(--glass-border)', overflow: 'hidden',
                }}>
                  <button type="button"
                    onClick={() => {
                      const min = installmentPlan.firstAmount < totalCost ? 2 : 1;
                      const next = Math.max((effectiveCount || 1) - 1, min);
                      if (next === effectiveCount) return;
                      setForm(prev => ({ ...prev, installmentsCount: next }));
                      setInstallmentPlan(prev => ({
                        ...prev,
                        dates: prev.dates.slice(0, next),
                      }));
                    }}
                    style={{
                      background: 'none', border: 'none', padding: '8px 14px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                      opacity: effectiveCount <= 1 ? 0.3 : 1,
                    }}
                    disabled={effectiveCount <= 1}
                    onMouseEnter={e => { if (effectiveCount > 1) (e.target as HTMLElement).style.background = 'var(--bg-muted)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
                  >−</button>
                  <div style={{ flex: 1, textAlign: 'center', padding: '4px 0' }}>
                    <input type="text" inputMode="numeric"
                      value={effectiveCount}
                      onInput={e => {
                        const raw = cleanNum((e.target as HTMLInputElement).value);
                        if (!raw) return;
                        let count = parseInt(raw) || 1;
                        const min = installmentPlan.firstAmount < totalCost ? 2 : 1;
                        if (count < min) count = min;
                        if (count > 24) count = 24;
                        if (count === effectiveCount) return;
                        setForm(prev => ({ ...prev, installmentsCount: count }));
                        setInstallmentPlan(prev => ({
                          ...prev,
                          dates: Array.from({ length: count }, (_, i) => prev.dates[i] || new Date(Date.now() + i * 30 * 86400000).toISOString().split('T')[0]),
                        }));
                      }}
                      style={{
                        width: 40, border: 'none', background: 'transparent',
                        textAlign: 'center', fontSize: '1rem', fontWeight: 700,
                        color: 'var(--text)', outline: 'none',
                        fontFamily: 'inherit',
                      }}/>
                  </div>
                  <button type="button"
                    onClick={() => {
                      const next = Math.min((effectiveCount || 1) + 1, 24);
                      if (next === effectiveCount) return;
                      setForm(prev => ({ ...prev, installmentsCount: next }));
                      setInstallmentPlan(prev => ({
                        ...prev,
                        dates: Array.from({ length: next }, (_, i) => prev.dates[i] || new Date(Date.now() + i * 30 * 86400000).toISOString().split('T')[0]),
                      }));
                    }}
                    style={{
                      background: 'none', border: 'none', padding: '8px 14px',
                      cursor: 'pointer',
                      color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                      opacity: effectiveCount >= 24 ? 0.3 : 1,
                    }}
                    disabled={effectiveCount >= 24}
                    onMouseEnter={e => { if (effectiveCount < 24) (e.target as HTMLElement).style.background = 'var(--primary-light)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
                  >+</button>
                </div>
              </div>
            </div>

            {/* Cash badge when first = total */}
            {effectiveCount === 1 && (
              <div style={{
                marginTop: 10, padding: '10px 14px', background: 'var(--success-light)',
                border: '1px solid var(--success)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)',
              }}>
                <DollarSign size={18}/> دفع كامل — يعتبر نقدي (بدون تقسيط)
              </div>
            )}

            {/* Installment dates + amounts table */}
            {effectiveCount > 1 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', margin: 0 }}>
                    📅 تواريخ ومبالغ الدفعات
                  </label>
                  {amountError && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                      ⚠️ {amountError}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.from({ length: effectiveCount }, (_, i) => {
                    const isFirst = i === 0;
                    const isLast = i === effectiveCount - 1;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', borderRadius: 8,
                        background: isFirst ? 'var(--primary-light)' : 'var(--card-bg)',
                        border: '1px solid', borderColor: isFirst ? 'var(--primary)' : 'var(--glass-border)',
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: isFirst ? 'var(--primary)' : 'var(--text-muted)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                        }}>{i + 1}</span>
                        <div style={{ width: 90, flexShrink: 0, fontSize: '0.78rem', fontWeight: 600 }}>
                          {isFirst ? 'الأولى' : isLast ? 'الأخيرة' : `${i + 1}`}
                        </div>
                        {isFirst ? (
                          <span style={{
                            width: 100, fontSize: '0.85rem', padding: '5px 8px',
                            textAlign: 'center', fontWeight: 700, color: 'var(--primary)',
                            display: 'inline-block',
                          }}>
                            {displayAmounts[i] ? Math.round(displayAmounts[i]).toString() : '0'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button type="button" tabIndex={-1}
                              onClick={() => {
                                const step = Math.max(5, Math.round(totalCost * 0.02));
                                const current = displayAmounts[i] || 0;
                                editInstallment(i, Math.max(0, current - step));
                              }}
                              style={{
                                background: 'none', border: '1px solid var(--glass-border)', borderRadius: '6px 0 0 6px',
                                padding: '4px 7px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                color: 'var(--text-muted)', lineHeight: 1, borderRight: 'none',
                              }}
                              onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--bg-muted)'}
                              onMouseLeave={e => (e.target as HTMLElement).style.background = 'none'}
                            >−</button>
                            <input type="text" inputMode="decimal" className="glass-input"
                              style={{
                                width: 74, fontSize: '0.8rem', padding: '4px 2px', textAlign: 'center',
                                borderRadius: 0, borderLeft: 'none', borderRight: 'none',
                              }}
                              value={displayAmounts[i] ? Math.round(displayAmounts[i]).toString() : ''}
                              onFocus={e => e.target.select()}
                              onInput={e => {
                                const val = toNumber((e.target as HTMLInputElement).value);
                                if (val >= 0) editInstallment(i, val);
                              }}/>
                            <button type="button" tabIndex={-1}
                              onClick={() => {
                                const step = Math.max(5, Math.round(totalCost * 0.02));
                                const current = displayAmounts[i] || 0;
                                editInstallment(i, current + step);
                              }}
                              style={{
                                background: 'none', border: '1px solid var(--glass-border)', borderRadius: '0 6px 6px 0',
                                padding: '4px 7px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                color: 'var(--primary)', lineHeight: 1, borderLeft: 'none',
                              }}
                              onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--primary-light)'}
                              onMouseLeave={e => (e.target as HTMLElement).style.background = 'none'}
                            >+</button>
                          </div>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, width: 24 }}>د.أ</span>
                        <input type="date" className="glass-input"
                          style={{ width: 130, fontSize: '0.78rem', padding: '5px 8px' }}
                          value={installmentPlan.dates[i] || new Date(Date.now() + i * 30 * 86400000).toISOString().split('T')[0]}
                          onChange={e => {
                            const newDates = [...installmentPlan.dates];
                            newDates[i] = e.target.value;
                            setInstallmentPlan(prev => ({ ...prev, dates: newDates }));
                          }}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ═══ First installment paid status ═══ */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: 14, padding: '16px',
            border: '1.5px solid var(--glass-border)', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: installmentPlan.firstPaid ? 16 : 0 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                {effectiveCount === 1 ? '💰 حالة الدفع الكامل' : '✅ حالة الدفعة الأولى'}
              </span>
              <button type="button"
                onClick={() => {
                  setInstallmentPlan(prev => prev.firstPaid ? { ...prev, firstPaid: false } : { ...prev, firstPaid: true, firstPaymentDest: '', firstPaymentMethod: 'CASH', firstPaymentSubMethod: '', firstPaymentRef: '', firstPaymentWalletRef: '', firstPaymentBank: '', firstPaymentCheckNum: '', firstPaymentHawalaNum: '' });
                  setRefError('');
                }}
                style={{
                  fontSize: '0.82rem', padding: '7px 20px', borderRadius: 8, border: '1.5px solid',
                  fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                  background: installmentPlan.firstPaid ? '#25D366' : 'transparent',
                  color: installmentPlan.firstPaid ? '#fff' : 'var(--text)',
                  borderColor: installmentPlan.firstPaid ? '#25D366' : 'var(--glass-border)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {installmentPlan.firstPaid ? '✓ مدفوع' : '○ غير مدفوع'}
              </button>
            </div>

            {installmentPlan.firstPaid && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Payment destination */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    جهة الدفع <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{
                    display: 'flex', gap: 8,
                    padding: 6, borderRadius: 12,
                    border: installmentPlan.firstPaymentDest
                      ? '1.5px solid var(--glass-border)'
                      : '1.5px dashed var(--danger)',
                    background: installmentPlan.firstPaymentDest ? 'transparent' : 'rgba(239,68,68,0.06)',
                    transition: 'all .2s',
                  }}>
                    {[
                      { value: 'ENTITY', label: '🏫 جهة التعليم' },
                      { value: 'US', label: '🏢 لدينا' },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setInstallmentPlan(prev => ({ ...prev, firstPaymentDest: opt.value as 'ENTITY' | 'US', firstPaymentMethod: 'CASH', firstPaymentBank: '', firstPaymentCheckNum: '', firstPaymentHawalaNum: '' }))}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 10, border: '1.5px solid', cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.82rem', transition: 'all .2s',
                          background: installmentPlan.firstPaymentDest === opt.value ? 'var(--primary)' : 'transparent',
                          color: installmentPlan.firstPaymentDest === opt.value ? '#fff' : 'var(--text)',
                          borderColor: installmentPlan.firstPaymentDest === opt.value ? 'var(--primary)' : 'var(--glass-border)',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {!installmentPlan.firstPaymentDest && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={13} /> مطلوب — اختر جهة الدفع (جهة التعليم أو لدينا) لإتمام الدفعة الأولى
                    </div>
                  )}
                </div>

                {/* Payment method */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    طريقة الدفع <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select className="glass-input" style={{ fontSize: '0.82rem' }}
                    value={installmentPlan.firstPaymentMethod}
                    onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentMethod: e.target.value as 'CASH' | 'TRANSFER' | 'CHECK' | 'MONEY_TRANSFER', firstPaymentSubMethod: '', firstPaymentBank: '', firstPaymentCheckNum: '', firstPaymentHawalaNum: '' }))}>
                    <option value="CASH">💰 نقداً</option>
                    <option value="TRANSFER">📲 إلكتروني</option>
                    <option value="CHECK">📄 شيك</option>
                    <option value="MONEY_TRANSFER">🌍 حوالة مالية</option>
                  </select>
                </div>

                {/* Wallet type (for electronic) */}
                {installmentPlan.firstPaymentMethod === 'TRANSFER' && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>
                        نوع المحفظة الإلكترونية <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <select className="glass-input" style={{ fontSize: '0.82rem' }}
                        value={installmentPlan.firstPaymentSubMethod}
                        onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentSubMethod: e.target.value }))}>
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
                    <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>رقم الحوالة</label>
                    <input type="text" className="glass-input" style={{ fontSize: '0.82rem', direction: 'ltr' }}
                      placeholder="اختياري — رقم العملية من المحفظة"
                        value={installmentPlan.firstPaymentWalletRef}
                        onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentWalletRef: e.target.value }))}/>
                    </div>
                  </>
                )}

                {/* Money transfer type */}
                {installmentPlan.firstPaymentMethod === 'MONEY_TRANSFER' && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>
                        نوع الحوالة المالية <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <select className="glass-input" style={{ fontSize: '0.82rem' }}
                        value={installmentPlan.firstPaymentSubMethod}
                        onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentSubMethod: e.target.value }))}>
                        <option value="">— اختر نوع الحوالة —</option>
                        <option value="WESTERN_UNION">ويسترن يونيون (Western Union)</option>
                        <option value="MONEYGRAM">MoneyGram</option>
                        <option value="RIA_MONEY">RIA Money</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>
                        رقم الحوالة <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input type="text" className="glass-input" style={{ fontSize: '0.82rem', direction: 'ltr' }}
                        placeholder="رقم الحوالة المالية"
                        value={installmentPlan.firstPaymentHawalaNum}
                        onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentHawalaNum: e.target.value }))}/>
                    </div>
                  </>
                )}

                {/* Check details */}
                {installmentPlan.firstPaymentMethod === 'CHECK' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>
                        البنك <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <select className="glass-input" style={{ fontSize: '0.82rem' }}
                        value={installmentPlan.firstPaymentBank}
                        onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentBank: e.target.value }))}>
                        <option value="">— اختر البنك —</option>
                        <option value="Jordan_Ahli">البنك الأهلي الأردني</option>
                        <option value="Arab_Bank">البنك العربي</option>
                        <option value="Housing_Bank">بنك الإسكان</option>
                        <option value="Cairo_Amman">بنك القاهرة عمان</option>
                        <option value="Jordan_Kuwait">البنك الأردني الكويتي</option>
                        <option value="Islamic_Bank">البنك الإسلامي الأردني</option>
                        <option value="Safwa_Islamic">بنك صفوة الإسلامي</option>
                        <option value="Etihad">بنك الاتحاد</option>
                        <option value="Bank_of_Jordan">بنك الأردن</option>
                        <option value="Investbank">بنك الاستثمار</option>
                        <option value="Jordan_Commercial">البنك التجاري الأردني</option>
                        <option value="ABC">بنك ABC</option>
                        <option value="OTHER">بنك آخر</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>
                        رقم الشيك <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input type="text" className="glass-input" style={{ fontSize: '0.82rem', direction: 'ltr' }}
                        placeholder="رقم الشيك"
                        value={installmentPlan.firstPaymentCheckNum}
                        onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentCheckNum: e.target.value }))}/>
                    </div>
                  </div>
                )}

                {/* Reference number (required for all) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    رقم المرجع <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input type="text" className={`glass-input ${refError ? 'error-field' : ''}`}
                    style={{ fontSize: '0.82rem', direction: 'ltr' }}
                    placeholder="إلزامي — رقم الإيصال أو التحويل (يجب ألا يكون مكرراً)"
                    value={installmentPlan.firstPaymentRef}
                    onChange={e => {
                      setInstallmentPlan(prev => ({ ...prev, firstPaymentRef: e.target.value }));
                      if (e.target.value.trim()) setRefError('');
                    }}/>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>ملاحظات الدفع</label>
                  <input type="text" className="glass-input" style={{ fontSize: '0.82rem' }}
                    placeholder="أي ملاحظات إضافية..."
                    value={installmentPlan.firstPaymentNotes}
                    onChange={e => setInstallmentPlan(prev => ({ ...prev, firstPaymentNotes: e.target.value }))}/>
                </div>

                {refError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                    ⚠️ {refError}
                  </div>
                )}
              </div>
            )}

            {!installmentPlan.firstPaid && (
              <div style={{ padding: '10px 0 2px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                سيتم تسجيل الاشتراك كـ <strong>غير مدفوع</strong> — يمكن تحديث حالة الدفع لاحقاً
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">ملاحظات إضافية</label>
            <textarea className="glass-input" rows={2} value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}/>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', padding: '10px 14px', background: 'var(--glass-bg)', borderRadius: 10, border: '1px solid var(--glass-border)', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={form.minPaymentException} onChange={e => setForm(prev => ({ ...prev, minPaymentException: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--warning)' }} />
            <span>🔄 استثناء الحد الأدنى للدفع — السماح بالتسجيل دون دفع الحد الأدنى</span>
          </label>

          {hasPermission('subscriptions.add') && (
            <button className="glass-btn lg" style={{ width: '100%', marginTop: 8 }} onClick={handleSave} disabled={isLoading}>
              <Save size={18}/> {isLoading ? 'جارٍ تسجيل الاشتراك...' : `تأكيد وحفظ اشتراك ال${subType === 'DIPLOMA' ? 'دبلوم' : 'دورة'}`}
            </button>
          )}
        </div>
      </div>

      {/* Deep Search Student Modal */}
      <DeepSearchModal
        isOpen={isDeepOpen}
        onClose={() => setIsDeepOpen(false)}
        onSearch={() => {}}
        onSelectStudent={handleDeepSelect}
        showResultsInline
      />
    </div>
  );
};
