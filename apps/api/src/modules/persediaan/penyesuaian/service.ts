import {
  bandingQty,
  keQty,
  kurangQty,
  type KondisiStok,
  type BarisDaftarPenyesuaian,
  type DataPenyesuaian,
  type DetailPenyesuaian,
  type MetaHalaman,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatBaris } from '../../../lib/errors';
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
 * SELESAI menulis mutasi lewat ledger dalam satu transaksi, BATAL tidak berefek. MUSNAH mengeluarkan
 * barang dari bucket RUSAK (A5, SR3; Fase 10).
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
        dikecualikan: r.dikecualikan,
        alasanKecuali: r.alasanKecuali,
        namaPenggunaKecuali: r.namaPenggunaKecuali,
        waktuKecuali: r.waktuKecuali?.toISOString() ?? null,
      };
    }),
  };
}

type BarisLama = Awaited<ReturnType<typeof repo.barisTersimpan>>[number];

/**
 * Baris input → baris detail tersimpan (A2, A4, A5); validasi barang ada (dan aktif untuk saldo awal).
 * K-069: pengecualian opname mencatat siapa & kapan; bila alasan tidak berubah, pencatat awal dipertahankan.
 */
async function siapkanDetail(
  tx: Tx,
  input: DataPenyesuaian,
  pelaku: PenggunaAktif,
  lama: Map<number, BarisLama> = new Map(),
) {
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
    const sebelum = lama.get(b.idBarang);
    const tetap =
      sebelum?.dikecualikan &&
      sebelum.alasanKecuali === b.alasanKecuali &&
      sebelum.idPenggunaKecuali !== null;
    const kecuali = b.dikecualikan
      ? {
          dikecualikan: true,
          alasanKecuali: b.alasanKecuali ?? null,
          idPenggunaKecuali: tetap ? sebelum.idPenggunaKecuali : pelaku.id,
          waktuKecuali: tetap ? sebelum.waktuKecuali : sekarang(),
        }
      : { dikecualikan: false, alasanKecuali: null, idPenggunaKecuali: null, waktuKecuali: null };
    const kondisi: KondisiStok = input.jenis === 'MUSNAH' ? 'RUSAK' : 'BAIK';
    const dasar = {
      idBarang: b.idBarang,
      kondisi,
      keterangan: b.keterangan ?? null,
      ...kecuali,
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
          qtyFisik: b.qtyFisik === null || b.dikecualikan ? null : keQty(b.qtyFisik),
          qtySelisih: '0',
        };
      case 'KOREKSI':
        return { ...dasar, qtyFisik: null, qtySelisih: keQty(b.qtySelisih ?? '0') };
      case 'RUSAK':
      case 'MUSNAH':
        // Disimpan negatif: keluar dari bucket asal (RUSAK: dari BAIK; MUSNAH: dari RUSAK).
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
    const detail = await siapkanDetail(tx, input, pelaku);
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
    const lama = new Map((await repo.barisTersimpan(tx, id)).map((b) => [b.idBarang, b]));
    const baru = new Map(input.baris.map((b) => [b.idBarang, b]));
    const perubahanOpname: string[] = [];
    if (h.jenis === 'OPNAME') {
      // K-069: barang yang sudah ada di lembar opname tidak boleh hilang tanpa jejak.
      const hilang = [...lama.values()].filter((b) => !baru.has(b.idBarang));
      if (hilang.length > 0) {
        throw new AppError(
          'VALIDASI',
          `Barang di lembar opname tidak bisa dihapus: ${hilang
            .slice(0, 5)
            .map((b) => b.namaBarang)
            .join(', ')}${hilang.length > 5 ? ', …' : ''}. Kecualikan dengan alasan.`,
          400,
        );
      }
      for (const [idBarang, b] of baru) {
        const l = lama.get(idBarang);
        if (b.dikecualikan && (!l?.dikecualikan || l.alasanKecuali !== b.alasanKecuali)) {
          perubahanOpname.push(
            `kecualikan ${l?.namaBarang ?? `#${idBarang}`} (${b.alasanKecuali})`,
          );
        } else if (!b.dikecualikan && l?.dikecualikan) {
          perubahanOpname.push(`sertakan lagi ${l.namaBarang}`);
        }
      }
    }
    const detail = await siapkanDetail(tx, input, pelaku, lama);
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
      ringkasan: `Mengubah draf ${h.nomor}: ${detail.length} barang${
        perubahanOpname.length > 0 ? `; ${perubahanOpname.join('; ')}` : ''
      }`.slice(0, 1000),
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
    if (h.jenis === 'MUSNAH' && !h.alasan) {
      throw new AppError('VALIDASI', 'Alasan pemusnahan wajib diisi sebelum diselesaikan.', 400);
    }
    const belumDihitung = baris.filter(
      (b) => h.jenis === 'OPNAME' && !b.dikecualikan && b.qtyFisik === null,
    );
    if (belumDihitung.length > 0) {
      throw new AppError(
        'VALIDASI',
        `Qty fisik belum diisi untuk ${belumDihitung.length} barang: ` +
          `${belumDihitung
            .slice(0, 5)
            .map((b) => b.namaBarang)
            .join(
              ', ',
            )}${belumDihitung.length > 5 ? ', …' : ''}. Isi hasil hitung atau kecualikan dengan alasan.`,
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
    const LABEL_KET = {
      SALDO_AWAL: 'Persediaan awal',
      RUSAK: 'Pindah ke stok rusak',
      MUSNAH: 'Pemusnahan stok rusak',
      OPNAME: 'Stok opname',
      KOREKSI: 'Koreksi',
    } as const;
    const ket = `${LABEL_KET[h.jenis]} ${h.nomor}${h.alasan ? `: ${h.alasan}` : ''}`;
    const umum = {
      idPengguna: pelaku.id,
      tanggalOperasional: tanggal,
      keterangan: ket.slice(0, 255),
    };

    for (const b of baris) {
      const sumber = { idPenyesuaianDetail: b.id };
      // A3: stok sistem dibaca saat diselesaikan (di bawah kunci baris persediaan), bukan saat draf dibuat.
      const p = await kunciPersediaan(tx, b.idBarang);
      if (b.dikecualikan) {
        // K-069: tidak dihitung → tidak ada mutasi; stok sistem saat itu tetap dicatat.
        await repo.ubahDetail(tx, b.id, { qtySistem: p.stokFisik, qtySelisih: '0' });
        continue;
      }
      let selisih = b.qtySelisih;
      if (h.jenis === 'OPNAME') {
        selisih = kurangQty(
          kurangQty(b.qtyFisik ?? '0', p.stokFisik),
          belum.get(b.idBarang) ?? '0',
        );
        // K-240: selisih opname hanya dikoreksi Kepala Toko/Owner, dengan sebab per barang.
        if (bandingQty(selisih, 0) !== 0) {
          if (!pelaku.izin.has('persediaan.opname.atur')) {
            throw new AppError(
              'TIDAK_BERIZIN',
              `${b.namaBarang} berselisih dengan stok sistem. Simpan draf; opname yang berselisih diselesaikan ` +
                'Kepala Toko/Owner setelah diperiksa.',
              403,
            );
          }
          if (!b.keterangan || b.keterangan.trim().length < 3) {
            throw new AppError(
              'VALIDASI',
              `${b.namaBarang} berselisih ${selisih}: isi keterangan sebabnya (mis. salah serah, rusak, ` +
                'salah input, hilang, belum tercatat) atau hitung ulang.',
              400,
            );
          }
        }
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
      } else if (h.jenis === 'MUSNAH') {
        await catatMutasi(tx, {
          ...umum,
          idBarang: b.idBarang,
          jenis: 'MUSNAH',
          kondisi: 'RUSAK',
          qtyKeluar: kurangQty(0, b.qtySelisih),
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
        qtySistem: h.jenis === 'MUSNAH' ? p.stokRusak : p.stokFisik,
        qtySelisih: selisih,
        hppSatuan: hpp,
      });
    }

    let ringkasOpname = '';
    if (h.jenis === 'OPNAME') {
      const kecuali = baris.filter((b) => b.dikecualikan);
      const diLuar = await repo.jumlahBarangAktifDiLuar(tx, id);
      ringkasOpname =
        `; dihitung ${baris.length - kecuali.length}, dikecualikan ${kecuali.length}` +
        (kecuali.length > 0
          ? ` (${kecuali.map((b) => `${b.namaBarang}: ${b.alasanKecuali}`).join('; ')})`
          : '') +
        `; barang aktif di luar dokumen ${diLuar}`;
    }
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, { status: 'SELESAI', waktuSelesai: waktu, diubahPada: waktu });
    await catatLog(tx, {
      aksi: 'PENYESUAIAN_SELESAI',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan:
        `Menyelesaikan ${h.nomor} (${h.jenis.toLowerCase()}): ${baris.length} barang${ringkasOpname}`.slice(
          0,
          1000,
        ),
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
        dikecualikan: false,
        alasanKecuali: null,
      })),
    },
    pelaku,
    asal,
  );
}
