import { useState, useRef, useEffect } from 'react';

const fmt = (n) => isNaN(n) ? '0.00' : Number(n).toFixed(2);
const MJ_OPTIONS = ['ks', 'm', 'm²', 'm³', 'kg', 't', 'hod', 'kpl', 'l', 'bal'];

export default function ItemRow({ row, index, stockItems, priceHistory, onChange, onRemove }) {
  const [nameInput, setNameInput] = useState(row.item_name || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync nameInput ak sa zmení item_name zvonku (napr. reset formu)
  useEffect(() => {
    setNameInput(row.item_name || '');
  }, [row.item_name]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openDropdown = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom, left: r.left, width: r.width });
    }
    setShowDropdown(true);
  };

  // Vyhľadávanie podľa názvu, SKU alebo ID
  const filtered = (stockItems || []).filter((s) =>
    s.name.toLowerCase().includes(nameInput.toLowerCase()) ||
    (s.sku && s.sku.toLowerCase().includes(nameInput.toLowerCase())) ||
    String(s.id).includes(nameInput)
  );

  const subtotal = parseFloat(row.quantity || 0) * parseFloat(row.unit_price || 0);

  const handleSelectStock = (item) => {
    setNameInput(item.name);
    setShowDropdown(false);
    const history = priceHistory[item.id] || [];
    onChange(index, {
      item_id: item.id,
      item_name: item.name,
      mj: 'ks',
      unit_price: item.unit_price,
      _stockQty: item.quantity,
      _priceHistory: history,
      _avgPurchasePrice: parseFloat(item.avg_purchase_price) || 0,
      _recommendedPrice: parseFloat(item.recommended_price) || 0,
    });
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      {/* # — vždy číslo, editovateľné */}
      <td className="px-2 py-2 w-10">
        <input
          type="number"
          min="1"
          step="1"
          value={Number(row.pos ?? index + 1)}
          onChange={(e) => onChange(index, { pos: parseInt(e.target.value, 10) || index + 1 })}
          className="input text-xs text-center w-10 px-1"
          title="Poradové číslo"
        />
      </td>

      {/* Názov položky */}
      <td className="px-3 py-2 min-w-[200px]">
        <div ref={wrapperRef} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              onChange(index, { item_name: e.target.value, item_id: '' });
              openDropdown();
            }}
            onFocus={openDropdown}
            placeholder="Názov položky (zo skladu alebo vlastný)..."
            className="input text-xs"
          />
          {showDropdown && filtered.length > 0 && (
            <ul
              style={{
                position: 'fixed',
                top: dropPos.top,
                left: dropPos.left,
                width: dropPos.width,
                zIndex: 9999,
              }}
              className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-xs"
            >
              {filtered.map((s) => {
                const buy = parseFloat(s.avg_purchase_price);
                const sell = parseFloat(s.unit_price);
                const rec = parseFloat(s.recommended_price);
                const margin = buy > 0 && sell > 0 ? ((sell - buy) / sell * 100) : null;
                return (
                  <li
                    key={s.id}
                    className="px-2 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                    onMouseDown={() => handleSelectStock(s)}
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      {s.sku && <span className="text-gray-400 font-mono">[{s.sku}]</span>}
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-400">· Predaj: {sell.toFixed(2)} €</span>
                      {rec > 0 && <span className="text-blue-500">· Dod.: {rec.toFixed(2)} €</span>}
                      <span className="text-gray-400">· Sklad: {s.quantity}</span>
                      {margin !== null && (
                        <span className={`font-semibold ${margin >= 20 ? 'text-green-600' : margin >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                          · {margin.toFixed(0)} %
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {row._priceHistory?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="text-xs text-gray-400">Predch.:</span>
            {[...new Set(row._priceHistory)].slice(0, 4).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange(index, { unit_price: p })}
                className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-blue-100 rounded text-gray-600"
              >
                {fmt(p)} €
              </button>
            ))}
          </div>
        )}
        {(row._avgPurchasePrice > 0 || row._recommendedPrice > 0) && (() => {
          const buy = row._avgPurchasePrice || 0;
          const sell = parseFloat(row.unit_price || 0);
          const rec = row._recommendedPrice || 0;
          const qty = parseFloat(row.quantity || 0);
          const margin = buy > 0 && sell > 0 ? ((sell - buy) / sell) * 100 : null;
          const profit = buy > 0 && sell > 0 ? (sell - buy) * qty : null;
          const cls = margin === null ? '' : margin >= 20 ? 'text-green-600' : margin >= 5 ? 'text-amber-600' : 'text-red-600';
          return (
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              {margin !== null && (
                <span className={`text-xs font-semibold ${cls}`}>
                  Marža: {margin.toFixed(1)} % · Zisk: {fmt(profit)} €
                </span>
              )}
              {rec > 0 && (
                <button
                  type="button"
                  onClick={() => onChange(index, { unit_price: rec })}
                  className="text-xs px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                >
                  Použi dod. cenu ({fmt(rec)} €)
                </button>
              )}
            </div>
          );
        })()}
      </td>

      {/* Množstvo */}
      <td className="px-2 py-2 w-24">
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.quantity}
          onChange={(e) => onChange(index, { quantity: e.target.value })}
          className="input text-xs text-right"
        />
      </td>

      {/* MJ — merná jednotka */}
      <td className="px-2 py-2 w-20">
        <select
          value={row.mj || 'ks'}
          onChange={(e) => onChange(index, { mj: e.target.value })}
          className="input text-xs text-center px-1"
        >
          {MJ_OPTIONS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </td>

      {/* Cena bez DPH */}
      <td className="px-2 py-2 w-28">
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.unit_price}
          onChange={(e) => onChange(index, { unit_price: e.target.value })}
          className="input text-xs text-right"
        />
      </td>

      {/* DPH % — editovateľný select */}
      <td className="px-2 py-2 w-28">
        <div className="flex items-center gap-1">
          <select
            value={[0, 23].includes(Number(row.vat_rate)) ? String(Number(row.vat_rate)) : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                onChange(index, { vat_rate: 10 });
              } else {
                onChange(index, { vat_rate: Number(e.target.value) });
              }
            }}
            className="input text-xs text-center px-1 w-16"
          >
            <option value="0">0 %</option>
            <option value="23">23 %</option>
            <option value="custom">Vlastná</option>
          </select>
          {![0, 23].includes(Number(row.vat_rate)) && (
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={row.vat_rate}
              onChange={(e) => onChange(index, { vat_rate: Number(e.target.value) })}
              className="input text-xs text-center w-10 px-1"
            />
          )}
        </div>
      </td>

      {/* Spolu bez DPH */}
      <td className="px-3 py-2 w-28 text-right text-sm font-medium text-gray-800">
        {fmt(subtotal)} €
      </td>

      {/* Odstrániť */}
      <td className="px-2 py-2 w-10 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 text-lg leading-none"
          title="Odstrániť"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
