import type { BarisMutasi } from '@sit/shared';
import { Link } from 'react-router';

/** Path halaman dokumen sumber mutasi yang sudah tersedia; dokumen fase berikutnya tampil sebagai teks. */
function pathDokumen(m: Pick<BarisMutasi, 'jenisDokumen' | 'idDokumen'>): string | null {
  if (m.idDokumen === null) return null;
  if (m.jenisDokumen === 'PENERIMAAN') return `/penerimaan/${m.idDokumen}`;
  if (m.jenisDokumen === 'PENYESUAIAN') return `/persediaan/penyesuaian/${m.idDokumen}`;
  if (m.jenisDokumen === 'PENJUALAN') return `/penjualan/${m.idDokumen}`;
  if (m.jenisDokumen === 'RETUR_PEMASOK') return `/retur-pemasok/${m.idDokumen}`;
  return null;
}

export function TautanDokumen({ m }: { m: BarisMutasi }) {
  if (!m.nomorDokumen) return <span className="text-slate-400">—</span>;
  const path = pathDokumen(m);
  return path ? (
    <Link to={path} className="font-mono text-xs font-medium text-blue-700 hover:underline">
      {m.nomorDokumen}
    </Link>
  ) : (
    <span className="font-mono text-xs">{m.nomorDokumen}</span>
  );
}
