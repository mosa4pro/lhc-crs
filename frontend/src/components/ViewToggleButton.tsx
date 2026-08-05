import React from 'react';

interface Props {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
}

export const ViewToggleButton = ({ active, onClick, icon, label, title }: Props) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 18px', borderRadius: 12,
      border: `1.5px solid ${active ? 'var(--primary)' : 'var(--glass-border)'}`,
      background: active ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--card-bg)',
      color: active ? '#fff' : 'var(--text-secondary)',
      cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700,
      fontFamily: 'inherit', letterSpacing: '-0.01em',
      backdropFilter: 'blur(10px)',
      boxShadow: active ? '0 6px 18px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.25)' : '0 2px 6px rgba(0,0,0,0.06)',
      transition: 'all 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => {
      if (!active) {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.color = 'var(--primary)';
        e.currentTarget.style.background = 'var(--primary-light)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }
    }}
    onMouseLeave={e => {
      if (!active) {
        e.currentTarget.style.borderColor = 'var(--glass-border)';
        e.currentTarget.style.color = 'var(--text-secondary)';
        e.currentTarget.style.background = 'var(--card-bg)';
        e.currentTarget.style.transform = 'translateY(0)';
      }
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.7, transition: 'opacity 0.2s' }}>{icon}</span>
    {label}
  </button>
);
