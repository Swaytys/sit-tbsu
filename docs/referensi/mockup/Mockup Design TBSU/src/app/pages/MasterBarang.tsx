import React, { useState } from 'react';
import { Search, Filter, Plus, Edit, Trash2, MoreVertical, Settings } from 'lucide-react';

const mockItems = [
  { id: 'BRG-001', name: 'Semen Gresik 40kg', category: 'Semen', brand: 'Gresik', unit: 'Sak', retail: 55000, wh1: 54000, wh2: 53000, stock: 150, min: 20, status: 'Aktif' },
  { id: 'BRG-002', name: 'Cat Tembok Dulux 5kg', category: 'Cat', brand: 'Dulux', unit: 'Pail', retail: 185000, wh1: 180000, wh2: 175000, stock: 25, min: 10, status: 'Aktif' },
  { id: 'BRG-003', name: 'Pipa PVC Maspion 3/4"', category: 'Pipa', brand: 'Maspion', unit: 'Btg', retail: 22000, wh1: 21000, wh2: 20000, stock: 300, min: 50, status: 'Aktif' },
  { id: 'BRG-004', name: 'Besi Beton Polos 8mm', category: 'Besi', brand: 'Krakatau', unit: 'Btg', retail: 45000, wh1: 43500, wh2: 42000, stock: 400, min: 100, status: 'Aktif' },
  { id: 'BRG-005', name: 'Triplek Meranti 9mm', category: 'Kayu', brand: 'Generic', unit: 'Lbr', retail: 110000, wh1: 105000, wh2: 100000, stock: 85, min: 20, status: 'Aktif' },
  { id: 'BRG-006', name: 'Baja Ringan C75 0.75mm', category: 'Atap', brand: 'Kencana', unit: 'Btg', retail: 85000, wh1: 83000, wh2: 80000, stock: 120, min: 30, status: 'Aktif' },
  { id: 'BRG-007', name: 'Paku Beton 5cm', category: 'Paku', brand: 'Marabu', unit: 'Dus', retail: 15000, wh1: 14000, wh2: 13000, stock: 50, min: 15, status: 'Aktif' },
  { id: 'BRG-008', name: 'Kabel Eterna NYM 2x1.5', category: 'Listrik', brand: 'Eterna', unit: 'Roll', retail: 320000, wh1: 310000, wh2: 300000, stock: 15, min: 5, status: 'Aktif' },
  { id: 'BRG-009', name: 'Semen Putih Tiga Roda', category: 'Semen', brand: 'Tiga Roda', unit: 'Sak', retail: 95000, wh1: 93000, wh2: 90000, stock: 40, min: 10, status: 'Aktif' },
  { id: 'BRG-010', name: 'Cat Kayu Avian Hitam 1kg', category: 'Cat', brand: 'Avian', unit: 'Klg', retail: 65000, wh1: 63000, wh2: 60000, stock: 65, min: 20, status: 'Aktif' },
];

export function MasterBarang() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6 h-full flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Master Barang</h1>
          <p className="text-slate-500 mt-1 text-sm">Kelola data inventori, harga, dan informasi produk</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" /> Atur Kolom
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Barang
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari kode atau nama barang..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
          <div className="flex gap-3">
            <select className="text-sm border border-slate-300 rounded-md py-2 px-3 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Semua Kategori</option>
              <option value="Semen">Semen</option>
              <option value="Cat">Cat</option>
              <option value="Pipa">Pipa</option>
              <option value="Besi">Besi</option>
            </select>
            <select className="text-sm border border-slate-300 rounded-md py-2 px-3 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
            <button className="p-2 border border-slate-300 rounded-md bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 w-12">No</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Kode</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Nama Barang</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">Kategori & Merk</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">Harga Retail</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">Harga Grosir 1</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">Stok (Min)</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Status</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm">
              {mockItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-2.5 px-4 text-slate-500">{index + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-700">{item.id}</td>
                  <td className="py-2.5 px-4">
                    <div className="text-slate-900 font-medium">{item.name}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{item.unit}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 mr-2">{item.category}</span>
                    <span className="text-slate-500 text-xs">{item.brand}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-800 tabular-nums">Rp {item.retail.toLocaleString('id-ID')}</td>
                  <td className="py-2.5 px-4 text-right text-slate-600 tabular-nums">Rp {item.wh1.toLocaleString('id-ID')}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 tabular-nums">
                      <span className={`font-medium ${item.stock <= item.min ? 'text-red-600' : 'text-slate-800'}`}>
                        {item.stock}
                      </span>
                      <span className="text-slate-400 text-xs">({item.min})</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded" title="Lainnya">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-sm text-slate-600">Menampilkan <span className="font-medium">1</span> sampai <span className="font-medium">10</span> dari <span className="font-medium">145</span> barang</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-400 cursor-not-allowed text-sm font-medium">Sebelumnya</button>
            <button className="px-3 py-1 border border-blue-600 rounded bg-blue-50 text-blue-600 text-sm font-medium">1</button>
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">2</button>
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">3</button>
            <span className="px-2 py-1 text-slate-400">...</span>
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">15</button>
            <button className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">Selanjutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
}
