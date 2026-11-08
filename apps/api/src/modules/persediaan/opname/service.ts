import { randomInt } from 'node:crypto';
import {
  nomorHari,
  type DetailPenyesuaian,
  type KelasABC,
  type RingkasanOpname,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';
import { buatPenyesuaian } from '../penyesuaian/service';

/*
 * K-240/K-227: Stok Opname bertahap (cycle count). Barang aktif milik sendiri dikelompokkan ABC menurut nilai keluar
 * terjual (HPP) 90 hari terakhir: A = penyumbang 80% pertama, B = 15% berikutnya, C = sisanya. Selang hitung A 30
 * hari, B 90, C 180; barang yang belum pernah diopname selalu jatuh tempo. Daftar hitung harian dipilih acak
 * berbobot dari yang jatuh tempo, ditambah sedikit barang yang belum jatuh tempo, supaya tidak bisa ditebak.
 */

const SELANG: Record<KelasABC, number> = { A: 30, B: 90, C: 180 };
const BOBOT: Record<KelasABC, number> = { A: 3, B: 2, C: 1 };

type BarangOpname = {
  idBarang: number;
  kelas: KelasABC;
  terakhir: string | null;
  jatuhTempo: boolean;
};

export async function petaOpname(hariIni = tanggalOperasional()): Promise<BarangOpname[]> {
  const dari = tambahHari(hariIni, -90);
  const r = await db.execute<{ id: string; nilai: string; terakhir: string | null }>(sql`
    select b.id::text id,
           coalesce((select sum(m.qty_keluar * m.hpp_satuan) from mutasi_persediaan m
                      where m.id_barang = b.id and m.jenis_mutasi = 'PENJUALAN'
                        and m.tanggal_operasional >= ${dari}), 0)::text nilai,
           (select max(p.waktu_selesai at time zone 'Asia/Jakarta')::date::text
              from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
             where d.id_barang = b.id and p.jenis = 'OPNAME' and p.status = 'SELESAI'
               and not d.dikecualikan) terakhir
      from barang b
     where b.status_aktif = 'AKTIF' and b.kepemilikan = 'MILIK_SENDIRI'`);
  const baris = r.rows.map((x) => ({
    id: Number(x.id),
    nilai: Number(x.nilai),
    terakhir: x.terakhir,
  }));
  const total = baris.reduce((t, b) => t + b.nilai, 0);
  baris.sort((a, b) => b.nilai - a.nilai || a.id - b.id);
  let kumulatif = 0;
  return baris.map((b) => {
    const sebelum = kumulatif;
    kumulatif += b.nilai;
    const kelas: KelasABC =
      total > 0 && b.nilai > 0 && sebelum / total < 0.8
        ? 'A'
        : total > 0 && b.nilai > 0 && sebelum / total < 0.95
          ? 'B'
          : 'C';
    const jatuhTempo =
      b.terakhir === null || nomorHari(hariIni) - nomorHari(b.terakhir) >= SELANG[kelas];
    return { idBarang: b.id, kelas, terakhir: b.terakhir, jatuhTempo };
  });
}

export async function ringkasanOpname(): Promise<RingkasanOpname> {
  const peta = await petaOpname();
  const kelas = (['A', 'B', 'C'] as const).map((k) => ({
    kelas: k,
    selangHari: SELANG[k],
    jumlah: peta.filter((b) => b.kelas === k).length,
    jatuhTempo: peta.filter((b) => b.kelas === k && b.jatuhTempo).length,
  }));
  // IRA (akurasi catatan persediaan) 30 hari: baris opname yang cocok ÷ baris yang dihitung.
  const r = await db.execute<{ dihitung: string; cocok: string; nilai: string }>(sql`
    select count(*)::text dihitung,
           count(*) filter (where d.qty_selisih = 0)::text cocok,
           coalesce(sum(abs(d.qty_selisih) * d.hpp_satuan), 0)::bigint::text nilai
      from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
     where p.jenis = 'OPNAME' and p.status = 'SELESAI' and not d.dikecualikan
       and p.tanggal_operasional >= ${tambahHari(tanggalOperasional(), -30)}`);
  const x = r.rows[0];
  const dihitung = Number(x?.dihitung ?? 0);
  const cocok = Number(x?.cocok ?? 0);
  return {
    kelas,
    akurasi30Hari: dihitung === 0 ? null : Math.round((cocok / dihitung) * 1000) / 10,
    barisDihitung30Hari: dihitung,
    nilaiSelisih30Hari: Number(x?.nilai ?? 0),
  };
}

/**
 * Daftar hitung harian: `jumlah` barang acak berbobot (A 3 : B 2 : C 1) dari yang jatuh tempo; ±1 dari 5 diambil
 * dari yang belum jatuh tempo (barang yang baru dihitung tetap bisa terpilih lagi). Hasilnya draf OPNAME biasa.
 */
export async function susunDaftarHarian(
  jumlah: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  const peta = await petaOpname();
  if (peta.length === 0)
    throw new AppError('VALIDASI', 'Tidak ada barang aktif untuk dihitung.', 400);
  const jatuh = peta.filter((b) => b.jatuhTempo);
  const lain = peta.filter((b) => !b.jatuhTempo);
  const kejutan = lain.length > 0 ? Math.max(1, Math.round(jumlah / 5)) : 0;
  const pilih = [
    ...ambilAcakBerbobot(jatuh, jumlah - Math.min(kejutan, jumlah - 1)),
    ...ambilAcakBerbobot(lain, kejutan),
  ];
  const sisa = jumlah - pilih.length;
  if (sisa > 0) {
    const sudah = new Set(pilih.map((b) => b.idBarang));
    pilih.push(
      ...ambilAcakBerbobot(
        peta.filter((b) => !sudah.has(b.idBarang)),
        sisa,
      ),
    );
  }
  return buatPenyesuaian(
    {
      jenis: 'OPNAME',
      alasan: null,
      catatan: `Daftar hitung harian ${tanggalOperasional()} (${pilih.length} barang, acak)`,
      baris: pilih.map((b) => ({
        idBarang: b.idBarang,
        qtyFisik: null,
        qtySelisih: null,
        hppSatuan: null,
        keterangan: null,
        dikecualikan: false,
        alasanKecuali: null,
      })),
    },
    pelaku,
    asal,
  );
}

function ambilAcakBerbobot(daftar: BarangOpname[], n: number): BarangOpname[] {
  const sisa = [...daftar];
  const hasil: BarangOpname[] = [];
  while (hasil.length < n && sisa.length > 0) {
    const total = sisa.reduce((t, b) => t + BOBOT[b.kelas], 0);
    let titik = randomInt(0, total);
    const i = sisa.findIndex((b) => (titik -= BOBOT[b.kelas]) < 0);
    hasil.push(...sisa.splice(i < 0 ? 0 : i, 1));
  }
  return hasil;
}
