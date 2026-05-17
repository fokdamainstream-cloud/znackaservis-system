import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function StockDeliveryForm() {
  const navigate = useNavigate();
  const [orderNeeds, setOrderNeeds] = useState([]);
  const [partners, setPartners] = useState([]);
  const [rentalItems, setRentalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingList, setPickingList] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/order-needs/'),
      api.get('/partners/'),
      api.get('/rental-items/'),
    ]).then(([needsRes, partnersRes, rentalRes]) => {
      const active = needsRes.data.filter(n => n.status !== 'done');
      setOrderNeeds(active);
      setPartners(partnersRes.data);
      setRentalItems(rentalRes.data.filter(r => !r.is_component));
      setRows(active.map(n => ({
        order_need_id: n.id,
        item_id: n.item_detail?.id || null,
        item_name: n.item_name,
        mj: n.mj,
        total_needed: n.total_qty_needed,
        remaining: n.remaining_qty,
        stock_qty: n.item_detail?.quantity ?? '—',
        quantity_received: '',
        purchase_price: '',
        target_stock: 'sale',
        rental_item_target_id: null,
      })));
    }).finally(() => setLoading(false));
  }, []);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSubmit = async () => {
    const itemsToSend = rows.filter(r => r.quantity_received && parseFloat(r.quantity_received) > 0);
    if (itemsToSend.length === 0) {
      alert('Zadajte aspoň jedno množstvo na príjem');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplier_id: supplierId || null,
        supplier_name: supplierName,
        supplier_invoice_number: invoiceNumber,
        delivery_date: deliveryDate,
        notes,
        items: itemsToSend.map(r => ({
          order_need_id: r.order_need_id,
          item_id: r.item_id,
          item_name: r.item_name,
          mj: r.mj,
          quantity_received: parseFloat(r.quantity_received),
          purchase_price: parseFloat(r.purchase_price) || 0,
          target_stock: r.target_stock || 'sale',
          rental_item_target_id: r.rental_item_target_id || null,
        })),
      };
      const res = await api.post('/order-needs/receive/', payload);
      setPickingList(res.data.picking_list);
    } catch (e) {
      alert(e.response?.data?.error || 'Chyba pri naskladnení');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam…</div>;

  if (pickingList) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Rozdeľovník pre sklad</h1>
          <button onClick={() => navigate('/order-needs')} className="btn-primary">✓ Hotovo</button>
        </div>
        <div className="card p-6 mb-4 bg-green-50 border border-green-200">
          <p className="text-green-800 font-medium mb-1">✓ Dodávka úspešne naskladnená</p>
          <p className="text-green-700 text-sm">Nižšie je rozdeľovník – koľko kusov ísť kde uložiť.</p>
        </div>
        <div className="space-y-4">
          {pickingList.map((item, i) => (
            <div key={i} className="card p-4">
              <div className="font-semibold text-gray-900 mb-2">{item.item_name} – celkom {item.qty_received} {item.mj}</div>
              {item.project_allocations.length > 0 && (
                <div className="space-y-1 mb-2">
                  {item.project_allocations.map((a, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></span>
                      <span className="font-medium">{a.quantity} {a.mj}</span>
                      <span className="text-gray-600">→ {a.project_number} {a.project_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {item.free_stock > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></span>
                  <span className="font-medium">{item.free_stock} {item.mj}</span>
                  <span className="text-gray-600">→ Voľný sklad</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Naskladniť dodávku</h1>
        <button onClick={() => navigate('/order-needs')} className="btn-secondary">← Späť</button>
      </div>

      <div className="card p-5 mb-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dodávateľ</label>
            <select className="input w-full" value={supplierId}
              onChange={e => {
                setSupplierId(e.target.value);
                const p = partners.find(x => x.id === parseInt(e.target.value));
                if (p) setSupplierName(p.name);
              }}>
              <option value="">— vybrať dodávateľa —</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Číslo faktúry dodávateľa</label>
            <input className="input w-full" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="napr. 2026/0123" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dátum príjmu</label>
            <input type="date" className="input w-full" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poznámka</label>
            <input className="input w-full" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">Žiadne položky na objednanie</div>
      ) : (
        <div className="card overflow-hidden mb-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Položka</th>
                  <th className="px-4 py-3 text-right font-medium">Potreba</th>
                  <th className="px-4 py-3 text-right font-medium">Na sklade</th>
                  <th className="px-4 py-3 text-right font-medium w-28">Prijímam</th>
                  <th className="px-4 py-3 text-right font-medium w-32">Nák. cena/ks (€)</th>
                  <th className="px-4 py-3 text-center font-medium">Cieľ</th>
                  <th className="px-4 py-3 text-center font-medium">MJ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={row.order_need_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.item_name}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">{row.remaining}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.stock_qty}</td>
                    <td className="px-4 py-3">
                      <input type="number" min="0" step="0.001"
                        className="input w-full text-right"
                        value={row.quantity_received}
                        onChange={e => updateRow(idx, 'quantity_received', e.target.value)}
                        placeholder="0" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min="0" step="0.01"
                        className="input w-full text-right"
                        value={row.purchase_price}
                        onChange={e => updateRow(idx, 'purchase_price', e.target.value)}
                        placeholder="0.00" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <select value={row.target_stock || 'sale'}
                          onChange={e => updateRow(idx, 'target_stock', e.target.value)}
                          className="input w-full text-xs">
                          <option value="sale">📦 Sklad (Predaj)</option>
                          <option value="rental">🔑 Požičovňa</option>
                        </select>
                        {row.target_stock === 'rental' && (
                          <select value={row.rental_item_target_id || ''}
                            onChange={e => updateRow(idx, 'rental_item_target_id', e.target.value || null)}
                            className="input w-full text-xs">
                            <option value="">— vybrať položku požičovne —</option>
                            {rentalItems.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{row.mj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/order-needs')} className="btn-secondary">Zrušiť</button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary">
          {saving ? 'Naskladňujem…' : '✓ Naskladniť a zobraziť rozdeľovník'}
        </button>
      </div>
    </div>
  );
}
