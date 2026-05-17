import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useUser } from '../context/UserContext';

const formatDate = s => s ? new Date(s).toLocaleDateString('sk-SK') : '—';
const fmt = n => typeof n === 'number' ? n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const STATUS_LABELS = { open: 'Otvorená', done: 'Dokončená', invoiced: 'Fakturovaná' };
const STATUS_COLORS = { open: 'bg-blue-100 text-blue-700', done: 'bg-gray-100 text-gray-600', invoiced: 'bg-green-100 text-green-700' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isOwner } = useUser();
  const [project, setProject] = useState(null);
  const [docs, setDocs] = useState({ invoices: [], quotations: [], delivery_notes: [] });
  const [rental, setRental] = useState({ items: [] });
  const [margin, setMargin] = useState(null);
  const [bom, setBom] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closingRental, setClosingRental] = useState(false);

  // BOM form
  const [showBomForm, setShowBomForm] = useState(false);
  const [stockItems, setStockItems] = useState([]);
  const [bomForm, setBomForm] = useState({ item_id: '', item_name: '', quantity_needed: 1, mj: 'ks', notes: '' });
  const [bomQuery, setBomQuery] = useState('');
  const [bomDropdown, setBomDropdown] = useState([]);
  const [savingBom, setSavingBom] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${id}/`),
      api.get(`/projects/${id}/linked_docs/`),
      api.get(`/projects/${id}/rental_summary/`),
      api.get(`/projects/${id}/margin/`),
      api.get(`/projects/${id}/bom/`),
      api.get('/items/'),
    ]).then(([pRes, docsRes, rentalRes, marginRes, bomRes, itemsRes]) => {
      setProject(pRes.data);
      setDocs(docsRes.data);
      setRental(rentalRes.data);
      setMargin(marginRes.data);
      setBom(bomRes.data);
      setStockItems(itemsRes.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleBomQuery = (q) => {
    setBomQuery(q);
    setBomForm(f => ({ ...f, item_name: q, item_id: '' }));
    if (q.length > 0) {
      const lq = q.toLowerCase();
      const filtered = stockItems.filter(i =>
        i.name.toLowerCase().includes(lq) ||
        i.sku?.toLowerCase().includes(lq) ||
        i.sign_code?.toLowerCase().includes(lq)
      );
      setBomDropdown(filtered.slice(0, 10));
    } else {
      // Prázdny dotaz – ukáž prvých 10 zo skladu
      setBomDropdown(stockItems.slice(0, 10));
    }
  };

  const handleBomFocus = () => {
    if (bomQuery.length === 0) {
      setBomDropdown(stockItems.slice(0, 10));
    }
  };

  const selectBomItem = (item) => {
    setBomForm(f => ({ ...f, item_id: item.id, item_name: item.name, mj: 'ks' }));
    setBomQuery(item.name);
    setBomDropdown([]);
  };

  const addBomItem = async () => {
    if (!bomForm.item_name.trim()) return;
    setSavingBom(true);
    try {
      await api.post(`/projects/${id}/bom/`, bomForm);
      const [bomRes] = await Promise.all([api.get(`/projects/${id}/bom/`)]);
      setBom(bomRes.data);
      setBomForm({ item_id: '', item_name: '', quantity_needed: 1, mj: 'ks', notes: '' });
      setBomQuery('');
      setShowBomForm(false);
    } catch (e) {
      alert(e.response?.data?.error || 'Chyba');
    } finally {
      setSavingBom(false);
    }
  };

  const deleteBomItem = async (bomId) => {
    if (!confirm('Odstrániť položku z BOM?')) return;
    await api.delete(`/projects/${id}/bom/${bomId}/`);
    setBom(prev => prev.filter(b => b.id !== bomId));
  };

  const handleCloseRental = async () => {
    if (!confirm('Ukončiť prenájom a pripraviť faktúru?')) return;
    setClosingRental(true);
    try {
      const res = await api.post(`/projects/${id}/close_rental/`);
      sessionStorage.setItem('rentalInvoicePrefill', JSON.stringify(res.data));
      navigate(`/invoices/new?from_rental=1`);
    } catch (e) {
      alert('Chyba pri ukončení prenájmu');
    } finally {
      setClosingRental(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam zákazku…</div>;
  if (!project) return <div className="text-red-500 p-4">Zákazka nenájdená</div>;

  const rentalTotal = rental.items?.reduce((s, i) => s + i.total_cost, 0) || 0;
  const missingBom = bom.filter(b => b.stock_qty !== null && b.stock_qty < parseFloat(b.quantity_needed));
  const unknownBom = bom.filter(b => b.stock_qty === null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {project.project_number && (
              <span className="font-mono text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.project_number}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[project.status] || project.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {(project.partner_detail?.name || project.partner_name) && (
            <p className="text-gray-500 mt-1">{project.partner_detail?.name || project.partner_name}</p>
          )}
          {project.notes && <p className="text-sm text-gray-500 mt-1 italic">{project.notes}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/delivery-notes/new?project=${id}`)} className="btn-secondary text-sm">
            + Dodací list
          </button>
          <button onClick={() => navigate(`/projects/${id}/edit`)} className="btn-secondary text-sm">✏ Upraviť</button>
        </div>
      </div>

      {/* MARGIN OVERVIEW – len pre majiteľa */}
      {isOwner && margin && (
        <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Obrat (fakturovaný)</div>
            <div className="text-lg font-bold text-gray-900">{fmt(margin.invoice_revenue)} €</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Prenájom (priebežne)</div>
            <div className="text-lg font-bold text-green-700">{fmt(margin.rental_revenue)} €</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nákupné náklady</div>
            <div className="text-lg font-bold text-red-600">{fmt(margin.total_cost)} €</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Čistá marža</div>
            <div className={`text-lg font-bold ${margin.margin_net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmt(margin.margin_net)} € <span className="text-sm font-normal">({margin.margin_pct}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* GRAY: POTREBNÝ MATERIÁL (BOM) */}
      <div className="card border-l-4 border-gray-400">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">📋 Potrebný materiál (BOM)</h2>
          <button onClick={() => setShowBomForm(f => !f)} className="btn-secondary text-xs">
            {showBomForm ? 'Zrušiť' : '+ Pridať položku'}
          </button>
        </div>

        {showBomForm && (
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="relative col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Položka / názov</label>
                <input className="input w-full" value={bomQuery}
                  onChange={e => handleBomQuery(e.target.value)}
                  onFocus={handleBomFocus}
                  onBlur={() => setTimeout(() => setBomDropdown([]), 150)}
                  placeholder="Hľadať v sklade alebo zadať ručne…" />
                {bomDropdown.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {bomDropdown.map(item => (
                      <div key={item.id} onClick={() => selectBomItem(item)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm">
                        <span className="font-medium">{item.name}</span>
                        {item.sku && <span className="text-gray-400 ml-2 text-xs">{item.sku}</span>}
                        <span className="text-gray-500 ml-2 text-xs">sklad: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Množstvo</label>
                <input type="number" min="0.001" step="0.001" className="input w-full"
                  value={bomForm.quantity_needed}
                  onChange={e => setBomForm(f => ({ ...f, quantity_needed: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">MJ</label>
                <input className="input w-full" value={bomForm.mj}
                  onChange={e => setBomForm(f => ({ ...f, mj: e.target.value }))} />
              </div>
            </div>
            <button onClick={addBomItem} disabled={savingBom} className="btn-primary text-sm">
              {savingBom ? 'Ukladám…' : '+ Pridať do BOM'}
            </button>
          </div>
        )}

        {bom.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Žiadne BOM položky. Pridajte materiál pre túto zákazku.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-2 text-left font-medium">Položka</th>
                  <th className="px-4 py-2 text-right font-medium">Potreba</th>
                  <th className="px-4 py-2 text-right font-medium">Na sklade</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bom.map(b => {
                  const onStock = b.stock_qty !== null && parseFloat(b.stock_qty) >= parseFloat(b.quantity_needed);
                  const noStock = b.stock_qty === null;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{b.item_name}</td>
                      <td className="px-4 py-2 text-right">{b.quantity_needed} {b.mj}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{b.stock_qty !== null ? `${b.stock_qty} ${b.mj}` : '—'}</td>
                      <td className="px-4 py-2 text-center">
                        {noStock ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Bez väzby</span>
                        ) : onStock ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Na sklade</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Chýba</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => deleteBomItem(b.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RED: CHÝBAJÚCI MATERIÁL */}
      {(missingBom.length > 0 || unknownBom.length > 0) && (
        <div className="card border-l-4 border-red-400">
          <div className="p-4 border-b border-red-100 flex items-center justify-between">
            <h2 className="font-semibold text-red-700">🔴 Chýbajúci materiál – Na objednanie</h2>
            <button onClick={() => navigate('/order-needs')} className="btn-secondary text-xs">
              Zobraziť objednávky →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-red-100">
                  <th className="px-4 py-2 text-left font-medium">Položka</th>
                  <th className="px-4 py-2 text-right font-medium">Potreba</th>
                  <th className="px-4 py-2 text-right font-medium">Na sklade</th>
                  <th className="px-4 py-2 text-right font-medium">Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {missingBom.map(b => (
                  <tr key={b.id} className="hover:bg-red-50">
                    <td className="px-4 py-2 text-gray-900">{b.item_name}</td>
                    <td className="px-4 py-2 text-right">{b.quantity_needed} {b.mj}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{b.stock_qty}</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">
                      {(parseFloat(b.quantity_needed) - parseFloat(b.stock_qty)).toFixed(2)} {b.mj}
                    </td>
                  </tr>
                ))}
                {unknownBom.map(b => (
                  <tr key={b.id} className="hover:bg-red-50">
                    <td className="px-4 py-2 text-gray-900">{b.item_name}</td>
                    <td className="px-4 py-2 text-right">{b.quantity_needed} {b.mj}</td>
                    <td className="px-4 py-2 text-right text-gray-400 italic">ručná pol.</td>
                    <td className="px-4 py-2 text-right font-semibold text-yellow-600">{b.quantity_needed} {b.mj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BLUE: KLASICKÝ SKLAD – DOKLADY */}
      <div className="card border-l-4 border-blue-400">
        <div className="p-4 border-b border-blue-100">
          <h2 className="font-semibold text-blue-700">🔵 Klasický sklad – Faktúry a dodacie listy</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Faktúry */}
          {docs.invoices.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Faktúry ({docs.invoices.length})</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {docs.invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="py-2 font-mono text-blue-600">{inv.invoice_number}</td>
                      <td className="py-2 text-gray-600">{inv.partner_name}</td>
                      <td className="py-2 text-right font-semibold">{fmt(parseFloat(inv.total))} €</td>
                      <td className="py-2 text-right"><button onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="text-xs text-blue-500 hover:underline">Detail</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Cenové ponuky */}
          {docs.quotations.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cenové ponuky ({docs.quotations.length})</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {docs.quotations.map(q => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="py-2 font-mono text-gray-700">{q.quotation_number}</td>
                      <td className="py-2 text-gray-600">{q.partner_name}</td>
                      <td className="py-2 text-right font-semibold">{fmt(parseFloat(q.total))} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Dodacie listy – standard */}
          {docs.delivery_notes.filter(d => d.type === 'standard').length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dodacie listy – výdaj</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {docs.delivery_notes.filter(d => d.type === 'standard').map(dn => (
                    <tr key={dn.id} className="hover:bg-gray-50">
                      <td className="py-2 font-mono text-gray-700">{dn.delivery_note_number}</td>
                      <td className="py-2 text-gray-600">{dn.partner_name}</td>
                      <td className="py-2 text-right text-gray-500 text-xs">{dn.items?.length ?? 0} pol.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {docs.invoices.length === 0 && docs.quotations.length === 0 && docs.delivery_notes.filter(d => d.type === 'standard').length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">Žiadne doklady k zákazke</div>
          )}
        </div>
      </div>

      {/* GREEN: SKLAD POŽIČOVŇA */}
      <div className="card border-l-4 border-green-500">
        <div className="p-4 border-b border-green-100 flex items-center justify-between">
          <h2 className="font-semibold text-green-700">🟢 Sklad Požičovňa</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/delivery-notes/new?project=${id}`)} className="btn-secondary text-xs">
              + Výdaj do prenájmu
            </button>
            {rental.items?.length > 0 && (
              <button onClick={handleCloseRental} disabled={closingRental} className="btn-primary text-xs bg-green-600 hover:bg-green-700 border-green-600">
                {closingRental ? 'Uzatváram…' : '✓ Ukončiť prenájom a faktúrovať'}
              </button>
            )}
          </div>
        </div>

        {!rental.items || rental.items.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Žiadny aktívny prenájom</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-green-100">
                    <th className="px-4 py-2 text-left font-medium">Položka</th>
                    <th className="px-4 py-2 text-right font-medium">Ks</th>
                    <th className="px-4 py-2 text-right font-medium">Dátum výdaja</th>
                    <th className="px-4 py-2 text-right font-medium text-orange-600">Dní</th>
                    <th className="px-4 py-2 text-right font-medium">Sadzba/deň</th>
                    <th className="px-4 py-2 text-right font-medium text-green-700">Priebežný zárobok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50">
                  {rental.items.map(item => (
                    <tr key={item.movement_id} className="hover:bg-green-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-2 text-right">{item.quantity} {item.mj}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{formatDate(item.date_out)}</td>
                      <td className="px-4 py-2 text-right font-bold text-orange-600">{item.days}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{fmt(item.daily_rate * item.quantity)} €/deň</td>
                      <td className="px-4 py-2 text-right font-semibold text-green-700">{fmt(item.total_cost)} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-green-50 font-semibold">
                    <td colSpan={5} className="px-4 py-2 text-right text-green-700">Celkový priebežný zárobok:</td>
                    <td className="px-4 py-2 text-right text-green-700 text-base">{fmt(rentalTotal)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Show rental delivery notes */}
            {docs.delivery_notes.filter(d => d.type !== 'standard').length > 0 && (
              <div className="p-4 border-t border-green-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pohybové doklady požičovne</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-green-50">
                    {docs.delivery_notes.filter(d => d.type !== 'standard').map(dn => (
                      <tr key={dn.id}>
                        <td className="py-1.5 font-mono text-gray-700 text-xs">{dn.delivery_note_number}</td>
                        <td className="py-1.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${dn.type === 'rental_out' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {dn.type === 'rental_out' ? 'Výdaj ↑' : 'Vratka ↓'}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-xs text-gray-400">{formatDate(dn.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
