import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PartnerSearch from '../components/PartnerSearch';

const MJ_OPTIONS = ['ks', 'm', 'm²', 'm³', 'kg', 't', 'hod', 'kpl', 'l', 'bal'];
const VAT_OPTIONS = [0, 10, 20, 23];
let rowKey = 700;
const emptyRow = () => ({ _key: rowKey++, item_id: '', rental_item_id: '', item_name: '', quantity: 1, mj: 'ks', unit_price: '', vat_rate: 20 });

function ItemRow({ row, index, stockItems, rentalItems, onChange, onRemove, vatOptions }) {
  const [query, setQuery] = useState(row.item_name || '');
  const [showDrop, setShowDrop] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 300 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setQuery(row.item_name || ''); }, [row.item_name]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openDrop = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, 320) });
    }
    setShowDrop(true);
  };

  const q = query.toLowerCase();
  const allItems = [
    ...stockItems.map(s => ({ ...s, _source: 'stock' })),
    ...rentalItems.filter(r => !r.is_component).map(r => ({ ...r, _source: 'rental' })),
  ];
  const filtered = q.length > 0 ? allItems.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.sku && s.sku.toLowerCase().includes(q)) ||
    (s.sign_code && s.sign_code.toLowerCase().includes(q)) ||
    (s.sign_name_sk && s.sign_name_sk.toLowerCase().includes(q))
  ).slice(0, 12) : [];

  const handleSelect = (s) => {
    setQuery(s.sign_name_sk || s.name);
    setShowDrop(false);
    onChange(index, {
      item_name: s.sign_name_sk || s.name,
      item_id: s._source === 'stock' ? s.id : '',
      rental_item_id: s._source === 'rental' ? s.id : '',
      mj: s.mj || 'ks',
      unit_price: s.avg_purchase_price != null ? String(parseFloat(s.avg_purchase_price) || '') : '',
    });
  };

  const lineTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 w-10 text-center text-xs text-gray-400">{index + 1}</td>
      <td className="px-3 py-2">
        <div ref={wrapRef} className="relative">
          <input ref={inputRef} type="text" value={query}
            onChange={e => { setQuery(e.target.value); onChange(index, { item_name: e.target.value, item_id: '', rental_item_id: '' }); openDrop(); }}
            onFocus={openDrop}
            placeholder="Názov, kód (506), alebo ľubovoľný text…"
            className="input text-sm w-full" />
          {showDrop && filtered.length > 0 && (
            <ul style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto text-xs">
              {filtered.map(s => (
                <li key={`${s._source}-${s.id}`}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                  onMouseDown={() => handleSelect(s)}>
                  <div className="flex items-center gap-2">
                    {s.sign_code && <span className="font-mono font-bold text-blue-600">{s.sign_code}</span>}
                    {!s.sign_code && s.sku && <span className="font-mono text-gray-400">[{s.sku}]</span>}
                    <span className="font-medium">{s.sign_name_sk || s.name}</span>
                    <span className={`text-xs px-1 rounded ${s._source === 'rental' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                      {s._source === 'rental' ? 'Požičovňa' : 'Sklad'}
                    </span>
                    {s.avg_purchase_price > 0 && (
                      <span className="text-gray-400 ml-auto">{parseFloat(s.avg_purchase_price).toFixed(2)} €</span>
                    )}
                  </div>
                  {(s.dimensions || s.retroreflex_class) && (
                    <div className="text-gray-400 mt-0.5">{s.dimensions} {s.retroreflex_class}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
      <td className="px-3 py-2 w-24">
        <input type="number" min="0.001" step="0.001" value={row.quantity}
          onChange={e => onChange(index, { quantity: e.target.value })}
          className="input text-sm text-right w-full" />
      </td>
      <td className="px-3 py-2 w-20">
        <select value={row.mj} onChange={e => onChange(index, { mj: e.target.value })} className="input text-sm px-1">
          {MJ_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 w-28">
        <input type="number" min="0" step="0.01" value={row.unit_price}
          onChange={e => onChange(index, { unit_price: e.target.value })}
          className="input text-sm text-right w-full" placeholder="0.00" />
      </td>
      <td className="px-3 py-2 w-20">
        <select value={row.vat_rate} onChange={e => onChange(index, { vat_rate: parseInt(e.target.value) })} className="input text-sm px-1">
          {VAT_OPTIONS.map(v => <option key={v} value={v}>{v} %</option>)}
        </select>
      </td>
      <td className="px-3 py-2 w-24 text-right text-sm font-semibold text-gray-700">
        {lineTotal > 0 ? lineTotal.toFixed(2) + ' €' : '—'}
      </td>
      <td className="px-2 py-2 w-8 text-center">
        <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
      </td>
    </tr>
  );
}

export default function SentOrderForm() {
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState('');
  const [supplierIco, setSupplierIco] = useState('');
  const [supplierDic, setSupplierDic] = useState('');
  const [supplierStreet, setSupplierStreet] = useState('');
  const [supplierZip, setSupplierZip] = useState('');
  const [supplierCity, setSupplierCity] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState([emptyRow()]);
  const [stockItems, setStockItems] = useState([]);
  const [rentalItems, setRentalItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/items/').then(r => setStockItems(r.data)).catch(() => {});
    api.get('/rental-items/').then(r => setRentalItems(r.data)).catch(() => {});
    api.get('/projects/').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const handleSelectPartner = (p) => {
    setSupplierName(p.name || '');
    setSupplierIco(p.ico || '');
    setSupplierDic(p.dic || '');
    setSupplierStreet(p.street || '');
    setSupplierZip(p.zip_code || p.zip || '');
    setSupplierCity(p.city || '');
  };

  const updateItem = (i, patch) => setItems(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(r => r.item_name?.trim());
    if (validItems.length === 0) { setError('Pridajte aspoň jednu položku'); return; }
    setError('');
    setSubmitting(true);
    try {
      const partnerPayload = supplierName ? {
        name: supplierName, ico: supplierIco, dic: supplierDic,
        street: supplierStreet, city: supplierCity, zip: supplierZip,
      } : null;
      await api.post('/sent-orders/', {
        partner: partnerPayload,
        supplier_name: supplierName,
        project_id: projectId || null,
        notes,
        expected_date: expectedDate || null,
        items: validItems.map(r => ({
          item_id: r.item_id || null,
          rental_item_id: r.rental_item_id || null,
          item_name: r.item_name,
          quantity: parseFloat(r.quantity) || 1,
          mj: r.mj,
          unit_price: parseFloat(r.unit_price) || 0,
          vat_rate: parseInt(r.vat_rate) || 20,
        })),
      });
      navigate('/order-needs');
    } catch (err) {
      setError(err.response?.data?.error || 'Chyba pri ukladaní');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Nová odoslaná objednávka</h1>
        <button type="button" onClick={() => navigate('/order-needs')} className="btn-secondary">← Späť</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>}

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dodávateľ</h2>
        <div className="max-w-lg">
          <PartnerSearch onSelect={handleSelectPartner} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Obchodné meno dodávateľa</label>
            <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} className="input" placeholder="napr. HAKOM s.r.o." />
          </div>
          <div>
            <label className="label">IČO</label>
            <input type="text" value={supplierIco} onChange={e => setSupplierIco(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Očakávaný termín dodania</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Prepojenie na Prijatú objednávku (PO)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
              <option value="">— bez prepojenia —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_number ? `${p.project_number} – ` : ''}{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Poznámka / interná informácia</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input resize-none" placeholder="napr. Urgentné, doručenie do piatku" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Položky objednávky</h2>
          <button type="button" onClick={() => setItems(prev => [...prev, emptyRow()])} className="btn-secondary text-xs">+ Pridať položku</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-3 py-2 text-center w-10">#</th>
                <th className="px-3 py-2 text-left">Názov / kód / voľný text</th>
                <th className="px-3 py-2 text-right w-24">Množstvo</th>
                <th className="px-3 py-2 text-center w-20">MJ</th>
                <th className="px-3 py-2 text-right w-28">Nák. cena/ks (€)</th>
                <th className="px-3 py-2 text-center w-20">DPH %</th>
                <th className="px-3 py-2 text-right w-24">Spolu</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <ItemRow key={row._key} row={row} index={i}
                  stockItems={stockItems} rentalItems={rentalItems}
                  onChange={updateItem} onRemove={removeItem} vatOptions={VAT_OPTIONS} />
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Žiadne položky.</p>}
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate('/order-needs')} className="btn-secondary">Zrušiť</button>
        <button type="submit" disabled={submitting} className="btn-primary px-6">
          {submitting ? 'Ukladám…' : '📤 Vytvoriť objednávku (OO)'}
        </button>
      </div>
    </form>
  );
}
