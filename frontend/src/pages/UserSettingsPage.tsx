import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useApi } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import {
  User, Shield, Key, Clock, Monitor, Smartphone, Globe,
  CheckCircle, XCircle, LogOut, AlertTriangle, Eye, EyeOff,
  Save, Settings, Activity, Laptop, Lock, Info, Camera,
  Image as ImageIcon, IdCard, BookOpen, Eye as EyeIcon, X
} from 'lucide-react';

interface Session {
  id: number;
  ipAddress: string | null;
  deviceType: string | null;
  userAgent: string | null;
  status: string;
  lastActive: string;
  createdAt: string;
}

interface SecurityAlert {
  id: number;
  userId: number;
  type: string;
  message: string;
  ipAddress: string | null;
  deviceType: string | null;
  userAgent: string | null;
  read: boolean;
  createdAt: string;
}

interface ActivityLog {
  id: number;
  action: string;
  entity: string;
  details: string;
  createdAt: string;
}

function parseUA(ua: string | null) {
  if (!ua) return { browser: '—', os: '—', device: '—' };
  const browser = ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
    : ua.includes('Edg') ? 'Edge'
    : ua.includes('OPR') || ua.includes('Opera') ? 'Opera'
    : 'أخرى';
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Mac OS') || ua.includes('macOS') ? 'macOS'
    : ua.includes('Linux') && !ua.includes('Android') ? 'Linux'
    : ua.includes('Android') ? 'Android'
    : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
    : 'أخرى';
  const device = ua.includes('iPhone') ? 'iPhone'
    : ua.includes('iPad') ? 'iPad'
    : ua.includes('Android') ? 'هاتف Android'
    : (ua.includes('Windows') || ua.includes('Mac') || ua.includes('Linux')) ? 'حاسوب'
    : 'أخرى';
  return { browser, os, device };
}

function formatDate(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} د`;
  if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} س`;
  const s = dt.toLocaleDateString('en-CA');
  const t = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${s} ${t}`;
}

const TABS = [
  { key: 'profile', label: 'الملف الشخصي', icon: User },
  { key: 'security', label: 'كلمة المرور', icon: Lock },
  { key: 'sessions', label: 'جلسات الدخول', icon: Laptop },
  { key: 'alerts', label: 'اشعارات الأمان', icon: AlertTriangle },
];

export const UserSettingsPage = () => {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const toast = useToast();

  const [tab, setTab] = useState('profile');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState({ sessions: true, alerts: true, activity: true });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editStatus, setEditStatus] = useState(user?.aboutStatus || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const unreadAlerts = alerts.filter(a => !a.read).length;

  useEffect(() => {
    setEditStatus(user?.aboutStatus || '');
  }, [user?.aboutStatus]);

  function imgUrl(p: string | undefined | null) {
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    if (p.startsWith('/uploads/')) return `${API_BASE}/api/files/${p.replace('/uploads/', '')}`;
    return p;
  }

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingProfile(true);
    try {
      const fd = new FormData();
      fd.append('profileImage', file);
      const token = localStorage.getItem('ems_token');
      const res = await fetch(API_BASE + '/api/auth/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      let errMsg = 'فشل رفع الصورة';
      try {
        const data = await res.json();
        if (data && typeof data.error === 'string') errMsg = data.error;
        else if (data && typeof data.message === 'string') errMsg = data.message;
      } catch {}
      if (!res.ok) throw new Error(errMsg);
      toast.success('تم', 'تم تحديث الصورة الشخصية');
      window.location.reload();
    } catch (e: any) {
      toast.error('خطأ', e.message);
    } finally { setSavingProfile(false); }
    e.target.value = '';
  };

  const handleRemoveProfileImage = async () => {
    try {
      await apiFetch('/auth/profile/image', { method: 'DELETE' });
      toast.success('تم', 'تم حذف الصورة الشخصية');
      window.location.reload();
    } catch (e: any) {
      toast.error('خطأ', e.message);
    }
  };

  const handleSaveStatus = async () => {
    setSavingProfile(true);
    try {
      await apiFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ aboutStatus: editStatus }),
      });
      toast.success('تم', 'تم تحديث الحالة');
    } catch (e: any) {
      toast.error('خطأ', e.message);
    } finally { setSavingProfile(false); }
  };

  useEffect(() => {
    apiFetch('/auth/sessions')
      .then(d => { setSessions(Array.isArray(d) ? d : []); setLoading(s => ({ ...s, sessions: false })); })
      .catch(() => setLoading(s => ({ ...s, sessions: false })));
    apiFetch('/auth/security-alerts')
      .then(d => { setAlerts(Array.isArray(d) ? d : []); setLoading(s => ({ ...s, alerts: false })); })
      .catch(() => setLoading(s => ({ ...s, alerts: false })));
    apiFetch('/auth/my-activity?limit=10')
      .then(d => { setActivity(Array.isArray(d) ? d : []); setLoading(s => ({ ...s, activity: false })); })
      .catch(() => setLoading(s => ({ ...s, activity: false })));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('خطأ', 'كلمة المرور الجديدة غير متطابقة مع التأكيد');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('خطأ', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      toast.success('تم التغيير', 'تم تغيير كلمة المرور بنجاح');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error('فشل التغيير', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTerminateSession = async (sessionId: number) => {
    try {
      await apiFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'REVOKED' } : s));
      toast.success('تم', 'تم إنهاء الجلسة');
    } catch (e: any) {
      toast.error('خطأ', e.message);
    }
  };

  const handleMarkRead = async (alertId: number) => {
    try {
      await apiFetch(`/auth/security-alerts/${alertId}/read`, { method: 'PUT' });
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    } catch { /* ignore */ }
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: 'مسؤول النظام', SUPERVISOR: 'مشرف', EMPLOYEE: 'موظف',
      TRAINEE: 'متدرب', INSTRUCTOR: 'محاضر', STUDENT: 'طالب',
    };
    return labels[role] || role;
  };

  const actionLabel = (action: string) => {
    const labels: Record<string, string> = {
      LOGIN: 'تسجيل دخول', LOGOUT: 'تسجيل خروج',
      PASSWORD_CHANGE: 'تغيير كلمة المرور',
      CREATE: 'إنشاء', UPDATE: 'تحديث', DELETE: 'حذف',
    };
    return labels[action] || action;
  };

  const pwStrength = (pw: string): { label: string; color: string; pct: number } => {
    if (!pw) return { label: '', color: '', pct: 0 };
    let score = 0;
    if (pw.length >= 6) score += 25;
    if (pw.length >= 10) score += 15;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 20;
    if (/\d/.test(pw)) score += 20;
    if (/[^a-zA-Z0-9]/.test(pw)) score += 20;
    if (score < 30) return { label: 'ضعيفة', color: '#ef4444', pct: score };
    if (score < 60) return { label: 'متوسطة', color: '#f59e0b', pct: score };
    if (score < 80) return { label: 'جيدة', color: '#22c55e', pct: score };
    return { label: 'قوية جداً', color: '#22c55e', pct: score };
  };

  const strength = pwStrength(newPassword);

  const columnStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '28px 1.4fr 1fr 1fr 1.2fr 1.6fr 100px',
    gap: 8, alignItems: 'center', padding: '10px 14px', fontSize: '0.78rem',
  };
  const cellStyle: React.CSSProperties = {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  return (
    <div className="fade-in" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={22} color="var(--secondary)" /> الإعدادات الشخصية
        </h2>
      </div>

      {/* Tabs */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '14px 0', cursor: 'pointer', border: 'none', background: 'transparent',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: tab === t.key ? 700 : 500, fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s', position: 'relative',
              }}>
              <t.icon size={16} />
              {t.label}
              {t.key === 'alerts' && unreadAlerts > 0 && (
                <span style={{
                  position: 'absolute', top: 6, left: '50%', marginLeft: 40,
                  background: 'var(--danger)', color: '#fff', fontSize: '0.6rem',
                  borderRadius: 10, padding: '1px 6px', fontWeight: 700, lineHeight: '14px',
                }}>
                  {unreadAlerts}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/*                     PROFILE TAB                           */}
      {/* ========================================================= */}
      {tab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="glass-panel" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <label style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 18,
                  background: user?.profileImage
                    ? 'none'
                    : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                  boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
                  overflow: 'hidden',
                  transition: 'opacity 0.2s',
                }}>
                  {user?.profileImage ? (
                    <img src={imgUrl(user.profileImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.fullName?.charAt(0) || '?'
                  )}
                </div>
                <div style={{
                  position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--primary)', color: '#fff', borderRadius: 8,
                  padding: '2px 8px', fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  تغيير
                </div>
                <input type="file" accept="image/*" onChange={handleProfileImageChange} style={{ display: 'none' }} />
              </label>
              {user?.profileImage && (
                <button onClick={handleRemoveProfileImage}
                  style={{
                    position: 'absolute', top: -6, left: -6,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--danger)', color: '#fff', border: '2px solid var(--card-bg)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', lineHeight: 1, padding: 0,
                  }}>
                  ✕
                </button>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>
                {user?.fullName}
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <span className="badge primary" style={{ fontSize: '0.75rem', padding: '2px 10px' }}>
                  {roleLabel(user?.role || '')}
                </span>
                {user?.isAdmin && (
                  <span className="badge" style={{ fontSize: '0.75rem', padding: '2px 10px', background: 'rgba(234,179,8,0.2)', color: '#eab308' }}>
                    👑 مدير
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  @{user?.username}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="form-label" style={{ marginBottom: 4 }}>الحالة (تظهر في الدردشات)</div>
                  <input className="glass-input" dir="rtl" placeholder="اكتب حالتك هنا..."
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    style={{ height: 36, fontSize: '0.85rem' }} />
                </div>
                <button onClick={handleSaveStatus}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 8, border: 'none',
                    background: savingProfile ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: '#fff', cursor: savingProfile ? 'not-allowed' : 'pointer',
                    fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  }}
                  disabled={savingProfile}>
                  <Save size={13} /> حفظ الحالة
                </button>
              </div>
            </div>
          </div>

          {/* ===== Employee Documents Section ===== */}
          {user?.employeeId && (
            <EmployeeDocsSection token={token!} toast={toast} />
          )}

          <div className="glass-panel">
            <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} /> آخر النشاطات
            </h4>
            {loading.activity ? (
              <div style={{ opacity: 0.4, padding: 20, textAlign: 'center' }}>جاري التحميل...</div>
            ) : activity.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد نشاطات بعد</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activity.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--surface)', gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{actionLabel(a.action)}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.entity}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', direction: 'ltr' }}>
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/*                   SECURITY TAB (PASSWORD)                 */}
      {/* ========================================================= */}
      {tab === 'security' && (
        <div className="glass-panel" style={{ maxWidth: 520 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', boxShadow: '0 6px 20px rgba(99,102,241,0.3)',
            }}>
              <Lock size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>تغيير كلمة المرور</h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                كلمة المرور الحالية
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPasswords ? 'text' : 'password'}
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '11px 14px', paddingLeft: 40, borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'monospace',
                    outline: 'none', direction: 'ltr',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <Key size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', pointerEvents: 'none',
                }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                كلمة المرور الجديدة
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPasswords ? 'text' : 'password'}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required minLength={6}
                  style={{
                    width: '100%', padding: '11px 14px', paddingLeft: 40, borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'monospace',
                    outline: 'none', direction: 'ltr',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <Key size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', pointerEvents: 'none',
                }} />
              </div>
              {newPassword && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)' }}>
                      <div style={{ width: `${strength.pct}%`, height: 4, borderRadius: 2, background: strength.color, transition: 'all 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: strength.color, fontWeight: 600, minWidth: 50, textAlign: 'left' }}>
                      {strength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                تأكيد كلمة المرور الجديدة
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '11px 14px', paddingLeft: 40, borderRadius: 10,
                    border: confirmPassword && confirmPassword !== newPassword
                      ? '1px solid #ef4444'
                      : confirmPassword && confirmPassword === newPassword
                        ? '1px solid #22c55e'
                        : '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'monospace',
                    outline: 'none', direction: 'ltr',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <Key size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: confirmPassword && confirmPassword !== newPassword ? '#ef4444' : 'var(--text-muted)',
                  pointerEvents: 'none',
                }} />
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#ef4444' }}>كلمة المرور غير متطابقة</p>
              )}
              {confirmPassword && confirmPassword === newPassword && (
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#22c55e' }}>✓ متطابقة</p>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showPasswords} onChange={() => setShowPasswords(!showPasswords)}
                style={{ accentColor: 'var(--primary)' }} />
              <Eye size={14} /> إظهار كلمات المرور
            </label>

            <button type="submit" className="glass-btn" disabled={saving}
              style={{
                justifyContent: 'center', minWidth: 180, height: 44,
                alignSelf: 'flex-start', marginTop: 4,
                opacity: saving || (confirmPassword && confirmPassword !== newPassword) ? 0.5 : 1,
              }}>
              <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/*                   SESSIONS TAB                           */}
      {/* ========================================================= */}
      {tab === 'sessions' && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 16px' }}>
            <h4 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Laptop size={16} /> جلسات تسجيل الدخول
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              جميع الأجهزة التي سجلت الدخول إلى حسابك. يمكنك إنهاء أي جلسة نشطة.
            </p>
          </div>

          {loading.sessions ? (
            <div style={{ opacity: 0.4, padding: 30, textAlign: 'center' }}>جاري التحميل...</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '0 20px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد جلسات</div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ ...columnStyle, background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span />
                <span>الجهاز</span>
                <span>نظام التشغيل</span>
                <span>المتصفح</span>
                <span>عنوان IP</span>
                <span>التاريخ والوقت</span>
                <span style={{ textAlign: 'center' }}>الحالة</span>
              </div>

              {sessions.map((s, i) => {
                const parsed = parseUA(s.userAgent);
                const isCurrent = i === 0 && s.status === 'ACTIVE';
                return (
                  <div key={s.id} style={{
                    ...columnStyle,
                    background: isCurrent ? 'rgba(34,197,94,0.04)' : 'transparent',
                    borderBottom: i < sessions.length - 1 ? '1px solid var(--border)' : 'none',
                    fontSize: '0.78rem',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: isCurrent ? 'rgba(34,197,94,0.12)' : 'var(--surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isCurrent ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      {parsed.device === 'iPhone' || parsed.device === 'iPad' || parsed.device === 'هاتف Android'
                        ? <Smartphone size={13} />
                        : <Monitor size={13} />
                      }
                    </div>
                    <div style={{ ...cellStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{parsed.device}</span>
                      {isCurrent && (
                        <span style={{ fontSize: '0.6rem', background: '#22c55e', color: '#fff', borderRadius: 5, padding: '1px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          الحالية
                        </span>
                      )}
                    </div>
                    <div style={cellStyle}>{parsed.os}</div>
                    <div style={cellStyle}>{parsed.browser}</div>
                    <div style={{ ...cellStyle, direction: 'ltr', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {s.ipAddress || '—'}
                    </div>
                    <div style={{ ...cellStyle, direction: 'ltr', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {formatDate(s.createdAt)}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {s.status === 'ACTIVE' ? (
                        isCurrent ? (
                          <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>
                            <CheckCircle size={11} style={{ display: 'inline', marginLeft: 3 }} />نشطة
                          </span>
                        ) : (
                          <button className="glass-btn danger sm"
                            onClick={() => handleTerminateSession(s.id)}
                            style={{ height: 28, fontSize: '0.68rem', padding: '0 8px', whiteSpace: 'nowrap' }}>
                            <XCircle size={11} /> إنهاء
                          </button>
                        )
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>منتهية</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            يمكنك إنهاء أي جلسة نشطة — سيتم قطع الاتصال فوراً بهذا الجهاز.
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/*                    ALERTS TAB                            */}
      {/* ========================================================= */}
      {tab === 'alerts' && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 16px' }}>
            <h4 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} /> اشعارات الأمان
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              تنبيهات عند محاولات دخول فاشلة ومتكررة على حسابك.
            </p>
          </div>

          {loading.alerts ? (
            <div style={{ opacity: 0.4, padding: 30, textAlign: 'center' }}>جاري التحميل...</div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Shield size={52} style={{ opacity: 0.15, marginBottom: 14 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>لا توجد اشعارات أمان</p>
              <p style={{ fontSize: '0.75rem', marginTop: 4 }}>حسابك آمن حتى الآن</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ ...columnStyle, background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span />
                <span>الجهاز</span>
                <span>نظام التشغيل</span>
                <span>المتصفح</span>
                <span>عنوان IP</span>
                <span>التاريخ والوقت</span>
                <span style={{ textAlign: 'center' }}>إجراء</span>
              </div>

              {alerts.map((a, i) => {
                const parsed = parseUA(a.userAgent);
                return (
                  <div key={a.id} style={{
                    ...columnStyle,
                    background: a.read ? 'transparent' : 'rgba(239,68,68,0.03)',
                    borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: a.read ? 'var(--surface)' : 'rgba(239,68,68,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: a.read ? 'var(--text-muted)' : '#ef4444',
                    }}>
                      <AlertTriangle size={13} />
                    </div>
                    <div style={cellStyle}>
                      <span style={{ color: a.read ? 'var(--text-primary)' : '#ef4444', fontWeight: a.read ? 400 : 600 }}>
                        {parsed.device}
                      </span>
                    </div>
                    <div style={cellStyle}>{parsed.os}</div>
                    <div style={cellStyle}>{parsed.browser}</div>
                    <div style={{ ...cellStyle, direction: 'ltr', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {a.ipAddress || '—'}
                    </div>
                    <div style={{ ...cellStyle, direction: 'ltr', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {formatDate(a.createdAt)}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {!a.read ? (
                        <button className="glass-btn sm" onClick={() => handleMarkRead(a.id)}
                          style={{ height: 28, fontSize: '0.68rem', padding: '0 8px', whiteSpace: 'nowrap' }}>
                          <CheckCircle size={11} /> تجاهل
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>مقروء</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            يتم إنشاء اشعار أمان عند 3 محاولات دخول فاشلة خلال 15 دقيقة.
          </div>
        </div>
      )}
    </div>
  );
};

// Add spin keyframe globally
if (!document.head.querySelector('[data-us-doc-anim]')) {
  const s = document.createElement('style');
  s.setAttribute('data-us-doc-anim', 'true');
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}

// ==========================================
// Employee Docs Section (upload ID + Contract)
// ==========================================
const DOC_API = API_BASE;

function docFileUrl(fp: string): string {
  if (!fp) return '';
  if (fp.startsWith('http')) return fp;
  if (fp.startsWith('/uploads/')) return `${DOC_API}/api/files/${fp.replace('/uploads/', '')}`;
  return fp;
}

async function docUpload(file: File, token: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${DOC_API}/api/employees/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'فشل الرفع'); }
  const d = await res.json();
  return d.url;
}

interface DocDropProps {
  label: string; subtitle: string; imgPath: string; loading: boolean;
  onUpload: (f: File) => void; onPreview: () => void; onDelete: () => void;
}

const DocDropZone: React.FC<DocDropProps> = ({ label, subtitle, imgPath, loading, onUpload, onPreview, onDelete }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  if (imgPath) {
    return (
      <div style={{ position: 'relative', width: '100%', height: 130 }}>
        <img src={docFileUrl(imgPath)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
          <button type="button" onClick={onPreview} style={{ background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#fff', lineHeight: 1 }}><EyeIcon size={14} /></button>
          <button type="button" onClick={onDelete} style={{ background: 'rgba(220,38,38,0.75)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#fff', lineHeight: 1 }}><X size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.[0]) onUpload(e.dataTransfer.files[0]); }}
      onClick={() => ref.current?.click()}
      style={{
        width: '100%', height: 130, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${drag ? 'var(--primary)' : 'var(--glass-border)'}`,
        borderRadius: 8, background: drag ? 'rgba(99,102,241,0.08)' : 'var(--glass-bg)',
        transition: 'all 0.2s', gap: 6,
      }}
    >
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ''; }} />
      {loading ? (
        <div style={{ width: 24, height: 24, border: '3px solid var(--glass-border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      ) : (
        <>
          <ImageIcon size={28} color={drag ? 'var(--primary)' : 'var(--text-secondary)'} />
          <span style={{ fontSize: '0.8rem', color: drag ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 500 }}>{drag ? 'أفلت هنا' : label}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{subtitle}</span>
        </>
      )}
    </div>
  );
};

const EmployeeDocsSection: React.FC<{ token: string; toast: any }> = ({ token, toast }) => {
  const [idImages, setIdImages] = useState<string[]>([]);
  const [contractImages, setContractImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [modal, setModal] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    fetch(`${DOC_API}/api/employees/my-images`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        try { setIdImages(d.idImages ? JSON.parse(d.idImages) : []); } catch { setIdImages([]); }
        try { setContractImages(d.contractImages ? JSON.parse(d.contractImages) : []); } catch { setContractImages([]); }
      })
      .catch(() => {});
  }, [token]);

  const handleUpload = async (type: string, file: File) => {
    setUploading(type);
    try {
      const url = await docUpload(file, token);
      if (type === 'contract') {
        setContractImages(prev => [...prev, url]);
      } else if (type === 'idFront') {
        setIdImages(prev => [url, prev[1] || '']);
      } else {
        setIdImages(prev => [prev[0] || '', url]);
      }
      toast.success('تم رفع الصورة بنجاح');
    } catch (e: any) {
      toast.error('خطأ في رفع الصورة', e.message);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = (type: string, index: number) => {
    if (type === 'contract') {
      setContractImages(prev => { const c = [...prev]; c.splice(index, 1); return c; });
    } else if (type === 'idFront') {
      setIdImages(prev => ['', prev[1] || '']);
    } else {
      setIdImages(prev => [prev[0] || '', '']);
    }
    toast.success('تم حذف الصورة');
  };

  return (
    <>
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Camera size={16} />
          </div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>المستندات الشخصية</h4>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <IdCard size={16} color="var(--secondary)" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>بطاقة الهوية</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'idFront', label: 'الوجه الأمامي', sub: 'صورة واضحة للبطاقة' },
              { key: 'idBack', label: 'الوجه الخلفي', sub: 'صورة واضحة للبطاقة' },
            ].map(({ key, label, sub }) => {
              const img = key === 'idFront' ? idImages[0] : idImages[1];
              return (
                <DocDropZone
                  key={key}
                  label={label}
                  subtitle={sub}
                  imgPath={img}
                  loading={uploading === key}
                  onUpload={(f) => handleUpload(key, f)}
                  onPreview={() => setModal({ src: docFileUrl(img!), alt: `هوية - ${label}` })}
                  onDelete={() => handleDelete(key, 0)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <BookOpen size={16} color="var(--secondary)" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>العقد</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {contractImages.map((img, idx) => (
              <DocDropZone
                key={idx}
                label={`صفحة ${idx + 1}`}
                subtitle=""
                imgPath={img}
                loading={false}
                onUpload={() => {}}
                onPreview={() => setModal({ src: docFileUrl(img), alt: `عقد صفحة ${idx + 1}` })}
                onDelete={() => handleDelete('contract', idx)}
              />
            ))}
            <div style={{ width: 120 }}>
              <DocDropZone
                label="إضافة صفحة"
                subtitle="اسحب صورة"
                imgPath=""
                loading={uploading === 'contract'}
                onUpload={(f) => handleUpload('contract', f)}
                onPreview={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {modal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, cursor: 'pointer',
        }} onClick={() => setModal(null)}>
          <button onClick={() => setModal(null)} style={{
            position: 'absolute', top: 20, left: 20,
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: 'white',
          }}><X size={24} /></button>
          <img src={modal.src} alt={modal.alt}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
