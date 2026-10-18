import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { StatusShift } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  clericalCheck,
  hitungKas,
  kasShift,
  orderPenjualan,
  pembayaranPemasok,
  pembayaranPenjualan,
  pengguna,
  penjualan,
  returPenjualan,
  shiftKasir,
  voidTransaksi,
} from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';

const namaPemeriksa = sql<string | null>`(select p.nama_pengguna from ${pengguna} p
  where p.id = ${kolomPenuh(clericalCheck.idPengguna)})`;

const kolom = {
  id: shiftKasir.id,
  nomor: shiftKasir.nomor,
  idKasir: shiftKasir.idKasir,
  namaKasir: pengguna.namaPengguna,
  tanggalOperasional: shiftKasir.tanggalOperasional,
  waktuBuka: shiftKasir.waktuBuka,
  waktuTutup: shiftKasir.waktuTutup,
  modalAwal: shiftKasir.modalAwal,
  status: shiftKasir.status,
  jadwalBuka: shiftKasir.jadwalBuka,
  jadwalTutup: shiftKasir.jadwalTutup,
  clcNomor: clericalCheck.nomor,
  clcTanggal: clericalCheck.tanggal,
  clcModalAwal: clericalCheck.modalAwal,
  clcTunaiPenjualan: clericalCheck.tunaiPenjualan,
  clcKasMasukLain: clericalCheck.kasMasukLain,
  clcKasKeluar: clericalCheck.kasKeluar,
  clcSaldoSistem: clericalCheck.saldoSistem,
  clcUangFisik: clericalCheck.uangFisik,
  clcSelisih: clericalCheck.selisih,
  clcKeterangan: clericalCheck.keterangan,
  clcNamaPemeriksa: namaPemeriksa,
  clcUangDitinggal: clericalCheck.uangDitinggal,
  clcKoreksiModal: clericalCheck.koreksiModal,
  clcToleransi: clericalCheck.toleransi,
  clcJumlahHitung: clericalCheck.jumlahHitung,
  clcPenjelasan: clericalCheck.penjelasanAtasan,
  clcDijelaskanPada: clericalCheck.dijelaskanPada,
  clcDijelaskanOleh: sql<string | null>`(select p.nama_pengguna from ${pengguna} p
    where p.id = ${kolomPenuh(clericalCheck.dijelaskanOleh)})`,
  caraBuka: shiftKasir.caraBuka,
  hitungBukaPada: shiftKasir.hitungBukaPada,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(shiftKasir)
    .innerJoin(pengguna, eq(pengguna.id, shiftKasir.idKasir))
    .leftJoin(clericalCheck, eq(clericalCheck.idShift, shiftKasir.id));
}

/**
 * K-109: shift BUKA yang perlu ditutup pada saat `kini`: dari hari operasional sebelum `hariIni`, atau sudah
 * melewati jam tutup yang dibekukan saat shift dibuka.
 */
export function perluDitutup(hariIni: string, kini: Date): SQL {
  return and(
    ne(shiftKasir.status, 'TUTUP'),
    or(
      lt(shiftKasir.tanggalOperasional, hariIni),
      sql`(${shiftKasir.jadwalTutup} is not null and ((${shiftKasir.tanggalOperasional} + ${shiftKasir.jadwalTutup}::time) at time zone 'Asia/Jakarta') <= ${kini.toISOString()}::timestamptz)`,
    ),
  ) as SQL;
}

export type SaringShift = {
  status?: StatusShift | undefined;
  /** Hanya yang perlu ditutup (K-109); butuh `hariIni` dan `kini`. */
  perluDitutup?: { hariIni: string; kini: Date } | undefined;
  idKasir?: number | undefined;
  dari?: string | undefined;
  sampai?: string | undefined;
  adaSelisih?: boolean | undefined;
};

function syarat(p: SaringShift): SQL | undefined {
  return and(
    p.status ? eq(shiftKasir.status, p.status) : undefined,
    p.perluDitutup ? perluDitutup(p.perluDitutup.hariIni, p.perluDitutup.kini) : undefined,
    p.idKasir === undefined ? undefined : eq(shiftKasir.idKasir, p.idKasir),
    p.dari ? gte(shiftKasir.tanggalOperasional, p.dari) : undefined,
    p.sampai ? lte(shiftKasir.tanggalOperasional, p.sampai) : undefined,
    p.adaSelisih ? ne(clericalCheck.selisih, 0) : undefined,
  );
}

export async function daftar(ex: Executor, p: SaringShift & { limit: number; offset: number }) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(shiftKasir.waktuBuka), desc(shiftKasir.id))
    .limit(p.limit)
    .offset(p.offset);
  const [h] = await ex
    .select({ total: count() })
    .from(shiftKasir)
    .leftJoin(clericalCheck, eq(clericalCheck.idShift, shiftKasir.id))
    .where(where);
  return { baris, total: h?.total ?? 0 };
}

/** Jumlah shift yang perlu ditutup (notifikasi atasan). */
export async function jumlahPerluDitutup(ex: Executor, hariIni: string, kini: Date) {
  const [h] = await ex
    .select({ total: count() })
    .from(shiftKasir)
    .where(perluDitutup(hariIni, kini));
  return h?.total ?? 0;
}

/** Shift yang perlu ditutup dan belum diingatkan hari ini (pengingat ke atasan, paling banyak sekali sehari). */
export function perluDiingatkan(ex: Executor, hariIni: string, kini: Date) {
  return ex
    .select({
      id: shiftKasir.id,
      nomor: shiftKasir.nomor,
      namaKasir: pengguna.namaPengguna,
      tanggalOperasional: shiftKasir.tanggalOperasional,
      waktuBuka: shiftKasir.waktuBuka,
      jadwalTutup: shiftKasir.jadwalTutup,
    })
    .from(shiftKasir)
    .innerJoin(pengguna, eq(pengguna.id, shiftKasir.idKasir))
    .where(
      and(
        perluDitutup(hariIni, kini),
        or(
          isNull(shiftKasir.diingatkanPada),
          sql`(${shiftKasir.diingatkanPada} at time zone 'Asia/Jakarta')::date < ${hariIni}::date`,
        ),
      ),
    )
    .orderBy(asc(shiftKasir.id));
}

export async function tandaiDiingatkan(ex: Executor, id: number, waktu: Date): Promise<void> {
  await ex.update(shiftKasir).set({ diingatkanPada: waktu }).where(eq(shiftKasir.id, id));
}

export async function byId(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(shiftKasir.id, id)).limit(1);
  return b;
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: shiftKasir.id,
      nomor: shiftKasir.nomor,
      idKasir: shiftKasir.idKasir,
      status: shiftKasir.status,
      modalAwal: shiftKasir.modalAwal,
      caraBuka: shiftKasir.caraBuka,
      hitungBukaPada: shiftKasir.hitungBukaPada,
      tanggalOperasional: shiftKasir.tanggalOperasional,
      modalUsulan: shiftKasir.modalUsulan,
      waktuBuka: shiftKasir.waktuBuka,
    })
    .from(shiftKasir)
    .where(eq(shiftKasir.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** K5: komponen saldo sistem shift (hanya nominal pembayaran tunai; kembalian sudah keluar dari laci). */
export async function komponenKas(ex: Executor, idShift: number) {
  const [tunai] = await ex
    .select({
      total: sql<number>`coalesce(sum(${pembayaranPenjualan.nominal}), 0)::bigint`.mapWith(Number),
      jumlah: count(),
    })
    .from(pembayaranPenjualan)
    .where(and(eq(pembayaranPenjualan.idShift, idShift), eq(pembayaranPenjualan.metode, 'TUNAI')));
  const [kas] = await ex
    .select({
      masuk: sql<number>`coalesce(sum(${kasShift.nominal}) filter (where ${kasShift.arah} = 'MASUK'
          and ${kasShift.jenis} not like 'KOREKSI_MODAL%'), 0)::bigint`.mapWith(Number),
      keluar:
        sql<number>`coalesce(sum(${kasShift.nominal}) filter (where ${kasShift.arah} = 'KELUAR'
          and ${kasShift.jenis} not like 'KOREKSI_MODAL%'), 0)::bigint`.mapWith(Number),
      koreksi: sql<number>`coalesce(sum(case ${kasShift.jenis}
          when 'KOREKSI_MODAL_TAMBAH' then ${kasShift.nominal}
          when 'KOREKSI_MODAL_KURANG' then -${kasShift.nominal} else 0 end), 0)::bigint`.mapWith(
        Number,
      ),
      jumlahKas:
        sql<number>`count(*) filter (where ${kasShift.jenis} not like 'KOREKSI_MODAL%')`.mapWith(
          Number,
        ),
    })
    .from(kasShift)
    .where(eq(kasShift.idShift, idShift));
  return {
    tunaiPenjualan: tunai?.total ?? 0,
    jumlahTransaksi: tunai?.jumlah ?? 0,
    kasMasukLain: kas?.masuk ?? 0,
    kasKeluar: kas?.keluar ?? 0,
    /** K-121: koreksi modal bersih (+/−); modal efektif = modal awal + koreksi. */
    koreksiModal: kas?.koreksi ?? 0,
    /** Sudah ada uang tunai yang bergerak (pembayaran tunai atau kas selain koreksi modal). */
    adaTransaksiTunai: (tunai?.jumlah ?? 0) + (kas?.jumlahKas ?? 0) > 0,
  };
}

const nomorSumber = sql<string | null>`coalesce(
  (select r.nomor from ${returPenjualan} r where r.id = ${kolomPenuh(kasShift.idRetur)}),
  (select v.nomor from ${voidTransaksi} v where v.id = ${kolomPenuh(kasShift.idVoid)}),
  (select b.nomor from ${pembayaranPemasok} b where b.id = ${kolomPenuh(kasShift.idPembayaranPemasok)}))`;

export function daftarKas(ex: Executor, idShift: number) {
  return ex
    .select({
      id: kasShift.id,
      waktu: kasShift.waktu,
      jenis: kasShift.jenis,
      arah: kasShift.arah,
      nominal: kasShift.nominal,
      keterangan: kasShift.keterangan,
      namaPengguna: pengguna.namaPengguna,
      nomorDokumen: nomorSumber,
    })
    .from(kasShift)
    .innerJoin(pengguna, eq(pengguna.id, kasShift.idPengguna))
    .where(eq(kasShift.idShift, idShift))
    .orderBy(asc(kasShift.id));
}

export async function tambahKas(tx: Tx, nilai: typeof kasShift.$inferInsert) {
  const [b] = await tx.insert(kasShift).values(nilai).returning({ id: kasShift.id });
  if (!b) throw new Error('insert kas_shift tidak mengembalikan id');
  return b.id;
}

export async function tambahClerical(tx: Tx, nilai: typeof clericalCheck.$inferInsert) {
  await tx.insert(clericalCheck).values(nilai);
}

export async function ubahStatus(tx: Tx, id: number, status: 'BUKA' | 'DIHITUNG', waktu: Date) {
  await tx.update(shiftKasir).set({ status, diubahPada: waktu }).where(eq(shiftKasir.id, id));
}

export async function tandaiHitungBuka(tx: Tx, id: number, waktu: Date) {
  await tx
    .update(shiftKasir)
    .set({ hitungBukaPada: waktu, diubahPada: waktu })
    .where(eq(shiftKasir.id, id));
}

/** K-121: uang ditinggal di laci menurut shift yang terakhir ditutup (satu laci untuk toko). */
export async function usulanBuka(ex: Executor) {
  const [b] = await ex
    .select({
      uangDitinggal: clericalCheck.uangDitinggal,
      nomorShift: shiftKasir.nomor,
      namaKasir: pengguna.namaPengguna,
      waktuTutup: shiftKasir.waktuTutup,
    })
    .from(clericalCheck)
    .innerJoin(shiftKasir, eq(shiftKasir.id, clericalCheck.idShift))
    .innerJoin(pengguna, eq(pengguna.id, shiftKasir.idKasir))
    .orderBy(desc(clericalCheck.tanggal), desc(clericalCheck.id))
    .limit(1);
  return b ?? null;
}

export async function tambahHitung(tx: Tx, nilai: typeof hitungKas.$inferInsert) {
  await tx.insert(hitungKas).values(nilai);
}

export function daftarHitung(ex: Executor, idShift: number) {
  return ex
    .select({
      jenis: hitungKas.jenis,
      waktu: hitungKas.waktu,
      uangFisik: hitungKas.uangFisik,
      rincian: hitungKas.rincian,
      saldoSistem: hitungKas.saldoSistem,
      namaPengguna: pengguna.namaPengguna,
    })
    .from(hitungKas)
    .innerJoin(pengguna, eq(pengguna.id, hitungKas.idPengguna))
    .where(eq(hitungKas.idShift, idShift))
    .orderBy(asc(hitungKas.id));
}

/** Pembayaran yang dicatat di shift ini (semua metode), dengan nomor penjualannya. */
export function pembayaranShift(ex: Executor, idShift: number) {
  return ex
    .select({
      tanggal: pembayaranPenjualan.tanggal,
      metode: pembayaranPenjualan.metode,
      nominal: pembayaranPenjualan.nominal,
      uangDiterima: pembayaranPenjualan.uangDiterima,
      kembalian: pembayaranPenjualan.kembalian,
      nomorPembayaran: pembayaranPenjualan.nomor,
      nomorPenjualan: penjualan.nomor,
    })
    .from(pembayaranPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, pembayaranPenjualan.idPenjualan))
    .where(eq(pembayaranPenjualan.idShift, idShift))
    .orderBy(asc(pembayaranPenjualan.tanggal), asc(pembayaranPenjualan.id));
}

/** Penjualan yang dibuat di shift ini per jenis (tidak termasuk yang di-void penuh). */
export function penjualanShift(ex: Executor, idShift: number) {
  return ex
    .select({
      jenis: penjualan.jenisPenjualan,
      jumlah: count(),
      total: sql<number>`coalesce(sum(${penjualan.totalNeto}), 0)::bigint`.mapWith(Number),
    })
    .from(penjualan)
    .where(and(eq(penjualan.idShift, idShift), ne(penjualan.statusTransaksi, 'VOID')))
    .groupBy(penjualan.jenisPenjualan);
}

export async function isiPenjelasan(
  tx: Tx,
  idShift: number,
  p: { penjelasan: string; oleh: number; waktu: Date },
) {
  await tx
    .update(clericalCheck)
    .set({ penjelasanAtasan: p.penjelasan, dijelaskanOleh: p.oleh, dijelaskanPada: p.waktu })
    .where(eq(clericalCheck.idShift, idShift));
}

export async function tutup(tx: Tx, id: number, waktu: Date) {
  await tx
    .update(shiftKasir)
    .set({ status: 'TUTUP', waktuTutup: waktu, diubahPada: waktu })
    .where(eq(shiftKasir.id, id));
}

/** K6 + K-132: semua order yang masih DIPROSES (kasir mana pun) kembali ke antrean saat shift toko ditutup. */
export async function lepasOrderDiproses(tx: Tx, waktu: Date) {
  return tx
    .update(orderPenjualan)
    .set({ status: 'MENUNGGU', idKasirProses: null, diubahPada: waktu })
    .where(eq(orderPenjualan.status, 'DIPROSES'))
    .returning({ nomor: orderPenjualan.nomor });
}

/** K-132: semua shift yang belum ditutup (seharusnya paling banyak satu), urut paling lama dibuka. */
export function shiftTerbuka(ex: Executor) {
  return ex
    .select({
      id: shiftKasir.id,
      nomor: shiftKasir.nomor,
      status: shiftKasir.status,
      tanggalOperasional: shiftKasir.tanggalOperasional,
      waktuBuka: shiftKasir.waktuBuka,
      modalAwal: shiftKasir.modalAwal,
      jadwalBuka: shiftKasir.jadwalBuka,
      jadwalTutup: shiftKasir.jadwalTutup,
      caraBuka: shiftKasir.caraBuka,
      batasHitungBuka: shiftKasir.batasHitungBuka,
      hitungBukaPada: shiftKasir.hitungBukaPada,
      modalUsulan: shiftKasir.modalUsulan,
      namaPembuka: pengguna.namaPengguna,
    })
    .from(shiftKasir)
    .innerJoin(pengguna, eq(pengguna.id, shiftKasir.idKasir))
    .where(ne(shiftKasir.status, 'TUTUP'))
    .orderBy(asc(shiftKasir.waktuBuka), asc(shiftKasir.id));
}

/** K-142: pengajuan retur/void yang masih menunggu persetujuan (uangnya belum keluar dari laci). */
export async function pengajuanMenunggu(ex: Executor) {
  const pengaju = (kolomPengaju: SQL) =>
    sql<string>`(select p.nama_pengguna from ${pengguna} p where p.id = ${kolomPengaju})`;
  const retur = await ex
    .select({
      id: returPenjualan.id,
      nomor: returPenjualan.nomor,
      nomorPenjualan: penjualan.nomor,
      nilai: returPenjualan.totalRetur,
      namaPengaju: pengaju(sql`${kolomPenuh(returPenjualan.idPengaju)}`),
      tanggal: returPenjualan.tanggal,
    })
    .from(returPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, returPenjualan.idPenjualan))
    .where(eq(returPenjualan.status, 'MENUNGGU'))
    .orderBy(asc(returPenjualan.tanggal));
  const v = await ex
    .select({
      id: voidTransaksi.id,
      nomor: voidTransaksi.nomor,
      nomorPenjualan: penjualan.nomor,
      nilai: voidTransaksi.nominalVoid,
      namaPengaju: pengaju(sql`${kolomPenuh(voidTransaksi.idPengaju)}`),
      tanggal: voidTransaksi.tanggal,
    })
    .from(voidTransaksi)
    .innerJoin(penjualan, eq(penjualan.id, voidTransaksi.idPenjualan))
    .where(eq(voidTransaksi.status, 'MENUNGGU'))
    .orderBy(asc(voidTransaksi.tanggal));
  return { retur, void: v };
}
