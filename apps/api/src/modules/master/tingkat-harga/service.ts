import {
  bandingQty,
  keQty,
  keTeksPersen,
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
import { tandaiTinjauUntukTier } from '../harga/repo';
import { lengkapiHargaTier } from '../harga/service';
import * as repo from './repo';

/**
 * Tingkat harga (tier, docs/06 H1–H2). Dibaca semua peran: namanya tampil di pelanggan, order, dan checkout.
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

function nilaiDari(input: DataTingkatHarga): repo.NilaiTingkatHarga {
  return {
    kode: input.kode,
    nama: input.nama,
    markupDefaultPersen: keTeksPersen(input.markupDefaultPersen),
    saranMinQty: input.saranMinQty === null ? null : keQty(input.saranMinQty),
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

/** Mengubah markup default menandai barang IKUT_TIER di tier ini untuk ditinjau (H5); harga tidak berubah. */
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
        saranMinQty: lama.saranMinQty,
        urutan: lama.urutan,
      },
      baru,
    );
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('kode')) await pastikanKodeBebas(tx, baru.kode, id);
    await repo.ubahTingkatHarga(tx, id, baru, sekarang());

    let ditandai = 0;
    if (bandingQty(lama.markupDefaultPersen, baru.markupDefaultPersen) !== 0) {
      ditandai = await tandaiTinjauUntukTier(tx, id);
    }
    await catatLog(tx, {
      aksi: 'TIER_UBAH',
      idPengguna: pelaku.id,
      entitas: 'tingkat_harga',
      idEntitas: id,
      ringkasan:
        `Mengubah tier ${lama.nama}: ${beda.kolom.join(', ')}` +
        (ditandai > 0 ? `; ${ditandai} barang ditandai perlu tinjau harga` : ''),
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id, pelaku.izin);
}

/** H1: tier default tidak bisa dinonaktifkan. Mengaktifkan kembali melengkapi harga barang baru (H2). */
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
    const dilengkapi =
      statusAktif === 'AKTIF'
        ? await lengkapiHargaTier(tx, id, lama.markupDefaultPersen, pelaku.id)
        : 0;
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'TIER_AKTIFKAN' : 'TIER_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'tingkat_harga',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} tier ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif, ...(dilengkapi > 0 ? { barangDiperiksa: dilengkapi } : {}) },
      ip: asal.ip,
    });
  });
  return muat(id, pelaku.izin);
}
