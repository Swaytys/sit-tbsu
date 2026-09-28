import React, { useState } from 'react';
import { Search, XCircle, X, AlertTriangle, ChevronDown } from 'lucide-react';

type StatusTrx = 'Selesai' | 'Void';

type Transaksi = {
  id: string;
  noInvoice: string;
  tanggal: string;
  pelanggan: string;
  kasir: string;
  total: number;
  status: StatusTrx;
  items: { nama: string; qty: number; harga: number }[];
};

const DUMMY_TRX: Transaksi[] = [
  {
    id: 'TRX-001', noInvoice: 'STR-2026-0041', tanggal: '17/08/2026', pelanggan: 'PT. Budi Karya Utama',
    kasir: 'Siti Rahayu', total: 4750000, status: 'Selesai',
    items: [
      { nama: 'Semen Gresik 50kg', qty: 20, harga: 75000 },
      { nama: 'Pasir Curah (m³)', qty: 3, harga: 500000 },
      { nama: 'Bata Merah (pcs)', qty: 100, harga: 2500 },
    ],
  },
  {
    id: 'TRX-002', noInvoice: 'STR-2026-0040', tanggal: '17/08/2026', pelanggan: 'Umum',
    kasir: 'Siti Rahayu', total: 850000, status: 'Selesai',
    items: [
      { nama: 'Cat Tembok Dulux 5kg', qty: 2, harga: 185000 },
      { nama: 'Kuas Cat 4"', qty: 5, harga: 25000 },
      { nama: 'Amplas Lembar', qty: 10, harga: 8000 },
    ],
  },
  {
    id: 'TRX-003', noInvoice: 'STR-2026-0038', tanggal: '16/08/2026', pelanggan: 'CV. Maju Jaya',
    kasir: 'Siti Rahayu', total: 12500000, status: 'Void',
    items: [
      { nama: 'Besi Beton 10mm (btg)', qty: 100, harga: 85000 },
      { nama: 'Kawat Beton (kg)', qty: 50, harga: 25000 },
    ],
  },
  {
    id: 'TRX-004', noInvoice: 'STR-2026-0037', tanggal: '16/08/2026', pelanggan: 'Bp. Haryanto',
    kasir: 'Siti Rahayu', total: 2300000, status: 'Selesai',
    items: [
      { nama: 'Keramik 60x60 Putih (box)', qty: 10, harga: 180000 },
      { nama: 'Lem Keramik (sak)', qty: 5, harga: 62000 },
    ],
  },
];

const VOID_LOG = [
  { id: 'VOID-001', tanggal: '16/08/2026 14:23', noInvoice: 'STR-2026-0038', scope: 'Seluruh Transaksi', pengaju: 'Siti Rahayu', pengotorisasi: 'Budi Santoso', alasan: 'Pelanggan membatalkan pesanan sebelum barang disiapkan' },
  { id: 'VOID-002', tanggal: '15/08/2026 10:05', noInvoice: 'STR-2026-0031', scope: 'Per Item (2 item)', pengaju: 'Siti Rahayu', pengotorisasi: 'Hendra Wijaya', alasan: 'Salah input jumlah barang oleh kasir' },
];

function fmt(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function VoidModal({ trx, onClose, onConfirm }: {
  trx: Transaksi;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  const [scope, setScope] = useState<'all' | 'item'>('all');
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const [alasan, setAlasan] = useState('');
  const [otorisasi, setOtorisasi] = useState('');

  const toggleItem = (idx: number) => setSelectedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim()) { alert('Alasan void wajib diisi.'); return; }
    if (!otorisasi) { alert('Pilih pengotorisasi void.'); return; }
    onConfirm(trx.id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-semibold text-slate-800">Void Transaksi</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Transaction info */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">No. Invoice</span><span className="font-mono font-semibold text-slate-800">{trx.noInvoice}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tanggal</span><span className="text-slate-700">{trx.tanggal}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Pelanggan</span><span className="text-slate-700">{trx.pelanggan}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Kasir</span><span className="text-slate-700">{trx.kasir}</span></div>
            <div className="flex justify-between font-semibold"><span className="text-slate-500">Total</span><span className="text-slate-800">{fmt(trx.total)}</span></div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Void transaksi bersifat permanen dan memerlukan otorisasi Admin/Owner. Stok barang akan dikembalikan setelah void dikonfirmasi.</p>
          </div>

          {/* Scope void */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Lingkup Void</label>
            <div className="flex gap-3">
              {[{ val: 'all', label: 'Seluruh Transaksi' }, { val: 'item', label: 'Per Item' }].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" value={val} checked={scope === val} onChange={() => setScope(val as 'all' | 'item')} className="accent-blue-600" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Per item selection */}
          {scope === 'item' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Pilih Item yang di-Void</label>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Nama Barang</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trx.items.map((item, idx) => (
                      <tr key={idx} className={`${selectedItems[idx] ? 'bg-red-50' : ''} transition-colors`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={!!selectedItems[idx]} onChange={() => toggleItem(idx)} className="accent-red-500" />
                        </td>
                        <td className="px-3 py-2 text-slate-700">{item.nama}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.qty}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmt(item.harga)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alasan */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Alasan Void <span className="text-red-500">*</span></label>
            <textarea
              required
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
              placeholder="Jelaskan alasan void transaksi ini..."
            />
          </div>

          {/* Otorisasi */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 mb-2">Otorisasi Diperlukan</p>
            <p className="text-xs text-blue-600 mb-3">Void transaksi harus disetujui oleh Admin atau Owner.</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Diotorisasi Oleh <span className="text-red-500">*</span></label>
              <select
                value={otorisasi}
                onChange={(e) => setOtorisasi(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">— Pilih Pengotorisasi —</option>
                <option>Hendra Wijaya (Owner)</option>
                <option>Budi Santoso (Administrator)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
            <button type="submit" className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" /> Konfirmasi Void
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VoidTransaksi() {
  const [data, setData] = useState<Transaksi[]>(DUMMY_TRX);
  const [search, setSearch] = useState('');
  const [voidTarget, setVoidTarget] = useState<Transaksi | null>(null);

  const filtered = data.filter(
    (t) => t.noInvoice.toLowerCase().includes(search.toLowerCase()) || t.pelanggan.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirmVoid = (id: string) => {
    setData((prev) => prev.map((t) => t.id === id ? { ...t, status: 'Void' as StatusTrx } : t));
    setVoidTarget(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Void Transaksi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Batalkan transaksi penjualan yang sudah dicatat</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. invoice atau pelanggan..." className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} transaksi</span>
      </div>

      {/* Table daftar transaksi */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Daftar Transaksi</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">No. Invoice</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tanggal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pelanggan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kasir</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((t) => (
              <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${t.status === 'Void' ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{t.noInvoice}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{t.tanggal}</td>
                <td className="px-4 py-3 text-slate-800">{t.pelanggan}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{t.kasir}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(t.total)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.status === 'Selesai' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {t.status === 'Selesai' && (
                    <button
                      onClick={() => setVoidTarget(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Riwayat Void */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Riwayat Void</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">No. Void</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Tanggal</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">No. Invoice</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Lingkup</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Pengaju</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Pengotorisasi</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {VOID_LOG.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-600">{v.id}</td>
                <td className="px-4 py-3 text-slate-600">{v.tanggal}</td>
                <td className="px-4 py-3 font-mono text-blue-700 font-semibold">{v.noInvoice}</td>
                <td className="px-4 py-3 text-slate-700">{v.scope}</td>
                <td className="px-4 py-3 text-slate-700">{v.pengaju}</td>
                <td className="px-4 py-3 text-slate-700">{v.pengotorisasi}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={v.alasan}>{v.alasan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {voidTarget && (
        <VoidModal trx={voidTarget} onClose={() => setVoidTarget(null)} onConfirm={handleConfirmVoid} />
      )}
    </div>
  );
}
