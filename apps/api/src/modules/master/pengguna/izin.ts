import {
  DAFTAR_IZIN,
  IZIN_KHUSUS_OWNER,
  IZIN_PER_PERAN,
  LABEL_PERAN,
  type DataIzinAkun,
  type DataPeranKustom,
  type Izin,
  type PeranKustom,
  type StatusAktif,
} from '@sit/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { db, type Tx } from '../../../db/client';
import { pengguna, peranKustom } from '../../../db/schema';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';

/*
 * K-243: izin tambahan/dicabut per akun dan peran khusus (peran dasar + penyesuaian). Hanya Owner (izin
 * `sistem.izin.atur`, dicek route). Izin khusus Owner tidak bisa diberikan; Owner selalu memegang semua izin.
 */

const SAH = new Set(Object.keys(DAFTAR_IZIN));

/** Bersihkan penyesuaian: hanya izin dikenal, tambah = yang belum dimiliki peran dasar, cabut = yang dimiliki. */
function rapikan(
  dasar: ReadonlySet<Izin>,
  tambah: string[],
  cabut: string[],
): { tambah: Izin[]; cabut: Izin[] } {
  const asing = [...tambah, ...cabut].filter((i) => !SAH.has(i));
  if (asing.length > 0) throw galatKolom('izinTambah', `Izin tidak dikenal: ${asing.join(', ')}.`);
  const terlarang = tambah.filter((i) => (IZIN_KHUSUS_OWNER as readonly string[]).includes(i));
  if (terlarang.length > 0) {
    throw galatKolom(
      'izinTambah',
      `Izin khusus Owner tidak bisa diberikan: ${terlarang.map((i) => DAFTAR_IZIN[i as Izin]).join('; ')}.`,
    );
  }
  return {
    tambah: (tambah as Izin[]).filter((i) => !dasar.has(i)).sort(),
    cabut: (cabut as Izin[]).filter((i) => dasar.has(i)).sort(),
  };
}

const ringkas = (p: { tambah: string[]; cabut: string[] }) =>
  [
    p.tambah.length ? `ditambah: ${p.tambah.join(', ')}` : '',
    p.cabut.length ? `dicabut: ${p.cabut.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ') || 'tanpa penyesuaian';

export async function daftarPeranKustom(): Promise<PeranKustom[]> {
  const r = await db
    .select({
      id: peranKustom.id,
      nama: peranKustom.nama,
      peranDasar: peranKustom.peranDasar,
      keterangan: peranKustom.keterangan,
      izinTambah: peranKustom.izinTambah,
      izinCabut: peranKustom.izinCabut,
      statusAktif: peranKustom.statusAktif,
      jumlahPengguna: sql<number>`(select count(*)::int from ${pengguna}
        where ${pengguna.idPeranKustom} = ${peranKustom.id})`,
    })
    .from(peranKustom)
    .orderBy(asc(peranKustom.nama));
  return r;
}

export async function simpanPeranKustom(
  id: number | null,
  input: DataPeranKustom,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PeranKustom> {
  const p = rapikan(IZIN_PER_PERAN[input.peranDasar], input.izinTambah, input.izinCabut);
  const idHasil = await dalamTransaksi(async (tx) => {
    const [ganda] = await tx
      .select({ id: peranKustom.id })
      .from(peranKustom)
      .where(sql`lower(${peranKustom.nama}) = lower(${input.nama})`);
    if (ganda && ganda.id !== id)
      throw galatKolom('nama', `Peran "${input.nama}" sudah ada.`, 'KONFLIK');
    const nilai = {
      nama: input.nama,
      peranDasar: input.peranDasar,
      keterangan: input.keterangan ?? null,
      izinTambah: p.tambah,
      izinCabut: p.cabut,
    };
    let idBaru = id;
    if (id === null) {
      const [b] = await tx.insert(peranKustom).values(nilai).returning({ id: peranKustom.id });
      if (!b) throw new Error('insert peran_kustom tidak mengembalikan id');
      idBaru = b.id;
    } else {
      const [lama] = await tx
        .select({ peranDasar: peranKustom.peranDasar })
        .from(peranKustom)
        .where(eq(peranKustom.id, id))
        .for('update');
      if (!lama) throw new AppError('TIDAK_DITEMUKAN', 'Peran khusus tidak ditemukan.', 404);
      if (lama.peranDasar !== input.peranDasar) {
        const [dipakai] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(pengguna)
          .where(eq(pengguna.idPeranKustom, id));
        if ((dipakai?.n ?? 0) > 0) {
          throw galatKolom(
            'peranDasar',
            'Peran dasar tidak bisa diganti selama peran ini dipakai akun. Buat peran khusus baru.',
          );
        }
      }
      await tx
        .update(peranKustom)
        .set({ ...nilai, diubahPada: sekarang() })
        .where(eq(peranKustom.id, id));
    }
    await catatLog(tx, {
      aksi: id === null ? 'PERAN_KUSTOM_BUAT' : 'PERAN_KUSTOM_UBAH',
      idPengguna: pelaku.id,
      entitas: 'peran_kustom',
      idEntitas: idBaru ?? undefined,
      ringkasan: `Peran khusus "${input.nama}" (dasar ${LABEL_PERAN[input.peranDasar]}): ${ringkas(p)}`,
      ip: asal.ip,
    });
    return idBaru as number;
  });
  const hasil = (await daftarPeranKustom()).find((x) => x.id === idHasil);
  if (!hasil) throw new Error('peran khusus hilang setelah disimpan');
  return hasil;
}

export async function ubahStatusPeranKustom(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const [b] = await tx
      .update(peranKustom)
      .set({ statusAktif, diubahPada: sekarang() })
      .where(eq(peranKustom.id, id))
      .returning({ nama: peranKustom.nama });
    if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Peran khusus tidak ditemukan.', 404);
    await catatLog(tx, {
      aksi: 'PERAN_KUSTOM_STATUS',
      idPengguna: pelaku.id,
      entitas: 'peran_kustom',
      idEntitas: id,
      ringkasan: `Peran khusus "${b.nama}" ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}`,
      ip: asal.ip,
    });
  });
}

/** K-243: peran khusus dan penyesuaian izin satu akun. */
export async function aturIzinAkun(
  idPengguna: number,
  input: DataIzinAkun,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx: Tx) => {
    const [t] = await tx
      .select({ nama: pengguna.namaPengguna, peran: pengguna.peran })
      .from(pengguna)
      .where(eq(pengguna.id, idPengguna))
      .for('update');
    if (!t) throw new AppError('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.', 404);
    if (t.peran === 'OWNER') {
      throw new AppError('KONFLIK', 'Owner selalu memegang semua izin; tidak perlu diatur.', 409);
    }
    let dasar = new Set(IZIN_PER_PERAN[t.peran]);
    let namaKustom = '';
    if (input.idPeranKustom !== null) {
      const [k] = await tx
        .select({
          nama: peranKustom.nama,
          peranDasar: peranKustom.peranDasar,
          statusAktif: peranKustom.statusAktif,
          tambah: peranKustom.izinTambah,
          cabut: peranKustom.izinCabut,
        })
        .from(peranKustom)
        .where(eq(peranKustom.id, input.idPeranKustom));
      if (k?.statusAktif !== 'AKTIF')
        throw galatKolom('idPeranKustom', 'Peran khusus tidak aktif.');
      if (k.peranDasar !== t.peran) {
        throw galatKolom(
          'idPeranKustom',
          `Peran khusus "${k.nama}" berdasar ${LABEL_PERAN[k.peranDasar]}, sedangkan akun ini ${LABEL_PERAN[t.peran]}.`,
        );
      }
      dasar = new Set([...dasar, ...(k.tambah as Izin[])]);
      for (const i of k.cabut) dasar.delete(i as Izin);
      namaKustom = k.nama;
    }
    const p = rapikan(dasar, input.izinTambah, input.izinCabut);
    await tx
      .update(pengguna)
      .set({
        idPeranKustom: input.idPeranKustom,
        izinTambah: p.tambah,
        izinCabut: p.cabut,
        diubahPada: sekarang(),
      })
      .where(eq(pengguna.id, idPengguna));
    await catatLog(tx, {
      aksi: 'PENGGUNA_IZIN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: idPengguna,
      ringkasan:
        `Izin ${t.nama}: ${namaKustom ? `peran khusus "${namaKustom}"; ` : ''}${ringkas(p)}`.slice(
          0,
          1000,
        ),
      ip: asal.ip,
    });
  });
}
