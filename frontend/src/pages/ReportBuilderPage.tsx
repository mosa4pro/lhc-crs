import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, Save, Trash2, Plus, RefreshCw, Columns, Play, Filter, X, Table, Eye, Printer, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Search, Download } from 'lucide-react';
import { useApi, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { printHeaderHTML } from '../utils/print';

interface FilterDef { field: string; label: string; type: string; placeholder?: string; options?: { value: string; label: string }[]; showIf?: { field: string; value: string }; group?: string; }
interface ColumnDef { field: string; label: string; group?: string; }
interface ReportTemplate { id: number; name: string; type: string; description?: string; columns: string; filters?: string; sortBy?: string; createdAt: string; }

const REPORT_TYPES = [
  { value: 'ACADEMIC', label: 'تقرير أكاديمي', icon: '📊' },
  { value: 'FINANCIAL', label: 'تقرير مالي', icon: '💰' },
];

export const ReportBuilderPage = () => {
  const { apiFetch } = useApi();
  const { centerName, centerNameEn, centerLogo } = useAuth();
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selected, setSelected] = useState<ReportTemplate | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('ACADEMIC');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const [filterDefs, setFilterDefs] = useState<FilterDef[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [executeResult, setExecuteResult] = useState<{ columns: ColumnDef[]; rows: any[] } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCols, setIsLoadingCols] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ReportTemplate | null>(null);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ columns: true, filters: true, actions: true });

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => { loadTemplates(); }, []);

  useEffect(() => {
    loadColumns();
    loadFilterDefs();
  }, [type]);

  useEffect(() => {
    if (!selected && filterDefs.length > 0) {
      setEnabledFilters(new Set(filterDefs.map(fd => fd.field)));
    }
  }, [filterDefs, selected]);

  const loadTemplates = async () => {
    try {
      const res = await apiFetch('/report-templates');
      setTemplates(Array.isArray(res) ? res : []);
    } catch {}
  };

  const loadColumns = async () => {
    setIsLoadingCols(true);
    try {
      const res = await apiFetch(`/report-templates/columns/${type}`);
      if (Array.isArray(res)) setColumns(res);
      else if (res && res.ACADEMIC) setColumns(res.ACADEMIC);
      else setColumns([]);
    } catch { setColumns([]); }
    finally { setIsLoadingCols(false); }
  };

  const loadFilterDefs = async () => {
    try {
      const res = await apiFetch(`/report-templates/filter-defs/${type}`);
      if (Array.isArray(res)) setFilterDefs(res);
      else if (res && res.ACADEMIC) setFilterDefs(res.ACADEMIC);
      else setFilterDefs([]);
    } catch { setFilterDefs([]); }
  };

  const toggleCol = (field: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const selectAllCols = () => setSelectedCols(new Set(columns.map(c => c.field)));
  const clearAllCols = () => setSelectedCols(new Set());

  const handleSelect = (t: ReportTemplate) => {
    setExecuteResult(null);
    setSelected(t);
    setName(t.name);
    setType(t.type);
    setDescription(t.description || '');
    let savedCols: string[];
    try { savedCols = Array.isArray(t.columns) ? t.columns : JSON.parse(t.columns || '[]'); }
    catch { savedCols = typeof t.columns === 'string' ? [t.columns] : []; }
    let savedFilters: Record<string, string>;
    try { savedFilters = t.filters && typeof t.filters === 'object' ? t.filters : (t.filters ? JSON.parse(t.filters) : {}); }
    catch { savedFilters = {}; }
    setSelectedCols(new Set(savedCols));
    setFilters(savedFilters || {});
    setEnabledFilters(new Set(Object.keys(savedFilters || {})));
  };

  const handleNew = () => {
    setSelected(null);
    setName('');
    setType('ACADEMIC');
    setDescription('');
    setSelectedCols(new Set());
    setFilters({});
    setExecuteResult(null);
  };

  const executeReport = useCallback(async () => {
    if (selectedCols.size === 0) { toast.error('اختر عموداً واحداً على الأقل'); return; }
    setIsExecuting(true);
    setExecuteResult(null);
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([k, v]) => enabledFilters.has(k) && v));
      const res = await apiFetch('/report-templates/execute', {
        method: 'POST',
        body: JSON.stringify({ type, columns: Array.from(selectedCols), filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined }),
      });
      setExecuteResult(res);
      if (!res.rows || res.rows.length === 0) toast.info('لا توجد نتائج', 'لم يتم العثور على بيانات تطابق المعايير');
      else toast.success('تم التنفيذ ✓', `${res.rows.length} سجل`);
    } catch (e: any) { toast.error('فشل التنفيذ', e.message); }
    finally { setIsExecuting(false); }
  }, [type, selectedCols, filters]);

  const saveTemplate = async () => {
    if (!name.trim()) { toast.error('اسم التقرير مطلوب'); return; }
    const colsArr = Array.from(selectedCols);
    if (colsArr.length === 0) { toast.error('اختر عموداً واحداً على الأقل'); return; }
    setIsSaving(true);
    try {
      const filterPayload = Object.fromEntries(Array.from(enabledFilters).map(f => [f, filters[f] || '']));
      const payload = { name, type, description, columns: colsArr, filters: Object.keys(filterPayload).length > 0 ? filterPayload : null };
      let savedId: number | null = null;
      if (selected) {
        savedId = selected.id;
        await apiFetch(`/report-templates/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('تم تحديث التقرير ✓');
      } else {
        const created = await apiFetch('/report-templates', { method: 'POST', body: JSON.stringify(payload) });
        savedId = created?.id || null;
        toast.success('تم إنشاء التقرير ✓', name);
      }
      setLastSavedId(savedId);
      await loadTemplates();
    } catch (e: any) { toast.error('فشل الحفظ', e.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiFetch(`/report-templates/${confirmDelete.id}`, { method: 'DELETE' });
      toast.success('تم الحذف');
      if (selected?.id === confirmDelete.id) handleNew();
      await loadTemplates();
    } catch (e: any) { toast.error('فشل الحذف', e.message); }
    finally { setConfirmDelete(null); }
  };

  const getCellValue = (row: any, col: ColumnDef) => {
    const val = row[col.field.replace('.', '_')];
    return val != null ? String(val) : '';
  };

  const exportCSV = () => {
    const er = executeResult;
    if (!er || er.rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const labels = er.columns.map(c => c.label);
    const rows = er.rows.map((row: any) => er.columns.map(c => getCellValue(row, c)).map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    const csv = '\uFEFF' + [labels.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `تقرير_${name || 'مخصص'}_${new Date().toLocaleDateString('en')}.csv`;
    a.click();
    toast.success('تم التصدير ✓', `${executeResult.rows.length} سجل`);
  };

  const exportExcel = () => {
    const er = executeResult;
    if (!er || er.rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const data = er.rows.map((row: any) => {
      const obj: Record<string, string> = {};
      er.columns.forEach(col => { obj[col.label] = getCellValue(row, col); });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
    XLSX.writeFile(wb, `تقرير_${name || 'مخصص'}_${new Date().toLocaleDateString('en')}.xlsx`);
    toast.success('تم تصدير Excel ✓', `${executeResult.rows.length} سجل`);
  };

  const exportPDF = () => {
    const er = executeResult;
    if (!er || er.rows.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const centerW = pageWidth / 3;
      if (centerLogo) { try { doc.addImage(centerLogo, 'PNG', centerW + centerW / 2 - 15, 6, 30, 15); } catch {} }
      doc.setFontSize(13);
      doc.text(centerName || 'المركز التعليمي الحديث', centerW, 15, { align: 'right' });
      doc.text(centerNameEn || '', pageWidth - centerW, 15, { align: 'left' });
      doc.setFontSize(8);
      doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-JO')}`, pageWidth - 10, 22, { align: 'left' });
      doc.setFontSize(12);
      doc.text(name || 'تقرير', pageWidth / 2, 28, { align: 'center' });
      const tableData = er.rows.map((row: any, i: number) => [String(i + 1), ...er.columns.map(col => getCellValue(row, col))]);
      autoTable(doc, {
        startY: 34, head: [['#', ...er.columns.map(c => c.label)]], body: tableData,
        theme: 'grid', styles: { fontSize: 7, font: 'helvetica' },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        tableLineColor: [200, 200, 200], tableLineWidth: 0.1,
      });
      doc.save(`تقرير_${name || 'مخصص'}_${new Date().toLocaleDateString('en')}.pdf`);
      toast.success('تم تصدير PDF ✓', `${executeResult.rows.length} سجل`);
    } catch (e: any) { toast.error('فشل تصدير PDF', e.message); }
  };

  const handlePrint = () => {
    const er = executeResult;
    if (!er || er.rows.length === 0) { toast.error('لا توجد بيانات للطباعة'); return; }
    setShowPrintPreview(true);
    setTimeout(() => {
      const win = window.open('', '_blank');
      if (!win) { toast.error('الرجاء السماح بالنوافذ المنبثقة للطباعة'); return; }
      const headerHTML = `${printHeaderHTML({ name: centerName, nameEn: centerNameEn, logo: centerLogo })}
      <div style="text-align:center;margin-bottom:16px;font-size:14px;font-weight:600">${name || 'تقرير'}</div>
      <div style="text-align:center;margin-bottom:16px;font-size:11px;color:#888">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-JO')}</div>`;
      let tableHTML = '<table dir="rtl" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="border:1px solid #ccc;padding:6px;background:#2980b9;color:#fff">#</th>';
      er.columns.forEach(col => { tableHTML += `<th style="border:1px solid #ccc;padding:6px;background:#2980b9;color:#fff">${col.label}</th>`; });
      tableHTML += '</tr></thead><tbody>';
      er.rows.forEach((row, i) => {
        tableHTML += '<tr>';
        tableHTML += `<td style="border:1px solid #ccc;padding:5px;text-align:center">${i + 1}</td>`;
        er.columns.forEach(col => { tableHTML += `<td style="border:1px solid #ccc;padding:5px">${getCellValue(row, col) || '—'}</td>`; });
        tableHTML += '</tr>';
      });
      tableHTML += '</tbody></table>';
      const footerHTML = `<div style="text-align:center;margin-top:20px;font-size:10px;color:#999;border-top:1px solid #ccc;padding-top:8px">تم الإنشاء بواسطة نظام إدارة المركز التعليمي</div>`;
      win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${name || 'تقرير'}</title><style>body{font-family:'Cairo','Segoe UI',Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px;text-align:center}th{background:#2980b9;color:#fff}@media print{body{padding:10px}}</style></head><body>${headerHTML}${tableHTML}${footerHTML}<script>setTimeout(function(){window.print();window.close();},400)</script></body></html>`);
      win.document.close();
      setShowPrintPreview(false);
    }, 100);
  };

  const toggleFilter = (field: string) => {
    setEnabledFilters(prev => {
      const next = new Set(prev);
      if (next.has(field)) { next.delete(field); setFilters(f => { const n = { ...f }; delete n[field]; return n; }); }
      else next.add(field);
      return next;
    });
  };

  const sf = (field: string, value: string) => setFilters(prev => ({ ...prev, [field]: value }));
  const clearFilters = () => { setFilters({}); setEnabledFilters(new Set()); };

  const activeFiltersCount = enabledFilters.size;
  const enabledColsCount = selectedCols.size;

  const SectionToggle = ({ section, label, count, children }: { section: string; label: React.ReactNode; count?: number; children: React.ReactNode }) => (
    <div style={{ border: '1px solid var(--glass-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)' }}>
      <div onClick={() => toggleSection(section)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: expandedSections[section] ? 'var(--primary-light)' : 'transparent' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>{label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {count !== undefined && <span className="badge primary" style={{ fontSize: '0.72rem' }}>{count}</span>}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', transform: expandedSections[section] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </div>
      </div>
      {expandedSections[section] && <div style={{ padding: '12px 16px 16px' }}>{children}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Table size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>صانع التقارير</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إنشاء تقارير مخصصة وتحليل البيانات</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="glass-btn secondary" onClick={() => loadTemplates()}><RefreshCw size={15} /> تحديث</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ width: 250, flexShrink: 0, alignSelf: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} color="var(--primary)" /> التقارير المحفوظة
            </h4>
            <button className="glass-btn secondary sm" onClick={handleNew} title="تقرير جديد"><Plus size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {templates.map(t => (
              <div key={t.id} onClick={() => handleSelect(t)} style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: selected?.id === t.id ? 'var(--primary-light)' : 'var(--card-bg)', border: `1px solid ${selected?.id === t.id ? 'var(--primary)' : 'var(--glass-border)'}`, transition: 'all 0.2s' }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{REPORT_TYPES.find(r => r.value === t.type)?.icon} {REPORT_TYPES.find(r => r.value === t.type)?.label}</div>
              </div>
            ))}
            {templates.length === 0 && <div style={{ textAlign: 'center', padding: 24, opacity: 0.5, fontSize: '0.85rem' }}>لا توجد تقارير محفوظة</div>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Columns size={20} color="var(--secondary)" />
                {selected ? `تعديل: ${selected.name}` : 'تقرير جديد'}
              </h3>
              {selected && <button className="glass-btn danger sm" onClick={() => setConfirmDelete(selected)}><Trash2 size={14} /> حذف</button>}
            </div>

            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label"><span className="required-star">*</span>اسم التقرير</label>
                <input type="text" className="glass-input" placeholder="مثال: تقرير الطلاب الشهري" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">نوع التقرير</label>
                <select className="glass-input" value={type} onChange={e => { setSelected(null); setSelectedCols(new Set()); setFilters({}); setEnabledFilters(new Set()); setExecuteResult(null); setType(e.target.value); }}>
                  {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">وصف (اختياري)</label>
              <input type="text" className="glass-input" placeholder="وصف مختصر للتقرير" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <SectionToggle section="columns" label={<><Columns size={16} /> اختيار الأعمدة</>} count={enabledColsCount || undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button className="glass-btn secondary sm" onClick={selectAllCols}>تحديد الكل</button>
              <button className="glass-btn secondary sm" onClick={clearAllCols}>إلغاء الكل</button>
              {isLoadingCols && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>جارٍ التحميل...</span>}
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {Array.from(new Set(columns.map(c => c.group).filter(Boolean))).map(group => {
                const groupCols = columns.filter(c => c.group === group);
                const groupSelected = groupCols.filter(c => selectedCols.has(c.field));
                return (
                  <div key={group} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{group}</span>
                      {groupSelected.length > 0 && <span className={`badge ${groupSelected.length === groupCols.length ? 'success' : 'primary'}`} style={{ fontSize: '0.62rem' }}>{groupSelected.length}/{groupCols.length}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 5 }}>
                      {groupCols.map(col => (
                        <label key={col.field} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: selectedCols.has(col.field) ? 'var(--primary-light)' : 'transparent', border: `1px solid ${selectedCols.has(col.field) ? 'var(--primary)' : 'var(--glass-border)'}`, transition: 'all 0.15s', fontSize: '0.82rem' }}>
                          <input type="checkbox" checked={selectedCols.has(col.field)} onChange={() => toggleCol(col.field)} style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                          <span style={{ color: selectedCols.has(col.field) ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: selectedCols.has(col.field) ? 600 : 400 }}>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!isLoadingCols && columns.length === 0 && <div style={{ textAlign: 'center', padding: 16, opacity: 0.5 }}>لا توجد أعمدة متاحة لهذا النوع</div>}
            </div>
          </SectionToggle>

          <SectionToggle section="filters" label={<><Filter size={16} /> الفلاتر</>} count={activeFiltersCount || undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>فعّل الفلاتر التي تريد استخدامها:</span>
              {activeFiltersCount > 0 && <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 3 }}><X size={13} /> مسح الكل</button>}
            </div>
            {filterDefs.length > 0 ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  {Array.from(new Set(filterDefs.map(fd => fd.group).filter(Boolean))).map(group => {
                    const groupFilters = filterDefs.filter(fd => fd.group === group);
                    return (
                      <div key={group} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{group}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {groupFilters.map(fd => (
                            <label key={fd.field} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '5px 10px', borderRadius: 8, fontSize: '0.8rem', background: enabledFilters.has(fd.field) ? 'var(--primary-light)' : 'transparent', border: `1px solid ${enabledFilters.has(fd.field) ? 'var(--primary)' : 'var(--glass-border)'}`, transition: 'all 0.15s' }}>
                              <input type="checkbox" checked={enabledFilters.has(fd.field)} onChange={() => toggleFilter(fd.field)} style={{ width: 13, height: 13, accentColor: 'var(--primary)' }} />
                              <span style={{ fontWeight: enabledFilters.has(fd.field) ? 600 : 400 }}>{fd.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {activeFiltersCount > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, padding: 14, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                    {filterDefs.filter(fd => enabledFilters.has(fd.field)).map(fd => (
                      <div key={fd.field} className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{fd.label}</label>
                        {fd.type === 'select' ? (
                          <select className="glass-input" style={{ fontSize: '0.82rem' }} value={filters[fd.field] || ''} onChange={e => sf(fd.field, e.target.value)}>
                            {fd.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input type={fd.type} className="glass-input" style={{ fontSize: '0.82rem' }} placeholder={fd.placeholder || fd.label} value={filters[fd.field] || ''} onChange={e => sf(fd.field, e.target.value)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>لا توجد فلاتر متاحة لهذا النوع</span>}
          </SectionToggle>

          <SectionToggle section="actions" label={<><Play size={16} /> الإجراءات</>}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="glass-btn" onClick={executeReport} disabled={isExecuting || enabledColsCount === 0} style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>
                <Play size={15} /> {isExecuting ? 'جارٍ التنفيذ...' : 'تشغيل التقرير'}
              </button>
              <button className="glass-btn" onClick={saveTemplate} disabled={isSaving || !name.trim() || enabledColsCount === 0}>
                <Save size={15} /> {isSaving ? 'جارٍ الحفظ...' : (selected ? 'حفظ التعديلات' : 'حفظ التقرير')}
              </button>
              <button className="glass-btn secondary" onClick={handleNew}><RefreshCw size={14} /> جديد</button>
            </div>
            {executeResult && executeResult.rows.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 10 }}>تصدير النتائج:</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="glass-btn secondary sm" onClick={exportCSV}><Download size={14} /> CSV</button>
                  <button className="glass-btn secondary sm" onClick={exportExcel}><FileSpreadsheet size={14} /> Excel</button>
                  <button className="glass-btn secondary sm" onClick={exportPDF}><FileText size={14} /> PDF</button>
                  <button className="glass-btn secondary sm" onClick={handlePrint}><Printer size={14} /> طباعة</button>
                  <button className="glass-btn secondary sm" onClick={() => setShowPrintPreview(true)}><Eye size={14} /> معاينة</button>
                </div>
              </div>
            )}
          </SectionToggle>

          {isExecuting && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              جارٍ تشغيل التقرير...
            </div>
          )}

          {executeResult && (
            <div className="glass-panel" ref={printRef}>
              <h4 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Table size={18} color="var(--secondary)" /> النتائج
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 400 }}>({executeResult.rows.length} سجل)</span>
              </h4>
              {executeResult.rows.length > 0 ? (
                <div className="glass-table-container" style={{ maxHeight: 500, overflow: 'auto' }}>
                  <table className="glass-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>#</th>
                        {executeResult.columns.map(col => <th key={col.field}>{col.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {executeResult.rows.map((row: any, i: number) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>{i + 1}</td>
                          {executeResult.columns.map(col => <td key={col.field}>{getCellValue(row, col) || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>لا توجد نتائج تطابق المعايير المحددة</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPrintPreview && executeResult && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowPrintPreview(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', direction: 'rtl', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e0e0e0' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={18} /> معاينة التقرير</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="glass-btn" onClick={handlePrint} style={{ fontSize: '0.82rem' }}><Printer size={14} /> طباعة</button>
                <button className="glass-btn secondary" onClick={exportPDF} style={{ fontSize: '0.82rem' }}><FileText size={14} /> PDF</button>
                <button className="glass-btn secondary" onClick={exportExcel} style={{ fontSize: '0.82rem' }}><FileSpreadsheet size={14} /> Excel</button>
                <button className="glass-btn secondary" onClick={() => setShowPrintPreview(false)}><X size={14} /> إغلاق</button>
              </div>
            </div>
            <div style={{ padding: '20px 30px', overflow: 'auto', flex: 1, background: '#f5f5f5' }}>
              <div style={{ background: '#fff', padding: '30px 25px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: '60vh' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, borderBottom: '2px solid #2980b9', paddingBottom: 12 }}>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: 16, fontWeight: 800, color: '#2980b9' }}>{centerName || 'المركز التعليمي الحديث'}</div>
                  <div style={{ flexShrink: 0 }}>{centerLogo && <img src={centerLogo} alt="الشعار" style={{ maxHeight: 50 }} />}</div>
                  <div style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{centerNameEn}</div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>{name || 'تقرير'}</div>
                <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 11, color: '#888' }}>تاريخ الطباعة: {new Date().toLocaleDateString('ar-JO')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ccc', padding: 6, background: '#2980b9', color: '#fff', textAlign: 'center' }}>#</th>
                      {executeResult.columns.map(col => <th key={col.field} style={{ border: '1px solid #ccc', padding: 6, background: '#2980b9', color: '#fff', textAlign: 'center' }}>{col.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {executeResult.rows.map((row: any, i: number) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #ccc', padding: 5, textAlign: 'center' }}>{i + 1}</td>
                        {executeResult.columns.map(col => <td key={col.field} style={{ border: '1px solid #ccc', padding: 5, textAlign: 'center' }}>{getCellValue(row, col) || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#999', borderTop: '1px solid #ccc', paddingTop: 8 }}>تم الإنشاء بواسطة نظام إدارة المركز التعليمي</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmDelete !== null} message={confirmDelete ? `هل تريد حذف تقرير "${confirmDelete.name}"؟` : ''} confirmText="حذف" danger onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
};
