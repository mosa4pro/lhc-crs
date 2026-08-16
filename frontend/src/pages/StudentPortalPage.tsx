import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, Calendar, UserCheck, DollarSign, User,
  LogOut, CheckCircle, XCircle, Clock, AlertCircle,
  Sun, Moon, BookOpen, FileText, Layers, Menu, X, Copy, Check, ChevronDown, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LearningTypeBadge } from '../components/LearningTypeBadge';
import { formatDate } from '../utils/dateFormat';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = API_BASE + '/api';

type Tab = 'schedule' | 'attendance' | 'payments' | 'grades' | 'profile' | 'subscriptions';

const DAY_LABELS: Record<string, string> = {
  SAT: 'السبت', SUN: 'الأحد', MON: 'الاثنين',
  TUE: 'الثلاثاء', WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة',
};
const DAYS_ORDER = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

const attStatus = {
  PRESENT: { label: 'حاضر',  cls: 'success', Icon: CheckCircle },
  ABSENT:  { label: 'غائب',  cls: 'danger',  Icon: XCircle    },
  LATE:    { label: 'متأخر', cls: 'warning', Icon: Clock       },
  EXCUSED: { label: 'معذور', cls: 'primary', Icon: AlertCircle },
};

const NAV_ITEMS: { key: Tab; label: string; Icon: any }[] = [
  { key: 'schedule',      label: 'الجدول',     Icon: Calendar    },
  { key: 'subscriptions', label: 'الاشتراكات', Icon: Layers      },
  { key: 'attendance',    label: 'الحضور',     Icon: UserCheck   },
  { key: 'payments',      label: 'الدفعات',    Icon: DollarSign  },
  { key: 'grades',        label: 'العلامات',   Icon: FileText    },
  { key: 'profile',       label: 'معلوماتي',    Icon: User        },
];

export const StudentPortalPage = () => {
  const { user, token, logout, centerName, centerLogo } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('schedule');
  const [studentData, setStudentData] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attSectionId, setAttSectionId] = useState('');
  const [gradesTab, setGradesTab] = useState(false);
  const [gradeSections, setGradeSections] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const full = await fetch(`${API}/students/me`, { headers });
        if (!full.ok) return;
        const student = await full.json();
        setStudentData(student);
        const pRes = await fetch(`${API}/financial/me`, { headers });
        if (pRes.ok) {
          const fin = await pRes.json();
          setPayments(fin.transactions || []);
        }
      } catch { }
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!attSectionId || !studentData) return;
    fetch(`${API}/attendance/me?sectionId=${attSectionId}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setAttendanceRecords)
      .catch(() => { });
  }, [attSectionId, studentData]);

  useEffect(() => {
    if (tab !== 'grades' || !studentData || gradesTab) return;
    fetch(`${API}/grades/me`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const all = data || [];
        setGradeSections(all.filter((g: any) => g.supervisorApproved === true));
        setGradesTab(true);
      })
      .catch(() => setGradesTab(true));
  }, [tab, studentData, gradesTab]);

  const scheduleGrid: Record<string, Record<string, any[]>> = {};
  DAYS_ORDER.forEach(d => { scheduleGrid[d] = {}; TIME_SLOTS.forEach(t => { scheduleGrid[d][t] = []; }); });
  (studentData?.sections || []).filter((ss: any) => ss.status === 'ENROLLED').forEach((ss: any) => {
    try {
      const days: string[] = JSON.parse(ss.section?.days || '[]');
      days.forEach(d => {
        if (scheduleGrid[d]) TIME_SLOTS.forEach(slot => {
          if (slot >= ss.section.startTime && slot < ss.section.endTime) scheduleGrid[d][slot].push(ss);
        });
      });
    } catch { }
  });

  const enrolledSections = (studentData?.sections || []).filter((ss: any) => ss.status === 'ENROLLED');

  const allTabs = ['schedule', 'attendance', 'payments', 'grades', 'subscriptions', 'profile'] as Tab[];
  const visibleTabs = user?.portalTabs?.length
    ? allTabs.filter(t => t === 'profile' || user.portalTabs!.includes(t))
    : allTabs;

  const getPhone = (phones: any) => {
    try { return (typeof phones === 'string' ? JSON.parse(phones) : phones)?.[0] || '—'; }
    catch { return '—'; }
  };
  const handleLogout = () => { logout(); };
  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(studentData?.id || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', backgroundAttachment: 'fixed', direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>

      {/* ═══════ TOP BAR ═══════ */}
      <header style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
        color: '#fff', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', maxWidth: 1100, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {centerLogo
              ? <img src={centerLogo} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
              : <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={18} /></div>
            }
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>{centerName}</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>بوابة الطالب</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggleTheme}
              style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.12)' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>{user?.fullName?.charAt(0)}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{user?.fullName}</div>
              </div>
              <button onClick={handleLogout}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut size={14} />
              </button>
            </div>
            <div className="mobile-only" style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setMenuOpen(!menuOpen)}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {menuOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ padding: '8px 16px 14px', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{user?.fullName?.charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user?.fullName}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{centerName}</div>
              </div>
            </div>
            <button onClick={() => { handleLogout(); setMenuOpen(false); }}
              style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
              <LogOut size={13} style={{ verticalAlign: 'middle' }} /> تسجيل الخروج
            </button>
          </div>
        )}

        {/* ═══════ CREDENTIALS BAR ═══════ */}
        {studentData && (
          <div style={{ background: 'rgba(0,0,0,0.08)', padding: '8px 16px' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', opacity: 0.85 }}>
                  <Shield size={12} /> اسم المستخدم:
                </div>
                <code style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 6, fontSize: '0.82rem', fontWeight: 700, direction: 'ltr', display: 'inline-block' }}>
                  {studentData.id}
                </code>
                <button onClick={copyUsername}
                  style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', padding: '3px 8px', borderRadius: 6, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'تم' : 'نسخ'}
                </button>
              </div>
              <button onClick={() => setShowCreds(!showCreds)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown size={12} style={{ transform: showCreds ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                معلومات الحساب
              </button>
            </div>

            {/* Expandable credential card */}
            {showCreds && (
              <div style={{ maxWidth: 1100, margin: '8px auto 0', background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 20px', direction: 'rtl' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 2 }}>الاسم</div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{studentData.fullNameAr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 2 }}>اسم المستخدم</div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace', direction: 'ltr' }}>{studentData.id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 2 }}>حالة الحساب</div>
                    <span style={{ background: 'rgba(16,185,129,0.3)', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>نشط</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 2 }}>رقم النظام</div>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem', fontFamily: 'monospace', direction: 'ltr' }}>#{studentData.id}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: '0.7rem', opacity: 0.6, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                  تم إصدار الحساب في تاريخ التسجيل. يمكنك نسخ اسم المستخدم أعلاه لتسجيل الدخول.
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ═══════ HORIZONTAL NAV BAR ═══════ */}
      <div ref={tabsRef} style={{
        background: 'var(--glass-bg)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky', top: 0, zIndex: 99,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 2,
          overflowX: 'auto', overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        }}>
          {NAV_ITEMS.filter(n => visibleTabs.includes(n.key)).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                flex: '1 0 auto', whiteSpace: 'nowrap', cursor: 'pointer',
                padding: '10px 18px', fontSize: 'clamp(0.72rem, 2vw, 0.88rem)',
                fontWeight: tab === key ? 700 : 500,
                border: 'none', borderBottom: tab === key ? '3px solid var(--primary)' : '3px solid transparent',
                background: 'transparent', color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ CONTENT ═══════ */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(12px, 2vw, 24px) clamp(10px, 2vw, 20px)' }}>

        {loading && (
          <div className="glass-panel empty-state" style={{ marginTop: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p>جارٍ تحميل بياناتك...</p>
          </div>
        )}

        {!loading && !studentData && (
          <div className="glass-panel empty-state" style={{ marginTop: 20 }}>
            <GraduationCap size={48} />
            <p>لم يتم ربط حسابك ببيانات طالب. يرجى التواصل مع الإدارة.</p>
          </div>
        )}

        {!loading && studentData && (
          <>
            {/* ═══ SCHEDULE ═══ */}
            {tab === 'schedule' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'clamp(8px, 1.5vw, 16px)' }}>
                  {[
                    { label: 'الشعب المسجّلة', value: enrolledSections.length, color: 'blue' },
                    { label: 'الدبلومات', value: (studentData?.diplomaSubscriptions || []).length, color: 'purple' },
                    { label: 'الدورات', value: (studentData?.courseSubscriptions || []).length, color: 'green' },
                    { label: 'المحاضرات', value: enrolledSections.length * 2, color: 'amber' },
                  ].map(c => (
                    <div key={c.label} className={`stat-card ${c.color}`} style={{ padding: 'clamp(10px, 1.5vw, 16px)' }}>
                      <div className="stat-label" style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.82rem)' }}>{c.label}</div>
                      <div className="stat-value" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)' }}>{c.value}</div>
                    </div>
                  ))}
                </div>

                <div className="glass-panel">
                  <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                    <Calendar size={18} className="text-primary" /> الجدول الأسبوعي
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 10px', background: 'var(--table-header)', border: '1px solid var(--table-border)', width: 60, fontSize: '0.78rem', color: 'var(--text-muted)' }}>الوقت</th>
                          {DAYS_ORDER.map(d => <th key={d} style={{ padding: '8px 10px', background: 'var(--table-header)', border: '1px solid var(--table-border)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{DAY_LABELS[d]}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {TIME_SLOTS.slice(0, -1).map(slot => (
                          <tr key={slot}>
                            <td style={{ padding: '5px 8px', border: '1px solid var(--table-border)', fontSize: '0.75rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'center', background: 'var(--card-bg)' }}>{slot}</td>
                            {DAYS_ORDER.map(d => {
                              const sessions = scheduleGrid[d][slot];
                              return (
                                <td key={d} style={{ padding: '3px', border: '1px solid var(--table-border)', height: 38, minWidth: 80 }}>
                                  {sessions.map((ss: any) => (
                                    <div key={ss.id} style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 6, padding: '2px 5px', fontSize: '0.7rem', fontWeight: 700 }}>
                                      {ss.section?.course?.name?.substring(0, 14)}
                                    </div>
                                  ))}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="glass-panel">
                  <h4 style={{ marginBottom: 16, fontSize: '0.95rem' }}>
                    <BookOpen size={18} className="text-secondary" style={{ verticalAlign: 'middle' }} /> المواد المسجّلة
                  </h4>
                  {enrolledSections.length === 0
                    ? <div className="empty-state"><BookOpen size={36} /><p>لا توجد مواد مسجّلة بعد</p></div>
                    : <div className="glass-table-container">
                      <table className="glass-table">
                        <thead><tr><th>المادة</th><th>المحاضر</th><th>الأيام</th><th>الوقت</th><th>القاعة</th><th>الحالة</th></tr></thead>
                        <tbody>
                          {enrolledSections.map((ss: any) => {
                            const days = JSON.parse(ss.section?.days || '[]') as string[];
                            return (
                              <tr key={ss.id}>
                                <td style={{ fontWeight: 700 }}>{ss.section?.course?.name}</td>
                                <td style={{ fontSize: '0.85rem' }}>{ss.section?.instructor?.name}</td>
                                <td style={{ fontSize: '0.82rem' }}>{days.map(d => DAY_LABELS[d]).join('، ')}</td>
                                <td style={{ direction: 'ltr', fontSize: '0.82rem' }}>{ss.section?.startTime} – {ss.section?.endTime}</td>
                                <td style={{ fontSize: '0.82rem' }}>
                                  <div>{ss.section?.room?.name}</div>
                                  <LearningTypeBadge room={ss.section?.room} style={{ marginTop: 2 }} />
                                </td>
                                <td><span className="badge success">مسجّل</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              </div>
            )}

            {/* ═══ ATTENDANCE ═══ */}
            {tab === 'attendance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                <div className="glass-panel" style={{ padding: '20px 24px' }}>
                  <label className="form-label">اختر المادة لعرض سجل الحضور</label>
                  <select className="glass-input" value={attSectionId} onChange={e => setAttSectionId(e.target.value)}>
                    <option value="">-- اختر المادة --</option>
                    {enrolledSections.map((ss: any) => (
                      <option key={ss.sectionId || ss.section?.id} value={ss.sectionId || ss.section?.id}>
                        {ss.section?.course?.name} — {ss.section?.instructor?.name}
                      </option>
                    ))}
                  </select>
                </div>

                {attSectionId && (
                  <>
                    {(() => {
                      const present = attendanceRecords.filter(r => r.status === 'PRESENT').length;
                      const absent = attendanceRecords.filter(r => r.status === 'ABSENT').length;
                      const late = attendanceRecords.filter(r => r.status === 'LATE').length;
                      const total = attendanceRecords.length;
                      const pct = total > 0 ? Math.round((present + late) / total * 100) : 0;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                          {[
                            { label: 'إجمالي', value: total, color: 'blue' },
                            { label: 'حاضر', value: present, color: 'green' },
                            { label: 'غائب', value: absent, color: 'purple' },
                            { label: 'نسبة الحضور', value: `${pct}%`, color: 'amber' },
                          ].map(c => (
                            <div key={c.label} className={`stat-card ${c.color}`} style={{ padding: '10px 12px' }}>
                              <div className="stat-label" style={{ fontSize: '0.7rem' }}>{c.label}</div>
                              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{c.value}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="glass-table-container">
                      <table className="glass-table">
                        <thead><tr><th>#</th><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
                        <tbody>
                          {attendanceRecords.length === 0
                            ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>لا توجد سجلات حضور</td></tr>
                            : attendanceRecords.map((r, i) => {
                              const cfg = attStatus[r.status as keyof typeof attStatus] || attStatus.ABSENT;
                              return (
                                <tr key={r.id}>
                                  <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                  <td>{formatDate(r.date)}</td>
                                  <td><span className={`badge ${cfg.cls}`}><cfg.Icon size={12} /> {cfg.label}</span></td>
                                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.notes || '—'}</td>
                                </tr>
                              );
                            })
                          }
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {!attSectionId && (
                  <div className="glass-panel empty-state">
                    <UserCheck size={42} />
                    <p>اختر المادة لعرض سجل حضورك</p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ PAYMENTS ═══ */}
            {tab === 'payments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                <div className="glass-panel">
                  <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                    <DollarSign size={18} className="text-success" /> سجل الدفعات
                  </h4>
                  {payments.length === 0
                    ? <div className="empty-state"><DollarSign size={36} /><p>لا توجد معاملات مالية مسجّلة</p></div>
                    : <div className="glass-table-container">
                      <table className="glass-table">
                        <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الوصف</th><th>الحالة</th></tr></thead>
                        <tbody>
                          {payments.map((p: any, i) => (
                            <tr key={p.id || i}>
                              <td>{formatDate(p.date || p.createdAt)}</td>
                              <td><span className="badge primary">{p.type || 'دفعة'}</span></td>
                              <td style={{ fontWeight: 700, color: 'var(--success)' }}>{Number(p.amount || 0).toLocaleString()} د.أ</td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.description || p.notes || '—'}</td>
                              <td><span className="badge success">مؤكّد</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                </div>

                {(studentData?.installments || []).length > 0 && (
                  <div className="glass-panel">
                    <h4 style={{ marginBottom: 16, fontSize: '0.95rem' }}>📅 الأقساط القادمة</h4>
                    <div className="glass-table-container">
                      <table className="glass-table">
                        <thead><tr><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th></tr></thead>
                        <tbody>
                          {studentData.installments.map((inst: any) => (
                            <tr key={inst.id}>
                              <td>{formatDate(inst.dueDate)}</td>
                              <td style={{ fontWeight: 700 }}>{Number(inst.amount).toLocaleString()} د.أ</td>
                              <td>
                                <span className={`badge ${inst.status === 'PAID' ? 'success' : inst.status === 'OVERDUE' ? 'danger' : 'warning'}`}>
                                  {inst.status === 'PAID' ? 'مدفوع' : inst.status === 'OVERDUE' ? 'متأخر' : 'قادم'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ SUBSCRIPTIONS ═══ */}
            {tab === 'subscriptions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                <div className="glass-panel">
                  <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                    <Layers size={18} className="text-primary" /> الاشتراكات
                  </h4>
                  <div className="glass-table-container">
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>المادة/الدبلوم</th>
                          <th>النوع</th>
                          <th>الحالة</th>
                          <th>تاريخ التسجيل</th>
                          <th>الشهادة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(studentData?.sections || []).length === 0 ? (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>لا توجد اشتراكات</td></tr>
                        ) : (studentData?.sections || []).map((ss: any, i: number) => (
                          <tr key={ss.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{ss.section?.course?.name || ss.courseName || '—'}</td>
                            <td><span className="badge primary">{ss.section?.type === 'DIPLOMA' ? 'دبلوم' : 'مادة'}</span></td>
                            <td>
                              <span className={`badge ${ss.status === 'ENROLLED' ? 'success' : ss.status === 'COMPLETED' ? 'primary' : ss.status === 'CANCELED' ? 'danger' : 'warning'}`}>
                                {ss.status === 'ENROLLED' ? 'ملتحق' : ss.status === 'COMPLETED' ? 'مكتمل' : ss.status === 'CANCELED' ? 'ملغي' : ss.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>{formatDate(ss.createdAt)}</td>
                            <td>
                              {ss.status === 'COMPLETED' && ss.result === 'PASS' ? (
                                <span className="badge success">مؤهل</span>
                              ) : ss.status === 'COMPLETED' ? (
                                <span className="badge danger">غير مؤهل</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ GRADES ═══ */}
            {tab === 'grades' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                {!gradesTab ? (
                  <div className="glass-panel empty-state">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                    <p>جارٍ تحميل العلامات...</p>
                  </div>
                ) : gradeSections.length === 0 ? (
                  <div className="glass-panel empty-state">
                    <FileText size={42} />
                    <p>لا توجد علامات بعد</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                      {(() => {
                        const withResult = (g: any) => {
                          if (g.isProject) return g.result;
                          if (g.grade !== null && g.grade !== undefined) return g.grade >= 50 ? 'PASS' : 'FAIL';
                          return null;
                        };
                        const passed = gradeSections.filter((g: any) => withResult(g) === 'PASS').length;
                        const failed = gradeSections.filter((g: any) => withResult(g) === 'FAIL').length;
                        const totalSum = gradeSections.reduce((s: number, g: any) => {
                          if (g.isProject) return s;
                          return s + (g.grade ?? 0);
                        }, 0);
                        const graded = gradeSections.filter((g: any) => !g.isProject && g.grade !== null && g.grade !== undefined).length;
                        const avg = graded > 0 ? Math.round(totalSum / graded) : 0;
                        return [
                          { label: 'عدد المواد', value: gradeSections.length, color: 'blue' },
                          { label: 'ناجح', value: passed, color: 'green' },
                          { label: 'راسب', value: failed, color: 'purple' },
                          { label: 'المعدل', value: avg, color: 'amber' },
                        ];
                      })().map(c => (
                        <div key={c.label} className={`stat-card ${c.color}`} style={{ padding: '10px 12px' }}>
                          <div className="stat-label" style={{ fontSize: '0.7rem' }}>{c.label}</div>
                          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{c.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="glass-panel">
                      <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                        <FileText size={18} className="text-primary" /> سجل العلامات
                      </h4>
                      <div className="glass-table-container">
                        <table className="glass-table">
                          <thead>
                            <tr>
                              <th>المادة</th>
                              <th>العلامة</th>
                              <th>نوع التقييم</th>
                              <th>النتيجة</th>
                              <th>الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gradeSections.map((g: any) => {
                              const result = g.isProject ? g.result :
                                (g.grade !== null && g.grade !== undefined ? (g.grade >= 50 ? 'PASS' : 'FAIL') : null);
                              return (
                                <tr key={g.id}>
                                  <td style={{ fontWeight: 700 }}>{g.section?.course?.name || g.courseName || '—'}</td>
                                  <td>{g.isProject ? '—' : (g.grade ?? '—')}</td>
                                  <td>{g.isProject ? 'تسليم مشروع' : 'امتحان'}</td>
                                  <td>
                                    <span className={`badge ${!result ? 'secondary' : result === 'PASS' ? 'success' : 'danger'}`}>
                                      {!result ? '—' : result === 'PASS' ? 'ناجح' : 'راسب'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge ${g.status === 'COMPLETED' ? 'success' : 'warning'}`}>
                                      {g.status === 'COMPLETED' ? 'مكتمل' : 'قيد التنفيذ'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ PROFILE ═══ */}
            {tab === 'profile' && (
              <div className="glass-panel" style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                  <div className="profile-avatar" style={{ width: 72, height: 72, fontSize: '2rem', borderRadius: 20, boxShadow: '0 8px 24px rgba(59,130,246,0.2)' }}>
                    {studentData.fullNameAr?.charAt(0) || '؟'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>{studentData.fullNameAr}</h3>
                    {studentData.fullNameEn && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 6 }}>{studentData.fullNameEn}</div>}
                    <span className="badge success">🎓 طالب نشط</span>
                  </div>
                </div>

                {/* Account credentials card */}
                <div style={{
                  background: 'var(--primary-light)', borderRadius: 14, padding: '14px 18px',
                  marginBottom: 20, border: '1px solid var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={20} className="text-primary" />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>اسم المستخدم (لتسجيل الدخول)</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'monospace', direction: 'ltr', color: 'var(--primary)' }}>
                        {studentData.id}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={copyUsername} className="glass-btn secondary sm" style={{ fontSize: '0.75rem' }}>
                      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>
                </div>

                <div className="divider" />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px 24px' }}>
                  {[
                    { label: 'رقم النظام', value: studentData.id },
                    { label: 'الرقم الوطني', value: studentData.nationalId || '—' },
                    { label: 'الجنسية', value: studentData.nationality === 'JO' ? '🇯🇴 أردني' : '🌍 غير أردني' },
                    { label: 'الجنس', value: studentData.gender === 'MALE' ? '👨 ذكر' : studentData.gender === 'FEMALE' ? '👩 أنثى' : '—' },
                    { label: 'تاريخ الميلاد', value: formatDate(studentData.dob) },
                    { label: 'رقم الهاتف', value: `0${getPhone(studentData.phones)}` },
                    { label: 'البريد الإلكتروني', value: studentData.email || '—' },
                    { label: 'المؤهل العلمي', value: studentData.education || '—' },
                    { label: 'المهنة', value: studentData.job || '—' },
                    { label: 'تاريخ التسجيل', value: formatDate(studentData.createdAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="info-row" style={{ borderBottom: '1px solid var(--table-border)', padding: '8px 0' }}>
                      <span className="label" style={{ fontSize: '0.8rem' }}>{label}</span>
                      <span className="value" style={{ fontSize: '0.85rem' }}>{value || '—'}</span>
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
