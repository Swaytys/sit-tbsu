import {
  bandingQty,
  keQty,
  keTeksPersen,
  teksQty,
  type DataTingkatHarga,
  type Izin,
  type StatusAktif,
  type TingkatHarga,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
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
 * dipakai otomatis menurut qty (`min_qty`, K-097), bukan menurut pelanggan.
 * Markup default hanya untuk pemegang `master.barang.lihat_hpp` karena membuka margin toko (docs/06 H12).
 */

type BarisTier = NonNullable<Awaited<ReturnType<typeof repo.tingkatHargaById>>>;

function keRespons(t: BarisTier, izin: ReadonlySet<Izin>): TingkatHarga {
  const { markupDefaultPersen, ...b } = t;
  return izin.has('master.barang.lihat_hpp') ? { ...b, markupDefaultPersen } : b;
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Tier harga tidak ditemukan.', 404);
}

async function muat(id: number, izin: ReadonlySet<Izin>): Promise<TingkatHarga> {
  const baris = await repo.tingkatHargaById(db, id);
  if (!baris) throw tidakDitemukan();
  return keRespons(baris, izin);
}

async function pastikanKodeBebas(tx: Tx, kode: string, kecualiId?: number): Promise<void> {
  if (await repo.kodeDipakai(tx, kode, kecualiId)) {
    const pesan = `Kode tier ${kode} sudah dipakai.`;
    throw new AppError('KONFLIK', pesan, 409, { kolom: { kode: [pesan] } });
  }
}

/** K-097: tier default dipakai semua pembeli yang belum memenuhi syarat qty tier lain. */
function galatMinQtyDefault(): AppError {
  const pesan = 'Tier default berlaku untuk semua qty; kosongkan "mulai qty".';
  return new AppError('VALIDASI', pesan, 400, { kolom: { minQty: [pesan] } });
}

function nilaiDari(input: DataTingkatHarga): repo.NilaiTingkatHarga {
  return {
    kode: input.kode,
    nama: input.nama,
    markupDefaultPersen: keTeksPersen(input.markupDefaultPersen),
    minQty: input.minQty === null ? null : keQty(input.minQty),
    urutan: input.urutan,
  };
}

export async function daftarTingkatHarga(izin: ReadonlySet<Izin>): Promise<TingkatHarga[]> {
  const baris = await repo.daftarTingkatHarga(db);
  return baris.map((t) => keRespons(t, izin));
}

/** Tier baru langsung mendapat harga IKUT_TIER untuk semua barang (H2). */
export async function tambahTingkatHarga(
  input: DataTingkatHarga,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TingkatHarga> {
  const id = await dalamTransaksi(async (tx) => {
    const nilai = nilaiDari(input);
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
        minQty: lama.minQty,
        urutan: lama.urutan,
      },
      baru,
    );
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('kode')) await pastikanKodeBebas(tx, baru.kode, id);
    if (lama.isDefault && baru.minQty !== null) throw galatMinQtyDefault();
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
 * H1: tier default tidak bisa dinonaktifkan. Mengaktifkan kembali melengkapi harga barang baru (H2) dan
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
        `Tier ${lama.nama} adalah tier default dan tidak bisa dinonaktifkan.`,
        409,
      );
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
