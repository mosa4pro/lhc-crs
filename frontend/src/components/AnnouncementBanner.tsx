import React, { useState, useEffect, useCallback } from 'react';
import { useApi, useAuth } from '../context/AuthContext';
import { X, Bell, AlertTriangle, ChevronDown, Eye, ExternalLink } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormat';

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export const AnnouncementBanner = () => {
  const { apiFetch } = useApi();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [urgent, setUrgent] = useState<Announcement | null>(null);
  const [dismissedUrgent, setDismissedUrgent] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const data = await apiFetch('/announcements/active');
      const list = Array.isArray(data) ? data : [];
      setAnnouncements(list);

      // Show urgent (only one at a time, highest priority = first)
      const urgentList = list.filter((a: Announcement) => a.type === 'URGENT' && !a.read && !dismissedUrgent.has(a.id));
      if (urgentList.length > 0) setUrgent(urgentList[0]);
    } catch {}
  }, [apiFetch, dismissedUrgent]);

  useEffect(() => { fetchActive(); }, []);

  const markRead = async (id: number) => {
    try { await apiFetch(`/announcements/${id}/read`, { method: 'POST' }); } catch {}
  };

  const dismissUrgent = () => {
    if (!urgent) return;
    markRead(urgent.id);
    setDismissedUrgent(prev => new Set([...prev, urgent.id]));
    setUrgent(null);
  };

  // Normal announcements (non-urgent, unread)
  const normalAnnouncements = announcements.filter(a => a.type !== 'URGENT' || a.read);

  if (!urgent && normalAnnouncements.length === 0) return null;

  return (
    <>
      {/* URGENT — Full-screen overlay */}
      {urgent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            maxWidth: 560, width: '100%',
            background: 'linear-gradient(145deg, #1e293b, #0f172a)',
            borderRadius: 20, overflow: 'hidden',
            border: '1px solid rgba(239,68,68,0.3)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(239,68,68,0.1)',
            animation: 'slideInUp 0.3s ease-out',
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #dc2626, #ef4444)',
              padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={22} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
                  إعلان عاجل
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginTop: 2 }}>
                  {formatDateTime(urgent.createdAt)}
                </div>
              </div>
              <button onClick={dismissUrgent}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}>
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px 24px' }}>
              <h2 style={{ margin: '0 0 12px', color: '#f1f5f9', fontSize: '1.2rem', fontWeight: 700 }}>
                {urgent.title}
              </h2>
              <div style={{
                color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
              }}>
                {urgent.content}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={dismissUrgent}
                style={{
                  padding: '10px 28px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
                <Eye size={14} style={{ marginLeft: 6, display: 'inline' }} />
                تمت القراءة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normal announcements — banner bar */}
      {normalAnnouncements.length > 0 && (
        <div style={{
          marginBottom: 16,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {normalAnnouncements.map(a => (
            <div key={a.id} style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: 12, padding: '10px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Bell size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0', marginBottom: 2 }}>
                  {a.title}
                </div>
                <div style={{
                  fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: expandedId === a.id ? undefined : 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                }}>
                  {a.content}
                </div>
                {a.content.length > 120 && (
                  <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.75rem', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronDown size={12} style={{ transform: expandedId === a.id ? 'rotate(180deg)' : '' }} />
                    {expandedId === a.id ? 'أقل' : 'المزيد'}
                  </button>
                )}
              </div>
              <button onClick={() => markRead(a.id)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b',
                  width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: '0.7rem',
                }}
                title="إخفاء">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
