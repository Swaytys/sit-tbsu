import {
  bandingQty,
  jumlahHari,
  keQty,
  rapikanDesimal,
  STATUS_SARAN_PESAN,
  subtotalRupiah,
  bagiQty,
  kaliQty,
  nomorHari,
  type CelahStok,
  tambahQty,
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
import * as repoPO from '../order-pembelian/repo';
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
/** K-127 butir 3: lama kirim aktual dipakai setelah minimal 3 order pembelian pemasok itu menerima barang. */
export const MIN_PO_LAMA_KIRIM = 3;
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
  // K-242: kedatangan order berjalan dan pemasok yang pernah memasok tiap barang.
  const [datangOrder, pernah] = await Promise.all([
    repo.kedatanganOrder(db),
    repo.pemasokPernah(db),
  ]);
  const idPemasok = [
    ...new Set([
      ...barang.flatMap((b) => (b.idPemasok === null ? [] : [b.idPemasok])),
      ...[...pernah.values()].flat(),
    ]),
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
  // K-125: barang yang sudah dipesan tetapi belum datang, dan lama kirim aktual dari order pembelian.
  const [dipesan, aktual] = await Promise.all([
    repoPO.sudahDipesan(db),
    repoPO.lamaKirimAktual(db),
  ]);
  return barang.map((b) => {
    const pm = b.idPemasok === null ? undefined : pemasok.get(b.idPemasok);
    const lk = b.idPemasok === null ? undefined : aktual.get(b.idPemasok);
    const pakaiAktual = lk !== undefined && lk.jumlahPO >= MIN_PO_LAMA_KIRIM;
    const lamaKirimHari = pakaiAktual ? lk.hari : (pm?.lamaKirimHari ?? prm.lamaKirimBawaan);
    const sudahDipesan = dipesan.get(b.idBarang) ?? '0';
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
      // Posisi stok = tersedia + sudah dipesan (belum datang), supaya tidak dipesan dua kali.
      stokTersedia: tambahQty(b.stokTersedia, sudahDipesan),
      stokMinimum: b.stokMinimum,
      stokMaksimum: b.stokMaksimum,
      lamaKirimHari,
      jarakBelanjaHari,
      hariPengaman: prm.hariPengaman,
      faktorKemasan: b.faktorKemasan,
    });
    const hargaBeli = b.hargaBeliTerakhir > 0 ? b.hargaBeliTerakhir : b.hppRata2;
    const lamaKirimPemasok = (id: number) => {
      const a = aktual.get(id);
      return a !== undefined && a.jumlahPO >= MIN_PO_LAMA_KIRIM
        ? a.hari
        : (pemasok.get(id)?.lamaKirimHari ?? prm.lamaKirimBawaan);
    };
    const celah = hitungCelah({
      hariIni: tambahHari(prm.sampai, 1),
      rata: h.rataPerHari,
      stokTersedia: b.stokTersedia,
      lamaKirimHari,
      order: datangOrder.filter((o) => o.idBarang === b.idBarang),
      lamaKirimPemasok,
      pemasokLain: (pernah.get(b.idBarang) ?? []).map((id) => ({
        id,
        nama: pemasok.get(id)?.namaPemasok ?? `Pemasok #${id}`,
      })),
      hargaJual: b.hargaJual,
      hpp: b.hppRata2 > 0 ? b.hppRata2 : hargaBeli,
    });
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
      // Cukup berapa hari dihitung dari stok yang benar-benar ada (tanpa yang masih dipesan).
      hariCukup:
        bandingQty(h.rataPerHari, 0) > 0
          ? bagiQty(bandingQty(b.stokTersedia, 0) > 0 ? b.stokTersedia : 0, h.rataPerHari)
          : null,
      sudahDipesan: keQty(sudahDipesan),
      lamaKirimAktual: pakaiAktual,
      status: h.status,
      metode: h.metode,
      catatan: h.catatan,
      hargaBeliTerakhir: hargaBeli,
      perkiraanBiaya: subtotalRupiah(h.saranPesan, hargaBeli),
      celah,
    };
  });
}

/**
 * K-242: apakah stok habis sebelum barang berikutnya datang. Tanggal datang = order berjalan tercepat (janji pemasok,
 * lalu tanggal kirim diminta, lalu tanggal pesan + lama kirim); tanpa order = bila dipesan hari ini. Kekosongan =
 * hari antara habis dan datang; perkiraan penjualan hilang = rata per hari × hari kosong.
 */
export function hitungCelah(k: {
  hariIni: string;
  rata: string;
  stokTersedia: string;
  lamaKirimHari: number;
  order: Awaited<ReturnType<typeof repo.kedatanganOrder>>;
  lamaKirimPemasok: (idPemasok: number) => number;
  pemasokLain: { id: number; nama: string }[];
  hargaJual: number;
  hpp: number;
}): CelahStok | null {
  if (bandingQty(k.rata, 0) <= 0) return null;
  const stok = bandingQty(k.stokTersedia, 0) > 0 ? k.stokTersedia : '0';
  // Hari penuh yang masih tercukupi; habis di hari berikutnya.
  const hariCukup = Math.floor(Number(bagiQty(stok, k.rata)));
  const habisPada = tambahHari(k.hariIni, hariCukup);
  const kandidat = k.order.map((o) => {
    const [tanggal, sumber] = o.janji
      ? [o.janji, 'JANJI' as const]
      : o.diminta
        ? [o.diminta, 'DIMINTA' as const]
        : [
            tambahHari(o.dipesan ?? k.hariIni, k.lamaKirimPemasok(o.idPemasok)),
            'PERKIRAAN' as const,
          ];
    return { ...o, tanggal: tanggal < k.hariIni ? k.hariIni : tanggal, sumber };
  });
  kandidat.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const o = kandidat[0];
  const datangPada = o ? o.tanggal : tambahHari(k.hariIni, k.lamaKirimHari);
  if (habisPada >= datangPada) return null;
  const hariKosong = nomorHari(datangPada) - nomorHari(habisPada);
  const qtyHilang = kaliQty(k.rata, hariKosong);
  const omzetHilang = subtotalRupiah(qtyHilang, k.hargaJual);
  return {
    habisPada,
    datangPada,
    sumberDatang: o ? o.sumber : 'PESAN_HARI_INI',
    nomorOrder: o?.nomor ?? null,
    namaPemasokOrder: o?.namaPemasok ?? null,
    noHpPemasokOrder: o?.noHp ?? null,
    hariKosong,
    qtyHilang: keQty(qtyHilang),
    omzetHilang,
    labaHilang: Math.max(0, omzetHilang - subtotalRupiah(qtyHilang, k.hpp)),
    pemasokCepat: k.pemasokLain
      .map((p) => ({
        idPemasok: p.id,
        namaPemasok: p.nama,
        lamaKirimHari: k.lamaKirimPemasok(p.id),
        datangPada: tambahHari(k.hariIni, k.lamaKirimPemasok(p.id)),
      }))
      .filter((p) => p.datangPada < datangPada)
      .sort((a, b) => a.lamaKirimHari - b.lamaKirimHari)
      .slice(0, 3),
  };
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
    if (hasil.celah) {
      hasil.celah = { ...hasil.celah };
      delete hasil.celah.labaHilang;
    }
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
  const adaCelah = semua.filter((b) => b.celah !== null);
  return {
    parameter,
    jumlah,
    baris,
    perPemasok,
    celah: {
      jumlahBarang: adaCelah.length,
      omzetHilang: adaCelah.reduce((t, b) => t + (b.celah?.omzetHilang ?? 0), 0),
      ...(nilai
        ? { labaHilang: adaCelah.reduce((t, b) => t + (b.celah?.labaHilang ?? 0), 0) }
        : {}),
    },
    dihitungPada: new Date(hasil.waktu).toISOString(),
    dariSimpanan: hasil.dariSimpanan,
  };
}

/** Untuk notifikasi: jumlah barang berstatus Pesan sekarang (RO6). */
export async function jumlahPerluDipesan(): Promise<number> {
  const { baris } = await barisTersimpan(await parameterSaran());
  return baris.filter((b) => b.status === 'PESAN_SEKARANG').length;
}
