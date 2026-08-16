import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Edit2, Trash2, RefreshCw, ShieldCheck, ShieldOff,
  Lock, Eye, EyeOff, UserCheck, UserX, Link2, Unlink, Briefcase,
  Copy, Check
} from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import { useApi, ALL_PERMISSIONS } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PermissionGuard } from '../components/PermissionGuard';
import { ConfirmModal } from '../components/ConfirmModal';

interface User {
  id: string; username: string; fullName: string; role: string;
  status: string; maxDevicesAllowed: number; activeSessionsCount: number;
  permissions: string[]; createdAt: string;
  portals: string[];
  employeeId?: string;
  supervisorId?: string; supervisorName?: string;
  teamLeaderId?: number | null; teamLeaderName?: string;
  points?: number;
  assignedEntityIds?: number[];
}

interface LinkOption { id: string; name: string; jobRole?: string; }

interface Template {
  id: number; name: string; permissions: string[];
}

const PERMISSION_GROUPS = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

const PORTAL_OPTIONS = [
  { key: 'ADMIN', label: 'بوابة الإدارة' },
  { key: 'EMPLOYEE', label: 'بوابة الموظفين' },
];

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: '👑 مسؤول' },
  { value: 'TEAM_LEADER', label: '🏁 قائد فريق' },
  { value: 'SUPERVISOR', label: '🏆 مشرف' },
  { value: 'REGISTRAR', label: '📝 مسجل' },
  { value: 'EMPLOYEE', label: '👤 موظف' },
  { value: 'TRAINEE', label: '🎓 متدرب' },
];

const roleLabel = (r: string) => ROLE_OPTIONS.find(o => o.value === r)?.label || r;

export const AdminUsersPage = () => {
  const { apiFetch } = useApi();
  const toast = useToast();

  // ── Tab state ──
  const [tab, setTab] = useState<'users' | 'templates'>('users');

  // ── Users state ──
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showEmpPicker, setShowEmpPicker] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  // Link data
  const [employees, setEmployees] = useState<LinkOption[]>([]);
  const [supervisors, setSupervisors] = useState<LinkOption[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<LinkOption[]>([]);
  const [entities, setEntities] = useState<LinkOption[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Confirm
  const [confirmDel, setConfirmDel] = useState<User | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<User | null>(null);

  const [form, setForm] = useState({
    username: '', password: '', fullName: '', role: 'EMPLOYEE',
    status: 'ACTIVE', maxDevicesAllowed: 3, permissions: [] as string[],
    portals: [] as string[],
    employeeId: '', supervisorId: '', teamLeaderId: '',
    assignedEntityIds: [] as number[]
  });

  // ── Templates state ──
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templatePerms, setTemplatePerms] = useState<string[]>([]);
  const [expandedTplGroup, setExpandedTplGroup] = useState<string | null>(null);
  const [confirmDelTemplate, setConfirmDelTemplate] = useState<Template | null>(null);
  const [expandedPermGroup, setExpandedPermGroup] = useState<string | null>('التسجيل');

  // ── Fetch users ──
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try { setUsers((await apiFetch('/auth/users')).filter((u: any) => u.role !== 'STUDENT' && u.role !== 'INSTRUCTOR')); }
    catch (e: any) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  // ── Fetch link data + templates ──
  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const [emps, supervisorUsers, entityData, templateData] = await Promise.all([
        apiFetch('/employees?limit=500').catch(() => []),
        apiFetch('/auth/users').catch(() => []),
        apiFetch('/educational-entities').catch(() => []),
        apiFetch('/auth/permission-templates').catch(() => []),
      ]);
      setEmployees((Array.isArray(emps) ? emps : emps.data || []).filter((e: any) => !e.userId).map((e: any) => ({ id: e.id, name: e.fullName || e.name, jobRole: e.jobRole })));
      const allUsers = Array.isArray(supervisorUsers) ? supervisorUsers : (supervisorUsers.data || []);
      setSupervisors(allUsers.filter((u: any) => u.role === 'ADMIN' || u.role === 'SUPERVISOR').map((u: any) => ({ id: u.id, name: u.fullName })));
      setTeamLeaders(allUsers.filter((u: any) => u.role === 'TEAM_LEADER' || u.role === 'ADMIN').map((u: any) => ({ id: u.id, name: u.fullName })));
      setEntities((Array.isArray(entityData) ? entityData : []).map((e: any) => ({ id: e.id, name: e.name })));
      setTemplates(Array.isArray(templateData) ? templateData : []);
    } catch {}
    finally { setLoadingLinks(false); }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/permission-templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); fetchTemplates(); }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const m = hash.match(/newEmployeeId=(\d+)/);
    if (m) {
      const employeeId = m[1];
      setEditingUser(null);
      setForm({
        username: '', password: '', fullName: '', role: 'EMPLOYEE',
        status: 'ACTIVE', maxDevicesAllowed: 3, permissions: [],
        portals: getDefaultPortals('EMPLOYEE'),
        employeeId, supervisorId: '', teamLeaderId: '',
        assignedEntityIds: []
      });
      setShowModal(true);
      fetchLinks().then(() => {
        toast.success('تم إضافة موظف جديد. يمكنك إنشاء حساب مستخدم له.');
      });
      window.location.hash = hash.replace(/[?&]newEmployeeId=\d+/, '');
    }
  }, []);

  const getDefaultPortals = (role: string) => {
    if (role === 'REGISTRAR' || role === 'EMPLOYEE') return ['EMPLOYEE'];
    if (role === 'TEAM_LEADER') return ['ADMIN', 'EMPLOYEE'];
    return ['ADMIN'];
  };

  // ── User modal handlers ──
  const openCreate = () => {
    setEditingUser(null);
    setForm({
      username: '', password: '', fullName: '', role: 'REGISTRAR',
      status: 'ACTIVE', maxDevicesAllowed: 3, permissions: [],
      portals: getDefaultPortals('REGISTRAR'),
      employeeId: '', supervisorId: '', teamLeaderId: '',
      assignedEntityIds: []
    });
    setShowModal(true);
    fetchLinks();
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({
      username: u.username, password: '', fullName: u.fullName,
      role: u.role, status: u.status, maxDevicesAllowed: u.maxDevicesAllowed,
      permissions: u.permissions,
      portals: u.portals?.length ? u.portals : getDefaultPortals(u.role),
      employeeId: u.employeeId || '',
      supervisorId: u.supervisorId || '',
      teamLeaderId: u.teamLeaderId ? String(u.teamLeaderId) : '',
      assignedEntityIds: u.assignedEntityIds || []
    });
    setShowModal(true);
    fetchLinks();
  };

  const handleSubmit = async () => {
    if (!form.fullName || (!editingUser && !form.username)) return toast.error('تنبيه', 'الاسم واسم المستخدم مطلوبان');
    try {
      if (editingUser) {
        await apiFetch(`/auth/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('تم التعديل');
      } else {
        if (!form.password) return toast.error('تنبيه', 'كلمة المرور مطلوبة');
        await apiFetch('/auth/users', { method: 'POST', body: JSON.stringify(form) });
        toast.success('تمت الإضافة');
      }
      setShowModal(false);
      await fetchUsers();
    } catch (e: any) { toast.error('خطأ', e.message); }
  };

  const handleDelete = async (u: User) => {
    try { await apiFetch(`/auth/users/${u.id}`, { method: 'DELETE' }); toast.success('تم الحذف'); await fetchUsers(); }
    catch (e: any) { toast.error('خطأ', e.message); }
  };

  const revokeSession = async (u: User) => {
    try { await apiFetch(`/auth/users/${u.id}/sessions`, { method: 'DELETE' }); toast.success('تم إلغاء الجلسات'); await fetchUsers(); }
    catch (e: any) { toast.error('خطأ', e.message); }
  };

  const togglePortal = (key: string) => {
    setForm(prev => ({
      ...prev,
      portals: prev.portals.includes(key)
        ? prev.portals.filter(p => p !== key)
        : [...prev.portals, key]
    }));
  };

  // ── Permission toggle functions (used in user modal) ──
  const togglePerm = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key]
    }));
  };

  const toggleGroup = (group: string) => {
    const groupKeys = ALL_PERMISSIONS.filter(p => p.group === group).map(p => p.key);
    const allSelected = groupKeys.every(k => form.permissions.includes(k));
    if (allSelected) {
      setForm(prev => ({ ...prev, permissions: prev.permissions.filter(k => !groupKeys.includes(k)) }));
    } else {
      setForm(prev => ({ ...prev, permissions: [...new Set([...prev.permissions, ...groupKeys])] }));
    }
  };

  const applyTemplateToForm = (t: Template) => {
    setForm(prev => ({ ...prev, permissions: [...new Set([...prev.permissions, ...t.permissions])] }));
    toast.success(`تم تطبيق قالب "${t.name}"`);
  };

  // ── Template CRUD handlers ──
  const openCreateTemplate = () => {
    setEditTemplate(null);
    setTemplateName('');
    setTemplatePerms([]);
    setExpandedTplGroup(PERMISSION_GROUPS[0] || null);
    setShowTemplateModal(true);
  };

  const openEditTemplate = (t: Template) => {
    setEditTemplate(t);
    setTemplateName(t.name);
    setTemplatePerms([...t.permissions]);
    setShowTemplateModal(true);
  };

  const toggleTplPerm = (key: string) => {
    setTemplatePerms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const toggleTplGroup = (group: string) => {
    const groupKeys = ALL_PERMISSIONS.filter(p => p.group === group).map(p => p.key);
    const allSelected = groupKeys.every(k => templatePerms.includes(k));
    if (allSelected) setTemplatePerms(prev => prev.filter(k => !groupKeys.includes(k)));
    else setTemplatePerms(prev => [...new Set([...prev, ...groupKeys])]);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return toast.error('تنبيه', 'اسم القالب مطلوب');
    try {
      if (editTemplate) {
        await apiFetch(`/auth/permission-templates/${editTemplate.id}`, {
          method: 'PUT', body: JSON.stringify({ name: templateName, permissions: templatePerms })
        });
        toast.success('تم تحديث القالب');
      } else {
        await apiFetch('/auth/permission-templates', {
          method: 'POST', body: JSON.stringify({ name: templateName, permissions: templatePerms })
        });
        toast.success('تم إنشاء القالب');
      }
      setShowTemplateModal(false);
      fetchTemplates();
    } catch (e: any) { toast.error('خطأ', e.message); }
  };

  const deleteTemplate = async (t: Template) => {
    try {
      await apiFetch(`/auth/permission-templates/${t.id}`, { method: 'DELETE' });
      toast.success('تم الحذف');
      fetchTemplates();
    } catch (e: any) { toast.error('خطأ', e.message); }
  };

  const currentLinks = (() => {
    if (form.employeeId) return employees.find(e => e.id === form.employeeId);
    return null;
  })();

  // ── Segmented control button style ──
  const tabBtnStyle = (active: boolean) => ({
    padding: '10px 28px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 600,
    background: active ? 'var(--primary)' : 'var(--card-bg)',
    color: active ? '#fff' : 'var(--text)',
    borderRadius: 10,
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: active ? '0 2px 8px var(--primary-glow)' : 'none',
  });

  return (
    <PermissionGuard perm="admin.users">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ═══ Segmented Tabs ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--card-bg)', padding: 4, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
            <button onClick={() => setTab('users')} style={tabBtnStyle(tab === 'users')}>
              <Users size={16} /> المستخدمون
            </button>
            <button onClick={() => setTab('templates')} style={tabBtnStyle(tab === 'templates')}>
              <Copy size={16} /> قوالب الصلاحيات
            </button>
          </div>
          {tab === 'users' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="glass-btn secondary" onClick={() => { fetchUsers(); fetchTemplates(); }} disabled={isLoading}>
                <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> تحديث
              </button>
              <button className="glass-btn" onClick={openCreate}>
                <Plus size={16} /> إضافة مستخدم
              </button>
            </div>
          )}
          {tab === 'templates' && (
            <button className="glass-btn" onClick={openCreateTemplate}>
              <Plus size={16} /> قالب جديد
            </button>
          )}
        </div>

        {/* ════════════════════════════════════════ */}
        {/* TAB: Users */}
        {/* ════════════════════════════════════════ */}
        {tab === 'users' && (
          <div className="glass-panel">
            <div className="glass-table-container">
              <table className="glass-table">
                <thead>
                    <tr>
                      <th>المستخدم</th>
                      <th>اسم الدخول</th>
                      <th>الدور</th>
                      <th>النقاط</th>
                      <th>المشرف</th>
                      <th>قائد الفريق</th>
                      <th>البوابات</th>
                      <th>الحالة</th>
                      <th>الصلاحيات</th>
                      <th>الجلسات</th>
                      <th>الربط</th>
                      <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {formatDate(u.createdAt)}
                        </div>
                      </td>
                      <td><code style={{ fontSize: '0.85rem', background: 'var(--card-bg)', padding: '2px 8px', borderRadius: 6 }}>@{u.username}</code></td>
                      <td>
                        <span className={`badge ${u.role === 'ADMIN' ? 'primary' : u.role === 'TEAM_LEADER' ? 'danger' : u.role === 'SUPERVISOR' ? 'warning' : 'secondary'}`} style={{ fontSize: '0.78rem' }}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                          {u.points ?? 0}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>
                          {u.supervisorName || <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>
                          {u.teamLeaderName || <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {(u.portals || []).map(p => (
                            <span key={p} className={`badge ${p === 'ADMIN' ? 'primary' : 'warning'}`} style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                              {p === 'ADMIN' ? 'إدارة' : 'موظفين'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '0.78rem' }}>
                          {u.status === 'ACTIVE' ? <><UserCheck size={11}/> نشط</> : <><UserX size={11}/> معطّل</>}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 240 }}>
                          {u.permissions.includes('ADMIN_ALL')
                            ? <span className="badge primary" style={{ fontSize: '0.72rem' }}>🔓 كامل</span>
                            : u.permissions.slice(0, 3).map(p => (
                              <span key={p} className="badge" style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                                {ALL_PERMISSIONS.find(pp => pp.key === p)?.label || p}
                              </span>
                            ))
                          }
                          {!u.permissions.includes('ADMIN_ALL') && u.permissions.length > 3 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>+{u.permissions.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: u.activeSessionsCount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {u.activeSessionsCount} نشطة
                        </span>
                      </td>
                      <td>
                        {u.employeeId ? (
                          <span className="badge success" style={{ fontSize: '0.72rem' }}>
                            <Link2 size={11}/> مربوط
                          </span>
                        ) : (
                          <span className="badge secondary" style={{ fontSize: '0.72rem' }}>
                            <Unlink size={11}/> غير مربوط
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="glass-btn secondary sm" onClick={() => openEdit(u)} title="تعديل">
                            <Edit2 size={13} />
                          </button>
                          {u.activeSessionsCount > 0 && (
                            <button className="glass-btn secondary sm" onClick={() => setConfirmRevoke(u)} title="قطع الجلسة" style={{ color: 'var(--warning)' }}>
                              <Lock size={13} />
                            </button>
                          )}
                          <button className="glass-btn secondary sm" onClick={() => setConfirmDel(u)} title="حذف" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>لا يوجد مستخدمون</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TAB: Templates */}
        {/* ════════════════════════════════════════ */}
        {tab === 'templates' && (
          <>
            {templates.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: 48, opacity: 0.5 }}>
                <Copy size={32} style={{ display: 'block', margin: '0 auto 12px' }} />
                لا توجد قوالب. أنشئ قالباً لتطبيق صلاحيات محددة على عدة مستخدمين بسرعة.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {templates.map(t => (
                  <div key={t.id} className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{t.name}</h4>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="glass-btn secondary sm" onClick={() => openEditTemplate(t)} title="تعديل">
                          <Edit2 size={13} />
                        </button>
                        <button className="glass-btn secondary sm" onClick={() => setConfirmDelTemplate(t)} title="حذف" style={{ color: 'var(--danger)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {t.permissions.slice(0, 5).map(p => (
                        <span key={p} className="badge" style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                          {ALL_PERMISSIONS.find(pp => pp.key === p)?.label || p}
                        </span>
                      ))}
                      {t.permissions.length > 5 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>+{t.permissions.length - 5}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════ */}
        {/* USER CREATE/EDIT MODAL */}
        {/* ════════════════════════════════════════ */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
            <div className="glass-panel slide-in" style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  {editingUser ? `تعديل: ${editingUser.fullName}` : 'إضافة مستخدم جديد'}
                </h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22 }}>×</button>
              </div>

              {/* Row 1: Name + Username */}
              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    الاسم الكامل <span className="required-star">*</span>
                    {form.employeeId && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--success)', marginRight: 8, fontWeight: 400 }}>
                        <Link2 size={12} style={{ display: 'inline' }} /> مرتبط بالموظف
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="glass-input" value={form.fullName}
                      onChange={e => { setForm({ ...form, fullName: e.target.value, employeeId: '' }); }}
                      disabled={!!form.employeeId}
                      style={{ flex: 1, opacity: form.employeeId ? 0.8 : 1 }}
                      placeholder={form.employeeId ? 'مجلوب من الموظف' : 'الاسم الكامل'} />
                    <button type="button" className="glass-btn"
                      onClick={() => { setEmpSearch(''); setShowEmpPicker(true); }}
                      style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Briefcase size={14} />
                      {form.employeeId ? 'تغيير' : 'اختيار'}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">اسم المستخدم {!editingUser && <span className="required-star">*</span>}</label>
                  <input className="glass-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    disabled={!!editingUser} placeholder={editingUser ? '(لا يمكن التعديل)' : 'lowercase فقط'} />
                </div>
              </div>

              {/* Row 2: Password + Role */}
              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">كلمة المرور {!editingUser && <span className="required-star">*</span>}</label>
                  <div style={{ position: 'relative' }}>
                    <input className="glass-input" type={showPass ? 'text' : 'password'}
                      value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder={editingUser ? 'اتركها فارغة للإبقاء' : 'كلمة المرور'} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', left: 12, top: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">الدور الأساسي</label>
                  <select className="glass-input" value={form.role}
                    onChange={e => {
                      const role = e.target.value;
                      if (form.portals.length === 0 || JSON.stringify(form.portals) === JSON.stringify(getDefaultPortals(form.role))) {
                        setForm({ ...form, role, portals: getDefaultPortals(role) });
                      } else {
                        setForm({ ...form, role });
                      }
                    }}>
                    {ROLE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Status + Max Devices */}
              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">الحالة</label>
                  <select className="glass-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">نشط</option>
                    <option value="INACTIVE">معطّل</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">عدد الأجهزة المسموحة</label>
                  <input type="number" min="1" max="10" className="glass-input" value={form.maxDevicesAllowed}
                    onChange={e => setForm({ ...form, maxDevicesAllowed: parseInt(e.target.value) })} />
                </div>
              </div>

              {/* ═══ Portal Access ═══ */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>البوابات المسموح بها</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {PORTAL_OPTIONS.map(po => (
                    <label key={po.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', padding: '8px 14px', borderRadius: 10, border: `1px solid ${form.portals.includes(po.key) ? 'var(--primary)' : 'var(--glass-border)'}`, background: form.portals.includes(po.key) ? 'var(--primary-light)' : 'var(--card-bg)' }}>
                      <input type="checkbox" checked={form.portals.includes(po.key)} onChange={() => togglePortal(po.key)}
                        style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      {po.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* ═══ Supervisor (only for EMPLOYEE or SUPERVISOR) ═══ */}
              {(form.role === 'REGISTRAR' || form.role === 'EMPLOYEE' || form.role === 'SUPERVISOR') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>المشرف المسؤول</div>
                  <select className="glass-input" value={form.supervisorId}
                    onChange={e => setForm({ ...form, supervisorId: e.target.value })}>
                    <option value="">-- بدون مشرف --</option>
                    {supervisors.filter(s => s.id !== editingUser?.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {form.role === 'REGISTRAR' && (
                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      المسجل يرى فقط الطلاب المسجلين بواسطته
                    </div>
                  )}
                  {form.role === 'SUPERVISOR' && (
                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      المشرف يرى طلاب المسجلين الخاضعين لإشرافه
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Team Leader (for REGISTRAR, SUPERVISOR, EMPLOYEE) ═══ */}
              {(form.role === 'REGISTRAR' || form.role === 'SUPERVISOR' || form.role === 'EMPLOYEE') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>قائد الفريق</div>
                  <select className="glass-input" value={form.teamLeaderId}
                    onChange={e => setForm({ ...form, teamLeaderId: e.target.value })}>
                    <option value="">-- بدون قائد فريق --</option>
                    {teamLeaders.filter(s => s.id !== editingUser?.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {form.role === 'REGISTRAR' && (
                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      قائد الفريق يحصل على نقطة عند كل تسجيل من المسجل
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Assigned Educational Entities ═══ */}
              {(form.role === 'SUPERVISOR' || form.role === 'EMPLOYEE') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>الجهات التعليمية المسموحة</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {entities.map(e => {
                      const selected = form.assignedEntityIds.includes(parseInt(e.id));
                      return (
                        <label key={e.id}
                          onClick={() => {
                            const id = parseInt(e.id);
                            setForm(prev => ({
                              ...prev,
                              assignedEntityIds: prev.assignedEntityIds.includes(id)
                                ? prev.assignedEntityIds.filter(x => x !== id)
                                : [...prev.assignedEntityIds, id]
                            }));
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem',
                            border: `1px solid ${selected ? 'var(--primary)' : 'var(--glass-border)'}`,
                            background: selected ? 'var(--primary-light)' : 'var(--card-bg)',
                            color: selected ? 'var(--primary-color)' : 'var(--text)',
                            transition: 'all 0.15s', userSelect: 'none'
                          }}>
                          {e.name}
                        </label>
                      );
                    })}
                  </div>
                  {entities.length === 0 && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      لا توجد جهات تعليمية. أضف جهات من صفحة الجهات التعليمية أولاً.
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Permissions ═══ */}
              {form.role !== 'ADMIN' && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>الصلاحيات</div>

                  {/* Template quick-select */}
                  {templates.length > 0 && (
                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>تعبئة من قالب:</span>
                      {templates.map(t => (
                        <button key={t.id} className="glass-btn secondary sm"
                          onClick={() => applyTemplateToForm(t)}
                          style={{ fontSize: '0.78rem', padding: '3px 10px' }}>
                          <Copy size={11} /> {t.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {PERMISSION_GROUPS.map(group => {
                      const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
                      const allSelected = groupPerms.every(p => form.permissions.includes(p.key));
                      return (
                        <div key={group} style={{ border: '1px solid var(--glass-border)', borderRadius: 10, overflow: 'hidden' }}>
                          <div onClick={() => setExpandedPermGroup(expandedPermGroup === group ? null : group)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: expandedPermGroup === group ? 'var(--primary-light)' : 'var(--card-bg)' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{group}</span>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <button onClick={e => { e.stopPropagation(); toggleGroup(group); }}
                                className={`glass-btn sm ${allSelected ? '' : 'secondary'}`} style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
                                {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                              </button>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{expandedPermGroup === group ? '▲' : '▼'}</span>
                            </div>
                          </div>
                          {expandedPermGroup === group && (
                            <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {groupPerms.map(perm => (
                                <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', padding: '4px 0' }}>
                                  <input type="checkbox" checked={form.permissions.includes(perm.key)} onChange={() => togglePerm(perm.key)} />
                                  {perm.label}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.role === 'ADMIN' && (
                <div style={{ padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem', color: 'var(--primary-color)' }}>
                  <ShieldCheck size={16} style={{ display: 'inline', marginLeft: 6 }} />
                  المسؤول يحصل تلقائياً على صلاحية <strong>ADMIN_ALL</strong> (وصول كامل)
                </div>
              )}

              {/* Employee picker popup */}
              {showEmpPicker && (
                <div style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                  backdropFilter: 'blur(4px)',
                }} onClick={() => setShowEmpPicker(false)}>
                  <div className="glass-panel" style={{
                    width: '100%', maxWidth: 480, maxHeight: '75vh', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    padding: 0, borderRadius: 16, direction: 'rtl',
                  }} onClick={e => e.stopPropagation()}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '18px 22px', borderBottom: '1px solid var(--glass-border)',
                    }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Briefcase size={20} /> اختيار موظف
                      </h4>
                      <button onClick={() => setShowEmpPicker(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, padding: '0 4px' }}>×</button>
                    </div>
                    <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--glass-border)' }}>
                      <input className="glass-input" placeholder="ابحث عن موظف..."
                        value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                        autoFocus />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                      {(() => {
                        const filtered = employees.filter(e =>
                          !empSearch || e.name.includes(empSearch) || (e.jobRole || '').includes(empSearch)
                        );
                        if (filtered.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                              <Briefcase size={32} style={{ display: 'block', margin: '0 auto 12px' }} />
                              {employees.length === 0 ? 'لا يوجد موظفون بدون حسابات' : 'لا توجد نتائج'}
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {filtered.map(emp => {
                              const alreadyLinked = users.some(u => u.employeeId === emp.id && u.id !== editingUser?.id);
                              return (
                                <div key={emp.id} onClick={() => {
                                  if (alreadyLinked) return;
                                  setForm({ ...form, employeeId: emp.id, fullName: emp.name });
                                  setShowEmpPicker(false);
                                  setEmpSearch('');
                                }} style={{
                                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                                  borderRadius: 10, cursor: alreadyLinked ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.15s', opacity: alreadyLinked ? 0.45 : 1,
                                  background: 'var(--card-bg)', border: '1px solid var(--glass-border)',
                                }}
                                  onMouseEnter={e => { if (!alreadyLinked) e.currentTarget.style.background = 'var(--primary-light)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; }}>
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                                    fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                                  }}>
                                    {emp.name.charAt(0)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{emp.name}</div>
                                    {emp.jobRole && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.jobRole}</div>}
                                  </div>
                                  {alreadyLinked && <UserCheck size={15} style={{ flexShrink: 0, color: 'var(--success)' }} />}
                                  {!alreadyLinked && <Plus size={15} style={{ flexShrink: 0, color: 'var(--primary)' }} />}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="glass-btn" style={{ flex: 1 }} onClick={handleSubmit}>
                  {editingUser ? <><Edit2 size={16}/> حفظ التعديلات</> : <><Plus size={16}/> إنشاء المستخدم</>}
                </button>
                <button className="glass-btn secondary" onClick={() => setShowModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TEMPLATE CREATE/EDIT MODAL */}
        {/* ════════════════════════════════════════ */}
        {showTemplateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
            <div className="glass-panel slide-in" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  {editTemplate ? `تعديل: ${editTemplate.name}` : 'قالب صلاحيات جديد'}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22 }}>×</button>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">اسم القالب <span className="required-star">*</span></label>
                <input className="glass-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="مثال: صلاحيات موظف تسجيل" />
              </div>

              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>الصلاحيات</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {PERMISSION_GROUPS.map(group => {
                  const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
                  const allSelected = groupPerms.every(p => templatePerms.includes(p.key));
                  return (
                    <div key={group} style={{ border: '1px solid var(--glass-border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div onClick={() => setExpandedTplGroup(expandedTplGroup === group ? null : group)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: expandedTplGroup === group ? 'var(--primary-light)' : 'var(--card-bg)' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{group}</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {groupPerms.filter(p => templatePerms.includes(p.key)).length}/{groupPerms.length}
                          </span>
                          <button onClick={e => { e.stopPropagation(); toggleTplGroup(group); }}
                            className={`glass-btn sm ${allSelected ? '' : 'secondary'}`} style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
                            {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                          </button>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{expandedTplGroup === group ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {expandedTplGroup === group && (
                        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {groupPerms.map(perm => (
                            <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', padding: '4px 0' }}>
                              <input type="checkbox" checked={templatePerms.includes(perm.key)} onChange={() => toggleTplPerm(perm.key)}
                                style={{ width: 17, height: 17, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                              {perm.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {templatePerms.length === 0 && (
                <div style={{ padding: '12px 16px', background: 'var(--danger-light, #fff0f0)', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem', color: 'var(--danger)' }}>
                  لم يتم اختيار أي صلاحيات. القالب سيكون فارغاً.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="glass-btn" style={{ flex: 1 }} onClick={saveTemplate}>
                  {editTemplate ? <><Edit2 size={16}/> حفظ القالب</> : <><Plus size={16}/> إنشاء القالب</>}
                </button>
                <button className="glass-btn secondary" onClick={() => setShowTemplateModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete User */}
        <ConfirmModal
          isOpen={!!confirmDel}
          message={`حذف المستخدم "${confirmDel?.fullName}"؟`}
          subMessage="لا يمكن التراجع عن هذا الإجراء"
          confirmText="حذف"
          cancelText="إلغاء"
          danger
          onConfirm={() => { if (confirmDel) handleDelete(confirmDel); setConfirmDel(null); }}
          onCancel={() => setConfirmDel(null)}
        />

        {/* Confirm Revoke Sessions */}
        <ConfirmModal
          isOpen={!!confirmRevoke}
          message={`إلغاء جميع جلسات "${confirmRevoke?.fullName}"؟`}
          subMessage="سيتم قطع اتصال جميع الأجهزة"
          confirmText="قطع الجلسات"
          cancelText="إلغاء"
          danger
          onConfirm={() => { if (confirmRevoke) revokeSession(confirmRevoke); setConfirmRevoke(null); }}
          onCancel={() => setConfirmRevoke(null)}
        />

        {/* Confirm Delete Template */}
        <ConfirmModal
          isOpen={!!confirmDelTemplate}
          message={`حذف القالب "${confirmDelTemplate?.name}"؟`}
          subMessage="لا يمكن التراجع عن هذا الإجراء"
          confirmText="حذف"
          cancelText="إلغاء"
          danger
          onConfirm={() => { if (confirmDelTemplate) deleteTemplate(confirmDelTemplate); setConfirmDelTemplate(null); }}
          onCancel={() => setConfirmDelTemplate(null)}
        />

      </div>
    </PermissionGuard>
  );
};
