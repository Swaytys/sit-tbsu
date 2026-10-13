import {
  formatRupiah,
  keQty,
  subtotalRupiah,
  type BarisDaftarPenerimaan,
  type DataPenerimaan,
  type DetailPenerimaan,
  type MetaHalaman,
  type StatusHutang,
} from '@sit/shared';
import { db } from '../../../db/client';
import { AppError, galatBaris, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { tanggalOperasional } from '../../../lib/waktu';
import { catatKas, shiftUntukCatat } from '../../kas/shift/service';
import { kunciBarangHarga } from '../../master/harga/repo';
import { petaDasar, tanggapiPerubahanDasar } from '../../master/harga/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { catatMutasi, kunciPersediaan } from '../ledger';
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
  const baris = await repo.detailPenerimaan(db, id);
  const pembayaran = await repo.pembayaranPenerimaan(db, id);
  return {
    ...keRespons(b),
    kodePemasok: b.kodePemasok,
    noSuratJalanPemasok: b.noSuratJalanPemasok,
    catatan: b.catatan,
    totalDibayar: b.totalDibayar,
    baris,
    pembayaran: pembayaran.map((x) => ({ ...x, tanggal: x.tanggal.toISOString() })),
  };
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
    const baris = input.baris.map((b, i) => {
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
      return { ...b, brg, qty, harga, subtotal: subtotalRupiah(qty, harga) };
    });

    // Urutan kunci baku barang → persediaan (berurutan id, K-086) agar tidak saling mengunci dengan
    // simpan harga, ubah barang, atau penerimaan lain. D sebelum penerimaan untuk pemicu H5/H7.
    const idUnik = [...new Set(baris.map((b) => b.idBarang))].sort((a, b) => a - b);
    await kunciBarangHarga(tx, idUnik);
    for (const idBarang of idUnik) await kunciPersediaan(tx, idBarang);
    const dasarSebelum = konsinyasi ? null : await petaDasar(tx, idUnik);

    const totalFaktur = konsinyasi ? 0 : baris.reduce((t, b) => t + b.subtotal, 0);
    const tunai = !konsinyasi && input.syaratBayar === 'TUNAI';
    const statusHutang: StatusHutang = konsinyasi
      ? 'TIDAK_ADA'
      : tunai || totalFaktur === 0
        ? 'LUNAS'
        : 'BELUM_LUNAS';
    const nomor = await terbitkanNomor(tx, 'RCV', tanggal);
    const idBaru = await repo.tambahHeader(tx, {
      nomor,
      tanggalOperasional: tanggal,
      idPemasok: pms.id,
      idPengguna: pelaku.id,
      jenis: input.jenis,
      syaratBayar: konsinyasi ? null : (input.syaratBayar ?? null),
      tanggalJatuhTempo:
        !konsinyasi && input.syaratBayar === 'TEMPO' ? (input.tanggalJatuhTempo ?? null) : null,
      noFakturPemasok: input.noFakturPemasok ?? null,
      noSuratJalanPemasok: input.noSuratJalanPemasok ?? null,
      catatan: input.catatan ?? null,
      totalFaktur,
      totalDibayar: tunai ? totalFaktur : 0,
      statusHutang,
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

    // E4: pembelian tunai langsung lunas. Uang TUNAI keluar dari laci shift BUKA pencatat (K2, K-075).
    if (tunai && totalFaktur > 0) {
      const shift = input.metodeBayar === 'TUNAI' ? await shiftUntukCatat(tx, pelaku.id) : null;
      if (input.metodeBayar === 'TUNAI' && !shift) {
        throw new AppError(
          'KONFLIK',
          'Bayar tunai dari laci butuh shift kasir terbuka. Buka shift dulu, atau pilih transfer.',
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
        nominal: totalFaktur,
        metode: input.metodeBayar,
        catatan: `Pelunasan tunai penerimaan ${nomor}`,
      });
      if (shift) {
        await catatKas(tx, {
          jenis: 'BAYAR_PEMASOK',
          nominal: totalFaktur,
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
          : `, ${formatRupiah(totalFaktur)} ${tunai ? 'tunai' : 'tempo'}`),
      ip: asal.ip,
    });
    return idBaru;
  });
  return detailPenerimaan(id);
}
