import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { DatabaseBackup, Download } from 'lucide-react';

import { superadminApi } from '@/api/superadmin';
import { useSocket } from '@/sockets/useSocket';
import { downloadBlob } from '@/utils/reportExport';

const FORMAT_STYLE = {
  EXCEL: 'bg-basil-soft text-basil',
  PDF: 'bg-chili-soft text-chili',
  TXT: 'bg-paper-dim text-ink',
  SQL: 'bg-cobalt-soft text-cobalt',
};

// A person may opt into having every new archive save to disk the
// instant it's created — the closest a browser can get to "SuperAdmin
// side downloads the .bak automatically" without the person having
// clicked anything first. Off by default so a busy platform admin
// isn't bombarded with save dialogs; the list below always updates
// live regardless via the same `backup:created` event.
export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(() => {
    superadminApi
      .listBackups()
      .then(setBackups)
      .catch(() => toast.error('Failed to load backups'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleDownload = useCallback(async (backup) => {
    setDownloadingId(backup.id);
    try {
      const blob = await superadminApi.downloadBackupArchive(backup.id);
      downloadBlob(blob, backup.bakFileName);
    } catch (err) {
      toast.error('Failed to download archive');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  useSocket({
    'backup:created': (backup) => {
      setBackups((prev) => [backup, ...prev]);
      toast(`${backup.restaurant?.name || 'A restaurant'} just backed up their data`, {
        icon: '🗄️',
      });
      if (autoDownload) handleDownload(backup);
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">Backups</h1>
        <label className="flex items-center gap-2 text-xs text-slate cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoDownload}
            onChange={(e) => setAutoDownload(e.target.checked)}
            className="accent-basil"
          />
          Auto-download new archives while I'm on this page
        </label>
      </div>
      <p className="text-sm text-slate mb-6">
        Every time an Owner backs up their data, an archival <code>.bak</code> copy — named{' '}
        <code>ownername_date.bak</code> — lands here automatically, independent of whatever format
        they exported for themselves.
      </p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : backups.length === 0 ? (
        <p className="text-sm text-slate">No backups yet — they'll show up here as Owners create them.</p>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div
              key={b.id}
              className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-paper-dim flex items-center justify-center shrink-0">
                  <DatabaseBackup size={16} className="text-slate" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{b.restaurant?.name || 'Unknown restaurant'}</p>
                  <p className="text-xs text-slate truncate">
                    {b.bakFileName} · requested by {b.requestedBy?.name || 'Owner'} ·{' '}
                    {new Date(b.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${FORMAT_STYLE[b.format] || 'bg-paper-dim text-ink'}`}>
                  {b.format}
                </span>
                <button
                  onClick={() => handleDownload(b)}
                  disabled={downloadingId === b.id}
                  className="flex items-center gap-1.5 border border-line rounded px-3 py-1.5 text-xs font-medium hover:border-ink disabled:opacity-50"
                >
                  <Download size={13} /> {downloadingId === b.id ? 'Downloading…' : '.bak'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
