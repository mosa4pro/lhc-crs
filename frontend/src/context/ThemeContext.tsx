import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ThemeContextType {
  theme: 'dark' | 'light';
  contrast: number;
  accent: number;
  fontScale: number;
  setTheme: (t: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setContrast: (c: number) => void;
  setAccent: (a: number) => void;
  setFontScale: (s: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light', contrast: 1, accent: 0, fontScale: 1,
  setTheme: () => {}, toggleTheme: () => {}, setContrast: () => {}, setAccent: () => {}, setFontScale: () => {}
});

const LS_THEME = 'ems_theme';
const LS_CONTRAST = 'ems_contrast';
const LS_ACCENT = 'ems_accent';
const LS_FONT_SCALE = 'ems_font_scale';

function clampFontScale(v: number) {
  return Math.min(1.2, Math.max(0.9, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(c1: string, c2: string, t: number): string {
  const h1 = c1.replace('#', ''), h2 = c2.replace('#', '');
  const r = Math.round(lerp(parseInt(h1.substring(0,2),16), parseInt(h2.substring(0,2),16), t));
  const g = Math.round(lerp(parseInt(h1.substring(2,4),16), parseInt(h2.substring(2,4),16), t));
  const b = Math.round(lerp(parseInt(h1.substring(4,6),16), parseInt(h2.substring(4,6),16), t));
  return `rgb(${r},${g},${b})`;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id;

  const lsKey = (base: string) => userId ? `${base}_${userId}` : base;

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const v = localStorage.getItem(lsKey(LS_THEME));
    return (v === 'light' || v === 'dark') ? v : 'light';
  });

  const [contrast, setContrastState] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(lsKey(LS_CONTRAST)) || '1');
    return v >= 0.8 && v <= 1.4 ? v : 1;
  });

  const [accent, setAccentState] = useState<number>(() => {
    const v = parseInt(localStorage.getItem(lsKey(LS_ACCENT)) || '5');
    return v >= 0 && v <= 5 ? v : 5;
  });

  const [fontScale, setFontScaleState] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(lsKey(LS_FONT_SCALE)) || '1');
    return clampFontScale(Number.isFinite(v) ? v : 1);
  });

  const applyContrast = useCallback((t: 'dark' | 'light', c: number) => {
    const root = document.documentElement;
    const isDark = t === 'dark';

    // t: -0.5 (soft) → 0 (normal) → 1.0 (sharp)
    const normalized = (c - 1) / 0.4;

    const text = isDark
      ? { primary: '#e8ecf4', secondary: '#b3bccf', muted: '#8b94b8', border: 'rgba(255,255,255,0.05)' }
      : { primary: '#1c1c2e', secondary: '#4a4a68', muted: '#62627e', border: 'rgba(0,0,0,0.05)' };

    // Low contrast targets (c=0.8)
    const low = isDark
      ? { primary: '#a0a8c0', secondary: '#7078a0', muted: '#505878' }
      : { primary: '#5a5a7a', secondary: '#8e8ea8', muted: '#b8b8cc' };

    // High contrast targets (c=1.4)
    const high = isDark
      ? { primary: '#ffffff', secondary: '#e8ecf4', muted: '#b8c1dc' }
      : { primary: '#000000', secondary: '#1c1c2e', muted: '#454560' };

    if (normalized === 0) {
      root.style.removeProperty('--ct-text-primary');
      root.style.removeProperty('--ct-text-secondary');
      root.style.removeProperty('--ct-text-muted');
      root.style.removeProperty('--ct-card-border');
      root.style.removeProperty('--ct-table-border');
      root.style.removeProperty('--ct-glass-opacity');
      return;
    }

    const lerpT = normalized < 0
      ? normalized / -0.5  // 0→1 as we go from normal to soft
      : normalized;        // 0→1 as we go from normal to sharp

    const srcLow = normalized < 0;
    const from = srcLow ? low : text;
    const to = srcLow ? text : high;

    // Text colors
    root.style.setProperty('--ct-text-primary', lerpColor(from.primary, to.primary, lerpT));
    root.style.setProperty('--ct-text-secondary', lerpColor(from.secondary, to.secondary, lerpT));
    root.style.setProperty('--ct-text-muted', lerpColor(from.muted, to.muted, lerpT));

    // Borders: adjust alpha based on contrast
    const borderAlpha = isDark
      ? lerp(0.05, 0.12, (c - 1) / 0.4 * 0.5 + 0.5)
      : lerp(0.04, 0.10, (c - 1) / 0.4 * 0.5 + 0.5);
    root.style.setProperty('--ct-card-border', `rgba(${isDark ? '255,255,255' : '0,0,0'},${borderAlpha.toFixed(3)})`);
    root.style.setProperty('--ct-table-border', `rgba(${isDark ? '255,255,255' : '0,0,0'},${borderAlpha.toFixed(3)})`);

    // Glass opacity: more transparent at low contrast, more opaque at high
    const glassOpacity = Math.max(0.45, Math.min(0.8, 0.6 + (c - 1) * 0.5));
    root.style.setProperty('--ct-glass-opacity', glassOpacity.toFixed(3));
  }, []);

  const applyStyle = useCallback((t: 'dark' | 'light', c: number, a: number) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', t);
    root.setAttribute('data-accent', String(a));
    applyContrast(t, c);
  }, [applyContrast]);

  useEffect(() => {
    if (!userId) return;
    const sT = localStorage.getItem(lsKey(LS_THEME));
    const sC = parseFloat(localStorage.getItem(lsKey(LS_CONTRAST)) || '1');
    const sA = parseInt(localStorage.getItem(lsKey(LS_ACCENT)) || '0');
    if (sT === 'light' || sT === 'dark') {
      const c = sC >= 0.8 && sC <= 1.4 ? sC : 1;
      const a = sA >= 0 && sA <= 5 ? sA : 5;
      setThemeState(sT);
      setContrastState(c);
      setAccentState(a);
      applyStyle(sT, c, a);
    } else {
      fetch(API_BASE + '/api/auth/preferences', {
        headers: { Authorization: `Bearer ${localStorage.getItem('ems_token')}` }
      }).then(r => r.json()).then(data => {
        if (data.preferences) {
          try {
            const pref = JSON.parse(typeof data.preferences === 'string' ? data.preferences : '{}');
            const t = pref.theme === 'light' ? 'light' : 'dark';
            const c = typeof pref.contrast === 'number' && pref.contrast >= 0.8 && pref.contrast <= 1.4 ? pref.contrast : 1;
            const a = typeof pref.accent === 'number' && pref.accent >= 0 && pref.accent <= 5 ? pref.accent : 5;
            const fs = clampFontScale(typeof pref.fontScale === 'number' ? pref.fontScale : 1);
            setThemeState(t);
            setContrastState(c);
            setAccentState(a);
            setFontScaleState(fs);
            applyStyle(t, c, a);
            localStorage.setItem(lsKey(LS_THEME), t);
            localStorage.setItem(lsKey(LS_CONTRAST), String(c));
            localStorage.setItem(lsKey(LS_ACCENT), String(a));
            localStorage.setItem(lsKey(LS_FONT_SCALE), String(fs));
          } catch {}
        } else { applyStyle('light', 1, 5); }
      }).catch(() => applyStyle('light', 1, 5));
    }
  }, [userId]);

  useEffect(() => {
    applyStyle(theme, contrast, accent);
  }, [theme, contrast, accent, applyStyle]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  const syncToApi = useCallback((t: string, c: number, a: number, fs: number) => {
    if (!userId) return;
    fetch(API_BASE + '/api/auth/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ems_token')}` },
      body: JSON.stringify({ preferences: JSON.stringify({ theme: t, contrast: c, accent: a, fontScale: fs }) })
    }).catch(() => {});
  }, [userId]);

  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t);
    localStorage.setItem(lsKey(LS_THEME), t);
    syncToApi(t, contrast, accent, fontScale);
  }, [userId, contrast, accent, fontScale]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    localStorage.setItem(lsKey(LS_THEME), next);
    syncToApi(next, contrast, accent, fontScale);
  }, [userId, theme, contrast, accent, fontScale]);

  const setContrast = useCallback((c: number) => {
    const clamped = Math.max(0.8, Math.min(1.4, c));
    setContrastState(clamped);
    localStorage.setItem(lsKey(LS_CONTRAST), String(clamped));
    syncToApi(theme, clamped, accent, fontScale);
  }, [userId, theme, accent, fontScale]);

  const setAccent = useCallback((a: number) => {
    const idx = Math.max(0, Math.min(5, a));
    setAccentState(idx);
    localStorage.setItem(lsKey(LS_ACCENT), String(idx));
    syncToApi(theme, contrast, idx, fontScale);
  }, [userId, theme, contrast, fontScale]);

  const setFontScale = useCallback((s: number) => {
    const clamped = clampFontScale(Math.round(s * 10) / 10);
    setFontScaleState(clamped);
    localStorage.setItem(lsKey(LS_FONT_SCALE), String(clamped));
    syncToApi(theme, contrast, accent, clamped);
  }, [userId, theme, contrast, accent]);

  return (
    <ThemeContext.Provider value={{ theme, contrast, accent, fontScale, setTheme, toggleTheme, setContrast, setAccent, setFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
