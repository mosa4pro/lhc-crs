import React, { useState, useEffect } from 'react';
import {
  GraduationCap, RefreshCw, DollarSign, CheckCircle, Clock,
  ChevronDown, ChevronUp, Wallet, CreditCard, Search, FileDown,
  Building2, Phone, Mail, CalendarDays, X
} from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PermissionGuard } from '../components/PermissionGuard';

export const LecturerAccountsPage = () => {
  const { apiFetch } = useApi();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [payMode, setPayMode] = useState<'individual' | 'bulk'>('individual');
  const [payingInstructor, setPayingInstructor] = useState<string | null>(null);
  const [payingSection, setPayingSection] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/fin-accounts/lecturers');
      setLecturers(data);
    } catch (e: any) {
      toast.error('خطأ', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = lecturers.filter(l => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return l.name.toLowerCase().includes(q) || (l.specialization || '').toLowerCase().includes(q) || (l.phone || '').toLowerCase().includes(q);
  });

  const totalDue = lecturers.reduce((s, l) => s + (l.totalDue || 0), 0);
  const totalPaid = lecturers.reduce((s, l) => s + (l.paidAmount || 0), 0);
  const totalPending = lecturers.reduce((s, l) => s + (l.pendingAmount || 0), 0);
  const totalRemaining = totalDue - totalPaid;

  const handlePaySection = async (instructorId: string, sectionId: string, courseId: string, amount: number) => {
    try {
      setIsLoading(true);
      await apiFetch('/fin-accounts/lecturers/pay', {
        method: 'POST',
        body: JSON.stringify({ instructorId, sectionId, courseId, amount, paymentMethod: 'CASH' })
      });
      toast.success('تم صرف أجر المحاضر');
      await load();
    } catch (e: any) {
      toast.error('خطأ', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayAll = async (instructor: any) => {
    if (!instructor.sections?.length) return;
    try {
      setIsLoading(true);
      await apiFetch('/fin-accounts/lecturers/pay-bulk', {
        method: 'POST',
        body: JSON.stringify({
          payments: instructor.sections.map((s: any) => ({
            instructorId: instructor.id,
            sectionId: s.id,
            courseId: s.courseId,
            amount: instructor.courseRate,
            paymentMethod: 'CASH'
          }))
        })
      });
      toast.success(`تم صرف ${instructor.sections.length} دفعة`);
      await load();
    } catch (e: any) {
      toast.error('خطأ', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayAllLecturers = async () => {
    const all = filtered.filter(l => (l.totalDue || 0) > (l.paidAmount || 0));
    if (!all.length) return toast.error('لا يوجد مستحقات للصرف');
    try {
      setIsLoading(true);
      let count = 0;
      for (const inst of all) {
        if (!inst.sections?.length) continue;
        await apiFetch('/fin-accounts/lecturers/pay-bulk', {
          method: 'POST',
          body: JSON.stringify({
            payments: inst.sections.map((s: any) => ({
              instructorId: inst.id, sectionId: s.id, courseId: s.courseId,
              amount: inst.courseRate, paymentMethod: 'CASH'
            }))
          })
        });
        count += inst.sections.length;
      }
      toast.success(`تم صرف ${count} دفعة لـ ${all.length} محاضر`);
      await load();
    } catch (e: any) {
      toast.error('خطأ', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentForSection = (instructor: any, sectionId: string) => {
    return instructor.payments?.find((p: any) => p.sectionId === parseInt(sectionId));
  };

  return (
    <PermissionGuard perm="finance.accounts">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <GraduationCap size={22} color="var(--primary-color)" /> حسابات المحاضرين
          </h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="glass-btn secondary" onClick={load} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> تحديث
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {[
            { label: 'إجمالي المستحقات', value: totalDue, color: 'var(--warning)', icon: DollarSign },
            { label: 'المدفوع', value: totalPaid, color: 'var(--success)', icon: CheckCircle },
            { label: 'معلّق', value: totalPending, color: 'var(--info)', icon: Clock },
            { label: 'المتبقي', value: totalRemaining, color: 'var(--danger)', icon: Wallet },
          ].map(c => (
            <div key={c.label} className="glass-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.label}</div>
                <c.icon size={18} color={c.color} />
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c.color }}>{c.value.toFixed(3)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>دينار</div>
            </div>
          ))}
        </div>

        {/* Search + Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-muted)' }} />
            <input className="glass-input" placeholder="بحث عن محاضر..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setSearchTerm('')}
              style={{ paddingRight: 32, paddingLeft: searchTerm ? 32 : 12 }} />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', zIndex: 2
              }}><X size={14} /></button>
            )}
          </div>
          {hasPermission('finance.accounts') && (
            <button className="glass-btn primary" onClick={handlePayAllLecturers} disabled={isLoading || totalRemaining <= 0}>
              <Wallet size={15} /> صرف جميع المستحقات
            </button>
          )}
          <button className="glass-btn secondary" onClick={() => setPayMode(p => p === 'individual' ? 'bulk' : 'individual')}>
            {payMode === 'individual' ? 'تجميعي' : 'فردي'}
          </button>
        </div>

        {/* Instructors List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(instructor => {
            const remaining = (instructor.totalDue || 0) - (instructor.paidAmount || 0);
            const isExpanded = expandedId === instructor.id;
            return (
              <div key={instructor.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Instructor Header */}
                <div
                  style={{
                    padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                    borderBottom: isExpanded ? '1px solid var(--glass-border)' : 'none'
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : instructor.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                    }}>
                      {instructor.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{instructor.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {instructor.specialization || '—'} · {instructor.courseRate?.toFixed(3)} د/دورة
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>الشعب</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{instructor.activeSections || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>المستحق</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--warning)' }}>{(instructor.totalDue || 0).toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>الباقي</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: remaining > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{remaining.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>المدفوع</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--success)' }}>{(instructor.paidAmount || 0).toFixed(1)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {remaining > 0 && payMode === 'bulk' && hasPermission('finance.accounts') && (
                      <button className="glass-btn sm success" onClick={e => { e.stopPropagation(); handlePayAll(instructor); }} style={{ fontSize: '0.75rem' }}>
                        <Wallet size={12} /> صرف الكل
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded Sections & Payments */}
                {isExpanded && (
                  <div style={{ padding: '14px 18px' }}>
                    {/* Sections Table */}
                    <div className="glass-table-container">
                      <table className="glass-table" style={{ fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>الدورة</th>
                            <th>أجر الدورة</th>
                            <th>حالة الدفع</th>
                            <th>طريقة الدفع</th>
                            <th>تاريخ الصرف</th>
                            <th>إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(instructor.sections || []).map((section: any, idx: number) => {
                            const payment = getPaymentForSection(instructor, section.id);
                            return (
                              <tr key={section.id}>
                                <td style={{ opacity: 0.5 }}>{idx + 1}</td>
                                <td style={{ fontWeight: 600 }}>{section.courseName || section.courseId}</td>
                                <td>{instructor.courseRate?.toFixed(3)} د</td>
                                <td>
                                  {payment ? (
                                    <span className={`badge ${payment.status === 'PAID' ? 'success' : 'warning'}`}>
                                      {payment.status === 'PAID' ? 'مدفوع' : 'معلّق'}
                                    </span>
                                  ) : (
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>غير محدد</span>
                                  )}
                                </td>
                                <td style={{ fontSize: '0.75rem' }}>{payment?.paymentMethod || '—'}</td>
                                <td style={{ fontSize: '0.75rem' }}>
                                  {payment?.paidDate ? formatDate(payment.paidDate) : '—'}
                                </td>
                                <td>
                                  {(!payment || payment.status !== 'PAID') && hasPermission('finance.accounts') && (
                                    <button
                                      className="glass-btn sm primary"
                                      onClick={() => handlePaySection(instructor.id, section.id, section.courseId, instructor.courseRate)}
                                      disabled={isLoading}
                                      style={{ fontSize: '0.7rem' }}
                                    >
                                      <DollarSign size={11} /> صرف
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {(!instructor.sections || instructor.sections.length === 0) && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>لا توجد شعب</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Payment History */}
                    {instructor.payments?.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                          سجل الدفعات ({instructor.payments.length})
                        </div>
                        <div className="glass-table-container">
                          <table className="glass-table" style={{ fontSize: '0.78rem' }}>
                            <thead>
                              <tr>
                                <th>المبلغ</th>
                                <th>الحالة</th>
                                <th>طريقة الدفع</th>
                                <th>التاريخ</th>
                                <th>ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {instructor.payments.map((p: any) => (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 600 }}>{p.amount?.toFixed(3)} د</td>
                                  <td>
                                    <span className={`badge ${p.status === 'PAID' ? 'success' : 'warning'}`}>
                                      {p.status === 'PAID' ? 'مدفوع' : 'معلّق'}
                                    </span>
                                  </td>
                                  <td>{p.paymentMethod || '—'}</td>
                                  <td>{p.paidDate ? formatDate(p.paidDate) : '—'}</td>
                                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Instructor Details */}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
                      {instructor.phone && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} /> {instructor.phone}
                        </div>
                      )}
                      {instructor.email && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={12} /> {instructor.email}
                        </div>
                      )}
                      {instructor.iban && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, direction: 'ltr' }}>
                          <CreditCard size={12} /> {instructor.iban}
                        </div>
                      )}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Building2 size={12} /> {instructor.paymentMethod === 'PER_COURSE' ? 'لكل دورة' : instructor.paymentMethod}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && !isLoading && (
            <div className="glass-panel" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
              لا يوجد محاضرون
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};
