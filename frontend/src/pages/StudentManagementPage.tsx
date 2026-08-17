import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Users, Trash2, Plus, Filter, X, CheckSquare, ChevronLeft, ChevronUp,
  Clock, BookOpen, Shield, ShieldOff, RefreshCw, ChevronDown,
  GraduationCap, AlertTriangle, UserCheck, UserX,
  Loader2
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal, type DeepSearchFilters } from '../components/DeepSearchModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { LearningTypeBadge } from '../components/LearningTypeBadge';
import { STUDENT_STATUS_MAP } from '../utils/constants';

interface StudentSection {
  sectionId: number;
  section?: any;
  result?: string | null;
  attendanceStatus?: string | null;
  attendanceOverride?: boolean;
  attendanceOverrideReason?: string | null;
  studentId: string;
}

interface Student {
  id: string;
  fullNameAr: string;
  fullNameEn?: string;
  nationality: 'JO' | 'OTHER';
  gender?: 'MALE' | 'FEMALE';
  studentType: 'UNIVERSITY' | 'HIGH_SCHOOL' | 'EMPLOYEE' | 'OTHER';
  universityName?: string;
  status: 'ACTIVE' | 'POSTPONED' | 'WITHDRAWN' | 'CANCELED' | 'FINISHED';
  phones: any;
  phoneCodes?: string;
  diplomaSubscriptions?: any[];
  courseSubscriptions?: any[];
  sections?: StudentSection[];
}

type SortKey = 'fullNameAr' | 'id' | 'status' | 'result' | 'attendanceStatus' | 'studentType';
type SortDir = 'ASC' | 'DESC';

const dayLabels: Record<string, string> = {
  SUN: 'الأحد', MON: 'الاثنين', TUE: 'الثلاثاء', WED: 'الأربعاء',
  THU: 'الخميس', FRI: 'الجمعة', SAT: 'السبت'
};
const dayOrder = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];

const formatDays = (days: any): string => {
  try {
    const arr = typeof days === 'string' ? JSON.parse(days) : (Array.isArray(days) ? days : []);
    return arr
      .slice()
      .sort((a: string, b: string) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
      .map((d: string) => dayLabels[d] || d)
      .join(' - ');
  } catch { return ''; }
};

const getWorstAttStatus = (sections: StudentSection[] | undefined): string | null => {
  if (!sections?.length) return null;
  const priority: Record<string, number> = { DEPRIVED: 3, EXEMPTED: 2, ELIGIBLE: 1 };
  let worst: string | null = null, worstPrio = 0;
  for (const ss of sections) {
    const st = ss.attendanceStatus;
    if (st && (priority[st] || 0) > worstPrio) { worst = st; worstPrio = priority[st] || 0; }
  }
  return worst;
};

const getBestResult = (sections: StudentSection[] | undefined): string | null => {
  if (!sections?.length) return null;
  if (sections.some(ss => ss.result === 'PASS')) return 'PASS';
  if (sections.some(ss => ss.result === 'FAIL')) return 'FAIL';
  return null;
};

export const StudentManagementPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [isDeepSearchOpen, setIsDeepSearchOpen] = useState(false);
  const [deepFilters, setDeepFilters] = useState<DeepSearchFilters>({});
  const [hasDeepFilter, setHasDeepFilter] = useState(false);

  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterDiplomaId, setFilterDiplomaId] = useState('');
  const [filterMarkerEmployeeId, setFilterMarkerEmployeeId] = useState('');
  const [filterGradeResult, setFilterGradeResult] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('fullNameAr');
  const [sortDir, setSortDir] = useState<SortDir>('ASC');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sectionMap, setSectionMap] = useState<Record<string, any[]>>({});

  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);

  const [enrollTarget, setEnrollTarget] = useState<Student | null>(null);
  const [availSections, setAvailSections] = useState<any[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const [empOptions, setEmpOptions] = useState<{ id: number; fullName: string }[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>({});

  const stats = useMemo(() => ({
    active: students.filter(s => s.status === 'ACTIVE').length,
    pass: students.filter(s => getBestResult(s.sections) === 'PASS').length,
    fail: students.filter(s => getBestResult(s.sections) === 'FAIL').length,
    deprived: students.filter(s => getWorstAttStatus(s.sections) === 'DEPRIVED').length,
  }), [students]);

  const sorted = useMemo(() => {
    const list = [...students];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'fullNameAr': cmp = a.fullNameAr.localeCompare(b.fullNameAr, 'ar'); break;
        case 'id': cmp = a.id.localeCompare(b.id); break;
        case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
        case 'result': cmp = (getBestResult(a.sections) || '').localeCompare(getBestResult(b.sections) || ''); break;
        case 'attendanceStatus': cmp = (getWorstAttStatus(a.sections) || '').localeCompare(getWorstAttStatus(b.sections) || ''); break;
        case 'studentType': cmp = (a.studentType || '').localeCompare(b.studentType || ''); break;
      }
      return sortDir === 'ASC' ? cmp : -cmp;
    });
    return list;
  }, [students, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortKey(key); setSortDir('ASC'); }
  };

  const loadStudents = useCallback(async (q = '', filters?: DeepSearchFilters) => {
    setIsLoading(true);
    try {
      let url = `/students?query=${encodeURIComponent(q)}&limit=500`;
      const f = filters || deepFilters;
      if (f.status) url += `&status=${f.status}`;
      if (f.studentType) url += `&studentType=${f.studentType}`;
      if (f.nationality) url += `&nationality=${f.nationality}`;
      if (f.regDateFrom) url += `&dateFrom=${f.regDateFrom}`;
      if (f.regDateTo) url += `&dateTo=${f.regDateTo}`;
      if (f.dobFrom) url += `&dobFrom=${f.dobFrom}`;
      if (f.dobTo) url += `&dobTo=${f.dobTo}`;
      if (f.universityName) url += `&universityName=${encodeURIComponent(f.universityName)}`;
      if (f.id) url += `&systemId=${f.id}`;
      if (f.nationalId) url += `&nationalId=${f.nationalId}`;
      if (f.nameAr) url += `&nameAr=${encodeURIComponent(f.nameAr)}`;
      if (f.nameEn) url += `&nameEn=${encodeURIComponent(f.nameEn)}`;
      if (f.highSchoolPassed) url += `&highSchoolPassed=${f.highSchoolPassed}`;
      if (filterSectionId) url += `&sectionId=${filterSectionId}`;
      if (filterCourseId) url += `&courseId=${filterCourseId}`;
      if (filterDiplomaId) url += `&diplomaId=${filterDiplomaId}`;
      if (filterMarkerEmployeeId) url += `&markerEmployeeId=${filterMarkerEmployeeId}`;
      if (filterGradeResult) url += `&gradeResult=${encodeURIComponent(filterGradeResult)}`;
      if (filterPaymentStatus) url += `&paymentStatus=${encodeURIComponent(filterPaymentStatus)}`;

      const res = await apiFetch(url);
      const data = Array.isArray(res) ? res : (res.data || []);
      setStudents(data);
      setTotalCount(Array.isArray(res) ? res.length : (res.total || 0));
    } catch (e: any) {
      toast.error('خطأ في تحميل البيانات', e.message);
    } finally {
      setIsLoading(false);
    }
  }, [deepFilters, filterSectionId, filterCourseId, filterDiplomaId, filterMarkerEmployeeId, filterGradeResult, filterPaymentStatus]);

  useEffect(() => { loadStudents(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const [emp, sec, crs, dip] = await Promise.all([
          apiFetch('/employees?limit=500').catch(() => []),
          apiFetch('/sections?limit=500').catch(() => []),
          apiFetch('/courses?limit=500').catch(() => []),
          apiFetch('/diplomas?limit=500').catch(() => []),
        ]);
        setFilterOptions({ emp, sec, crs, dip });
        setEmpOptions(Array.isArray(emp) ? emp : emp?.data || []);
      } catch {}
    })();
  }, []);

  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadStudents(q), 350);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadStudents('');
    searchInputRef.current?.focus();
  };

  const toggleExpand = (s: Student) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(s.id)) next.delete(s.id);
      else next.add(s.id);
      return next;
    });
    if (!sectionMap[s.id]) {
      const sections = s.sections?.map((ss: StudentSection) => ({
        ...ss.section,
        course: ss.section?.course,
        attendanceStatus: ss.attendanceStatus,
        result: ss.result,
        attendanceOverrideReason: ss.attendanceOverrideReason,
        students: [{ studentId: ss.studentId }]
      })) || [];
      setSectionMap(prev => ({ ...prev, [s.id]: sections }));
    }
  };

  const changeAttStatus = async (secId: number, studentId: string, action: 'EXEMPT' | 'DEPRIVE' | 'REMOVE_OVERRIDE', reason?: string) => {
    try {
      if (action === 'EXEMPT') {
        await apiFetch(`/attendance/override-deprivation/${secId}/student/${studentId}`, { method: 'POST', body: JSON.stringify({ reason: reason || 'إعفاء يدوي' }) });
        toast.success('تم الإعفاء');
      } else if (action === 'DEPRIVE') {
        await apiFetch(`/attendance/override-deprivation/${secId}/student/${studentId}`, { method: 'POST', body: JSON.stringify({ reason: reason || 'حرمان يدوي' }) });
        toast.success('تم الحرمان');
      } else {
        await apiFetch(`/attendance/remove-override/${secId}/student/${studentId}`, { method: 'POST' });
        toast.success('تم إلغاء التجاوز');
      }
      loadStudents(searchQuery);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeepSearch = (filters: DeepSearchFilters) => {
    setDeepFilters(filters);
    loadStudents(searchQuery, filters);
  };

  const handleDelete = (s: Student) => setConfirmDelete(s);
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiFetch(`/students/${confirmDelete.id}`, { method: 'DELETE' });
      toast.success(`تم حذف ${confirmDelete.fullNameAr}`);
      await loadStudents(searchQuery);
    } catch (e: any) { toast.error('فشل الحذف', e.message); }
    finally { setConfirmDelete(null); }
  };

  const getDisplayPhone = (s: Student): string => {
    try {
      const phones = typeof s.phones === 'string' ? JSON.parse(s.phones) : s.phones;
      const codes = Array.isArray(s.phoneCodes) ? s.phoneCodes : (typeof s.phoneCodes === 'string' ? JSON.parse(s.phoneCodes || '[]') : []);
      return Array.isArray(phones) && phones[0] ? `${codes[0] || '+962'} ${typeof phones[0] === 'object' ? phones[0].number : phones[0]}` : '—';
    } catch { return '—'; }
  };

  const sectionOptions = useMemo(() => (Array.isArray(filterOptions.sec) ? filterOptions.sec : filterOptions.sec?.data || []), [filterOptions.sec]);
  const courseOpts = useMemo(() => (Array.isArray(filterOptions.crs) ? filterOptions.crs : filterOptions.crs?.data || []), [filterOptions.crs]);
  const diplomaOpts = useMemo(() => (Array.isArray(filterOptions.dip) ? filterOptions.dip : filterOptions.dip?.data || []), [filterOptions.dip]);

  const openEnroll = (s: Student) => {
    setEnrollTarget(s);
    setSelectedSectionId(null);
    setLoadingAvail(true);
    (async () => { try { const d = await apiFetch(`/students/${s.id}/available-sections`); setAvailSections(Array.isArray(d) ? d : []); } catch { setAvailSections([]); } finally { setLoadingAvail(false); } })();
  };

  const SortHeader = ({ label, sortKey: sk }: { label: string; sortKey: SortKey }) => (
    <th onClick={() => toggleSort(sk)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}{' '}
      <span style={{ opacity: sortKey === sk ? 1 : 0.3, fontSize: '0.65rem' }}>
        {sortKey === sk ? (sortDir === 'ASC' ? '▲' : '▼') : '▲'}
      </span>
    </th>
  );

  const ActionBtn = ({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) => (
    <button className="glass-btn secondary sm" title={label}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        fontSize: '0.7rem', padding: '4px 8px', color, border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      }}>
      {icon} {label}
    </button>
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ═══ HEADER ═══ */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <Users size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>إدارة الطلاب</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {totalCount} طالب {hasDeepFilter && '— فلتر نشط'}
            </p>
          </div>
        </div>
        <div className="actions" style={{ gap: 8 }}>
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
            <input ref={searchInputRef} type="text" className="glass-input" dir="auto"
              style={{ paddingRight: 36, paddingLeft: searchQuery ? 32 : 12, fontSize: '0.85rem', width: '100%' }}
              placeholder="بحث: اسم، هاتف، رقم وطني..."
              value={searchQuery} onChange={e => handleSearchInput(e.target.value)} />
            {searchQuery && (
              <button onClick={handleClearSearch}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button className={`glass-btn ${hasDeepFilter ? '' : 'secondary'} sm`}
            onClick={() => setIsDeepSearchOpen(true)}
            style={hasDeepFilter ? { boxShadow: '0 0 0 2px var(--primary)' } : {}}>
            <Filter size={14} /> بحث عميق
          </button>
          {hasDeepFilter && (
            <button className="glass-btn secondary sm"
              onClick={() => { setDeepFilters({}); setHasDeepFilter(false); loadStudents('', {}); }}
              style={{ color: 'var(--danger)' }}>
              <X size={14} /> مسح
            </button>
          )}
          <button className={`glass-btn sm ${showFilters ? '' : 'secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
            style={showFilters ? { boxShadow: '0 0 0 1.5px var(--secondary)' } : {}}>
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: 'إجمالي', value: totalCount, icon: <Users size={18} />, color: 'var(--primary)', bg: 'var(--primary-light)' },
          { label: 'مستمر', value: stats.active, icon: <UserCheck size={18} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' },
          { label: 'ناجح', value: stats.pass, icon: <GraduationCap size={18} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' },
          { label: 'راسب', value: stats.fail, icon: <AlertTriangle size={18} />, color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)' },
          { label: 'محروم', value: stats.deprived, icon: <UserX size={18} />, color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--card-bg)', borderRadius: 12, padding: '14px 16px',
            border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: card.bg, color: card.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.2, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ FILTERS ═══ */}
      {showFilters && (
        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {[
              { label: 'الشعبة', val: filterSectionId, set: setFilterSectionId, opts: sectionOptions.map((s: any) => ({ value: s.id, label: s.name })) },
              { label: 'الدورة', val: filterCourseId, set: setFilterCourseId, opts: courseOpts.map((c: any) => ({ value: c.id, label: c.name })) },
              { label: 'الدبلوم', val: filterDiplomaId, set: setFilterDiplomaId, opts: diplomaOpts.map((d: any) => ({ value: d.id, label: d.name })) },
              { label: 'الموظف', val: filterMarkerEmployeeId, set: setFilterMarkerEmployeeId, opts: empOptions.map((e: any) => ({ value: e.id, label: e.fullName })) },
              { label: 'العلامات', val: filterGradeResult, set: setFilterGradeResult, opts: [
                { value: 'PASS', label: '✅ ناجح' }, { value: 'FAIL', label: '❌ راسب' }, { value: 'NO_GRADE', label: '⚪ بدون' },
              ]},
              { label: 'الدفع', val: filterPaymentStatus, set: setFilterPaymentStatus, opts: [
                { value: 'PAID', label: '✅ مسدد' }, { value: 'PARTIAL', label: '💳 جزئي' }, { value: 'UNPAID', label: '❌ غير مسدد' },
              ]},
            ].map(f => (
              <div className="form-group" key={f.label} style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>{f.label}</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={f.val} onChange={e => { f.set(e.target.value); setTimeout(() => loadStudents(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {f.opts.map((o: { value: string; label: string }) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ BULK BAR ═══ */}
      {selectedIds.size > 0 && (
        <div style={{
          padding: '12px 18px', borderRadius: 12,
          background: 'var(--primary-light)', border: '1.5px solid var(--primary)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckSquare size={16} /> {selectedIds.size} طالب
          </span>
          <div style={{ width: 1, height: 24, background: 'var(--primary)', opacity: 0.3 }} />
          <button className="glass-btn sm" disabled={isBulkLoading}
            onClick={async () => {
              setIsBulkLoading(true);
              try { const r = await apiFetch('/students/bulk/end-course', { method: 'POST', body: JSON.stringify({ studentIds: Array.from(selectedIds) }) }); toast.success(r.message || 'تم'); setSelectedIds(new Set()); loadStudents(searchQuery); }
              catch (e: any) { toast.error('فشل', e.message); } finally { setIsBulkLoading(false); }
            }}>
            إنهاء دورة
          </button>
          <button className="glass-btn sm" disabled={isBulkLoading}
            onClick={async () => {
              setIsBulkLoading(true);
              try { const r = await apiFetch('/students/bulk/end-diploma', { method: 'POST', body: JSON.stringify({ studentIds: Array.from(selectedIds) }) }); toast.success(r.message || 'تم'); setSelectedIds(new Set()); loadStudents(searchQuery); }
              catch (e: any) { toast.error('فشل', e.message); } finally { setIsBulkLoading(false); }
            }}>
            إنهاء دبلوم
          </button>
          <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>حالة:</span>
          {[
            { key: 'FINISHED', label: '🎓 إنهاء' }, { key: 'POSTPONED', label: '⏸️ تأجيل' },
            { key: 'WITHDRAWN', label: '🚫 انسحاب' }, { key: 'ACTIVE', label: '✅ تفعيل' },
          ].map(opt => (
            <button key={opt.key} className="glass-btn sm" style={{ fontSize: '0.78rem' }} disabled={isBulkLoading}
              onClick={async () => {
                setIsBulkLoading(true);
                try { const r = await apiFetch('/students/bulk/change-status', { method: 'POST', body: JSON.stringify({ studentIds: Array.from(selectedIds), newStatus: opt.key }) }); toast.success(r.message || 'تم'); setSelectedIds(new Set()); loadStudents(searchQuery); }
                catch (e: any) { toast.error('فشل', e.message); } finally { setIsBulkLoading(false); }
              }}>
              {opt.label}
            </button>
          ))}
          <button className="glass-btn sm" style={{ fontSize: '0.8rem', color: 'var(--danger)' }}
            onClick={() => setSelectedIds(new Set())}>
            <X size={13} /> إلغاء
          </button>
        </div>
      )}

      {/* ═══ TABLE ═══ */}
      <div className="glass-table-container" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <table className="glass-table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input type="checkbox"
                  checked={students.length > 0 && selectedIds.size === students.length}
                  onChange={e => setSelectedIds(e.target.checked ? new Set(students.map(s => s.id)) : new Set())}
                  style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              </th>
              <th style={{ width: 28 }}></th>
              <SortHeader label="رقم النظام" sortKey="id" />
              <SortHeader label="الطالب" sortKey="fullNameAr" />
              <th>الهاتف</th>
              <SortHeader label="النوع" sortKey="studentType" />
              <SortHeader label="الحالة" sortKey="status" />
              <SortHeader label="العلامات" sortKey="result" />
              <SortHeader label="الحضور" sortKey="attendanceStatus" />
              <th style={{ width: 70, textAlign: 'center' }}>حذف</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => {
              const attStatus = getWorstAttStatus(s.sections);
              const result = getBestResult(s.sections);
              const statusObj = STUDENT_STATUS_MAP[s.status] || { label: s.status, cls: 'secondary', icon: '?' };
              return (
                <React.Fragment key={s.id}>
                  <tr className={expanded.has(s.id) ? 'row-expanded' : ''}>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(s.id)}
                        onChange={e => setSelectedIds(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(s.id) : next.delete(s.id);
                          return next;
                        })}
                        style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                    </td>
                    <td onClick={() => toggleExpand(s)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expanded.has(s.id) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                        <ChevronLeft size={14} />
                      </div>
                    </td>
                    <td><code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.id}</code></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.fullNameAr}</div>
                      {s.fullNameEn && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.fullNameEn}</div>}
                    </td>
                    <td style={{ direction: 'ltr', fontSize: '0.8rem', fontFamily: 'monospace' }}>{getDisplayPhone(s)}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {s.studentType === 'UNIVERSITY' ? '🎓 جامعة' : s.studentType === 'HIGH_SCHOOL' ? '📚 ثانوي' : s.studentType === 'EMPLOYEE' ? '💼 موظف' : '👤 أخرى'}
                      </span>
                    </td>
                    <td><span className={`badge ${statusObj.cls}`} style={{ fontSize: '0.72rem', padding: '2px 10px' }}>{statusObj.icon} {statusObj.label}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {result ? (
                        <span className={`badge ${result === 'PASS' ? 'success' : 'danger'}`} style={{ fontSize: '0.7rem', padding: '2px 10px' }}>
                          {result === 'PASS' ? '✅ ناجح' : '❌ راسب'}
                        </span>
                      ) : <span className="badge secondary" style={{ fontSize: '0.7rem' }}>⚪ —</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {attStatus === 'ELIGIBLE' ? <span className="badge success" style={{ fontSize: '0.7rem', padding: '2px 10px' }}>🟢 مؤهل</span> :
                       attStatus === 'DEPRIVED' ? <span className="badge danger" style={{ fontSize: '0.7rem', padding: '2px 10px' }}>🔴 محروم</span> :
                       attStatus === 'EXEMPTED' ? <span className="badge warning" style={{ fontSize: '0.7rem', padding: '2px 10px' }}>🟡 معفى</span> :
                       <span className="badge secondary" style={{ fontSize: '0.7rem' }}>⚪ —</span>}
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button className="glass-btn secondary sm"
                        onClick={() => handleDelete(s)}
                        style={{ color: 'var(--danger)', padding: '4px 8px' }} title="حذف الطالب">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>

                  {/* ── Expanded Section Cards ── */}
                  {expanded.has(s.id) && (
                    <tr key={`${s.id}-exp`}>
                      <td colSpan={10} style={{ padding: 0, borderBottom: '1px solid var(--glass-border)' }}>
                        <div style={{ padding: '4px 16px 16px 48px', background: 'var(--bg-muted)' }}>
                          {!sectionMap[s.id]?.length ? (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              غير مسجل في أي شعبة
                              {hasPermission('sections.assign') && (
                                <button className="glass-btn primary sm" style={{ marginRight: 12 }} onClick={() => openEnroll(s)}>
                                  <Plus size={13} /> إضافة شعبة
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 4px' }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <BookOpen size={13} /> جدول الطالب — {sectionMap[s.id].length} شُعَب
                                </span>
                                {hasPermission('sections.assign') && (
                                  <button className="glass-btn primary sm" style={{ fontSize: '0.72rem', padding: '3px 10px' }} onClick={() => openEnroll(s)}>
                                    <Plus size={12} /> إضافة شعبة
                                  </button>
                                )}
                              </div>
                              {sectionMap[s.id].map((sec: any) => {
                                const secId = sec.id || sec.sectionId;
                                const att = sec.attendanceStatus;
                                const res = sec.result;
                                return (
                                  <div key={secId} style={{
                                    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                                    padding: '10px 14px', borderRadius: 10,
                                    background: 'var(--card-bg)', border: '1px solid var(--glass-border)',
                                    fontSize: '0.82rem',
                                  }}>
                                    <div style={{ flex: '1 0 140px' }}>
                                      <div style={{ fontWeight: 600 }}>{sec.course?.name || sec.courseName || '—'}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>شعبة: {sec.name || '-'}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: '2 0 auto' }}>
                                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                        <span><Clock size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} />{formatDays(sec.days)}</span>
                                        <span style={{ direction: 'ltr' }}>{sec.startTime}-{sec.endTime}</span>
                                      </div>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{sec.instructor?.name || sec.instructorName || ''}</span>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{sec.room?.name || sec.roomName || ''}</span>
                                      <LearningTypeBadge room={sec.room} value={sec.roomLearningType} modality={sec.roomModality} entityName={sec.roomEntityName} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      {res === 'PASS' ? <span className="badge success" style={{ fontSize: '0.68rem' }}>✅ ناجح</span> :
                                       res === 'FAIL' ? <span className="badge danger" style={{ fontSize: '0.68rem' }}>❌ راسب</span> :
                                       <span className="badge secondary" style={{ fontSize: '0.68rem' }}>⚪ —</span>}
                                      {att === 'ELIGIBLE' ? <span className="badge success" style={{ fontSize: '0.68rem' }}>🟢 مؤهل</span> :
                                       att === 'DEPRIVED' ? <span className="badge danger" style={{ fontSize: '0.68rem' }}>🔴 محروم</span> :
                                       att === 'EXEMPTED' ? <span className="badge warning" style={{ fontSize: '0.68rem' }}>🟡 معفى</span> :
                                       <span className="badge secondary" style={{ fontSize: '0.68rem' }}>⚪ —</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      {att === 'DEPRIVED' && (
                                        <ActionBtn icon={<Shield size={12} />} label="إعفاء" color="var(--success)"
                                          onClick={() => changeAttStatus(secId, s.id, 'EXEMPT')} />
                                      )}
                                      {att === 'EXEMPTED' && (
                                        <ActionBtn icon={<ShieldOff size={12} />} label="إلغاء" color="var(--warning)"
                                          onClick={() => changeAttStatus(secId, s.id, 'REMOVE_OVERRIDE')} />
                                      )}
                                      {(!att || att === 'ELIGIBLE') && (
                                        <ActionBtn icon={<X size={12} />} label="حرمان" color="var(--danger)"
                                          onClick={() => changeAttStatus(secId, s.id, 'DEPRIVE')} />
                                      )}
                                      {hasPermission('sections.assign') && (
                                        <ActionBtn icon={<Trash2 size={12} />} label="إزالة" color="var(--danger)"
                                          onClick={async () => {
                                            if (!confirm('إزالة الطالب من هذه الشعبة؟')) return;
                                            try { await apiFetch(`/sections/${secId}/students/${s.id}`, { method: 'DELETE' }); toast.success('تمت الإزالة'); loadStudents(searchQuery); }
                                            catch (e: any) { toast.error(e.message); }
                                          }} />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 50, opacity: 0.5 }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>لا يوجد طلاب مطابقون لمعايير البحث</div>
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 30 }}>
                  <Loader2 size={28} className="spin" style={{ color: 'var(--primary)' }} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ MODALS ═══ */}
      <DeepSearchModal
        isOpen={isDeepSearchOpen}
        onClose={() => setIsDeepSearchOpen(false)}
        onSearch={handleDeepSearch}
        initialFilters={deepFilters}
        showResultsInline={false}
      />
      <ConfirmModal
        isOpen={confirmDelete !== null}
        message={confirmDelete ? `هل أنت متأكد من حذف الطالب: ${confirmDelete.fullNameAr}؟` : ''}
        danger onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(null)} />

      {/* ── Enroll Modal ── */}
      {enrollTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setEnrollTarget(null)}>
          <div className="glass-panel" style={{ maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--glass-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <Plus size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>إضافة شعبة</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{enrollTarget.fullNameAr}</p>
                </div>
              </div>
              <button onClick={() => setEnrollTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>
            {loadingAvail ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>جارٍ تحميل الشعب المتاحة...</p>
              </div>
            ) : availSections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                <p>لا توجد شعب متاحة — تأكد من وجود اشتراك دورة أو دبلوم نشط للطالب</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  اختر الشعبة المطلوبة ({availSections.length} شعبة متاحة)
                </div>
                {availSections.map(sec => (
                  <div key={sec.id} onClick={() => setSelectedSectionId(sec.id)}
                    style={{
                      display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', cursor: 'pointer',
                      borderRadius: 12, border: selectedSectionId === sec.id ? '2px solid var(--primary)' : '1.5px solid var(--glass-border)',
                      background: selectedSectionId === sec.id ? 'var(--primary-light)' : 'var(--card-bg)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: selectedSectionId === sec.id ? 'var(--primary)' : 'var(--glass-border)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{sec.courseName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>📚 شعبة: {sec.name || '-'}</span>
                        <span>👨‍🏫 {sec.instructorName}</span>
                        <span>🏠 {sec.roomName}</span>
                        <LearningTypeBadge room={sec.room} value={sec.roomLearningType} modality={sec.roomModality} entityName={sec.roomEntityName} />
                        <span>📅 {sec.days?.join(' - ')}</span>
                        <span>🕐 {sec.startTime}-{sec.endTime}</span>
                        <span>👥 {sec.enrolledCount}/{sec.capacity}</span>
                      </div>
                      {sec.hasConflict && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} /> يوجد تعارض
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--glass-border)', justifyContent: 'flex-end' }}>
              <button className="glass-btn secondary" onClick={() => setEnrollTarget(null)}>إلغاء</button>
              <button className="glass-btn" disabled={!selectedSectionId || enrolling}
                onClick={async () => {
                  if (!selectedSectionId) return;
                  setEnrolling(true);
                  try {
                    await apiFetch(`/sections/${selectedSectionId}/students`, { method: 'POST', body: JSON.stringify({ studentId: enrollTarget.id }) });
                    toast.success('تم التسجيل'); setEnrollTarget(null); loadStudents(searchQuery);
                  } catch (e: any) { toast.error(e.message); } finally { setEnrolling(false); }
                }}>
                {enrolling ? <Loader2 size={16} className="spin" /> : null} {enrolling ? 'جاري...' : 'تسجيل'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .row-expanded { background: var(--bg-muted) !important; border-bottom: none !important; }
      `}</style>
    </div>
  );
};
