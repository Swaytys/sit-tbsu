import {
  bandingQty,
  keQty,
  kurangQty,
  type BarisDaftarPenyesuaian,
  type DataPenyesuaian,
  type DetailPenyesuaian,
  type MetaHalaman,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { catatMutasi, kunciPersediaan } from '../ledger';
import * as repo from './repo';

/*
 * Penyesuaian stok (docs/05 §12, A1–A7): dokumen ADJ dibuat DRAFT, baris boleh diubah selama DRAFT,
 * SELESAI menulis mutasi lewat ledger dalam satu transaksi, BATAL tidak berefek. MUSNAH = M2.
 */

type Header = NonNullable<Awaited<ReturnType<typeof repo.penyesuaianById>>>;

function keRespons(h: Header): BarisDaftarPenyesuaian {
  return {
    id: h.id,
    nomor: h.nomor,
    tanggal: h.tanggal.toISOString(),
    jenis: h.jenis,
    status: h.status,
    alasan: h.alasan,
    jumlahBaris: h.jumlahBaris,
    namaPengguna: h.namaPengguna,
    waktuSelesai: h.waktuSelesai?.toISOString() ?? null,
  };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Penyesuaian tidak ditemukan.', 404);
}

export async function daftarPenyesuaian(
  p: repo.SaringPenyesuaian & { halaman: number; perHalaman: number },
): Promise<{ data: BarisDaftarPenyesuaian[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPenyesuaian(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

export async function detailPenyesuaian(id: number): Promise<DetailPenyesuaian> {
  const h = await repo.penyesuaianById(db, id);
  if (!h) throw tidakDitemukan();
  const rows = await repo.detailPenyesuaian(db, id);
  const draf = h.status === 'DRAFT';
  const belum =
    draf && h.jenis === 'OPNAME'
      ? await repo.qtyBelumDiambil(
          db,
          rows.map((r) => r.idBarang),
        )
      : new Map<number, string>();
  return {
    ...keRespons(h),
    catatan: h.catatan,
    baris: rows.map((r) => {
      const sistem = draf
        ? r.kondisi === 'BAIK'
          ? r.stokFisikKini
          : r.stokRusakKini
        : r.qtySistem;
      // SELESAI: belum diambil = fisik − sistem − selisih (A3).
      const belumDiambil = draf
        ? (belum.get(r.idBarang) ?? '0.000')
        : h.jenis === 'OPNAME' && r.qtyFisik !== null
          ? kurangQty(kurangQty(r.qtyFisik, r.qtySistem), r.qtySelisih)
          : '0.000';
      return {
        id: r.id,
        idBarang: r.idBarang,
        kodeBarang: r.kodeBarang,
        namaBarang: r.namaBarang,
        namaKategori: r.namaKategori,
        kodeSatuan: r.kodeSatuan,
        kondisi: r.kondisi,
        qtySistem: sistem,
        qtyBelumDiambil: belumDiambil,
        qtyFisik: r.qtyFisik,
        qtySelisih: r.qtySelisih,
        hppSatuan: r.hppSatuan,
        keterangan: r.keterangan,
      };
    }),
  };
}

function galatBaris(i: number, kolom: string, pesan: string): AppError {
  return new AppError('VALIDASI', `Baris ${i + 1}: ${pesan}`, 400, {
    kolom: { [`baris.${i}.${kolom}`]: [pesan] },
  });
}

/** Baris input → baris detail tersimpan (A2, A4, A5); validasi barang ada (dan aktif untuk saldo awal). */
async function siapkanDetail(tx: Tx, input: DataPenyesuaian) {
  const perBarang = new Map(
    (
      await repo.barangUntukPenyesuaian(
        tx,
        input.baris.map((b) => b.idBarang),
      )
    ).map((b) => [b.id, b]),
  );
  return input.baris.map((b, i) => {
    const brg = perBarang.get(b.idBarang);
    if (!brg) throw galatBaris(i, 'idBarang', 'Barang tidak ditemukan.');
    if (input.jenis === 'SALDO_AWAL' && brg.statusAktif !== 'AKTIF') {
      throw galatBaris(i, 'idBarang', `${brg.namaBarang} nonaktif.`);
    }
    const dasar = {
      idBarang: b.idBarang,
      kondisi: 'BAIK' as const,
      keterangan: b.keterangan ?? null,
    };
    switch (input.jenis) {
      case 'SALDO_AWAL': {
        const qty = keQty(b.qtyFisik ?? '0');
        // Barang konsinyasi bernilai harga titip (L7).
        const hpp = brg.kepemilikan === 'KONSINYASI' ? (brg.hargaTitip ?? 0) : (b.hppSatuan ?? 0);
        return { ...dasar, qtyFisik: qty, qtySelisih: qty, hppSatuan: hpp };
      }
      case 'OPNAME':
        return {
          ...dasar,
          qtyFisik: b.qtyFisik === null ? null : keQty(b.qtyFisik),
          qtySelisih: '0',
        };
      case 'KOREKSI':
        return { ...dasar, qtyFisik: null, qtySelisih: keQty(b.qtySelisih ?? '0') };
      case 'RUSAK':
        // Disimpan negatif: keluar dari bucket asal BAIK (docs/03 penyesuaian_stok_detail).
        return { ...dasar, qtyFisik: null, qtySelisih: kurangQty(0, b.qtySelisih ?? '0') };
    }
  });
}

export async function buatPenyesuaian(
  input: DataPenyesuaian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  const id = await dalamTransaksi(async (tx) => {
    const detail = await siapkanDetail(tx, input);
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'ADJ', tanggal);
    const idBaru = await repo.tambahHeader(tx, {
      nomor,
      tanggalOperasional: tanggal,
      jenis: input.jenis,
      idPengguna: pelaku.id,
      alasan: input.alasan ?? null,
      catatan: input.catatan ?? null,
    });
    await repo.gantiDetail(tx, idBaru, detail);
    await catatLog(tx, {
      aksi: 'PENYESUAIAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: idBaru,
      nomorDokumen: nomor,
      ringkasan: `Draf penyesuaian ${input.jenis.toLowerCase()} ${nomor}: ${detail.length} barang`,
      ip: asal.ip,
    });
    return idBaru;
  });
  return detailPenyesuaian(id);
}

async function kunciDraf(tx: Tx, id: number) {
  const h = await repo.kunciPenyesuaian(tx, id);
  if (!h) throw tidakDitemukan();
  if (h.status !== 'DRAFT') {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Penyesuaian ${h.nomor} sudah ${h.status === 'SELESAI' ? 'selesai' : 'dibatalkan'}; tidak bisa diubah.`,
      409,
    );
  }
  return h;
}

/** A1: ubah draf (jenis tetap). */
export async function ubahPenyesuaian(
  id: number,
  input: DataPenyesuaian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDraf(tx, id);
    if (h.jenis !== input.jenis) {
      throw new AppError(
        'VALIDASI',
        'Jenis penyesuaian tidak bisa diubah; buat dokumen baru.',
        400,
      );
    }
    const detail = await siapkanDetail(tx, input);
    await repo.ubahHeader(tx, id, {
      alasan: input.alasan ?? null,
      catatan: input.catatan ?? null,
      diubahPada: sekarang(),
    });
    await repo.gantiDetail(tx, id, detail);
    await catatLog(tx, {
      aksi: 'PENYESUAIAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Mengubah draf ${h.nomor}: ${detail.length} barang`,
      ip: asal.ip,
    });
  });
  return detailPenyesuaian(id);
}

/** A2–A7: menyelesaikan draf → mutasi ledger per baris, dalam satu transaksi. */
export async function selesaikanPenyesuaian(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDraf(tx, id);
    const baris = await repo.detailUntukSelesai(tx, id);
    if (baris.length === 0) {
      throw new AppError('VALIDASI', `Penyesuaian ${h.nomor} belum berisi barang.`, 400);
    }
    if (h.jenis === 'KOREKSI' && !h.alasan) {
      throw new AppError('VALIDASI', 'Alasan koreksi wajib diisi sebelum diselesaikan.', 400);
    }
    if (h.jenis === 'MUSNAH') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Pemusnahan stok rusak tersedia di versi berikutnya.',
        409,
      );
    }
    const belumDihitung = baris.filter((b) => h.jenis === 'OPNAME' && b.qtyFisik === null);
    if (belumDihitung.length > 0) {
      throw new AppError(
        'VALIDASI',
        `Qty fisik belum diisi untuk ${belumDihitung.length} barang: ` +
          `${belumDihitung
            .slice(0, 5)
            .map((b) => b.namaBarang)
            .join(', ')}${belumDihitung.length > 5 ? ', …' : ''}. Isi atau hapus barisnya.`,
        400,
      );
    }

    const tanggal = tanggalOperasional();
    const belum =
      h.jenis === 'OPNAME'
        ? await repo.qtyBelumDiambil(
            tx,
            baris.map((b) => b.idBarang),
          )
        : new Map<number, string>();
    const ket = `${h.jenis === 'SALDO_AWAL' ? 'Saldo awal' : h.jenis === 'RUSAK' ? 'Pindah ke stok rusak' : h.jenis === 'OPNAME' ? 'Stok opname' : 'Koreksi'} ${h.nomor}${h.alasan ? `: ${h.alasan}` : ''}`;
    const umum = {
      idPengguna: pelaku.id,
      tanggalOperasional: tanggal,
      keterangan: ket.slice(0, 255),
    };

    for (const b of baris) {
      const sumber = { idPenyesuaianDetail: b.id };
      // A3: stok sistem dibaca saat diselesaikan (di bawah kunci baris persediaan), bukan saat draf dibuat.
      const p = await kunciPersediaan(tx, b.idBarang);
      let selisih = b.qtySelisih;
      if (h.jenis === 'OPNAME') {
        selisih = kurangQty(
          kurangQty(b.qtyFisik ?? '0', p.stokFisik),
          belum.get(b.idBarang) ?? '0',
        );
      }
      let hpp = p.hppRata2;
      if (h.jenis === 'SALDO_AWAL') {
        hpp = (
          await catatMutasi(tx, {
            ...umum,
            idBarang: b.idBarang,
            jenis: 'SALDO_AWAL',
            qtyMasuk: b.qtySelisih,
            hppSatuan: b.hppSatuan,
            sumber,
          })
        ).hppSatuan;
      } else if (h.jenis === 'RUSAK') {
        const qty = kurangQty(0, b.qtySelisih);
        await catatMutasi(tx, {
          ...umum,
          idBarang: b.idBarang,
          jenis: 'PINDAH_KONDISI',
          qtyKeluar: qty,
          sumber,
        });
        await catatMutasi(tx, {
          ...umum,
          idBarang: b.idBarang,
          jenis: 'PINDAH_KONDISI',
          kondisi: 'RUSAK',
          qtyMasuk: qty,
          sumber,
        });
      } else if (bandingQty(selisih, 0) !== 0) {
        const arah =
          bandingQty(selisih, 0) > 0 ? { qtyMasuk: selisih } : { qtyKeluar: kurangQty(0, selisih) };
        await catatMutasi(tx, {
          ...umum,
          ...arah,
          idBarang: b.idBarang,
          jenis: 'PENYESUAIAN',
          sumber,
        });
      }
      await repo.ubahDetail(tx, b.id, {
        qtySistem: p.stokFisik,
        qtySelisih: selisih,
        hppSatuan: hpp,
      });
    }

    const waktu = sekarang();
    await repo.ubahHeader(tx, id, { status: 'SELESAI', waktuSelesai: waktu, diubahPada: waktu });
    await catatLog(tx, {
      aksi: 'PENYESUAIAN_SELESAI',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Menyelesaikan ${h.nomor} (${h.jenis.toLowerCase()}): ${baris.length} barang`,
      ip: asal.ip,
    });
  });
  return detailPenyesuaian(id);
}

export async function batalkanPenyesuaian(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDraf(tx, id);
    await repo.ubahHeader(tx, id, { status: 'BATAL', diubahPada: sekarang() });
    await catatLog(tx, {
      aksi: 'PENYESUAIAN_BATAL',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Membatalkan draf ${h.nomor}`,
      ip: asal.ip,
    });
  });
  return detailPenyesuaian(id);
}

/** Draf OPNAME berisi semua barang aktif (atau satu kategori) dengan qty fisik kosong, untuk dicetak. */
export async function buatLembarOpname(
  p: { idKategori: number | null; catatan?: string | null | undefined },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  const daftar = await repo.barangAktifUntukOpname(db, p.idKategori);
  if (daftar.length === 0)
    throw new AppError('VALIDASI', 'Tidak ada barang aktif untuk dihitung.', 400);
  return buatPenyesuaian(
    {
      jenis: 'OPNAME',
      alasan: null,
      catatan: p.catatan ?? null,
      baris: daftar.map((b) => ({
        idBarang: b.id,
        qtyFisik: null,
        qtySelisih: null,
        hppSatuan: null,
        keterangan: null,
      })),
    },
    pelaku,
    asal,
  );
}
