import { eq, sql } from 'drizzle-orm';
import {
  kaliQty,
  type DataBerangkat,
  type MetaHalaman,
  type Muatan,
  type Perjalanan,
  type TingkatMuatan,
} from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { suratJalan } from '../../../db/schema';
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
import * as repo from './repo';

/*
 * Perjalanan pengantaran (docs/05 S9, S12; K-150): satu kendaraan + satu sopir membawa satu atau lebih surat
 * jalan. Kendaraan dan sopir yang sedang jalan tidak bisa berangkat lagi sampai hasil semua surat jalannya
 * dicatat (perjalanan selesai otomatis, lihat surat-jalan/service.ts `catatHasil`).
 */

async function keRespons(
  ex: Executor,
  rows: Awaited<ReturnType<typeof repo.daftar>>['baris'],
): Promise<Perjalanan[]> {
  const sj = await repo.suratJalanPerjalanan(
    ex,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    waktuBerangkat: r.waktuBerangkat.toISOString(),
    waktuKembali: r.waktuKembali?.toISOString() ?? null,
    suratJalan: sj.filter((s) => s.idPerjalanan === r.id).map(({ idPerjalanan: _, ...s }) => s),
  }));
}

export async function daftarPerjalanan(
  p: repo.SaringPerjalanan & { halaman: number; perHalaman: number },
): Promise<{ data: Perjalanan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(db, baris), meta: metaHalaman(total, p) };
}

/** S9: berangkatkan surat jalan DIPROSES/DIMUAT dengan kendaraan dan sopir yang tidak sedang jalan. */
export async function berangkat(
  input: DataBerangkat,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  const id = await dalamTransaksi(async (tx) => {
    // Kunci kendaraan dan sopir dulu: dua keberangkatan bersamaan dengan kendaraan/sopir yang sama berurutan.
    const k = await armadaRepo.kunciKendaraan(tx, input.idKendaraan);
    if (!k) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
    const s = await armadaRepo.kunciSopir(tx, input.idSopir);
    if (!s) throw new AppError('TIDAK_DITEMUKAN', 'Sopir tidak ditemukan.', 404);
    if (k.statusAktif !== 'AKTIF') {
      throw new AppError('STATUS_TIDAK_VALID', `Kendaraan ${k.plat} nonaktif.`, 409);
    }
    if (s.statusAktif !== 'AKTIF') {
      throw new AppError('STATUS_TIDAK_VALID', `Sopir ${s.nama} nonaktif.`, 409);
    }
    const jk = await armadaRepo.perjalananJalan(tx, { idKendaraan: k.id });
    if (jk) throw masihJalan(`Kendaraan ${k.plat}`, jk);
    const js = await armadaRepo.perjalananJalan(tx, { idSopir: s.id });
    if (js) throw masihJalan(`Sopir ${s.nama}`, js);

    const daftarId = [...new Set(input.idSuratJalan)].sort((a, b) => a - b);
    const nomorSj: string[] = [];
    for (const idSj of daftarId) {
      const sj = await sjRepo.kunci(tx, idSj);
      if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
      if (sj.status !== 'DIPROSES' && sj.status !== 'DIMUAT') {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          `Surat jalan ${sj.nomor} sudah ${sj.status === 'BATAL' ? 'batal' : 'berangkat'}; muat ulang halaman.`,
          409,
        );
      }
      nomorSj.push(sj.nomor);
    }

    // K-161: muatan diperiksa sebelum berangkat. Ditolak = berhenti; perlu konfirmasi = alasan wajib.
    const muatan = await hitungMuatan(tx, k, daftarId);
    if (muatan.kesimpulan === 'DITOLAK') {
      throw new AppError('STATUS_TIDAK_VALID', muatan.pesan.join(' '), 409, { muatan });
    }
    const alasan = input.alasanMuatan?.trim() ?? '';
    if (muatan.kesimpulan === 'KONFIRMASI' && alasan.length < 10) {
      throw new AppError(
        'VALIDASI',
        'Muatan melewati batas wajar: tulis alasan kenapa tetap aman (minimal 10 huruf).',
        400,
        { kolom: { alasanMuatan: ['Alasan muatan wajib diisi.'] }, muatan },
      );
    }

    const waktu = sekarang();
    const nomor = await terbitkanNomor(tx, 'TRP', tanggalOperasional(waktu));
    const idBaru = await repo.tambah(tx, {
      nomor,
      idKendaraan: k.id,
      idSopir: s.id,
      idPengguna: pelaku.id,
      waktuBerangkat: waktu,
      catatan: input.catatan ?? null,
      muatanBeratKg: muatan.beratKg,
      muatanVolumeM3: muatan.volumeM3,
      alasanMuatan: muatan.kesimpulan === 'KONFIRMASI' ? alasan : null,
    });
    const teksKendaraan = `${k.plat} (${k.jenis})`.slice(0, 50);
    for (const idSj of daftarId) {
      await tx
        .update(suratJalan)
        .set({
          status: 'DIKIRIM',
          idPerjalanan: idBaru,
          sopir: s.nama,
          kendaraan: teksKendaraan,
          waktuDikirim: waktu,
          waktuDimuat: sql`coalesce(${suratJalan.waktuDimuat}, ${waktu})`,
          diubahPada: waktu,
        })
        .where(eq(suratJalan.id, idSj));
    }
    await catatLog(tx, {
      aksi: 'PERJALANAN_BERANGKAT',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: idBaru,
      nomorDokumen: nomor,
      ringkasan:
        `Perjalanan ${nomor}: ${k.plat}, sopir ${s.nama}, ${nomorSj.join(', ')}; muatan ` +
        `${muatan.beratKg} kg, ${muatan.volumeM3} m³` +
        (muatan.kesimpulan === 'KONFIRMASI' ? ` (melewati batas lunak: ${alasan})` : ''),
      ip: asal.ip,
    });
    return idBaru;
  });
  const { baris } = await repo.daftar(db, { id, limit: 1, offset: 0 });
  const [hasil] = await keRespons(db, baris);
  if (!hasil) throw new Error('perjalanan hilang');
  return hasil;
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

  // Berat: tidak ada toleransi di atas daya angkut (ODOL).
  let tBerat: TingkatMuatan = 'TIDAK_DIKETAHUI';
  const pBerat = k.kapasitasKg ? persen(berat, k.kapasitasKg) : null;
  if (pBerat === null) {
    pesan.push(`Daya angkut ${k.plat} belum diisi: berat muatan tidak bisa diperiksa.`);
  } else if (pBerat > 100) {
    tBerat = 'DITOLAK';
    pesan.push(
      `Berat ${teks(berat, 0)} kg melebihi daya angkut ${k.plat} (${k.kapasitasKg} kg). Kurangi barang ` +
        'atau pakai kendaraan lain: kelebihan muatan membahayakan rem dan melanggar aturan ODOL.',
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
  } else if (pVolume > 115) {
    tVolume = 'DITOLAK';
    pesan.push(
      `Volume barang ${teks(volume, 2).replace('.', ',')} m³ jauh melebihi ruang bak (${teks(bak ?? 0, 2).replace('.', ',')} m³ terpakai wajar). ` +
        'Bagi menjadi dua rit atau pakai kendaraan lebih besar.',
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

/** Pratinjau muatan untuk dialog Berangkat (tanpa menulis apa pun). */
export async function pratinjauMuatan(input: {
  idKendaraan: number;
  idSuratJalan: number[];
}): Promise<Muatan> {
  const k = await armadaRepo.kendaraanById(db, input.idKendaraan);
  if (!k) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
  return hitungMuatan(db, k, input.idSuratJalan);
}
