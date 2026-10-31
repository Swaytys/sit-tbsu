import {
  JENIS_USAHA,
  LANGKAH_SETUP_LANJUT,
  LAYANAN_TOKO,
  type DataUsaha,
  type LangkahSetupLanjut,
  type LayananToko,
  type OperasionalAwal,
  type StatusPenyiapan,
  type StatusSetupAwal,
  type TipeKonfigurasi,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { db, type Tx } from '../../../db/client';
import { konfigurasi } from '../../../db/schema';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import * as authRepo from '../../auth/repo';
import { invalidasiKonfigurasi, semuaNilai } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import * as pengaturanRepo from '../pengaturan/repo';

/*
 * K-205: setup awal pemakaian pertama. Data usaha dan operasional disimpan ke konfigurasi yang sama dengan
 * Pengaturan (bukan tabel baru), sehingga mengulang setup = mengubah pengaturan yang sama. Kemajuan disimpan di
 * konfigurasi `setup_awal` (JSON). Instalasi lama yang belum punya kunci itu dianggap sudah selesai: setup awal
 * hanya diwajibkan untuk akun Owner yang dibuat lewat rute setup awal.
 */

const KODE_SETUP = 'setup_awal';

type CatatanSetup = { selesai: boolean; dilewati: LangkahSetupLanjut[] };

function bacaCatatan(teks: string | null | undefined): CatatanSetup {
  if (teks == null) return { selesai: true, dilewati: [] };
  try {
    const o = JSON.parse(teks) as Partial<CatatanSetup>;
    return {
      selesai: o.selesai === true,
      dilewati: (o.dilewati ?? []).filter((l): l is LangkahSetupLanjut =>
        (LANGKAH_SETUP_LANJUT as readonly string[]).includes(l),
      ),
    };
  } catch {
    return { selesai: true, dilewati: [] };
  }
}

function layananDari(teks: string | null | undefined): LayananToko[] {
  const daftar = (teks ?? 'LANGSUNG,ORDER,ANTAR')
    .split(',')
    .filter((l): l is LayananToko => (LAYANAN_TOKO as readonly string[]).includes(l));
  return daftar.length > 0 ? daftar : ['LANGSUNG'];
}

function entri(
  usaha: DataUsaha,
  operasional: OperasionalAwal,
): { kode: string; nilai: string; tipe: TipeKonfigurasi }[] {
  const t = (kode: string, nilai: string) => ({ kode, nilai, tipe: 'TEKS' as const });
  return [
    t('jenis_usaha', usaha.jenisUsaha),
    t('jenis_usaha_lain', usaha.jenisUsaha === 'LAINNYA' ? usaha.jenisUsahaLain : ''),
    t('nama_toko', usaha.namaToko),
    t('nama_badan_usaha', usaha.namaBadanUsaha),
    t('slogan_toko', usaha.sloganToko),
    t('alamat_toko', usaha.alamatToko),
    t('kota_toko', usaha.kotaToko),
    t('telp_toko', usaha.telpToko),
    t('email_toko', usaha.emailToko),
    t('layanan_toko', operasional.layanan.join(',')),
    t('shift_jam_buka', operasional.shiftJamBuka),
    t('shift_jam_tutup', operasional.shiftJamTutup),
  ];
}

/** Menyimpan data usaha + operasional di transaksi pemanggil. */
export async function simpanDataUsaha(
  tx: Tx,
  usaha: DataUsaha,
  operasional: OperasionalAwal,
): Promise<void> {
  const waktu = sekarang();
  for (const e of entri(usaha, operasional)) await pengaturanRepo.simpanKonfigurasi(tx, e, waktu);
  // Langkah "Profil toko" panduan penyiapan (K-168) dianggap sudah diperiksa: datanya baru diisi pemilik.
  const [baris] = await tx
    .select({ nilai: konfigurasi.nilai })
    .from(konfigurasi)
    .where(eq(konfigurasi.kode, 'penyiapan_ditandai'));
  let ditandai: string[];
  try {
    ditandai = JSON.parse(baris?.nilai ?? '[]') as string[];
  } catch {
    ditandai = [];
  }
  if (!ditandai.includes('PROFIL')) {
    await pengaturanRepo.simpanKonfigurasi(
      tx,
      { kode: 'penyiapan_ditandai', nilai: JSON.stringify([...ditandai, 'PROFIL']), tipe: 'TEKS' },
      waktu,
    );
  }
}

/** Menandai setup awal baru dimulai (dipanggil saat akun Owner pertama dibuat lewat setup awal). */
export async function mulaiCatatanSetup(tx: Tx): Promise<void> {
  await pengaturanRepo.simpanKonfigurasi(
    tx,
    { kode: KODE_SETUP, nilai: JSON.stringify({ selesai: false, dilewati: [] }), tipe: 'TEKS' },
    sekarang(),
  );
}

/** Rute publik: halaman masuk perlu tahu apakah ada pengguna dan identitas usaha untuk ditampilkan. */
export async function statusPenyiapan(): Promise<StatusPenyiapan> {
  const m = await semuaNilai();
  const ada = (await authRepo.jumlahPengguna(db)) > 0;
  return {
    perluAkunPertama: !ada,
    namaToko: ada ? (m.get('nama_toko') ?? '') : '',
    sloganToko: ada ? (m.get('slogan_toko') ?? '') : '',
    kotaToko: ada ? (m.get('kota_toko') ?? '') : '',
  };
}

export async function bacaSetupAwal(): Promise<StatusSetupAwal> {
  const m = await semuaNilai();
  const c = bacaCatatan(m.get(KODE_SETUP));
  const jenis = m.get('jenis_usaha');
  return {
    selesai: c.selesai,
    dilewati: c.dilewati,
    usaha: {
      jenisUsaha: JENIS_USAHA.find((j) => j === jenis) ?? 'BAHAN_BANGUNAN',
      jenisUsahaLain: m.get('jenis_usaha_lain') ?? '',
      namaToko: m.get('nama_toko') ?? '',
      namaBadanUsaha: m.get('nama_badan_usaha') ?? '',
      sloganToko: m.get('slogan_toko') ?? '',
      alamatToko: m.get('alamat_toko') ?? '',
      kotaToko: m.get('kota_toko') ?? '',
      telpToko: m.get('telp_toko') ?? '',
      emailToko: m.get('email_toko') ?? '',
    },
    operasional: {
      layanan: layananDari(m.get('layanan_toko')),
      shiftJamBuka: m.get('shift_jam_buka') ?? '',
      shiftJamTutup: m.get('shift_jam_tutup') ?? '',
    },
  };
}

/** Mengulang setup awal dari Pengaturan: data usaha + operasional diubah, setup ditandai belum selesai. */
export async function ubahDataUsaha(
  input: { usaha: DataUsaha; operasional: OperasionalAwal },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<StatusSetupAwal> {
  await dalamTransaksi(async (tx) => {
    await simpanDataUsaha(tx, input.usaha, input.operasional);
    await catatLog(tx, {
      aksi: 'SETUP_AWAL_USAHA',
      idPengguna: pelaku.id,
      entitas: 'konfigurasi',
      ringkasan: `Data usaha diperbarui lewat setup awal: ${input.usaha.namaToko}`,
      dataBaru: { ...input.usaha, layanan: input.operasional.layanan },
      ip: asal.ip,
    });
  });
  invalidasiKonfigurasi();
  return bacaSetupAwal();
}

/** Langkah terakhir: setup awal selesai; langkah yang dilewati diingatkan di Dashboard. */
export async function selesaiSetupAwal(
  dilewati: LangkahSetupLanjut[],
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<StatusSetupAwal> {
  await dalamTransaksi(async (tx) => {
    await pengaturanRepo.simpanKonfigurasi(
      tx,
      { kode: KODE_SETUP, nilai: JSON.stringify({ selesai: true, dilewati }), tipe: 'TEKS' },
      sekarang(),
    );
    await catatLog(tx, {
      aksi: 'SETUP_AWAL_SELESAI',
      idPengguna: pelaku.id,
      entitas: 'konfigurasi',
      ringkasan:
        dilewati.length > 0
          ? `Setup awal selesai; diatur nanti: ${dilewati.join(', ')}`
          : 'Setup awal selesai',
      ip: asal.ip,
    });
  });
  invalidasiKonfigurasi();
  return bacaSetupAwal();
}
