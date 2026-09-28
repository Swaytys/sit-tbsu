import React from 'react';
import { 
  MapPin, 
  User, 
  Phone, 
  Truck, 
  FileText, 
  CreditCard, 
  History,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

export function PenjualanPengantaran() {
  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto overflow-y-auto scrollbar-thin">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Detail Pengantaran: DO-260406-089
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
              <Truck className="w-3 h-3" /> Sedang Dikirim
            </span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm flex items-center gap-2">
            <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> Ref: INV-260406-045</span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> 6 Apr 2026, 11:30</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <FileText className="w-4 h-4" /> Cetak Surat Jalan
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
            Update Status Kirim
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Timeline */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Informasi Pelanggan
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Nama Pelanggan</p>
                <p className="font-bold text-slate-800">PT. Bangun Sentosa (Proyek A)</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> No. Telepon / WhatsApp</p>
                <p className="font-medium text-slate-800">0812-3456-7890 (Bpk. Budi)</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Alamat Pengiriman</p>
                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  Jl. Pembangunan Jaya No. 45 Blok C<br />
                  Kec. Waru, Kab. Sidoarjo<br />
                  Jawa Timur 61256
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Catatan Pengiriman</p>
                <p className="text-sm text-slate-700 bg-amber-50 text-amber-800 p-2 rounded border border-amber-200">
                  ⚠️ Jalan sempit, gunakan pick-up kecil. Tolong hubungi Bpk. Budi sebelum sampai lokasi.
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Status Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" /> Status Pengiriman
            </h2>
            <div className="relative pl-3 mt-4 space-y-6">
              {/* Vertical line */}
              <div className="absolute top-2 bottom-2 left-4 w-0.5 bg-slate-200"></div>

              <div className="relative flex gap-4 items-start">
                <div className="w-3 h-3 mt-1.5 rounded-full bg-slate-200 border-2 border-white ring-2 ring-slate-200 z-10"></div>
                <div>
                  <p className="text-sm font-bold text-slate-400">Selesai / Diterima</p>
                  <p className="text-xs text-slate-400 mt-0.5">-</p>
                </div>
              </div>
              
              <div className="relative flex gap-4 items-start">
                <div className="w-3 h-3 mt-1.5 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100 z-10 animate-pulse"></div>
                <div>
                  <p className="text-sm font-bold text-blue-700">Sedang Dikirim</p>
                  <p className="text-xs text-slate-500 mt-0.5">Driver: Anto (L300 - W 1234 XY)</p>
                  <p className="text-[10px] text-slate-400 mt-1">6 Apr 2026, 13:45</p>
                </div>
              </div>
              
              <div className="relative flex gap-4 items-start">
                <div className="w-3 h-3 mt-1.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 z-10"></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Muat Barang Selesai</p>
                  <p className="text-[10px] text-slate-400 mt-1">6 Apr 2026, 13:10</p>
                </div>
              </div>
              
              <div className="relative flex gap-4 items-start">
                <div className="w-3 h-3 mt-1.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 z-10"></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Surat Jalan Dicetak</p>
                  <p className="text-[10px] text-slate-400 mt-1">6 Apr 2026, 11:35</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Items & Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-0 overflow-hidden flex flex-col h-[350px]">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" /> Daftar Barang Kiriman
              </h2>
              <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                Total: 12 Item (450 kg)
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-5 text-xs font-bold text-slate-600 uppercase">Nama Barang</th>
                    <th className="py-2.5 px-5 text-xs font-bold text-slate-600 uppercase text-center">Qty Kirim</th>
                    <th className="py-2.5 px-5 text-xs font-bold text-slate-600 uppercase text-right">Harga Satuan</th>
                    <th className="py-2.5 px-5 text-xs font-bold text-slate-600 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {[
                    { name: 'Semen Gresik 40kg', qty: 10, unit: 'Sak', price: 55000, total: 550000 },
                    { name: 'Besi Beton Polos 8mm', qty: 50, unit: 'Btg', price: 45000, total: 2250000 },
                    { name: 'Besi Beton Polos 10mm', qty: 30, unit: 'Btg', price: 65000, total: 1950000 },
                    { name: 'Kawat Bendrat', qty: 5, unit: 'Roll', price: 20000, total: 100000 },
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-5 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 px-5 text-center">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{item.qty} {item.unit}</span>
                      </td>
                      <td className="py-3 px-5 text-right text-slate-600 tabular-nums">Rp {item.price.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-5 text-right font-semibold text-slate-800 tabular-nums">Rp {item.total.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-6 shrink-0">
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Total Nilai Barang</p>
                <p className="text-lg font-bold text-slate-800 tabular-nums">Rp 4.850.000</p>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" /> Status Pembayaran
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Pembayaran Sebagian (DP)
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-1">Total Tagihan</p>
                <p className="text-xl font-bold text-slate-800 tabular-nums">Rp 4.850.000</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center relative overflow-hidden">
                <div className="absolute -right-2 -top-2 text-emerald-200">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <p className="text-xs text-emerald-700 mb-1 relative z-10">Sudah Dibayar</p>
                <p className="text-xl font-bold text-emerald-700 tabular-nums relative z-10">Rp 1.000.000</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center relative overflow-hidden">
                <div className="absolute -right-2 -top-2 text-amber-200">
                  <History className="w-12 h-12" />
                </div>
                <p className="text-xs text-amber-700 mb-1 relative z-10">Sisa Tagihan</p>
                <p className="text-xl font-bold text-amber-700 tabular-nums relative z-10">Rp 3.850.000</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-1">
                <History className="w-3 h-3" /> Riwayat Pembayaran
              </h3>
              <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Metode</th>
                    <th className="py-2 px-3">Referensi</th>
                    <th className="py-2 px-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-500">6 Apr 2026, 11:30</td>
                    <td className="py-2 px-3"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">Transfer BCA</span></td>
                    <td className="py-2 px-3 text-slate-500">TRF-098765</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-600 tabular-nums">Rp 1.000.000</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="mt-4 flex justify-end">
                <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm transition-colors flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Terima Pelunasan (COD)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
