import { useState, useEffect } from 'react';
import api from '../api/axios';

function PartnerModal({ partner, onClose, onSave }) {
  const isNew = !partner?.id;
  const [form, setForm] = useState({
    name: partner?.name || '',
    ico: partner?.ico || '',
    dic: partner?.dic || '',
    ic_dph: partner?.ic_dph || '',
    street: partner?.street || '',
    city: partner?.city || '',
    zip_code: partner?.zip_code || '',
    default_discount_percent: partner?.default_discount_percent ?? 0,
    default_discount_active: partner?.default_discount_active ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Zadajte názov'); return; }
    if (!form.ico.trim()) { setError('Zadajte IČO'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        ico: form.ico.trim(),
        dic: form.dic.trim(),
        ic_dph: form.ic_dph.trim(),
        street: form.street.trim(),
        city: form.city.trim(),
        zip_code: form.zip_code.trim(),
        default_discount_percent: parseFloat(form.default_discount_percent) || 0,
        default_discount_active: form.default_discount_active,
      };
      if (isNew) {
        await api.post('/partners/', payload);
      } else {
        await api.patch(`/partners/${partner.id}/`, payload);
      }
      onSave();
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.ico?.[0] || d?.name?.[0] || d?.detail || 'Chyba pri ukladaní';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isNew ? 'Nový partner' : 'Upraviť partnera'}
        </h3>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">Obchodné meno *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">IČO *</label>
              <input type="text" value={form.ico} onChange={(e) => set('ico', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">DIČ</label>
              <input type="text" value={form.dic} onChange={(e) => set('dic', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label className="label">IČ DPH</label>
            <input type="text" value={form.ic_dph} onChange={(e) => set('ic_dph', e.target.value)} className="input" />
          </div>

          <div>
            <label className="label">Ulica a číslo</label>
            <input type="text" value={form.street} onChange={(e) => set('street', e.target.value)} className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mesto</label>
              <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">PSČ</label>
              <input type="text" value={form.zip_code} onChange={(e) => set('zip_code', e.target.value)} className="input" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.default_discount_active}
                  onChange={(e) => set('default_discount_active', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Predvolená zľava aktívna</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="label mb-0">Predvolená zľava (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.default_discount_percent}
                disabled={!form.default_discount_active}
                onChange={(e) => set('default_discount_percent', e.target.value)}
                className={`input w-24 text-right ${!form.default_discount_active ? 'bg-gray-50 text-gray-400' : ''}`}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button type="button" onClick={onClose} className="btn-secondary">Zrušiť</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Ukladám…' : 'Uložiť'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPartner, setModalPartner] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/partners/');
      setPartners(r.data.sort((a, b) => a.name.localeCompare(b.name, 'sk')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = partners.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.ico.includes(search)
  );

  const openNew = () => { setModalPartner(null); setShowModal(true); };
  const openEdit = (p) => { setModalPartner(p); setShowModal(true); };
  const handleSave = () => { setShowModal(false); load(); };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Partneri</h1>
        <button onClick={openNew} className="btn-primary">+ Nový partner</button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hľadať podľa názvu alebo IČO…"
          className="input max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>Žiadni partneri. Pridajte prvého partnera.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Obchodné meno</th>
                  <th className="px-4 py-3 text-left font-medium">IČO</th>
                  <th className="px-4 py-3 text-left font-medium">DIČ / IČ DPH</th>
                  <th className="px-4 py-3 text-left font-medium">Mesto</th>
                  <th className="px-4 py-3 text-center font-medium">Predvolená zľava</th>
                  <th className="px-4 py-3 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{p.ico}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.dic && <span>{p.dic}</span>}
                      {p.dic && p.ic_dph && ' / '}
                      {p.ic_dph && <span>{p.ic_dph}</span>}
                      {!p.dic && !p.ic_dph && '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {[p.city, p.zip_code].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.default_discount_active && parseFloat(p.default_discount_percent) > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {parseFloat(p.default_discount_percent).toFixed(1)} %
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
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
        <PartnerModal
          partner={modalPartner}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
