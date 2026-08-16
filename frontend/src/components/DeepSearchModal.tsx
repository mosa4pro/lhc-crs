import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Filter, Calendar, User, Hash, Phone, GraduationCap, CheckSquare, Building2, RefreshCw } from 'lucide-react';
import { JORDANIAN_UNIVERSITIES } from '../utils/constants';
import { DateField } from './DateField';
import { useAuth } from '../context/AuthContext';

export interface DeepSearchFilters {
  id?: string;
  nameAr?: string;
  nameEn?: string;
  phone?: string;
  nationalId?: string;
  nationality?: '' | 'JO' | 'OTHER';
  studentType?: '' | 'UNIVERSITY' | 'HIGH_SCHOOL' | 'EMPLOYEE' | 'OTHER';
  status?: string;
  universityName?: string;
  highSchoolPassed?: '' | 'true' | 'false';
  regDateFrom?: string;
  regDateTo?: string;
  dobFrom?: string;
  dobTo?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: DeepSearchFilters) => void;
  onSelectStudent?: (student: any) => void;
  initialFilters?: DeepSearchFilters;
  showResultsInline?: boolean;
}

const STATUSES = [
  { value: '', label: 'جميع الحالات' },
  { value: 'ACTIVE', label: 'مستمر' },
  { value: 'POSTPONED', label: 'مؤجل' },
  { value: 'WITHDRAWN', label: 'منسحب' },
  { value: 'CANCELED', label: 'ملغي' },
  { value: 'FINISHED', label: 'أنهى الدراسة' },
];

const STUDENT_TYPES = [
  { value: '', label: 'جميع الصفات' },
  { value: 'UNIVERSITY', label: 'طالب جامعة' },
  { value: 'HIGH_SCHOOL', label: 'طالب ثانوي' },
  { value: 'EMPLOYEE', label: 'موظف' },
  { value: 'OTHER', label: 'غير ذلك' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = API_BASE + '/api';

const DeepSearchModalInner: React.FC<Props> = ({
  isOpen, onClose, onSearch, onSelectStudent, initialFilters = {}, showResultsInline = true
}) => {
  const { token } = useAuth();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [filters, setFilters] = useState<DeepSearchFilters>(initialFilters);
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [view, setView] = useState<'filters' | 'results'>('filters');

  useEffect(() => {
    if (isOpen) {
      setFilters(initialFilters);
      setResults([]);
      setHasSearched(false);
      setView('filters');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const set = (key: keyof DeepSearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({});
    setResults([]);
    setHasSearched(false);
    setView('filters');
  };

  const handleApply = async () => {
    setSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (filters.nameAr)         params.set('nameAr', filters.nameAr);
      if (filters.nameEn)         params.set('nameEn', filters.nameEn);
      if (filters.phone)          params.set('query', filters.phone);
      if (filters.id)       params.set('systemId', filters.id);
      if (filters.nationalId)     params.set('nationalId', filters.nationalId);
      if (filters.nationality)    params.set('nationality', filters.nationality);
      if (filters.studentType)    params.set('studentType', filters.studentType);
      if (filters.status)         params.set('status', filters.status);
      if (filters.universityName) params.set('universityName', filters.universityName);
      if (filters.highSchoolPassed) params.set('highSchoolPassed', filters.highSchoolPassed);
      if (filters.regDateFrom)    params.set('regDateFrom', filters.regDateFrom);
      if (filters.regDateTo)      params.set('regDateTo', filters.regDateTo);
      if (filters.dobFrom)        params.set('dobFrom', filters.dobFrom);
      if (filters.dobTo)          params.set('dobTo', filters.dobTo);
      params.set('limit', '50');

      const res = await fetch(`${API}/students?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      setResults(list);

      if (showResultsInline) {
        setView('results');
      } else {
        onSearch(filters);
        onClose();
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const getPhone = (phones: any): string => {
    try {
      const arr = typeof phones === 'string' ? JSON.parse(phones) : phones;
      return arr?.[0] || '—';
    } catch { return '—'; }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483647,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 820,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          direction: 'rtl',
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: '1px solid var(--glass-border)',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={20} color="var(--primary)"/>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              {view === 'results' ? `نتائج البحث العميق (${results.length})` : 'البحث العميق والفلاتر'}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view === 'results' && (
              <button className="glass-btn secondary sm" onClick={() => setView('filters')}>
                ← الفلاتر
              </button>
            )}
            <button className="modal-close" onClick={onClose}><X size={18}/></button>
          </div>
        </div>

        {/* Filters */}
        {view === 'filters' && (
          <div style={{ overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14}/> الاسم العربي
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }}/>
                  <input type="text" className="glass-input" style={{ paddingRight: 36 }}
                    placeholder="ادخل الاسم أو جزء منه..."
                    value={filters.nameAr || ''} onChange={e => set('nameAr', e.target.value)}/>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14}/> الاسم الإنجليزي
                </label>
                <input type="text" className="glass-input"
                  placeholder="Enter name or part of it..."
                  value={filters.nameEn || ''} onChange={e => set('nameEn', e.target.value)}/>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14}/> رقم الهاتف
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }}/>
                  <input type="text" className="glass-input" style={{ paddingRight: 36 }}
                    placeholder="أدخل الرقم أو جزء منه..."
                    value={filters.phone || ''} onChange={e => set('phone', e.target.value)}/>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Hash size={14}/> رقم الطالب
                </label>
                <input type="text" className="glass-input"
                  placeholder="مثال: 2026021230001"
                  value={filters.id || ''} onChange={e => set('id', e.target.value)}/>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">الرقم الوطني / الجواز</label>
                <input type="text" className="glass-input"
                  placeholder="أدخل الرقم..."
                  value={filters.nationalId || ''} onChange={e => set('nationalId', e.target.value)}/>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">الجنسية</label>
                <select className="glass-input" value={filters.nationality || ''} onChange={e => set('nationality', e.target.value)}>
                  <option value="">جميع الجنسيات</option>
                  <option value="JO">أردني</option>
                  <option value="OTHER">غير أردني</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">صفة الطالب</label>
                <select className="glass-input" value={filters.studentType || ''} onChange={e => set('studentType', e.target.value)}>
                  {STUDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">حالة المشترك</label>
                <select className="glass-input" value={filters.status || ''} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">حالة الثانوية</label>
                <select className="glass-input" value={filters.highSchoolPassed || ''} onChange={e => set('highSchoolPassed', e.target.value)}>
                  <option value="">الكل</option>
                  <option value="true">ناجح</option>
                  <option value="false">راسب / غير محدد</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">الجامعة</label>
                <input type="text" className="glass-input" list="deep-uni-list"
                  placeholder="اكتب اسم الجامعة..."
                  value={filters.universityName || ''} onChange={e => set('universityName', e.target.value)}/>
                <datalist id="deep-uni-list">
                  {JORDANIAN_UNIVERSITIES.map(u => <option key={u} value={u}/>)}
                </datalist>
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: 12, padding: 16, background: 'var(--card-bg)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>تاريخ التسجيل</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>من</label>
                    <DateField value={filters.regDateFrom || ''} onChange={v => set('regDateFrom', v)}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>إلى</label>
                    <DateField value={filters.regDateTo || ''} onChange={v => set('regDateTo', v)}/>
                  </div>
                </div>
              </div>
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: 12, padding: 16, background: 'var(--card-bg)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>تاريخ الميلاد</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>من</label>
                    <DateField value={filters.dobFrom || ''} onChange={v => set('dobFrom', v)}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>إلى</label>
                    <DateField value={filters.dobTo || ''} onChange={v => set('dobTo', v)}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {view === 'results' && (
          <div style={{ overflowY: 'auto' }}>
            {searching ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <RefreshCw size={36} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }}/>
                <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>جارٍ البحث...</p>
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                <Search size={44} style={{ opacity: 0.35, marginBottom: 16 }}/>
                <p>لا توجد نتائج مطابقة. جرّب تغيير معايير البحث.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'var(--table-header)' }}>
                    <th style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--table-border)' }}>#</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--table-border)' }}>الاسم</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--table-border)' }}>الرقم</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--table-border)' }}>الهاتف</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--table-border)' }}>الجنسية</th>
                    {onSelectStudent && <th style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)' }}/>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((st, i) => (
                    <tr key={st.id}
                      style={{ cursor: onSelectStudent ? 'pointer' : 'default', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (onSelectStudent) e.currentTarget.style.background = 'var(--table-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                      onClick={() => { if (onSelectStudent) { onSelectStudent(st); onClose(); } }}
                    >
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{i + 1}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                            {(st.fullNameAr || st.fullName)?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{st.fullNameAr || st.fullName}</div>
                            {st.fullNameEn && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.fullNameEn}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)', fontSize: '0.82rem', direction: 'ltr' }}>{st.id || '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)', fontSize: '0.82rem', direction: 'ltr' }}>0{getPhone(st.phones)}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)' }}>
                        <span style={{ fontSize: '0.8rem' }}>{st.nationality === 'JO' ? 'أردني' : 'غير أردني'}</span>
                      </td>
                      {onSelectStudent && (
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--table-border)' }}>
                          <button className="glass-btn sm" onClick={e => { e.stopPropagation(); onSelectStudent(st); onClose(); }}>
                            ← اختيار
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex', gap: 10, justifyContent: 'flex-start',
          flexShrink: 0,
          background: 'var(--card-bg)',
          borderRadius: '0 0 24px 24px',
        }}>
          {view === 'filters' ? (
            <>
              <button className="glass-btn" onClick={handleApply} disabled={searching} style={{ minWidth: 140 }}>
                {searching ? <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }}/> : <Search size={16}/>}
                {searching ? 'جارٍ البحث...' : 'بحث'}
              </button>
              <button className="glass-btn secondary" onClick={handleReset}>مسح الكل</button>
              <button className="glass-btn secondary" onClick={onClose}>إلغاء</button>
            </>
          ) : (
            <>
              <button className="glass-btn secondary" onClick={() => setView('filters')}>← تعديل الفلاتر</button>
              <button className="glass-btn secondary" onClick={handleReset}>بحث جديد</button>
              <button className="glass-btn secondary" onClick={onClose}>إغلاق</button>
              <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                {results.length} نتيجة
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const DeepSearchModal: React.FC<Props> = (props) => {
  return createPortal(<DeepSearchModalInner {...props} />, document.body);
};
