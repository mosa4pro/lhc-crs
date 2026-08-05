import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BedDouble, Plus, Edit2, Trash2, RefreshCw, Monitor, Users } from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PermissionGuard } from '../components/PermissionGuard';
import { LEARNING_TYPES } from '../components/LearningTypeBadge';

interface Room {
  id: string; name: string; type: string; capacity: number;
  floor?: string; building?: string; address?: string; learningType?: string;
  hasProjector?: boolean; hasAC?: boolean; notes?: string;
}

const ROOM_TYPES: Record<string, string> = {
  CLASSROOM: 'قاعة دراسية', LAB: 'مختبر', HALL: 'قاعة كبرى', OFFICE: 'مكتب', OTHER: 'أخرى'
};

export const AdminRoomsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState({ name: '', type: 'CLASSROOM', capacity: 30, floor: '', building: '', address: '', learningType: 'INSIDE_CENTER', hasProjector: false, hasAC: false, notes: '' });

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setRooms(await apiFetch('/rooms')); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'CLASSROOM', capacity: 30, floor: '', building: '', address: '', learningType: 'INSIDE_CENTER', hasProjector: false, hasAC: false, notes: '' });
    setShowModal(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({ name: r.name, type: r.type, capacity: r.capacity, floor: r.floor || '', building: r.building || '', address: r.address || '', learningType: r.learningType || 'INSIDE_CENTER', hasProjector: !!r.hasProjector, hasAC: !!r.hasAC, notes: r.notes || '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) return toast.error('تنبيه', 'اسم القاعة مطلوب');
    try {
      if (editing) { await apiFetch(`/rooms/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) }); toast.success('تم التعديل'); }
      else { await apiFetch('/rooms', { method: 'POST', body: JSON.stringify(form) }); toast.success('تمت الإضافة'); }
      setShowModal(false); await load();
    } catch (e: any) { toast.error('خطأ', e.message); }
  };

  const handleDelete = async (r: Room) => {
    if (!confirm('حذف هذه القاعة؟')) return;
    try { await apiFetch(`/rooms/${r.id}`, { method: 'DELETE' }); toast.success('تم الحذف'); await load(); }
    catch (e: any) { toast.error('خطأ', e.message); }
  };

  return (
    <PermissionGuard perm="admin.rooms.view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BedDouble size={22} color="var(--primary-color)" /> القاعات والمختبرات
          </h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="glass-btn secondary" onClick={load} disabled={isLoading}><RefreshCw size={16} className={isLoading ? 'spin' : ''} /></button>
            {hasPermission('admin.rooms.add') && <button className="glass-btn" onClick={openCreate}><Plus size={16} /> إضافة قاعة</button>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {rooms.map(r => (
            <div key={r.id} className="glass-panel" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name}</div>
                  <span className="badge secondary" style={{ fontSize: '0.75rem', marginTop: 4 }}>{ROOM_TYPES[r.type] || r.type}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {hasPermission('admin.rooms.edit') && <button className="glass-btn secondary sm" onClick={() => openEdit(r)}><Edit2 size={13}/></button>}
                  {hasPermission('admin.rooms.delete') && <button className="glass-btn secondary sm" onClick={() => handleDelete(r)} style={{ color: 'var(--danger)' }}><Trash2 size={13}/></button>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12}/> {r.capacity} مقعد
                </span>
                <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{LEARNING_TYPES[r.learningType || 'INSIDE_CENTER'] || r.learningType}</span>
                {r.building && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>🏛 {r.building}</span>}
                {r.floor && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📍 طابق {r.floor}</span>}
                {r.address && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📍 {r.address}</span>}
                {r.hasProjector && <span style={{ fontSize: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: 20 }}>📽 بروجكتور</span>}
                {r.hasAC && <span style={{ fontSize: '0.75rem', background: 'rgba(6,182,212,0.1)', color: 'var(--info)', padding: '2px 8px', borderRadius: 20 }}>❄️ تكييف</span>}
              </div>
            </div>
          ))}
          {rooms.length === 0 && !isLoading && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, opacity: 0.5 }}>لا توجد قاعات</div>
          )}
        </div>

        {showModal && createPortal(
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="glass-panel slide-in" style={{ width: 460, direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{editing ? 'تعديل القاعة' : 'إضافة قاعة جديدة'}</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)' }}>×</button>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                  <label className="form-label">اسم القاعة <span className="required-star">*</span></label>
                  <input className="glass-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">النوع</label>
                  <select className="glass-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">نوع التعلّم</label>
                  <select className="glass-input" value={form.learningType} onChange={e => setForm({ ...form, learningType: e.target.value })}>
                    {Object.entries(LEARNING_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                  <label className="form-label">العنوان</label>
                  <input type="text" className="glass-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">السعة (مقاعد)</label>
                  <input type="number" min="1" className="glass-input" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">المبنى</label>
                  <input className="glass-input" value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">الطابق</label>
                  <input className="glass-input" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 16, gridColumn: '1/-1', padding: '8px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasProjector} onChange={e => setForm({ ...form, hasProjector: e.target.checked })} />
                    📽 بروجكتور
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasAC} onChange={e => setForm({ ...form, hasAC: e.target.checked })} />
                    ❄️ تكييف
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="glass-btn" style={{ flex: 1 }} onClick={handleSubmit}>{editing ? 'حفظ التعديلات' : 'إضافة القاعة'}</button>
                <button className="glass-btn secondary" onClick={() => setShowModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </PermissionGuard>
  );
};
