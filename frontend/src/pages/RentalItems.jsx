import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const fmt = (n) => isNaN(parseFloat(n)) ? '—' : `${parseFloat(n).toFixed(2)} €`;

export default function RentalItems() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/rental-items/').then((r) => setItems(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Požičovňa DZ</h1>
          <p className="text-sm text-gray-500 mt-0.5">Prenájomný sklad dopravného značenia</p>
        </div>
        <button onClick={() => navigate('/rental-items/new')} className="btn-primary">+ Nová položka</button>
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-2">Prázdny prenájomný sklad</p>
          <button onClick={() => navigate('/rental-items/new')} className="btn-primary mt-2">Pridať prvú položku</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Názov</th>
                  <th className="px-4 py-3 text-left font-medium">Kód</th>
                  <th className="px-4 py-3 text-left font-medium">Naziv TP117</th>
                  <th className="px-4 py-3 text-left font-medium">VRF</th>
                <th className="px-4 py-3 text-right font-medium">Celkovo</th>
                <th className="px-4 py-3 text-right font-medium">Požičané</th>
                <th className="px-4 py-3 text-right font-medium">Dostupné</th>
                <th className="px-4 py-3 text-right font-medium">Denná sadzba</th>
                <th className="px-4 py-3 text-center font-medium">MJ</th>
                <th className="px-4 py-3 text-left font-medium">Rozmery</th>
                <th className="px-4 py-3 text-left font-medium">VRF</th>
                <th className="px-4 py-3 text-right font-medium">Akcie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const avail = item.available_qty;
                const isLow = avail <= 0;
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.sign_code || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{item.sign_name_sk || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {item.retroreflex_class ? <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">{item.retroreflex_class}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.total_qty}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-medium">{item.rented_qty}</td>
                    <td className={`px-4 py-3 text-right font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                      {avail}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(item.daily_rate)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{item.mj}</td>
                    <td className="px-4 py-3 text-left text-gray-500 text-xs">{item.dimensions || '—'}</td>
                    <td className="px-4 py-3 text-left text-gray-500 text-xs">{item.vrf_class || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => navigate(`/rental-items/${item.id}/edit`)} className="btn-secondary text-xs">✏ Upraviť</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
