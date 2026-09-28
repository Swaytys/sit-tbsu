import React, { useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';

type Pelanggan = {
  id: string;
  nama: string;
  noHp: string;
  email: string;
  alamat: string;
  keterangan: string;
  status: 'Aktif' | 'Nonaktif';
};

const DUMMY_DATA: Pelanggan[] = [
  { id: 'PLG-001', nama: 'PT. Budi Karya Utama', noHp: '081234567890', email: 'budi.karya@email.com', alamat: 'Jl. Industri No. 12, Surabaya', keterangan: 'Pelanggan tetap, pembayaran 30 hari', status: 'Aktif' },
  { id: 'PLG-002', nama: 'CV. Maju Jaya', noHp: '082198765432', email: 'cv.majujaya@gmail.com', alamat: 'Jl. Raya Waru No. 5, Sidoarjo', keterangan: 'Kontraktor bangunan', status: 'Aktif' },
  { id: 'PLG-003', nama: 'Toko Bangunan Sejahtera', noHp: '085712345678', email: '-', alamat: 'Jl. Pahlawan No. 88, Gresik', keterangan: '', status: 'Aktif' },
  { id: 'PLG-004', nama: 'Bp. Haryanto', noHp: '081356789012', email: 'haryanto@email.com', alamat: 'Jl. Kenanga No. 3, Surabaya Timur', keterangan: 'Pelanggan perorangan', status: 'Aktif' },
  { id: 'PLG-005', nama: 'UD. Karya Mandiri', noHp: '089987654321', email: 'ud.karyamandiri@email.com', alamat: 'Jl. Kapas Krampung No. 21, Surabaya', keterangan: '', status: 'Nonaktif' },
  { id: 'PLG-006', nama: 'PT. Graha Nusantara', noHp: '081298765430', email: 'graha.nusantara@corp.com', alamat: 'Jl. Ahmad Yani No. 100, Surabaya', keterangan: 'Developer perumahan', status: 'Aktif' },
];

function Modal({ pelanggan, onClose, onSave }: {
  pelanggan: Partial<Pelanggan> | null;
  onClose: () => void;
  onSave: (p: Pelanggan) => void;
}) {
  const isEdit = !!pelanggan?.id;
  const [form, setForm] = useState<Partial<Pelanggan>>(pelanggan ?? { status: 'Aktif' });

  const set = (k: keyof Pelanggan, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: form.id ?? `PLG-${Date.now()}`,
      nama: form.nama ?? '',
      noHp: form.noHp ?? '',
      email: form.email ?? '',
      alamat: form.alamat ?? '',
      keterangan: form.keterangan ?? '',
      status: (form.status as 'Aktif' | 'Nonaktif') ?? 'Aktif',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Pelanggan <span className="text-red-500">*</span></label>
              <input required value={form.nama ?? ''} onChange={(e) => set('nama', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Nama lengkap / nama perusahaan" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP <span className="text-red-500">*</span></label>
              <input required value={form.noHp ?? ''} onChange={(e) => set('noHp', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="08xxxx" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="email@domain.com" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat</label>
              <input value={form.alamat ?? ''} onChange={(e) => set('alamat', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Alamat lengkap" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan</label>
              <textarea value={form.keterangan ?? ''} onChange={(e) => set('keterangan', e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Catatan tambahan..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select value={form.status ?? 'Aktif'} onChange={(e) => set('status', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                <option>Aktif</option>
                <option>Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
            <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DataPelanggan() {
  const [data, setData] = useState<Pelanggan[]>(DUMMY_DATA);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Partial<Pelanggan> | null | false>(false);

  const filtered = data.filter(
    (p) => p.nama.toLowerCase().includes(search.toLowerCase()) || p.noHp.includes(search)
  );

  const handleSave = (p: Pelanggan) => {
    setData((prev) => prev.some((x) => x.id === p.id) ? prev.map((x) => x.id === p.id ? p : x) : [p, ...prev]);
    setModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus data pelanggan ini?')) setData((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Data Pelanggan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola daftar pelanggan toko</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Tambah Pelanggan
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau no. HP..." className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} pelanggan</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Pelanggan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">No. HP</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Alamat</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.id}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.nama}</td>
                <td className="px-4 py-3 text-slate-600">{p.noHp}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{p.email}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{p.alamat}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal(p)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">Tidak ada data pelanggan ditemukan</div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs text-slate-500">Menampilkan {filtered.length} dari {data.length} data</span>
          <div className="flex gap-1">
            <button className="p-1.5 border border-slate-200 rounded-md hover:bg-white text-slate-500"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md">1</button>
            <button className="p-1.5 border border-slate-200 rounded-md hover:bg-white text-slate-500"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {modal !== false && (
        <Modal pelanggan={modal} onClose={() => setModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}
