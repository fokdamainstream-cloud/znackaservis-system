import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import PartnerSearch from '../components/PartnerSearch';

const MJ_OPTIONS = ['ks', 'm', 'm²', 'm³', 'kg', 't', 'hod', 'kpl', 'l', 'bal'];
let rowKey = 500;
const emptyRow = (pos) => ({ _key: rowKey++, pos, item_id: '', rental_item_id: '', item_name: '', quantity: 1, mj: 'ks', unit_price: 0, is_complete_set: true, minus_stand: false, minus_pole: false, minus_clamps: false });

const TYPE_LABELS = {
  standard: 'Klasický výdaj',
  rental_out: 'Výdaj do prenájmu',
  rental_return: 'Vratka z prenájmu',
};

const TYPE_COLORS = {
  standard: 'bg-gray-100 text-gray-700',
  rental_out: 'bg-orange-100 text-orange-700',
  rental_return: 'bg-green-100 text-green-700',
};

export default function DeliveryNoteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const [dnType, setDnType] = useState('standard');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientIco, setRecipientIco] = useState('');
  const [recipientDic, setRecipientDic] = useState('');
  const [recipientStreet, setRecipientStreet] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyRow(1)]);
  const [stockItems, setStockItems] = useState([]);
  const [rentalItems, setRentalItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/items/').then((r) => setStockItems(r.data)).catch(() => {});
    api.get('/rental-items/').then((r) => setRentalItems(r.data)).catch(() => {});
    api.get('/projects/').then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  // Prefill from project param
  useEffect(() => {
    const fromProject = searchParams.get('project');
    if (fromProject && !isEdit) {
      setProjectId(fromProject);
      setDnType('rental_out');
      api.get(`/projects/${fromProject}/`).then((r) => {
        const p = r.data.partner_detail;
        if (p) {
          setRecipientName(p.name || '');
          setRecipientIco(p.ico || '');
          setRecipientDic(p.dic || '');
          setRecipientStreet(p.street || '');
          setRecipientZip(p.zip_code || '');
          setRecipientCity(p.city || '');
        }
      }).catch(() => {});
    }
  }, [searchParams, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/delivery-notes/${id}/`).then((r) => {
      const dn = r.data;
      setDnType(dn.type || 'standard');
      setProjectId(dn.project ? String(dn.project) : '');
      const p = dn.partner_detail;
      if (p) {
        setRecipientName(p.name || '');
        setRecipientIco(p.ico || '');
        setRecipientDic(p.dic || '');
        setRecipientStreet(p.street || '');
        setRecipientZip(p.zip_code || '');
        setRecipientCity(p.city || '');
      } else {
        setRecipientName(dn.partner_name || '');
        setRecipientIco(dn.partner_ico || '');
      }
      setNotes(dn.notes || '');
      if (dn.items?.length) {
        setItems(dn.items.map((it) => ({
          _key: rowKey++,
          pos: it.pos,
          item_id: it.item || '',
          rental_item_id: it.rental_item || '',
          item_name: it.item_name || '',
          quantity: it.quantity,
          mj: it.mj || 'ks',
          unit_price: it.unit_price || 0,
          is_complete_set: it.is_complete_set ?? true,
          minus_stand: it.minus_stand ?? false,
          minus_pole: it.minus_pole ?? false,
          minus_clamps: it.minus_clamps ?? false,
        })));
      }
    }).catch(() => setError('Nepodarilo sa načítať dodací list'));
  }, [id, isEdit]);

  const handleSelectPartner = useCallback((p) => {
    setRecipientName(p.name || '');
    setRecipientIco(p.ico || '');
    setRecipientDic(p.dic || '');
    setRecipientStreet(p.street || '');
    setRecipientZip(p.zip_code || p.zip || '');
    setRecipientCity(p.city || '');
  }, []);

  // When project changes, auto-fill partner from project
  const handleProjectChange = (pid) => {
    setProjectId(pid);
    if (pid) {
      const proj = projects.find((p) => String(p.id) === String(pid));
      if (proj?.partner_detail) {
        setRecipientName(proj.partner_detail.name || '');
        setRecipientIco(proj.partner_detail.ico || '');
        setRecipientDic(proj.partner_detail.dic || '');
        setRecipientStreet(proj.partner_detail.street || '');
        setRecipientZip(proj.partner_detail.zip_code || '');
        setRecipientCity(proj.partner_detail.city || '');
      }
    }
  };

  const isRental = dnType === 'rental_out' || dnType === 'rental_return';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) { setError('Pridajte aspoň jednu položku'); return; }
    const invalid = items.find((r) => !r.item_name?.trim());
    if (invalid) { setError('Každá položka musí mať názov'); return; }
    if (isRental && !projectId) { setError('Pre prenájom vyberte zákazku'); return; }

    setSubmitting(true);
    try {
      const partnerPayload = recipientName ? {
        name: recipientName,
        ico: recipientIco || '',
        dic: recipientDic || '',
        street: recipientStreet || '',
        city: recipientCity || '',
        zip: recipientZip || '',
      } : null;

      const payload = {
        partner: partnerPayload,
        type: dnType,
        project_id: projectId ? parseInt(projectId) : null,
        items: items.map((r, i) => ({
          pos: r.pos ?? i + 1,
          item_id: r.item_id || null,
          rental_item_id: r.rental_item_id || null,
          item_name: r.item_name || '',
          quantity: parseFloat(r.quantity) || 1,
          mj: r.mj || 'ks',
          unit_price: parseFloat(r.unit_price) || 0,
          is_complete_set: r.is_complete_set ?? false,
          minus_stand: r.minus_stand ?? false,
          minus_pole: r.minus_pole ?? false,
          minus_clamps: r.minus_clamps ?? false,
        })),
        notes,
      };

      if (isEdit) {
        await api.patch(`/delivery-notes/${id}/`, payload);
        setSuccess('Dodací list bol úspešne uložený!');
      } else {
        await api.post('/delivery-notes/', payload);
        setSuccess('Dodací list bol úspešne vytvorený!');
      }
      setTimeout(() => navigate('/delivery-notes'), 1500);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Chyba pri ukladaní';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {isEdit ? 'Úprava dodacieho listu' : 'Nový dodací list'}
        </h1>
        <button type="button" onClick={() => navigate('/delivery-notes')} className="btn-secondary">
          ← Späť
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm">{success}</div>}

      {/* Typ dokladu + zákazka */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Typ dokladu</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Typ dodacieho listu</label>
            <select value={dnType} onChange={(e) => setDnType(e.target.value)} className="input">
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prijatá objednávka {isRental && <span className="text-red-500">*</span>}</label>
            <select value={projectId} onChange={(e) => handleProjectChange(e.target.value)} className="input">
              <option value="">— bez zákazky —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Odberateľ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Odberateľ</h2>
          <span className="text-xs text-gray-400">Autofill z registra →</span>
        </div>
        <div className="max-w-lg mb-4">
          <PartnerSearch onSelect={handleSelectPartner} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Obchodné meno / Meno</label>
            <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
              placeholder="napr. ABC s.r.o." className="input" />
          </div>
          <div>
            <label className="label">IČO</label>
            <input type="text" value={recipientIco} onChange={(e) => setRecipientIco(e.target.value)}
              placeholder="12345678" className="input" />
          </div>
          <div>
            <label className="label">DIČ</label>
            <input type="text" value={recipientDic} onChange={(e) => setRecipientDic(e.target.value)}
              placeholder="2012345678" className="input" />
          </div>
          <div>
            <label className="label">Ulica</label>
            <input type="text" value={recipientStreet} onChange={(e) => setRecipientStreet(e.target.value)}
              placeholder="Hlavná 1" className="input" />
          </div>
          <div>
            <label className="label">PSČ</label>
            <input type="text" value={recipientZip} onChange={(e) => setRecipientZip(e.target.value)}
              placeholder="010 01" className="input" />
          </div>
          <div>
            <label className="label">Mesto</label>
            <input type="text" value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)}
              placeholder="Žilina" className="input" />
          </div>
        </div>
      </div>

      {/* Položky */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Položky</h2>
          <button type="button"
            onClick={() => setItems((prev) => [...prev, emptyRow(prev.length + 1)])}
            className="btn-secondary text-xs">
            + Pridať položku
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-2 py-2 text-center font-medium w-10">#</th>
                <th className="px-3 py-2 text-left font-medium">Názov položky</th>
                <th className="px-2 py-2 text-right font-medium w-24">Množstvo</th>
                <th className="px-2 py-2 text-center font-medium w-20">MJ</th>
                <th className="px-2 py-2 text-right font-medium w-28">Cena bez DPH</th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <DNItemRow
                  key={row._key}
                  row={row}
                  index={index}
                  stockItems={stockItems}
                  rentalItems={rentalItems}
                  isRental={isRental}
                  onChange={(i, patch) => setItems((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], ...patch };
                    return next;
                  })}
                  onRemove={(i) => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">Žiadne položky.</p>
        )}
      </div>

      {/* Poznámka */}
      <div className="card p-5">
        <label className="label">Poznámka</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Napr.: Tovar sa vracia z dôvodu reklamácie."
          className="input resize-none" />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate('/delivery-notes')} className="btn-secondary">Zrušiť</button>
        <button type="submit" disabled={submitting} className="btn-primary px-6 py-2">
          {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Vytvoriť dodací list'}
        </button>
      </div>
    </form>
  );
}

function DNItemRow({ row, index, stockItems, rentalItems, isRental, onChange, onRemove }) {
  const [nameInput, setNameInput] = useState(row.item_name || '');
  const [showDrop, setShowDrop] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setNameInput(row.item_name || ''); }, [row.item_name]);

  useEffect(() => {
    function outside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const openDrop = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom, left: r.left, width: r.width });
    }
    setShowDrop(true);
  };

  const sourceList = isRental ? rentalItems : stockItems;
  const q = nameInput.toLowerCase();
  const filtered = (sourceList || []).filter((s) =>
    s.name.toLowerCase().includes(q) ||
    (s.sku && s.sku.toLowerCase().includes(q)) ||
    (s.sign_code && s.sign_code.toLowerCase().includes(q)) ||
    (s.sign_name_sk && s.sign_name_sk.toLowerCase().includes(q))
  );

  const handleSelect = (s) => {
    setNameInput(s.name);
    setShowDrop(false);
    if (isRental) {
      onChange(index, {
        rental_item_id: s.id,
        item_id: '',
        item_name: s.name,
        mj: s.mj || 'ks',
        unit_price: s.daily_rate || 0,
      });
    } else {
      onChange(index, {
        item_id: s.id,
        rental_item_id: '',
        item_name: s.name,
        unit_price: s.unit_price || 0,
      });
    }
  };

  const showSetConfig = isRental && row.rental_item_id;

  return (
    <>
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-2 py-2 w-10">
        <input type="number" min="1" step="1" value={Number(row.pos ?? index + 1)}
          onChange={(e) => onChange(index, { pos: parseInt(e.target.value, 10) || index + 1 })}
          className="input text-xs text-center w-10 px-1" />
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <div ref={wrapRef} className="relative">
          <input ref={inputRef} type="text" value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); onChange(index, { item_name: e.target.value, item_id: '', rental_item_id: '' }); openDrop(); }}
            onFocus={openDrop}
            placeholder={isRental ? "Položka z prenájomného skladu..." : "Názov položky (zo skladu alebo vlastný)..."}
            className="input text-xs" />
          {showDrop && filtered.length > 0 && (
            <ul style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
              className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-xs">
              {filtered.map((s) => (
                <li key={s.id}
                  className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                  onMouseDown={() => handleSelect(s)}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {s.sign_code && <span className="font-mono text-blue-600 text-xs font-bold">{s.sign_code}</span>}
                    {s.sku && !s.sign_code && <span className="text-gray-400 font-mono text-xs">[{s.sku}]</span>}
                    <span className="font-medium text-xs">{s.sign_name_sk || s.name}</span>
                    {s.sign_name_sk && <span className="text-gray-400 text-xs">({s.name})</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.retroreflex_class && <span className="mr-2">{s.retroreflex_class}</span>}
                    {s.dimensions && <span className="mr-2">{s.dimensions}</span>}
                    {isRental
                      ? `Dostupné: ${s.available_qty} · ${s.daily_rate} €/deň`
                      : `Na sklade: ${s.quantity} · ${s.unit_price} €`
                    }
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
      <td className="px-2 py-2 w-24">
        <input type="number" min="0" step="0.01" value={row.quantity}
          onChange={(e) => onChange(index, { quantity: e.target.value })}
          className="input text-xs text-right" />
      </td>
      <td className="px-2 py-2 w-20">
        <select value={row.mj || 'ks'} onChange={(e) => onChange(index, { mj: e.target.value })}
          className="input text-xs text-center px-1">
          {MJ_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-2 py-2 w-28">
        <input type="number" min="0" step="0.01" value={row.unit_price}
          onChange={(e) => onChange(index, { unit_price: e.target.value })}
          className="input text-xs text-right"
          placeholder={isRental ? "denná sadzba" : "cena"} />
      </td>
      <td className="px-2 py-2 w-10 text-center">
        <button type="button" onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
      </td>
    </tr>
    {showSetConfig && (
      <tr className="bg-orange-50 border-b border-orange-100">
        <td></td>
        <td colSpan={5} className="px-3 py-2">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <label className="flex items-center gap-1.5 font-medium text-orange-800">
              <input type="checkbox" checked={row.is_complete_set ?? true}
                onChange={(e) => onChange(index, { is_complete_set: e.target.checked })}
                className="rounded" />
              Kompletná zostava
            </label>
            {row.is_complete_set && (
              <>
                <label className="flex items-center gap-1.5 text-gray-600">
                  <input type="checkbox" checked={row.minus_stand ?? false}
                    onChange={(e) => onChange(index, { minus_stand: e.target.checked })}
                    className="rounded" />
                  – Bez podstavca
                </label>
                <label className="flex items-center gap-1.5 text-gray-600">
                  <input type="checkbox" checked={row.minus_pole ?? false}
                    onChange={(e) => onChange(index, { minus_pole: e.target.checked })}
                    className="rounded" />
                  – Bez stĺpika
                </label>
                <label className="flex items-center gap-1.5 text-gray-600">
                  <input type="checkbox" checked={row.minus_clamps ?? false}
                    onChange={(e) => onChange(index, { minus_clamps: e.target.checked })}
                    className="rounded" />
                  – Bez svoriek
                </label>
              </>
            )}
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
