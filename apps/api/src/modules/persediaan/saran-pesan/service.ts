import {
  bandingQty,
  jumlahHari,
  keQty,
  rapikanDesimal,
  STATUS_SARAN_PESAN,
  subtotalRupiah,
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
import { hitungSaran } from './hitung';
import * as repo from './repo';

/*
 * Rekomendasi pemesanan ulang (K-113, docs/05 §17 RO1–RO8). Posisi saat ini: dihitung setiap kali diminta dari
 * ledger dan cache persediaan, tidak disimpan (tidak ada angka hasil hitung tanpa sumber kebenaran).
 */

export type DataCariSaranPesan = z.output<typeof skemaCariSaranPesan>;

const URUTAN: Record<StatusSaranPesan, number> = {
  PESAN_SEKARANG: 0,
  SEGERA: 1,
  AMAN: 2,
  TIDAK_LAKU: 3,
};

/** RO1–RO4: parameter dari pengaturan; periode = N hari penuh terakhir sampai kemarin. */
export async function parameterSaran(hariIni = tanggalOperasional()): Promise<ParameterSaranPesan> {
  const periodeHari = await ambilAngka('saran_pesan_periode_hari', 30);
  return {
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

async function semuaBaris(
  prm: ParameterSaranPesan,
  saring: { idKategori?: number | undefined; cari?: string | undefined },
  izin: ReadonlySet<Izin>,
): Promise<BarisSaranPesan[]> {
  const barang = await repo.barangUntukSaran(db, { dari: prm.dari, sampai: prm.sampai, ...saring });
  const idPemasok = [
    ...new Set(barang.flatMap((b) => (b.idPemasok === null ? [] : [b.idPemasok]))),
  ];
  const pemasok = new Map((await repo.pemasokSaran(db, idPemasok)).map((p) => [p.id, p]));
  const nilai = bolehNilai(izin);
  return barang.map((b) => {
    const pm = b.idPemasok === null ? undefined : pemasok.get(b.idPemasok);
    const lamaKirimHari = pm?.lamaKirimHari ?? prm.lamaKirimBawaan;
    const jarakBelanjaHari = pm?.jarakBelanjaHari ?? prm.jarakBelanjaBawaan;
    // RO1: barang yang riwayatnya lebih pendek dari periode diamati sejak mutasi pertamanya.
    const hariRiwayat = b.mutasiPertama ? jumlahHari(b.mutasiPertama, prm.sampai) : 0;
    const hariAmatan = Math.max(0, Math.min(prm.periodeHari, hariRiwayat));
    const h = hitungSaran({
      terjual: b.terjual,
      hariAmatan,
      stokTersedia: b.stokTersedia,
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
      namaKategori: b.namaKategori,
      kodeSatuan: b.kodeSatuan,
      idPemasok: pm?.id ?? null,
      namaPemasok: pm?.namaPemasok ?? null,
      hariAmatan,
      terjual: bandingQty(b.terjual, 0) > 0 ? keQty(b.terjual) : keQty(0),
      rataPerHari: h.rataPerHari,
      stokTersedia: keQty(b.stokTersedia),
      stokMinimum: keQty(b.stokMinimum),
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
      ...(nilai
        ? { hargaBeliTerakhir: hargaBeli, perkiraanBiaya: subtotalRupiah(h.saranPesan, hargaBeli) }
        : {}),
    };
  });
}

export async function daftarSaranPesan(
  p: DataCariSaranPesan,
  izin: ReadonlySet<Izin>,
): Promise<HasilSaranPesan> {
  const parameter = await parameterSaran();
  const semua = (await semuaBaris(parameter, p, izin)).filter(
    (b) => p.idPemasok === undefined || b.idPemasok === p.idPemasok,
  );
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

  const nilai = bolehNilai(izin);
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
  return { parameter, jumlah, baris, perPemasok };
}

/** Untuk notifikasi: jumlah barang berstatus Pesan sekarang (RO6). */
export async function jumlahPerluDipesan(): Promise<number> {
  const parameter = await parameterSaran();
  const semua = await semuaBaris(parameter, {}, new Set());
  return semua.filter((b) => b.status === 'PESAN_SEKARANG').length;
}
