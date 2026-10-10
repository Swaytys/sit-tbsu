import {
  formatRupiah,
  hargaMarkup,
  keQty,
  keTeksPersen,
  marginPersen,
  teksQty,
  type BarisTinjauHarga,
  type DataSimpanHarga,
  type DataTerapkanTinjau,
  type HasilTinjauHarga,
  type InputAbaikanTinjau,
  type InputHargaOtomatis,
  type Kepemilikan,
  type MetaHalaman,
  type MetodeHarga,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { ambilAngka, ambilTeks } from '../../sistem/konfigurasi/service';
import { catatLog, catatLogBanyak, type EntriLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Harga jual per tier (docs/06 §1). Harga selalu disimpan (K-010); markup dihitung saat harga disimpan,
 * bukan saat dibaca. Baris TETAP tidak pernah dihitung ulang otomatis. Semua pemicu perubahan dasar
 * markup (H5), harga otomatis (H7), dan Tinjau Harga (H6) diputuskan di modul ini (K-086).
 */

export type KonteksHarga = { kelipatan: number; modeDasar: 'HARGA_BELI_TERAKHIR' | 'HPP_RATA2' };

export function konteksDari(kelipatan: number, mode: string): KonteksHarga {
  return {
    kelipatan: kelipatan >= 1 ? kelipatan : 1,
    modeDasar: mode === 'HPP_RATA2' ? 'HPP_RATA2' : 'HARGA_BELI_TERAKHIR',
  };
}

export async function muatKonteksHarga(ex: Executor): Promise<KonteksHarga> {
  return konteksDari(
    await ambilAngka('pembulatan_harga', 100, ex),
    await ambilTeks('dasar_markup', 'HARGA_BELI_TERAKHIR', ex),
  );
}

export type DataDasar = {
  kepemilikan: Kepemilikan;
  hargaModalAwal: number;
  hargaTitip: number | null;
  hppRata2: number;
  hargaBeliTerakhir: number;
  tanggalBeliTerakhir: string | null;
};

/**
 * H3: dasar markup `D`. KONSINYASI → harga titip. Sebelum ada penerimaan pembelian (tanggal beli terakhir
 * kosong) → harga modal awal. Sesudahnya → harga beli terakhir atau HPP rata-rata sesuai konfigurasi.
 */
export function dasarMarkup(b: DataDasar, modeDasar: KonteksHarga['modeDasar']): number {
  if (b.kepemilikan === 'KONSINYASI') return b.hargaTitip ?? 0;
  if (b.tanggalBeliTerakhir === null) return b.hargaModalAwal;
  return modeDasar === 'HPP_RATA2' ? b.hppRata2 : b.hargaBeliTerakhir;
}

/**
 * Isian harga satu tier: angka = TETAP; markup persen = MARKUP; keduanya kosong = IKUT_TIER. `minQty`
 * (K-097): syarat qty khusus barang; tidak dikirim = tidak diubah.
 */
export type InputHarga = {
  hargaTetap: number | null;
  markupPersen?: string | null | undefined;
  minQty?: string | null | undefined;
};

function keQtyAtauNull(v: string | null): string | null {
  return v === null ? null : keQty(v);
}

/** H4: nilai baris harga dari isian. */
export function nilaiHarga(
  isian: InputHarga,
  markupTier: string,
  dasar: number,
  kelipatan: number,
): repo.NilaiHarga {
  if (isian.hargaTetap !== null) {
    return {
      metode: 'TETAP',
      markupPersen: null,
      hargaTetap: isian.hargaTetap,
      hargaJual: isian.hargaTetap,
      dasarMarkupSaatHitung: null,
    };
  }
  if (isian.markupPersen !== null && isian.markupPersen !== undefined) {
    const persen = keTeksPersen(isian.markupPersen);
    return {
      metode: 'MARKUP',
      markupPersen: persen,
      hargaTetap: null,
      hargaJual: hargaMarkup(dasar, persen, kelipatan),
      dasarMarkupSaatHitung: dasar,
    };
  }
  return {
    metode: 'IKUT_TIER',
    markupPersen: null,
    hargaTetap: null,
    hargaJual: hargaMarkup(dasar, markupTier, kelipatan),
    dasarMarkupSaatHitung: dasar,
  };
}

const berformula = (m: MetodeHarga) => m !== 'TETAP';

/**
 * H4 + K-086: harga usulan satu baris dengan dasar `D`. IKUT_TIER dan harga tetap tier default memakai
 * markup tier; MARKUP memakai markup barang; harga tetap tier lain tidak diusulkan (`null`).
 */
export function hargaUsulan(
  b: { metode: MetodeHarga; markupPersen: string | null },
  t: { markupDefaultPersen: string; isDefault: boolean },
  dasar: number,
  kelipatan: number,
): number | null {
  if (b.metode === 'MARKUP' && b.markupPersen !== null) {
    return hargaMarkup(dasar, b.markupPersen, kelipatan);
  }
  if (b.metode === 'IKUT_TIER' || t.isDefault) {
    return hargaMarkup(dasar, t.markupDefaultPersen, kelipatan);
  }
  return null;
}

/** Persen markup efektif yang dipakai usulan (untuk tampilan). */
function persenEfektif(
  b: { metode: MetodeHarga; markupPersen: string | null },
  t: { markupDefaultPersen: string; isDefault: boolean },
): string | null {
  if (b.metode === 'MARKUP') return b.markupPersen;
  return b.metode === 'IKUT_TIER' || t.isDefault ? t.markupDefaultPersen : null;
}

const persenSama = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : keTeksPersen(a) === keTeksPersen(b);

type NilaiLog = { metode: MetodeHarga; hargaJual: number; markupPersen?: string; minQty?: string };
export type PerubahanHarga = {
  idTingkatHarga: number;
  tier: string;
  lama: NilaiLog | null;
  baru: NilaiLog;
};

function nilaiLog(n: {
  metode: MetodeHarga;
  hargaJual: number;
  markupPersen: string | null;
  minQty?: string | null | undefined;
}): NilaiLog {
  return {
    metode: n.metode,
    hargaJual: n.hargaJual,
    ...(n.metode === 'MARKUP' && n.markupPersen !== null ? { markupPersen: n.markupPersen } : {}),
    ...(n.minQty ? { minQty: n.minQty } : {}),
  };
}

function galatHarga(pesan: string): AppError {
  return new AppError('VALIDASI', pesan, 400, { kolom: { hargaTier: [pesan] } });
}

/**
 * Menerapkan harga tier untuk satu barang di dalam `tx` (form barang, halaman Harga Jual). Tier yang dikirim
 * diubah; tier aktif yang belum punya baris dilengkapi IKUT_TIER (K-047, H2); baris IKUT_TIER/MARKUP lain
 * dihitung ulang dengan `D` terkini (K-060 #4: menyimpan harga = menerima D terkini). Harga tetap tier
 * default tidak boleh Rp 0 (K-094). Pemanggil mengunci baris barang lebih dulu (urutan kunci K-086).
 */
export async function terapkanHargaBarang(
  tx: Tx,
  idBarang: number,
  input: ({ idTingkatHarga: number } & InputHarga)[],
  opsi: { dasar: number; konteks: KonteksHarga; idPengguna: number },
): Promise<PerubahanHarga[]> {
  const tier = await repo.semuaTier(tx);
  const perTier = new Map(tier.map((t) => [t.id, t]));
  const lama = new Map(
    (await repo.kunciHargaBarang(tx, idBarang)).map((h) => [h.idTingkatHarga, h]),
  );
  const masukan = new Map(input.map((h) => [h.idTingkatHarga, h]));

  for (const id of masukan.keys()) {
    const t = perTier.get(id);
    if (!t) throw galatHarga('Tier harga tidak ditemukan.');
    if (t.statusAktif !== 'AKTIF' && !lama.has(id)) throw galatHarga(`Tier ${t.nama} nonaktif.`);
  }

  const perubahan: PerubahanHarga[] = [];
  const baruDibuat: Parameters<typeof repo.tambahHarga>[1] = [];
  const waktu = sekarang();
  for (const t of tier) {
    const barisLama = lama.get(t.id);
    let isian: InputHarga | undefined = masukan.get(t.id);
    if (!isian) {
      if (t.statusAktif !== 'AKTIF') continue;
      if (!barisLama) isian = { hargaTetap: null };
      else if (berformula(barisLama.metode)) {
        isian = { hargaTetap: null, markupPersen: barisLama.markupPersen };
      } else continue;
    }
    // K-097: syarat qty khusus barang; tidak dikirim = tetap. Tier default berlaku untuk semua qty.
    const minQty =
      isian.minQty === undefined ? (barisLama?.minQty ?? null) : keQtyAtauNull(isian.minQty);
    if (t.isDefault && minQty !== null) {
      throw galatHarga(`Harga ${t.nama} berlaku untuk semua qty; kosongkan "mulai qty".`);
    }
    const nilai = {
      ...nilaiHarga(isian, t.markupDefaultPersen, opsi.dasar, opsi.konteks.kelipatan),
      minQty,
    };
    // K-094/K-095: harga Rp tetap tier default tidak boleh 0. Harga ikut markup boleh 0 selama harga modal
    // belum diketahui (barang belum bisa dijual); harganya terisi sendiri setelah penerimaan pertama.
    if (t.isDefault && nilai.metode === 'TETAP' && nilai.hargaJual <= 0) {
      throw galatHarga(`Harga ${t.nama} tidak boleh Rp 0.`);
    }
    if (barisLama) {
      const sama =
        barisLama.metode === nilai.metode &&
        barisLama.hargaTetap === nilai.hargaTetap &&
        barisLama.hargaJual === nilai.hargaJual &&
        persenSama(barisLama.markupPersen, nilai.markupPersen) &&
        barisLama.minQty === nilai.minQty;
      if (sama && barisLama.dasarMarkupSaatHitung === nilai.dasarMarkupSaatHitung) continue;
      await repo.ubahHarga(tx, barisLama.id, { ...nilai, idPengguna: opsi.idPengguna }, waktu);
      // Hanya dasar saat hitung yang diperbarui (harga hasil pembulatan sama): bukan perubahan harga.
      if (sama) continue;
    } else {
      baruDibuat.push({ ...nilai, idBarang, idTingkatHarga: t.id, idPengguna: opsi.idPengguna });
    }
    perubahan.push({
      idTingkatHarga: t.id,
      tier: t.nama,
      lama: barisLama ? nilaiLog(barisLama) : null,
      baru: nilaiLog(nilai),
    });
  }
  await repo.tambahHarga(tx, baruDibuat);
  return perubahan;
}

function labelNilai(n: NilaiLog): string {
  const harga = formatRupiah(n.hargaJual);
  const mulai = n.minQty ? `, mulai qty ${teksQty(n.minQty)}` : '';
  if (n.metode === 'IKUT_TIER') return `${harga} (ikut tier${mulai})`;
  if (n.metode === 'MARKUP') return `${harga} (markup ${teksQty(n.markupPersen ?? '0')}%${mulai})`;
  return mulai ? `${harga} (${mulai.slice(2)})` : harga;
}

/** Ringkasan perubahan harga untuk log, mis. "Normal Rp 55.000 → Rp 56.000". */
export function ringkasPerubahanHarga(perubahan: PerubahanHarga[]): string {
  return perubahan
    .map((p) =>
      p.lama
        ? `${p.tier} ${formatRupiah(p.lama.hargaJual)} → ${labelNilai(p.baru)}`
        : `${p.tier} ${labelNilai(p.baru)}`,
    )
    .join('; ');
}

function entriLogHarga(
  aksi: EntriLog['aksi'],
  idBarang: number,
  ringkasan: string,
  perubahan: PerubahanHarga[],
  p: { idPengguna: number; ip?: string | null | undefined; nomorDokumen?: string | undefined },
  tambahanBaru: Record<string, unknown> = {},
): EntriLog {
  return {
    aksi,
    idPengguna: p.idPengguna,
    entitas: 'barang',
    idEntitas: idBarang,
    ...(p.nomorDokumen ? { nomorDokumen: p.nomorDokumen } : {}),
    ringkasan,
    dataLama: Object.fromEntries(perubahan.map((x) => [x.tier, x.lama])),
    dataBaru: { ...Object.fromEntries(perubahan.map((x) => [x.tier, x.baru])), ...tambahanBaru },
    ip: p.ip ?? null,
  };
}

/**
 * H13: simpan harga dari halaman Harga Jual. Menyimpan manual menghitung ulang baris markup barang itu
 * dengan D terkini dan melepas tanda perlu tinjau (H5, K-060 #4).
 */
export async function simpanHargaMassal(
  input: DataSimpanHarga,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ jumlahBarang: number; jumlahPerubahan: number }> {
  const perBarang = new Map<number, ({ idTingkatHarga: number } & InputHarga)[]>();
  for (const p of input.perubahan) {
    const daftar = perBarang.get(p.idBarang) ?? [];
    daftar.push({
      idTingkatHarga: p.idTingkatHarga,
      hargaTetap: p.hargaTetap,
      markupPersen: p.markupPersen,
      minQty: p.minQty,
    });
    perBarang.set(p.idBarang, daftar);
  }
  const idBarang = [...perBarang.keys()].sort((a, b) => a - b);

  return dalamTransaksi(async (tx) => {
    const terkunci = new Map((await repo.kunciBarangHarga(tx, idBarang)).map((b) => [b.id, b]));
    const konteks = await muatKonteksHarga(tx);
    const dasar = new Map((await repo.dataDasar(tx, idBarang)).map((d) => [d.id, d]));
    let jumlahPerubahan = 0;
    for (const id of idBarang) {
      const b = dasar.get(id);
      if (!b || !terkunci.has(id)) {
        throw new AppError('TIDAK_DITEMUKAN', `Barang #${id} tidak ditemukan.`, 404);
      }
      const perubahan = await terapkanHargaBarang(tx, id, perBarang.get(id) ?? [], {
        dasar: dasarMarkup(b, konteks.modeDasar),
        konteks,
        idPengguna: pelaku.id,
      });
      if (perubahan.length === 0) continue;
      jumlahPerubahan += perubahan.length;
      await catatLog(
        tx,
        entriLogHarga(
          'HARGA_UBAH',
          id,
          `Harga ${b.namaBarang}: ${ringkasPerubahanHarga(perubahan)}`,
          perubahan,
          { idPengguna: pelaku.id, ip: asal.ip },
        ),
      );
    }
    await repo.aturTandaTinjau(tx, idBarang, false);
    return { jumlahBarang: idBarang.length, jumlahPerubahan };
  });
}

/**
 * H7 (K-094): nyalakan/matikan harga otomatis barang terpilih. Menyalakan langsung mengevaluasi harga
 * barang itu (naik diterapkan, turun ditinjau), sama seperti dari form barang. Log `BARANG_UBAH` per barang.
 */
export async function aturHargaOtomatis(
  input: InputHargaOtomatis,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ jumlahBarang: number }> {
  const ids = [...new Set(input.idBarang)].sort((a, b) => a - b);
  return dalamTransaksi(async (tx) => {
    const berubah = (await repo.kunciBarangHarga(tx, ids)).filter(
      (b) => b.hargaOtomatis !== input.hargaOtomatis,
    );
    const idBerubah = berubah.map((b) => b.id);
    await repo.aturHargaOtomatis(tx, idBerubah, input.hargaOtomatis, sekarang());
    if (input.hargaOtomatis) {
      await tanggapiPemicuHarga(tx, idBerubah, {
        sebab: 'harga otomatis dinyalakan',
        idPengguna: pelaku.id,
        ip: asal.ip,
      });
    }
    await catatLogBanyak(
      tx,
      berubah.map((b) => ({
        aksi: 'BARANG_UBAH',
        idPengguna: pelaku.id,
        entitas: 'barang',
        idEntitas: b.id,
        ringkasan: `Harga otomatis ${b.namaBarang} ${input.hargaOtomatis ? 'dinyalakan' : 'dimatikan'}`,
        dataLama: { hargaOtomatis: !input.hargaOtomatis },
        dataBaru: { hargaOtomatis: input.hargaOtomatis },
        ip: asal.ip,
      })),
    );
    return { jumlahBarang: berubah.length };
  });
}

/**
 * H2: tier baru (atau diaktifkan kembali) mendapat baris IKUT_TIER untuk semua barang yang belum
 * punya baris di tier itu. Mengembalikan jumlah barang.
 */
export async function lengkapiHargaTier(
  tx: Tx,
  idTingkatHarga: number,
  markupPersen: string,
  idPengguna: number,
): Promise<number> {
  const konteks = await muatKonteksHarga(tx);
  const semua = await repo.semuaDataDasar(tx);
  await repo.tambahHarga(
    tx,
    semua.map((b) => ({
      ...nilaiHarga(
        { hargaTetap: null },
        markupPersen,
        dasarMarkup(b, konteks.modeDasar),
        konteks.kelipatan,
      ),
      idBarang: b.id,
      idTingkatHarga,
      idPengguna,
    })),
  );
  return semua.length;
}

/**
 * Tier diaktifkan kembali (K-086): baris IKUT_TIER/MARKUP lama di tier itu dihitung ulang dengan D terkini,
 * seperti tier baru (H2), karena harganya tidak dipakai selama tier nonaktif. Mengembalikan jumlah baris.
 */
export async function hitungUlangTier(
  tx: Tx,
  idTingkatHarga: number,
  idPengguna: number,
): Promise<number> {
  const idBarang = await repo.barangBerformula(tx, idTingkatHarga);
  if (idBarang.length === 0) return 0;
  await repo.kunciBarangHarga(tx, idBarang);
  const t = (await repo.semuaTier(tx)).find((x) => x.id === idTingkatHarga);
  if (!t) return 0;
  const konteks = await muatKonteksHarga(tx);
  const dasar = new Map((await repo.dataDasar(tx, idBarang)).map((d) => [d.id, d]));
  const hitung: repo.HitungUlangHarga[] = [];
  for (const h of await repo.hargaBarangDasar(tx, idBarang)) {
    const d = dasar.get(h.idBarang);
    if (h.idTingkatHarga !== idTingkatHarga || !berformula(h.metode) || !d) continue;
    const D = dasarMarkup(d, konteks.modeDasar);
    const u = hargaUsulan(h, t, D, konteks.kelipatan) ?? h.hargaJual;
    if (u !== h.hargaJual || h.dasarMarkupSaatHitung !== D) {
      hitung.push({ id: h.id, hargaJual: u, hargaTetap: null, dasarMarkupSaatHitung: D });
    }
  }
  await repo.hitungUlangHargaBanyak(tx, hitung, idPengguna, sekarang());
  return hitung.length;
}

// --- Pemicu H5 dan harga otomatis H7 (K-086) ---

export type PemicuHarga = {
  /** Uraian untuk log, mis. "penerimaan RCV-261004-001". */
  sebab: string;
  idPengguna: number;
  ip?: string | null | undefined;
  nomorDokumen?: string | undefined;
  /** Hanya baris tier ini yang terpengaruh (markup tier berubah). Kosong = dasar markup berubah. */
  idTier?: number | undefined;
  /** Barang tidak otomatis ditandai hanya bila ada harga hasil hitung yang berbeda (bukan selalu). */
  tandaiBilaBerubah?: boolean | undefined;
  /** Konteks baru bila konfigurasi diubah di transaksi ini (cache konfigurasi belum diperbarui). */
  konteks?: KonteksHarga | undefined;
};

export type HasilPemicu = { ditandai: number; diterapkan: number };

function kelompokkan(harga: repo.BarisHarga[]): Map<number, repo.BarisHarga[]> {
  const peta = new Map<number, repo.BarisHarga[]>();
  for (const h of harga) {
    const daftar = peta.get(h.idBarang) ?? [];
    daftar.push(h);
    peta.set(h.idBarang, daftar);
  }
  return peta;
}

/**
 * H5/H7 (K-086), di transaksi yang sama dengan pemicunya, untuk barang yang usulan harganya mungkin berubah:
 * - barang tidak otomatis → ditandai perlu tinjau (harga tidak berubah);
 * - barang otomatis → baris IKUT_TIER/MARKUP yang hasil hitungnya NAIK langsung diterapkan (log HARGA_UBAH);
 *   yang TURUN tidak diterapkan. Barang ditandai bila ada yang turun atau (pemicu dasar) harga tetap tier
 *   default di bawah usulannya; selain itu tanda dilepas. Harga tetap tidak pernah diubah otomatis.
 */
export async function tanggapiPemicuHarga(
  tx: Tx,
  idBarang: number[],
  p: PemicuHarga,
): Promise<HasilPemicu> {
  const ids = [...new Set(idBarang)].sort((a, b) => a - b);
  if (ids.length === 0) return { ditandai: 0, diterapkan: 0 };
  const barangTerkunci = await repo.kunciBarangHarga(tx, ids);
  const konteks = p.konteks ?? (await muatKonteksHarga(tx));
  const perTier = new Map((await repo.semuaTier(tx)).map((t) => [t.id, t]));
  const dasar = new Map((await repo.dataDasar(tx, ids)).map((d) => [d.id, d]));
  const harga = kelompokkan(await repo.hargaBarangDasar(tx, ids));
  const lengkap = p.idTier === undefined;

  const ditandai: number[] = [];
  const dilepas: number[] = [];
  const hitung: repo.HitungUlangHarga[] = [];
  const log: EntriLog[] = [];
  for (const b of barangTerkunci) {
    const d = dasar.get(b.id);
    if (!d) continue;
    const D = dasarMarkup(d, konteks.modeDasar);
    let berubah = false;
    let turun = false;
    let defaultDiBawah = false;
    const perubahan: PerubahanHarga[] = [];
    for (const h of harga.get(b.id) ?? []) {
      const t = perTier.get(h.idTingkatHarga);
      if (!t || t.statusAktif !== 'AKTIF' || (!lengkap && t.id !== p.idTier)) continue;
      const u = hargaUsulan(h, t, D, konteks.kelipatan);
      if (u === null) continue;
      if (!berformula(h.metode)) {
        // Harga tetap (Rp) tier default: hanya diusulkan, tidak pernah otomatis (K-086).
        if (lengkap && h.hargaJual < u) defaultDiBawah = true;
        continue;
      }
      if (u !== h.hargaJual) berubah = true;
      if (!b.hargaOtomatis) continue;
      if (u < h.hargaJual) {
        turun = true;
        continue;
      }
      if (u > h.hargaJual || h.dasarMarkupSaatHitung !== D) {
        hitung.push({ id: h.id, hargaJual: u, hargaTetap: null, dasarMarkupSaatHitung: D });
      }
      if (u > h.hargaJual) {
        perubahan.push({
          idTingkatHarga: t.id,
          tier: t.nama,
          lama: nilaiLog(h),
          baru: { ...nilaiLog(h), hargaJual: u },
        });
      }
    }

    if (!b.hargaOtomatis) {
      if (!p.tandaiBilaBerubah || berubah) ditandai.push(b.id);
      continue;
    }
    if (turun || defaultDiBawah) ditandai.push(b.id);
    // Evaluasi satu tier saja tidak boleh melepas tanda dari tier lain yang masih menunggu tinjau.
    else if (lengkap) dilepas.push(b.id);
    if (perubahan.length > 0) {
      log.push(
        entriLogHarga(
          'HARGA_UBAH',
          b.id,
          `Harga otomatis ${b.namaBarang} (${p.sebab}): ${ringkasPerubahanHarga(perubahan)}`,
          perubahan,
          p,
          { dasarMarkup: D },
        ),
      );
    }
  }

  await repo.hitungUlangHargaBanyak(tx, hitung, p.idPengguna, sekarang());
  await repo.aturTandaTinjau(tx, ditandai, true);
  await repo.aturTandaTinjau(tx, dilepas, false);
  await catatLogBanyak(tx, log);
  return { ditandai: ditandai.length, diterapkan: log.length };
}

/** `D` per barang saat ini (untuk membandingkan sebelum dan sesudah pemicu). */
export async function petaDasar(
  ex: Executor,
  idBarang: number[],
  konteks?: KonteksHarga,
): Promise<Map<number, number>> {
  const k = konteks ?? (await muatKonteksHarga(ex));
  return new Map(
    (await repo.dataDasar(ex, idBarang)).map((d) => [d.id, dasarMarkup(d, k.modeDasar)]),
  );
}

/** H5: setelah pemicu yang mungkin mengubah `D`, tanggapi barang yang `D`-nya benar-benar berubah. */
export async function tanggapiPerubahanDasar(
  tx: Tx,
  sebelum: Map<number, number>,
  p: PemicuHarga,
): Promise<HasilPemicu> {
  const sesudah = await petaDasar(tx, [...sebelum.keys()], p.konteks);
  const berubah = [...sebelum].filter(([id, d]) => sesudah.get(id) !== d).map(([id]) => id);
  return tanggapiPemicuHarga(tx, berubah, p);
}

// --- Tinjau Harga (H6) ---

export async function daftarTinjauHarga(
  p: repo.SaringTinjau & { halaman: number; perHalaman: number },
): Promise<{ data: BarisTinjauHarga[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPerluTinjau(db, { ...p, ...batasHalaman(p) });
  const konteks = await muatKonteksHarga(db);
  const tier = (await repo.semuaTier(db)).filter((t) => t.statusAktif === 'AKTIF');
  const harga = kelompokkan(
    await repo.hargaBarangDasar(
      db,
      baris.map((b) => b.id),
    ),
  );
  return {
    data: baris.map((b) => {
      const D = dasarMarkup(b, konteks.modeDasar);
      const perTier = new Map((harga.get(b.id) ?? []).map((h) => [h.idTingkatHarga, h]));
      return {
        id: b.id,
        kode: b.kode,
        namaBarang: b.namaBarang,
        namaKategori: b.namaKategori,
        kodeSatuan: b.kodeSatuan,
        kepemilikan: b.kepemilikan,
        hargaOtomatis: b.hargaOtomatis,
        dasarBaru: D,
        tier: tier.flatMap((t) => {
          const h = perTier.get(t.id);
          if (!h) return [];
          const u = hargaUsulan(h, t, D, konteks.kelipatan);
          return [
            {
              idTingkatHarga: t.id,
              namaTier: t.nama,
              isDefault: t.isDefault,
              metode: h.metode,
              markupPersen: persenEfektif(h, t),
              hargaSekarang: h.hargaJual,
              dasarLama: h.dasarMarkupSaatHitung,
              hargaUsulan: u,
              marginSekarang: marginPersen(h.hargaJual, D),
              marginUsulan: u === null ? null : marginPersen(u, D),
            },
          ];
        }),
      };
    }),
    meta: metaHalaman(total, p),
  };
}

/**
 * H6: terapkan usulan untuk barang terpilih (semua tier sekaligus; tier default bila diminta). `D` dihitung
 * ulang di dalam transaksi; bila berbeda dari yang terlihat di layar, seluruh penerapan ditolak (409).
 */
export async function terapkanTinjauHarga(
  input: DataTerapkanTinjau,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilTinjauHarga> {
  const dilihat = new Map(input.barang.map((b) => [b.idBarang, b.dasar]));
  const ids = [...dilihat.keys()].sort((a, b) => a - b);
  const termasukDefault = input.termasukTierDefault;

  return dalamTransaksi(async (tx) => {
    const barangTerkunci = await repo.kunciBarangHarga(tx, ids);
    const konteks = await muatKonteksHarga(tx);
    const perTier = new Map((await repo.semuaTier(tx)).map((t) => [t.id, t]));
    const dasar = new Map((await repo.dataDasar(tx, ids)).map((d) => [d.id, d]));
    const harga = kelompokkan(await repo.hargaBarangDasar(tx, ids));

    const berubahDasar: string[] = [];
    const hitung: repo.HitungUlangHarga[] = [];
    const dilepas: number[] = [];
    const log: EntriLog[] = [];
    let jumlahPerubahan = 0;
    for (const b of barangTerkunci) {
      const d = dasar.get(b.id);
      // Sudah ditinjau pengguna lain (tanda lepas) atau barang hilang: dilewati.
      if (!d || !b.perluTinjauHarga) continue;
      const D = dasarMarkup(d, konteks.modeDasar);
      if (D !== dilihat.get(b.id)) {
        berubahDasar.push(b.namaBarang);
        continue;
      }
      const perubahan: PerubahanHarga[] = [];
      for (const h of harga.get(b.id) ?? []) {
        const t = perTier.get(h.idTingkatHarga);
        if (!t || t.statusAktif !== 'AKTIF') continue;
        const u = hargaUsulan(h, t, D, konteks.kelipatan);
        if (u === null) continue;
        if (!berformula(h.metode)) {
          if (!termasukDefault || u === h.hargaJual) continue;
          hitung.push({ id: h.id, hargaJual: u, hargaTetap: u, dasarMarkupSaatHitung: null });
        } else {
          if (u === h.hargaJual && h.dasarMarkupSaatHitung === D) continue;
          hitung.push({ id: h.id, hargaJual: u, hargaTetap: null, dasarMarkupSaatHitung: D });
          if (u === h.hargaJual) continue;
        }
        perubahan.push({
          idTingkatHarga: t.id,
          tier: t.nama,
          lama: nilaiLog(h),
          baru: { ...nilaiLog(h), hargaJual: u },
        });
      }
      dilepas.push(b.id);
      jumlahPerubahan += perubahan.length;
      log.push(
        entriLogHarga(
          'HARGA_TINJAU_TERAPKAN',
          b.id,
          `Tinjau harga ${b.namaBarang}: ` +
            (perubahan.length > 0 ? ringkasPerubahanHarga(perubahan) : 'tidak ada harga berubah'),
          perubahan,
          { idPengguna: pelaku.id, ip: asal.ip },
          { dasarMarkup: D },
        ),
      );
    }
    if (berubahDasar.length > 0) {
      throw new AppError(
        'KONFLIK',
        `Dasar harga ${berubahDasar.length} barang berubah sejak halaman dimuat ` +
          `(${berubahDasar.slice(0, 3).join(', ')}${berubahDasar.length > 3 ? ', …' : ''}). ` +
          'Muat ulang lalu terapkan lagi.',
        409,
      );
    }
    await repo.hitungUlangHargaBanyak(tx, hitung, pelaku.id, sekarang());
    await repo.aturTandaTinjau(tx, dilepas, false);
    await catatLogBanyak(tx, log);
    return { jumlahBarang: dilepas.length, jumlahPerubahan };
  });
}

/** H6: abaikan = lepas tanda tanpa mengubah harga (log per barang). */
export async function abaikanTinjauHarga(
  input: InputAbaikanTinjau,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilTinjauHarga> {
  const ids = [...new Set(input.idBarang)].sort((a, b) => a - b);
  return dalamTransaksi(async (tx) => {
    const dilepas = (await repo.kunciBarangHarga(tx, ids)).filter((b) => b.perluTinjauHarga);
    await repo.aturTandaTinjau(
      tx,
      dilepas.map((b) => b.id),
      false,
    );
    await catatLogBanyak(
      tx,
      dilepas.map((b) => ({
        aksi: 'HARGA_TINJAU_ABAIKAN',
        idPengguna: pelaku.id,
        entitas: 'barang',
        idEntitas: b.id,
        ringkasan: `Mengabaikan tinjau harga ${b.namaBarang} (harga tidak diubah)`,
        ip: asal.ip,
      })),
    );
    return { jumlahBarang: dilepas.length, jumlahPerubahan: 0 };
  });
}
