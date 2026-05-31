import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useUser } from '../context/UserContext';

const fmt = (n) => (isNaN(parseFloat(n)) ? '—' : `${parseFloat(n).toFixed(2)} €`);

const calcMargin = (sellPrice, buyPrice) => {
  const s = parseFloat(sellPrice);
  const b = parseFloat(buyPrice);
  if (!b || !s || s <= 0) return null;
  return ((s - b) / s) * 100;
};

function ItemModal({ item, onClose, onSave }) {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    name: item?.name || '',
    sku: item?.sku || '',
    description: item?.description || '',
    quantity: item?.quantity ?? 0,
    unit_price: item?.unit_price ?? '',
    avg_purchase_price: item?.avg_purchase_price ?? '',
    recommended_price: item?.recommended_price ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Zadajte názov'); return; }
    if (form.unit_price === '' || isNaN(parseFloat(form.unit_price))) {
      setError('Zadajte cenu');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description,
        quantity: parseFloat(form.quantity) || 0,
        unit_price: parseFloat(form.unit_price),
        avg_purchase_price: parseFloat(form.avg_purchase_price) || 0,
        recommended_price: parseFloat(form.recommended_price) || 0,
      };
      if (isNew) {
        await api.post('/items/', payload);
      } else {
        await api.patch(`/items/${item.id}/`, payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Chyba pri ukladaní');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isNew ? 'Nová položka' : 'Upraviť položku'}
        </h3>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Názov *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="input"
                placeholder="napr. Cestná zábrana"
              />
            </div>
            <div>
              <label className="label">Číslo položky (SKU)</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                className="input"
                placeholder="napr. SKU-001"
              />
            </div>
          </div>
          <div>
            <label className="label">Popis</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="input"
              placeholder="Voliteľný popis"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Množstvo na sklade</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                className="input text-right"
              />
            </div>
            <div>
              <label className="label">Predajná cena bez DPH (€) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => set('unit_price', e.target.value)}
                className="input text-right"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nákupná cena (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.avg_purchase_price}
                onChange={(e) => set('avg_purchase_price', e.target.value)}
                className="input text-right"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Doporučená cena dod. (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.recommended_price}
                onChange={(e) => set('recommended_price', e.target.value)}
                className="input text-right"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 px-1">
            {(() => {
              const m = calcMargin(form.unit_price, form.avg_purchase_price);
              if (m === null) return <span className="text-xs text-gray-400">Marža (predajná): —</span>;
              const cls = m >= 20 ? 'text-green-600' : m >= 5 ? 'text-amber-600' : 'text-red-600';
              return <span className={`text-sm font-semibold ${cls}`}>Marža: {m.toFixed(1)} %</span>;
            })()}
            {parseFloat(form.recommended_price) > 0 && parseFloat(form.avg_purchase_price) > 0 && (() => {
              const m = calcMargin(form.recommended_price, form.avg_purchase_price);
              if (m === null) return null;
              const cls = m >= 20 ? 'text-green-600' : m >= 5 ? 'text-amber-600' : 'text-red-600';
              return <span className={`text-xs ${cls}`}>(dod. cena: {m.toFixed(1)} %)</span>;
            })()}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button type="button" onClick={onClose} className="btn-secondary">Zrušiť</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Ukladám…' : 'Uložiť'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Items() {
  const { isOwner } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/items/');
      const arr = Array.isArray(r.data) ? r.data : [];
      setItems(arr.sort((a, b) => a.name.localeCompare(b.name, 'sk')));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.sku && i.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const openNew = () => { setModalItem(null); setShowModal(true); };
  const openEdit = (item) => { setModalItem(item); setShowModal(true); };
  const handleSave = () => { setShowModal(false); load(); };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Položky skladu</h1>
        <button onClick={openNew} className="btn-primary">+ Nová položka</button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hľadať položku…"
          className="input max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>Žiadne položky. Pridajte prvú položku.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Názov</th>
                  <th className="px-4 py-3 text-left font-medium">Popis</th>
                  <th className="px-4 py-3 text-right font-medium">Na sklade</th>
                  {isOwner && <th className="px-4 py-3 text-right font-medium">Predajná cena</th>}
                  {isOwner && <th className="px-4 py-3 text-right font-medium">Nákupná cena</th>}
                  {isOwner && <th className="px-4 py-3 text-right font-medium">Marža</th>}
                  <th className="px-4 py-3 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{item.sku || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          item.quantity <= 0
                            ? 'text-red-600'
                            : item.quantity <= 5
                            ? 'text-amber-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {item.quantity}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">ks</span>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {fmt(item.unit_price)}
                      </td>
                    )}
                    {isOwner && (
                      <td className="px-4 py-3 text-right text-gray-600">
                        {parseFloat(item.avg_purchase_price) > 0 ? fmt(item.avg_purchase_price) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {isOwner && (() => {
                      const m = calcMargin(item.unit_price, item.avg_purchase_price);
                      const cls = m === null ? '' : m >= 20 ? 'text-green-600 font-semibold' : m >= 5 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold';
                      return (
                        <td className={`px-4 py-3 text-right ${cls}`}>
                          {m === null ? <span className="text-gray-300">—</span> : `${m.toFixed(1)} %`}
                        </td>
                      );
                    })()}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(item)}
                        className="btn-secondary text-xs"
                      >
                        Upraviť
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ItemModal
          item={modalItem}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
