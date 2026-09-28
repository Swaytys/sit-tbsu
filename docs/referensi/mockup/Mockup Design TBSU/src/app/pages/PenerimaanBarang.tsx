import React from 'react';
import { Truck, Plus, PackageOpen, PackagePlus, FileCheck, Save, ArrowRight } from 'lucide-react';

export function PenerimaanBarang() {
  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Penerimaan Barang (Good Receipt)
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Catat barang masuk dari supplier untuk menambah stok</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> Riwayat Penerimaan
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Header Form */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">No. Penerimaan (Otomatis)</label>
            <input 
              type="text" 
              value="RCV-260406-001" 
              readOnly 
              className="w-full border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-500 bg-slate-100 font-mono font-bold cursor-not-allowed shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Supplier Pengirim</label>
            <select className="w-full border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium shadow-sm">
              <option value="">Pilih Supplier...</option>
              <option value="S1">PT. Bangun Jaya Semesta</option>
              <option value="S2">CV. Maju Terus</option>
              <option value="S3">Distributor Semen Gresik</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">No. Surat Jalan Supplier</label>
            <input 
              type="text" 
              placeholder="Contoh: SJ-998877" 
              className="w-full border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Tanggal Diterima</label>
            <input 
              type="date" 
              defaultValue="2026-04-06"
              className="w-full border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium shadow-sm"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-blue-600" /> Detail Barang Masuk
          </h2>
          <button className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-bold hover:bg-blue-100 shadow-sm transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Baris Barang
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase w-12 text-center">No</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase">Pilih Barang</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-center w-32">Qty Terima</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-center w-32">Satuan</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-right w-48">Harga Modal (Rp)</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-right w-48">Subtotal (Rp)</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm bg-white">
              {[
                { id: 1, name: 'Semen Gresik 40kg', qty: 200, unit: 'Sak', cost: 52000, total: 10400000 },
                { id: 2, name: 'Besi Beton Polos 8mm', qty: 500, unit: 'Btg', cost: 41000, total: 20500000 },
                { id: 3, name: 'Paku Beton 5cm', qty: 50, unit: 'Dus', cost: 12000, total: 600000 },
              ].map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-center text-slate-500 font-medium">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <select className="w-full border border-slate-300 rounded text-sm py-1.5 px-2 font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500">
                      <option>{item.name}</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <input 
                      type="number" 
                      defaultValue={item.qty} 
                      className="w-full border border-slate-300 rounded text-sm py-1.5 px-2 text-center font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 tabular-nums"
                    />
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 font-medium">{item.unit}</td>
                  <td className="py-3 px-4">
                    <input 
                      type="text" 
                      defaultValue={item.cost.toLocaleString('id-ID')} 
                      className="w-full border border-slate-300 rounded text-sm py-1.5 px-2 text-right font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 tabular-nums"
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-800 tabular-nums">
                    Rp {item.total.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Hapus Baris">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* Empty Row for entry */}
              <tr className="bg-blue-50/30">
                <td className="py-3 px-4 text-center text-blue-400 font-medium">*</td>
                <td className="py-3 px-4">
                  <select className="w-full border border-blue-200 rounded text-sm py-1.5 px-2 text-slate-500 bg-white focus:ring-2 focus:ring-blue-500 border-dashed">
                    <option value="">-- Pilih Barang --</option>
                  </select>
                </td>
                <td className="py-3 px-4"><input type="number" placeholder="0" className="w-full border border-blue-200 border-dashed rounded text-sm py-1.5 px-2 text-center bg-white" /></td>
                <td className="py-3 px-4 text-center text-slate-400">-</td>
                <td className="py-3 px-4"><input type="text" placeholder="0" className="w-full border border-blue-200 border-dashed rounded text-sm py-1.5 px-2 text-right bg-white" /></td>
                <td className="py-3 px-4 text-right text-slate-400">Rp 0</td>
                <td className="py-3 px-4"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Totals & Save */}
        <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-end shrink-0">
          <div className="w-1/2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Catatan Tambahan</label>
            <textarea 
              className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none h-16 shadow-sm"
              placeholder="Tuliskan catatan kondisi barang jika ada..."
            ></textarea>
          </div>
          
          <div className="flex flex-col items-end gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1 font-bold">Total Nilai Barang Masuk</p>
              <p className="text-3xl font-black text-slate-800 tabular-nums">Rp 31.500.000</p>
            </div>
            
            <button className="px-6 py-3 bg-blue-600 text-white rounded-xl text-base font-black hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform active:translate-y-1">
              <Save className="w-5 h-5" /> Simpan & Update Stok (F12)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
