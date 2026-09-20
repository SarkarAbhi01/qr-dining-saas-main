import { Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

import { downloadCsv, buildReportPrintHtml } from '@/utils/reportExport';
import { printReceipt } from '@/utils/print';

/**
 * `rows` should already be a flat array of plain objects with
 * human-readable keys (used directly as both CSV headers and printed
 * table columns) — build that shape at the call site from whatever
 * state the report section already has.
 *
 * `excelEnabled` (default true) hides the Excel/CSV download button
 * when SuperAdmin has switched Restaurant.excelExportEnabled off for
 * this restaurant — see Reports.jsx, which fetches that flag once via
 * restaurantApi.getPermissions() and passes it down to every instance
 * of this component on the page. Print/PDF stays available either way
 * — the toggle is specifically about the raw data export.
 */
export default function ReportDownloadButtons({ title, rows, excelEnabled = true }) {
  function handleCsv() {
    const ok = downloadCsv(title, rows);
    if (!ok) toast.error('Nothing to export yet for this period');
  }

  function handlePrint() {
    if (!rows || rows.length === 0) {
      toast.error('Nothing to export yet for this period');
      return;
    }
    printReceipt(buildReportPrintHtml(title, rows));
  }

  return (
    <div className="flex items-center gap-1">
      {excelEnabled && (
        <button onClick={handleCsv} title="Download CSV" className="text-slate hover:text-ink p-1">
          <Download size={14} />
        </button>
      )}
      <button onClick={handlePrint} title="Print / Save as PDF" className="text-slate hover:text-ink p-1">
        <Printer size={14} />
      </button>
    </div>
  );
}
