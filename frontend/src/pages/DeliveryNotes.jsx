import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const formatDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('sk-SK');
};

const TYPE_LABELS = {
  standard: 'Výdaj',
  rental_out: 'Prenájom ↑',
  rental_return: 'Vratka ↓',
};

const TYPE_COLORS = {
  standard: 'bg-gray-100 text-gray-600',
  rental_out: 'bg-orange-100 text-orange-700',
  rental_return: 'bg-green-100 text-green-700',
};

export default function DeliveryNotes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/delivery-notes/')
      .then((r) => setNotes(r.data.sort((a, b) => b.id - a.id)))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (id, number) => {
    const a = document.createElement('a');
    a.href = `/api/delivery-notes/${id}/download_pdf/`;
    a.download = `dodaci_list_${number.replace(/\//g, '_')}.pdf`;
    a.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam dodacie listy…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Dodacie listy</h1>
        <button onClick={() => navigate('/delivery-notes/new')} className="btn-primary">
          + Nový dodací list
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-2">Žiadne dodacie listy</p>
          <button onClick={() => navigate('/delivery-notes/new')} className="btn-primary mt-2">
            Vytvoriť prvý dodací list
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Číslo</th>
                  <th className="px-4 py-3 text-left font-medium">Typ</th>
                  <th className="px-4 py-3 text-left font-medium">Partner</th>
                  <th className="px-4 py-3 text-left font-medium">Zákazka</th>
                  <th className="px-4 py-3 text-left font-medium">Dátum</th>
                  <th className="px-4 py-3 text-right font-medium">Pol.</th>
                  <th className="px-4 py-3 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notes.map((dn) => (
                  <tr key={dn.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">
                      {dn.delivery_note_number}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[dn.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[dn.type] || dn.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {dn.partner_detail?.name || dn.partner_name || <span className="text-gray-400 italic">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {dn.project_name || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(dn.created_at)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{dn.items?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => navigate(`/delivery-notes/${dn.id}/edit`)}
                          className="btn-secondary text-xs" title="Upraviť">✏ Upraviť</button>
                        <button onClick={() => handleDownload(dn.id, dn.delivery_note_number)}
                          className="btn-secondary text-xs" title="PDF">↓ PDF</button>
                        {!dn.invoice && dn.type === 'standard' && (
                          <button onClick={() => navigate(`/invoices/new?dn=${dn.id}`)}
                            className="btn-primary text-xs">→ Faktúra</button>
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
    </div>
  );
}
