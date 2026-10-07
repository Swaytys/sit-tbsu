import {
  bandingQty,
  faktorSatuan,
  formatRupiah,
  hargaSatuanJual,
  JENIS_DIMENSI_FISIK,
  rapikanDesimal,
  type DataSimpanSatuanJual,
  type DetailBarang,
  type OpsiSatuanBaris,
  type SatuanJualBarang,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { db, type Executor } from '../../../db/client';
import { tingkatHarga } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as barangRepo from '../barang/repo';
import { hargaBarangDasar } from '../harga/repo';
import { muatKonteksHarga } from '../harga/service';
import * as satuanRepo from '../satuan/repo';
import * as repo from './repo';

/*
 * Satuan jual per barang (Fase 12, docs/06 H11, K-091). Harga satuan jual per tier = harga tetap bila
 * ditetapkan, selain itu bulatkanHarga(harga satuan dasar tier itu × faktor), dihitung saat dibaca sehingga selalu
 * mengikuti harga satuan dasar.
 */

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;

/** "12.0000" → "12", "0.2500" → "0.25". */
export const rapikanFaktor = rapikanDesimal;

async function tierAktif(ex: Executor) {
  return ex
    .select({ id: tingkatHarga.id })
    .from(tingkatHarga)
    .where(eq(tingkatHarga.statusAktif, 'AKTIF'));
}

/** Satuan jual (aktif dan nonaktif) per barang dengan harga per tier aktif. */
export async function muatSatuanJual(
  ex: Executor,
  idBarang: number[],
): Promise<Map<number, SatuanJualBarang[]>> {
  const hasil = new Map<number, SatuanJualBarang[]>();
  const rows = await repo.satuanJualBarang(ex, idBarang);
  if (rows.length === 0) return hasil;
  const idDipakai = [...new Set(rows.map((r) => r.idBarang))];
  const { kelipatan } = await muatKonteksHarga(ex);
  const tier = await tierAktif(ex);
  const dasar = new Map(
    (await hargaBarangDasar(ex, idDipakai)).map((h) => [
      `${h.idBarang}:${h.idTingkatHarga}`,
      h.hargaJual,
    ]),
  );
  const tetap = new Map(
    (await repo.hargaTetapSatuanJual(ex, idDipakai))
      .filter((h) => h.metode === 'TETAP' && h.hargaTetap !== null)
      .map((h) => [`${h.idSatuanJual}:${h.idTingkatHarga}`, h.hargaTetap ?? 0]),
  );
  for (const r of rows) {
    const harga: SatuanJualBarang['harga'] = [];
    for (const t of tier) {
      const t1 = tetap.get(`${r.id}:${t.id}`);
      if (t1 !== undefined) {
        harga.push({ idTingkatHarga: t.id, hargaJual: t1, tetap: true });
        continue;
      }
      const d = dasar.get(`${r.idBarang}:${t.id}`);
      if (d !== undefined) {
        harga.push({
          idTingkatHarga: t.id,
          hargaJual: hargaSatuanJual(d, r.faktor, kelipatan),
          tetap: false,
        });
      }
    }
    const daftar = hasil.get(r.idBarang) ?? [];
    daftar.push({
      id: r.id,
      idSatuan: r.idSatuan,
      kodeSatuan: r.kodeSatuan,
      namaSatuan: r.namaSatuan,
      faktor: rapikanFaktor(r.faktor),
      barcode: r.barcode,
      isDefaultJual: r.isDefaultJual,
      statusAktif: r.statusAktif,
      harga,
    });
    hasil.set(r.idBarang, daftar);
  }
  return hasil;
}

/** Pilihan satuan baris transaksi: satuan dasar lalu satuan jual aktif. */
export function opsiSatuan(
  kodeSatuanDasar: string,
  hargaDasar: { idTingkatHarga: number; hargaJual: number }[],
  satuanJual: SatuanJualBarang[],
): OpsiSatuanBaris[] {
  return [
    { idSatuanJual: null, kodeSatuan: kodeSatuanDasar, faktor: '1', hargaTier: hargaDasar },
    ...satuanJual
      .filter((s) => s.statusAktif === 'AKTIF')
      .map((s) => ({
        idSatuanJual: s.id,
        kodeSatuan: s.kodeSatuan,
        faktor: s.faktor,
        hargaTier: s.harga.map((h) => ({
          idTingkatHarga: h.idTingkatHarga,
          hargaJual: h.hargaJual,
        })),
      })),
  ];
}

function galat(i: number, kolom: string, pesan: string): AppError {
  return new AppError('VALIDASI', `Satuan jual ${i + 1}: ${pesan}`, 400, {
    kolom: { [`baris.${i}.${kolom}`]: [pesan] },
  });
}

/**
 * Simpan seluruh satuan jual barang (K-091): baris dicocokkan per satuan; satuan jual yang tidak dikirim
 * dinonaktifkan (tidak dihapus). Faktor antar-satuan fisik berdimensi sama dihitung dari tabel satuan. Harga tetap
 * per tier butuh `master.harga.kelola`. Log BARANG_UBAH.
 */
export async function simpanSatuanJual(
  idBarang: number,
  input: DataSimpanSatuanJual,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  detail: (id: number) => Promise<DetailBarang>,
): Promise<DetailBarang> {
  await dalamTransaksi(async (tx) => {
    const brg = await barangRepo.kunciBarang(tx, idBarang);
    if (!brg) throw new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);
    const dasar = await satuanRepo.satuanById(tx, brg.idSatuanDasar);
    if (!dasar) throw new Error('satuan dasar hilang');
    const lama = await repo.satuanJualBarang(tx, [idBarang]);
    const lamaPer = new Map(lama.map((l) => [l.idSatuan, l]));
    const hargaLama = new Map(
      (await repo.hargaTetapSatuanJual(tx, [idBarang]))
        .filter((h) => h.metode === 'TETAP')
        .map((h) => [`${h.idSatuanJual}:${h.idTingkatHarga}`, h.hargaTetap]),
    );
    const { kelipatan } = await muatKonteksHarga(tx);
    const hargaDasar = new Map(
      (await hargaBarangDasar(tx, [idBarang])).map((h) => [h.idTingkatHarga, h.hargaJual]),
    );
    const idTierAktif = new Set((await tierAktif(tx)).map((t) => t.id));
    const waktu = sekarang();
    const ringkas: string[] = [];

    for (const [i, b] of input.baris.entries()) {
      if (b.idSatuan === brg.idSatuanDasar) {
        throw galat(i, 'idSatuan', 'Satuan jual tidak boleh sama dengan satuan dasar.');
      }
      const s = await satuanRepo.satuanById(tx, b.idSatuan);
      const l = lamaPer.get(b.idSatuan);
      if (!s || (!l && s.statusAktif !== 'AKTIF')) {
        throw galat(i, 'idSatuan', 'Satuan tidak ditemukan atau nonaktif.');
      }
      // Satuan fisik berdimensi sama dengan satuan dasar: faktor mengikuti tabel satuan (mis. cm → m = 0,01).
      let faktor = b.faktor;
      if (s.jenisDimensi === dasar.jenisDimensi && DIMENSI_FISIK.includes(s.jenisDimensi)) {
        faktor = faktorSatuan(s.faktorKeBasis, dasar.faktorKeBasis);
        if (!/[1-9]/.test(faktor)) {
          throw galat(i, 'faktor', `Satuan ${s.kode} terlalu kecil terhadap ${dasar.kode}.`);
        }
      }
      if (b.barcode && (await repo.barcodeTerpakai(tx, b.barcode, l?.id ?? null))) {
        throw galat(i, 'barcode', `Barcode ${b.barcode} sudah dipakai barang atau satuan lain.`);
      }
      const nilai = {
        faktorKeDasar: faktor,
        barcode: b.barcode,
        isDefaultJual: b.isDefaultJual && b.statusAktif === 'AKTIF',
        statusAktif: b.statusAktif,
      };
      let idSj: number;
      if (l) {
        idSj = l.id;
        const berubah =
          bandingQty(l.faktor, faktor) !== 0 ||
          l.barcode !== b.barcode ||
          l.isDefaultJual !== nilai.isDefaultJual ||
          l.statusAktif !== b.statusAktif;
        if (berubah) {
          await repo.ubah(tx, l.id, { ...nilai, diubahPada: waktu });
          ringkas.push(
            `${s.kode} (${rapikanFaktor(faktor)} ${dasar.kode})` +
              (l.statusAktif !== b.statusAktif ? ` ${b.statusAktif.toLowerCase()}` : ' diubah'),
          );
        }
      } else {
        idSj = await repo.tambah(tx, { idBarang, idSatuan: b.idSatuan, ...nilai });
        ringkas.push(`${s.kode} (${rapikanFaktor(faktor)} ${dasar.kode}) ditambah`);
      }
      for (const h of b.hargaTetap) {
        if (!idTierAktif.has(h.idTingkatHarga)) continue;
        const sebelum = hargaLama.get(`${idSj}:${h.idTingkatHarga}`) ?? null;
        if (sebelum === h.harga) continue;
        if (!pelaku.izin.has('master.harga.kelola')) {
          throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin mengubah harga jual.', 403);
        }
        const d = hargaDasar.get(h.idTingkatHarga) ?? 0;
        await repo.aturHarga(tx, {
          idBarang,
          idSatuanJual: idSj,
          idTingkatHarga: h.idTingkatHarga,
          hargaTetap: h.harga,
          hargaJual: hargaSatuanJual(d, faktor, kelipatan),
          waktu,
        });
        ringkas.push(
          `harga ${s.kode} tier #${h.idTingkatHarga}: ` +
            `${sebelum === null ? 'otomatis' : formatRupiah(sebelum)} → ${h.harga === null ? 'otomatis' : formatRupiah(h.harga)}`,
        );
      }
    }
    // Satuan jual yang tidak dikirim lagi dinonaktifkan (dipakai transaksi lama; tidak dihapus).
    const dikirim = new Set(input.baris.map((b) => b.idSatuan));
    for (const l of lama) {
      if (dikirim.has(l.idSatuan) || l.statusAktif === 'NONAKTIF') continue;
      await repo.ubah(tx, l.id, {
        statusAktif: 'NONAKTIF',
        isDefaultJual: false,
        diubahPada: waktu,
      });
      ringkas.push(`${l.kodeSatuan} nonaktif`);
    }
    if (ringkas.length > 0) {
      await catatLog(tx, {
        aksi: 'BARANG_UBAH',
        idPengguna: pelaku.id,
        entitas: 'barang',
        idEntitas: idBarang,
        nomorDokumen: brg.kode,
        ringkasan: `Satuan jual ${brg.namaBarang}: ${ringkas.join('; ')}`.slice(0, 500),
        ip: asal.ip,
      });
    }
  });
  return detail(idBarang);
}

export async function satuanJualPerBarang(idBarang: number[]) {
  return muatSatuanJual(db, idBarang);
}
