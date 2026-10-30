import { and, eq, sql } from 'drizzle-orm';
import {
  kaliQty,
  type DataRencanaRit,
  type MetaHalaman,
  type Muatan,
  type Perjalanan,
  type TingkatMuatan,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { perjalanan, suratJalan } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import * as armadaRepo from '../../master/armada/repo';
import { masihJalan } from '../../master/armada/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import * as sjRepo from '../surat-jalan/repo';
import {
  batalSuratJalanTx,
  buatSuratJalanTx,
  kunciRitTujuan,
  sisaKirim,
} from '../surat-jalan/service';
import * as repo from './repo';

/*
 * Perjalanan (rit) pengantaran (docs/05 S9, S12–S14; K-150, K-160, K-174): satu kendaraan + satu sopir membawa satu
 * atau lebih surat jalan. Rit direncanakan dulu (DIRENCANAKAN), lalu surat jalan dibuat di dalamnya dari papan
 * Pengiriman, kasir, atau detail invoice; dimuat; berangkat. Surat jalan tidak pernah ada di luar rit, sehingga
 * sopir dan kendaraannya selalu tertulis. Kendaraan dan sopir yang sedang jalan tidak bisa berangkat lagi sampai hasil
 * semua surat jalannya dicatat (perjalanan selesai otomatis, lihat surat-jalan/service.ts `catatHasil`).
 */

async function keRespons(
  ex: Executor,
  rows: Awaited<ReturnType<typeof repo.daftar>>['baris'],
): Promise<Perjalanan[]> {
  const sj = await repo.suratJalanPerjalanan(
    ex,
    rows.map((r) => r.id),
  );
  const hasil: Perjalanan[] = [];
  for (const r of rows) {
    const isi = sj.filter((s) => s.idPerjalanan === r.id).map(({ idPerjalanan: _, ...s }) => s);
    const { kapasitasKg, bakPanjangCm, bakLebarCm, bakTinggiCm, ...umum } = r;
    // Rit rencana: muatan dihitung dari surat jalan yang sudah dicentang dimuat (K-203), dipakai bar dan warna grup.
    const dimuat = isi.filter((s) => s.status === 'DIMUAT');
    const muatan =
      r.status === 'DIRENCANAKAN' && isi.length > 0
        ? await hitungMuatan(
            ex,
            {
              plat: r.plat,
              kapasitasKg,
              bakPanjangCm,
              bakLebarCm,
              bakTinggiCm,
            },
            dimuat.map((s) => s.id),
          )
        : null;
    hasil.push({
      ...umum,
      waktuBerangkat: r.waktuBerangkat?.toISOString() ?? null,
      waktuKembali: r.waktuKembali?.toISOString() ?? null,
      jadwalBerangkat: r.jadwalBerangkat?.toISOString() ?? null,
      muatan,
      suratJalan: isi,
    });
  }
  return hasil;
}

export async function daftarPerjalanan(
  p: repo.SaringPerjalanan & { halaman: number; perHalaman: number },
): Promise<{ data: Perjalanan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(db, baris), meta: metaHalaman(total, p) };
}

async function satuPerjalanan(id: number): Promise<Perjalanan> {
  const { baris } = await repo.daftar(db, { id, limit: 1, offset: 0 });
  const [hasil] = await keRespons(db, baris);
  if (!hasil) throw new AppError('TIDAK_DITEMUKAN', 'Rit tidak ditemukan.', 404);
  return hasil;
}

/** Kunci kendaraan dan sopir (berurutan, agar dua aksi bersamaan antre) dan pastikan aktif. */
async function kunciArmada(tx: Tx, idKendaraan: number, idSopir: number, cekJalan: boolean) {
  const k = await armadaRepo.kunciKendaraan(tx, idKendaraan);
  if (!k) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
  const s = await armadaRepo.kunciSopir(tx, idSopir);
  if (!s) throw new AppError('TIDAK_DITEMUKAN', 'Sopir tidak ditemukan.', 404);
  if (k.statusAktif !== 'AKTIF') {
    throw new AppError('STATUS_TIDAK_VALID', `Kendaraan ${k.plat} nonaktif.`, 409);
  }
  if (s.statusAktif !== 'AKTIF') {
    throw new AppError('STATUS_TIDAK_VALID', `Sopir ${s.nama} nonaktif.`, 409);
  }
  if (cekJalan) {
    const jk = await armadaRepo.perjalananJalan(tx, { idKendaraan: k.id });
    if (jk) throw masihJalan(`Kendaraan ${k.plat}`, jk);
    const js = await armadaRepo.perjalananJalan(tx, { idSopir: s.id });
    if (js) throw masihJalan(`Sopir ${s.nama}`, js);
  }
  return { k, s };
}

/** Kunci surat jalan dan pastikan belum berangkat/batal. */
async function kunciSuratJalanSiap(tx: Tx, daftarId: number[]) {
  const hasil: NonNullable<Awaited<ReturnType<typeof sjRepo.kunci>>>[] = [];
  for (const idSj of [...new Set(daftarId)].sort((a, b) => a - b)) {
    const sj = await sjRepo.kunci(tx, idSj);
    if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
    if (sj.status !== 'DIPROSES' && sj.status !== 'DIMUAT') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Surat jalan ${sj.nomor} sudah ${sj.status === 'BATAL' ? 'batal' : 'berangkat'}; muat ulang halaman.`,
        409,
      );
    }
    hasil.push(sj);
  }
  return hasil;
}

/** K-161: muatan diperiksa sebelum berangkat. Ditolak = berhenti; perlu konfirmasi = alasan wajib. */
async function periksaMuatan(
  tx: Tx,
  k: Parameters<typeof hitungMuatan>[1],
  daftarId: number[],
  alasanMasuk: string | null | undefined,
) {
  const muatan = await hitungMuatan(tx, k, daftarId);
  if (muatan.kesimpulan === 'DITOLAK') {
    throw new AppError('STATUS_TIDAK_VALID', muatan.pesan.join(' '), 409, { muatan });
  }
  const alasan = alasanMasuk?.trim() ?? '';
  if (muatan.kesimpulan === 'KONFIRMASI' && alasan.length < 10) {
    throw new AppError(
      'VALIDASI',
      'Muatan melewati batas wajar: tulis alasan kenapa tetap aman (minimal 10 huruf).',
      400,
      { kolom: { alasanMuatan: ['Alasan muatan wajib diisi.'] }, muatan },
    );
  }
  return { muatan, alasan: muatan.kesimpulan === 'KONFIRMASI' ? alasan : null };
}

/** Semua surat jalan rit → DIKIRIM dengan salinan teks sopir/kendaraan untuk cetakan. */
async function kirimkanSuratJalan(
  tx: Tx,
  idRit: number,
  daftarId: number[],
  teks: { sopir: string; kendaraan: string },
  waktu: Date,
) {
  for (const idSj of daftarId) {
    await tx
      .update(suratJalan)
      .set({
        status: 'DIKIRIM',
        idPerjalanan: idRit,
        sopir: teks.sopir,
        kendaraan: teks.kendaraan.slice(0, 50),
        waktuDikirim: waktu,
        waktuDimuat: sql`coalesce(${suratJalan.waktuDimuat}, ${waktu})`,
        diubahPada: waktu,
      })
      .where(eq(suratJalan.id, idSj));
  }
}

// --- Rit rencana (K-160, docs/13 §4) ---

async function kunciRitRencana(tx: Tx, id: number) {
  const r = await repo.kunci(tx, id);
  if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Rit tidak ditemukan.', 404);
  if (r.status !== 'DIRENCANAKAN') {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Rit ${r.nomor} sudah ${r.status === 'JALAN' ? 'berangkat' : r.status.toLowerCase()}; muat ulang halaman.`,
      409,
    );
  }
  return r;
}

/** S14: rencanakan rit (kendaraan, sopir, jadwal) tanpa mengunci kendaraan; kunci berlaku saat berangkat. */
export async function rencanakanRit(
  input: DataRencanaRit,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  const id = await dalamTransaksi(async (tx) => {
    const { k, s } = await kunciArmada(tx, input.idKendaraan, input.idSopir, false);
    const jadwal = new Date(input.jadwalBerangkat);
    const nomor = await terbitkanNomor(tx, 'TRP', tanggalOperasional(jadwal));
    const idBaru = await repo.tambah(tx, {
      nomor,
      idKendaraan: k.id,
      idSopir: s.id,
      idPengguna: pelaku.id,
      status: 'DIRENCANAKAN',
      waktuBerangkat: null,
      jadwalBerangkat: jadwal,
      catatan: input.catatan ?? null,
      muatanBeratKg: null,
      muatanVolumeM3: null,
      alasanMuatan: null,
    });
    await catatLog(tx, {
      aksi: 'PERJALANAN_RENCANA',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: idBaru,
      nomorDokumen: nomor,
      ringkasan: `Rencana rit ${nomor}: ${k.plat}, sopir ${s.nama}, jadwal ${input.jadwalBerangkat}`,
      ip: asal.ip,
    });
    return idBaru;
  });
  return satuPerjalanan(id);
}

/**
 * Masukkan order ke rit rencana: buat surat jalan untuk seluruh sisa barang sebuah invoice di rit ini, atau pindahkan
 * surat jalan dari rit rencana lain (sopir dan kendaraan di surat jalan ikut berganti).
 */
export async function isiRit(
  id: number,
  input: { idSuratJalan?: number | undefined; idPenjualan?: number | undefined },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  await dalamTransaksi(async (tx) => {
    const r = await kunciRitRencana(tx, id);
    let idSj = input.idSuratJalan ?? null;
    if (idSj === null) {
      if (!input.idPenjualan)
        throw new AppError('VALIDASI', 'Pilih surat jalan atau invoice.', 400);
      // Kartu Backlog: surat jalan baru untuk semua barang yang belum dikirim.
      const sisa = (await sjRepo.qtyBaris(tx, input.idPenjualan))
        .map((b) => ({ idPenjualanDetail: b.id, qtyKirim: sisaKirim(b) }))
        .filter((b) => Number(b.qtyKirim) > 0);
      if (sisa.length === 0) {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          'Invoice ini tidak punya barang yang belum dikirim.',
          409,
        );
      }
      idSj = await buatSuratJalanTx(
        tx,
        input.idPenjualan,
        { baris: sisa, idPerjalanan: id },
        pelaku,
        asal,
      );
    }
    const [sj] = await kunciSuratJalanSiap(tx, [idSj]);
    if (!sj) throw new Error('surat jalan hilang');
    if (sj.idPerjalanan !== null && sj.idPerjalanan !== id) {
      const lain = await repo.kunci(tx, sj.idPerjalanan);
      if (lain && lain.status !== 'DIRENCANAKAN') {
        throw new AppError('STATUS_TIDAK_VALID', `${sj.nomor} sudah di rit ${lain.nomor}.`, 409);
      }
    }
    if (sj.idPerjalanan !== id) {
      const { teks } = await kunciRitTujuan(tx, id);
      await tx
        .update(suratJalan)
        .set({ idPerjalanan: id, ...teks, diubahPada: sekarang() })
        .where(eq(suratJalan.id, sj.id));
    }
    await catatLog(tx, {
      aksi: 'PERJALANAN_ISI',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `${sj.nomor} masuk rit ${r.nomor}`,
      ip: asal.ip,
    });
  });
  return satuPerjalanan(id);
}

/**
 * K-174: keluarkan order dari rit rencana. Surat jalannya dibatalkan (surat jalan tidak boleh ada tanpa sopir dan
 * kendaraan), barangnya kembali menjadi order kirim di Backlog.
 */
export async function keluarkanDariRit(
  idSj: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const [sj] = await kunciSuratJalanSiap(tx, [idSj]);
    if (!sj) return;
    const r = sj.idPerjalanan ? await kunciRitRencana(tx, sj.idPerjalanan) : null;
    await batalSuratJalanTx(
      tx,
      sj.id,
      r ? `Dikeluarkan dari rit ${r.nomor}` : 'Dikeluarkan (tanpa rit)',
      pelaku,
      asal,
    );
    if (r) {
      await catatLog(tx, {
        aksi: 'PERJALANAN_ISI',
        idPengguna: pelaku.id,
        entitas: 'perjalanan',
        idEntitas: r.id,
        nomorDokumen: r.nomor,
        ringkasan: `${sj.nomor} dikeluarkan dari rit ${r.nomor} (surat jalan batal, barang kembali ke Backlog)`,
        ip: asal.ip,
      });
    }
  });
}

/** Semua surat jalan rit rencana yang belum dimuat → DIMUAT. */
export async function muatRit(id: number, pelaku: PenggunaAktif, asal: AsalRequest) {
  await dalamTransaksi(async (tx) => {
    const r = await kunciRitRencana(tx, id);
    const isi = await repo.idSuratJalanRit(tx, id);
    if (isi.length === 0)
      throw new AppError('STATUS_TIDAK_VALID', `Rit ${r.nomor} masih kosong.`, 409);
    const waktu = sekarang();
    await tx
      .update(suratJalan)
      .set({ status: 'DIMUAT', waktuDimuat: waktu, diubahPada: waktu })
      .where(and(eq(suratJalan.idPerjalanan, id), eq(suratJalan.status, 'DIPROSES')));
    await catatLog(tx, {
      aksi: 'PERJALANAN_DIMUAT',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Rit ${r.nomor} dimuat (${isi.length} surat jalan)`,
      ip: asal.ip,
    });
  });
  return satuPerjalanan(id);
}

/** S9: rit rencana berangkat (kendaraan/sopir tidak sedang jalan, muatan diperiksa); semua surat jalan → DIKIRIM. */
export async function berangkatkanRit(
  id: number,
  input: { alasanMuatan?: string | null | undefined },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  await dalamTransaksi(async (tx) => {
    const r = await kunciRitRencana(tx, id);
    const { k, s } = await kunciArmada(tx, r.idKendaraan, r.idSopir, true);
    const daftar = await kunciSuratJalanSiap(tx, await repo.idSuratJalanRit(tx, id));
    if (daftar.length === 0)
      throw new AppError('STATUS_TIDAK_VALID', `Rit ${r.nomor} masih kosong.`, 409);
    // K-203: semua surat jalan harus dicentang dimuat sebelum berangkat.
    const belum = daftar.filter((x) => x.status !== 'DIMUAT');
    if (belum.length > 0) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Centang muat dulu semua surat jalan rit ${r.nomor}: ${belum.map((x) => x.nomor).join(', ')} belum dimuat.`,
        409,
      );
    }
    const daftarId = daftar.map((x) => x.id);
    const { muatan, alasan } = await periksaMuatan(tx, k, daftarId, input.alasanMuatan);
    const waktu = sekarang();
    await tx
      .update(perjalanan)
      .set({
        status: 'JALAN',
        waktuBerangkat: waktu,
        muatanBeratKg: muatan.beratKg,
        muatanVolumeM3: muatan.volumeM3,
        alasanMuatan: alasan,
        diubahPada: waktu,
      })
      .where(eq(perjalanan.id, id));
    await kirimkanSuratJalan(
      tx,
      id,
      daftarId,
      { sopir: s.nama, kendaraan: `${k.plat} (${k.jenis})` },
      waktu,
    );
    await catatLog(tx, {
      aksi: 'PERJALANAN_BERANGKAT',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan:
        `Rit ${r.nomor} berangkat: ${k.plat}, sopir ${s.nama}, ${daftar.map((x) => x.nomor).join(', ')}; ` +
        `muatan ${muatan.beratKg} kg, ${muatan.volumeM3} m³${alasan ? ` (${alasan})` : ''}`,
      ip: asal.ip,
    });
  });
  return satuPerjalanan(id);
}

/**
 * K-203: ubah kendaraan, sopir, dan jadwal rit yang belum berangkat (mis. kendaraan ternyata terlalu kecil). Teks
 * sopir/kendaraan di surat jalannya ikut diganti.
 */
export async function ubahRit(
  id: number,
  input: { idKendaraan: number; idSopir: number; jadwalBerangkat: string },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  await dalamTransaksi(async (tx) => {
    const r = await kunciRitRencana(tx, id);
    const { k, s } = await kunciArmada(tx, input.idKendaraan, input.idSopir, false);
    const waktu = sekarang();
    await tx
      .update(perjalanan)
      .set({
        idKendaraan: k.id,
        idSopir: s.id,
        jadwalBerangkat: new Date(input.jadwalBerangkat),
        diubahPada: waktu,
      })
      .where(eq(perjalanan.id, id));
    await tx
      .update(suratJalan)
      .set({ sopir: s.nama, kendaraan: `${k.plat} (${k.jenis})`, diubahPada: waktu })
      .where(eq(suratJalan.idPerjalanan, id));
    const beda = [
      r.idKendaraan !== k.id ? `kendaraan → ${k.plat}` : null,
      r.idSopir !== s.id ? `sopir → ${s.nama}` : null,
      `jadwal ${input.jadwalBerangkat}`,
    ].filter(Boolean);
    await catatLog(tx, {
      aksi: 'PERJALANAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Rit ${r.nomor} diubah: ${beda.join(', ')}`,
      dataLama: { idKendaraan: r.idKendaraan, idSopir: r.idSopir },
      dataBaru: { idKendaraan: k.id, idSopir: s.id, jadwalBerangkat: input.jadwalBerangkat },
      ip: asal.ip,
    });
  });
  return satuPerjalanan(id);
}

/** Batalkan rit rencana (K-174): surat jalannya ikut batal, barangnya kembali menjadi order kirim di Backlog. */
export async function batalkanRit(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  await dalamTransaksi(async (tx) => {
    const r = await kunciRitRencana(tx, id);
    const waktu = sekarang();
    for (const idSj of await repo.idSuratJalanRit(tx, id)) {
      await batalSuratJalanTx(tx, idSj, `Rit ${r.nomor} dibatalkan: ${alasan}`, pelaku, asal);
    }
    await tx
      .update(perjalanan)
      .set({ status: 'BATAL', alasanBatal: alasan, diubahPada: waktu })
      .where(eq(perjalanan.id, id));
    await catatLog(tx, {
      aksi: 'PERJALANAN_BATAL',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Rit ${r.nomor} dibatalkan: ${alasan}`,
      ip: asal.ip,
    });
  });
  return satuPerjalanan(id);
}

// --- Muatan (K-161, docs/13 §3) ---

const PERINGKAT: Record<TingkatMuatan, number> = {
  TIDAK_DIKETAHUI: 0,
  AMAN: 0,
  HAMPIR_PENUH: 1,
  KONFIRMASI: 2,
  DITOLAK: 3,
};

/** Angka fisik (berat/volume) untuk tampilan: dibulatkan, tanpa nol berlebih. */
const teks = (n: number, desimal: number) => String(Number(n.toFixed(desimal)));
/** Persen untuk kalimat pesan: koma desimal Indonesia. */
const ps = (n: number) => `${n.toLocaleString('id-ID')}%`;

type KendaraanMuatan = {
  plat: string;
  kapasitasKg: number | null;
  bakPanjangCm: number | null;
  bakLebarCm: number | null;
  bakTinggiCm: number | null;
};

/**
 * Hitung muatan surat jalan terhadap satu kendaraan. Qty dasar dihitung dengan helper qty; berat dan volume
 * adalah perkiraan fisik (bukan uang/qty), sehingga dijumlah sebagai angka biasa lalu dibulatkan untuk tampilan.
 */
export async function hitungMuatan(
  ex: Executor,
  k: KendaraanMuatan,
  idSuratJalan: number[],
): Promise<Muatan> {
  const faktorIsi = await ambilAngka('muatan_faktor_isi_persen', 85, ex);
  const julur = await ambilAngka('muatan_julur_maks_cm', 100, ex);
  // K-203: di atas 100% sampai toleransi = boleh dengan alasan; di atasnya ditolak (ganti kendaraan).
  const toleransi = await ambilAngka('muatan_toleransi_persen', 110, ex);
  const baris = await repo.barisMuatan(ex, idSuratJalan);
  let berat = 0;
  let volume = 0;
  let terpanjang: number | null = null;
  const tanpaData = new Set<string>();
  for (const b of baris) {
    const qtyDasar = Number(kaliQty(b.qtyKirim, b.faktor));
    if (b.beratKg === null) tanpaData.add(b.namaBarang);
    else berat += qtyDasar * Number(b.beratKg);
    if (b.curah) {
      if (b.volumeM3 === null) tanpaData.add(b.namaBarang);
      else volume += qtyDasar * Number(b.volumeM3);
    } else if (b.panjangCm !== null && b.lebarCm !== null && b.tinggiCm !== null) {
      const p = Number(b.panjangCm);
      const l = Number(b.lebarCm);
      const t = Number(b.tinggiCm);
      volume += (qtyDasar * p * l * t) / 1_000_000;
      terpanjang = Math.max(terpanjang ?? 0, p, l, t);
    } else if (b.volumeM3 !== null) {
      volume += qtyDasar * Number(b.volumeM3);
    } else {
      tanpaData.add(b.namaBarang);
    }
  }

  const pesan: string[] = [];
  const saran: string[] = [];
  const persen = (a: number, b: number) => Math.round((a / b) * 1000) / 10;

  // Berat (K-203): di atas daya angkut sampai toleransi butuh alasan; di atasnya ditolak (ODOL).
  let tBerat: TingkatMuatan = 'TIDAK_DIKETAHUI';
  const pBerat = k.kapasitasKg ? persen(berat, k.kapasitasKg) : null;
  if (pBerat === null) {
    pesan.push(`Daya angkut ${k.plat} belum diisi: berat muatan tidak bisa diperiksa.`);
  } else if (pBerat > toleransi) {
    tBerat = 'DITOLAK';
    pesan.push(
      `Berat ${teks(berat, 0)} kg (${ps(pBerat)}) jauh melebihi daya angkut ${k.plat} (${k.kapasitasKg} kg), di atas ` +
        `batas toleransi ${ps(toleransi)}. Kurangi barang atau ganti kendaraan (Ubah rit): kelebihan muatan ` +
        'membahayakan rem dan melanggar aturan ODOL.',
    );
  } else if (pBerat > 100) {
    tBerat = 'KONFIRMASI';
    pesan.push(
      `Berat ${ps(pBerat)} dari daya angkut ${k.plat}: masih dalam toleransi ${ps(toleransi)}, wajib tulis alasan ` +
        '(mis. jarak dekat, jalan datar, kecepatan rendah) dan periksa ban/rem.',
    );
  } else if (pBerat > 90) {
    tBerat = 'HAMPIR_PENUH';
    pesan.push(`Berat ${ps(pBerat)} dari daya angkut: periksa kendaraan setelah dimuat.`);
  } else {
    tBerat = 'AMAN';
  }

  // Volume: dibanding volume bak × faktor isi.
  let tVolume: TingkatMuatan = 'TIDAK_DIKETAHUI';
  const bak =
    k.bakPanjangCm && k.bakLebarCm && k.bakTinggiCm
      ? ((k.bakPanjangCm * k.bakLebarCm * k.bakTinggiCm) / 1_000_000) * (faktorIsi / 100)
      : null;
  const pVolume = bak ? persen(volume, bak) : null;
  if (pVolume === null) {
    pesan.push(`Ukuran bak ${k.plat} belum diisi: volume muatan tidak bisa diperiksa.`);
  } else if (pVolume > toleransi) {
    tVolume = 'DITOLAK';
    pesan.push(
      `Volume barang ${teks(volume, 2).replace('.', ',')} m³ jauh melebihi ruang bak (${teks(bak ?? 0, 2).replace('.', ',')} m³ terpakai wajar). ` +
        `Di atas batas toleransi ${ps(toleransi)}: bagi menjadi dua rit atau ganti kendaraan lebih besar (Ubah rit).`,
    );
  } else if (pVolume > 100) {
    tVolume = 'KONFIRMASI';
    pesan.push(
      `Volume ${ps(pVolume)} dari ruang bak: wajib tulis alasan kenapa tetap aman (mis. ditumpuk di atas dinding, ` +
        'diikat dan ditutup terpal) dan periksa setelah dimuat.',
    );
  } else if (pVolume > 85) {
    tVolume = 'HAMPIR_PENUH';
    pesan.push(`Volume ${ps(pVolume)} dari ruang bak: hampir penuh, periksa setelah dimuat.`);
  } else {
    tVolume = 'AMAN';
  }

  // Panjang: barang terpanjang dibanding panjang bak (+ julur yang diizinkan, dengan alasan).
  let tPanjang: TingkatMuatan = 'TIDAK_DIKETAHUI';
  if (terpanjang !== null && k.bakPanjangCm) {
    if (terpanjang <= k.bakPanjangCm) tPanjang = 'AMAN';
    else if (terpanjang <= k.bakPanjangCm + julur) {
      tPanjang = 'KONFIRMASI';
      pesan.push(
        `Barang terpanjang ${teks(terpanjang, 0)} cm menjulur ${teks(terpanjang - k.bakPanjangCm, 0)} cm dari bak ` +
          `(${k.bakPanjangCm} cm): wajib tulis alasan (diikat, bendera merah di ujung, rute).`,
      );
    } else {
      tPanjang = 'DITOLAK';
      pesan.push(
        `Barang terpanjang ${teks(terpanjang, 0)} cm melebihi bak ${k.bakPanjangCm} cm lebih dari ${julur} cm ` +
          'yang diizinkan. Pakai kendaraan dengan bak lebih panjang.',
      );
    }
  }
  if (tanpaData.size > 0) {
    pesan.push(
      `${tanpaData.size} barang belum punya berat/ukuran (dihitung 0): ${[...tanpaData].slice(0, 3).join(', ')}` +
        `${tanpaData.size > 3 ? ', …' : ''}. Lengkapi di Data Barang › Data muatan.`,
    );
  }
  if (pBerat !== null && pVolume !== null && pBerat < 30 && pVolume < 30) {
    saran.push(
      `Muatan baru ${ps(Math.max(pBerat, pVolume))} kapasitas ${k.plat}. Bila tujuannya berjauhan, pertimbangkan ` +
        'kendaraan lebih kecil atau gabungkan dengan order kirim lain searah.',
    );
  }

  const tingkat = { berat: tBerat, volume: tVolume, panjang: tPanjang };
  const terburuk = Object.values(tingkat).reduce<TingkatMuatan>(
    (a, t) => (PERINGKAT[t] > PERINGKAT[a] ? t : a),
    'AMAN',
  );
  return {
    beratKg: teks(berat, 1),
    volumeM3: teks(volume, 3),
    terpanjangCm: terpanjang === null ? null : teks(terpanjang, 0),
    dayaAngkutKg: k.kapasitasKg,
    volumeBakM3: bak === null ? null : teks(bak, 3),
    panjangBakCm: k.bakPanjangCm,
    julurMaksCm: julur,
    faktorIsiPersen: faktorIsi,
    persenBerat: pBerat,
    persenVolume: pVolume,
    tingkat,
    kesimpulan: terburuk === 'TIDAK_DIKETAHUI' ? 'AMAN' : terburuk,
    barangTanpaData: [...tanpaData],
    pesan,
    saran,
  };
}
