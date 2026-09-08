/**
 * Converts an array of flat objects into a CSV file and triggers a
 * browser download. Runs entirely client-side against data the report
 * page already has in memory — no round-trip to the backend needed
 * just to export what's already on screen.
 */
export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    return false;
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (val) => {
    const str = val == null ? '' : String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

const REPORT_PRINT_STYLES = `
  body { font-family: 'Inter', Arial, sans-serif; padding: 24px; color: #1c1b1a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #6b6b68; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e4e1d8; }
  th { text-transform: uppercase; font-size: 11px; color: #6b6b68; }
  @media print { @page { margin: 14mm; } }
`;

/**
 * Builds a clean, printable HTML table from the same row data used for
 * CSV export, and hands it to the browser's print dialog — where
 * "Save as PDF" is a built-in destination on every major browser/OS.
 * This gets a real PDF export without adding a PDF-generation library.
 */
export function buildReportPrintHtml(title, rows) {
  if (!rows || rows.length === 0) {
    return `<!DOCTYPE html><html><head><title>${title}</title><style>${REPORT_PRINT_STYLES}</style></head><body><h1>${title}</h1><p class="muted">No data for this period.</p></body></html>`;
  }
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${headers.map((h) => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`)
    .join('');

  return `<!DOCTYPE html><html><head><title>${title}</title><style>${REPORT_PRINT_STYLES}</style></head><body>
    <h1>${title}</h1>
    <p class="muted">Generated ${new Date().toLocaleString()}</p>
    <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
  </body></html>`;
}
