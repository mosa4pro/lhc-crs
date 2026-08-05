import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, Plus, BookOpen, Search, Trash2, X, Pencil, DollarSign, Clock, AlertCircle, Building2, Layers, Settings2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { ViewToggleButton } from '../components/ViewToggleButton';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import { ConfirmModal } from '../components/ConfirmModal';
import { normalizeDigits, highlightMatch } from '../utils/constants';

interface CourseCategory { id: number; name: string; nameAr: string | null; }
interface EducationalEntity { id: number; name: string; }
interface Course {
  id: string;
  name: string;
  categoryId: number;
  category?: { id: number; name: string; nameAr: string | null };
  entity?: { id: number; name: string } | null;
  entityId?: number | null;
  hours: number;
  price: number;
  minPayment: number;
  duration: string;
  description: string;
  status: string;
}

const statusOpts = [
  { value: 'ACTIVE', label: '🟢 فعالة' },
  { value: 'COMPLETED', label: '🔵 منتهية' },
  { value: 'SUSPENDED', label: '🟡 معلقة' },
];

export const ManageCoursesPage = () => {
  const { token, hasPermission } = useAuth();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [entities, setEntities] = useState<EducationalEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState('');
  const [splitPos, setSplitPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showList, setShowList] = useState(true);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CourseCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', nameAr: '' });
  const [savingCat, setSavingCat] = useState(false);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({ name: '', categoryId: 1, hours: 0, price: 0, minPayment: 0, duration: '', description: '', entityId: '' });

  const resetForm = () => {
    setFormData({ name: '', categoryId: 1, hours: 0, price: 0, minPayment: 0, duration: '', description: '', entityId: '' });
    setEditingCourse(null);
  };

  const handleEditCourse = (c: Course) => {
    setEditingCourse(c);
    setFormData({
      name: c.name,
      categoryId: c.categoryId,
      hours: c.hours,
      price: c.price,
      minPayment: c.minPayment,
      duration: c.duration || '',
      description: c.description || '',
      entityId: String(c.entityId || '')
    });
  };

  const fetchData = async () => {
    try {
      const [crsRes, catRes, entRes] = await Promise.all([
        fetch(API_BASE + '/api/courses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API_BASE + '/api/courses/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API_BASE + '/api/educational-entities', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (crsRes.ok) setCourses(await crsRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (entRes.ok) setEntities(await entRes.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSave = async () => {
    if (!formData.name) return toast.error('تنبيه', 'يرجى إدخال اسم الدورة');
    if (!formData.entityId) return toast.error('تنبيه', 'يرجى اختيار الجهة التعليمية');
    if (formData.hours < 0) return toast.error('تنبيه', 'يرجى إدخال عدد الساعات');
    if (formData.price < 0) return toast.error('تنبيه', 'يرجى إدخال السعر');
    if (formData.minPayment < 0) return toast.error('تنبيه', 'يرجى إدخال الحد الأدنى للدفع');

    const exists = courses.some(c => c.name === formData.name && c.categoryId === formData.categoryId && (!editingCourse || c.id !== editingCourse.id));
    if (exists) return toast.error('خطأ', 'يوجد دورة بنفس الاسم في هذا التصنيف بالفعل');

    setIsLoading(true);
    try {
      const isEdit = !!editingCourse;
      const url = isEdit ? `${API_BASE}/api/courses/${editingCourse!.id}` : API_BASE + '/api/courses';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success(isEdit ? 'تم التعديل' : 'تمت الإضافة', isEdit ? 'تم تحديث الدورة بنجاح' : 'تم إضافة الدورة بنجاح');
        fetchData();
        resetForm();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error('خطأ', err.error || 'حدث خطأ أثناء الحفظ');
      }
    } catch { toast.error('خطأ', 'تعذر الاتصال بالخادم'); }
    finally { setIsLoading(false); }
  };

  const handleStatusUpdate = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/courses/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: editingStatus })
      });
      if (res.ok) { toast.success('تم التحديث', 'تم تغيير الحالة بنجاح'); fetchData(); }
      else toast.error('خطأ', 'فشل تحديث الحالة');
    } catch { toast.error('خطأ', 'تعذر الاتصال بالخادم'); }
    finally { setEditingId(null); }
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try { await fetch(`${API_BASE}/api/courses/${confirmDeleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); fetchData(); }
    catch (err) { console.error(err); }
    finally { setConfirmDeleteId(null); }
  };

  const handleResetFilters = () => { setSearchQuery(''); setFilterCategory(''); setFilterEntity(''); setFilterStatus(''); };

  const filtered = useMemo(() => courses.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && c.categoryId !== Number(filterCategory)) return false;
    if (filterEntity && c.entityId !== Number(filterEntity)) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  }), [courses, searchQuery, filterCategory, filterEntity, filterStatus]);

  const uniqueEntities = useMemo(() => {
    const map = new Map<number, string>();
    courses.forEach(c => { if (c.entity) map.set(c.entity.id, c.entity.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [courses]);

  const anyFilterActive = searchQuery || filterCategory || filterEntity || filterStatus;

  /* ── Resizable splitter ── */
  const handleSplitMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = el.getBoundingClientRect();
      let pct = ((rect.right - clientX) / rect.width) * 100;
      pct = Math.max(25, Math.min(75, pct));
      setSplitPos(pct);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging]);

  const categoryName = (id: number) => {
    const cat = categories.find(c => c.id === id);
    return cat?.nameAr || cat?.name || '—';
  };

  const openAddCat = () => { setEditingCat(null); setCatForm({ name: '', nameAr: '' }); setCatModalOpen(true); };

  const openEditCat = (cat: CourseCategory) => { setEditingCat(cat); setCatForm({ name: cat.name, nameAr: cat.nameAr || '' }); setCatModalOpen(true); };

  const handleSaveCat = async () => {
    if (!catForm.name) return toast.error('تنبيه', 'يرجى إدخال اسم التصنيف');
    setSavingCat(true);
    try {
      const isEdit = !!editingCat;
      const url = isEdit ? `${API_BASE}/api/courses/categories/${editingCat!.id}` : API_BASE + '/api/courses/categories';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(catForm)
      });
      if (res.ok) {
        toast.success(isEdit ? 'تم التعديل' : 'تمت الإضافة', isEdit ? 'تم تحديث التصنيف' : 'تم إضافة التصنيف');
        setCatModalOpen(false);
        const catRes = await fetch(API_BASE + '/api/courses/categories', { headers: { Authorization: `Bearer ${token}` } });
        if (catRes.ok) setCategories(await catRes.json());
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error('خطأ', err.error || 'فشل الحفظ');
      }
    } catch { toast.error('خطأ', 'تعذر الاتصال بالخادم'); }
    finally { setSavingCat(false); }
  };

  const handleDeleteCat = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/courses/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        toast.success('تم الحذف', 'تم حذف التصنيف');
        setCatModalOpen(false);
        const catRes = await fetch(API_BASE + '/api/courses/categories', { headers: { Authorization: `Bearer ${token}` } });
        if (catRes.ok) setCategories(await catRes.json());
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error('خطأ', err.error || 'فشل الحذف');
      }
    } catch { toast.error('خطأ', 'تعذر الاتصال بالخادم'); }
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><BookOpen className="text-primary" size={22} /> إدارة الدورات التدريبية</h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={16} style={{ opacity: 0.5 }} />
          إجمالي <strong style={{ color: 'var(--primary)' }}>{courses.length}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} color="var(--primary)" />
          {editingCourse ? 'تعديل دورة تدريبية' : 'إضافة دورة تدريبية'}
        </span>
        <ViewToggleButton
          active={showList}
          onClick={() => setShowList(v => !v)}
          icon={showList ? <BookOpen size={16} /> : <EyeOff size={16} />}
          label={showList ? 'قائمة الدورات' : 'إظهار القائمة'}
          title={showList ? 'إخفاء قائمة الدورات' : 'إظهار قائمة الدورات'}
        />
      </div>

      <div ref={containerRef} style={{
        display: 'flex', gap: 0, alignItems: 'flex-start', position: 'relative',
        userSelect: isDragging ? 'none' : undefined,
        cursor: isDragging ? 'col-resize' : undefined
      }}>
        {/* ═══ RIGHT: Form ═══ */}
        <div style={{ width: showList ? `${splitPos}%` : '100%', flexShrink: 0, paddingLeft: showList ? '12px' : 0, transition: 'width 0.3s ease' }}>
          <div className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={22} className="text-primary" /> {editingCourse ? 'تعديل الدورة' : 'إضافة دورة تدريبية'}
              </h3>
              {editingCourse && (
                <button className="glass-btn secondary sm" onClick={resetForm} style={{ fontSize: '0.72rem' }}>
                  <X size={12} /> إلغاء
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">اسم الدورة <span className="required-star">*</span></label>
              <input type="text" className="glass-input" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: دورة البرمجة المتقدمة" />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">
                  <Layers size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                  التصنيف
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="glass-input" value={formData.categoryId} style={{ flex: 1 }}
                    onChange={e => setFormData({ ...formData, categoryId: Number(e.target.value) })}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
                  </select>
                  {hasPermission('courses.manage') && (
                    <button className="glass-btn icon-only sm secondary" onClick={openAddCat} title="إدارة التصنيفات" style={{ padding: 6, flexShrink: 0 }}>
                      <Settings2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <Building2 size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                  جهة التعليم <span className="required-star">*</span>
                </label>
                <select className="glass-input" value={formData.entityId}
                  onChange={e => setFormData({ ...formData, entityId: e.target.value })}>
                  <option value="">-- اختر جهة تعليمية --</option>
                  {entities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                </select>
              </div>
            </div>

            <div className="divider" />

            <h4 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <DollarSign size={16} className="text-success" /> البيانات المالية والتسعير
            </h4>

              <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">السعر الأساسي</label>
                <div style={{ position: 'relative' }}>
                  <input type="text" inputMode="decimal" className="glass-input" value={formData.price || ''}
                    onChange={e => { const v = normalizeDigits(e.target.value).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); setFormData({ ...formData, price: v ? parseFloat(v) : 0 }); }}
                    placeholder="0.00" style={{ paddingLeft: 30, textAlign: 'center' }} />
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>د.أ</span>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">الحد الأدنى</label>
                <div style={{ position: 'relative' }}>
                  <input type="text" inputMode="decimal" className="glass-input" value={formData.minPayment || ''}
                    onChange={e => { const v = normalizeDigits(e.target.value).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); setFormData({ ...formData, minPayment: v ? parseFloat(v) : 0 }); }}
                    placeholder="0.00" style={{ paddingLeft: 30, textAlign: 'center' }} />
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>د.أ</span>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  <Clock size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} />
                  الساعات
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="text" inputMode="numeric" className="glass-input" value={formData.hours || ''}
                    onChange={e => { const v = normalizeDigits(e.target.value).replace(/\D/g, ''); setFormData({ ...formData, hours: v ? parseInt(v) : 0 }); }}
                    placeholder="0" style={{ paddingLeft: 22, textAlign: 'center' }} />
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>س</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">المدة الزمنية</label>
              <input type="text" className="glass-input" placeholder="مثال: شهرين" value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: e.target.value })} />
            </div>

            <div className="divider" />

            <div className="form-group">
              <label className="form-label">الوصف التفصيلي</label>
              <textarea className="glass-input" rows={3} value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف مختصر لمحتوى الدورة ومخرجاتها..." />
            </div>

            {(hasPermission('courses.add') || hasPermission('courses.edit')) && (
              <button className="glass-btn" style={{ width: '100%' }} onClick={handleSave} disabled={isLoading}>
                <Save size={18} /> {isLoading ? 'جاري الحفظ...' : editingCourse ? 'تحديث الدورة' : 'حفظ الدورة'}
              </button>
            )}
          </div>
        </div>

        {/* ═══ Draggable Divider ═══ */}
        {showList && (
        <div onMouseDown={handleSplitMouseDown} onTouchStart={handleSplitMouseDown} style={{
          width: '10px', flexShrink: 0, cursor: 'col-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 10, margin: '0 -1px',
        }}>
          <div style={{
            width: '3px', height: '100%', minHeight: '300px', borderRadius: '2px',
            background: isDragging ? 'var(--primary)' : 'var(--glass-border)',
            transition: isDragging ? 'none' : 'background 0.2s',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 20, height: 32, borderRadius: 4,
              background: isDragging ? 'var(--primary)' : 'var(--card-bg)',
              border: `1px solid ${isDragging ? 'var(--primary)' : 'var(--glass-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, transition: 'all 0.15s',
              boxShadow: isDragging ? '0 0 12px rgba(99,102,241,0.3)' : '0 2px 6px rgba(0,0,0,0.08)'
            }}>
              <div style={{ width: 2, height: 12, borderRadius: 1, background: isDragging ? '#fff' : 'var(--text-muted)' }} />
              <div style={{ width: 2, height: 12, borderRadius: 1, background: isDragging ? '#fff' : 'var(--text-muted)' }} />
            </div>
          </div>
        </div>
        )}

        {/* ═══ LEFT: Search & List ═══ */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '12px', display: showList ? undefined : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="glass-panel">
              <h3 style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={18} className="text-secondary" /> الدورات المسجلة
                <span className="badge primary" style={{ marginRight: 'auto', fontSize: '0.72rem' }}>{courses.length}</span>
              </h3>

              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input ref={searchRef} type="text" className="glass-input" style={{ paddingRight: 38, paddingLeft: searchQuery ? 32 : 12 }}
                  placeholder="ابحث باسم الدورة أو الرمز... ( / للبحث)" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && setSearchQuery('')} />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2
                  }}><X size={14} /></button>
                )}
              </div>

              {searchQuery && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  عرض <strong style={{ color: 'var(--primary)' }}>{filtered.length}</strong> من <strong>{courses.length}</strong> دورة
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <select className="glass-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ fontSize: '0.82rem', flex: 1 }}>
                  <option value="">التصنيف: الكل</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
                </select>
                <select className="glass-input" value={filterEntity} onChange={e => setFilterEntity(e.target.value)} style={{ fontSize: '0.82rem', flex: 1 }}>
                  <option value="">جهة التعليم: الكل</option>
                  {uniqueEntities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                </select>
                <select className="glass-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: '0.82rem', flex: 1 }}>
                  <option value="">الحالة: الكل</option>
                  {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {anyFilterActive && (
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="glass-btn secondary sm" onClick={handleResetFilters} style={{ fontSize: '0.78rem' }}>
                    <X size={13} /> إلغاء التصفية
                  </button>
                </div>
              )}
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 0' }}>
                  <BookOpen size={42} />
                  <p style={{ margin: '12px 0 4px', fontWeight: 600 }}>لا توجد دورات</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {courses.length === 0 ? 'لم يتم إضافة أي دورة بعد' : 'لا توجد نتائج تطابق البحث'}
                  </p>
                </div>
              ) : (
                <div className="glass-table-container" style={{ border: 'none' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>الرمز</th>
                        <th>الاسم</th>
                        <th style={{ width: 100 }}>التصنيف</th>
                        <th style={{ width: 100 }}>الجهة</th>
                        <th style={{ width: 80 }}>السعر</th>
                        <th style={{ width: 80 }}>الحالة</th>
                        <th style={{ width: 55 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                       {filtered.map(c => (
                         <tr key={c.id}
                           onClick={() => hasPermission('courses.edit') && handleEditCourse(c)}
                           style={{ cursor: hasPermission('courses.edit') ? 'pointer' : undefined }}>
                           <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>{c.id}</td>
                           <td>
                             <div style={{ fontWeight: 700 }}>{c.name}</div>
                             <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                               <Clock size={10} /> {c.hours} ساعة {c.duration ? `• ${c.duration}` : ''}
                             </div>
                           </td>
                           <td style={{ fontSize: '0.75rem' }}>
                             <span className="badge secondary" style={{ fontSize: '0.68rem' }}>{c.category?.nameAr || c.category?.name || '—'}</span>
                           </td>
                           <td style={{ fontSize: '0.75rem' }}>{c.entity?.name || '—'}</td>
                           <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                             {Number(c.price).toLocaleString()} د.أ
                           </td>
                           <td onClick={e => e.stopPropagation()}>
                             {editingId === c.id ? (
                               <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                 <select className="glass-input" style={{ fontSize: '0.72rem', padding: '3px 5px', width: 85 }}
                                   value={editingStatus} onChange={e => setEditingStatus(e.target.value)}>
                                   {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                 </select>
                                 <button className="glass-btn sm" style={{ padding: '2px 7px', fontSize: '0.68rem' }} onClick={() => handleStatusUpdate(c.id)}>حفظ</button>
                                 <button className="glass-btn sm secondary" style={{ padding: '2px 7px', fontSize: '0.68rem' }} onClick={() => setEditingId(null)}>X</button>
                               </div>
                             ) : (
                               <span className={`badge ${c.status === 'ACTIVE' ? 'success' : c.status === 'COMPLETED' ? 'secondary' : 'warning'}`}
                                 style={{ fontSize: '0.68rem', cursor: 'pointer' }}
                                 onClick={(e) => { e.stopPropagation(); if (hasPermission('courses.edit')) { setEditingId(c.id); setEditingStatus(c.status); } }}>
                                 {c.status === 'ACTIVE' ? 'فعالة' : c.status === 'COMPLETED' ? 'منتهية' : 'معلقة'}
                               </span>
                             )}
                           </td>
                           <td onClick={e => e.stopPropagation()}>
                             <div style={{ display: 'flex', gap: 3 }}>
                               {editingId !== c.id && hasPermission('courses.edit') && (
                                 <button className="glass-btn icon-only sm secondary" style={{ padding: 4 }}
                                   onClick={() => { setEditingId(c.id); setEditingStatus(c.status); }} title="تغيير الحالة">
                                   <Pencil size={12} />
                                 </button>
                               )}
                              {hasPermission('courses.delete') && (
                                <button className="glass-btn icon-only sm secondary" style={{ padding: 4, color: 'var(--danger)' }}
                                  onClick={() => handleDelete(c.id)} title="حذف">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Management Modal ── */}
      {catModalOpen && (
        <div className="modal-overlay" onClick={() => setCatModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Layers size={18} className="text-primary" /> {editingCat ? 'تعديل التصنيف' : 'إضافة تصنيف'}</h3>
              <button className="glass-btn icon-only sm secondary" onClick={() => setCatModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">الاسم (إنجليزي) <span className="required-star">*</span></label>
                <input type="text" className="glass-input" value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="مثال: PROGRAMMING" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">الاسم (عربي)</label>
                <input type="text" className="glass-input" value={catForm.nameAr}
                  onChange={e => setCatForm({ ...catForm, nameAr: e.target.value })}
                  placeholder="مثال: برمجة" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="glass-btn" style={{ flex: 1 }} onClick={handleSaveCat} disabled={savingCat}>
                  <Save size={16} /> {savingCat ? 'جاري الحفظ...' : editingCat ? 'تحديث' : 'إضافة'}
                </button>
                {editingCat && (
                  <button className="glass-btn secondary" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm('حذف هذا التصنيف؟')) handleDeleteCat(editingCat.id); }}>
                    <Trash2 size={16} /> حذف
                  </button>
                )}
              </div>
              {categories.length > 0 && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>التصنيفات الحالية</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {categories.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', cursor: 'pointer', fontSize: '0.85rem' }}
                        onClick={() => openEditCat(c)}>
                        <span>{c.nameAr || c.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({c.name})</span></span>
                        <Pencil size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmDeleteId !== null} message="هل أنت متأكد من حذف هذه الدورة؟" confirmText="حذف" danger onConfirm={handleConfirmDelete} onCancel={() => setConfirmDeleteId(null)} />
    </div>
  );
};
