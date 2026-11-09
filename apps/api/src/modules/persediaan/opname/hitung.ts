import {
  bandingQty,
  kurangQty,
  subtotalRupiah,
  type CaraHitung,
  type HitunganOpname,
  type KelasABC,
} from '@sit/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from '../../../db/client';
import { opnameHitung, pengguna } from '../../../db/schema';

/*
 * K-227: aturan hasil hitung opname (docs/05 A3c–A3g).
 *  - Setiap hasil hitung disimpan sebagai catatan baru (`opname_hitung`); hasil akhir baris = hitungan terakhir.
 *  - Selisih sebuah hitungan dihitung terhadap stok sistem **pada waktu hitungan itu** dan barang terjual yang
 *    belum diambil pada waktu itu, sehingga transaksi sesudah barang dihitung tidak membuat selisih palsu.
 *  - Selisih yang melewati toleransi (kelas A: selisih berapa pun) wajib dikonfirmasi: hitungan terakhir harus sama
 *    selisihnya dengan hitungan orang lain. Dari tiap orang yang dipakai hanya hitungan terakhirnya.
 */

export type Hitungan = {
  id: number;
  idBarang: number;
  idPenghitung: number;
  namaPenghitung: string;
  waktu: Date;
  qty: string;
  cara: CaraHitung;
  beratGram: string | null;
};

export type HitunganBernilai = Hitungan & { selisih: string; sistem: string; belum: string };

/** Semua hitungan satu dokumen per barang, urut waktu (lalu id). */
export async function hitunganDokumen(
  ex: Executor,
  idPenyesuaian: number,
): Promise<Map<number, Hitungan[]>> {
  const r = await ex
    .select({
      id: opnameHitung.id,
      idBarang: opnameHitung.idBarang,
      idPenghitung: opnameHitung.idPenghitung,
      namaPenghitung: pengguna.namaPengguna,
      waktu: opnameHitung.waktu,
      qty: opnameHitung.qty,
      cara: opnameHitung.cara,
      beratGram: opnameHitung.beratGram,
    })
    .from(opnameHitung)
    .innerJoin(pengguna, eq(pengguna.id, opnameHitung.idPenghitung))
    .where(eq(opnameHitung.idPenyesuaian, idPenyesuaian))
    .orderBy(asc(opnameHitung.waktu), asc(opnameHitung.id));
  const hasil = new Map<number, Hitungan[]>();
  for (const h of r) {
    const daftar = hasil.get(h.idBarang) ?? [];
    daftar.push(h);
    hasil.set(h.idBarang, daftar);
  }
  return hasil;
}

/**
 * Per hitungan: mutasi bersih stok BAIK sesudah waktu hitung (`sesudah`) dan barang terjual LANGSUNG yang belum
 * diambil pada waktu hitung (`belum`). Stok sistem saat hitung = stok fisik kini − `sesudah`. Dihitung di SQL dengan
 * waktu dari tabel (presisi mikrodetik, tanpa pembulatan JavaScript).
 */
export async function keadaanSaatHitung(
  ex: Executor,
  idHitungan: number[],
): Promise<Map<number, { sesudah: string; belum: string }>> {
  const hasil = new Map<number, { sesudah: string; belum: string }>();
  for (let i = 0; i < idHitungan.length; i += 1000) {
    const potong = idHitungan.slice(i, i + 1000);
    const r = await ex.execute<{ id: string; sesudah: string; belum: string }>(sql`
      select h.id::text id,
             coalesce((select sum(m.qty_masuk - m.qty_keluar) from mutasi_persediaan m
                        where m.id_barang = h.id_barang and m.kondisi = 'BAIK' and m.waktu > h.waktu), 0)::text sesudah,
             coalesce((select sum(d.qty_dasar - d.qty_retur_dasar)
                         from penjualan_detail d join penjualan p on p.id = d.id_penjualan
                        where d.id_barang = h.id_barang and p.jenis_penjualan = 'LANGSUNG'
                          and p.status_transaksi <> 'VOID' and d.status_item <> 'VOID'
                          and p.dibuat_pada <= h.waktu
                          and (p.status_pengambilan = 'BELUM_DIAMBIL'
                               or (p.status_pengambilan = 'DIAMBIL' and p.waktu_diambil > h.waktu))), 0)::text belum
        from opname_hitung h
       where h.id in (${sql.join(
         potong.map((x) => sql`${x}`),
         sql`, `,
       )})`);
    for (const b of r.rows) hasil.set(Number(b.id), { sesudah: b.sesudah, belum: b.belum });
  }
  return hasil;
}

/** Selisih tiap hitungan terhadap keadaan pada waktunya. `stokKini` = stok fisik BAIK saat ini per barang. */
export async function nilaiHitungan(
  ex: Executor,
  perBarang: Map<number, Hitungan[]>,
  stokKini: (idBarang: number) => string,
): Promise<Map<number, HitunganBernilai[]>> {
  const semua = [...perBarang.values()].flat();
  const keadaan = await keadaanSaatHitung(
    ex,
    semua.map((h) => h.id),
  );
  const hasil = new Map<number, HitunganBernilai[]>();
  for (const [idBarang, daftar] of perBarang) {
    hasil.set(
      idBarang,
      daftar.map((h) => {
        const k = keadaan.get(h.id) ?? { sesudah: '0', belum: '0' };
        const sistem = kurangQty(stokKini(idBarang), k.sesudah);
        return {
          ...h,
          sistem,
          belum: kurangQty(k.belum, 0),
          selisih: kurangQty(kurangQty(h.qty, sistem), k.belum),
        };
      }),
    );
  }
  return hasil;
}

export type PenilaianBaris = {
  akhir: HitunganBernilai | null;
  /** Ada hitungan (terakhir per orang) yang selisihnya melewati toleransi atau kelas A berselisih. */
  perluHitungUlang: boolean;
  /** Hitungan terakhir sama selisihnya dengan hitungan terakhir orang lain. */
  terkonfirmasi: boolean;
  /** Semua orang yang menghitung baris ini. */
  penghitung: Set<number>;
};

/** Nilai rupiah sebuah selisih (mutlak). */
export function nilaiSelisih(selisih: string, hpp: number): number {
  return subtotalRupiah(selisih.startsWith('-') ? selisih.slice(1) : selisih, hpp);
}

export function nilaiBaris(p: {
  hitungan: HitunganBernilai[];
  hpp: number;
  kelas: KelasABC;
  toleransiRp: number;
}): PenilaianBaris {
  const akhir = p.hitungan.at(-1) ?? null;
  const perOrang = new Map<number, HitunganBernilai>();
  for (const h of p.hitungan) perOrang.set(h.idPenghitung, h);
  const lewat = (h: HitunganBernilai) =>
    bandingQty(h.selisih, 0) !== 0 &&
    (p.kelas === 'A' || nilaiSelisih(h.selisih, p.hpp) > p.toleransiRp);
  const terakhirOrang = [...perOrang.values()];
  return {
    akhir,
    perluHitungUlang: terakhirOrang.some(lewat),
    terkonfirmasi:
      akhir !== null &&
      terakhirOrang.some(
        (h) => h.idPenghitung !== akhir.idPenghitung && bandingQty(h.selisih, akhir.selisih) === 0,
      ),
    penghitung: new Set(p.hitungan.map((h) => h.idPenghitung)),
  };
}

export function keRespons(h: HitunganBernilai | Hitungan, tampilSelisih: boolean): HitunganOpname {
  return {
    id: h.id,
    idPenghitung: h.idPenghitung,
    namaPenghitung: h.namaPenghitung,
    waktu: h.waktu.toISOString(),
    qty: h.qty,
    cara: h.cara,
    beratGram: h.beratGram,
    selisih: tampilSelisih && 'selisih' in h ? h.selisih : null,
  };
}

/** Catat satu hitungan (dipakai lembar hitung dan form penyesuaian). */
export async function tambahHitungan(
  ex: Executor,
  h: {
    idPenyesuaian: number;
    idBarang: number;
    idPenghitung: number;
    qty: string;
    cara: CaraHitung;
    beratGram: string | null;
  },
): Promise<void> {
  await ex.insert(opnameHitung).values(h);
}

/** Barang (dari daftar) yang sudah punya hitungan di dokumen ini. */
export async function barangTerhitung(
  ex: Executor,
  idPenyesuaian: number,
  idBarang: number[],
): Promise<Set<number>> {
  if (idBarang.length === 0) return new Set();
  const r = await ex
    .selectDistinct({ idBarang: opnameHitung.idBarang })
    .from(opnameHitung)
    .where(
      sql`${opnameHitung.idPenyesuaian} = ${idPenyesuaian} and ${inArray(opnameHitung.idBarang, idBarang)}`,
    );
  return new Set(r.map((x) => x.idBarang));
}
