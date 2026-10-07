import {
  bandingQty,
  keQty,
  LABEL_JENIS_DIMENSI,
  marginPersen,
  type AtributBarang,
  type BarisBarang,
  type DataBarang,
  type DetailBarang,
  type HargaTierBarang,
  type Izin,
  type MetaHalaman,
  type SatuanJualBarang,
  type StatusAktif,
  type StatusStok,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { bacaGambar, hapusBerkas, simpanGambar } from '../../../lib/penyimpanan';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { buatPersediaan, kunciPersediaan, selaraskanHppMaster } from '../../persediaan/ledger';
import { statusStokBarang } from '../../persediaan/stok/service';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { sinkronkanKodeMaster, terbitkanKodeMaster } from '../../sistem/penomoran';
import { hargaBarangDasar, type BarisHarga } from '../harga/repo';
import {
  dasarMarkup,
  muatKonteksHarga,
  ringkasPerubahanHarga,
  tanggapiPemicuHarga,
  terapkanHargaBarang,
  type KonteksHarga,
  type PerubahanHarga,
} from '../harga/service';
import { muatSatuanJual } from '../satuan-jual/service';
import * as satuanJualRepo from '../satuan-jual/repo';
import * as repo from './repo';

/*
 * Barang (docs/03 §3.2, docs/05 L10, docs/06 H2–H5, KS1). Tidak dihapus; dinonaktifkan (K-021).
 * Field sensitif hanya dikirim ke pemegang `master.barang.lihat_hpp` (CLAUDE.md aturan 6).
 */

const FOLDER_GAMBAR = 'barang';
const POLA_KODE_OTOMATIS = /^BRG-(\d{1,8})$/;

type Baris = NonNullable<Awaited<ReturnType<typeof repo.barangById>>>;

// --- Respons ---

function urlGambar(id: number, gambar: string | null): string | null {
  return gambar ? `/api/barang/${id}/gambar?v=${encodeURIComponent(gambar)}` : null;
}

/** "12.5000" → "12.5". */
function rapikanAngka(nilai: string): string {
  return nilai.includes('.') ? nilai.replace(/0+$/, '').replace(/\.$/, '') : nilai;
}

function keBaris(
  b: Baris,
  hargaMentah: BarisHarga[],
  izin: ReadonlySet<Izin>,
  konteks: KonteksHarga,
  statusStok: StatusStok,
  satuanJual: SatuanJualBarang[] = [],
  idSatuanJualCocok: number | null = null,
): BarisBarang {
  const lihatHpp = izin.has('master.barang.lihat_hpp');
  const dasar = dasarMarkup(b, konteks.modeDasar);
  // Markup barang dan margin membuka harga modal (H12, K-059): hanya untuk pemegang lihat_hpp.
  const harga: HargaTierBarang[] = hargaMentah.map((h) => ({
    idTingkatHarga: h.idTingkatHarga,
    metode: h.metode,
    hargaTetap: h.hargaTetap,
    hargaJual: h.hargaJual,
    ...(lihatHpp ? { markupPersen: h.markupPersen, margin: marginPersen(h.hargaJual, dasar) } : {}),
  }));
  const umum: BarisBarang = {
    id: b.id,
    kode: b.kode,
    barcode: b.barcode,
    namaBarang: b.namaBarang,
    idKategori: b.idKategori,
    namaKategori: b.namaKategori,
    idMerk: b.idMerk,
    namaMerk: b.namaMerk,
    idSatuanDasar: b.idSatuanDasar,
    kodeSatuan: b.kodeSatuan,
    stokMinimum: b.stokMinimum,
    stokFisik: b.stokFisik,
    stokRusak: b.stokRusak,
    stokTersedia: keQty(b.stokTersedia),
    statusStok,
    kepemilikan: b.kepemilikan,
    idPemasokKonsinyasi: b.idPemasokKonsinyasi,
    namaPemasokKonsinyasi: b.namaPemasokKonsinyasi,
    perluTinjauHarga: b.perluTinjauHarga,
    hargaOtomatis: b.hargaOtomatis,
    gambar: urlGambar(b.id, b.gambar),
    statusAktif: b.statusAktif,
    harga,
    satuanJual,
    idSatuanJualCocok,
  };
  if (!lihatHpp) return umum;
  return {
    ...umum,
    hargaModalAwal: b.hargaModalAwal,
    hargaTitip: b.hargaTitip,
    hppRata2: b.hppRata2,
    hargaBeliTerakhir: b.hargaBeliTerakhir,
    dasarMarkup: dasar,
  };
}

async function hargaPerBarang(idBarang: number[]): Promise<Map<number, BarisHarga[]>> {
  const peta = new Map<number, BarisHarga[]>();
  for (const h of await hargaBarangDasar(db, idBarang)) {
    const daftar = peta.get(h.idBarang) ?? [];
    daftar.push(h);
    peta.set(h.idBarang, daftar);
  }
  return peta;
}

export async function daftarBarang(
  p: repo.SaringBarang & { halaman: number; perHalaman: number },
  izin: ReadonlySet<Izin>,
): Promise<{ data: BarisBarang[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarBarang(db, { ...p, ...batasHalaman(p) });
  const harga = await hargaPerBarang(baris.map((b) => b.id));
  const konteks = await muatKonteksHarga(db);
  const status = await statusStokBarang(baris.map((b) => b.id));
  const satuanJual = await muatSatuanJual(
    db,
    baris.map((b) => b.id),
  );
  // K-091: kata cari sama persis dengan barcode satuan jual → satuan itu dipilih saat dipindai.
  const cocok = p.cari ? await satuanJualRepo.satuanJualDariBarcode(db, p.cari.trim()) : undefined;
  return {
    data: baris.map((b) =>
      keBaris(
        b,
        harga.get(b.id) ?? [],
        izin,
        konteks,
        status.get(b.id) ?? 'HABIS',
        satuanJual.get(b.id) ?? [],
        cocok?.idBarang === b.id ? cocok.id : null,
      ),
    ),
    meta: metaHalaman(total, p),
  };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);
}

export async function detailBarang(id: number, izin: ReadonlySet<Izin>): Promise<DetailBarang> {
  const b = await repo.barangById(db, id);
  if (!b) throw tidakDitemukan();
  const harga = await hargaPerBarang([id]);
  const atribut: AtributBarang[] = (await repo.atributBarang(db, id)).map((a) => ({
    idJenisAtribut: a.idJenisAtribut,
    kodeJenis: a.kodeJenis,
    namaJenis: a.namaJenis,
    tipeNilai: a.tipeNilai,
    nilai: a.nilaiAngka === null ? (a.nilaiTeks ?? '') : rapikanAngka(a.nilaiAngka),
    idSatuan: a.idSatuan,
    kodeSatuan: a.kodeSatuan,
  }));
  return {
    ...keBaris(
      b,
      harga.get(id) ?? [],
      izin,
      await muatKonteksHarga(db),
      (await statusStokBarang([id])).get(id) ?? 'HABIS',
      (await muatSatuanJual(db, [id])).get(id) ?? [],
    ),
    keterangan: b.keterangan,
    atribut,
    sudahAdaMutasi: b.terakhirMutasi !== null,
  };
}

// --- Validasi ---

function galatKolom(kode: 'VALIDASI' | 'KONFLIK', kolom: string, pesan: string): AppError {
  return new AppError(kode, pesan, kode === 'KONFLIK' ? 409 : 400, { kolom: { [kolom]: [pesan] } });
}

function pastikanBolehHpp(pelaku: PenggunaAktif): void {
  // Form barang memuat harga modal dan harga titip (data sensitif, CLAUDE.md aturan 6).
  if (!pelaku.izin.has('master.barang.lihat_hpp')) {
    throw new AppError(
      'TIDAK_BERIZIN',
      'Mengelola barang membutuhkan izin melihat harga modal.',
      403,
    );
  }
}

/** N5: kode sendiri boleh selama unik; kode berpola `BRG-nnnnn` ikut menaikkan penghitung. */
async function tentukanKode(tx: Tx, kode: string | undefined, kecualiId?: number): Promise<string> {
  if (kode !== undefined) {
    if (await repo.kodeDipakai(tx, kode, kecualiId)) {
      throw galatKolom('KONFLIK', 'kode', `Kode ${kode} sudah dipakai barang lain.`);
    }
    const cocok = POLA_KODE_OTOMATIS.exec(kode);
    if (cocok?.[1]) await sinkronkanKodeMaster(tx, 'BRG', Number.parseInt(cocok[1], 10));
    return kode;
  }
  // Lewati kode yang kebetulan sudah diketik manual tanpa melalui penghitung.
  for (let i = 0; i < 1000; i++) {
    const baru = await terbitkanKodeMaster(tx, 'BRG');
    if (!(await repo.kodeDipakai(tx, baru))) return baru;
  }
  throw new Error('Gagal menerbitkan kode barang yang belum dipakai');
}

async function pastikanBarcodeBebas(tx: Tx, barcode: string | null, kecualiId?: number) {
  if (barcode !== null && (await repo.barcodeDipakai(tx, barcode, kecualiId))) {
    throw galatKolom('KONFLIK', 'barcode', `Barcode ${barcode} sudah dipakai barang lain.`);
  }
}

/** Kategori, satuan dasar, dan pemasok konsinyasi harus aktif bila baru dipilih. */
async function pastikanReferensiAktif(
  tx: Tx,
  nilai: repo.NilaiBarang,
  lama?: repo.NilaiBarang,
): Promise<void> {
  const status = await repo.statusReferensi(tx, {
    idKategori: nilai.idKategori,
    idSatuan: nilai.idSatuanDasar,
    idPemasok: nilai.idPemasokKonsinyasi,
    idMerk: nilai.idMerk,
  });
  const baruDipilih = (k: 'idKategori' | 'idSatuanDasar' | 'idPemasokKonsinyasi' | 'idMerk') =>
    !lama || lama[k] !== nilai[k];
  if (baruDipilih('idKategori') && status.kategori !== 'AKTIF') {
    throw galatKolom('VALIDASI', 'idKategori', 'Kategori tidak ditemukan atau nonaktif.');
  }
  if (nilai.idMerk !== null && baruDipilih('idMerk') && status.merk !== 'AKTIF') {
    throw galatKolom('VALIDASI', 'idMerk', 'Merk tidak ditemukan atau nonaktif.');
  }
  if (baruDipilih('idSatuanDasar') && status.satuan !== 'AKTIF') {
    throw galatKolom('VALIDASI', 'idSatuanDasar', 'Satuan tidak ditemukan atau nonaktif.');
  }
  if (
    nilai.idPemasokKonsinyasi !== null &&
    baruDipilih('idPemasokKonsinyasi') &&
    status.pemasok !== 'AKTIF'
  ) {
    throw galatKolom('VALIDASI', 'idPemasokKonsinyasi', 'Pemasok tidak ditemukan atau nonaktif.');
  }
}

const POLA_ANGKA_ATRIBUT = /^\d{1,14}(\.\d{1,4})?$/;

/**
 * Atribut dinamis (K-014): TEKS tanpa satuan; ANGKA berdimensi wajib memakai satuan berdimensi sama;
 * ANGKA tanpa dimensi tanpa satuan. Jenis atribut/satuan nonaktif hanya boleh bila sudah dipakai barang ini.
 */
async function siapkanAtribut(
  tx: Tx,
  input: DataBarang['atribut'],
  lama: { idJenis: Set<number>; idSatuan: Set<number> },
): Promise<repo.NilaiAtribut[]> {
  const { jenis, satuan } = await repo.jenisAtributDanSatuan(
    tx,
    input.map((a) => a.idJenisAtribut),
    input.flatMap((a) => (a.idSatuan ? [a.idSatuan] : [])),
  );
  const perJenis = new Map(jenis.map((j) => [j.id, j]));
  const perSatuan = new Map(satuan.map((s) => [s.id, s]));

  return input.map((a, i) => {
    const galat = (kolom: string, pesan: string) =>
      galatKolom('VALIDASI', `atribut.${i}.${kolom}`, pesan);
    const j = perJenis.get(a.idJenisAtribut);
    if (!j) throw galat('idJenisAtribut', 'Jenis atribut tidak ditemukan.');
    if (j.statusAktif !== 'AKTIF' && !lama.idJenis.has(j.id)) {
      throw galat('idJenisAtribut', `Jenis atribut ${j.nama} nonaktif.`);
    }
    const idSatuan = a.idSatuan ?? null;
    if (j.tipeNilai === 'TEKS') {
      if (idSatuan !== null)
        throw galat('idSatuan', `Atribut ${j.nama} berupa teks, tanpa satuan.`);
      return { idJenisAtribut: j.id, nilaiAngka: null, nilaiTeks: a.nilai, idSatuan, urutan: i };
    }

    const angka = a.nilai.replace(',', '.');
    if (!POLA_ANGKA_ATRIBUT.test(angka)) {
      throw galat('nilai', `Nilai ${j.nama} harus angka ≥ 0 dengan maksimal 4 desimal.`);
    }
    if (j.jenisDimensi === null) {
      if (idSatuan !== null) throw galat('idSatuan', `Atribut ${j.nama} tidak memakai satuan.`);
    } else {
      const dimensi = LABEL_JENIS_DIMENSI[j.jenisDimensi].toLowerCase();
      if (idSatuan === null)
        throw galat('idSatuan', `Satuan ${j.nama} wajib dipilih (${dimensi}).`);
      const s = perSatuan.get(idSatuan);
      if (!s) throw galat('idSatuan', 'Satuan tidak ditemukan.');
      if (s.jenisDimensi !== j.jenisDimensi) {
        throw galat(
          'idSatuan',
          `Satuan ${s.kode} bukan satuan ${dimensi}; atribut ${j.nama} butuh satuan ${dimensi}.`,
        );
      }
      if (s.statusAktif !== 'AKTIF' && !lama.idSatuan.has(s.id)) {
        throw galat('idSatuan', `Satuan ${s.kode} nonaktif.`);
      }
    }
    return { idJenisAtribut: j.id, nilaiAngka: angka, nilaiTeks: null, idSatuan, urutan: i };
  });
}

function nilaiDari(
  input: DataBarang,
  kode: string,
  stokMinimum: string,
  hargaOtomatisLama = false,
): repo.NilaiBarang {
  const konsinyasi = input.kepemilikan === 'KONSINYASI';
  return {
    kode,
    barcode: input.barcode ?? null,
    namaBarang: input.namaBarang,
    idKategori: input.idKategori,
    idMerk: input.idMerk ?? null,
    idSatuanDasar: input.idSatuanDasar,
    stokMinimum,
    hargaModalAwal: input.hargaModalAwal,
    kepemilikan: input.kepemilikan,
    idPemasokKonsinyasi: konsinyasi ? (input.idPemasokKonsinyasi ?? null) : null,
    hargaTitip: konsinyasi ? (input.hargaTitip ?? null) : null,
    keterangan: input.keterangan ?? null,
    // Barang baru: tidak otomatis ("ditinjau dulu", K-086).
    hargaOtomatis: input.hargaOtomatis ?? hargaOtomatisLama,
  };
}

function dataDasarDari(
  nilai: repo.NilaiBarang,
  p: { hppRata2: number; hargaBeliTerakhir: number; tanggalBeliTerakhir: string | null },
) {
  return {
    kepemilikan: nilai.kepemilikan,
    hargaModalAwal: nilai.hargaModalAwal,
    hargaTitip: nilai.hargaTitip,
    hppRata2: p.hppRata2,
    hargaBeliTerakhir: p.hargaBeliTerakhir,
    tanggalBeliTerakhir: p.tanggalBeliTerakhir,
  };
}

async function catatLogHarga(
  tx: Tx,
  id: number,
  nama: string,
  perubahan: PerubahanHarga[],
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  if (perubahan.length === 0) return;
  await catatLog(tx, {
    aksi: 'HARGA_UBAH',
    idPengguna: pelaku.id,
    entitas: 'barang',
    idEntitas: id,
    ringkasan: `Harga ${nama}: ${ringkasPerubahanHarga(perubahan)}`,
    dataLama: Object.fromEntries(perubahan.map((p) => [p.tier, p.lama])),
    dataBaru: Object.fromEntries(perubahan.map((p) => [p.tier, p.baru])),
    ip: asal.ip,
  });
}

// --- Mutasi ---

/** Izin menambah barang: form memuat harga modal dan harga tier default wajib diisi. */
export function pastikanBolehTambahBarang(pelaku: PenggunaAktif): void {
  pastikanBolehHpp(pelaku);
  if (!pelaku.izin.has('master.harga.kelola')) {
    throw new AppError('TIDAK_BERIZIN', 'Menambah barang membutuhkan izin mengelola harga.', 403);
  }
}

export type BarangBaru = {
  id: number;
  nilai: repo.NilaiBarang;
  atribut: repo.NilaiAtribut[];
  harga: PerubahanHarga[];
};

/**
 * Inti tambah barang di dalam `tx` (dipakai form dan import Excel): kode, validasi, baris persediaan
 * (L10), atribut, dan harga semua tier (K-047). Tidak mencatat log; pemanggil yang mencatat.
 */
export async function buatBarang(
  tx: Tx,
  input: DataBarang,
  idPengguna: number,
): Promise<BarangBaru> {
  if (!input.hargaTier || input.hargaTier.length === 0) {
    throw galatKolom('VALIDASI', 'hargaTier', 'Harga jual tier default wajib diisi.');
  }
  const stokMinimum = keQty(input.stokMinimum ?? (await ambilAngka('stok_minimum_default', 0, tx)));
  const kode = await tentukanKode(tx, input.kode);
  const nilai = nilaiDari(input, kode, stokMinimum);
  await pastikanBarcodeBebas(tx, nilai.barcode);
  await pastikanReferensiAktif(tx, nilai);
  const atribut = await siapkanAtribut(tx, input.atribut, {
    idJenis: new Set(),
    idSatuan: new Set(),
  });

  const id = await repo.tambahBarang(tx, nilai);
  await buatPersediaan(tx, id, nilai);
  await repo.gantiAtribut(tx, id, atribut);
  const konteks = await muatKonteksHarga(tx);
  const persediaanBaru = await kunciPersediaan(tx, id);
  const harga = await terapkanHargaBarang(tx, id, input.hargaTier, {
    dasar: dasarMarkup(dataDasarDari(nilai, persediaanBaru), konteks.modeDasar),
    konteks,
    idPengguna,
  });
  return { id, nilai, atribut, harga };
}

export async function catatLogBarangBaru(
  tx: Tx,
  b: BarangBaru,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  keterangan = '',
): Promise<void> {
  await catatLog(tx, {
    aksi: 'BARANG_BUAT',
    idPengguna: pelaku.id,
    entitas: 'barang',
    idEntitas: b.id,
    ringkasan: `Menambah barang ${b.nilai.kode} ${b.nilai.namaBarang}${keterangan}`,
    dataBaru: {
      ...b.nilai,
      atribut: b.atribut,
      harga: b.harga.map((p) => ({ tier: p.tier, ...p.baru })),
    },
    ip: asal.ip,
  });
}

export async function tambahBarang(
  input: DataBarang,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailBarang> {
  pastikanBolehTambahBarang(pelaku);
  const id = await dalamTransaksi(async (tx) => {
    const baru = await buatBarang(tx, input, pelaku.id);
    await catatLogBarangBaru(tx, baru, pelaku, asal);
    return baru.id;
  });
  return detailBarang(id, pelaku.izin);
}

export async function ubahBarang(
  id: number,
  input: DataBarang,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailBarang> {
  pastikanBolehHpp(pelaku);
  if (input.hargaTier !== undefined && !pelaku.izin.has('master.harga.kelola')) {
    throw new AppError(
      'TIDAK_BERIZIN',
      'Mengubah harga jual membutuhkan izin mengelola harga.',
      403,
    );
  }

  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciBarang(tx, id);
    if (!lama) throw tidakDitemukan();
    const stok = await kunciPersediaan(tx, id);
    const sudahAdaMutasi = stok.terakhirMutasi !== null;

    const kode = input.kode === undefined || input.kode === lama.kode ? lama.kode : input.kode;
    if (kode !== lama.kode) await tentukanKode(tx, kode, id);
    const nilai = nilaiDari(
      input,
      kode,
      input.stokMinimum ? keQty(input.stokMinimum) : lama.stokMinimum,
      lama.hargaOtomatis,
    );
    if (nilai.hargaOtomatis !== lama.hargaOtomatis && !pelaku.izin.has('master.harga.kelola')) {
      throw new AppError(
        'TIDAK_BERIZIN',
        'Mengubah pilihan harga otomatis membutuhkan izin mengelola harga.',
        403,
      );
    }
    const konteks = await muatKonteksHarga(tx);
    const dasarSebelum = dasarMarkup(dataDasarDari(lama, stok), konteks.modeDasar);
    const beda = selisih(lama, nilai);

    if (beda.kolom.includes('barcode')) await pastikanBarcodeBebas(tx, nilai.barcode, id);
    await pastikanReferensiAktif(tx, nilai, lama);
    if (sudahAdaMutasi && beda.kolom.includes('idSatuanDasar')) {
      throw galatKolom(
        'KONFLIK',
        'idSatuanDasar',
        'Satuan dasar tidak bisa diubah setelah ada mutasi stok.',
      );
    }
    if (sudahAdaMutasi && beda.kolom.includes('hargaModalAwal')) {
      throw galatKolom(
        'KONFLIK',
        'hargaModalAwal',
        'Harga modal awal tidak bisa diubah setelah ada mutasi stok; HPP mengikuti penerimaan.',
      );
    }
    // KS1: kepemilikan dikunci selama masih ada stok (baik maupun rusak).
    const adaStok = bandingQty(stok.stokFisik, 0) > 0 || bandingQty(stok.stokRusak, 0) > 0;
    if (beda.kolom.includes('kepemilikan') && adaStok) {
      throw galatKolom(
        'KONFLIK',
        'kepemilikan',
        'Kepemilikan tidak bisa diubah selama barang masih punya stok.',
      );
    }

    const lamaAtribut = await repo.atributBarang(tx, id);
    const atribut = await siapkanAtribut(tx, input.atribut, {
      idJenis: new Set(lamaAtribut.map((a) => a.idJenisAtribut)),
      idSatuan: new Set(lamaAtribut.flatMap((a) => (a.idSatuan ? [a.idSatuan] : []))),
    });
    const ringkasAtribut = (
      a: { idJenisAtribut: number; nilai: string; idSatuan: number | null }[],
    ) => a.map((x) => `${x.idJenisAtribut}:${x.nilai}:${x.idSatuan ?? ''}`).join('|');
    const atributLamaRingkas = lamaAtribut.map((a) => ({
      idJenisAtribut: a.idJenisAtribut,
      nilai: a.nilaiAngka === null ? (a.nilaiTeks ?? '') : rapikanAngka(a.nilaiAngka),
      idSatuan: a.idSatuan,
    }));
    const atributBaruRingkas = atribut.map((a) => ({
      idJenisAtribut: a.idJenisAtribut,
      nilai: a.nilaiTeks ?? rapikanAngka(a.nilaiAngka ?? '0'),
      idSatuan: a.idSatuan,
    }));
    const atributBerubah =
      ringkasAtribut(atributLamaRingkas) !== ringkasAtribut(atributBaruRingkas);

    const dasarBerubah = ['hargaModalAwal', 'hargaTitip', 'kepemilikan'].some((k) =>
      beda.kolom.includes(k),
    );
    const waktu = sekarang();
    if (beda.kolom.length > 0) await repo.ubahBarang(tx, id, nilai, waktu);
    if (atributBerubah) await repo.gantiAtribut(tx, id, atribut);
    const hpp = dasarBerubah ? await selaraskanHppMaster(tx, id, nilai) : null;
    const dasarSesudah = dasarMarkup(
      dataDasarDari(nilai, await kunciPersediaan(tx, id)),
      konteks.modeDasar,
    );
    const otomatisDinyalakan = nilai.hargaOtomatis && !lama.hargaOtomatis;

    let perubahanHarga: PerubahanHarga[] = [];
    if (input.hargaTier !== undefined) {
      // Harga ikut disimpan: dihitung dengan D terkini dan tanda tinjau lepas (H5, K-060 #4).
      perubahanHarga = await terapkanHargaBarang(tx, id, input.hargaTier, {
        dasar: dasarSesudah,
        konteks,
        idPengguna: pelaku.id,
      });
      if (lama.perluTinjauHarga) await repo.ubahBarang(tx, id, { perluTinjauHarga: false }, waktu);
    } else if (dasarSesudah !== dasarSebelum || otomatisDinyalakan) {
      // H5/H7: tandai perlu tinjau, atau terapkan harga otomatis (K-086).
      await tanggapiPemicuHarga(tx, [id], {
        sebab: otomatisDinyalakan ? 'harga otomatis dinyalakan' : 'dasar harga berubah',
        idPengguna: pelaku.id,
        ip: asal.ip,
      });
    }

    if (beda.kolom.length > 0 || atributBerubah || hpp) {
      await catatLog(tx, {
        aksi: 'BARANG_UBAH',
        idPengguna: pelaku.id,
        entitas: 'barang',
        idEntitas: id,
        ringkasan: `Mengubah barang ${kode} ${nilai.namaBarang}: ${[
          ...beda.kolom,
          ...(atributBerubah ? ['atribut'] : []),
        ].join(', ')}`,
        dataLama: {
          ...beda.dataLama,
          ...(atributBerubah ? { atribut: atributLamaRingkas } : {}),
          ...(hpp ? { persediaan: hpp.lama } : {}),
        },
        dataBaru: {
          ...beda.dataBaru,
          ...(atributBerubah ? { atribut: atributBaruRingkas } : {}),
          ...(hpp ? { persediaan: hpp.baru } : {}),
        },
        ip: asal.ip,
      });
    }
    await catatLogHarga(tx, id, nilai.namaBarang, perubahanHarga, pelaku, asal);
  });
  return detailBarang(id, pelaku.izin);
}

export async function ubahStatusBarang(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailBarang> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciBarang(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahBarang(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'BARANG_AKTIFKAN' : 'BARANG_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'barang',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} barang ${lama.kode} ${lama.namaBarang}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return detailBarang(id, pelaku.izin);
}

// --- Gambar ---

export async function unggahGambar(
  id: number,
  isi: Uint8Array,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailBarang> {
  const nama = await simpanGambar(FOLDER_GAMBAR, String(id), isi);
  let namaLama: string | null = null;
  try {
    await dalamTransaksi(async (tx) => {
      const lama = await repo.kunciBarang(tx, id);
      if (!lama) throw tidakDitemukan();
      namaLama = lama.gambar;
      await repo.ubahBarang(tx, id, { gambar: nama }, sekarang());
      await catatLog(tx, {
        aksi: 'BARANG_UBAH',
        idPengguna: pelaku.id,
        entitas: 'barang',
        idEntitas: id,
        ringkasan: `Mengganti gambar barang ${lama.kode} ${lama.namaBarang}`,
        dataLama: { gambar: lama.gambar },
        dataBaru: { gambar: nama },
        ip: asal.ip,
      });
    });
  } catch (err) {
    await hapusBerkas(FOLDER_GAMBAR, nama);
    throw err;
  }
  await hapusBerkas(FOLDER_GAMBAR, namaLama);
  return detailBarang(id, pelaku.izin);
}

export async function hapusGambar(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailBarang> {
  const namaLama = await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciBarang(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.gambar === null) return null;
    await repo.ubahBarang(tx, id, { gambar: null }, sekarang());
    await catatLog(tx, {
      aksi: 'BARANG_UBAH',
      idPengguna: pelaku.id,
      entitas: 'barang',
      idEntitas: id,
      ringkasan: `Menghapus gambar barang ${lama.kode} ${lama.namaBarang}`,
      dataLama: { gambar: lama.gambar },
      dataBaru: { gambar: null },
      ip: asal.ip,
    });
    return lama.gambar;
  });
  await hapusBerkas(FOLDER_GAMBAR, namaLama);
  return detailBarang(id, pelaku.izin);
}

export async function ambilGambar(id: number) {
  const b = await repo.barangById(db, id);
  if (!b?.gambar) throw new AppError('TIDAK_DITEMUKAN', 'Barang belum punya gambar.', 404);
  const berkas = await bacaGambar(FOLDER_GAMBAR, b.gambar);
  if (!berkas) throw new AppError('TIDAK_DITEMUKAN', 'Berkas gambar tidak ditemukan.', 404);
  return berkas;
}
