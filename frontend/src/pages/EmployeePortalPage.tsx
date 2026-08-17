import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, Sun, Moon, Settings,
  Users, GraduationCap, UserCheck, BookOpen, FileText, BarChart,
  Briefcase, DollarSign, CreditCard, ArrowLeft
} from 'lucide-react';
import { useAuth, fileUrl } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const QUICK_LINKS = [
  { path: '/students', label: 'الطلاب', icon: <Users size={18} />, color: '#6366f1' },
  { path: '/subscriptions', label: 'تسجيل الطلاب', icon: <GraduationCap size={18} />, color: '#8b5cf6' },
  { path: '/attendance', label: 'الحضور', icon: <UserCheck size={18} />, color: '#ec4899' },
  { path: '/student-management', label: 'إدارة الطلاب', icon: <Users size={18} />, color: '#14b8a6' },
  { path: '/grades', label: 'العلامات', icon: <FileText size={18} />, color: '#f97316' },
  { path: '/manage-courses', label: 'الدورات', icon: <BookOpen size={18} />, color: '#06b6d4' },
  { path: '/manage-sections', label: 'الشعب', icon: <BookOpen size={18} />, color: '#10b981' },
  { path: '/add-to-section', label: 'السحب والإضافة', icon: <UserCheck size={18} />, color: '#eab308' },
  { path: '/installments', label: 'الأقساط', icon: <CreditCard size={18} />, color: '#22c55e' },
  { path: '/receipts', label: 'المقبوضات', icon: <DollarSign size={18} />, color: '#3b82f6' },
  { path: '/academic-reports', label: 'التقارير', icon: <BarChart size={18} />, color: '#a855f7' },
  { path: '/employees', label: 'الموظفين', icon: <Briefcase size={18} />, color: '#64748b' },
];

export const EmployeePortalPage = () => {
  const { user, logout, centerName, centerLogo, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const visibleLinks = QUICK_LINKS.filter(l => !l.path.startsWith('/admin') && hasPermission(
    l.path === '/students' ? 'students.view' :
    l.path === '/subscriptions' ? 'subscriptions.add' :
    l.path === '/attendance' ? 'attendance.manage' :
    l.path === '/student-management' ? 'students.view' :
    l.path === '/grades' ? 'students.view' :
    l.path === '/manage-courses' ? 'courses.manage' :
    l.path === '/manage-sections' ? 'sections.manage' :
    l.path === '/add-to-section' ? 'sections.assign' :
    l.path === '/installments' ? 'finance.installments' :
    l.path === '/receipts' ? 'finance.installments' :
    l.path === '/academic-reports' ? 'reports.academic' :
    l.path === '/employees' ? 'employees.view' : 'none'
  ));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8f6f3 0%, #f0ece6 50%, #e8e2d8 100%)',
      direction: 'rtl',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px', background: '#fff',
        borderBottom: '2px solid #722F37',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {centerLogo && (
            <img src={fileUrl(centerLogo)} alt="" style={{ height: 36, borderRadius: 8 }} />
          )}
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#722F37' }}>
            {centerName || 'بوابة الموظفين'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user?.fullName}</span>
          <button onClick={toggleTheme} className="glass-btn secondary xs" title={theme === 'dark' ? 'فاتح' : 'داكن'}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => navigate('/settings')} className="glass-btn secondary xs" title="الإعدادات">
            <Settings size={14} />
          </button>
          <button onClick={logout} className="glass-btn secondary xs" title="تسجيل خروج" style={{ color: 'var(--danger)' }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Hero section */}
      <div style={{
        padding: '48px 24px 32px', textAlign: 'center',
        background: 'linear-gradient(180deg, rgba(114,47,55,0.06) 0%, transparent 100%)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #9F2D3F, #7A2030)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', margin: '0 auto 20px',
          boxShadow: '0 8px 24px rgba(114,47,55,0.25)',
        }}>
          <Briefcase size={34} />
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', color: '#722F37', fontWeight: 800 }}>
          مرحباً، {user?.fullName}
        </h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {centerName} — بوابة الموظفين
        </p>
      </div>

      {/* Main action */}
      <div style={{ padding: '0 24px 24px', maxWidth: 500, margin: '0 auto' }}>
        <button onClick={() => navigate('/')}
          style={{
            width: '100%', padding: '16px 24px', border: 'none', borderRadius: 14,
            background: 'linear-gradient(135deg, #722F37, #9A4A55)',
            color: '#fff', fontFamily: 'Cairo', fontSize: '1rem', fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 4px 16px rgba(114,47,55,0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(114,47,55,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(114,47,55,0.3)'; }}>
          <LayoutDashboard size={20} />
          الدخول إلى لوحة التحكم
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Quick links */}
      {visibleLinks.length > 0 && (
        <div style={{ padding: '8px 24px 40px', maxWidth: 700, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            أو اختر خدمة مباشرة:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {visibleLinks.map(l => (
              <div key={l.path} onClick={() => navigate(l.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '16px 10px', borderRadius: 12, cursor: 'pointer',
                  background: '#fff', border: '1px solid #e8e2d8',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#722F37'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e2d8'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: l.color + '18', color: l.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {l.icon}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
