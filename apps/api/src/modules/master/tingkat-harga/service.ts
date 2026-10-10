import {
  bandingQty,
  keTeksPersen,
  teksQty,
  type DataTingkatHarga,
  type Izin,
  type StatusAktif,
  type TingkatHarga,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { barangIkutTier } from '../harga/repo';
import { hitungUlangTier, lengkapiHargaTier, tanggapiPemicuHarga } from '../harga/service';
import * as repo from './repo';

/**
 * Tingkat harga (tier, docs/06 H1–H2, H8). Dibaca semua peran: namanya tampil di order dan checkout. Tier
 * dipakai otomatis menurut total nilai belanja transaksi (`min_belanja`, K-098), untuk semua barang; tidak
 * ada tier pilihan manual, sehingga tier aktif selain tier dasar wajib punya syarat belanja (K-099).
 * Markup default hanya untuk pemegang `master.barang.lihat_hpp` karena membuka margin toko (docs/06 H12).
 */

type BarisTier = NonNullable<Awaited<ReturnType<typeof repo.tingkatHargaById>>>;

/**
 * Peringatan susunan tier (K-098) untuk layar Kelola tier: makin besar syarat belanja, markup seharusnya makin
 * kecil. Hanya peringatan, bukan penolakan, karena mengubah dua tier satu per satu melewati susunan antara.
 */
function peringatanSusunan(t: BarisTier, semua: BarisTier[]): string | null {
  if (t.isDefault || t.statusAktif !== 'AKTIF') return null;
  const dasar = semua.find((x) => x.isDefault);
  if (dasar && bandingQty(t.markupDefaultPersen, dasar.markupDefaultPersen) >= 0) {
    return `Markup ${t.nama} tidak lebih kecil dari ${dasar.nama}, sehingga harganya tidak lebih murah.`;
  }
  const min = t.minBelanja;
  if (min === null) return null;
  const lebihMurah = semua.find(
    (x) =>
      !x.isDefault &&
      x.statusAktif === 'AKTIF' &&
      x.minBelanja !== null &&
      x.minBelanja < min &&
      bandingQty(x.markupDefaultPersen, t.markupDefaultPersen) < 0,
  );
  return lebihMurah
    ? `Syarat belanja ${t.nama} lebih besar dari ${lebihMurah.nama}, tetapi markup-nya juga lebih besar: ` +
        'pembeli yang belanja lebih banyak justru membayar lebih mahal.'
    : null;
}

/** Markup dan peringatan susunan membuka margin toko: hanya untuk pemegang `master.barang.lihat_hpp`. */
function keRespons(t: BarisTier, semua: BarisTier[], izin: ReadonlySet<Izin>): TingkatHarga {
  const { markupDefaultPersen, ...b } = t;
  if (!izin.has('master.barang.lihat_hpp')) return b;
  const peringatan = peringatanSusunan(t, semua);
  return { ...b, markupDefaultPersen, ...(peringatan ? { peringatan } : {}) };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Tier harga tidak ditemukan.', 404);
}

async function muat(id: number, izin: ReadonlySet<Izin>): Promise<TingkatHarga> {
  const semua = await repo.daftarTingkatHarga(db);
  const baris = semua.find((t) => t.id === id);
  if (!baris) throw tidakDitemukan();
  return keRespons(baris, semua, izin);
}

async function pastikanKodeBebas(tx: Tx, kode: string, kecualiId?: number): Promise<void> {
  if (await repo.kodeDipakai(tx, kode, kecualiId)) {
    throw galatKolom('kode', `Kode tier ${kode} sudah dipakai.`, 'KONFLIK');
  }
}

/** K-098: tier dasar dipakai semua transaksi yang belum mencapai nilai belanja tier lain. */
function galatBelanjaTierDasar(): AppError {
  const pesan = 'Tier dasar berlaku untuk semua transaksi; kosongkan "mulai belanja".';
  return new AppError('VALIDASI', pesan, 400, { kolom: { minBelanja: [pesan] } });
}

/** K-099: tier selain tier dasar hanya dipakai otomatis, jadi wajib punya syarat belanja. */
function galatBelanjaWajib(nama: string): AppError {
  return galatKolom(
    'minBelanja',
    `Isi "Mulai belanja" tier ${nama}: tier dipakai otomatis saat total belanja mencapai angka itu.`,
  );
}

function nilaiDari(input: DataTingkatHarga): repo.NilaiTingkatHarga {
  return {
    kode: input.kode,
    nama: input.nama,
    markupDefaultPersen: keTeksPersen(input.markupDefaultPersen),
    minBelanja: input.minBelanja,
    urutan: input.urutan,
  };
}

export async function daftarTingkatHarga(izin: ReadonlySet<Izin>): Promise<TingkatHarga[]> {
  const baris = await repo.daftarTingkatHarga(db);
  return baris.map((t) => keRespons(t, baris, izin));
}

/** Tier baru langsung mendapat harga IKUT_TIER untuk semua barang (H2). */
export async function tambahTingkatHarga(
  input: DataTingkatHarga,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TingkatHarga> {
  const id = await dalamTransaksi(async (tx) => {
    const nilai = nilaiDari(input);
    if (nilai.minBelanja === null) throw galatBelanjaWajib(nilai.nama);
    await pastikanKodeBebas(tx, nilai.kode);
    const idBaru = await repo.tambahTingkatHarga(tx, nilai);
    const jumlah = await lengkapiHargaTier(tx, idBaru, nilai.markupDefaultPersen, pelaku.id);
    await catatLog(tx, {
      aksi: 'TIER_BUAT',
      idPengguna: pelaku.id,
      entitas: 'tingkat_harga',
      idEntitas: idBaru,
      ringkasan: `Menambah tier ${nilai.nama} (markup ${nilai.markupDefaultPersen}%) untuk ${jumlah} barang`,
      dataBaru: nilai,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id, pelaku.izin);
}

/**
 * Mengubah markup default memicu H5/H7 untuk barang IKUT_TIER di tier ini: barang biasa ditandai perlu
 * tinjau (harga tidak berubah); barang berharga otomatis langsung naik, atau ditandai bila turun (K-086).
 */
export async function ubahTingkatHarga(
  id: number,
  input: DataTingkatHarga,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TingkatHarga> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciTingkatHarga(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = nilaiDari(input);
    const beda = selisih(
      {
        kode: lama.kode,
        nama: lama.nama,
        markupDefaultPersen: lama.markupDefaultPersen,
        minBelanja: lama.minBelanja,
        urutan: lama.urutan,
      },
      baru,
    );
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('kode')) await pastikanKodeBebas(tx, baru.kode, id);
    if (lama.isDefault && baru.minBelanja !== null) throw galatBelanjaTierDasar();
    // Tier nonaktif (mis. tier lama tanpa syarat) boleh disimpan dulu; syaratnya wajib saat diaktifkan.
    if (!lama.isDefault && baru.minBelanja === null && lama.statusAktif === 'AKTIF') {
      throw galatBelanjaWajib(baru.nama);
    }
    await repo.ubahTingkatHarga(tx, id, baru, sekarang());

    let hasil = { ditandai: 0, diterapkan: 0 };
    if (bandingQty(lama.markupDefaultPersen, baru.markupDefaultPersen) !== 0) {
      hasil = await tanggapiPemicuHarga(tx, await barangIkutTier(tx, id), {
        sebab: `markup tier ${baru.nama} ${teksQty(lama.markupDefaultPersen)}% → ${teksQty(baru.markupDefaultPersen)}%`,
        idPengguna: pelaku.id,
        ip: asal.ip,
        idTier: id,
      });
    }
    await catatLog(tx, {
      aksi: 'TIER_UBAH',
      idPengguna: pelaku.id,
      entitas: 'tingkat_harga',
      idEntitas: id,
      ringkasan:
        `Mengubah tier ${lama.nama}: ${beda.kolom.join(', ')}` +
        (hasil.ditandai > 0 ? `; ${hasil.ditandai} barang ditandai perlu tinjau harga` : '') +
        (hasil.diterapkan > 0 ? `; harga otomatis ${hasil.diterapkan} barang naik` : ''),
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id, pelaku.izin);
}

/**
 * H1: tier dasar tidak bisa dinonaktifkan. Mengaktifkan kembali melengkapi harga barang baru (H2) dan
 * menghitung ulang baris IKUT_TIER/MARKUP lama di tier itu dengan D terkini (K-086).
 */
export async function ubahStatusTingkatHarga(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TingkatHarga> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciTingkatHarga(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    if (statusAktif === 'NONAKTIF' && lama.isDefault) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Tier ${lama.nama} adalah tier dasar dan tidak bisa dinonaktifkan.`,
        409,
      );
    }
    if (statusAktif === 'AKTIF' && !lama.isDefault && lama.minBelanja === null) {
      throw galatBelanjaWajib(lama.nama);
    }
    await repo.ubahTingkatHarga(tx, id, { statusAktif }, sekarang());
    const aktif = statusAktif === 'AKTIF';
    const dilengkapi = aktif
      ? await lengkapiHargaTier(tx, id, lama.markupDefaultPersen, pelaku.id)
      : 0;
    const dihitungUlang = aktif ? await hitungUlangTier(tx, id, pelaku.id) : 0;
    await catatLog(tx, {
      aksi: aktif ? 'TIER_AKTIFKAN' : 'TIER_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'tingkat_harga',
      idEntitas: id,
      ringkasan:
        `${aktif ? 'Mengaktifkan' : 'Menonaktifkan'} tier ${lama.nama}` +
        (dihitungUlang > 0 ? `; ${dihitungUlang} harga dihitung ulang dengan dasar terkini` : ''),
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: {
        statusAktif,
        ...(dilengkapi > 0 ? { barangDiperiksa: dilengkapi } : {}),
        ...(dihitungUlang > 0 ? { hargaDihitungUlang: dihitungUlang } : {}),
      },
      ip: asal.ip,
    });
  });
  return muat(id, pelaku.izin);
}
