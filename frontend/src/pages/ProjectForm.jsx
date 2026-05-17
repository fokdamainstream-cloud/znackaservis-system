import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import PartnerSearch from '../components/PartnerSearch';

export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [status, setStatus] = useState('open');
  const [notes, setNotes] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientIco, setRecipientIco] = useState('');
  const [recipientDic, setRecipientDic] = useState('');
  const [recipientStreet, setRecipientStreet] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/projects/${id}/`).then((r) => {
      const p = r.data;
      setName(p.name || '');
      setStatus(p.status || 'open');
      setNotes(p.notes || '');
      setCustomerOrderNumber(p.customer_order_number || '');
      const pd = p.partner_detail;
      if (pd) {
        setRecipientName(pd.name || '');
        setRecipientIco(pd.ico || '');
        setRecipientDic(pd.dic || '');
        setRecipientStreet(pd.street || '');
        setRecipientZip(pd.zip_code || '');
        setRecipientCity(pd.city || '');
      } else {
        setRecipientName(p.partner_name || '');
      }
    }).catch(() => setError('Nepodarilo sa načítať objednávku'));
  }, [id, isEdit]);

  const handleSelectPartner = useCallback((p) => {
    setRecipientName(p.name || '');
    setRecipientIco(p.ico || '');
    setRecipientDic(p.dic || '');
    setRecipientStreet(p.street || '');
    setRecipientZip(p.zip_code || p.zip || '');
    setRecipientCity(p.city || '');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Zadajte názov objednávky'); return; }
    setSubmitting(true);
    setError('');
    try {
      const partnerPayload = recipientName ? {
        name: recipientName, ico: recipientIco || '', dic: recipientDic || '',
        street: recipientStreet || '', city: recipientCity || '', zip: recipientZip || '',
      } : null;
      const payload = { name, status, notes, customer_order_number: customerOrderNumber, partner: partnerPayload };
      if (isEdit) {
        await api.patch(`/projects/${id}/`, payload);
      } else {
        await api.post('/projects/', payload);
      }
      navigate('/projects');
    } catch (err) {
      setError(err.response?.data?.error || 'Chyba pri ukladaní objednávky');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{isEdit ? 'Úprava prijatej objednávky' : 'Nová prijatá objednávka'}</h1>
        <button type="button" onClick={() => navigate('/projects')} className="btn-secondary">← Späť</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>}

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Názov objednávky *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="napr. Bytový komplex XY – dopravné značenie" className="input" />
        </div>
        <div>
          <label className="label">Stav</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="open">Otvorená</option>
            <option value="done">Dokončená</option>
            <option value="invoiced">Fakturovaná</option>
          </select>
        </div>
        <div>
          <label className="label">Poznámka</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input resize-none" />
        </div>
        <div>
          <label className="label">Číslo objednávky zákazníka (pre obce/firmy)</label>
          <input type="text" value={customerOrderNumber} onChange={(e) => setCustomerOrderNumber(e.target.value)}
            placeholder="napr. OBJ-2026/0042" className="input" />
          <p className="text-xs text-gray-400 mt-1">Bude sa zobrazovať na dodacích listoch a faktúrach: „Na základe Vašej objednávky č.: ..."</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Partner / Zákazník</h2>
        <div className="max-w-lg mb-4">
          <PartnerSearch onSelect={handleSelectPartner} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Obchodné meno</label>
            <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">IČO</label>
            <input type="text" value={recipientIco} onChange={(e) => setRecipientIco(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">DIČ</label>
            <input type="text" value={recipientDic} onChange={(e) => setRecipientDic(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Ulica</label>
            <input type="text" value={recipientStreet} onChange={(e) => setRecipientStreet(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">PSČ</label>
            <input type="text" value={recipientZip} onChange={(e) => setRecipientZip(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Mesto</label>
            <input type="text" value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)} className="input" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate('/projects')} className="btn-secondary">Zrušiť</button>
        <button type="submit" disabled={submitting} className="btn-primary px-6">
          {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Vytvoriť objednávku'}
        </button>
      </div>
    </form>
  );
}
