import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
let rowKey = 100;

const emptyRow = (pos, defaultVat = 23) => ({
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
});

// Jednoduchá rozbaľovacia sekcia
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

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const fromDnId = searchParams.get('dn');

  // Odberateľ — voľne editovateľné polia (autofill z databázy voliteľný)
  const [recipientName, setRecipientName] = useState('');
  const [recipientIco, setRecipientIco] = useState('');
  const [recipientDic, setRecipientDic] = useState('');
  const [recipientIcDph, setRecipientIcDph] = useState('');
  const [recipientStreet, setRecipientStreet] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [recipientCity, setRecipientCity] = useState('');

  // Základné polia
  const [dueDate, setDueDate] = useState(addDays(14));
  const [vatRate, setVatRate] = useState(23);
  const [isVatPayer, setIsVatPayer] = useState(true);
  const [items, setItems] = useState([emptyRow(1)]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  // Fakturačné detaily
  const [paymentMethod, setPaymentMethod] = useState('Bankový prevod');
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [dateOfSupply, setDateOfSupply] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');

  // Kontaktné údaje
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Poznámky
  const [customerNote, setCustomerNote] = useState('');
  const [internalNote, setInternalNote] = useState('');

  // Stav
  const [stockItems, setStockItems] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createDeliveryNote, setCreateDeliveryNote] = useState(false);

  useEffect(() => {
    api.get('/items/').then((r) => setStockItems(r.data)).catch(() => {
      setError('Nepodarilo sa načítať položky skladu. Skontroluj, či beží backend (port 8000).');
    });
    api.get('/invoices/').then((r) => {
      const history = {};
      for (const inv of r.data) {
        for (const ii of inv.items || []) {
          if (!ii.item) continue;
          if (!history[ii.item]) history[ii.item] = [];
          history[ii.item].push(parseFloat(ii.unit_price));
        }
      }
      setPriceHistory(history);
    }).catch(() => {});
  }, []);

  // Načítanie existujúcej faktúry v režime úpravy
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/invoices/${id}/`).then((r) => {
      const inv = r.data;
      const p = inv.partner_detail;
      if (p) {
        setRecipientName(p.name || '');
        setRecipientIco(p.ico || '');
        setRecipientDic(p.dic || '');
        setRecipientIcDph(p.ic_dph || '');
        setRecipientStreet(p.street || '');
        setRecipientZip(p.zip_code || '');
        setRecipientCity(p.city || '');
      }
      setDueDate(inv.due_date || addDays(14));
      setVatRate(inv.vat_rate ?? 23);
      setIsVatPayer(inv.is_vat_payer ?? true);
      setPaymentMethod(inv.payment_method || 'Bankový prevod');
      setCustomerOrderNumber(inv.customer_order_number || '');
      setJobNumber(inv.job_number || '');
      setDateOfSupply(inv.date_of_supply || '');
      setPlaceOfSupply(inv.place_of_supply || '');
      setContactPerson(inv.contact_person || '');
      setContactEmail(inv.contact_email || '');
      setContactPhone(inv.contact_phone || '');
      setCustomerNote(inv.customer_note || '');
      setInternalNote(inv.internal_note || '');
      if (inv.items?.length) {
        setItems(inv.items.map((ii, i) => ({
          _key: rowKey++,
          pos: i + 1,
          item_id: ii.item || '',
          item_name: ii.item_name || ii.description || '',
          mj: ii.mj || 'ks',
          quantity: ii.quantity,
          unit_price: ii.unit_price,
          vat_rate: parseFloat(ii.vat_rate) || 23,
          _stockQty: null,
          _priceHistory: [],
        })));
      }
    }).catch(() => setError('Nepodarilo sa načítať faktúru'));
  }, [id, isEdit]);

  // Predvyplnenie z dodacieho listu
  useEffect(() => {
    if (!fromDnId || isEdit) return;
    api.get(`/delivery-notes/${fromDnId}/`).then((r) => {
      const dn = r.data;
      const p = dn.partner_detail;
      if (p) {
        setRecipientName(p.name || '');
        setRecipientIco(p.ico || '');
        setRecipientDic(p.dic || '');
        setRecipientIcDph(p.ic_dph || '');
        setRecipientStreet(p.street || '');
        setRecipientZip(p.zip_code || '');
        setRecipientCity(p.city || '');
      } else {
        setRecipientName(dn.partner_name || '');
        setRecipientIco(dn.partner_ico || '');
        setRecipientDic(dn.partner_dic || '');
      }
      if (dn.items?.length) {
        setItems(dn.items.map((it, i) => ({
          _key: rowKey++,
          pos: it.pos ?? i + 1,
          item_id: it.item || '',
          item_name: it.item_name || '',
          mj: it.mj || 'ks',
          quantity: it.quantity,
          unit_price: '',
          vat_rate: 23,
          _stockQty: null,
          _priceHistory: [],
        })));
      }
    }).catch(() => {});
  }, [fromDnId, isEdit]);

  // Prefill z ukončeného prenájmu
  useEffect(() => {
    const fromRental = searchParams.get('from_rental');
    if (!fromRental || isEdit) return;
    const stored = sessionStorage.getItem('rentalInvoicePrefill');
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      sessionStorage.removeItem('rentalInvoicePrefill');
      const p = data.partner || {};
      if (p.name) {
        setRecipientName(p.name || '');
        setRecipientIco(p.ico || '');
        setRecipientDic(p.dic || '');
        setRecipientStreet(p.street || '');
        setRecipientZip(p.zip || '');
        setRecipientCity(p.city || '');
      }
      if (data.items?.length) {
        setItems(data.items.map((it, i) => ({
          _key: Date.now() + i,
          pos: i + 1,
          item_id: '',
          item_name: it.description || it.item_name || '',
          quantity: it.quantity || 1,
          mj: it.mj || 'dní',
          unit_price: it.unit_price || 0,
          vat_rate: it.vat_rate ?? 23,
          _priceHistory: [],
          _stockQty: null,
        })));
      }
    } catch (e) {
      console.error('Chyba pri načítaní rental prefill:', e);
    }
  }, [searchParams, isEdit]);

  // Autofill z databázy — plní editovateľné polia
  const handleSelectPartner = useCallback((p) => {
    setRecipientName(p.name || '');
    setRecipientIco(p.ico || '');
    setRecipientDic(p.dic || '');
    setRecipientIcDph(p.ic_dph || '');
    setRecipientStreet(p.street || '');
    setRecipientZip(p.zip_code || p.zip || '');
    setRecipientCity(p.city || '');
    if (p.default_discount_active && parseFloat(p.default_discount_percent) > 0) {
      setDiscountPercent(String(p.default_discount_percent));
    }
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
    let subtotalItems = 0;
    let vatTotal = 0;
    let profitTotal = 0;
    let profitItemCount = 0;
    for (const row of items) {
      const qty = parseFloat(row.quantity || 0);
      const sell = parseFloat(row.unit_price || 0);
      const lineBase = qty * sell;
      subtotalItems += lineBase;
      if (isVatPayer) {
        vatTotal += lineBase * ((parseFloat(row.vat_rate) || 0) / 100);
      }
      const buy = parseFloat(row._avgPurchasePrice || 0);
      if (buy > 0) {
        profitTotal += (sell - buy) * qty;
        profitItemCount++;
      }
    }
    const dp = parseFloat(discountPercent) || 0;
    const da = parseFloat(discountAmount) || 0;
    const invoiceDiscount = dp > 0 ? subtotalItems * (dp / 100) : da;
    const discountRatio = subtotalItems > 0 ? invoiceDiscount / subtotalItems : 0;
    const vatAfterDiscount = vatTotal * (1 - discountRatio);
    const afterDiscount = subtotalItems - invoiceDiscount;
    const profitAfterDiscount = profitTotal * (1 - discountRatio);
    return {
      subtotalItems, invoiceDiscount, afterDiscount,
      vat: vatAfterDiscount, total: afterDiscount + vatAfterDiscount,
      profitTotal: profitAfterDiscount, profitItemCount,
    };
  }, [items, discountPercent, discountAmount, isVatPayer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) { setError('Pridajte aspoň jednu položku'); return; }
    const invalid = items.find((r) => !r.item_name?.trim());
    if (invalid) { setError('Každá položka musí mať názov'); return; }
    if (!dueDate) { setError('Zadajte dátum splatnosti'); return; }

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
        due_date: dueDate,
        vat_rate: vatRate,
        is_vat_payer: isVatPayer,
        discount_percent: parseFloat(discountPercent) || 0,
        discount_amount: parseFloat(discountAmount) || 0,
        use_partner_discount: false,
        // Fakturačné detaily
        payment_method: paymentMethod,
        customer_order_number: customerOrderNumber,
        job_number: jobNumber,
        date_of_supply: dateOfSupply || null,
        place_of_supply: placeOfSupply,
        // Kontaktné údaje
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        // Poznámky
        customer_note: customerNote,
        internal_note: internalNote,
      };

      const res = isEdit
        ? await api.patch(`/invoices/${id}/`, payload)
        : await api.post('/invoices/', payload);

      // Ak zaškrtnutý checkbox, vytvor aj dodací list
      if (!isEdit && createDeliveryNote) {
        const invoiceId = res.data.id;
        const dnPayload = {
          partner: partnerPayload,
          items: items.map((r, i) => ({
            pos: r.pos ?? i + 1,
            item_id: r.item_id || null,
            item_name: r.item_name || '',
            quantity: parseFloat(r.quantity) || 1,
            mj: r.mj || 'ks',
          })),
          notes: customerNote || '',
          invoice_id: invoiceId,
        };
        await api.post('/delivery-notes/', dnPayload);
      }

      setSuccess(isEdit ? 'Faktúra bola úspešne uložená!' : `Faktúra ${res.data.invoice_number} bola úspešne vytvorená!`);
      setTimeout(() => navigate('/invoices'), 1500);
    } catch (err) {
      const d = err.response?.data;
      const msg = (typeof d === 'string' ? d : d?.error || d?.detail || JSON.stringify(d)) || 'Chyba pri ukladaní';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{isEdit ? 'Úprava faktúry' : 'Nová faktúra'}</h1>
        <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">
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

      {/* ── Základné nastavenia ─────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Nastavenia</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Dátum splatnosti *</label>
            <input
              type="date" value={dueDate} min={today()}
              onChange={(e) => setDueDate(e.target.value)}
              className="input w-40" required
            />
          </div>
          <div>
            <label className="label">Sadzba DPH</label>
            <select
              value={vatRate}
              onChange={(e) => { const v = Number(e.target.value); setVatRate(v); setIsVatPayer(v > 0); }}
              className="input w-28"
            >
              <option value={0}>0 %</option>
              <option value={23}>23 %</option>
            </select>
          </div>
          <div>
            <label className="label">Spôsob úhrady</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input w-48">
              <option>Bankový prevod</option>
              <option>Hotovosť</option>
              <option>Platobná karta</option>
            </select>
          </div>
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
            <label className="label">Dátum dodania</label>
            <input type="date" value={dateOfSupply} onChange={(e) => setDateOfSupply(e.target.value)}
              className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Miesto dodania</label>
            <input type="text" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder="Žilina, Slovensko" className="input" />
          </div>
        </div>
      </Accordion>

      {/* ── Položky ─────────────────────────────────────── */}
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
          <p className="text-center text-gray-400 text-sm py-6">Žiadne položky. Kliknite „+ Pridať položku".</p>
        )}
      </div>

      {/* ── Zľava + Súhrn ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Zľava na celú faktúru</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Zľava (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={discountPercent}
                onChange={(e) => { setDiscountPercent(e.target.value); setDiscountAmount(''); }}
                placeholder="0" className="input text-right" />
            </div>
            <div>
              <label className="label">Zľava (€)</label>
              <input type="number" min="0" step="0.01" value={discountAmount}
                disabled={parseFloat(discountPercent) > 0}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className={`input text-right ${parseFloat(discountPercent) > 0 ? 'bg-gray-50 text-gray-400' : ''}`} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">Percento má prednosť pred sumou.</p>
        </div>

        <div className="card p-5 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Súhrn</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Medzisúčet</span>
              <span>{fmt(summary.subtotalItems)} €</span>
            </div>
            {summary.invoiceDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Zľava na faktúru</span>
                <span>−{fmt(summary.invoiceDiscount)} €</span>
              </div>
            )}
            {isVatPayer && (
              <>
                <div className="flex justify-between border-t border-gray-200 pt-1.5">
                  <span className="text-gray-600">Základ DPH</span>
                  <span>{fmt(summary.afterDiscount)} €</span>
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
          </div>
        </div>
      </div>

      {/* ── Poznámky (accordion) ────────────────────────── */}
      <Accordion title="Poznámky" icon="📝">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Poznámka pre zákazníka</label>
            <textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)}
              rows={3} placeholder="Zobrazí sa na faktúre..." className="input resize-none" />
          </div>
          <div>
            <label className="label">Interná poznámka</label>
            <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)}
              rows={3} placeholder="Nezobrazí sa na faktúre..." className="input resize-none" />
          </div>
        </div>
      </Accordion>

      {/* ── Dodací list checkbox ────────────────────────── */}
      {!isEdit && (
        <div className="card p-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="createDN"
            checked={createDeliveryNote}
            onChange={(e) => setCreateDeliveryNote(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="createDN" className="text-sm text-gray-700 cursor-pointer select-none">
            Vytvoriť aj dodací list s rovnakými položkami
          </label>
        </div>
      )}

      {/* ── Akcie ───────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">Zrušiť</button>
        <button type="submit" disabled={submitting || items.length === 0} className="btn-primary px-6 py-2">
          {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Vystaviť faktúru'}
        </button>
      </div>
    </form>
  );
}
