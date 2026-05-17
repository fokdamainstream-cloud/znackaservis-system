import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const fmt = n => (n == null ? '—' : parseFloat(n).toLocaleString('sk-SK', { maximumFractionDigits: 3 }));

export default function StockDeficits() {
  const navigate = useNavigate();
  const [deficits, setDeficits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api.get('/bom-items/deficits/')
      .then(r => setDeficits(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Načítavam deficity…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Chýba na sklade</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Materiál potrebný v otvorených zákazkách, ktorý nie je dostatočne naskladnený
          </p>
        </div>
        <button onClick={() => navigate('/order-needs/new')} className="btn-primary text-sm">
          📤 Nová odoslaná obj.
        </button>
      </div>

      {deficits.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-lg font-medium text-gray-600">Všetok materiál je dostatočne naskladnený</p>
          <p className="text-sm mt-1">Žiadne otvorené zákazky nemajú deficit voči aktuálnemu stavu skladu.</p>
        </div>
      ) : (
        <>
          {/* Súhrnný banner */}
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
            <span className="text-red-500 text-2xl">⚠</span>
            <div>
              <div className="font-semibold text-red-800">{deficits.length} {deficits.length === 1 ? 'položka chýba' : deficits.length < 5 ? 'položky chýbajú' : 'položiek chýba'} na sklade</div>
              <div className="text-red-600 text-xs">zo všetkých otvorených prijatých objednávok (zákaziek)</div>
            </div>
          </div>

          <div className="space-y-2">
            {deficits.map((d, idx) => {
              const key = d.item_id ?? `__${d.item_name}`;
              const isOpen = expanded[key];
              const deficitPct = d.stock_qty != null
                ? Math.min(100, Math.round((d.stock_qty / d.total_needed) * 100))
                : 0;

              return (
                <div key={key} className="card overflow-hidden">
                  {/* Hlavička položky */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggle(key)}
                  >
                    {/* Červený kruh s číslom */}
                    <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>

                    {/* Názov + SKU */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{d.item_name}</div>
                      {d.sku && <div className="text-xs text-gray-400 font-mono">{d.sku}</div>}
                    </div>

                    {/* Progress */}
                    <div className="w-32 hidden sm:block">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{ width: `${deficitPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{deficitPct}%</span>
                      </div>
                    </div>

                    {/* Čísla */}
                    <div className="text-right flex-shrink-0 min-w-[130px]">
                      <div className="text-sm text-gray-500">
                        Na sklade: <span className="font-semibold text-gray-700">{d.stock_qty != null ? fmt(d.stock_qty) : '?'} {d.mj}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Potreba: <span className="font-semibold text-gray-800">{fmt(d.total_needed)} {d.mj}</span>
                      </div>
                    </div>

                    {/* Deficit badge */}
                    <div className="flex-shrink-0 ml-2">
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                        −{fmt(d.deficit)} {d.mj}
                      </span>
                    </div>

                    {/* Expand chevron */}
                    <svg
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Rozbalený rozpis zákaziek */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      <div className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Rozpis podľa zákaziek
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                            <th className="px-5 py-2 text-left font-medium">Zákazka</th>
                            <th className="px-5 py-2 text-left font-medium">Názov</th>
                            <th className="px-5 py-2 text-right font-medium">Potreba</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {d.projects.map((p, pi) => (
                            <tr key={pi} className="hover:bg-white transition-colors">
                              <td className="px-5 py-2.5">
                                <button
                                  onClick={() => navigate(`/projects/${p.project_id}`)}
                                  className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                                >
                                  {p.project_number || `#${p.project_id}`}
                                </button>
                              </td>
                              <td className="px-5 py-2.5 text-gray-700 text-sm">{p.project_name}</td>
                              <td className="px-5 py-2.5 text-right font-semibold text-gray-800">
                                {fmt(p.quantity_needed)} <span className="text-gray-400 font-normal">{d.mj}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-red-50">
                            <td colSpan={2} className="px-5 py-2 text-xs text-red-700 font-semibold">
                              Celkový deficit voči skladu
                            </td>
                            <td className="px-5 py-2 text-right font-bold text-red-700">
                              −{fmt(d.deficit)} {d.mj}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
