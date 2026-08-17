import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Calculator, StickyNote, Table, X, Minus, Maximize2, Minimize2,
  Clock, Folder, FileText, Search, Grid, Users,
  Sun, Moon, Settings, LogOut, ChevronLeft, ChevronRight,
  Monitor, Music, Image as ImageIcon, Trash2, Plus,
} from 'lucide-react';
import { NotesDesktopApp, FilesDesktopApp, DocumentsDesktopApp } from './DesktopApps';

// ==================== TYPES ====================
interface WindowState {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  component: React.ReactNode;
  zIndex: number;
  prevRect?: { x: number; y: number; width: number; height: number };
}

interface AppDef {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  component: React.FC<{ onClose: () => void }>;
  width: number;
  height: number;
}

let _zCounter = 100;

// ==================== CALCULATOR APP ====================
const CalculatorApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [operator, setOperator] = useState<string | null>(null);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD'>('DEG');

  const fmt = (n: number) => {
    if (!isFinite(n)) return 'خطأ';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 10 });
  };

  const inputDigit = (d: string) => {
    if (waitingForOperand) { setDisplay(d); setWaitingForOperand(false); }
    else setDisplay(prev => prev === '0' ? d : prev + d);
  };
  const inputDecimal = () => {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); return; }
    if (!display.includes('.')) setDisplay(prev => prev + '.');
  };
  const clearAll = () => { setDisplay('0'); setExpression(''); setOperator(null); setPrevValue(null); setWaitingForOperand(false); };
  const clearEntry = () => setDisplay('0');
  const backspace = () => setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
  const toggleSign = () => setDisplay(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev);

  const calc = (a: number, b: number, op: string): number => {
    const expr = `${fmt(a)} ${op} ${fmt(b)}`;
    let r: number;
    switch (op) {
      case '+': r = a + b; break;
      case '−': r = a - b; break;
      case '×': r = a * b; break;
      case '÷': r = b !== 0 ? a / b : NaN; break;
      case '^': r = Math.pow(a, b); break;
      default: r = b;
    }
    setHistory(prev => [`${expr} = ${fmt(r)}`, ...prev].slice(0, 30));
    return r;
  };

  const performOp = (nextOp: string) => {
    const cv = parseFloat(display);
    if (prevValue === null) { setPrevValue(cv); setExpression(`${fmt(cv)} ${nextOp}`); }
    else if (operator) {
      const r = calc(prevValue!, cv, operator);
      setDisplay(fmt(r));
      setPrevValue(r);
      setExpression(`${fmt(r)} ${nextOp}`);
    }
    setWaitingForOperand(true);
    setOperator(nextOp);
  };

  const equals = () => {
    const cv = parseFloat(display);
    if (prevValue !== null && operator) {
      const r = calc(prevValue, cv, operator);
      setDisplay(fmt(r));
      setExpression(`${fmt(prevValue)} ${operator} ${fmt(cv)} =`);
      setPrevValue(null); setOperator(null); setWaitingForOperand(true);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
      else if (e.key === '.') inputDecimal();
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      else if (e.key === 'Escape') clearAll();
      else if (e.key === 'Backspace') backspace();
      else if (e.key === '%') { const n = parseFloat(display); setDisplay(fmt(n / 100)); }
      else if (e.key === '+') performOp('+');
      else if (e.key === '-') performOp('−');
      else if (e.key === '*') performOp('×');
      else if (e.key === '/') { e.preventDefault(); performOp('÷'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [display, operator, prevValue, waitingForOperand]);

  const sciFunc = (fn: string) => {
    const n = parseFloat(display);
    let r: number;
    const toRad = (d: number) => angleMode === 'DEG' ? d * Math.PI / 180 : d;
    switch (fn) {
      case 'sqrt': r = Math.sqrt(n); break;
      case 'square': r = n * n; break;
      case 'inv': r = n !== 0 ? 1 / n : NaN; break;
      case 'sin': r = Math.sin(toRad(n)); break;
      case 'cos': r = Math.cos(toRad(n)); break;
      case 'tan': r = Math.tan(toRad(n)); break;
      case 'log': r = Math.log10(n); break;
      case 'ln': r = Math.log(n); break;
      case 'fact': r = n >= 0 && Number.isInteger(n) ? factorial(n) : NaN; break;
      default: r = n;
    }
    setDisplay(fmt(r));
  };

  const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);

  const btnStyle = (bg: string, fg = '#fff'): React.CSSProperties => ({
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
    background: bg, color: fg, cursor: 'pointer', fontWeight: 600,
    fontSize: '0.9rem', transition: 'all 0.1s', userSelect: 'none',
  });

  return (
    <div style={{ height: '100%', display: 'flex', gap: 8, direction: 'ltr', color: '#e2e8f0' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '10px 14px',
          textAlign: 'right', direction: 'rtl', minHeight: 56,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          fontFamily: "'Segoe UI', 'San Francisco', monospace",
          border: '1px solid rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden',
        }}>
          {expression && (
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 1, direction: 'ltr', textAlign: 'right' }}>
              {expression}
            </div>
          )}
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Segoe UI', 'San Francisco', monospace", direction: 'ltr', textAlign: 'right' }}>
            {display}
          </div>
          <div style={{ position: 'absolute', top: 4, left: 8, fontSize: '0.55rem', color: '#475569' }}>{angleMode}</div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {['sin', 'cos', 'tan', 'log', 'ln'].map(fn => (
            <button key={fn} style={{ ...btnStyle('rgba(255,255,255,0.05)', '#94a3b8'), fontSize: '0.68rem', padding: '7px 0' }} onClick={() => sciFunc(fn)}>{fn}</button>
          ))}
          <button style={{ ...btnStyle('rgba(255,255,255,0.05)', '#94a3b8'), fontSize: '0.6rem', padding: '7px 0' }} onClick={() => setAngleMode(prev => prev === 'DEG' ? 'RAD' : 'DEG')}>
            {angleMode}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {['√', 'x²', '1/x', 'x!', 'xʸ'].map(fn => (
            <button key={fn} style={{ ...btnStyle('rgba(255,255,255,0.05)', '#94a3b8'), fontSize: '0.68rem', padding: '7px 0' }}
              onClick={() => {
                if (fn === '√') sciFunc('sqrt');
                else if (fn === 'x²') sciFunc('square');
                else if (fn === '1/x') sciFunc('inv');
                else if (fn === 'x!') sciFunc('fact');
                else if (fn === 'xʸ') performOp('^');
              }}>{fn}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button style={btnStyle('rgba(239,68,68,0.15)', '#ef4444')} onClick={clearAll}>AC</button>
          <button style={btnStyle('rgba(255,255,255,0.06)', '#94a3b8')} onClick={clearEntry}>C</button>
          <button style={btnStyle('rgba(255,255,255,0.06)', '#94a3b8')} onClick={backspace}>⌫</button>
          <button style={btnStyle('rgba(99,102,241,0.2)', '#818cf8')} onClick={() => performOp('÷')}>÷</button>
        </div>
        {[
          ['7', '8', '9', '×'],
          ['4', '5', '6', '−'],
          ['1', '2', '3', '+'],
        ].map(row => (
          <div key={row[0]} style={{ display: 'flex', gap: 3 }}>
            {row.map(k => (
              <button key={k} style={btnStyle('rgba(255,255,255,0.06)', k === '×' || k === '−' || k === '+' ? '#818cf8' : '#f1f5f9')}
                onClick={() => k === '×' || k === '−' || k === '+' ? performOp(k) : inputDigit(k)}>
                {k}
              </button>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 3 }}>
          <button style={btnStyle('rgba(255,255,255,0.06)', '#94a3b8')} onClick={toggleSign}>±</button>
          <button style={btnStyle('rgba(255,255,255,0.06)', '#f1f5f9')} onClick={() => inputDigit('0')}>0</button>
          <button style={btnStyle('rgba(255,255,255,0.06)', '#f1f5f9')} onClick={inputDecimal}>,</button>
          <button style={{ ...btnStyle('linear-gradient(135deg, #6366f1, #8b5cf6)', '#fff'), fontSize: '1rem' }} onClick={equals}>=</button>
        </div>
      </div>
      <div style={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button onClick={() => setShowHistory(!showHistory)}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 3 }}>
          <Clock size={12} />
        </button>
        {showHistory && (
          <div style={{ position: 'absolute', left: 36, top: 0, width: 170, maxHeight: 250, overflowY: 'auto',
            background: '#1e293b', borderRadius: 8, padding: 8, zIndex: 50,
            border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.68rem', marginBottom: 4, color: '#94a3b8' }}>السجل</div>
            {history.length === 0 && <div style={{ fontSize: '0.65rem', color: '#475569' }}>فارغ</div>}
            {history.map((h, i) => (
              <div key={i} style={{ fontSize: '0.65rem', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', direction: 'ltr', textAlign: 'right', color: '#cbd5e1' }}>{h}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== SPREADSHEET APP ====================
const SpreadsheetApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [cols, setCols] = useState(6);
  const [rows, setRows] = useState(15);
  const [data, setData] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('opencode_sheet') || '{}'); }
    catch { return {}; }
  });
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [formulaBar, setFormulaBar] = useState('');

  useEffect(() => { localStorage.setItem('opencode_sheet', JSON.stringify(data)); }, [data]);

  const cellId = (r: number, c: number) => `${String.fromCharCode(65 + c)}${r + 1}`;

  const evaluate = (expr: string): string => {
    try {
      const resolved = expr.toUpperCase().replace(/[A-Z]+\d+/g, m => {
        const v = parseFloat(data[m] || '0');
        return isNaN(v) ? '0' : v.toString();
      });
      const r = Function('"use strict"; return (' + resolved + ')')();
      return isNaN(r) ? expr : String(r);
    } catch { return expr; }
  };

  const getDisplay = (id: string) => {
    const raw = data[id] || '';
    if (raw.startsWith('=')) return evaluate(raw.slice(1));
    return raw;
  };

  const updateCell = (id: string, val: string) => {
    setData(prev => {
      const next = { ...prev };
      if (val === '' || val === undefined) delete next[id];
      else next[id] = val;
      return next;
    });
  };

  const exportCSV = () => {
    let csv = '';
    for (let r = 0; r < rows; r++) {
      csv += Array.from({ length: cols }, (_, c) => data[cellId(r, c)] || '').join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'table.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const colLetter = (c: number) => String.fromCharCode(65 + c);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 80 }}>
          <span style={{ position: 'absolute', right: 8, top: 6, fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 700 }}>
            {activeCell || ''}
          </span>
          <input style={{ width: '100%', paddingRight: 32, fontSize: '0.75rem', height: 28, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#e2e8f0', outline: 'none', fontFamily: 'Tajawal' }}
            value={formulaBar} onChange={e => { setFormulaBar(e.target.value); if (activeCell) updateCell(activeCell, e.target.value); }} placeholder="fx" />
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={() => setRows(prev => Math.min(prev + 1, 200))} style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.6rem' }}>صف +</button>
          <button onClick={() => setCols(prev => Math.min(prev + 1, 26))} style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.6rem' }}>عمود +</button>
          <button onClick={exportCSV} style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#34d399', cursor: 'pointer', fontSize: '0.6rem' }}>CSV</button>
          <button onClick={() => setData({})} style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: '0.6rem' }}>مسح</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 300, fontSize: '0.72rem' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 22, padding: '2px 3px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.05)', fontWeight: 600, fontSize: '0.6rem', color: '#64748b', position: 'sticky', top: 0, zIndex: 2 }}>#</th>
              {Array.from({ length: cols }).map((_, c) => (
                <th key={c} style={{ minWidth: 75, padding: '2px 5px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.05)', fontWeight: 600, fontSize: '0.6rem', color: '#64748b', position: 'sticky', top: 0, zIndex: 1 }}>{colLetter(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                <td style={{ padding: '2px 3px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.03)', fontWeight: 600, fontSize: '0.6rem', color: '#475569' }}>{r + 1}</td>
                {Array.from({ length: cols }).map((_, c) => {
                  const id = cellId(r, c);
                  const isActive = activeCell === id;
                  const display = getDisplay(id);
                  const raw = data[id] || '';
                  return (
                    <td key={c} onClick={() => { setActiveCell(id); setFormulaBar(raw); }}
                      style={{
                        padding: '2px 5px', borderBottom: '1px solid rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.03)',
                        cursor: 'cell', background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                        outline: isActive ? '1px solid #6366f1' : 'none', outlineOffset: -1,
                        color: raw.startsWith('=') ? '#818cf8' : '#e2e8f0',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textAlign: 'left', direction: 'ltr', fontSize: '0.72rem',
                      }}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== APP REGISTRY ====================
const APPS: AppDef[] = [
  { id: 'files', title: 'الملفات', icon: Folder, color: '#f59e0b', component: FilesDesktopApp, width: 580, height: 480 },
  { id: 'notes', title: 'الملاحظات', icon: StickyNote, color: '#3b82f6', component: NotesDesktopApp, width: 460, height: 500 },
  { id: 'documents', title: 'المستندات', icon: FileText, color: '#10b981', component: DocumentsDesktopApp, width: 540, height: 480 },
  { id: 'calculator', title: 'آلة حاسبة', icon: Calculator, color: '#6366f1', component: CalculatorApp, width: 300, height: 440 },
  { id: 'spreadsheet', title: 'الجداول', icon: Table, color: '#06b6d4', component: SpreadsheetApp, width: 560, height: 480 },
];

// ==================== WINDOW COMPONENT ====================
interface DesktopWindowProps {
  win: WindowState;
  onFocus: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, edge: string) => void;
  isDragging: boolean;
}

const DesktopWindow = React.memo(({ win, onFocus, onMinimize, onMaximize, onClose, onDragStart, onResizeStart, isDragging }: DesktopWindowProps) => {
  const isTop = win.zIndex === _zCounter;

  return (
    <div data-window
      onClick={onFocus}
      onMouseDown={onFocus}
      style={{
        position: 'absolute',
        left: win.x, top: win.y,
        width: win.width, height: win.height,
        zIndex: win.zIndex,
        display: 'flex', flexDirection: 'column',
        borderRadius: 10, overflow: 'hidden',
        background: 'rgba(18, 22, 36, 0.96)',
        backdropFilter: 'blur(8px)',
        border: isTop ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isTop
          ? '0 16px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)'
          : '0 8px 32px rgba(0,0,0,0.3)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        userSelect: isDragging ? 'none' : undefined,
      }}>
      {/* Title bar */}
      <div onMouseDown={onDragStart}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 10px', cursor: 'grab', flexShrink: 0,
          background: isTop ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          borderBottom: isTop ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.03)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontWeight: 600, fontSize: '0.75rem' }}>
          <span style={{ color: win.color, display: 'flex' }}>{win.icon}</span>
          {win.title}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onMinimize(); }}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#64748b', width: 22, height: 22, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Minus size={10} />
          </button>
          <button onClick={e => { e.stopPropagation(); onMaximize(); }}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#64748b', width: 22, height: 22, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {win.maximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
          <button onClick={e => { e.stopPropagation(); onClose(); }}
            style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: '#ef4444', width: 22, height: 22, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}>
            <X size={10} />
          </button>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: 10, overflow: 'auto', position: 'relative', minHeight: 0 }}>
        {win.component}
      </div>
      {/* Resize handles */}
      {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(edge => (
        <div key={edge} onMouseDown={e => onResizeStart(e, edge)}
          style={{
            position: 'absolute',
            ...(edge.includes('n') ? { top: 0, height: 3, cursor: 'n-resize' } : edge.includes('s') ? { bottom: 0, height: 3, cursor: 's-resize' } : { height: '100%' }),
            ...(edge.includes('e') ? { right: 0, width: 3, cursor: 'e-resize' } : edge.includes('w') ? { left: 0, width: 3, cursor: 'w-resize' } : { width: '100%' }),
            ...(edge.length === 2 ? {
              [edge.includes('n') ? 'top' : 'bottom']: 0,
              [edge.includes('e') ? 'right' : 'left']: 0,
              width: 6, height: 6,
              cursor: edge === 'ne' || edge === 'sw' ? 'ne-resize' : 'nw-resize',
              zIndex: 10,
            } : { zIndex: 5 }),
          }} />
      ))}
    </div>
  );
});

// ==================== START MENU ====================
interface StartMenuProps {
  open: boolean;
  onClose: () => void;
  onLaunchApp: (app: AppDef) => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ open, onClose, onLaunchApp }) => {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (open) { document.addEventListener('mousedown', h); setSearch(''); }
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = search
    ? APPS.filter(a => a.title.includes(search))
    : APPS;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={onClose} />
      <div ref={ref} style={{
        position: 'fixed', bottom: 48, right: '50%', transform: 'translateX(50%)',
        width: 400, maxHeight: 480,
        background: 'rgba(15, 20, 35, 0.97)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeInUp 0.2s ease',
      }}>
        {/* Search */}
        <div style={{ padding: '14px 14px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
            <input
              type="text" placeholder="ابحث عن تطبيق..." value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: '#e2e8f0', fontSize: '0.82rem', width: '100%',
                fontFamily: 'Cairo',
              }} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>
                ×
              </button>
            )}
          </div>
        </div>

        {/* Apps list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {search && <div style={{ padding: '6px 8px', fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>التطبيقات</div>}
          {filtered.map((app, i) => (
            <div key={app.id} onClick={() => { onLaunchApp(app); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                transition: 'all 0.12s',
                animation: `fadeInUp 0.25s ease ${i * 0.03}s both`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{
                width: 32, height: 32, borderRadius: 7,
                background: `linear-gradient(135deg, ${app.color}, ${app.color}bb)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
              }}>
                <app.icon size={14} />
              </div>
              <div style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 500 }}>{app.title}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: '#475569', fontSize: '0.78rem' }}>
              لا توجد تطبيقات
            </div>
          )}
        </div>

        {/* Bottom */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(255,255,255,0.06)', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Settings size={13} /></div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>
    </>
  );
};

// ==================== TASKBAR ====================
interface TaskbarProps {
  windows: WindowState[];
  clock: Date;
  onStartClick: () => void;
  onAppClick: (app: AppDef) => void;
  onTaskbarAppClick: (id: string) => void;
  startOpen: boolean;
}

const Taskbar: React.FC<TaskbarProps> = ({ windows, clock, onStartClick, onAppClick, onTaskbarAppClick, startOpen }) => {
  const isOpen = (id: string) => windows.some(w => w.id === id && !w.minimized);
  const isMin = (id: string) => windows.some(w => w.id === id && w.minimized);

  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center', gap: 2,
      padding: '0 10px', flexShrink: 0,
      background: 'rgba(12, 16, 28, 0.92)',
      backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      zIndex: 100,
      position: 'relative',
    }}>
      {/* Start button */}
      <button onClick={onStartClick}
        style={{
          width: 36, height: 36, borderRadius: 8, border: 'none',
          background: startOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: startOpen ? '#fff' : '#64748b',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.12s',
          marginLeft: 2,
        }}
        onMouseEnter={e => { if (!startOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; } }}
        onMouseLeave={e => { if (!startOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}>
        <Grid size={16} />
      </button>

      {/* Running apps */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' }}>
        {APPS.map(app => {
          const win = windows.find(w => w.id === app.id);
          const active = win && !win.minimized;
          const minimized = win?.minimized;
          return (
            <button key={app.id} onClick={() => win ? onTaskbarAppClick(app.id) : onAppClick(app)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6, border: 'none',
                background: active ? 'rgba(255,255,255,0.08)' : minimized ? 'rgba(255,255,255,0.03)' : 'transparent',
                color: active ? '#fff' : '#64748b',
                cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
                height: 32, position: 'relative',
                transition: 'all 0.12s',
                opacity: minimized ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = minimized ? 'rgba(255,255,255,0.03)' : 'transparent'; } }}>
              <app.icon size={13} />
              {(active || minimized) && (
                <span style={{ fontSize: '0.7rem', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {app.title}
                </span>
              )}
              {active && <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 16, height: 2, borderRadius: 1, background: app.color }} />}
            </button>
          );
        })}
      </div>

      {/* System tray */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 500 }}>
            {clock.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== HOME PAGE ====================
export const HomePage = () => {
  const { user, centerName } = useAuth();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [clock, setClock] = useState(new Date());
  const [startOpen, setStartOpen] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; edge: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const bringToFront = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: ++_zCounter } : w));
  };

  const openApp = (appDef: AppDef) => {
    setStartOpen(false);
    const existing = windows.find(w => w.id === appDef.id && !w.minimized);
    if (existing) {
      bringToFront(appDef.id);
      return;
    }
    const minimized = windows.find(w => w.id === appDef.id);
    if (minimized) {
      setWindows(prev => prev.map(w => w.id === appDef.id ? { ...w, minimized: false, zIndex: ++_zCounter } : w));
      return;
    }
    const offset = windows.length * 18;
    const win: WindowState = {
      id: appDef.id,
      title: appDef.title,
      icon: <appDef.icon size={13} />,
      color: appDef.color,
      x: 40 + offset,
      y: 30 + offset,
      width: appDef.width,
      height: appDef.height,
      minimized: false,
      maximized: false,
      zIndex: ++_zCounter,
      component: <appDef.component onClose={() => closeWindow(appDef.id)} />,
    };
    setWindows(prev => [...prev, win]);
  };

  const closeWindow = (id: string) => setWindows(prev => prev.filter(w => w.id !== id));

  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: true } : w));
  };

  const toggleMaximize = (id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.maximized && w.prevRect) {
        return { ...w, maximized: false, x: w.prevRect.x, y: w.prevRect.y, width: w.prevRect.width, height: w.prevRect.height, prevRect: undefined };
      }
      return { ...w, maximized: true, prevRect: { x: w.x, y: w.y, width: w.width, height: w.height }, x: 0, y: 0, width: window.innerWidth - 220, height: window.innerHeight - 104 };
    }));
  };

  const taskbarAppClick = (id: string) => {
    const win = windows.find(w => w.id === id);
    if (!win) return;
    if (win.minimized) {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: false, zIndex: ++_zCounter } : w));
    } else if (win.zIndex === _zCounter) {
      minimizeWindow(id);
    } else {
      bringToFront(id);
    }
  };

  const startDrag = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const target = e.currentTarget.closest('[data-window]') as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    setDragging({ id, dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      setWindows(prev => prev.map(w =>
        w.id === dragging.id ? { ...w, x: Math.max(0, e.clientX - dragging.dx), y: Math.max(0, e.clientY - dragging.dy) } : w
      ));
    };
    const up = () => setDragging(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging]);

  const startResize = (e: React.MouseEvent, id: string, edge: string) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget.closest('[data-window]') as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setResizing({ id, edge, startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height });
  };

  useEffect(() => {
    if (!resizing) return;
    const move = (e: MouseEvent) => {
      setWindows(prev => prev.map(w => {
        if (w.id !== resizing.id) return w;
        if (w.maximized) return w;
        const dx = e.clientX - resizing.startX;
        const dy = e.clientY - resizing.startY;
        let newW = resizing.startW, newH = resizing.startH, newX = w.x, newY = w.y;
        if (resizing.edge.includes('e')) newW = Math.max(220, resizing.startW + dx);
        if (resizing.edge.includes('s')) newH = Math.max(200, resizing.startH + dy);
        if (resizing.edge.includes('w')) { newW = Math.max(220, resizing.startW - dx); newX = w.x + dx; }
        if (resizing.edge.includes('n')) { newH = Math.max(200, resizing.startH - dy); newY = w.y + dy; }
        return { ...w, x: newX, y: newY, width: newW, height: newH };
      }));
    };
    const up = () => setResizing(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [resizing]);

  const h = clock.getHours();
  const greeting = h < 12 ? 'صباح الخير' : h < 17 ? 'مساء الخير' : 'مساء الخير';

  return (
    <div style={{
      height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column',
      background: '#0a0e1a',
      position: 'relative', overflow: 'hidden', borderRadius: 14,
    }}>
      {/* Animated wallpaper */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.07) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(6,182,212,0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(236,72,153,0.04) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(255,255,255,0.012) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 24px 24px',
        pointerEvents: 'none',
      }} />

      {/* Desktop content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        {/* Desktop icons - left sidebar style */}
        <div style={{
          position: 'absolute', right: 12, top: 12, zIndex: 5,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {APPS.map((app, i) => {
            const active = windows.some(w => w.id === app.id && !w.minimized);
            const minimized = windows.some(w => w.id === app.id && w.minimized);
            return (
              <div key={app.id} onClick={() => openApp(app)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '5px 6px', borderRadius: 8, cursor: 'pointer',
                  width: 50,
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: active ? '1px solid rgba(255,255,255,0.10)' : '1px solid transparent',
                  transition: 'all 0.12s',
                  opacity: minimized ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!active && !minimized) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active && !minimized) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `linear-gradient(135deg, ${app.color}, ${app.color}aa)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                  boxShadow: `0 2px 8px ${app.color}22`,
                }}>
                  <app.icon size={14} />
                </div>
                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.15 }}>
                  {app.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Welcome overlay */}
        {windows.filter(w => !w.minimized).length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 1,
            gap: 4, pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: '2.2rem', fontWeight: 800, color: '#f1f5f9',
              textShadow: '0 2px 20px rgba(0,0,0,0.3)',
              letterSpacing: '-0.02em',
            }}>
              {greeting}، {user?.fullName?.split(' ')[0]}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: 4 }}>
              {centerName}
            </div>
            <div style={{
              fontSize: '3.5rem', fontWeight: 200, color: 'rgba(255,255,255,0.06)',
              fontFamily: 'monospace', letterSpacing: 4,
            }}>
              {clock.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>
              اضغط على أيقونة أو ابدأ من القائمة
            </div>
          </div>
        )}

        {/* Windows */}
        {windows.map(win => {
          if (win.minimized) return null;
          const isDragging = dragging?.id === win.id;
          return (
            <DesktopWindow
              key={win.id}
              win={win}
              onFocus={() => bringToFront(win.id)}
              onMinimize={() => minimizeWindow(win.id)}
              onMaximize={() => toggleMaximize(win.id)}
              onClose={() => closeWindow(win.id)}
              onDragStart={e => startDrag(e, win.id)}
              onResizeStart={(e, edge) => startResize(e, win.id, edge)}
              isDragging={isDragging}
            />
          );
        })}
      </div>

      {/* Taskbar */}
      <Taskbar
        windows={windows}
        clock={clock}
        onStartClick={() => setStartOpen(prev => !prev)}
        onAppClick={openApp}
        onTaskbarAppClick={taskbarAppClick}
        startOpen={startOpen}
      />

      {/* Start Menu */}
      <StartMenu open={startOpen} onClose={() => setStartOpen(false)} onLaunchApp={openApp} />
    </div>
  );
};
