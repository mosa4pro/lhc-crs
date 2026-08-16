import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

import {
  Folder, File, Upload, Download, Trash2, Edit3, Plus,
  ChevronLeft, FileText, Image, Film, Music, Archive,
  StickyNote, Pin, PinOff, Palette, Save, X,
  Table, Search, FileSpreadsheet
} from 'lucide-react';
import { formatDate } from '../utils/dateFormat';

// ==================== API NOTE ====================
interface ApiNote {
  id: number;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  '#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#fae8ff', '#ffe4e6', '#e0e7ff', '#fef9c3',
];

export const NotesDesktopApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { apiFetch } = useApi();
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/user-notes');
      setNotes(data);
    } catch {} finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      const note = await apiFetch('/user-notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'ملاحظة جديدة', content: '', color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] }),
      });
      setEditingId(note.id);
      setEditTitle(note.title);
      setEditContent(note.content);
      load();
    } catch {}
  };

  const handleSave = async (id: number) => {
    try {
      await apiFetch(`/user-notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      setEditingId(null);
      load();
    } catch {}
  };

  const handleTogglePin = async (note: ApiNote) => {
    try {
      await apiFetch(`/user-notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      load();
    } catch {}
  };

  const handleColorChange = async (note: ApiNote, color: string) => {
    try {
      await apiFetch(`/user-notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({ color }),
      });
      setShowColorPicker(null);
      load();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/user-notes/${id}`, { method: 'DELETE' });
      if (editingId === id) setEditingId(null);
      load();
    } catch {}
  };

  const filtered = notes.filter(n =>
    n.title.includes(search) || n.content.includes(search)
  );
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', right: 10, top: 9, color: '#64748b' }} />
          <input className="glass-input" dir="rtl" style={{ paddingRight: 30, fontSize: '0.78rem', height: 32, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={handleCreate} style={{
          height: 32, padding: '0 12px', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <Plus size={13} /> جديدة
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 2 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.3, fontSize: '0.8rem', color: '#94a3b8' }}>جارٍ التحميل...</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.3, fontSize: '0.8rem', color: '#94a3b8' }}>
            {search ? 'لا توجد نتائج' : 'لا توجد ملاحظات'}
          </div>
        ) : sorted.map(note => (
          <div key={note.id}
            style={{
              background: note.color, borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
              position: 'relative', transition: 'all 0.12s',
              borderLeft: `3px solid ${note.color}`,
              opacity: editingId === note.id ? 0.5 : 1,
            }}
            onClick={() => { setEditingId(note.id); setEditTitle(note.title); setEditContent(note.content); }}
            onMouseEnter={e => { if (editingId !== note.id) { e.currentTarget.style.transform = 'translateX(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}}
            onMouseLeave={e => { if (editingId !== note.id) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                {note.pinned && <PinOff size={10} />}
                {note.title || 'بدون عنوان'}
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {note.content.length > 80 ? note.content.slice(0, 80) + '…' : note.content}
            </div>

            {/* Quick actions */}
            {editingId !== note.id && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}
                onClick={e => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => handleTogglePin(note)}
                  style={{ width: 22, height: 22, background: 'rgba(0,0,0,0.08)', borderRadius: 4, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {note.pinned ? <PinOff size={9} /> : <Pin size={9} />}
                </button>
                <div style={{ position: 'relative' }}>
                  <button className="icon-btn" onClick={() => setShowColorPicker(showColorPicker === note.id ? null : note.id)}
                    style={{ width: 22, height: 22, background: 'rgba(0,0,0,0.08)', borderRadius: 4, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Palette size={9} />
                  </button>
                  {showColorPicker === note.id && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, display: 'flex', gap: 2, padding: 4,
                      background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                      {NOTE_COLORS.map(c => (
                        <div key={c} onClick={() => handleColorChange(note, c)}
                          style={{ width: 16, height: 16, borderRadius: 3, background: c, cursor: 'pointer', border: c === note.color ? '2px solid #6366f1' : '2px solid transparent' }} />
                      ))}
                    </div>
                  )}
                </div>
                <button className="icon-btn" onClick={() => handleDelete(note.id)}
                  style={{ width: 22, height: 22, background: 'rgba(239,68,68,0.15)', borderRadius: 4, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <Trash2 size={9} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Inline editor */}
      {editingId !== null && (() => {
        const note = notes.find(n => n.id === editingId);
        if (!note) return null;
        return (
          <div style={{
            marginTop: 10, padding: 12, borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <input className="glass-input" dir="rtl" placeholder="عنوان" value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
            <textarea className="glass-input" dir="rtl" style={{ minHeight: 80, resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', marginBottom: 8, fontSize: '0.78rem' }}
              placeholder="اكتب..." value={editContent} onChange={e => setEditContent(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => handleSave(editingId)}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Save size={12} /> حفظ
              </button>
              <button onClick={() => setEditingId(null)}
                style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}>
                إلغاء
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ==================== FILES APP ====================
interface UserFile {
  id: number;
  name: string;
  type: string;
  mimeType: string | null;
  size: number | null;
  parentId: number | null;
  createdAt: string;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText size={16} />, doc: <FileText size={16} />, docx: <FileText size={16} />,
  xls: <FileSpreadsheet size={16} />, xlsx: <FileSpreadsheet size={16} />,
  jpg: <Image size={16} />, jpeg: <Image size={16} />, png: <Image size={16} />, gif: <Image size={16} />,
  mp4: <Film size={16} />, mov: <Film size={16} />, mp3: <Music size={16} />,
  zip: <Archive size={16} />, rar: <Archive size={16} />,
};

function getFileIcon(name: string): React.ReactNode {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || <File size={16} />;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilesDesktopApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { apiFetch } = useApi();
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [path, setPath] = useState<{ id: number | null; name: string }[]>([{ id: null, name: 'ملفاتي' }]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [sharedMode, setSharedMode] = useState(false);

  const apiPrefix = sharedMode ? '/shared-files' : '/user-files';

  const load = useCallback(async (parentId: number | null) => {
    setLoading(true);
    try {
      const data = await apiFetch(`${apiPrefix}?parentId=${parentId ?? ''}`);
      setFiles(data);
    } catch {} finally { setLoading(false); }
  }, [apiFetch, apiPrefix]);

  useEffect(() => { load(currentFolderId); }, [currentFolderId, load]);

  const navTo = (id: number | null, name: string) => {
    setCurrentFolderId(id);
    if (id === null) {
      if (sharedMode) setPath([{ id: null, name: 'الملفات المشتركة' }]);
      else setPath([{ id: null, name: 'ملفاتي' }]);
    } else setPath(prev => {
      const idx = prev.findIndex(p => p.id === id);
      return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, { id, name }];
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const token = localStorage.getItem('ems_token');
      await fetch(`${API_BASE}/api${apiPrefix}/upload?parentId=${currentFolderId ?? ''}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      load(currentFolderId);
    } catch {}
    e.target.value = '';
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await apiFetch(`${apiPrefix}/folder`, {
        method: 'POST', body: JSON.stringify({ name: folderName.trim(), parentId: currentFolderId }),
      });
      setFolderName(''); setCreatingFolder(false);
      load(currentFolderId);
    } catch {}
  };

  const handleRename = async (id: number) => {
    if (!renameVal.trim()) return;
    try {
      await apiFetch(`${apiPrefix}/rename/${id}`, {
        method: 'PUT', body: JSON.stringify({ name: renameVal.trim() }),
      });
      setRenaming(null);
      load(currentFolderId);
    } catch {}
  };

  const handleDelete = async (f: UserFile) => {
    try {
      await apiFetch(`${apiPrefix}/${f.id}`, { method: 'DELETE' });
      load(currentFolderId);
    } catch {}
  };

  const handleDownload = async (f: UserFile) => {
    try {
      const token = localStorage.getItem('ems_token');
      const res = await fetch(`${API_BASE}/api${apiPrefix}/download/${f.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = f.name; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const toggleMode = () => {
    const wasShared = sharedMode;
    setSharedMode(!wasShared);
    setCurrentFolderId(null);
    setPath([{ id: null, name: !wasShared ? 'الملفات المشتركة' : 'ملفاتي' }]);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap', fontSize: '0.72rem' }}>
          {path.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronLeft size={11} style={{ opacity: 0.3 }} />}
              <span onClick={() => navTo(p.id, p.name)}
                style={{ cursor: 'pointer', fontWeight: p.id === currentFolderId ? 700 : 400, color: p.id === currentFolderId ? '#818cf8' : '#94a3b8' }}>
                {p.name}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={toggleMode}
            style={{ height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: sharedMode ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.04)', color: sharedMode ? '#fbbf24' : '#94a3b8', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {sharedMode ? 'ملفاتي' : 'مشتركة'}
          </button>
          <button onClick={() => setCreatingFolder(true)}
            style={{ height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={11} /> مجلد
          </button>
          <label style={{ height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: 'rgba(16,185,129,0.2)', color: '#34d399', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Upload size={11} /> رفع
            <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {creatingFolder && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          <input className="glass-input" dir="rtl" placeholder="اسم المجلد" value={folderName}
            onChange={e => setFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            style={{ flex: 1, height: 30, fontSize: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} autoFocus />
          <button onClick={handleCreateFolder} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>إنشاء</button>
          <button onClick={() => { setCreatingFolder(false); setFolderName(''); }} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.7rem' }}>إلغاء</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: '0.8rem' }}>جارٍ التحميل...</div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
            <Folder size={28} style={{ opacity: 0.2, marginBottom: 6 }} />
            <div style={{ fontSize: '0.75rem' }}>مجلد فارغ</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {files.map(f => (
              <div key={f.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 40px', gap: 6,
                padding: '6px 10px', alignItems: 'center', fontSize: '0.74rem',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {f.type === 'FOLDER' ? (
                    <Folder size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  ) : (
                    <span style={{ flexShrink: 0, opacity: 0.5 }}>{getFileIcon(f.name)}</span>
                  )}
                  {renaming === f.id ? (
                    <input className="glass-input" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(f.id); if (e.key === 'Escape') setRenaming(null); }}
                      onBlur={() => setRenaming(null)} autoFocus
                      style={{ height: 24, fontSize: '0.72rem', padding: '0 6px', flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  ) : (
                    <span onClick={() => f.type === 'FOLDER' && navTo(f.id, f.name)}
                      style={{ cursor: f.type === 'FOLDER' ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: f.type === 'FOLDER' ? '#f59e0b' : '#e2e8f0' }}>
                      {f.name}
                    </span>
                  )}
                </div>
                <span style={{ textAlign: 'left', fontSize: '0.68rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                  {f.type === 'FILE' ? fmtSize(f.size) : '—'}
                </span>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  {f.type === 'FILE' && (
                    <button className="icon-btn" onClick={() => handleDownload(f)}
                      style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Download size={10} />
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => { setRenaming(f.id); setRenameVal(f.name); }}
                    style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit3 size={10} />
                  </button>
                  <button className="icon-btn" onClick={() => handleDelete(f)}
                    style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== DOCUMENTS APP ====================
interface Doc {
  id: number;
  title: string;
  type: string;
  content: string;
  updatedAt: string;
}

const WordEditor: React.FC<{ doc: Doc; onSave: (title: string, content: string) => void; onBack: () => void }> = ({ doc, onSave, onBack }) => {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);

  const fmt = (cmd: string, val?: string) => document.execCommand(cmd, false, val);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.72rem' }}>← رجوع</button>
        <input className="glass-input" value={title} onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, height: 30, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
        <button onClick={() => onSave(title, content)}
          style={{ height: 30, padding: '0 14px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Save size={11} /> حفظ
        </button>
      </div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[['B', ' bold'], ['I', ' italic'], ['U', ' underline']].map(([l, c]) => (
          <button key={c} onClick={() => fmt(c)} style={{ width: 26, height: 24, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.7rem', fontWeight: l === 'B' ? 700 : 400 }}>{l}</button>
        ))}
        <span style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
        {[['• قائمة', 'insertUnorderedList'], ['1. قائمة', 'insertOrderedList']].map(([l, c]) => (
          <button key={c} onClick={() => fmt(c)} style={{ height: 24, padding: '0 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.65rem' }}>{l}</button>
        ))}
      </div>
      <div contentEditable suppressContentEditableWarning
        onInput={e => setContent((e.target as HTMLDivElement).innerHTML)}
        dangerouslySetInnerHTML={{ __html: content }}
        style={{
          flex: 1, padding: 12, overflowY: 'auto',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
          outline: 'none', fontSize: '0.82rem', lineHeight: 1.8, color: '#e2e8f0', fontFamily: 'Cairo', direction: 'rtl',
        }}
      />
    </div>
  );
};

const SpreadsheetEditor: React.FC<{ doc: Doc; onSave: (title: string, content: string) => void; onBack: () => void }> = ({ doc, onSave, onBack }) => {
  const [title, setTitle] = useState(doc.title);
  const parsed = (() => { try { return JSON.parse(doc.content); } catch { return [['']]; } })();
  const [data, setData] = useState<string[][]>(parsed.length > 0 ? parsed : [['']]);
  const [cols, setCols] = useState(Math.max(4, (parsed[0] || []).length));
  const [rows, setRows] = useState(Math.max(8, parsed.length));

  useEffect(() => {
    const nd = data.map(r => { while (r.length < cols) r.push(''); return r.slice(0, cols); });
    while (nd.length < rows) nd.push(new Array(cols).fill(''));
    setData(nd.slice(0, rows));
  }, [cols, rows]);

  const updateCell = (r: number, c: number, val: string) => {
    const copy = data.map(row => [...row]);
    copy[r][c] = val;
    setData(copy);
  };

  const colLabels = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.72rem' }}>← رجوع</button>
        <input className="glass-input" value={title} onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, height: 30, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
        <button onClick={() => onSave(title, JSON.stringify(data))}
          style={{ height: 30, padding: '0 14px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Save size={11} /> حفظ
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem' }}>
          <thead>
            <tr>
              <th style={{ width: 24, padding: 3, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: '1px solid rgba(255,255,255,0.06)', fontWeight: 600, color: '#64748b', fontSize: '0.65rem' }}>#</th>
              {colLabels.map((l, ci) => (
                <th key={ci} style={{ padding: '3px 6px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: '1px solid rgba(255,255,255,0.06)', fontWeight: 600, color: '#64748b', fontSize: '0.65rem', textAlign: 'center' }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, rows).map((row, ri) => (
              <tr key={ri}>
                <td style={{ padding: '2px 3px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: '1px solid rgba(255,255,255,0.04)', color: '#64748b', fontSize: '0.65rem', fontWeight: 600 }}>{ri + 1}</td>
                {row.slice(0, cols).map((cell, ci) => (
                  <td key={ci} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: '1px solid rgba(255,255,255,0.04)', padding: 0 }}>
                    <input value={cell} onChange={e => updateCell(ri, ci, e.target.value)}
                      style={{ width: '100%', border: 'none', outline: 'none', padding: '3px 6px', background: 'transparent', color: '#e2e8f0', fontSize: '0.72rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DocumentsDesktopApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { apiFetch } = useApi();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'documents' | 'spreadsheets'>('documents');
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/user-documents');
      setDocs(data);
    } catch {} finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (type: string) => {
    try {
      const doc = await apiFetch('/user-documents', {
        method: 'POST',
        body: JSON.stringify({ title: type === 'spreadsheet' ? 'جدول جديد' : 'مستند جديد', type }),
      });
      setEditingDoc(doc);
      load();
    } catch {}
  };

  const handleSave = async (title: string, content: string) => {
    if (!editingDoc) return;
    try {
      await apiFetch(`/user-documents/${editingDoc.id}`, {
        method: 'PUT', body: JSON.stringify({ title, content }),
      });
      setEditingDoc(null);
      load();
    } catch {}
  };

  const handleDelete = async (doc: Doc) => {
    try {
      await apiFetch(`/user-documents/${doc.id}`, { method: 'DELETE' });
      if (editingDoc?.id === doc.id) setEditingDoc(null);
      load();
    } catch {}
  };

  const filtered = docs.filter(d => tab === 'documents' ? d.type === 'document' : d.type === 'spreadsheet');

  if (editingDoc) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }}>
        {editingDoc.type === 'spreadsheet' ? (
          <SpreadsheetEditor doc={editingDoc} onSave={handleSave} onBack={() => setEditingDoc(null)} />
        ) : (
          <WordEditor doc={editingDoc} onSave={handleSave} onBack={() => setEditingDoc(null)} />
        )}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('documents')}
          style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: tab === 'documents' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)', color: tab === 'documents' ? '#818cf8' : '#94a3b8', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>
          <FileText size={11} style={{ marginLeft: 4 }} />مستندات
        </button>
        <button onClick={() => setTab('spreadsheets')}
          style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: tab === 'spreadsheets' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.04)', color: tab === 'spreadsheets' ? '#34d399' : '#94a3b8', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>
          <Table size={11} style={{ marginLeft: 4 }} />جداول
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => handleCreate(tab === 'spreadsheets' ? 'spreadsheet' : 'document')}
          style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={11} /> جديد
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: '0.8rem' }}>جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
            {tab === 'documents' ? <FileText size={28} style={{ opacity: 0.2, marginBottom: 6 }} /> : <Table size={28} style={{ opacity: 0.2, marginBottom: 6 }} />}
            <div style={{ fontSize: '0.75rem' }}>لا توجد {tab === 'documents' ? 'مستندات' : 'جداول'}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {filtered.map(doc => (
              <div key={doc.id} onClick={() => setEditingDoc(doc)}
                style={{
                  padding: 12, borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = ''; }}>
                <div style={{ textAlign: 'center', marginBottom: 6, opacity: 0.5 }}>
                  {doc.type === 'spreadsheet' ? <Table size={20} /> : <FileText size={20} />}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', textAlign: 'center' }}>
                  {formatDate(doc.updatedAt)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                  <button onClick={e => { e.stopPropagation(); handleDelete(doc); }}
                    style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
