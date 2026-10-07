import {
  bandingQty,
  formatRupiah,
  keQty,
  kurangQty,
  subtotalRupiah,
  tambahQty,
  teksTanggalAngka,
  type BarisDaftarPenyelesaianKonsinyasi,
  type BarisSetoranKonsinyasi,
  type DaftarPenyelesaianKonsinyasi,
  type DataPenyelesaianKonsinyasi,
  type DetailPenyelesaianKonsinyasi,
  type PratinjauKonsinyasi,
  type RingkasanKonsinyasiPemasok,
} from '@sit/shared';
import { db, type Executor } from '../../db/client';
import { AppError } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../lib/paginasi';
import { dalamTransaksi } from '../../lib/transaksi';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { pembayaranHutang } from '../hutang/service';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanNomor } from '../sistem/penomoran';
import * as repo from './repo';

/*
 * Penyelesaian konsinyasi (docs/06 KS5–KS9, K-089). Setoran = penjualan barang titipan yang belum disetor
 * dikurangi retur pelanggan kondisi BAIK, per barang per harga titip saat jual. Retur atas baris yang sudah
 * disetor menjadi koreksi pada setoran berikutnya; bila penjualan baru dengan harga titip yang sama belum
 * cukup, koreksi ditunda (qty neto tidak boleh negatif, CHECK DB).
 */

type BarisJual = Awaited<ReturnType<typeof repo.jualBelumDisetor>>[number];
type BarisRetur = Awaited<ReturnType<typeof repo.returBelumDihitung>>[number];

type Grup = {
  idBarang: number;
  hargaTitip: number;
  terjual: string;
  retur: string;
};

export type HasilSetoran = {
  grup: Grup[];
  idJual: number[];
  idRetur: number[];
  koreksiDitunda: number;
};

/** Hitung setoran dari kandidat (murni, mudah diuji). */
export function hitungSetoran(jual: BarisJual[], retur: BarisRetur[]): HasilSetoran {
  const peta = new Map<string, Grup>();
  const kunci = (idBarang: number, harga: number) => `${idBarang}:${harga}`;
  for (const j of jual) {
    const k = kunci(j.idBarang, j.hargaTitip);
    const g = peta.get(k) ?? {
      idBarang: j.idBarang,
      hargaTitip: j.hargaTitip,
      terjual: '0',
      retur: '0',
    };
    g.terjual = tambahQty(g.terjual, j.qtyDasar);
    peta.set(k, g);
  }
  const idJualSet = new Set(jual.map((j) => j.id));
  const idRetur: number[] = [];
  // Retur atas baris yang ikut disetor sekarang: selalu dihitung (qty retur ≤ qty baris itu).
  for (const r of retur) {
    if (r.sudahDisetor || !idJualSet.has(r.idPenjualanDetail)) continue;
    const g = peta.get(kunci(r.idBarang, r.hargaTitip));
    if (!g) continue;
    g.retur = tambahQty(g.retur, r.qtyDasar);
    idRetur.push(r.id);
  }
  // KS6: koreksi atas baris yang sudah disetor, sejauh penjualan baru berharga titip sama mencukupi.
  let koreksiDitunda = 0;
  for (const r of retur) {
    if (!r.sudahDisetor) continue;
    const g = peta.get(kunci(r.idBarang, r.hargaTitip));
    if (g && bandingQty(tambahQty(g.retur, r.qtyDasar), g.terjual) <= 0) {
      g.retur = tambahQty(g.retur, r.qtyDasar);
      idRetur.push(r.id);
    } else {
      koreksiDitunda += 1;
    }
  }
  return { grup: [...peta.values()], idJual: jual.map((j) => j.id), idRetur, koreksiDitunda };
}

async function susunPratinjau(
  ex: Executor,
  pms: { id: number; nama: string },
  periodeSelesai: string,
): Promise<{ pratinjau: PratinjauKonsinyasi; setoran: HasilSetoran }> {
  if (periodeSelesai > tanggalOperasional()) {
    const pesan = 'Tanggal akhir periode tidak boleh melewati hari ini.';
    throw new AppError('VALIDASI', pesan, 400, { kolom: { periodeSelesai: [pesan] } });
  }
  const jual = await repo.jualBelumDisetor(ex, pms.id, periodeSelesai);
  const retur = await repo.returBelumDihitung(ex, pms.id, periodeSelesai);
  const setoran = hitungSetoran(jual, retur);
  const info = new Map(
    (await repo.infoBarang(ex, [...new Set(setoran.grup.map((g) => g.idBarang))])).map((b) => [
      b.id,
      b,
    ]),
  );
  const baris: BarisSetoranKonsinyasi[] = setoran.grup
    .map((g) => {
      const b = info.get(g.idBarang);
      const qtyNeto = kurangQty(g.terjual, g.retur);
      return {
        idBarang: g.idBarang,
        kodeBarang: b?.kode ?? '',
        namaBarang: b?.namaBarang ?? '',
        kodeSatuan: b?.kodeSatuan ?? '',
        hargaTitip: g.hargaTitip,
        qtyTerjual: keQty(g.terjual),
        qtyRetur: keQty(g.retur),
        qtyNeto: keQty(qtyNeto),
        subtotal: subtotalRupiah(qtyNeto, g.hargaTitip),
      };
    })
    .sort((a, b) => a.namaBarang.localeCompare(b.namaBarang) || a.hargaTitip - b.hargaTitip);

  const terakhir = await repo.periodeTerakhir(ex, pms.id);
  const awalJual = jual[0]?.tanggalOperasional ?? periodeSelesai;
  const calon = [terakhir ? tambahHari(terakhir, 1) : awalJual, awalJual, periodeSelesai];
  const periodeMulai = calon.reduce((a, b) => (b < a ? b : a));
  return {
    setoran,
    pratinjau: {
      idPemasok: pms.id,
      namaPemasok: pms.nama,
      periodeMulai,
      periodeSelesai,
      baris,
      total: baris.reduce((t, b) => t + b.subtotal, 0),
      jumlahBarisJual: jual.length,
      koreksiDitunda: setoran.koreksiDitunda,
    },
  };
}

function pemasokTidakAda(): AppError {
  const pesan = 'Pemasok tidak ditemukan.';
  return new AppError('VALIDASI', pesan, 400, { kolom: { idPemasok: [pesan] } });
}

export async function pratinjauKonsinyasi(p: {
  idPemasok: number;
  periodeSelesai: string;
}): Promise<PratinjauKonsinyasi> {
  const pms = await repo.namaPemasok(db, p.idPemasok);
  if (!pms) throw pemasokTidakAda();
  return (await susunPratinjau(db, pms, p.periodeSelesai)).pratinjau;
}

/** KS5: simpan penyelesaian (KSG); total menjadi hutang konsinyasi (HT1). Log KONSINYASI_SELESAIKAN. */
export async function selesaikanKonsinyasi(
  input: DataPenyelesaianKonsinyasi,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyelesaianKonsinyasi> {
  const id = await dalamTransaksi(async (tx) => {
    const pms = await repo.kunciPemasok(tx, input.idPemasok);
    if (!pms) throw pemasokTidakAda();
    const { pratinjau: p, setoran } = await susunPratinjau(tx, pms, input.periodeSelesai);
    if (setoran.idJual.length === 0) {
      const pesan = `Tidak ada penjualan barang titipan ${pms.nama} yang belum disetor sampai ${teksTanggalAngka(input.periodeSelesai)}.`;
      throw new AppError('KONFLIK', pesan, 409);
    }
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'KSG', tanggal);
    const idKsg = await repo.tambahHeader(tx, {
      nomor,
      tanggalOperasional: tanggal,
      idPemasok: pms.id,
      periodeMulai: p.periodeMulai,
      periodeSelesai: p.periodeSelesai,
      idPengguna: pelaku.id,
      total: p.total,
      statusHutang: p.total > 0 ? 'BELUM_LUNAS' : 'LUNAS',
      catatan: input.catatan ?? null,
    });
    await repo.tambahDetail(
      tx,
      p.baris.map((b) => ({
        idPenyelesaian: idKsg,
        idBarang: b.idBarang,
        qtyTerjual: b.qtyTerjual,
        qtyRetur: b.qtyRetur,
        qtyNeto: b.qtyNeto,
        hargaTitip: b.hargaTitip,
        subtotal: b.subtotal,
      })),
    );
    await repo.tandaiJual(tx, setoran.idJual, idKsg);
    await repo.tandaiRetur(tx, setoran.idRetur, idKsg);
    await catatLog(tx, {
      aksi: 'KONSINYASI_SELESAIKAN',
      idPengguna: pelaku.id,
      entitas: 'penyelesaian_konsinyasi',
      idEntitas: idKsg,
      nomorDokumen: nomor,
      ringkasan:
        `Setoran konsinyasi ${pms.nama} s/d ${teksTanggalAngka(p.periodeSelesai)}: ` +
        `${p.baris.length} barang, ${formatRupiah(p.total)}` +
        (p.koreksiDitunda > 0 ? `, ${p.koreksiDitunda} koreksi retur ditunda` : ''),
      ip: asal.ip,
    });
    return idKsg;
  });
  return detailPenyelesaian(id);
}

function keBarisDaftar(
  b: NonNullable<Awaited<ReturnType<typeof repo.byId>>>,
): BarisDaftarPenyelesaianKonsinyasi {
  return {
    id: b.id,
    nomor: b.nomor,
    tanggal: b.tanggal.toISOString(),
    idPemasok: b.idPemasok,
    namaPemasok: b.namaPemasok,
    periodeMulai: b.periodeMulai,
    periodeSelesai: b.periodeSelesai,
    total: b.total,
    totalDibayar: b.totalDibayar,
    sisaHutang: b.sisaHutang ?? b.total - b.totalDibayar,
    statusHutang: b.statusHutang,
    namaPengguna: b.namaPengguna,
  };
}

export async function daftarPenyelesaian(
  p: repo.SaringPenyelesaian & { halaman: number; perHalaman: number },
): Promise<DaftarPenyelesaianKonsinyasi> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keBarisDaftar), meta: metaHalaman(total, p) };
}

export async function detailPenyelesaian(id: number): Promise<DetailPenyelesaianKonsinyasi> {
  const h = await repo.byId(db, id);
  if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Penyelesaian konsinyasi tidak ditemukan.', 404);
  const baris = (await repo.detail(db, id)).map((b) => ({
    ...b,
    qtyTerjual: keQty(b.qtyTerjual),
    qtyRetur: keQty(b.qtyRetur),
    qtyNeto: keQty(b.qtyNeto),
  }));
  return {
    ...keBarisDaftar(h),
    catatan: h.catatan,
    baris,
    pembayaran: await pembayaranHutang('KONSINYASI', id),
  };
}

/** KS8: posisi konsinyasi per pemasok penitip (stok titipan, belum disetor, sisa hutang). */
export async function ringkasanKonsinyasi(): Promise<RingkasanKonsinyasiPemasok[]> {
  const hasil = new Map<number, RingkasanKonsinyasiPemasok>();
  const ambil = (id: number, nama = '') => {
    const r = hasil.get(id) ?? {
      idPemasok: id,
      namaPemasok: nama,
      jumlahBarang: 0,
      nilaiStokTitipan: 0,
      nilaiBelumDisetor: 0,
      sisaHutang: 0,
      terakhirDisetor: null,
    };
    if (nama) r.namaPemasok = nama;
    hasil.set(id, r);
    return r;
  };
  for (const p of await repo.pemasokTitipan(db)) ambil(p.id, p.nama);
  for (const s of await repo.stokTitipan(db)) {
    if (s.idPemasok === null) continue;
    const r = ambil(s.idPemasok);
    r.jumlahBarang += 1;
    r.nilaiStokTitipan += subtotalRupiah(tambahQty(s.stokFisik, s.stokRusak), s.hargaTitip ?? 0);
  }
  for (const j of await repo.semuaJualBelumDisetor(db)) {
    if (j.idPemasok === null) continue;
    ambil(j.idPemasok).nilaiBelumDisetor += subtotalRupiah(j.qtyDasar, j.hargaTitip);
  }
  for (const k of await repo.rekapPenyelesaian(db)) {
    const r = ambil(k.idPemasok);
    r.sisaHutang = k.sisaHutang;
    r.terakhirDisetor = k.terakhir;
  }
  // Pemasok tanpa nama = bukan penitip lagi tetapi punya penyelesaian; lengkapi namanya.
  for (const r of hasil.values()) {
    if (!r.namaPemasok) r.namaPemasok = (await repo.namaPemasok(db, r.idPemasok))?.nama ?? '';
  }
  return [...hasil.values()].sort((a, b) => a.namaPemasok.localeCompare(b.namaPemasok));
}
