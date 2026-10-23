import {
  teksTanggalAngka,
  type DataKendaraan,
  type DataSopir,
  type Kendaraan,
  type SedangJalan,
  type Sopir,
  type StatusAktif,
} from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { jamLokal, sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Kendaraan dan sopir (docs/05 S8, K-150). Tidak dihapus; dinonaktifkan. Yang sedang jalan tidak bisa
 * dinonaktifkan agar perjalanannya tetap bisa diselesaikan.
 */

type BarisRepo<T> = Omit<T, 'sedangJalan'> & {
  sedangJalan: { idPerjalanan: number; nomor: string; waktuBerangkat: string } | null;
};

/** json_build_object mengembalikan waktu sebagai teks Postgres; dinormalkan ke ISO. */
function rapikanJalan(j: BarisRepo<Kendaraan>['sedangJalan']): SedangJalan | null {
  if (!j) return null;
  return { ...j, waktuBerangkat: new Date(j.waktuBerangkat).toISOString() };
}

const keKendaraan = (b: BarisRepo<Kendaraan>): Kendaraan => ({
  ...b,
  sedangJalan: rapikanJalan(b.sedangJalan),
});
const keSopir = (b: BarisRepo<Sopir>): Sopir => ({
  ...b,
  sedangJalan: rapikanJalan(b.sedangJalan),
});

async function muatKendaraan(ex: Executor, id: number): Promise<Kendaraan> {
  const b = await repo.kendaraanById(ex, id);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
  return keKendaraan(b);
}

async function muatSopir(ex: Executor, id: number): Promise<Sopir> {
  const b = await repo.sopirById(ex, id);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Sopir tidak ditemukan.', 404);
  return keSopir(b);
}

/** "14:30" bila hari ini, selain itu "22/10/2026 14:30". */
export function teksBerangkat(w: Date): string {
  const tgl = tanggalOperasional(w);
  return tgl === tanggalOperasional() ? jamLokal(w) : `${teksTanggalAngka(tgl)} ${jamLokal(w)}`;
}

export function masihJalan(apa: string, j: { nomor: string; waktuBerangkat: Date }): AppError {
  return new AppError(
    'STATUS_TIDAK_VALID',
    `${apa} sedang jalan (${j.nomor}, berangkat ${teksBerangkat(j.waktuBerangkat)}). ` +
      'Catat hasil pengantarannya dulu.',
    409,
  );
}

// --- Kendaraan ---

function nilaiKendaraan(input: DataKendaraan): repo.NilaiKendaraan {
  return {
    plat: input.plat,
    jenis: input.jenis,
    kapasitasKg: input.kapasitasKg,
    bakPanjangCm: input.bakPanjangCm,
    bakLebarCm: input.bakLebarCm,
    bakTinggiCm: input.bakTinggiCm,
    berlakuStnk: input.berlakuStnk,
    berlakuKir: input.berlakuKir,
    catatan: input.catatan ?? null,
  };
}

export async function daftarKendaraan(status: StatusAktif | 'SEMUA'): Promise<Kendaraan[]> {
  return (await repo.daftarKendaraan(db, status)).map(keKendaraan);
}

export async function tambahKendaraan(
  input: DataKendaraan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Kendaraan> {
  const data = nilaiKendaraan(input);
  const id = await dalamTransaksi(async (tx) => {
    if (await repo.platDipakai(tx, data.plat)) {
      throw galatKolom('plat', `Kendaraan ${data.plat} sudah terdaftar.`, 'KONFLIK');
    }
    const idBaru = await repo.tambahKendaraan(tx, data);
    await catatLog(tx, {
      aksi: 'KENDARAAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'kendaraan',
      idEntitas: idBaru,
      ringkasan: `Menambah kendaraan ${data.plat} (${data.jenis})`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muatKendaraan(db, id);
}

export async function ubahKendaraan(
  id: number,
  input: DataKendaraan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Kendaraan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciKendaraan(tx, id);
    if (!lama) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
    const baru = nilaiKendaraan(input);
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('plat') && (await repo.platDipakai(tx, baru.plat, id))) {
      throw galatKolom('plat', `Kendaraan ${baru.plat} sudah terdaftar.`, 'KONFLIK');
    }
    await repo.ubahKendaraan(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'KENDARAAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'kendaraan',
      idEntitas: id,
      ringkasan: `Mengubah kendaraan ${lama.plat}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muatKendaraan(db, id);
}

export async function ubahStatusKendaraan(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Kendaraan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciKendaraan(tx, id);
    if (!lama) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
    if (lama.statusAktif === statusAktif) return;
    if (statusAktif === 'NONAKTIF') {
      const j = await repo.perjalananJalan(tx, { idKendaraan: id });
      if (j) throw masihJalan(`Kendaraan ${lama.plat}`, j);
    }
    await repo.ubahKendaraan(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'KENDARAAN_AKTIFKAN' : 'KENDARAAN_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'kendaraan',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} kendaraan ${lama.plat}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muatKendaraan(db, id);
}

// --- Sopir ---

export async function daftarSopir(status: StatusAktif | 'SEMUA'): Promise<Sopir[]> {
  return (await repo.daftarSopir(db, status)).map(keSopir);
}

export async function tambahSopir(
  input: DataSopir,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Sopir> {
  const data = { nama: input.nama, noHp: input.noHp ?? null, catatan: input.catatan ?? null };
  const id = await dalamTransaksi(async (tx) => {
    if (await repo.namaSopirDipakai(tx, data.nama)) {
      throw galatKolom(
        'nama',
        `Sopir "${data.nama}" sudah ada. Beri pembeda bila orangnya lain, mis. "${data.nama} (Kecil)".`,
        'KONFLIK',
      );
    }
    const idBaru = await repo.tambahSopir(tx, data);
    await catatLog(tx, {
      aksi: 'SOPIR_BUAT',
      idPengguna: pelaku.id,
      entitas: 'sopir',
      idEntitas: idBaru,
      ringkasan: `Menambah sopir ${data.nama}`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muatSopir(db, id);
}

export async function ubahSopir(
  id: number,
  input: DataSopir,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Sopir> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciSopir(tx, id);
    if (!lama) throw new AppError('TIDAK_DITEMUKAN', 'Sopir tidak ditemukan.', 404);
    const baru = { nama: input.nama, noHp: input.noHp ?? null, catatan: input.catatan ?? null };
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('nama') && (await repo.namaSopirDipakai(tx, baru.nama, id))) {
      throw galatKolom('nama', `Sopir "${baru.nama}" sudah ada.`, 'KONFLIK');
    }
    await repo.ubahSopir(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'SOPIR_UBAH',
      idPengguna: pelaku.id,
      entitas: 'sopir',
      idEntitas: id,
      ringkasan: `Mengubah sopir ${lama.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muatSopir(db, id);
}

export async function ubahStatusSopir(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Sopir> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciSopir(tx, id);
    if (!lama) throw new AppError('TIDAK_DITEMUKAN', 'Sopir tidak ditemukan.', 404);
    if (lama.statusAktif === statusAktif) return;
    if (statusAktif === 'NONAKTIF') {
      const j = await repo.perjalananJalan(tx, { idSopir: id });
      if (j) throw masihJalan(`Sopir ${lama.nama}`, j);
    }
    await repo.ubahSopir(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'SOPIR_AKTIFKAN' : 'SOPIR_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'sopir',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} sopir ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muatSopir(db, id);
}
