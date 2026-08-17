import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = `${API_BASE}/api`;

// Resolve a file path from the backend to a full URL
export function fileUrl(filePath: string | null | undefined): string {
  if (!filePath) return '';
  if (filePath.startsWith('data:')) return filePath;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith('/uploads/')) {
    return `${API_BASE}/api/files/${filePath.replace('/uploads/', '')}`;
  }
  return filePath;
}

// Map new granular permissions → older flat keys for backward compatibility
const PERMISSION_ALIASES: Record<string, string[]> = {
  'courses.view': ['courses.manage'],
  'courses.add': ['courses.manage'],
  'courses.edit': ['courses.manage'],
  'courses.delete': ['courses.manage'],
  'diplomas.view': ['diplomas.manage'],
  'diplomas.add': ['diplomas.manage'],
  'diplomas.edit': ['diplomas.manage'],
  'diplomas.delete': ['diplomas.manage'],
  'sections.view': ['sections.manage'],
  'sections.add': ['sections.manage'],
  'sections.edit': ['sections.manage'],
  'sections.delete': ['sections.manage'],
  'attendance.view': ['attendance.manage'],
  'employees.view': ['employees.manage', 'admin.users'],
  'employees.add': ['employees.manage', 'admin.users'],
  'employees.edit': ['employees.manage', 'admin.users'],
  'employees.delete': ['employees.manage', 'admin.users'],
  'employees.salaries': ['employees.manage', 'admin.users'],
  'admin.users.view': ['admin.users', 'admin.users.manage'],
  'admin.users.add': ['admin.users', 'admin.users.manage'],
  'admin.users.edit': ['admin.users', 'admin.users.manage'],
  'admin.users.delete': ['admin.users', 'admin.users.manage'],
  'admin.settings.view': ['admin.settings', 'admin.settings.manage'],
  'admin.settings.edit': ['admin.settings', 'admin.settings.manage'],
  'admin.entities.view': ['admin.entities', 'admin.entities.manage'],
  'admin.entities.add': ['admin.entities', 'admin.entities.manage'],
  'admin.entities.edit': ['admin.entities', 'admin.entities.manage'],
  'admin.entities.delete': ['admin.entities', 'admin.entities.manage'],
  'admin.rooms.view': ['admin.rooms', 'admin.rooms.manage'],
  'admin.rooms.add': ['admin.rooms', 'admin.rooms.manage'],
  'admin.rooms.edit': ['admin.rooms', 'admin.rooms.manage'],
  'admin.rooms.delete': ['admin.rooms', 'admin.rooms.manage'],
  'admin.instructors.view': ['admin.instructors', 'admin.instructors.manage'],
  'admin.instructors.add': ['admin.instructors', 'admin.instructors.manage'],
  'admin.instructors.edit': ['admin.instructors', 'admin.instructors.manage'],
  'admin.instructors.delete': ['admin.instructors', 'admin.instructors.manage'],
  'admin.announcements.view': ['admin.announcements', 'admin.announcements.manage'],
  'admin.announcements.add': ['admin.announcements', 'admin.announcements.manage'],
  'admin.announcements.edit': ['admin.announcements', 'admin.announcements.manage'],
  'admin.announcements.delete': ['admin.announcements', 'admin.announcements.manage'],
  'files.view': ['files.manage'],
  'files.add': ['files.manage'],
  'files.delete': ['files.manage'],
  'notes.view': ['notes.manage'],
  'notes.add': ['notes.manage'],
  'notes.edit': ['notes.manage'],
  'notes.delete': ['notes.manage'],
  'documents.view': ['documents.manage'],
  'documents.add': ['documents.manage'],
  'documents.edit': ['documents.manage'],
  'documents.delete': ['documents.manage'],
};

// ============ PERMISSIONS DEFINITIONS ============
export const ALL_PERMISSIONS = [
  // ════════════════════════════════════════
  // التسجيل
  // ════════════════════════════════════════
  // صفحة الطلاب
  { key: 'students.view', label: 'عرض الطلاب (استعلام)', group: 'التسجيل', page: 'صفحة الطلاب' },
  { key: 'students.add', label: 'إضافة طالب', group: 'التسجيل', page: 'صفحة الطلاب' },
  { key: 'students.edit', label: 'تعديل بيانات طالب', group: 'التسجيل', page: 'صفحة الطلاب' },
  { key: 'students.delete', label: 'حذف طالب', group: 'التسجيل', page: 'صفحة الطلاب' },
  { key: 'students.change_status', label: 'تغيير حالة طالب', group: 'التسجيل', page: 'صفحة الطلاب' },
  { key: 'students.change_date', label: 'تغيير تاريخ طالب', group: 'التسجيل', page: 'صفحة الطلاب' },
  // صفحة الاشتراكات
  { key: 'subscriptions.view', label: 'عرض الاشتراكات', group: 'التسجيل', page: 'صفحة الاشتراكات' },
  { key: 'subscriptions.add', label: 'إضافة اشتراك', group: 'التسجيل', page: 'صفحة الاشتراكات' },
  { key: 'subscriptions.edit', label: 'تعديل / إلغاء اشتراك', group: 'التسجيل', page: 'صفحة الاشتراكات' },
  { key: 'subscriptions.delete', label: 'حذف اشتراك', group: 'التسجيل', page: 'صفحة الاشتراكات' },
  { key: 'subscriptions.change_status', label: 'تغيير حالة اشتراك', group: 'التسجيل', page: 'صفحة الاشتراكات' },
  // صفحة الدورات
  { key: 'courses.view', label: 'عرض الدورات', group: 'التسجيل', page: 'صفحة الدورات' },
  { key: 'courses.add', label: 'إضافة دورة', group: 'التسجيل', page: 'صفحة الدورات' },
  { key: 'courses.edit', label: 'تعديل دورة', group: 'التسجيل', page: 'صفحة الدورات' },
  { key: 'courses.delete', label: 'حذف دورة', group: 'التسجيل', page: 'صفحة الدورات' },
  { key: 'courses.manage', label: 'إدارة الدورات (كاملة)', group: 'التسجيل', page: 'صفحة الدورات' },
  // صفحة الدبلومات
  { key: 'diplomas.view', label: 'عرض الدبلومات', group: 'التسجيل', page: 'صفحة الدبلومات' },
  { key: 'diplomas.add', label: 'إضافة دبلوم', group: 'التسجيل', page: 'صفحة الدبلومات' },
  { key: 'diplomas.edit', label: 'تعديل دبلوم', group: 'التسجيل', page: 'صفحة الدبلومات' },
  { key: 'diplomas.delete', label: 'حذف دبلوم', group: 'التسجيل', page: 'صفحة الدبلومات' },
  { key: 'diplomas.manage', label: 'إدارة الدبلومات (كاملة)', group: 'التسجيل', page: 'صفحة الدبلومات' },
  // صفحة الشعب
  { key: 'sections.view', label: 'عرض الشعب', group: 'التسجيل', page: 'صفحة الشعب' },
  { key: 'sections.add', label: 'إضافة شعبة', group: 'التسجيل', page: 'صفحة الشعب' },
  { key: 'sections.edit', label: 'تعديل شعبة', group: 'التسجيل', page: 'صفحة الشعب' },
  { key: 'sections.delete', label: 'حذف شعبة', group: 'التسجيل', page: 'صفحة الشعب' },
  { key: 'sections.manage', label: 'إدارة الشعب (كاملة)', group: 'التسجيل', page: 'صفحة الشعب' },
  { key: 'sections.assign', label: 'إسناد الطلاب للشعب', group: 'التسجيل', page: 'صفحة الشعب' },
  // صفحة الحضور
  { key: 'attendance.view', label: 'عرض الحضور', group: 'التسجيل', page: 'صفحة الحضور' },
  { key: 'attendance.manage', label: 'تسجيل وتعديل الحضور', group: 'التسجيل', page: 'صفحة الحضور' },
  { key: 'attendance.admin', label: 'إدارة الحضور (فتح/تعديل/حذف)', group: 'التسجيل', page: 'صفحة الحضور' },
  // الدرجات
  { key: 'grades.approve', label: 'اعتماد الدرجات', group: 'التسجيل', page: 'صفحة الدرجات' },
  // التقارير الأكاديمية
  { key: 'reports.academic', label: 'التقارير الأكاديمية', group: 'التسجيل', page: 'التقارير الأكاديمية' },

  // ════════════════════════════════════════
  // الموظفون
  // ════════════════════════════════════════
  // صفحة الموظفين
  { key: 'employees.view', label: 'عرض الموظفين (استعلام)', group: 'الموظفون', page: 'صفحة الموظفين' },
  { key: 'employees.add', label: 'إضافة موظف', group: 'الموظفون', page: 'صفحة الموظفين' },
  { key: 'employees.edit', label: 'تعديل موظف', group: 'الموظفون', page: 'صفحة الموظفين' },
  { key: 'employees.delete', label: 'حذف موظف', group: 'الموظفون', page: 'صفحة الموظفين' },
  { key: 'employees.manage', label: 'إدارة الموظفين (كاملة)', group: 'الموظفون', page: 'صفحة الموظفين' },
  // الرواتب والعمولات
  { key: 'employees.salaries', label: 'الرواتب والعمولات', group: 'الموظفون', page: 'الرواتب والعمولات' },

  // ════════════════════════════════════════
  // المالية
  // ════════════════════════════════════════
  // الصفحة الرئيسية
  { key: 'finance.view', label: 'عرض المالية', group: 'المالية', page: 'الصفحة الرئيسية' },
  // سندات القبض
  { key: 'finance.receipts', label: 'سندات القبض', group: 'المالية', page: 'سندات القبض' },
  // سندات الصرف
  { key: 'finance.payments', label: 'سندات الصرف', group: 'المالية', page: 'سندات الصرف' },
  // إدارة الأقساط
  { key: 'finance.installments', label: 'إدارة الأقساط', group: 'المالية', page: 'إدارة الأقساط' },
  // التقارير المالية
  { key: 'finance.reports', label: 'التقارير المالية', group: 'المالية', page: 'التقارير المالية' },
  // التسويات والشراكات
  { key: 'finance.settlements', label: 'التسويات والشراكات', group: 'المالية', page: 'التسويات والشراكات' },
  // حسابات المحاضرين
  { key: 'finance.accounts', label: 'حسابات المحاضرين', group: 'المالية', page: 'حسابات المحاضرين' },
  // المطالبات
  { key: 'finance.claims', label: 'المطالبات', group: 'المالية', page: 'المطالبات' },

  // ════════════════════════════════════════
  // الإدارة
  // ════════════════════════════════════════
  // المستخدمون والصلاحيات
  { key: 'admin.users.view', label: 'عرض المستخدمين (استعلام)', group: 'الإدارة', page: 'المستخدمون والصلاحيات' },
  { key: 'admin.users.add', label: 'إضافة مستخدم', group: 'الإدارة', page: 'المستخدمون والصلاحيات' },
  { key: 'admin.users.edit', label: 'تعديل مستخدم', group: 'الإدارة', page: 'المستخدمون والصلاحيات' },
  { key: 'admin.users.delete', label: 'حذف مستخدم', group: 'الإدارة', page: 'المستخدمون والصلاحيات' },
  { key: 'admin.users.manage', label: 'إدارة المستخدمين (كاملة)', group: 'الإدارة', page: 'المستخدمون والصلاحيات' },
  // إعدادات النظام
  { key: 'admin.settings.view', label: 'عرض الإعدادات', group: 'الإدارة', page: 'إعدادات النظام' },
  { key: 'admin.settings.edit', label: 'تعديل الإعدادات', group: 'الإدارة', page: 'إعدادات النظام' },
  { key: 'admin.settings.manage', label: 'إدارة إعدادات النظام (كاملة)', group: 'الإدارة', page: 'إعدادات النظام' },
  // سجل العمليات
  { key: 'admin.audit', label: 'سجل العمليات', group: 'الإدارة', page: 'سجل العمليات' },
  // الجهات التعليمية
  { key: 'admin.entities.view', label: 'عرض الجهات التعليمية (استعلام)', group: 'الإدارة', page: 'الجهات التعليمية' },
  { key: 'admin.entities.add', label: 'إضافة جهة تعليمية', group: 'الإدارة', page: 'الجهات التعليمية' },
  { key: 'admin.entities.edit', label: 'تعديل جهة تعليمية', group: 'الإدارة', page: 'الجهات التعليمية' },
  { key: 'admin.entities.delete', label: 'حذف جهة تعليمية', group: 'الإدارة', page: 'الجهات التعليمية' },
  { key: 'admin.entities.manage', label: 'إدارة الجهات (كاملة)', group: 'الإدارة', page: 'الجهات التعليمية' },
  // القاعات والمختبرات
  { key: 'admin.rooms.view', label: 'عرض القاعات (استعلام)', group: 'الإدارة', page: 'القاعات والمختبرات' },
  { key: 'admin.rooms.add', label: 'إضافة قاعة', group: 'الإدارة', page: 'القاعات والمختبرات' },
  { key: 'admin.rooms.edit', label: 'تعديل قاعة', group: 'الإدارة', page: 'القاعات والمختبرات' },
  { key: 'admin.rooms.delete', label: 'حذف قاعة', group: 'الإدارة', page: 'القاعات والمختبرات' },
  { key: 'admin.rooms.manage', label: 'إدارة القاعات (كاملة)', group: 'الإدارة', page: 'القاعات والمختبرات' },
  // حسابات المدرّبين
  { key: 'admin.instructors.view', label: 'عرض المدرّبين (استعلام)', group: 'الإدارة', page: 'حسابات المدرّبين' },
  { key: 'admin.instructors.add', label: 'إضافة حساب مدرّب', group: 'الإدارة', page: 'حسابات المدرّبين' },
  { key: 'admin.instructors.edit', label: 'تعديل حساب مدرّب', group: 'الإدارة', page: 'حسابات المدرّبين' },
  { key: 'admin.instructors.delete', label: 'حذف حساب مدرّب', group: 'الإدارة', page: 'حسابات المدرّبين' },
  { key: 'admin.instructors.manage', label: 'إدارة حسابات المدرّبين (كاملة)', group: 'الإدارة', page: 'حسابات المدرّبين' },
  // الإعلانات
  { key: 'admin.announcements.view', label: 'عرض الإعلانات (استعلام)', group: 'الإدارة', page: 'الإعلانات' },
  { key: 'admin.announcements.add', label: 'إضافة إعلان', group: 'الإدارة', page: 'الإعلانات' },
  { key: 'admin.announcements.edit', label: 'تعديل إعلان', group: 'الإدارة', page: 'الإعلانات' },
  { key: 'admin.announcements.delete', label: 'حذف إعلان', group: 'الإدارة', page: 'الإعلانات' },
  { key: 'admin.announcements.manage', label: 'إدارة الإعلانات (كاملة)', group: 'الإدارة', page: 'الإعلانات' },

  // ════════════════════════════════════════
  // التطبيقات
  // ════════════════════════════════════════
  // الملفات
  { key: 'files.view', label: 'عرض الملفات (استعلام)', group: 'التطبيقات', page: 'الملفات' },
  { key: 'files.add', label: 'رفع ملف', group: 'التطبيقات', page: 'الملفات' },
  { key: 'files.delete', label: 'حذف ملف', group: 'التطبيقات', page: 'الملفات' },
  { key: 'files.manage', label: 'إدارة الملفات (كاملة)', group: 'التطبيقات', page: 'الملفات' },
  // الملاحظات
  { key: 'notes.view', label: 'عرض الملاحظات (استعلام)', group: 'التطبيقات', page: 'الملاحظات' },
  { key: 'notes.add', label: 'إضافة ملاحظة', group: 'التطبيقات', page: 'الملاحظات' },
  { key: 'notes.edit', label: 'تعديل ملاحظة', group: 'التطبيقات', page: 'الملاحظات' },
  { key: 'notes.delete', label: 'حذف ملاحظة', group: 'التطبيقات', page: 'الملاحظات' },
  { key: 'notes.manage', label: 'إدارة الملاحظات (كاملة)', group: 'التطبيقات', page: 'الملاحظات' },
  // المستندات
  { key: 'documents.view', label: 'عرض المستندات (استعلام)', group: 'التطبيقات', page: 'المستندات' },
  { key: 'documents.add', label: 'إضافة مستند', group: 'التطبيقات', page: 'المستندات' },
  { key: 'documents.edit', label: 'تعديل مستند', group: 'التطبيقات', page: 'المستندات' },
  { key: 'documents.delete', label: 'حذف مستند', group: 'التطبيقات', page: 'المستندات' },
  { key: 'documents.manage', label: 'إدارة المستندات (كاملة)', group: 'التطبيقات', page: 'المستندات' },
];

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  permissions: string[];
  status: string;
  portals: string[];
  portalTabs: string[];
  studentId?: string;
  instructorId?: string;
  employeeId?: string;
  profileImage?: string | null;
  aboutStatus?: string;
  points: number;
  teamLeaderId?: number | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  centerName: string;
  centerNameEn: string;
  centerLogo: string;
  settingsLoaded: boolean;
  activePortal: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string, portal?: string) => Promise<any>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  updateCenter: (name: string, nameEn: string, logo: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    settingsLoaded: false,
    centerName: localStorage.getItem('centerName') || '',
    centerNameEn: localStorage.getItem('centerNameEn') || '',
    centerLogo: localStorage.getItem('centerLogo') || '',
    activePortal: localStorage.getItem('ems_active_portal') || null,
  });

  // Set document title from localStorage immediately on mount
  useEffect(() => {
    const savedName = localStorage.getItem('centerName');
    if (savedName) document.title = savedName;
  }, []);

  // On mount: restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('ems_token');
    if (savedToken) {
      // Verify token is still valid by calling /me
      fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(user => {
          if (user) {
            setState(prev => ({ ...prev, user, token: savedToken, isLoading: false }));
          } else {
            localStorage.removeItem('ems_token');
            setState(prev => ({ ...prev, isLoading: false }));
          }
        })
        .catch(() => {
          setState(prev => ({ ...prev, isLoading: false }));
        });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API}/settings`);
        if (res.ok) {
          const data = await res.json();
            if (data.centerName) {
              try { localStorage.setItem('centerName', data.centerName); } catch {}
              setState(prev => ({ ...prev, centerName: data.centerName }));
              document.title = data.centerName;
            }
          if (data.centerNameEn) {
            try { localStorage.setItem('centerNameEn', data.centerNameEn); } catch {}
            setState(prev => ({ ...prev, centerNameEn: data.centerNameEn }));
          }
          if (data.centerLogo) {
            const resolved = fileUrl(data.centerLogo);
            try { localStorage.setItem('centerLogo', resolved); } catch {}
            setState(prev => ({ ...prev, centerLogo: resolved }));
          }
        }
      } catch { /* ignore */ }
      setState(prev => ({ ...prev, settingsLoaded: true }));
    };
    if (!state.settingsLoaded) fetchSettings();
  }, [state.settingsLoaded]);

  const login = async (username: string, password: string, portal?: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, portal })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'فشل تسجيل الدخول');
    }

    localStorage.setItem('ems_token', data.token);
    if (portal) {
      localStorage.setItem('ems_active_portal', portal.toUpperCase());
    }
    setState(prev => ({ ...prev, user: data.user, token: data.token, activePortal: portal?.toUpperCase() || null }));

    // Sync localStorage settings to backend (for incognito / fresh browsers)
    const localName = localStorage.getItem('centerName');
    const localNameEn = localStorage.getItem('centerNameEn');
    const localLogo = localStorage.getItem('centerLogo');
    const body: Record<string, string> = {};
    if (localName) body.centerName = localName ?? '';
    if (localNameEn) body.centerNameEn = localNameEn ?? '';
    if (localLogo) body.centerLogo = localLogo ?? '';
    if (Object.keys(body).length > 0) {
      await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify(body),
      }).catch(() => {});
      // Re-fetch settings so state reflects DB
      setState(prev => ({ ...prev, settingsLoaded: false }));
    }

    return data.user;
  };

  const logout = async () => {
    try {
      if (state.token) {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.token}` }
        });
      }
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_active_portal');
    setState(prev => ({ ...prev, user: null, token: null, activePortal: null }));
  };

  const hasPermission = (perm: string): boolean => {
    if (!state.user) return false;
    if (state.user.isAdmin || state.user.permissions.includes('ADMIN_ALL')) return true;
    if (state.user.permissions.includes(perm)) return true;
    // Bare admin.X grants from any granular admin.X.* permission (e.g. admin.users ← admin.users.manage)
    if (/^admin\.[a-zA-Z]+$/.test(perm) && state.user.permissions.some(p => p.startsWith(`${perm}.`))) return true;
    const aliases = PERMISSION_ALIASES[perm];
    if (aliases) {
      for (const alias of aliases) {
        if (state.user.permissions.includes(alias)) return true;
      }
    }
    return false;
  };

  const updateCenter = async (name: string, nameEn: string, logo: string) => {
    const resolvedLogo = fileUrl(logo);
    setState(prev => ({ ...prev, centerName: name, centerNameEn: nameEn, centerLogo: resolvedLogo }));
    try { localStorage.setItem('centerName', name); } catch { /* quota / private mode */ }
    try { localStorage.setItem('centerNameEn', nameEn); } catch { /* quota / private mode */ }
    try { localStorage.setItem('centerLogo', resolvedLogo); } catch { /* quota / private mode */ }
    try {
      const token = localStorage.getItem('ems_token');
      if (token) {
        await fetch(`${API}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ centerName: name, centerNameEn: nameEn, centerLogo: logo }),
        });
      }
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, updateCenter }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// API helper with auth token
export const useApi = () => {
  const { token, logout } = useAuth();

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (res.status === 401) {
      await logout();
      throw new Error('انتهت الجلسة. يرجى تسجيل الدخول.');
    }

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch { throw new Error('الخادم غير متصل أو حدث خطأ غير متوقع'); }
    if (!res.ok) throw new Error(data.error || 'حدث خطأ في الخادم');
    return data;
  }, [token, logout]);

  return { apiFetch };
};
