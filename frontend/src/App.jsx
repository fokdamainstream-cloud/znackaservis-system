import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  ClipboardList, ShoppingCart, Truck, FileSpreadsheet, Receipt,
  Package, Warehouse, Users, Contact, PackageX, LogOut,
} from 'lucide-react';
import { UserProvider, useUser } from './context/UserContext';
import Quotations from './pages/Quotations';
import QuotationForm from './pages/QuotationForm';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import DeliveryNotes from './pages/DeliveryNotes';
import DeliveryNoteForm from './pages/DeliveryNoteForm';
import Items from './pages/Items';
import Partners from './pages/Partners';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import ProjectDetail from './pages/ProjectDetail';
import RentalItems from './pages/RentalItems';
import RentalItemForm from './pages/RentalItemForm';
import OrderNeeds from './pages/OrderNeeds';
import StockDeliveryForm from './pages/StockDeliveryForm';
import SentOrders from './pages/SentOrders';
import SentOrderForm from './pages/SentOrderForm';
import StockDeficits from './pages/StockDeficits';

const ADD_ITEMS = [
  { to: '/quotations/new', label: 'Vytvoriť cenovú ponuku', icon: '📋' },
  { to: '/invoices/new', label: 'Vystaviť faktúru', icon: '🧾' },
  { to: '/delivery-notes/new', label: 'Vytvoriť dodací list', icon: '📦' },
  { to: '/projects/new', label: 'Nová prijatá obj.', icon: '🏗' },
  { to: '/order-needs/new', label: 'Nová odoslaná obj.', icon: '📤' },
];

const NAV_SECTIONS = [
  {
    title: 'OBCHOD',
    items: [
      { to: '/projects',       label: 'Prijaté obj.',   Icon: ClipboardList },
      { to: '/order-needs',    label: 'Odoslané obj.',  Icon: ShoppingCart },
      { to: '/delivery-notes', label: 'Dodacie listy',  Icon: Truck },
      { to: '/',               label: 'Cenové ponuky',  Icon: FileSpreadsheet, end: true },
      { to: '/invoices',       label: 'Faktúry',        Icon: Receipt },
    ],
  },
  {
    title: 'SKLADY',
    items: [
      { to: '/items',           label: 'Sklad materiálu', Icon: Package },
      { to: '/rental-items',    label: 'Sklad Požičovňa', Icon: Warehouse },
      { to: '/stock-deficits',  label: 'Chýba na sklade', Icon: PackageX },
    ],
  },
  {
    title: 'ADRESÁR',
    items: [
      { to: '/partners', label: 'Dodávatelia', Icon: Users,    end: true },
      { to: '/partners', label: 'Partneri',    Icon: Contact,  end: true },
    ],
  },
];

function AddDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-primary text-sm flex items-center justify-center gap-1.5 w-full"
      >
        <span className="text-base leading-none">+</span>
        Pridať
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          {ADD_ITEMS.map(({ to, label, icon }) => (
            <button
              key={to}
              onClick={() => { setOpen(false); navigate(to); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2.5 transition-colors"
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginScreen() {
  const { login } = useUser();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    // Krátke oneskorenie pre UX
    setTimeout(() => {
      const result = login(password);
      if (!result.success) setError(result.error);
      setLoading(false);
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-amber-500 rounded-2xl w-16 h-16 flex items-center justify-center font-black text-white text-2xl mx-auto mb-4 shadow-lg">
            ZS
          </div>
          <h1 className="text-xl font-bold text-gray-900">Značka Servis</h1>
          <p className="text-sm text-gray-400 mt-1">Predaj · Požičovňa · Montáž</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Prístupové heslo
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="input w-full"
              placeholder="••••••••"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="btn-primary w-full py-2.5 text-base font-semibold"
          >
            {loading ? 'Overujem…' : 'Prihlásiť sa →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-8">v2.4 · interný systém</p>
      </div>
    </div>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { currentUser, logout, isOwner } = useUser();

  // Opravená logika: end=true → prísna zhoda; inak prefix /to/ alebo presná /to
  // Pre duplicitné záznamy (rovnaké `to`) nechávame oba svietiť – ide o tú istú stránku
  const isActive = (to, end = false) => {
    if (end || to === '/') return pathname === to;
    return pathname === to || pathname.startsWith(to + '/');
  };

  const itemCls = (to, end = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
      isActive(to, end)
        ? 'bg-amber-50 text-amber-900 font-semibold'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`;

  return (
    <aside className="fixed left-0 top-0 w-60 h-screen bg-white border-r border-gray-200 flex flex-col z-40 shadow-sm">

      {/* Hlavička – logo (kompaktné, bez veľkého čierneho panela) */}
      <div className="px-4 py-4 flex-shrink-0 border-b border-gray-100">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 w-full text-left group"
        >
          <div className="bg-amber-500 rounded-lg w-9 h-9 flex items-center justify-center font-black text-white text-base flex-shrink-0 group-hover:bg-amber-600 transition-colors">
            ZS
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-gray-900 leading-tight truncate">Značka Servis</div>
            <div className="text-xs text-gray-400 leading-tight">Predaj · Požičovňa</div>
          </div>
        </button>
      </div>

      {/* Nav sekcie */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map(({ title, items }) => (
          <div key={title}>
            <div className="px-3 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</div>
            <div className="space-y-0.5">
              {items.map(({ to, label, Icon, end }) => (
                <button
                  key={`${to}-${label}`}
                  onClick={() => navigate(to)}
                  className={itemCls(to, end)}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* + Pridať – nad vizitkou */}
      <div className="px-3 py-2 flex-shrink-0 border-t border-gray-100">
        <AddDropdown />
      </div>

      {/* Vizitka prihláseného používateľa */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs flex-shrink-0">
            {currentUser.initials || currentUser.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-800 truncate">{currentUser.name}</div>
            <div className="text-xs text-gray-400">
              {isOwner ? '👑 Majiteľ' : '👤 Používateľ'} · v2.4
            </div>
          </div>
          <button
            onClick={logout}
            title="Odhlásiť sa"
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

    </aside>
  );
}

function AppContent() {
  const { isLoggedIn } = useUser();
  if (!isLoggedIn) return <LoginScreen />;
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pl-60 px-6 py-6 min-h-screen">
        <Routes>
          <Route path="/" element={<Quotations />} />
          <Route path="/quotations/new" element={<QuotationForm />} />
          <Route path="/quotations/:id/edit" element={<QuotationForm />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<InvoiceForm />} />
          <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
          <Route path="/delivery-notes" element={<DeliveryNotes />} />
          <Route path="/delivery-notes/new" element={<DeliveryNoteForm />} />
          <Route path="/delivery-notes/:id/edit" element={<DeliveryNoteForm />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/new" element={<ProjectForm />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<ProjectForm />} />
          <Route path="/rental-items" element={<RentalItems />} />
          <Route path="/rental-items/new" element={<RentalItemForm />} />
          <Route path="/rental-items/:id/edit" element={<RentalItemForm />} />
          <Route path="/order-needs" element={<SentOrders />} />
          <Route path="/order-needs/new" element={<SentOrderForm />} />
          <Route path="/order-needs/receive" element={<StockDeliveryForm />} />
          <Route path="/items" element={<Items />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/stock-deficits" element={<StockDeficits />} />
        </Routes>
      </main>
      <Sidebar />
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </UserProvider>
  );
}
