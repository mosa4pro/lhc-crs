import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, fileUrl } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import ChatSidebar from './ChatPanel';
import { AnnouncementBanner } from './AnnouncementBanner';
import { useTheme } from '../context/ThemeContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import {
  Users, GraduationCap, DollarSign, Settings, LayoutDashboard, BookOpen,
  Layers, ChevronDown, ChevronUp, UserCheck, Search, BarChart,
  FileText, CreditCard, Shield, Moon, Sun, LogOut, Activity, Building2,
  Calendar, UserSquare, Briefcase, PieChart, ClipboardList, Receipt,
  TrendingUp, Wallet, HandCoins, Award,
  MessageSquare, Palette, Megaphone, Pin, PinOff, X, Folder, StickyNote,
  MessageCircle
} from 'lucide-react';

interface MenuItem {
  path: string;
  name: string;
  icon: React.ReactNode;
  permission?: string;
  badge?: string;
}

interface MenuGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    key: 'registration',
    label: 'إدارة التسجيل',
    icon: <GraduationCap size={17} />,
    color: 'var(--primary)',
    items: [
      { path: '/students', name: 'إضافة طالب', icon: <Users size={15} />, permission: 'students.view' },

      { path: '/subscriptions', name: 'تسجيل الطلاب', icon: <GraduationCap size={15} />, permission: 'subscriptions.add' },
      { path: '/student-profile', name: 'ملف الطالب', icon: <UserSquare size={15} />, permission: 'students.view' },
      { path: '/academic-reports', name: 'التقارير الأكاديمية', icon: <BarChart size={15} />, permission: 'reports.academic' },
    ],
  },
  {
    key: 'student_affairs',
    label: 'شؤون الطلبة',
    icon: <Users size={17} />,
    color: '#06b6d4',
    items: [
      { path: '/student-management', name: 'إدارة الطلاب', icon: <Users size={15} />, permission: 'students.view' },
      { path: '/grades', name: 'العلامات', icon: <FileText size={15} />, permission: 'students.view' },
      { path: '/attendance', name: 'الحضور والغياب', icon: <UserCheck size={15} />, permission: 'attendance.view' },
      { path: '/add-to-section', name: 'السحب والاضافة', icon: <UserCheck size={15} />, permission: 'sections.assign' },
      { path: '/request-course', name: 'طلب دورة غير مطروحة', icon: <BookOpen size={15} />, permission: 'subscriptions.add' },
    ],
  },
  {
    key: 'enrollment_admin',
    label: 'إدارة البرامج',
    icon: <Layers size={17} />,
    color: 'var(--secondary)',
    items: [
      { path: '/manage-diplomas', name: 'إدارة الدبلومات', icon: <GraduationCap size={15} />, permission: 'diplomas.view' },
      { path: '/manage-courses', name: 'إدارة الدورات', icon: <BookOpen size={15} />, permission: 'courses.view' },
      { path: '/manage-sections', name: 'إدارة الشعب', icon: <Layers size={15} />, permission: 'sections.view' },
      { path: '/admin-entities', name: 'جهات التعليم', icon: <Building2 size={15} />, permission: 'admin.entities.view' },
      { path: '/admin-rooms', name: 'القاعات والمختبرات', icon: <Layers size={15} />, permission: 'admin.rooms.view' },
    ],
  },
  {
    key: 'employees',
    label: 'الموظفون',
    icon: <Briefcase size={17} />,
    color: '#f59e0b',
    items: [
      { path: '/employees', name: 'إدارة الموظفين', icon: <Briefcase size={15} />, permission: 'employees.view' },
      { path: '/employee-salaries', name: 'الرواتب والعمولات', icon: <Award size={15} />, permission: 'employees.salaries' },
    ],
  },
  {
    key: 'users',
    label: 'المستخدمين',
    icon: <Shield size={17} />,
    color: '#ef4444',
    items: [
      { path: '/student-accounts', name: 'الطلاب', icon: <Shield size={15} />, permission: 'admin.users.view' },
      { path: '/instructor-accounts', name: 'المحاضرين', icon: <Shield size={15} />, permission: 'admin.instructors.view' },
    ],
  },
  {
    key: 'finance',
    label: 'المالية',
    icon: <DollarSign size={17} />,
    color: '#10b981',
    items: [
      { path: '/installments', name: 'إدارة الأقساط', icon: <CreditCard size={15} />, permission: 'finance.installments' },
      { path: '/receipts', name: 'سندات القبض والمصروفات', icon: <FileText size={15} />, permission: 'finance.installments' },
      { path: '/lecturer-accounts', name: 'حسابات المحاضرين', icon: <Wallet size={15} />, permission: 'finance.accounts' },
    ],
  },
  {
    key: 'admin',
    label: 'إدارة النظام',
    icon: <Settings size={17} />,
    color: '#8b5cf6',
    items: [
      { path: '/admin-users', name: 'المستخدمون والصلاحيات', icon: <Users size={15} />, permission: 'admin.users.view' },
      { path: '/admin-announcements', name: 'الإعلانات', icon: <Megaphone size={15} />, permission: 'admin.announcements.view' },
      { path: '/admin-settings', name: 'إعدادات المركز', icon: <Settings size={15} />, permission: 'admin.settings.view' },
      { path: '/whatsapp', name: 'رسائل واتساب', icon: <MessageSquare size={15} />, permission: 'admin.settings.view' },
      { path: '/report-builder', name: 'صانع التقارير', icon: <ClipboardList size={15} />, permission: 'admin.settings.view' },
    ],
  },
];

// ========== HOOK: pinned pages ==========
const LS_PINNED = 'ems_pinned';
function usePinnedPages() {
  const { user } = useAuth();
  const userId = user?.id;
  const key = userId ? `${LS_PINNED}_${userId}` : LS_PINNED;

  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Persist whenever pinned changes
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(pinned));
  }, [pinned, key]);

  const togglePin = useCallback((path: string) => {
    setPinned(prev => {
      const next = prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path];
      return next;
    });
  }, []);

  const isPinned = useCallback((path: string) => pinned.includes(path), [pinned]);

  return { pinned, togglePin, isPinned, setPinned };
}

// ========== SIDEBAR ==========
interface SidebarProps {
  pinnedPages: string[];
  togglePin: (path: string) => void;
  isPinned: (path: string) => boolean;
}
const Sidebar = ({ pinnedPages, togglePin, isPinned }: SidebarProps) => {
  const location = useLocation();
  const { hasPermission, centerName, centerLogo } = useAuth();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    registration: true,
  });
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('ems_sidebar_expanded');
    return saved === 'true';
  });
  const [search, setSearch] = useState('');

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem('ems_sidebar_expanded', String(expanded));
  }, [expanded]);

  const toggleSidebar = useCallback(() => {
    document.documentElement.classList.add('no-hover');
    setTimeout(() => document.documentElement.classList.remove('no-hover'), 350);
    setExpanded(prev => !prev);
  }, []);

  const toggleMenu = (key: string) => {
    if (!expanded) {
      setExpanded(true);
      setTimeout(() => {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
      }, 150);
      return;
    }
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupColors: Record<string, string> = {
    registration: 'var(--primary)',
    student_affairs: '#06b6d4',
    enrollment_admin: 'var(--secondary)',
    financial: '#10b981',
    employees: '#f59e0b',
    admin: '#8b5cf6',
  };

  // Collect all items for search
  const allItems = MENU_GROUPS.flatMap(g =>
    g.items.filter(item => !item.permission || hasPermission(item.permission))
  );
  const searchResults = search.trim()
    ? allItems.filter(item => item.name.includes(search))
    : null;

  const handlePinClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    e.preventDefault();
    togglePin(path);
  };

  const renderMenuItem = (item: MenuItem, color: string, active: boolean) => (
    <Link
      key={item.path}
      to={item.path}
      className={`menu-item sub-item ${active ? 'active' : ''}`}
      style={active ? { borderRight: `2px solid ${color}` } : {}}
      onClick={() => setSearch('')}
    >
      <span className="menu-item-icon" style={{ color: active ? color : undefined }}>{item.icon}</span>
      {expanded && <span className="menu-item-label">{item.name}</span>}
      <button
        onClick={e => handlePinClick(e, item.path)}
        className={`menu-pin-btn ${isPinned(item.path) ? 'pinned' : ''}`}
        title={isPinned(item.path) ? 'إزالة من الوصول السريع' : 'إضافة للوصول السريع'}
      >
        {isPinned(item.path) ? <PinOff size={11} /> : <Pin size={11} />}
      </button>
    </Link>
  );

  return (
    <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
      {/* ===== Professional Logo Area ===== */}
      <div className="logo-area" onClick={toggleSidebar}>
        <div className="logo-icon">
          <div className="logo-icon-inner">
            {centerLogo ? (
              <img src={centerLogo} alt={centerName} />
            ) : (
              <div className="logo-fallback">
                <GraduationCap size={22} />
              </div>
            )}
          </div>
        </div>
        <span className="logo-hint">{expanded ? '✕ طي' : '✓ توسيع'}</span>
        <div className={`logo-text-wrapper ${!expanded ? 'hidden' : ''}`}>
          <div className="logo-text">{centerName}</div>
          <div className="logo-sub">نظام إدارة التعليم</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <Link
          to="/"
          className={`menu-item ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => { if (!expanded) toggleSidebar(); }}
        >
          <span className="menu-item-icon"><LayoutDashboard size={17} /></span>
          {expanded && <span className="menu-item-label">الرئيسية</span>}
        </Link>

        {/* Search */}
        {expanded && (
          <div style={{ padding: '0 12px', marginBottom: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 8, padding: '6px 10px',
              transition: 'border-color 0.2s',
            }}>
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="بحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%',
                  fontFamily: 'Cairo',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}>
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {searchResults !== null ? (
          <div style={{ padding: '0 12px' }}>
            {searchResults.length > 0 ? (
              <div className="submenu">
                {searchResults.map(item => {
                  const group = MENU_GROUPS.find(g => g.items.some(i => i.path === item.path));
                  const color = group?.color || 'var(--primary)';
                  return renderMenuItem(item, color, location.pathname === item.path);
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                لا توجد نتائج
              </div>
            )}
          </div>
        ) : (
          MENU_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => !item.permission || hasPermission(item.permission));
            if (visibleItems.length === 0) return null;
            const isOpen = openMenus[group.key];
            const isActive = visibleItems.some(i => location.pathname === i.path);

            return (
              <div className="menu-group" key={group.key}>
                <div
                  className={`menu-header ${isOpen ? 'open' : ''}`}
                  onClick={() => toggleMenu(group.key)}
                >
                  <div className="menu-header-label">
                    <span className="menu-header-icon" style={{ color: group.color }}>{group.icon}</span>
                    {expanded && <span className="menu-header-text">{group.label}</span>}
                  </div>
                  {expanded && (isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                </div>

                {isOpen && expanded && (
                  <div className="submenu">
                    {visibleItems.map(item => renderMenuItem(item, group.color, location.pathname === item.path))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Version Footer */}
      <div className="sidebar-footer">
        {expanded && <span>نظام LHC-CRS v3.0</span>}
        {!expanded && <span>v3.0</span>}
      </div>
    </aside>
  );
};

// ========== DOCK ITEM COMPONENT ==========
interface DockItemProps {
  item: MenuItem;
  index: number;
  isActive: boolean;
  groupColor?: string;
  editing: boolean;
  togglePin: (path: string) => void;
  reorderPinned: (from: number, to: number) => void;
  onEditStart: () => void;
}
const DockItem = ({ item, index, isActive, groupColor, editing, togglePin, reorderPinned, onEditStart }: DockItemProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [dragSource, setDragSource] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragSource(true);
  };

  const handleDragEnd = () => {
    setDragOver(false);
    setDragSource(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIdx === index) return;
    reorderPinned(fromIdx, index);
  };

  const handleMouseDown = () => {
    longPressRef.current = setTimeout(onEditStart, 400);
  };
  const handleMouseUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };
  const handleMouseLeave = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  return editing ? (
    <div
      className={`dock-item ${isActive ? 'active' : ''} ${dragSource ? 'dragging' : ''} ${dragOver ? 'drag-over' : ''} ${editing ? 'wobble' : ''}`}
      draggable={editing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseLeave}
    >
      <span className="dock-item-icon" style={{ color: isActive ? groupColor : undefined }}>
        {item.icon}
      </span>
      <span className="dock-item-label">{item.name}</span>
      <button
        className={`dock-item-remove ${editing ? 'visible' : ''}`}
        onClick={e => { e.stopPropagation(); togglePin(item.path); }}
        title="إزالة من الوصول السريع"
      >
        <X size={10} />
      </button>
    </div>
  ) : (
    <Link
      to={item.path}
      className={`dock-item ${isActive ? 'active' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseLeave}
    >
      <span className="dock-item-icon" style={{ color: isActive ? groupColor : undefined }}>
        {item.icon}
      </span>
      <span className="dock-item-label">{item.name}</span>
    </Link>
  );
};

// ========== TOPBAR ==========
interface TopbarProps {
  pinnedPages: string[];
  togglePin: (path: string) => void;
  reorderPinned: (from: number, to: number) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
}
const Topbar = ({ pinnedPages, togglePin, reorderPinned, chatOpen, setChatOpen }: TopbarProps) => {
  const { user, logout, centerName } = useAuth();
  const { theme, setTheme, contrast, setContrast, accent, setAccent, fontScale, setFontScale } = useTheme();
  const { unreadTotal, unreadPeople, bizzAlert, resetBizzAlert } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const menuPosRef = useRef({ top: 0, right: 0 });

  const { hasPermission } = useAuth();

  const allItems = MENU_GROUPS.flatMap(g =>
    g.items.filter(item => !item.permission || hasPermission(item.permission))
  );

  const pinnedItems = pinnedPages
    .map(path => allItems.find(i => i.path === path))
    .filter(Boolean) as MenuItem[];

  const startEditing = useCallback(() => setEditing(true), []);
  const stopEditing = useCallback(() => setEditing(false), []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          portalMenuRef.current && !portalMenuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (editing && dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editing]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      {/* Left: center name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <h2 className="topbar-title" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{centerName}</h2>
      </div>

      {/* Center: Pinned Dock (macOS style) */}
      <div className="pinned-dock" ref={dockRef}>
        <div className="pinned-dock-inner">
          {pinnedItems.length === 0 && !editing ? (
            <span className="empty-dock">اسحب الصفحات هنا للوصول السريع</span>
          ) : (
            pinnedItems.map((item, idx) => {
              const isActive = location.pathname === item.path;
              const group = MENU_GROUPS.find(g => g.items.some(i => i.path === item.path));
              return (
                <DockItem
                  key={item.path}
                  item={item}
                  index={idx}
                  isActive={isActive}
                  groupColor={group?.color}
                  editing={editing}
                  togglePin={togglePin}
                  reorderPinned={reorderPinned}
                  onEditStart={startEditing}
                />
              );
            })
          )}
          {editing && (
            <div className="dock-edit-bar">
              <span className="dock-edit-hint">اسحب لإعادة الترتيب</span>
              <button className="dock-done-btn" onClick={stopEditing}>تم</button>
            </div>
          )}
        </div>
      </div>

      {/* Right: user menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Chat widget */}
        <div onClick={() => { setChatOpen(!chatOpen); resetBizzAlert(); }}
          role="button" tabIndex={0}
          aria-label="الرسائل"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChatOpen(!chatOpen); resetBizzAlert(); } }}
          style={{
            width: 36, height: 36, borderRadius: 10, cursor: 'pointer', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            background: chatOpen ? 'var(--primary-light)' : 'transparent',
            color: chatOpen ? 'var(--primary)' : 'var(--text-secondary)',
          }}
          onMouseEnter={e => { if (!chatOpen) { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
          onMouseLeave={e => { if (!chatOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
          title="الرسائل"
        >
          <MessageCircle size={18} />
          {unreadPeople > 0 && (
            <span style={{
              position: 'absolute', top: -2, left: -2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#ef4444', color: '#fff',
              fontSize: '0.5rem', fontWeight: 800, lineHeight: '18px',
              textAlign: 'center', boxShadow: '0 0 0 2px var(--card-bg)',
            }}>
              {unreadPeople > 9 ? '9+' : unreadPeople}
            </span>
          )}
          {bizzAlert > 0 && (
            <span style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#ef4444', color: '#fff',
              fontSize: '0.5rem', fontWeight: 800, lineHeight: '18px',
              textAlign: 'center', boxShadow: '0 0 0 2px var(--card-bg)',
              animation: 'pulse 1s ease infinite',
            }}>
              {bizzAlert > 9 ? '9+' : bizzAlert}
            </span>
          )}
        </div>
        <div ref={menuRef}>
          <div
            ref={triggerRef}
            onClick={() => {
              const r = triggerRef.current!.getBoundingClientRect();
              menuPosRef.current = {
                top: Math.min(r.bottom + 6, window.innerHeight - 400),
                right: window.innerWidth - r.right,
              };
              setMenuOpen(prev => !prev);
            }}
            role="button" tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="قائمة المستخدم"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); menuOpen ? setMenuOpen(false) : setMenuOpen(true); } }}
            className={`user-trigger ${menuOpen ? 'open' : ''}`}
          >
            {user?.profileImage ? (
              <img src={fileUrl(user.profileImage)} alt="" style={{
                width: 24, height: 24, borderRadius: 7, objectFit: 'cover', flexShrink: 0,
              }} />
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: 7,
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
              }}>{user?.fullName?.charAt(0) || '?'}</div>
            )}
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.fullName}
            </span>
            <ChevronDown size={14} style={{ opacity: 0.4, flexShrink: 0, transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
          </div>
        </div>
      </div>

      {menuOpen && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setMenuOpen(false)}/>
          <div ref={portalMenuRef} style={{
            position: 'fixed', top: menuPosRef.current.top,
            right: Math.max(8, Math.min(menuPosRef.current.right, window.innerWidth - 268)),
            width: 260,
            background: 'var(--modal-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 14,
            boxShadow: 'var(--glass-shadow-hover)',
            zIndex: 9999,
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
            onMouseLeave={() => setMenuOpen(false)}
          >
                <div style={{
                  padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: '1px solid var(--glass-border)',
                }}>
                  {user?.profileImage ? (
                    <img src={fileUrl(user.profileImage)} alt="" style={{
                      width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0,
                    }} />
                  ) : (
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: 'var(--primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.95rem', fontWeight: 700, flexShrink: 0,
                    }}>{user?.fullName?.charAt(0) || '?'}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user?.fullName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>@{user?.username}</div>
                  </div>
                </div>

                <div onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  style={{
                    padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)',
                    transition: 'all 0.2s', position: 'relative',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  <Settings size={15} style={{ opacity: 0.6 }}/> الإعدادات
                </div>

                <div style={{ height: 1, background: 'var(--glass-border)', margin: '0 14px' }}/>

                {/* Font size */}
                <div style={{ padding: '8px 18px 6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3 }}>حجم الخط</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="font-step-btn"
                        onClick={() => setFontScale(fontScale - 0.1)}
                        disabled={fontScale <= 0.9}
                        title="تصغير الخط"
                        aria-label="تصغير الخط"
                      >A−</button>
                      <span className="font-scale-value">{Math.round(fontScale * 100)}%</span>
                      <button
                        className="font-step-btn"
                        onClick={() => setFontScale(fontScale + 0.1)}
                        disabled={fontScale >= 1.2}
                        title="تكبير الخط"
                        aria-label="تكبير الخط"
                      >A+</button>
                    </div>
                  </div>
                </div>

                {/* Theme slider */}
                <div style={{ padding: '12px 18px 6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3 }}>السمة</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sun size={13} style={{ opacity: theme === 'light' ? 1 : 0.3, transition: 'opacity 0.2s' }}/>
                      <div style={{ position: 'relative', width: 48, height: 20 }}>
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: 10,
                          background: theme === 'dark'
                            ? 'linear-gradient(90deg, #1e293b, #475569)'
                            : 'linear-gradient(90deg, #cbd5e1, #f1f5f9)',
                          transition: 'background 0.3s',
                        }}/>
                        <div style={{
                          position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                          background: theme === 'dark' ? '#60a5fa' : '#fbbf24',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                          left: theme === 'dark' ? 2 : 30,
                          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), background 0.3s',
                          cursor: 'pointer',
                        }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}/>
                        <input type="range" min="0" max="1" step="1"
                          value={theme === 'dark' ? 0 : 1}
                          onChange={e => setTheme(e.target.value === '0' ? 'dark' : 'light')}
                          style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            opacity: 0, cursor: 'pointer', margin: 0,
                          }}/>
                      </div>
                      <Moon size={13} style={{ opacity: theme === 'dark' ? 1 : 0.3, transition: 'opacity 0.2s' }}/>
                    </div>
                  </div>
                </div>

                {/* Contrast slider */}
                <div style={{ padding: '6px 18px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3 }}>التباين</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(contrast * 100)}%</span>
                  </div>
                  <input type="range" min="80" max="140" step="5"
                    value={Math.round(contrast * 100)}
                    onChange={e => setContrast(parseInt(e.target.value) / 100)}
                    style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: 'var(--primary)', borderRadius: 2 }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.5, letterSpacing: 0.2 }}>ناعم</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.5, letterSpacing: 0.2 }}>حاد</span>
                  </div>
                </div>

                {/* Accent color picker */}
                <div style={{ padding: '4px 18px 14px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.3 }}>
                    لون مميز
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { i: 0, color: '#25D366', name: 'أخضر' },
                      { i: 1, color: '#00A884', name: 'نعناعي' },
                      { i: 2, color: '#3b82f6', name: 'أزرق' },
                      { i: 3, color: '#8b5cf6', name: 'بنفسجي' },
                      { i: 4, color: '#f59e0b', name: 'عنبر' },
                      { i: 5, color: '#C4546A', name: 'نبيذي' },
                    ].map(({ i, color, name }) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div onClick={() => setAccent(i)}
                          style={{
                            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                            background: color,
                            margin: '0 auto',
                            boxShadow: accent === i
                              ? `0 0 0 2.5px var(--modal-bg), 0 0 0 4px ${color}`
                              : '0 1px 4px rgba(0,0,0,0.15)',
                            transition: 'box-shadow 0.2s, transform 0.15s',
                            transform: accent === i ? 'scale(1.08)' : 'scale(1)',
                          }}
                          onMouseEnter={e => { if (accent !== i) e.currentTarget.style.transform = 'scale(1.06)'; }}
                          onMouseLeave={e => { if (accent !== i) e.currentTarget.style.transform = 'scale(1)'; }}/>
                        <div style={{
                          fontSize: '0.58rem', marginTop: 3, color: 'var(--text-muted)',
                          opacity: accent === i ? 1 : 0.4,
                          transition: 'opacity 0.2s',
                        }}>{name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--glass-border)', margin: '0 14px' }}/>

                <div onClick={handleLogout}
                  style={{
                    padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.8rem', fontWeight: 500, color: 'var(--danger)',
                    transition: 'all 0.2s', position: 'relative',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                    e.currentTarget.style.transform = 'translateX(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <LogOut size={15} style={{ opacity: 0.7 }}/> تسجيل الخروج
                </div>
              </div>
            </>
          ,
          document.body
        )}
    </header>
  );
};

// ========== MAIN LAYOUT ==========
export const Layout = () => {
  const [bgStyle, setBgStyle] = useState<string>('');
  const { open: chatCtxOpen, setOpen: setChatCtxOpen } = useChat();
  const [chatOpen, setChatOpenState] = useState(false);

  // Sync chatOpen when context changes (e.g. share button)
  useEffect(() => {
    if (chatCtxOpen !== chatOpen) setChatOpenState(chatCtxOpen);
  }, [chatCtxOpen]);

  const setChatOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(chatOpen) : v;
    setChatOpenState(next);
    setChatCtxOpen(next);
  }, [chatOpen, setChatCtxOpen]);
  const { pinned: pinnedPages, togglePin, isPinned, setPinned: setPinnedPages } = usePinnedPages();
  const reorderPinned = useCallback((from: number, to: number) => {
    setPinnedPages(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, [setPinnedPages]);
  const apiFetchBg = useCallback(async () => {
    try {
      const token = localStorage.getItem('ems_token');
      if (!token) return;
      const res = await fetch(API_BASE + '/api/backgrounds', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const bgs = await res.json();
        const adminBg = bgs.find((b: any) => b.portal === 'ADMIN');
        if (adminBg && adminBg.type !== 'GRADIENT' && adminBg.content) {
          if (adminBg.type === 'IMAGE') {
            setBgStyle(fileUrl(adminBg.content));
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => { apiFetchBg(); }, [apiFetchBg]);

  return (
    <div className="app-layout">
      <Sidebar pinnedPages={pinnedPages} togglePin={togglePin} isPinned={isPinned} />
      <main className="main-content" style={{
        background: bgStyle ? `url(${bgStyle}) center/cover no-repeat fixed` : undefined,
        position: 'relative',
      }}>
        {bgStyle && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
          }} />
        )}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Topbar pinnedPages={pinnedPages} togglePin={togglePin} reorderPinned={reorderPinned} chatOpen={chatOpen} setChatOpen={setChatOpen} />
          <div className="page-content" style={{
            paddingLeft: chatOpen ? 400 : 0,
            transition: 'padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <AnnouncementBanner />
            <Outlet />
          </div>
        </div>
        <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
      </main>
    </div>
  );
};
