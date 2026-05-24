import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const fmt = (n) => (isNaN(parseFloat(n)) ? '—' : `${parseFloat(n).toFixed(2)} €`);

const formatDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('sk-SK');
};

function EmailModal({ invoice, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async () => {
    if (!email) return;
    setLoading(true);
    setResult('');
    try {
      await api.post(`/invoices/${invoice.id}/send_email/`, { email }, { timeout: 30000 });
      setResult('success');
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setResult('Timeout — server neodpovedal. Skontroluj SMTP nastavenia.');
      } else {
        setResult(err.response?.data?.error || 'Chyba pri odosielaní e-mailu');
      }
    } finally {
      setLoading(false);
    }
  };

  if (result === 'success') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="font-semibold text-green-700 mb-1">E-mail odoslaný</h3>
          <p className="text-sm text-gray-500 mb-4">Faktúra bola odoslaná na {email}</p>
          <button onClick={onClose} className="btn-primary">Zavrieť</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Odoslať faktúru e-mailom</h3>
        <p className="text-sm text-gray-500 mb-4">
          Faktúra: <strong>{invoice.invoice_number}</strong>
        </p>
        {typeof result === 'string' && result && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{result}</p>
        )}
        <label className="label">E-mail príjemcu *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="firma@example.sk"
          className="input mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Zrušiť</button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !email}
            className="btn-primary"
          >
            {loading ? 'Odosielam…' : 'Odoslať'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailTarget, setEmailTarget] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    api.get('/invoices/')
      .then((r) => setInvoices(r.data.sort((a, b) => b.id - a.id)))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id, number) => {
    try {
      const res = await api.get(`/invoices/${id}/download_pdf/`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faktura_${number}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      alert('Chyba pri sťahovaní PDF');
    }
  };

  const handlePreview = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}/download_pdf/`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPreviewUrl(url);
    } catch {
      alert('Chyba pri načítaní náhľadu');
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Načítavam faktúry…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Faktúry</h1>
        <button onClick={() => navigate('/invoices/new')} className="btn-primary">
          + Nová faktúra
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>Žiadne faktúry. Skonvertujte cenovú ponuku na faktúru.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Číslo faktúry</th>
                  <th className="px-4 py-3 text-left font-medium">Dodací list</th>
                  <th className="px-4 py-3 text-left font-medium">Partner</th>
                  <th className="px-4 py-3 text-left font-medium">Vystavená</th>
                  <th className="px-4 py-3 text-left font-medium">Splatnosť</th>
                  <th className="px-4 py-3 text-right font-medium">Základ</th>
                  <th className="px-4 py-3 text-right font-medium">DPH</th>
                  <th className="px-4 py-3 text-right font-medium">Celkom</th>
                  <th className="px-4 py-3 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {inv.delivery_note || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {inv.partner_detail?.name || inv.partner_name || <span className="text-gray-400 italic">—</span>}
                      </div>
                      {(inv.partner_detail?.ico || inv.partner_ico) && (
                        <div className="text-xs text-gray-500">IČO: {inv.partner_detail?.ico || inv.partner_ico}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(inv.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(inv.vat_amount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(inv.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                          className="btn-secondary text-xs"
                          title="Upraviť"
                        >
                          ✏ Upraviť
                        </button>
                        <button
                          onClick={() => handlePreview(inv)}
                          className="btn-secondary text-xs"
                          title="Náhľad faktúry"
                        >
                          👁 Náhľad
                        </button>
                        <button
                          onClick={() => handleDownload(inv.id, inv.invoice_number)}
                          className="btn-secondary text-xs"
                          title="Stiahnuť PDF"
                        >
                          ↓ PDF
                        </button>
                        <button
                          onClick={() => setEmailTarget(inv)}
                          className="btn-secondary text-xs"
                          title="Odoslať e-mailom"
                        >
                          ✉ E-mail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {emailTarget && (
        <EmailModal invoice={emailTarget} onClose={() => setEmailTarget(null)} />
      )}

      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
            <span className="text-white text-sm font-medium">Náhľad faktúry</span>
            <button
              onClick={closePreview}
              className="text-white hover:text-gray-300 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <iframe
            src={previewUrl}
            className="flex-1 w-full border-0"
            title="Náhľad faktúry"
          />
        </div>
      )}
    </div>
  );
}
