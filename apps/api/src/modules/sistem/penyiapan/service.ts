import {
  JENIS_CONTOH,
  skemaBarang,
  skemaKendaraan,
  skemaPelanggan,
  skemaPemasok,
  skemaSopir,
  type HasilContoh,
  type JenisContoh,
  type LangkahPenyiapan,
  type PanduanPenyiapan,
} from '@sit/shared';
import { and, count, eq, inArray, notInArray, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '../../../db/client';
import {
  barang,
  kategori,
  kendaraan,
  pelanggan,
  pemasok,
  pengguna,
  penyesuaianStok,
  rekeningToko,
  satuan,
  sopir,
  tingkatHarga,
} from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import {
  tambahKendaraan,
  tambahSopir,
  ubahStatusKendaraan,
  ubahStatusSopir,
} from '../../master/armada/service';
import { tambahBarang, ubahStatusBarang } from '../../master/barang/service';
import { tambahPelanggan, ubahStatusPelanggan } from '../../master/pelanggan/service';
import { tambahPemasok, ubahStatusPemasok } from '../../master/pemasok/service';
import { ambilTeks, invalidasiKonfigurasi } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import * as pengaturanRepo from '../pengaturan/repo';
import {
  CONTOH_BARANG,
  CONTOH_KENDARAAN,
  CONTOH_PELANGGAN,
  CONTOH_PEMASOK,
  CONTOH_SOPIR,
  TANDA_CONTOH,
} from './contoh';

/*
 * K-168: panduan penyiapan pertama (Owner/Admin). Status langkah dihitung dari data asli (contoh tidak dihitung).
 * Id contoh disimpan di konfigurasi `contoh_data` agar bisa dinonaktifkan sekali klik.
 */

const KODE_CONTOH = 'contoh_data';
const KODE_DITANDAI = 'penyiapan_ditandai';
const KODE_SEMBUNYI = 'penyiapan_disembunyikan';

type CatatanContoh = {
  BARANG: number[];
  PELANGGAN: number[];
  PEMASOK: number[];
  KENDARAAN: number[];
  SOPIR: number[];
};

const KOSONG: CatatanContoh = { BARANG: [], PELANGGAN: [], PEMASOK: [], KENDARAAN: [], SOPIR: [] };

function baca<T extends object>(teks: string, bawaan: T): T {
  try {
    return { ...bawaan, ...(JSON.parse(teks) as T) };
  } catch {
    return bawaan;
  }
}

/** Daftar langkah yang ditandai manual (konfigurasi JSON berisi array teks). */
async function langkahDitandai(): Promise<string[]> {
  try {
    const v: unknown = JSON.parse(await ambilTeks(KODE_DITANDAI, '[]'));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function catatanContoh(): Promise<CatatanContoh> {
  return baca(await ambilTeks(KODE_CONTOH, '{}'), KOSONG);
}

async function simpan(kode: string, nilai: string, tipe: 'JSON' | 'BOOL'): Promise<void> {
  try {
    await dalamTransaksi((tx) =>
      pengaturanRepo.simpanKonfigurasi(tx, { kode, nilai, tipe }, sekarang()),
    );
  } finally {
    invalidasiKonfigurasi();
  }
}

/** Jumlah baris aktif di `tabel`, tanpa id contoh. */
async function jumlahAsli(
  tabel: PgTable,
  kolom: { id: PgColumn; statusAktif: PgColumn },
  kecuali: number[],
  tambahan?: SQL,
): Promise<number> {
  const [b] = await db
    .select({ n: count() })
    .from(tabel)
    .where(
      and(
        eq(kolom.statusAktif, 'AKTIF'),
        kecuali.length > 0 ? notInArray(kolom.id, kecuali) : undefined,
        tambahan,
      ),
    );
  return b?.n ?? 0;
}

async function jumlahAktif(
  tabel: PgTable,
  kolom: { id: PgColumn; statusAktif: PgColumn },
  id: number[],
) {
  if (id.length === 0) return 0;
  const [b] = await db
    .select({ n: count() })
    .from(tabel)
    .where(and(eq(kolom.statusAktif, 'AKTIF'), inArray(kolom.id, id)));
  return b?.n ?? 0;
}

export async function bacaPanduan(): Promise<PanduanPenyiapan> {
  const c = await catatanContoh();
  const tandaiArr = await langkahDitandai();
  const [stok] = await db
    .select({ n: count() })
    .from(penyesuaianStok)
    .where(and(eq(penyesuaianStok.jenis, 'SALDO_AWAL'), eq(penyesuaianStok.status, 'SELESAI')));
  const jumlah: Record<Exclude<LangkahPenyiapan, 'PROFIL' | 'PRINTER'>, number> = {
    REKENING: await jumlahAsli(rekeningToko, rekeningToko, []),
    PENGGUNA: await jumlahAsli(pengguna, pengguna, []),
    BARANG: await jumlahAsli(barang, barang, c.BARANG),
    STOK: stok?.n ?? 0,
    PELANGGAN: await jumlahAsli(pelanggan, pelanggan, c.PELANGGAN),
    PEMASOK: await jumlahAsli(pemasok, pemasok, c.PEMASOK),
    ARMADA: Math.min(
      await jumlahAsli(kendaraan, kendaraan, c.KENDARAAN),
      await jumlahAsli(sopir, sopir, c.SOPIR),
    ),
  };
  return {
    langkah: [
      { langkah: 'PROFIL', selesai: tandaiArr.includes('PROFIL'), jumlah: null },
      { langkah: 'REKENING', selesai: jumlah.REKENING > 0, jumlah: jumlah.REKENING },
      // Selain akun pemilik, minimal satu akun karyawan.
      { langkah: 'PENGGUNA', selesai: jumlah.PENGGUNA > 1, jumlah: jumlah.PENGGUNA },
      { langkah: 'BARANG', selesai: jumlah.BARANG > 0, jumlah: jumlah.BARANG },
      { langkah: 'STOK', selesai: jumlah.STOK > 0, jumlah: jumlah.STOK },
      { langkah: 'PELANGGAN', selesai: jumlah.PELANGGAN > 0, jumlah: jumlah.PELANGGAN },
      { langkah: 'PEMASOK', selesai: jumlah.PEMASOK > 0, jumlah: jumlah.PEMASOK },
      { langkah: 'ARMADA', selesai: jumlah.ARMADA > 0, jumlah: jumlah.ARMADA },
      // Printer struk diatur per komputer: statusnya dibaca peramban.
      { langkah: 'PRINTER', selesai: false, jumlah: null },
    ],
    contoh: {
      BARANG: await jumlahAktif(barang, barang, c.BARANG),
      PELANGGAN: await jumlahAktif(pelanggan, pelanggan, c.PELANGGAN),
      PEMASOK: await jumlahAktif(pemasok, pemasok, c.PEMASOK),
      ARMADA:
        (await jumlahAktif(kendaraan, kendaraan, c.KENDARAAN)) +
        (await jumlahAktif(sopir, sopir, c.SOPIR)),
    },
    disembunyikan: (await ambilTeks(KODE_SEMBUNYI, 'false')) === 'true',
  };
}

export async function tandaiLangkah(
  langkah: 'PROFIL',
  selesai: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PanduanPenyiapan> {
  const baru = new Set(await langkahDitandai());
  if (selesai) baru.add(langkah);
  else baru.delete(langkah);
  await simpan(KODE_DITANDAI, JSON.stringify([...baru]), 'JSON');
  await catatLog(db, {
    aksi: 'PENGATURAN_UBAH',
    idPengguna: pelaku.id,
    entitas: 'konfigurasi',
    ringkasan: `Panduan penyiapan: profil toko ${selesai ? 'ditandai sudah diperiksa' : 'ditandai belum'}`,
    ip: asal.ip,
  });
  return bacaPanduan();
}

export async function sembunyikanPanduan(
  sembunyikan: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PanduanPenyiapan> {
  await simpan(KODE_SEMBUNYI, String(sembunyikan), 'BOOL');
  await catatLog(db, {
    aksi: 'PENGATURAN_UBAH',
    idPengguna: pelaku.id,
    entitas: 'konfigurasi',
    ringkasan: `Pengingat panduan penyiapan di dashboard ${sembunyikan ? 'disembunyikan' : 'ditampilkan lagi'}`,
    ip: asal.ip,
  });
  return bacaPanduan();
}

function pesan(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function idLookup() {
  const kat = new Map(
    (await db.select({ id: kategori.id, nama: kategori.nama }).from(kategori)).map((k) => [
      k.nama,
      k.id,
    ]),
  );
  const sat = new Map(
    (await db.select({ id: satuan.id, kode: satuan.kode }).from(satuan)).map((s) => [s.kode, s.id]),
  );
  const [tier] = await db
    .select({ id: tingkatHarga.id })
    .from(tingkatHarga)
    .where(eq(tingkatHarga.isDefault, true))
    .limit(1);
  if (!tier) throw new AppError('STATUS_TIDAK_VALID', 'Tier harga dasar belum ada.', 409);
  return { kat, sat, idTier: tier.id };
}

/** Membuat contoh satu jenis. Ditolak bila contoh jenis itu masih ada (aktif). */
export async function isiContoh(
  jenis: JenisContoh,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilContoh> {
  if (!JENIS_CONTOH.includes(jenis))
    throw new AppError('VALIDASI', 'Jenis contoh tidak dikenal.', 400);
  if ((await bacaPanduan()).contoh[jenis] > 0) {
    throw new AppError(
      'KONFLIK',
      'Contoh jenis ini sudah ada. Nonaktifkan dulu bila ingin membuat ulang.',
      409,
    );
  }
  const c = await catatanContoh();
  const gagal: string[] = [];
  let dibuat = 0;
  const catat = (kunci: keyof CatatanContoh, id: number) => {
    c[kunci] = [...c[kunci], id];
    dibuat++;
  };
  if (jenis === 'BARANG') {
    const { kat, sat, idTier } = await idLookup();
    for (const b of CONTOH_BARANG) {
      try {
        const { kategori: namaKat, satuan: kodeSat, hargaJual, ...isi } = b;
        const data = skemaBarang.parse({
          ...isi,
          idKategori: kat.get(namaKat),
          idSatuanDasar: sat.get(kodeSat),
          hargaTier: [{ idTingkatHarga: idTier, hargaTetap: hargaJual }],
          keterangan: TANDA_CONTOH,
          abaikanMirip: true,
        });
        catat('BARANG', (await tambahBarang(data, pelaku, asal)).id);
      } catch (err) {
        gagal.push(`${b.namaBarang}: ${pesan(err)}`);
      }
    }
  } else if (jenis === 'PELANGGAN') {
    for (const p of CONTOH_PELANGGAN) {
      try {
        const data = skemaPelanggan.parse({ ...p, keterangan: TANDA_CONTOH, abaikanMirip: true });
        catat('PELANGGAN', (await tambahPelanggan(data, pelaku, asal)).id);
      } catch (err) {
        gagal.push(`${p.namaPelanggan}: ${pesan(err)}`);
      }
    }
  } else if (jenis === 'PEMASOK') {
    for (const p of CONTOH_PEMASOK) {
      try {
        const data = skemaPemasok.parse({ ...p, keterangan: TANDA_CONTOH, abaikanMirip: true });
        catat('PEMASOK', (await tambahPemasok(data, pelaku, asal)).id);
      } catch (err) {
        gagal.push(`${p.namaPemasok}: ${pesan(err)}`);
      }
    }
  } else {
    for (const k of CONTOH_KENDARAAN) {
      try {
        const data = skemaKendaraan.parse({ ...k, catatan: TANDA_CONTOH });
        catat('KENDARAAN', (await tambahKendaraan(data, pelaku, asal)).id);
      } catch (err) {
        gagal.push(`${k.plat}: ${pesan(err)}`);
      }
    }
    for (const s of CONTOH_SOPIR) {
      try {
        const data = skemaSopir.parse({ ...s, catatan: TANDA_CONTOH });
        catat('SOPIR', (await tambahSopir(data, pelaku, asal)).id);
      } catch (err) {
        gagal.push(`${s.nama}: ${pesan(err)}`);
      }
    }
  }
  await simpan(KODE_CONTOH, JSON.stringify(c), 'JSON');
  await catatLog(db, {
    aksi: 'PENYIAPAN_CONTOH',
    idPengguna: pelaku.id,
    entitas: 'konfigurasi',
    ringkasan: `Contoh ${jenis.toLowerCase()} dibuat: ${dibuat}${gagal.length ? `; gagal ${gagal.length}` : ''}`,
    ip: asal.ip,
  });
  return { dibuat, dinonaktifkan: 0, gagal, panduan: await bacaPanduan() };
}

/** Semua contoh yang tercatat dinonaktifkan (tidak dihapus). Yang gagal tetap tercatat untuk dicoba lagi. */
export async function nonaktifkanContoh(
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilContoh> {
  const c = await catatanContoh();
  const sisa: CatatanContoh = { ...KOSONG };
  const gagal: string[] = [];
  let dinonaktifkan = 0;
  const jalankan = async (
    kunci: keyof CatatanContoh,
    tabel: PgTable,
    kolom: { id: PgColumn; statusAktif: PgColumn },
    ubah: (id: number) => Promise<unknown>,
  ) => {
    if (c[kunci].length === 0) return;
    const aktif = await db
      .select({ id: kolom.id })
      .from(tabel)
      .where(and(eq(kolom.statusAktif, 'AKTIF'), inArray(kolom.id, c[kunci])));
    for (const { id } of aktif as { id: number }[]) {
      try {
        await ubah(id);
        dinonaktifkan++;
      } catch (err) {
        sisa[kunci] = [...sisa[kunci], id];
        gagal.push(`${kunci.toLowerCase()} #${id}: ${pesan(err)}`);
      }
    }
  };
  await jalankan('BARANG', barang, barang, (id) => ubahStatusBarang(id, 'NONAKTIF', pelaku, asal));
  await jalankan('PELANGGAN', pelanggan, pelanggan, (id) =>
    ubahStatusPelanggan(id, 'NONAKTIF', pelaku, asal),
  );
  await jalankan('PEMASOK', pemasok, pemasok, (id) =>
    ubahStatusPemasok(id, 'NONAKTIF', pelaku, asal),
  );
  await jalankan('KENDARAAN', kendaraan, kendaraan, (id) =>
    ubahStatusKendaraan(id, 'NONAKTIF', pelaku, asal),
  );
  await jalankan('SOPIR', sopir, sopir, (id) => ubahStatusSopir(id, 'NONAKTIF', pelaku, asal));
  await simpan(KODE_CONTOH, JSON.stringify(sisa), 'JSON');
  await catatLog(db, {
    aksi: 'PENYIAPAN_CONTOH',
    idPengguna: pelaku.id,
    entitas: 'konfigurasi',
    ringkasan: `Contoh dinonaktifkan: ${dinonaktifkan}${gagal.length ? `; gagal ${gagal.length}` : ''}`,
    ip: asal.ip,
  });
  return { dibuat: 0, dinonaktifkan, gagal, panduan: await bacaPanduan() };
}
