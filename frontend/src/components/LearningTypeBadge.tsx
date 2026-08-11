import React from 'react';

// مكان الانعقاد / جهة القاعة
export const LEARNING_TYPES: Record<string, string> = {
  INSIDE_CENTER: 'داخل المركز',
  EXTERNAL_ENTITY: 'جهة تعلم خارجية',
};

// نوع القاعة
export const MODALITIES: Record<string, string> = {
  PHYSICAL: 'حضوري',
  VIRTUAL_ROOM: 'قاعة وهمية',
  ONLINE: 'قاعة Online',
};

export const learningTypeLabel = (v?: string | null) => {
  const val = v || 'INSIDE_CENTER';
  return LEARNING_TYPES[val] || v || 'داخل المركز';
};

export const modalityLabel = (v?: string | null) => (v ? MODALITIES[v] || v : '');

const COLORS: Record<string, { bg: string; fg: string }> = {
  INSIDE_CENTER: { bg: 'rgba(37,211,102,0.12)', fg: 'var(--primary)' },
  EXTERNAL_ENTITY: { bg: 'rgba(245,158,11,0.12)', fg: 'var(--warning)' },
  VIRTUAL_ROOM: { bg: 'rgba(99,102,241,0.1)', fg: '#818cf8' },
  ONLINE: { bg: 'rgba(6,182,212,0.12)', fg: 'var(--info)' },
};

interface RoomLike {
  learningType?: string | null;
  modality?: string | null;
  entity?: { name?: string } | null;
}

interface LearningTypeBadgeProps {
  value?: string | null;
  entityName?: string | null;
  modality?: string | null;
  room?: RoomLike | null;
  style?: React.CSSProperties;
}

export const LearningTypeBadge = ({ value, entityName, modality, room, style }: LearningTypeBadgeProps) => {
  let location = room?.learningType ?? value ?? 'INSIDE_CENTER';
  let mod = room?.modality ?? modality;
  const entity = room?.entity?.name ?? entityName;

  if (location === 'VIRTUAL_ROOM' || location === 'ONLINE') {
    mod = location;
    location = 'INSIDE_CENTER';
  }

  const locColor = COLORS[location] || COLORS.INSIDE_CENTER;
  const locLabel =
    location === 'EXTERNAL_ENTITY' ? entity || 'جهة تعلم خارجية' : 'داخل المركز';
  const showMod = !!mod && mod !== 'PHYSICAL';
  const modColor = COLORS[mod || ''] || COLORS.VIRTUAL_ROOM;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', ...style }}>
      <span className="badge" style={{ fontSize: '0.68rem', background: locColor.bg, color: locColor.fg, whiteSpace: 'nowrap' }}>
        {locLabel}
      </span>
      {showMod && (
        <span className="badge" style={{ fontSize: '0.68rem', background: modColor.bg, color: modColor.fg, whiteSpace: 'nowrap' }}>
          {modalityLabel(mod)}
        </span>
      )}
    </span>
  );
};
