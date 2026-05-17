import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const STATUS_LABELS = { open: 'Otvorená', done: 'Dokončená', invoiced: 'Fakturovaná' };
const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  done: 'bg-gray-100 text-gray-600',
  invoiced: 'bg-green-100 text-green-700',
};

const formatDate = (s) => s ? new Date(s).toLocaleDateString('sk-SK') : '—';

const FILTERS = [
  { key: 'all', label: 'Všetky' },
  { key: 'rental', label: '🟢 Prebieha prenájom' },
  { key: 'sale', label: '🔵 Čistý predaj' },
];

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/projects/').then((r) => setProjects(r.data)).finally(() => setLoading(false));
  }, []);

  const displayed = projects.filter(p => {
    if (filter === 'rental') return p.has_active_rental;
    if (filter === 'sale') return p.has_sales && !p.has_active_rental;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam prijaté objednávky…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Prijaté objednávky</h1>
        <button onClick={() => navigate('/projects/new')} className="btn-primary">+ Nová prijatá obj.</button>
      </div>

      {/* Filtre */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
        {filter !== 'all' && (
          <span className="ml-1 self-center text-xs text-gray-400">{displayed.length} objednávok</span>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-2">{filter === 'all' ? 'Žiadne prijaté objednávky' : 'Žiadne prijaté objednávky pre tento filter'}</p>
          {filter === 'all' && (
            <button onClick={() => navigate('/projects/new')} className="btn-primary mt-2">Vytvoriť prvú objednávku</button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Číslo</th>
                  <th className="px-4 py-3 text-left font-medium">Zákazka</th>
                  <th className="px-4 py-3 text-left font-medium">Partner</th>
                  <th className="px-4 py-3 text-center font-medium">Stav</th>
                  <th className="px-4 py-3 text-left font-medium">Typ</th>
                  <th className="px-4 py-3 text-center font-medium">Fakt.</th>
                  <th className="px-4 py-3 text-center font-medium">Ponuky</th>
                  <th className="px-4 py-3 text-center font-medium">DL</th>
                  <th className="px-4 py-3 text-left font-medium">Vytvorená</th>
                  <th className="px-4 py-3 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 whitespace-nowrap">{p.project_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.partner_detail?.name || p.partner_name || <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {p.has_active_rental && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                            🟢 Požičovňa
                          </span>
                        )}
                        {p.has_sales && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                            🔵 Sklad
                          </span>
                        )}
                        {!p.has_active_rental && !p.has_sales && (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.invoice_count}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.quotation_count}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.delivery_note_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => navigate(`/projects/${p.id}`)} className="btn-primary text-xs">Detail</button>
                        <button onClick={() => navigate(`/projects/${p.id}/edit`)} className="btn-secondary text-xs">✏</button>
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
