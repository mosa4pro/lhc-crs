import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Briefcase, Save, Users, Award, Clock, DollarSign, RefreshCw, Trash2, Search, ChevronLeft, ChevronRight, GraduationCap, Phone, Mail, Star, CreditCard, IdCard, Edit2, X, BookOpen, Camera, Image as ImageIcon, Eye } from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { normalizeDigits } from '../utils/constants';
import { DateField } from '../components/DateField';
import { ConfirmModal } from '../components/ConfirmModal';

// ==========================================
// Types
// ==========================================
interface Employee {
  id: string; fullName: string; phone?: string; email?: string;
  type: string; baseSalary: number; commissionType: string; commissionValue: number;
  status: string; notes?: string; workPhone?: string; personalPhone?: string;
  address?: string; confirmationDate?: string; jobRole?: string;
  dateOfBirth?: string; nationalId?: string; idImages?: string;
  hasSocialInsurance?: boolean; contractImages?: string;
}

interface Instructor {
  id: string; name: string; specialization?: string; phone?: string;
  email?: string; courseRate?: number; notes?: string; status?: string;
  paymentMethod?: string; iban?: string; employmentType?: string;
  salaryType?: string; fixedSalary?: number; hourlyRate?: number;
}

const EMPTY_EMP: Partial<Employee> = {
  type: 'FULL_TIME', commissionType: 'NONE',
  baseSalary: 0, commissionValue: 0, status: 'ACTIVE',
};

const EMPTY_INS: Instructor = {
  id: '', name: '', specialization: '', phone: '', email: '',
  courseRate: 0, paymentMethod: 'PER_COURSE', iban: '',
  notes: '', status: 'ACTIVE', employmentType: 'PART_TIME',
  salaryType: 'PER_COURSE', fixedSalary: 0, hourlyRate: 0,
};

type Tab = 'employees' | 'instructors';

const token = () => localStorage.getItem('token');
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const IMG_API = API_BASE;

function fileUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  if (filePath.startsWith('/uploads/')) return `${IMG_API}/api/files/${filePath.replace('/uploads/', '')}`;
  return filePath;
}

// Temporary upload — returns URL
async function uploadTempImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${IMG_API}/api/employees/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
    body: formData,
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'فشل رفع الصورة'); }
  const data = await res.json();
  return data.url;
}

// ==========================================
// DropZone Component
// ==========================================
interface DropZoneProps {
  label: string;
  subtitle?: string;
  imgPath: string;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onPreview?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ label, subtitle, imgPath, isUploading, onUpload, onPreview, onDelete, compact }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  };

  if (imgPath) {
    const s = compact ? { width: 100, height: 90 } : { width: '100%', height: 110 };
    return (
      <div style={{ position: 'relative', ...s }}>
        <img src={fileUrl(imgPath)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
          {onPreview && (
            <button type="button" onClick={onPreview} style={{
              background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6,
              padding: '4px 6px', cursor: 'pointer', color: '#fff', lineHeight: 1,
            }}><Eye size={14} /></button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} style={{
              background: 'rgba(220,38,38,0.75)', border: 'none', borderRadius: 6,
              padding: '4px 6px', cursor: 'pointer', color: '#fff', lineHeight: 1,
            }}><X size={14} /></button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setDrag(false); }}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      style={{
        width: compact ? 100 : '100%', height: compact ? 90 : 110, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${drag ? 'var(--primary)' : 'var(--glass-border)'}`,
        borderRadius: 8, background: drag ? 'rgba(99,102,241,0.08)' : 'var(--glass-bg)',
        transition: 'all 0.2s', gap: 4,
      }}
    >
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
      />
      {isUploading ? (
        <>
          <div style={{ width: 22, height: 22, border: '3px solid var(--glass-border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>جاري الضغط...</span>
        </>
      ) : (
        <>
          <ImageIcon size={compact ? 20 : 28} color={drag ? 'var(--primary)' : 'var(--text-secondary)'} />
          <span style={{ fontSize: compact ? '0.7rem' : '0.8rem', color: drag ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
            {drag ? 'أفلت هنا' : label}
          </span>
          {subtitle && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{subtitle}</span>}
        </>
      )}
    </div>
  );
};

export const AdminEmployeesPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('employees');

  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empSelected, setEmpSelected] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<Partial<Employee>>(EMPTY_EMP);
  const [empSearch, setEmpSearch] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [empPage, setEmpPage] = useState(1);

  // Instructors state
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [insSelected, setInsSelected] = useState<Instructor | null>(null);
  const [insForm, setInsForm] = useState<Instructor>(EMPTY_INS);
  const [insSearch, setInsSearch] = useState('');
  const [insPage, setInsPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: Tab; item: Employee | Instructor } | null>(null);
  const [autoCreateUserId, setAutoCreateUserId] = useState<number | null>(null);
  const [cardInstructor, setCardInstructor] = useState<Instructor | null>(null);

  // Image upload state
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const pageSize = 8;

  // Resizable splitter
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('emp-split-percent');
    return saved ? parseFloat(saved) : 45;
  });
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitPercentRef = useRef(splitPercent);
  splitPercentRef.current = splitPercent;

  useEffect(() => { loadEmployees(); loadInstructors(); }, []);

  useEffect(() => {
    if (autoCreateUserId) window.location.hash = '#/admin/users?newEmployeeId=' + autoCreateUserId;
  }, [autoCreateUserId]);

  const loadEmployees = async () => {
    try {
      const res = await apiFetch('/employees');
      setEmployees(Array.isArray(res) ? res : (res.data || []));
    } catch (e: any) { toast.error('خطأ في تحميل الموظفين', e.message); }
  };

  const loadInstructors = async () => {
    try {
      setInstructors(await apiFetch('/instructors'));
    } catch (e: any) { toast.error('خطأ في تحميل المحاضرين', e.message); }
  };

  // ===== Employee handlers =====
  const empSelect = (e: Employee) => { setEmpSelected(e); setEmpForm({ ...e }); };
  const empNew = () => { setEmpSelected(null); setEmpForm({ ...EMPTY_EMP }); };
  const empSet = (key: keyof Employee, val: any) => setEmpForm(prev => ({ ...prev, [key]: val }));

  const empSave = async () => {
    if (!empForm.fullName?.trim()) { toast.error('الاسم مطلوب'); return; }
    setIsLoading(true);
    try {
      if (empSelected) {
        await apiFetch(`/employees/${empSelected.id}`, { method: 'PUT', body: JSON.stringify(empForm) });
        toast.success('تم التعديل ✓');
      } else {
        const res = await apiFetch('/employees', { method: 'POST', body: JSON.stringify(empForm) });
        toast.success('تمت الإضافة ✓');
        setAutoCreateUserId(res.id);
      }
      await loadEmployees(); empNew();
    } catch (e: any) { toast.error('فشل الحفظ', e.message); }
    finally { setIsLoading(false); }
  };

  // ===== Image handlers (generic upload — works before/after saving) =====
  const getEmpImages = (emp: Partial<Employee>, type: 'id' | 'contract'): string[] => {
    const raw = type === 'id' ? emp.idImages : emp.contractImages;
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  };

  const setEmpImages = (type: 'id' | 'contract', images: string[]) => {
    const key = type === 'id' ? 'idImages' : 'contractImages';
    empSet(key as any, JSON.stringify(images));
  };

  const handleLocalUpload = async (type: 'idFront' | 'idBack' | 'contract', file: File) => {
    setUploadingType(type);
    try {
      const url = await uploadTempImage(file);
      const images = getEmpImages(empForm, type === 'contract' ? 'contract' : 'id');

      if (type === 'contract') {
        setEmpImages('contract', [...images, url]);
      } else if (type === 'idFront') {
        setEmpImages('id', [url, images[1] || '']);
      } else {
        setEmpImages('id', [images[0] || '', url]);
      }

      toast.success('تم رفع الصورة بنجاح');
    } catch (err: any) {
      toast.error('خطأ في رفع الصورة', err.message);
    } finally {
      setUploadingType(null);
    }
  };

  const handleLocalDelete = (type: 'idFront' | 'idBack' | 'contract', index: number) => {
    const images = getEmpImages(empForm, type === 'contract' ? 'contract' : 'id');
    images.splice(index, 1);
    setEmpImages(type === 'contract' ? 'contract' : 'id', images);
  };

  // ===== Instructor handlers =====
  const insSelect = (inst: Instructor) => { setInsSelected(inst); setInsForm({ ...inst }); };
  const insNew = () => { setInsSelected(null); setInsForm({ ...EMPTY_INS }); };
  const insSet = (key: keyof Instructor, val: any) => setInsForm(prev => ({ ...prev, [key]: val }));

  const insSave = async () => {
    if (!insForm.name?.trim()) { toast.error('اسم المحاضر مطلوب'); return; }
    setIsLoading(true);
    try {
      if (insSelected) {
        await apiFetch(`/instructors/${insSelected.id}`, { method: 'PUT', body: JSON.stringify(insForm) });
        toast.success('تم التعديل ✓');
      } else {
        await apiFetch('/instructors', { method: 'POST', body: JSON.stringify(insForm) });
        toast.success('تمت الإضافة ✓');
      }
      await loadInstructors(); insNew();
    } catch (e: any) { toast.error('فشل الحفظ', e.message); }
    finally { setIsLoading(false); }
  };

  // ===== Delete =====
  const handleDelete = (type: Tab, item: Employee | Instructor) => setConfirmDelete({ type, item });
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      const { type, item } = confirmDelete;
      if (type === 'employees') {
        await apiFetch(`/employees/${item.id}`, { method: 'DELETE' });
        toast.success('تم حذف الموظف');
        await loadEmployees();
        if (empSelected?.id === item.id) empNew();
      } else {
        await apiFetch(`/instructors/${item.id}`, { method: 'DELETE' });
        toast.success('تم حذف المحاضر');
        await loadInstructors();
        if (insSelected?.id === item.id) insNew();
      }
    } catch (err: any) { toast.error('فشل الحذف', err.message); }
    finally { setConfirmDelete(null); }
  };

  // ===== Filters & Pagination =====
  const filteredEmps = employees.filter(e => {
    if (empSearch) {
      const q = empSearch.toLowerCase();
      if (!e.fullName.toLowerCase().includes(q) && !(e.phone || '').toLowerCase().includes(q)) return false;
    }
    if (empFilter && e.type !== empFilter) return false;
    return true;
  });
  const empPages = Math.max(1, Math.ceil(filteredEmps.length / pageSize));
  const empPaginated = filteredEmps.slice((empPage - 1) * pageSize, empPage * pageSize);

  const filteredIns = instructors.filter(i => {
    if (!insSearch) return true;
    const q = insSearch.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.phone || '').toLowerCase().includes(q);
  });
  const insPages = Math.max(1, Math.ceil(filteredIns.length / pageSize));
  const insPaginated = filteredIns.slice((insPage - 1) * pageSize, insPage * pageSize);

  useEffect(() => { setEmpPage(1); }, [empSearch, empFilter]);
  useEffect(() => { setInsPage(1); }, [insSearch]);

  const totalSalary = employees.filter(e => e.type === 'FULL_TIME').reduce((s, e) => s + e.baseSalary, 0);

  // ===== Splitter handlers =====
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDividerDoubleClick = useCallback(() => {
    setSplitPercent(45);
    localStorage.setItem('emp-split-percent', '45');
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const fromRight = rect.right - e.clientX;
      const percent = ((fromRight - 8) / rect.width) * 100;
      setSplitPercent(Math.min(70, Math.max(35, percent)));
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('emp-split-percent', String(splitPercentRef.current));
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

  const switchTab = (t: Tab) => { setTab(t); };

  return (
    <div className="split-layout" ref={splitContainerRef} style={{ gap: 0, alignItems: 'stretch', minHeight: 'calc(100vh - 140px)' }}>

      {/* ===== FORM PANEL (RIGHT in RTL) ===== */}
      <div className="glass-panel split-panel" key={`${tab}-${insSelected?.id || 'new'}-${empSelected?.id || 'new'}`} style={{ flex: `0 0 ${splitPercent}%`, minWidth: 0, borderRadius: '0 var(--radius-lg) var(--radius-lg) 0', margin: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--card-bg)', borderRadius: 10, padding: 3, border: '1px solid var(--glass-border)' }}>
          <button onClick={() => switchTab('employees')}
            style={{
              flex: 1, padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.2s',
              background: tab === 'employees' ? 'var(--primary)' : 'transparent',
              color: tab === 'employees' ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Briefcase size={16} /> الموظفون
          </button>
          <button onClick={() => switchTab('instructors')}
            style={{
              flex: 1, padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.2s',
              background: tab === 'instructors' ? 'var(--primary)' : 'transparent',
              color: tab === 'instructors' ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <GraduationCap size={16} /> المحاضرون
          </button>
        </div>

        {tab === 'employees' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Briefcase size={20} color="var(--secondary)" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{empSelected ? `تعديل: ${empSelected.fullName}` : 'إضافة موظف جديد'}</h3>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label"><span className="required-star">*</span>الاسم الكامل</label>
              <input type="text" className="glass-input" placeholder="الاسم الرباعي" value={empForm.fullName || ''} onChange={e => empSet('fullName', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">رقم الهاتف</label>
                <input type="text" className="glass-input" placeholder="07xxxxxxxx" value={empForm.phone || ''} onChange={e => empSet('phone', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">البريد الإلكتروني</label>
                <input type="email" className="glass-input" placeholder="email@example.com" value={empForm.email || ''} onChange={e => empSet('email', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">نوع الدوام</label>
                <select className="glass-input" value={empForm.type} onChange={e => empSet('type', e.target.value)}>
                  <option value="FULL_TIME">⏰ دوام كامل</option>
                  <option value="PART_TIME">🕐 دوام جزئي</option>
                  <option value="COMMISSION">💰 عمولة</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">الوصف الوظيفي</label>
                <input type="text" className="glass-input" placeholder="مثل: مسؤول تسويق" value={empForm.jobRole || ''} onChange={e => empSet('jobRole', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">الراتب الأساسي (دينار/شهر)</label>
                <input type="number" className="glass-input" value={empForm.baseSalary || 0} disabled={empForm.type === 'PART_TIME'} onChange={e => empSet('baseSalary', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">نوع العمولة</label>
                <select className="glass-input" value={empForm.commissionType} onChange={e => empSet('commissionType', e.target.value)}>
                  <option value="NONE">❌ بدون عمولة</option>
                  <option value="FIXED_PER_STUDENT">💰 ثابت / طالب</option>
                  <option value="PERCENTAGE">📊 نسبة مئوية</option>
                </select>
              </div>
            </div>

            {empForm.commissionType !== 'NONE' && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">{empForm.commissionType === 'PERCENTAGE' ? 'نسبة (%)' : 'مبلغ (دينار/طالب)'}</label>
                <input type="number" className="glass-input" value={empForm.commissionValue || 0} onChange={e => empSet('commissionValue', parseFloat(e.target.value) || 0)} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">الحالة</label>
                <select className="glass-input" value={empForm.status} onChange={e => empSet('status', e.target.value)}>
                  <option value="ACTIVE">✅ نشط</option>
                  <option value="ON_LEAVE">⏸️ إجازة</option>
                  <option value="INACTIVE">❌ غير نشط</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">تاريخ الميلاد</label>
                <DateField value={empForm.dateOfBirth || ''} onChange={v => empSet('dateOfBirth', v)} maxYear={new Date().getFullYear()} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 14px', background: 'var(--card-bg)',
                border: '1.5px solid var(--glass-border)', borderRadius: 10,
              }}>
                <input type="checkbox" checked={empForm.hasSocialInsurance || false} onChange={e => empSet('hasSocialInsurance', e.target.checked)} style={{ width: 17, height: 17 }} />
                <span style={{ fontWeight: 600, color: empForm.hasSocialInsurance ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {empForm.hasSocialInsurance ? '✅ لديه ضمان اجتماعي' : '❌ لا يوجد ضمان اجتماعي'}
                </span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">ملاحظات</label>
              <textarea className="glass-input" rows={2} placeholder="ملاحظات إضافية..." value={empForm.notes || ''} onChange={e => empSet('notes', e.target.value)} />
            </div>

            {/* ===== صور الموظف ===== */}
            <div style={{ marginBottom: 14, padding: 16, background: 'var(--card-bg)', border: '1.5px solid var(--glass-border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <Camera size={16} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>المستندات</span>
              </div>

              {/* بطاقة الهوية */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <IdCard size={16} color="var(--secondary)" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>بطاقة الهوية</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {([
                    { key: 'idFront' as const, label: 'الوجه الأمامي', sub: 'اضغط أو اسحب الصورة' },
                    { key: 'idBack' as const, label: 'الوجه الخلفي', sub: 'اضغط أو اسحب الصورة' },
                  ]).map(({ key, label, sub }) => {
                    const images = getEmpImages(empForm, 'id');
                    const img = key === 'idFront' ? images[0] : images[1];
                    return (
                      <DropZone
                        key={key}
                        label={label}
                        subtitle={sub}
                        imgPath={img}
                        isUploading={uploadingType === key}
                        onUpload={(file) => handleLocalUpload(key, file)}
                        onPreview={() => img && setImageModal({ src: fileUrl(img), alt: `هوية - ${label}` })}
                        onDelete={() => handleLocalDelete(key, 0)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* العقد */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <BookOpen size={16} color="var(--secondary)" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>العقد</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {getEmpImages(empForm, 'contract').map((img, idx) => (
                    <DropZone
                      key={idx}
                      label={`صفحة ${idx + 1}`}
                      imgPath={img}
                      isUploading={false}
                      onPreview={() => setImageModal({ src: fileUrl(img), alt: `عقد صفحة ${idx + 1}` })}
                      onDelete={() => handleLocalDelete('contract', idx)}
                      onUpload={() => {}}
                      compact
                    />
                  ))}
                  <DropZone
                    label="إضافة صفحة"
                    subtitle="اسحب أو اختر"
                    imgPath=""
                    isUploading={uploadingType === 'contract'}
                    onUpload={(file) => handleLocalUpload('contract', file)}
                    compact
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {(empSelected ? hasPermission('employees.edit') : hasPermission('employees.add')) && (
                <button className="glass-btn" onClick={empSave} disabled={isLoading}>
                  <Save size={16} /> {isLoading ? 'جارٍ الحفظ...' : (empSelected ? 'حفظ التعديلات' : 'إضافة الموظف')}
                </button>
              )}
              {hasPermission('employees.add') && (
                <button className="glass-btn secondary" onClick={empNew}><RefreshCw size={16} /> جديد</button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <GraduationCap size={20} color="var(--secondary)" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{insSelected ? `تعديل: ${insSelected.name}` : 'إضافة محاضر جديد'}</h3>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label"><span className="required-star">*</span>الاسم الكامل</label>
              <input type="text" className="glass-input" placeholder="اسم المحاضر" value={insForm.name} onChange={e => insSet('name', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">رقم الهاتف</label>
                <input type="text" className="glass-input" placeholder="07xxxxxxxx" value={insForm.phone} onChange={e => insSet('phone', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">البريد الإلكتروني</label>
                <input type="email" className="glass-input" placeholder="email@example.com" value={insForm.email} onChange={e => insSet('email', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">التخصص</label>
                <input type="text" className="glass-input" placeholder="مثل: لغة إنجليزية" value={insForm.specialization} onChange={e => insSet('specialization', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">نوع العمل</label>
                <select className="glass-input" value={insForm.employmentType} onChange={e => insSet('employmentType', e.target.value)}>
                  <option value="FULL_TIME">دوام كامل</option>
                  <option value="PART_TIME">عمل جزئي</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">نظام الأجر</label>
              <select className="glass-input" value={insForm.salaryType} onChange={e => insSet('salaryType', e.target.value)}>
                <option value="PER_COURSE">💼 أجر لكل دورة</option>
                <option value="PER_HOUR">⏱️ أجر بالساعة</option>
                <option value="FIXED">📅 راتب شهري ثابت</option>
              </select>
            </div>

            {insForm.salaryType === 'FIXED' && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">الراتب الشهري (دينار)</label>
                <input type="number" step="0.001" className="glass-input" value={insForm.fixedSalary} onChange={e => insSet('fixedSalary', parseFloat(e.target.value) || 0)} />
              </div>
            )}
            {insForm.salaryType === 'PER_COURSE' && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">أجر الدورة (دينار)</label>
                <input type="number" step="0.001" className="glass-input" value={insForm.courseRate} onChange={e => insSet('courseRate', parseFloat(e.target.value) || 0)} />
              </div>
            )}
            {insForm.salaryType === 'PER_HOUR' && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">أجر الساعة (دينار)</label>
                <input type="number" step="0.001" className="glass-input" value={insForm.hourlyRate} onChange={e => insSet('hourlyRate', parseFloat(e.target.value) || 0)} />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">IBAN (رقم الحساب)</label>
              <input type="text" className="glass-input" dir="ltr" placeholder="JO94XXXXXXXX" value={insForm.iban} onChange={e => insSet('iban', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">الحالة</label>
              <select className="glass-input" value={insForm.status} onChange={e => insSet('status', e.target.value)}>
                <option value="ACTIVE">✅ نشط</option>
                <option value="INACTIVE">❌ غير نشط</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">ملاحظات</label>
              <textarea className="glass-input" rows={2} placeholder="ملاحظات..." value={insForm.notes} onChange={e => insSet('notes', e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="glass-btn" onClick={insSave} disabled={isLoading}>
                <Save size={16} /> {isLoading ? 'جارٍ الحفظ...' : (insSelected ? 'حفظ التعديلات' : 'إضافة المحاضر')}
              </button>
              <button className="glass-btn secondary" onClick={insNew}><RefreshCw size={16} /> جديد</button>
            </div>
          </>
        )}
      </div>

      {/* ===== RESIZABLE DIVIDER ===== */}
      <div className={`split-divider ${isDragging ? 'active' : ''}`}
        onMouseDown={handleDividerMouseDown}
        onDoubleClick={handleDividerDoubleClick}
        title="اسحب لتغيير الحجم — انقر مرتين للوضع الافتراضي"
      >
        <div className="split-divider-handle"><span /><span /><span /><span /><span /></div>
        {isDragging && <div className="split-divider-tooltip">{Math.round(splitPercent)}%</div>}
      </div>

      {/* ===== TABLE PANEL (LEFT in RTL) ===== */}
      <div className="glass-panel split-panel" style={{ flex: 1, minWidth: 0, borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)', margin: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--card-bg)', borderRadius: 10, padding: 3, border: '1px solid var(--glass-border)' }}>
          <button onClick={() => switchTab('employees')}
            style={{
              flex: 1, padding: '10px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
              background: tab === 'employees' ? 'var(--primary)' : 'transparent',
              color: tab === 'employees' ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Briefcase size={17} /> الموظفون ({employees.length})
          </button>
          <button onClick={() => switchTab('instructors')}
            style={{
              flex: 1, padding: '10px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
              background: tab === 'instructors' ? 'var(--primary)' : 'transparent',
              color: tab === 'instructors' ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <GraduationCap size={17} /> المحاضرون ({instructors.length})
          </button>
        </div>

        {tab === 'employees' ? (
          <>
            {/* Stats Cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
              <div className="stat-card blue" style={{ flex: '0 0 auto', minWidth: 130, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><Users size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{employees.length}</div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>إجمالي الموظفين</div>
                </div>
              </div>
              <div className="stat-card green" style={{ flex: '0 0 auto', minWidth: 110, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><Clock size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>{employees.filter(e => e.type === 'FULL_TIME').length}</div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>دوام كامل</div>
                </div>
              </div>
              <div className="stat-card amber" style={{ flex: '0 0 auto', minWidth: 110, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><Clock size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{employees.filter(e => e.type !== 'FULL_TIME').length}</div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>جزئي / عمولة</div>
                </div>
              </div>
              <div className="stat-card purple" style={{ flex: '0 0 auto', minWidth: 140, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><DollarSign size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--secondary)' }}>{totalSalary.toFixed(0)} د</div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>إجمالي الرواتب</div>
                </div>
              </div>
            </div>

            {/* Search + Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>قائمة الموظفين <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>({filteredEmps.length})</span></h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input type="text" className="glass-input" style={{ paddingRight: 30, paddingLeft: empSearch ? 28 : 10, width: 170, fontSize: '0.82rem' }}
                    placeholder="بحث..." value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setEmpSearch('')} />
                  {empSearch && (
                    <button onClick={() => setEmpSearch('')} style={{
                      position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2
                    }}><X size={13} /></button>
                  )}
                </div>
                <select className="glass-input" style={{ width: 120, fontSize: '0.82rem' }} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="FULL_TIME">دوام كامل</option>
                  <option value="PART_TIME">دوام جزئي</option>
                  <option value="COMMISSION">عمولة</option>
                </select>
              </div>
            </div>

            <div className="glass-table-container">
              <table className="glass-table">
                <thead><tr><th>الموظف</th><th>الهاتف</th><th>الوظيفة</th><th>نوع الدوام</th><th>الراتب</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>
                  {empPaginated.map(e => (
                    <tr key={e.id} onClick={() => empSelect(e)} className={empSelected?.id === e.id ? 'active' : ''} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>{e.fullName}</td>
                      <td style={{ fontSize: '0.83rem' }}>{e.phone || '—'}</td>
                      <td style={{ fontSize: '0.83rem' }}>{e.jobRole || '—'}</td>
                      <td><span className={`badge ${e.type === 'FULL_TIME' ? 'primary' : e.type === 'COMMISSION' ? 'secondary' : 'warning'}`} style={{ fontSize: '0.75rem' }}>{e.type === 'FULL_TIME' ? '⏰ كامل' : e.type === 'COMMISSION' ? '💰 عمولة' : '🕐 جزئي'}</span></td>
                      <td style={{ fontSize: '0.83rem' }}>{e.type === 'FULL_TIME' ? `${e.baseSalary.toFixed(0)} د` : '—'}</td>
                      <td><span className={`badge ${e.status === 'ACTIVE' ? 'success' : e.status === 'ON_LEAVE' ? 'warning' : 'danger'}`} style={{ fontSize: '0.72rem' }}>{e.status === 'ACTIVE' ? 'نشط' : e.status === 'ON_LEAVE' ? 'إجازة' : 'غير نشط'}</span></td>
                      <td onClick={ev => ev.stopPropagation()}>
                        {hasPermission('employees.delete') && (
                          <button className="glass-btn secondary sm" onClick={() => handleDelete('employees', e)} style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredEmps.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, opacity: 0.5 }}>لا يوجد موظفون</td></tr>}
                </tbody>
              </table>
            </div>

            {empPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={empPage <= 1} onClick={() => setEmpPage(p => Math.max(1, p - 1))}><ChevronRight size={15} /></button>
                {Array.from({ length: empPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pagination-btn ${p === empPage ? 'active' : ''}`} onClick={() => setEmpPage(p)}>{p}</button>
                ))}
                <button className="pagination-btn" disabled={empPage >= empPages} onClick={() => setEmpPage(p => Math.min(empPages, p + 1))}><ChevronLeft size={15} /></button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Stats Cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
              <div className="stat-card blue" style={{ flex: '0 0 auto', minWidth: 130, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><GraduationCap size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{instructors.length}</div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>إجمالي المحاضرين</div>
                </div>
              </div>
              <div className="stat-card green" style={{ flex: '0 0 auto', minWidth: 110, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><Star size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>{instructors.filter(i => i.status === 'ACTIVE').length}</div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>نشط</div>
                </div>
              </div>
              <div className="stat-card purple" style={{ flex: '0 0 auto', minWidth: 160, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div className="stat-icon" style={{ marginBottom: 0, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><DollarSign size={16} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--secondary)' }}>
                    {instructors.filter(i => i.salaryType === 'FIXED').reduce((s, i) => s + (i.fixedSalary || 0), 0).toFixed(0)} د
                  </div>
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>إجمالي الرواتب الثابتة</div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>قائمة المحاضرين <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>({filteredIns.length})</span></h3>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="text" className="glass-input" style={{ paddingRight: 30, paddingLeft: insSearch ? 28 : 10, width: 200, fontSize: '0.82rem' }}
                  placeholder="بحث بالاسم أو الهاتف..." value={insSearch} onChange={e => setInsSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && setInsSearch('')} />
                {insSearch && (
                  <button onClick={() => setInsSearch('')} style={{
                    position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2
                  }}><X size={13} /></button>
                )}
              </div>
            </div>

            <div className="glass-table-container">
              <table className="glass-table">
                <thead><tr><th>المحاضر</th><th>التخصص</th><th>الهاتف</th><th>نظام الأجر</th><th>القيمة</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>
                  {insPaginated.map(i => (
                    <tr key={i.id} onClick={() => insSelect(i)} className={insSelected?.id === i.id ? 'active' : ''} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i.name}
                        <button className="glass-btn secondary sm" style={{ padding: '2px 6px', minWidth: 0 }} onClick={ev => { ev.stopPropagation(); setCardInstructor(i); }} title="بطاقة تعريف">
                          <IdCard size={11} />
                        </button>
                      </td>
                      <td style={{ fontSize: '0.83rem' }}>{i.specialization || '—'}</td>
                      <td style={{ fontSize: '0.83rem' }}>{i.phone || '—'}</td>
                      <td style={{ fontSize: '0.83rem' }}>
                        {i.salaryType === 'FIXED' ? '📅 شهري' : i.salaryType === 'PER_HOUR' ? '⏱️ بالساعة' : '💼 لكل دورة'}
                      </td>
                      <td style={{ fontSize: '0.83rem', color: 'var(--success)', fontWeight: 600 }}>
                        {i.salaryType === 'FIXED' ? `${(i.fixedSalary || 0).toFixed(0)} د` :
                         i.salaryType === 'PER_HOUR' ? `${(i.hourlyRate || 0).toFixed(0)} د` :
                         `${(i.courseRate || 0).toFixed(0)} د`}
                      </td>
                      <td><span className={`badge ${i.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '0.72rem' }}>{i.status === 'ACTIVE' ? 'نشط' : 'غير نشط'}</span></td>
                      <td onClick={ev => ev.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                        <button className="glass-btn secondary sm" onClick={() => insSelect(i)}><Edit2 size={12} /></button>
                        <button className="glass-btn secondary sm" onClick={() => handleDelete('instructors', i)} style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredIns.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, opacity: 0.5 }}>لا يوجد محاضرون</td></tr>}
                </tbody>
              </table>
            </div>

            {insPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={insPage <= 1} onClick={() => setInsPage(p => Math.max(1, p - 1))}><ChevronRight size={15} /></button>
                {Array.from({ length: insPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pagination-btn ${p === insPage ? 'active' : ''}`} onClick={() => setInsPage(p)}>{p}</button>
                ))}
                <button className="pagination-btn" disabled={insPage >= insPages} onClick={() => setInsPage(p => Math.min(insPages, p + 1))}><ChevronLeft size={15} /></button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDelete !== null}
        message={confirmDelete ? `هل تريد حذف ${confirmDelete.type === 'employees' ? (confirmDelete.item as Employee).fullName : (confirmDelete.item as Instructor).name}؟` : ''}
        confirmText="حذف"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Instructor ID Card Modal */}
      {cardInstructor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setCardInstructor(null)}>
          <div className="glass-panel" style={{ width: 400, direction: 'rtl', overflow: 'hidden', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '20px 24px 14px', textAlign: 'center', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <IdCard size={22} />
                <button onClick={() => setCardInstructor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#fff' }}>×</button>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 6 }}>بطاقة تعريف محاضر</div>
            </div>
            <div style={{ padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cardInstructor.name}</div>
              {cardInstructor.specialization && <div style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>📚 {cardInstructor.specialization}</div>}
              <div style={{ height: 1, background: 'var(--glass-border)', margin: '2px 0' }} />
              {cardInstructor.phone && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={13} /> {cardInstructor.phone}</div>}
              {cardInstructor.email && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> {cardInstructor.email}</div>}
              <div style={{ height: 1, background: 'var(--glass-border)', margin: '2px 0' }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={13} />
                {cardInstructor.salaryType === 'FIXED' ? `${(cardInstructor.fixedSalary || 0).toFixed(0)} د/شهر` :
                 cardInstructor.salaryType === 'PER_HOUR' ? `${(cardInstructor.hourlyRate || 0).toFixed(0)} د/ساعة` :
                 `${(cardInstructor.courseRate || 0).toFixed(0)} د/دورة`}
              </div>
              {cardInstructor.iban && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', direction: 'ltr', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}><CreditCard size={13} /> {cardInstructor.iban}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <span className={`badge ${cardInstructor.status === 'ACTIVE' ? 'success' : 'danger'}`}>
                  {cardInstructor.status === 'ACTIVE' ? 'نشط' : 'غير نشط'}
                </span>
                <span className="badge secondary">{cardInstructor.salaryType === 'FIXED' ? 'راتب ثابت' : cardInstructor.salaryType === 'PER_HOUR' ? 'بالساعة' : 'لكل دورة'}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6, fontFamily: 'monospace', letterSpacing: 1, background: 'var(--card-bg)', padding: '4px 10px', borderRadius: 6 }}>
                #{cardInstructor.id}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imageModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, cursor: 'pointer',
          }}
          onClick={() => setImageModal(null)}
        >
          <button
            onClick={() => setImageModal(null)}
            style={{
              position: 'absolute', top: 20, left: 20, background: 'rgba(255,255,255,0.2)',
              border: 'none', borderRadius: '50%', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <X size={24} />
          </button>
          <img
            src={imageModal.src}
            alt={imageModal.alt}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// Spin animation for loading spinner
const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.head.querySelector('[data-dropzone-anim]')) {
  styleEl.setAttribute('data-dropzone-anim', 'true');
  document.head.appendChild(styleEl);
}
