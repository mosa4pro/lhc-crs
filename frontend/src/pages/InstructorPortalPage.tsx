import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, UserCheck, Calendar, BookOpen,
  LogOut, CheckCircle, XCircle, Clock, AlertCircle,
  Sun, Moon, Save, RefreshCw, Users, ChevronDown,
  FileText, User, BarChart3, Download, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LearningTypeBadge } from '../components/LearningTypeBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = API_BASE + '/api';
type Tab = 'schedule' | 'attendance' | 'grades' | 'profile';
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const statusConfig: Record<AttStatus, { label: string; color: string; bg: string; Icon: any }> = {
  PRESENT: { label: 'حاضر',  color: 'var(--success)', bg: 'var(--success-light)', Icon: CheckCircle },
  ABSENT:  { label: 'غائب',  color: 'var(--danger)',  bg: 'var(--danger-light)',  Icon: XCircle    },
  LATE:    { label: 'متأخر', color: 'var(--warning)', bg: 'var(--warning-light)', Icon: Clock      },
  EXCUSED: { label: 'معذور', color: 'var(--primary)', bg: 'var(--primary-light)', Icon: AlertCircle },
};

const DAY_LABELS: Record<string, string> = {
  SAT: 'السبت', SUN: 'الأحد', MON: 'الاثنين',
  TUE: 'الثلاثاء', WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة',
};

const formatDays = (str: string) => {
  try { return (JSON.parse(str) as string[]).map(d => DAY_LABELS[d] || d).join('، '); }
  catch { return str; }
};

const PASS_THRESHOLD = 50;

const NAV_ITEMS: { key: Tab; label: string; Icon: any }[] = [
  { key: 'schedule',   label: 'جدولي',         Icon: Calendar  },
  { key: 'attendance', label: 'تسجيل الحضور',  Icon: UserCheck },
  { key: 'grades',     label: 'العلامات',      Icon: FileText  },
  { key: 'profile',    label: 'معلوماتي',       Icon: User      },
];

export const InstructorPortalPage = () => {
  const { user, token, logout, centerName, centerLogo } = useAuth();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('schedule');
  const [instructorData, setInstructorData] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* attendance state */
  const [selSection, setSelSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({});
  const [notes, setNotes]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loadingAtt, setLoadingAtt] = useState(false);

  /* grades state */
  const [selSecGrades, setSelSecGrades] = useState('');
  const [gradeStudents, setGradeStudents] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<Record<string, {grade: number | null; isProject: boolean; projectResult: string | null; supervisorApproved: boolean}>>({});
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradesSaved, setGradesSaved] = useState(false);

  /* ── load instructor data ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const instructorId = user?.instructorId;
        if (instructorId) {
          const res = await fetch(`${API}/instructors/${instructorId}`, { headers });
          if (res.ok) {
            const inst = await res.json();
            setInstructorData(inst);
            const sRes = await fetch(`${API}/sections?instructorId=${inst.id}`, { headers });
            if (sRes.ok) setSections(await sRes.json());
          }
        } else {
          const sRes = await fetch(`${API}/sections`, { headers });
          if (sRes.ok) setSections(await sRes.json());
        }
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [user?.id, user?.instructorId]);

  /* ── load students for attendance ── */
  const loadAttendance = useCallback(async (secId: string, dt: string) => {
    if (!secId) return;
    setLoadingAtt(true);
    setSaved(false);
    try {
      const res = await fetch(`${API}/attendance/section/${secId}?date=${dt}`, { headers });
      const data = await res.json();
      setStudents(data.students || []);
      const s: Record<string, AttStatus> = {};
      const n: Record<string, string>   = {};
      (data.students || []).forEach((st: any) => {
        s[st.id] = st.attendance?.status || 'PRESENT';
        n[st.id] = st.attendance?.notes || '';
      });
      setStatuses(s);
      setNotes(n);
    } catch { setStudents([]); }
    finally { setLoadingAtt(false); }
  }, [token]);

  useEffect(() => { loadAttendance(selSection, date); }, [selSection, date]);

  const loadGrades = useCallback(async (secId: string) => {
    if (!secId) return;
    setLoadingGrades(true);
    setGradesSaved(false);
    try {
      const res = await fetch(`${API}/grades/section/${secId}/students`, { headers });
      const data = await res.json();
      const students = data.enrollments || (Array.isArray(data) ? data : []);
      setGradeStudents(students);
      const gd: Record<string, any> = {};
      students.forEach((st: any) => {
        gd[st.id] = {
          grade: st.grade ?? null,
          isProject: st.isProject ?? false,
          projectResult: st.isProject ? (st.result ?? null) : null,
          supervisorApproved: st.supervisorApproved ?? false,
        };
      });
      setGradeData(gd);
    } catch { setGradeStudents([]); }
    finally { setLoadingGrades(false); }
  }, [token]);

  useEffect(() => { loadGrades(selSecGrades); }, [selSecGrades]);

  const handleSave = async () => {
    if (!selSection) return;
    setSaving(true);
    try {
      const records = students.map(st => ({ studentId: st.id, status: statuses[st.id] || 'PRESENT', notes: notes[st.id] || '' }));
      await fetch(`${API}/attendance/bulk`, {
        method: 'POST', headers,
        body: JSON.stringify({ sectionId: selSection, date, records })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const handleSaveGrades = async () => {
    if (!selSecGrades) return;
    setSavingGrades(true);
    try {
      const records = gradeStudents.map(st => ({
        studentId: st.id,
        ...gradeData[st.id],
      }));
      await fetch(`${API}/grades/bulk`, {
        method: 'POST', headers,
        body: JSON.stringify({ sectionId: selSecGrades, records })
      });
      setGradesSaved(true);
      setTimeout(() => setGradesSaved(false), 3000);
    } finally { setSavingGrades(false); }
  };

  const getResult = (g: any) => {
    if (g.isProject) return g.projectResult || null;
    if (g.grade !== null && g.grade !== undefined) return g.grade >= PASS_THRESHOLD ? 'PASS' : 'FAIL';
    return null;
  };

  const generateGradeCSV = (students: any[], gd: Record<string, any>, sectionLabel: string): string => {
    const header = 'اسم الطالب,العلامة/المشروع,الحالة,ملاحظات';
    const rows = students.map(st => {
      const g = gd[st.id] || {};
      const label = g.isProject ? (g.projectResult === 'PASS' ? 'مشروع ناجح' : 'مشروع راسب') : (g.grade ?? '—');
      const result = getResult(g);
      const status = !result ? '—' : result === 'PASS' ? 'ناجح' : 'راسب';
      const name = st.student?.fullNameAr || st.fullName || '—';
      const notes = g.supervisorApproved ? 'معتمد' : 'غير معتمد';
      return `${name},${label},${status},${notes}`;
    });
    return '\uFEFF' + header + '\n' + rows.join('\n');
  };

  const handleDownloadGrades = () => {
    if (!selSecGrades || gradeStudents.length === 0) return;
    const section = sections.find(s => s.id === selSecGrades);
    const label = section?.course?.name || selSecGrades;
    const csv = generateGradeCSV(gradeStudents, gradeData, label);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grades-${label}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllGrades = async () => {
    const allSections = sections.filter(s => s.students?.length);
    if (allSections.length === 0) return;
    let allCsv = '';
    for (const sec of allSections) {
      try {
        const res = await fetch(`${API}/grades/section/${sec.id}/students`, { headers });
        const data = await res.json();
        const students = data.enrollments || (Array.isArray(data) ? data : []);
        if (students.length === 0) continue;
        const gd: Record<string, any> = {};
        students.forEach((st: any) => {
          gd[st.id] = {
            grade: st.grade ?? null,
            isProject: st.isProject ?? false,
            projectResult: st.isProject ? (st.result ?? null) : null,
            supervisorApproved: st.supervisorApproved ?? false,
          };
        });
        const label = sec.course?.name || sec.id;
        allCsv += `\n--- ${label} ---\n` + generateGradeCSV(students, gd, label);
      } catch {}
    }
    if (!allCsv) return;
    const blob = new Blob(['\uFEFF' + allCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-grades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presentCount = Object.values(statuses).filter(s => s === 'PRESENT').length;
  const absentCount  = Object.values(statuses).filter(s => s === 'ABSENT').length;

  return (
    <div className="portal-page">
      {/* ── Topbar ── */}
      <header className="portal-header">
        <div className="portal-header-start">
          {centerLogo
            ? <img src={centerLogo} alt="logo" className="portal-logo"/>
            : <div className="portal-logo-fallback"><GraduationCap size={18}/></div>
          }
          <div>
            <div className="portal-name">{centerName}</div>
            <div className="portal-subtitle">بوابة المحاضر</div>
          </div>
        </div>
        <div className="portal-header-end">
          <div className="portal-user-badge">
            <div className="portal-avatar-sm">{user?.fullName?.charAt(0)}</div>
            <div>
              <div className="portal-user-name">{user?.fullName}</div>
              <div className="portal-user-role">محاضر</div>
            </div>
          </div>
          <button onClick={toggleTheme} className="glass-btn secondary icon-only">
            {theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}
          </button>
          <button onClick={logout} className="glass-btn secondary icon-only" style={{ color: 'var(--danger)' }}>
            <LogOut size={16}/>
          </button>
        </div>
      </header>

      <div className="portal-container">
        {/* ── Tabs ── */}
        <div className="tabs">
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              <Icon size={15}/> {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="glass-panel empty-state">
            <div className="spinner-lg"/>
            <p>جارٍ تحميل البيانات...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* ═══ SCHEDULE TAB ═══ */}
            {tab === 'schedule' && (
              <div className="portal-section">
                <div className="grid-2">
                  <div className="stat-card blue">
                    <div className="stat-icon"><BookOpen size={22}/></div>
                    <div className="stat-label">الشعب المُسندة</div>
                    <div className="stat-value">{sections.length}</div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-icon"><Users size={22}/></div>
                    <div className="stat-label">إجمالي الطلاب</div>
                    <div className="stat-value">{sections.reduce((acc, s) => acc + (s.students?.length || 0), 0)}</div>
                  </div>
                </div>

                <div className="glass-panel">
                  <h4 className="panel-title"><BookOpen size={18} className="text-primary"/> شعبي الدراسية</h4>
                  {sections.length === 0
                    ? <div className="empty-state"><BookOpen size={36}/><p>لا توجد شعب مُسندة إليك</p></div>
                    : <div className="glass-table-container">
                        <table className="glass-table">
                          <thead><tr><th>الدورة</th><th>الأيام</th><th>الوقت</th><th>القاعة</th><th>الطلاب</th><th>الحالة</th></tr></thead>
                          <tbody>
                            {sections.map(s => (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 700 }}>{s.course?.name}</td>
                                <td style={{ fontSize: '0.85rem' }}>{formatDays(s.days)}</td>
                                <td style={{ direction: 'ltr', fontSize: '0.82rem' }}>{s.startTime} – {s.endTime}</td>
                                <td style={{ fontSize: '0.85rem' }}>
                                  <div>{s.room?.name}</div>
                                  <LearningTypeBadge value={s.room?.learningType} style={{ marginTop: 2 }} />
                                </td>
                                <td>
                                  <span className="badge primary">
                                    <Users size={12}/> {s.students?.length || 0}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${s.status === 'OPEN' ? 'success' : 'secondary'}`}>
                                    {s.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </div>
              </div>
            )}

            {/* ═══ ATTENDANCE TAB ═══ */}
            {tab === 'attendance' && (
              <div className="portal-section">
                <div className="glass-panel">
                  <div className="grid-2" style={{ gap: 16 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">الشعبة <span className="required-star">*</span></label>
                      <div style={{ position: 'relative' }}>
                        <select className="glass-input" value={selSection} onChange={e => setSelSection(e.target.value)} style={{ paddingLeft: 36 }}>
                          <option value="">-- اختر الشعبة --</option>
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.course?.name} ({formatDays(s.days)} {s.startTime})</option>
                          ))}
                        </select>
                        <ChevronDown size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}/>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">التاريخ</label>
                      <input type="date" className="glass-input" value={date} onChange={e => setDate(e.target.value)}/>
                    </div>
                  </div>
                </div>

                {!selSection && (
                  <div className="glass-panel empty-state">
                    <UserCheck size={42}/><p>اختر الشعبة لتسجيل الحضور</p>
                  </div>
                )}

                {selSection && loadingAtt && (
                  <div className="glass-panel empty-state">
                    <RefreshCw size={32} className="spin"/><p>جارٍ التحميل...</p>
                  </div>
                )}

                {selSection && !loadingAtt && students.length > 0 && (
                  <>
                    <div className="grid-4">
                      {[
                        { label: 'الإجمالي', value: students.length, color: 'blue' },
                        { label: 'حاضر', value: presentCount, color: 'green' },
                        { label: 'غائب', value: absentCount, color: 'purple' },
                        { label: 'نسبة الحضور', value: `${students.length > 0 ? Math.round(presentCount / students.length * 100) : 0}%`, color: 'amber' },
                      ].map(c => (
                        <div key={c.label} className={`stat-card ${c.color}`}>
                          <div className="stat-label">{c.label}</div>
                          <div className="stat-value">{c.value}</div>
                        </div>
                      ))}
                    </div>

                    {saved && <div className="alert success"><CheckCircle size={16}/> تم حفظ الحضور بنجاح!</div>}

                    <div className="glass-table-container">
                      <table className="glass-table">
                        <thead>
                          <tr>
                            <th>#</th><th>الطالب</th>
                            {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttStatus[]).map(s => (
                              <th key={s} style={{ textAlign: 'center', minWidth: 70 }}>
                                <span className={`badge ${s === 'PRESENT' ? 'success' : s === 'ABSENT' ? 'danger' : s === 'LATE' ? 'warning' : 'primary'}`}>
                                  {statusConfig[s].label}
                                </span>
                              </th>
                            ))}
                            <th>ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((st, idx) => {
                            const cur = statuses[st.id] || 'PRESENT';
                            return (
                              <tr key={st.id}>
                                <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <div className="profile-avatar-sm">{st.fullName?.charAt(0)}</div>
                                    <span style={{ fontWeight: 600 }}>{st.fullName}</span>
                                  </div>
                                </td>
                                {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttStatus[]).map(s => (
                                  <td key={s} style={{ textAlign: 'center' }}>
                                    <input type="radio" name={`att-${st.id}`} checked={cur === s}
                                      onChange={() => setStatuses(p => ({ ...p, [st.id]: s }))}
                                      style={{ width: 18, height: 18, accentColor: statusConfig[s].color, cursor: 'pointer' }}
                                    />
                                  </td>
                                ))}
                                <td>
                                  <input type="text" className="glass-input" placeholder="ملاحظة..."
                                    value={notes[st.id] || ''}
                                    onChange={e => setNotes(p => ({ ...p, [st.id]: e.target.value }))}
                                    style={{ padding: '6px 10px', fontSize: '0.82rem', width: 120 }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="glass-btn lg" onClick={handleSave} disabled={saving}>
                        {saving ? <RefreshCw size={18} className="spin"/> : <Save size={18}/>}
                        {saving ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
                      </button>
                      <button className="glass-btn secondary" onClick={() => loadAttendance(selSection, date)}>
                        <RefreshCw size={16}/> تحديث
                      </button>
                    </div>
                  </>
                )}

                {selSection && !loadingAtt && students.length === 0 && (
                  <div className="glass-panel empty-state"><Users size={36}/><p>لا يوجد طلاب في هذه الشعبة</p></div>
                )}
              </div>
            )}

            {/* ═══ GRADES TAB ═══ */}
            {tab === 'grades' && (
              <div className="portal-section">
                <div className="glass-panel">
                  <h4 className="panel-title"><FileText size={18} className="text-primary"/> إدخال العلامات</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    مقياس العلامات: امتحان منتصف الفصل (30) + المشاركة (20) + الامتحان النهائي (50) = 100 درجة. النجاح من {PASS_THRESHOLD} درجة.
                  </p>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">الشعبة <span className="required-star">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <select className="glass-input" value={selSecGrades} onChange={e => setSelSecGrades(e.target.value)} style={{ paddingLeft: 36 }}>
                        <option value="">-- اختر الشعبة --</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.course?.name} ({formatDays(s.days)} {s.startTime})</option>
                        ))}
                      </select>
                      <ChevronDown size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}/>
                    </div>
                  </div>
                </div>

                {!selSecGrades && (
                  <div className="glass-panel empty-state">
                    <BookOpen size={42}/><p>اختر الشعبة لعرض العلامات</p>
                  </div>
                )}

                {selSecGrades && loadingGrades && (
                  <div className="glass-panel empty-state">
                    <RefreshCw size={32} className="spin"/><p>جارٍ التحميل...</p>
                  </div>
                )}

                {selSecGrades && !loadingGrades && gradeStudents.length > 0 && (
                  <>
                    {(() => {
                      const graded = gradeStudents.filter(st => {
                        const g = gradeData[st.id];
                        return g && (g.grade !== null || g.isProject || g.supervisorApproved);
                      });
                      const pass = gradeStudents.filter(st => {
                        const g = gradeData[st.id];
                        const r = getResult(g);
                        return r === 'PASS';
                      });
                      const fail = gradeStudents.filter(st => {
                        const g = gradeData[st.id];
                        const r = getResult(g);
                        return r === 'FAIL';
                      });
                      return (
                        <div className="grid-4">
                          <div className="stat-card blue"><div className="stat-label">المسجلون</div><div className="stat-value">{gradeStudents.length}</div></div>
                          <div className="stat-card green"><div className="stat-label">تم التقييم</div><div className="stat-value">{graded.length}</div></div>
                          <div className="stat-card purple"><div className="stat-label">ناجح</div><div className="stat-value">{pass.length}</div></div>
                          <div className="stat-card amber"><div className="stat-label">راسب</div><div className="stat-value">{fail.length}</div></div>
                        </div>
                      );
                    })()}

                    {gradesSaved && <div className="alert success"><CheckCircle size={16}/> تم حفظ العلامات بنجاح!</div>}

                    <div className="glass-table-container">
                      <table className="glass-table">
                        <thead>
                          <tr>
                            <th>#</th><th>الطالب</th>
                            <th style={{ textAlign: 'center' }}>العلامة (0-100)</th>
                            <th style={{ textAlign: 'center' }}>تسليم مشروع</th>
                            <th style={{ textAlign: 'center' }}>النتيجة</th>
                            <th style={{ textAlign: 'center' }}>اعتماد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gradeStudents.map((st, idx) => {
                            const g = gradeData[st.id] || { grade: null, isProject: false, projectResult: null, supervisorApproved: false };
                            const result = getResult(g);
                            return (
                              <tr key={st.id}>
                                <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <div className="profile-avatar-sm">{(st.student?.fullNameAr || st.fullName || '?')?.charAt(0)}</div>
                                    <span style={{ fontWeight: 600 }}>{st.student?.fullNameAr || st.fullName || '—'}</span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input type="number" className="glass-input" min={0} step="1"
                                    value={g.isProject ? '' : (g.grade ?? '')} style={{ width: 80, padding: '6px 10px', fontSize: '0.82rem', textAlign: 'center' }}
                                    placeholder={g.isProject ? 'مشروع' : 'العلامة'}
                                    disabled={g.isProject}
                                    onChange={e => {
                                      const v = e.target.value ? parseFloat(e.target.value) : null;
                                      if (v !== null) {
                                        setGradeData(p => ({ ...p, [st.id]: { ...p[st.id], grade: Math.max(0, v), isProject: false, projectResult: null } }));
                                      } else {
                                        setGradeData(p => ({ ...p, [st.id]: { ...p[st.id], grade: null } }));
                                      }
                                    }}/>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <input type="checkbox"
                                      checked={g.isProject}
                                      onChange={e => {
                                        const checked = e.target.checked;
                                        setGradeData(p => ({ ...p, [st.id]: { grade: null, isProject: checked, projectResult: checked ? (p[st.id]?.projectResult ?? null) : null, supervisorApproved: p[st.id]?.supervisorApproved ?? false } }));
                                      }}
                                      style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                    />
                                    {g.isProject && (
                                      <select className="glass-input" style={{ width: 80, padding: '4px 4px', fontSize: '0.78rem' }}
                                        value={g.projectResult ?? ''}
                                        onChange={e => setGradeData(p => ({ ...p, [st.id]: { ...p[st.id], projectResult: e.target.value || null, grade: null } }))}>
                                        <option value="">اختر</option>
                                        <option value="PASS">ناجح</option>
                                        <option value="FAIL">راسب</option>
                                      </select>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`badge ${!result ? 'secondary' : result === 'PASS' ? 'success' : 'danger'}`}>
                                    {!result ? '—' : result === 'PASS' ? 'ناجح' : 'راسب'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="checkbox"
                                      checked={g.supervisorApproved}
                                      onChange={e => setGradeData(p => ({ ...p, [st.id]: { ...p[st.id], supervisorApproved: e.target.checked } }))}
                                      style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.78rem', color: g.supervisorApproved ? 'var(--success)' : 'var(--text-muted)' }}>
                                      {g.supervisorApproved ? 'معتمد' : 'غير معتمد'}
                                    </span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="glass-btn lg" onClick={handleSaveGrades} disabled={savingGrades}>
                        {savingGrades ? <RefreshCw size={18} className="spin"/> : <Save size={18}/>}
                        {savingGrades ? 'جارٍ الحفظ...' : 'حفظ العلامات'}
                      </button>
                      <button className="glass-btn secondary" onClick={() => loadGrades(selSecGrades)}>
                        <RefreshCw size={16}/> تحديث
                      </button>
                      <button className="glass-btn secondary" onClick={handleDownloadGrades} disabled={gradeStudents.length === 0} style={{ marginRight: 'auto' }}>
                        <Download size={16}/> تنزيل العلامات CSV
                      </button>
                      <button className="glass-btn secondary" onClick={handleDownloadAllGrades}>
                        <Download size={16}/> تنزيل الكل
                      </button>
                    </div>
                  </>
                )}

                {selSecGrades && !loadingGrades && gradeStudents.length === 0 && (
                  <div className="glass-panel empty-state"><Users size={36}/><p>لا يوجد طلاب في هذه الشعبة</p></div>
                )}
              </div>
            )}

            {/* ═══ PROFILE TAB ═══ */}
            {tab === 'profile' && (
              <div className="portal-section">
                <div className="glass-panel">
                  <div className="profile-header">
                    <div className="profile-avatar-lg">{(instructorData?.name || user?.fullName)?.charAt(0) || '؟'}</div>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>{instructorData?.name || user?.fullName}</h3>
                      <span className="badge teal">محاضر</span>
                    </div>
                  </div>
                  <div className="divider"/>
                  {[
                    { label: 'اسم المستخدم',  value: user?.username },
                    { label: 'الاسم الكامل', value: instructorData?.name || user?.fullName },
                    { label: 'رقم الهاتف',   value: instructorData?.phone || '—' },
                    { label: 'التخصص',       value: instructorData?.specialization || '—' },
                    { label: 'عدد الشعب',    value: sections.length },
                  ].map(({ label, value }) => (
                    <div key={label} className="info-row">
                      <span className="label">{label}</span>
                      <span className="value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
