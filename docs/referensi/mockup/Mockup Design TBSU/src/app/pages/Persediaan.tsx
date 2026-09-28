import React, { useState } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ArrowRightLeft, 
  Search, 
  Filter, 
  Download, 
  Settings2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const mockInventory = [
  { id: 'BRG-001', name: 'Semen Gresik 40kg', category: 'Semen', unit: 'Sak', stock: 150, min: 200, status: 'Kritis', lastUpdate: '6 Apr 2026, 14:30' },
  { id: 'BRG-002', name: 'Cat Tembok Dulux 5kg', category: 'Cat', unit: 'Pail', stock: 25, min: 10, status: 'Aman', lastUpdate: '5 Apr 2026, 11:20' },
  { id: 'BRG-003', name: 'Pipa PVC Maspion 3/4"', category: 'Pipa', unit: 'Btg', stock: 300, min: 50, status: 'Aman', lastUpdate: '6 Apr 2026, 09:15' },
  { id: 'BRG-004', name: 'Besi Beton Polos 8mm', category: 'Besi', unit: 'Btg', stock: 45, min: 100, status: 'Kritis', lastUpdate: '6 Apr 2026, 13:10' },
  { id: 'BRG-005', name: 'Triplek Meranti 9mm', category: 'Kayu', unit: 'Lbr', stock: 85, min: 20, status: 'Aman', lastUpdate: '4 Apr 2026, 16:45' },
  { id: 'BRG-006', name: 'Baja Ringan C75 0.75mm', category: 'Atap', unit: 'Btg', stock: 120, min: 30, status: 'Aman', lastUpdate: '6 Apr 2026, 10:05' },
  { id: 'BRG-007', name: 'Paku Beton 5cm', category: 'Paku', unit: 'Dus', stock: 50, min: 15, status: 'Aman', lastUpdate: '3 Apr 2026, 15:20' },
  { id: 'BRG-008', name: 'Kabel Eterna NYM 2x1.5', category: 'Listrik', unit: 'Roll', stock: 6, min: 5, status: 'Peringatan', lastUpdate: '5 Apr 2026, 14:10' },
];

export function Persediaan() {
  const [activeTab, setActiveTab] = useState('stok');

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Manajemen Persediaan
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Pantau stok, mutasi barang, dan lakukan opname</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Ekspor Data
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Penyesuaian Stok (Opname)
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Item Aktif</p>
            <h3 className="text-2xl font-bold text-slate-800">1,245</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Stok Kritis</p>
            <h3 className="text-2xl font-bold text-red-600">12 Item</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Hampir Habis</p>
            <h3 className="text-2xl font-bold text-amber-600">28 Item</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
            <ArrowRightLeft className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Mutasi Hari Ini</p>
            <h3 className="text-2xl font-bold text-emerald-600">+45 / -120</h3>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/50">
          <button 
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'stok' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            onClick={() => setActiveTab('stok')}
          >
            Posisi Stok Saat Ini
          </button>
          <button 
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'mutasi' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            onClick={() => setActiveTab('mutasi')}
          >
            Riwayat Mutasi
          </button>
          <button 
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'kartu' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            onClick={() => setActiveTab('kartu')}
          >
            Kartu Stok
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari kode atau nama barang..." 
              className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
          <div className="flex gap-3">
            <select className="text-sm border border-slate-300 rounded-lg py-2 px-3 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
              <option value="">Semua Kategori</option>
              <option value="Semen">Semen</option>
              <option value="Cat">Cat</option>
              <option value="Besi">Besi</option>
            </select>
            <select className="text-sm border border-slate-300 rounded-lg py-2 px-3 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
              <option value="">Semua Status Stok</option>
              <option value="Kritis">Kritis (Di Bawah Minimum)</option>
              <option value="Peringatan">Peringatan (Mendekati Minimum)</option>
              <option value="Aman">Aman</option>
            </select>
            <button className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Kode</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Nama Barang</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Kategori</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">Stok Min</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">Stok Aktual</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Status</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">Update Terakhir</th>
                <th className="py-3 px-5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm">
              {mockInventory.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-3 px-5 font-medium text-slate-700">{item.id}</td>
                  <td className="py-3 px-5">
                    <div className="text-slate-900 font-bold">{item.name}</div>
                  </td>
                  <td className="py-3 px-5 text-slate-500">{item.category}</td>
                  <td className="py-3 px-5 text-right text-slate-500 tabular-nums">{item.min} {item.unit}</td>
                  <td className="py-3 px-5 text-right tabular-nums">
                    <span className={`font-black text-base ${item.stock <= item.min ? 'text-red-600' : 'text-slate-800'}`}>
                      {item.stock}
                    </span>
                    <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
                  </td>
                  <td className="py-3 px-5 text-center">
                    {item.status === 'Kritis' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider">
                        <TrendingDown className="w-3 h-3 mr-1" /> Kritis
                      </span>
                    )}
                    {item.status === 'Peringatan' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider">
                        Peringatan
                      </span>
                    )}
                    {item.status === 'Aman' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                        Aman
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right text-slate-400 text-xs">{item.lastUpdate}</td>
                  <td className="py-3 px-5">
                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded transition-colors bg-white">
                        Kartu Stok
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <p className="text-sm text-slate-600">Menampilkan <span className="font-bold text-slate-800">1-8</span> dari <span className="font-bold text-slate-800">1,245</span> data</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-400 cursor-not-allowed text-sm font-medium">Sebelumnya</button>
            <button className="px-3 py-1 border border-blue-600 rounded bg-blue-50 text-blue-600 text-sm font-medium">1</button>
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">2</button>
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">Selanjutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
}
