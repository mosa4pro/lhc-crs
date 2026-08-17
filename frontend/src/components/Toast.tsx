import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ============ TYPES ============
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============ SINGLE TOAST COMPONENT ============
const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 5000;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    // Progress bar
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(intervalRef.current!);
        handleClose();
      }
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 400);
  };

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const colors: Record<ToastType, { bg: string; border: string; icon: string; bar: string; title: string }> = {
    success: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.4)',
      icon: '#10b981',
      bar: '#10b981',
      title: '#10b981',
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.4)',
      icon: '#ef4444',
      bar: '#ef4444',
      title: '#ef4444',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.4)',
      icon: '#f59e0b',
      bar: '#f59e0b',
      title: '#f59e0b',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.4)',
      icon: '#3b82f6',
      bar: '#3b82f6',
      title: '#3b82f6',
    },
  };

  const c = colors[toast.type];

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: c.bg,
        backdropFilter: 'blur(10px) saturate(120%)',
        WebkitBackdropFilter: 'blur(10px) saturate(120%)',
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        minWidth: 300,
        maxWidth: 400,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(120px)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        direction: 'rtl',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
        {/* Icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${c.icon}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: c.icon, fontWeight: 700, fontSize: '1rem', flexShrink: 0,
        }}>
          {icons[toast.type]}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: c.title, fontSize: '0.92rem', marginBottom: toast.message ? 3 : 0 }}>
            {toast.title}
          </div>
          {toast.message && (
            <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {toast.message}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1,
            padding: '2px 4px', borderRadius: 4,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ×
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: 3,
        background: `${c.bar}30`,
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
      }}>
        <div style={{
          height: '100%',
          background: c.bar,
          width: `${progress}%`,
          transition: 'width 0.05s linear',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>
    </div>
  );
};

// ============ PROVIDER ============
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const location = useLocation();

  // Clear toasts on route change — notifications are page-scoped
  useEffect(() => { setToasts([]); }, [location.pathname]);

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { ...opts, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    toast: addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        top: 20,
        left: 20,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============ HOOK ============
export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
