import React from 'react';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const daysInMonth = (m: number, y: number) => {
  if (m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
};

interface DateFieldProps {
  value: string;
  onChange: (v: string) => void;
  minYear?: number;
  maxYear?: number;
  style?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  disabled?: boolean;
}

export const DateField = ({ value, onChange, minYear = 1920, maxYear, style, selectStyle, disabled }: DateFieldProps) => {
  const nowYear = new Date().getFullYear();
  const maxY = maxYear ?? nowYear + 5;
  const minY = Math.min(minYear, maxY);
  const [y, m, d] = String(value || '').split('-').map(Number);
  const yy = y || 0;
  const mm = m || 0;
  const dd = d || 0;

  const years: number[] = [];
  for (let yr = maxY; yr >= minY; yr--) years.push(yr);
  const days = Array.from({ length: daysInMonth(mm || 1, yy || nowYear) }, (_, i) => i + 1);

  const emit = (year: number, month: number, day: number) => {
    if (!year || !month || !day) { onChange(''); return; }
    onChange(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  };

  const base: React.CSSProperties = { flex: 1, minWidth: 0, padding: '9px 10px', fontSize: '0.82rem', ...selectStyle };

  return (
    <div style={{ display: 'flex', gap: 6, direction: 'rtl', alignItems: 'stretch', ...style }}>
      <select className="glass-input" disabled={disabled} style={base} value={dd || ''}
        onChange={e => emit(yy, mm, Number(e.target.value))}>
        <option value="">اليوم</option>
        {days.map(day => <option key={day} value={day}>{day}</option>)}
      </select>
      <select className="glass-input" disabled={disabled} style={base} value={mm || ''}
        onChange={e => {
          const nm = Number(e.target.value);
          if (!dd) { onChange(''); return; }
          emit(yy, nm, Math.min(dd, daysInMonth(nm, yy || nowYear)));
        }}>
        <option value="">الشهر</option>
        {MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
      </select>
      <select className="glass-input" disabled={disabled} style={base} value={yy || ''}
        onChange={e => {
          const ny = Number(e.target.value);
          if (!dd) { onChange(''); return; }
          emit(ny, mm, Math.min(dd, daysInMonth(mm || 1, ny)));
        }}>
        <option value="">السنة</option>
        {years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
};