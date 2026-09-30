import type { DataPemasok, MetaHalaman, Pemasok, StatusAktif } from '@sit/shared';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanKodeMaster } from '../../sistem/penomoran';
import * as repo from './repo';

/** Pemasok (docs/03 §3.2). Kode `PMS-00001` tetap (N5). Tidak dihapus; dinonaktifkan (K-021). */

type BarisPemasok = NonNullable<Awaited<ReturnType<typeof repo.pemasokById>>>;

function keRespons(b: BarisPemasok): Pemasok {
  return { ...b, dibuatPada: b.dibuatPada.toISOString() };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Pemasok tidak ditemukan.', 404);
}

async function muat(id: number): Promise<Pemasok> {
  const baris = await repo.pemasokById(db, id);
  if (!baris) throw tidakDitemukan();
  return keRespons(baris);
}

function nilaiDari(input: DataPemasok): repo.NilaiPemasok {
  return {
    namaPemasok: input.namaPemasok,
    noHp: input.noHp,
    kontakPerson: input.kontakPerson ?? null,
    alamat: input.alamat ?? null,
    keterangan: input.keterangan ?? null,
  };
}

export async function daftarPemasok(p: {
  cari?: string | undefined;
  status: StatusAktif | 'SEMUA';
  halaman: number;
  perHalaman: number;
}): Promise<{ data: Pemasok[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPemasok(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

export async function tambahPemasok(
  input: DataPemasok,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pemasok> {
  const id = await dalamTransaksi(async (tx) => {
    const nilai = { ...nilaiDari(input), kode: await terbitkanKodeMaster(tx, 'PMS') };
    const idBaru = await repo.tambahPemasok(tx, nilai);
    await catatLog(tx, {
      aksi: 'PEMASOK_BUAT',
      idPengguna: pelaku.id,
      entitas: 'pemasok',
      idEntitas: idBaru,
      ringkasan: `Menambah pemasok ${nilai.kode} ${nilai.namaPemasok}`,
      dataBaru: nilai,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahPemasok(
  id: number,
  input: DataPemasok,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pemasok> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPemasok(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = nilaiDari(input);
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    await repo.ubahPemasok(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'PEMASOK_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pemasok',
      idEntitas: id,
      ringkasan: `Mengubah pemasok ${lama.namaPemasok}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusPemasok(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pemasok> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPemasok(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahPemasok(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'PEMASOK_AKTIFKAN' : 'PEMASOK_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'pemasok',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} pemasok ${lama.namaPemasok}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
