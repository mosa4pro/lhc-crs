// ==========================================
// Shared print-document helpers
// Uniform header used on every printed document:
//   logo centered — Arabic name on the right — English name on the left
// ==========================================

export interface PrintCenterInfo {
  name?: string;
  nameEn?: string;
  logo?: string;
}

export const printHeaderHTML = (c: PrintCenterInfo): string => {
  const logo = c.logo
    ? `<img src="${c.logo}" alt="" style="height:64px;max-width:160px;object-fit:contain;" />`
    : '';
  return `
<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1f2937;">
  <div style="flex:1;text-align:right;direction:rtl;min-width:0;">
    <div style="font-size:21px;font-weight:700;color:#111827;line-height:1.45;">${c.name || ''}</div>
  </div>
  <div style="flex:0 0 auto;text-align:center;">${logo}</div>
  <div style="flex:1;text-align:left;direction:ltr;min-width:0;">
    <div style="font-size:15px;font-weight:600;color:#374151;letter-spacing:0.4px;line-height:1.45;">${c.nameEn || ''}</div>
  </div>
</div>`;
};
