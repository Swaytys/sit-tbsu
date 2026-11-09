import {
  bandingQty,
  formatRupiah,
  keQty,
  kurangQty,
  LABEL_SEBAB_SELISIH,
  type KelasABC,
  type KondisiStok,
  type BarisDaftarPenyesuaian,
  type DataPenyesuaian,
  type DetailPenyesuaian,
  type MetaHalaman,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { AppError, galatBaris } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { catatMutasi, kunciPersediaan } from '../ledger';
import {
  hitunganDokumen,
  keRespons as hitunganKeRespons,
  nilaiBaris,
  nilaiHitungan,
  nilaiSelisih,
  tambahHitungan,
  type Hitungan,
  type HitunganBernilai,
} from '../opname/hitung';
import { kelasBarang } from '../opname/peta';
import * as repo from './repo';

/*
 * Penyesuaian stok (docs/05 §12, A1–A7): dokumen ADJ dibuat DRAFT, baris boleh diubah selama DRAFT,
 * SELESAI menulis mutasi lewat ledger dalam satu transaksi, BATAL tidak berefek. MUSNAH mengeluarkan
 * barang dari bucket RUSAK (A5, SR3; Fase 10).
 *
 * K-227 (OPNAME): setiap hasil hitung tercatat atas nama pengisinya (`opname_hitung`); selisih dihitung terhadap stok
 * sistem pada waktu hitung; hitung buta ditegakkan di API; selisih di atas toleransi wajib dikonfirmasi hitungan
 * orang lain; penghitung tidak menyetujui selisih yang ikut ia hitung (kecuali Owner, tercatat).
 */

type Header = NonNullable<Awaited<ReturnType<typeof repo.penyesuaianById>>>;

const ATUR = 'persediaan.opname.atur';
const HITUNG = 'persediaan.opname.hitung';

/** Toleransi nilai selisih opname tanpa hitung ulang (K-227); bawaan Rp 0 = semua selisih dihitung ulang. */
export function toleransiOpname(ex: Executor = db): Promise<number> {
  return ambilAngka('opname_toleransi_rp', 0, ex);
}

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

/**
 * K-227: draf opname yang ditugaskan ke orang lain tidak terlihat oleh penghitung lain (daftar acak tidak bocor
 * sebelum diberikan). Pengatur opname melihat semuanya.
 */
export function pastikanBolehLihatOpname(
  h: { jenis: string; status: string; idPenghitung: number | null; namaPenghitung?: string | null },
  pelaku: PenggunaAktif,
): void {
  if (
    h.jenis === 'OPNAME' &&
    h.status === 'DRAFT' &&
    h.idPenghitung !== null &&
    h.idPenghitung !== pelaku.id &&
    !pelaku.izin.has(ATUR)
  ) {
    throw new AppError(
      'TIDAK_BERIZIN',
      `Daftar hitung ini ditugaskan ke ${h.namaPenghitung ?? 'penghitung lain'}.`,
      403,
    );
  }
}

export async function daftarPenyesuaian(
  p: repo.SaringPenyesuaian & { halaman: number; perHalaman: number },
  pelaku?: PenggunaAktif,
): Promise<{ data: BarisDaftarPenyesuaian[]; meta: MetaHalaman }> {
  const saring = {
    ...p,
    ...(pelaku && !pelaku.izin.has(ATUR) ? { sembunyikanTugasLainDari: pelaku.id } : {}),
  };
  const { baris, total } = await repo.daftarPenyesuaian(db, { ...saring, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

export async function detailPenyesuaian(
  id: number,
  pelaku?: PenggunaAktif,
): Promise<DetailPenyesuaian> {
  const h = await repo.penyesuaianById(db, id);
  if (!h) throw tidakDitemukan();
  if (pelaku) pastikanBolehLihatOpname(h, pelaku);
  const rows = await repo.detailPenyesuaian(db, id);
  const draf = h.status === 'DRAFT';
  const opname = h.jenis === 'OPNAME';
  // Hitung buta (K-240/K-227): selama draf, tanpa izin mengatur opname tidak ada stok sistem, selisih, atau hitungan
  // orang lain yang dikirim.
  const buta = opname && draf && !!pelaku && !pelaku.izin.has(ATUR);
  const belum =
    draf && opname
      ? await repo.qtyBelumDiambil(
          db,
          rows.map((r) => r.idBarang),
        )
      : new Map<number, string>();
  const stokKini = new Map(rows.map((r) => [r.idBarang, r.stokFisikKini]));
  const hitungan = opname ? await hitunganDokumen(db, id) : new Map<number, Hitungan[]>();
  const bernilai = opname
    ? await nilaiHitungan(db, hitungan, (b) => stokKini.get(b) ?? '0')
    : new Map<number, HitunganBernilai[]>();
  const kelas = opname && !buta ? await kelasBarang() : new Map<number, KelasABC>();
  const toleransiRp = opname ? await toleransiOpname() : 0;

  return {
    ...keRespons(h),
    catatan: h.catatan,
    penghitung: h.idPenghitung ? { id: h.idPenghitung, nama: h.namaPenghitung ?? '' } : null,
    waktuMulaiHitung: h.waktuMulaiHitung?.toISOString() ?? null,
    hitungButa: buta,
    toleransiRp,
    baris: rows.map((r) => {
      const hit = bernilai.get(r.idBarang) ?? [];
      const nilai = nilaiBaris({
        hitungan: hit,
        hpp: r.hppKini,
        kelas: kelas.get(r.idBarang) ?? 'C',
        toleransiRp,
      });
      const akhir = nilai.akhir;
      const dasar = {
        id: r.id,
        idBarang: r.idBarang,
        kodeBarang: r.kodeBarang,
        namaBarang: r.namaBarang,
        namaKategori: r.namaKategori,
        kodeSatuan: r.kodeSatuan,
        kondisi: r.kondisi,
        hppSatuan: r.hppSatuan,
        keterangan: r.keterangan,
        dikecualikan: r.dikecualikan,
        alasanKecuali: r.alasanKecuali,
        namaPenggunaKecuali: r.namaPenggunaKecuali,
        waktuKecuali: r.waktuKecuali?.toISOString() ?? null,
        sebabSelisih: r.sebabSelisih,
      };
      if (buta && pelaku) {
        const milikSaya = hit.filter((x) => x.idPenghitung === pelaku.id);
        const sudahSaya = milikSaya.length > 0;
        return {
          ...dasar,
          qtySistem: '0.000',
          qtyBelumDiambil: '0.000',
          qtyFisik: milikSaya.at(-1)?.qty ?? null,
          qtySelisih: '0.000',
          hitungan: milikSaya.map((x) => hitunganKeRespons(x, false)),
          dihitungOrangLain: hit.some((x) => x.idPenghitung !== pelaku.id),
          waktuHitung: milikSaya.at(-1)?.waktu.toISOString() ?? null,
          // Tanda hanya untuk barang yang belum ia hitung: tidak menjadi petunjuk stok sistem bagi penghitungnya.
          perluHitungUlang: nilai.perluHitungUlang && !nilai.terkonfirmasi && !sudahSaya,
          terkonfirmasi: false,
          kelas: null,
        };
      }
      const sistem = draf
        ? r.kondisi === 'BAIK'
          ? (akhir?.sistem ?? r.stokFisikKini)
          : r.stokRusakKini
        : r.qtySistem;
      // SELESAI: belum diambil = fisik − sistem − selisih (A3).
      const belumDiambil = draf
        ? (akhir?.belum ?? belum.get(r.idBarang) ?? '0.000')
        : opname && r.qtyFisik !== null
          ? kurangQty(kurangQty(r.qtyFisik, r.qtySistem), r.qtySelisih)
          : '0.000';
      return {
        ...dasar,
        qtySistem: sistem,
        qtyBelumDiambil: belumDiambil,
        qtyFisik: r.qtyFisik,
        qtySelisih: r.qtySelisih,
        hitungan: hit.map((x) => hitunganKeRespons(x, true)),
        dihitungOrangLain: false,
        waktuHitung: akhir?.waktu.toISOString() ?? null,
        perluHitungUlang: nilai.perluHitungUlang,
        terkonfirmasi: nilai.terkonfirmasi,
        kelas: opname ? (kelas.get(r.idBarang) ?? null) : null,
      };
    }),
  };
}

type BarisLama = Awaited<ReturnType<typeof repo.barisTersimpan>>[number];

/**
 * Baris input → baris detail tersimpan (A2, A4, A5); validasi barang ada (dan aktif untuk saldo awal).
 * K-069: pengecualian opname mencatat siapa & kapan; bila alasan tidak berubah, pencatat awal dipertahankan.
 * K-227 (OPNAME): qty fisik = hitungan terakhir (`hitungBaru` atau yang sudah tercatat); isian kosong tidak menghapus
 * hitungan. Sebab selisih hanya diubah pengatur opname.
 */
async function siapkanDetail(
  tx: Tx,
  input: DataPenyesuaian,
  pelaku: PenggunaAktif,
  lama: Map<number, BarisLama> = new Map(),
  opname: { hitungBaru: Map<number, string>; terakhir: Map<number, string> } = {
    hitungBaru: new Map(),
    terakhir: new Map(),
  },
) {
  const perBarang = new Map(
    (
      await repo.barangUntukPenyesuaian(
        tx,
        input.baris.map((b) => b.idBarang),
      )
    ).map((b) => [b.id, b]),
  );
  const bolehSebab = pelaku.izin.has(ATUR);
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
      case 'OPNAME': {
        const akhir = opname.hitungBaru.get(b.idBarang) ?? opname.terakhir.get(b.idBarang) ?? null;
        return {
          ...dasar,
          qtyFisik: b.dikecualikan ? null : akhir,
          qtySelisih: '0',
          sebabSelisih: bolehSebab ? (b.sebabSelisih ?? null) : (sebelum?.sebabSelisih ?? null),
        };
      }
      case 'KOREKSI':
        return { ...dasar, qtyFisik: null, qtySelisih: keQty(b.qtySelisih ?? '0') };
      case 'RUSAK':
      case 'MUSNAH':
        // Disimpan negatif: keluar dari bucket asal (RUSAK: dari BAIK; MUSNAH: dari RUSAK).
        return { ...dasar, qtyFisik: null, qtySelisih: kurangQty(0, b.qtySelisih ?? '0') };
    }
  });
}

/**
 * K-227: isian qty fisik di form opname yang berbeda dari yang ditampilkan ke pengisi menjadi hitungan baru atas
 * namanya. Pengatur opname melihat hitungan terakhir; penghitung (hitung buta) hanya hitungannya sendiri.
 */
async function hitunganDariForm(
  tx: Tx,
  idPenyesuaian: number | null,
  input: DataPenyesuaian,
  pelaku: PenggunaAktif,
): Promise<{ hitungBaru: Map<number, string>; terakhir: Map<number, string> }> {
  const ada =
    idPenyesuaian === null
      ? new Map<number, Hitungan[]>()
      : await hitunganDokumen(tx, idPenyesuaian);
  const buta = !pelaku.izin.has(ATUR);
  const hitungBaru = new Map<number, string>();
  const terakhir = new Map<number, string>();
  for (const b of input.baris) {
    const daftar: Hitungan[] = ada.get(b.idBarang) ?? [];
    const akhir = daftar.at(-1);
    if (akhir) terakhir.set(b.idBarang, akhir.qty);
    if (b.dikecualikan || b.qtyFisik === null) continue;
    const tampil = buta ? daftar.filter((h) => h.idPenghitung === pelaku.id).at(-1) : akhir;
    if (!tampil || bandingQty(tampil.qty, b.qtyFisik) !== 0)
      hitungBaru.set(b.idBarang, keQty(b.qtyFisik));
  }
  if (hitungBaru.size > 0 && !pelaku.izin.has(HITUNG)) {
    throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin mengisi hasil hitung opname.', 403);
  }
  return { hitungBaru, terakhir };
}

async function simpanHitunganBaru(
  tx: Tx,
  idPenyesuaian: number,
  hitungBaru: Map<number, string>,
  pelaku: PenggunaAktif,
) {
  for (const [idBarang, qty] of hitungBaru) {
    await tambahHitungan(tx, {
      idPenyesuaian,
      idBarang,
      idPenghitung: pelaku.id,
      qty,
      cara: 'HITUNG',
      beratGram: null,
    });
  }
}

export async function buatPenyesuaian(
  input: DataPenyesuaian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  opsi: { idPenghitung?: number | null } = {},
): Promise<DetailPenyesuaian> {
  const id = await dalamTransaksi(async (tx) => {
    const opname =
      input.jenis === 'OPNAME' ? await hitunganDariForm(tx, null, input, pelaku) : undefined;
    const detail = await siapkanDetail(tx, input, pelaku, new Map(), opname);
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'ADJ', tanggal);
    const idBaru = await repo.tambahHeader(tx, {
      nomor,
      tanggalOperasional: tanggal,
      jenis: input.jenis,
      idPengguna: pelaku.id,
      alasan: input.alasan ?? null,
      catatan: input.catatan ?? null,
      idPenghitung: input.jenis === 'OPNAME' ? (opsi.idPenghitung ?? null) : null,
    });
    await repo.gantiDetail(tx, idBaru, detail);
    if (opname) await simpanHitunganBaru(tx, idBaru, opname.hitungBaru, pelaku);
    await catatLog(tx, {
      aksi: 'PENYESUAIAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: idBaru,
      nomorDokumen: nomor,
      ringkasan: `Draf penyesuaian ${input.jenis.toLowerCase()} ${nomor}: ${detail.length} barang${
        opname && opname.hitungBaru.size > 0 ? `; ${opname.hitungBaru.size} hasil hitung` : ''
      }`,
      ip: asal.ip,
    });
    return idBaru;
  });
  return detailPenyesuaian(id, pelaku);
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
    pastikanBolehLihatOpname({ ...h, namaPenghitung: null }, pelaku);
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
    const opname = h.jenis === 'OPNAME' ? await hitunganDariForm(tx, id, input, pelaku) : undefined;
    if (opname && opname.hitungBaru.size > 0) {
      perubahanOpname.push(
        `hasil hitung ${[...opname.hitungBaru]
          .slice(0, 10)
          .map(([idBarang, qty]) => `${lama.get(idBarang)?.namaBarang ?? `#${idBarang}`} ${qty}`)
          .join(', ')}${opname.hitungBaru.size > 10 ? ', …' : ''}`,
      );
    }
    const detail = await siapkanDetail(tx, input, pelaku, lama, opname);
    await repo.ubahHeader(tx, id, {
      alasan: input.alasan ?? null,
      catatan: input.catatan ?? null,
      diubahPada: sekarang(),
    });
    await repo.gantiDetail(tx, id, detail);
    if (opname) await simpanHitunganBaru(tx, id, opname.hitungBaru, pelaku);
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
  return detailPenyesuaian(id, pelaku);
}

/** A2–A7: menyelesaikan draf → mutasi ledger per baris, dalam satu transaksi. */
export async function selesaikanPenyesuaian(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDraf(tx, id);
    pastikanBolehLihatOpname({ ...h, namaPenghitung: null }, pelaku);
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
    const opname = h.jenis === 'OPNAME';
    // K-227: kunci semua baris persediaan lebih dulu (urut id barang), baru membaca keadaan saat hitung, supaya
    // transaksi lain tidak menyelip di antara pembacaan stok kini dan mutasi sesudah waktu hitung.
    const kunci = new Map<number, Awaited<ReturnType<typeof kunciPersediaan>>>();
    for (const idBarang of [...new Set(baris.map((b) => b.idBarang))].sort((a, b) => a - b)) {
      kunci.set(idBarang, await kunciPersediaan(tx, idBarang));
    }
    const belum = opname
      ? await repo.qtyBelumDiambil(
          tx,
          baris.map((b) => b.idBarang),
        )
      : new Map<number, string>();
    const hitungan = opname
      ? await nilaiHitungan(
          tx,
          await hitunganDokumen(tx, id),
          (b) => kunci.get(b)?.stokFisik ?? '0',
        )
      : new Map<number, HitunganBernilai[]>();
    const kelas = opname ? await kelasBarang() : new Map<number, KelasABC>();
    const toleransiRp = opname ? await toleransiOpname(tx) : 0;
    const pemilik = pelaku.peran === 'OWNER';
    const tanpaHitungUlang: string[] = [];
    const disetujuiPenghitung: string[] = [];

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
      const p = kunci.get(b.idBarang);
      if (!p) throw new Error(`persediaan barang ${b.idBarang} tidak terkunci`);
      if (b.dikecualikan) {
        // K-069: tidak dihitung → tidak ada mutasi; stok sistem saat itu tetap dicatat.
        await repo.ubahDetail(tx, b.id, { qtySistem: p.stokFisik, qtySelisih: '0' });
        continue;
      }
      let selisih = b.qtySelisih;
      let sistem = h.jenis === 'MUSNAH' ? p.stokRusak : p.stokFisik;
      if (opname) {
        const daftar = hitungan.get(b.idBarang) ?? [];
        const nilai = nilaiBaris({
          hitungan: daftar,
          hpp: p.hppRata2,
          kelas: kelas.get(b.idBarang) ?? 'C',
          toleransiRp,
        });
        const akhir = nilai.akhir;
        // Tanpa catatan hitung (dokumen lama): stok sistem saat diselesaikan, pembuat dianggap penghitung.
        sistem = akhir?.sistem ?? p.stokFisik;
        selisih =
          akhir?.selisih ??
          kurangQty(kurangQty(b.qtyFisik ?? '0', p.stokFisik), belum.get(b.idBarang) ?? '0');
        const penghitung = akhir ? nilai.penghitung : new Set([h.idPengguna]);
        // K-240/K-227: selisih opname hanya dikoreksi Kepala Toko/Owner, dengan sebab baku per barang.
        if (bandingQty(selisih, 0) !== 0) {
          if (!pelaku.izin.has(ATUR)) {
            throw new AppError(
              'TIDAK_BERIZIN',
              `${b.namaBarang} berselisih dengan stok sistem. Simpan draf; opname yang berselisih diselesaikan ` +
                'Kepala Toko/Owner setelah diperiksa.',
              403,
            );
          }
          if (!b.sebabSelisih) {
            throw new AppError(
              'VALIDASI',
              `${b.namaBarang} berselisih ${selisih}: pilih sebabnya (salah serah, rusak, salah input, hilang, ` +
                'belum tercatat, …) atau hitung ulang.',
              400,
            );
          }
          if (b.sebabSelisih === 'LAINNYA' && (!b.keterangan || b.keterangan.trim().length < 3)) {
            throw new AppError(
              'VALIDASI',
              `${b.namaBarang}: sebab "Lainnya" wajib dijelaskan di keterangan.`,
              400,
            );
          }
          if (nilai.perluHitungUlang && !nilai.terkonfirmasi) {
            if (!pemilik) {
              throw new AppError(
                'VALIDASI',
                `${b.namaBarang} berselisih ${selisih} (${formatRupiah(nilaiSelisih(selisih, p.hppRata2))}): ` +
                  'wajib dihitung ulang oleh orang lain sampai dua hitungan sama. Tugaskan hitung ulang ke ' +
                  'penghitung lain.',
                400,
              );
            }
            tanpaHitungUlang.push(b.namaBarang);
          }
          if (penghitung.has(pelaku.id)) {
            if (!pemilik) {
              throw new AppError(
                'TIDAK_BERIZIN',
                `Anda ikut menghitung ${b.namaBarang}; selisihnya harus disetujui Kepala Toko/Owner lain.`,
                403,
              );
            }
            disetujuiPenghitung.push(b.namaBarang);
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
          keterangan: (opname && b.sebabSelisih
            ? `${ket} (${LABEL_SEBAB_SELISIH[b.sebabSelisih]})`
            : ket
          ).slice(0, 255),
          idBarang: b.idBarang,
          jenis: 'PENYESUAIAN',
          sumber,
        });
      }
      await repo.ubahDetail(tx, b.id, {
        qtySistem: sistem,
        qtySelisih: selisih,
        hppSatuan: hpp,
      });
    }

    let ringkasOpname = '';
    if (opname) {
      const kecuali = baris.filter((b) => b.dikecualikan);
      const diLuar = await repo.jumlahBarangAktifDiLuar(tx, id);
      ringkasOpname =
        `; dihitung ${baris.length - kecuali.length}, dikecualikan ${kecuali.length}` +
        (kecuali.length > 0
          ? ` (${kecuali.map((b) => `${b.namaBarang}: ${b.alasanKecuali}`).join('; ')})`
          : '') +
        `; barang aktif di luar dokumen ${diLuar}` +
        (tanpaHitungUlang.length > 0
          ? `; Owner menyetujui tanpa hitung ulang: ${tanpaHitungUlang.join(', ')}`
          : '') +
        (disetujuiPenghitung.length > 0
          ? `; Owner menyetujui hitungannya sendiri: ${disetujuiPenghitung.join(', ')}`
          : '');
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
  return detailPenyesuaian(id, pelaku);
}

export async function batalkanPenyesuaian(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDraf(tx, id);
    pastikanBolehLihatOpname({ ...h, namaPenghitung: null }, pelaku);
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
  return detailPenyesuaian(id, pelaku);
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
        sebabSelisih: null,
        dikecualikan: false,
        alasanKecuali: null,
      })),
    },
    pelaku,
    asal,
  );
}
