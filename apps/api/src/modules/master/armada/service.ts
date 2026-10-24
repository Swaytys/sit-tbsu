import {
  teksTanggalAngka,
  type DataKendaraan,
  type DataSopir,
  type Kendaraan,
  type KesehatanKendaraan,
  type SedangJalan,
  type Sopir,
  type StatusAktif,
  type TingkatPengingat,
} from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import {
  jamLokal,
  sekarang,
  tambahBulan,
  tambahHari,
  tanggalOperasional,
} from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Kendaraan dan sopir (docs/05 S8, K-150). Tidak dihapus; dinonaktifkan. Yang sedang jalan tidak bisa
 * dinonaktifkan agar perjalanannya tetap bisa diselesaikan.
 */

type BarisRepo<T> = Omit<T, 'sedangJalan' | 'kesehatan'> & {
  sedangJalan: { idPerjalanan: number; nomor: string; waktuBerangkat: string } | null;
};

/** json_build_object mengembalikan waktu sebagai teks Postgres; dinormalkan ke ISO. */
function rapikanJalan(j: BarisRepo<Kendaraan>['sedangJalan']): SedangJalan | null {
  if (!j) return null;
  return { ...j, waktuBerangkat: new Date(j.waktuBerangkat).toISOString() };
}

// --- Kesehatan kendaraan (K-162, docs/13 §5.2) ---

const HARI_SEGERA_SERVIS = 14;
const KM_SEGERA_SERVIS = 500;
const HARI_SEGERA_SURAT = 30;
const PERINGKAT: Record<TingkatPengingat, number> = { AMAN: 0, SEGERA: 1, LEWAT: 2 };

/** LEWAT bila `batas` sudah lewat (hari ini > batas), SEGERA bila tinggal ≤ `hariSegera` hari. */
function tingkatTanggal(batas: string | null, hariSegera: number, hariIni: string) {
  if (!batas) return null;
  if (batas < hariIni) return 'LEWAT';
  return batas <= tambahHari(hariIni, hariSegera) ? 'SEGERA' : 'AMAN';
}

function terburuk(...t: (TingkatPengingat | null)[]): TingkatPengingat | null {
  return t.reduce<TingkatPengingat | null>(
    (a, b) => (b === null ? a : a === null || PERINGKAT[b] > PERINGKAT[a] ? b : a),
    null,
  );
}

export function hitungKesehatan(
  k: {
    servisTiapKm: number | null;
    servisTiapBulan: number | null;
    berlakuStnk: string | null;
    berlakuKir: string | null;
  },
  odo: { odometerKm: number; tanggal: string } | undefined,
  servis: { tanggal: string; odometerKm: number | null; jenis: string } | undefined,
  hariIni: string = tanggalOperasional(),
): KesehatanKendaraan {
  let servisBerikut: KesehatanKendaraan['servisBerikut'] = null;
  if (servis && (k.servisTiapKm || k.servisTiapBulan)) {
    const km =
      k.servisTiapKm && servis.odometerKm !== null ? servis.odometerKm + k.servisTiapKm : null;
    const tanggal = k.servisTiapBulan ? tambahBulan(servis.tanggal, k.servisTiapBulan) : null;
    const tingkatKm: TingkatPengingat | null =
      km === null || !odo
        ? null
        : odo.odometerKm >= km
          ? 'LEWAT'
          : odo.odometerKm >= km - KM_SEGERA_SERVIS
            ? 'SEGERA'
            : 'AMAN';
    const tingkat = terburuk(tingkatKm, tingkatTanggal(tanggal, HARI_SEGERA_SERVIS, hariIni));
    if (km !== null || tanggal !== null)
      servisBerikut = { km, tanggal, tingkat: tingkat ?? 'AMAN' };
  }
  return {
    odometerKm: odo?.odometerKm ?? null,
    odometerTanggal: odo?.tanggal ?? null,
    servisTerakhir: servis ?? null,
    servisBerikut,
    stnk: tingkatTanggal(k.berlakuStnk, HARI_SEGERA_SURAT, hariIni),
    kir: tingkatTanggal(k.berlakuKir, HARI_SEGERA_SURAT, hariIni),
  };
}

async function keKendaraanSemua(ex: Executor, baris: BarisRepo<Kendaraan>[]): Promise<Kendaraan[]> {
  const id = baris.map((b) => b.id);
  const odo = await repo.odometerTerakhir(ex, id);
  const servis = await repo.servisTerakhir(ex, id);
  return baris.map((b) => ({
    ...b,
    sedangJalan: rapikanJalan(b.sedangJalan),
    kesehatan: hitungKesehatan(b, odo.get(b.id), servis.get(b.id)),
  }));
}
const keSopir = (b: BarisRepo<Sopir>): Sopir => ({
  ...b,
  sedangJalan: rapikanJalan(b.sedangJalan),
});

async function muatKendaraan(ex: Executor, id: number): Promise<Kendaraan> {
  const b = await repo.kendaraanById(ex, id);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
  const [k] = await keKendaraanSemua(ex, [b]);
  if (!k) throw new Error('kendaraan hilang');
  return k;
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

export function masihJalan(
  apa: string,
  j: { nomor: string; waktuBerangkat: Date | null },
): AppError {
  return new AppError(
    'STATUS_TIDAK_VALID',
    `${apa} sedang jalan (${j.nomor}${j.waktuBerangkat ? `, berangkat ${teksBerangkat(j.waktuBerangkat)}` : ''}). ` +
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
    servisTiapKm: input.servisTiapKm,
    servisTiapBulan: input.servisTiapBulan,
    catatan: input.catatan ?? null,
  };
}

export async function daftarKendaraan(status: StatusAktif | 'SEMUA'): Promise<Kendaraan[]> {
  return keKendaraanSemua(db, await repo.daftarKendaraan(db, status));
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

/** Pengingat notifikasi (K-162): kendaraan aktif dengan STNK/KIR atau servis SEGERA/LEWAT. */
export async function pengingatArmada(): Promise<{
  surat: string[];
  suratLewat: number;
  servis: string[];
  servisLewat: number;
}> {
  const daftar = await daftarKendaraan('AKTIF');
  const teks = (t: TingkatPengingat) => (t === 'LEWAT' ? 'habis' : 'hampir habis');
  const surat: string[] = [];
  const servis: string[] = [];
  let suratLewat = 0;
  let servisLewat = 0;
  for (const k of daftar) {
    const { stnk, kir, servisBerikut } = k.kesehatan;
    const bagian = [
      stnk && stnk !== 'AMAN' ? `STNK ${teks(stnk)}` : null,
      kir && kir !== 'AMAN' ? `KIR ${teks(kir)}` : null,
    ].filter((x): x is string => x !== null);
    if (bagian.length > 0) {
      surat.push(`${k.plat}: ${bagian.join(', ')}`);
      if (stnk === 'LEWAT' || kir === 'LEWAT') suratLewat++;
    }
    if (servisBerikut && servisBerikut.tingkat !== 'AMAN') {
      servis.push(
        `${k.plat}: ${servisBerikut.tingkat === 'LEWAT' ? 'terlewat' : 'segera'}` +
          (servisBerikut.km !== null ? ` (${servisBerikut.km.toLocaleString('id-ID')} km)` : '') +
          (servisBerikut.tanggal ? ` (${teksTanggalAngka(servisBerikut.tanggal)})` : ''),
      );
      if (servisBerikut.tingkat === 'LEWAT') servisLewat++;
    }
  }
  return { surat, suratLewat, servis, servisLewat };
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
