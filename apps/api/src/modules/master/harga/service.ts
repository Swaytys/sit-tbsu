import {
  formatRupiah,
  hargaMarkup,
  type InputSimpanHarga,
  type Kepemilikan,
  type MetodeHarga,
} from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { ambilAngka, ambilTeks } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Harga jual per tier (docs/06 §1). Harga selalu disimpan (K-010); markup dihitung saat harga disimpan,
 * bukan saat dibaca. Baris TETAP tidak pernah dihitung ulang otomatis.
 */

export type KonteksHarga = { kelipatan: number; modeDasar: 'HARGA_BELI_TERAKHIR' | 'HPP_RATA2' };

export async function muatKonteksHarga(ex: Executor): Promise<KonteksHarga> {
  const kelipatan = await ambilAngka('pembulatan_harga', 100, ex);
  const mode = await ambilTeks('dasar_markup', 'HARGA_BELI_TERAKHIR', ex);
  return {
    kelipatan: kelipatan >= 1 ? kelipatan : 1,
    modeDasar: mode === 'HPP_RATA2' ? 'HPP_RATA2' : 'HARGA_BELI_TERAKHIR',
  };
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

/** H4: nilai baris harga dari input (angka = TETAP, `null` = IKUT_TIER). */
export function nilaiHarga(
  hargaTetap: number | null,
  markupTier: string,
  dasar: number,
  kelipatan: number,
): repo.NilaiHarga {
  if (hargaTetap !== null) {
    return {
      metode: 'TETAP',
      markupPersen: null,
      hargaTetap,
      hargaJual: hargaTetap,
      dasarMarkupSaatHitung: null,
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

type Tier = Awaited<ReturnType<typeof repo.semuaTier>>[number];
export type PerubahanHarga = {
  idTingkatHarga: number;
  tier: string;
  lama: { metode: MetodeHarga; hargaJual: number } | null;
  baru: { metode: MetodeHarga; hargaJual: number };
};

function galatHarga(pesan: string): AppError {
  return new AppError('VALIDASI', pesan, 400, { kolom: { hargaTier: [pesan] } });
}

/**
 * Menerapkan harga tier untuk satu barang di dalam `tx`. Tier yang dikirim diubah; tier aktif yang belum
 * punya baris dilengkapi IKUT_TIER, sehingga barang baru mendapat baris untuk setiap tier aktif (K-047, H2).
 * Tier default tidak boleh IKUT_TIER (harus diisi harga tetap).
 */
export async function terapkanHargaBarang(
  tx: Tx,
  idBarang: number,
  input: { idTingkatHarga: number; hargaTetap: number | null }[],
  opsi: { dasar: number; konteks: KonteksHarga; idPengguna: number },
): Promise<PerubahanHarga[]> {
  const tier = await repo.semuaTier(tx);
  const perTier = new Map<number, Tier>(tier.map((t) => [t.id, t]));
  const lama = new Map(
    (await repo.kunciHargaBarang(tx, idBarang)).map((h) => [h.idTingkatHarga, h]),
  );
  const masukan = new Map(input.map((h) => [h.idTingkatHarga, h.hargaTetap]));

  for (const id of masukan.keys()) {
    const t = perTier.get(id);
    if (!t) throw galatHarga('Tier harga tidak ditemukan.');
    if (t.statusAktif !== 'AKTIF' && !lama.has(id)) throw galatHarga(`Tier ${t.nama} nonaktif.`);
  }

  const perubahan: PerubahanHarga[] = [];
  const baruDibuat: Parameters<typeof repo.tambahHarga>[1] = [];
  const waktu = sekarang();
  for (const t of tier) {
    const dikirim = masukan.has(t.id);
    const barisLama = lama.get(t.id);
    // Tier yang tidak dikirim dan sudah punya baris dibiarkan; tier nonaktif tanpa baris dilewati.
    if (!dikirim && (barisLama || t.statusAktif !== 'AKTIF')) continue;

    const hargaTetap = masukan.get(t.id) ?? null;
    if (t.isDefault && hargaTetap === null) {
      throw galatHarga(`Harga tier ${t.nama} (tier default) wajib diisi.`);
    }
    const nilai = nilaiHarga(hargaTetap, t.markupDefaultPersen, opsi.dasar, opsi.konteks.kelipatan);
    if (barisLama) {
      const sama =
        barisLama.metode === nilai.metode &&
        barisLama.hargaTetap === nilai.hargaTetap &&
        barisLama.hargaJual === nilai.hargaJual;
      if (sama) continue;
      await repo.ubahHarga(tx, barisLama.id, { ...nilai, idPengguna: opsi.idPengguna }, waktu);
    } else {
      baruDibuat.push({ ...nilai, idBarang, idTingkatHarga: t.id, idPengguna: opsi.idPengguna });
    }
    perubahan.push({
      idTingkatHarga: t.id,
      tier: t.nama,
      lama: barisLama ? { metode: barisLama.metode, hargaJual: barisLama.hargaJual } : null,
      baru: { metode: nilai.metode, hargaJual: nilai.hargaJual },
    });
  }
  await repo.tambahHarga(tx, baruDibuat);
  return perubahan;
}

/** Ringkasan perubahan harga untuk log, mis. "Normal Rp 55.000 → Rp 56.000". */
export function ringkasPerubahanHarga(perubahan: PerubahanHarga[]): string {
  return perubahan
    .map((p) => {
      const baru = `${formatRupiah(p.baru.hargaJual)}${p.baru.metode === 'IKUT_TIER' ? ' (ikut tier)' : ''}`;
      return p.lama ? `${p.tier} ${formatRupiah(p.lama.hargaJual)} → ${baru}` : `${p.tier} ${baru}`;
    })
    .join('; ');
}

/** H13: simpan harga dari halaman Harga Jual. Menyimpan manual melepas tanda perlu tinjau (H5). */
export async function simpanHargaMassal(
  input: InputSimpanHarga,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ jumlahBarang: number; jumlahPerubahan: number }> {
  const perBarang = new Map<number, { idTingkatHarga: number; hargaTetap: number | null }[]>();
  for (const p of input.perubahan) {
    const daftar = perBarang.get(p.idBarang) ?? [];
    daftar.push({ idTingkatHarga: p.idTingkatHarga, hargaTetap: p.hargaTetap });
    perBarang.set(p.idBarang, daftar);
  }
  const idBarang = [...perBarang.keys()].sort((a, b) => a - b);

  return dalamTransaksi(async (tx) => {
    const konteks = await muatKonteksHarga(tx);
    const dasar = new Map((await repo.dataDasar(tx, idBarang)).map((d) => [d.id, d]));
    let jumlahPerubahan = 0;
    // Urutan id tetap agar dua penyimpanan bersamaan tidak saling mengunci (deadlock).
    for (const id of idBarang) {
      const b = dasar.get(id);
      if (!b) throw new AppError('TIDAK_DITEMUKAN', `Barang #${id} tidak ditemukan.`, 404);
      const perubahan = await terapkanHargaBarang(tx, id, perBarang.get(id) ?? [], {
        dasar: dasarMarkup(b, konteks.modeDasar),
        konteks,
        idPengguna: pelaku.id,
      });
      if (perubahan.length === 0) continue;
      jumlahPerubahan += perubahan.length;
      await catatLog(tx, {
        aksi: 'HARGA_UBAH',
        idPengguna: pelaku.id,
        entitas: 'barang',
        idEntitas: id,
        ringkasan: `Harga ${b.namaBarang}: ${ringkasPerubahanHarga(perubahan)}`,
        dataLama: Object.fromEntries(perubahan.map((p) => [p.tier, p.lama])),
        dataBaru: Object.fromEntries(perubahan.map((p) => [p.tier, p.baru])),
        ip: asal.ip,
      });
    }
    await repo.aturTandaTinjau(tx, idBarang, false);
    return { jumlahBarang: idBarang.length, jumlahPerubahan };
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
      ...nilaiHarga(null, markupPersen, dasarMarkup(b, konteks.modeDasar), konteks.kelipatan),
      idBarang: b.id,
      idTingkatHarga,
      idPengguna,
    })),
  );
  return semua.length;
}
