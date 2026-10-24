import {
  bandingQty,
  jumlahHari,
  keQty,
  rapikanDesimal,
  STATUS_SARAN_PESAN,
  subtotalRupiah,
  Z_TINGKAT_LAYANAN,
  type BarisSaranPesan,
  type HasilSaranPesan,
  type Izin,
  type ParameterSaranPesan,
  type RingkasanPemasokSaran,
  type StatusSaranPesan,
  type skemaCariSaranPesan,
} from '@sit/shared';
import type { z } from 'zod';
import { db } from '../../../db/client';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { hitungSaranMetode } from './hitung';
import * as repo from './repo';

/*
 * Rekomendasi pemesanan ulang (K-113, docs/05 §17 RO1–RO13). Dihitung dari ledger dan cache persediaan saat
 * diminta; hasil per metode disimpan sementara di memori (RO13), tidak di database.
 */

type Keluaran = z.output<typeof skemaCariSaranPesan>;
/** Metode dan tingkat layanan boleh tidak dikirim (laporan, notifikasi): bawaan A dan 95 %. */
export type DataCariSaranPesan = Omit<Keluaran, 'metode' | 'layanan'> &
  Partial<Pick<Keluaran, 'metode' | 'layanan'>>;

/** Baris lengkap (dengan nilai rupiah dan id kategori) sebelum disaring. */
type BarisPenuh = BarisSaranPesan & { idKategori: number };

const UMUR_SIMPANAN_MS = 10 * 60 * 1000;
const simpanan = new Map<string, { waktu: number; mutasi: string; baris: BarisPenuh[] }>();

/** Untuk tes: kosongkan simpanan. */
export function lupakanSimpananSaran(): void {
  simpanan.clear();
}

const URUTAN: Record<StatusSaranPesan, number> = {
  PESAN_SEKARANG: 0,
  SEGERA: 1,
  AMAN: 2,
  TIDAK_LAKU: 3,
};

/** RO1–RO4: parameter dari pengaturan; periode = N hari penuh terakhir sampai kemarin. */
export async function parameterSaran(
  hariIni = tanggalOperasional(),
  pilihan: Pick<ParameterSaranPesan, 'metode' | 'tingkatLayanan'> = {
    metode: 'RATA',
    tingkatLayanan: 95,
  },
): Promise<ParameterSaranPesan> {
  const periodeHari = await ambilAngka('saran_pesan_periode_hari', 30);
  return {
    ...pilihan,
    periodeHari,
    dari: tambahHari(hariIni, -periodeHari),
    sampai: tambahHari(hariIni, -1),
    hariPengaman: await ambilAngka('saran_pesan_hari_pengaman', 2),
    lamaKirimBawaan: await ambilAngka('saran_pesan_lama_kirim_default', 3),
    jarakBelanjaBawaan: await ambilAngka('saran_pesan_jarak_belanja_default', 7),
  };
}

function bolehNilai(izin: ReadonlySet<Izin>): boolean {
  return izin.has('master.barang.lihat_hpp');
}

/** Semua barang dihitung dengan metode pilihan (tanpa saringan), lengkap dengan nilai rupiah. */
async function hitungSemua(prm: ParameterSaranPesan): Promise<BarisPenuh[]> {
  const barang = await repo.barangUntukSaran(db, { dari: prm.dari, sampai: prm.sampai });
  const idPemasok = [
    ...new Set(barang.flatMap((b) => (b.idPemasok === null ? [] : [b.idPemasok]))),
  ];
  const pemasok = new Map((await repo.pemasokSaran(db, idPemasok)).map((p) => [p.id, p]));
  // Deret harian hanya untuk metode yang memakainya (B, D).
  const perluDeret = prm.metode === 'STATISTIK' || prm.metode === 'TREN';
  const harian = new Map<string, string>();
  if (perluDeret) {
    for (const r of await repo.penjualanHarian(db, prm)) {
      harian.set(`${r.idBarang}|${r.tanggal}`, r.qty);
    }
  }
  const z = Z_TINGKAT_LAYANAN[prm.tingkatLayanan];
  return barang.map((b) => {
    const pm = b.idPemasok === null ? undefined : pemasok.get(b.idPemasok);
    const lamaKirimHari = pm?.lamaKirimHari ?? prm.lamaKirimBawaan;
    const jarakBelanjaHari = pm?.jarakBelanjaHari ?? prm.jarakBelanjaBawaan;
    // RO1: barang yang riwayatnya lebih pendek dari periode diamati sejak mutasi pertamanya.
    const hariRiwayat = b.mutasiPertama ? jumlahHari(b.mutasiPertama, prm.sampai) : 0;
    const hariAmatan = Math.max(0, Math.min(prm.periodeHari, hariRiwayat));
    const deret = perluDeret
      ? Array.from({ length: hariAmatan }, (_, i) => {
          const q = harian.get(`${b.idBarang}|${tambahHari(prm.sampai, i - hariAmatan + 1)}`);
          return q !== undefined && bandingQty(q, 0) > 0 ? q : '0';
        })
      : [];
    const h = hitungSaranMetode({
      metode: prm.metode,
      terjual: b.terjual,
      hariAmatan,
      harian: deret,
      z,
      stokTersedia: b.stokTersedia,
      stokMinimum: b.stokMinimum,
      stokMaksimum: b.stokMaksimum,
      lamaKirimHari,
      jarakBelanjaHari,
      hariPengaman: prm.hariPengaman,
      faktorKemasan: b.faktorKemasan,
    });
    const hargaBeli = b.hargaBeliTerakhir > 0 ? b.hargaBeliTerakhir : b.hppRata2;
    return {
      idBarang: b.idBarang,
      kode: b.kode,
      namaBarang: b.namaBarang,
      idKategori: b.idKategori,
      namaKategori: b.namaKategori,
      kodeSatuan: b.kodeSatuan,
      idPemasok: pm?.id ?? null,
      namaPemasok: pm?.namaPemasok ?? null,
      hariAmatan,
      terjual: bandingQty(b.terjual, 0) > 0 ? keQty(b.terjual) : keQty(0),
      rataPerHari: h.rataPerHari,
      stokTersedia: keQty(b.stokTersedia),
      stokMinimum: keQty(b.stokMinimum),
      stokMaksimum: b.stokMaksimum === null ? null : keQty(b.stokMaksimum),
      lamaKirimHari,
      jarakBelanjaHari,
      stokPengaman: h.stokPengaman,
      titikPesan: h.titikPesan,
      stokTarget: h.stokTarget,
      saranPesan: h.saranPesan,
      saranKemasan:
        h.saranKemasan !== null && b.kodeKemasan !== null && b.faktorKemasan !== null
          ? `${h.saranKemasan} ${b.kodeKemasan} (isi ${rapikanDesimal(b.faktorKemasan)})`
          : null,
      hariCukup: h.hariCukup,
      status: h.status,
      metode: h.metode,
      catatan: h.catatan,
      hargaBeliTerakhir: hargaBeli,
      perkiraanBiaya: subtotalRupiah(h.saranPesan, hargaBeli),
    };
  });
}

/** RO13: hasil hitung dari simpanan bila masih berlaku, atau dihitung lalu disimpan. */
async function barisTersimpan(
  prm: ParameterSaranPesan,
): Promise<{ baris: BarisPenuh[]; waktu: number; dariSimpanan: boolean }> {
  const mutasi = await repo.versiDataSaran(db);
  const kunci = JSON.stringify(prm);
  const kini = Date.now();
  const ada = simpanan.get(kunci);
  if (ada && ada.mutasi === mutasi && kini - ada.waktu < UMUR_SIMPANAN_MS) {
    return { baris: ada.baris, waktu: ada.waktu, dariSimpanan: true };
  }
  const baris = await hitungSemua(prm);
  // Simpanan yang sudah tidak berlaku dibuang agar memori tidak membengkak.
  for (const [k, v] of simpanan) {
    if (v.mutasi !== mutasi || kini - v.waktu >= UMUR_SIMPANAN_MS) simpanan.delete(k);
  }
  simpanan.set(kunci, { waktu: kini, mutasi, baris });
  return { baris, waktu: kini, dariSimpanan: false };
}

/** Saringan kategori dan cari (nama/kode memuat semua kata) diterapkan pada hasil hitung. */
function cocok(
  b: BarisPenuh,
  saring: { idKategori?: number | undefined; cari?: string | undefined },
): boolean {
  if (saring.idKategori !== undefined && b.idKategori !== saring.idKategori) return false;
  if (!saring.cari) return true;
  const teks = `${b.namaBarang} ${b.kode}`.toLowerCase();
  return saring.cari
    .toLowerCase()
    .split(/\s+/)
    .every((k) => teks.includes(k));
}

/** Nilai rupiah dibuang untuk yang tidak boleh melihat harga modal; id kategori internal dibuang. */
function tampilkan(b: BarisPenuh, nilai: boolean): BarisSaranPesan {
  const hasil: BarisSaranPesan & { idKategori?: number } = { ...b };
  delete hasil.idKategori;
  if (!nilai) {
    delete hasil.hargaBeliTerakhir;
    delete hasil.perkiraanBiaya;
  }
  return hasil;
}

export async function daftarSaranPesan(
  p: DataCariSaranPesan,
  izin: ReadonlySet<Izin>,
): Promise<HasilSaranPesan> {
  const parameter = await parameterSaran(undefined, {
    metode: p.metode ?? 'RATA',
    tingkatLayanan: p.layanan ?? 95,
  });
  const nilai = bolehNilai(izin);
  const hasil = await barisTersimpan(parameter);
  const semua = hasil.baris
    .filter((b) => (p.idPemasok === undefined || b.idPemasok === p.idPemasok) && cocok(b, p))
    .map((b) => tampilkan(b, nilai));
  const jumlah = Object.fromEntries(STATUS_SARAN_PESAN.map((s) => [s, 0])) as Record<
    StatusSaranPesan,
    number
  >;
  for (const b of semua) jumlah[b.status] += 1;

  const perlu = (b: BarisSaranPesan) => b.status === 'PESAN_SEKARANG' || b.status === 'SEGERA';
  const baris = semua
    .filter((b) =>
      p.tampil === 'SEMUA' ? true : p.tampil === 'PERLU' ? perlu(b) : b.status === p.tampil,
    )
    .sort(
      (a, b) =>
        URUTAN[a.status] - URUTAN[b.status] ||
        bandingQty(a.hariCukup ?? '999999', b.hariCukup ?? '999999') ||
        a.namaBarang.localeCompare(b.namaBarang, 'id'),
    );

  const grup = new Map<string, RingkasanPemasokSaran>();
  for (const b of semua.filter(perlu)) {
    const kunci = String(b.idPemasok ?? 0);
    const g = grup.get(kunci) ?? {
      idPemasok: b.idPemasok,
      namaPemasok: b.namaPemasok ?? 'Belum pernah dibeli',
      jumlahBarang: 0,
      ...(nilai ? { perkiraanBiaya: 0 } : {}),
    };
    g.jumlahBarang += 1;
    if (g.perkiraanBiaya !== undefined) g.perkiraanBiaya += b.perkiraanBiaya ?? 0;
    grup.set(kunci, g);
  }
  const perPemasok = [...grup.values()].sort((a, b) =>
    a.namaPemasok.localeCompare(b.namaPemasok, 'id'),
  );
  return {
    parameter,
    jumlah,
    baris,
    perPemasok,
    dihitungPada: new Date(hasil.waktu).toISOString(),
    dariSimpanan: hasil.dariSimpanan,
  };
}

/** Untuk notifikasi: jumlah barang berstatus Pesan sekarang (RO6). */
export async function jumlahPerluDipesan(): Promise<number> {
  const { baris } = await barisTersimpan(await parameterSaran());
  return baris.filter((b) => b.status === 'PESAN_SEKARANG').length;
}
