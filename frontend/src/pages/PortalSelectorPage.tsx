import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Briefcase, ChevronLeft, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const PortalSelectorPage = () => {
  const { user, logout, centerName, centerLogo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const portals = [
    {
      key: 'admin',
      icon: <Briefcase size={32}/>,
      title: 'بوابة الإدارة',
      description: 'لوحة التحكم الكاملة — للمسؤولين والمشرفين',
      gradient: 'linear-gradient(135deg, #722F37, #C9A93E)',
      path: '/',
      portalKey: 'ADMIN',
    },
    {
      key: 'employee',
      icon: <Briefcase size={32}/>,
      title: 'بوابة الموظفين',
      description: 'الخدمات الإدارية — للطلاب والتسجيلات والخدمات اليومية',
      gradient: 'linear-gradient(135deg, #6B2430, #D4AF37)',
      path: '/employee-portal',
      portalKey: 'EMPLOYEE',
    },
    {
      key: 'student',
      icon: <GraduationCap size={32}/>,
      title: 'بوابة الطالب',
      description: 'الجدول الدراسي، سجل الحضور، الدفعات، المعلومات الشخصية',
      gradient: 'linear-gradient(135deg, #10b981, #3b82f6)',
      path: '/student-portal',
      portalKey: 'STUDENT',
    },
    {
      key: 'instructor',
      icon: <BookOpen size={32}/>,
      title: 'بوابة المحاضر',
      description: 'إدارة الشعب، تسجيل الحضور، عرض الجداول',
      gradient: 'linear-gradient(135deg, #8b5cf6, #f59e0b)',
      path: '/instructor-portal',
      portalKey: 'INSTRUCTOR',
    },
  ];

  // Filter portals based on user's assigned portals
  const userPortalKeys = (user?.portals || []).map(p => p.toUpperCase());
  const availablePortals = portals.filter(p => userPortalKeys.includes(p.portalKey));

  // If only one portal matches, auto-redirect
  useEffect(() => {
    if (availablePortals.length === 1) {
      navigate(availablePortals[0].path, { replace: true });
    }
  }, [user?.portals]);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-gradient)', backgroundAttachment: 'fixed',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', direction: 'rtl', fontFamily: 'Cairo, sans-serif',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{ position: 'absolute', top: 20, left: 20 }}
        className="glass-btn secondary icon-only"
      >
        {theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}
      </button>

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        {centerLogo
          ? <img src={centerLogo} alt="logo" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', boxShadow: '0 12px 40px rgba(59,130,246,0.25)', marginBottom: 16 }}/>
          : <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg,var(--primary),var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 12px 40px rgba(59,130,246,0.3)', margin: '0 auto 16px' }}>
              <GraduationCap size={36}/>
            </div>
        }
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>{centerName}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          مرحباً {user?.fullName} — اختر البوابة المناسبة لك
        </p>
      </div>

      {/* Portal cards */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
        {availablePortals.map(portal => (
          <div
            key={portal.key}
            onClick={() => navigate(portal.path)}
            className="hover-glass"
            style={{
              width: 260, padding: '32px 28px', borderRadius: 24,
              background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-border)', cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              textAlign: 'center', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 24px 60px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            {/* Gradient icon */}
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: portal.gradient, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff', margin: '0 auto 20px',
              boxShadow: `0 8px 24px rgba(0,0,0,0.2)`,
            }}>
              {portal.icon}
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 8 }}>{portal.title}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
              {portal.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--primary)', fontWeight: 700, fontSize: '0.88rem' }}>
              ادخل <ChevronLeft size={16}/>
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={() => logout()}
        className="glass-btn secondary"
        style={{ marginTop: 40, fontSize: '0.88rem' }}
      >
        تسجيل الخروج
      </button>
    </div>
  );
};
