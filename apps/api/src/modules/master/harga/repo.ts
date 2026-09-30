import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { MetodeHarga } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { barang, hargaBarang, persediaan, tingkatHarga } from '../../../db/schema';

/** Data untuk menghitung dasar markup `D` (docs/06 H3) per barang. */
export const kolomDasar = {
  id: barang.id,
  namaBarang: barang.namaBarang,
  kepemilikan: barang.kepemilikan,
  hargaModalAwal: barang.hargaModalAwal,
  hargaTitip: barang.hargaTitip,
  hppRata2: persediaan.hppRata2,
  hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
  tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
};

export async function dataDasar(ex: Executor, idBarang: number[]) {
  if (idBarang.length === 0) return [];
  return ex
    .select(kolomDasar)
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(inArray(barang.id, idBarang));
}

export function semuaDataDasar(ex: Executor) {
  return ex
    .select(kolomDasar)
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id));
}

export function semuaTier(ex: Executor) {
  return ex
    .select({
      id: tingkatHarga.id,
      nama: tingkatHarga.nama,
      markupDefaultPersen: tingkatHarga.markupDefaultPersen,
      isDefault: tingkatHarga.isDefault,
      statusAktif: tingkatHarga.statusAktif,
    })
    .from(tingkatHarga);
}

/** Harga per satuan dasar (satuan jual null) untuk sekumpulan barang. */
export async function hargaBarangDasar(ex: Executor, idBarang: number[]) {
  if (idBarang.length === 0) return [];
  return ex
    .select({
      id: hargaBarang.id,
      idBarang: hargaBarang.idBarang,
      idTingkatHarga: hargaBarang.idTingkatHarga,
      metode: hargaBarang.metode,
      hargaTetap: hargaBarang.hargaTetap,
      hargaJual: hargaBarang.hargaJual,
      dasarMarkupSaatHitung: hargaBarang.dasarMarkupSaatHitung,
    })
    .from(hargaBarang)
    .where(and(inArray(hargaBarang.idBarang, idBarang), isNull(hargaBarang.idSatuanJual)));
}

/** Mengunci baris harga barang selama transaksi (simpan harga serentak tidak saling menimpa). */
export async function kunciHargaBarang(tx: Tx, idBarang: number) {
  return tx
    .select({
      id: hargaBarang.id,
      idTingkatHarga: hargaBarang.idTingkatHarga,
      metode: hargaBarang.metode,
      hargaTetap: hargaBarang.hargaTetap,
      hargaJual: hargaBarang.hargaJual,
    })
    .from(hargaBarang)
    .where(and(eq(hargaBarang.idBarang, idBarang), isNull(hargaBarang.idSatuanJual)))
    .for('update');
}

export type NilaiHarga = {
  metode: MetodeHarga;
  markupPersen: string | null;
  hargaTetap: number | null;
  hargaJual: number;
  dasarMarkupSaatHitung: number | null;
};

export async function tambahHarga(
  tx: Tx,
  baris: (NilaiHarga & { idBarang: number; idTingkatHarga: number; idPengguna: number | null })[],
): Promise<void> {
  // Per 1000 baris agar tidak melewati batas parameter PostgreSQL. Baris yang sudah ada (mis. tier
  // diaktifkan kembali) dibiarkan (uq_harga_barang).
  for (let i = 0; i < baris.length; i += 1000) {
    await tx
      .insert(hargaBarang)
      .values(baris.slice(i, i + 1000))
      .onConflictDoNothing();
  }
}

export async function ubahHarga(
  tx: Tx,
  id: number,
  nilai: NilaiHarga & { idPengguna: number },
  waktu: Date,
): Promise<void> {
  await tx
    .update(hargaBarang)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(hargaBarang.id, id));
}

/** H5: tandai barang yang punya baris IKUT_TIER pada tier ini (markup default tier berubah). */
export async function tandaiTinjauUntukTier(tx: Tx, idTingkatHarga: number): Promise<number> {
  const hasil = await tx
    .update(barang)
    .set({ perluTinjauHarga: true })
    .where(
      inArray(
        barang.id,
        tx
          .select({ id: hargaBarang.idBarang })
          .from(hargaBarang)
          .where(
            and(
              eq(hargaBarang.idTingkatHarga, idTingkatHarga),
              eq(hargaBarang.metode, 'IKUT_TIER'),
            ),
          ),
      ),
    )
    .returning({ id: barang.id });
  return hasil.length;
}

export async function aturTandaTinjau(tx: Tx, idBarang: number[], nilai: boolean): Promise<void> {
  if (idBarang.length === 0) return;
  await tx
    .update(barang)
    .set({ perluTinjauHarga: nilai })
    .where(and(inArray(barang.id, idBarang), sql`${barang.perluTinjauHarga} <> ${nilai}`));
}
