import {
  formatRupiah,
  keQty,
  keTeksPersen,
  teksQty,
  type DataPromo,
  type MetaHalaman,
  type Promo,
  type StatusAktif,
  type StatusBerlakuPromo,
} from '@sit/shared';
import { db, type Tx } from '../../db/client';
import { AppError } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../lib/paginasi';
import { selisih } from '../../lib/perubahan';
import { dalamTransaksi } from '../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../lib/waktu';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanKodeMaster } from '../sistem/penomoran';
import * as repo from './repo';

/*
 * Master promo (docs/06 §3, K-087). Tidak dihapus; dinonaktifkan. Kode PRM-nnnnn dari penomoran (N5).
 * Setelah promo terpakai di penjualan, aturannya dikunci agar struk lama, cetak ulang, dan Laporan Promo
 * tetap sesuai dengan yang terjadi; aturan berbeda dibuat sebagai promo baru.
 */

/** PR1: status berlaku menurut tanggal operasional hari ini (status aktif dinilai terpisah). */
export function statusBerlaku(
  p: { tanggalMulai: string; tanggalSelesai: string },
  hariIni: string,
): StatusBerlakuPromo {
  if (hariIni < p.tanggalMulai) return 'TERJADWAL';
  if (hariIni > p.tanggalSelesai) return 'BERAKHIR';
  return 'BERJALAN';
}

type Baris = NonNullable<Awaited<ReturnType<typeof repo.promoById>>>;

function keRespons(b: Baris, hariIni: string): Promo {
  return {
    id: b.id,
    kode: b.kode,
    nama: b.nama,
    tanggalMulai: b.tanggalMulai,
    tanggalSelesai: b.tanggalSelesai,
    jenisPotongan: b.jenisPotongan,
    potonganPersen: b.potonganPersen,
    potonganNominal: b.potonganNominal,
    maksPotongan: b.maksPotongan,
    sasaran: b.sasaran,
    idKategori: b.idKategori,
    namaKategori: b.namaKategori,
    idBarang: b.idBarang,
    kodeBarang: b.kodeBarang,
    namaBarang: b.namaBarang,
    minQty: b.minQty,
    minBelanja: b.minBelanja,
    keterangan: b.keterangan,
    statusAktif: b.statusAktif === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
    statusBerlaku: statusBerlaku(b, hariIni),
    jumlahPemakaian: b.jumlahPemakaian,
  };
}

/** Uraian potongan untuk log/tampilan, mis. "10% (maks. Rp 5.000)" atau "Rp 2.000/satuan". */
export function uraianPotongan(p: {
  jenisPotongan: string;
  potonganPersen: string | null;
  potonganNominal: number | null;
  maksPotongan: number | null;
}): string {
  if (p.jenisPotongan === 'PERSEN') {
    const maks = p.maksPotongan === null ? '' : ` (maks. ${formatRupiah(p.maksPotongan)})`;
    return `${teksQty(p.potonganPersen ?? '0')}%${maks}`;
  }
  return `${formatRupiah(p.potonganNominal ?? 0)}/satuan`;
}

export async function daftarPromo(
  p: Omit<repo.SaringPromo, 'hariIni'> & { halaman: number; perHalaman: number },
): Promise<{ data: Promo[]; meta: MetaHalaman }> {
  const hariIni = tanggalOperasional();
  const { baris, total } = await repo.daftarPromo(db, { ...p, hariIni, ...batasHalaman(p) });
  return { data: baris.map((b) => keRespons(b, hariIni)), meta: metaHalaman(total, p) };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Promo tidak ditemukan.', 404);
}

export async function detailPromo(id: number): Promise<Promo> {
  const b = await repo.promoById(db, id);
  if (!b) throw tidakDitemukan();
  return keRespons(b, tanggalOperasional());
}

function galatKolom(kolom: string, pesan: string, kode: 'VALIDASI' | 'KONFLIK' = 'VALIDASI') {
  return new AppError(kode, pesan, kode === 'KONFLIK' ? 409 : 400, {
    kolom: { [kolom]: [pesan] },
  });
}

/** Isian → nilai kolom; kolom yang tidak berlaku untuk jenis/sasaran dikosongkan (cermin CHECK DB). */
function nilaiDari(input: DataPromo): repo.NilaiPromo {
  const persen = input.jenisPotongan === 'PERSEN';
  return {
    nama: input.nama,
    tanggalMulai: input.tanggalMulai,
    tanggalSelesai: input.tanggalSelesai,
    jenisPotongan: input.jenisPotongan,
    potonganPersen: persen ? keTeksPersen(input.potonganPersen ?? '0') : null,
    potonganNominal: persen ? null : input.potonganNominal,
    maksPotongan: persen ? input.maksPotongan : null,
    sasaran: input.sasaran,
    idKategori: input.sasaran === 'KATEGORI' ? input.idKategori : null,
    idBarang: input.sasaran === 'BARANG' ? input.idBarang : null,
    minQty: input.minQty === null ? null : keQty(input.minQty),
    minBelanja: input.minBelanja,
    keterangan: input.keterangan ?? null,
  };
}

/** Kategori/barang sasaran harus ada dan aktif bila baru dipilih. */
async function pastikanSasaran(
  tx: Tx,
  nilai: repo.NilaiPromo,
  lama?: { idKategori: number | null; idBarang: number | null },
) {
  const s = await repo.statusSasaran(tx, {
    idKategori: nilai.idKategori ?? null,
    idBarang: nilai.idBarang ?? null,
  });
  if (nilai.idKategori != null && nilai.idKategori !== lama?.idKategori) {
    if (s.kategori?.status !== 'AKTIF') {
      throw galatKolom('idKategori', 'Kategori tidak ditemukan atau nonaktif.');
    }
  }
  if (nilai.idBarang != null && nilai.idBarang !== lama?.idBarang) {
    if (s.barang?.status !== 'AKTIF') {
      throw galatKolom('idBarang', 'Barang tidak ditemukan atau nonaktif.');
    }
  }
}

function ringkasPromo(kode: string, n: repo.NilaiPromo): string {
  return `${kode} ${n.nama}: ${uraianPotongan({
    jenisPotongan: n.jenisPotongan,
    potonganPersen: n.potonganPersen ?? null,
    potonganNominal: n.potonganNominal ?? null,
    maksPotongan: n.maksPotongan ?? null,
  })}, ${n.tanggalMulai} s.d. ${n.tanggalSelesai}`;
}

export async function tambahPromo(
  input: DataPromo,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Promo> {
  const nilai = nilaiDari(input);
  if (nilai.tanggalSelesai < tanggalOperasional()) {
    throw galatKolom('tanggalSelesai', 'Tanggal selesai sudah lewat.');
  }
  const id = await dalamTransaksi(async (tx) => {
    await pastikanSasaran(tx, nilai);
    const kode = await terbitkanKodeMaster(tx, 'PRM');
    const idBaru = await repo.tambahPromo(tx, { ...nilai, kode });
    await catatLog(tx, {
      aksi: 'PROMO_BUAT',
      idPengguna: pelaku.id,
      entitas: 'promo',
      idEntitas: idBaru,
      ringkasan: `Menambah promo ${ringkasPromo(kode, nilai)}`,
      dataBaru: { kode, ...nilai },
      ip: asal.ip,
    });
    return idBaru;
  });
  return detailPromo(id);
}

/** Kolom aturan yang dikunci setelah promo terpakai di penjualan (K-087). */
const KOLOM_ATURAN = [
  'tanggalMulai',
  'jenisPotongan',
  'potonganPersen',
  'potonganNominal',
  'maksPotongan',
  'sasaran',
  'idKategori',
  'idBarang',
  'minQty',
  'minBelanja',
];

export async function ubahPromo(
  id: number,
  input: DataPromo,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Promo> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPromo(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = nilaiDari(input);
    const beda = selisih(
      {
        nama: lama.nama,
        tanggalMulai: lama.tanggalMulai,
        tanggalSelesai: lama.tanggalSelesai,
        jenisPotongan: lama.jenisPotongan,
        potonganPersen: lama.potonganPersen,
        potonganNominal: lama.potonganNominal,
        maksPotongan: lama.maksPotongan,
        sasaran: lama.sasaran,
        idKategori: lama.idKategori,
        idBarang: lama.idBarang,
        minQty: lama.minQty,
        minBelanja: lama.minBelanja,
        keterangan: lama.keterangan,
      },
      baru,
    );
    if (beda.kolom.length === 0) return;
    const aturanBerubah = beda.kolom.filter((k) => KOLOM_ATURAN.includes(k));
    if (aturanBerubah.length > 0 && (await repo.jumlahPemakaian(tx, id)) > 0) {
      throw new AppError(
        'KONFLIK',
        `Promo ${lama.kode} sudah dipakai di penjualan; aturannya tidak bisa diubah. ` +
          'Nonaktifkan lalu buat promo baru untuk aturan berbeda (nama, keterangan, dan tanggal selesai ' +
          'tetap bisa diubah).',
        409,
      );
    }
    await pastikanSasaran(tx, baru, lama);
    await repo.ubahPromo(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'PROMO_UBAH',
      idPengguna: pelaku.id,
      entitas: 'promo',
      idEntitas: id,
      ringkasan: `Mengubah promo ${lama.kode} ${baru.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return detailPromo(id);
}

export async function ubahStatusPromo(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Promo> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPromo(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahPromo(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'PROMO_AKTIFKAN' : 'PROMO_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'promo',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} promo ${lama.kode} ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return detailPromo(id);
}
