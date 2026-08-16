import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Edit2, Trash2, RefreshCw, Send, AlertTriangle, Megaphone,
  X, Eye, EyeOff, Calendar, Users, UserCheck, Filter, Globe, Save,
  Clock, Archive, AlertCircle, CheckCircle
} from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PermissionGuard } from '../components/PermissionGuard';
import { ConfirmModal } from '../components/ConfirmModal';

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: string;
  status: string;
  targetRoles: string;
  targetUserIds: string;
  startAt: string;
  endAt: string | null;
  createdBy: { id: number; fullName: string };
  publishedAt: string | null;
  createdAt: string;
  _count: { reads: number };
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: '👑 مسؤول', color: '#6366f1' },
  { value: 'SUPERVISOR', label: '🏆 مشرف', color: '#f59e0b' },
  { value: 'EMPLOYEE', label: '👤 موظف', color: '#06b6d4' },
  { value: 'TRAINEE', label: '📋 متدرب', color: '#10b981' },
  { value: 'INSTRUCTOR', label: '📚 محاضر', color: '#8b5cf6' },
  { value: 'STUDENT', label: '🎓 طالب', color: '#3b82f6' },
];

export const AdminAnnouncementsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [confirmDel, setConfirmDel] = useState<Announcement | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'NORMAL',
    status: 'DRAFT',
    targetRoles: [] as string[],
    targetUserIds: [] as number[],
    startAt: new Date().toISOString().slice(0, 16),
    endAt: '',
  });

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/announcements');
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch {}
    finally { setIsLoading(false); }
  }, [apiFetch]);

  useEffect(() => { fetchAnnouncements(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '', content: '', type: 'NORMAL', status: 'DRAFT',
      targetRoles: [], targetUserIds: [],
      startAt: new Date().toISOString().slice(0, 16),
      endAt: '',
    });
    setShowModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    let roles: string[] = [];
    let userIds: number[] = [];
    try { roles = JSON.parse(a.targetRoles); } catch {}
    try { userIds = JSON.parse(a.targetUserIds); } catch {}
    setForm({
      title: a.title,
      content: a.content,
      type: a.type,
      status: a.status,
      targetRoles: roles,
      targetUserIds: userIds,
      startAt: new Date(a.startAt).toISOString().slice(0, 16),
      endAt: a.endAt ? new Date(a.endAt).toISOString().slice(0, 16) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('تنبيه', 'العنوان مطلوب');
    if (!form.content.trim()) return toast.error('تنبيه', 'المحتوى مطلوب');
    try {
      if (editing) {
        await apiFetch(`/announcements/${editing.id}`, {
          method: 'PUT', body: JSON.stringify(form)
        });
        toast.success('تم تحديث الإعلان');
      } else {
        await apiFetch('/announcements', {
          method: 'POST', body: JSON.stringify(form)
        });
        toast.success('تم إنشاء الإعلان');
      }
      setShowModal(false);
      fetchAnnouncements();
    } catch (e: any) { toast.error('خطأ', e.message); }
  };

  const handleDelete = async (a: Announcement) => {
    try { await apiFetch(`/announcements/${a.id}`, { method: 'DELETE' }); toast.success('تم الحذف'); fetchAnnouncements(); }
    catch (e: any) { toast.error('خطأ', e.message); }
  };

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role]
    }));
  };

  const filteredAnnouncements = announcements.filter(a => {
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    if (type === 'URGENT') return <AlertTriangle size={14} />;
    return <Megaphone size={14} />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return <span className="badge success" style={{ fontSize: '0.7rem' }}>منشور</span>;
      case 'DRAFT': return <span className="badge secondary" style={{ fontSize: '0.7rem' }}>مسودة</span>;
      case 'ARCHIVED': return <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--card-bg)', color: 'var(--text-muted)' }}>مؤرشف</span>;
      default: return <span className="badge secondary" style={{ fontSize: '0.7rem' }}>{status}</span>;
    }
  };

  return (
    <PermissionGuard perm="admin.announcements.view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Megaphone size={22} color="var(--secondary)" /> إدارة الإعلانات
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="glass-btn secondary" onClick={fetchAnnouncements} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> تحديث
            </button>
            {hasPermission('admin.announcements.add') && (
              <button className="glass-btn" onClick={openCreate}>
                <Plus size={16} /> إعلان جديد
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select className="glass-input" style={{ width: 'auto', minWidth: 120, fontSize: '0.82rem', height: 34 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">كل الحالات</option>
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشور</option>
            <option value="ARCHIVED">مؤرشف</option>
          </select>
          <select className="glass-input" style={{ width: 'auto', minWidth: 120, fontSize: '0.82rem', height: 34 }}
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="ALL">كل الأنواع</option>
            <option value="NORMAL">عادي</option>
            <option value="URGENT">عاجل</option>
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredAnnouncements.length} إعلان
          </span>
        </div>

        {/* Table */}
        <div className="glass-panel">
          <div className="glass-table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>الجمهور المستهدف</th>
                  <th>تاريخ البدء</th>
                  <th>تاريخ الانتهاء</th>
                  <th>القراءات</th>
                  <th>الناشر</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map(a => {
                  let roles: string[] = [];
                  let userIds: number[] = [];
                  try { roles = JSON.parse(a.targetRoles); } catch {}
                  try { userIds = JSON.parse(a.targetUserIds); } catch {}
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {a.type === 'URGENT' && <AlertTriangle size={14} color="#ef4444" />}
                          {a.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatDate(a.createdAt)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${a.type === 'URGENT' ? 'danger' : 'primary'}`} style={{ fontSize: '0.7rem' }}>
                          {getTypeIcon(a.type)} {a.type === 'URGENT' ? 'عاجل' : 'عادي'}
                        </span>
                      </td>
                      <td>{getStatusBadge(a.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 180 }}>
                          {userIds.length > 0 ? (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                              <Users size={10} /> {userIds.length} مستخدم
                            </span>
                          ) : roles.length === 0 ? (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--card-bg)' }}>الجميع</span>
                          ) : (
                            roles.map(r => (
                              <span key={r} className="badge" style={{ fontSize: '0.65rem', background: 'var(--card-bg)' }}>
                                {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {formatDate(a.startAt)}
                      </td>
                      <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: a.endAt ? undefined : 'var(--text-muted)' }}>
                        {a.endAt ? formatDate(a.endAt) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a._count.reads}</span>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{a.createdBy.fullName}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {hasPermission('admin.announcements.edit') && (
                            <button className="glass-btn secondary sm" onClick={() => openEdit(a)} title="تعديل">
                              <Edit2 size={13} />
                            </button>
                          )}
                          {hasPermission('admin.announcements.delete') && (
                            <button className="glass-btn secondary sm" onClick={() => setConfirmDel(a)} title="حذف" style={{ color: 'var(--danger)' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAnnouncements.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>لا توجد إعلانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
            <div className="glass-panel slide-in" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Megaphone size={18} /> {editing ? 'تعديل الإعلان' : 'إعلان جديد'}
                </h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22 }}>×</button>
              </div>

              {/* Title */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">عنوان الإعلان <span className="required-star">*</span></label>
                <input className="glass-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: تعليمات هامة بخصوص الامتحانات" />
              </div>

              {/* Content */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">محتوى الإعلان <span className="required-star">*</span></label>
                <textarea className="glass-input" style={{ minHeight: 140, resize: 'vertical' }}
                  value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="اكتب محتوى الإعلان هنا...&#10;&#10;يمكنك استخدام عدة أسطر وفقرات." />
              </div>

              {/* Type + Status */}
              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">نوع الإعلان</label>
                  <select className="glass-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="NORMAL">عادي</option>
                    <option value="URGENT">🚨 عاجل (شاشة كاملة)</option>
                  </select>
                  {form.type === 'URGENT' && (
                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} /> سيظهر للمستخدمين كشاشة كاملة ولا يمكن تجاوزها دون ضغط
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">الحالة</label>
                  <select className="glass-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="DRAFT">مسودة</option>
                    <option value="PUBLISHED">نشر مباشر</option>
                  </select>
                </div>
              </div>

              {/* Schedule */}
              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">تاريخ البدء</label>
                  <input type="datetime-local" className="glass-input" value={form.startAt}
                    onChange={e => setForm({ ...form, startAt: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">تاريخ الانتهاء (اختياري)</label>
                  <input type="datetime-local" className="glass-input" value={form.endAt}
                    onChange={e => setForm({ ...form, endAt: e.target.value })} />
                </div>
              </div>

              {/* Target Audience */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} /> الجمهور المستهدف
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  اختر الأدوار المستهدفة. إذا لم تختر أي دور، سيظهر الإعلان للجميع.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLE_OPTIONS.map(r => {
                    const selected = form.targetRoles.includes(r.value);
                    return (
                      <label key={r.value}
                        onClick={() => toggleRole(r.value)}
                        style={{
                          padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem',
                          border: `1px solid ${selected ? r.color : 'var(--glass-border)'}`,
                          background: selected ? `${r.color}15` : 'var(--card-bg)',
                          color: selected ? r.color : 'var(--text)',
                          transition: 'all 0.15s', userSelect: 'none',
                        }}>
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                {form.targetRoles.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Globe size={12} style={{ marginLeft: 4 }} />
                    سيظهر للجميع (جميع المستخدمين النشطين)
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {(editing ? hasPermission('admin.announcements.edit') : hasPermission('admin.announcements.add')) && (
                  <button className="glass-btn" style={{ flex: 1 }} onClick={handleSave}>
                    <Save size={16} /> {editing ? 'تحديث الإعلان' : 'إنشاء الإعلان'}
                  </button>
                )}
                <button className="glass-btn secondary" onClick={() => setShowModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        <ConfirmModal
          isOpen={!!confirmDel}
          message={`حذف الإعلان "${confirmDel?.title}"؟`}
          subMessage="لا يمكن التراجع عن هذا الإجراء"
          confirmText="حذف"
          cancelText="إلغاء"
          danger
          onConfirm={() => { if (confirmDel) handleDelete(confirmDel); setConfirmDel(null); }}
          onCancel={() => setConfirmDel(null)}
        />
      </div>
    </PermissionGuard>
  );
};
