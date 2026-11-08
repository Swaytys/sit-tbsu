import {
  bandingQty,
  formatRupiah,
  keQty,
  PESAN_REFERENSI_KELUAR,
  referensiSah,
  subtotalRupiah,
  type SyaratBayar,
  type BarisDaftarPenerimaan,
  type DataPenerimaan,
  type DetailPenerimaan,
  type MetaHalaman,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { db, type Tx } from '../../../db/client';
import { orderPembelian, pemasok } from '../../../db/schema';
import { AppError, galatBaris, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';
import { catatKas, shiftUntukCatat } from '../../kas/shift/service';
import { kunciBarangHarga } from '../../master/harga/repo';
import { petaDasar, tanggapiPerubahanDasar } from '../../master/harga/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { catatMutasi, kunciPersediaan } from '../ledger';
import { terimaDariPO } from '../order-pembelian/service';
import * as repo from './repo';

/*
 * Penerimaan barang (docs/05 §11, E1–E6). Dokumen tidak bisa diubah atau dibatalkan (E5); koreksi lewat
 * penyesuaian. Setiap baris menulis mutasi PENERIMAAN lewat ledger dalam satu transaksi.
 */

type Baris = NonNullable<Awaited<ReturnType<typeof repo.penerimaanById>>>;

function keRespons(b: Baris): BarisDaftarPenerimaan {
  return {
    id: b.id,
    nomor: b.nomor,
    tanggal: b.tanggal.toISOString(),
    tanggalOperasional: b.tanggalOperasional,
    idPemasok: b.idPemasok,
    namaPemasok: b.namaPemasok,
    jenis: b.jenis,
    syaratBayar: b.syaratBayar,
    tanggalJatuhTempo: b.tanggalJatuhTempo,
    noFakturPemasok: b.noFakturPemasok,
    totalFaktur: b.totalFaktur,
    sisaHutang: b.sisaHutang,
    statusHutang: b.statusHutang,
    jumlahBaris: b.jumlahBaris,
    namaPengguna: b.namaPengguna,
  };
}

export async function daftarPenerimaan(
  p: repo.SaringPenerimaan & { halaman: number; perHalaman: number },
): Promise<{ data: BarisDaftarPenerimaan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPenerimaan(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

export async function detailPenerimaan(id: number): Promise<DetailPenerimaan> {
  const b = await repo.penerimaanById(db, id);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Penerimaan tidak ditemukan.', 404);
  const [baris, pembayaran, ditolak, menyimpang] = await Promise.all([
    repo.detailPenerimaan(db, id),
    repo.pembayaranPenerimaan(db, id),
    repo.tolakPenerimaan(db, id),
    repo.penyimpanganPenerimaan(db, id),
  ]);
  return {
    ...keRespons(b),
    kodePemasok: b.kodePemasok,
    noSuratJalanPemasok: b.noSuratJalanPemasok,
    catatan: b.catatan,
    totalDibayar: b.totalDibayar,
    idOrderPembelian: b.idOrderPembelian,
    nomorOrderPembelian: b.nomorOrderPembelian,
    baris,
    pembayaran: pembayaran.map((x) => ({ ...x, tanggal: x.tanggal.toISOString() })),
    ditolak: ditolak.map((x) => ({ ...x, qty: keQty(x.qty) })),
    penyimpanganBayar: menyimpang?.penyimpanganBayar ?? false,
    alasanPenyimpangan: menyimpang?.alasanPenyimpangan ?? null,
  };
}

/** K-236: kesepakatan order (kosong untuk order lama sebelum K-236 → isian form yang dipakai). */
async function kesepakatanOrder(tx: Tx, idPO: number) {
  const [po] = await tx
    .select({ syaratBayar: orderPembelian.syaratBayar, tempoHari: orderPembelian.tempoHari })
    .from(orderPembelian)
    .where(eq(orderPembelian.id, idPO));
  return po?.syaratBayar ? po : null;
}

/**
 * K-237: bayar kurang dari kesepakatan tunai. Hanya pemegang `pembelian.setujui` (Kepala Toko/Owner) yang boleh
 * mencatatnya; alasan wajib; jatuh tempo sisa paling lama tempo pemasok (bawaan 30 hari).
 */
async function periksaKurangBayar(
  tx: Tx,
  input: DataPenerimaan,
  pelaku: PenggunaAktif,
  idPemasok: number,
  tanggal: string,
): Promise<{ alasan: string; jatuhTempo: string }> {
  if (!pelaku.izin.has('pembelian.setujui')) {
    throw new AppError(
      'TIDAK_BERIZIN',
      'Kesepakatan order ini lunas saat barang datang. Bayar kurang dari sisa tagihan hanya bisa dicatat ' +
        'Kepala Toko/Owner (masuk dengan akunnya).',
      403,
    );
  }
  const alasan = input.alasanKurangBayar?.trim() ?? '';
  if (alasan.length < 3) {
    throw galatKolom('alasanKurangBayar', 'Tulis alasan dibayar kurang dari kesepakatan.');
  }
  const [pm] = await tx
    .select({ tempoHari: pemasok.tempoHari })
    .from(pemasok)
    .where(eq(pemasok.id, idPemasok));
  const maks = tambahHari(tanggal, pm?.tempoHari ?? 30);
  const jt = input.jatuhTempoKurangBayar;
  if (!jt || jt < tanggal || jt > maks) {
    throw galatKolom(
      'jatuhTempoKurangBayar',
      `Isi jatuh tempo sisa antara hari ini dan ${maks} (tempo pemasok).`,
    );
  }
  return { alasan, jatuhTempo: jt };
}

/**
 * E1–E4: simpan penerimaan, tulis mutasi PENERIMAAN per baris (HPP L4, harga beli terakhir L6 untuk
 * PEMBELIAN, harga titip untuk KONSINYASI), lalu catat pelunasan bila TUNAI.
 */
export async function simpanPenerimaan(
  input: DataPenerimaan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenerimaan> {
  const tanggal = tanggalOperasional();
  if (input.idOrderPembelian && input.jenis !== 'PEMBELIAN') {
    throw galatKolom('idOrderPembelian', 'Order pembelian hanya untuk penerimaan jenis pembelian.');
  }
  if (input.jenis === 'PEMBELIAN' && input.syaratBayar === 'TEMPO') {
    if (!input.tanggalJatuhTempo || input.tanggalJatuhTempo < tanggal) {
      throw galatKolom('tanggalJatuhTempo', 'Tanggal jatuh tempo tidak boleh sebelum hari ini.');
    }
  }

  const id = await dalamTransaksi(async (tx) => {
    const pms = await repo.pemasokAktif(tx, input.idPemasok);
    if (pms?.statusAktif !== 'AKTIF') {
      throw galatKolom('idPemasok', 'Pemasok tidak ditemukan atau nonaktif.');
    }
    const perBarang = new Map(
      (
        await repo.barangUntukPenerimaan(
          tx,
          input.baris.map((b) => b.idBarang),
        )
      ).map((b) => [b.id, b]),
    );

    const konsinyasi = input.jenis === 'KONSINYASI';
    // K-236: penerimaan dari order mewarisi syarat bayar dan lama tempo order (isian form diabaikan).
    const sepakat = input.idOrderPembelian
      ? await kesepakatanOrder(tx, input.idOrderPembelian)
      : null;
    const syaratDasar: SyaratBayar | null = konsinyasi
      ? null
      : sepakat
        ? sepakat.syaratBayar === 'TEMPO'
          ? 'TEMPO'
          : 'TUNAI'
        : (input.syaratBayar ?? null);
    const jatuhTempoDasar =
      syaratDasar !== 'TEMPO'
        ? null
        : sepakat
          ? tambahHari(tanggal, sepakat.tempoHari ?? 0)
          : (input.tanggalJatuhTempo ?? null);
    const semuaBaris = input.baris.map((b, i) => {
      const brg = perBarang.get(b.idBarang);
      if (!brg) throw galatBaris(i, 'idBarang', 'Barang tidak ditemukan.');
      if (brg.statusAktif !== 'AKTIF')
        throw galatBaris(i, 'idBarang', `${brg.namaBarang} nonaktif.`);
      if (!konsinyasi && brg.kepemilikan === 'KONSINYASI') {
        throw galatBaris(
          i,
          'idBarang',
          `${brg.namaBarang} adalah barang konsinyasi; terima lewat jenis Konsinyasi.`,
        );
      }
      if (konsinyasi && (brg.kepemilikan !== 'KONSINYASI' || brg.idPemasokKonsinyasi !== pms.id)) {
        throw galatBaris(i, 'idBarang', `${brg.namaBarang} bukan barang titipan ${pms.nama}.`);
      }
      // E3: harga konsinyasi = harga titip, tidak bisa diubah.
      const harga = konsinyasi ? (brg.hargaTitip ?? 0) : b.hargaModalMasuk;
      const qty = keQty(b.qtyMasuk);
      const ditolak = keQty(b.qtyDitolak ?? '0');
      return { ...b, brg, qty, ditolak, harga, subtotal: subtotalRupiah(qty, harga) };
    });
    // K-237: baris yang semua barangnya ditolak tidak masuk stok/tagihan (hanya tercatat sebagai tolak).
    const baris = semuaBaris.filter((b) => bandingQty(b.qty, 0) > 0);

    // Urutan kunci baku barang → persediaan (berurutan id, K-086) agar tidak saling mengunci dengan
    // simpan harga, ubah barang, atau penerimaan lain. D sebelum penerimaan untuk pemicu H5/H7.
    const idUnik = [...new Set(baris.map((b) => b.idBarang))].sort((a, b) => a - b);
    await kunciBarangHarga(tx, idUnik);
    for (const idBarang of idUnik) await kunciPersediaan(tx, idBarang);
    const dasarSebelum = konsinyasi ? null : await petaDasar(tx, idUnik);

    const totalFaktur = konsinyasi ? 0 : baris.reduce((t, b) => t + b.subtotal, 0);
    const tunai = syaratDasar === 'TUNAI';
    const nomor = await terbitkanNomor(tx, 'RCV', tanggal);
    const idBaru = await repo.tambahHeader(tx, {
      nomor,
      tanggalOperasional: tanggal,
      idPemasok: pms.id,
      idPengguna: pelaku.id,
      jenis: input.jenis,
      syaratBayar: syaratDasar,
      tanggalJatuhTempo: jatuhTempoDasar,
      noFakturPemasok: input.noFakturPemasok ?? null,
      noSuratJalanPemasok: input.noSuratJalanPemasok ?? null,
      catatan: input.catatan ?? null,
      totalFaktur,
      totalDibayar: 0,
      statusHutang: konsinyasi ? 'TIDAK_ADA' : 'BELUM_LUNAS',
      idOrderPembelian: input.idOrderPembelian ?? null,
    });

    for (const b of baris) {
      const idDetail = await repo.tambahDetail(tx, {
        idPenerimaan: idBaru,
        idBarang: b.idBarang,
        qtyMasuk: b.qty,
        qtyDasar: b.qty,
        hargaModalMasuk: b.harga,
        hargaModalDasar: b.harga,
        subtotal: b.subtotal,
        keterangan: b.keterangan ?? null,
        idOrderPembelianDetail: input.idOrderPembelian ? (b.idOrderPembelianDetail ?? null) : null,
      });
      await catatMutasi(tx, {
        idBarang: b.idBarang,
        jenis: 'PENERIMAAN',
        qtyMasuk: b.qty,
        hppSatuan: b.harga,
        pembelian: !konsinyasi,
        sumber: { idPenerimaanDetail: idDetail },
        idPengguna: pelaku.id,
        tanggalOperasional: tanggal,
        keterangan: `Terima dari ${pms.nama} (${nomor})`,
      });
    }
    // H5/H7 (L6): harga beli baru → tanda perlu tinjau atau harga otomatis, di transaksi yang sama.
    if (dasarSebelum) {
      await tanggapiPerubahanDasar(tx, dasarSebelum, {
        sebab: `penerimaan ${nomor}`,
        idPengguna: pelaku.id,
        ip: asal.ip,
        nomorDokumen: nomor,
      });
    }

    // K-125 PO5: penerimaan dari order pembelian: perbarui PO dan pakai uang mukanya untuk faktur ini.
    let uangMuka = 0;
    let nomorPO: string | null = null;
    if (input.idOrderPembelian) {
      const h = await terimaDariPO(tx, {
        idPO: input.idOrderPembelian,
        idPemasok: pms.id,
        idPenerimaan: idBaru,
        totalFaktur,
        baris: semuaBaris.map((b) => ({
          idOrderPembelianDetail: b.idOrderPembelianDetail,
          idBarang: b.idBarang,
          qty: b.qty,
          ditolak: b.ditolak,
          alasanTolak: b.alasanTolak ?? null,
          tindakanTolak: b.tindakanTolak ?? null,
        })),
        pelaku,
        tanggal,
      });
      uangMuka = h.uangMukaTerpakai;
      nomorPO = h.nomorPO;
    }

    // E4/K-237: yang dibayar sekarang. Tunai (termasuk bayar di muka yang belum lunas) wajib melunasi sisa tagihan;
    // kurang dari itu = penyimpangan (alasan, jatuh tempo, Kepala Toko/Owner). Tempo: boleh mencicil sekarang.
    const sisaTagihan = totalFaktur - uangMuka;
    let bayarTunai = konsinyasi ? 0 : tunai ? sisaTagihan : 0;
    let menyimpang: { alasan: string; jatuhTempo: string } | null = null;
    if (sepakat && !konsinyasi) {
      bayarTunai = input.bayarSekarang ?? bayarTunai;
      if (bayarTunai > sisaTagihan) {
        throw galatKolom(
          'bayarSekarang',
          `Melebihi sisa tagihan ${formatRupiah(sisaTagihan)} setelah uang muka.`,
        );
      }
      if (tunai && bayarTunai < sisaTagihan) {
        menyimpang = await periksaKurangBayar(tx, input, pelaku, pms.id, tanggal);
      }
    }
    if (menyimpang) {
      await repo.aturPenyimpangan(tx, idBaru, {
        syaratBayar: 'TEMPO',
        tanggalJatuhTempo: menyimpang.jatuhTempo,
        penyimpanganBayar: true,
        alasanPenyimpangan: menyimpang.alasan,
        idPenyetujuPenyimpangan: pelaku.id,
      });
    }
    if (!konsinyasi) {
      const dibayar = uangMuka + bayarTunai;
      await repo.aturDibayar(tx, idBaru, {
        totalDibayar: dibayar,
        statusHutang: dibayar >= totalFaktur ? 'LUNAS' : dibayar === 0 ? 'BELUM_LUNAS' : 'SEBAGIAN',
      });
    }

    // Uang TUNAI keluar dari laci shift BUKA (K2); transfer wajib No. referensi (K-196).
    if (bayarTunai > 0) {
      if (input.metodeBayar === 'TRANSFER' && !referensiSah(input.referensi)) {
        throw galatKolom('referensi', PESAN_REFERENSI_KELUAR);
      }
      const shift = input.metodeBayar === 'TUNAI' ? await shiftUntukCatat(tx) : null;
      if (input.metodeBayar === 'TUNAI' && !shift) {
        throw new AppError(
          'KONFLIK',
          'Bayar tunai butuh shift toko terbuka. Buka shift dulu, atau pilih transfer.',
          409,
          { kolom: { metodeBayar: ['Butuh shift terbuka.'] } },
        );
      }
      const nomorBayar = await terbitkanNomor(tx, 'PBP', tanggal);
      const idBayar = await repo.tambahPembayaran(tx, {
        nomor: nomorBayar,
        tanggalOperasional: tanggal,
        idPemasok: pms.id,
        idPenerimaan: idBaru,
        idPengguna: pelaku.id,
        idShift: shift?.id ?? null,
        nominal: bayarTunai,
        metode: input.metodeBayar,
        referensi: input.metodeBayar === 'TRANSFER' ? (input.referensi?.trim() ?? null) : null,
        catatan: `${tunai && !menyimpang ? 'Pelunasan' : 'Bayar'} penerimaan ${nomor}`,
      });
      if (shift) {
        await catatKas(tx, {
          jenis: 'BAYAR_PEMASOK',
          nominal: bayarTunai,
          pelaku,
          keterangan: `${nomorBayar}: bayar ${pms.nama} (${nomor})`,
          idPembayaranPemasok: idBayar,
        });
      }
    }

    await catatLog(tx, {
      aksi: 'PENERIMAAN_SIMPAN',
      idPengguna: pelaku.id,
      entitas: 'penerimaan_barang',
      idEntitas: idBaru,
      nomorDokumen: nomor,
      ringkasan:
        `Penerimaan ${nomor} dari ${pms.nama}: ${baris.length} barang` +
        (konsinyasi
          ? ' (konsinyasi)'
          : `, ${formatRupiah(totalFaktur)} ${tunai && !menyimpang ? 'tunai' : 'tempo'}`) +
        (menyimpang
          ? `; dibayar kurang dari kesepakatan, sisa jatuh tempo ${menyimpang.jatuhTempo}: ${menyimpang.alasan}`
          : '') +
        (nomorPO
          ? ` (dari ${nomorPO}${uangMuka > 0 ? `, uang muka ${formatRupiah(uangMuka)}` : ''})`
          : ''),
      ip: asal.ip,
    });
    return idBaru;
  });
  return detailPenerimaan(id);
}
