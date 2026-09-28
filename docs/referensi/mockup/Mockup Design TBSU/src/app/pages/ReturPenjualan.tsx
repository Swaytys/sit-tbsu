import React, { useState } from 'react';
import { Search, Undo2, AlertCircle, CheckCircle2, FileText, Banknote, Package, X } from 'lucide-react';

export function ReturPenjualan() {
  const [searchInvoice, setSearchInvoice] = useState('INV-260405-089');
  const [showResult, setShowResult] = useState(false);
  
  return (
    <div className="p-6 h-full flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Retur Penjualan
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Proses pengembalian barang dari pelanggan dan pengembalian dana</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            Riwayat Retur
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-1 space-y-6">
          {/* Search Invoice */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              1. Cari Transaksi Awal
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nomor Invoice / Struk</label>
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchInvoice}
                    onChange={(e) => setSearchInvoice(e.target.value)}
                    className="pl-10 pr-4 py-2.5 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-medium bg-white shadow-sm"
                  />
                </div>
              </div>
              <button 
                onClick={() => setShowResult(true)}
                className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 shadow-sm transition-colors"
              >
                Cari Data Transaksi
              </button>
            </div>
          </div>

          {/* Form Retur */}
          {showResult && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 animate-in slide-in-from-top-4 duration-300">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                2. Detail Retur
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Alasan Retur</label>
                  <select className="w-full border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm font-medium">
                    <option>Barang Cacat / Rusak</option>
                    <option>Kelebihan Beli / Sisa Proyek</option>
                    <option>Salah Kirim Barang</option>
                    <option>Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipe Penyelesaian</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 border-2 border-blue-500 bg-blue-50 rounded-lg cursor-pointer">
                      <input type="radio" name="resolution" className="text-blue-600 focus:ring-blue-500 w-4 h-4" defaultChecked />
                      <span className="text-sm font-bold text-blue-700 flex items-center gap-1.5"><Banknote className="w-4 h-4"/> Refund Uang</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border-2 border-slate-200 hover:border-slate-300 bg-white rounded-lg cursor-pointer">
                      <input type="radio" name="resolution" className="text-slate-600 focus:ring-slate-500 w-4 h-4" />
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Package className="w-4 h-4"/> Tukar Barang</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Catatan (Opsional)</label>
                  <textarea 
                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm resize-none h-20"
                    placeholder="Tuliskan keterangan tambahan..."
                  ></textarea>
                </div>
                <div className="pt-2">
                  <button className="w-full py-3 bg-red-600 text-white rounded-lg text-sm font-black hover:bg-red-700 shadow-sm transition-colors flex items-center justify-center gap-2">
                    <Undo2 className="w-5 h-5" /> Proses Retur Barang
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-2 font-medium">Membutuhkan otorisasi dari Admin/Owner</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Invoice Data */}
        {showResult ? (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-10rem)]">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" /> Data Invoice: {searchInvoice}
                </h2>
                <p className="text-xs text-slate-500">Tanggal: 5 Apr 2026, 09:30 | Pelanggan: PT. Bangun Sentosa</p>
              </div>
              <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Lunas
              </span>
            </div>

            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3 shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Instruksi Retur</p>
                <p className="text-xs text-amber-700 mt-0.5">Pilih barang yang akan diretur dan tentukan jumlahnya (Qty Retur). Barang yang tidak diretur biarkan Qty Retur-nya 0.</p>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase">Nama Barang</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase text-center">Harga Jual</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase text-center">Qty Beli</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-red-600 uppercase text-center bg-red-50/50">Qty Retur</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-red-600 uppercase text-right bg-red-50/50">Nilai Retur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm bg-white">
                  {[
                    { id: 1, name: 'Semen Gresik 40kg', price: 55000, qty: 100, returnQty: 2, returnVal: 110000, active: true },
                    { id: 2, name: 'Besi Beton Polos 8mm', price: 45000, qty: 50, returnQty: 0, returnVal: 0, active: false },
                    { id: 3, name: 'Kawat Bendrat', price: 20000, qty: 5, returnQty: 0, returnVal: 0, active: false },
                  ].map((item, idx) => (
                    <tr key={item.id} className={item.active ? 'bg-red-50/20' : 'hover:bg-slate-50'}>
                      <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 px-4 text-center text-slate-600 tabular-nums">Rp {item.price.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{item.qty}</td>
                      <td className="py-3 px-4 text-center bg-red-50/10">
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="number" 
                            min="0" 
                            max={item.qty}
                            defaultValue={item.returnQty}
                            className={`w-16 text-center border ${item.active ? 'border-red-300 bg-white ring-1 ring-red-200' : 'border-slate-300 bg-slate-50'} rounded-md py-1 px-2 text-sm font-bold text-slate-800 focus:outline-none`}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600 tabular-nums bg-red-50/10">
                        Rp {item.returnVal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
              <p className="text-sm font-bold text-slate-500">Stok barang akan otomatis bertambah setelah retur disetujui.</p>
              <div className="text-right">
                <p className="text-sm text-slate-600 mb-1 font-bold">Total Pengembalian Dana</p>
                <p className="text-2xl font-black text-red-600 tabular-nums">Rp 110.000</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-slate-50 border border-slate-200 border-dashed rounded-xl shadow-sm flex flex-col items-center justify-center text-slate-400">
            <Search className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-bold text-slate-500">Pencarian Transaksi</p>
            <p className="text-sm">Masukkan nomor invoice atau struk di sebelah kiri untuk memulai retur.</p>
          </div>
        )}
      </div>
    </div>
  );
}
