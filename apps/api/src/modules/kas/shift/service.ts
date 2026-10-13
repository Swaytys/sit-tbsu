import { and, eq } from 'drizzle-orm';
import {
  ARAH_JENIS_KAS,
  formatRupiah,
  type BarisShift,
  type DataKasShift,
  type DataTutupShift,
  type DaftarShift,
  type DetailShift,
  type HasilClerical,
  type JenisKasShift,
  type ShiftAktif,
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
import { jamLokal, saatLokal, sekarang, tanggalOperasional } from '../../../lib/waktu';
import { ambilTeks } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { kirimKePengguna, penerimaBerizin } from '../../sistem/saluran/service';
import * as repo from './repo';

/*
 * Shift kasir dan clerical check (docs/05 §10, K1–K8; K-018). Semua uang tunai (pembayaran, refund, kas lain)
 * terikat ke shift BUKA milik pencatatnya. Tutup shift = blind count: kasir menginput uang fisik, server
 * menghitung saldo sistem (K5) lalu menyimpan clerical check; angka sistem baru tampil setelah tutup (K4).
 *
 * K-109 (K9–K11): shift dari hari operasional sebelumnya yang belum ditutup mengunci pencatatan pemiliknya
 * sampai ditutup; jadwal buka/tutup toko dibekukan ke shift saat dibuka; atasan diingatkan bila ada shift
 * yang lewat jam tutup atau lewat hari.
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
 * Shift BUKA milik pengguna, atau `null`. `kunci`: FOR SHARE, dipakai saat mencatat uang ke shift itu agar
 * tidak bersamaan dengan tutup shift (FOR UPDATE) — clerical tidak boleh melewatkan transaksi (K6).
 */
export async function shiftBuka(ex: Executor | Tx, idPengguna: number, kunci = false) {
  const q = ex
    .select({
      id: shiftKasir.id,
      nomor: shiftKasir.nomor,
      tanggalOperasional: shiftKasir.tanggalOperasional,
      waktuBuka: shiftKasir.waktuBuka,
      modalAwal: shiftKasir.modalAwal,
      jadwalBuka: shiftKasir.jadwalBuka,
      jadwalTutup: shiftKasir.jadwalTutup,
    })
    .from(shiftKasir)
    .where(and(eq(shiftKasir.idKasir, idPengguna), eq(shiftKasir.status, 'BUKA')))
    .limit(1);
  const [s] = kunci ? await q.for('share') : await q;
  return s ?? null;
}

/**
 * K9: shift BUKA milik pengguna untuk MENCATAT penjualan atau uang (dikunci FOR SHARE), atau `null` bila
 * tidak punya. Shift dari hari operasional sebelumnya ditolak: pemiliknya harus menutupnya dulu (hitung
 * uang di laci), supaya satu shift tidak memuat transaksi beberapa hari dan selisih kas tidak tertunda.
 */
export async function shiftUntukCatat(tx: Tx, idPengguna: number) {
  const s = await shiftBuka(tx, idPengguna, true);
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

function keAktif(s: NonNullable<Awaited<ReturnType<typeof shiftBuka>>>): ShiftAktif {
  return { ...s, waktuBuka: s.waktuBuka.toISOString(), ...waktuShift(s) };
}

export async function shiftSaya(pelaku: PenggunaAktif): Promise<ShiftAktif | null> {
  const s = await shiftBuka(db, pelaku.id);
  return s ? keAktif(s) : null;
}

/** K1: satu shift BUKA per pengguna; modal awal boleh 0. */
export async function bukaShift(
  modalAwal: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ShiftAktif> {
  await dalamTransaksi(async (tx) => {
    const ada = await shiftBuka(tx, pelaku.id);
    if (ada) {
      throw new AppError(
        'KONFLIK',
        `Anda masih punya shift terbuka (${ada.nomor}). Tutup shift itu dulu.`,
        409,
      );
    }
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'SHF', tanggal);
    // K10: jadwal toko dibekukan ke shift ini; perubahan pengaturan berlaku untuk shift berikutnya.
    const jadwalBuka = (await ambilTeks('shift_jam_buka', '', tx)) || null;
    const jadwalTutup = (await ambilTeks('shift_jam_tutup', '', tx)) || null;
    const [s] = await tx
      .insert(shiftKasir)
      .values({
        nomor,
        idKasir: pelaku.id,
        tanggalOperasional: tanggal,
        modalAwal,
        jadwalBuka,
        jadwalTutup,
      })
      .returning({ id: shiftKasir.id });
    await catatLog(tx, {
      aksi: 'SHIFT_BUKA',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: s?.id,
      nomorDokumen: nomor,
      ringkasan: `Buka shift ${nomor}, modal awal ${formatRupiah(modalAwal)}`,
      ip: asal.ip,
    });
  });
  const s = await shiftBuka(db, pelaku.id);
  if (!s) throw new Error('shift baru tidak terbaca');
  return keAktif(s);
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
          tunaiPenjualan: b.clcTunaiPenjualan ?? 0,
          kasMasukLain: b.clcKasMasukLain ?? 0,
          kasKeluar: b.clcKasKeluar ?? 0,
          saldoSistem: b.clcSaldoSistem ?? 0,
          uangFisik: b.clcUangFisik ?? 0,
          selisih: b.clcSelisih ?? 0,
          keterangan: b.clcKeterangan,
          namaPemeriksa: b.clcNamaPemeriksa ?? '',
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
    waktu: b.status === 'BUKA' ? waktuShift(b) : null,
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

/** K4: ringkasan saldo shift BUKA hanya untuk `kas.shift.lihat_semua` (kasir: setelah tutup). */
export async function detailShift(id: number, pelaku: PenggunaAktif): Promise<DetailShift> {
  const b = await repo.byId(db, id);
  const semua = pelaku.izin.has('kas.shift.lihat_semua');
  if (!b || (!semua && b.idKasir !== pelaku.id)) {
    throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
  }
  const kas = (await repo.daftarKas(db, id)).map((k) => ({ ...k, waktu: k.waktu.toISOString() }));
  let ringkasan: DetailShift['ringkasan'] = null;
  if (b.status === 'TUTUP' || semua) {
    const k = await repo.komponenKas(db, id);
    ringkasan = {
      modalAwal: b.modalAwal,
      ...k,
      saldoSistem: b.modalAwal + k.tunaiPenjualan + k.kasMasukLain - k.kasKeluar,
    };
  }
  return { ...keBaris(b), kas, ringkasan };
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

/**
 * K4–K6: tutup shift. Pemilik shift menutup shiftnya sendiri; pemegang `kas.shift.lihat_semua` boleh menutup
 * shift kasir lain (kasir lupa tutup). Saldo sistem dihitung server di bawah kunci shift; selisih ≠ 0 wajib
 * keterangan (tanpa membuka angkanya). Order DIPROSES kasir itu kembali ke antrean.
 */
export async function tutupShift(
  id: number,
  input: DataTutupShift,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailShift> {
  let orderDilepas = 0;
  await dalamTransaksi(async (tx) => {
    const s = await repo.kunci(tx, id);
    const semua = pelaku.izin.has('kas.shift.lihat_semua');
    if (!s || (s.idKasir !== pelaku.id && !semua)) {
      throw new AppError('TIDAK_DITEMUKAN', 'Shift tidak ditemukan.', 404);
    }
    if (s.status !== 'BUKA') {
      throw new AppError('STATUS_TIDAK_VALID', `Shift ${s.nomor} sudah ditutup.`, 409);
    }
    const k = await repo.komponenKas(tx, id);
    const saldoSistem = s.modalAwal + k.tunaiPenjualan + k.kasMasukLain - k.kasKeluar;
    const selisih = input.uangFisik - saldoSistem;
    if (selisih !== 0 && !input.keterangan) {
      throw new AppError(
        'KONFLIK',
        'Uang fisik tidak sama dengan catatan sistem. Tulis keterangan selisih untuk menutup shift.',
        409,
        { kolom: { keterangan: ['Keterangan selisih wajib diisi.'] }, perluKeterangan: true },
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
      modalAwal: s.modalAwal,
      tunaiPenjualan: k.tunaiPenjualan,
      kasMasukLain: k.kasMasukLain,
      kasKeluar: k.kasKeluar,
      saldoSistem,
      uangFisik: input.uangFisik,
      keterangan: input.keterangan ?? null,
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
        `Tutup shift ${s.nomor} (${nomor}): sistem ${formatRupiah(saldoSistem)}, fisik ${formatRupiah(input.uangFisik)}, ` +
        `selisih ${formatRupiah(selisih)}${input.keterangan ? ` — ${input.keterangan}` : ''}` +
        (s.idKasir !== pelaku.id ? ' (ditutup oleh pengguna lain)' : ''),
      ip: asal.ip,
    });
  });
  if (orderDilepas > 0) siarkan('antrean');
  return detailShift(id, pelaku);
}

/** K11: jumlah shift BUKA yang lewat jam tutup atau lewat hari (notifikasi atasan). */
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
