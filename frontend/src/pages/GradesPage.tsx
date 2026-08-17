import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Save, RefreshCw, CheckCircle, Lock, Unlock,
  User, BookOpen, GraduationCap,
  Clock, Users, DoorOpen, X, ChevronLeft, AlertCircle
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DIPLOMA_CATEGORIES } from '../utils/constants';

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

interface Student {
  id: string; fullNameAr: string; fullNameEn: string | null;
  nationality?: string; nationalityName?: string; nationalId?: string;
  phones?: string; phoneCodes?: string; address?: string;
  studentType?: string; universityName?: string; universityId?: string;
  status?: string;
}

interface UserAccount {
  id: string; username: string; fullName: string; role: string;
  status: string; permissions: string[];
}

interface Section {
  id: number; name: string | null;
  courseId: string; course: Course;
  instructor: { id: number; name: string };
  days: string; startTime: string; endTime: string;
  room?: { id: number; name: string };
  status: string;
  perDaySchedule?: boolean;
  scheduleDetails?: string;
  _count?: { students: number };
}

interface Enrollment {
  id: string; studentId: string; sectionId: number;
  enrollDate: string; status: string;
  grade: number | null; isProject: boolean;
  result: string | null; supervisorApproved: boolean;
  student: Student;
}

type SearchMode = 'DIPLOMA' | 'COURSE';

const dayNames: Record<string, string> = {
  SAT: 'سبت', SUN: 'أحد', MON: 'اثنين', TUE: 'ثلاثاء',
  WED: 'أربعاء', THU: 'خميس', FRI: 'جمعة'
};

export const GradesPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<SearchMode>('DIPLOMA');
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Diploma path: step states
  const [dipCat, setDipCat] = useState('');
  const [dipDip, setDipDip] = useState('');
  const [dipCrsCat, setDipCrsCat] = useState('');
  const [dipCrs, setDipCrs] = useState('');
  const [dipSec, setDipSec] = useState('');

  // Course path: step states
  const [crsCat, setCrsCat] = useState('');
  const [crsCrs, setCrsCrs] = useState('');
  const [crsSec, setCrsSec] = useState('');

  // Sections data
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Grades
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [sectionEnrollments, setSectionEnrollments] = useState<Enrollment[]>([]);
  const [instructorCanEdit, setInstructorCanEdit] = useState(true);
  const [gradeApprovedByInstructor, setGradeApprovedByInstructor] = useState(false);
  const [gradeApprovedByAdmin, setGradeApprovedByAdmin] = useState(false);
  const [loadingSection, setLoadingSection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [edits, setEdits] = useState<Record<string, {
    grade: number | null;
    isProject: boolean;
    projectResult: string | null;
    supervisorApproved: boolean;
  }>>({});

  // Student detail modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentUser, setStudentUser] = useState<UserAccount | null>(null);
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Derived: filtered lists
  const filteredDiplomas = useMemo(() => {
    if (!dipCat) return diplomas;
    return diplomas.filter(d => d.category === dipCat);
  }, [dipCat, diplomas]);

  const diplomaCourseIds = useMemo(() => {
    if (!dipDip) return new Set<string>();
    const dip = diplomas.find(d => d.id === dipDip);
    return new Set((dip?.courses || []).map(dc => dc.courseId));
  }, [dipDip, diplomas]);

  const diplomaCourses = useMemo(() => {
    return courses.filter(c => diplomaCourseIds.has(c.id));
  }, [diplomaCourseIds, courses]);

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

  // Load sections for a course
  const loadSections = async (courseId: string) => {
    setLoadingSections(true);
    try {
      const data: Section[] = await apiFetch(`/grades/sections?courseId=${courseId}`);
      setSections(data);
    } catch (e: any) {
      toast.error(e.message || 'فشل تحميل الشعب');
    } finally {
      setLoadingSections(false);
    }
  };

  // Reset section-dependent state
  const resetSectionState = () => {
    setSections([]);
    setSelectedSection(null);
    setSectionEnrollments([]);
    setEdits({});
  };

  // Fetch sections when course changes in diploma mode
  useEffect(() => {
    if (mode === 'DIPLOMA' && dipCrs) {
      resetSectionState();
      loadSections(dipCrs);
    }
  }, [mode, dipCrs]);

  // Fetch sections when course changes in course mode
  useEffect(() => {
    if (mode === 'COURSE' && crsCrs) {
      resetSectionState();
      loadSections(crsCrs);
    }
  }, [mode, crsCrs]);

  // Load section students when section is selected (diploma mode)
  useEffect(() => {
    if (mode === 'DIPLOMA' && dipSec) {
      loadSectionStudents(Number(dipSec));
    }
  }, [mode, dipSec]);

  // Load section students when section is selected (course mode)
  useEffect(() => {
    if (mode === 'COURSE' && crsSec) {
      loadSectionStudents(Number(crsSec));
    }
  }, [mode, crsSec]);

  const loadSectionStudents = async (sectionId: number) => {
    setLoadingSection(true);
    setSelectedSection(sectionId);
    setEdits({});
    try {
      const data = await apiFetch(`/grades/section/${sectionId}/students`);
      if (data.enrollments) {
        setSectionEnrollments(data.enrollments);
        setInstructorCanEdit(data.instructorCanEdit ?? true);
      } else {
        setSectionEnrollments(data);
        setInstructorCanEdit(true);
      }
      // Check approval status from enrollments
      const hasInstructorApproval = data.enrollments?.some((e: any) => e.gradeApprovedByInstructor);
      const hasAdminApproval = data.enrollments?.some((e: any) => e.gradeApprovedByAdmin);
      setGradeApprovedByInstructor(hasInstructorApproval || false);
      setGradeApprovedByAdmin(hasAdminApproval || false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingSection(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, dips, crs] = await Promise.all([
          apiFetch('/courses/categories'),
          apiFetch('/diplomas'),
          apiFetch('/courses'),
        ]);
        setCategories(cats);
        setDiplomas(dips);
        setCourses(crs);
      } catch (e: any) {
        toast.error(e.message || 'فشل تحميل البيانات');
      }
    };
    load();
  }, []);

  const handleGradeChange = (studentId: string, value: number | null) => {
    setEdits(prev => ({
      ...prev,
      [studentId]: { grade: value, isProject: false, projectResult: null, supervisorApproved: prev[studentId]?.supervisorApproved ?? false }
    }));
  };

  const handleApprovalChange = (studentId: string, approved: boolean) => {
    setEdits(prev => ({
      ...prev,
      [studentId]: { grade: null, isProject: false, projectResult: null, supervisorApproved: approved }
    }));
  };

  const handleProjectChange = (studentId: string, isProject: boolean) => {
    setEdits(prev => {
      const current = prev[studentId];
      if (isProject) {
        return { ...prev, [studentId]: { grade: null, isProject: true, projectResult: current?.projectResult ?? null, supervisorApproved: current?.supervisorApproved ?? false } };
      } else {
        return { ...prev, [studentId]: { grade: current?.grade ?? null, isProject: false, projectResult: null, supervisorApproved: current?.supervisorApproved ?? false } };
      }
    });
  };

  const handleProjectResultChange = (studentId: string, projectResult: string) => {
    setEdits(prev => ({
      ...prev,
      [studentId]: { grade: null, isProject: true, projectResult, supervisorApproved: prev[studentId]?.supervisorApproved ?? false }
    }));
  };

  const saveGrades = async () => {
    if (!selectedSection) return;
    const records = Object.entries(edits)
      .filter(([_, edit]) => edit.grade !== null || edit.isProject || edit.supervisorApproved)
      .map(([studentId, edit]) => ({
        studentId,
        grade: edit.grade,
        isProject: edit.isProject,
        projectResult: edit.isProject ? edit.projectResult : null,
        supervisorApproved: edit.supervisorApproved,
      }));
    if (records.length === 0) { toast.info('لا توجد تغييرات للحفظ'); return; }
    setSaving(true);
    try {
      await apiFetch('/grades/bulk', {
        method: 'POST',
        body: JSON.stringify({ sectionId: selectedSection, records }),
      });
      toast.success('تم حفظ العلامات بنجاح');
      setEdits({});
      const data = await apiFetch(`/grades/section/${selectedSection}/students`);
      setSectionEnrollments(data.enrollments || []);
      setInstructorCanEdit(data.instructorCanEdit ?? true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openStudentDetail = async (student: Student) => {
    setSelectedStudent(student);
    setStudentUser(null);
    setStudentGrades([]);
    setLoadingStudent(true);
    try {
      const [allUsers, allGrades] = await Promise.all([
        apiFetch('/auth/users'),
        apiFetch(`/grades/student/${student.id}`),
      ]);
      setStudentUser((allUsers as any[]).find((u: any) => u.studentId === student.id) || null);
      setStudentGrades(allGrades);
    } catch { }
    finally { setLoadingStudent(false); }
  };

  const getEditGrade = (enrollment: Enrollment) => {
    const edit = edits[enrollment.studentId];
    if (edit && edit.grade !== null && edit.grade !== undefined) return edit.grade;
    return enrollment.grade ?? '';
  };

  const getEditIsProject = (enrollment: Enrollment) => {
    const edit = edits[enrollment.studentId];
    if (edit) return edit.isProject;
    return enrollment.isProject;
  };

  const getEditProjectResult = (enrollment: Enrollment) => {
    const edit = edits[enrollment.studentId];
    if (edit?.isProject && edit.projectResult !== null && edit.projectResult !== undefined) return edit.projectResult;
    if (enrollment.isProject) return enrollment.result ?? '';
    return '';
  };

  const getEditApproved = (enrollment: Enrollment) => {
    const edit = edits[enrollment.studentId];
    if (edit && edit.supervisorApproved !== undefined) return edit.supervisorApproved;
    return enrollment.supervisorApproved;
  };

  const getCalcResult = (enrollment: Enrollment) => {
    const edit = edits[enrollment.studentId];
    if (edit) {
      if (edit.isProject) return edit.projectResult || null;
      if (edit.grade !== null && edit.grade !== undefined) return edit.grade >= 50 ? 'PASS' : 'FAIL';
      return null;
    }
    if (enrollment.isProject) return enrollment.result;
    if (enrollment.grade !== null && enrollment.grade !== undefined) return enrollment.grade >= 50 ? 'PASS' : 'FAIL';
    return null;
  };

  const hasEdits = Object.values(edits).some(e => e.grade !== null || e.isProject || e.supervisorApproved);

  const switchMode = (m: SearchMode) => {
    setMode(m);
    setDipCat(''); setDipDip(''); setDipCrsCat(''); setDipCrs(''); setDipSec('');
    setCrsCat(''); setCrsCrs(''); setCrsSec('');
    resetSectionState();
  };

  const parseDays = (daysJson: string): string[] => {
    try { return JSON.parse(daysJson); } catch { return []; }
  };

  const secScheduleLabel = (s: Section) => {
    if (s.perDaySchedule && s.scheduleDetails) {
      try {
        const dets = JSON.parse(s.scheduleDetails) as { day: string; startTime: string; endTime: string }[];
        if (Array.isArray(dets) && dets.length) return dets.map(d => `${d.day} ${d.startTime}-${d.endTime}`).join(' | ');
      } catch { /* ignore */ }
    }
    return s.startTime ? `${s.startTime}-${s.endTime}` : '';
  };

  const selectedSectionInfo = sections.find(s => s.id === selectedSection) || null;

  const resetDiplomaPath = () => {
    setDipCat(''); setDipDip(''); setDipCrsCat(''); setDipCrs(''); setDipSec('');
    resetSectionState();
  };

  const resetCoursePath = () => {
    setCrsCat(''); setCrsCrs(''); setCrsSec('');
    resetSectionState();
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
          }}>
            {step.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );

  const renderSelect = (
    label: string, value: string, onChange: (v: string) => void,
    options: { value: string; label: string }[], disabled = false, placeholder = ''
  ) => (
    <div className="form-group" style={{ margin: 0, minWidth: 170, flex: 1 }}>
      <label className="form-label" style={{ fontSize: '0.72rem' }}>{label}</label>
      <select className="glass-input" value={value}
        onChange={e => onChange(e.target.value)} disabled={disabled}>
        <option value="">{placeholder || `— اختر ${label} —`}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={22} style={{ color: 'var(--primary)' }} />
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>كشف العلامات</h2>
        </div>
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
                transition: 'all 0.2s',
              }}>
              <BookOpen size={16} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
              {label}
            </button>
          ))}
        </div>

        {/* ═══ Diploma Path ═══ */}
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
              {renderSelect(
                'تصنيف الدبلوم', dipCat, v => { setDipCat(v); setDipDip(''); setDipCrsCat(''); setDipCrs(''); setDipSec(''); resetSectionState(); },
                DIPLOMA_CATEGORIES.map(c => ({ value: c.value, label: c.label })), false, 'جميع التصنيفات'
              )}
              {renderSelect(
                'الدبلوم', dipDip, v => { setDipDip(v); setDipCrsCat(''); setDipCrs(''); setDipSec(''); resetSectionState(); },
                filteredDiplomas.map(d => ({ value: d.id, label: d.name })), !dipCat
              )}
              {renderSelect(
                'تصنيف الدورة', dipCrsCat, v => { setDipCrsCat(v); setDipCrs(''); setDipSec(''); resetSectionState(); },
                categories.map(c => ({ value: String(c.id), label: c.nameAr || c.name })), !dipDip, 'جميع التصنيفات'
              )}
              {renderSelect(
                'الدورة', dipCrs, v => { setDipCrs(v); setDipSec(''); resetSectionState(); },
                filteredDiplomaCourses.map(c => ({ value: c.id, label: c.name })), !dipDip || filteredDiplomaCourses.length === 0
              )}
              {renderSelect(
                'الشعبة', dipSec, v => setDipSec(v),
                sections.map(s => ({
                  value: String(s.id),
                  label: `${s.name || 'شعبة'} — ${s.instructor?.name || '-'} ${secScheduleLabel(s) ? `(${secScheduleLabel(s)})` : ''} (${s._count?.students || 0} طالب)`
                })),
                !dipCrs || sections.length === 0
              )}
              {dipCat && (
                <button className="glass-btn secondary sm" onClick={resetDiplomaPath}
                  style={{ fontSize: '0.75rem', padding: '6px 12px', marginBottom: 1 }}>
                  <X size={12} /> إعادة تعيين
                </button>
              )}
            </div>
            {loadingSections && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>جارٍ تحميل الشعب...</div>}
            {!loadingSections && dipCrs && !dipSec && sections.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>لا توجد شعب متاحة لهذه الدورة</div>
            )}
          </div>
        )}

        {/* ═══ Course Path ═══ */}
        {mode === 'COURSE' && (
          <div style={{ padding: 16 }}>
            {renderSteps([
              { label: 'تصنيف الدورة', value: !!crsCat },
              { label: 'الدورة', value: !!crsCrs },
              { label: 'الشعبة', value: !!crsSec },
            ])}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {renderSelect(
                'تصنيف الدورة', crsCat, v => { setCrsCat(v); setCrsCrs(''); setCrsSec(''); resetSectionState(); },
                categories.map(c => ({ value: String(c.id), label: c.nameAr || c.name })), false, 'جميع التصنيفات'
              )}
              {renderSelect(
                'الدورة', crsCrs, v => { setCrsCrs(v); setCrsSec(''); resetSectionState(); },
                filteredCourseCourses.map(c => ({ value: c.id, label: c.name })), !crsCat
              )}
              {renderSelect(
                'الشعبة', crsSec, v => setCrsSec(v),
                sections.map(s => ({
                  value: String(s.id),
                  label: `${s.name || 'شعبة'} — ${s.instructor?.name || '-'} ${secScheduleLabel(s) ? `(${secScheduleLabel(s)})` : ''} (${s._count?.students || 0} طالب)`
                })),
                !crsCrs || sections.length === 0
              )}
              {crsCat && (
                <button className="glass-btn secondary sm" onClick={resetCoursePath}
                  style={{ fontSize: '0.75rem', padding: '6px 12px', marginBottom: 1 }}>
                  <X size={12} /> إعادة تعيين
                </button>
              )}
            </div>
            {loadingSections && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>جارٍ تحميل الشعب...</div>}
            {!loadingSections && crsCrs && !crsSec && sections.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>لا توجد شعب متاحة لهذه الدورة</div>
            )}
          </div>
        )}
      </div>

      {/* ── Grades Table ── */}
      {selectedSection && selectedSectionInfo && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid var(--glass-border)', background: 'var(--card-bg)', flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GraduationCap size={18} style={{ color: 'var(--primary)' }} />
              <strong style={{ fontSize: '0.95rem' }}>{selectedSectionInfo.course.name}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                شعبة: {selectedSectionInfo.name || '-'} | محاضر: {selectedSectionInfo.instructor?.name || '-'}
              </span>
              <span className="badge primary" style={{ fontSize: '0.75rem', padding: '2px 10px' }}>
                {sectionEnrollments.length} طالب
              </span>
              {gradeApprovedByAdmin && (
                <span className="badge success" style={{ fontSize: '0.75rem' }}>
                  <Lock size={11} /> معتمد نهائياً
                </span>
              )}
              {gradeApprovedByInstructor && !gradeApprovedByAdmin && (
                <span className="badge warning" style={{ fontSize: '0.75rem' }}>
                  <CheckCircle size={11} /> معتمد من المحاضر
                </span>
              )}
              {!gradeApprovedByInstructor && !instructorCanEdit && (
                <span className="badge danger" style={{ fontSize: '0.75rem' }}>
                  <Lock size={11} /> مقفول
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {hasEdits && instructorCanEdit && !gradeApprovedByInstructor && (
                <button className="glass-btn primary sm" onClick={saveGrades} disabled={saving}>
                  <Save size={14} style={{ marginLeft: 6 }} />
                  {saving ? 'جاري الحفظ...' : 'حفظ العلامات'}
                </button>
              )}
              {instructorCanEdit && !gradeApprovedByInstructor && (
                <button className="glass-btn success sm" onClick={async () => {
                  setApproving(true);
                  try {
                    await apiFetch(`/grades/approve-instructor/${selectedSection}`, { method: 'POST' });
                    toast.success('تم اعتماد العلامات من قبل المحاضر');
                    setInstructorCanEdit(false);
                    setGradeApprovedByInstructor(true);
                    const data = await apiFetch(`/grades/section/${selectedSection}/students`);
                    if (data.enrollments) setSectionEnrollments(data.enrollments);
                  } catch (e: any) { toast.error(e.message); }
                  finally { setApproving(false); }
                }} disabled={approving}>
                  <CheckCircle size={14} style={{ marginLeft: 6 }} />
                  {approving ? 'جاري...' : 'اعتماد المحاضر'}
                </button>
              )}
              {!instructorCanEdit && gradeApprovedByInstructor && !gradeApprovedByAdmin && hasPermission('grades.approve') && (
                <button className="glass-btn success sm" onClick={async () => {
                  setApproving(true);
                  try {
                    await apiFetch(`/grades/approve-admin/${selectedSection}`, { method: 'POST' });
                    toast.success('تم اعتماد العلامات نهائياً');
                    setGradeApprovedByAdmin(true);
                    const data = await apiFetch(`/grades/section/${selectedSection}/students`);
                    if (data.enrollments) setSectionEnrollments(data.enrollments);
                  } catch (e: any) { toast.error(e.message); }
                  finally { setApproving(false); }
                }} disabled={approving}>
                  <Lock size={14} style={{ marginLeft: 6 }} />
                  {approving ? 'جاري...' : 'اعتماد نهائي'}
                </button>
              )}
              {hasPermission('grades.approve') && !instructorCanEdit && gradeApprovedByInstructor && (
                <button className="glass-btn secondary sm" onClick={async () => {
                  try {
                    await apiFetch(`/grades/unlock-instructor/${selectedSection}`, { method: 'POST' });
                    toast.success('تم فتح العلامات للتعديل');
                    setInstructorCanEdit(true);
                    setGradeApprovedByInstructor(false);
                  } catch (e: any) { toast.error(e.message); }
                }}>
                  <Unlock size={14} style={{ marginLeft: 6 }} /> فتح التعديل
                </button>
              )}
            </div>
          </div>

          {loadingSection && <div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>جارٍ التحميل...</div>}

          {!loadingSection && sectionEnrollments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>لا يوجد طلاب مسجلين في هذه الشعبة</div>
          )}

          {!loadingSection && sectionEnrollments.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="glass-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right', padding: '8px 12px', minWidth: 140 }}>الطالب</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: 70 }}>الرقم</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: 80 }}>العلامة (100)</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: 80 }}>تسليم مشروع</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: 60 }}>النتيجة</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: 70 }}>اعتماد</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: 70 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionEnrollments.map(enrollment => {
                    const grade = getEditGrade(enrollment);
                    const isProject = getEditIsProject(enrollment);
                    const projectResult = getEditProjectResult(enrollment);
                    const approved = getEditApproved(enrollment);
                    const calcResult = getCalcResult(enrollment);

                    return (
                      <tr key={enrollment.id} style={{
                        background: calcResult === 'PASS' ? 'rgba(16,185,129,0.04)' :
                          calcResult === 'FAIL' ? 'rgba(239,68,68,0.04)' : '',
                      }}>
                        <td style={{ textAlign: 'right', padding: '6px 12px' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--primary)' }}>
                            {enrollment.student.fullNameAr}
                          </div>
                          {enrollment.student.fullNameEn && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {enrollment.student.fullNameEn}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {enrollment.student.id}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px' }} onClick={e => e.stopPropagation()}>
                          <input className="glass-input" style={{ width: 70, textAlign: 'center', padding: '4px 0', fontSize: '0.82rem' }}
                            type="number" step="1" min="0"
                            value={isProject ? '' : grade}
                            disabled={!instructorCanEdit || isProject}
                            placeholder={isProject ? 'مشروع' : 'العلامة'}
                            onChange={e => handleGradeChange(enrollment.studentId, e.target.value ? parseFloat(e.target.value) : null)}
                            onFocus={e => e.target.select()} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <input type="checkbox" checked={isProject}
                              disabled={!instructorCanEdit}
                              onChange={e => handleProjectChange(enrollment.studentId, e.target.checked)}
                              style={{ width: 16, height: 16, cursor: instructorCanEdit ? 'pointer' : 'not-allowed', accentColor: 'var(--primary)' }} />
                            {isProject && (
                              <select className="glass-input" style={{ width: 80, padding: '4px 4px', fontSize: '0.78rem' }}
                                value={projectResult}
                                disabled={!instructorCanEdit}
                                onChange={e => { e.stopPropagation(); handleProjectResultChange(enrollment.studentId, e.target.value); }}>
                                <option value="">اختر</option>
                                <option value="PASS">ناجح</option>
                                <option value="FAIL">راسب</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px' }}>
                          <span className={`badge ${!calcResult ? 'secondary' : calcResult === 'PASS' ? 'success' : 'danger'}`}
                            style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                            {!calcResult ? '-' : calcResult === 'PASS' ? 'ناجح' : 'راسب'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={approved}
                            disabled={!instructorCanEdit}
                            onChange={e => handleApprovalChange(enrollment.studentId, e.target.checked)}
                            style={{ width: 16, height: 16, cursor: instructorCanEdit ? 'pointer' : 'not-allowed', accentColor: 'var(--primary)' }} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px', fontSize: '0.78rem' }}>
                          <span className={`badge ${enrollment.status === 'COMPLETED' ? 'success' :
                            enrollment.status === 'ENROLLED' ? 'primary' :
                            enrollment.status === 'WITHDRAWN' ? 'danger' : 'secondary'}`}
                            style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                            {enrollment.status === 'COMPLETED' ? 'مكتمل' :
                             enrollment.status === 'ENROLLED' ? 'ملتحق' :
                             enrollment.status === 'WITHDRAWN' ? 'منسحب' : enrollment.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Student Detail Modal ── */}
      {selectedStudent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20, direction: 'rtl',
        }} onClick={() => setSelectedStudent(null)}>
          <div className="glass-panel slide-in" style={{
            width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--glass-border)',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={20} style={{ color: 'var(--primary)' }} />
                  {selectedStudent.fullNameAr}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {selectedStudent.id}
                  {selectedStudent.fullNameEn && <span> | {selectedStudent.fullNameEn}</span>}
                </p>
              </div>
              <button onClick={() => setSelectedStudent(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer' }}>
                ×
              </button>
            </div>

            {loadingStudent ? (
              <div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>جارٍ التحميل...</div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: '0.9rem', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={16} style={{ color: 'var(--primary)' }} /> معلومات الطالب
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['الجنسية', selectedStudent.nationalityName || selectedStudent.nationality || '-'],
                      ['الرقم الوطني', selectedStudent.nationalId || '-'],
                      ['نوع الطالب', selectedStudent.studentType === 'UNIVERSITY' ? 'جامعي' :
                       selectedStudent.studentType === 'HIGH_SCHOOL' ? 'ثانوي' :
                       selectedStudent.studentType === 'EMPLOYEE' ? 'موظف' :
                       selectedStudent.studentType || '-'],
                      ['الجامعة', selectedStudent.universityName || '-'],
                      ['الرقم الجامعي', selectedStudent.universityId || '-'],
                    ].map(([l, v]) => (
                      <div key={l as string} className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">{l}</label>
                        <div className="glass-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{v}</div>
                      </div>
                    ))}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">حالة الطالب</label>
                      <div>
                        <span className={`badge ${selectedStudent.status === 'ACTIVE' ? 'success' :
                          selectedStudent.status === 'POSTPONED' ? 'warning' :
                          selectedStudent.status === 'WITHDRAWN' ? 'danger' : 'secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                          {selectedStudent.status === 'ACTIVE' ? 'مستمر' :
                           selectedStudent.status === 'POSTPONED' ? 'مؤجل' :
                           selectedStudent.status === 'WITHDRAWN' ? 'منسحب' :
                           selectedStudent.status === 'CANCELED' ? 'ملغي' :
                           selectedStudent.status === 'FINISHED' ? 'أنهى' : selectedStudent.status || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: '0.9rem', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    حساب المستخدم
                  </h4>
                  {studentUser ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        ['اسم المستخدم', studentUser.username],
                        ['الدور', studentUser.role === 'STUDENT' ? 'طالب' : studentUser.role],
                      ].map(([l, v]) => (
                        <div key={l as string} className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">{l}</label>
                          <div className="glass-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{v}</div>
                        </div>
                      ))}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">حالة الحساب</label>
                        <div>
                          <span className={`badge ${studentUser.status === 'ACTIVE' ? 'success' : 'danger'}`}
                            style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                            {studentUser.status === 'ACTIVE' ? 'نشط' : 'معطل'}
                          </span>
                        </div>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">الصلاحيات</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {studentUser.permissions.length > 0 ? studentUser.permissions.map((p: string) => (
                            <span key={p} className="badge primary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{p}</span>
                          )) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>-</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, opacity: 0.5, fontSize: '0.9rem' }}>
                      لا يوجد حساب مستخدم مرتبط
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ fontSize: '0.9rem', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} style={{ color: 'var(--primary)' }} /> العلامات
                  </h4>
                  {studentGrades.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="glass-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'right', padding: '6px 10px' }}>المادة</th>
                            <th style={{ textAlign: 'center', padding: '6px 6px', width: 50 }}>الشعبة</th>
                            <th style={{ textAlign: 'center', padding: '6px 6px', width: 60 }}>العلامة</th>
                            <th style={{ textAlign: 'center', padding: '6px 6px', width: 70 }}>مشروع</th>
                            <th style={{ textAlign: 'center', padding: '6px 6px', width: 55 }}>النتيجة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentGrades.map((g: any) => {
                            const gResult = g.isProject ? g.result :
                              (g.grade !== null && g.grade !== undefined ? (g.grade >= 50 ? 'PASS' : 'FAIL') : null);
                            return (
                              <tr key={g.id}>
                                <td style={{ textAlign: 'right', padding: '6px 10px' }}>{g.section?.course?.name || '-'}</td>
                                <td style={{ textAlign: 'center', padding: '6px 6px' }}>{g.section?.name || '-'}</td>
                                <td style={{ textAlign: 'center', padding: '6px 6px' }}>{g.isProject ? '-' : (g.grade ?? '-')}</td>
                                <td style={{ textAlign: 'center', padding: '6px 6px' }}>{g.isProject ? (g.result === 'PASS' ? 'ناجح' : g.result === 'FAIL' ? 'راسب' : '✓') : '-'}</td>
                                <td style={{ textAlign: 'center', padding: '6px 6px' }}>
                                  <span className={`badge ${!gResult ? 'secondary' : gResult === 'PASS' ? 'success' : 'danger'}`}
                                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                    {!gResult ? '-' : gResult === 'PASS' ? 'ناجح' : 'راسب'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20, opacity: 0.5, fontSize: '0.9rem' }}>
                      لا توجد علامات مسجلة
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
