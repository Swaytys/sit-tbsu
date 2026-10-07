import {
  formatRupiah,
  keQty,
  subtotalRupiah,
  type BarisDaftarReturPemasok,
  type DataReturPemasok,
  type DetailReturPemasok,
  type MetaHalaman,
} from '@sit/shared';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { statusHutangDari } from '../../hutang/service';
import * as hutangRepo from '../../hutang/repo';
import { catatKas, shiftBuka } from '../../kas/shift/service';
import { kunciBarangHarga } from '../../master/harga/repo';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { catatMutasi, kunciPersediaan } from '../ledger';
import * as penerimaanRepo from '../penerimaan/repo';
import * as repo from './repo';

/*
 * Retur ke pemasok (docs/06 RP1–RP7, K-088). Dokumen RTP tidak diubah atau dibatalkan (append-only); setiap
 * baris mengeluarkan stok lewat ledger (RETUR_PEMASOK) dari bucket kondisi asalnya dengan HPP rata-rata saat
 * itu. Penyelesaian: potong hutang penerimaan, ganti barang (penerimaan pengganti dibayar kompensasi), uang
 * kembali (tunai ke laci shift / transfer), atau pengembalian titipan (konsinyasi).
 */

type Header = NonNullable<Awaited<ReturnType<typeof repo.returById>>>;

function keRespons(h: Header): BarisDaftarReturPemasok {
  return {
    id: h.id,
    nomor: h.nomor,
    tanggal: h.tanggal.toISOString(),
    tanggalOperasional: h.tanggalOperasional,
    idPemasok: h.idPemasok,
    namaPemasok: h.namaPemasok,
    idPenerimaan: h.idPenerimaan,
    nomorPenerimaan: h.nomorPenerimaan,
    penyelesaian: h.penyelesaian,
    totalRetur: h.totalRetur,
    jumlahBaris: h.jumlahBaris,
    namaPengguna: h.namaPengguna,
  };
}

export async function daftarReturPemasok(
  p: repo.SaringReturPemasok & { halaman: number; perHalaman: number },
): Promise<{ data: BarisDaftarReturPemasok[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

export async function detailReturPemasok(
  id: number,
  peringatan: string[] = [],
): Promise<DetailReturPemasok> {
  const h = await repo.returById(db, id);
  if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Retur pemasok tidak ditemukan.', 404);
  return {
    ...keRespons(h),
    alasan: h.alasan,
    catatan: h.catatan,
    baris: (await repo.detail(db, id)).map((b) => ({ ...b, qty: keQty(b.qty) })),
    nomorPenerimaanPengganti: await repo.penerimaanPengganti(db, id),
    peringatan,
  };
}

function galatBaris(i: number, pesan: string): AppError {
  return new AppError('VALIDASI', `Baris ${i + 1}: ${pesan}`, 400, {
    kolom: { [`baris.${i}.idBarang`]: [pesan] },
  });
}

export async function simpanReturPemasok(
  input: DataReturPemasok,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailReturPemasok> {
  const peringatan: string[] = [];
  const id = await dalamTransaksi(async (tx) => {
    const pms = await penerimaanRepo.pemasokAktif(tx, input.idPemasok);
    if (!pms) {
      const pesan = 'Pemasok tidak ditemukan.';
      throw new AppError('VALIDASI', pesan, 400, { kolom: { idPemasok: [pesan] } });
    }
    const titipan = input.penyelesaian === 'PENGEMBALIAN_TITIPAN';
    const idUnik = [...new Set(input.baris.map((b) => b.idBarang))].sort((a, b) => a - b);
    const brg = new Map((await repo.dataBarang(tx, idUnik)).map((b) => [b.id, b]));
    input.baris.forEach((b, i) => {
      const x = brg.get(b.idBarang);
      if (!x) throw galatBaris(i, 'Barang tidak ditemukan.');
      if (titipan && (x.kepemilikan !== 'KONSINYASI' || x.idPemasokKonsinyasi !== pms.id)) {
        throw galatBaris(i, `${x.namaBarang} bukan barang titipan ${pms.nama}.`);
      }
      if (!titipan && x.kepemilikan === 'KONSINYASI') {
        throw galatBaris(
          i,
          `${x.namaBarang} barang titipan; kembalikan lewat penyelesaian "Pengembalian titipan".`,
        );
      }
    });
    if (!titipan) {
      // RP1: barang milik sendiri yang belum pernah dibeli dari pemasok ini → peringatan, bukan penolakan.
      const dibeli = await repo.pernahDibeli(tx, pms.id, idUnik);
      for (const idBarang of idUnik) {
        if (!dibeli.has(idBarang)) {
          peringatan.push(
            `${brg.get(idBarang)?.namaBarang ?? 'Barang'} belum pernah dibeli dari ${pms.nama}.`,
          );
        }
      }
    }

    // Urutan kunci baku barang → persediaan (berurutan id, K-086); HPP saat ini per barang (L5, RP2).
    await kunciBarangHarga(tx, idUnik);
    const hpp = new Map<number, number>();
    for (const idBarang of idUnik)
      hpp.set(idBarang, (await kunciPersediaan(tx, idBarang)).hppRata2);
    const baris = input.baris.map((b) => {
      const qty = keQty(b.qty);
      const h = hpp.get(b.idBarang) ?? 0;
      return { ...b, qty, hpp: h, subtotal: subtotalRupiah(qty, h) };
    });
    const total = baris.reduce((t, b) => t + b.subtotal, 0);

    // RP4: potong hutang penerimaan pemasok yang sama, sisa harus cukup.
    const sumber =
      input.idPenerimaan === null ? null : await hutangRepo.kunciPenerimaan(tx, input.idPenerimaan);
    if (input.idPenerimaan !== null) {
      if (!sumber || sumber.idPemasok !== pms.id || sumber.jenis !== 'PEMBELIAN') {
        const pesan = `Penerimaan asal bukan pembelian dari ${pms.nama}.`;
        throw new AppError('VALIDASI', pesan, 400, { kolom: { idPenerimaan: [pesan] } });
      }
    }
    if (input.penyelesaian === 'POTONG_HUTANG' && sumber) {
      const sisa = sumber.totalFaktur - sumber.totalDibayar - sumber.totalReturPotong;
      if (sisa < total) {
        throw new AppError(
          'KONFLIK',
          `Sisa hutang ${sumber.nomor} ${formatRupiah(sisa)} kurang dari nilai retur ${formatRupiah(total)}.`,
          409,
        );
      }
    }
    const refundTunai = input.penyelesaian === 'REFUND' && input.metodeRefund === 'TUNAI';
    if (refundTunai && total > 0 && !(await shiftBuka(tx, pelaku.id, true))) {
      throw new AppError(
        'KONFLIK',
        'Uang kembali tunai masuk ke laci shift Anda: buka shift dulu, atau pilih transfer.',
        409,
      );
    }

    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'RTP', tanggal);
    const catatan =
      input.penyelesaian === 'REFUND' && input.metodeRefund === 'TRANSFER'
        ? [
            `Uang kembali lewat transfer${input.referensi ? ` (ref. ${input.referensi})` : ''}`,
            input.catatan,
          ]
            .filter(Boolean)
            .join('. ')
            .slice(0, 255)
        : (input.catatan ?? null);
    const idRetur = await repo.tambahHeader(tx, {
      nomor,
      tanggalOperasional: tanggal,
      idPemasok: pms.id,
      idPenerimaan: input.idPenerimaan,
      idPengguna: pelaku.id,
      alasan: input.alasan,
      penyelesaian: input.penyelesaian,
      totalRetur: total,
      catatan,
    });
    for (const b of baris) {
      const idDetail = await repo.tambahDetail(tx, {
        idReturPemasok: idRetur,
        idBarang: b.idBarang,
        kondisiAsal: b.kondisiAsal,
        qtyDasar: b.qty,
        hppSatuan: b.hpp,
        subtotal: b.subtotal,
        keterangan: b.keterangan ?? null,
      });
      // RP2/RP3: keluar dari bucket kondisi asal; bucket BAIK tunduk pada A6 (stok dipesan).
      await catatMutasi(tx, {
        idBarang: b.idBarang,
        jenis: 'RETUR_PEMASOK',
        kondisi: b.kondisiAsal,
        qtyKeluar: b.qty,
        hppSatuan: b.hpp,
        sumber: { idReturPemasokDetail: idDetail },
        idPengguna: pelaku.id,
        tanggalOperasional: tanggal,
        keterangan: `Retur ke ${pms.nama} (${nomor})`,
      });
    }

    const waktu = sekarang();
    if (input.penyelesaian === 'POTONG_HUTANG' && sumber) {
      const potong = sumber.totalReturPotong + total;
      await hutangRepo.aturHutangPenerimaan(
        tx,
        sumber.id,
        {
          totalReturPotong: potong,
          statusHutang: statusHutangDari(sumber.totalFaktur - sumber.totalDibayar - potong, true),
        },
        waktu,
      );
    } else if (input.penyelesaian === 'GANTI_BARANG') {
      // RP5: barang pengganti diterima sebagai pembelian tunai seharga HPP yang diretur, dibayar
      // kompensasi; bukan pembelian baru sehingga harga beli terakhir tidak berubah (H5).
      const nomorRcv = await terbitkanNomor(tx, 'RCV', tanggal);
      const idRcv = await penerimaanRepo.tambahHeader(tx, {
        nomor: nomorRcv,
        tanggalOperasional: tanggal,
        idPemasok: pms.id,
        idPengguna: pelaku.id,
        jenis: 'PEMBELIAN',
        syaratBayar: 'TUNAI',
        catatan: `Barang pengganti retur ${nomor}`,
        totalFaktur: total,
        totalDibayar: total,
        statusHutang: 'LUNAS',
      });
      for (const b of baris) {
        const idDetail = await penerimaanRepo.tambahDetail(tx, {
          idPenerimaan: idRcv,
          idBarang: b.idBarang,
          qtyMasuk: b.qty,
          qtyDasar: b.qty,
          hargaModalMasuk: b.hpp,
          hargaModalDasar: b.hpp,
          subtotal: b.subtotal,
          keterangan: `Pengganti ${nomor}`,
        });
        await catatMutasi(tx, {
          idBarang: b.idBarang,
          jenis: 'PENERIMAAN',
          qtyMasuk: b.qty,
          hppSatuan: b.hpp,
          pembelian: false,
          sumber: { idPenerimaanDetail: idDetail },
          idPengguna: pelaku.id,
          tanggalOperasional: tanggal,
          keterangan: `Pengganti retur ${nomor} dari ${pms.nama} (${nomorRcv})`,
        });
      }
      if (total > 0) {
        await penerimaanRepo.tambahPembayaran(tx, {
          nomor: await terbitkanNomor(tx, 'PBP', tanggal),
          tanggalOperasional: tanggal,
          idPemasok: pms.id,
          idPenerimaan: idRcv,
          idPengguna: pelaku.id,
          nominal: total,
          metode: 'KOMPENSASI',
          idReturPemasok: idRetur,
          catatan: `Kompensasi retur ${nomor}`,
        });
      }
    } else if (refundTunai && total > 0) {
      // RP6: uang dari pemasok masuk laci shift pencatat.
      await catatKas(tx, {
        jenis: 'MASUK_LAIN',
        nominal: total,
        pelaku,
        keterangan: `Refund ${nomor} dari ${pms.nama}`,
      });
    }

    await catatLog(tx, {
      aksi: 'RETUR_PEMASOK_SIMPAN',
      idPengguna: pelaku.id,
      entitas: 'retur_pemasok',
      idEntitas: idRetur,
      nomorDokumen: nomor,
      ringkasan:
        `Retur ${nomor} ke ${pms.nama}: ${baris.length} barang, ${formatRupiah(total)}, ` +
        input.penyelesaian.toLowerCase().replaceAll('_', ' ') +
        (sumber ? ` (${sumber.nomor})` : ''),
      ip: asal.ip,
    });
    return idRetur;
  });
  return detailReturPemasok(id, peringatan);
}
