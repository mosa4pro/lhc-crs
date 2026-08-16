import React, { useState } from 'react';
import { Search, Filter, Users, GraduationCap, BookOpen, RefreshCw } from 'lucide-react';
import { useApi } from '../context/AuthContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { formatDate } from '../utils/dateFormat';

export const SmartQueriesPage = () => {
  const { apiFetch } = useApi();
  const [queryType, setQueryType] = useState('students');
  const [filters, setFilters] = useState({ status: '', nationality: '', studentType: '' });
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runQuery = async () => {
    setIsLoading(true);
    try {
      let url = '';
      if (queryType === 'students') {
        url = `/students?limit=500${filters.status ? '&status=' + filters.status : ''}${filters.nationality ? '&nationality=' + filters.nationality : ''}`;
      } else if (queryType === 'overdue') {
        url = '/installments?status=OVERDUE';
      } else if (queryType === 'subscriptions') {
        url = '/subscriptions?limit=200';
      }
      const res = await apiFetch(url);
      setResults(Array.isArray(res) ? res : (res.data || []));
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const getPhone = (phones: any) => {
    try { return (typeof phones === 'string' ? JSON.parse(phones) : phones)?.[0] || '—'; } catch { return '—'; }
  };

  return (
    <PermissionGuard perm="reports.academic">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={22} color="var(--primary-color)" /> الاستعلامات الذكية
        </h2>

        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} /> معايير البحث
          </h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: '0 1 200px' }}>
              <label className="form-label">نوع الاستعلام</label>
              <select className="glass-input" value={queryType} onChange={e => setQueryType(e.target.value)}>
                <option value="students">🎓 الطلاب</option>
                <option value="overdue">⚠️ الأقساط المتأخرة</option>
                <option value="subscriptions">📋 الاشتراكات</option>
              </select>
            </div>
            {queryType === 'students' && (
              <>
                <div className="form-group" style={{ margin: 0, flex: '0 1 160px' }}>
                  <label className="form-label">الحالة</label>
                  <select className="glass-input" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                    <option value="">الكل</option>
                    <option value="ACTIVE">مستمر</option>
                    <option value="POSTPONED">مؤجل</option>
                    <option value="WITHDRAWN">منسحب</option>
                    <option value="CANCELED">ملغي</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, flex: '0 1 160px' }}>
                  <label className="form-label">الجنسية</label>
                  <select className="glass-input" value={filters.nationality} onChange={e => setFilters({ ...filters, nationality: e.target.value })}>
                    <option value="">الكل</option>
                    <option value="JO">أردني</option>
                    <option value="OTHER">غير أردني</option>
                  </select>
                </div>
              </>
            )}
            <button className="glass-btn" onClick={runQuery} disabled={isLoading}>
              {isLoading ? <RefreshCw size={16} className="spin" /> : <Search size={16} />} تشغيل الاستعلام
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0 }}>النتائج ({results.length})</h4>
            </div>
            <div className="glass-table-container">
              <table className="glass-table">
                {queryType === 'students' && (
                  <>
                    <thead><tr><th>الطالب</th><th>الهاتف</th><th>الجنسية</th><th>الصفة</th><th>الحالة</th></tr></thead>
                    <tbody>
                      {results.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.fullNameAr}</td>
                          <td dir="ltr" style={{ textAlign: 'right', fontSize: '0.85rem' }}>0{getPhone(s.phones)}</td>
                          <td>{s.nationality === 'JO' ? '🇯🇴' : '🌍'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{s.studentType === 'UNIVERSITY' ? 'جامعة' : s.studentType === 'HIGH_SCHOOL' ? 'ثانوي' : 'موظف'}</td>
                          <td><span className={`badge ${s.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '0.75rem' }}>{s.status === 'ACTIVE' ? 'نشط' : s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {queryType === 'overdue' && (
                  <>
                    <thead><tr><th>الطالب</th><th>القسط</th><th>تاريخ الاستحقاق</th><th>المتبقي</th></tr></thead>
                    <tbody>
                      {results.map(inst => (
                        <tr key={inst.id}>
                          <td style={{ fontWeight: 600 }}>{inst.student?.fullNameAr || '—'}</td>
                          <td>{inst.installmentNumber}/{inst.totalInstallments}</td>
                          <td style={{ color: 'var(--danger)' }}>{formatDate(inst.dueDate)}</td>
                          <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{inst.remainingAmount?.toFixed(3)} د</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>
        )}

        {results.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Search size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>اختر معايير الاستعلام وانقر "تشغيل الاستعلام"</p>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};
