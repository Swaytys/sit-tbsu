import { kunciNama, POLA_AWALAN_NAMA, type DataMirip } from '@sit/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../db/client';
import { AppError } from '../../lib/errors';

/*
 * K-137: cegah data ganda. Sebelum menambah/mengubah pelanggan, pemasok, atau barang, dicari data lain (aktif
 * maupun nonaktif) yang namanya sama setelah dirapikan (`kunciNama`, ekspresi SQL yang sama) atau No. HP-nya
 * sama. Bila ada, penyimpanan ditolak 409 dengan daftarnya, kecuali pengguna menegaskan `abaikanMirip` (data
 * memang berbeda). Kueri berparameter; nama tabel/kolom tetap.
 */

export type JenisMirip = 'pelanggan' | 'pemasok' | 'barang';

const DEF: Record<
  JenisMirip,
  { tabel: string; nama: string; noHp: string | null; awalan: boolean }
> = {
  pelanggan: { tabel: 'pelanggan', nama: 'nama_pelanggan', noHp: 'no_hp', awalan: true },
  pemasok: { tabel: 'pemasok', nama: 'nama_pemasok', noHp: 'no_hp', awalan: true },
  barang: { tabel: 'barang', nama: 'nama_barang', noHp: null, awalan: false },
};

/** Ekspresi SQL kunci nama (cermin `kunciNama`). */
export function kunciNamaSql(kolom: SQL, buangAwalan: boolean): SQL {
  const kecil = sql`lower(trim(${kolom}))`;
  const tanpaAwalan = buangAwalan ? sql`regexp_replace(${kecil}, ${POLA_AWALAN_NAMA}, '')` : kecil;
  return sql`regexp_replace(${tanpaAwalan}, '[^a-z0-9]', '', 'g')`;
}

export async function cariMirip(
  ex: Executor,
  jenis: JenisMirip,
  data: {
    nama: string;
    noHp?: string | null;
    /** Barang: versi titipan (K-094) boleh bernama sama dengan barang milik sendiri / penitip lain. */
    kepemilikan?: string;
    idPemasokKonsinyasi?: number | null;
  },
  kecualiId?: number,
): Promise<DataMirip[]> {
  const d = DEF[jenis];
  const kunci = kunciNama(data.nama, d.awalan);
  const kolomNama = sql.identifier(d.nama);
  const kolomHp = d.noHp ? sql.identifier(d.noHp) : null;
  const samaNama =
    kunci === '' ? sql`false` : sql`${kunciNamaSql(sql`${kolomNama}`, d.awalan)} = ${kunci}`;
  const samaHp = kolomHp && data.noHp ? sql`${kolomHp} = ${data.noHp}` : sql`false`;
  const r = await ex.execute<{
    id: string;
    kode: string;
    nama: string;
    no_hp: string | null;
    status_aktif: string;
    sama_nama: boolean;
  }>(sql`
    select id, kode, ${kolomNama} as nama, ${kolomHp ?? sql`null`} as no_hp, status_aktif,
      (${samaNama}) as sama_nama
      from ${sql.identifier(d.tabel)}
     where ((${samaNama}) or (${samaHp}))
       ${kecualiId === undefined ? sql`` : sql`and id <> ${kecualiId}`}
       ${
         jenis === 'barang' && data.kepemilikan
           ? sql`and kepemilikan = ${data.kepemilikan}
               and id_pemasok_konsinyasi is not distinct from ${data.idPemasokKonsinyasi ?? null}`
           : sql``
       }
     order by status_aktif, id limit 5`);
  return r.rows.map((x) => ({
    id: Number(x.id),
    kode: x.kode,
    nama: x.nama,
    noHp: x.no_hp,
    statusAktif: x.status_aktif,
    alasan: x.sama_nama ? 'nama sama' : 'No. HP sama',
  }));
}

/** Tolak bila ada data mirip, kecuali sudah ditegaskan berbeda (`abaikan`). */
export async function pastikanTidakMirip(
  ex: Executor,
  jenis: JenisMirip,
  data: Parameters<typeof cariMirip>[2],
  abaikan: boolean | undefined,
  kecualiId?: number,
): Promise<void> {
  if (abaikan) return;
  const mirip = await cariMirip(ex, jenis, data, kecualiId);
  if (mirip.length === 0) return;
  const apa = jenis === 'barang' ? 'Barang' : jenis === 'pelanggan' ? 'Pelanggan' : 'Pemasok';
  throw new AppError(
    'KONFLIK',
    `${apa} mirip sudah ada: ${mirip.map((m) => `${m.kode} ${m.nama} (${m.alasan}${m.statusAktif === 'AKTIF' ? '' : ', nonaktif'})`).join('; ')}. ` +
      'Pakai data yang ada, atau tegaskan bahwa ini data berbeda.',
    409,
    { mirip },
  );
}
