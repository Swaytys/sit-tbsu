import React, { useState } from 'react';
import { Search, Plus, Trash2, Printer, CreditCard, Banknote, User, ScanLine, Calculator, X } from 'lucide-react';

export function PenjualanLangsung() {
  const [items, setItems] = useState([
    { id: 1, name: 'Semen Gresik 40kg', qty: 2, price: 55000, discount: 0, total: 110000 },
    { id: 2, name: 'Pipa PVC Maspion 3/4"', qty: 5, price: 22000, discount: 5000, total: 105000 },
    { id: 3, name: 'Paku Beton 5cm', qty: 1, price: 15000, discount: 0, total: 15000 },
  ]);
  const [payAmount, setPayAmount] = useState('250000');

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const change = parseInt(payAmount) - subtotal;

  return (
    <div className="p-4 h-[calc(100vh-4rem)] flex flex-col bg-slate-100 animate-in fade-in duration-500">
      {/* Top Bar: Search & Customer */}
      <div className="flex gap-4 mb-4 shrink-0">
        <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <ScanLine className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Scan barcode atau ketik nama/kode barang... (F2)" 
            className="flex-1 text-sm outline-none bg-transparent font-medium text-slate-800"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500 font-mono">F2</kbd>
        </div>
        <div className="w-72 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <User className="w-5 h-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-xs text-slate-500 font-medium">Pelanggan Umum (Tunai)</p>
            <p className="text-sm font-bold text-slate-800 truncate">Pilih Pelanggan...</p>
          </div>
        </div>
      </div>

      {/* Main POS Area */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: Cart Items */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-3 grid grid-cols-12 gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider text-center items-center">
            <div className="col-span-5 text-left pl-2">Nama Barang</div>
            <div className="col-span-2">Harga</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2 text-right pr-2">Subtotal</div>
            <div className="col-span-1">Aksi</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-12 gap-2 items-center hover:border-blue-300 transition-colors group">
                <div className="col-span-5 flex flex-col pl-1">
                  <span className="font-bold text-slate-800 text-sm truncate" title={item.name}>{idx+1}. {item.name}</span>
                  {item.discount > 0 && (
                    <span className="text-xs text-emerald-600 font-medium mt-0.5">Diskon: Rp {item.discount.toLocaleString('id-ID')}</span>
                  )}
                </div>
                <div className="col-span-2 text-center text-slate-600 tabular-nums text-sm font-medium">
                  Rp {item.price.toLocaleString('id-ID')}
                </div>
                <div className="col-span-2 flex items-center justify-center gap-2">
                  <button className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors">-</button>
                  <span className="w-8 text-center font-bold text-slate-800 text-lg">{item.qty}</span>
                  <button className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center font-bold transition-colors">+</button>
                </div>
                <div className="col-span-2 text-right pr-1 font-bold text-slate-800 tabular-nums text-base">
                  Rp {item.total.toLocaleString('id-ID')}
                </div>
                <div className="col-span-1 flex justify-center">
                  <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {/* Empty space filler for realistic POS feel */}
            {items.length < 8 && Array.from({ length: 8 - items.length }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 border border-dashed border-slate-200 rounded-lg bg-transparent"></div>
            ))}
          </div>
          
          {/* Bottom Summary Strip */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <span className="bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">{items.length} Macam Barang</span>
              <span className="bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">{items.reduce((a, b) => a + b.qty, 0)} Total Qty</span>
            </div>
            <button className="text-red-600 text-sm font-bold flex items-center gap-1 hover:underline">
              <X className="w-4 h-4" /> Batalkan Transaksi (F9)
            </button>
          </div>
        </div>

        {/* Right: Payment Panel */}
        <div className="w-[380px] flex flex-col gap-4 shrink-0">
          {/* Total Display */}
          <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg flex flex-col justify-center items-end relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
            
            <p className="text-slate-300 font-medium mb-1 relative z-10 uppercase tracking-widest text-xs">Total Pembayaran</p>
            <h2 className="text-5xl font-black tabular-nums tracking-tight relative z-10 mb-2 text-emerald-400">
              <span className="text-2xl text-emerald-500/70 mr-1">Rp</span>
              {subtotal.toLocaleString('id-ID')}
            </h2>
          </div>

          {/* Payment Form */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
              <Calculator className="w-5 h-5 text-blue-600" /> Detail Pembayaran
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-blue-600 bg-blue-50 text-blue-700 font-bold transition-all">
                <Banknote className="w-6 h-6 mb-1" /> Tunai
              </button>
              <button className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-slate-200 hover:border-blue-300 text-slate-600 hover:bg-slate-50 transition-all font-medium">
                <CreditCard className="w-6 h-6 mb-1 text-slate-400" /> Transfer / EDC
              </button>
            </div>

            <div className="space-y-4 mb-auto">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Jumlah Bayar (Rp)</label>
                <input 
                  type="text" 
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-right text-3xl font-bold text-slate-800 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 tabular-nums"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[50000, 100000, 250000, 'Pas'].map((val) => (
                  <button 
                    key={val}
                    onClick={() => val === 'Pas' ? setPayAmount(subtotal.toString()) : setPayAmount(val.toString())}
                    className="py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm"
                  >
                    {val === 'Pas' ? val : (val/1000).toString() + 'k'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="flex justify-between items-end mb-4">
                <span className="text-slate-500 font-medium">Kembalian</span>
                <span className={`text-2xl font-black tabular-nums ${change >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  Rp {change > 0 ? change.toLocaleString('id-ID') : 0}
                </span>
              </div>
              
              <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-lg shadow-[0_4px_0_0_#047857] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2">
                <Printer className="w-5 h-5" /> Bayar & Cetak (Enter)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
