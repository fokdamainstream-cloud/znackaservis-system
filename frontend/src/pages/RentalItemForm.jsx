import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';

const MJ_OPTIONS = ['ks', 'm', 'm²', 'm³', 'kg', 't', 'hod', 'kpl', 'l', 'bal'];

export default function RentalItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [totalQty, setTotalQty] = useState('0');
  const [rentedQty, setRentedQty] = useState('0');
  const [dailyRate, setDailyRate] = useState('0');
  const [mj, setMj] = useState('ks');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [vrfClass, setVrfClass] = useState('');
  const [signCode, setSignCode] = useState('');
  const [signNameSk, setSignNameSk] = useState('');
  const [retroreflexClass, setRetroreflexClass] = useState('');
  const [isComponent, setIsComponent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/rental-items/${id}/`).then((r) => {
      const d = r.data;
      setSku(d.sku || '');
      setName(d.name || '');
      setTotalQty(String(d.total_qty));
      setRentedQty(String(d.rented_qty));
      setDailyRate(String(d.daily_rate));
      setMj(d.mj || 'ks');
      setDescription(d.description || '');
      setDimensions(d.dimensions || '');
      setVrfClass(d.vrf_class || '');
      setSignCode(d.sign_code || '');
      setSignNameSk(d.sign_name_sk || '');
      setRetroreflexClass(d.retroreflex_class || '');
      setIsComponent(d.is_component || false);
    }).catch(() => setError('Nepodarilo sa načítať položku'));
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Zadajte názov položky'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        sku, name,
        total_qty: parseFloat(totalQty) || 0,
        rented_qty: parseFloat(rentedQty) || 0,
        daily_rate: parseFloat(dailyRate) || 0,
        mj, description,
        dimensions,
        vrf_class: vrfClass,
        sign_code: signCode,
        sign_name_sk: signNameSk,
        retroreflex_class: retroreflexClass,
        is_component: isComponent,
      };
      if (isEdit) {
        await api.patch(`/rental-items/${id}/`, payload);
      } else {
        await api.post('/rental-items/', payload);
      }
      navigate('/rental-items');
    } catch (err) {
      setError(err.response?.data?.error || 'Chyba pri ukladaní');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {isEdit ? 'Úprava prenájomnej položky' : 'Nová prenájomná položka'}
        </h1>
        <button type="button" onClick={() => navigate('/rental-items')} className="btn-secondary">← Späť</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>}

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">SKU / Kód</label>
            <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="input" placeholder="DZ-001" />
          </div>
          <div>
            <label className="label">MJ</label>
            <select value={mj} onChange={(e) => setMj(e.target.value)} className="input">
              {MJ_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Názov položky *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input"
            placeholder="napr. Prenosná dopravná značka A-12" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Celkovo ks</label>
            <input type="number" min="0" step="0.01" value={totalQty}
              onChange={(e) => setTotalQty(e.target.value)} className="input text-right" />
          </div>
          <div>
            <label className="label">Aktuálne požičané</label>
            <input type="number" min="0" step="0.01" value={rentedQty}
              onChange={(e) => setRentedQty(e.target.value)} className="input text-right" />
          </div>
          <div>
            <label className="label">Denná sadzba (€)</label>
            <input type="number" min="0" step="0.01" value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)} className="input text-right" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rozmery</label>
            <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} className="input" placeholder="napr. 900×600 mm" />
          </div>
          <div>
            <label className="label">Trieda retroreflexie</label>
            <select value={retroreflexClass} onChange={(e) => setRetroreflexClass(e.target.value)} className="input">
              <option value="">— nezvolená —</option>
              <option value="VRF1">VRF1</option>
              <option value="VRF2">VRF2</option>
              <option value="VRF7">VRF7 – s koľajnicou</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kód TP117 (napr. 506, 201)</label>
            <input type="text" value={signCode} onChange={(e) => setSignCode(e.target.value)} className="input" placeholder="napr. 506" />
          </div>
          <div>
            <label className="label">Slovenský názov / skratka</label>
            <input type="text" value={signNameSk} onChange={(e) => setSignNameSk(e.target.value)} className="input" placeholder="napr. Slepá ulica" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isComponent" checked={isComponent} onChange={(e) => setIsComponent(e.target.checked)} className="rounded" />
          <label htmlFor="isComponent" className="text-sm text-gray-700">Komponent zostáv (stĺpik / podstavec / svorka)</label>
        </div>
        <div>
          <label className="label">Popis (interný)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={2} className="input resize-none" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate('/rental-items')} className="btn-secondary">Zrušiť</button>
        <button type="submit" disabled={submitting} className="btn-primary px-6">
          {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Pridať položku'}
        </button>
      </div>
    </form>
  );
}
