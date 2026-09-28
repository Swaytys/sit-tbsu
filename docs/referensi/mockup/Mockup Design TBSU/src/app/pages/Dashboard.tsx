import React from 'react';
import { 
  TrendingUp, 
  ShoppingCart, 
  AlertTriangle, 
  Truck,
  Package,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const dataPenjualan = [
  { name: 'Sen', total: 12000000 },
  { name: 'Sel', total: 19000000 },
  { name: 'Rab', total: 15000000 },
  { name: 'Kam', total: 22000000 },
  { name: 'Jum', total: 18000000 },
  { name: 'Sab', total: 31000000 },
  { name: 'Min', total: 25000000 },
];

export function Dashboard() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Operasional</h1>
          <p className="text-slate-500 mt-1 text-sm">Ringkasan aktivitas UD. Sumber Urip hari ini: 6 April 2026</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
            Refresh Data
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors">
            + Order Baru
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-500 text-sm font-medium">Penjualan Hari Ini</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">Rp 18.500.000</h3>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center text-xs text-emerald-600 font-medium">
            <span>+12.5% dibanding kemarin</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-500 text-sm font-medium">Antrean Order</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">14</h3>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg shrink-0">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center text-xs text-amber-600 font-medium">
            <Clock className="w-3.5 h-3.5 mr-1" />
            <span>3 Butuh Verifikasi Kasir</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-500 text-sm font-medium">Pengiriman Aktif</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">8</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center text-xs text-blue-600 font-medium">
            <span>2 Sedang di jalan</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-500 text-sm font-medium">Peringatan Stok</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">12 Item</h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center text-xs text-red-600 font-medium cursor-pointer hover:underline">
            <span>Lihat daftar barang &rarr;</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-slate-800">Grafik Penjualan (7 Hari Terakhir)</h2>
            <select className="text-sm border border-slate-200 rounded-md py-1 px-2 text-slate-600 focus:ring-blue-500 outline-none">
              <option>Minggu Ini</option>
              <option>Bulan Ini</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataPenjualan} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(val) => `Rp ${val/1000000}M`}
                />
                <Tooltip 
                  formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Total']}
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Aksi Cepat</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors border border-slate-100 group">
                <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />
                <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 text-center">Kasir<br/>Langsung</span>
              </button>
              <button className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors border border-slate-100 group">
                <Package className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />
                <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 text-center">Terima<br/>Barang</span>
              </button>
              <button className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors border border-slate-100 group">
                <Truck className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />
                <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 text-center">Cek<br/>Kirim</span>
              </button>
              <button className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors border border-slate-100 group">
                <AlertTriangle className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />
                <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 text-center">Otorisasi<br/>Batal</span>
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Aktivitas Terkini</h2>
              <button className="text-xs text-blue-600 font-medium hover:underline">Lihat Semua</button>
            </div>
            <div className="flex-1 space-y-4">
              {[
                { time: '10:45', action: 'Penjualan Baru', desc: 'INV-260406-001 - Rp 1.500.000', type: 'sale' },
                { time: '10:30', action: 'Order Masuk', desc: 'ORD-260406-004 - 5 Item', type: 'order' },
                { time: '10:15', action: 'Stok Kritis', desc: 'Semen Gresik 40kg sisa 5 sak', type: 'alert' },
                { time: '09:50', action: 'Barang Masuk', desc: 'RCV-002 dari PT. Bangun Jaya', type: 'in' },
              ].map((act, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                    act.type === 'sale' ? 'bg-emerald-500' : 
                    act.type === 'order' ? 'bg-blue-500' : 
                    act.type === 'alert' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{act.action}</p>
                    <p className="text-xs text-slate-500">{act.desc}</p>
                  </div>
                  <div className="ml-auto">
                    <p className="text-[10px] text-slate-400">{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
