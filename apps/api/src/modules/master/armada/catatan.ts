import {
  formatRupiah,
  teksTanggalAngka,
  type CatatanBbm,
  type CatatanServis,
  type DataCatatBbm,
  type DataCatatServis,
  type MetaHalaman,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as catatanRepo from './catatan-repo';
import * as repo from './repo';

/*
 * Catatan BBM dan servis (K-162, docs/13 §5.2). Hanya pencatatan (tidak mengubah kas shift). Catatan salah
 * dibatalkan dengan alasan lalu dicatat ulang. Odometer tidak boleh mundur menurut urutan tanggal.
 */

async function kunciKendaraanAktif(tx: Tx, id: number) {
  const k = await repo.kunciKendaraan(tx, id);
  if (!k) throw galatKolom('idKendaraan', 'Kendaraan tidak ditemukan.');
  if (k.statusAktif !== 'AKTIF') throw galatKolom('idKendaraan', `Kendaraan ${k.plat} nonaktif.`);
  return k;
}

function pastikanTanggal(tanggal: string) {
  if (tanggal > tanggalOperasional()) {
    throw galatKolom('tanggal', 'Tanggal tidak boleh setelah hari ini.');
  }
}

/** Odometer baru harus ≥ catatan pada/sebelum tanggalnya dan ≤ catatan sesudahnya. */
async function pastikanOdometer(tx: Tx, idKendaraan: number, tanggal: string, km: number | null) {
  if (km === null) return;
  const { sebelum, sesudah } = await catatanRepo.batasOdometer(tx, idKendaraan, tanggal);
  const f = (n: number) => n.toLocaleString('id-ID');
  if (sebelum !== null && km < sebelum) {
    throw galatKolom(
      'odometerKm',
      `Odometer lebih kecil dari catatan sebelumnya (${f(sebelum)} km). Periksa angkanya; bila catatan lama ` +
        'yang salah, batalkan dulu catatan itu.',
    );
  }
  if (sesudah !== null && km > sesudah) {
    throw galatKolom(
      'odometerKm',
      `Odometer lebih besar dari catatan bertanggal sesudahnya (${f(sesudah)} km). Periksa tanggal dan angkanya.`,
    );
  }
}

export async function catatBbm(
  input: DataCatatBbm,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ id: number }> {
  pastikanTanggal(input.tanggal);
  return dalamTransaksi(async (tx) => {
    const k = await kunciKendaraanAktif(tx, input.idKendaraan);
    if (input.idSopir !== null && !(await repo.sopirById(tx, input.idSopir))) {
      throw galatKolom('idSopir', 'Sopir tidak ditemukan.');
    }
    if (input.idPerjalanan !== null) {
      const rit = await catatanRepo.ritKendaraan(tx, input.idPerjalanan);
      if (rit?.idKendaraan !== k.id) {
        throw galatKolom('idPerjalanan', `Rit itu bukan rit kendaraan ${k.plat}.`);
      }
    }
    await pastikanOdometer(tx, k.id, input.tanggal, input.odometerKm);
    const id = await catatanRepo.tambahBbm(tx, {
      idKendaraan: k.id,
      idSopir: input.idSopir,
      idPerjalanan: input.idPerjalanan,
      tanggal: input.tanggal,
      odometerKm: input.odometerKm,
      liter: input.liter,
      totalRp: input.totalRp,
      penuh: input.penuh,
      catatan: input.catatan ?? null,
      idPengguna: pelaku.id,
    });
    await catatLog(tx, {
      aksi: 'ARMADA_BBM_CATAT',
      idPengguna: pelaku.id,
      entitas: 'catatan_bbm',
      idEntitas: id,
      ringkasan:
        `BBM ${k.plat} ${teksTanggalAngka(input.tanggal)}: ${input.liter.replace('.', ',')} L, ` +
        `${formatRupiah(input.totalRp)}${input.odometerKm !== null ? `, odometer ${input.odometerKm} km` : ''}`,
      dataBaru: input,
      ip: asal.ip,
    });
    return { id };
  });
}

export async function catatServis(
  input: DataCatatServis,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ id: number }> {
  pastikanTanggal(input.tanggal);
  return dalamTransaksi(async (tx) => {
    const k = await kunciKendaraanAktif(tx, input.idKendaraan);
    await pastikanOdometer(tx, k.id, input.tanggal, input.odometerKm);
    const id = await catatanRepo.tambahServis(tx, {
      idKendaraan: k.id,
      tanggal: input.tanggal,
      odometerKm: input.odometerKm,
      jenis: input.jenis,
      biayaRp: input.biayaRp,
      bengkel: input.bengkel ?? null,
      catatan: input.catatan ?? null,
      idPengguna: pelaku.id,
    });
    await catatLog(tx, {
      aksi: 'ARMADA_SERVIS_CATAT',
      idPengguna: pelaku.id,
      entitas: 'catatan_servis',
      idEntitas: id,
      ringkasan: `Servis ${k.plat} ${teksTanggalAngka(input.tanggal)}: ${input.jenis}, ${formatRupiah(input.biayaRp)}`,
      dataBaru: input,
      ip: asal.ip,
    });
    return { id };
  });
}

export async function batalCatatan(
  jenis: catatanRepo.JenisCatatan,
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const c = await catatanRepo.kunciCatatan(tx, jenis, id);
    if (!c) throw new AppError('TIDAK_DITEMUKAN', 'Catatan tidak ditemukan.', 404);
    if (c.batalPada) throw new AppError('STATUS_TIDAK_VALID', 'Catatan ini sudah dibatalkan.', 409);
    await catatanRepo.batalkan(tx, jenis, id, {
      batalPada: sekarang(),
      alasanBatal: alasan,
      dibatalkanOleh: pelaku.id,
    });
    await catatLog(tx, {
      aksi: 'ARMADA_CATATAN_BATAL',
      idPengguna: pelaku.id,
      entitas: jenis === 'bbm' ? 'catatan_bbm' : 'catatan_servis',
      idEntitas: id,
      ringkasan: `Batal catatan ${jenis === 'bbm' ? 'BBM' : 'servis'} ${c.plat} ${teksTanggalAngka(c.tanggal)}: ${alasan}`,
      ip: asal.ip,
    });
  });
}

const iso = (d: Date | null) => (d === null ? null : d.toISOString());

export async function daftarBbm(p: {
  idKendaraan?: number | undefined;
  halaman: number;
  perHalaman: number;
}): Promise<{ data: CatatanBbm[]; meta: MetaHalaman }> {
  const { data, total } = await catatanRepo.daftarBbm(db, { ...p, ...batasHalaman(p) });
  return {
    data: data.map((b) => ({
      ...b,
      liter: b.liter.replace(/\.?0+$/, ''),
      dibuatPada: b.dibuatPada.toISOString(),
      batalPada: iso(b.batalPada),
    })),
    meta: metaHalaman(total, p),
  };
}

export async function daftarServis(p: {
  idKendaraan?: number | undefined;
  halaman: number;
  perHalaman: number;
}): Promise<{ data: CatatanServis[]; meta: MetaHalaman }> {
  const { data, total } = await catatanRepo.daftarServis(db, { ...p, ...batasHalaman(p) });
  return {
    data: data.map((b) => ({
      ...b,
      dibuatPada: b.dibuatPada.toISOString(),
      batalPada: iso(b.batalPada),
    })),
    meta: metaHalaman(total, p),
  };
}
