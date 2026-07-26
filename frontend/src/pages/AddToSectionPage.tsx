import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck, Users, Search, Plus, X, BookOpen, Clock, AlertCircle, AlertTriangle, RefreshCw, ChevronLeft, Loader2 } from 'lucide-react';
import { useApi } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DeepSearchModal } from '../components/DeepSearchModal';
import { DIPLOMA_CATEGORIES } from '../utils/constants';


const dayLabels: Record<string, string> = { SUN: 'الأحد', MON: 'الاثنين', TUE: 'الثلاثاء', WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة', SAT: 'السبت' };
const dayOrder = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];

type Tab = 'section-first' | 'student-first' | 'transfer';

export const AddToSectionPage = () => {
  const { apiFetch } = useApi();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('section-first');

  // ── Section-first state ──
  const [entities, setEntities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [statusFilter, setStatusFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sections, setSections] = useState<any[]>([]);
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]); // full student objects from subscriptions

  // Hierarchical filter
  type HierMode = 'DIPLOMA' | 'COURSE';
  const [hierMode, setHierMode] = useState<HierMode>('DIPLOMA');

  const [diplomaList, setDiplomaList] = useState<any[]>([]);
  const [courseList, setCourseList] = useState<any[]>([]);
  const [courseCategories, setCourseCategories] = useState<any[]>([]);
  const [hSectionList, setHSectionList] = useState<any[]>([]);
  const [hLoading, setHLoading] = useState(false);
  // Diploma path
  const [hDipCat, setHDipCat] = useState('');
  const [hDip, setHDip] = useState('');
  const [hDCrsCat, setHDCrsCat] = useState('');
  const [hDCrs, setHDCrs] = useState('');
  const [hDSec, setHDSec] = useState('');
  // Course path
  const [hCCrsCat, setHCCrsCat] = useState('');
  const [hCCrs, setHCCrs] = useState('');
  const [hCSec, setHCSec] = useState('');

  // ── Expandable schedule in non-enrolled list ──
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentSchedule, setStudentSchedule] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const toggleSchedule = async (studentId: string) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
      setStudentSchedule([]);
      return;
    }
    setExpandedStudent(studentId);
    setStudentSchedule([]);
    setScheduleLoading(true);
    try {
      const data = await apiFetch(`/sections/students/${studentId}/enrolled-sections`);
      setStudentSchedule(Array.isArray(data) ? data : []);
    } catch {
      setStudentSchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Student-first state ──
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentSections, setStudentSections] = useState<any[]>([]);
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  const [transferLog, setTransferLog] = useState<any[]>([]);
  const [isDeepOpen, setIsDeepOpen] = useState(false);
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);

  // ── Transfer tab state ──
  const [trStudent, setTrStudent] = useState<any | null>(null);
  const [trEnrolled, setTrEnrolled] = useState<any[]>([]);
  const [trAvail, setTrAvail] = useState<any[]>([]);
  const [trSearch, setTrSearch] = useState('');
  const [trResults, setTrResults] = useState<any[] | null>(null);
  const [trLoading, setTrLoading] = useState<number | null>(null); // sectionId being transferred
  const [trIsDeepOpen, setTrIsDeepOpen] = useState(false);
  const [trModalSection, setTrModalSection] = useState<any | null>(null);
  const [trTargetId, setTrTargetId] = useState<number | null>(null);

  // Initial data load
  useEffect(() => {
    Promise.all([
      apiFetch('/educational-entities'),
      apiFetch('/courses/categories'),
    ]).then(([ents, cats]) => {
      setEntities(Array.isArray(ents) ? ents : []);
      setCategories(Array.isArray(cats) ? cats : []);
    }).catch(console.error);
    // Load hierarchy data
    Promise.all([
      apiFetch('/diplomas').catch(() => []),
      apiFetch('/courses').catch(() => []),
      apiFetch('/courses/categories').catch(() => []),
    ]).then(([dips, crs, cats2]) => {
      const dl = Array.isArray(dips) ? dips : dips?.data || [];
      const cl = Array.isArray(crs) ? crs : crs?.data || [];
      const cc = Array.isArray(cats2) ? cats2 : cats2?.data || [];
      setDiplomaList(dl);
      setCourseList(cl);
      setCourseCategories(cc);

    }).catch(console.error);
  }, []);

  // ── Section-first logic ──
  const fetchSections = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (entityFilter) params.set('entityId', entityFilter);
    if (categoryFilter) params.set('categoryId', categoryFilter);
    const qs = params.toString();
    const secs = await apiFetch(`/sections${qs ? '?' + qs : ''}`);
    setSections(Array.isArray(secs) ? secs : []);
  }, [statusFilter, entityFilter, categoryFilter, apiFetch]);

  useEffect(() => { if (tab === 'section-first') fetchSections(); }, [tab, fetchSections]);

  useEffect(() => {
    if (!selectedSection) { setEligibleStudents([]); return; }
    const sec = [...sections, ...hSectionList].find(s => String(s.id) === selectedSection);
    if (!sec?.courseId) return;
    let url = `/subscriptions/eligible-students?courseId=${sec.courseId}`;
    if (hierMode === 'DIPLOMA' && hDip) url += `&diplomaId=${hDip}`;
    apiFetch(url)
      .then((students: any) => {
        setEligibleStudents(Array.isArray(students) ? students : []);
      })
      .catch(() => setEligibleStudents([]));
  }, [selectedSection, sections, hierMode, hDip, apiFetch]);

  // Fetch full section data (with students array) when a section is selected
  // GET /sections (list) does NOT include students, only _count
  useEffect(() => {
    if (!selectedSection) return;
    apiFetch(`/sections/${selectedSection}`).then(updated => {
      if (!updated) return;
      setSections(prev => prev.map(s => String(s.id) === selectedSection ? updated : s));
      setHSectionList(prev => prev.map(s => String(s.id) === selectedSection ? updated : s));
    }).catch(() => {});
  }, [selectedSection, apiFetch]);

  const activeSection = [...sections, ...hSectionList].find(s => String(s.id) === selectedSection);
  const enrolledStudents = (activeSection?.students || []).map((ss: any) => ss.student).filter(Boolean);
  const enrolledIds = new Set(enrolledStudents.map((s: any) => s.id));
  const eligibleIds = new Set(eligibleStudents.map((s: any) => s.id));
  const nonEnrolled = eligibleStudents.filter((s: any) => !enrolledIds.has(s.id));
  const enrolled = enrolledStudents;
  const getPhone = (phones: any) => { try { return (typeof phones === 'string' ? JSON.parse(phones) : phones)?.[0] || ''; } catch { return ''; } };
  const qfilter = (s: any) => !query || s.fullNameAr?.includes(query) || getPhone(s.phones)?.includes(query) || (query.startsWith('0') && getPhone(s.phones)?.includes(query.slice(1)));

  // Hierarchy derived values
  const hFilteredDiplomas = useMemo(() => {
    if (!hDipCat) return diplomaList;
    return diplomaList.filter((d: any) => d.category === hDipCat);
  }, [hDipCat, diplomaList]);

  const hDiplomaCourseIds = useMemo(() => {
    if (!hDip) return new Set<number>();
    const dip = diplomaList.find((d: any) => d.id === hDip);
    return new Set((dip?.courses || []).map((dc: any) => dc.courseId));
  }, [hDip, diplomaList]);

  const hDiplomaCourses = useMemo(() => courseList.filter((c: any) => hDiplomaCourseIds.has(c.id)), [hDiplomaCourseIds, courseList]);

  const hFilteredDCourses = useMemo(() => {
    let list = hDiplomaCourses;
    if (hDCrsCat) list = list.filter((c: any) => String(c.categoryId) === hDCrsCat || c.categoryId === Number(hDCrsCat));
    return list;
  }, [hDiplomaCourses, hDCrsCat]);

  const hFilteredCCourses = useMemo(() => {
    if (!hCCrsCat) return courseList;
    return courseList.filter((c: any) => String(c.categoryId) === hCCrsCat || c.categoryId === Number(hCCrsCat));
  }, [hCCrsCat, courseList]);

  const loadSectionsByCourse = async (courseId: string) => {
    setHLoading(true);
    try {
      const res = await apiFetch(`/sections?courseId=${courseId}`);
      setHSectionList(Array.isArray(res) ? res : res?.data || []);
    } catch { setHSectionList([]); }
    finally { setHLoading(false); }
  };

  useEffect(() => {
    if (hierMode === 'DIPLOMA' && hDCrs) loadSectionsByCourse(hDCrs);
  }, [hierMode, hDCrs]);
  useEffect(() => {
    if (hierMode === 'COURSE' && hCCrs) loadSectionsByCourse(hCCrs);
  }, [hierMode, hCCrs]);

  useEffect(() => {
    const sid = hierMode === 'DIPLOMA' ? hDSec : hCSec;
    if (sid) setSelectedSection(sid);
  }, [hierMode, hDSec, hCSec, setSelectedSection]);

  const refreshSection = async () => {
    if (!selectedSection) return;
    const updated = await apiFetch(`/sections/${selectedSection}`);
    if (updated) {
      setSections(prev => prev.map(s => String(s.id) === selectedSection ? updated : s));
      setHSectionList(prev => prev.map(s => String(s.id) === selectedSection ? updated : s));
    }
  };

  const handleAdd = async (studentId: string) => {
    if (!selectedSection) return toast.error('تنبيه', 'الرجاء اختيار الشعبة أولاً');
    setAdding(studentId);
    try {
      await apiFetch(`/sections/${selectedSection}/students`, { method: 'POST', body: JSON.stringify({ studentId }) });
      toast.success('تمت الإضافة', 'تم إضافة الطالب للشعبة بنجاح');
      await refreshSection();
    } catch (e: any) {
      toast.error('خطأ', e.message || 'حدث خطأ');
      if (expandedStudent !== studentId) toggleSchedule(studentId);
    } finally { setAdding(null); }
  };

  const handleRemove = async (studentId: string) => {
    if (!selectedSection) return;
    setAdding(studentId);
    try {
      await apiFetch(`/sections/${selectedSection}/students/${studentId}`, { method: 'DELETE' });
      toast.success('تم الحذف', 'تم حذف الطالب من الشعبة');
      await refreshSection();
    } catch (e: any) {
      toast.error('خطأ', e.message || 'حدث خطأ');
    } finally { setAdding(null); }
  };

  // ── Student-first logic ──
  const handleStudentSearch = async () => {
    if (!studentSearch.trim()) return;
    try {
      const data = await apiFetch(`/students?query=${encodeURIComponent(studentSearch.trim())}`);
      setSearchResults(Array.isArray(data) ? data : (data.data || []));
    } catch { setSearchResults([]); }
  };

  const handleDeepSearch = (student: any) => {
    selectStudent(student);
  };

  const selectStudent = async (student: any) => {
    setSelectedStudent(student);
    setSearchResults(null);
    setStudentSearch('');
    try {
      const [enrolledData, availData, logData] = await Promise.all([
        apiFetch(`/sections/students/${student.id}/enrolled-sections`),
        apiFetch(`/students/${student.id}/available-sections`),
        apiFetch(`/sections/students/${student.id}/transfer-log`),
      ]);
      setStudentSections(Array.isArray(enrolledData) ? enrolledData : []);
      setAvailableSections(Array.isArray(availData) ? availData : []);
      setTransferLog(Array.isArray(logData) ? logData : []);
    } catch { setStudentSections([]); setAvailableSections([]); setTransferLog([]); }
  };

  const handleEnroll = async (sectionId: number) => {
    if (!selectedStudent) return;
    setEnrolling(sectionId);
    try {
      await apiFetch(`/sections/${sectionId}/students`, { method: 'POST', body: JSON.stringify({ studentId: selectedStudent.id }) });
      toast.success('تم التسجيل', 'تم تسجيل الطالب في الشعبة بنجاح');
      if (selectedStudent) selectStudent(selectedStudent);
    } catch (e: any) {
      toast.error('خطأ', e.message || 'فشل التسجيل');
    } finally { setEnrolling(null); }
  };

  const handleWithdraw = async (sectionId: number) => {
    if (!selectedStudent) return;
    setWithdrawing(sectionId);
    try {
      await apiFetch(`/sections/${sectionId}/students/${selectedStudent.id}`, { method: 'DELETE' });
      toast.success('تم الحذف', 'تم إزالة الطالب من الشعبة');
      if (selectedStudent) selectStudent(selectedStudent);
    } catch (e: any) {
      toast.error('خطأ', e.message || 'فشل الإزالة');
    } finally { setWithdrawing(null); }
  };

  // ── Transfer logic ──
  const selectTrStudent = async (student: any) => {
    setTrStudent(student);
    setTrResults(null);
    setTrSearch('');
    try {
      const [enrolled, avail] = await Promise.all([
        apiFetch(`/sections/students/${student.id}/enrolled-sections`),
        apiFetch(`/students/${student.id}/available-sections`),
      ]);
      setTrEnrolled(Array.isArray(enrolled) ? enrolled : []);
      setTrAvail(Array.isArray(avail) ? avail : []);
    } catch { setTrEnrolled([]); setTrAvail([]); }
  };

  const handleTrSearch = async () => {
    if (!trSearch.trim()) return;
    try {
      const data = await apiFetch(`/students?query=${encodeURIComponent(trSearch.trim())}`);
      setTrResults(Array.isArray(data) ? data : (data.data || []));
    } catch { setTrResults([]); }
  };

  const handleTrDeepSearch = (student: any) => {
    selectTrStudent(student);
  };

  const getAvailForCourse = (courseId: string) =>
    trAvail.filter(a => String(a.courseId) === String(courseId));

  const formatDays = (days: string[] | string) => {
    const arr = typeof days === 'string' ? (() => { try { return JSON.parse(days); } catch { return []; } })() : days;
    return arr
      .slice()
      .sort((a: string, b: string) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
      .map((d: string) => dayLabels[d] || d)
      .join(' - ');
  };

  const formatSchedule = (sec: any) => {
    if (!sec) return '';
    if (sec.perDaySchedule && sec.scheduleDetails) {
      const details = typeof sec.scheduleDetails === 'string' ? (() => { try { return JSON.parse(sec.scheduleDetails); } catch { return []; } })() : sec.scheduleDetails;
      if (Array.isArray(details) && details.length > 0) {
        return details.map((s: any) => `${dayLabels[s.day] || s.day} ${s.startTime}-${s.endTime}`).join(' | ');
      }
    }
    return `${formatDays(sec.days)} ${sec.startTime ? `(${sec.startTime}-${sec.endTime})` : ''}`;
  };

  // ── Render ──
  return (
    <div className="fade-in">
      <div className="page-header">
        <h2><Users className="text-primary" size={24} /> إدارة الشعب والتسجيل</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--glass-bg)', borderRadius: 10, border: '1px solid var(--glass-border)', overflow: 'hidden', width: 'fit-content' }}>
        <button onClick={() => { setTab('section-first'); setSelectedSection(''); setSelectedStudent(null); }}
          style={{ padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.15s', fontFamily: 'Cairo', background: tab === 'section-first' ? 'var(--primary)' : 'transparent', color: tab === 'section-first' ? '#fff' : 'var(--text-muted)' }}>
          إدارة طلاب الشعبة
        </button>
        <button onClick={() => { setTab('student-first'); setSelectedSection(''); }}
          style={{ padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.15s', fontFamily: 'Cairo', background: tab === 'student-first' ? 'var(--primary)' : 'transparent', color: tab === 'student-first' ? '#fff' : 'var(--text-muted)' }}>
          تسجيل طالب
        </button>
        <button onClick={() => setTab('transfer')}
          style={{ padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.15s', fontFamily: 'Cairo', background: tab === 'transfer' ? 'var(--primary)' : 'transparent', color: tab === 'transfer' ? '#fff' : 'var(--text-muted)' }}>
          ⇄ نقل طالب
        </button>
      </div>

      {tab === 'section-first' ? (
        <>
          {/* ═══ Hierarchical Filter ═══ */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-muted)' }}>
              {([['DIPLOMA', 'دبلوم'], ['COURSE', 'دورة']] as const).map(([key, label]) => (
                <button key={key} onClick={() => { setHierMode(key); setHDipCat(''); setHDip(''); setHDCrsCat(''); setHDCrs(''); setHDSec(''); setHCCrsCat(''); setHCCrs(''); setHCSec(''); setHSectionList([]); setSelectedSection(''); }}
                  style={{
                    flex: 1, padding: '12px 20px', border: 'none', cursor: 'pointer',
                    background: hierMode === key ? 'var(--card-bg)' : 'transparent',
                    color: hierMode === key ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: hierMode === key ? 700 : 500, fontSize: '0.9rem',
                    borderBottom: hierMode === key ? '2px solid var(--primary)' : '2px solid transparent',
                  }}>
                  <BookOpen size={16} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                  {label}
                </button>
              ))}
            </div>

            {hierMode === 'DIPLOMA' && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                  {[
                    { label: 'تصنيف الدبلوم', val: !!hDipCat },
                    { label: 'الدبلوم', val: !!hDip },
                    { label: 'الدورة', val: !!hDCrs },
                    { label: 'الشعبة', val: !!hDSec },
                  ].map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 && <ChevronLeft size={13} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />}
                      <span style={{ fontSize: '0.76rem', fontWeight: s.val ? 700 : 400, color: s.val ? 'var(--primary)' : 'var(--text-muted)', opacity: s.val ? 1 : 0.45 }}>{s.label}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 160, flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>تصنيف الدبلوم</label>
                    <select className="glass-input" value={hDipCat} onChange={e => { setHDipCat(e.target.value); setHDip(''); setHDCrsCat(''); setHDCrs(''); setHDSec(''); setHSectionList([]); setSelectedSection(''); }}>
                      <option value="">— اختر تصنيف الدبلوم —</option>
                      {DIPLOMA_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 160, flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>الدبلوم</label>
                    <select className="glass-input" value={hDip} onChange={e => { setHDip(e.target.value); setHDCrsCat(''); setHDCrs(''); setHDSec(''); setHSectionList([]); setSelectedSection(''); }} disabled={!hDipCat}>
                      <option value="">— اختر الدبلوم —</option>
                      {hFilteredDiplomas.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 1, height: 32, background: 'var(--glass-border)', alignSelf: 'flex-end', marginBottom: 4 }} />
                  <div className="form-group" style={{ margin: 0, minWidth: 130, flex: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>فلتر التصنيف</label>
                    <select className="glass-input" value={hDCrsCat} onChange={e => { setHDCrsCat(e.target.value); setHDCrs(''); setHDSec(''); setHSectionList([]); setSelectedSection(''); }} disabled={!hDip}>
                      <option value="">كل التصنيفات</option>
                      {courseCategories.map((c: any) => <option key={c.id} value={String(c.id)}>{c.nameAr || c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 2 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>الدورة</label>
                    <select className="glass-input" value={hDCrs} onChange={e => { setHDCrs(e.target.value); setHDSec(''); setHSectionList([]); setSelectedSection(''); }} disabled={!hDip || hFilteredDCourses.length === 0}>
                      <option value="">— اختر الدورة —</option>
                      {hFilteredDCourses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 2 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>الشعبة</label>
                    <select className="glass-input" value={hDSec} onChange={e => setHDSec(e.target.value)} disabled={!hDCrs || hSectionList.length === 0}>
                      <option value="">— اختر الشعبة —</option>
                      {hSectionList.map((s: any) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name || 'شعبة'} — {s.instructor?.name || '-'} {formatSchedule(s)} ({s._count?.students || 0} طالب)
                          {s.status === 'CLOSED' ? ' 🔴' : s.status === 'COMPLETED' ? ' 🔵' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hDipCat && (
                    <button className="glass-btn secondary sm" onClick={() => { setHDipCat(''); setHDip(''); setHDCrsCat(''); setHDCrs(''); setHDSec(''); setHSectionList([]); setSelectedSection(''); }} style={{ fontSize: '0.75rem', padding: '6px 12px', marginBottom: 1 }}>
                      <RefreshCw size={12} /> إعادة تعيين
                    </button>
                  )}
                </div>
                {hLoading && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>جارٍ تحميل الشعب...</div>}
              </div>
            )}

            {hierMode === 'COURSE' && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                  {[
                    { label: 'الدورة', val: !!hCCrs },
                    { label: 'الشعبة', val: !!hCSec },
                  ].map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 && <ChevronLeft size={13} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />}
                      <span style={{ fontSize: '0.76rem', fontWeight: s.val ? 700 : 400, color: s.val ? 'var(--primary)' : 'var(--text-muted)', opacity: s.val ? 1 : 0.45 }}>{s.label}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 130, flex: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>فلتر التصنيف</label>
                    <select className="glass-input" value={hCCrsCat} onChange={e => { setHCCrsCat(e.target.value); setHCCrs(''); setHCSec(''); setHSectionList([]); setSelectedSection(''); }}>
                      <option value="">كل التصنيفات</option>
                      {courseCategories.map((c: any) => <option key={c.id} value={String(c.id)}>{c.nameAr || c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 2 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>الدورة</label>
                    <select className="glass-input" value={hCCrs} onChange={e => { setHCCrs(e.target.value); setHCSec(''); setHSectionList([]); setSelectedSection(''); }}>
                      <option value="">— اختر الدورة —</option>
                      {hFilteredCCourses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 2 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>الشعبة</label>
                    <select className="glass-input" value={hCSec} onChange={e => setHCSec(e.target.value)} disabled={!hCCrs || hSectionList.length === 0}>
                      <option value="">— اختر الشعبة —</option>
                      {hSectionList.map((s: any) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name || 'شعبة'} — {s.instructor?.name || '-'} {formatSchedule(s)} ({s._count?.students || 0} طالب)
                          {s.status === 'CLOSED' ? ' 🔴' : s.status === 'COMPLETED' ? ' 🔵' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hCCrsCat && (
                    <button className="glass-btn secondary sm" onClick={() => { setHCCrsCat(''); setHCCrs(''); setHCSec(''); setHSectionList([]); setSelectedSection(''); }} style={{ fontSize: '0.75rem', padding: '6px 12px', marginBottom: 1 }}>
                      <RefreshCw size={12} /> إعادة تعيين
                    </button>
                  )}
                </div>
                {hLoading && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>جارٍ تحميل الشعب...</div>}
              </div>
            )}
          </div>

          {activeSection && (
            <div className="glass-panel" style={{ marginBottom: 20, padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.88rem' }}>
                <span>🟢 الحالة: <strong>{activeSection.status === 'OPEN' ? 'مفتوحة' : activeSection.status === 'CLOSED' ? 'مغلقة' : 'منتهية'}</strong></span>
                <span>الاستيعاب: <strong>{activeSection.capacity}</strong></span>
                <span>المسجلون: <strong style={{ color: enrolledIds.size >= activeSection.capacity ? 'var(--danger)' : 'var(--success)' }}>{enrolledIds.size}/{activeSection.capacity}</strong></span>
                <span>المواعيد: <strong>{formatSchedule(activeSection)}</strong></span>
              </div>
            </div>
          )}

          {selectedSection ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="search-bar">
                  <Search className="search-icon" size={17} />
                  <input type="text" className="glass-input" placeholder="ابحث عن طالب..." value={query} onChange={e => setQuery(e.target.value)} />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
                <div className="glass-panel">
                  <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserCheck size={18} color="var(--success)" /> الطلاب غير المسجلين
                    <span className="badge primary" style={{ fontSize: '0.72rem' }}>{nonEnrolled.filter(qfilter).length}</span>
                  </h3>
                  <div className="glass-table-container" style={{ maxHeight: 500, overflowY: 'auto' }}>
                    <table className="glass-table">
                      <thead><tr><th>الطالب</th><th>الهاتف</th><th></th></tr></thead>
                      <tbody>
                        {nonEnrolled.filter(qfilter).slice(0, 50).map(s => (
                          <React.Fragment key={s.id}>
                            <tr>
                              <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSchedule(s.id)}>
                                {s.fullNameAr}
                                <span style={{ marginRight: 8, fontSize: '0.65rem', opacity: 0.5 }}>
                                  {expandedStudent === s.id ? '▲' : '▼'}
                                </span>
                              </td>
                              <td dir="ltr" style={{ fontSize: '0.85rem', textAlign: 'right' }}>{getPhone(s.phones) ? `0${getPhone(s.phones)}` : '—'}</td>
                              <td>
                                <button className="glass-btn sm success" onClick={() => handleAdd(s.id)}
                                  disabled={adding === s.id || enrolledIds.size >= (activeSection?.capacity || 0)}>
                                  {adding === s.id ? '...' : <><Plus size={13} /> إضافة</>}
                                </button>
                              </td>
                            </tr>
                            {expandedStudent === s.id && (
                              <tr>
                                <td colSpan={3} style={{ padding: 0, background: 'var(--bg-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                                  {scheduleLoading ? (
                                    <div style={{ padding: '10px 16px', textAlign: 'center', opacity: 0.5, fontSize: '0.78rem' }}>جارٍ تحميل الجدول...</div>
                                  ) : studentSchedule.length === 0 ? (
                                    <div style={{ padding: '10px 16px', textAlign: 'center', opacity: 0.4, fontSize: '0.78rem' }}>غير مسجل في أي شعبة</div>
                                  ) : (
                                    <div style={{ padding: '10px 16px' }}>
                                      <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>جدول الطالب الحالي:</div>
                                      <table className="glass-table" style={{ fontSize: '0.78rem', width: '100%' }}>
                                        <thead>
                                          <tr>
                                            <th>الدورة</th>
                                            <th>الجدول</th>
                                            <th>المدرب</th>
                                            <th>القاعة</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {studentSchedule.map((sec: any) => (
                                            <tr key={sec.id}>
                                              <td style={{ fontWeight: 600 }}>{sec.courseName || '—'}</td>
                                              <td style={{ fontSize: '0.78rem' }}>{formatSchedule(sec)}</td>
                                              <td>{sec.instructorName || '—'}</td>
                                              <td>{sec.roomName || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {nonEnrolled.filter(qfilter).length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>لا يوجد طلاب</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="glass-panel">
                  <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color="var(--primary)" /> الطلاب المسجلين
                    <span className="badge teal" style={{ fontSize: '0.72rem' }}>{enrolled.filter(qfilter).length}</span>
                  </h3>
                  <div className="glass-table-container" style={{ maxHeight: 500, overflowY: 'auto' }}>
                    <table className="glass-table">
                      <thead><tr><th>الطالب</th><th>الهاتف</th><th></th></tr></thead>
                      <tbody>
                        {enrolled.filter(qfilter).slice(0, 50).map((s: any) => (
                          <React.Fragment key={s.id}>
                            <tr>
                              <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSchedule(s.id)}>
                                {s.fullNameAr}
                                <span style={{ marginRight: 8, fontSize: '0.65rem', opacity: 0.5 }}>
                                  {expandedStudent === s.id ? '▲' : '▼'}
                                </span>
                              </td>
                              <td dir="ltr" style={{ fontSize: '0.85rem', textAlign: 'right' }}>{getPhone(s.phones) ? `0${getPhone(s.phones)}` : '—'}</td>
                              <td>
                                <button className="glass-btn sm danger" onClick={() => handleRemove(s.id)} disabled={adding === s.id}>
                                  {adding === s.id ? '...' : <><X size={13} /> حذف</>}
                                </button>
                              </td>
                            </tr>
                            {expandedStudent === s.id && (
                              <tr>
                                <td colSpan={3} style={{ padding: 0, background: 'var(--bg-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                                  {scheduleLoading ? (
                                    <div style={{ padding: '10px 16px', textAlign: 'center', opacity: 0.5, fontSize: '0.78rem' }}>جارٍ تحميل الجدول...</div>
                                  ) : studentSchedule.length === 0 ? (
                                    <div style={{ padding: '10px 16px', textAlign: 'center', opacity: 0.4, fontSize: '0.78rem' }}>غير مسجل في أي شعبة</div>
                                  ) : (
                                    <div style={{ padding: '10px 16px' }}>
                                      <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>جدول الطالب الحالي:</div>
                                      <table className="glass-table" style={{ fontSize: '0.78rem', width: '100%' }}>
                                        <thead>
                                          <tr>
                                            <th>الدورة</th>
                                            <th>الجدول</th>
                                            <th>المدرب</th>
                                            <th>القاعة</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {studentSchedule.map((sec: any) => (
                                            <tr key={sec.id}>
                                              <td style={{ fontWeight: 600 }}>{sec.courseName || '—'}</td>
                                              <td style={{ fontSize: '0.78rem' }}>{formatSchedule(sec)}</td>
                                              <td>{sec.instructorName || '—'}</td>
                                              <td>{sec.roomName || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {enrolled.filter(qfilter).length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>لا يوجد طلاب مسجلين</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel empty-state">
              <Users size={48} />
              <p>اختر شعبة من القائمة أعلاه لإدارة الطلاب</p>
            </div>
          )}
        </>
      ) : tab === 'student-first' ? (
        /* ═══════════════════════════════════ */
        /*  STUDENT-FIRST TAB                 */
        /* ═══════════════════════════════════ */
        <>
          {/* Search */}
          <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 250, marginBottom: 0 }}>
                <Search className="search-icon" size={17} />
                <input type="text" className="glass-input" placeholder="ابحث عن طالب بالاسم أو رقم الهاتف..." value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStudentSearch()} />
              </div>
              <button className="glass-btn" onClick={handleStudentSearch} style={{ padding: '8px 18px' }}>
                <Search size={15} /> بحث
              </button>
              <button className="glass-btn secondary" onClick={() => setIsDeepOpen(true)} style={{ padding: '8px 18px' }}>
                بحث عميق
              </button>
            </div>

            {/* Search results dropdown */}
            {searchResults !== null && searchResults.length > 0 && (
              <div style={{ marginTop: 12, border: '1px solid var(--glass-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div className="glass-table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table className="glass-table">
                    <thead><tr><th>الطالب</th><th>رقم الجلوس</th><th>الهاتف</th><th></th></tr></thead>
                    <tbody>
                      {searchResults.slice(0, 20).map((s: any) => (
                        <tr key={s.id} style={{ cursor: 'pointer' }}
                          onClick={() => selectStudent(s)}>
                          <td style={{ fontWeight: 600 }}>{s.fullNameAr}</td>
                          <td style={{ fontSize: '0.85rem', direction: 'ltr' }}>{s.id}</td>
                          <td dir="ltr" style={{ fontSize: '0.85rem' }}>{getPhone(s.phones) ? `0${getPhone(s.phones)}` : '—'}</td>
                          <td><button className="glass-btn sm" onClick={e => { e.stopPropagation(); selectStudent(s); }}>اختيار</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {searchResults !== null && searchResults.length === 0 && (
              <div style={{ marginTop: 12, padding: 16, textAlign: 'center', opacity: 0.5, fontSize: '0.88rem' }}>لا توجد نتائج</div>
            )}
          </div>

          {/* Deep Search Modal */}
          <DeepSearchModal isOpen={isDeepOpen} onClose={() => setIsDeepOpen(false)} onSearch={() => {}} onSelectStudent={handleDeepSearch} />

          {/* Selected student info */}
          {selectedStudent && (
            <>
              <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {(selectedStudent.fullNameAr || '?').charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedStudent.fullNameAr}
                      {selectedStudent.fullNameEn && <span style={{ fontSize: '0.8rem', fontWeight: 400, marginRight: 8, color: 'var(--text-muted)' }}>({selectedStudent.fullNameEn})</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>رقم الجلوس: <strong>{selectedStudent.id}</strong></span>
                      <span>الحالة: <strong style={{ color: selectedStudent.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }}>
                        {selectedStudent.status === 'ACTIVE' ? 'نشط' : selectedStudent.status === 'POSTPONED' ? 'مؤجل' : selectedStudent.status === 'WITHDRAWN' ? 'منسحب' : 'منتهي'}
                      </strong></span>
                      {selectedStudent.nationalId && <span>رقم وطني: <strong>{selectedStudent.nationalId}</strong></span>}
                      {getPhone(selectedStudent.phones) && <span>هاتف: <strong dir="ltr">0{getPhone(selectedStudent.phones)}</strong></span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Current sections */}
              <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
                <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setCollapsed({ ...collapsed, currSections: !collapsed.currSections })}>
                  <BookOpen size={18} color="var(--primary)" /> الشعب المسجل فيها حالياً
                  <span className="badge teal" style={{ fontSize: '0.72rem' }}>{studentSections.length}</span>
                  <span style={{ marginRight: 'auto', fontSize: '0.72rem', opacity: 0.4 }}>{collapsed.currSections ? 'إظهار' : 'إخفاء'}</span>
                </h3>
                {!collapsed.currSections && (studentSections.length > 0 ? (
                  <div className="glass-table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table className="glass-table">
                      <thead><tr><th>الدورة</th><th>الجدول</th><th>المدرب</th><th>القاعة</th></tr></thead>
                      <tbody>
                        {studentSections.map(sec => (
                          <tr key={sec.id}>
                            <td style={{ fontWeight: 600 }}>{sec.courseName || sec.name || '—'}</td>
                            <td style={{ fontSize: '0.82rem' }}>{formatSchedule(sec)}</td>
                            <td style={{ fontSize: '0.85rem' }}>{sec.instructorName || '—'}</td>
                            <td style={{ fontSize: '0.85rem' }}>{sec.roomName || '—'}</td>
                            <td>
                              <button className="glass-btn sm danger" onClick={() => handleWithdraw(sec.id)} disabled={withdrawing === sec.id}>
                                {withdrawing === sec.id ? '...' : <><X size={13} /> إزالة</>}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                  <p style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>غير مسجل في أي شعبة</p>
                ))}
              </div>

              {/* Transfer log */}
              {transferLog.length > 0 && (
                <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
                  <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={18} color="#f59e0b" /> سجل التنقلات
                    <span className="badge warning" style={{ fontSize: '0.72rem' }}>{transferLog.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {transferLog.map(log => (
                      <div key={log.id} style={{
                        background: 'var(--bg-muted)', borderRadius: 10,
                        border: '1px solid var(--glass-border)', overflow: 'hidden',
                      }}>
                        {/* Header with date */}
                        <div style={{
                          padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600,
                          color: 'var(--text-muted)', background: 'var(--glass-bg)',
                          borderBottom: '1px solid var(--glass-border)',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <Clock size={12} />
                          {new Date(log.transferredAt).toLocaleDateString('ar-SA', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </div>
                        <div style={{ padding: '12px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {/* From section */}
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>
                              ✕ من
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.from.courseName}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {log.from.name || 'شعبة'} — {formatSchedule(log.from)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              {log.from.instructorName} | {log.from.roomName}
                            </div>
                          </div>
                          {/* Arrow */}
                          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                            ←
                          </div>
                          {/* To section */}
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>
                              ✓ إلى
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.to.courseName}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {log.to.name || 'شعبة'} — {formatSchedule(log.to)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              {log.to.instructorName} | {log.to.roomName}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available sections */}
              <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
                  <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setCollapsed({ ...collapsed, availSections: !collapsed.availSections })}>
                    <Clock size={18} color="var(--success)" /> الشعب المتاحة للتسجيل
                    <span className="badge primary" style={{ fontSize: '0.72rem' }}>{availableSections.length}</span>
                    <span style={{ marginRight: 'auto', fontSize: '0.72rem', opacity: 0.4 }}>{collapsed.availSections ? 'إظهار' : 'إخفاء'}</span>
                  </h3>
                  {!collapsed.availSections && (availableSections.length > 0 ? (
                  <div className="glass-table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className="glass-table">
                      <thead><tr>
                        <th>الدورة</th>
                        <th>الجدول</th>
                        <th>المدرب</th>
                        <th>القاعة</th>
                        <th>المقاعد</th>
                        <th></th>
                      </tr></thead>
                      <tbody>
                        {availableSections.map(sec => (
                          <tr key={sec.id} style={sec.hasConflict ? { background: 'var(--danger-light)', opacity: 0.7 } : {}}>
                            <td style={{ fontWeight: 600 }}>{sec.courseName || sec.name || '—'}</td>
                            <td style={{ fontSize: '0.82rem' }}>{formatSchedule(sec)}</td>
                            <td style={{ fontSize: '0.85rem' }}>{sec.instructorName || '—'}</td>
                            <td style={{ fontSize: '0.85rem' }}>{sec.roomName || '—'}</td>
                            <td style={{ fontSize: '0.82rem', textAlign: 'center' }}>
                              <span style={{ color: sec.enrolledCount >= sec.capacity ? 'var(--danger)' : 'var(--success)' }}>
                                {sec.enrolledCount}/{sec.capacity}
                              </span>
                            </td>
                            <td>
                              {sec.hasConflict ? (
                                <span title={sec.conflicts?.map((c: any) => `تعارض مع ${c.name || 'شعبة'}: ${formatSchedule(c)}`).join(' | ')}>
                                  <AlertCircle size={15} color="var(--danger)" style={{ verticalAlign: 'middle' }} />
                                </span>
                              ) : (
                                <button className="glass-btn sm success" onClick={() => handleEnroll(sec.id)}
                                  disabled={enrolling === sec.id || sec.enrolledCount >= sec.capacity}>
                                  {enrolling === sec.id ? '...' : <><Plus size={13} /> تسجيل</>}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>لا توجد شعب متاحة (يجب تسجيل الطالب في دورة أولاً)</p>
                ))}
              </div>
            </>
          )}

          {!selectedStudent && searchResults === null && (
            <div className="glass-panel empty-state">
              <Users size={48} />
              <p>ابحث عن طالب لعرض شعبهم المتاحة</p>
            </div>
          )}
        </>
      ) : (
        /* ═══════════════════════════════════ */
        /*  TRANSFER TAB                      */
        /* ═══════════════════════════════════ */
        <>
          <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 250, marginBottom: 0 }}>
                <Search className="search-icon" size={17} />
                <input type="text" className="glass-input" placeholder="ابحث عن طالب بالاسم أو رقم الهاتف..." value={trSearch}
                  onChange={e => setTrSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTrSearch()} />
              </div>
              <button className="glass-btn" onClick={handleTrSearch} style={{ padding: '8px 18px' }}>
                <Search size={15} /> بحث
              </button>
              <button className="glass-btn secondary" onClick={() => setTrIsDeepOpen(true)} style={{ padding: '8px 18px' }}>
                بحث عميق
              </button>
            </div>

            {trResults !== null && trResults.length > 0 && (
              <div style={{ marginTop: 12, border: '1px solid var(--glass-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div className="glass-table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table className="glass-table">
                    <thead><tr><th>الطالب</th><th>رقم الجلوس</th><th>الهاتف</th><th></th></tr></thead>
                    <tbody>
                      {trResults.slice(0, 20).map((s: any) => (
                        <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => selectTrStudent(s)}>
                          <td style={{ fontWeight: 600 }}>{s.fullNameAr}</td>
                          <td style={{ fontSize: '0.85rem', direction: 'ltr' }}>{s.id}</td>
                          <td dir="ltr" style={{ fontSize: '0.85rem' }}>{getPhone(s.phones) ? `0${getPhone(s.phones)}` : '—'}</td>
                          <td><button className="glass-btn sm" onClick={e => { e.stopPropagation(); selectTrStudent(s); }}>اختيار</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {trResults !== null && trResults.length === 0 && (
              <div style={{ marginTop: 12, padding: 16, textAlign: 'center', opacity: 0.5, fontSize: '0.88rem' }}>لا توجد نتائج</div>
            )}
          </div>

          <DeepSearchModal isOpen={trIsDeepOpen} onClose={() => setTrIsDeepOpen(false)} onSearch={() => {}} onSelectStudent={handleTrDeepSearch} />

          {trStudent && (
            <>
              <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(trStudent.fullNameAr || '?').charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {trStudent.fullNameAr}
                      {trStudent.fullNameEn && <span style={{ fontSize: '0.8rem', fontWeight: 400, marginRight: 8, color: 'var(--text-muted)' }}>({trStudent.fullNameEn})</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>رقم الجلوس: <strong>{trStudent.id}</strong></span>
                      <span>الحالة: <strong style={{ color: trStudent.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }}>
                        {trStudent.status === 'ACTIVE' ? 'نشط' : trStudent.status === 'POSTPONED' ? 'مؤجل' : trStudent.status === 'WITHDRAWN' ? 'منسحب' : 'منتهي'}
                      </strong></span>
                      {getPhone(trStudent.phones) && <span>هاتف: <strong dir="ltr">0{getPhone(trStudent.phones)}</strong></span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ marginBottom: 16, padding: '18px 22px' }}>
                <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} color="var(--primary)" /> الشعب المسجل فيها حالياً
                  <span className="badge teal" style={{ fontSize: '0.72rem' }}>{trEnrolled.length}</span>
                </h3>
                {trEnrolled.length > 0 ? (
                  <div className="glass-table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className="glass-table">
                      <thead><tr><th>الدورة</th><th>الجدول</th><th>المدرب</th><th>القاعة</th><th>من</th><th>إلى</th><th>نقل</th></tr></thead>
                      <tbody>
                        {trEnrolled.map(sec => {
                          const targets = getAvailForCourse(sec.courseId);
                          return (
                            <tr key={sec.id}>
                              <td style={{ fontWeight: 600 }}>{sec.courseName}</td>
                              <td style={{ fontSize: '0.82rem' }}>{formatSchedule(sec)}</td>
                              <td style={{ fontSize: '0.85rem' }}>{sec.instructorName || '—'}</td>
                              <td style={{ fontSize: '0.85rem' }}>{sec.roomName || '—'}</td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{sec.enrollDate ? new Date(sec.enrollDate).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{sec.endDate && new Date(sec.endDate) <= new Date() ? new Date(sec.endDate).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' }) : 'إلى الآن'}</td>
                              <td>
                                {targets.length > 0 ? (
                                  <button className="glass-btn sm" onClick={() => { setTrModalSection(sec); setTrTargetId(null); }}
                                    disabled={trLoading === sec.id}>
                                    {trLoading === sec.id ? <Loader2 size={13} className="spin" /> : <><RefreshCw size={13} /> نقل</>}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>لا توجد شعب متاحة</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>غير مسجل في أي شعبة</p>
                )}
              </div>
            </>
          )}

          {!trStudent && trResults === null && (
            <div className="glass-panel empty-state">
              <Users size={48} />
              <p>ابحث عن طالب لنقله إلى شعبة أخرى</p>
            </div>
          )}

          {/* Transfer Modal (like enroll modal) */}
          {trModalSection && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }} onClick={() => setTrModalSection(null)}>
              <div className="glass-panel" style={{ maxWidth: 680, width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: 16 }}
                onClick={e => e.stopPropagation()}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--glass-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <RefreshCw size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>نقل الطالب</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {trStudent?.fullNameAr} ← {trModalSection.courseName} ({trModalSection.name || 'شعبة'})
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setTrModalSection(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', padding: '0 4px' }}>×</button>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  اختر الشعبة الهدف لنقل الطالب إليها
                </div>
                {getAvailForCourse(trModalSection.courseId).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                    <p>لا توجد شعب متاحة لهذه الدورة</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {getAvailForCourse(trModalSection.courseId).map(sec => (
                      <div key={sec.id} onClick={() => setTrTargetId(sec.id)}
                        style={{
                          display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', cursor: 'pointer',
                          borderRadius: 12, border: trTargetId === sec.id ? '2px solid var(--primary)' : '1.5px solid var(--glass-border)',
                          background: trTargetId === sec.id ? 'var(--primary-light)' : 'var(--card-bg)',
                          transition: 'all 0.15s',
                        }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: trTargetId === sec.id ? 'var(--primary)' : 'var(--glass-border)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{sec.courseName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span>📚 شعبة: {sec.name || '-'}</span>
                            <span>👨‍🏫 {sec.instructorName}</span>
                            <span>🏠 {sec.roomName}</span>
                            <span>📅 {sec.startDate ? `${new Date(sec.startDate).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' })}` : '-'} → {sec.endDate && new Date(sec.endDate) <= new Date() ? new Date(sec.endDate).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' }) : 'الآن'}</span>
                            <span>📅 {sec.days ? formatSchedule(sec) : '-'}</span>
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
                  <button className="glass-btn secondary" onClick={() => setTrModalSection(null)}>إلغاء</button>
                  <button className="glass-btn success" disabled={!trTargetId || !!trLoading}
                    onClick={async () => {
                      if (!trTargetId) return;
                      setTrLoading(trModalSection.id);
                      try {
                        await apiFetch('/sections/transfer', {
                          method: 'POST',
                          body: JSON.stringify({ studentId: trStudent.id, fromSectionId: trModalSection.id, toSectionId: trTargetId })
                        });
                        toast.success('تم النقل', 'تم نقل الطالب بنجاح');
                        setTrModalSection(null);
                        setTrTargetId(null);
                        if (trStudent) selectTrStudent(trStudent);
                      } catch (e: any) { toast.error('خطأ', e.message || 'فشل نقل الطالب'); }
                      finally { setTrLoading(null); }
                    }}>
                    {trLoading ? <><Loader2 size={16} className="spin" /> جاري...</> : '✅ تأكيد النقل'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
