import { createHash } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import {
  ARAH_JENIS_KAS,
  formatRupiah,
  totalPecahan,
  type BantuanSelisih,
  type BarisHitungKas,
  type BarisShift,
  type DataBukaShift,
  type DataHitungKas,
  type DataKasShift,
  type DataKodePersetujuan,
  type DataKoreksiModal,
  type DataTutupShift,
  type DaftarShift,
  type DetailShift,
  type HasilClerical,
  type HasilHitungTutup,
  type InfoKodePersetujuan,
  type JenisKasShift,
  type RincianPecahan,
  type ShiftAktif,
  type TinjauanShift,
  type UsulanBukaShift,
  type WaktuShift,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { shiftKasir } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { siarkan } from '../../../lib/siaran';
import { dalamTransaksi } from '../../../lib/transaksi';
import { logger } from '../../../lib/logger';
import { jamLokal, saatLokal, sekarang, tambahMenit, tanggalOperasional } from '../../../lib/waktu';
import { ambilAngka, ambilTeks } from '../../sistem/konfigurasi/service';
import { mintaKode, pakaiKode, periksaKode } from '../../sistem/kode-persetujuan/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { kirimKePengguna, penerimaBerizin } from '../../sistem/saluran/service';
import { bantuanSelisih, linimasaTunai, type KasShiftRingkas } from './bantuan';
import * as repo from './repo';

/*
 * Shift kasir dan clerical check (docs/05 §10, K1–K8; K-018). Semua uang tunai (pembayaran, refund, kas lain)
 * terikat ke shift BUKA milik pencatatnya.
 *
 * K-109 (K9–K11): shift lewat hari mengunci pencatatan; jadwal dibekukan; atasan diingatkan.
 * K-121 (K15–K24): buka tiga cara (sama dengan kemarin, hitung sekarang, hitung nanti), hitung per pecahan,
 * modal berlanjut (uang ditinggal), koreksi modal tercatat, tutup dua langkah (hitungan terkunci → hasil,
 * tinjauan, bantuan selisih → keterangan → tutup), satu kali hitung ulang, toleransi selisih receh, penjelasan
 * selisih oleh atasan. Modal awal tidak pernah diubah; koreksi = kas KOREKSI_MODAL_±.
 */

const tglId = (t: string) => `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}`;

/** K10: keadaan waktu shift BUKA pada saat `kini`. */
export function waktuShift(
  s: { tanggalOperasional: string; jadwalBuka: string | null; jadwalTutup: string | null },
  kini: Date = sekarang(),
): WaktuShift {
  const batas = s.jadwalTutup ? saatLokal(s.tanggalOperasional, s.jadwalTutup) : null;
  return {
    jadwalBuka: s.jadwalBuka,
    jadwalTutup: s.jadwalTutup,
    batasTutup: batas?.toISOString() ?? null,
    lewatJadwal: batas !== null && kini >= batas,
    terlewat: s.tanggalOperasional < tanggalOperasional(kini),
  };
}

/**
 * Shift milik pengguna yang belum ditutup (BUKA atau DIHITUNG), atau `null`. `kunci`: FOR SHARE, dipakai saat
 * mencatat uang ke shift itu agar tidak bersamaan dengan hitungan tutup (FOR UPDATE) — clerical tidak boleh
 * melewatkan transaksi (K6).
 */
export async function shiftBuka(ex: Executor | Tx, idPengguna: number, kunci = false) {
  const q = ex
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
    })
    .from(shiftKasir)
    .where(and(eq(shiftKasir.idKasir, idPengguna), ne(shiftKasir.status, 'TUTUP')))
    .limit(1);
  const [s] = kunci ? await q.for('share') : await q;
  return s ?? null;
}

/**
 * K9: shift BUKA milik pengguna untuk MENCATAT penjualan atau uang (dikunci FOR SHARE), atau `null` bila
 * tidak punya. Shift dari hari operasional sebelumnya ditolak; shift yang sedang ditutup (DIHITUNG, K-121)
 * ditolak karena hitungan uangnya sudah dikirim.
 */
export async function shiftUntukCatat(tx: Tx, idPengguna: number) {
  const s = await shiftBuka(tx, idPengguna, true);
  if (s && s.status === 'DIHITUNG') {
    throw new AppError(
      'KONFLIK',
      `Shift ${s.nomor} sedang ditutup: hitungan uang sudah dikirim. Selesaikan penutupan di menu Shift & ` +
        'Clerical Check, lalu buka shift baru untuk mencatat uang lagi.',
      409,
      { shiftDihitung: { id: s.id, nomor: s.nomor } },
    );
  }
  if (s && s.tanggalOperasional < tanggalOperasional()) {
    throw new AppError(
      'KONFLIK',
      `Shift ${s.nomor} tanggal ${tglId(s.tanggalOperasional)} belum ditutup. Tutup shift itu dulu di menu ` +
        'Shift & Clerical Check (hitung uang di laci), lalu buka shift baru untuk hari ini.',
      409,
      { shiftTerlewat: { id: s.id, nomor: s.nomor } },
    );
  }
  return s;
}

type ShiftTerbuka = NonNullable<Awaited<ReturnType<typeof shiftBuka>>>;

async function keAktif(ex: Executor, s: ShiftTerbuka): Promise<ShiftAktif> {
  const k = await repo.komponenKas(ex, s.id);
  return {
    id: s.id,
    nomor: s.nomor,
    status: s.status,
    tanggalOperasional: s.tanggalOperasional,
    waktuBuka: s.waktuBuka.toISOString(),
    modalAwal: s.modalAwal,
    caraBuka: s.caraBuka,
    batasHitungBuka:
      s.caraBuka === 'HITUNG_NANTI' && s.hitungBukaPada === null
        ? (s.batasHitungBuka?.toISOString() ?? null)
        : null,
    koreksiModal: k.koreksiModal,
    adaTransaksiTunai: k.adaTransaksiTunai,
    ...waktuShift(s),
  };
}

export async function shiftSaya(pelaku: PenggunaAktif): Promise<ShiftAktif | null> {
  const s = await shiftBuka(db, pelaku.id);
  return s ? keAktif(db, s) : null;
}

async function toleransi(ex: Executor | Tx = db): Promise<number> {
  return ambilAngka('toleransi_selisih_kas', 1000, ex);
}

/** K-121: usulan modal awal = uang ditinggal di laci saat shift terakhir ditutup. */
export async function usulanBukaShift(): Promise<UsulanBukaShift> {
  const u = await repo.usulanBuka(db);
  return {
    uangDitinggal: u?.uangDitinggal ?? null,
    nomorShift: u?.nomorShift ?? null,
    namaKasir: u?.namaKasir ?? null,
    waktuTutup: u?.waktuTutup?.toISOString() ?? null,
    batasHitungMenit: await ambilAngka('batas_hitung_buka_menit', 60),
  };
}

function totalHitungan(h: {
  uangFisik?: number | undefined;
  rincian?: RincianPecahan | undefined;
}) {
  return h.rincian !== undefined ? totalPecahan(h.rincian) : (h.uangFisik ?? 0);
}

/** K1 + K-121: satu shift belum tutup per pengguna; tiga cara buka. */
export async function bukaShift(
  input: DataBukaShift,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ShiftAktif> {
  await dalamTransaksi(async (tx) => {
    const ada = await shiftBuka(tx, pelaku.id);
    if (ada) {
      throw new AppError(
        'KONFLIK',
        `Anda masih punya shift yang belum ditutup (${ada.nomor}). Tutup shift itu dulu.`,
        409,
      );
    }
    const usulan = (await repo.usulanBuka(tx))?.uangDitinggal ?? null;
    if (input.cara === 'SAMA_KEMARIN' && usulan === null) {
      throw new AppError(
        'KONFLIK',
        'Belum ada catatan uang yang ditinggal di laci dari shift sebelumnya. Pilih "Hitung sekarang".',
        409,
      );
    }
    const dihitung =
      input.rincian !== undefined ? totalPecahan(input.rincian) : (input.modalAwal ?? 0);
    if (
      input.cara === 'HITUNG' &&
      input.rincian !== undefined &&
      input.modalAwal !== undefined &&
      input.modalAwal !== dihitung
    ) {
      throw new AppError('VALIDASI', 'Total tidak sama dengan jumlah rincian pecahan.', 400, {
        kolom: { modalAwal: ['Total tidak sama dengan rincian pecahan.'] },
      });
    }
    const modalAwal = input.cara === 'HITUNG' ? dihitung : (usulan ?? 0);
    const waktu = sekarang();
    const tanggal = tanggalOperasional(waktu);
    const nomor = await terbitkanNomor(tx, 'SHF', tanggal);
    // K10: jadwal toko dibekukan ke shift ini; perubahan pengaturan berlaku untuk shift berikutnya.
    const jadwalBuka = (await ambilTeks('shift_jam_buka', '', tx)) || null;
    const jadwalTutup = (await ambilTeks('shift_jam_tutup', '', tx)) || null;
    const batasMenit = await ambilAngka('batas_hitung_buka_menit', 60, tx);
    const [s] = await tx
      .insert(shiftKasir)
      .values({
        nomor,
        idKasir: pelaku.id,
        tanggalOperasional: tanggal,
        waktuBuka: waktu,
        modalAwal,
        jadwalBuka,
        jadwalTutup,
        caraBuka: input.cara,
        modalUsulan: usulan,
        rincianBuka: input.cara === 'HITUNG' ? (input.rincian ?? null) : null,
        batasHitungBuka: input.cara === 'HITUNG_NANTI' ? tambahMenit(waktu, batasMenit) : null,
      })
      .returning({ id: shiftKasir.id });
    if (!s) throw new Error('insert shift_kasir tidak mengembalikan id');
    if (input.cara === 'HITUNG') {
      await repo.tambahHitung(tx, {
        idShift: s.id,
        jenis: 'BUKA',
        idPengguna: pelaku.id,
        uangFisik: modalAwal,
        rincian: input.rincian ?? null,
        saldoSistem: usulan,
      });
    }
    const keterangan: Record<DataBukaShift['cara'], string> = {
      SAMA_KEMARIN: `sama dengan uang ditinggal kemarin ${formatRupiah(modalAwal)}`,
      HITUNG: `dihitung ${formatRupiah(modalAwal)}${
        usulan !== null && usulan !== modalAwal
          ? ` (uang ditinggal kemarin ${formatRupiah(usulan)}, selisih semalam ${formatRupiah(modalAwal - usulan)})`
          : ''
      }`,
      HITUNG_NANTI: `hitung nanti (≤ ${batasMenit} menit), modal sementara ${formatRupiah(modalAwal)}`,
    };
    await catatLog(tx, {
      aksi: 'SHIFT_BUKA',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: s.id,
      nomorDokumen: nomor,
      ringkasan: `Buka shift ${nomor}: ${keterangan[input.cara]}`,
      ip: asal.ip,
    });
  });
  const s = await shiftBuka(db, pelaku.id);
  if (!s) throw new Error('shift baru tidak terbaca');
  return keAktif(db, s);
}

/**
 * Mencatat uang keluar/masuk laci pada shift BUKA milik pencatat (K2/K3). Dipakai kas manual, refund retur/void,
 * dan pembayaran pemasok tunai. Tanpa shift BUKA → ditolak (uang tunai harus tercatat di laci tertentu).
 */
export async function catatKas(
  tx: Tx,
  k: {
    jenis: JenisKasShift;
    nominal: number;
    pelaku: PenggunaAktif;
    keterangan?: string | null;
    idRetur?: number;
    idVoid?: number;
    idPembayaranPemasok?: number;
  },
): Promise<{ idShift: number; nomorShift: string }> {
  const s = await shiftUntukCatat(tx, k.pelaku.id);
  if (!s) {
    throw new AppError(
      'KONFLIK',
      'Buka shift kasir terlebih dahulu: uang tunai harus tercatat di laci shift Anda.',
      409,
    );
  }
  await repo.tambahKas(tx, {
    idShift: s.id,
    jenis: k.jenis,
    arah: ARAH_JENIS_KAS[k.jenis],
    nominal: k.nominal,
    idPengguna: k.pelaku.id,
    idRetur: k.idRetur ?? null,
    idVoid: k.idVoid ?? null,
    idPembayaranPemasok: k.idPembayaranPemasok ?? null,
    keterangan: k.keterangan ?? null,
  });
  return { idShift: s.id, nomorShift: s.nomor };
}

type Baris = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;

function keBaris(b: Baris): BarisShift {
  const clerical: HasilClerical | null =
    b.clcNomor && b.clcTanggal
      ? {
          nomor: b.clcNomor,
          tanggal: b.clcTanggal.toISOString(),
          modalAwal: b.clcModalAwal ?? 0,
          koreksiModal: b.clcKoreksiModal ?? 0,
          tunaiPenjualan: b.clcTunaiPenjualan ?? 0,
          kasMasukLain: b.clcKasMasukLain ?? 0,
          kasKeluar: b.clcKasKeluar ?? 0,
          saldoSistem: b.clcSaldoSistem ?? 0,
          uangFisik: b.clcUangFisik ?? 0,
          selisih: b.clcSelisih ?? 0,
          keterangan: b.clcKeterangan,
          namaPemeriksa: b.clcNamaPemeriksa ?? '',
          uangDitinggal: b.clcUangDitinggal ?? 0,
          toleransi: b.clcToleransi ?? 0,
          jumlahHitung: b.clcJumlahHitung ?? 1,
          penjelasanAtasan: b.clcPenjelasan,
          dijelaskanOleh: b.clcDijelaskanOleh,
          dijelaskanPada: b.clcDijelaskanPada?.toISOString() ?? null,
        }
      : null;
  return {
    id: b.id,
    nomor: b.nomor,
    idKasir: b.idKasir,
    namaKasir: b.namaKasir,
    tanggalOperasional: b.tanggalOperasional,
    waktuBuka: b.waktuBuka.toISOString(),
    waktuTutup: b.waktuTutup?.toISOString() ?? null,
    modalAwal: b.modalAwal,
    status: b.status,
    clerical,
    waktu: b.status !== 'TUTUP' ? waktuShift(b) : null,
  };
}

/** K8: semua shift untuk `kas.shift.lihat_semua`; kasir hanya shift miliknya. */
export async function daftarShift(
  p: Omit<repo.SaringShift, 'perluDitutup'> & {
    perluDitutup?: boolean | undefined;
    halaman: number;
    perHalaman: number;
  },
  pelaku: PenggunaAktif,
): Promise<DaftarShift> {
  const semua = pelaku.izin.has('kas.shift.lihat_semua');
  const kini = sekarang();
  const { baris, total } = await repo.daftar(db, {
    ...p,
    perluDitutup: p.perluDitutup ? { hariIni: tanggalOperasional(kini), kini } : undefined,
    idKasir: semua ? p.idKasir : pelaku.id,
    ...batasHalaman(p),
  });
  return { data: baris.map(keBaris), meta: metaHalaman(total, p) };
}

async function dataShift(ex: Executor, id: number) {
  const [kas, bayar] = await Promise.all([repo.daftarKas(ex, id), repo.pembayaranShift(ex, id)]);
  const kasRingkas: KasShiftRingkas[] = kas.map((k) => ({
    waktu: k.waktu,
    jenis: k.jenis,
    arah: k.arah,
    nominal: k.nominal,
    keterangan: k.keterangan,
    nomorDokumen: k.nomorDokumen,
  }));
  return { kas, kasRingkas, bayar };
}

/** K-121 butir 6: ringkasan kejadian shift. */
async function tinjauan(ex: Executor, id: number, modalAwal: number, waktuBuka: Date) {
  const { kasRingkas, bayar } = await dataShift(ex, id);
  const perJenis = await repo.penjualanShift(ex, id);
  const metode = new Map<string, { jumlah: number; total: number }>();
  for (const b of bayar) {
    const m = metode.get(b.metode) ?? { jumlah: 0, total: 0 };
    m.jumlah += 1;
    m.total += b.nominal;
    metode.set(b.metode, m);
  }
  const jumlahKas = (jenis: JenisKasShift) => {
    const d = kasRingkas.filter((k) => k.jenis === jenis);
    return { jumlah: d.length, total: d.reduce((t, k) => t + k.nominal, 0) };
  };
  const t: TinjauanShift = {
    jumlahTransaksi: perJenis.reduce((n, x) => n + x.jumlah, 0),
    perJenis,
    perMetode: [...metode.entries()].map(([m, x]) => ({
      metode: m as TinjauanShift['perMetode'][number]['metode'],
      ...x,
    })),
    totalKembalian: bayar.reduce((n, b) => n + (b.metode === 'TUNAI' ? b.kembalian : 0), 0),
    void: jumlahKas('REFUND_VOID'),
    retur: jumlahKas('REFUND_RETUR'),
    linimasa: linimasaTunai(modalAwal, waktuBuka, bayar, kasRingkas),
  };
  return { tinjauan: t, kasRingkas, bayar };
}

function hitunganKe(h: Awaited<ReturnType<typeof repo.daftarHitung>>): BarisHitungKas[] {
  return h.map((x) => ({
    jenis: x.jenis,
    waktu: x.waktu.toISOString(),
    uangFisik: x.uangFisik,
    rincian: x.rincian ?? null,
    saldoSistem: x.saldoSistem,
    namaPengguna: x.namaPengguna,
  }));
}

/** K4: ringkasan saldo shift belum tutup hanya untuk `kas.shift.lihat_semua` (kasir: setelah tutup). */
export async function detailShift(id: number, pelaku: PenggunaAktif): Promise<DetailShift> {
  const b = await repo.byId(db, id);
  const semua = pelaku.izin.has('kas.shift.lihat_semua');
  if (!b || (!semua && b.idKasir !== pelaku.id)) {
    throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
  }
  const kas = (await repo.daftarKas(db, id)).map((k) => ({ ...k, waktu: k.waktu.toISOString() }));
  const hitungan = hitunganKe(await repo.daftarHitung(db, id));
  const terlihat = b.status === 'TUTUP' || semua;
  let ringkasan: DetailShift['ringkasan'] = null;
  let tinj: TinjauanShift | null = null;
  let bantuan: BantuanSelisih | null = null;
  if (terlihat) {
    const k = await repo.komponenKas(db, id);
    const modal = b.modalAwal + k.koreksiModal;
    ringkasan = {
      modalAwal: modal,
      koreksiModal: k.koreksiModal,
      tunaiPenjualan: k.tunaiPenjualan,
      kasMasukLain: k.kasMasukLain,
      kasKeluar: k.kasKeluar,
      jumlahTransaksi: k.jumlahTransaksi,
      saldoSistem: modal + k.tunaiPenjualan + k.kasMasukLain - k.kasKeluar,
    };
    const t = await tinjauan(db, id, b.modalAwal, b.waktuBuka);
    tinj = t.tinjauan;
    if (b.clcSelisih !== null && b.clcSelisih !== 0) {
      bantuan = bantuanSelisih(b.clcSelisih, b.clcToleransi ?? 0, t.bayar, t.kasRingkas);
    }
  }
  return {
    ...keBaris(b),
    kas,
    ringkasan,
    hitungan,
    caraBuka: b.caraBuka,
    tinjauan: tinj,
    bantuan,
  };
}

/** K3: kas masuk/keluar manual pada shift BUKA milik sendiri. */
export async function catatKasManual(
  input: DataKasShift,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailShift> {
  const idShift = await dalamTransaksi(async (tx) => {
    const { idShift, nomorShift } = await catatKas(tx, {
      jenis: input.jenis,
      nominal: input.nominal,
      pelaku,
      keterangan: input.keterangan ?? null,
    });
    await catatLog(tx, {
      aksi: 'KAS_SHIFT_CATAT',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: idShift,
      nomorDokumen: nomorShift,
      ringkasan: `${input.jenis.toLowerCase().replace('_', ' ')} ${formatRupiah(input.nominal)}${input.keterangan ? `: ${input.keterangan}` : ''}`,
      ip: asal.ip,
    });
    return idShift;
  });
  return detailShift(idShift, pelaku);
}

/** Shift yang boleh diurus pelaku (pemiliknya, atau `kas.shift.lihat_semua`), dikunci FOR UPDATE. */
async function shiftUntukDiurus(tx: Tx, id: number, pelaku: PenggunaAktif) {
  const s = await repo.kunci(tx, id);
  if (!s || (s.idKasir !== pelaku.id && !pelaku.izin.has('kas.shift.lihat_semua'))) {
    throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
  }
  return s;
}

/**
 * K-121 butir 1 (hitung nanti): kasir mengirim hitungan uang laci setelah shift berjalan. Modal sebenarnya saat
 * buka = hitungan − (tunai masuk − tunai keluar sejak buka). Selisihnya terhadap modal sementara dicatat sebagai
 * koreksi modal ("selisih semalam").
 */
export async function hitungBukaSusulan(
  id: number,
  input: DataHitungKas,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ShiftAktif> {
  await dalamTransaksi(async (tx) => {
    const s = await shiftUntukDiurus(tx, id, pelaku);
    if (s.status !== 'BUKA') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Shift ${s.nomor} sudah dihitung untuk ditutup.`,
        409,
      );
    }
    if (s.caraBuka !== 'HITUNG_NANTI' || s.hitungBukaPada !== null) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Shift ${s.nomor} tidak menunggu hitung susulan. Untuk membetulkan modal, pakai Koreksi modal.`,
        409,
      );
    }
    const hitungan = totalHitungan(input);
    const k = await repo.komponenKas(tx, id);
    const bersih = k.tunaiPenjualan + k.kasMasukLain - k.kasKeluar;
    const modalBenar = hitungan - bersih;
    if (modalBenar < 0) {
      throw new AppError(
        'KONFLIK',
        `Hitungan ${formatRupiah(hitungan)} lebih kecil dari uang tunai bersih yang masuk sejak shift dibuka ` +
          `(${formatRupiah(bersih)}). Hitung ulang uang di laci; bila tetap begitu, hubungi atasan.`,
        409,
        { kolom: { uangFisik: ['Hitungan lebih kecil dari uang yang masuk sejak buka.'] } },
      );
    }
    const modalSekarang = s.modalAwal + k.koreksiModal;
    const beda = modalBenar - modalSekarang;
    const waktu = sekarang();
    if (beda !== 0) {
      await repo.tambahKas(tx, {
        idShift: id,
        jenis: beda > 0 ? 'KOREKSI_MODAL_TAMBAH' : 'KOREKSI_MODAL_KURANG',
        arah: beda > 0 ? 'MASUK' : 'KELUAR',
        nominal: Math.abs(beda),
        idPengguna: pelaku.id,
        keterangan:
          `Hitung susulan: laci ${formatRupiah(hitungan)} − tunai bersih sejak buka ${formatRupiah(bersih)} = ` +
          `modal saat buka ${formatRupiah(modalBenar)} (selisih semalam ${formatRupiah(beda)})`,
      });
    }
    await repo.tambahHitung(tx, {
      idShift: id,
      jenis: 'BUKA_SUSULAN',
      idPengguna: pelaku.id,
      uangFisik: hitungan,
      rincian: input.rincian ?? null,
      saldoSistem: bersih,
    });
    await repo.tandaiHitungBuka(tx, id, waktu);
    await catatLog(tx, {
      aksi: 'SHIFT_HITUNG_BUKA',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: id,
      nomorDokumen: s.nomor,
      ringkasan:
        `Hitung susulan shift ${s.nomor}: laci ${formatRupiah(hitungan)}, tunai bersih sejak buka ` +
        `${formatRupiah(bersih)}, modal saat buka ${formatRupiah(modalBenar)}` +
        (beda !== 0 ? ` (selisih semalam ${formatRupiah(beda)})` : ''),
      ip: asal.ip,
    });
  });
  const s = await shiftBuka(db, (await repo.byId(db, id))?.idKasir ?? pelaku.id);
  if (!s) throw new Error('shift tidak terbaca');
  return keAktif(db, s);
}

function sidikKoreksi(id: number, modalBenar: number): string {
  return createHash('sha256').update(`koreksi-kas:${id}:${modalBenar}`).digest('hex');
}

/** K-121 butir 3: minta kode atasan untuk koreksi modal setelah ada transaksi tunai. */
export async function mintaKodeKoreksi(
  id: number,
  input: Pick<DataKoreksiModal, 'modalBenar' | 'alasan'>,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<InfoKodePersetujuan> {
  const b = await repo.byId(db, id);
  if (!b || b.idKasir !== pelaku.id)
    throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
  if (b.status !== 'BUKA') {
    throw new AppError('STATUS_TIDAK_VALID', `Shift ${b.nomor} sudah tidak berjalan.`, 409);
  }
  const k = await repo.komponenKas(db, id);
  const lama = b.modalAwal + k.koreksiModal;
  return mintaKode(
    {
      jenis: 'KOREKSI_KAS',
      izin: 'kas.shift.lihat_semua',
      pengaju: pelaku,
      rujukan: {},
      idEntitas: id,
      nomorDokumen: b.nomor,
      nilai: input.modalBenar,
      ringkasan:
        `Koreksi modal awal shift ${b.nomor} (${b.namaKasir}): ${formatRupiah(lama)} → ` +
        `${formatRupiah(input.modalBenar)} (${formatRupiah(input.modalBenar - lama)}). Alasan: ${input.alasan}`,
      sidik: sidikKoreksi(id, input.modalBenar),
    },
    asal,
  );
}

/**
 * K-121 butir 3: koreksi modal awal. Modal awal tidak diubah; selisihnya dicatat sebagai kas KOREKSI_MODAL_±
 * beralasan. Tanpa kode hanya sebelum ada transaksi tunai, atau oleh `kas.shift.lihat_semua`.
 */
export async function koreksiModal(
  id: number,
  input: DataKoreksiModal,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailShift> {
  const atasan = pelaku.izin.has('kas.shift.lihat_semua');
  let sah: Awaited<ReturnType<typeof periksaKode>> | null = null;
  const awal = await repo.komponenKas(db, id);
  if (awal.adaTransaksiTunai && !atasan) {
    const kode: DataKodePersetujuan | undefined = input.kode;
    if (!kode) {
      throw new AppError(
        'TIDAK_BERIZIN',
        'Sudah ada transaksi tunai di shift ini, jadi koreksi modal butuh kode dari Admin/Owner.',
        403,
        { butuhKode: true },
      );
    }
    const sidik = sidikKoreksi(id, input.modalBenar);
    sah = await periksaKode(
      {
        idPermintaan: kode.idPermintaan,
        kode: kode.kode,
        jenis: 'KOREKSI_KAS',
        izin: 'kas.shift.lihat_semua',
        pengaju: pelaku,
        cocok: (m) => m.sidik === sidik,
      },
      asal,
    );
  }
  await dalamTransaksi(async (tx) => {
    const s = await shiftUntukDiurus(tx, id, pelaku);
    if (s.status !== 'BUKA') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Shift ${s.nomor} sudah dihitung/ditutup; modal tidak bisa dikoreksi lagi.`,
        409,
      );
    }
    const k = await repo.komponenKas(tx, id);
    if (k.adaTransaksiTunai && !atasan && !sah) {
      throw new AppError('TIDAK_BERIZIN', 'Koreksi modal butuh kode dari Admin/Owner.', 403, {
        butuhKode: true,
      });
    }
    const lama = s.modalAwal + k.koreksiModal;
    const beda = input.modalBenar - lama;
    if (beda === 0) {
      throw new AppError('VALIDASI', 'Modal yang benar sama dengan modal sekarang.', 400, {
        kolom: { modalBenar: ['Sama dengan modal sekarang.'] },
      });
    }
    if (sah) await pakaiKode(tx, sah);
    const oleh = sah ? ` (disetujui ${sah.atasan.namaPengguna} lewat kode)` : '';
    await repo.tambahKas(tx, {
      idShift: id,
      jenis: beda > 0 ? 'KOREKSI_MODAL_TAMBAH' : 'KOREKSI_MODAL_KURANG',
      arah: beda > 0 ? 'MASUK' : 'KELUAR',
      nominal: Math.abs(beda),
      idPengguna: pelaku.id,
      keterangan: `${input.alasan} (${formatRupiah(lama)} → ${formatRupiah(input.modalBenar)})${oleh}`,
    });
    await catatLog(tx, {
      aksi: 'SHIFT_KOREKSI_MODAL',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: id,
      nomorDokumen: s.nomor,
      ringkasan: `Koreksi modal shift ${s.nomor}: ${formatRupiah(lama)} → ${formatRupiah(input.modalBenar)}. ${input.alasan}${oleh}`,
      dataLama: { modal: lama },
      dataBaru: { modal: input.modalBenar },
      ip: asal.ip,
    });
  });
  return detailShift(id, pelaku);
}

/** Saldo sistem dan komponen untuk shift `id` (modal efektif = modal awal + koreksi). */
async function rekonsiliasiDasar(ex: Executor | Tx, id: number, modalAwal: number) {
  const k = await repo.komponenKas(ex, id);
  const modal = modalAwal + k.koreksiModal;
  return {
    k,
    ringkasan: {
      modalAwal: modal,
      koreksiModal: k.koreksiModal,
      tunaiPenjualan: k.tunaiPenjualan,
      kasMasukLain: k.kasMasukLain,
      kasKeluar: k.kasKeluar,
      jumlahTransaksi: k.jumlahTransaksi,
      saldoSistem: modal + k.tunaiPenjualan + k.kasMasukLain - k.kasKeluar,
    },
  };
}

/** Hasil rekonsiliasi untuk shift DIHITUNG: hitungan terakhir, tinjauan, bantuan. */
export async function hasilHitung(id: number, pelaku: PenggunaAktif): Promise<HasilHitungTutup> {
  const b = await repo.byId(db, id);
  if (!b || (b.idKasir !== pelaku.id && !pelaku.izin.has('kas.shift.lihat_semua'))) {
    throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
  }
  if (b.status !== 'DIHITUNG') {
    throw new AppError('STATUS_TIDAK_VALID', `Shift ${b.nomor} belum dihitung untuk ditutup.`, 409);
  }
  const { ringkasan } = await rekonsiliasiDasar(db, id, b.modalAwal);
  const hitungan = hitunganKe(await repo.daftarHitung(db, id));
  const tutup = hitungan.filter((h) => h.jenis === 'TUTUP' || h.jenis === 'TUTUP_ULANG');
  const terakhir = tutup.at(-1);
  if (!terakhir) throw new Error('shift DIHITUNG tanpa hitungan tutup');
  const tol = await toleransi();
  const selisih = terakhir.uangFisik - ringkasan.saldoSistem;
  const dalam = Math.abs(selisih) <= tol;
  const t = await tinjauan(db, id, b.modalAwal, b.waktuBuka);
  return {
    idShift: id,
    nomorShift: b.nomor,
    rekonsiliasi: {
      ...ringkasan,
      uangFisik: terakhir.uangFisik,
      selisih,
      toleransi: tol,
      dalamToleransi: dalam,
    },
    hitungan,
    bolehHitungUlang: !dalam && tutup.length < 2,
    perluKeterangan: !dalam,
    usulanDitinggal: Math.min(ringkasan.modalAwal, terakhir.uangFisik),
    hitungBukaTidakDilakukan:
      b.caraBuka === 'HITUNG_NANTI' && !hitungan.some((h) => h.jenis === 'BUKA_SUSULAN'),
    tinjauan: t.tinjauan,
    bantuan: bantuanSelisih(selisih, tol, t.bayar, t.kasRingkas),
  };
}

/**
 * K-121 butir 4: kirim hitungan tutup. Hitungan pertama mengubah shift menjadi DIHITUNG (pencatatan uang baru
 * ditolak); hitungan kedua (hitung ulang) hanya sekali dan hanya bila selisih pertama di luar toleransi. Semua
 * hitungan tercatat.
 */
export async function hitungTutup(
  id: number,
  input: DataHitungKas,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilHitungTutup> {
  await dalamTransaksi((tx) => kirimHitunganTutup(tx, id, input, pelaku, asal));
  return hasilHitung(id, pelaku);
}

async function kirimHitunganTutup(
  tx: Tx,
  id: number,
  input: DataHitungKas,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  const s = await shiftUntukDiurus(tx, id, pelaku);
  if (s.status === 'TUTUP') {
    throw new AppError('STATUS_TIDAK_VALID', `Shift ${s.nomor} sudah ditutup.`, 409);
  }
  const uang = totalHitungan(input);
  const { ringkasan } = await rekonsiliasiDasar(tx, id, s.modalAwal);
  let jenis: 'TUTUP' | 'TUTUP_ULANG' = 'TUTUP';
  if (s.status === 'DIHITUNG') {
    const sebelumnya = (await repo.daftarHitung(tx, id)).filter(
      (h) => h.jenis === 'TUTUP' || h.jenis === 'TUTUP_ULANG',
    );
    const tol = await toleransi(tx);
    const pertama = sebelumnya[0];
    if (
      sebelumnya.length >= 2 ||
      !pertama ||
      Math.abs(pertama.uangFisik - ringkasan.saldoSistem) <= tol
    ) {
      throw new AppError(
        'KONFLIK',
        'Hitung ulang hanya boleh sekali, dan hanya bila hitungan pertama berselisih di luar toleransi.',
        409,
      );
    }
    jenis = 'TUTUP_ULANG';
  } else {
    await repo.ubahStatus(tx, id, 'DIHITUNG', sekarang());
  }
  await repo.tambahHitung(tx, {
    idShift: id,
    jenis,
    idPengguna: pelaku.id,
    uangFisik: uang,
    rincian: input.rincian ?? null,
    saldoSistem: ringkasan.saldoSistem,
  });
  await catatLog(tx, {
    aksi: 'SHIFT_HITUNG',
    idPengguna: pelaku.id,
    entitas: 'shift_kasir',
    idEntitas: id,
    nomorDokumen: s.nomor,
    ringkasan:
      `${jenis === 'TUTUP' ? 'Hitungan tutup' : 'Hitung ulang'} shift ${s.nomor}: fisik ${formatRupiah(uang)}, ` +
      `sistem ${formatRupiah(ringkasan.saldoSistem)}, selisih ${formatRupiah(uang - ringkasan.saldoSistem)}` +
      (s.idKasir !== pelaku.id ? ' (oleh pengguna lain)' : ''),
    ip: asal.ip,
  });
}

/**
 * K4–K6 + K-121: tutup shift. Bila shift masih BUKA dan hitungan dikirim bersama (satu langkah), hitungan dicatat
 * dulu. Selisih di luar toleransi wajib keterangan; dalam toleransi diberi keterangan "selisih receh". Uang
 * ditinggal di laci (≤ uang fisik) menjadi usulan modal shift berikutnya. Order DIPROSES kasir itu kembali ke
 * antrean.
 */
export async function tutupShift(
  id: number,
  input: DataTutupShift,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailShift> {
  let orderDilepas = 0;
  await dalamTransaksi(async (tx) => {
    let s = await shiftUntukDiurus(tx, id, pelaku);
    if (s.status === 'TUTUP') {
      throw new AppError('STATUS_TIDAK_VALID', `Shift ${s.nomor} sudah ditutup.`, 409);
    }
    if (s.status === 'BUKA') {
      if (input.uangFisik === undefined && input.rincian === undefined) {
        throw new AppError('VALIDASI', 'Kirim dulu hasil hitungan uang di laci.', 400, {
          kolom: { uangFisik: ['Isi hasil hitungan uang.'] },
        });
      }
      await kirimHitunganTutup(tx, id, input, pelaku, asal);
      s = await shiftUntukDiurus(tx, id, pelaku);
    }
    const hitungan = (await repo.daftarHitung(tx, id)).filter(
      (h) => h.jenis === 'TUTUP' || h.jenis === 'TUTUP_ULANG',
    );
    const terakhir = hitungan.at(-1);
    if (!terakhir) throw new Error('shift DIHITUNG tanpa hitungan tutup');
    const { k, ringkasan } = await rekonsiliasiDasar(tx, id, s.modalAwal);
    const tol = await toleransi(tx);
    const selisih = terakhir.uangFisik - ringkasan.saldoSistem;
    let keterangan = input.keterangan ?? null;
    if (Math.abs(selisih) > tol && !keterangan) {
      throw new AppError(
        'KONFLIK',
        'Ada selisih di luar toleransi. Tulis keterangan selisih untuk menutup shift.',
        409,
        { kolom: { keterangan: ['Keterangan selisih wajib diisi.'] }, perluKeterangan: true },
      );
    }
    if (selisih !== 0 && !keterangan) {
      keterangan = `Selisih receh (dalam toleransi ${formatRupiah(tol)})`;
    }
    const ditinggal = input.uangDitinggal ?? Math.min(ringkasan.modalAwal, terakhir.uangFisik);
    if (ditinggal > terakhir.uangFisik) {
      throw new AppError(
        'VALIDASI',
        `Uang ditinggal di laci tidak boleh lebih dari uang yang dihitung (${formatRupiah(terakhir.uangFisik)}).`,
        400,
        { kolom: { uangDitinggal: ['Lebih dari uang yang dihitung.'] } },
      );
    }
    const waktu = sekarang();
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'CLC', tanggal);
    await repo.tambahClerical(tx, {
      nomor,
      idShift: id,
      idPengguna: pelaku.id,
      tanggalOperasional: tanggal,
      modalAwal: ringkasan.modalAwal,
      tunaiPenjualan: k.tunaiPenjualan,
      kasMasukLain: k.kasMasukLain,
      kasKeluar: k.kasKeluar,
      saldoSistem: ringkasan.saldoSistem,
      uangFisik: terakhir.uangFisik,
      keterangan,
      uangDitinggal: ditinggal,
      koreksiModal: k.koreksiModal,
      toleransi: tol,
      jumlahHitung: hitungan.length,
    });
    await repo.tutup(tx, id, waktu);
    orderDilepas = (await repo.lepasOrderKasir(tx, s.idKasir, waktu)).length;
    await catatLog(tx, {
      aksi: 'SHIFT_TUTUP',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: id,
      nomorDokumen: s.nomor,
      ringkasan:
        `Tutup shift ${s.nomor} (${nomor}): sistem ${formatRupiah(ringkasan.saldoSistem)}, fisik ` +
        `${formatRupiah(terakhir.uangFisik)}, selisih ${formatRupiah(selisih)}` +
        (hitungan.length > 1 ? ' (hitung ulang)' : '') +
        `, ditinggal di laci ${formatRupiah(ditinggal)}` +
        (keterangan ? ` — ${keterangan}` : '') +
        (s.idKasir !== pelaku.id ? ' (ditutup oleh pengguna lain)' : ''),
      ip: asal.ip,
    });
  });
  if (orderDilepas > 0) siarkan('antrean');
  return detailShift(id, pelaku);
}

/** K-121 butir 8: penjelasan selisih oleh Admin/Owner setelah shift ditutup (angka tidak berubah). */
export async function jelaskanSelisih(
  id: number,
  penjelasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailShift> {
  await dalamTransaksi(async (tx) => {
    const s = await repo.kunci(tx, id);
    if (!s) throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
    const b = await repo.byId(tx, id);
    if (s.status !== 'TUTUP' || !b?.clcNomor) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Penjelasan hanya untuk shift yang sudah ditutup.',
        409,
      );
    }
    if (b.clcSelisih === 0) {
      throw new AppError('STATUS_TIDAK_VALID', 'Shift ini tidak punya selisih.', 409);
    }
    if (b.clcPenjelasan) {
      throw new AppError('KONFLIK', 'Selisih shift ini sudah dijelaskan.', 409);
    }
    await repo.isiPenjelasan(tx, id, { penjelasan, oleh: pelaku.id, waktu: sekarang() });
    await catatLog(tx, {
      aksi: 'SHIFT_PENJELASAN',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: id,
      nomorDokumen: s.nomor,
      ringkasan: `Penjelasan selisih shift ${s.nomor} (${formatRupiah(b.clcSelisih ?? 0)}): ${penjelasan}`,
      ip: asal.ip,
    });
  });
  return detailShift(id, pelaku);
}

/** K11: jumlah shift belum tutup yang lewat jam tutup atau lewat hari (notifikasi atasan). */
export async function jumlahShiftPerluDitutup(): Promise<number> {
  const kini = sekarang();
  return repo.jumlahPerluDitutup(db, tanggalOperasional(kini), kini);
}

/**
 * K11: mengingatkan pemegang `kas.shift.lihat_semua` lewat Telegram/email tentang shift yang lewat jam
 * tutup atau lewat hari. Tiap shift diingatkan paling banyak sekali sehari. Dipanggil berkala oleh server;
 * mengembalikan jumlah shift yang diingatkan.
 */
export async function ingatkanShiftPerluDitutup(): Promise<number> {
  const kini = sekarang();
  const hariIni = tanggalOperasional(kini);
  const daftar = await repo.perluDiingatkan(db, hariIni, kini);
  if (daftar.length === 0) return 0;
  const penerima = await penerimaBerizin('kas.shift.lihat_semua', 0);
  for (const s of daftar) {
    const sebab =
      s.tanggalOperasional < hariIni
        ? `belum ditutup sejak ${tglId(s.tanggalOperasional)}; kasir itu tidak bisa mencatat penjualan sampai shiftnya ditutup`
        : `sudah melewati jam tutup ${s.jadwalTutup ?? ''}`;
    const isi =
      `Shift ${s.nomor} milik ${s.namaKasir} (dibuka ${tglId(s.tanggalOperasional)} pukul ${jamLokal(s.waktuBuka)}) ${sebab}.\n\n` +
      'Minta kasir menghitung uang di laci lalu menutup shift di menu Shift & Clerical Check. ' +
      'Admin/Owner juga bisa menutupnya dari tab Semua shift (klik nomor shift, isi hasil hitung uang).';
    for (const p of penerima) {
      const h = await kirimKePengguna(p, 'BonsaiUrip: shift perlu ditutup', isi);
      if (h.galat.length > 0)
        logger.warn({ shift: s.nomor, galat: h.galat }, 'Pengingat shift gagal');
    }
    await repo.tandaiDiingatkan(db, s.id, kini);
  }
  return daftar.length;
}
