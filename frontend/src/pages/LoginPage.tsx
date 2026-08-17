import React, { useState, useEffect } from 'react';
import { useAuth, fileUrl } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { GraduationCap, Lock, User, Eye, EyeOff, Shield, Users, BookOpen, Briefcase } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = API_BASE + '/api';

// ===== PORTAL CONFIG =====
interface Portal {
  key: string;
  label: string;
  subLabel: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  defaultUsername?: string;
}

const PORTALS: Portal[] = [
  {
    key: 'ADMIN',
    label: 'بوابة الإدارة',
    subLabel: 'مسؤولو النظام والمشرفون',
    icon: <Shield size={28} />,
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 50%, #818cf8 100%)',
    glowColor: 'rgba(99,102,241,0.4)',
  },
  {
    key: 'EMPLOYEE',
    label: 'بوابة الموظفين',
    subLabel: 'موظفو التسجيل والمحاسبة',
    icon: <Briefcase size={28} />,
    gradient: 'linear-gradient(135deg, #0f2027 0%, #059669 50%, #34d399 100%)',
    glowColor: 'rgba(16,185,129,0.4)',
  },
  {
    key: 'INSTRUCTOR',
    label: 'بوابة المحاضرين',
    subLabel: 'المدرّسون والأكاديميون',
    icon: <BookOpen size={28} />,
    gradient: 'linear-gradient(135deg, #2e1065 0%, #7c3aed 50%, #a78bfa 100%)',
    glowColor: 'rgba(139,92,246,0.4)',
  },
  {
    key: 'STUDENT',
    label: 'بوابة الطلاب',
    subLabel: 'المتدرّبون والطلاب',
    icon: <GraduationCap size={28} />,
    gradient: 'linear-gradient(135deg, #0f172a 0%, #2563eb 50%, #60a5fa 100%)',
    glowColor: 'rgba(59,130,246,0.4)',
  },
];

// ===== PORTAL SELECTOR =====
const PortalSelector = ({ onSelect }: { onSelect: (p: Portal) => void }) => {
  const { centerName, centerLogo } = useAuth();
  usePageTitle('اختيار بوابة');
  const [displayName, setDisplayName] = useState(centerName);
  const [displayLogo, setDisplayLogo] = useState(centerLogo);

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.centerName) setDisplayName(data.centerName);
        if (data?.centerLogo) setDisplayLogo(fileUrl(data.centerLogo));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (centerName) setDisplayName(centerName);
    if (centerLogo) setDisplayLogo(centerLogo);
  }, [centerName, centerLogo]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(165deg, #f8f6f3 0%, #f0ece6 50%, #e8e2d8 100%)',
      padding: 24, position: 'relative', overflow: 'auto',
    }}>
      {[
        { size: 500, x: '-15%', y: '-20%', color: 'rgba(114,47,55,0.06)' },
        { size: 400, x: '80%', y: '10%', color: 'rgba(201,169,62,0.05)' },
        { size: 350, x: '40%', y: '70%', color: 'rgba(114,47,55,0.04)' },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'absolute', width: orb.size, height: orb.size,
          borderRadius: '50%', background: orb.color,
          left: orb.x, top: orb.y, filter: 'blur(100px)',
          animation: `pulse ${4 + i}s ease-in-out infinite alternate`,
        }} />
      ))}

      <div style={{ textAlign: 'center', marginBottom: 48, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 88, height: 88, borderRadius: 22, margin: '0 auto 16px',
          overflow: 'hidden', position: 'relative',
          boxShadow: '0 8px 32px rgba(114,47,55,0.15)',
          border: '2px solid rgba(201,169,62,0.2)',
          background: displayLogo
            ? `url(${displayLogo}) center/cover no-repeat`
            : 'linear-gradient(135deg, #9F2D3F, #7A2030)',
        }}>
          {!displayLogo && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={36} color="rgba(255,255,255,0.9)" />
            </div>
          )}
        </div>
        <h1 style={{
          fontSize: '2rem', fontWeight: 800, color: '#8B2635', marginTop: 16, marginBottom: 8,
          letterSpacing: '-0.5px',
        }}>{displayName}</h1>
        <p style={{ color: '#998B7A', fontSize: '0.95rem', fontWeight: 500 }}>
          اختر بوابة الدخول المناسبة
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20, maxWidth: 700, width: '100%',
        position: 'relative', zIndex: 1,
      }}>
        {PORTALS.map(portal => (
          <div
            key={portal.key}
            onClick={() => onSelect(portal)}
            style={{
              background: '#fff',
              borderRadius: 20, padding: '28px 24px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 12px 32px rgba(0,0,0,0.02)',
              border: '1px solid rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06), 0 20px 48px rgba(114,47,55,0.08)';
              e.currentTarget.style.borderColor = 'rgba(201,169,62,0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 12px 32px rgba(0,0,0,0.02)';
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)';
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: '#A84D56',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(145deg, #9A4A55, #6B2430)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
                border: '1px solid rgba(201,169,62,0.15)',
                boxShadow: '0 4px 12px rgba(155,74,85,0.2)',
              }}>
                <div style={{ color: '#D4AF37' }}>
                  {portal.icon}
                </div>
              </div>
              <h3 style={{ color: '#2D2A24', fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>
                {portal.label}
              </h3>
              <p style={{ color: '#998B7A', fontSize: '0.82rem', margin: 0 }}>
                {portal.subLabel}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ color: '#C4B9A8', fontSize: '0.75rem', marginTop: 40, position: 'relative', zIndex: 1 }}>
        نظام LHC-CRS v3.0 — جميع الحقوق محفوظة
      </p>
    </div>
  );
};

// ===== LOGIN FORM =====
const LoginForm = ({ portal, onBack }: { portal: Portal; onBack: () => void }) => {
  const { login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bgType, setBgType] = useState<'GRADIENT' | 'IMAGE' | 'VIDEO' | null>(null);
  const [bgContent, setBgContent] = useState('');
  const [formName, setFormName] = useState('');
  const [formLogo, setFormLogo] = useState('');
  usePageTitle(`دخول ${portal.label}`);

  const [bgError, setBgError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setBgError('');
    fetch(`${API}/backgrounds`)
      .then(res => res.ok ? res.json() : [])
      .then(bgs => {
        if (cancelled) return;
        const bg = (bgs || []).find((b: any) => b.portal === portal.key);
        if (bg) {
          setBgType(bg.type);
          setBgContent(bg.type === 'IMAGE' ? fileUrl(bg.content) : (bg.content || ''));
        } else {
          setBgType(null);
          setBgContent('');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setBgError(err.message || 'خطأ في جلب الخلفية');
        setBgType(null);
      });
    return () => { cancelled = true; };
  }, [portal.key]);

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.centerName) setFormName(data.centerName);
        if (data?.centerLogo) setFormLogo(fileUrl(data.centerLogo));
      })
      .catch(() => {});
  }, []);

  const triggerShake = () => { setIsError(true); setTimeout(() => setIsError(false), 600); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      triggerShake();
      return;
    }
    setError(''); setLoading(true);
    try {
      const userData: any = await login(username.trim(), password, portal.key);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
      triggerShake();
    } finally { setLoading(false); }
  };

  const showCustomBg = bgType && bgContent;
  const bgImage = showCustomBg && bgType === 'IMAGE' ? bgContent : null;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'auto',
      background: showCustomBg
        ? (bgType === 'GRADIENT' && bgContent ? bgContent : 'linear-gradient(165deg, #f8f6f3 0%, #f0ece6 50%, #e8e2d8 100%)')
        : 'linear-gradient(165deg, #f8f6f3 0%, #f0ece6 50%, #e8e2d8 100%)',
    }}>
      {bgImage && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `url(${bgImage}) center/cover no-repeat`,
        }} />
      )}
      {bgError && (
        <div style={{ position: 'fixed', bottom: 10, left: 10, zIndex: 999,
          background: '#dc2626', color: '#fff', padding: '8px 14px',
          borderRadius: 8, fontSize: '0.75rem', fontFamily: 'Cairo',
        }}>
          BG Error: {bgError}
        </div>
      )}

      {showCustomBg && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(135deg, rgba(248,246,243,0.85) 0%, rgba(240,236,230,0.9) 100%)',
        }} />
      )}

      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 20, right: 24, zIndex: 10,
          background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
          color: '#722F37', padding: '8px 18px', borderRadius: 10,
          cursor: 'pointer', fontFamily: 'Cairo', fontSize: '0.85rem',
          fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
      >
        ← العودة
      </button>

      <div
        className={isError ? 'shake-error' : ''}
        style={{
          position: 'relative', zIndex: 2,
          width: '100%', maxWidth: 420, margin: '0 20px',
          background: '#fff',
          borderRadius: 24, padding: '40px 36px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 24px 48px rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20, margin: '0 auto 12px',
            background: 'linear-gradient(145deg, #9A4A55, #6B2430)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(201,169,62,0.15)',
            boxShadow: '0 4px 12px rgba(155,74,85,0.2)',
          }}>
            <div style={{ color: '#D4AF37' }}>
              {portal.icon}
            </div>
          </div>
          <h2 style={{
            color: '#2D2A24', fontWeight: 800, fontSize: '1.3rem', marginBottom: 4,
          }}>
            {portal.label}
          </h2>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 6, padding: '4px 14px',
            background: '#F5F2ED',
            borderRadius: 20, border: '1px solid rgba(0,0,0,0.04)',
          }}>
            {formLogo && (
              <img src={formLogo} alt=""
                style={{ width: 18, height: 18, borderRadius: 6, objectFit: 'cover' }} />
            )}
            <p style={{ color: '#998B7A', fontSize: '0.8rem', margin: 0 }}>
              {formName}
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', color: '#DC2626',
            border: '1px solid #FCA5A5',
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
            fontSize: '0.88rem', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#722F37', fontSize: '0.82rem', marginBottom: 6, fontWeight: 700 }}>
              <User size={13} style={{ display: 'inline', marginLeft: 5 }} /> اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus autoComplete="username"
              placeholder="أدخل اسم المستخدم..."
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                background: '#F5F2ED',
                border: '1.5px solid #E5DDD3',
                color: '#2D2A24', fontFamily: 'Cairo', fontSize: '0.95rem',
                outline: 'none', transition: 'all 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#722F37'}
              onBlur={e => e.target.style.borderColor = '#E5DDD3'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#722F37', fontSize: '0.82rem', marginBottom: 6, fontWeight: 700 }}>
              <Lock size={13} style={{ display: 'inline', marginLeft: 5 }} /> كلمة المرور
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور..."
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 12,
                  background: '#F5F2ED',
                  border: '1.5px solid #E5DDD3',
                  color: '#2D2A24', fontFamily: 'Cairo', fontSize: '0.95rem',
                  outline: 'none', transition: 'all 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#722F37'}
                onBlur={e => e.target.style.borderColor = '#E5DDD3'}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#C4B9A8', padding: 4,
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 12, border: 'none',
              background: loading ? '#C4B9A8' : 'linear-gradient(135deg, #722F37, #7A2E3E)',
              color: '#fff', fontFamily: 'Cairo', fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(114,47,55,0.3)',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(114,47,55,0.35)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(114,47,55,0.3)'; }}
          >
            {loading ? 'جارٍ تسجيل الدخول...' : `دخول ${portal.label}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// ===== MAIN EXPORT =====
export const LoginPage = () => {
  const [selectedPortal, setSelectedPortal] = useState<Portal | null>(null);

  if (!selectedPortal) {
    return <PortalSelector onSelect={setSelectedPortal} />;
  }

  return <LoginForm portal={selectedPortal} onBack={() => setSelectedPortal(null)} />;
};
