import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  bandingQty,
  hppRataRata,
  keQty,
  kurangQty,
  tambahQty,
  teksQty,
  type JenisMutasi,
  type Kepemilikan,
  type KondisiStok,
} from '@sit/shared';
import type { Executor, Tx } from '../../db/client';
import {
  barang,
  mutasiPersediaan,
  orderPenjualan,
  orderPenjualanDetail,
  persediaan,
  satuan,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import { sekarang } from '../../lib/waktu';
import { muatKonteksHarga, tanggapiPemicuHarga } from '../master/harga/service';

/*
 * SATU-SATUNYA berkas yang menulis tabel `persediaan` (CLAUDE.md aturan 2, docs/05 §2).
 * Fase 3: baris awal (L10) dan penyelarasan HPP dari data master (L7, K-060).
 * Fase 4: `catatMutasi()` (semua pergerakan stok) dan `hitungUlangCache()` (L9).
 */

type NilaiHppMaster = {
  kepemilikan: Kepemilikan;
  hargaModalAwal: number;
  hargaTitip: number | null;
};

/** L10: nilai awal HPP dari data master barang. */
function hppAwal(b: NilaiHppMaster): { hppRata2: number; hargaBeliTerakhir: number } {
  return b.kepemilikan === 'KONSINYASI'
    ? { hppRata2: b.hargaTitip ?? 0, hargaBeliTerakhir: 0 }
    : { hppRata2: b.hargaModalAwal, hargaBeliTerakhir: b.hargaModalAwal };
}

/** L10: baris `persediaan` dibuat bersamaan dengan barang, stok 0 (harga FIFO = harga beli terakhir, K-184). */
export async function buatPersediaan(tx: Tx, idBarang: number, b: NilaiHppMaster): Promise<void> {
  const awal = hppAwal(b);
  await tx.insert(persediaan).values({ idBarang, ...awal, hargaFifo: awal.hargaBeliTerakhir });
}

/**
 * K-184 L12: harga FIFO = `hpp_satuan` lapisan masuk BAIK tertua yang masih ada. Baris masuk BAIK ditelusuri dari
 * yang terbaru; lapisan pertama yang membuat jumlahnya ≥ `stokFisik` adalah lapisan tertua yang tersisa (stok
 * keluar dianggap mengambil yang lama dulu). Stok 0 → `cadangan` (harga beli terakhir). Jumlah masuk kurang dari
 * stok (tidak semestinya) → lapisan masuk paling awal.
 */
export async function hitungHargaFifo(
  ex: Executor,
  idBarang: number,
  stokFisik: string,
  cadangan: number,
): Promise<number> {
  if (bandingQty(stokFisik, 0) <= 0) return cadangan;
  const hasil = await ex.execute(sql`
    select coalesce(
      (select m.hpp_satuan from (
         select id, hpp_satuan, sum(qty_masuk) over (order by id desc) as kum
           from ${mutasiPersediaan}
          where id_barang = ${idBarang} and kondisi = 'BAIK' and qty_masuk > 0
       ) m where m.kum >= ${stokFisik}::numeric order by m.kum, m.id desc limit 1),
      (select hpp_satuan from ${mutasiPersediaan}
        where id_barang = ${idBarang} and kondisi = 'BAIK' and qty_masuk > 0 order by id limit 1)
    ) as h`);
  const h = (hasil.rows[0] as { h: string | number | null } | undefined)?.h;
  return h === null || h === undefined ? cadangan : Number(h);
}

/** Baris persediaan barang, dikunci sampai transaksi selesai (L1). */
export async function kunciPersediaan(tx: Tx, idBarang: number) {
  const [baris] = await tx
    .select({
      stokFisik: persediaan.stokFisik,
      stokRusak: persediaan.stokRusak,
      stokDipesan: persediaan.stokDipesan,
      hppRata2: persediaan.hppRata2,
      hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
      tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
      terakhirMutasi: persediaan.terakhirMutasi,
      hargaFifo: persediaan.hargaFifo,
    })
    .from(persediaan)
    .where(eq(persediaan.idBarang, idBarang))
    .limit(1)
    .for('update');
  if (!baris) throw new Error(`Baris persediaan barang ${idBarang} tidak ada (L10 dilanggar)`);
  return baris;
}

/**
 * Menyelaraskan HPP persediaan setelah data master barang berubah:
 * - KONSINYASI: `hpp_rata2` selalu = `harga_titip` (L7).
 * - MILIK_SENDIRI tanpa mutasi sama sekali: nilai awal L10 mengikuti `harga_modal_awal` (K-060).
 * Setelah ada mutasi, HPP milik sendiri hanya berubah lewat ledger.
 * Mengembalikan nilai lama/baru bila berubah (untuk log), atau `null`.
 */
export async function selaraskanHppMaster(tx: Tx, idBarang: number, b: NilaiHppMaster) {
  const lama = await kunciPersediaan(tx, idBarang);
  const awal = hppAwal(b);
  let baru: { hppRata2: number; hargaBeliTerakhir: number };
  if (lama.terakhirMutasi === null) baru = awal;
  else if (b.kepemilikan === 'KONSINYASI')
    baru = { hppRata2: awal.hppRata2, hargaBeliTerakhir: lama.hargaBeliTerakhir };
  else return null;

  if (baru.hppRata2 === lama.hppRata2 && baru.hargaBeliTerakhir === lama.hargaBeliTerakhir) {
    return null;
  }
  await tx
    .update(persediaan)
    .set({
      ...baru,
      // K-184: tanpa mutasi belum ada lapisan; harga FIFO mengikuti harga beli terakhir.
      ...(lama.terakhirMutasi === null ? { hargaFifo: baru.hargaBeliTerakhir } : {}),
      diubahPada: sekarang(),
    })
    .where(eq(persediaan.idBarang, idBarang));
  return {
    lama: { hppRata2: lama.hppRata2, hargaBeliTerakhir: lama.hargaBeliTerakhir },
    baru,
  };
}

// --- Ledger: catatMutasi (docs/05 §2) ---

/** Referensi dokumen sumber: tepat satu (CHECK chk_mutasi_ref). */
export type SumberMutasi =
  | { idPenerimaanDetail: number }
  | { idPenjualanDetail: number }
  | { idReturDetail: number }
  | { idVoidDetail: number }
  | { idPenyesuaianDetail: number }
  | { idReturPemasokDetail: number };

export type InputMutasi = {
  idBarang: number;
  jenis: JenisMutasi;
  kondisi?: KondisiStok;
  /** Tepat satu dari `qtyMasuk` / `qtyKeluar` diisi (> 0), dalam satuan dasar. */
  qtyMasuk?: string;
  qtyKeluar?: string;
  /** L5: wajib untuk SALDO_AWAL, PENERIMAAN, RETUR_JUAL, VOID; selain itu = `hpp_rata2` saat itu. */
  hppSatuan?: number;
  /** L6: PENERIMAAN jenis PEMBELIAN memperbarui harga & tanggal beli terakhir. */
  pembelian?: boolean;
  sumber: SumberMutasi;
  idPengguna: number;
  tanggalOperasional: string;
  keterangan?: string | null;
};

export type HasilMutasi = {
  idMutasi: number;
  saldoSetelah: string;
  hppSetelah: number;
  hppSatuan: number;
};

/** Jenis yang memakai `hppSatuan` dari pemanggil (L5); selainnya memakai `hpp_rata2` saat itu. */
const HPP_DARI_PEMANGGIL: readonly JenisMutasi[] = [
  'SALDO_AWAL',
  'PENERIMAAN',
  'RETUR_JUAL',
  'VOID',
];

/** Nomor order MENUNGGU/DIPROSES/DISIMPAN yang menahan stok barang (pesan A6/K-048, K-122). */
async function orderPenahan(tx: Tx, idBarang: number): Promise<string[]> {
  const baris = await tx
    .selectDistinct({ nomor: orderPenjualan.nomor })
    .from(orderPenjualanDetail)
    .innerJoin(orderPenjualan, eq(orderPenjualan.id, orderPenjualanDetail.idOrder))
    .where(
      and(
        eq(orderPenjualanDetail.idBarang, idBarang),
        inArray(orderPenjualan.status, ['MENUNGGU', 'DIPROSES', 'DISIMPAN']),
      ),
    );
  return baris.map((b) => b.nomor);
}

/**
 * SATU-SATUNYA jalan mengubah stok (CLAUDE.md aturan 2). Di dalam `tx` (L1): mengunci baris persediaan,
 * menolak saldo negatif (L2) dan fisik di bawah stok dipesan (A6/K-048), menghitung HPP rata-rata tertimbang
 * untuk barang milik sendiri yang masuk ke bucket BAIK (L4), lalu menulis satu baris ledger (L3).
 */
export async function catatMutasi(tx: Tx, m: InputMutasi): Promise<HasilMutasi> {
  const kondisi = m.kondisi ?? 'BAIK';
  const masuk = m.qtyMasuk !== undefined;
  const qty = keQty(m.qtyMasuk ?? m.qtyKeluar ?? '0');
  if (masuk === (m.qtyKeluar !== undefined) || bandingQty(qty, 0) <= 0) {
    throw new Error('catatMutasi: tepat satu dari qtyMasuk/qtyKeluar harus > 0');
  }
  if (HPP_DARI_PEMANGGIL.includes(m.jenis) && m.hppSatuan === undefined) {
    throw new Error(`catatMutasi: hppSatuan wajib untuk ${m.jenis}`);
  }

  const p = await kunciPersediaan(tx, m.idBarang);
  const [b] = await tx
    .select({
      namaBarang: barang.namaBarang,
      kepemilikan: barang.kepemilikan,
      hargaTitip: barang.hargaTitip,
      kodeSatuan: satuan.kode,
    })
    .from(barang)
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(barang.id, m.idBarang));
  if (!b) throw new Error(`Barang ${m.idBarang} tidak ada`);

  const saldoLama = kondisi === 'BAIK' ? p.stokFisik : p.stokRusak;
  if (!masuk && bandingQty(qty, saldoLama) > 0) {
    throw new AppError(
      'STOK_TIDAK_CUKUP',
      `Stok ${b.namaBarang}${kondisi === 'RUSAK' ? ' (rusak)' : ''} tidak cukup: ` +
        `tersedia ${teksQty(saldoLama)} ${b.kodeSatuan}, diminta ${teksQty(qty)} ${b.kodeSatuan}.`,
      409,
      { idBarang: m.idBarang, saldo: saldoLama, diminta: qty },
    );
  }
  const saldoBaru = masuk ? tambahQty(saldoLama, qty) : kurangQty(saldoLama, qty);
  if (kondisi === 'BAIK' && !masuk && bandingQty(saldoBaru, p.stokDipesan) < 0) {
    const nomor = await orderPenahan(tx, m.idBarang);
    throw new AppError(
      'KONFLIK',
      `Stok fisik ${b.namaBarang} tidak boleh di bawah stok yang dipesan ` +
        `(${teksQty(p.stokDipesan)} ${b.kodeSatuan}). ` +
        `Batalkan atau selesaikan dulu order: ${nomor.join(', ') || '-'}.`,
      409,
      { idBarang: m.idBarang, orderPenahan: nomor },
    );
  }

  const hppSatuan = m.hppSatuan ?? p.hppRata2;
  let hppBaru = p.hppRata2;
  if (b.kepemilikan === 'KONSINYASI') {
    hppBaru = b.hargaTitip ?? 0; // L7
  } else if (masuk && kondisi === 'BAIK') {
    // L4: rata-rata tertimbang atas saldo bucket BAIK sebelum mutasi.
    hppBaru = hppRataRata(p.stokFisik, p.hppRata2, qty, hppSatuan);
  }

  const waktu = sekarang();
  const perubahan: Partial<typeof persediaan.$inferInsert> = {
    hppRata2: hppBaru,
    terakhirMutasi: waktu,
    diubahPada: waktu,
    ...(kondisi === 'BAIK' ? { stokFisik: saldoBaru } : { stokRusak: saldoBaru }),
  };
  if (m.jenis === 'PENERIMAAN' && m.pembelian) {
    // L6: harga beli terakhir. Akibatnya pada harga jual (tanda tinjau H5 / harga otomatis H7) diputuskan
    // pemanggil lewat `tanggapiPerubahanDasar()` di transaksi yang sama (K-086).
    perubahan.hargaBeliTerakhir = hppSatuan;
    perubahan.tanggalBeliTerakhir = m.tanggalOperasional;
  }
  await tx.update(persediaan).set(perubahan).where(eq(persediaan.idBarang, m.idBarang));

  const [baris] = await tx
    .insert(mutasiPersediaan)
    .values({
      idBarang: m.idBarang,
      waktu,
      tanggalOperasional: m.tanggalOperasional,
      jenisMutasi: m.jenis,
      kondisi,
      qtyMasuk: masuk ? qty : '0',
      qtyKeluar: masuk ? '0' : qty,
      saldoSetelah: saldoBaru,
      hppSatuan,
      hppSetelah: hppBaru,
      ...m.sumber,
      idPengguna: m.idPengguna,
      keterangan: m.keterangan ?? null,
    })
    .returning({ id: mutasiPersediaan.id });
  if (!baris) throw new Error('insert mutasi tidak mengembalikan id');

  // K-184 L12: cache harga FIFO diselaraskan di transaksi yang sama (aturan 15). Bila dasar markup toko FIFO dan
  // angkanya berubah (mis. stok lama habis terjual), harga jual barang ini ditanggapi seperti pemicu H5/H7.
  if (kondisi === 'BAIK') {
    const stokBaik = saldoBaru;
    const fifo = await hitungHargaFifo(
      tx,
      m.idBarang,
      stokBaik,
      perubahan.hargaBeliTerakhir ?? p.hargaBeliTerakhir,
    );
    if (fifo !== p.hargaFifo) {
      await tx
        .update(persediaan)
        .set({ hargaFifo: fifo })
        .where(eq(persediaan.idBarang, m.idBarang));
      const konteks = await muatKonteksHarga(tx);
      if (konteks.modeDasar === 'FIFO' && b.kepemilikan === 'MILIK_SENDIRI') {
        await tanggapiPemicuHarga(tx, [m.idBarang], {
          sebab: `lapisan stok FIFO berubah (${m.jenis.toLowerCase().replace(/_/g, ' ')})`,
          idPengguna: m.idPengguna,
          konteks,
        });
      }
    }
  }
  return { idMutasi: baris.id, saldoSetelah: saldoBaru, hppSetelah: hppBaru, hppSatuan };
}

// --- Reservasi order (R2–R6, K-006) ---

export type PerubahanReservasi = { idBarang: number; delta: string };

/**
 * SATU-SATUNYA jalan mengubah `stok_dipesan` (CLAUDE.md aturan 2). Di dalam `tx`: mengunci baris persediaan
 * berurutan id barang (mencegah deadlock antar-transaksi), memeriksa semua penambahan terhadap stok tersedia,
 * lalu menerapkan. Bila ada barang yang kurang, tidak ada yang diubah dan pesan menyebut SEMUA barang itu (R3).
 * Delta negatif = melepas reservasi (batal, checkout, baris dikurangi).
 */
export async function ubahReservasi(tx: Tx, perubahan: PerubahanReservasi[]): Promise<void> {
  const gabung = new Map<number, string>();
  for (const p of perubahan)
    gabung.set(p.idBarang, tambahQty(gabung.get(p.idBarang) ?? '0', p.delta));
  const urut = [...gabung.entries()]
    .filter(([, d]) => bandingQty(d, 0) !== 0)
    .sort(([a], [b]) => a - b);
  const kurang: {
    idBarang: number;
    nama: string;
    kodeSatuan: string;
    tersedia: string;
    diminta: string;
  }[] = [];
  const baru: { idBarang: number; dipesan: string }[] = [];
  for (const [idBarang, delta] of urut) {
    const p = await kunciPersediaan(tx, idBarang);
    const dipesan = tambahQty(p.stokDipesan, delta);
    if (bandingQty(dipesan, 0) < 0) {
      throw new Error(`ubahReservasi: stok_dipesan barang ${idBarang} menjadi negatif`);
    }
    if (bandingQty(delta, 0) > 0) {
      const tersedia = kurangQty(p.stokFisik, p.stokDipesan);
      if (bandingQty(delta, tersedia) > 0) {
        const [b] = await tx
          .select({ nama: barang.namaBarang, kodeSatuan: satuan.kode })
          .from(barang)
          .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
          .where(eq(barang.id, idBarang));
        kurang.push({
          idBarang,
          nama: b?.nama ?? `#${idBarang}`,
          kodeSatuan: b?.kodeSatuan ?? '',
          tersedia,
          diminta: keQty(delta),
        });
      }
    }
    baru.push({ idBarang, dipesan });
  }
  if (kurang.length > 0) {
    throw new AppError(
      'STOK_TIDAK_CUKUP',
      `Stok tersedia tidak cukup: ${kurang
        .map(
          (k) =>
            `${k.nama} (tersedia ${teksQty(k.tersedia)} ${k.kodeSatuan}, ` +
            `diminta ${teksQty(k.diminta)} ${k.kodeSatuan})`,
        )
        .join('; ')}.`,
      409,
      { barang: kurang },
    );
  }
  const waktu = sekarang();
  for (const b of baru) {
    await tx
      .update(persediaan)
      .set({ stokDipesan: b.dipesan, diubahPada: waktu })
      .where(eq(persediaan.idBarang, b.idBarang));
  }
}

// --- L9: hitung ulang cache dari ledger ---

export type HasilAudit = {
  idBarang: number;
  cocok: boolean;
  cache: { stokFisik: string; stokRusak: string; stokDipesan: string; hppRata2: number };
  ledger: { stokFisik: string; stokRusak: string; stokDipesan: string; hppRata2: number };
  masalah: string[];
};

/**
 * L9: menghitung `stok_fisik`, `stok_rusak`, dan `hpp_rata2` dari ledger lalu membandingkannya dengan cache
 * `persediaan`. Juga memeriksa rantai `saldo_setelah` dan rumus HPP (L4) baris demi baris. Selisih = bug.
 */
export async function hitungUlangCache(ex: Executor, idBarang: number): Promise<HasilAudit> {
  const [p] = await ex
    .select({
      stokFisik: persediaan.stokFisik,
      stokRusak: persediaan.stokRusak,
      stokDipesan: persediaan.stokDipesan,
      hppRata2: persediaan.hppRata2,
      hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
      hargaFifo: persediaan.hargaFifo,
      kepemilikan: barang.kepemilikan,
      hargaModalAwal: barang.hargaModalAwal,
    })
    .from(persediaan)
    .innerJoin(barang, eq(barang.id, persediaan.idBarang))
    .where(eq(persediaan.idBarang, idBarang));
  if (!p) throw new Error(`Persediaan barang ${idBarang} tidak ada`);
  const daftar = await ex
    .select()
    .from(mutasiPersediaan)
    .where(eq(mutasiPersediaan.idBarang, idBarang))
    .orderBy(asc(mutasiPersediaan.id));

  const masalah: string[] = [];
  const saldo: Record<KondisiStok, string> = { BAIK: '0.000', RUSAK: '0.000' };
  let hpp = p.kepemilikan === 'KONSINYASI' ? p.hppRata2 : p.hargaModalAwal;
  for (const r of daftar) {
    const lama = saldo[r.kondisi];
    saldo[r.kondisi] = kurangQty(tambahQty(lama, r.qtyMasuk), r.qtyKeluar);
    if (bandingQty(saldo[r.kondisi], r.saldoSetelah) !== 0) {
      masalah.push(
        `Mutasi #${r.id}: saldo_setelah ${r.saldoSetelah}, seharusnya ${saldo[r.kondisi]}.`,
      );
    }
    if (p.kepemilikan === 'MILIK_SENDIRI') {
      if (r.kondisi === 'BAIK' && bandingQty(r.qtyMasuk, 0) > 0) {
        hpp = hppRataRata(lama, hpp, r.qtyMasuk, r.hppSatuan);
      }
      if (r.hppSetelah !== hpp) {
        masalah.push(`Mutasi #${r.id}: hpp_setelah ${r.hppSetelah}, seharusnya ${hpp}.`);
      }
    } else {
      hpp = r.hppSetelah;
    }
  }
  // R2: stok dipesan = Σ qty_dasar baris order MENUNGGU/DIPROSES/DISIMPAN (K-122).
  const [tahan] = await ex
    .select({
      qty: sql<string>`coalesce(sum(${orderPenjualanDetail.qtyDasar}), 0)::text`,
    })
    .from(orderPenjualanDetail)
    .innerJoin(orderPenjualan, eq(orderPenjualan.id, orderPenjualanDetail.idOrder))
    .where(
      and(
        eq(orderPenjualanDetail.idBarang, idBarang),
        inArray(orderPenjualan.status, ['MENUNGGU', 'DIPROSES', 'DISIMPAN']),
      ),
    );
  const ledger = {
    stokFisik: saldo.BAIK,
    stokRusak: saldo.RUSAK,
    stokDipesan: keQty(tahan?.qty ?? '0'),
    hppRata2: p.kepemilikan === 'KONSINYASI' || daftar.length === 0 ? p.hppRata2 : hpp,
  };
  const cache = {
    stokFisik: p.stokFisik,
    stokRusak: p.stokRusak,
    stokDipesan: p.stokDipesan,
    hppRata2: p.hppRata2,
  };
  if (bandingQty(cache.stokDipesan, ledger.stokDipesan) !== 0) {
    masalah.push(`stok_dipesan ${cache.stokDipesan}, order ${ledger.stokDipesan}.`);
  }
  if (bandingQty(cache.stokFisik, ledger.stokFisik) !== 0) {
    masalah.push(`stok_fisik ${cache.stokFisik}, ledger ${ledger.stokFisik}.`);
  }
  if (bandingQty(cache.stokRusak, ledger.stokRusak) !== 0) {
    masalah.push(`stok_rusak ${cache.stokRusak}, ledger ${ledger.stokRusak}.`);
  }
  if (cache.hppRata2 !== ledger.hppRata2) {
    masalah.push(`hpp_rata2 ${cache.hppRata2}, ledger ${ledger.hppRata2}.`);
  }
  // K-184 L12: harga FIFO dari ledger.
  const fifo = await hitungHargaFifo(ex, idBarang, ledger.stokFisik, p.hargaBeliTerakhir);
  if (p.hargaFifo !== fifo) masalah.push(`harga_fifo ${p.hargaFifo}, ledger ${fifo}.`);
  return { idBarang, cocok: masalah.length === 0, cache, ledger, masalah };
}
