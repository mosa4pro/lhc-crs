import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Save, RefreshCw, Users, Trash2, Plus, Filter,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Phone, Building2, Hash,   CheckSquare, X, BookOpen, Clock, User,
  Shield, ShieldOff, XCircle, Eye, EyeOff, UserCog, ClipboardList
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal, type DeepSearchFilters } from '../components/DeepSearchModal';
import { DateField } from '../components/DateField';
import { ConfirmModal } from '../components/ConfirmModal';
import { LearningTypeBadge } from '../components/LearningTypeBadge';
import { ViewToggleButton as ViewToggleButtonComp } from '../components/ViewToggleButton';

const ViewToggleButton = ViewToggleButtonComp;
import { JORDANIAN_UNIVERSITIES, COUNTRY_CODES, normalizeDigits, STUDENT_STATUS_MAP } from '../utils/constants';

// ==========================================
// Types
// ==========================================
interface PhoneEntry {
  code: string;
  number: string;
  isWhatsapp: boolean;
  isId: boolean;
}

interface Student {
  id: string;
  fullNameAr: string;
  fullNameEn?: string;
  dob: string;
  nationality: 'JO' | 'OTHER';
  nationalityName?: string;
  gender?: 'MALE' | 'FEMALE';
  nationalId?: string;
  passportId?: string;
  personalId?: string;
  phones: PhoneEntry[] | string;
  phoneCodes?: string;
  whatsappOnly?: string;
  isIdNumber?: string;
  address?: string;
  governorate?: string;
  studentType: 'UNIVERSITY' | 'HIGH_SCHOOL' | 'EMPLOYEE' | 'OTHER';
  universityName?: string;
  universityId?: string;
  highSchoolPassed: boolean;
  status: 'ACTIVE' | 'POSTPONED' | 'WITHDRAWN' | 'CANCELED' | 'FINISHED';
  markerEmployeeId?: number;
  supervisorEmployeeId?: number;
  registeredByUserId?: number;
  marketerName?: string;
  markerEmployee?: { id: number; fullName: string };
  supervisorEmployee?: { id: number; fullName: string };
  registeredByUser?: { id: number; fullName: string; points?: number };
  notes?: string;
  registrationDate?: string;
  diplomaSubscriptions?: any[];
  courseSubscriptions?: any[];
  sections?: Array<{
    sectionId: number;
    section?: any;
    result?: string | null;
    attendanceStatus?: string | null;
    attendanceOverride?: boolean;
  }>;
}

// ==========================================
// Phone Input Component (React.memo for stable re-renders)
// ==========================================
// ==========================================
// Phone Input Component (uncontrolled input — immune to re-render value loss)
// ==========================================
const PhoneInputRow = ({
  entry,
  index,
  isJordanian,
  onChange,
  onRemove,
  canRemove,
  onAddPhone,
  isLast,
  maxPhones,
}: {
  entry: PhoneEntry;
  index: number;
  isJordanian: boolean;
  onChange: (i: number, e: Partial<PhoneEntry>) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
  onAddPhone: () => void;
  isLast: boolean;
  maxPhones: number;
}) => {
  const [codeSearch, setCodeSearch] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowCodes(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync input value when entry.number changes externally (e.g., editing student)
  useEffect(() => {
    if (numberRef.current && numberRef.current.value !== entry.number) {
      numberRef.current.value = entry.number;
    }
  }, [entry.number]);

  const filtered = COUNTRY_CODES.filter(c =>
    c.name.includes(codeSearch) || c.code.includes(codeSearch) || c.flag.includes(codeSearch)
  );

  const selected = COUNTRY_CODES.find(c => c.code === entry.code) || COUNTRY_CODES[0];
  const maxLen = entry.code === '+962' ? 9 : 15;

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeDigits(e.target.value).replace(/\D/g, '');
    if (normalized !== e.target.value) {
      e.target.value = normalized;
    }
    onChange(index, { number: normalized });
  }, [onChange, index]);

  const handleCodeSelect = useCallback((code: string) => {
    onChange(index, { code });
    setShowCodes(false);
    setCodeSearch('');
  }, [onChange, index]);

  const handleWhatsappToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { isWhatsapp: e.target.checked });
  }, [onChange, index]);

  const handleIdToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { isId: e.target.checked });
  }, [onChange, index]);

  return (
    <div style={{ marginBottom: 12, border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12, background: 'var(--card-bg)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        {/* Country Code Selector */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={dropRef}>
          <button
            type="button"
            onClick={() => setShowCodes(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 12px', background: 'var(--input-bg)',
              border: '1.5px solid var(--glass-border)', borderRadius: 10,
              cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)',
              whiteSpace: 'nowrap', minWidth: 100,
              transition: 'all 0.2s',
            }}
          >
            <span>{selected.flag}</span>
            <span style={{ fontFamily: 'monospace' }}>{selected.code}</span>
            <ChevronDown size={12} />
          </button>
          {showCodes && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 999,
              background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-border)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              width: 260, maxHeight: 260, overflowY: 'auto',
            }}>
              <div style={{ padding: 8, borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, background: 'var(--glass-bg)' }}>
                <input
                  type="text" className="glass-input"
                  placeholder="ابحث..."
                  value={codeSearch}
                  onChange={e => setCodeSearch(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.83rem' }}
                  autoFocus
                />
              </div>
              {filtered.map((c, i) => (
                <div
                  key={i}
                  onClick={() => handleCodeSelect(c.code)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', display: 'flex', gap: 10,
                    alignItems: 'center', fontSize: '0.85rem',
                    background: c.code === entry.code ? 'var(--primary-light)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (c.code !== entry.code) e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                  onMouseLeave={e => { if (c.code !== entry.code) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{c.flag}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.code}</span>
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Number Input — UNCONTROLLED (defaultValue) so React never clears it on re-render */}
        <input
          ref={numberRef}
          type="text"
          className="glass-input"
          inputMode="numeric"
          placeholder={`رقم الهاتف (${maxLen} أرقام)`}
          defaultValue={entry.number}
          maxLength={maxLen}
          onChange={handleNumberChange}
          data-phone-input
          style={{ flex: 1, direction: 'ltr', textAlign: 'left' }}
        />

        {/* Remove */}
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{
              background: 'var(--danger-light)', border: 'none', borderRadius: 8,
              padding: 8, cursor: 'pointer', color: 'var(--danger)', flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Checkboxes */}
      <div style={{ display: 'flex', gap: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={entry.isWhatsapp}
            onChange={handleWhatsappToggle}
            style={{ width: 15, height: 15 }}
          />
          <span style={{ color: '#25D366', fontWeight: 600 }}>📱 واتساب فقط</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={entry.isId}
            onChange={handleIdToggle}
            style={{ width: 15, height: 15 }}
          />
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>👤 أحد أقربائه</span>
        </label>
      </div>

      {/* Add Phone Button (last row) */}
      {isLast && index < maxPhones - 1 && (
        <button
          type="button"
          onClick={onAddPhone}
          style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--primary-light)', border: '1px dashed var(--primary)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            color: 'var(--primary)', fontSize: '0.83rem', fontWeight: 600,
            width: '100%', justifyContent: 'center', transition: 'all 0.2s',
          }}
        >
          <Plus size={14} /> إضافة رقم هاتف آخر
        </button>
      )}
    </div>
  );
};

// ==========================================
// University Combobox
// ==========================================
const UniversitySelect = ({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void; [key: string]: any }) => {
  const [search, setSearch] = useState(value);
  const [showList, setShowList] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = JORDANIAN_UNIVERSITIES.filter(u => u.includes(search));

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div style={{ position: 'relative' }}>
        <Building2 size={15} style={{ position: 'absolute', right: 12, top: 13, color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          type="text"
          className="glass-input"
          style={{ paddingRight: 36 }}
          placeholder="ابحث أو اكتب اسم الجامعة..."
          value={search}
          {...rest}
          onChange={e => { setSearch(e.target.value); onChange(e.target.value); setShowList(true); }}
          onFocus={() => setShowList(true)}
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); onChange(''); setShowList(false); }}
            style={{ position: 'absolute', left: 10, top: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {showList && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, left: 0, zIndex: 999,
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {filtered.map(u => (
            <div
              key={u}
              onClick={() => { setSearch(u); onChange(u); setShowList(false); }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: '0.88rem',
                color: 'var(--text-primary)', transition: 'background 0.15s',
                borderBottom: '1px solid var(--glass-border)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              🏛️ {u}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// Helper: Parse phones from student data
// ==========================================
function parsePhones(student: Student): PhoneEntry[] {
  try {
    const nums = typeof student.phones === 'string' ? JSON.parse(student.phones) : student.phones;
    const codes = Array.isArray(student.phoneCodes) ? student.phoneCodes : (typeof student.phoneCodes === 'string' ? JSON.parse(student.phoneCodes || '[]') : []);
    const wa = Array.isArray(student.whatsappOnly) ? student.whatsappOnly : (typeof student.whatsappOnly === 'string' ? JSON.parse(student.whatsappOnly || '[]') : []);
    const ids = Array.isArray(student.isIdNumber) ? student.isIdNumber : (typeof student.isIdNumber === 'string' ? JSON.parse(student.isIdNumber || '[]') : []);

    if (Array.isArray(nums)) {
      return nums.map((n: any, i: number) => ({
        code: codes[i] || '+962',
        number: typeof n === 'object' ? (n.number || '') : String(n || ''),
        isWhatsapp: wa[i] || false,
        isId: ids[i] || false,
      }));
    }
  } catch {}
  return [{ code: '+962', number: '', isWhatsapp: false, isId: false }];
}

function phonesToPayload(phones: PhoneEntry[]) {
  return {
    phones: phones.map(p => p.number),
    phoneCodes: phones.map(p => p.code),
    whatsappOnly: phones.map(p => p.isWhatsapp),
    isIdNumber: phones.map(p => p.isId),
  };
}

// ==========================================
// Main Component
// ==========================================
export const StudentsPage = () => {
  const { apiFetch } = useApi();
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isDeepSearchOpen, setIsDeepSearchOpen] = useState(false);
  const [deepFilters, setDeepFilters] = useState<DeepSearchFilters>({});
  const [hasDeepFilter, setHasDeepFilter] = useState(false);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentSectionsMap, setStudentSectionsMap] = useState<Record<string, any[]>>({});

  // Advanced filters
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterDiplomaId, setFilterDiplomaId] = useState('');
  const [filterMarkerEmployeeId, setFilterMarkerEmployeeId] = useState('');
  const [filterSupervisorEmployeeId, setFilterSupervisorEmployeeId] = useState('');
  const [filterRegisteredByUserId, setFilterRegisteredByUserId] = useState('');
  const [filterNoSubscriptions, setFilterNoSubscriptions] = useState(false);
  const [filterNoSubscriptionType, setFilterNoSubscriptionType] = useState(''); // '' | 'course' | 'diploma' | 'both'
  const [filterTeamLeaderUserId, setFilterTeamLeaderUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStudentType, setFilterStudentType] = useState('');
  const [filterGradeResult, setFilterGradeResult] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showList, setShowList] = useState(true);
  const [hierarchy, setHierarchy] = useState<{ teamLeaders: any[]; supervisors: any[]; registrars: any[] }>({ teamLeaders: [], supervisors: [], registrars: [] });
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [selectedRegistrarId, setSelectedRegistrarId] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Filter dropdown options
  const [empOptions, setEmpOptions] = useState<{ id: number; fullName: string }[]>([]);
  const [sectionOptions, setSectionOptions] = useState<{ id: number; name: string }[]>([]);
  const [courseOptions, setCourseOptions] = useState<{ id: number; name: string }[]>([]);
  const [diplomaOptions, setDiplomaOptions] = useState<{ id: number; name: string }[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Add section modal
  const [addSectionTarget, setAddSectionTarget] = useState<Student | null>(null);
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  const [loadingAvailSections, setLoadingAvailSections] = useState(false);
  const [selectedNewSectionId, setSelectedNewSectionId] = useState<number | null>(null);
  const [addSectionLoading, setAddSectionLoading] = useState(false);

  // Form State
  const [nationality, setNationality] = useState<'JO' | 'OTHER'>('JO');
  const [phones, setPhones] = useState<PhoneEntry[]>([{ code: '+962', number: '', isWhatsapp: false, isId: false }]);
  const [form, setForm] = useState<Partial<Student>>({
    nationality: 'JO', studentType: 'UNIVERSITY', status: 'ACTIVE', highSchoolPassed: false,
  });
  const [checkingId, setCheckingId] = useState(false);
  const [idError, setIdError] = useState('');

  const maxPhones = 3;
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formVersion, setFormVersion] = useState(0);
  const nationalIdRef = useRef<HTMLInputElement>(null);
  const universityIdRef = useRef<HTMLInputElement>(null);

  // ===== Resizable Splitter State =====
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('students-split-percent');
    return saved ? parseFloat(saved) : 40;
  });
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const phoneContainerRef = useRef<HTMLDivElement>(null);

  const clearError = useCallback((field: string) => {
    setFormErrors(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  useEffect(() => { loadStudents(); }, []);

  // ===== Resizable Splitter Handlers =====
  const splitPercentRef = useRef(splitPercent);
  splitPercentRef.current = splitPercent;

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDividerDoubleClick = useCallback(() => {
    setSplitPercent(40);
    localStorage.setItem('students-split-percent', '40');
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      // RTL layout: form is on the RIGHT (first in DOM).
      // splitPercent = form width as % of container.
      // Form starts at rect.right and extends leftward.
      // Divider X position from right edge = form width.
      const fromRight = rect.right - e.clientX;
      const dividerWidth = 16; // approximate divider width
      const adjustedFromRight = fromRight - dividerWidth / 2;
      const percent = (adjustedFromRight / rect.width) * 100;
      const clamped = Math.min(75, Math.max(50, percent));
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('students-split-percent', String(splitPercentRef.current));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [isDragging]);

  useEffect(() => {
    if (user?.fullName && !selectedStudent) {
      setForm(prev => ({ ...prev, marketerName: user.fullName }));
    }
  }, [user?.fullName]);

  // Load filter dropdown options
  useEffect(() => {
    const load = async () => {
      try {
        const [empRes, secRes, courseRes, diplomaRes] = await Promise.all([
          apiFetch('/employees?limit=500').catch(() => []),
          apiFetch('/sections?limit=500').catch(() => []),
          apiFetch('/courses?limit=500').catch(() => []),
          apiFetch('/diplomas?limit=500').catch(() => []),
        ]);
        setEmpOptions(Array.isArray(empRes) ? empRes : empRes?.data || []);
        setSectionOptions(Array.isArray(secRes) ? secRes : secRes?.data || []);
        setCourseOptions(Array.isArray(courseRes) ? courseRes : courseRes?.data || []);
        setDiplomaOptions(Array.isArray(diplomaRes) ? diplomaRes : diplomaRes?.data || []);
      } catch {}
    };
    load();
  }, []);

  const loadStudents = useCallback(async (q = '', filters?: DeepSearchFilters) => {
    try {
      let url = `/students?query=${encodeURIComponent(q)}&limit=300`;
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
      if (f.highSchoolPassed !== undefined && f.highSchoolPassed !== '') {
        url += `&highSchoolPassed=${f.highSchoolPassed}`;
      }
      // Advanced filters
      if (filterSectionId) url += `&sectionId=${filterSectionId}`;
      if (filterCourseId) url += `&courseId=${filterCourseId}`;
      if (filterDiplomaId) url += `&diplomaId=${filterDiplomaId}`;
      if (filterMarkerEmployeeId) url += `&markerEmployeeId=${filterMarkerEmployeeId}`;
      if (filterSupervisorEmployeeId) url += `&supervisorEmployeeId=${filterSupervisorEmployeeId}`;
      if (filterRegisteredByUserId) url += `&registeredByUserId=${filterRegisteredByUserId}`;
      if (filterNoSubscriptionType === 'course') url += `&hasCourseSubscriptions=true`;
      else if (filterNoSubscriptionType === 'diploma') url += `&hasDiplomaSubscriptions=true`;
      else if (filterNoSubscriptionType === 'unsubscribed') url += `&noSubscriptions=true`;
      if (filterTeamLeaderUserId) url += `&teamLeaderUserId=${filterTeamLeaderUserId}`;
      if (filterStatus) url += `&status=${encodeURIComponent(filterStatus)}`;
      if (filterStudentType) url += `&studentType=${encodeURIComponent(filterStudentType)}`;
      if (filterGradeResult) url += `&gradeResult=${encodeURIComponent(filterGradeResult)}`;
      if (filterPaymentStatus) url += `&paymentStatus=${encodeURIComponent(filterPaymentStatus)}`;

      const res = await apiFetch(url);
      const data = Array.isArray(res) ? res : (res.data || []);
      const total = Array.isArray(res) ? res.length : (res.total || 0);
      setStudents(data);
      setTotalCount(total);
    } catch (err: any) {
      toast.error('خطأ في تحميل البيانات', err.message);
    }
  }, [deepFilters, filterSectionId, filterCourseId, filterDiplomaId, filterMarkerEmployeeId, filterSupervisorEmployeeId, filterRegisteredByUserId, filterNoSubscriptionType, filterTeamLeaderUserId, filterStatus, filterStudentType, filterGradeResult, filterPaymentStatus]);

  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadStudents(q), 350);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
    loadStudents('');
    searchInputRef.current?.focus();
  };

  const isAdmin = user?.role === 'ADMIN' || hasPermission?.('ADMIN_ALL');
  const isTeamLeader = user?.role === 'TEAM_LEADER';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isRegistrar = user?.role === 'REGISTRAR' || user?.role === 'EMPLOYEE';

  const canAssignSupervisor = isAdmin || isTeamLeader;
  const canAssignRegistrar = isAdmin || isTeamLeader || isSupervisor;
  const cascadedRegistrars = selectedSupervisorId
    ? hierarchy.registrars.filter((r: any) => String(r.supervisorId) === String(selectedSupervisorId))
    : [];

  useEffect(() => {
    apiFetch('/students/users/hierarchy').then(h => {
      setHierarchy(h);
      // Auto-set fixed filter values based on role
      if (!isAdmin) {
        if (!isTeamLeader) {
          // Non-admin, non-team-leader: tl is fixed
          if (h.teamLeaders?.length === 1 && !filterTeamLeaderUserId) {
            setFilterTeamLeaderUserId(String(h.teamLeaders[0].id));
          }
          if (isRegistrar) {
            // Registrar: supervisor + registrar are fixed
            if (h.supervisors?.length === 1 && !filterSupervisorEmployeeId) {
              if (h.supervisors[0].employeeId) setFilterSupervisorEmployeeId(String(h.supervisors[0].employeeId));
            }
            if (h.registrars?.length === 1 && !filterRegisteredByUserId) {
              setFilterRegisteredByUserId(String(h.registrars[0].id));
            }
          } else if (isSupervisor) {
            // Supervisor: registrar is not fixed, but supervisor self is fixed
            if (h.supervisors?.length === 1 && !filterSupervisorEmployeeId) {
              if (h.supervisors[0].employeeId) setFilterSupervisorEmployeeId(String(h.supervisors[0].employeeId));
            }
          }
        }
        // isTeamLeader: nothing auto-set, they pick
      }
      // Auto-select supervisor (self) for supervisor/registrar in the assignment cascades
      if (!isAdmin && !isTeamLeader && h.supervisors?.length === 1) {
        setSelectedSupervisorId(String(h.supervisors[0].id));
      }
      if (isRegistrar && h.registrars?.length === 1) {
        setSelectedRegistrarId(String(h.registrars[0].id));
      }
    }).catch(() => {});
  }, []);

  const applyFilter = () => { loadStudentsRef.current(searchQuery); };

  const loadStudentsRef = useRef(loadStudents);
  loadStudentsRef.current = loadStudents;

  const clearAllAdvancedFilters = () => {
    setFilterSectionId('');
    setFilterCourseId('');
    setFilterDiplomaId('');
    setFilterMarkerEmployeeId('');
    setFilterSupervisorEmployeeId('');
    setFilterRegisteredByUserId('');
    setFilterNoSubscriptionType('');
    setFilterTeamLeaderUserId('');
    setFilterStatus('');
    setFilterStudentType('');
    setFilterGradeResult('');
    setFilterPaymentStatus('');
    setTimeout(() => loadStudentsRef.current(searchQuery), 0);
  };

  const hasAdvancedFilters = filterSectionId || filterCourseId || filterDiplomaId || filterMarkerEmployeeId || filterGradeResult || filterPaymentStatus || filterNoSubscriptionType || filterTeamLeaderUserId || filterSupervisorEmployeeId || filterRegisteredByUserId;

  const handleDeepSearch = (filters: DeepSearchFilters) => {
    setDeepFilters(filters);
    const hasFilters = Object.values(filters).some(v => v !== '' && v !== undefined);
    setHasDeepFilter(hasFilters);
    setPage(1);
    loadStudents(searchQuery, filters);
  };

  const handleSelect = (s: Student) => {
    setSelectedStudent(s);
    const nat = s.nationality as 'JO' | 'OTHER';
    setNationality(nat);
    setPhones(parsePhones(s));
    setForm({ ...s, phones: undefined });
    setIdError('');
    setFormErrors({});
    setFormVersion(prev => prev + 1);
    // Map supervisor employeeId → hierarchy user id, and registrar user id
    const sup = hierarchy.supervisors.find(x => x.employeeId === s.supervisorEmployeeId);
    setSelectedSupervisorId(sup ? String(sup.id) : '');
    setSelectedRegistrarId(s.registeredByUserId ? String(s.registeredByUserId) : '');
  };

  const toggleExpand = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
        // Load from pre-fetched student data
        const student = students.find(s => s.id === studentId);
        const sections = student?.sections as any[] | undefined;
        setStudentSectionsMap(prev => ({
          ...prev,
          [studentId]: sections
            ? sections.map((ss: any) => ({
                ...ss.section,
                course: ss.section?.course,
                attendanceStatus: ss.attendanceStatus,
                result: ss.result,
                students: [{ studentId: ss.studentId }]
              }))
            : []
        }));
      }
      return next;
    });
  };

  const handleNew = () => {
    setSelectedStudent(null);
    setNationality('JO');
    setPhones([{ code: '+962', number: '', isWhatsapp: false, isId: false }]);
    setForm({ nationality: 'JO', studentType: 'UNIVERSITY', status: 'ACTIVE', highSchoolPassed: false, governorate: '', marketerName: user?.fullName || '' });
    setIdError('');
    setFormErrors({});
    setFormVersion(prev => prev + 1);
    // Reset cascading assignment (auto-set for supervisor/registrar happens in hierarchy effect)
    if (isAdmin || isTeamLeader || isSupervisor) setSelectedSupervisorId(isSupervisor && hierarchy.supervisors.length === 1 ? String(hierarchy.supervisors[0].id) : '');
    setSelectedRegistrarId('');
  };

  const updatePhone = useCallback((i: number, partial: Partial<PhoneEntry>) => {
    setPhones(prev => prev.map((p, idx) => idx === i ? { ...p, ...partial } : p));
  }, []);
  const removePhone = useCallback((i: number) => {
    setPhones(prev => prev.filter((_, idx) => idx !== i));
  }, []);
  const addPhone = useCallback(() => {
    setPhones(prev => {
      if (prev.length >= maxPhones) return prev;
      return [...prev, { code: '+962', number: '', isWhatsapp: false, isId: false }];
    });
  }, [maxPhones]);

  const handlePhoneChange = useCallback((idx: number, partial: Partial<PhoneEntry>) => {
    updatePhone(idx, partial);
    clearError('phone');
  }, [updatePhone, clearError]);

  // Check national ID uniqueness
  const checkIdSeq = useRef(0);
  const checkNationalId = async (id: string) => {
    if (!id || id.length < 10) return;
    setCheckingId(true);
    const seq = ++checkIdSeq.current;
    try {
      const res = await apiFetch(`/students/check-id?nationalId=${id}&excludeId=${selectedStudent?.id || ''}`);
      if (seq !== checkIdSeq.current) return;
      if (res.exists) {
        setIdError(`⚠️ هذا الرقم الوطني مسجّل مسبقاً (${res.studentName})`);
      } else {
        setIdError('');
      }
    } catch { if (seq === checkIdSeq.current) setIdError(''); }
    finally { if (seq === checkIdSeq.current) setCheckingId(false); }
  };

  const handleSave = async () => {
    // Validations — always read from DOM/refs for uncontrolled inputs
    const errors: Record<string, string> = {};

    const nameVal = form.fullNameAr?.trim() || (document.querySelector<HTMLInputElement>('[data-field="fullNameAr"]')?.value?.trim() ?? '');
    const dobVal = form.dob || (document.querySelector<HTMLInputElement>('[data-field="dob"]')?.value ?? '');
    if (!nameVal) errors.fullNameAr = 'يرجى تعبئة الاسم الكامل بالعربي';
    if (!dobVal) errors.dob = 'تاريخ الميلاد مطلوب';

    if (nationality === 'JO') {
      const rawNational = (nationalIdRef.current?.value || document.querySelector<HTMLInputElement>('[data-field="nationalId"]')?.value || '').replace(/\s/g, '');
      if (!rawNational || !/^\d{10}$/.test(rawNational)) {
        errors.nationalId = 'الرقم الوطني يجب أن يتكون من 10 أرقام';
      }
      if (idError && !errors.nationalId) errors.nationalId = idError;
    } else {
      const hasPassport = form.passportId?.trim();
      const hasPersonal = form.personalId?.trim() && /^\d{10}$/.test(form.personalId);
      if (!hasPassport && !hasPersonal) {
        errors.passportOrPersonal = 'يجب تعبئة رقم الجواز أو الرقم الشخصي (10 أرقام)';
      }
    }

    if (form.studentType === 'UNIVERSITY') {
      const domUniName = document.querySelector<HTMLInputElement>('[data-field="universityName"]');
      const uniName = form.universityName?.trim() || domUniName?.value?.trim() || '';
      const uniId = universityIdRef.current?.value?.trim() || '';
      if (!uniName) errors.universityName = 'اسم الجامعة مطلوب لطلاب الجامعة';
      if (!uniId) errors.universityId = 'الرقم الجامعي مطلوب';
    }

    // Read phone value directly from DOM (uncontrolled input)
    const phoneDom = document.querySelector<HTMLInputElement>('[data-phone-input]');
    const domPhone = phoneDom?.value?.trim();
    if (!domPhone) errors.phone = 'يرجى إدخال رقم هاتف واحد على الأقل';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstMsg = Object.values(errors)[0];
      toast.error('خطأ في البيانات', firstMsg);
      return;
    }

    setIsLoading(true);
    try {
      // Read values from DOM/refs (state may be stale in React 18)
      const phoneDomInputs = document.querySelectorAll<HTMLInputElement>('[data-phone-input]');
      const livePhones = Array.from(phoneDomInputs).map(input => input.value.trim());
      const domName = document.querySelector<HTMLInputElement>('[data-field="fullNameAr"]');
      const domDob = document.querySelector<HTMLInputElement>('[data-field="dob"]');
      const domUniName = document.querySelector<HTMLInputElement>('[data-field="universityName"]');

      const payload: Record<string, any> = {
        fullNameAr: form.fullNameAr?.trim() || domName?.value?.trim() || '',
        fullNameEn: form.fullNameEn?.trim() || '',
        gender: form.gender || undefined,
        dob: form.dob || domDob?.value || '',
        nationality,
        nationalityName: nationality === 'OTHER' ? form.nationalityName : undefined,
        phones: livePhones,
        phoneCodes: phones.map(p => p.code),
        whatsappOnly: phones.map(p => p.isWhatsapp),
        isIdNumber: phones.map(p => p.isId),
        nationalId: nationality === 'JO' ? (nationalIdRef.current?.value || document.querySelector<HTMLInputElement>('[data-field="nationalId"]')?.value || '') : undefined,
        passportId: nationality === 'OTHER' ? form.passportId : undefined,
        personalId: nationality === 'OTHER' ? form.personalId : undefined,
        universityName: form.universityName?.trim() || domUniName?.value?.trim() || '',
        universityId: universityIdRef.current?.value?.trim() || document.querySelector<HTMLInputElement>('[data-field="universityId"]')?.value?.trim() || '',
        highSchoolPassed: form.highSchoolPassed || false,
        studentType: form.studentType,
        status: form.status,
        address: form.address,
        governorate: form.governorate,
        marketerName: form.marketerName,
        markerEmployeeId: form.markerEmployeeId,
        supervisorEmployeeId: selectedSupervisorId
          ? (hierarchy.supervisors.find(sup => String(sup.id) === String(selectedSupervisorId))?.employeeId ?? null)
          : undefined,
        registeredByUserId: selectedRegistrarId ? Number(selectedRegistrarId) : undefined,
        notes: form.notes,
      };

      if (selectedStudent) {
        const displayName = form.fullNameAr?.trim() || domName?.value?.trim() || '';
        await apiFetch(`/students/${selectedStudent.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('تم التعديل بنجاح ✓', `تم تحديث بيانات ${displayName}`);
      } else {
        const displayName = form.fullNameAr?.trim() || domName?.value?.trim() || '';
        const created = await apiFetch('/students', { method: 'POST', body: JSON.stringify(payload) });
        toast.success(`تمت إضافة الطالب بنجاح 🎓`, `${displayName} — رقم النظام: ${created.id || '—'}`);
      }
      await loadStudents(searchQuery);
      handleNew();
    } catch (e: any) {
      toast.error('خطأ في الحفظ', e.message || 'تعذر الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (s: Student) => {
    setConfirmDeleteStudent(s);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteStudent) return;
    try {
      await apiFetch(`/students/${confirmDeleteStudent.id}`, { method: 'DELETE' });
      toast.success('تم الحذف', `تم حذف ${confirmDeleteStudent.fullNameAr} من النظام`);
      await loadStudents(searchQuery);
      if (selectedStudent?.id === confirmDeleteStudent.id) handleNew();
    } catch (e: any) {
      toast.error('فشل الحذف', e.message);
    }
    finally { setConfirmDeleteStudent(null); }
  };

  const dayLabels: Record<string, string> = { SUN: 'الأحد', MON: 'الاثنين', TUE: 'الثلاثاء', WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة', SAT: 'السبت' };
  const dayOrder = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
  const formatDays = (days: any) => {
    const arr = typeof days === 'string' ? (() => { try { return JSON.parse(days); } catch { return []; } })() : (Array.isArray(days) ? days : []);
    return arr.slice().sort((a: string, b: string) => dayOrder.indexOf(a) - dayOrder.indexOf(b)).map((d: string) => dayLabels[d] || d).join(' - ');
  };

  const getDisplayPhone = (s: Student): string => {
    try {
      const phones = typeof s.phones === 'string' ? JSON.parse(s.phones) : s.phones;
      const codes = typeof s.phoneCodes === 'string' ? JSON.parse(s.phoneCodes || '[]') : [];
      const num = Array.isArray(phones) ? phones[0] : '';
      const code = codes[0] || '+962';
      if (typeof num === 'object') return `${code} ${num.number || ''}`;
      return num ? `${code} ${num}` : '—';
    } catch { return '—'; }
  };

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
  const paginatedStudents = students.slice((page - 1) * pageSize, page * pageSize);

  // Reset to page 1 when student data changes
  useEffect(() => {
    setPage(1);
  }, [students.length]);

  return (
    <>
      {/* ===== VIEW CONTROL TOOLBAR (always visible) ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Users size={18} color="var(--primary)" />
            {selectedStudent ? (
              <>تعديل بيانات: <span style={{ color: 'var(--primary)' }}>{selectedStudent.fullNameAr}</span></>
            ) : 'إضافة طالب جديد'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ViewToggleButton
            active={showStats}
            onClick={() => setShowStats(v => !v)}
            icon={showStats ? <Eye size={16} /> : <EyeOff size={16} />}
            label="الكروت الإحصائية"
            title={showStats ? 'إخفاء الكروت الإحصائية' : 'إظهار الكروت الإحصائية'}
          />
          <ViewToggleButton
            active={showList}
            onClick={() => setShowList(v => !v)}
            icon={showList ? <Users size={16} /> : <EyeOff size={16} />}
            label="قائمة الطلاب"
            title={showList ? 'إخفاء قائمة الطلاب وتوسيع الفورم' : 'إظهار قائمة الطلاب'}
          />
        </div>
      </div>

      <div className="split-layout" ref={splitContainerRef} style={{ gap: 0, alignItems: 'stretch', minHeight: 'calc(100vh - 180px)' }}>

      {/* ===== FORM PANEL (RIGHT in RTL — first in DOM) ===== */}
      <div className="glass-panel split-panel" key={formVersion} style={{
        flex: showList ? `0 0 ${splitPercent}%` : '1 1 100%',
        minWidth: 0,
        borderRadius: showList ? '0 var(--radius-lg) var(--radius-lg) 0' : 'var(--radius-lg)',
        margin: 0,
        transition: 'flex 0.35s ease, border-radius 0.35s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem' }}>
            <Users size={22} color="var(--secondary)" />
            {selectedStudent ? (
              <span>تعديل بيانات: <span style={{ color: 'var(--primary)' }}>{selectedStudent.fullNameAr}</span></span>
            ) : 'إضافة طالب جديد'}
          </h3>
          {selectedStudent?.id && (
            <span style={{
              background: 'var(--primary-light)', color: 'var(--primary)',
              padding: '4px 14px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: 1,
            }}>
              رقم النظام: {selectedStudent.id}
            </span>
          )}
        </div>

        {/* Staff info when editing */}
        {selectedStudent?.id && (
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
            padding: '10px 14px', borderRadius: 10, background: 'var(--primary-light)',
            fontSize: '0.82rem',
          }}>
            {selectedStudent.registeredByUser?.fullName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={14} /> المسجل: {selectedStudent.registeredByUser.fullName}
              </span>
            )}
            {selectedStudent.supervisorEmployee?.fullName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={14} /> المشرف: {selectedStudent.supervisorEmployee.fullName}
              </span>
            )}
            {selectedStudent.markerEmployee?.fullName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={14} /> المسوق: {selectedStudent.markerEmployee.fullName}
              </span>
            )}
          </div>
        )}

        {/* Row 1: Full name Arabic (full width) */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label"><span className="required-star">*</span>الاسم كامل بالعربي</label>
          <input
            type="text"
            className={`glass-input ${formErrors.fullNameAr ? 'error-field' : ''}`}
            placeholder="الاسم الرباعي بالعربي"
            value={form.fullNameAr || ''}
            data-field="fullNameAr"
            onChange={e => { setForm({ ...form, fullNameAr: e.target.value }); clearError('fullNameAr'); }}
          />
          {formErrors.fullNameAr && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {formErrors.fullNameAr}</div>}
        </div>

        {/* Row 2: English name (full width) */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">الاسم كامل بالإنجليزي</label>
          <input
            type="text" className="glass-input"
            placeholder="Full Name in English"
            value={form.fullNameEn || ''}
            onChange={e => setForm({ ...form, fullNameEn: e.target.value })}
            style={{ direction: 'ltr' }}
          />
        </div>

        {/* Row 3: DOB + Gender (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label"><span className="required-star">*</span>تاريخ الميلاد</label>
            <DateField
              value={form.dob ? String(form.dob).split('T')[0] : ''}
              onChange={v => { setForm({ ...form, dob: v }); clearError('dob'); }}
              maxYear={new Date().getFullYear()}
            />
            {formErrors.dob && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {formErrors.dob}</div>}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">الجنس</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label onClick={() => setForm({ ...form, gender: 'MALE' })}
                className={`glass-btn ${form.gender === 'FEMALE' ? 'secondary' : ''}`}
                style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: '0.85rem' }}>
                👨 ذكر
              </label>
              <label onClick={() => setForm({ ...form, gender: 'FEMALE' })}
                className={`glass-btn ${form.gender !== 'FEMALE' ? 'secondary' : ''}`}
                style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: '0.85rem' }}>
                👩 أنثى
              </label>
            </div>
          </div>
        </div>

        {/* Row 2: Nationality + ID */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">الجنسية</label>
          <select
            className="glass-input"
            value={nationality}
            onChange={e => {
              const nat = e.target.value as 'JO' | 'OTHER';
              setNationality(nat);
              setForm({ ...form, nationality: nat, nationalId: '', passportId: '', personalId: '' });
              setPhones([{ code: '+962', number: '', isWhatsapp: false, isId: false }]);
              setIdError('');
            }}
          >
            <option value="JO">🇯🇴 أردني</option>
            <option value="OTHER">🌍 غير أردني</option>
          </select>
        </div>

        {nationality === 'JO' ? (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">
              <span className="required-star">*</span>الرقم الوطني (10 أرقام)
              {checkingId && <span style={{ marginRight: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>جارٍ التحقق...</span>}
            </label>
            <input
              ref={nationalIdRef}
              type="text"
              className={`glass-input ${(formErrors.nationalId || idError) ? 'error-field' : ''}`}
              placeholder="0000000000"
              maxLength={10}
              inputMode="numeric"
              defaultValue={form.nationalId || ''}
              data-field="nationalId"
              onChange={e => {
                const val = normalizeDigits(e.target.value).replace(/\D/g, '');
                setForm({ ...form, nationalId: val });
                setIdError('');
                clearError('nationalId');
                if (val.length === 10) checkNationalId(val);
              }}
              onBlur={() => {
                const raw = (nationalIdRef.current?.value || '').replace(/\s/g, '');
                if (raw.length > 0 && raw.length !== 10) {
                  setFormErrors(prev => ({ ...prev, nationalId: 'يجب أن يتكون الرقم الوطني من 10 أرقام' }));
                } else if (raw.length === 10) {
                  checkNationalId(raw);
                }
              }}
              style={{ direction: 'ltr' }}
            />
            {(formErrors.nationalId || idError) && (
              <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {formErrors.nationalId || idError}</div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className={`form-label ${formErrors.passportOrPersonal ? 'error-label' : ''}`}>
                  رقم الجواز
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> (اختياري)</span>
                </label>
                <input
                  type="text"
                  className={`glass-input ${formErrors.passportOrPersonal ? 'error-field' : ''}`}
                  placeholder="رقم الجواز"
                  value={form.passportId || ''}
                  onChange={e => { setForm({ ...form, passportId: e.target.value }); clearError('passportOrPersonal'); }}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className={`form-label ${formErrors.passportOrPersonal ? 'error-label' : ''}`}>
                  الرقم الشخصي (10 أرقام)
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> — إلزامي</span>
                </label>
                <input
                  type="text"
                  className={`glass-input ${formErrors.passportOrPersonal ? 'error-field' : ''}`}
                  placeholder="0000000000"
                  maxLength={10}
                  inputMode="numeric"
                  value={form.personalId || ''}
                  onChange={e => { setForm({ ...form, personalId: normalizeDigits(e.target.value).replace(/\D/g, '') }); clearError('passportOrPersonal'); }}
                  style={{ direction: 'ltr' }}
                />
              </div>
            </div>
            {formErrors.passportOrPersonal && (
              <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: 14 }}>⚠️ {formErrors.passportOrPersonal}</div>
            )}
          </>
        )}

        {nationality === 'OTHER' && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">الجنسية (تحديد)</label>
            <input
              type="text" className="glass-input"
              placeholder="مثال: سوري، عراقي، مصري..."
              value={form.nationalityName || ''}
              onChange={e => setForm({ ...form, nationalityName: e.target.value })}
            />
          </div>
        )}

        {/* Phone Numbers */}
        <div className="form-group">
          <label className={`form-label ${formErrors.phone ? 'error-label' : ''}`}>
            <span className="required-star">*</span>
            أرقام الهاتف
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginRight: 8 }}>
              (يمكن إضافة حتى {maxPhones} أرقام)
            </span>
          </label>
          {phones.map((entry, i) => (
            <PhoneInputRow
              key={`p-${i}`}
              entry={entry}
              index={i}
              isJordanian={nationality === 'JO'}
              onChange={handlePhoneChange}
              onRemove={removePhone}
              canRemove={phones.length > 1}
              onAddPhone={addPhone}
              isLast={i === phones.length - 1}
              maxPhones={maxPhones}
            />
          ))}
          {formErrors.phone && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {formErrors.phone}</div>}
        </div>

        {/* Student Type */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">صفة الطالب</label>
          <select
            className="glass-input"
            value={form.studentType}
            onChange={e => {
              const val = e.target.value;
              setForm(prev => {
                const next = { ...prev, studentType: val as any };
                if (val !== 'UNIVERSITY') {
                  next.universityName = '';
                  next.universityId = '';
                }
                return next;
              });
              if (val !== 'UNIVERSITY') {
                clearError('universityName');
                clearError('universityId');
              }
            }}
          >
            <option value="UNIVERSITY">🎓 طالب جامعة</option>
            <option value="HIGH_SCHOOL">📚 طالب ثانوي</option>
            <option value="EMPLOYEE">💼 موظف</option>
            <option value="OTHER">👤 غير ذلك</option>
          </select>
        </div>

        {form.studentType === 'UNIVERSITY' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className={`form-label ${formErrors.universityName ? 'error-label' : ''}`}>
                <span className="required-star">*</span>اسم الجامعة
              </label>
              <UniversitySelect
                value={form.universityName || ''}
                onChange={v => { setForm({ ...form, universityName: v }); clearError('universityName'); }}
                data-field="universityName"
              />
              {formErrors.universityName && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {formErrors.universityName}</div>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className={`form-label ${formErrors.universityId ? 'error-label' : ''}`}>
                <span className="required-star">*</span>الرقم الجامعي
              </label>
              <input
                ref={universityIdRef}
                type="text"
                className={`glass-input ${formErrors.universityId ? 'error-field' : ''}`}
                placeholder="رقم الطالب في الجامعة"
                defaultValue={form.universityId || ''}
                maxLength={20}
                data-field="universityId"
                onChange={e => { setForm({ ...form, universityId: e.target.value }); clearError('universityId'); }}
                style={{ direction: 'ltr' }}
              />
              {formErrors.universityId && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {formErrors.universityId}</div>}
            </div>
          </div>
        )}

        {form.studentType === 'HIGH_SCHOOL' && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '12px 16px', background: 'var(--card-bg)',
              border: '1.5px solid var(--glass-border)', borderRadius: 10, width: '100%',
            }}>
              <input
                type="checkbox"
                checked={form.highSchoolPassed || false}
                onChange={e => setForm({ ...form, highSchoolPassed: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontWeight: 600, color: form.highSchoolPassed ? 'var(--success)' : 'var(--text-secondary)' }}>
                {form.highSchoolPassed ? '✅ ناجح في الثانوية العامة' : '❌ راسب / غير ناجح'}
              </span>
            </label>
          </div>
        )}

        {/* Status + Address + Governorate */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">حالة المشترك</label>
            <select
              className="glass-input"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as any })}
            >
              <option value="ACTIVE">✅ مستمر</option>
              <option value="POSTPONED">⏸️ مؤجل</option>
              <option value="WITHDRAWN">🚫 منسحب</option>
              <option value="CANCELED">❌ ملغي</option>
              <option value="FINISHED">🎓 أنهى الدراسة</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">المحافظة</label>
            <select
              className="glass-input"
              value={form.governorate || ''}
              onChange={e => setForm({ ...form, governorate: e.target.value })}
            >
              <option value="">اختر المحافظة</option>
              <option value="AMMAN">عمان</option>
              <option value="IRBID">إربد</option>
              <option value="ZARQA">الزرقاء</option>
              <option value="BALQA">البلقاء</option>
              <option value="MADABA">مادبا</option>
              <option value="KARAK">الكرك</option>
              <option value="TAFILEH">الطفيلة</option>
              <option value="MAAN">معان</option>
              <option value="MAFRAQ">المفرق</option>
              <option value="JARASH">جرش</option>
              <option value="AJLOUN">عجلون</option>
              <option value="AQABA">العقبة</option>
              <option value="RAMTHA">الرمثا</option>
              <option value="SALT">السلط</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">العنوان</label>
          <input
            type="text" className="glass-input"
            placeholder="محافظة / منطقة / شارع"
            value={form.address || ''}
            onChange={e => setForm({ ...form, address: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 14, display: 'none' }}>
          <label className="form-label">اسم المسوّق / المرسِل</label>
          <input
            type="text" className="glass-input"
            placeholder="من أحضر الطالب؟"
            value={form.marketerName || ''}
            onChange={e => setForm({ ...form, marketerName: e.target.value })}
          />
        </div>

        {/* Cascading staff assignment: Admin/TL → Supervisor → Registrar */}
        <div className="form-group" style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: 12 }}>
          <label className="form-label" style={{ marginBottom: 10 }}>
            <UserCog size={15} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            المسؤولية والتسلسل الإداري
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.82rem' }}>
                <Shield size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
                المشرف المسؤول
              </label>
              <select
                className="glass-input"
                value={selectedSupervisorId}
                onChange={e => { setSelectedSupervisorId(e.target.value); setSelectedRegistrarId(''); }}
                disabled={!canAssignSupervisor}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">— اختر المشرف —</option>
                {hierarchy.supervisors.filter((s: any) => s.employeeId).map((sup: any) => (
                  <option key={sup.id} value={sup.id}>{sup.fullName}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.82rem' }}>
                <ClipboardList size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
                المسجل المسؤول
              </label>
              <select
                className="glass-input"
                value={selectedRegistrarId}
                onChange={e => setSelectedRegistrarId(e.target.value)}
                disabled={!canAssignRegistrar || !selectedSupervisorId}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">— اختر المسجل —</option>
                {cascadedRegistrars.map((reg: any) => (
                  <option key={reg.id} value={reg.id}>{reg.fullName}</option>
                ))}
              </select>
            </div>
          </div>
          {canAssignSupervisor && !selectedSupervisorId && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              اختر المشرف أولًا لعرض المسجلين المرتبطين به
            </div>
          )}
          {canAssignSupervisor && selectedSupervisorId && cascadedRegistrars.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-warning)', marginTop: 8 }}>
              لا يوجد مسجلون مرتبطون بهذا المشرف
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">ملاحظات</label>
          <textarea
            className="glass-input" rows={2} maxLength={1000}
            placeholder="أي ملاحظات إضافية عن الطالب..."
            value={form.notes || ''}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {(selectedStudent ? hasPermission('students.edit') : hasPermission('students.add')) && (
            <button className="glass-btn lg" onClick={handleSave} disabled={isLoading}>
              <Save size={18} />
              {isLoading ? 'جارٍ الحفظ...' : (selectedStudent ? 'حفظ التعديلات' : 'إضافة الطالب')}
            </button>
          )}
          <button className="glass-btn secondary lg" onClick={handleNew} disabled={isLoading}>
            <RefreshCw size={18} /> جديد
          </button>
        </div>
      </div>

      {/* ===== RESIZABLE DIVIDER (hidden when list is collapsed) ===== */}
      {showList && (
      <div
        className={`split-divider ${isDragging ? 'active' : ''}`}
        onMouseDown={handleDividerMouseDown}
        onDoubleClick={handleDividerDoubleClick}
        title="اسحب لتغيير الحجم — انقر مرتين للوضع الافتراضي"
      >
        <div className="split-divider-handle">
          <span /><span /><span /><span /><span />
        </div>
        {isDragging && (
          <div className="split-divider-tooltip">
            {Math.round(splitPercent)}%
          </div>
        )}
      </div>
      )}

      {/* ===== STUDENTS TABLE (LEFT in RTL — second in DOM) ===== */}
      <div className="glass-panel split-panel" style={{
        flex: 1,
        minWidth: 0,
        display: showList ? undefined : 'none',
        borderRadius: showList ? 'var(--radius-lg) 0 0 var(--radius-lg)' : 'var(--radius-lg)',
        margin: 0,
      }}>
        {/* ===== ALL STAT CARDS — unified, premium ===== */}
        <div style={{
          display: 'grid',
          gridTemplateRows: showStats ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.35s ease, opacity 0.3s ease',
          opacity: showStats ? 1 : 0,
          overflow: 'hidden',
          marginBottom: showStats ? 0 : 0,
        }}>
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* إجمالي الطلاب */}
          <div className="stat-card blue" style={{ flex: '0 0 auto', minWidth: 148, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="stat-icon" style={{ marginBottom: 0, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}><Users size={20} /></div>
            <div>
              <div className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.25 }}>{totalCount}</div>
              <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.72rem', fontWeight: 700 }}>إجمالي الطلاب</div>
            </div>
          </div>
          {/* نشط */}
          <div className="stat-card green" style={{ flex: '0 0 auto', minWidth: 118, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="stat-icon" style={{ marginBottom: 0, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}><CheckSquare size={20} /></div>
            <div>
              <div className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.25, color: 'var(--success)' }}>{students.filter(s => s.status === 'ACTIVE').length}</div>
              <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.72rem', fontWeight: 700 }}>نشط</div>
            </div>
          </div>
          {/* قائد الفريق */}
          <div className={`stat-card amber ${filterTeamLeaderUserId ? 'active-filter' : ''}`} style={{ flex: '0 0 auto', minWidth: 250, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, border: filterTeamLeaderUserId ? '2px solid var(--primary)' : undefined, transition: 'all 0.2s' }}>
            <div className="stat-icon" style={{ marginBottom: 0, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}><Users size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.25 }}>{filterTeamLeaderUserId ? students.length : hierarchy.teamLeaders.length}</div>
              <div className="stat-label" style={{ marginBottom: 6, fontSize: '0.72rem', fontWeight: 700 }}>قائد الفريق</div>
              {!isAdmin ? (
                <div className="stat-role-badge">{hierarchy.teamLeaders[0]?.fullName || '—'}</div>
              ) : (
                <select className="glass-input stat-filter-select" style={{ fontSize: '0.72rem', padding: '4px 8px', width: '100%', borderRadius: 8 }} value={filterTeamLeaderUserId} onChange={e => { setFilterTeamLeaderUserId(e.target.value); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {hierarchy.teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                </select>
              )}
            </div>
          </div>
          {/* المشرف */}
          <div className={`stat-card purple ${filterSupervisorEmployeeId ? 'active-filter' : ''}`} style={{ flex: '0 0 auto', minWidth: 250, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, border: filterSupervisorEmployeeId ? '2px solid var(--primary)' : undefined, transition: 'all 0.2s' }}>
            <div className="stat-icon" style={{ marginBottom: 0, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}><Shield size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.25 }}>{filterSupervisorEmployeeId ? students.filter(s => s.supervisorEmployeeId === Number(filterSupervisorEmployeeId)).length : hierarchy.supervisors.length}</div>
              <div className="stat-label" style={{ marginBottom: 6, fontSize: '0.72rem', fontWeight: 700 }}>المشرف</div>
              {!isAdmin && !isTeamLeader ? (
                <div className="stat-role-badge">{hierarchy.supervisors[0]?.fullName || '—'}</div>
              ) : (
                <select className="glass-input stat-filter-select" style={{ fontSize: '0.72rem', padding: '4px 8px', width: '100%', borderRadius: 8 }} value={filterSupervisorEmployeeId} onChange={e => { setFilterSupervisorEmployeeId(e.target.value); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {hierarchy.supervisors.filter(s => s.employeeId).map(sup => <option key={sup.id} value={sup.employeeId}>{sup.fullName}</option>)}
                </select>
              )}
            </div>
          </div>
          {/* المسجل */}
          <div className={`stat-card teal ${filterRegisteredByUserId ? 'active-filter' : ''}`} style={{ flex: '0 0 auto', minWidth: 250, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, border: filterRegisteredByUserId ? '2px solid var(--primary)' : undefined, transition: 'all 0.2s' }}>
            <div className="stat-icon" style={{ marginBottom: 0, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}><User size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.25 }}>{filterRegisteredByUserId ? students.filter(s => s.registeredByUserId === Number(filterRegisteredByUserId)).length : hierarchy.registrars.length}</div>
              <div className="stat-label" style={{ marginBottom: 6, fontSize: '0.72rem', fontWeight: 700 }}>المسجل</div>
              {isRegistrar ? (
                <div className="stat-role-badge">{hierarchy.registrars[0]?.fullName || '—'}</div>
              ) : (
                <select className="glass-input stat-filter-select" style={{ fontSize: '0.72rem', padding: '4px 8px', width: '100%', borderRadius: 8 }} value={filterRegisteredByUserId} onChange={e => { setFilterRegisteredByUserId(e.target.value); setFilterMarkerEmployeeId(''); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {hierarchy.registrars.map(reg => <option key={reg.id} value={reg.id}>{reg.fullName}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            قائمة الطلاب{' '}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>({totalCount} طالب)</span>
            {hasDeepFilter && (
              <span style={{ marginRight: 8, fontSize: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 10 }}>
                فلتر نشط
              </span>
            )}
          </h3>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Simple Search */}
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
              <input ref={searchInputRef} type="text" className="glass-input" dir="auto"
                style={{ paddingRight: 32, paddingLeft: searchQuery ? 28 : 10, fontSize: '0.82rem', width: '100%', height: 34 }}
                placeholder="بحث: اسم، هاتف، رقم وطني..."
                value={searchQuery} onChange={e => handleSearchInput(e.target.value)} />
              {searchQuery && (
                <button onClick={handleClearSearch}
                  style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                  <X size={13} />
                </button>
              )}
            </div>
            {/* Deep Search Button */}
            <button
              className="glass-btn icon-btn"
              onClick={() => setIsDeepSearchOpen(true)}
              title="بحث عميق"
              style={hasDeepFilter ? { boxShadow: '0 0 0 2px var(--primary)' } : {}}
            >
              <Search size={18} />
            </button>

            {/* Clear Filters */}
            {hasDeepFilter && (
              <button
                className="glass-btn icon-btn"
                onClick={() => {
                  setDeepFilters({});
                  setHasDeepFilter(false);
                  setPage(1);
                  loadStudents('', {});
                }}
                style={{ color: 'var(--danger)' }}
                title="مسح الفلاتر"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Bar */}
        {hasAdvancedFilters && (
          <div style={{ marginBottom: 12 }}>
            <span className="badge primary" style={{ fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => setShowFilters(!showFilters)}>
              فلاتر متقدمة نشطة — اضغط للتعديل
            </span>
          </div>
        )}
        {showFilters && (
          <div style={{
            padding: 14, marginBottom: 16, background: 'var(--card-bg)',
            borderRadius: 12, border: '1px solid var(--glass-border)',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 10,
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>الشعبة</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={filterSectionId} onChange={e => { setFilterSectionId(e.target.value); setPage(1); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {sectionOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>الدورة</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={filterCourseId} onChange={e => { setFilterCourseId(e.target.value); setPage(1); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {courseOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>الدبلوم</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={filterDiplomaId} onChange={e => { setFilterDiplomaId(e.target.value); setPage(1); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {diplomaOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>الموظف المسجل</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={filterMarkerEmployeeId} onChange={e => { setFilterMarkerEmployeeId(e.target.value); setPage(1); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  {empOptions.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>نتيجة العلامات</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={filterGradeResult} onChange={e => { setFilterGradeResult(e.target.value); setPage(1); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  <option value="PASS">ناجح</option>
                  <option value="FAIL">راسب</option>
                  <option value="NO_GRADE">بدون علامات</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>حالة الدفع</label>
                <select className="glass-input" style={{ fontSize: '0.82rem' }}
                  value={filterPaymentStatus} onChange={e => { setFilterPaymentStatus(e.target.value); setPage(1); setTimeout(() => loadStudentsRef.current(searchQuery), 0); }}>
                  <option value="">الكل</option>
                  <option value="PAID">مسدد</option>
                  <option value="PARTIAL">دفع جزئي</option>
                  <option value="UNPAID">غير مسدد</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10, textAlign: 'left' }}>
              <button className="glass-btn secondary" onClick={clearAllAdvancedFilters} style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                <X size={13} /> مسح كل الفلاتر
              </button>
            </div>
          </div>
        )}

        {/* Bulk Action Bar */}
        <div style={{
          display: 'grid',
          gridTemplateRows: showList ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.35s ease, opacity 0.3s ease',
          opacity: showList ? 1 : 0,
          overflow: 'hidden',
        }}>
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {selectedIds.size > 0 && (
          <div style={{
            padding: '10px 16px', marginBottom: 12,
            background: 'var(--primary-light)', borderRadius: 10,
            border: '1px solid var(--primary)',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}>
              <CheckSquare size={15} /> {selectedIds.size} طالب محدد
            </span>
            <button className="glass-btn sm" onClick={async () => {
              setIsBulkLoading(true);
              try {
                const res = await apiFetch('/students/bulk/end-course', {
                  method: 'POST', body: JSON.stringify({ studentIds: Array.from(selectedIds) })
                });
                toast.success(res.message || 'تم إنهاء الدورات');
                setSelectedIds(new Set());
                await loadStudents(searchQuery);
              } catch (e: any) { toast.error('فشل', e.message); }
              finally { setIsBulkLoading(false); }
            }} disabled={isBulkLoading} style={{ fontSize: '0.8rem' }}>
              إنهاء الدورة
            </button>
            <button className="glass-btn sm" onClick={async () => {
              setIsBulkLoading(true);
              try {
                const res = await apiFetch('/students/bulk/end-diploma', {
                  method: 'POST', body: JSON.stringify({ studentIds: Array.from(selectedIds) })
                });
                toast.success(res.message || 'تم إنهاء الدبلومات');
                setSelectedIds(new Set());
                await loadStudents(searchQuery);
              } catch (e: any) { toast.error('فشل', e.message); }
              finally { setIsBulkLoading(false); }
            }} disabled={isBulkLoading} style={{ fontSize: '0.8rem' }}>
              إنهاء الدبلوم
            </button>
            <button className="glass-btn sm" style={{ fontSize: '0.8rem', color: 'var(--danger)' }}
              onClick={() => setSelectedIds(new Set())}>
              <X size={13} /> إلغاء التحديد
            </button>
          </div>
        )}

        <div className="glass-table-container">
          <table className="glass-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox"
                    checked={students.length > 0 && selectedIds.size === students.length}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(new Set(students.map(s => s.id)));
                      else setSelectedIds(new Set());
                    }}
                    style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ width: 32 }}></th>
                <th>الطالب</th>
                <th>الهاتف</th>
                <th>الحالة</th>
                <th>الدبلوم/الدورة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map(s => {
                const st = STUDENT_STATUS_MAP[s.status] || { label: s.status, cls: 'secondary', icon: '?' };
                const hasDiploma = (s.diplomaSubscriptions || []).length > 0;
                const hasCourse = (s.courseSubscriptions || []).length > 0;
                return (
                  <>
                    <tr
                      key={s.id}
                      onClick={() => handleSelect(s)}
                    className={selectedStudent?.id === s.id ? 'active' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          });
                        }}
                        style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                    </td>
                    <td onClick={e => { e.stopPropagation(); toggleExpand(s.id); }} style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {expandedStudents.has(s.id) ? <ChevronUp size={14} /> : <ChevronLeft size={14} />}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.fullNameAr}</div>
                      {s.fullNameEn && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.fullNameEn}</div>}
                    </td>
                    <td style={{ direction: 'ltr', textAlign: 'right', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {getDisplayPhone(s)}
                    </td>
                    <td>
                      <span className={`badge ${st.cls}`} style={{ fontSize: '0.78rem' }}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {hasDiploma && <span className="badge primary" style={{ fontSize: '0.72rem' }}>دبلوم</span>}
                        {hasCourse && <span className="badge success" style={{ fontSize: '0.72rem' }}>دورة</span>}
                        {!hasDiploma && !hasCourse && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {hasPermission('students.delete') && (
                        <button
                          className="glass-btn secondary sm"
                          onClick={() => handleDelete(s)}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedStudents.has(s.id) && (
                    <tr key={`${s.id}-exp`}>
                      <td colSpan={7} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                        <div style={{ padding: '12px 20px 12px 52px' }}>
                          {studentSectionsMap[s.id] === undefined ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>جارٍ التحميل...</span>
                          ) : studentSectionsMap[s.id]?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                                <span><BookOpen size={13} style={{ verticalAlign: 'middle', marginLeft: 6 }} /> جدول الطالب</span>
                                {hasPermission('sections.assign') && (
                                  <button className="glass-btn primary sm" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                                    onClick={async (e) => { e.stopPropagation(); setAddSectionTarget(s); setSelectedNewSectionId(null); setLoadingAvailSections(true); try {
                                      const data = await apiFetch(`/students/${s.id}/available-sections`);
                                      setAvailableSections(Array.isArray(data) ? data : []);
                                    } catch { setAvailableSections([]); } finally { setLoadingAvailSections(false); } }}>
                                    <Plus size={12} /> إضافة شعبة
                                  </button>
                                )}
                              </div>
                              {studentSectionsMap[s.id].map((sec: any) => {
                                const ss = sec.students?.find((st: any) => st.studentId === s.id);
                                const attStatus = ss?.attendanceStatus;
                                const result = ss?.result;
                                const secId = sec.id || sec.sectionId;
                                return (
                                <div key={secId} style={{
                                  display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                                  padding: '6px 12px', borderRadius: 6,
                                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                  fontSize: '0.82rem'
                                }}>
                                  <span style={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{sec.course?.name || sec.name || sec.courseName || '—'}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    <Clock size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                                    {formatDays(sec.days)}
                                  </span>
                                  <span style={{ direction: 'ltr', color: 'var(--text-muted)' }}>{sec.startTime} - {sec.endTime}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{sec.instructor?.name || sec.instructorName || ''}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{sec.room?.name || sec.roomName || ''}</span>
                                  <LearningTypeBadge room={sec.room} value={sec.roomLearningType} modality={sec.roomModality} entityName={sec.roomEntityName} />
                                  <span>
                                    {result === 'PASS' && <span className="badge success" style={{ fontSize: '0.7rem' }}>ناجح</span>}
                                    {result === 'FAIL' && <span className="badge danger" style={{ fontSize: '0.7rem' }}>راسب</span>}
                                    {!result && <span className="badge secondary" style={{ fontSize: '0.7rem' }}>لم يسجل</span>}
                                  </span>
                                  <span>
                                    {attStatus === 'ELIGIBLE' && <span className="badge success" style={{ fontSize: '0.7rem' }}>مؤهل</span>}
                                    {attStatus === 'DEPRIVED' && <span className="badge danger" style={{ fontSize: '0.7rem' }}>محروم</span>}
                                    {attStatus === 'EXEMPTED' && <span className="badge warning" style={{ fontSize: '0.7rem' }}>معفى</span>}
                                    {!attStatus && <span className="badge secondary" style={{ fontSize: '0.7rem' }}>—</span>}
                                  </span>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {attStatus === 'DEPRIVED' && (
                                      <button className="glass-btn secondary sm" title="إعفاء الطالب" style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--success)' }}
                                        onClick={async (e) => { e.stopPropagation(); try {
                                          await apiFetch(`/attendance/override-deprivation/${secId}/student/${s.id}`, { method: 'POST', body: JSON.stringify({ reason: 'إعفاء يدوي' }) });
                                          toast.success('تم إعفاء الطالب'); loadStudents(searchQuery);
                                        } catch (e: any) { toast.error(e.message); } }}>
                                        <Shield size={12} /> إعفاء
                                      </button>
                                    )}
                                    {attStatus === 'EXEMPTED' && (
                                      <button className="glass-btn secondary sm" title="إلغاء الإعفاء" style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--warning)' }}
                                        onClick={async (e) => { e.stopPropagation(); try {
                                          await apiFetch(`/attendance/remove-override/${secId}/student/${s.id}`, { method: 'POST' });
                                          toast.success('تم إلغاء الإعفاء'); loadStudents(searchQuery);
                                        } catch (e: any) { toast.error(e.message); } }}>
                                        <ShieldOff size={12} /> إلغاء الإعفاء
                                      </button>
                                    )}
                                    {(!attStatus || attStatus === 'ELIGIBLE') && (
                                      <button className="glass-btn secondary sm" title="حرمان الطالب" style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--danger)' }}
                                        onClick={async (e) => { e.stopPropagation(); try {
                                          await apiFetch(`/attendance/override-deprivation/${secId}/student/${s.id}`, { method: 'POST', body: JSON.stringify({ reason: 'حرمان يدوي' }) });
                                          toast.success('تم حرمان الطالب'); loadStudents(searchQuery);
                                        } catch (e: any) { toast.error(e.message); } }}>
                                        <X size={12} /> حرمان
                                      </button>
                                    )}
                                    {hasPermission('sections.assign') && (
                                      <button className="glass-btn secondary sm" title="إزالة من الشعبة" style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--danger)' }}
                                        onClick={async (e) => { e.stopPropagation(); if (!confirm('إزالة الطالب من هذه الشعبة؟')) return; try {
                                          await apiFetch(`/sections/${secId}/students/${s.id}`, { method: 'DELETE' });
                                          toast.success('تمت الإزالة'); loadStudents(searchQuery);
                                        } catch (e: any) { toast.error(e.message); } }}>
                                        <Trash2 size={12} /> إزالة
                                      </button>
                                    )}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>غير مسجل في أي شعبة</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                    {isLoading ? 'جارٍ التحميل...' : 'لا يوجد طلاب مطابقون لمعايير البحث'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ===== PAGINATION ===== */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`pagination-btn ${p === page ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="pagination-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Deep Search Modal */}
      <DeepSearchModal
        isOpen={isDeepSearchOpen}
        onClose={() => setIsDeepSearchOpen(false)}
        onSearch={handleDeepSearch}
        onSelectStudent={handleSelect}
        initialFilters={deepFilters}
        showResultsInline={false}
      />

      <ConfirmModal
        isOpen={confirmDeleteStudent !== null}
        message={confirmDeleteStudent ? `هل أنت متأكد من حذف الطالب: ${confirmDeleteStudent.fullNameAr}؟` : ''}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteStudent(null)}
      />

      {/* ── Add Section Modal ── */}
      {addSectionTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setAddSectionTarget(null)}>
          <div className="glass-panel" style={{ maxWidth: 700, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--glass-border)'
            }}>
              <h4 style={{ margin: 0 }}><Plus size={18} style={{ verticalAlign: 'middle', marginLeft: 8 }} />إضافة شعبة للطالب: {addSectionTarget.fullNameAr}</h4>
              <button onClick={() => setAddSectionTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {loadingAvailSections ? (
              <div style={{ textAlign: 'center', padding: 30, opacity: 0.6 }}>جارٍ تحميل الشعب المتاحة...</div>
            ) : availableSections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, opacity: 0.5 }}>
                لا توجد شعب متاحة — تأكد من وجود اشتراك دورة أو دبلوم نشط للطالب
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableSections.map(sec => (
                  <div key={sec.id} onClick={() => setSelectedNewSectionId(sec.id)}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', cursor: 'pointer',
                      borderRadius: 10, border: selectedNewSectionId === sec.id ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                      background: selectedNewSectionId === sec.id ? 'var(--primary-light)' : 'var(--card-bg)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sec.courseName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        شعبة: {sec.name || '-'} | {sec.instructorName} | {sec.roomName} | {sec.days?.join(' - ')} {sec.startTime}-{sec.endTime}
                        <span style={{ marginRight: 8 }}><LearningTypeBadge room={sec.room} value={sec.roomLearningType} modality={sec.roomModality} entityName={sec.roomEntityName} /></span>
                        {sec.hasConflict && <span style={{ color: 'var(--danger)', marginRight: 10 }}>⚠️ تعارض</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {sec.enrolledCount}/{sec.capacity}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="glass-btn secondary" onClick={() => setAddSectionTarget(null)}>إلغاء</button>
              <button className="glass-btn" disabled={!selectedNewSectionId || addSectionLoading}
                onClick={async () => {
                  if (!selectedNewSectionId) return;
                  setAddSectionLoading(true);
                  try {
                    await apiFetch(`/sections/${selectedNewSectionId}/students`, {
                      method: 'POST', body: JSON.stringify({ studentId: addSectionTarget.id })
                    });
                    toast.success('تم تسجيل الطالب في الشعبة');
                    setAddSectionTarget(null);
                    loadStudents(searchQuery);
                  } catch (e: any) { toast.error(e.message); }
                  finally { setAddSectionLoading(false); }
                }}>
                {addSectionLoading ? 'جاري...' : 'تسجيل في الشعبة'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
