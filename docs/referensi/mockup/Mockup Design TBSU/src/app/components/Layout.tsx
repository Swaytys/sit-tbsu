import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Store,
  Undo2,
  Download,
  CheckSquare,
  FileText,
  Menu,
  Bell,
  Search,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Users,
  UserCheck,
  Building2,
  XCircle,
  Settings,
  Boxes,
  X,
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';

type MenuItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

type MenuGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  roles: UserRole[];
};

type SingleMenuItem = MenuItem & { single: true };

type NavEntry = MenuGroup | SingleMenuItem;

const ALL_ROLES: UserRole[] = ['staf', 'kasir', 'admin', 'owner'];

const NAV_STRUCTURE: NavEntry[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ALL_ROLES,
    single: true,
  },
  {
    id: 'data-master',
    label: 'Data Master',
    icon: Package,
    roles: ['staf', 'kasir', 'admin', 'owner'],
    items: [
      { path: '/master-barang', label: 'Data Barang', icon: Boxes, roles: ['admin', 'owner'] },
      { path: '/data-pelanggan', label: 'Data Pelanggan', icon: UserCheck, roles: ALL_ROLES },
      { path: '/data-pemasok', label: 'Data Pemasok', icon: Building2, roles: ['admin', 'owner'] },
      { path: '/data-pengguna', label: 'Data Pengguna', icon: Users, roles: ['owner'] },
    ],
  },
  {
    id: 'transaksi',
    label: 'Transaksi Penjualan',
    icon: ShoppingCart,
    roles: ALL_ROLES,
    items: [
      { path: '/order-penjualan', label: 'Order Penjualan', icon: ShoppingCart, roles: ALL_ROLES },
      { path: '/penjualan-langsung', label: 'Penjualan Langsung', icon: Store, roles: ['kasir', 'admin', 'owner'] },
      { path: '/penjualan-pengantaran', label: 'Penjualan Pengantaran', icon: Truck, roles: ['kasir', 'admin', 'owner'] },
      { path: '/retur', label: 'Retur Penjualan', icon: Undo2, roles: ['kasir', 'admin', 'owner'] },
      { path: '/void-transaksi', label: 'Void Transaksi', icon: XCircle, roles: ['kasir', 'admin', 'owner'] },
    ],
  },
  {
    id: 'persediaan',
    label: 'Persediaan',
    icon: Download,
    roles: ['admin', 'owner'],
    items: [
      { path: '/penerimaan', label: 'Penerimaan Barang', icon: Download, roles: ['admin', 'owner'] },
      { path: '/persediaan', label: 'Stok Persediaan', icon: Boxes, roles: ['admin', 'owner'] },
    ],
  },
  {
    path: '/clerical-check',
    label: 'Clerical Check',
    icon: CheckSquare,
    roles: ['kasir', 'admin', 'owner'],
    single: true,
  },
  {
    path: '/laporan',
    label: 'Laporan',
    icon: FileText,
    roles: ['admin', 'owner'],
    single: true,
  },
  {
    path: '/pengaturan',
    label: 'Pengaturan',
    icon: Settings,
    roles: ['admin', 'owner'],
    single: true,
  },
];

function hasAccess(roles: UserRole[], userRole: UserRole): boolean {
  return roles.includes(userRole);
}

const NOTIFICATIONS = [
  { id: 1, text: 'Stok Semen Gresik hampir habis (5 sak)', time: '10 menit lalu', type: 'warning' },
  { id: 2, text: 'Order #ORD-2026-0041 menunggu konfirmasi', time: '25 menit lalu', type: 'info' },
  { id: 3, text: 'Pengantaran #SJ-2026-0018 selesai dikirim', time: '1 jam lalu', type: 'success' },
  { id: 4, text: 'Penerimaan barang dari PT Indocement pending', time: '2 jam lalu', type: 'info' },
];

const SEARCH_SUGGESTIONS = [
  { label: 'Semen Gresik 50kg', category: 'Barang', path: '/master-barang' },
  { label: 'ORD-2026-0041', category: 'Order', path: '/order-penjualan' },
  { label: 'PT. Budi Karya', category: 'Pelanggan', path: '/data-pelanggan' },
  { label: 'Laporan Penjualan Bulan Ini', category: 'Laporan', path: '/laporan' },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'data-master': true,
    transaksi: true,
    persediaan: true,
  });
  const [showNotif, setShowNotif] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const userRole: UserRole = user?.role ?? 'staf';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredSuggestions = searchQuery
    ? SEARCH_SUGGESTIONS.filter((s) => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SEARCH_SUGGESTIONS;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col shrink-0`}>
        {/* Logo */}
        <div className="h-14 flex items-center border-b border-slate-800 px-4 shrink-0">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2.5 font-bold text-white">
              <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-black shrink-0">SU</div>
              <div className="leading-tight overflow-hidden">
                <div className="text-sm font-bold text-white truncate">Sumber Urip</div>
                <div className="text-xs text-slate-400 truncate">SIM Operasional</div>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-black mx-auto">SU</div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {NAV_STRUCTURE.map((entry) => {
            // Single item
            if ('single' in entry && entry.single) {
              if (!hasAccess(entry.roles, userRole)) return null;
              const isActive = location.pathname === entry.path || location.pathname.startsWith(entry.path + '/');
              return (
                <div key={entry.path} className="px-2">
                  <Link
                    to={entry.path}
                    title={!isSidebarOpen ? entry.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white text-slate-400'
                    }`}
                  >
                    <entry.icon className="w-4 h-4 shrink-0" />
                    {isSidebarOpen && <span>{entry.label}</span>}
                  </Link>
                </div>
              );
            }

            // Group
            const group = entry as MenuGroup;
            const visibleItems = group.items.filter((item) => hasAccess(item.roles, userRole));
            if (visibleItems.length === 0) return null;

            const isGroupOpen = openGroups[group.id] ?? true;
            const hasActiveChild = visibleItems.some(
              (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            );

            return (
              <div key={group.id} className="px-2">
                {isSidebarOpen ? (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      hasActiveChild && !isGroupOpen ? 'text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <group.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left font-medium">{group.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isGroupOpen ? '' : '-rotate-90'}`} />
                  </button>
                ) : (
                  <button
                    onClick={() => { setSidebarOpen(true); setOpenGroups(prev => ({ ...prev, [group.id]: true })); }}
                    title={group.label}
                    className="w-full flex items-center justify-center px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <group.icon className="w-4 h-4" />
                  </button>
                )}

                {isSidebarOpen && isGroupOpen && (
                  <div className="ml-3 mt-0.5 pl-4 border-l border-slate-700 space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                            isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <item.icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User profile at bottom */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                {user?.name?.charAt(0) ?? 'U'}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'Guest'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.roleLabel ?? '-'}</p>
              </div>
              <button onClick={handleLogout} title="Keluar" className="p-1 hover:text-red-400 text-slate-500 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} title="Keluar" className="w-full flex justify-center p-1.5 hover:text-red-400 text-slate-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search with dropdown */}
            <div className="relative hidden md:block" ref={searchRef}>
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
                placeholder="Cari transaksi, barang, pelanggan..."
                className="pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {showSearch && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 text-xs text-slate-500 font-medium">
                    {searchQuery ? 'Hasil Pencarian' : 'Pencarian Cepat'}
                  </div>
                  {filteredSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { navigate(s.path); setShowSearch(false); setSearchQuery(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
                    >
                      <Search className="w-3 h-3 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-sm text-slate-800">{s.label}</div>
                        <div className="text-xs text-slate-400">{s.category}</div>
                      </div>
                    </button>
                  ))}
                  {filteredSuggestions.length === 0 && (
                    <div className="px-3 py-4 text-sm text-slate-400 text-center">Tidak ada hasil ditemukan</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif(!showNotif)}
                className="relative p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
              {showNotif && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-800">Notifikasi</span>
                    <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">{NOTIFICATIONS.length}</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {NOTIFICATIONS.map((n) => (
                      <div key={n.id} className="flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          n.type === 'warning' ? 'bg-amber-400' : n.type === 'success' ? 'bg-green-400' : 'bg-blue-400'
                        }`} />
                        <div>
                          <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 text-center">
                    <button className="text-xs text-blue-600 hover:underline font-medium">Lihat semua notifikasi</button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            {/* User badge */}
            <div className="flex items-center gap-2 text-sm text-slate-600 px-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0) ?? 'U'}
              </div>
              <div className="hidden md:block leading-tight">
                <div className="text-xs font-semibold text-slate-700">{user?.name ?? 'Guest'}</div>
                <div className="text-xs text-slate-400">{user?.roleLabel ?? '-'}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
