import React, { useState } from 'react';
import { Calculator, CheckSquare, Banknote, Clock, User, CheckCircle2, AlertTriangle, Save, FileText } from 'lucide-react';

export function ClericalCheck() {
  const [actualCash, setActualCash] = useState('25500000');
  
  // Simulated System Data
  const systemCash = 25450000;
  const difference = parseInt(actualCash.replace(/\D/g, '') || '0') - systemCash;

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Clerical Check (Tutup Shift Kasir)
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Rekonsiliasi uang fisik dengan catatan sistem</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <FileText className="w-4 h-4" /> Riwayat Clerical
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Info & System Data */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> Informasi Shift
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Tanggal</p>
                <p className="font-bold text-slate-800">6 April 2026</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Kasir Bertugas</p>
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Kasir Utama (Rudi)
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Waktu Mulai Shift</p>
                <p className="font-bold text-slate-800">08:00 WIB</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Waktu Tutup Shift</p>
                <p className="font-bold text-slate-800">16:30 WIB (Sekarang)</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" /> Rangkuman Sistem
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                <span className="text-sm font-medium text-slate-600">Modal Awal Kasir</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">Rp 1.000.000</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                <span className="text-sm font-medium text-slate-600">Penerimaan Tunai (Penjualan)</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">Rp 24.500.000</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                <span className="text-sm font-medium text-slate-600">Pengeluaran Tunai (Retur/Kasbon)</span>
                <span className="text-sm font-bold text-red-600 tabular-nums">- Rp 50.000</span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-slate-300">
                <span className="text-base font-black text-slate-800">Total Saldo Sistem</span>
                <span className="text-xl font-black text-indigo-700 tabular-nums">Rp {systemCash.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Input Actual & Summary */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" /> Input Saldo Fisik Laci
            </h2>
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Hitung Total Uang Tunai di Laci Kasir (Rp)</label>
              <input 
                type="text" 
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full text-right text-4xl font-black text-emerald-700 border-2 border-emerald-500 rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-emerald-100 bg-emerald-50/50 shadow-inner tabular-nums transition-all"
              />
            </div>

            <div className={`p-4 rounded-xl border ${difference === 0 ? 'bg-blue-50 border-blue-200' : (difference > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200')} transition-colors`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-700">Hasil Rekonsiliasi</span>
                {difference === 0 ? (
                  <span className="flex items-center gap-1 text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Cocok (Balance)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold bg-white text-slate-800 px-2 py-1 rounded-full border border-slate-200 shadow-sm uppercase tracking-wider">
                    <AlertTriangle className={`w-3 h-3 ${difference > 0 ? 'text-amber-500' : 'text-red-500'}`} /> Selisih (Unbalance)
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <span className={`text-sm font-medium ${difference === 0 ? 'text-blue-700' : (difference > 0 ? 'text-amber-700' : 'text-red-700')}`}>
                  {difference === 0 ? 'Saldo fisik sama dengan sistem' : (difference > 0 ? 'Lebih bayar / Lebih uang' : 'Kurang bayar / Kurang uang')}
                </span>
                <span className={`text-3xl font-black tabular-nums ${difference === 0 ? 'text-blue-700' : (difference > 0 ? 'text-amber-600' : 'text-red-600')}`}>
                  {difference > 0 ? '+' : (difference < 0 ? '-' : '')}Rp {Math.abs(difference).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              {difference !== 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Keterangan Selisih Wajib Diisi</label>
                  <textarea 
                    className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm resize-none h-20"
                    placeholder="Jelaskan alasan terjadinya selisih saldo fisik dan sistem..."
                  ></textarea>
                </div>
              )}
              <button className={`w-full py-4 rounded-xl text-lg font-black shadow-sm flex items-center justify-center gap-2 transition-all transform active:translate-y-1 ${difference === 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                <CheckSquare className="w-5 h-5" /> Simpan & Tutup Shift
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
