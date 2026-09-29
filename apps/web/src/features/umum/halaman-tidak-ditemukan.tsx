import { Link } from 'react-router';

export function HalamanTidakDitemukan() {
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center">
      <h1 className="text-lg font-semibold text-slate-800">Halaman tidak ditemukan</h1>
      <p className="text-sm text-slate-500">Alamat yang dibuka tidak ada atau belum tersedia.</p>
      <Link to="/satuan" className="text-sm font-medium text-blue-600 hover:underline">
        Kembali ke halaman Satuan
      </Link>
    </div>
  );
}
