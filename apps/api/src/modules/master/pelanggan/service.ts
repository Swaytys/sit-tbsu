import { createHash } from 'node:crypto';
import { pelanggan } from '../../../db/schema';
import {
  formatRupiah,
  type BawaanPelanggan,
  type DataKodePersetujuan,
  type DataMintaKodePelanggan,
  type DataPelanggan,
  type InfoKodePersetujuan,
  type Izin,
  type MetaHalaman,
  type Pelanggan,
  type PosisiKreditPelanggan,
  type StatusAktif,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import { ambilVersi, pastikanVersi } from '../../../lib/versi';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import {
  mintaKode,
  pakaiKode,
  periksaKode,
  type KodeSah,
} from '../../sistem/kode-persetujuan/service';
import { ambilAngka, ambilTeks, invalidasiKonfigurasi } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { simpanKonfigurasi } from '../../sistem/pengaturan/repo';
import { terbitkanKodeMaster } from '../../sistem/penomoran';
import { golonganById } from '../golongan-pelanggan/repo';
import * as repo from './repo';
import { pastikanTidakMirip } from '../mirip';

/** Pelanggan (docs/03 §3.2). Kode `PLG-00001` tetap (N5). Tidak dihapus; dinonaktifkan (K-021). */

type BarisPelanggan = NonNullable<Awaited<ReturnType<typeof repo.pelangganById>>>;
type NilaiKredit = Pick<repo.NilaiPelanggan, 'idGolongan' | 'termHari' | 'limitKredit'>;

type BarisKredit = Awaited<ReturnType<typeof repo.posisiKreditBanyak>>[number];

const MS_PER_HARI = 24 * 60 * 60 * 1000;

/** Selisih hari kalender dari `hariIni` ke `tanggal` (keduanya `YYYY-MM-DD`); negatif = sudah lewat. */
function hariMenuju(tanggal: string, hariIni: string): number {
  return Math.round(
    (Date.parse(`${tanggal}T00:00:00Z`) - Date.parse(`${hariIni}T00:00:00Z`)) / MS_PER_HARI,
  );
}

function posisiKredit(
  limitKredit: number | null,
  k: BarisKredit | undefined,
  hariIni: string,
): PosisiKreditPelanggan {
  const piutang = k?.piutang ?? 0;
  const jatuhTempo = k?.jatuhTempoTerdekat ?? null;
  return {
    piutang,
    jumlahNota: k?.jumlahNota ?? 0,
    sisaLimit: limitKredit === null ? null : limitKredit - piutang,
    jatuhTempoTerdekat: jatuhTempo,
    hariKeJatuhTempo: jatuhTempo === null ? null : hariMenuju(jatuhTempo, hariIni),
    piutangTerlambat: k?.piutangTerlambat ?? 0,
  };
}

/** Baris pelanggan + posisi kreditnya (dihitung dari penjualan yang belum lunas). */
async function keRespons(ex: Executor, baris: BarisPelanggan[]): Promise<Pelanggan[]> {
  const hariIni = tanggalOperasional();
  const kredit = new Map(
    (
      await repo.posisiKreditBanyak(
        ex,
        baris.map((b) => b.id),
        hariIni,
      )
    ).map((k) => [k.idPelanggan, k]),
  );
  return baris.map(({ diubahPada, ...b }) => ({
    ...b,
    dibuatPada: b.dibuatPada.toISOString(),
    versi: (diubahPada ?? b.dibuatPada).toISOString(),
    kredit: posisiKredit(b.limitKredit, kredit.get(b.id), hariIni),
  }));
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Pelanggan tidak ditemukan.', 404);
}

async function muat(id: number): Promise<Pelanggan> {
  const baris = await repo.pelangganById(db, id);
  if (!baris) throw tidakDitemukan();
  const [hasil] = await keRespons(db, [baris]);
  if (!hasil) throw tidakDitemukan();
  return hasil;
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
  return { data: await keRespons(db, baris), meta: metaHalaman(total, p) };
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

      await pastikanTidakMirip(
        tx,
        'pelanggan',
        { nama: input.namaPelanggan, noHp: input.noHp },
        input.abaikanMirip,
      );
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

// --- K-107: perubahan oleh pengguna tanpa `master.pelanggan.atur_kredit` butuh kode atasan ---

const IZIN_ATASAN: Izin = 'master.pelanggan.atur_kredit';

const LABEL_KOLOM: Record<string, string> = {
  namaPelanggan: 'Nama',
  noHp: 'No. HP',
  email: 'Email',
  alamat: 'Alamat',
  keterangan: 'Keterangan',
};

type Perubahan =
  | { aksi: 'UBAH'; data: ReturnType<typeof dataKontak> }
  | { aksi: 'STATUS'; statusAktif: StatusAktif };

/**
 * Sidik satu perubahan: kode atasan hanya berlaku untuk pelanggan dan isian yang persis sama dengan yang
 * tertulis di pesan untuk atasan, sehingga kode tidak bisa dipakai untuk perubahan lain.
 */
function sidikPerubahan(id: number, p: Perubahan): string {
  const isi =
    p.aksi === 'UBAH'
      ? [
          'UBAH',
          id,
          p.data.namaPelanggan,
          p.data.noHp,
          p.data.email,
          p.data.alamat,
          p.data.keterangan,
        ]
      : ['STATUS', id, p.statusAktif];
  return createHash('sha256').update(JSON.stringify(isi)).digest('hex');
}

function butuhKode(): AppError {
  return new AppError(
    'TIDAK_BERIZIN',
    'Mengubah atau menonaktifkan pelanggan yang sudah ada butuh kode persetujuan Admin/Owner.',
    403,
  );
}

/** Memeriksa kode atasan untuk `perubahan` (di transaksinya sendiri, agar salah ketik tetap terhitung). */
async function kodeSahUntuk(
  id: number,
  perubahan: Perubahan,
  kode: DataKodePersetujuan | null,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<KodeSah> {
  if (!kode) throw butuhKode();
  const sidik = sidikPerubahan(id, perubahan);
  return periksaKode(
    {
      idPermintaan: kode.idPermintaan,
      kode: kode.kode,
      jenis: 'UBAH_PELANGGAN',
      izin: IZIN_ATASAN,
      pengaju: pelaku,
      cocok: (m) => m.idPelanggan === id && m.sidik === sidik,
    },
    asal,
  );
}

/**
 * Mengirim kode sekali pakai ke Admin/Owner untuk satu perubahan data atau status pelanggan (K-107). Isi
 * pesan disusun dari data di database dan isian yang akan disimpan, karena itulah yang dibaca atasan.
 */
export async function mintaKodePelanggan(
  id: number,
  input: DataMintaKodePelanggan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<InfoKodePersetujuan> {
  const kini = await muat(id);
  let perubahan: Perubahan;
  let ringkasan: string;
  const siapa = `${kini.kode} ${kini.namaPelanggan}`;
  if (input.aksi === 'UBAH') {
    // Golongan, term, dan limit tidak ikut: tanpa izin atur kredit, kolom itu memang tidak bisa diubah.
    const data = dataKontak(input.data);
    const beda = selisih(kini, data);
    if (beda.kolom.length === 0) {
      throw new AppError('VALIDASI', 'Tidak ada data yang berubah, jadi tidak perlu kode.', 400);
    }
    perubahan = { aksi: 'UBAH', data };
    ringkasan =
      `Ubah data pelanggan ${siapa}:\n` +
      beda.kolom
        .map((k) => {
          const dulu = beda.dataLama[k];
          const jadi = beda.dataBaru[k];
          const teks = (v: unknown) => (typeof v === 'string' && v !== '' ? v : '(kosong)');
          return `- ${LABEL_KOLOM[k] ?? k}: ${teks(dulu)} -> ${teks(jadi)}`;
        })
        .join('\n');
  } else {
    if (kini.statusAktif === input.statusAktif) {
      throw new AppError('VALIDASI', 'Status pelanggan sudah seperti itu.', 400);
    }
    perubahan = { aksi: 'STATUS', statusAktif: input.statusAktif };
    ringkasan =
      `${input.statusAktif === 'AKTIF' ? 'Aktifkan kembali' : 'Nonaktifkan'} pelanggan ${siapa}.\n` +
      `Piutang berjalan: ${formatRupiah(kini.kredit.piutang)} (${kini.kredit.jumlahNota} nota).`;
  }
  return mintaKode(
    {
      jenis: 'UBAH_PELANGGAN',
      izin: IZIN_ATASAN,
      pengaju: pelaku,
      rujukan: { idPelanggan: id },
      idEntitas: id,
      nomorDokumen: null,
      nilai: 0,
      ringkasan,
      sidik: sidikPerubahan(id, perubahan),
    },
    asal,
  );
}

export async function ubahPelanggan(
  id: number,
  input: DataPelanggan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  kode: DataKodePersetujuan | null = null,
): Promise<Pelanggan> {
  const langsung = pelaku.izin.has(IZIN_ATASAN);
  // K-107: tanpa izin atasan, perubahan nyata harus disertai kode yang sah untuk isian yang sama.
  let sah: KodeSah | null = null;
  if (!langsung) {
    const kini = await repo.pelangganById(db, id);
    if (!kini) throw tidakDitemukan();
    const data = dataKontak(input);
    if (selisih(kini, data).kolom.length > 0) {
      sah = await kodeSahUntuk(id, { aksi: 'UBAH', data }, kode, pelaku, asal);
    }
  }
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPelanggan(tx, id);
    if (!lama) throw tidakDitemukan();
    pastikanVersi(
      input.versi,
      await ambilVersi(tx, pelanggan, id),
      `Pelanggan ${lama.namaPelanggan}`,
    );
    const kredit = tentukanKredit(input, lama, pelaku.izin);
    if (kredit.idGolongan !== lama.idGolongan) {
      await pastikanGolonganAktif(tx, kredit.idGolongan);
    }

    const baru = { ...dataKontak(input), ...kredit };
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('namaPelanggan') || beda.kolom.includes('noHp')) {
      await pastikanTidakMirip(
        tx,
        'pelanggan',
        { nama: input.namaPelanggan, noHp: input.noHp },
        input.abaikanMirip,
        id,
      );
    }
    if (!langsung) {
      // Data berubah di antara pemeriksaan dan penguncian: kodenya tidak lagi untuk keadaan ini.
      if (!sah) throw butuhKode();
      await pakaiKode(tx, sah);
    }
    await repo.ubahPelanggan(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'PELANGGAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pelanggan',
      idEntitas: id,
      ringkasan:
        `Mengubah pelanggan ${lama.namaPelanggan}: ${beda.kolom.join(', ')}` +
        (sah ? ` (disetujui ${sah.atasan.namaPengguna} lewat kode)` : ''),
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
  kode: DataKodePersetujuan | null = null,
): Promise<Pelanggan> {
  const langsung = pelaku.izin.has(IZIN_ATASAN);
  let sah: KodeSah | null = null;
  if (!langsung) {
    const kini = await repo.pelangganById(db, id);
    if (!kini) throw tidakDitemukan();
    if (kini.statusAktif !== statusAktif) {
      sah = await kodeSahUntuk(id, { aksi: 'STATUS', statusAktif }, kode, pelaku, asal);
    }
  }
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciPelanggan(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    if (!langsung) {
      if (!sah) throw butuhKode();
      await pakaiKode(tx, sah);
    }
    await repo.ubahPelanggan(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'PELANGGAN_AKTIFKAN' : 'PELANGGAN_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'pelanggan',
      idEntitas: id,
      ringkasan:
        `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} pelanggan ${lama.namaPelanggan}` +
        (sah ? ` (disetujui ${sah.atasan.namaPengguna} lewat kode)` : ''),
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
