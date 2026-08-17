import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Search, RefreshCw, UserPlus, Shield,
  Eye, EyeOff, Link2, Unlink, X, Copy, Check, Wand2, Phone, Mail, Users
} from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PermissionGuard } from '../components/PermissionGuard';
import { ConfirmModal } from '../components/ConfirmModal';
import { printHeaderHTML } from '../utils/print';

const STUDENT_TABS = [
  { key: 'schedule', label: 'جدولي' },
  { key: 'attendance', label: 'الحضور والغياب' },
  { key: 'payments', label: 'المدفوعات' },
  { key: 'grades', label: 'العلامات' },
  { key: 'profile', label: 'معلوماتي' },
];
const DEFAULT_STUDENT_TABS = ['schedule', 'attendance', 'payments', 'grades', 'profile'];

function genPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '0123456789';
  let p = '';
  for (let i = 0; i < 3; i++) p += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 5; i++) p += digits[Math.floor(Math.random() * digits.length)];
  return p;
}

function printReceipt(name: string, username: string, password: string, center: { name?: string; nameEn?: string; logo?: string } = {}) {
  const w = window.open('', '_blank', 'width=400,height=500');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>حساب طالب</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', 'Segoe UI', sans-serif; background: #fff; padding: 40px 30px; color: #222; }
    h1 { text-align: center; font-size: 1.2rem; margin: 16px 0; color: #333; border-bottom: 2px solid #06b6d4; padding-bottom: 12px; }
    .card { border: 2px dashed #06b6d4; border-radius: 16px; padding: 28px 24px; margin: 24px 0; background: #ecfeff; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e8e8e8; font-size: 1rem; }
    .row:last-child { border-bottom: none; }
    .label { color: #666; font-weight: 600; }
    .value { font-weight: 700; direction: ltr; text-align: left; font-family: 'Courier New', monospace; font-size: 1.1rem; letter-spacing: 1px; }
    .note { text-align: center; margin-top: 24px; font-size: 0.8rem; color: #999; }
    .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 0.75rem; color: #aaa; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style></head><body>
    ${printHeaderHTML(center)}
    <h1>📚 بيانات حساب الطالب — ${name}</h1>
    <div class="card">
      <div class="row"><span class="label">اسم المستخدم</span><span class="value" dir="ltr">${username}</span></div>
      <div class="row"><span class="label">كلمة المرور</span><span class="value" dir="ltr">${password}</span></div>
    </div>
    <div class="note">يُرجى الاحتفاظ بهذه المعلومات وعدم مشاركتها مع أي شخص</div>
    <div class="footer">تم الإنشاء في ${formatDate(new Date())}</div>
    <script>window.print();</script>
  </body></html>`);
  w.document.close();
}

export const StudentAccountsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission, centerName, centerNameEn, centerLogo } = useAuth();
  const toast = useToast();

  const [students, setStudents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>(DEFAULT_STUDENT_TABS);
  const [showPass, setShowPass] = useState(false);
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'with_account' | 'without_account'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoUsername, setAutoUsername] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [studs, usrs] = await Promise.all([
        apiFetch('/students?limit=500'),
        apiFetch('/auth/users'),
      ]);
      setStudents(Array.isArray(studs) ? studs : studs?.data || []);
      setUsers(Array.isArray(usrs) ? usrs : []);
    } catch (e: any) { toast.error('خطأ في التحميل', e.message); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    let list = students;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(s =>
        s.fullNameAr?.toLowerCase().includes(q) ||
        s.fullNameEn?.toLowerCase().includes(q) ||
        s.id?.includes(q) ||
        s.nationalId?.includes(q) ||
        s.phone?.includes(q)
      );
    }
    if (filterType === 'with_account') {
      const ids = new Set(users.filter(u => u.studentId).map(u => u.studentId));
      list = list.filter(s => ids.has(s.id));
    } else if (filterType === 'without_account') {
      const ids = new Set(users.filter(u => u.studentId).map(u => u.studentId));
      list = list.filter(s => !ids.has(s.id));
    }
    setFiltered(list);
  }, [students, users, query, filterType]);

  const existingUser = (sid: string) => users.find(u => u.studentId === sid);

  const generateUsername = (student: any): string => {
    const base = student.id || `S${Date.now()}`;
    const existing = users.filter(u => u.studentId && u.username?.startsWith('S'));
    let maxNum = 100000;
    for (const u of existing) {
      const num = parseInt(u.username.replace('S', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    return `S${maxNum + 1}`;
  };

  const openCreate = (stud: any) => {
    setSelectedStudent(stud);
    const eu = existingUser(stud.id);
    setSelectedTabs(eu?.portalTabs?.length ? eu.portalTabs : DEFAULT_STUDENT_TABS);
    setPassword(eu ? '' : genPassword());
    setAutoUsername(eu ? eu.username : generateUsername(stud));
    setShowModal(true);
  };

  const handleGenerate = () => setPassword(genPassword());

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    const eu = existingUser(selectedStudent.id);
    if (!eu && !password) return toast.error('تنبيه', 'كلمة المرور مطلوبة');

    setCreating(true);
    try {
      if (eu) {
        const body: any = {
          portalTabs: selectedTabs,
          fullName: eu.fullName,
          role: eu.role,
          status: eu.status,
          maxDevicesAllowed: eu.maxDevicesAllowed,
          portals: eu.portals || ['STUDENT'],
          studentId: selectedStudent.id,
        };
        if (password) body.password = password;

        await apiFetch(`/auth/users/${eu.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('تم التحديث', 'تم تحديث إعدادات البوابة');

        if (password) {
          printReceipt(selectedStudent.fullNameAr, autoUsername, password, { name: centerName, nameEn: centerNameEn, logo: centerLogo });
        }
      } else {
        const result = await apiFetch('/auth/users', {
          method: 'POST',
          body: JSON.stringify({
            username: autoUsername,
            password,
            fullName: selectedStudent.fullNameAr,
            role: 'STUDENT',
            status: 'ACTIVE',
            portals: ['STUDENT'],
            portalTabs: selectedTabs,
            studentId: selectedStudent.id,
            permissions: [],
          })
        });
        toast.success('تم الإنشاء', `حساب الطالب ${selectedStudent.fullNameAr}`);
        printReceipt(selectedStudent.fullNameAr, autoUsername, password, { name: centerName, nameEn: centerNameEn, logo: centerLogo });
        setUsers(prev => [...prev, {
          id: result.id,
          username: autoUsername,
          fullName: selectedStudent.fullNameAr,
          studentId: selectedStudent.id,
          role: 'STUDENT',
          status: 'ACTIVE',
          portals: ['STUDENT'],
          portalTabs: selectedTabs,
          permissions: [],
          maxDevicesAllowed: 3,
          activeSessionsCount: 0,
          createdAt: new Date().toISOString(),
        }]);
      }
      setShowModal(false);
      setFilterType('all');
      await loadData();
    } catch (e: any) { toast.error('فشل', e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (userId: string) => {
    try {
      await apiFetch(`/auth/users/${userId}`, { method: 'DELETE' });
      toast.success('تم الحذف');
      setFilterType('all');
      await loadData();
    } catch (e: any) { toast.error('فشل', e.message); }
  };

  const filteredStats = {
    total: students.length,
    withAccount: users.filter(u => u.studentId).length,
    withoutAccount: students.length - users.filter(u => u.studentId).length,
  };

  const eu = selectedStudent ? existingUser(selectedStudent.id) : null;

  return (
    <PermissionGuard perm="admin.users.view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(1rem, 3vw, 1.3rem)' }}>
            <Users size={22} color="var(--primary-color)" /> حسابات الطلاب
          </h2>
          <button className="glass-btn secondary" onClick={loadData} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> تحديث
          </button>
        </div>

        {/* Search + Filter */}
        <div className="glass-panel" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 150 }}>
              <Search size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" className="glass-input" style={{ paddingRight: 36, fontSize: '0.85rem' }}
                placeholder="اسم / رقم النظام / وطنـي / هاتف..." value={query}
                onChange={e => setQuery(e.target.value)} />
              {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16}/></button>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { key: 'without_account', label: 'بدون حساب' },
                { key: 'with_account', label: 'لديه حساب' },
                { key: 'all', label: 'الكل' },
              ] as const).map(ft => (
                <button key={ft.key} className={`glass-btn sm ${filterType === ft.key ? '' : 'secondary'}`}
                  onClick={() => setFilterType(ft.key)} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                  {ft.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
          {[
            { label: 'إجمالي الطلاب', value: filteredStats.total, color: 'blue' as const },
            { label: 'لديه حساب', value: filteredStats.withAccount, color: 'green' as const },
            { label: 'بدون حساب', value: filteredStats.withoutAccount, color: 'purple' as const },
          ].map(c => (
            <div key={c.label} className={`stat-card ${c.color}`} style={{ padding: '12px 14px' }}>
              <div className="stat-label" style={{ fontSize: '0.72rem' }}>{c.label}</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Student Table */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="glass-table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>رقم النظام</th>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>الجنسية</th>
                  <th>الحساب</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((stud, idx) => {
                  const eu2 = existingUser(stud.id);
                  return (
                    <tr key={stud.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', direction: 'ltr' }}>{stud.id}</td>
                      <td style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {stud.fullNameAr}
                        {stud.fullNameEn && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{stud.fullNameEn}</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem', direction: 'ltr' }}>{stud.phones?.[0] || stud.phone || '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{stud.nationality === 'JO' ? '🇯🇴 أردني' : '🌍 غير أردني'}</td>
                      <td>
                        {eu2
                          ? <span className="badge success" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}><Link2 size={10}/> {eu2.username}</span>
                          : <span className="badge secondary" style={{ fontSize: '0.7rem' }}><Unlink size={10}/> لا يوجد</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {hasPermission('admin.users.add') && (
                            <button className="glass-btn secondary sm" onClick={() => openCreate(stud)} style={{ padding: '5px 10px' }}
                              title={eu2 ? 'تعديل' : 'إنشاء حساب'}>
                              {eu2 ? <Shield size={13} /> : <UserPlus size={13} />}
                            </button>
                          )}
                          {eu2 && hasPermission('admin.users.delete') && (
                            <button className="glass-btn secondary sm" style={{ color: 'var(--danger)', padding: '5px 10px' }}
                              onClick={() => setConfirmDelete(eu2.id)} title="حذف الحساب">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>لا يوجد طلاب</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && selectedStudent && (
          <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="glass-panel" style={{
              width: '100%', maxWidth: 500, direction: 'rtl',
              borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px 20px', animation: 'slideUp 0.25s ease',
            }}>
              <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>
                  {eu ? 'إعدادات حساب الطالب' : 'إنشاء حساب طالب'}
                </h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 24, lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>

              {/* Student info */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
                padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 12,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: 'linear-gradient(135deg,#06b6d4,#0891b2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                }}>
                  {selectedStudent.fullNameAr?.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedStudent.fullNameAr}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    #{selectedStudent.id}
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  {eu ? 'تغيير كلمة المرور' : 'كلمة المرور'}
                  {!eu && <span className="required-star"> *</span>}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input className="glass-input" type={showPass ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={eu ? 'اترك فارغاً إذا لم ترد التغيير' : 'كلمة المرور'}
                      style={{ fontSize: '0.88rem', direction: 'ltr', textAlign: 'left', paddingLeft: 40, fontFamily: 'monospace' }} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  <button type="button" className="glass-btn secondary sm" onClick={handleGenerate}
                    title="توليد كلمة مرور عشوائية" style={{ padding: '8px 10px', flexShrink: 0 }}>
                    <Wand2 size={16}/>
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>اسم المستخدم: <code style={{ background: 'var(--card-bg)', padding: '1px 6px', borderRadius: 4, fontSize: '0.78rem', fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>{autoUsername}</code></span>
                  <button onClick={() => handleCopy(autoUsername)} className="glass-btn secondary sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                    {copied ? <Check size={12} /> : <Copy size={12} />} نسخ
                  </button>
                </div>
              </div>

              {/* Portal Tabs */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.85rem' }}>التبويبات المرئية للطالب</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  اختر ما يمكن للطالب مشاهدته في بوابته
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {STUDENT_TABS.map(tab => {
                    const isProfile = tab.key === 'profile';
                    return (
                      <label key={tab.key} style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: isProfile ? 'not-allowed' : 'pointer',
                        padding: '8px 10px', borderRadius: 8, fontSize: '0.82rem',
                        background: selectedTabs.includes(tab.key) ? 'var(--primary-light)' : 'var(--card-bg)',
                        border: '1px solid', borderColor: selectedTabs.includes(tab.key) ? 'var(--primary)' : 'var(--glass-border)',
                        opacity: isProfile ? 0.55 : 1,
                      }}>
                        <input type="checkbox" disabled={isProfile}
                          checked={selectedTabs.includes(tab.key)}
                          onChange={() => setSelectedTabs(prev =>
                            prev.includes(tab.key) ? prev.filter(t => t !== tab.key) : [...prev, tab.key]
                          )}
                          style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: isProfile ? 'not-allowed' : 'pointer', flexShrink: 0 }} />
                        <span style={{ fontWeight: selectedTabs.includes(tab.key) ? 600 : 400 }}>
                          {tab.label}
                        </span>
                        {isProfile && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(إجباري)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="glass-btn" style={{ flex: 1 }} onClick={handleSave} disabled={creating}>
                  {creating ? 'جارٍ...' : eu ? 'حفظ الإعدادات' : 'إنشاء الحساب'}
                </button>
                <button className="glass-btn secondary" onClick={() => setShowModal(false)}>إلغاء</button>
              </div>

              {eu && (
                <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  لتتمكن من طباعة بيانات الحساب، أدخل كلمة مرور جديدة واحفظ
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirm Delete */}
        <ConfirmModal
          isOpen={!!confirmDelete}
          message="حذف حساب الطالب؟"
          subMessage="سيتم حذف حساب المستخدم المرتبط بالطالب"
          confirmText="حذف"
          danger
          onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    </PermissionGuard>
  );
};
