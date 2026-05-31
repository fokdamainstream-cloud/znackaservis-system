import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import PartnerSearch from '../components/PartnerSearch';
import ItemRow from '../components/ItemRow';

const today = () => new Date().toISOString().split('T')[0];
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
const fmt = (n) => (isNaN(n) ? '0.00' : Number(n).toFixed(2));
let rowKey = 1;

function Accordion({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </span>
        <span className={`text-gray-400 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-3 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

const emptyRow = (pos, defaultVat = 0) => ({
  _key: rowKey++,
  pos: Number(pos),
  item_id: '',
  item_name: '',
  mj: 'ks',
  quantity: 1,
  unit_price: '',
  vat_rate: defaultVat,
  _stockQty: null,
  _priceHistory: [],
  _avgPurchasePrice: 0,
  _recommendedPrice: 0,
});

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // Odberateľ — voľne editovateľné polia
  const [recipientName, setRecipientName] = useState('');
  const [recipientIco, setRecipientIco] = useState('');
  const [recipientDic, setRecipientDic] = useState('');
  const [recipientIcDph, setRecipientIcDph] = useState('');
  const [recipientStreet, setRecipientStreet] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [recipientCity, setRecipientCity] = useState('');

  const [validUntil, setValidUntil] = useState(addDays(30));
  const [vatRate, setVatRate] = useState(0);
  const [isVatPayer, setIsVatPayer] = useState(false);
  const [items, setItems] = useState([emptyRow(1)]);
  const [notes, setNotes] = useState('');

  // Kontaktné údaje
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Fakturačné detaily
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bankový prevod');

  // Poznámka pre zákazníka
  const [customerNote, setCustomerNote] = useState('');

  const [stockItems, setStockItems] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/items/').then((r) => setStockItems(r.data)).catch(() => {});
    api.get('/quotations/').then((r) => {
      const history = {};
      for (const q of r.data) {
        for (const qi of q.items || []) {
          if (!qi.item) continue;
          if (!history[qi.item]) history[qi.item] = [];
          history[qi.item].push(parseFloat(qi.unit_price));
        }
      }
      setPriceHistory(history);
    }).catch(() => {});
  }, []);

  // Načítanie existujúcej ponuky v režime úpravy
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/quotations/${id}/`).then((r) => {
      const q = r.data;
      const p = q.partner_detail;
      if (p) {
        setRecipientName(p.name || '');
        setRecipientIco(p.ico || '');
        setRecipientDic(p.dic || '');
        setRecipientIcDph(p.ic_dph || '');
        setRecipientStreet(p.street || '');
        setRecipientZip(p.zip_code || '');
        setRecipientCity(p.city || '');
      }
      setValidUntil(q.valid_until || addDays(30));
      setVatRate(q.vat_rate ?? 0);
      setIsVatPayer(q.is_vat_payer ?? false);
      setNotes(q.notes || '');
      setPaymentMethod(q.payment_method || 'Bankový prevod');
      setCustomerOrderNumber(q.customer_order_number || '');
      setJobNumber(q.job_number || '');
      setPlaceOfSupply(q.place_of_supply || '');
      setContactPerson(q.contact_person || '');
      setContactEmail(q.contact_email || '');
      setContactPhone(q.contact_phone || '');
      setCustomerNote(q.customer_note || '');
      if (q.items?.length) {
        setItems(q.items.map((qi, i) => ({
          _key: rowKey++,
          pos: i + 1,
          item_id: qi.item || '',
          item_name: qi.item_name || qi.description || '',
          mj: qi.mj || 'ks',
          quantity: qi.quantity,
          unit_price: qi.unit_price,
          vat_rate: parseFloat(qi.vat_rate) || 0,
          _stockQty: null,
          _priceHistory: [],
        })));
      }
    }).catch(() => setError('Nepodarilo sa načítať cenovú ponuku'));
  }, [id, isEdit]);

  const handleSelectPartner = useCallback((p) => {
    setRecipientName(p.name || '');
    setRecipientIco(p.ico || '');
    setRecipientDic(p.dic || '');
    setRecipientIcDph(p.ic_dph || '');
    setRecipientStreet(p.street || '');
    setRecipientZip(p.zip_code || p.zip || '');
    setRecipientCity(p.city || '');
  }, []);

  const handleItemChange = useCallback((index, patch) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const handleItemRemove = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const summary = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    let profitTotal = 0;
    let profitItemCount = 0;
    for (const row of items) {
      const qty = parseFloat(row.quantity || 0);
      const sell = parseFloat(row.unit_price || 0);
      const lineBase = qty * sell;
      subtotal += lineBase;
      if (isVatPayer) {
        vatTotal += lineBase * ((parseFloat(row.vat_rate) || 0) / 100);
      }
      const buy = parseFloat(row._avgPurchasePrice || 0);
      if (buy > 0) {
        profitTotal += (sell - buy) * qty;
        profitItemCount++;
      }
    }
    return { subtotal, vat: vatTotal, total: subtotal + vatTotal, profitTotal, profitItemCount };
  }, [items, isVatPayer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (items.length === 0) { setError('Pridajte aspoň jednu položku'); return; }
    const invalid = items.find((r) => !r.item_name?.trim() && !r.item_id);
    if (invalid) { setError('Každá položka musí mať názov'); return; }
    if (!validUntil) { setError('Zadajte dátum platnosti'); return; }

    setSubmitting(true);
    try {
      const partnerPayload = recipientName ? {
        name: recipientName,
        ico: recipientIco || '',
        dic: recipientDic || '',
        ic_dph: recipientIcDph || '',
        street: recipientStreet || '',
        city: recipientCity || '',
        zip: recipientZip || '',
      } : null;

      const payload = {
        partner: partnerPayload,
        items: items.map((r) => ({
          ...(r.item_id ? { item_id: r.item_id } : {}),
          description: r.item_name || '',
          mj: r.mj || 'ks',
          quantity: parseFloat(r.quantity) || 1,
          unit_price: parseFloat(r.unit_price) || 0,
          vat_rate: parseFloat(r.vat_rate) || 0,
        })),
        valid_until: validUntil,
        vat_rate: vatRate,
        is_vat_payer: isVatPayer,
        discount_percent: 0,
        discount_amount: 0,
        use_partner_discount: false,
        status: 'draft',
        notes,
        payment_method: paymentMethod,
        customer_order_number: customerOrderNumber,
        job_number: jobNumber,
        place_of_supply: placeOfSupply,
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        customer_note: customerNote,
      };

      const res = isEdit
        ? await api.patch(`/quotations/${id}/`, payload)
        : await api.post('/quotations/', payload);
      setSuccess(isEdit ? 'Ponuka bola úspešne uložená!' : `Ponuka ${res.data.quotation_number} bola úspešne vytvorená!`);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Chyba pri ukladaní';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{isEdit ? 'Úprava cenovej ponuky' : 'Nová cenová ponuka'}</h1>
        <button type="button" onClick={() => navigate('/')} className="btn-secondary">
          ← Späť
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* ── Odberateľ — voľne editovateľné polia ─────────── */}
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
              placeholder="napr. ABC s.r.o. alebo Ján Novák" className="input" />
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
            <label className="label">IČ DPH</label>
            <input type="text" value={recipientIcDph} onChange={(e) => setRecipientIcDph(e.target.value)}
              placeholder="SK2012345678" className="input" />
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

      {/* Nastavenia */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Nastavenia</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Platí do *</label>
            <input
              type="date"
              value={validUntil}
              min={today()}
              onChange={(e) => setValidUntil(e.target.value)}
              className="input w-40"
              required
            />
          </div>
          <div>
            <label className="label">Sadzba DPH</label>
            <select
              value={vatRate}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVatRate(v);
                setIsVatPayer(v > 0);
              }}
              className="input w-28"
            >
              <option value={0}>0 %</option>
              <option value={23}>23 %</option>
            </select>
          </div>
          {vatRate === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">
              Ceny sú uvedené bez DPH
            </p>
          )}
        </div>
      </div>

      {/* ── Kontaktné údaje (accordion) ─────────────────── */}
      <Accordion title="Kontaktné údaje" icon="👤">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Kontaktná osoba</label>
            <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Ing. Ján Novák" className="input" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
              placeholder="jan.novak@firma.sk" className="input" />
          </div>
          <div>
            <label className="label">Telefón</label>
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+421 900 000 000" className="input" />
          </div>
        </div>
      </Accordion>

      {/* ── Fakturačné detaily (accordion) ───────────────── */}
      <Accordion title="Fakturačné detaily" icon="📋">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="label">Číslo objednávky</label>
            <input type="text" value={customerOrderNumber} onChange={(e) => setCustomerOrderNumber(e.target.value)}
              placeholder="OBJ-2025-001" className="input" />
          </div>
          <div>
            <label className="label">Zákazka</label>
            <input type="text" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)}
              placeholder="ZAK-2025-001" className="input" />
          </div>
          <div>
            <label className="label">Spôsob úhrady</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
              <option>Bankový prevod</option>
              <option>Hotovosť</option>
              <option>Platobná karta</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Miesto dodania</label>
            <input type="text" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder="Žilina, Slovensko" className="input" />
          </div>
        </div>
      </Accordion>

      {/* ── Poznámky (accordion) ────────────────────────── */}
      <Accordion title="Poznámky" icon="📝">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Poznámka pre zákazníka</label>
            <textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)}
              rows={3} placeholder="Zobrazí sa na ponuke..." className="input resize-none" />
          </div>
          <div>
            <label className="label">Interná poznámka</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Nezobrazí sa na ponuke..." className="input resize-none" />
          </div>
        </div>
      </Accordion>

      {/* Položky */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Položky</h2>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyRow(prev.length + 1, vatRate)])}
            className="btn-secondary text-xs"
          >
            + Pridať položku
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-2 py-2 text-center font-medium w-10">#</th>
                <th className="px-3 py-2 text-left font-medium">Názov položky</th>
                <th className="px-2 py-2 text-right font-medium">Množstvo</th>
                <th className="px-2 py-2 text-center font-medium">MJ</th>
                <th className="px-2 py-2 text-right font-medium">Cena bez DPH</th>
                <th className="px-2 py-2 text-center font-medium">DPH %</th>
                <th className="px-3 py-2 text-right font-medium">Spolu bez DPH</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <ItemRow
                  key={row._key}
                  row={row}
                  index={index}
                  stockItems={stockItems}
                  priceHistory={priceHistory}
                  onChange={handleItemChange}
                  onRemove={handleItemRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">
            Žiadne položky. Kliknite „+ Pridať položku".
          </p>
        )}
      </div>

      {/* Súhrn */}
      <div className="flex justify-end">
        <div className="card p-5 w-full max-w-sm bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Súhrn</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Medzisúčet</span>
              <span>{fmt(summary.subtotal)} €</span>
            </div>
            {isVatPayer && (
              <>
                <div className="flex justify-between border-t border-gray-200 pt-1.5">
                  <span className="text-gray-600">Základ DPH</span>
                  <span>{fmt(summary.subtotal)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">DPH celkom</span>
                  <span>{fmt(summary.vat)} €</span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t-2 border-gray-300 pt-2 text-base font-bold">
              <span>Celkom</span>
              <span className="text-blue-700">{fmt(summary.total)} €</span>
            </div>
            {summary.profitItemCount > 0 && (
              <div className={`flex justify-between border-t border-dashed border-gray-200 pt-2 text-sm font-semibold ${summary.profitTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                <span>Odh. zisk (bez DPH)</span>
                <span>{summary.profitTotal >= 0 ? '+' : ''}{fmt(summary.profitTotal)} €</span>
              </div>
            )}
            {!isVatPayer && (
              <p className="text-xs text-amber-600 mt-1">Ceny sú uvedené bez DPH</p>
            )}
          </div>
        </div>
      </div>

      {/* Akcie */}
      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate('/')} className="btn-secondary">
          Zrušiť
        </button>
        <button
          type="submit"
          disabled={submitting || items.length === 0}
          className="btn-primary px-6 py-2"
        >
          {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Uložiť ponuku'}
        </button>
      </div>
    </form>
  );
}
