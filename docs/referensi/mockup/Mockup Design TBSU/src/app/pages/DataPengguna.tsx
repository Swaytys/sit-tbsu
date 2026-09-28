import React, { useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Shield, Eye, EyeOff } from 'lucide-react';

type Peran = 'Owner' | 'Administrator' | 'Kasir' | 'Staf Penjualan';

type Pengguna = {
  id: string;
  nama: string;
  username: string;
  peran: Peran;
  status: 'Aktif' | 'Nonaktif';
  noHp: string;
};

const DUMMY_DATA: Pengguna[] = [
  { id: 'USR-001', nama: 'Hendra Wijaya', username: 'hendra.w', peran: 'Owner', status: 'Aktif', noHp: '081234567000' },
  { id: 'USR-002', nama: 'Budi Santoso', username: 'budi.s', peran: 'Administrator', status: 'Aktif', noHp: '082198765432' },
  { id: 'USR-003', nama: 'Siti Rahayu', username: 'siti.r', peran: 'Kasir', status: 'Aktif', noHp: '085712341234' },
  { id: 'USR-004', nama: 'Agus Prasetyo', username: 'agus.p', peran: 'Staf Penjualan', status: 'Aktif', noHp: '089987654321' },
  { id: 'USR-005', nama: 'Rina Susanti', username: 'rina.s', peran: 'Kasir', status: 'Nonaktif', noHp: '081312345678' },
];

const PERAN_COLORS: Record<Peran, string> = {
  Owner: 'bg-purple-100 text-purple-700',
  Administrator: 'bg-blue-100 text-blue-700',
  Kasir: 'bg-teal-100 text-teal-700',
  'Staf Penjualan': 'bg-slate-100 text-slate-600',
};

function Modal({ pengguna, onClose, onSave }: {
  pengguna: Partial<Pengguna> | null;
  onClose: () => void;
  onSave: (p: Pengguna) => void;
}) {
  const isEdit = !!pengguna?.id;
  const [form, setForm] = useState<Partial<Pengguna> & { password?: string }>(pengguna ?? { status: 'Aktif', peran: 'Kasir' });
  const [showPwd, setShowPwd] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: form.id ?? `USR-${Date.now()}`,
      nama: form.nama ?? '',
      username: form.username ?? '',
      peran: (form.peran as Peran) ?? 'Kasir',
      status: (form.status as 'Aktif' | 'Nonaktif') ?? 'Aktif',
      noHp: form.noHp ?? '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Pengguna <span className="text-red-500">*</span></label>
              <input required value={form.nama ?? ''} onChange={(e) => set('nama', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Username <span className="text-red-500">*</span></label>
              <input required value={form.username ?? ''} onChange={(e) => set('username', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono" placeholder="username.user" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP</label>
              <input value={form.noHp ?? ''} onChange={(e) => set('noHp', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="08xxxx" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kata Sandi {!isEdit && <span className="text-red-500">*</span>}</label>
              <div className="relative">
                <input
                  required={!isEdit}
                  type={showPwd ? 'text' : 'password'}
                  value={form.password ?? ''}
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Password baru'}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Peran <span className="text-red-500">*</span></label>
              <select required value={form.peran ?? 'Kasir'} onChange={(e) => set('peran', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                <option>Owner</option>
                <option>Administrator</option>
                <option>Kasir</option>
                <option>Staf Penjualan</option>
              </select>
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

export function DataPengguna() {
  const [data, setData] = useState<Pengguna[]>(DUMMY_DATA);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Partial<Pengguna> | null | false>(false);

  const filtered = data.filter(
    (p) => p.nama.toLowerCase().includes(search.toLowerCase()) || p.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (p: Pengguna) => {
    setData((prev) => prev.some((x) => x.id === p.id) ? prev.map((x) => x.id === p.id ? p : x) : [p, ...prev]);
    setModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus data pengguna ini?')) setData((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-slate-800">Data Pengguna</h1>
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              <Shield className="w-3 h-3" /> Owner Only
            </span>
          </div>
          <p className="text-sm text-slate-500">Kelola akun pengguna dan hak akses sistem</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Tambah Pengguna
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau username..." className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} pengguna</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Pengguna</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Username</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Peran</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">No. HP</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.id}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.nama}</td>
                <td className="px-4 py-3 font-mono text-slate-600 text-xs">{p.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PERAN_COLORS[p.peran]}`}>
                    {p.peran}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{p.noHp}</td>
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
          <div className="py-12 text-center text-slate-400 text-sm">Tidak ada data pengguna ditemukan</div>
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
        <Modal pengguna={modal} onClose={() => setModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}
