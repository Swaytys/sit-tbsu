import {
  formatRupiah,
  keQty,
  keTeksPersen,
  kunciKelompok,
  teksQty,
  type DataPromo,
  type KelompokSasaran,
  type MetaHalaman,
  type Promo,
  type SasaranPromo,
  type StatusAktif,
  type StatusBerlakuPromo,
} from '@sit/shared';
import { db, type Tx } from '../../db/client';
import { AppError, galatKolom } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../lib/paginasi';
import { selisih } from '../../lib/perubahan';
import { dalamTransaksi } from '../../lib/transaksi';
import { jamLokal, sekarang, tanggalOperasional } from '../../lib/waktu';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanKodeMaster } from '../sistem/penomoran';
import { bitHari, hariDariBit } from './hitung';
import * as repo from './repo';

/*
 * Master promo (docs/06 §3, K-087, K-163). Tidak dihapus; dinonaktifkan. Kode PRM-nnnnn dari penomoran (N5).
 * Setelah promo terpakai di penjualan, aturannya dikunci agar struk lama, cetak ulang, dan Laporan Promo
 * tetap sesuai dengan yang terjadi; aturan berbeda dibuat sebagai promo baru. Templat kampanye (K-163) tidak
 * pernah berlaku; isinya disalin menjadi promo baru di layar.
 */

/** PR1: status berlaku menurut waktu sekarang (status aktif dinilai terpisah). */
export function statusBerlaku(
  p: { mulaiPada: Date; selesaiPada: Date },
  saat: Date,
): StatusBerlakuPromo {
  if (saat < p.mulaiPada) return 'TERJADWAL';
  if (saat > p.selesaiPada) return 'BERAKHIR';
  return 'BERJALAN';
}

type Baris = NonNullable<Awaited<ReturnType<typeof repo.promoById>>>;
type PelangganPromo = Promo['pelanggan'];
type SasaranDaftar = Promo['sasaranDaftar'];

function keRespons(
  b: Baris,
  saat: Date,
  pelanggan: PelangganPromo,
  sasaranDaftar: SasaranDaftar,
  kelompok: Promo['kelompok'],
): Promo {
  return {
    id: b.id,
    kode: b.kode,
    nama: b.nama,
    tanggalMulai: b.tanggalMulai,
    tanggalSelesai: b.tanggalSelesai,
    mulaiPada: b.mulaiPada.toISOString(),
    selesaiPada: b.selesaiPada.toISOString(),
    hariBerlaku: hariDariBit(b.hariBerlaku),
    jamMulai: b.jamMulai,
    jamSelesai: b.jamSelesai,
    jenisPotongan: b.jenisPotongan,
    potonganPersen: b.potonganPersen,
    potonganNominal: b.potonganNominal,
    maksPotongan: b.maksPotongan,
    hargaKhusus: b.hargaKhusus,
    beliQty: b.beliQty,
    gratisQty: b.gratisQty,
    templat: b.templat,
    sasaran: b.sasaran,
    sasaranDaftar,
    kelompok,
    minQty: b.minQty,
    minBelanja: b.minBelanja,
    keterangan: b.keterangan,
    sasaranPembeli: b.sasaranPembeli,
    idGolongan: b.idGolongan,
    namaGolongan: b.namaGolongan,
    pelanggan,
    minBelanjaPelanggan: b.minBelanjaPelanggan,
    hariBelanja: b.hariBelanja,
    statusAktif: b.statusAktif === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
    statusBerlaku: statusBerlaku(b, saat),
    jumlahPemakaian: b.jumlahPemakaian,
    anggaran: b.anggaran,
    maksPerPembeli: b.maksPerPembeli,
    totalDiskon: b.totalDiskon,
    sisaAnggaran: b.anggaran === null ? null : Math.max(0, b.anggaran - b.totalDiskon),
  };
}

/**
 * Uraian manfaat untuk log/tampilan, mis. "10% (maks. Rp 5.000)", "Rp 2.000/satuan", "harga Rp 48.000/satuan",
 * atau "beli 10 gratis 1".
 */
export function uraianPotongan(p: {
  jenisPotongan: string;
  potonganPersen: string | null;
  potonganNominal: number | null;
  maksPotongan: number | null;
  hargaKhusus?: number | null;
  beliQty?: string | null;
  gratisQty?: string | null;
}): string {
  if (p.jenisPotongan === 'PERSEN') {
    const maks = p.maksPotongan === null ? '' : ` (maks. ${formatRupiah(p.maksPotongan)})`;
    return `${teksQty(p.potonganPersen ?? '0')}%${maks}`;
  }
  if (p.jenisPotongan === 'HARGA_KHUSUS') return `harga ${formatRupiah(p.hargaKhusus ?? 0)}/satuan`;
  if (p.jenisPotongan === 'GRATIS') {
    return `beli ${teksQty(p.beliQty ?? '0')} gratis ${teksQty(p.gratisQty ?? '0')}`;
  }
  if (p.jenisPotongan === 'BELI_POTONG') {
    return `beli ${teksQty(p.beliQty ?? '0')} potong ${formatRupiah(p.potonganNominal ?? 0)}`;
  }
  return `${formatRupiah(p.potonganNominal ?? 0)}/satuan`;
}

/** Pelanggan berhak per promo (K-097). */
async function pelangganPer(idPromo: number[]): Promise<Map<number, PelangganPromo>> {
  const peta = new Map<number, PelangganPromo>();
  for (const r of await repo.pelangganPromo(db, idPromo)) {
    const daftar = peta.get(r.idPromo) ?? [];
    daftar.push({ id: r.id, nama: r.nama });
    peta.set(r.idPromo, daftar);
  }
  return peta;
}

/** Sasaran berikut nama per promo (K-163). */
async function sasaranPer(idPromo: number[]): Promise<Map<number, SasaranDaftar>> {
  const peta = new Map<number, SasaranDaftar>();
  for (const r of await repo.sasaranPromo(db, idPromo)) {
    peta.set(r.idPromo, [...(peta.get(r.idPromo) ?? []), { id: r.id, kode: r.kode, nama: r.nama }]);
  }
  return peta;
}

export async function daftarPromo(
  p: Omit<repo.SaringPromo, 'hariIni' | 'templat'> & {
    templat: '0' | '1';
    halaman: number;
    perHalaman: number;
  },
): Promise<{ data: Promo[]; meta: MetaHalaman }> {
  const saat = sekarang();
  const { baris, total } = await repo.daftarPromo(db, {
    ...p,
    templat: p.templat === '1',
    hariIni: tanggalOperasional(saat),
    ...batasHalaman(p),
  });
  const id = baris.map((b) => b.id);
  const pelanggan = await pelangganPer(id);
  const sasaran = await sasaranPer(id);
  const kelompok = await repo.kelompokPromo(db, id);
  return {
    data: baris.map((b) =>
      keRespons(
        b,
        saat,
        pelanggan.get(b.id) ?? [],
        sasaran.get(b.id) ?? [],
        kelompok.get(b.id) ?? [],
      ),
    ),
    meta: metaHalaman(total, p),
  };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Promo tidak ditemukan.', 404);
}

export async function detailPromo(id: number): Promise<Promo> {
  const b = await repo.promoById(db, id);
  if (!b) throw tidakDitemukan();
  return keRespons(
    b,
    sekarang(),
    (await pelangganPer([id])).get(id) ?? [],
    (await sasaranPer([id])).get(id) ?? [],
    (await repo.kelompokPromo(db, [id])).get(id) ?? [],
  );
}

/** Isian → nilai kolom; kolom yang tidak berlaku untuk jenis manfaat dikosongkan (cermin CHECK DB). */
function nilaiDari(input: DataPromo): repo.NilaiPromo {
  const j = input.jenisPotongan;
  const mulai = new Date(input.mulaiPada);
  const selesai = new Date(input.selesaiPada);
  return {
    nama: input.nama,
    mulaiPada: mulai,
    selesaiPada: selesai,
    tanggalMulai: tanggalOperasional(mulai),
    tanggalSelesai: tanggalOperasional(selesai),
    hariBerlaku: bitHari(input.hariBerlaku),
    jamMulai: input.jamMulai,
    jamSelesai: input.jamSelesai,
    jenisPotongan: j,
    potonganPersen: j === 'PERSEN' ? keTeksPersen(input.potonganPersen ?? '0') : null,
    potonganNominal: j === 'NOMINAL' || j === 'BELI_POTONG' ? input.potonganNominal : null,
    maksPotongan: j === 'PERSEN' ? input.maksPotongan : null,
    hargaKhusus: j === 'HARGA_KHUSUS' ? input.hargaKhusus : null,
    beliQty:
      (j === 'GRATIS' || j === 'BELI_POTONG') && input.beliQty !== null
        ? keQty(input.beliQty)
        : null,
    gratisQty: j === 'GRATIS' && input.gratisQty !== null ? keQty(input.gratisQty) : null,
    sasaran: input.sasaran,
    minQty: input.minQty === null ? null : keQty(input.minQty),
    minBelanja: input.minBelanja,
    keterangan: input.keterangan ?? null,
    sasaranPembeli: input.sasaranPembeli,
    idGolongan: input.sasaranPembeli === 'GOLONGAN' ? input.idGolongan : null,
    minBelanjaPelanggan: input.minBelanjaPelanggan,
    hariBelanja: input.minBelanjaPelanggan === null ? null : input.hariBelanja,
    anggaran: input.anggaran,
    maksPerPembeli: input.maksPerPembeli,
    templat: input.templat,
  };
}

/** Pelanggan berhak (urut, tanpa ganda); kosong bila sasaran pembeli bukan PELANGGAN. */
function pelangganDari(input: DataPromo): number[] {
  return input.sasaranPembeli === 'PELANGGAN'
    ? [...new Set(input.idPelanggan)].sort((a, b) => a - b)
    : [];
}

function sasaranDari(input: DataPromo): number[] {
  return input.sasaran === 'SEMUA' || input.sasaran === 'KELOMPOK' ? [] : input.idSasaran;
}

/** K-185: kelompok sasaran (kosong bila sasaran bukan KELOMPOK). */
function kelompokDari(input: DataPromo): KelompokSasaran[] {
  return input.sasaran === 'KELOMPOK' ? input.kelompok : [];
}

/**
 * K-185: kelompok yang baru ditambahkan harus berisi kategori/merk/barang yang ada dan AKTIF, dan barangnya
 * termasuk kategori/merk kelompok itu (kalau tidak, kelompok itu tidak akan pernah cocok).
 */
async function pastikanKelompok(tx: Tx, kelompok: KelompokSasaran[], lama: KelompokSasaran[] = []) {
  const kunciLama = new Set(lama.map(kunciKelompok));
  const baru = kelompok.filter((k) => !kunciLama.has(kunciKelompok(k)));
  if (baru.length === 0) return;
  const d = await repo.dataKelompok(tx, baru);
  for (const k of baru) {
    const no = kelompok.indexOf(k) + 1;
    if (k.idKategori !== null && !d.kategoriAktif.has(k.idKategori)) {
      throw galatKolom('kelompok', `Kelompok ${no}: kategori tidak ditemukan atau nonaktif.`);
    }
    if (k.idMerk !== null && !d.merkAktif.has(k.idMerk)) {
      throw galatKolom('kelompok', `Kelompok ${no}: merk tidak ditemukan atau nonaktif.`);
    }
    if (k.idBarang !== null) {
      const b = d.barang.get(k.idBarang);
      if (!b) throw galatKolom('kelompok', `Kelompok ${no}: barang tidak ditemukan atau nonaktif.`);
      if (
        (k.idKategori !== null && b.idKategori !== k.idKategori) ||
        (k.idMerk !== null && b.idMerk !== k.idMerk)
      ) {
        throw galatKolom(
          'kelompok',
          `Kelompok ${no}: ${b.nama} bukan termasuk kategori/merk kelompok itu, jadi tidak akan pernah cocok.`,
        );
      }
    }
  }
}

/** K-097: golongan dan pelanggan sasaran harus ada dan aktif bila baru dipilih. */
async function pastikanPembeli(
  tx: Tx,
  nilai: repo.NilaiPromo,
  idPelanggan: number[],
  lama?: { idGolongan: number | null; idPelanggan: number[] },
) {
  const s = await repo.statusPembeli(tx, { idGolongan: nilai.idGolongan ?? null, idPelanggan });
  if (nilai.idGolongan != null && nilai.idGolongan !== lama?.idGolongan) {
    if (s.golongan?.status !== 'AKTIF') {
      throw galatKolom('idGolongan', 'Golongan pelanggan tidak ditemukan atau nonaktif.');
    }
  }
  const baru = idPelanggan.filter((id) => !lama?.idPelanggan.includes(id));
  if (baru.some((id) => !s.pelangganAktif.has(id))) {
    throw galatKolom('idPelanggan', 'Ada pelanggan yang tidak ditemukan atau nonaktif.');
  }
}

/** K-163: barang/kategori/merk sasaran yang baru dipilih harus ada dan aktif. */
async function pastikanSasaran(
  tx: Tx,
  sasaran: SasaranPromo,
  id: number[],
  lama?: { sasaran: SasaranPromo; id: number[] },
) {
  const baru = id.filter((x) => lama?.sasaran !== sasaran || !lama.id.includes(x));
  const aktif = await repo.sasaranAktif(tx, sasaran, baru);
  if (baru.some((x) => !aktif.has(x))) {
    const apa = sasaran === 'BARANG' ? 'barang' : sasaran === 'KATEGORI' ? 'kategori' : 'merk';
    throw galatKolom('idSasaran', `Ada ${apa} yang tidak ditemukan atau nonaktif.`);
  }
}

function teksWaktu(w: Date): string {
  return `${tanggalOperasional(w)} ${jamLokal(w)}`;
}

function ringkasPromo(kode: string, n: repo.NilaiPromo): string {
  return `${kode} ${n.nama}: ${uraianPotongan({
    jenisPotongan: n.jenisPotongan,
    potonganPersen: n.potonganPersen ?? null,
    potonganNominal: n.potonganNominal ?? null,
    maksPotongan: n.maksPotongan ?? null,
    hargaKhusus: n.hargaKhusus ?? null,
    beliQty: n.beliQty ?? null,
    gratisQty: n.gratisQty ?? null,
  })}, ${teksWaktu(n.mulaiPada)} s.d. ${teksWaktu(n.selesaiPada)}${n.templat ? ' (templat)' : ''}`;
}

export async function tambahPromo(
  input: DataPromo,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Promo> {
  const nilai = nilaiDari(input);
  if (!nilai.templat && nilai.selesaiPada < sekarang()) {
    throw galatKolom('selesaiPada', 'Waktu selesai sudah lewat.');
  }
  const idPelanggan = pelangganDari(input);
  const idSasaran = sasaranDari(input);
  const kelompok = kelompokDari(input);
  const id = await dalamTransaksi(async (tx) => {
    await pastikanSasaran(tx, nilai.sasaran, idSasaran);
    await pastikanKelompok(tx, kelompok);
    await pastikanPembeli(tx, nilai, idPelanggan);
    const kode = await terbitkanKodeMaster(tx, 'PRM');
    const idBaru = await repo.tambahPromo(tx, { ...nilai, kode });
    await repo.gantiSasaranPromo(tx, idBaru, nilai.sasaran, idSasaran, kelompok);
    await repo.gantiPelangganPromo(tx, idBaru, idPelanggan);
    await catatLog(tx, {
      aksi: 'PROMO_BUAT',
      idPengguna: pelaku.id,
      entitas: 'promo',
      idEntitas: idBaru,
      ringkasan: `Menambah ${nilai.templat ? 'templat' : 'promo'} ${ringkasPromo(kode, nilai)}`,
      dataBaru: { kode, ...nilai, idSasaran, kelompok, idPelanggan },
      ip: asal.ip,
    });
    return idBaru;
  });
  return detailPromo(id);
}

/** Kolom aturan yang dikunci setelah promo terpakai di penjualan (K-087); waktu selesai tetap boleh diubah. */
const KOLOM_ATURAN = [
  'mulaiPada',
  'hariBerlaku',
  'jamMulai',
  'jamSelesai',
  'jenisPotongan',
  'potonganPersen',
  'potonganNominal',
  'maksPotongan',
  'hargaKhusus',
  'beliQty',
  'gratisQty',
  'sasaran',
  'idSasaran',
  'kelompok',
  'minQty',
  'minBelanja',
  'sasaranPembeli',
  'idGolongan',
  'idPelanggan',
  'minBelanjaPelanggan',
  'hariBelanja',
  'templat',
];

/** Bentuk yang bisa dibandingkan `selisih` (waktu sebagai ISO, daftar id sebagai teks). */
function bandingan(
  n: repo.NilaiPromo,
  idSasaran: number[],
  idPelanggan: number[],
  kelompok: KelompokSasaran[],
) {
  return {
    nama: n.nama,
    mulaiPada: n.mulaiPada.toISOString(),
    selesaiPada: n.selesaiPada.toISOString(),
    hariBerlaku: n.hariBerlaku ?? null,
    jamMulai: n.jamMulai ?? null,
    jamSelesai: n.jamSelesai ?? null,
    jenisPotongan: n.jenisPotongan,
    potonganPersen: n.potonganPersen ?? null,
    potonganNominal: n.potonganNominal ?? null,
    maksPotongan: n.maksPotongan ?? null,
    hargaKhusus: n.hargaKhusus ?? null,
    beliQty: n.beliQty ?? null,
    gratisQty: n.gratisQty ?? null,
    sasaran: n.sasaran,
    idSasaran: idSasaran.join(','),
    kelompok: kelompok.map(kunciKelompok).join(','),
    minQty: n.minQty ?? null,
    minBelanja: n.minBelanja ?? null,
    keterangan: n.keterangan ?? null,
    sasaranPembeli: n.sasaranPembeli ?? 'SEMUA',
    idGolongan: n.idGolongan ?? null,
    idPelanggan: idPelanggan.join(','),
    minBelanjaPelanggan: n.minBelanjaPelanggan ?? null,
    hariBelanja: n.hariBelanja ?? null,
    anggaran: n.anggaran ?? null,
    maksPerPembeli: n.maksPerPembeli ?? null,
    templat: n.templat ?? false,
  };
}

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
    const idPelanggan = pelangganDari(input);
    const idSasaran = sasaranDari(input);
    const idPelangganLama = (await repo.pelangganPromo(tx, [id]))
      .map((p) => p.id)
      .sort((a, b) => a - b);
    const kelompok = kelompokDari(input);
    const kelompokLama = (
      lama.sasaran === 'KELOMPOK' ? ((await repo.kelompokPromo(tx, [id])).get(id) ?? []) : []
    ).map((k) => ({ idKategori: k.idKategori, idMerk: k.idMerk, idBarang: k.idBarang }));
    const idSasaranLama =
      lama.sasaran === 'KELOMPOK' ? [] : ((await repo.idSasaranPromo(tx, [id])).get(id) ?? []);
    const beda = selisih(
      bandingan(lama, idSasaranLama, idPelangganLama, kelompokLama),
      bandingan(baru, idSasaran, idPelanggan, kelompok),
    );
    if (beda.kolom.length === 0) return;
    // K-110: anggaran dan batas per pembeli boleh diubah kapan saja (bukan aturan potongan), tetapi anggaran
    // tidak boleh di bawah yang sudah terpakai.
    if (baru.anggaran != null && beda.kolom.includes('anggaran')) {
      const sudah = await repo.totalDiskonPromo(tx, id);
      if (baru.anggaran < sudah) {
        throw galatKolom(
          'anggaran',
          `Anggaran tidak boleh lebih kecil dari potongan yang sudah diberikan (${formatRupiah(sudah)}).`,
        );
      }
    }
    const aturanBerubah = beda.kolom.filter((k) => KOLOM_ATURAN.includes(k));
    if (aturanBerubah.length > 0 && (await repo.jumlahPemakaian(tx, id)) > 0) {
      throw new AppError(
        'KONFLIK',
        `Promo ${lama.kode} sudah dipakai di penjualan; aturannya tidak bisa diubah. ` +
          'Nonaktifkan lalu buat promo baru untuk aturan berbeda (nama, keterangan, waktu selesai, anggaran, ' +
          'dan batas per pembeli tetap bisa diubah).',
        409,
      );
    }
    await pastikanSasaran(tx, baru.sasaran, idSasaran, {
      sasaran: lama.sasaran,
      id: idSasaranLama,
    });
    await pastikanKelompok(tx, kelompok, kelompokLama);
    await pastikanPembeli(tx, baru, idPelanggan, {
      idGolongan: lama.idGolongan,
      idPelanggan: idPelangganLama,
    });
    await repo.ubahPromo(tx, id, baru, sekarang());
    if (['sasaran', 'idSasaran', 'kelompok'].some((k) => beda.kolom.includes(k))) {
      await repo.gantiSasaranPromo(tx, id, baru.sasaran, idSasaran, kelompok);
    }
    if (beda.kolom.includes('idPelanggan')) await repo.gantiPelangganPromo(tx, id, idPelanggan);
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
