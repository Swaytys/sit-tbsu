import { and, asc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import type { Executor, Tx } from '../../../db/client';
import { barang, barangSatuanJual, hargaBarang, satuan } from '../../../db/schema';

/** Satuan jual sekumpulan barang (aktif dan nonaktif), urut faktor. */
export function satuanJualBarang(ex: Executor, idBarang: number[]) {
  if (idBarang.length === 0) return Promise.resolve([]);
  return ex
    .select({
      id: barangSatuanJual.id,
      idBarang: barangSatuanJual.idBarang,
      idSatuan: barangSatuanJual.idSatuan,
      kodeSatuan: satuan.kode,
      namaSatuan: satuan.nama,
      faktor: barangSatuanJual.faktorKeDasar,
      barcode: barangSatuanJual.barcode,
      isDefaultJual: barangSatuanJual.isDefaultJual,
      statusAktif: barangSatuanJual.statusAktif,
    })
    .from(barangSatuanJual)
    .innerJoin(satuan, eq(satuan.id, barangSatuanJual.idSatuan))
    .where(inArray(barangSatuanJual.idBarang, idBarang))
    .orderBy(asc(barangSatuanJual.faktorKeDasar), asc(barangSatuanJual.id));
}

/** Harga satuan jual yang ditetapkan (metode TETAP). Baris lain = otomatis dari satuan dasar. */
export function hargaTetapSatuanJual(ex: Executor, idBarang: number[]) {
  if (idBarang.length === 0) return Promise.resolve([]);
  return ex
    .select({
      id: hargaBarang.id,
      idBarang: hargaBarang.idBarang,
      idSatuanJual: hargaBarang.idSatuanJual,
      idTingkatHarga: hargaBarang.idTingkatHarga,
      metode: hargaBarang.metode,
      hargaTetap: hargaBarang.hargaTetap,
    })
    .from(hargaBarang)
    .where(and(inArray(hargaBarang.idBarang, idBarang), isNotNull(hargaBarang.idSatuanJual)));
}

/** Barcode satuan jual yang sama persis dengan teks (pindai barcode dus, dsb.). */
export async function satuanJualDariBarcode(ex: Executor, barcode: string) {
  const [b] = await ex
    .select({ id: barangSatuanJual.id, idBarang: barangSatuanJual.idBarang })
    .from(barangSatuanJual)
    .where(and(eq(barangSatuanJual.barcode, barcode), eq(barangSatuanJual.statusAktif, 'AKTIF')))
    .limit(1);
  return b;
}

/** Barcode dipakai barang lain atau satuan jual lain. */
export async function barcodeTerpakai(
  ex: Executor,
  barcode: string,
  kecualiIdSatuanJual: number | null,
) {
  const [b] = await ex
    .select({ id: barang.id })
    .from(barang)
    .where(eq(barang.barcode, barcode))
    .limit(1);
  if (b) return true;
  const [s] = await ex
    .select({ id: barangSatuanJual.id })
    .from(barangSatuanJual)
    .where(
      and(
        eq(barangSatuanJual.barcode, barcode),
        kecualiIdSatuanJual === null ? undefined : ne(barangSatuanJual.id, kecualiIdSatuanJual),
      ),
    )
    .limit(1);
  return s !== undefined;
}

export async function tambah(tx: Tx, nilai: typeof barangSatuanJual.$inferInsert) {
  const [b] = await tx
    .insert(barangSatuanJual)
    .values(nilai)
    .returning({ id: barangSatuanJual.id });
  if (!b) throw new Error('insert satuan jual tidak mengembalikan id');
  return b.id;
}

export async function ubah(
  tx: Tx,
  id: number,
  nilai: Partial<typeof barangSatuanJual.$inferInsert>,
) {
  await tx.update(barangSatuanJual).set(nilai).where(eq(barangSatuanJual.id, id));
}

/** Simpan harga satuan jual per tier: TETAP dengan harga, atau kembali otomatis (IKUT_TIER). */
export async function aturHarga(
  tx: Tx,
  nilai: {
    idBarang: number;
    idSatuanJual: number;
    idTingkatHarga: number;
    hargaTetap: number | null;
    /** Harga hasil hitung saat ini (kolom wajib; untuk baris otomatis tidak dipakai saat membaca). */
    hargaJual: number;
    waktu: Date;
  },
) {
  const isi =
    nilai.hargaTetap === null
      ? { metode: 'IKUT_TIER' as const, hargaTetap: null, hargaJual: nilai.hargaJual }
      : { metode: 'TETAP' as const, hargaTetap: nilai.hargaTetap, hargaJual: nilai.hargaTetap };
  await tx
    .insert(hargaBarang)
    .values({
      idBarang: nilai.idBarang,
      idSatuanJual: nilai.idSatuanJual,
      idTingkatHarga: nilai.idTingkatHarga,
      markupPersen: null,
      ...isi,
    })
    .onConflictDoUpdate({
      target: [hargaBarang.idBarang, hargaBarang.idTingkatHarga, hargaBarang.idSatuanJual],
      set: { ...isi, markupPersen: null, diubahPada: nilai.waktu },
    });
}
