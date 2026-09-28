import React, { useState } from 'react';
import { FileText, Download, Printer, Filter, Calendar, TrendingUp, BarChart2, CheckCircle2, ChevronDown } from 'lucide-react';

const reportTypes = [
  'Laporan Stok Rekap',
  'Laporan Kartu Stok',
  'Laporan Stok Minimum',
  'Laporan Nilai Persediaan',
  'Laporan Penjualan per Periode',
  'Laporan Produk Terlaris',
  'Laporan Detail Invoice',
  'Laporan Retur Penjualan',
  'Laporan Gross Profit Penjualan'
];

export function LaporanOperasional() {
  const [selectedReport, setSelectedReport] = useState('Laporan Gross Profit Penjualan');
  const [period, setPeriod] = useState('Hari Ini');

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Laporan Operasional
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Pusat data laporan operasional toko bahan bangunan</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <Printer className="w-4 h-4" /> Cetak (PDF)
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Ekspor Excel
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left: Sidebar Reports */}
        <div className="w-72 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Daftar Laporan
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 mt-2">Laporan Persediaan</div>
              {reportTypes.slice(0, 4).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedReport(type)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedReport === type ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                >
                  {type}
                </button>
              ))}
              
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 mt-4">Laporan Penjualan</div>
              {reportTypes.slice(4).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedReport(type)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedReport === type ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Report Viewer */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 grid grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Periode</label>
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium shadow-sm"
              >
                <option>Hari Ini</option>
                <option>Kemarin</option>
                <option>Minggu Ini</option>
                <option>Bulan Ini</option>
                <option>Kustom (Rentang Tanggal)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Dari Tanggal</label>
              <input type="date" disabled={period !== 'Kustom (Rentang Tanggal)'} defaultValue="2026-04-06" className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 bg-white shadow-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Sampai Tanggal</label>
              <input type="date" disabled={period !== 'Kustom (Rentang Tanggal)'} defaultValue="2026-04-06" className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 bg-white shadow-sm" />
            </div>
            <div>
              <button className="w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 shadow-sm transition-colors flex items-center justify-center gap-2">
                <Filter className="w-4 h-4" /> Terapkan Filter
              </button>
            </div>
          </div>

          {/* Report Preview Header */}
          <div className="p-6 border-b border-slate-200 bg-white shrink-0 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">{selectedReport}</h2>
                <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Periode: 6 April 2026
                </p>
              </div>
            </div>
            
            {/* Quick Stats for this report */}
            <div className="text-right">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estimasi Gross Profit</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums">Rp 4.550.000</p>
            </div>
          </div>

          {/* Report Table */}
          <div className="flex-1 overflow-auto bg-slate-50 p-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase">No. Transaksi</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase text-center">Tipe Transaksi</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase text-right">Nilai Jual</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase text-right">Nilai Pokok (HPP)</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase text-right">Laba Kotor (Gross)</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase text-center">% Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {[
                    { id: 'INV-260406-001', type: 'Langsung', jual: 1500000, hpp: 1200000, margin: 20 },
                    { id: 'INV-260406-002', type: 'Langsung', jual: 450000, hpp: 380000, margin: 15.5 },
                    { id: 'INV-260406-003', type: 'Pengantaran', jual: 12500000, hpp: 9800000, margin: 21.6 },
                    { id: 'INV-260406-004', type: 'Pengantaran', jual: 3500000, hpp: 2850000, margin: 18.5 },
                    { id: 'INV-260406-005', type: 'Langsung', jual: 85000, hpp: 70000, margin: 17.6 },
                  ].map((row, idx) => {
                    const gross = row.jual - row.hpp;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-blue-700 hover:underline cursor-pointer">{row.id}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.type === 'Pengantaran' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>{row.type}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800 tabular-nums">Rp {row.jual.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600 tabular-nums">Rp {row.hpp.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 tabular-nums">Rp {gross.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="flex justify-center items-center gap-1 font-bold text-emerald-600">
                            <TrendingUp className="w-3 h-3" /> {row.margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black">
                    <td className="py-4 px-4 text-right text-slate-800 uppercase tracking-wider" colSpan={2}>Total (Halaman Ini)</td>
                    <td className="py-4 px-4 text-right text-slate-800 tabular-nums">Rp 18.035.000</td>
                    <td className="py-4 px-4 text-right text-slate-600 tabular-nums">Rp 14.300.000</td>
                    <td className="py-4 px-4 text-right text-emerald-700 tabular-nums">Rp 3.735.000</td>
                    <td className="py-4 px-4 text-center text-emerald-700 tabular-nums">20.7%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <p className="text-xs text-slate-400 mt-4 font-medium text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-300" /> Data telah divalidasi dengan sistem utama
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
