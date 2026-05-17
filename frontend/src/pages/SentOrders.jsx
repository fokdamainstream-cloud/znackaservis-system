import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useUser } from '../context/UserContext';

/* ─── constants ─────────────────────────────────────────────────── */
const STATUS_LABELS = {
  sent: 'Odoslaná',
  partial: 'Čiastočne',
  done: 'Naskladnené',
};
const STATUS_COLORS = {
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-orange-100 text-orange-700',
  done: 'bg-green-100 text-green-700',
};

const fmt = s => s ? new Date(s).toLocaleDateString('sk-SK') : '—';
const fmtLong = s => s ? new Date(s).toLocaleDateString('sk-SK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const fmtEur = n => (n || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/* ─── StatCard ───────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${colors[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-0.5">{label}</div>
        <div className="text-xl font-bold truncate">{value}</div>
        {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── ProgressBar ────────────────────────────────────────────────── */
function ProgressBar({ pct }) {
  const w = Math.min(100, Math.max(0, pct));
  const color = w >= 100 ? 'bg-green-500' : w > 0 ? 'bg-orange-400' : 'bg-gray-200';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-9 text-right">{w.toFixed(0)}%</span>
    </div>
  );
}

/* ─── ReceiveModal ───────────────────────────────────────────────── */
function ReceiveModal({ order, rentalItems, onClose, onDone }) {
  const [rows, setRows] = useState(
    (order.items || []).filter(i => parseFloat(i.remaining_qty) > 0).map(i => ({
      sent_order_item_id: i.id,
      item_name: i.item_name,
      mj: i.mj,
      remaining: i.remaining_qty,
      item_detail: i.item_detail,
      quantity_received: '',
      purchase_price: i.unit_price > 0 ? String(i.unit_price) : '',
      target_stock: i.item_detail ? 'sale' : 'rental',
      rental_item_target_id: '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (idx, field, val) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const handleSubmit = async () => {
    const toSend = rows.filter(r => r.quantity_received && parseFloat(r.quantity_received) > 0);
    if (!toSend.length) { setError('Zadajte aspoň jedno množstvo'); return; }
    setSaving(true);
    try {
      await api.post(`/sent-orders/${order.id}/receive/`, {
        items: toSend.map(r => ({
          sent_order_item_id: r.sent_order_item_id,
          quantity_received: parseFloat(r.quantity_received),
          purchase_price: parseFloat(r.purchase_price) || 0,
          target_stock: r.target_stock,
          rental_item_target_id: r.rental_item_target_id || null,
        })),
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Naskladniť – {order.order_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {error && <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        <div className="p-5 space-y-3">
          {rows.map((row, idx) => (
            <div key={row.sent_order_item_id} className="border border-gray-100 rounded-lg p-3 space-y-2">
              <div className="font-medium text-sm text-gray-900">{row.item_name}
                <span className="text-gray-400 text-xs ml-2">zostatok: {row.remaining} {row.mj}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Prijímam ({row.mj})</label>
                  <input type="number" min="0" step="0.001" value={row.quantity_received}
                    onChange={e => update(idx, 'quantity_received', e.target.value)}
                    className="input text-sm w-full text-right" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Nák. cena/ks (€)</label>
                  <input type="number" min="0" step="0.01" value={row.purchase_price}
                    onChange={e => update(idx, 'purchase_price', e.target.value)}
                    className="input text-sm w-full text-right" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Cieľ</label>
                  <select value={row.target_stock} onChange={e => update(idx, 'target_stock', e.target.value)} className="input text-sm w-full">
                    <option value="sale">📦 Sklad</option>
                    <option value="rental">🔑 Požičovňa</option>
                  </select>
                </div>
              </div>
              {row.target_stock === 'rental' && (
                <select value={row.rental_item_target_id} onChange={e => update(idx, 'rental_item_target_id', e.target.value)} className="input text-sm w-full">
                  <option value="">— vybrať položku požičovne —</option>
                  {rentalItems.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Zrušiť</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Naskladňujem…' : '✓ Potvrdiť príjem'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── DropZone ───────────────────────────────────────────────────── */
function DropZone({ orderId, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/sent-orders/${orderId}/upload_attachment/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      onUploaded();
    } catch { alert('Chyba pri nahrávaní súboru'); }
    finally { setUploading(false); }
  }, [orderId, onUploaded]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden"
        onChange={e => handleFiles(e.target.files)} />
      {uploading
        ? <p className="text-sm text-blue-600">Nahrávam…</p>
        : <>
          <p className="text-xl mb-1">📎</p>
          <p className="text-sm font-medium text-gray-700">Pretiahnite súbory sem alebo kliknite</p>
          <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG – potvrdzovacie emaily, naskenované dodáky</p>
        </>}
    </div>
  );
}

/* ─── PdfPreview ─────────────────────────────────────────────────── */
function PdfPreview({ order }) {
  const handlePrint = () => {
    const w = window.open('', '_blank');
    const content = document.getElementById('pdf-content-' + order.id)?.innerHTML || '';
    w.document.write(`<html><head><title>${order.order_number}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;padding:30px;color:#111}
        .logo{font-size:20px;font-weight:bold;color:#1d4ed8}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e5e7eb}
        td{padding:6px 10px;border-bottom:1px solid #e5e7eb}
        .footer{margin-top:40px;font-size:10px;color:#6b7280}
        @media print{button{display:none}}
      </style></head><body>${content}</body></html>`);
    w.document.close(); w.print();
  };

  const totalVal = (order.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Náhľad PDF</span>
        <button onClick={handlePrint} className="btn-secondary text-xs">🖨 PDF</button>
      </div>
      <div id={`pdf-content-${order.id}`} className="p-5 text-sm">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-xl font-bold text-blue-700">ZnačkaServis</div>
            <div className="text-xs text-gray-500">Značka servis s.r.o.</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{order.order_number}</div>
            <div className="text-xs text-gray-500">Odoslaná objednávka · {fmtLong(order.created_at)}</div>
            {order.expected_date && <div className="text-xs text-orange-600 font-medium">Termín: {fmt(order.expected_date)}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Dodávateľ</div>
            <div className="font-medium">{order.supplier_name || '—'}</div>
            {order.supplier_detail?.ico && <div className="text-xs text-gray-500">IČO: {order.supplier_detail.ico}</div>}
            {order.supplier_detail?.street && <div className="text-xs text-gray-500">{order.supplier_detail.street}, {order.supplier_detail.zip_code} {order.supplier_detail.city}</div>}
          </div>
          {order.project_detail && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Pre zákazku</div>
              <div className="font-medium text-blue-700">{order.project_detail.project_number}</div>
              <div className="text-xs text-gray-500">{order.project_detail.name}</div>
            </div>
          )}
        </div>
        {order.notes && <div className="mb-4 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs">{order.notes}</div>}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1.5 text-left border border-gray-200">#</th>
              <th className="px-2 py-1.5 text-left border border-gray-200">Položka</th>
              <th className="px-2 py-1.5 text-right border border-gray-200">Množstvo</th>
              <th className="px-2 py-1.5 text-center border border-gray-200">MJ</th>
              <th className="px-2 py-1.5 text-right border border-gray-200">Cena/ks</th>
              <th className="px-2 py-1.5 text-right border border-gray-200">Spolu</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{i + 1}</td>
                <td className="px-2 py-1.5 border border-gray-200 font-medium">
                  {item.item_detail?.sign_code && <span className="font-mono text-blue-600 mr-1.5">{item.item_detail.sign_code}</span>}
                  {item.item_name}
                </td>
                <td className="px-2 py-1.5 border border-gray-200 text-right">{item.quantity}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-center">{item.mj}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-right">{parseFloat(item.unit_price) > 0 ? parseFloat(item.unit_price).toFixed(2) + ' €' : '—'}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-right font-semibold">{item.line_total > 0 ? item.line_total.toFixed(2) + ' €' : '—'}</td>
              </tr>
            ))}
          </tbody>
          {totalVal > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="px-2 py-2 border border-gray-200 text-right">Celkom bez DPH:</td>
                <td className="px-2 py-2 border border-gray-200 text-right text-blue-700">{totalVal.toFixed(2)} €</td>
              </tr>
            </tfoot>
          )}
        </table>
        <div className="mt-6 pt-3 border-t border-gray-200 text-xs text-gray-400">
          Vygenerované systémom ZnačkaServis · {fmtLong(new Date().toISOString())}
        </div>
      </div>
    </div>
  );
}

/* ─── Drawer (slide-over from right) ────────────────────────────── */
function Drawer({ order, rentalItems, onClose, onRefresh, onDelete }) {
  const [showReceive, setShowReceive] = useState(false);
  const [tab, setTab] = useState('detail'); // 'detail' | 'pdf' | 'files'
  const { isOwner } = useUser();

  const deleteAtt = async (attId) => {
    await api.delete(`/sent-orders/${order.id}/attachments/${attId}/`);
    onRefresh();
  };

  // Profit line (hidden admin info)
  const totalCost = (order.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-40 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-blue-700 text-base">{order.order_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-800 mt-0.5">{order.supplier_name || '—'}</div>
            {order.project_detail && (
              <div className="text-xs text-blue-600">{order.project_detail.project_number} – {order.project_detail.name}</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {order.status !== 'done' && (
              <button onClick={() => setShowReceive(true)} className="btn-primary text-xs">✓ Naskladniť</button>
            )}
            <button onClick={() => onDelete(order.id)} className="text-red-400 hover:text-red-600 text-xs border border-red-200 rounded px-2 py-1">Vymazať</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-1">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 px-5">
          {[['detail', '📋 Položky'], ['pdf', '🖨 PDF náhľad'], ['files', '📎 Prílohy']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {l}
              {k === 'files' && order.attachments?.length > 0 && (
                <span className="ml-1 bg-gray-200 text-gray-600 text-xs rounded-full px-1.5">{order.attachments.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'detail' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-gray-500 block">Vystavená</span>{fmt(order.created_at)}</div>
                <div><span className="text-xs text-gray-500 block">Očakávaný termín</span>
                  {order.expected_date
                    ? <span className={new Date(order.expected_date) < new Date() && order.status !== 'done' ? 'text-red-600 font-semibold' : ''}>{fmt(order.expected_date)}</span>
                    : '—'}
                </div>
              </div>
              {order.notes && <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-gray-700 italic">{order.notes}</div>}

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Položka</th>
                    <th className="px-3 py-2 text-right">Obj.</th>
                    <th className="px-3 py-2 text-right">Prijato</th>
                    <th className="px-3 py-2 text-right">Cena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items?.map((item, i) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        {item.item_detail?.sign_code && <span className="font-mono text-blue-600 text-xs mr-1.5">{item.item_detail.sign_code}</span>}
                        <span className="font-medium">{item.item_name}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{item.quantity} {item.mj}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={parseFloat(item.qty_received) >= parseFloat(item.quantity) ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                          {item.qty_received} {item.mj}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 text-xs">
                        {item.unit_price > 0 ? parseFloat(item.unit_price).toFixed(2) + ' €' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isOwner && totalCost > 0 && (
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-semibold text-gray-800">
                  <span>Celkom bez DPH:</span>
                  <span className="text-blue-700">{fmtEur(totalCost)}</span>
                </div>
              )}
            </div>
          )}

          {tab === 'pdf' && <PdfPreview order={order} />}

          {tab === 'files' && (
            <div className="space-y-3">
              {order.attachments?.length > 0 && (
                <div className="space-y-1.5">
                  {order.attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📄</span>
                        <div>
                          <div className="font-medium text-gray-800">{att.original_name}</div>
                          <div className="text-xs text-gray-400">{fmt(att.uploaded_at)} · {Math.round(att.file_size / 1024)} KB</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {att.file_url && <a href={att.file_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 text-xs">Otvoriť</a>}
                        <button onClick={() => deleteAtt(att.id)} className="text-red-400 hover:text-red-600 text-xs">Vymazať</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <DropZone orderId={order.id} onUploaded={onRefresh} />
            </div>
          )}
        </div>

        {/* Admin profit footer */}
        {isOwner && totalCost > 0 && (
          <div className="border-t border-dashed border-gray-200 px-5 py-3 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-mono">🔒 Interné – obstarávacia hodnota dokladu</span>
              <span className="font-bold text-gray-700">{fmtEur(totalCost)}</span>
            </div>
          </div>
        )}
      </div>

      {showReceive && (
        <ReceiveModal
          order={order}
          rentalItems={rentalItems}
          onClose={() => setShowReceive(false)}
          onDone={() => { setShowReceive(false); onRefresh(); }}
        />
      )}
    </>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function SentOrders() {
  const navigate = useNavigate();
  const { isOwner } = useUser();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('active');
  const [rentalItems, setRentalItems] = useState([]);

  const load = useCallback(() => {
    api.get('/sent-orders/').then(r => {
      setOrders(r.data);
      if (selected) {
        const updated = r.data.find(o => o.id === selected.id);
        setSelected(updated || null);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    load();
    api.get('/sent-orders/stats/').then(r => setStats(r.data)).catch(() => {});
    api.get('/rental-items/').then(r => setRentalItems(r.data.filter(x => !x.is_component))).catch(() => {});
  }, []);

  const displayed = orders.filter(o => {
    if (filter === 'active') return o.status !== 'done';
    if (filter === 'done') return o.status === 'done';
    return true;
  });

  const deleteOrder = async (id) => {
    if (!confirm('Naozaj vymazať túto objednávku?')) return;
    await api.delete(`/sent-orders/${id}/`);
    setSelected(null);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam…</div>;

  return (
    <div>
      {/* Stats cards – len pre majiteľa */}
      {isOwner && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon="💰" label="Celkový obrat" value={fmtEur(stats.total_turnover)} sub="suma všetkých faktúr (bez DPH)" color="blue" />
          <StatCard icon="📈" label="Reálny zisk" value={fmtEur(stats.real_profit)}
            sub={`po odpočítaní nákup. nákladov`}
            color={stats.real_profit >= 0 ? 'green' : 'orange'} />
          <StatCard icon="🔑" label="Hodnota v prenájme" value={fmtEur(stats.rental_value)} sub="otvorené nájmy (dnes)" color="purple" />
          <StatCard icon="🏭" label="Sklad v nákupe" value={fmtEur(stats.stock_purchase_value)} sub="suma zásob × nák. cena" color="gray" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Odoslané objednávky</h1>
          <p className="text-xs text-gray-400 mt-0.5">{displayed.length} záznamov</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/order-needs/receive')} className="btn-secondary text-sm">📦 BOM príjem</button>
          <button onClick={() => navigate('/order-needs/new')} className="btn-primary text-sm">+ Nová OO</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[['active', 'Aktívne'], ['done', 'Naskladnené'], ['all', 'Všetky']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-2">Žiadne odoslané objednávky</p>
          <button onClick={() => navigate('/order-needs/new')} className="btn-primary mt-2">Vytvoriť prvú OO</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Číslo OO</th>
                  <th className="px-4 py-3 text-left font-medium">Dodávateľ</th>
                  <th className="px-4 py-3 text-left font-medium">Vystavená</th>
                  <th className="px-4 py-3 text-left font-medium">Termín</th>
                  <th className="px-4 py-3 text-center font-medium">Pol.</th>
                  <th className="px-4 py-3 text-right font-medium">Hodnota</th>
                  <th className="px-4 py-3 font-medium w-40">Naskladnenie</th>
                  <th className="px-4 py-3 text-center font-medium">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(o => {
                  const isOverdue = o.expected_date && new Date(o.expected_date) < new Date() && o.status !== 'done';
                  return (
                    <tr key={o.id}
                      onClick={() => setSelected(selected?.id === o.id ? null : o)}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${selected?.id === o.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">{o.order_number}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {o.supplier_name || '—'}
                        {o.project_detail && <div className="text-xs text-gray-400">{o.project_detail.project_number}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmt(o.created_at)}</td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {o.expected_date ? fmt(o.expected_date) : '—'}
                        {isOverdue && <span className="ml-1">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{o.items_count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">
                        {o.total_value > 0 ? fmtEur(o.total_value) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 w-40">
                        <ProgressBar pct={o.received_pct || 0} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <Drawer
          order={selected}
          rentalItems={rentalItems}
          onClose={() => setSelected(null)}
          onRefresh={load}
          onDelete={deleteOrder}
        />
      )}
    </div>
  );
}
