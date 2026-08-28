import { useEffect, useRef, useState } from 'react';
import { Plus, Layers, Download, Link as LinkIcon, Trash2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';

import { restaurantApi } from '@/api/restaurant';
import Modal from '@/components/Modal';
import { useSocket } from '@/sockets/useSocket';

const STATUS_STYLES = {
  EMPTY: 'bg-basil-soft text-basil',
  OCCUPIED: 'bg-chili-soft text-chili',
  NEEDS_ATTENTION: 'bg-saffron/20 text-saffron-dark',
  RESERVED: 'bg-cobalt-soft text-cobalt',
};

// QR is rendered right here in the browser rather than relying on a
// backend-generated image. That means it encodes whatever origin the
// Owner is currently viewing the dashboard from — localhost while
// developing, the live domain once deployed — automatically, correctly,
// with no environment config to get wrong.
function TableQrCard({ table, onDelete }) {
  const canvasRef = useRef(null);
  // Defensive: tables created before this fix may still have a full URL
  // (e.g. "http://localhost:5173/order/...") saved from the old backend
  // behavior. Only prepend the current origin if it isn't one already.
  const fullUrl = /^https?:\/\//.test(table.qrCodeUrl)
    ? table.qrCodeUrl
    : `${window.location.origin}${table.qrCodeUrl}`;

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `table-${table.tableNumber}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Order link copied');
  }

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2 text-center">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-ink font-semibold">{table.tableNumber}</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[table.status]}`}>
          {table.status.replace('_', ' ')}
        </span>
      </div>
      <div ref={canvasRef} className="bg-white border border-line rounded p-2 mb-2 mx-auto w-fit">
        <QRCodeCanvas value={fullUrl} size={112} bgColor="#FFFFFF" fgColor="#1C1B1A" level="M" />
      </div>
      <p className="text-xs text-slate mb-1">Seats {table.capacity}</p>
      <p className="text-[10px] text-slate/70 font-mono truncate mb-3" title={fullUrl}>
        {fullUrl.replace(/^https?:\/\//, '')}
      </p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={handleDownload} className="text-xs text-cobalt hover:underline flex items-center gap-1">
          <Download size={12} /> Download
        </button>
        <button onClick={handleCopyLink} className="text-slate hover:text-ink" title="Copy order link">
          <LinkIcon size={13} />
        </button>
        <button onClick={() => onDelete(table.id)} className="text-slate hover:text-chili" title="Delete table">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [singleOpen, setSingleOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [singleForm, setSingleForm] = useState({ tableNumber: '', capacity: 4 });
  const [bulkForm, setBulkForm] = useState({ prefix: 'T', startAt: 1, count: 10, capacity: 4 });

  async function load() {
    setLoading(true);
    try {
      setTables(await restaurantApi.listTables());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Table status (e.g. OCCUPIED -> EMPTY the moment a bill is fully
  // paid) updates live here rather than only after a manual refresh.
  useSocket({
    'table:update': (updated) => {
      setTables((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    },
  });

  async function handleCreateSingle(e) {
    e.preventDefault();
    try {
      await restaurantApi.createTable(singleForm);
      toast.success('Table created');
      setSingleOpen(false);
      setSingleForm({ tableNumber: '', capacity: 4 });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create table');
    }
  }

  async function handleCreateBulk(e) {
    e.preventDefault();
    try {
      const created = await restaurantApi.bulkCreateTables(bulkForm);
      toast.success(`${created.length} tables created`);
      setBulkOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to bulk-create tables');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this table? Its QR code will stop working.')) return;
    try {
      await restaurantApi.deleteTable(id);
      toast.success('Table deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete table');
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate">Loading tables…</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink mb-1">Tables &amp; QR Codes</h1>
          <p className="text-sm text-slate">
            Each QR opens straight to <span className="font-mono">{window.location.origin}</span> — scan it
            from any device on this network while testing, or once deployed it'll automatically point at your
            live domain instead.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-1.5 border border-line rounded px-3 py-2 text-sm font-medium hover:border-ink transition-colors"
          >
            <Layers size={15} /> Bulk generate
          </button>
          <button
            onClick={() => setSingleOpen(true)}
            className="staff-menu-btn flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add table
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tables.map((t) => (
          <TableQrCard key={t.id} table={t} onDelete={handleDelete} />
        ))}
        {tables.length === 0 && (
          <p className="text-sm text-slate col-span-full">No tables yet — add your first one above.</p>
        )}
      </div>

      {/* --- Single table modal --- */}
      <Modal open={singleOpen} onClose={() => setSingleOpen(false)} title="New table">
        <form onSubmit={handleCreateSingle} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Table number / name</label>
            <input
              required
              value={singleForm.tableNumber}
              onChange={(e) => setSingleForm((f) => ({ ...f, tableNumber: e.target.value }))}
              placeholder="e.g. T12 or Patio-3"
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Capacity</label>
            <input
              type="number"
              min="1"
              value={singleForm.capacity}
              onChange={(e) => setSingleForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium">
            Create table &amp; generate QR
          </button>
        </form>
      </Modal>

      {/* --- Bulk generate modal --- */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk generate tables">
        <form onSubmit={handleCreateBulk} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Prefix</label>
              <input
                value={bulkForm.prefix}
                onChange={(e) => setBulkForm((f) => ({ ...f, prefix: e.target.value }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Start at</label>
              <input
                type="number"
                min="1"
                value={bulkForm.startAt}
                onChange={(e) => setBulkForm((f) => ({ ...f, startAt: Number(e.target.value) }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">How many</label>
              <input
                type="number"
                min="1"
                max="200"
                value={bulkForm.count}
                onChange={(e) => setBulkForm((f) => ({ ...f, count: Number(e.target.value) }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Capacity each</label>
              <input
                type="number"
                min="1"
                value={bulkForm.capacity}
                onChange={(e) => setBulkForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate">
            Will create {bulkForm.prefix}{bulkForm.startAt} through {bulkForm.prefix}
            {bulkForm.startAt + bulkForm.count - 1}.
          </p>
          <button type="submit" className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium">
            Generate {bulkForm.count} tables
          </button>
        </form>
      </Modal>
    </div>
  );
}
