import type {
  BawaanPelanggan,
  DataPelanggan,
  Izin,
  MetaHalaman,
  Pelanggan,
  StatusAktif,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { ambilAngka, ambilTeks, invalidasiKonfigurasi } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { simpanKonfigurasi } from '../../sistem/pengaturan/repo';
import { terbitkanKodeMaster } from '../../sistem/penomoran';
import { golonganById } from '../golongan-pelanggan/repo';
import * as repo from './repo';

/** Pelanggan (docs/03 §3.2). Kode `PLG-00001` tetap (N5). Tidak dihapus; dinonaktifkan (K-021). */

type BarisPelanggan = NonNullable<Awaited<ReturnType<typeof repo.pelangganById>>>;
type NilaiKredit = Pick<repo.NilaiPelanggan, 'idGolongan' | 'termHari' | 'limitKredit'>;

function keRespons(b: BarisPelanggan): Pelanggan {
  return { ...b, dibuatPada: b.dibuatPada.toISOString() };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Pelanggan tidak ditemukan.', 404);
}

async function muat(id: number): Promise<Pelanggan> {
  const baris = await repo.pelangganById(db, id);
  if (!baris) throw tidakDitemukan();
  return keRespons(baris);
}

/**
 * Golongan (K-097), term, dan limit kredit akhir: dari input bila dikirim, selain itu dari `dasar` (bawaan toko
 * untuk pelanggan baru, nilai lama untuk ubah data). Tanpa izin `master.pelanggan.atur_kredit` nilainya tidak
 * boleh berbeda dari `dasar` (K-059).
 */
function tentukanKredit(
  input: DataPelanggan,
  dasar: NilaiKredit,
  izin: ReadonlySet<Izin>,
): NilaiKredit {
  const hasil: NilaiKredit = {
    idGolongan: input.idGolongan === undefined ? dasar.idGolongan : input.idGolongan,
    termHari: input.termHari ?? dasar.termHari,
    limitKredit: input.limitKredit === undefined ? dasar.limitKredit : input.limitKredit,
  };
  const berubah =
    hasil.idGolongan !== dasar.idGolongan ||
    hasil.termHari !== dasar.termHari ||
    hasil.limitKredit !== dasar.limitKredit;
  if (berubah && !izin.has('master.pelanggan.atur_kredit')) {
    throw new AppError(
      'TIDAK_BERIZIN',
      'Golongan, term, dan limit kredit pelanggan hanya bisa diatur Admin atau Owner.',
      403,
    );
  }
  return hasil;
}

async function pastikanGolonganAktif(tx: Tx, id: number | null): Promise<void> {
  if (id === null || (await golonganById(tx, id))?.statusAktif === 'AKTIF') return;
  throw galatKolom('idGolongan', 'Golongan pelanggan tidak ditemukan atau sudah nonaktif.');
}

function dataKontak(input: DataPelanggan) {
  return {
    namaPelanggan: input.namaPelanggan,
    noHp: input.noHp,
    email: input.email ?? null,
    alamat: input.alamat ?? null,
    keterangan: input.keterangan ?? null,
  };
}

export async function daftarPelanggan(p: {
  cari?: string | undefined;
  status: StatusAktif | 'SEMUA';
  halaman: number;
  perHalaman: number;
}): Promise<{ data: Pelanggan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPelanggan(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

const KUNCI_LIMIT_BAWAAN = 'limit_kredit_default';

/** Term dan limit kredit yang diisikan untuk pelanggan baru; limit kosong di konfigurasi = tanpa limit. */
export async function bawaanPelanggan(ex: Executor = db): Promise<BawaanPelanggan> {
  const limit = (await ambilTeks(KUNCI_LIMIT_BAWAAN, '', ex)).trim();
  return {
    termHari: await ambilAngka('term_hari_default', 0, ex),
    limitKredit: /^\d+$/.test(limit) ? Number(limit) : null,
  };
}

export async function tambahPelanggan(
  input: DataPelanggan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pelanggan> {
  let bawaanBerubah = false;
  try {
    const id = await dalamTransaksi(async (tx) => {
      const dasar = await bawaanPelanggan(tx);
      const kredit = tentukanKredit(input, { idGolongan: null, ...dasar }, pelaku.izin);
      await pastikanGolonganAktif(tx, kredit.idGolongan);

      // K-104: limit isian ini menjadi bawaan pelanggan berikutnya (kosong = tanpa limit).
      if (input.jadikanLimitBawaan && kredit.limitKredit !== dasar.limitKredit) {
        const nilai = kredit.limitKredit === null ? '' : String(kredit.limitKredit);
        await simpanKonfigurasi(tx, { kode: KUNCI_LIMIT_BAWAAN, nilai, tipe: 'ANGKA' }, sekarang());
        bawaanBerubah = true;
        await catatLog(tx, {
          aksi: 'PENGATURAN_UBAH',
          idPengguna: pelaku.id,
          entitas: 'konfigurasi',
          ringkasan: `Mengubah pengaturan: ${KUNCI_LIMIT_BAWAAN} (dari form tambah pelanggan)`,
          dataLama: { [KUNCI_LIMIT_BAWAAN]: dasar.limitKredit },
          dataBaru: { [KUNCI_LIMIT_BAWAAN]: kredit.limitKredit },
          ip: asal.ip,
        });
      }

      const nilai = { ...dataKontak(input), ...kredit, kode: await terbitkanKodeMaster(tx, 'PLG') };
      const idBaru = await repo.tambahPelanggan(tx, nilai);
      await catatLog(tx, {
        aksi: 'PELANGGAN_BUAT',
        idPengguna: pelaku.id,
        entitas: 'pelanggan',
        idEntitas: idBaru,
        ringkasan: `Menambah pelanggan ${nilai.kode} ${nilai.namaPelanggan}`,
        dataBaru: nilai,
        ip: asal.ip,
      });
      return idBaru;
    });
    return await muat(id);
  } finally {
    // Cache konfigurasi dibuang juga bila transaksi batal (isi cache tidak boleh mendahului database).
    if (bawaanBerubah) invalidasiKonfigurasi();
  }
}

export async function ubahPelanggan(
  id: number,
  input: DataPelanggan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pelanggan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPelanggan(tx, id);
    if (!lama) throw tidakDitemukan();
    const kredit = tentukanKredit(input, lama, pelaku.izin);
    if (kredit.idGolongan !== lama.idGolongan) {
      await pastikanGolonganAktif(tx, kredit.idGolongan);
    }

    const baru = { ...dataKontak(input), ...kredit };
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    await repo.ubahPelanggan(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'PELANGGAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pelanggan',
      idEntitas: id,
      ringkasan: `Mengubah pelanggan ${lama.namaPelanggan}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusPelanggan(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pelanggan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPelanggan(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahPelanggan(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'PELANGGAN_AKTIFKAN' : 'PELANGGAN_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'pelanggan',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} pelanggan ${lama.namaPelanggan}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
