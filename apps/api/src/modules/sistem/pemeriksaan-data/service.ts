import {
  galatNoHp,
  rapikanNoHp,
  type DataMirip,
  type HasilPemeriksaanData,
  type HasilRapikanNoHp,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { kunciNamaSql } from '../../master/mirip';
import { catatLog } from '../log-aktivitas';

/*
 * K-137 butir 3: pindai data lama yang sudah lolos sebelum aturan ketat berlaku: data ganda (nama sama setelah
 * dirapikan, No. HP sama) dan format salah (No. HP bukan format internasional, nama berspasi ganda). Hanya
 * membaca; perapian No. HP otomatis dijalankan terpisah atas perintah Admin/Owner dan tercatat di log.
 */

type Tabel = {
  jenis: 'pelanggan' | 'pemasok' | 'barang';
  tabel: string;
  nama: string;
  hp: string | null;
  awalan: boolean;
};

const TABEL: (Tabel & { alamat: string | null })[] = [
  {
    jenis: 'pelanggan',
    tabel: 'pelanggan',
    nama: 'nama_pelanggan',
    hp: 'no_hp',
    awalan: true,
    alamat: 'alamat',
  },
  {
    jenis: 'pemasok',
    tabel: 'pemasok',
    nama: 'nama_pemasok',
    hp: 'no_hp',
    awalan: true,
    alamat: 'alamat',
  },
  { jenis: 'barang', tabel: 'barang', nama: 'nama_barang', hp: null, awalan: false, alamat: null },
];

/** Alamat dibandingkan tanpa beda huruf besar, tanda baca, dan spasi; alamat pendek (< 10 huruf) diabaikan. */
const kunciAlamat = (a: string | null) => {
  const k = (a ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return k.length >= 10 ? k : null;
};

/** K-183: kelengkapan data aktif. `sql` mengembalikan id, kode, nama, no_hp, status_aktif. */
const KURANG: {
  jenis: 'pelanggan' | 'pemasok' | 'barang';
  alasan: string;
  kueri: ReturnType<typeof sql>;
}[] = [
  {
    jenis: 'barang',
    alasan: 'belum punya harga jual di tier dasar',
    kueri: sql`select b.id, b.kode, b.nama_barang nama, null no_hp, b.status_aktif from barang b
      where b.status_aktif = 'AKTIF' and not exists (select 1 from harga_barang h
        join tingkat_harga t on t.id = h.id_tingkat_harga and t.is_default
        where h.id_barang = b.id and h.harga_jual > 0)`,
  },
  {
    jenis: 'barang',
    alasan: 'kategori atau satuan dasarnya sudah nonaktif',
    kueri: sql`select b.id, b.kode, b.nama_barang nama, null no_hp, b.status_aktif from barang b
      join kategori k on k.id = b.id_kategori join satuan s on s.id = b.id_satuan_dasar
      where b.status_aktif = 'AKTIF' and (k.status_aktif <> 'AKTIF' or s.status_aktif <> 'AKTIF')`,
  },
  {
    jenis: 'barang',
    alasan: 'data muatan (berat/ukuran) belum lengkap',
    kueri: sql`select b.id, b.kode, b.nama_barang nama, null no_hp, b.status_aktif from barang b
      where b.status_aktif = 'AKTIF' and (b.berat_kg is null
        or (not b.curah and b.panjang_cm is null and b.volume_m3 is null)
        or (b.curah and b.volume_m3 is null))`,
  },
  {
    jenis: 'pelanggan',
    alasan: 'belum punya alamat (tidak bisa diantar)',
    kueri: sql`select id, kode, nama_pelanggan nama, no_hp, status_aktif from pelanggan
      where status_aktif = 'AKTIF' and coalesce(trim(alamat), '') = ''`,
  },
  {
    jenis: 'pemasok',
    alasan: 'belum punya No. HP',
    kueri: sql`select id, kode, nama_pemasok nama, no_hp, status_aktif from pemasok
      where status_aktif = 'AKTIF' and coalesce(trim(no_hp), '') = ''`,
  },
];
const MAKS_CONTOH = 50;

type Baris = { id: string; kode: string; nama: string; no_hp: string | null; status_aktif: string };

const keMirip = (b: Baris, alasan: string): DataMirip => ({
  id: Number(b.id),
  kode: b.kode,
  nama: b.nama,
  noHp: b.no_hp,
  statusAktif: b.status_aktif,
  alasan,
});

export async function periksaData(): Promise<HasilPemeriksaanData> {
  const ganda: HasilPemeriksaanData['ganda'] = [];
  const format: HasilPemeriksaanData['format'] = [];
  for (const t of TABEL) {
    const nama = sql.identifier(t.nama);
    const hp = t.hp ? sql.identifier(t.hp) : sql`null`;
    const kunci = kunciNamaSql(sql`${nama}`, t.awalan);
    const alamat = t.alamat ? sql.identifier(t.alamat) : sql`null`;
    const semua = (
      await db.execute(sql`
        select id, kode, ${nama} nama, ${hp} no_hp, status_aktif, ${kunci} kunci, ${alamat} alamat
          from ${sql.identifier(t.tabel)} order by id`)
    ).rows as (Baris & { kunci: string; alamat: string | null })[];
    const kelompok = (
      kunciDari: (b: Baris & { kunci: string; alamat: string | null }) => string | null,
      alasan: string,
    ) => {
      const peta = new Map<string, (Baris & { kunci: string; alamat: string | null })[]>();
      for (const b of semua) {
        const k = kunciDari(b);
        if (!k) continue;
        peta.set(k, [...(peta.get(k) ?? []), b]);
      }
      for (const isi of peta.values()) {
        if (isi.length > 1)
          ganda.push({ jenis: t.jenis, alasan, data: isi.map((b) => keMirip(b, alasan)) });
      }
    };
    kelompok((b) => b.kunci || null, 'nama sama');
    if (t.hp) {
      kelompok((b) => (b.no_hp ? (rapikanNoHp(b.no_hp) ?? b.no_hp) : null), 'No. HP sama');
    }
    // K-183: alamat sama (aktif saja) sering berarti satu pelanggan/pemasok tercatat dua kali.
    if (t.alamat) {
      kelompok((b) => (b.status_aktif === 'AKTIF' ? kunciAlamat(b.alamat) : null), 'alamat sama');
    }
    for (const b of semua) {
      const masalah: string[] = [];
      if (b.nama !== b.nama.trim().replace(/\s+/g, ' ')) masalah.push('spasi berlebih di nama');
      if (t.hp && b.no_hp) {
        const rapi = rapikanNoHp(b.no_hp);
        if (!rapi || galatNoHp(rapi)) masalah.push('No. HP tidak sah; perbaiki manual');
        else if (rapi !== b.no_hp) {
          masalah.push(`No. HP belum format internasional (bisa dirapikan: ${rapi})`);
        }
      }
      if (masalah.length > 0) format.push({ ...keMirip(b, masalah.join('; ')), jenis: t.jenis });
    }
  }
  const kurang: HasilPemeriksaanData['kurang'] = [];
  for (const k of KURANG) {
    const baris = (await db.execute(k.kueri)).rows as Baris[];
    if (baris.length > 0) {
      kurang.push({
        jenis: k.jenis,
        alasan: k.alasan,
        jumlah: baris.length,
        data: baris.slice(0, MAKS_CONTOH).map((b) => keMirip(b, k.alasan)),
      });
    }
  }
  return { ganda, format, kurang };
}

/** Rapikan No. HP pelanggan, pemasok, sopir, pengguna ke format internasional (yang bisa dirapikan saja). */
export async function rapikanSemuaNoHp(
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilRapikanNoHp> {
  return dalamTransaksi(async (tx) => {
    let diubah = 0;
    const gagal: string[] = [];
    for (const tabel of ['pelanggan', 'pemasok', 'sopir', 'pengguna'] as const) {
      const r = (
        await tx.execute(
          sql`select id, no_hp from ${sql.identifier(tabel)} where no_hp is not null for update`,
        )
      ).rows as { id: string; no_hp: string }[];
      for (const b of r) {
        const rapi = rapikanNoHp(b.no_hp);
        if (!rapi || galatNoHp(rapi)) {
          gagal.push(`${tabel} #${b.id}: ${b.no_hp}`);
          continue;
        }
        if (rapi === b.no_hp) continue;
        await tx.execute(
          sql`update ${sql.identifier(tabel)} set no_hp = ${rapi}, diubah_pada = ${sekarang()} where id = ${Number(b.id)}`,
        );
        diubah++;
      }
    }
    await catatLog(tx, {
      aksi: 'DATA_RAPIKAN',
      idPengguna: pelaku.id,
      entitas: 'pemeriksaan_data',
      ringkasan: `Merapikan No. HP ke format internasional: ${diubah} diubah, ${gagal.length} perlu diperbaiki manual`,
      dataBaru: { diubah, gagal },
      ip: asal.ip,
    });
    return { diubah, gagal };
  });
}
