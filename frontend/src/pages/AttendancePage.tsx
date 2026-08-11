import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck, Calendar, Search, CheckCircle, XCircle, X,
  Clock, AlertCircle, Save, RefreshCw, Printer, BarChart3, ListChecks,
  BookOpen, GraduationCap, ChevronLeft, Users, Lock, Unlock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LearningTypeBadge } from '../components/LearningTypeBadge';
import { DIPLOMA_CATEGORIES } from '../utils/constants';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = API_BASE + '/api';

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface StudentRow {
  id: string;
  fullName: string;
  studentCode?: string;
  attendance?: { id: string; status: AttStatus; notes?: string } | null;
}

interface Section {
  id: number; name: string | null;
  courseId: string; course: { id: string; name: string; categoryId: number; category?: { id: number; name: string; nameAr: string | null } };
  instructor?: { id: number; name: string };
  room?: { id: number; name: string };
  days: string; startTime: string; endTime: string;
  status: string;
  _count?: { students: number };
}

interface SummaryStudent {
  id: string;
  fullName: string;
  phone: string;
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

interface CourseCategory {
  id: number; name: string; nameAr: string | null;
}

interface Course {
  id: string; name: string; categoryId: number;
}

interface Diploma {
  id: string; name: string; category: string | null;
  courses?: { courseId: string }[];
}

type SearchMode = 'DIPLOMA' | 'COURSE';

const statusConfig: Record<AttStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PRESENT: { label: 'حاضر',  color: 'var(--success)', bg: 'var(--success-light)', icon: <CheckCircle size={15}/> },
  ABSENT:  { label: 'غائب',  color: 'var(--danger)',  bg: 'var(--danger-light)',  icon: <XCircle size={15}/> },
  LATE:    { label: 'متأخر', color: 'var(--warning)', bg: 'var(--warning-light)', icon: <Clock size={15}/> },
  EXCUSED: { label: 'معذور', color: 'var(--primary)', bg: 'var(--primary-light)', icon: <AlertCircle size={15}/> },
};

const dayLabels: Record<string, string> = {
  SUN: 'الأحد', MON: 'الاثنين', TUE: 'الثلاثاء',
  WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة', SAT: 'السبت'
};

const formatDays = (str: string) => {
  try { return (JSON.parse(str) as string[]).map(d => dayLabels[d] || d).join('، '); }
  catch { return str; }
};

export const AttendancePage = () => {
  const { token, hasPermission } = useAuth();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [mode, setMode] = useState<SearchMode>('DIPLOMA');
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Diploma path
  const [dipCat, setDipCat] = useState('');
  const [dipDip, setDipDip] = useState('');
  const [dipCrsCat, setDipCrsCat] = useState('');
  const [dipCrs, setDipCrs] = useState('');
  const [dipSec, setDipSec] = useState('');

  // Course path
  const [crsCat, setCrsCat] = useState('');
  const [crsCrs, setCrsCrs] = useState('');
  const [crsSec, setCrsSec] = useState('');

  // Sections
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Attendance state
  const [tab, setTab] = useState<'record' | 'summary'>('record');
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sectionInfo, setSectionInfo] = useState<any>(null);
  const [instructorCanEdit, setInstructorCanEdit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  // Summary state
  const [summaryStudents, setSummaryStudents] = useState<SummaryStudent[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);

  // Derived
  const filteredDiplomas = useMemo(() => {
    if (!dipCat) return diplomas;
    return diplomas.filter(d => d.category === dipCat);
  }, [dipCat, diplomas]);

  const diplomaCourseIds = useMemo(() => {
    if (!dipDip) return new Set<string>();
    const dip = diplomas.find(d => d.id === dipDip);
    return new Set((dip?.courses || []).map(dc => dc.courseId));
  }, [dipDip, diplomas]);

  const diplomaCourses = useMemo(() => courses.filter(c => diplomaCourseIds.has(c.id)), [diplomaCourseIds, courses]);

  const filteredDiplomaCourses = useMemo(() => {
    let list = diplomaCourses;
    if (dipCrsCat) list = list.filter(c => c.categoryId === Number(dipCrsCat));
    return list;
  }, [diplomaCourses, dipCrsCat]);

  const filteredCourseCourses = useMemo(() => {
    if (!crsCat) return courses;
    return courses.filter(c => c.categoryId === Number(crsCat));
  }, [crsCat, courses]);

  const dipCategories = DIPLOMA_CATEGORIES.map(c => c.value);

  // Init
  useEffect(() => {
    fetch(`${API}/courses/categories`, { headers }).then(r => r.ok ? r.json() : []).then(setCategories).catch(() => {});
    fetch(`${API}/diplomas`, { headers }).then(r => r.ok ? r.json() : []).then(setDiplomas).catch(() => {});
    fetch(`${API}/courses`, { headers }).then(r => r.ok ? r.json() : []).then(setCourses).catch(() => {});
  }, []);

  // Load sections when course changes
  const loadSections = async (courseId: string) => {
    setLoadingSections(true);
    setSelectedSectionId(null);
    setSectionInfo(null);
    setStudents([]);
    try {
      const res = await fetch(`${API}/sections?courseId=${courseId}`, { headers });
      const data = res.ok ? await res.json() : [];
      setSections(data);
    } catch {
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => {
    if (mode === 'DIPLOMA' && dipCrs) loadSections(dipCrs);
  }, [mode, dipCrs]);

  useEffect(() => {
    if (mode === 'COURSE' && crsCrs) loadSections(crsCrs);
  }, [mode, crsCrs]);

  // Load attendance when section is selected
  useEffect(() => {
    const secId = mode === 'DIPLOMA' ? dipSec : crsSec;
    if (!secId) return;
    const id = Number(secId);
    setSelectedSectionId(id);
    loadAttendance(id, date);
  }, [mode, dipSec, crsSec]);

  useEffect(() => {
    if (selectedSectionId && tab === 'record') loadAttendance(selectedSectionId, date);
  }, [date, tab]);

  useEffect(() => {
    if (selectedSectionId && tab === 'summary') loadSummary(selectedSectionId);
  }, [tab]);

  const loadAttendance = async (sectionId: number, dt: string) => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`${API}/attendance/section/${sectionId}?date=${dt}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setSectionInfo(data.section);
      setInstructorCanEdit(data.instructorCanEdit);
      setStudents(data.students);
      const s: Record<string, AttStatus> = {};
      const n: Record<string, string> = {};
      data.students.forEach((st: StudentRow) => {
        if (st.attendance) {
          s[st.id] = st.attendance.status;
          n[st.id] = st.attendance.notes || '';
        } else {
          s[st.id] = 'PRESENT';
        }
      });
      setStatuses(s);
      setNotes(n);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (sectionId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/attendance/section-summary/${sectionId}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setSectionInfo(data.section);
      setTotalSessions(data.totalSessions);
      setSummaryStudents(data.students || []);
    } catch {
      setSummaryStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSectionId || students.length === 0) return;
    setSaving(true);
    try {
      const records = students.map(st => ({
        studentId: st.id,
        status: statuses[st.id] || 'PRESENT',
        notes: notes[st.id] || ''
      }));
      const res = await fetch(`${API}/attendance/bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sectionId: selectedSectionId, date, records })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status: AttStatus) => {
    const s: Record<string, AttStatus> = {};
    students.forEach(st => { s[st.id] = status; });
    setStatuses(s);
  };

  const presentCount = Object.values(statuses).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(statuses).filter(s => s === 'ABSENT').length;
  const lateCount = Object.values(statuses).filter(s => s === 'LATE').length;

  const filteredStudents = students.filter(st => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return st.fullName.toLowerCase().includes(q) || (st.studentCode || '').toLowerCase().includes(q);
  });

  const filteredSummary = summaryStudents.filter(st => {
    if (!searchQ) return true;
    return st.fullName.toLowerCase().includes(searchQ.toLowerCase());
  });

  const handlePrint = () => window.print();

  const switchMode = (m: SearchMode) => {
    setMode(m);
    setDipCat(''); setDipDip(''); setDipCrsCat(''); setDipCrs(''); setDipSec('');
    setCrsCat(''); setCrsCrs(''); setCrsSec('');
    setSections([]);
    setSelectedSectionId(null);
    setSectionInfo(null);
    setStudents([]);
  };

  const resetDiplomaPath = () => {
    setDipCat(''); setDipDip(''); setDipCrsCat(''); setDipCrs(''); setDipSec('');
    setSections([]);
    setSelectedSectionId(null);
    setSectionInfo(null);
    setStudents([]);
  };

  const resetCoursePath = () => {
    setCrsCat(''); setCrsCrs(''); setCrsSec('');
    setSections([]);
    setSelectedSectionId(null);
    setSectionInfo(null);
    setStudents([]);
  };

  const renderSteps = (steps: { label: string; value: boolean }[]) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 12,
      borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap',
    }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          {i > 0 && <ChevronLeft size={13} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />}
          <span style={{
            fontSize: '0.76rem', fontWeight: step.value ? 700 : 400,
            color: step.value ? 'var(--primary)' : 'var(--text-muted)',
            opacity: step.value ? 1 : 0.45,
          }}>{step.label}</span>
        </React.Fragment>
      ))}
    </div>
  );

  const renderSelect = (
    label: string, value: string, onChange: (v: string) => void,
    options: { value: string; label: string }[], disabled = false
  ) => (
    <div className="form-group" style={{ margin: 0, minWidth: 160, flex: 1 }}>
      <label className="form-label" style={{ fontSize: '0.72rem' }}>{label}</label>
      <select className="glass-input" value={value}
        onChange={e => onChange(e.target.value)} disabled={disabled}>
        <option value="">— اختر {label} —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2><UserCheck className="text-primary" size={24} /> الحضور والغياب</h2>
        {selectedSectionId && !loading && students.length > 0 && tab === 'record' && (
          <div className="actions">
            <button className="glass-btn secondary sm" onClick={() => markAll('PRESENT')}>
              <CheckCircle size={14} /> تحديد الكل حاضر
            </button>
            <button className="glass-btn secondary sm" onClick={() => markAll('ABSENT')}>
              <XCircle size={14} /> تحديد الكل غائب
            </button>
            <button className="glass-btn secondary sm no-print" onClick={handlePrint}>
              <Printer size={14} /> طباعة
            </button>
            {hasPermission('attendance.manage') && instructorCanEdit && (
              <button className="glass-btn" onClick={handleSave} disabled={saving}>
                {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
              </button>
            )}
            {hasPermission('attendance.admin') && instructorCanEdit && (
              <button className="glass-btn secondary sm" onClick={async () => {
                try {
                  await fetch(`${API}/attendance/lock/${selectedSectionId}`, { method: 'POST', headers });
                  setInstructorCanEdit(false);
                } catch {}
              }}>
                <Lock size={14} /> تأمين الحضور
              </button>
            )}
            {hasPermission('attendance.admin') && !instructorCanEdit && (
              <button className="glass-btn secondary sm" onClick={async () => {
                try {
                  await fetch(`${API}/attendance/unlock/${selectedSectionId}`, { method: 'POST', headers });
                  setInstructorCanEdit(true);
                } catch {}
              }}>
                <Unlock size={14} /> فتح التعديل
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Step-by-Step Filter Panel ── */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-muted)' }}>
          {([['DIPLOMA', 'دبلوم'], ['COURSE', 'دورة']] as [SearchMode, string][]).map(([key, label]) => (
            <button key={key} onClick={() => switchMode(key)}
              style={{
                flex: 1, padding: '12px 20px', border: 'none', cursor: 'pointer',
                background: mode === key ? 'var(--card-bg)' : 'transparent',
                color: mode === key ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: mode === key ? 700 : 500, fontSize: '0.9rem',
                borderBottom: mode === key ? '2px solid var(--primary)' : '2px solid transparent',
              }}>
              <BookOpen size={16} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
              {label}
            </button>
          ))}
        </div>

        {mode === 'DIPLOMA' && (
          <div style={{ padding: 16 }}>
            {renderSteps([
              { label: 'تصنيف الدبلوم', value: !!dipCat },
              { label: 'الدبلوم', value: !!dipDip },
              { label: 'تصنيف الدورة', value: !!dipCrsCat },
              { label: 'الدورة', value: !!dipCrs },
              { label: 'الشعبة', value: !!dipSec },
            ])}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {renderSelect('تصنيف الدبلوم', dipCat, v => { setDipCat(v); setDipDip(''); setDipCrsCat(''); setDipCrs(''); setDipSec(''); setSections([]); },
                dipCategories.map(c => ({ value: c, label: c })))}
              {renderSelect('الدبلوم', dipDip, v => { setDipDip(v); setDipCrsCat(''); setDipCrs(''); setDipSec(''); setSections([]); },
                filteredDiplomas.map(d => ({ value: d.id, label: d.name })), !dipCat)}
              {renderSelect('تصنيف الدورة', dipCrsCat, v => { setDipCrsCat(v); setDipCrs(''); setDipSec(''); setSections([]); },
                categories.map(c => ({ value: String(c.id), label: c.nameAr || c.name })), !dipDip)}
              {renderSelect('الدورة', dipCrs, v => { setDipCrs(v); setDipSec(''); setSections([]); },
                filteredDiplomaCourses.map(c => ({ value: c.id, label: c.name })), !dipDip || filteredDiplomaCourses.length === 0)}
              {renderSelect('الشعبة', dipSec, v => setDipSec(v),
                sections.map(s => ({
                  value: String(s.id),
                  label: `${s.name || 'شعبة'} — ${s.instructor?.name || '-'} ${s.startTime ? `(${s.startTime}-${s.endTime})` : ''} (${s._count?.students || 0} طالب)`
                })), !dipCrs || sections.length === 0)}
              {dipCat && (
                <button className="glass-btn secondary sm" onClick={resetDiplomaPath} style={{ fontSize: '0.75rem', padding: '6px 12px', marginBottom: 1 }}>
                  <RefreshCw size={12} /> إعادة تعيين
                </button>
              )}
            </div>
            {loadingSections && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>جارٍ تحميل الشعب...</div>}
          </div>
        )}

        {mode === 'COURSE' && (
          <div style={{ padding: 16 }}>
            {renderSteps([
              { label: 'تصنيف الدورة', value: !!crsCat },
              { label: 'الدورة', value: !!crsCrs },
              { label: 'الشعبة', value: !!crsSec },
            ])}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {renderSelect('تصنيف الدورة', crsCat, v => { setCrsCat(v); setCrsCrs(''); setCrsSec(''); setSections([]); },
                categories.map(c => ({ value: String(c.id), label: c.nameAr || c.name })))}
              {renderSelect('الدورة', crsCrs, v => { setCrsCrs(v); setCrsSec(''); setSections([]); },
                filteredCourseCourses.map(c => ({ value: c.id, label: c.name })), !crsCat)}
              {renderSelect('الشعبة', crsSec, v => setCrsSec(v),
                sections.map(s => ({
                  value: String(s.id),
                  label: `${s.name || 'شعبة'} — ${s.instructor?.name || '-'} ${s.startTime ? `(${s.startTime}-${s.endTime})` : ''} (${s._count?.students || 0} طالب)`
                })), !crsCrs || sections.length === 0)}
              {crsCat && (
                <button className="glass-btn secondary sm" onClick={resetCoursePath} style={{ fontSize: '0.75rem', padding: '6px 12px', marginBottom: 1 }}>
                  <RefreshCw size={12} /> إعادة تعيين
                </button>
              )}
            </div>
            {loadingSections && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>جارٍ تحميل الشعب...</div>}
          </div>
        )}
      </div>

      {/* Section info bar */}
      {selectedSectionId && sectionInfo && (
        <div className="glass-panel" style={{ marginBottom: 20, padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.9rem' }}>{sectionInfo.course?.name}</strong>
            {[
              { label: 'القاعة', value: sectionInfo.room?.name },
              { label: 'المحاضر', value: sectionInfo.instructor?.name },
              { label: 'الأيام', value: formatDays(sectionInfo.days) },
              { label: 'الوقت', value: `${sectionInfo.startTime} - ${sectionInfo.endTime}` },
            ].map(({ label, value }) => value ? (              <div key={label} style={{
                background: 'var(--primary-light)', borderRadius: 8, padding: '5px 14px',
                fontSize: '0.82rem', display: 'flex', gap: 6, alignItems: 'center'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{value}</span>
              </div>
            ) : null)}
            {sectionInfo.room?.learningType && (
              <LearningTypeBadge room={sectionInfo.room} />
            )}

            {tab === 'record' && (
              <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <input type="date" className="glass-input" style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                  value={date} onChange={e => setDate(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      {selectedSectionId && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          <button
            className={`glass-btn ${tab === 'record' ? '' : 'secondary'} sm`}
            onClick={() => setTab('record')}
            style={{ flex: 1, justifyContent: 'center' }}>
            <ListChecks size={16} /> تسجيل الحضور
          </button>
          <button
            className={`glass-btn ${tab === 'summary' ? '' : 'secondary'} sm`}
            onClick={() => setTab('summary')}
            style={{ flex: 1, justifyContent: 'center' }}>
            <BarChart3 size={16} /> سجل الحضور والإحصائيات
          </button>
        </div>
      )}

      {!selectedSectionId && (
        <div className="glass-panel empty-state">
          <UserCheck size={48} />
          <p>اختر الشعبة من القائمة أعلاه لعرض بيانات الحضور</p>
        </div>
      )}

      {selectedSectionId && loading && (
        <div className="glass-panel empty-state">
          <RefreshCw size={36} className="spin" />
          <p>جارٍ تحميل البيانات...</p>
        </div>
      )}

      {/* ── Record Tab ── */}
      {selectedSectionId && !loading && tab === 'record' && (
        <>
          {students.length > 0 && (
            <>
              <div className="grid-4" style={{ marginBottom: 16 }}>
                {[
                  { label: 'إجمالي الطلاب', value: students.length, color: 'blue' },
                  { label: 'حاضر', value: presentCount, color: 'green' },
                  { label: 'غائب', value: absentCount, color: 'purple' },
                  { label: 'متأخر', value: lateCount, color: 'amber' },
                ].map(card => (
                  <div key={card.label} className={`stat-card ${card.color}`}>
                    <div className="stat-label">{card.label}</div>
                    <div className="stat-value">{card.value}</div>
                  </div>
                ))}
              </div>

              {saved && (
                <div className="alert success" style={{ marginBottom: 16 }}>
                  <CheckCircle size={18} /> تم حفظ سجل الحضور بنجاح!
                </div>
              )}
              {selectedSectionId && !instructorCanEdit && (
                <div className="alert warning" style={{ marginBottom: 16 }}>
                  <AlertCircle size={18} /> تم تأمين سجل الحضور، لا يمكن التعديل. يرجى التواصل مع الإدارة لتعديل الحضور.
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div className="search-bar" style={{ position: 'relative' }}>
                  <Search className="search-icon" size={17} />
                  <input type="text" className="glass-input" placeholder="بحث باسم الطالب أو الرقم... ( / للبحث)"
                    value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setSearchQ('')}
                    style={{ paddingLeft: searchQ ? 32 : 12 }} />
                  {searchQ && (
                    <button onClick={() => setSearchQ('')} style={{
                      position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2
                    }}><X size={14} /></button>
                  )}
                </div>
                {searchQ && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    عرض <strong style={{ color: 'var(--primary)' }}>{tab === 'record' ? filteredStudents.length : filteredSummary.length}</strong> من <strong>{tab === 'record' ? students.length : summaryStudents.length}</strong> طالب
                  </div>
                )}
              </div>

              <div className="glass-table-container">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الطالب</th>
                      <th>الرقم</th>
                      <th style={{ textAlign: 'center' }}>حاضر</th>
                      <th style={{ textAlign: 'center' }}>غائب</th>
                      <th style={{ textAlign: 'center' }}>متأخر</th>
                      <th style={{ textAlign: 'center' }}>معذور</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((st, idx) => {
                      const cur = statuses[st.id] || 'PRESENT';
                      const cfg = statusConfig[cur];
                      return (
                        <tr key={st.id} style={cur !== 'PRESENT' ? { background: cfg.bg + '60' } : {}}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="profile-avatar" style={{ width: 34, height: 34, fontSize: '0.9rem' }}>
                                {st.fullName.charAt(0)}
                              </div>
                              <span style={{ fontWeight: 600 }}>{st.fullName}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', direction: 'ltr' }}>
                            {st.studentCode || '—'}
                          </td>
                          {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttStatus[]).map(s => (
                            <td key={s} style={{ textAlign: 'center' }}>
                              <input type="radio" name={`att-${st.id}`}
                                checked={cur === s}
                                disabled={!instructorCanEdit}
                                onChange={() => setStatuses(p => ({ ...p, [st.id]: s }))}
                                style={{ width: 18, height: 18, accentColor: statusConfig[s].color, cursor: instructorCanEdit ? 'pointer' : 'not-allowed', opacity: instructorCanEdit ? 1 : 0.5 }} />
                            </td>
                          ))}
                          <td>
                            <input type="text" className="glass-input" placeholder="إن وجد..."
                              value={notes[st.id] || ''}
                              disabled={!instructorCanEdit}
                              onChange={e => setNotes(p => ({ ...p, [st.id]: e.target.value }))}
                              style={{ padding: '6px 10px', fontSize: '0.85rem', opacity: instructorCanEdit ? 1 : 0.5 }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10, marginTop: 20 }}>
                {hasPermission('attendance.manage') && instructorCanEdit && (
                  <button className="glass-btn lg" onClick={handleSave} disabled={saving}>
                    {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                    {saving ? 'جارٍ الحفظ...' : 'حفظ سجل الحضور'}
                  </button>
                )}
                {hasPermission('attendance.admin') && instructorCanEdit && (
                  <button className="glass-btn secondary sm" onClick={async () => {
                    try {
                      await fetch(`${API}/attendance/lock/${selectedSectionId}`, { method: 'POST', headers });
                      setInstructorCanEdit(false);
                    } catch {}
                  }}>
                    <Lock size={14} /> تأمين الحضور
                  </button>
                )}
                {hasPermission('attendance.admin') && !instructorCanEdit && (
                  <button className="glass-btn secondary sm" onClick={async () => {
                    try {
                      await fetch(`${API}/attendance/unlock/${selectedSectionId}`, { method: 'POST', headers });
                      setInstructorCanEdit(true);
                    } catch {}
                  }}>
                    <Unlock size={14} /> فتح التعديل
                  </button>
                )}
                <button className="glass-btn secondary" onClick={() => selectedSectionId && loadAttendance(selectedSectionId, date)}>
                  <RefreshCw size={16} /> تحديث
                </button>
              </div>
            </>
          )}

          {students.length === 0 && (
            <div className="glass-panel empty-state">
              <XCircle size={40} />
              <p>لا يوجد طلاب مسجّلون في هذه الشعبة بعد</p>
            </div>
          )}
        </>
      )}

      {/* ── Summary Tab ── */}
      {selectedSectionId && !loading && tab === 'summary' && (
        <>
          {summaryStudents.length > 0 ? (
            <>
              <div className="grid-4" style={{ marginBottom: 16 }}>
                {[
                  { label: 'إجمالي الطلاب', value: summaryStudents.length, color: 'blue' },
                  { label: 'عدد الجلسات', value: totalSessions, color: 'purple' },
                  { label: 'إجمالي الحضور', value: summaryStudents.reduce((a, b) => a + b.present, 0), color: 'green' },
                  { label: 'إجمالي الغياب', value: summaryStudents.reduce((a, b) => a + b.absent, 0), color: 'red' },
                ].map(card => (
                  <div key={card.label} className={`stat-card ${card.color}`}>
                    <div className="stat-label">{card.label}</div>
                    <div className="stat-value">{card.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="search-bar" style={{ position: 'relative' }}>
                  <Search className="search-icon" size={17} />
                  <input type="text" className="glass-input" placeholder="ابحث عن طالب..."
                    value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setSearchQ('')}
                    style={{ paddingLeft: searchQ ? 32 : 12 }} />
                  {searchQ && (
                    <button onClick={() => setSearchQ('')} style={{
                      position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2
                    }}><X size={14} /></button>
                  )}
                </div>
              </div>

              <div className="glass-table-container">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الطالب</th>
                      <th style={{ textAlign: 'center' }}>حاضر</th>
                      <th style={{ textAlign: 'center' }}>غائب</th>
                      <th style={{ textAlign: 'center' }}>متأخر</th>
                      <th style={{ textAlign: 'center' }}>معذور</th>
                      <th style={{ textAlign: 'center' }}>المجموع</th>
                      <th style={{ textAlign: 'center' }}>نسبة الحضور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummary.map((st, idx) => {
                      const total = st.totalSessions;
                      const totalRecorded = st.present + st.absent + st.late + st.excused;
                      const attendancePercent = total > 0 ? Math.round((st.present / total) * 100) : 0;
                      return (
                        <tr key={st.id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{st.fullName}</td>
                          <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>{st.present}</td>
                          <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>{st.absent}</td>
                          <td style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 700 }}>{st.late}</td>
                          <td style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>{st.excused}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{total}</td>
                          <td style={{ textAlign: 'center' }}>
                            {total === 0 ? (
                              <span className="badge secondary" style={{ fontSize: '0.72rem' }}>لم يسجل بعد</span>
                            ) : (
                              <span style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                                fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                                background: attendancePercent >= 75 ? 'var(--success)' : attendancePercent >= 50 ? 'var(--warning)' : 'var(--danger)'
                              }}>
                                {attendancePercent}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="glass-btn secondary" onClick={() => selectedSectionId && loadSummary(selectedSectionId)}>
                  <RefreshCw size={16} /> تحديث
                </button>
              </div>
            </>
          ) : (
            <div className="glass-panel empty-state">
              <BarChart3 size={40} />
              <p>لم يتم تسجيل أي جلسات حضور لهذه الشعبة بعد</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
