import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Save, Globe, Image, Monitor, Smartphone, Palette, Upload, X, Activity, RefreshCw, Filter, Trash2, ChevronRight } from 'lucide-react';
import { PermissionGuard } from '../components/PermissionGuard';
import { useApi, useAuth, fileUrl } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/dateFormat';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ==========================================
// Types
// ==========================================
type TabKey = 'general' | 'backgrounds' | 'activity';

interface AuditLog {
  id: string; action: string; entity: string; details?: string;
  ipAddress?: string; deviceType?: string; createdAt: string;
  user?: { username: string; fullName: string };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'var(--success)', UPDATE: 'var(--warning)', DELETE: 'var(--danger)',
  LOGIN: 'var(--primary)', LOGOUT: 'var(--text-muted)', PAY: '#a78bfa', VIEW: 'var(--info)',
};

const PORTALS = [
  { key: 'ADMIN', label: 'بوابة الإدارة', icon: Monitor, gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { key: 'EMPLOYEE', label: 'بوابة الموظفين', icon: Smartphone, gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { key: 'INSTRUCTOR', label: 'بوابة المدربين', icon: Monitor, gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { key: 'STUDENT', label: 'بوابة الطلاب', icon: Smartphone, gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
];

export const AdminSettingsPage = () => {
  const { apiFetch } = useApi();
  const { updateCenter, hasPermission } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabKey>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // General settings
  const [settings, setSettings] = useState({
    centerName: '', centerLogo: '', centerPhone: '', centerEmail: '',
    currency: 'JOD', timezone: 'Asia/Amman', defaultCommissionRate: 5,
    maxInstallments: 12, overdueGraceDays: 3,
    notifyOnOverdue: 'true', notifyOnRegistration: 'true', backupEnabled: 'false',
  });

  // Backgrounds
  const [bgPortal, setBgPortal] = useState('ADMIN');
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [bgForm, setBgForm] = useState({ type: 'GRADIENT', content: '' });
  const [bgSaving, setBgSaving] = useState(false);

  // Activity
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const portal = PORTALS.find(p => p.key === bgPortal)!;
  const currentBg = backgrounds.find(b => b.portal === bgPortal);

  useEffect(() => {
    const token = localStorage.getItem('ems_token');
    if (!token) { setLoading(false); return; }
    fetch(API_BASE + '/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setSettings(prev => ({ ...prev, ...data })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (tab === 'backgrounds') loadBackgrounds(); }, [tab, bgPortal]);
  useEffect(() => { if (tab === 'activity') fetchLogs(); }, [tab, filterAction, filterEntity]);

  // ===== General Settings =====
  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) });
      updateCenter(
        data?.centerName || settings.centerName,
        data?.centerLogo || settings.centerLogo
      );
      toast.success('تم الحفظ', 'تم حفظ الإعدادات بنجاح');
    } catch (e: any) {
      console.error('[handleSave] apiFetch failed:', e?.message);
      // Fallback: save name directly via localStorage + context even if backend fails
      updateCenter(settings.centerName, settings.centerLogo);
      toast.error('فشل الحفظ', e?.message || 'خطأ غير معروف');
    } finally { setSaving(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setSettings(prev => ({ ...prev, centerLogo: ev.target?.result as string || '' })); };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => { setSettings(prev => ({ ...prev, centerLogo: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // ===== Backgrounds =====
  const loadBackgrounds = async () => {
    try {
      const data = await apiFetch('/backgrounds');
      setBackgrounds(Array.isArray(data) ? data : []);
      const bg = Array.isArray(data) ? data.find(b => b.portal === bgPortal) : null;
      if (bg) setBgForm({ type: bg.type, content: bg.type === 'IMAGE' ? fileUrl(bg.content) : (bg.content || '') });
      else setBgForm({ type: 'GRADIENT', content: '' });
    } catch {}
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setBgForm({ type: 'IMAGE', content: ev.target?.result as string || '' }); };
    reader.readAsDataURL(file);
  };

  const handleBgSave = async () => {
    setBgSaving(true);
    try {
      await apiFetch(`/backgrounds/${bgPortal}`, { method: 'PUT', body: JSON.stringify(bgForm) });
      toast.success('تم الحفظ', `تم تحديث خلفية ${portal.label}`);
      loadBackgrounds();
    } catch (e: any) { toast.error('فشل الحفظ', e.message); }
    finally { setBgSaving(false); }
  };

  const bgGradientColors = (): string[] => {
    if (bgForm.type === 'GRADIENT' && bgForm.content) {
      const c = bgForm.content.match(/#[0-9a-fA-F]{6}/g);
      if (c && c.length >= 2) return c;
    }
    return portal.gradient.match(/#[0-9a-fA-F]{6}/g) || [];
  };

  const bgPreview = () => {
    if (bgForm.type === 'IMAGE' && bgForm.content) return bgForm.content;
    return null;
  };

  // ===== Activity =====
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      let url = '/audit?limit=300';
      if (filterAction) url += `&action=${filterAction}`;
      if (filterEntity) url += `&entity=${filterEntity}`;
      setLogs(await apiFetch(url));
    } catch {}
    finally { setIsLoadingLogs(false); }
  }, [filterAction, filterEntity]);

  const clearLogs = async () => {
    if (!confirm('هل أنت متأكد من مسح جميع سجلات النشاط؟ لا يمكن التراجع.')) return;
    try { await apiFetch('/audit', { method: 'DELETE' }); toast.success('تم المسح'); await fetchLogs(); }
    catch (e: any) { toast.error('خطأ', e.message); }
  };

  const parseDetails = (details?: string) => {
    if (!details) return null;
    try { return JSON.parse(details); } catch { return details; }
  };

  const uniqueEntities = [...new Set(logs.map(l => l.entity))];
  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'general', label: 'الإعدادات العامة', icon: Settings },
    { key: 'backgrounds', label: 'خلفيات البوابات', icon: Palette },
    { key: 'activity', label: 'سجل النشاطات', icon: Activity },
  ];

  if (loading) {
    return (
      <PermissionGuard perm="admin.settings.view">
        <div style={{ padding: 60, textAlign: 'center', opacity: 0.4 }}>جاري التحميل...</div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard perm="admin.settings.view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, background: 'var(--card-bg)', borderRadius: 12, padding: 4, border: '1px solid var(--glass-border)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '12px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
                background: tab === t.key ? 'var(--primary)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>

        {/* ===== TAB: GENERAL SETTINGS ===== */}
        {tab === 'general' && (
          <>
            <div className="glass-panel">
              <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Image size={16} /> الشعار والاسم
              </h4>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 120, height: 120, borderRadius: 20,
                    background: settings.centerLogo ? `url(${settings.centerLogo}) center/cover no-repeat` : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '3px solid var(--glass-border)', overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.2)',
                  }}>
                    {!settings.centerLogo && <Image size={36} style={{ opacity: 0.5, color: '#fff' }} />}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button className="glass-btn secondary sm" style={{ fontSize: '0.7rem', height: 28, padding: '0 10px' }}
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload size={11} /> رفع
                    </button>
                    {settings.centerLogo && hasPermission('admin.settings.edit') && (
                      <button className="glass-btn danger sm" style={{ fontSize: '0.7rem', height: 28, padding: '0 10px' }} onClick={removeLogo}>
                        <X size={11} /> حذف
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                </div>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <div className="form-group">
                    <label className="form-label">اسم المركز</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <input className="glass-input" value={settings.centerName}
                        onChange={e => setSettings({ ...settings, centerName: e.target.value })}
                        placeholder="المركز التعليمي الحديث" style={{ fontSize: '1rem', fontWeight: 600, flex: 1 }} />
                      {hasPermission('admin.settings.edit') && (
                        <button className="glass-btn" onClick={handleSave} disabled={saving}
                          style={{ height: 44, minWidth: 80, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                          <Save size={14} /> {saving ? '...' : 'حفظ'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div className="form-group">
                      <label className="form-label">هاتف التواصل</label>
                      <input className="glass-input" value={settings.centerPhone} onChange={e => setSettings({ ...settings, centerPhone: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">البريد الإلكتروني</label>
                      <input type="email" className="glass-input" value={settings.centerEmail} onChange={e => setSettings({ ...settings, centerEmail: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel">
              <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={16} /> الإعدادات المالية والعملة
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">العملة</label>
                  <select className="glass-input" value={settings.currency} onChange={e => setSettings({ ...settings, currency: e.target.value })}>
                    <option value="JOD">دينار أردني (JOD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">المنطقة الزمنية</label>
                  <select className="glass-input" value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })}>
                    <option value="Asia/Amman">عمّان (GMT+3)</option>
                    <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                    <option value="Asia/Dubai">دبي (GMT+4)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">نسبة العمولة الافتراضية (%)</label>
                  <input type="number" min="0" max="50" className="glass-input" value={settings.defaultCommissionRate}
                    onChange={e => setSettings({ ...settings, defaultCommissionRate: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">الحد الأقصى للأقساط</label>
                  <input type="number" min="1" max="36" className="glass-input" value={settings.maxInstallments}
                    onChange={e => setSettings({ ...settings, maxInstallments: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">أيام السماح للتأخر</label>
                  <input type="number" min="0" max="30" className="glass-input" value={settings.overdueGraceDays}
                    onChange={e => setSettings({ ...settings, overdueGraceDays: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div className="glass-panel">
              <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} /> الإشعارات
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'notifyOnOverdue', label: 'إشعار عند تأخر الأقساط' },
                  { key: 'notifyOnRegistration', label: 'إشعار عند تسجيل طالب جديد' },
                  { key: 'backupEnabled', label: 'النسخ الاحتياطي التلقائي' },
                ].map(item => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 10 }}>
                    <input type="checkbox" checked={settings[item.key as keyof typeof settings] === 'true'}
                      onChange={e => setSettings({ ...settings, [item.key]: e.target.checked ? 'true' : 'false' })} />
                    <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                    <span className={`badge ${settings[item.key as keyof typeof settings] === 'true' ? 'success' : 'danger'}`} style={{ fontSize: '0.72rem', marginRight: 'auto' }}>
                      {settings[item.key as keyof typeof settings] === 'true' ? 'مفعّل' : 'معطّل'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {hasPermission('admin.settings.edit') && (
                <button className="glass-btn" style={{ minWidth: 180 }} onClick={handleSave} disabled={saving}>
                  <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              )}
            </div>
          </>
        )}

        {/* ===== TAB: BACKGROUNDS ===== */}
        {tab === 'backgrounds' && (
          <>
            {/* Portal tabs */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex' }}>
                {PORTALS.map(p => (
                  <button key={p.key} onClick={() => { setBgPortal(p.key); }}
                    style={{
                      flex: 1, padding: '14px 0', cursor: 'pointer', border: 'none', background: 'transparent',
                      borderBottom: bgPortal === p.key ? '2px solid var(--primary)' : '2px solid transparent',
                      color: bgPortal === p.key ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: bgPortal === p.key ? 700 : 500, fontSize: '0.82rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.2s',
                    }}>
                    <p.icon size={16} /> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="glass-panel" style={{
              position: 'relative', overflow: 'hidden', minHeight: 180,
              background: bgPreview() ? `url(${bgPreview()}) center/cover no-repeat` : portal.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16,
            }}>
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', borderRadius: 16,
              }} />
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{portal.label}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 6 }}>
                  {bgForm.type === 'GRADIENT' && 'خلفية متدرجة (افتراضي)'}
                  {bgForm.type === 'IMAGE' && 'خلفية صورة'}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="glass-panel">
              <h4 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Palette size={16} /> إعدادات الخلفية
              </h4>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  { type: 'GRADIENT', label: 'تدرج افتراضي', icon: Palette },
                  { type: 'IMAGE', label: 'صورة مرفوعة', icon: Image },
                ].map(opt => (
                  <button key={opt.type} onClick={() => setBgForm({ type: opt.type, content: bgForm.type === opt.type ? bgForm.content : '' })}
                    className={`glass-btn ${bgForm.type === opt.type ? '' : 'secondary'}`}
                    style={{ flex: 1, justifyContent: 'center', minWidth: 100, height: 40, border: bgForm.type === opt.type ? '2px solid var(--primary)' : '2px solid transparent' }}>
                    <opt.icon size={15} /> {opt.label}
                  </button>
                ))}
              </div>

              {bgForm.type === 'IMAGE' && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>اختر صورة من جهازك. يفضل 1920×1080 أو أعلى.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="glass-btn" onClick={() => bgFileInputRef.current?.click()} style={{ justifyContent: 'center' }}>
                      <Image size={14} /> اختيار صورة
                    </button>
                    {bgForm.content && hasPermission('admin.settings.edit') && <button className="glass-btn danger sm" onClick={() => setBgForm({ ...bgForm, content: '' })}><X size={14} /> إزالة</button>}
                  </div>
                  <input ref={bgFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
                </div>
              )}

              {bgForm.type === 'GRADIENT' && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>اختر ألوان التدرج لتخصيص الخلفية.</p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    {bgGradientColors().map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" value={c} onChange={e => {
                          const next = bgGradientColors(); next[i] = e.target.value;
                          setBgForm({ type: 'GRADIENT', content: `linear-gradient(135deg, ${next.join(', ')})` });
                        }} style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'none', padding: 2 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c}</span>
                      </div>
                    ))}
                    {bgGradientColors().length < 3 && (
                      <button className="glass-btn sm" onClick={() => setBgForm({ type: 'GRADIENT', content: `linear-gradient(135deg, ${[...bgGradientColors(), '#ffffff'].join(', ')})` })} style={{ height: 32, fontSize: '0.75rem', padding: '0 10px' }}>
                        + إضافة لون
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {hasPermission('admin.settings.edit') && (
                  <button className="glass-btn" onClick={handleBgSave} disabled={bgSaving} style={{ minWidth: 140, justifyContent: 'center' }}>
                    <Save size={14} /> {bgSaving ? 'جاري الحفظ...' : 'حفظ الخلفية'}
                  </button>
                )}
                <button className="glass-btn secondary" onClick={loadBackgrounds} style={{ justifyContent: 'center' }}>
                  <RefreshCw size={14} /> إعادة تحميل
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===== TAB: ACTIVITY ===== */}
        {tab === 'activity' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
                <Activity size={20} color="var(--primary)" /> سجل النشاطات
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({logs.length} سجل)</span>
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="glass-btn secondary" onClick={fetchLogs} disabled={isLoadingLogs}>
                  <RefreshCw size={15} className={isLoadingLogs ? 'spin' : ''} /> تحديث
                </button>
                {hasPermission('admin.settings.edit') && (
                  <button className="glass-btn secondary" onClick={clearLogs} style={{ color: 'var(--danger)' }}>
                    <Trash2 size={15} /> مسح
                  </button>
                )}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                <select className="glass-input" style={{ flex: '0 1 160px', fontSize: '0.82rem' }}
                  value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                  <option value="">جميع الإجراءات</option>
                  {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="glass-input" style={{ flex: '0 1 160px', fontSize: '0.82rem' }}
                  value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
                  <option value="">جميع الكيانات</option>
                  {uniqueEntities.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <button className="glass-btn secondary sm" onClick={() => { setFilterAction(''); setFilterEntity(''); }}>
                  إعادة ضبط
                </button>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 0 }}>
              <div className="glass-table-container">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>الإجراء</th>
                      <th>الكيان</th>
                      <th>المستخدم</th>
                      <th>التفاصيل</th>
                      <th>IP</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const details = parseDetails(log.details);
                      return (
                        <tr key={log.id}>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: '0.78rem', color: ACTION_COLORS[log.action] || '#fff', background: `${ACTION_COLORS[log.action]}20`, padding: '2px 8px', borderRadius: 20 }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.83rem', fontWeight: 600 }}>{log.entity}</td>
                          <td>
                            <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{log.user?.fullName || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{log.user?.username}</div>
                          </td>
                          <td style={{ fontSize: '0.78rem', maxWidth: 180 }}>
                            {typeof details === 'object' && details !== null ? (
                              <div style={{ color: 'var(--text-muted)' }}>
                                {Object.entries(details).slice(0, 2).map(([k, v]) => (
                                  <div key={k}><strong>{k}:</strong> {String(v).slice(0, 30)}</div>
                                ))}
                              </div>
                            ) : <span style={{ color: 'var(--text-muted)' }}>{String(details || '—').slice(0, 60)}</span>}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', direction: 'ltr' }}>{log.ipAddress || '—'}</td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            <div>{formatDate(log.createdAt)}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(log.createdAt).toLocaleTimeString('ar-JO')}</div>
                          </td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, opacity: 0.5 }}>
                        {isLoadingLogs ? 'جارٍ التحميل...' : 'لا توجد سجلات'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </PermissionGuard>
  );
};
