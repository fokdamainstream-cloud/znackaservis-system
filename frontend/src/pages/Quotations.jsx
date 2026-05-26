import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const STATUS_LABELS = {
  draft: 'Koncept',
  sent: 'Odoslaná',
  accepted: 'Akceptovaná',
  rejected: 'Zamietnutá',
  converted: 'Konvertovaná',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
};

const fmt = (n) => (isNaN(parseFloat(n)) ? '—' : `${parseFloat(n).toFixed(2)} €`);

const formatDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('sk-SK');
};

function ConvertModal({ quotation, onClose, onSuccess }) {
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const handleConvert = async () => {
    if (!dueDate) { setError('Zadajte dátum splatnosti'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/quotations/${quotation.id}/convert_to_invoice/`, {
        due_date: dueDate,
      });
      onSuccess(res.data.invoice_number);
    } catch (err) {
      setError(err.response?.data?.error || 'Chyba pri konverzii');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Konvertovať na faktúru</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ponuka: <strong>{quotation.quotation_number}</strong>
        </p>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>
        )}
        <label className="label">Dátum splatnosti *</label>
        <input
          type="date"
          value={dueDate || defaultDue}
          min={today}
          onChange={(e) => setDueDate(e.target.value)}
          className="input mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Zrušiť
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={loading}
            className="btn-success"
          >
            {loading ? 'Konvertujem…' : 'Konvertovať'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailModal({ quotation, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async () => {
    if (!email) return;
    setLoading(true);
    setResult('');
    try {
      await api.post(`/quotations/${quotation.id}/send_email/`, { email }, { timeout: 30000 });
      setResult('success');
    } catch (err) {
      setResult(err.code === 'ECONNABORTED'
        ? 'Timeout — server neodpovedal'
        : err.response?.data?.error || 'Chyba pri odosielaní');
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
          <p className="text-sm text-gray-500 mb-4">Ponuka odoslaná na {email}</p>
          <button onClick={onClose} className="btn-primary">Zavrieť</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Odoslať ponuku e-mailom</h3>
        <p className="text-sm text-gray-500 mb-4">Ponuka: <strong>{quotation.quotation_number}</strong></p>
        {typeof result === 'string' && result && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{result}</p>
        )}
        <label className="label">E-mail príjemcu *</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="firma@example.sk" className="input mb-4" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Zrušiť</button>
          <button type="button" onClick={handleSend} disabled={loading || !email} className="btn-primary">
            {loading ? 'Odosielam…' : 'Odoslať'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Quotations() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [convertTarget, setConvertTarget] = useState(null);
  const [emailTarget, setEmailTarget] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations/');
      setQuotations(res.data.sort((a, b) => b.id - a.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.post(`/quotations/${id}/update_status/`, { status: newStatus });
      setQuotations((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: newStatus } : q))
      );
    } catch {
      showToast('Chyba pri zmene statusu');
    }
  };

  const handleConvertSuccess = (invoiceNumber) => {
    setConvertTarget(null);
    showToast(`Faktúra ${invoiceNumber} bola úspešne vytvorená!`);
    load();
  };

  const handleDownload = async (q) => {
    try {
      const res = await api.get(`/quotations/${q.id}/download_pdf/`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ponuka_${q.quotation_number}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { showToast('Chyba pri sťahovaní PDF'); }
  };

  const handlePreview = async (q) => {
    try {
      const res = await api.get(`/quotations/${q.id}/download_pdf/`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch { showToast('Chyba pri načítaní náhľadu'); }
  };

  const handlePrint = async (q) => {
    try {
      const res = await api.get(`/quotations/${q.id}/download_pdf/`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const win = window.open(url);
      win.onload = () => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
    } catch { showToast('Chyba pri tlači'); }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Načítavam ponuky…
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Cenové ponuky</h1>
        <button onClick={() => navigate('/quotations/new')} className="btn-primary">
          + Nová ponuka
        </button>
      </div>

      {quotations.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-2">Žiadne cenové ponuky</p>
          <button onClick={() => navigate('/quotations/new')} className="btn-primary mt-2">
            Vytvoriť prvú ponuku
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Číslo</th>
                  <th className="px-4 py-3 text-left font-medium">Partner</th>
                  <th className="px-4 py-3 text-left font-medium">Vytvorená</th>
                  <th className="px-4 py-3 text-left font-medium">Platí do</th>
                  <th className="px-4 py-3 text-right font-medium">Celkom</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">
                      {q.quotation_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {q.partner_detail?.name || q.partner_name || <span className="text-gray-400 italic">—</span>}
                      </div>
                      {(q.partner_detail?.ico || q.partner_ico) && (
                        <div className="text-xs text-gray-500">IČO: {q.partner_detail?.ico || q.partner_ico}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(q.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(q.valid_until)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmt(q.total)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={q.status}
                        disabled={q.status === 'converted'}
                        onChange={(e) => handleStatusChange(q.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer focus:outline-none ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button onClick={() => handlePreview(q)} className="btn-secondary text-xs" title="Náhľad">👁 Náhľad</button>
                        <button onClick={() => handleDownload(q)} className="btn-secondary text-xs" title="Stiahnuť PDF">↓ PDF</button>
                        <button onClick={() => handlePrint(q)} className="btn-secondary text-xs" title="Tlačiť">🖨 Tlač</button>
                        <button onClick={() => setEmailTarget(q)} className="btn-secondary text-xs" title="E-mail">✉ E-mail</button>
                        <button onClick={() => navigate(`/quotations/${q.id}/edit`)} className="btn-secondary text-xs" title="Upraviť">✏ Upraviť</button>
                        {q.status !== 'converted' && q.status !== 'rejected' && (
                          <button onClick={() => setConvertTarget(q)} className="btn-success text-xs">→ Faktúra</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {convertTarget && (
        <ConvertModal
          quotation={convertTarget}
          onClose={() => setConvertTarget(null)}
          onSuccess={handleConvertSuccess}
        />
      )}

      {emailTarget && (
        <EmailModal quotation={emailTarget} onClose={() => setEmailTarget(null)} />
      )}

      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
            <span className="text-white text-sm font-medium">Náhľad cenovej ponuky</span>
            <button onClick={closePreview} className="text-white hover:text-gray-300 text-2xl leading-none">×</button>
          </div>
          <iframe src={previewUrl} className="flex-1 w-full border-0" title="Náhľad ponuky" />
        </div>
      )}
    </div>
  );
}
