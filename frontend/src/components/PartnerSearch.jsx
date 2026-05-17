import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../api/axios';

export default function PartnerSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/invoices/search-partner/?q=${encodeURIComponent(q)}`);
      const data = Array.isArray(res.data) ? res.data : [res.data];
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setError('Firma nenájdená');
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 400);
  };

  const handleSelect = (partner) => {
    setQuery(partner.name);
    setOpen(false);
    onSelect(partner);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="label">Vyhľadať partnera (IČO alebo názov) *</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="napr. 12345678 alebo ABC s.r.o."
          className="input pr-8"
        />
        {loading && (
          <span className="absolute right-2 top-2 text-gray-400 text-xs">...</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((p, i) => (
            <li
              key={p.ico || i}
              className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
              onMouseDown={() => handleSelect(p)}
            >
              <div className="font-medium text-sm text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                IČO: {p.ico}
                {p.dic && ` · DIČ: ${p.dic}`}
                {(p.full_address || p.city) && ` · ${p.full_address || p.city}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
