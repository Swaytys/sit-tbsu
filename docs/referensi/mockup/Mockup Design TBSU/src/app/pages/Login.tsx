import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock, User, Store, ChevronRight } from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';

const DEMO_ROLES: { role: UserRole; label: string; color: string; username: string; desc: string }[] = [
  { role: 'owner', label: 'Owner', color: 'bg-purple-600 hover:bg-purple-700', username: 'hendra.w', desc: 'Akses penuh semua fitur' },
  { role: 'admin', label: 'Administrator', color: 'bg-blue-600 hover:bg-blue-700', username: 'budi.s', desc: 'Kelola data & laporan' },
  { role: 'kasir', label: 'Kasir', color: 'bg-teal-600 hover:bg-teal-700', username: 'siti.r', desc: 'Transaksi & pembayaran' },
  { role: 'staf', label: 'Staf Penjualan', color: 'bg-slate-600 hover:bg-slate-700', username: 'agus.p', desc: 'Order & pelanggan' },
];

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login('admin');
      navigate('/dashboard');
    }, 600);
  };

  const handleQuickLogin = (role: UserRole) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(role);
      navigate('/dashboard');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-0 shadow-2xl rounded-2xl overflow-hidden">
        {/* Left panel - branding */}
        <div className="bg-blue-700 p-10 flex flex-col justify-between text-white hidden lg:flex">
          <div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
              <Store className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2 leading-tight">UD. Sumber Urip</h1>
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-6">
              Sistem Informasi Operasional
            </p>
            <p className="text-blue-100 text-sm leading-relaxed">
              Platform manajemen toko bahan bangunan terintegrasi — penjualan, persediaan, dan laporan dalam satu sistem.
            </p>
          </div>
          <div className="text-blue-300 text-xs">
            Versi 1.0.0 &copy; 2026 UD. Sumber Urip
          </div>
        </div>

        {/* Right panel - login form */}
        <div className="bg-white p-8 flex flex-col justify-center">
          <div className="mb-6 lg:hidden text-center">
            <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3">
              <Store className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">UD. Sumber Urip</h1>
          </div>

          <h2 className="text-xl font-semibold text-slate-800 mb-1">Masuk ke Sistem</h2>
          <p className="text-sm text-slate-500 mb-6">Masukkan kredensial Anda untuk melanjutkan.</p>

          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-colors"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-colors"
                  placeholder="Masukkan kata sandi"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Memproses...' : (
                <>Masuk <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Demo role quick login */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 text-center">
              Demo — Masuk Cepat per Peran
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ROLES.map(({ role, label, color, username: uname, desc }) => (
                <button
                  key={role}
                  onClick={() => handleQuickLogin(role)}
                  disabled={loading}
                  className={`${color} text-white rounded-lg p-3 text-left transition-colors disabled:opacity-50`}
                >
                  <div className="text-xs font-bold mb-0.5">{label}</div>
                  <div className="text-xs opacity-75">{desc}</div>
                  <div className="text-xs opacity-60 font-mono mt-1">{uname}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
