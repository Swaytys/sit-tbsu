import {
  formatRupiah,
  KELOMPOK_UMUR,
  kelompokUmur,
  nomorHari,
  type BarisHutang,
  type DaftarHutang,
  type DataBayarHutang,
  type HasilBayarHutang,
  type JenisDokumenHutang,
  type KelompokUmur,
  type PembayaranPemasok,
  type StatusHutang,
  type DataHutangAwal,
  type DataPerpanjangJatuhTempo,
} from '@sit/shared';
import { and, eq } from 'drizzle-orm';
import { db, type Tx } from '../../db/client';
import { hutangAwal, pemasok, penerimaanBarang, perpanjanganJatuhTempo } from '../../db/schema';
import { AppError, galatKolom } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { metaHalaman } from '../../lib/paginasi';
import { dalamTransaksi } from '../../lib/transaksi';
import { sekarang, tambahHari, tanggalOperasional } from '../../lib/waktu';
import { catatKas, shiftUntukCatat } from '../kas/shift/service';
import { tambahPembayaran } from '../persediaan/penerimaan/repo';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanNomor } from '../sistem/penomoran';
import { ambilAngka } from '../sistem/konfigurasi/service';
import { pastikanDeposit } from './deposit';
import * as repo from './repo';

/*
 * Hutang pemasok (docs/06 HT1–HT4, K-088): daftar dokumen terbuka dengan umur, ringkasan per pemasok dan per
 * kelompok umur, serta pembayaran (PBP). TUNAI keluar dari laci shift pembayar (K2); TRANSFER wajib rekening.
 */

/** Hari lewat jatuh tempo (negatif = belum), `null` bila dokumen tanpa jatuh tempo. */
export function hariLewat(jatuhTempo: string | null, hariIni: string): number | null {
  return jatuhTempo === null ? null : nomorHari(hariIni) - nomorHari(jatuhTempo);
}

function keBaris(d: repo.DokumenHutang, hariIni: string): BarisHutang {
  const lewat = hariLewat(d.tanggalJatuhTempo, hariIni);
  return { ...d, hariLewat: lewat, kelompokUmur: kelompokUmur(lewat) };
}

export type SaringHutang = {
  cari?: string | undefined;
  idPemasok?: number | undefined;
  terlambat?: boolean | undefined;
  halaman: number;
  perHalaman: number;
};

/** Seluruh hutang terbuka sebagai baris (urut jatuh tempo terdekat; tanpa jatuh tempo di akhir). */
export async function semuaBarisHutang(hariIni = tanggalOperasional()): Promise<BarisHutang[]> {
  return (await repo.semuaHutang(db))
    .map((d) => keBaris(d, hariIni))
    .sort(
      (a, b) =>
        (a.tanggalJatuhTempo ?? '9999-12-31').localeCompare(b.tanggalJatuhTempo ?? '9999-12-31') ||
        a.tanggalOperasional.localeCompare(b.tanggalOperasional) ||
        a.id - b.id,
    );
}

export async function daftarHutang(p: SaringHutang): Promise<DaftarHutang> {
  const hariIni = tanggalOperasional();
  const semua = await semuaBarisHutang(hariIni);
  const cari = p.cari?.toLowerCase();
  const tersaring = semua.filter(
    (b) =>
      (p.idPemasok === undefined || b.idPemasok === p.idPemasok) &&
      (!p.terlambat || (b.hariLewat !== null && b.hariLewat > 0)) &&
      (!cari ||
        b.nomor.toLowerCase().includes(cari) ||
        b.namaPemasok.toLowerCase().includes(cari) ||
        (b.noFaktur ?? '').toLowerCase().includes(cari)),
  );
  const mulai = (p.halaman - 1) * p.perHalaman;

  const umur = Object.fromEntries(KELOMPOK_UMUR.map((k) => [k, 0])) as Record<KelompokUmur, number>;
  const perPemasok = new Map<number, DaftarHutang['ringkasan']['perPemasok'][number]>();
  let totalSisa = 0;
  let jumlahTerlambat = 0;
  let totalTerlambat = 0;
  for (const b of semua) {
    totalSisa += b.sisa;
    umur[b.kelompokUmur] += b.sisa;
    if (b.hariLewat !== null && b.hariLewat > 0) {
      jumlahTerlambat += 1;
      totalTerlambat += b.sisa;
    }
    const r = perPemasok.get(b.idPemasok) ?? {
      idPemasok: b.idPemasok,
      namaPemasok: b.namaPemasok,
      jumlahDokumen: 0,
      totalSisa: 0,
      jatuhTempoTerlama: null,
    };
    r.jumlahDokumen += 1;
    r.totalSisa += b.sisa;
    if (
      b.tanggalJatuhTempo &&
      (!r.jatuhTempoTerlama || b.tanggalJatuhTempo < r.jatuhTempoTerlama)
    ) {
      r.jatuhTempoTerlama = b.tanggalJatuhTempo;
    }
    perPemasok.set(b.idPemasok, r);
  }
  return {
    data: tersaring.slice(mulai, mulai + p.perHalaman),
    meta: metaHalaman(tersaring.length, p),
    ringkasan: {
      totalSisa,
      jumlah: semua.length,
      jumlahTerlambat,
      totalTerlambat,
      perPemasok: [...perPemasok.values()].sort((a, b) => b.totalSisa - a.totalSisa),
      umur,
    },
  };
}

export async function pembayaranHutang(
  jenis: JenisDokumenHutang,
  id: number,
): Promise<PembayaranPemasok[]> {
  return (await repo.pembayaranDokumen(db, jenis, id)).map((b) => ({
    ...b,
    tanggal: b.tanggal.toISOString(),
  }));
}

/** Status hutang dari sisa: 0 → LUNAS; selain itu SEBAGIAN bila sudah ada bayar/potongan (HT2, HT6). */
export function statusHutangDari(sisa: number, sudahBerkurang: boolean): StatusHutang {
  if (sisa <= 0) return 'LUNAS';
  return sudahBerkurang ? 'SEBAGIAN' : 'BELUM_LUNAS';
}

type DokumenTerkunci = {
  idPemasok: number;
  nomor: string;
  sisa: number;
  terapkan: (nominal: number) => Promise<HasilBayarHutang['statusHutang']>;
  entitas: string;
};

async function kunciDokumen(
  tx: Tx,
  jenis: JenisDokumenHutang,
  id: number,
): Promise<DokumenTerkunci> {
  const waktu = sekarang();
  if (jenis === 'PENERIMAAN') {
    const d = await repo.kunciPenerimaan(tx, id);
    if (!d || d.jenis !== 'PEMBELIAN') {
      throw new AppError('TIDAK_DITEMUKAN', 'Dokumen hutang tidak ditemukan.', 404);
    }
    const sisa = d.totalFaktur - d.totalDibayar - d.totalReturPotong;
    return {
      idPemasok: d.idPemasok,
      nomor: d.nomor,
      sisa,
      entitas: 'penerimaan_barang',
      terapkan: async (nominal) => {
        const dibayar = d.totalDibayar + nominal;
        const status = statusHutangDari(d.totalFaktur - dibayar - d.totalReturPotong, true);
        await repo.aturHutangPenerimaan(
          tx,
          id,
          { totalDibayar: dibayar, statusHutang: status },
          waktu,
        );
        return status;
      },
    };
  }
  if (jenis === 'HUTANG_AWAL') {
    const h = await repo.kunciHutangAwal(tx, id);
    if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Dokumen hutang tidak ditemukan.', 404);
    return {
      idPemasok: h.idPemasok,
      nomor: h.nomor,
      sisa: h.total - h.totalDibayar,
      entitas: 'hutang_awal',
      terapkan: async (nominal) => {
        const dibayar = h.totalDibayar + nominal;
        const status = statusHutangDari(h.total - dibayar, true);
        await repo.aturHutangAwal(tx, id, { totalDibayar: dibayar, statusHutang: status }, waktu);
        return status;
      },
    };
  }
  const d = await repo.kunciPenyelesaian(tx, id);
  if (!d) throw new AppError('TIDAK_DITEMUKAN', 'Dokumen hutang tidak ditemukan.', 404);
  return {
    idPemasok: d.idPemasok,
    nomor: d.nomor,
    sisa: d.total - d.totalDibayar,
    entitas: 'penyelesaian_konsinyasi',
    terapkan: async (nominal) => {
      const dibayar = d.totalDibayar + nominal;
      const status = statusHutangDari(d.total - dibayar, true);
      await repo.aturHutangPenyelesaian(
        tx,
        id,
        { totalDibayar: dibayar, statusHutang: status },
        waktu,
      );
      return status;
    },
  };
}

/**
 * HT2: bayar hutang satu dokumen. Nominal ≤ sisa; TUNAI wajib shift BUKA pembayar dan tercatat sebagai kas
 * BAYAR_PEMASOK di laci itu; status LUNAS bila sisa 0, selain itu SEBAGIAN. Log HUTANG_BAYAR.
 */
export async function bayarHutang(
  input: DataBayarHutang,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilBayarHutang> {
  return dalamTransaksi(async (tx) => {
    const d = await kunciDokumen(tx, input.jenis, input.id);
    if (d.sisa <= 0) {
      throw new AppError('STATUS_TIDAK_VALID', `Hutang ${d.nomor} sudah lunas.`, 409);
    }
    if (input.nominal > d.sisa) {
      throw galatKolom('nominal', `Nominal melebihi sisa hutang ${formatRupiah(d.sisa)}.`);
    }
    const shift = input.metode === 'TUNAI' ? await shiftUntukCatat(tx) : null;
    if (input.metode === 'TUNAI' && !shift) {
      throw new AppError(
        'KONFLIK',
        'Bayar tunai butuh shift toko terbuka. Buka shift dulu, atau pilih transfer.',
        409,
        { kolom: { metode: ['Butuh shift terbuka.'] } },
      );
    }
    // K-225: Kepala Toko membayar sampai batasnya per pembayaran; di atasnya hanya Owner.
    if (!pelaku.izin.has('pembelian.setujui_semua')) {
      const batas = await ambilAngka('hutang_batas_kepala_toko', 10_000_000, tx);
      if (input.nominal > batas) {
        throw new AppError(
          'TIDAK_BERIZIN',
          `Pembayaran di atas ${formatRupiah(batas)} hanya bisa dilakukan Owner. Bayar sebagian, atau minta Owner.`,
          403,
        );
      }
    }
    if (input.metode === 'DEPOSIT') await pastikanDeposit(tx, d.idPemasok, input.nominal);
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'PBP', tanggal);
    const idBayar = await tambahPembayaran(tx, {
      nomor,
      tanggalOperasional: tanggal,
      idPemasok: d.idPemasok,
      idPenerimaan: input.jenis === 'PENERIMAAN' ? input.id : null,
      idPenyelesaianKonsinyasi: input.jenis === 'KONSINYASI' ? input.id : null,
      idHutangAwal: input.jenis === 'HUTANG_AWAL' ? input.id : null,
      idPengguna: pelaku.id,
      idShift: shift?.id ?? null,
      nominal: input.nominal,
      metode: input.metode,
      rekening: input.rekening ?? null,
      referensi: input.referensi ?? null,
      catatan: input.catatan ?? null,
    });
    if (input.metode === 'TUNAI') {
      await catatKas(tx, {
        jenis: 'BAYAR_PEMASOK',
        nominal: input.nominal,
        pelaku,
        keterangan: `${nomor}: bayar hutang ${d.nomor}`,
        idPembayaranPemasok: idBayar,
      });
    }
    const status = await d.terapkan(input.nominal);
    await catatLog(tx, {
      aksi: 'HUTANG_BAYAR',
      idPengguna: pelaku.id,
      entitas: d.entitas,
      idEntitas: input.id,
      nomorDokumen: nomor,
      ringkasan:
        `Bayar hutang ${d.nomor}: ${formatRupiah(input.nominal)} ${input.metode.toLowerCase()}` +
        ` — sisa ${formatRupiah(d.sisa - input.nominal)}`,
      ip: asal.ip,
    });
    return { nomor, sisa: d.sisa - input.nominal, statusHutang: status };
  });
}

/** HT4: jumlah hutang terlambat dan yang jatuh tempo dalam 3 hari (notifikasi). */
export async function hutangJatuhTempo(): Promise<{ terlambat: number; segera: number }> {
  const hariIni = tanggalOperasional();
  const batas = tambahHari(hariIni, 3);
  let terlambat = 0;
  let segera = 0;
  for (const d of await repo.semuaHutang(db)) {
    if (!d.tanggalJatuhTempo) continue;
    if (d.tanggalJatuhTempo < hariIni) terlambat += 1;
    else if (d.tanggalJatuhTempo <= batas) segera += 1;
  }
  return { terlambat, segera };
}

export async function penerimaanBerhutang(idPemasok: number) {
  return repo.penerimaanBerhutang(db, idPemasok);
}

/**
 * K-237: perpanjang jatuh tempo hutang penerimaan. Hanya Owner (`pembelian.setujui_semua`, dicek route); alasan wajib;
 * tanggal baru harus setelah jatuh tempo berlaku dan tidak sebelum hari ini. Riwayat append-only di
 * `perpanjangan_jatuh_tempo`; kolom jatuh tempo penerimaan diperbarui di transaksi yang sama.
 */
export async function perpanjangJatuhTempo(
  idPenerimaan: number,
  input: DataPerpanjangJatuhTempo,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const [p] = await tx
      .select({
        nomor: penerimaanBarang.nomor,
        jenis: penerimaanBarang.jenis,
        syarat: penerimaanBarang.syaratBayar,
        jatuhTempo: penerimaanBarang.tanggalJatuhTempo,
        status: penerimaanBarang.statusHutang,
      })
      .from(penerimaanBarang)
      .where(eq(penerimaanBarang.id, idPenerimaan))
      .for('update');
    if (!p || p.jenis !== 'PEMBELIAN') {
      throw new AppError('TIDAK_DITEMUKAN', 'Hutang penerimaan tidak ditemukan.', 404);
    }
    if (p.syarat !== 'TEMPO' || !p.jatuhTempo || p.status === 'LUNAS') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Hanya hutang tempo yang belum lunas yang bisa diperpanjang jatuh temponya.',
        409,
      );
    }
    const hariIni = tanggalOperasional();
    if (input.tanggalBaru <= p.jatuhTempo || input.tanggalBaru < hariIni) {
      throw galatKolom(
        'tanggalBaru',
        `Jatuh tempo baru harus setelah ${p.jatuhTempo} dan tidak sebelum hari ini.`,
      );
    }
    await tx.insert(perpanjanganJatuhTempo).values({
      idPenerimaan,
      tanggalLama: p.jatuhTempo,
      tanggalBaru: input.tanggalBaru,
      alasan: input.alasan,
      idPengguna: pelaku.id,
    });
    await tx
      .update(penerimaanBarang)
      .set({ tanggalJatuhTempo: input.tanggalBaru, diubahPada: sekarang() })
      .where(eq(penerimaanBarang.id, idPenerimaan));
    await catatLog(tx, {
      aksi: 'HUTANG_PERPANJANG',
      idPengguna: pelaku.id,
      entitas: 'penerimaan_barang',
      idEntitas: idPenerimaan,
      nomorDokumen: p.nomor,
      ringkasan: `Jatuh tempo ${p.nomor} diperpanjang ${p.jatuhTempo} → ${input.tanggalBaru}: ${input.alasan}`,
      ip: asal.ip,
    });
  });
}

/**
 * K-241: catat hutang awal pemasok (faktur lama yang belum lunas saat mulai memakai aplikasi). Tidak menambah stok;
 * menjadi tagihan di Hutang Pemasok dan dibayar seperti hutang lain. Faktur lama yang sama untuk pemasok yang sama
 * tidak boleh dicatat dua kali.
 */
export async function catatHutangAwal(
  input: DataHutangAwal,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ id: number; nomor: string }> {
  return dalamTransaksi(async (tx) => {
    const [pm] = await tx
      .select({ nama: pemasok.namaPemasok, status: pemasok.statusAktif })
      .from(pemasok)
      .where(eq(pemasok.id, input.idPemasok));
    if (pm?.status !== 'AKTIF')
      throw galatKolom('idPemasok', 'Pemasok tidak ditemukan atau nonaktif.');
    if (input.noFakturLama) {
      const [ganda] = await tx
        .select({ nomor: hutangAwal.nomor })
        .from(hutangAwal)
        .where(
          and(
            eq(hutangAwal.idPemasok, input.idPemasok),
            eq(hutangAwal.noFakturLama, input.noFakturLama),
          ),
        );
      if (ganda) {
        throw galatKolom(
          'noFakturLama',
          `Faktur ${input.noFakturLama} pemasok ini sudah dicatat (${ganda.nomor}).`,
        );
      }
    }
    const tanggal = tanggalOperasional();
    if (input.tanggalFaktur && input.tanggalFaktur > tanggal) {
      throw galatKolom('tanggalFaktur', 'Tanggal faktur tidak boleh setelah hari ini.');
    }
    const nomor = await terbitkanNomor(tx, 'HAW', tanggal);
    const [b] = await tx
      .insert(hutangAwal)
      .values({
        nomor,
        tanggalOperasional: tanggal,
        idPemasok: input.idPemasok,
        idPengguna: pelaku.id,
        noFakturLama: input.noFakturLama ?? null,
        tanggalFaktur: input.tanggalFaktur ?? null,
        total: input.sisa,
        tanggalJatuhTempo: input.tanggalJatuhTempo,
        catatan: input.catatan ?? null,
      })
      .returning({ id: hutangAwal.id });
    if (!b) throw new Error('insert hutang_awal tidak mengembalikan id');
    await catatLog(tx, {
      aksi: 'HUTANG_AWAL_CATAT',
      idPengguna: pelaku.id,
      entitas: 'hutang_awal',
      idEntitas: b.id,
      nomorDokumen: nomor,
      ringkasan:
        `Hutang awal ke ${pm.nama}: ${formatRupiah(input.sisa)}, jatuh tempo ${input.tanggalJatuhTempo}` +
        (input.noFakturLama ? ` (faktur ${input.noFakturLama})` : ''),
      ip: asal.ip,
    });
    return { id: b.id, nomor };
  });
}
