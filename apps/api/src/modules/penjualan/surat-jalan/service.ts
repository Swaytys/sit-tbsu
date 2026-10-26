import { eq } from 'drizzle-orm';
import {
  bagiQty,
  bandingQty,
  formatRupiah,
  hargaSatuanEfektif,
  keQty,
  subtotalRupiah,
  tambahQty,
  teksQty,
  kurangQty,
  type BarisSuratJalan,
  type DataHasilSuratJalan,
  type DataSuratJalan,
  type HasilSuratJalan,
  type KondisiRetur,
  type MetaHalaman,
  type PerluDikirim,
  type StatusPengiriman,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import {
  penjualan,
  suratJalan,
  suratJalanDetail,
  suratJalanHasil,
  suratJalanHasilDetail,
} from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import * as armadaRepo from '../../master/armada/repo';
import * as returRepo from '../../koreksi/retur/repo';
import { ajukanReturTx } from '../../koreksi/retur/service';
import { hitungTagihan } from '../pembayaran';
import * as perjalananRepo from '../perjalanan/repo';
import * as pjRepo from '../penjualan/repo';
import * as repo from './repo';

/*
 * Surat jalan (docs/05 §7, S1–S14; K-024, K-149–K-151, K-174): banyak SJ per invoice, qty kirim per baris tidak
 * melebihi sisa, selalu dibuat di dalam rit rencana (sopir dan kendaraan sudah pasti), berangkat bersama ritnya,
 * selesai lewat catat hasil per barang, status pengiriman invoice = agregat (cache, diperbarui di transaksi yang sama).
 */

/**
 * K-174: kunci rit rencana tujuan surat jalan dan siapkan teks sopir/kendaraan untuk cetakan. Rit yang sudah
 * berangkat, selesai, atau batal tidak bisa diisi.
 */
export async function kunciRitTujuan(tx: Tx, idPerjalanan: number) {
  const r = await perjalananRepo.kunci(tx, idPerjalanan);
  if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Rit tidak ditemukan.', 404);
  if (r.status !== 'DIRENCANAKAN') {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Rit ${r.nomor} sudah ${r.status === 'JALAN' ? 'berangkat' : r.status.toLowerCase()}; pilih rit lain.`,
      409,
    );
  }
  const k = await armadaRepo.kendaraanById(tx, r.idKendaraan);
  const s = await armadaRepo.sopirById(tx, r.idSopir);
  return {
    ...r,
    teks: {
      sopir: s?.nama ?? null,
      kendaraan: k ? `${k.plat} (${k.jenis})`.slice(0, 50) : null,
    },
  };
}

/** Qty retur dalam satuan baris (K-091: qty retur dasar ÷ faktor satuan jual). */
function qtyReturBaris(b: { qtyReturDasar: string; faktor: string }): string {
  return bagiQty(b.qtyReturDasar, b.faktor);
}

/**
 * S2: qty yang masih boleh dikirim per baris = qty − retur (disetujui dan menunggu) − terpakai di SJ non-BATAL
 * (diterima bila hasilnya sudah dicatat, selain itu qty kirim). Baris VOID = 0.
 */
export function sisaKirim(b: {
  qty: string;
  qtyReturDasar: string;
  qtyReturMenungguDasar?: string;
  faktor: string;
  statusItem: string;
  qtyDikirim: string;
}): string {
  if (b.statusItem === 'VOID') return '0.000';
  const retur = qtyReturBaris({
    qtyReturDasar: tambahQty(b.qtyReturDasar, b.qtyReturMenungguDasar ?? '0'),
    faktor: b.faktor,
  });
  const sisa = kurangQty(kurangQty(b.qty, retur), b.qtyDikirim);
  return bandingQty(sisa, 0) < 0 ? '0.000' : keQty(sisa);
}

/** S4: hitung ulang `penjualan.status_pengiriman` dari surat jalannya. */
export async function sinkronStatusPengiriman(
  tx: Tx,
  idPenjualan: number,
): Promise<StatusPengiriman> {
  let status: StatusPengiriman;
  if (!(await repo.adaSuratJalanAktif(tx, idPenjualan))) {
    status = 'BELUM';
  } else {
    const baris = await repo.qtyBaris(tx, idPenjualan);
    const semua = baris.every(
      (b) =>
        b.statusItem === 'VOID' ||
        bandingQty(b.qtyTerkirim, kurangQty(b.qty, qtyReturBaris(b))) >= 0,
    );
    status = semua ? 'SELESAI' : 'SEBAGIAN';
  }
  await tx
    .update(penjualan)
    .set({ statusPengiriman: status, diubahPada: sekarang() })
    .where(eq(penjualan.id, idPenjualan));
  return status;
}

type Header = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;

async function keRespons(ex: Executor, rows: Header[]): Promise<BarisSuratJalan[]> {
  const id = rows.map((r) => r.id);
  const detail = await repo.detail(ex, id);
  const hasil = await repo.hasilHeader(ex, id);
  const hasilBaris = await repo.hasilDetail(
    ex,
    hasil.map((h) => h.id),
  );
  const keHasil = (idSj: number): HasilSuratJalan | null => {
    const h = hasil.find((x) => x.idSuratJalan === idSj);
    if (!h) return null;
    return {
      waktu: h.waktu.toISOString(),
      namaPengguna: h.namaPengguna,
      namaPenerima: h.namaPenerima,
      penangananRusak: h.penangananRusak,
      catatan: h.catatan,
      returTukar:
        h.idReturTukar && h.nomorReturTukar
          ? { id: h.idReturTukar, nomor: h.nomorReturTukar, status: h.statusReturTukar ?? '' }
          : null,
      returUang:
        h.idReturUang && h.nomorReturUang
          ? { id: h.idReturUang, nomor: h.nomorReturUang, status: h.statusReturUang ?? '' }
          : null,
      baris: hasilBaris.filter((b) => b.idHasil === h.id).map(({ idHasil: _, ...b }) => b),
    };
  };
  return rows.map((r) => ({
    ...r,
    tanggal: r.tanggal.toISOString(),
    waktuDimuat: r.waktuDimuat?.toISOString() ?? null,
    waktuDikirim: r.waktuDikirim?.toISOString() ?? null,
    waktuSelesai: r.waktuSelesai?.toISOString() ?? null,
    hasil: keHasil(r.id),
    baris: detail.filter((d) => d.idSuratJalan === r.id).map(({ idSuratJalan: _, ...d }) => d),
  }));
}

/** Kolom "Perlu surat jalan": invoice pengantaran yang masih punya qty belum dikirim (S2). */
export async function perluDikirim(): Promise<PerluDikirim[]> {
  const calon = await repo.calonPerluDikirim(db);
  const hasil: PerluDikirim[] = [];
  for (const c of calon) {
    const baris = (await repo.qtyBaris(db, c.idPenjualan))
      .map((b) => ({
        namaBarang: b.namaBarang,
        kodeSatuan: b.kodeSatuan,
        qtyBelumDikirim: sisaKirim(b),
      }))
      .filter((b) => bandingQty(b.qtyBelumDikirim, 0) > 0);
    if (baris.length > 0) hasil.push({ ...c, tanggal: c.tanggal.toISOString(), baris });
  }
  return hasil;
}

export async function daftarSuratJalan(
  p: repo.SaringSuratJalan & { halaman: number; perHalaman: number },
): Promise<{ data: BarisSuratJalan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(db, baris), meta: metaHalaman(total, p) };
}

export async function suratJalanPenjualan(idPenjualan: number): Promise<BarisSuratJalan[]> {
  const { baris } = await repo.daftar(db, { idPenjualan, limit: 100, offset: 0 });
  return keRespons(db, baris);
}

export async function detailSuratJalan(id: number): Promise<BarisSuratJalan> {
  const h = await repo.byId(db, id);
  if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
  const [hasil] = await keRespons(db, [h]);
  if (!hasil) throw new Error('surat jalan hilang');
  return hasil;
}

/** S1/S2/S14: membuat surat jalan (DIPROSES) untuk invoice pengantaran, langsung di dalam rit rencana. */
export async function buatSuratJalan(
  idPenjualan: number,
  input: DataSuratJalan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  const id = await dalamTransaksi((tx) => buatSuratJalanTx(tx, idPenjualan, input, pelaku, asal));
  return detailSuratJalan(id);
}

/** S1/S2/S14 di dalam transaksi pemanggil (dipakai juga papan Pengiriman). Mengembalikan id surat jalan. */
export async function buatSuratJalanTx(
  tx: Tx,
  idPenjualan: number,
  input: Pick<DataSuratJalan, 'baris' | 'idPerjalanan'> & Partial<DataSuratJalan>,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<number> {
  {
    // Urutan kunci sama dengan isi rit dari papan: rit dulu, lalu invoice.
    const rit = await kunciRitTujuan(tx, input.idPerjalanan);
    const pj = await pjRepo.kunciPenjualan(tx, idPenjualan);
    if (!pj) throw new AppError('TIDAK_DITEMUKAN', 'Penjualan tidak ditemukan.', 404);
    if (pj.jenisPenjualan !== 'PENGANTARAN') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Surat jalan hanya untuk penjualan pengantaran.',
        409,
      );
    }
    if (pj.statusTransaksi === 'VOID') {
      throw new AppError('STATUS_TIDAK_VALID', `Penjualan ${pj.nomor} sudah di-void.`, 409);
    }
    const baris = new Map((await repo.qtyBaris(tx, idPenjualan)).map((b) => [b.id, b]));
    const terlihat = new Set<number>();
    for (const [i, r] of input.baris.entries()) {
      const b = baris.get(r.idPenjualanDetail);
      if (!b || terlihat.has(r.idPenjualanDetail)) {
        throw new AppError('VALIDASI', `Baris ${i + 1}: barang tidak ada di invoice ini.`, 400);
      }
      terlihat.add(r.idPenjualanDetail);
      const sisa = sisaKirim(b);
      if (bandingQty(r.qtyKirim, sisa) > 0) {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          `${b.namaBarang}: qty kirim ${teksQty(keQty(r.qtyKirim))} melebihi sisa yang belum dikirim ` +
            `(${teksQty(sisa)} ${b.kodeSatuan}).`,
          409,
          { kolom: { [`baris.${i}.qtyKirim`]: [`Maksimal ${teksQty(sisa)} ${b.kodeSatuan}.`] } },
        );
      }
    }
    const [info] = await tx
      .select({ alamatKirim: penjualan.alamatKirim })
      .from(penjualan)
      .where(eq(penjualan.id, idPenjualan));
    const nomor = await terbitkanNomor(tx, 'SJ', tanggalOperasional());
    const [sj] = await tx
      .insert(suratJalan)
      .values({
        nomor,
        idPenjualan,
        idPengguna: pelaku.id,
        alamatKirim: input.alamatKirim ?? info?.alamatKirim ?? '-',
        namaPenerima: input.namaPenerima ?? null,
        noHpPenerima: input.noHpPenerima ?? null,
        sopir: rit.teks.sopir,
        kendaraan: rit.teks.kendaraan,
        idPerjalanan: rit.id,
        catatan: input.catatan ?? null,
      })
      .returning({ id: suratJalan.id });
    if (!sj) throw new Error('insert surat jalan tidak mengembalikan id');
    await tx.insert(suratJalanDetail).values(
      input.baris.map((r) => ({
        idSuratJalan: sj.id,
        idPenjualanDetail: r.idPenjualanDetail,
        qtyKirim: keQty(r.qtyKirim),
      })),
    );
    await sinkronStatusPengiriman(tx, idPenjualan);
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: sj.id,
      nomorDokumen: nomor,
      ringkasan: `Surat jalan ${nomor} untuk ${pj.nomor} di rit ${rit.nomor}: ${input.baris.length} barang`,
      ip: asal.ip,
    });
    return sj.id;
  }
}

/**
 * S3: DIPROSES → DIMUAT. DIKIRIM hanya lewat berangkat rit (S9) dan SELESAI hanya lewat catat hasil
 * (S10), agar kendaraan, sopir, dan hasil per barang selalu tercatat.
 */
export async function ubahStatusSuratJalan(
  id: number,
  input: { status: 'DIMUAT' },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  await dalamTransaksi(async (tx) => {
    const sj = await repo.kunci(tx, id);
    if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
    if (sj.status !== 'DIPROSES') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Surat jalan ${sj.nomor} berstatus ${sj.status.toLowerCase()}; tidak bisa menjadi dimuat.`,
        409,
      );
    }
    const waktu = sekarang();
    await tx
      .update(suratJalan)
      .set({ status: input.status, waktuDimuat: waktu, diubahPada: waktu })
      .where(eq(suratJalan.id, id));
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_STATUS',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: id,
      nomorDokumen: sj.nomor,
      ringkasan: `Surat jalan ${sj.nomor}: diproses → dimuat`,
      ip: asal.ip,
    });
  });
  return detailSuratJalan(id);
}

type BarisHasil = DataHasilSuratJalan['baris'][number];
type ReturDibuat = { id: number; nomor: string; disetujui: boolean };

/**
 * S10–S11 (K-149, K-151): mencatat hasil pengantaran per barang, sekali per surat jalan DIKIRIM. Barang ditolak
 * dan rusak (tagihan dikurangi) menjadi satu retur potong tagihan/refund; rusak yang dikirim pengganti menjadi
 * retur tukar barang. Kembali utuh tanpa mutasi stok (barang pembeli dititipkan di toko) dan menjadi belum
 * dikirim lagi. Perjalanannya selesai bila tidak ada lagi surat jalan DIKIRIM di dalamnya.
 */
export async function catatHasil(
  id: number,
  input: DataHasilSuratJalan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  await dalamTransaksi(async (tx) => {
    const sj = await repo.kunci(tx, id);
    if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
    if (sj.status !== 'DIKIRIM') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        sj.status === 'SELESAI'
          ? `Hasil ${sj.nomor} sudah dicatat.`
          : `Surat jalan ${sj.nomor} belum berangkat; hasil dicatat setelah barang diantar.`,
        409,
      );
    }
    const pj = await pjRepo.kunciPenjualan(tx, sj.idPenjualan);
    if (!pj) throw new Error('penjualan surat jalan hilang');
    const detail = await repo.detailUntukHasil(tx, id);
    const masukan = new Map<number, { r: BarisHasil; i: number }>();
    for (const [i, r] of input.baris.entries()) {
      const ada = detail.some((d) => d.idPenjualanDetail === r.idPenjualanDetail);
      if (!ada || masukan.has(r.idPenjualanDetail)) {
        throw new AppError('VALIDASI', `Baris ${i + 1}: barang tidak ada di surat jalan ini.`, 400);
      }
      masukan.set(r.idPenjualanDetail, { r, i });
    }
    const isi = detail.map((d) => {
      const m = masukan.get(d.idPenjualanDetail);
      if (!m) throw new AppError('VALIDASI', `${d.namaBarang}: hasil belum diisi.`, 400);
      const { r, i } = m;
      const jumlah = [r.qtyDiterima, r.qtyKembali, r.qtyRusak, r.qtyDitolak].reduce(
        (t, q) => tambahQty(t, q),
        '0',
      );
      if (bandingQty(jumlah, d.qtyKirim) !== 0) {
        const kirim = `${teksQty(keQty(d.qtyKirim))} ${d.kodeSatuan}`;
        throw new AppError(
          'VALIDASI',
          `${d.namaBarang}: diterima + kembali + rusak + ditolak harus sama dengan qty kirim (${kirim}).`,
          400,
          { kolom: { [`baris.${i}.qtyDiterima`]: [`Jumlah harus ${kirim}.`] } },
        );
      }
      return { d, r };
    });
    const adaRusak = isi.some((x) => bandingQty(x.r.qtyRusak, 0) > 0);
    if (adaRusak && !input.penangananRusak) {
      throw new AppError(
        'VALIDASI',
        'Ada barang rusak: pilih kirim pengganti atau kurangi tagihan.',
        400,
        { kolom: { penangananRusak: ['Pilih pilihan pembeli untuk barang rusak.'] } },
      );
    }
    const penanganan = adaRusak ? input.penangananRusak : null;

    // Surat jalan selesai dulu, supaya retur di bawah tidak menganggap barangnya masih di jalan.
    const waktu = sekarang();
    await tx
      .update(suratJalan)
      .set({ status: 'SELESAI', waktuSelesai: waktu, diubahPada: waktu })
      .where(eq(suratJalan.id, id));

    const alasanDasar = `Hasil pengantaran ${sj.nomor}`;
    // Retur potong tagihan/refund: ditolak (kondisi dipilih) + rusak bila tagihan dikurangi (RUSAK).
    const barisUang: {
      idPenjualanDetail: number;
      qtyRetur: string;
      kondisi: KondisiRetur;
      keterangan: string;
    }[] = [];
    for (const { d, r } of isi) {
      const tolak = bandingQty(r.qtyDitolak, 0) > 0;
      const rusak = penanganan === 'KURANGI_TAGIHAN' && bandingQty(r.qtyRusak, 0) > 0;
      if (!tolak && !rusak) continue;
      if (tolak && rusak && r.kondisiDitolak === 'BAIK') {
        throw new AppError(
          'VALIDASI',
          `${d.namaBarang}: ada yang ditolak (kondisi baik) dan rusak sekaligus. Catat yang ditolak dengan ` +
            'kondisi rusak, atau pilih kirim pengganti untuk yang rusak.',
          400,
        );
      }
      barisUang.push({
        idPenjualanDetail: d.idPenjualanDetail,
        qtyRetur: keQty(tambahQty(tolak ? r.qtyDitolak : '0', rusak ? r.qtyRusak : '0')),
        kondisi: tolak ? r.kondisiDitolak : 'RUSAK',
        keterangan: [tolak ? 'ditolak pembeli' : '', rusak ? 'rusak di jalan' : '']
          .filter(Boolean)
          .join(', '),
      });
    }
    let returUang: ReturDibuat | null = null;
    if (barisUang.length > 0) {
      const harga = new Map((await returRepo.barisPenjualan(tx, pj.id)).map((b) => [b.id, b]));
      const nilai = barisUang.reduce((t, x) => {
        const b = harga.get(x.idPenjualanDetail);
        return b ? t + subtotalRupiah(x.qtyRetur, hargaSatuanEfektif(b.subtotal, b.qty)) : t;
      }, 0);
      const { sisa } = hitungTagihan(pj);
      const potong = nilai <= sisa;
      if (!potong && !input.metodeRefund) {
        throw new AppError(
          'VALIDASI',
          `Nilai barang ditolak/rusak ${formatRupiah(nilai)} melebihi sisa tagihan ` +
            `${formatRupiah(Math.max(0, sisa))}: pilih cara uang dikembalikan (tunai/transfer).`,
          400,
          { kolom: { metodeRefund: ['Pilih cara uang dikembalikan.'] } },
        );
      }
      returUang = await ajukanReturTx(
        tx,
        {
          idPenjualan: pj.id,
          alasan: `${alasanDasar}: ${[...new Set(barisUang.map((x) => x.keterangan))].join('; ')}`,
          penyelesaian: potong ? 'POTONG_TAGIHAN' : 'REFUND',
          catatan: input.catatan ?? null,
          baris: barisUang,
          persetujuan: {
            metodeRefund: potong ? null : input.metodeRefund,
            rekeningRefund: potong ? null : (input.rekeningRefund ?? null),
            referensiRefund: null,
          },
        },
        pelaku,
        asal,
      );
    }
    // K-151: rusak, dikirim pengganti → tukar barang (rusak masuk stok rusak, pengganti keluar dari stok jual).
    let returTukar: ReturDibuat | null = null;
    const barisTukar =
      penanganan === 'KIRIM_PENGGANTI' ? isi.filter((x) => bandingQty(x.r.qtyRusak, 0) > 0) : [];
    if (barisTukar.length > 0) {
      returTukar = await ajukanReturTx(
        tx,
        {
          idPenjualan: pj.id,
          alasan: `${alasanDasar}: rusak di jalan, dikirim pengganti`,
          penyelesaian: 'TUKAR_BARANG',
          catatan: input.catatan ?? null,
          baris: barisTukar.map((x) => ({
            idPenjualanDetail: x.d.idPenjualanDetail,
            qtyRetur: keQty(x.r.qtyRusak),
            kondisi: 'RUSAK' as const,
            keterangan: 'rusak di jalan',
          })),
          persetujuan: { metodeRefund: null, rekeningRefund: null, referensiRefund: null },
        },
        pelaku,
        asal,
      );
    }

    const [h] = await tx
      .insert(suratJalanHasil)
      .values({
        idSuratJalan: id,
        idPengguna: pelaku.id,
        waktu,
        namaPenerima: input.namaPenerima ?? null,
        penangananRusak: penanganan,
        idReturTukar: returTukar?.id ?? null,
        idReturUang: returUang?.id ?? null,
        catatan: input.catatan ?? null,
      })
      .returning({ id: suratJalanHasil.id });
    if (!h) throw new Error('insert hasil surat jalan tidak mengembalikan id');
    await tx.insert(suratJalanHasilDetail).values(
      isi.map(({ d, r }) => ({
        idHasil: h.id,
        idSuratJalanDetail: d.id,
        qtyDiterima: keQty(r.qtyDiterima),
        qtyKembali: keQty(r.qtyKembali),
        qtyRusak: keQty(r.qtyRusak),
        qtyDitolak: keQty(r.qtyDitolak),
        kondisiDitolak: bandingQty(r.qtyDitolak, 0) > 0 ? r.kondisiDitolak : null,
      })),
    );
    await sinkronStatusPengiriman(tx, sj.idPenjualan);

    let ringkasPerjalanan = '';
    if (sj.idPerjalanan !== null) {
      const p = await perjalananRepo.kunci(tx, sj.idPerjalanan);
      if (p && p.status === 'JALAN' && (await perjalananRepo.masihDikirim(tx, p.id, id)) === 0) {
        await perjalananRepo.selesaikan(tx, p.id, waktu);
        ringkasPerjalanan = `; perjalanan ${p.nomor} selesai`;
        await catatLog(tx, {
          aksi: 'PERJALANAN_SELESAI',
          idPengguna: pelaku.id,
          entitas: 'perjalanan',
          idEntitas: p.id,
          nomorDokumen: p.nomor,
          ringkasan: `Perjalanan ${p.nomor} selesai (hasil ${sj.nomor} terakhir dicatat)`,
          ip: asal.ip,
        });
      }
    }
    const total = (k: 'qtyKembali' | 'qtyRusak' | 'qtyDitolak') =>
      isi.reduce((t, x) => tambahQty(t, x.r[k]), '0');
    const catat = (
      [
        ['kembali', 'qtyKembali'],
        ['rusak', 'qtyRusak'],
        ['ditolak', 'qtyDitolak'],
      ] as const
    )
      .filter(([, k]) => bandingQty(total(k), 0) > 0)
      .map(([label, k]) => `${label} ${teksQty(keQty(total(k)))}`);
    const teksRetur = (r: ReturDibuat | null, label: string) =>
      r ? `; ${label} ${r.nomor}${r.disetujui ? '' : ' menunggu atasan'}` : '';
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_HASIL',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: id,
      nomorDokumen: sj.nomor,
      ringkasan:
        `Hasil ${sj.nomor} (${pj.nomor}): ${catat.length ? catat.join(', ') : 'semua diterima'}` +
        teksRetur(returUang, 'retur') +
        teksRetur(returTukar, 'tukar') +
        ringkasPerjalanan,
      ip: asal.ip,
    });
  });
  return detailSuratJalan(id);
}

/** S5: batal hanya dari DIPROSES/DIMUAT dengan alasan; tidak dihitung lagi di S2/S4. */
export async function batalSuratJalan(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  await dalamTransaksi((tx) => batalSuratJalanTx(tx, id, alasan, pelaku, asal));
  return detailSuratJalan(id);
}

/** S5 di dalam transaksi pemanggil (dipakai juga keluarkan dari rit dan batal rit, K-174). */
export async function batalSuratJalanTx(
  tx: Tx,
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  {
    const sj = await repo.kunci(tx, id);
    if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
    if (sj.status !== 'DIPROSES' && sj.status !== 'DIMUAT') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Surat jalan ${sj.nomor} sudah ${sj.status === 'BATAL' ? 'batal' : 'berangkat'}; tidak bisa dibatalkan.`,
        409,
      );
    }
    // K-160: surat jalan batal keluar dari rit rencana (rit yang sudah berangkat tidak mungkin: S5).
    let ritTetap = sj.idPerjalanan;
    if (
      ritTetap !== null &&
      (await perjalananRepo.kunci(tx, ritTetap))?.status === 'DIRENCANAKAN'
    ) {
      ritTetap = null;
    }
    await tx
      .update(suratJalan)
      .set({ status: 'BATAL', alasanBatal: alasan, idPerjalanan: ritTetap, diubahPada: sekarang() })
      .where(eq(suratJalan.id, id));
    await sinkronStatusPengiriman(tx, sj.idPenjualan);
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_BATAL',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: id,
      nomorDokumen: sj.nomor,
      ringkasan: `Surat jalan ${sj.nomor} dibatalkan: ${alasan}`,
      ip: asal.ip,
    });
  }
}
