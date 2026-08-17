import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { X, Search, ArrowLeft, Send, Check, CheckCheck, Users, Edit3, MessageCircle, Plus, Trash2, Smile, ChevronDown, Info, CheckCircle, Forward, Bell } from 'lucide-react';

/* ───────── helpers ───────── */
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return new Date(d).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

function lastSeenStr(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 7) return `منذ ${d} ي`;
  return new Date(dateStr).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return d.toLocaleDateString('ar-SA', { weekday: 'long' });
  return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getOtherParticipant(conv: any, userId: string | number | undefined) {
  const uid = Number(userId);
  return conv.participants?.find((p: any) => p.userId !== uid)?.user;
}

function getReaderNames(msg: any, userId?: string | number): string[] {
  const uid = userId !== undefined ? Number(userId) : undefined;
  return (msg.statuses || [])
    .filter((s: any) => s.userId !== uid && s.status === 'READ' && s.fullName)
    .map((s: any) => s.fullName);
}

const EMOJIS = ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','💪','🖕','✍️','🙏','💋','👄','👅','👀','👤','👥','💃','🕺','👶','👧','🧒','👦','👩','🧑','👨','👩‍🦱','👨‍🦱','👩‍🦰','👨‍🦰','👱‍♀️','👱‍♂️','👩‍🦳','👨‍🦳','👩‍🦲','👨‍🦲','🧔','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🙌','🤝','💅','👂','👃','👣','❤️','🧡','💛','💚','💙','💜','🖤','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','🎉','🎊','🎈','🎁','🎀','🕊','🔥','💫','⭐','🌟','✨','⚡','☄','💥','💦','💨','💯','🔞','💢','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎','⚜️','🔰','🔱','🏅','🥇','🥈','🥉','⚽','⚾','🏀','🏐','🏈','🎾','🎲','♟','🏎','🚑','🚒','🚓','🚕','🚗','🚙','🚌','🚎','🏍','🛵','🚲','🛴','🚁','✈️','🚀','🛰','⌚️','📱','💻','⌨️','🖥','🖨','🕹','📀','💿','📸','📹','📞','☎️','📺','📻','⏰','🕰','⌛️','⏳','🔋','🔌','💡','🔦','🧯','🗑','🔪','🔧','🔨','⚒','🛠','🔩','⚙','🧲','💣','🧨','🔬','🔭','💉','💊','🩺','🚪','🛏','🛋','🪑','🚿','🛁','🧴','🧹','🧺','🧻','🪣','🧽','🧼','🪒','👓','🥽','🥼','🦺','👔','👕','👖','🧣','🧤','🧥','🧦','👗','👘','👙','👚','👛','👜','👝','🎒','💼','👞','👟','👠','👡','👢','👑','👒','🎩','🎓','💄','💍','🌂','🎵','🎶','🎼','🎤','🎧','🎷','🎸','🎹','🎺','🎻','🥁','🎬','🎮','👾','🎯','🎰','♠️','♥️','♣️','♦️','🖼','🎨','🎭','🎪'];

const TypingDots = () => (
  <div style={{ display: 'flex', gap: 4, padding: '4px 2px', alignItems: 'center' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
        opacity: 0.5, animation: `wadot 1.4s ${i * 0.2}s infinite`,
      }} />
    ))}
  </div>
);

/* ───────── clickable content ───────── */
const STUDENT_LINK_PREFIX = '🔗 STU:';
const STUDENT_SHARE_PREFIX = '📋 ملف طالب:';

function composeShareMessage(s: { id: number; fullNameAr: string }) {
  return `${STUDENT_SHARE_PREFIX} ${s.fullNameAr}\n${STUDENT_LINK_PREFIX}${s.id}`;
}

function parseStudentShare(text: string): { name: string; id: number } | null {
  const lines = text.split('\n');
  if (lines.length < 2) return null;
  const nameLine = lines[0].trim();
  const linkLine = lines[1].trim();
  if (!nameLine.startsWith(STUDENT_SHARE_PREFIX)) return null;
  if (!linkLine.startsWith(STUDENT_LINK_PREFIX)) return null;
  const name = nameLine.slice(STUDENT_SHARE_PREFIX.length).trim();
  const idStr = linkLine.slice(STUDENT_LINK_PREFIX.length).trim();
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return null;
  return { name, id };
}

function StudentShareCard({ name, id, isMine }: { name: string; id: number; isMine: boolean }) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `/student-profile?shareId=${id}`;
  };
  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--primary-color)', marginBottom: 6, letterSpacing: 0.5 }}>
        📋 ملف طالب
      </div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
        {name}
      </div>
      <div onClick={handleClick} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: isMine ? 'rgba(255,255,255,0.2)' : '#25D366',
        color: '#fff', padding: '7px 16px', borderRadius: 20,
        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s', userSelect: 'none',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = isMine ? 'rgba(255,255,255,0.3)' : '#128C7E'; }}
        onMouseLeave={e => { e.currentTarget.style.background = isMine ? 'rgba(255,255,255,0.2)' : '#25D366'; }}>
        <span>عرض الملف الشخصي</span>
        <span style={{ fontSize: '0.9rem' }}>←</span>
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches: { index: number; len: number; node: React.ReactNode }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(urlRegex.source, 'g');
  while ((m = re.exec(text)) !== null) {
    matches.push({ index: m.index, len: m[0].length, node: <a href={m[0]} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', opacity: 0.85 }}>{m[0]}</a> });
  }
  if (matches.length === 0) return <>{text}</>;
  matches.sort((a, b) => a.index - b.index);
  for (const match of matches) {
    if (match.index > lastIndex) parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    parts.push(<React.Fragment key={`m${match.index}`}>{match.node}</React.Fragment>);
    lastIndex = match.index + match.len;
  }
  if (lastIndex < text.length) parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>);
  return <>{parts}</>;
}

function imgUrl(p: string | undefined | null) {
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (p.startsWith('/uploads/')) return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/files/${p.replace('/uploads/', '')}`;
  return p;
}

const Avtr = React.memo(({ name, type, size = 40, online, lastSeen, image }: { name?: string; type?: string; size?: number; online?: boolean; lastSeen?: string; image?: string | null }) => (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: image
        ? 'none'
        : type === 'GROUP'
          ? 'linear-gradient(135deg, #667781, #8696a0)'
          : 'linear-gradient(135deg, #25D366, #128C7E)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600, lineHeight: 1,
    }}>
      {image ? (
        <img src={imgUrl(image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : type === 'GROUP' ? (
        <Users size={size * 0.45} />
      ) : (
        name?.charAt(0) || '?'
      )}
    </div>
    {online !== undefined && (
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: size * 0.32, height: size * 0.32, borderRadius: '50%',
        border: `2px solid var(--card-bg)`,
        background: online ? '#25D366' : '#a0a0a0',
        boxShadow: '0 0 2px rgba(0,0,0,0.2)',
      }} />
    )}
  </div>
));

interface Msg { id: number; conversationId: number; senderId: number; content: string | null; imageUrl: string | null; createdAt: string; sender: { id: number; fullName: string }; statuses?: any[]; }

export default function ChatSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const {
    socket, connected, conversations, onlineUsers, lastSeenMap, typingUsers,
    setActiveConv, activeConv, messages, loadMessages, sendMessage, deleteMessage,
    startConversation, createGroup, updateGroup, deleteGroup,
    availableUsers, loadAvailableUsers, hasMoreMessages, bizzAlert,
    pendingShareStudent, setPendingShareStudent, bizzFromName, bizzLimitMsg, bizzTimerRef,
  } = useChat();

  const [view, setView] = useState<'list' | 'chat' | 'new' | 'group' | 'groupinfo'>('list');
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState<Set<number>>(new Set());
  const [msgInfo, setMsgInfo] = useState<Msg | null>(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [swipedMsg, setSwipedMsg] = useState<number | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
  const [sharingConvId, setSharingConvId] = useState(false);
  const [shareSent, setShareSent] = useState(false);
  const [bizzToast, setBizzToast] = useState<string | null>(null);
  const swipeTrackRef = useRef<{ msgId: number; startX: number; delta: number; el: HTMLElement | null }>({ msgId: 0, startX: 0, delta: 0, el: null });
  const touchMovedRef = useRef(false);
  const selectModeRef = useRef(false);
  selectModeRef.current = selectMode;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const pageRef = useRef(1);
  const activeConvRef = useRef<number | null>(null);
  activeConvRef.current = activeConv;

  // Switch to list view when sharing
  useEffect(() => {
    if (pendingShareStudent) setView('list');
  }, [pendingShareStudent]);

  const handleShareClick = async (conv: any) => {
    if (!pendingShareStudent || sharingConvId) return;
    setSharingConvId(true);
    try {
      const msg = composeShareMessage(pendingShareStudent);
      let targetConv = conv;
      if (conv.type === 'PRIVATE' && !conv.lastMessage) {
        // fresh conversation — use startConversation which returns the conv with id
        const otherP = conv.participants?.find((p: any) => p.userId !== user?.id);
        if (otherP) {
          const data = await startConversation(otherP.user.id);
          targetConv = data.conversation;
        }
      }
      sendMessage(targetConv.id, msg);
      // Show success feedback
      setShareSent(true);
      setTimeout(() => {
        setPendingShareStudent(null);
        setShareSent(false);
      }, 1200);
    } catch {
      setPendingShareStudent(null);
    }
    setSharingConvId(false);
  };

  const ac = conversations.find(c => c.id === activeConv);
  const ot = ac ? getOtherParticipant(ac, user?.id) : null;

  // Bizz toast for recipient (shows regardless of which conversation is open)
  useEffect(() => {
    if (bizzFromName) {
      setBizzToast(`🔔 <strong>${bizzFromName}</strong> قام بنكزك`);
      setTimeout(() => setBizzToast(null), 3500);
    }
  }, [bizzFromName]);

  // Bizz limit toast
  useEffect(() => {
    if (bizzLimitMsg) {
      setBizzToast(`⏱️ ${bizzLimitMsg}`);
      clearTimeout(bizzTimerRef.current);
      bizzTimerRef.current = setTimeout(() => { setBizzToast(null); }, 3000);
    }
  }, [bizzLimitMsg]);

  // Bizz sent confirmation (sender)
  const handleBizzClick = useCallback(() => {
    if (!socket || !activeConv) return;
    const other = ot;
    socket.emit('bizz:send', { conversationId: activeConv });
    setBizzToast(`✅ نكزت ${other ? other.fullName : ''}`);
    setTimeout(() => setBizzToast(null), 2500);
  }, [socket, activeConv, ot]);
  const otherUser = ac?.participants?.find((p: any) => p.userId !== user?.id)?.user;
  const otherLastSeen = otherUser?.lastSeenAt || (ot && lastSeenMap.get(ot.id)) || undefined;
  const ty = activeConv ? (typingUsers.get(activeConv) || []) : [];
  const isOnline = ot ? onlineUsers.has(ot.id) : false;
  const isGroup = ac?.type === 'GROUP';
  const isGroupAdmin = isGroup && ac?.createdById === Number(user?.id);

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.12s', color: 'var(--text-muted)',
  };

  const typingText = ty.length > 0
    ? ty.map(t => t.fullName).join('، ') + (ty.length === 1 ? ' يكتب...' : ' يكتبون...')
    : '';

  /* ── effects ── */
  useEffect(() => {
    if (activeConv) { pageRef.current = 1; loadMessages(activeConv); socket?.emit('conversation:join', activeConv); }
    setSwipedMsg(null);
    setSelectMode(false);
    setSelectedMsgs(new Set());
  }, [activeConv]);

  useEffect(() => {
    if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 300);
  }, [view]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── swipe: non-passive touch listeners ── */

  /* ── swipe: non-passive touch listeners ── */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onStart = (e: TouchEvent) => {
      const el = (e.target as HTMLElement).closest('[data-msg-id]') as HTMLElement | null;
      if (!el || selectModeRef.current) return;
      // Close any previously open swipe
      const prev = document.querySelector('.msg-swipe-el.swiped');
      if (prev) prev.classList.remove('swiped');
      setSwipedMsg(null);
      swipeTrackRef.current = { msgId: Number(el.dataset.msgId), startX: e.touches[0].clientX, delta: 0, el };
      touchMovedRef.current = false;
    };
    const onMove = (e: TouchEvent) => {
      const st = swipeTrackRef.current;
      if (!st || !st.el) return;
      const isSent = st.el.dataset.isMine === '1';
      const raw = e.touches[0].clientX - st.startX;
      // sent → swipe right (positive), received → swipe left (negative)
      let d: number;
      if (isSent) {
        if (raw < 5) return;
        d = Math.min(raw, 140);
      } else {
        if (raw > -5) return;
        d = Math.min(-raw, 140);
      }
      e.preventDefault();
      touchMovedRef.current = true;
      st.delta = d;
      st.el.style.transition = 'none';
      st.el.style.transform = `translateX(${d * (isSent ? 1 : -1)}px)`;
    };
    const onEnd = () => {
      const st = swipeTrackRef.current;
      if (!st || !st.el) return;
      if (st.delta > 70) {
        setSwipedMsg(st.msgId);
        st.el.classList.add('swiped');
      } else {
        setSwipedMsg(null);
        st.el.classList.remove('swiped');
      }
      st.el.style.transition = '';
      st.el.style.transform = '';
      swipeTrackRef.current = { msgId: 0, startX: 0, delta: 0, el: null };
    };
    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
    };
  }, [activeConv]);

  /* Clear inline transform when swipedMsg changes so CSS class takes over smoothly */
  useEffect(() => {
    document.querySelectorAll('.msg-swipe-el').forEach(el => {
      (el as HTMLElement).style.transition = '';
      (el as HTMLElement).style.transform = '';
    });
    // sync swiped class with state
    document.querySelectorAll('.msg-swipe-el.swiped').forEach(el => {
      if (swipedMsg === null || Number((el as HTMLElement).dataset.msgId) !== swipedMsg) {
        el.classList.remove('swiped');
      }
    });
  }, [swipedMsg]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleTyping = useCallback(() => {
    if (!socket?.connected || !activeConv) return;
    socket.emit('typing:start', { conversationId: activeConv });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket.emit('typing:stop', { conversationId: activeConv }), 2000);
  }, [socket, activeConv]);

  const handleSend = () => {
    if (!text.trim() || !activeConv) return;
    sendMessage(activeConv, text.trim());
    setText('');
    setShowEmoji(false);
    socket?.emit('typing:stop', { conversationId: activeConv });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const insertEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSelectMsg = (id: number) => {
    setSelectedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (!selectMode) return;
    for (const id of selectedMsgs) deleteMessage(activeConv!, id);
    setSelectedMsgs(new Set());
    setSelectMode(false);
  };

  const filteredList = conversations.filter(c => {
    const u = getOtherParticipant(c, user?.id);
    return (c.type === 'GROUP' ? (c.name || '') : (u?.fullName || '')).toLowerCase().includes(search.toLowerCase());
  });

  const availableFiltered = availableUsers.filter(u => u.id !== Number(user?.id) && u.fullName.includes(search));

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: Msg[] }[] = [];
    let currentDate = '';
    for (const m of messages) {
      const d = new Date(m.createdAt).toDateString();
      if (d !== currentDate) { currentDate = d; groups.push({ date: m.createdAt, msgs: [] }); }
      groups[groups.length - 1].msgs.push(m);
    }
    return groups;
  }, [messages]);

  /* ── WhatsApp-style: show avatar only on first msg of each consecutive block ── */
  function showAvatarForMsg(index: number, msgs: Msg[]): boolean {
    if (index === 0) return true;
    return msgs[index].senderId !== msgs[index - 1].senderId;
  }

  return (
    <div style={{
      position: 'absolute', left: 0, top: 52, bottom: 0, width: 400, zIndex: 20,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--card-bg)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      borderLeft: '1px solid var(--card-border)',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: open ? '4px 0 32px rgba(0,0,0,0.15)' : 'none',
      fontFamily: 'Cairo, sans-serif',
    }}>
      {/* ====================== LIST VIEW ====================== */}
      {view === 'list' && (
        <>
          <div style={{
            padding: '8px 12px', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', minHeight: 50,
            borderBottom: '1px solid var(--card-border)',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={20} color="#25D366" />
              الدردشات
            </span>
            <div style={{ display: 'flex', gap: 1 }}>
              {user?.role === 'ADMIN' && (
                <div onClick={() => { loadAvailableUsers(); setView('group'); setSearch(''); }}
                  style={iconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Users size={17} />
                </div>
              )}
              <div onClick={() => { loadAvailableUsers(); setView('new'); setSearch(''); }}
                style={iconBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Plus size={18} />
              </div>
              <div onClick={onClose}
                style={iconBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={17} />
              </div>
            </div>
          </div>
          {pendingShareStudent && (
            <div className="glass-panel" style={{ padding: '12px 14px', margin: '6px 8px', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary-color)' }}>📋 مشاركة ملف طالب</span>
                {!shareSent && (
                  <div onClick={() => setPendingShareStudent(null)} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--glass-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>✕</div>
                )}
              </div>
              {shareSent ? (
                <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--success-color, #4caf50)', fontWeight: 700, fontSize: '0.9rem' }}>
                  ✓ تم الإرسال
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>👤 {pendingShareStudent.fullNameAr}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>اختر محادثة للإرسال</div>
                </>
              )}
            </div>
          )}
          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass-bg)', borderRadius: 8, padding: '0 10px' }}>
              <Search size={15} color="var(--text-muted)" />
              <input placeholder="ابحث في المحادثات..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '7px 0', fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0' }}>
            {filteredList.length === 0 && !pendingShareStudent && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>لا توجد محادثات</div>
            )}
            {filteredList.map(c => {
              const u = getOtherParticipant(c, user?.id);
              const n = c.type === 'GROUP' ? (c.name || 'مجموعة') : (u?.fullName || 'مستخدم');
              const o = u ? onlineUsers.has(u.id) : false;
              const isSharing = !!pendingShareStudent;
              return (
                <div key={c.id} onClick={() => { if (isSharing) { handleShareClick(c); } else { setActiveConv(c.id); setView('chat'); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--card-border)', opacity: isSharing && sharingConvId ? 0.5 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Avtr name={n} type={c.type} size={44} online={c.type === 'PRIVATE' ? o : undefined} image={u?.profileImage} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{n}</span>
                      {c.lastMessage && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(c.lastMessage.createdAt)}</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: '0.73rem', color: c.unread > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
                          fontWeight: c.unread > 0 ? 500 : 400,
                        }}>
                          {c.type === 'GROUP' && c.lastMessage
                            ? `${c.lastMessage.sender.fullName}: ${c.lastMessage.content || 'صورة'}`
                            : c.lastMessage?.content || 'بدون رسائل'}
                        </span>
                        {c.type === 'PRIVATE' && u?.aboutStatus && !c.lastMessage && (
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.6 }}>
                            {u.aboutStatus}
                          </div>
                        )}
                      </div>
                      {c.unread > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, lineHeight: '20px', fontSize: '0.55rem', fontWeight: 800, textAlign: 'center', flexShrink: 0 }}>
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ====================== CHAT VIEW ====================== */}
      {view === 'chat' && ac && (
        <>
          {/* ── Header ── */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            minHeight: 52, borderBottom: '1px solid var(--card-border)',
            animation: bizzFromName ? 'shake 0.5s ease' : 'none',
          }}>
            <div onClick={() => { setActiveConv(null); setView('list'); setText(''); setSelectMode(false); setSelectedMsgs(new Set()); setMsgInfo(null); }}
              style={iconBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ArrowLeft size={18} />
            </div>
            <div onClick={() => { if (isGroup) { setEditGroupName(ac.name || ''); setView('groupinfo'); } }}
              style={{ cursor: isGroup ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <Avtr name={ac.type === 'GROUP' ? (ac.name || '') : (ot?.fullName || '')} type={ac.type} size={36}
                online={ac.type === 'PRIVATE' ? isOnline : undefined}
                image={ac.type === 'PRIVATE' ? ot?.profileImage : undefined} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ac.type === 'GROUP' ? (ac.name || 'المجموعة') : (ot?.fullName || '')}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', minHeight: 14, marginTop: 0 }}>
                  {typingText ? (
                    <span style={{ color: '#25D366', fontWeight: 500 }}>{typingText}</span>
                  ) : ac.type === 'PRIVATE' ? (
                    isOnline
                      ? <span style={{ color: '#25D366' }}>متصل</span>
                      : <span>{otherLastSeen ? `آخر ظهور ${lastSeenStr(otherLastSeen)}` : ''}</span>
                  ) : (
                    <span style={{ color: '#25D366', fontWeight: 500 }}>{`${ac.participants?.length || 0} مشارك`}</span>
                  )}
                  {ac.type === 'PRIVATE' && ot?.aboutStatus && !typingText && (
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.5, marginTop: 1 }}>
                      {ot.aboutStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {selectMode ? (
              <div style={{ display: 'flex', gap: 2 }}>
                <div onClick={handleBulkDelete} style={{ ...iconBtn, color: '#e74c3c' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Trash2 size={15} />
                </div>
                <div onClick={() => { setSelectMode(false); setSelectedMsgs(new Set()); }} style={iconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={15} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 2 }}>
                <div onClick={handleBizzClick}
                  style={{ ...iconBtn, color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="نكز (Bizz)">
                  <Bell size={15} />
                </div>
                <div onClick={onClose} style={iconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={16} />
                </div>
              </div>
            )}
          </div>

          {/* ── Messages ── */}
          <div ref={scrollRef} onScroll={handleScroll}
            onClick={() => { if (touchMovedRef.current) { touchMovedRef.current = false; return; } setSwipedMsg(null); }}
            style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative',
            background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c0c0c0' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundColor: 'var(--glass-bg)',
            backgroundBlendMode: 'overlay',
            animation: bizzFromName ? 'shake 0.5s ease' : 'none',
          }}>
            {hasMoreMessages && (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <span onClick={() => { pageRef.current += 1; loadMessages(activeConv!, pageRef.current); }}
                  style={{ fontSize: '0.68rem', color: '#25D366', cursor: 'pointer', fontWeight: 600 }}>عرض الرسائل السابقة</span>
              </div>
            )}
            {bizzToast && (
              <div style={{
                position: 'sticky', top: 4, zIndex: 25, margin: '4px 12px', direction: 'ltr',
                background: bizzFromName
                  ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                  : bizzLimitMsg
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: '#fff', borderRadius: 12, padding: '10px 16px',
                fontSize: '0.82rem', fontWeight: 600, textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                animation: 'waIn 0.3s ease',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ fontSize: '1.1rem' }}>
                  {bizzFromName ? '🔔' : bizzLimitMsg ? '⏱️' : '✅'}
                </span>
                <span dangerouslySetInnerHTML={{ __html: bizzToast }} />
              </div>
            )}
            <div style={{ padding: '6px 0' }}>
              {groupedMessages.map(group => (
                <div key={group.date}>
                  <div style={{ textAlign: 'center', margin: '10px 0 18px' }}>
                    <span style={{
                      display: 'inline-block', padding: '4px 14px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
                      fontSize: '0.65rem', fontWeight: 500, color: '#667781',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    }}>
                      {formatDateHeader(group.date)}
                    </span>
                  </div>

                  {group.msgs.map((m, idx) => {
                    const isMine = m.senderId === Number(user?.id);
                    const isTemp = m.id < 0;
                    const isDeleted = m.content === null && m.imageUrl === null;
                    const hasImage = !!m.imageUrl;
                    const sel = selectMode && selectedMsgs.has(m.id);
                    const firstInBlock = showAvatarForMsg(idx, group.msgs);
                    const readers = getReaderNames(m, user?.id);

                    const isBizz = m.content?.startsWith('🚀');

                    if (isBizz) {
                      return (
                        <div key={m.id} style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                          <span style={{
                            display: 'inline-block', padding: '4px 14px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)',
                            fontSize: '0.72rem', fontWeight: 600, color: '#667781',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          }}>
                            {m.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id} style={{
                        overflow: 'hidden', position: 'relative', borderRadius: 8,
                        marginBottom: 5, marginTop: 0,
                      }}>
                        {/* Actions panel — left for sent, right for received */}
                        <div style={{
                          position: 'absolute', top: 0, bottom: 0,
                          [isMine ? 'left' : 'right']: 0,
                          display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px',
                          opacity: swipedMsg === m.id ? 1 : 0,
                          transition: 'opacity 0.15s ease',
                          pointerEvents: swipedMsg === m.id ? 'auto' : 'none',
                        }}>
                          {/* Forward — always available */}
                          {!isDeleted && (
                            <div onClick={(e) => { e.stopPropagation(); setForwardMsg(m); setSwipedMsg(null); }}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: '#128C7E', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 2px 8px rgba(18,140,126,0.3)',
                              }}>
                              <Forward size={14} />
                            </div>
                          )}
                          {/* Info — who read */}
                          {readers.length > 0 && (
                            <div onClick={(e) => { e.stopPropagation(); setMsgInfo(msgInfo?.id === m.id ? null : m); setSwipedMsg(null); }}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: '#25D366', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
                              }}>
                              <Info size={16} />
                            </div>
                          )}
                          {/* Delete — only mine */}
                          {isMine && !isDeleted && (
                            <div onClick={(e) => { e.stopPropagation(); deleteMessage(activeConv!, m.id); setSwipedMsg(null); }}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: '#e74c3c', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 2px 8px rgba(231,76,60,0.3)',
                              }}>
                              <Trash2 size={16} />
                            </div>
                          )}
                        </div>

                        {/* Sliding message */}
                        <div
                          data-msg-id={m.id}
                          data-is-mine={isMine ? '1' : '0'}
                          className={`msg-swipe-el${swipedMsg === m.id ? ' swiped' : ''}`}
                          onClick={(e) => {
                            if (touchMovedRef.current) { touchMovedRef.current = false; e.stopPropagation(); return; }
                            if (swipedMsg === m.id) { setSwipedMsg(null); e.stopPropagation(); return; }
                            if (swipedMsg !== null) setSwipedMsg(null); // close other swipe
                            selectMode && handleSelectMsg(m.id);
                          }}
                          onDoubleClick={() => { if (!selectMode && !isDeleted && isMine) { setSelectMode(true); setSelectedMsgs(new Set([m.id])); } }}
                          style={{
                            display: 'flex', alignItems: 'flex-end', gap: 6,
                            justifyContent: isMine ? 'flex-start' : 'flex-end',
                            padding: '0 12px',
                            opacity: isTemp ? 0.55 : 1,
                            animation: isTemp ? 'none' : 'waIn 0.2s ease',
                            background: 'transparent',
                            position: 'relative',
                            zIndex: 1,
                          }}>

                        {/* Select checkbox */}
                        {selectMode && (
                          <div onClick={(e) => { e.stopPropagation(); handleSelectMsg(m.id); }}
                            style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${sel ? '#25D366' : '#aaa'}`,
                              background: sel ? '#25D366' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.12s', cursor: 'pointer',
                            }}>
                            {sel && <Check size={11} color="#fff" />}
                          </div>
                        )}

                        {/* Bubble */}
                        <div style={{ maxWidth: '80%', position: 'relative' }}>
                          {/* Sender name above bubble (groups, first in block) */}
                          {!isMine && isGroup && firstInBlock && m.content && !isDeleted && (
                            <div style={{
                              fontSize: '0.6rem', fontWeight: 700, color: '#25D366',
                              marginBottom: 1, marginRight: 2,
                            }}>
                              {m.sender.fullName}
                            </div>
                          )}

                          <div style={{
                            position: 'relative',
                            background: isMine ? '#25D366' : '#fff',
                            color: isMine ? '#fff' : '#111',
                            padding: hasImage ? '4px' : '6px 10px 5px',
                            borderRadius: isMine ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                            fontSize: '0.82rem', lineHeight: 1.55, wordBreak: 'break-word',
                            boxShadow: isMine
                              ? '0 1px 1px rgba(0,0,0,0.06)'
                              : '0 1px 1px rgba(0,0,0,0.02), 0 0 0 1px rgba(0,0,0,0.06)',
                          }}>
                            {hasImage && (
                              <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: m.content ? 4 : 0 }}>
                                <img src={m.imageUrl!} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', borderRadius: 6 }} />
                              </div>
                            )}
                            {m.content && (
                              <div style={{ padding: m.content && !hasImage ? '0 2px' : '2px 4px', fontStyle: isDeleted ? 'italic' : 'normal', opacity: isDeleted ? 0.55 : 1 }}>
                                {isDeleted ? 'تم حذف الرسالة' : (() => {
                                  const share = parseStudentShare(m.content);
                                  if (share) return <StudentShareCard name={share.name} id={share.id} isMine={isMine} />;
                                  return <MessageContent text={m.content} />;
                                })()}
                              </div>
                            )}
                            {/* Time + status */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              justifyContent: 'flex-end', marginTop: hasImage && m.content ? 2 : 0,
                              padding: hasImage && !m.content ? '0 4px 2px' : '1px 2px 0',
                              direction: 'ltr', userSelect: 'none', minHeight: 13,
                            }}>
                              <span style={{
                                fontSize: '0.52rem',
                                color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                                lineHeight: '12px', whiteSpace: 'nowrap',
                              }}>
                                {new Date(m.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isMine && !isDeleted && (
                                readers.length > 0
                                  ? <CheckCheck size={10} color="#53bdeb" />
                                  : (m.statuses || []).some((s: any) => s.userId !== user?.id && s.status === 'DELIVERED')
                                    ? <CheckCheck size={10} color="rgba(255,255,255,0.4)" />
                                    : <Check size={10} color="rgba(255,255,255,0.4)" />
                              )}
                            </div>
                          </div>

                          {/* Read receipts row — visible always if read */}
                          {isMine && readers.length > 0 && (
                            <div
                              onClick={() => setMsgInfo(msgInfo?.id === m.id ? null : m)}
                              style={{
                                fontSize: '0.55rem', color: '#53bdeb', marginTop: 1,
                                cursor: 'pointer', textAlign: 'left' as const,
                                display: 'flex', alignItems: 'center', gap: 3,
                              }}>
                              <CheckCheck size={9} />
                              <span>
                                {isGroup
                                  ? `مقروءة من ${readers[0]}${readers.length > 1 ? ` و ${readers.length - 1} آخرين` : ''}`
                                  : 'تمت القراءة'}
                              </span>
                            </div>
                          )}

                          {/* Message info popup (who read) */}
                          {msgInfo?.id === m.id && readers.length > 0 && (
                            <div style={{
                              position: 'absolute', bottom: '100%', left: 0,
                              background: 'var(--card-bg)', backdropFilter: 'var(--glass-blur)',
                              border: '1px solid var(--card-border)', borderRadius: 8,
                              padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              zIndex: 20, minWidth: 150, marginBottom: 4,
                            }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>معلومات الرسالة</div>
                              {m.statuses?.filter((s: any) => s.userId !== user?.id).map((s: any) => (
                                <div key={s.userId} style={{
                                  display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
                                  fontSize: '0.65rem', color: 'var(--text-secondary)',
                                }}>
                                  <CheckCircle size={10} color={s.status === 'READ' ? '#53bdeb' : s.status === 'DELIVERED' ? '#bbb' : '#ddd'} />
                                  <span>{s.fullName || `مستخدم ${s.userId}`}</span>
                                  <span style={{ marginRight: 'auto', fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                                    {s.status === 'READ' && s.readAt ? new Date(s.readAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : s.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>

                        {/* Avatar — right side for received messages in groups (after bubble) */}
                        {!isMine && isGroup && (
                          <div style={{
                            width: 28, flexShrink: 0, alignSelf: 'flex-end',
                            visibility: firstInBlock ? 'visible' : 'hidden',
                          }}>
                            {firstInBlock && <Avtr name={m.sender.fullName} size={28} image={(m.sender as any)?.profileImage} />}
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Typing */}
              {ty.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px', marginBottom: 4 }}>
                  <div style={{
                    background: '#fff', borderRadius: '8px 8px 8px 2px', padding: '4px 10px',
                    border: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 1px 1px rgba(0,0,0,0.02)',
                  }}>
                    <TypingDots />
                    {ty.length > 0 && (
                      <span style={{ fontSize: '0.6rem', color: '#25D366', fontWeight: 600 }}>
                        {ty.map(t => t.fullName).join('، ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} style={{ height: 1 }} />
            </div>

            {/* Scroll to bottom */}
            {showScrollBtn && (
              <div onClick={scrollToBottom}
                style={{
                  position: 'sticky', bottom: 10, left: '50%', transform: 'translateX(50%)',
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--card-bg)', backdropFilter: 'var(--glass-blur)',
                  border: '1px solid var(--card-border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 10, color: 'var(--text-muted)',
                  animation: 'waIn 0.2s ease',
                }}>
                <ChevronDown size={16} />
              </div>
            )}
          </div>

          {/* ── Emoji picker ── */}
          {showEmoji && (
            <div style={{
              borderTop: '1px solid var(--card-border)',
              background: 'var(--card-bg)', backdropFilter: 'var(--glass-blur)',
              maxHeight: 200, overflowY: 'auto', padding: '6px 8px',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {EMOJIS.map((e, i) => (
                  <span key={i} onClick={() => insertEmoji(e)}
                    style={{ cursor: 'pointer', fontSize: '1.3rem', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: 'all 0.1s' }}
                    onMouseEnter={e2 => e2.currentTarget.style.background = 'var(--glass-bg-hover)'}
                    onMouseLeave={e2 => e2.currentTarget.style.background = 'transparent'}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Input ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 6, padding: '5px 8px', flexShrink: 0,
            borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)',
          }}>
            <div onClick={() => setShowEmoji(!showEmoji)}
              style={{ ...iconBtn, color: showEmoji ? '#25D366' : 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Smile size={18} />
            </div>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: 'var(--glass-bg)', borderRadius: 8, padding: '0 10px',
              border: '1px solid var(--card-border)',
            }}>
              <textarea ref={inputRef} value={text}
                onChange={e => { setText(e.target.value); handleTyping(); }}
                onKeyDown={handleKey}
                placeholder="رسالة" rows={1}
                style={{
                  flex: 1, border: 'none', outline: 'none', resize: 'none',
                  padding: '9px 0', fontSize: '0.84rem', fontFamily: 'inherit',
                  background: 'transparent', color: 'var(--text-primary)', maxHeight: 80, lineHeight: 1.5,
                }} />
            </div>
            <div onClick={text.trim() ? handleSend : undefined}
              style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: text.trim() ? '#25D366' : 'var(--glass-bg)',
                color: text.trim() ? '#fff' : 'var(--text-muted)',
                cursor: text.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s',
                boxShadow: text.trim() ? '0 2px 6px rgba(37,211,102,0.3)' : 'none',
              }}>
              <Send size={16} />
            </div>
          </div>
        </>
      )}

      {/* ====================== GROUP INFO VIEW ====================== */}
      {view === 'groupinfo' && ac && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '8px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--card-border)', minHeight: 50 }}>
            <div onClick={() => { setView('chat'); setEditingGroup(false); }}
              style={iconBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ArrowLeft size={18} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>معلومات المجموعة</span>
          </div>

          {/* Group avatar & name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', borderBottom: '1px solid var(--card-border)' }}>
            <Avtr name={ac.name || ''} type="GROUP" size={64} />
            {editingGroup ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, width: '100%', maxWidth: 240 }}>
                <input value={editGroupName}
                  onChange={e => setEditGroupName(e.target.value)}
                  style={{
                    flex: 1, border: '1px solid var(--card-border)', borderRadius: 6, padding: '6px 10px',
                    fontSize: '0.82rem', background: 'var(--glass-bg)', color: 'var(--text-primary)',
                    fontFamily: 'inherit', outline: 'none', textAlign: 'center',
                  }} />
                <div onClick={async () => { await updateGroup(ac.id, editGroupName); setEditingGroup(false); }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, background: '#25D366', color: '#fff',
                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>حفظ</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>{ac.name || 'المجموعة'}</div>
            )}
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {ac.participants?.length || 0} مشارك
            </div>
          </div>

          {/* Participants */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: '0.72rem', color: '#25D366' }}>
              المشاركون
            </div>
            {ac.participants?.map((p: any) => {
              const isAdmin = p.userId === ac.createdById;
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderBottom: '1px solid var(--card-border)',
                }}>
                  <Avtr name={p.user.fullName} size={36} online={onlineUsers.has(p.userId)} image={p.user.profileImage} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.user.fullName}
                      {isAdmin && <span style={{ fontSize: '0.55rem', color: '#25D366', fontWeight: 600 }}>مشرف</span>}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      {p.user.role === 'ADMIN' ? 'مشرف' : p.user.role === 'SUPERVISOR' ? 'مشرف عام' : p.user.role === 'EMPLOYEE' ? 'موظف' : p.user.role}
                      {onlineUsers.has(p.userId) ? ' • متصل' : p.user.lastSeenAt ? ` • آخر ظهور ${lastSeenStr(p.user.lastSeenAt)}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Admin actions */}
          {isGroupAdmin && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div onClick={() => setEditingGroup(!editingGroup)}
                style={{
                  padding: '9px', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: '0.82rem',
                  background: 'var(--glass-bg)', color: '#25D366', cursor: 'pointer',
                  border: '1px solid var(--card-border)',
                }}>
                <Edit3 size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                تعديل الاسم
              </div>
              <div onClick={async () => {
                if (confirm('هل أنت متأكد من حذف المجموعة؟')) {
                  await deleteGroup(ac.id);
                  setView('list');
                }
              }}
                style={{
                  padding: '9px', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: '0.82rem',
                  background: 'var(--glass-bg)', color: '#e74c3c', cursor: 'pointer',
                  border: '1px solid var(--card-border)',
                }}>
                <Trash2 size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                حذف المجموعة
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================== NEW / GROUP VIEW ====================== */}
      {(view === 'new' || view === 'group') && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '8px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--card-border)', minHeight: 50 }}>
            <div onClick={() => { setView('list'); setSelectedUsers([]); setGroupName(''); }} style={iconBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ArrowLeft size={18} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {view === 'new' ? 'محادثة جديدة' : 'مجموعة جديدة'}
            </span>
          </div>
          {view === 'group' && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass-bg)', borderRadius: 8, padding: '0 10px' }}>
                <Edit3 size={14} color="var(--text-muted)" />
                <input placeholder="اسم المجموعة" value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '7px 0', fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
              </div>
            </div>
          )}
          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass-bg)', borderRadius: 8, padding: '0 10px' }}>
              <Search size={15} color="var(--text-muted)" />
              <input placeholder="ابحث عن مستخدم..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '7px 0', fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {availableFiltered.map(u => (
              <div key={u.id}
                onClick={() => {
                  if (view === 'new') {
                    startConversation(u.id).then(d => {
                      if (d?.existing) setActiveConv(d.conversation.id);
                      setView('chat'); setText('');
                    });
                  } else {
                    setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id]);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--card-border)',
                  background: selectedUsers.includes(u.id) ? 'var(--glass-bg-hover)' : 'transparent',
                }}
                onMouseEnter={e => { if (!selectedUsers.includes(u.id)) e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                onMouseLeave={e => { if (!selectedUsers.includes(u.id)) e.currentTarget.style.background = 'transparent'; }}>
                <Avtr name={u.fullName} size={40} online={onlineUsers.has(u.id)} image={u.profileImage} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-primary)' }}>{u.fullName}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {u.role === 'ADMIN' ? 'مشرف' : u.role === 'SUPERVISOR' ? 'مشرف عام' : u.role === 'EMPLOYEE' ? 'موظف' : u.role}
                    {onlineUsers.has(u.id) ? ' • متصل' : ''}
                  </div>
                </div>
                {view === 'group' && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selectedUsers.includes(u.id) ? '#25D366' : '#bbb'}`,
                    background: selectedUsers.includes(u.id) ? '#25D366' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
                  }}>
                    {selectedUsers.includes(u.id) && <Check size={12} color="#fff" />}
                  </div>
                )}
              </div>
            ))}
          </div>
          {view === 'group' && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--card-border)' }}>
              <div onClick={async () => { if (!groupName.trim() || selectedUsers.length === 0) return; await createGroup(groupName.trim(), selectedUsers); setView('chat'); setText(''); }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, textAlign: 'center',
                  fontWeight: 600, fontSize: '0.84rem',
                  background: groupName.trim() && selectedUsers.length > 0 ? '#25D366' : 'var(--glass-bg)',
                  color: groupName.trim() && selectedUsers.length > 0 ? '#fff' : 'var(--text-muted)',
                  cursor: groupName.trim() && selectedUsers.length > 0 ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}>
                إنشاء المجموعة
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Forward modal ── */}
      {forwardMsg && (
        <>
          <div onClick={() => setForwardMsg(null)} style={{
            position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.35)',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'var(--card-bg)', backdropFilter: 'var(--glass-blur)',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            zIndex: 1000, boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            maxHeight: 300, overflowY: 'auto', padding: '8px 0',
          }}>
            <div style={{ padding: '8px 14px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              إعادة توجيه إلى...
            </div>
            {conversations.filter(c => c.id !== activeConv).map(c => {
              const u = getOtherParticipant(c, user?.id);
              const n = c.type === 'GROUP' ? (c.name || 'مجموعة') : (u?.fullName || 'مستخدم');
              return (
                <div key={c.id} onClick={async () => {
                  if (!forwardMsg.content) return;
                  sendMessage(c.id, forwardMsg.content);
                  setForwardMsg(null);
                }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Avtr name={n} type={c.type} size={36} image={c.type === 'PRIVATE' ? u?.profileImage : undefined} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>{n}</span>
                </div>
              );
            })}
            {conversations.filter(c => c.id !== activeConv).length === 0 && (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                لا توجد محادثات أخرى
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes wadot { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }
        @keyframes waIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
        .msg-swipe-el { transform: translateX(0); transition: transform 0.2s ease; will-change: transform; }
        .msg-swipe-el.swiped[data-is-mine="1"] { transform: translateX(120px); }
        .msg-swipe-el.swiped[data-is-mine="0"] { transform: translateX(-120px); }
      `}</style>
    </div>
  );
}
