import React from 'react';

export const LEARNING_TYPES: Record<string, string> = {
  INSIDE_CENTER: 'داخل المركز',
  VIRTUAL_ROOM: 'قاعة وهمية',
  ONLINE: 'قاعة Online',
  EXTERNAL_ENTITY: 'جهة تعلم خارجية',
};

export const learningTypeLabel = (v?: string | null) => LEARNING_TYPES[v || 'INSIDE_CENTER'] || v || 'داخل المركز';

const COLORS: Record<string, { bg: string; fg: string }> = {
  INSIDE_CENTER: { bg: 'rgba(37,211,102,0.12)', fg: 'var(--primary)' },
  VIRTUAL_ROOM: { bg: 'rgba(99,102,241,0.1)', fg: '#818cf8' },
  ONLINE: { bg: 'rgba(6,182,212,0.12)', fg: 'var(--info)' },
  EXTERNAL_ENTITY: { bg: 'rgba(245,158,11,0.12)', fg: 'var(--warning)' },
};

export const LearningTypeBadge = ({ value, style }: { value?: string | null; style?: React.CSSProperties }) => {
  const key = value || 'INSIDE_CENTER';
  const c = COLORS[key] || COLORS.INSIDE_CENTER;
  return (
    <span className="badge" style={{ fontSize: '0.68rem', background: c.bg, color: c.fg, whiteSpace: 'nowrap', ...style }}>
      {learningTypeLabel(value)}
    </span>
  );
};
