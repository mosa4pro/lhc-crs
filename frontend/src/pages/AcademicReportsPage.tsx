import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, RefreshCw, Users, Filter, Download, TrendingUp, X,
  UserCheck, FileText, Play, ClipboardList, Printer, FileSpreadsheet, Eye
} from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { printHeaderHTML } from '../utils/print';

interface FilterDef {
  field: string; label: string; type: string; placeholder?: string;
  options?: { value: string; label: string }[];
  showIf?: { field: string; value: string };
}
interface SavedReport { id: number; name: string; type: string; columns: string | string[]; filters?: string | Record<string, string> | null; }

const getCellValue = (row: any, col: any) =>
  row[col.field?.replace?.(/\./g, '_')] ?? row[col.field] ?? '—';

export const AcademicReportsPage = () => {
  const { apiFetch } = useApi();
  const { centerName, centerNameEn, centerLogo } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [templates, setTemplates] = useState<SavedReport[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedReport | null>(null);

  const [filterDefs, setFilterDefs] = useState<FilterDef[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [activeColumns, setActiveColumns] = useState<any[]>([]);

  const [results, setResults] = useState<{ columns: any[]; rows: any[] } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => { loadStats(); loadTemplates(); loadFilterDefs(); }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [studRes, activeRes, gradesRes] = await Promise.all([
        apiFetch('/students?limit=1'),
        apiFetch('/students?limit=1&status=ACTIVE'),
        apiFetch('/grades/admin/stats'),
      ]);
      setStats({
        totalStudents: studRes.total || 0,
        activeStudents: activeRes.total || 0,
        withGrades: gradesRes.withGrades || 0,
      });
    } catch { }
    finally { setIsLoading(false); }
  };

  const loadTemplates = async () => {
    try {
      const res = await apiFetch('/report-templates');
      setTemplates(Array.isArray(res) ? res.filter((t: any) => t.type === 'ACADEMIC') : []);
    } catch {}
  };

  const loadFilterDefs = async () => {
    try {
      const res = await apiFetch('/report-templates/filter-defs/ACADEMIC');
      setFilterDefs(Array.isArray(res) ? res : []);
    } catch {}
  };

  const selectTemplate = async (t: SavedReport) => {
    setSelectedTemplate(t);
    setResults(null);
    const savedFilters: Record<string, string> = t.filters && typeof t.filters === 'object' ? t.filters : (t.filters ? JSON.parse(t.filters) : {});
    setFilterValues(savedFilters);
    setEnabledFilters(new Set(Object.keys(savedFilters)));
    try {
      const cols: string[] = Array.isArray(t.columns) ? t.columns : JSON.parse(t.columns || '[]');
      const colRes = await apiFetch('/report-templates/columns/ACADEMIC');
      const allCols: any[] = Array.isArray(colRes) ? colRes : [];
      setActiveColumns(allCols.filter((c: any) => cols.includes(c.field)));
    } catch {
      setActiveColumns([]);
    }
  };

  const sf = (field: string, value: string) =>
    setFilterValues(prev => ({ ...prev, [field]: value }));

  const executeReport = useCallback(async () => {
    if (!selectedTemplate) return;
    setIsExecuting(true);
    setResults(null);
    try {
      const cols: string[] = Array.isArray(selectedTemplate.columns) ? selectedTemplate.columns : JSON.parse(selectedTemplate.columns || '[]');
      const activeFilters = Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v));
      const res = await apiFetch('/report-templates/execute', {
        method: 'POST',
        body: JSON.stringify({
          type: 'ACADEMIC',
          columns: cols,
          filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
        }),
      });
      setResults(res);
      if (res.rows?.length > 0) toast.success(`تم التنفيذ ✓`, `${res.rows.length} سجل`);
      else toast.info('لا توجد نتائج');
    } catch (e: any) {
      toast.error('فشل التنفيذ', e.message);
    } finally { setIsExecuting(false); }
  }, [selectedTemplate, filterValues]);

  const exportCSV = () => {
    if (!results || results.rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const labels = results.columns.map((c: any) => c.label);
    const rows = results.rows.map((row: any) =>
      results.columns.map((c: any) => String(getCellValue(row, c))).map(v => `"${v.replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [labels.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `تقرير_${selectedTemplate?.name || 'أكاديمي'}_${new Date().toLocaleDateString('en')}.csv`;
    a.click();
    toast.success('تم التصدير ✓', `${results.rows.length} سجل`);
  };

  const exportExcel = () => {
    if (!results || results.rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const data = results.rows.map((row: any) => {
      const obj: Record<string, string> = {};
      results.columns.forEach((col: any) => { obj[col.label] = getCellValue(row, col); });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
    XLSX.writeFile(wb, `تقرير_${selectedTemplate?.name || 'أكاديمي'}_${new Date().toLocaleDateString('en')}.xlsx`);
    toast.success('تم تصدير Excel ✓', `${results.rows.length} سجل`);
  };

  const exportPDF = () => {
    if (!results || results.rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const centerW = pageWidth / 3;
      if (centerLogo) {
        try { doc.addImage(centerLogo, 'PNG', centerW + centerW / 2 - 15, 6, 30, 15); } catch {}
      }
      doc.setFontSize(13);
      doc.text(centerName || 'المركز التعليمي الحديث', centerW, 15, { align: 'right' });
      doc.text(centerNameEn || '', pageWidth - centerW, 15, { align: 'left' });
      doc.setFontSize(8);
      doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-JO')}`, pageWidth - 10, 22, { align: 'left' });
      doc.setFontSize(12);
      doc.text(selectedTemplate?.name || 'تقرير', pageWidth / 2, 28, { align: 'center' });

      const tableData = results.rows.map((row: any, i: number) => [
        String(i + 1),
        ...results.columns.map((col: any) => getCellValue(row, col)),
      ]);
      autoTable(doc, {
        startY: 34,
        head: [['#', ...results.columns.map((c: any) => c.label)]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 7, font: 'helvetica' },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.1,
      });
      doc.save(`تقرير_${selectedTemplate?.name || 'أكاديمي'}_${new Date().toLocaleDateString('en')}.pdf`);
      toast.success('تم تصدير PDF ✓', `${results.rows.length} سجل`);
    } catch (e: any) {
      toast.error('فشل تصدير PDF', e.message);
    }
  };

  const handlePrint = () => {
    if (!results || results.rows.length === 0) { toast.error('لا توجد بيانات للطباعة'); return; }
    setShowPrintPreview(true);
    setTimeout(() => {
      const win = window.open('', '_blank');
      if (!win) { toast.error('الرجاء السماح بالنوافذ المنبثقة للطباعة'); return; }
      const headerHTML = `${printHeaderHTML({ name: centerName, nameEn: centerNameEn, logo: centerLogo })}
        <div style="text-align:center;margin-bottom:16px;font-size:14px;font-weight:600">${selectedTemplate?.name || 'تقرير'}</div>
        <div style="text-align:center;margin-bottom:16px;font-size:11px;color:#888">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-JO')}</div>
      `;
      const labels = results.columns.map((c: any) => c.label);
      let tableHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th style="border:1px solid #ccc;padding:6px;background:#2980b9;color:#fff;text-align:center">#</th>
        ${labels.map(l => `<th style="border:1px solid #ccc;padding:6px;background:#2980b9;color:#fff;text-align:center">${l}</th>`).join('')}
        </tr></thead><tbody>
        ${results.rows.map((row: any, i: number) => `<tr>
          <td style="border:1px solid #ccc;padding:5px;text-align:center">${i + 1}</td>
          ${results.columns.map((col: any) => `<td style="border:1px solid #ccc;padding:5px;text-align:center">${getCellValue(row, col)}</td>`).join('')}
        </tr>`).join('')}
        </tbody></table>`;
      win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${selectedTemplate?.name || 'تقرير'}</title></head><body style="margin:20px;font-family:Tahoma,Arial,sans-serif">${headerHTML}${tableHTML}<script>window.onload=function(){window.print();}<\/script></body></html>`);
      win.document.close();
    }, 300);
  };

  const clearFilters = () => setFilterValues({});

  const isFilterVisible = (fd: FilterDef) => {
    if (!fd.showIf) return true;
    return filterValues[fd.showIf.field] === fd.showIf.value;
  };

  const activeFiltersCount = Object.values(filterValues).filter(v => v).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart2 size={26} color="var(--primary)" />
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>التقارير الأكاديمية</h2>
        </div>
        <button className="glass-btn secondary" onClick={() => { loadStats(); }} disabled={isLoading}>
          <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> تحديث
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[
            { label: 'إجمالي الطلاب', value: stats.totalStudents, color: 'var(--primary)', icon: Users },
            { label: 'طلاب نشطون', value: stats.activeStudents, color: 'var(--success)', icon: UserCheck },
            { label: 'طلاب بعلامات', value: stats.withGrades, color: 'var(--secondary)', icon: FileText },
          ].map(c => (
            <div key={c.label} className="stat-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.label}</div>
                <c.icon size={18} color={c.color} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: c.color }}>{isLoading ? '...' : c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Template Selector */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ClipboardList size={18} color="var(--primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>التقارير المحفوظة</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{templates.length} تقرير</span>
        </div>

        {templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, opacity: 0.5, fontSize: '0.85rem' }}>
            لا توجد تقارير أكاديمية محفوظة — أنشئ واحداً من <strong>صانع التقارير</strong> في الإعدادات
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid var(--glass-border)',
                  background: selectedTemplate?.id === t.id ? 'var(--primary-light)' : 'var(--card-bg)',
                  color: selectedTemplate?.id === t.id ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: selectedTemplate?.id === t.id ? 700 : 500,
                  cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Report */}
      {selectedTemplate && (
        <>
          {/* Filter Panel */}
          <div className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingUp size={20} color="var(--secondary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{selectedTemplate.name}</h3>
                {activeFiltersCount > 0 && (
                  <span className="badge primary" style={{ fontSize: '0.72rem' }}>{activeFiltersCount} فلتر</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="glass-btn" onClick={executeReport} disabled={isExecuting}>
                  <Play size={15} /> {isExecuting ? 'جارٍ...' : 'تشغيل التقرير'}
                </button>
                {activeFiltersCount > 0 && (
                  <button className="glass-btn secondary" onClick={clearFilters}>
                    <X size={13} /> مسح الفلاتر
                  </button>
                )}
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 10, padding: 14, background: 'var(--card-bg)',
              borderRadius: 12, border: '1px solid var(--glass-border)',
            }}>
              {filterDefs.filter(fd => enabledFilters.has(fd.field)).filter(isFilterVisible).map(fd => (
                <div key={fd.field} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{fd.label}</label>
                  {fd.type === 'select' ? (
                    <select className="glass-input" style={{ fontSize: '0.82rem' }}
                      value={filterValues[fd.field] || ''} onChange={e => sf(fd.field, e.target.value)}>
                      {fd.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={fd.type} className="glass-input" style={{ fontSize: '0.82rem' }}
                      placeholder={fd.placeholder || fd.label}
                      value={filterValues[fd.field] || ''} onChange={e => sf(fd.field, e.target.value)} />
                  )}
                </div>
              ))}
            </div>

            {/* Column Summary */}
            {activeColumns.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {activeColumns.map((c: any) => (
                  <span key={c.field} className="badge primary" style={{ fontSize: '0.7rem', opacity: 0.8 }}>{c.label}</span>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {isExecuting && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              جارٍ تشغيل التقرير...
            </div>
          )}

          {results && (
            <div className="glass-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 size={18} color="var(--secondary)" /> النتائج
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    ({results.rows.length} سجل)
                  </span>
                </h4>
                {results.rows.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="glass-btn secondary sm" onClick={exportCSV}><Download size={13} /> CSV</button>
                    <button className="glass-btn secondary sm" onClick={exportExcel}><FileSpreadsheet size={13} /> Excel</button>
                    <button className="glass-btn secondary sm" onClick={exportPDF}><FileText size={13} /> PDF</button>
                    <button className="glass-btn primary sm" onClick={() => setShowPrintPreview(true)}><Eye size={13} /> معاينة</button>
                    <button className="glass-btn secondary sm" onClick={handlePrint}><Printer size={13} /> طباعة</button>
                  </div>
                )}
              </div>

              {results.rows.length > 0 ? (
                <div className="glass-table-container" style={{ maxHeight: 500, overflow: 'auto' }}>
                  <table className="glass-table" style={{ fontSize: '0.8rem' }}>
                    <thead><tr>
                      <th>#</th>
                      {results.columns.map((col: any) => <th key={col.field}>{col.label}</th>)}
                    </tr></thead>
                    <tbody>
                      {results.rows.map((row: any, i: number) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                          {results.columns.map((col: any) => {
                            const val = row[col.field.replace?.(/\./g, '_')] ?? row[col.field];
                            return <td key={col.field}>{val != null ? String(val) : '—'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
                  لا توجد نتائج تطابق المعايير المحددة
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && results && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setShowPrintPreview(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, width: '90%', maxWidth: 900,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            direction: 'rtl', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderBottom: '1px solid #e0e0e0',
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>معاينة التقرير</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="glass-btn" onClick={handlePrint} style={{ fontSize: '0.82rem' }}>
                  <Printer size={14} /> طباعة
                </button>
                <button className="glass-btn secondary" onClick={exportPDF} style={{ fontSize: '0.82rem' }}>
                  <FileText size={14} /> PDF
                </button>
                <button className="glass-btn secondary" onClick={exportExcel} style={{ fontSize: '0.82rem' }}>
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button className="glass-btn secondary" onClick={() => setShowPrintPreview(false)} style={{ fontSize: '0.82rem' }}>إغلاق</button>
              </div>
            </div>
            <div style={{ padding: '20px 30px', overflow: 'auto', flex: 1, background: '#f5f5f5' }}>
              <div style={{
                background: '#fff', padding: '30px 25px', borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: '60vh',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  marginBottom: 20, borderBottom: '2px solid #2980b9', paddingBottom: 12,
                }}>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: 16, fontWeight: 800, color: '#2980b9' }}>
                    {centerName || 'المركز التعليمي الحديث'}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {centerLogo && <img src={centerLogo} alt="الشعار" style={{ maxHeight: 50 }} />}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                    {centerNameEn}
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
                  {selectedTemplate?.name || 'تقرير'}
                </div>
                <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 11, color: '#888' }}>
                  تاريخ الطباعة: {new Date().toLocaleDateString('ar-JO')}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ccc', padding: 6, background: '#2980b9', color: '#fff', textAlign: 'center' }}>#</th>
                      {results.columns.map((col: any) => (
                        <th key={col.field} style={{ border: '1px solid #ccc', padding: 6, background: '#2980b9', color: '#fff', textAlign: 'center' }}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.rows.map((row: any, i: number) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #ccc', padding: 5, textAlign: 'center' }}>{i + 1}</td>
                        {results.columns.map((col: any) => (
                          <td key={col.field} style={{ border: '1px solid #ccc', padding: 5, textAlign: 'center' }}>{getCellValue(row, col)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
