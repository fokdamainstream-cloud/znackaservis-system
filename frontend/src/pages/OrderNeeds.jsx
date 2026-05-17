import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const STATUS_LABELS = {
  pending: 'Čaká',
  ordered: 'Objednané',
  partial: 'Čiastočne',
  done: 'Prijaté',
};
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  ordered: 'bg-blue-100 text-blue-700',
  partial: 'bg-orange-100 text-orange-700',
  done: 'bg-green-100 text-green-700',
};

export default function OrderNeeds() {
  const navigate = useNavigate();
  const [needs, setNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    api.get('/order-needs/').then(r => setNeeds(r.data)).finally(() => setLoading(false));
  }, []);

  const displayed = needs.filter(n => {
    if (filter === 'active') return n.status !== 'done';
    if (filter === 'done') return n.status === 'done';
    return true;
  });

  const pendingCount = needs.filter(n => n.status === 'pending').length;

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Odoslané objednávky</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-yellow-600 mt-0.5">{pendingCount} položiek čaká na objednanie</p>
          )}
        </div>
        <button onClick={() => navigate('/order-needs/receive')} className="btn-primary">
          + Naskladniť (prijatá dodávka)
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[['active', 'Aktívne'], ['done', 'Prijaté'], ['all', 'Všetky']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-1">Žiadne položky na objednanie</p>
          <p className="text-sm">Pridajte BOM položky v detaile zákazky</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Položka</th>
                  <th className="px-4 py-3 text-left font-medium">Celkom</th>
                  <th className="px-4 py-3 text-left font-medium">Prijaté</th>
                  <th className="px-4 py-3 text-left font-medium">Zostatok</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Číslo OO</th>
                  <th className="px-4 py-3 text-left font-medium">Zákazky</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{n.item_name}</div>
                      {n.item_detail?.sku && <div className="text-xs text-gray-400">{n.item_detail.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{n.total_qty_needed} {n.mj}</td>
                    <td className="px-4 py-3 text-gray-600">{n.qty_received} {n.mj}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{n.remaining_qty} {n.mj}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[n.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[n.status] || n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{n.order_number || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {n.project_shares?.map(s => (
                        <span key={s.id} className="inline-block bg-gray-100 rounded px-1.5 py-0.5 mr-1 mb-0.5">
                          {s.project_number || s.project_name}
                        </span>
                      ))}
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
