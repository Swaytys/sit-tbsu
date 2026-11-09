import { randomInt } from 'node:crypto';
import {
  kaliQty,
  keQty,
  LABEL_PERAN,
  qtyDariTimbang,
  rapikanDesimal,
  tambahQty,
  SEBAB_SELISIH,
  type BarisLembarHitung,
  type DataHitungOpname,
  type DataPenyesuaian,
  type DataTimbangBarang,
  type DetailPenyesuaian,
  type KelasABC,
  type KinerjaOpname,
  type LembarHitung,
  type PenghitungOpname,
  type RingkasanOpname,
  type SebabSelisih,
  type TugasOpname,
} from '@sit/shared';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db, type Tx } from '../../../db/client';
import {
  barang,
  opnameHitung,
  pengguna,
  penyesuaianStok,
  penyesuaianStokDetail,
  satuan,
} from '../../../db/schema';
import { AppError, galatKolom } from '../../../lib/errors';
import { izinDari, kolomIzin } from '../../../lib/izin-pengguna';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tambahHari, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { kemasanSegel } from '../ledger';
import * as repoPenyesuaian from '../penyesuaian/repo';
import {
  buatPenyesuaian,
  detailPenyesuaian,
  pastikanBolehLihatOpname,
  toleransiOpname,
} from '../penyesuaian/service';
import { hitunganDokumen, keRespons, nilaiBaris, nilaiHitungan, tambahHitungan } from './hitung';
import { kelasBarang, petaOpname, SELANG, type BarangOpname } from './peta';

/*
 * K-240/K-227: Stok Opname bertahap (cycle count). Daftar hitung harian dipilih acak berbobot dari barang yang jatuh
 * tempo, ditambah sedikit barang yang belum jatuh tempo, supaya tidak bisa ditebak; daftar langsung ditugaskan ke
 * satu penghitung dan baru terlihat isinya saat ia menekan "Mulai hitung". Lembar hitung = tampilan hitung buta untuk
 * HP/tablet: satu barang satu isian, boleh lewat timbangan.
 */

const HITUNG = 'persediaan.opname.hitung';

export async function ringkasanOpname(): Promise<RingkasanOpname> {
  const peta = await petaOpname();
  const kelas = (['A', 'B', 'C'] as const).map((k) => ({
    kelas: k,
    selangHari: SELANG[k],
    jumlah: peta.filter((b) => b.kelas === k).length,
    jatuhTempo: peta.filter((b) => b.kelas === k && b.jatuhTempo).length,
  }));
  // IRA (akurasi catatan persediaan) 30 hari: baris opname yang cocok ÷ baris yang dihitung.
  const r = await db.execute<{ dihitung: string; cocok: string; nilai: string; draf: string }>(sql`
    select count(*)::text dihitung,
           count(*) filter (where d.qty_selisih = 0)::text cocok,
           coalesce(sum(abs(d.qty_selisih) * d.hpp_satuan), 0)::bigint::text nilai,
           (select count(*) from penyesuaian_stok where jenis = 'OPNAME' and status = 'DRAFT')::text draf
      from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
     where p.jenis = 'OPNAME' and p.status = 'SELESAI' and not d.dikecualikan
       and p.tanggal_operasional >= ${tambahHari(tanggalOperasional(), -30)}`);
  const x = r.rows[0];
  const dihitung = Number(x?.dihitung ?? 0);
  const cocok = Number(x?.cocok ?? 0);
  const awalTahun = `${tanggalOperasional().slice(0, 4)}-01-01`;
  // Barang per hari kerja (6 hari seminggu) agar setiap barang terhitung dalam selangnya.
  const perHari = peta.reduce((t, b) => t + 1 / b.selang, 0) * (7 / 6);
  return {
    kelas,
    akurasi30Hari: dihitung === 0 ? null : Math.round((cocok / dihitung) * 1000) / 10,
    barisDihitung30Hari: dihitung,
    nilaiSelisih30Hari: Number(x?.nilai ?? 0),
    rawan: peta.filter((b) => b.rawan).length,
    belumDihitungTahunIni: peta.filter((b) => b.terakhir === null || b.terakhir < awalTahun).length,
    saranPerHari: peta.length === 0 ? 0 : Math.max(1, Math.ceil(perHari)),
    toleransiRp: await toleransiOpname(),
    drafAktif: Number(x?.draf ?? 0),
  };
}

/** Pengguna aktif yang (dengan izin efektifnya, K-243) boleh menghitung opname. */
export async function daftarPenghitung(): Promise<PenghitungOpname[]> {
  const r = await db
    .select({
      id: pengguna.id,
      nama: pengguna.namaPengguna,
      peran: pengguna.peran,
      ...kolomIzin,
    })
    .from(pengguna)
    .where(eq(pengguna.statusAktif, 'AKTIF'))
    .orderBy(pengguna.namaPengguna);
  return r
    .filter((p) => izinDari(p).has(HITUNG))
    .map((p) => ({ id: p.id, nama: p.nama, peran: p.namaPeranKustom ?? LABEL_PERAN[p.peran] }));
}

async function pastikanPenghitung(idPenghitung: number): Promise<{ id: number; nama: string }> {
  const p = (await daftarPenghitung()).find((x) => x.id === idPenghitung);
  if (!p) {
    throw galatKolom(
      'idPenghitung',
      'Pengguna itu tidak aktif atau tidak berizin menghitung opname (atur di Data Pengguna › Atur izin).',
    );
  }
  return p;
}

/**
 * Daftar hitung harian: `jumlah` barang acak berbobot (kelas A 3 : B 2 : C 1, + rawan/mahal/khusus) dari yang jatuh
 * tempo; ±1 dari 5 diambil dari yang belum jatuh tempo (barang yang baru dihitung tetap bisa terpilih lagi).
 * Hasilnya draf OPNAME yang langsung ditugaskan ke satu penghitung.
 */
export async function susunDaftarHarian(
  jumlah: number,
  idPenghitung: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  const penghitung = await pastikanPenghitung(idPenghitung);
  const peta = await petaOpname();
  if (peta.length === 0)
    throw new AppError('VALIDASI', 'Tidak ada barang aktif untuk dihitung.', 400);
  const jatuh = peta.filter((b) => b.jatuhTempo);
  const lain = peta.filter((b) => !b.jatuhTempo);
  const kejutan = lain.length > 0 ? Math.max(1, Math.round(jumlah / 5)) : 0;
  const pilih = [
    ...ambilAcakBerbobot(jatuh, jumlah - Math.min(kejutan, jumlah - 1)),
    ...ambilAcakBerbobot(lain, kejutan),
  ];
  const sisa = jumlah - pilih.length;
  if (sisa > 0) {
    const sudah = new Set(pilih.map((b) => b.idBarang));
    pilih.push(
      ...ambilAcakBerbobot(
        peta.filter((b) => !sudah.has(b.idBarang)),
        sisa,
      ),
    );
  }
  const input: DataPenyesuaian = {
    jenis: 'OPNAME',
    alasan: null,
    catatan: `Daftar hitung harian ${tanggalOperasional()} (${pilih.length} barang, acak) untuk ${penghitung.nama}`,
    baris: pilih.map((b) => ({
      idBarang: b.idBarang,
      qtyFisik: null,
      qtySelisih: null,
      hppSatuan: null,
      keterangan: null,
      sebabSelisih: null,
      dikecualikan: false,
      alasanKecuali: null,
    })),
  };
  return buatPenyesuaian(input, pelaku, asal, {
    idPenghitung,
    ujiPetik: await pilihUjiPetik(pilih.map((b) => b.idBarang)),
  });
}

/**
 * K-227 uji petik: dari barang terpilih yang punya box segel di stok, ± 1 dari 3 diminta membuka 1 box acak dan
 * menghitung isinya; paling sedikit satu bila ada yang memenuhi.
 */
async function pilihUjiPetik(idBarang: number[]): Promise<Set<number>> {
  if (idBarang.length === 0) return new Set();
  const r = await db.execute<{ id: string }>(sql`
    select p.id_barang::text id from persediaan p
     where p.qty_segel >= 1 and p.id_barang in (${sql.join(
       idBarang.map((x) => sql`${x}`),
       sql`, `,
     )})
       and exists (select 1 from barang_satuan_jual bsj
                    where bsj.id_barang = p.id_barang and bsj.kemasan_segel and bsj.status_aktif = 'AKTIF')`);
  const calon = r.rows.map((x) => Number(x.id));
  const hasil = new Set(calon.filter(() => randomInt(0, 3) === 0));
  const satu = calon[randomInt(0, Math.max(1, calon.length))];
  if (hasil.size === 0 && satu !== undefined) hasil.add(satu);
  return hasil;
}

function ambilAcakBerbobot(daftar: BarangOpname[], n: number): BarangOpname[] {
  const sisa = [...daftar];
  const hasil: BarangOpname[] = [];
  while (hasil.length < n && sisa.length > 0) {
    const total = sisa.reduce((t, b) => t + b.bobot, 0);
    let titik = randomInt(0, total);
    const i = sisa.findIndex((b) => (titik -= b.bobot) < 0);
    hasil.push(...sisa.splice(i < 0 ? 0 : i, 1));
  }
  return hasil;
}

async function kunciDrafOpname(tx: Tx, id: number) {
  const h = await repoPenyesuaian.kunciPenyesuaian(tx, id);
  if (h?.jenis !== 'OPNAME') {
    throw new AppError('TIDAK_DITEMUKAN', 'Lembar opname tidak ditemukan.', 404);
  }
  if (h.status !== 'DRAFT') {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Opname ${h.nomor} sudah ${h.status === 'SELESAI' ? 'selesai' : 'dibatalkan'}.`,
      409,
    );
  }
  return h;
}

/** Menugaskan (atau memindah, mis. untuk hitung ulang) lembar opname ke penghitung; `null` = semua penghitung. */
export async function tugaskanOpname(
  id: number,
  idPenghitung: number | null,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  const penghitung = idPenghitung === null ? null : await pastikanPenghitung(idPenghitung);
  await dalamTransaksi(async (tx) => {
    const h = await kunciDrafOpname(tx, id);
    await tx
      .update(penyesuaianStok)
      .set({ idPenghitung, waktuMulaiHitung: null, diubahPada: sekarang() })
      .where(eq(penyesuaianStok.id, id));
    await catatLog(tx, {
      aksi: 'OPNAME_TUGASKAN',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: penghitung
        ? `Lembar ${h.nomor} ditugaskan ke ${penghitung.nama}`
        : `Lembar ${h.nomor} dibuka untuk semua penghitung`,
      ip: asal.ip,
    });
  });
  return detailPenyesuaian(id, pelaku);
}

/** Penghitung yang ditugaskan menekan "Mulai hitung": isi daftar baru terlihat dan waktunya dicatat. */
export async function mulaiHitung(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<LembarHitung> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDrafOpname(tx, id);
    pastikanBolehLihatOpname({ ...h, namaPenghitung: null }, pelaku);
    await catatMulai(tx, h, pelaku, asal);
  });
  return lembarHitung(id, pelaku);
}

async function catatMulai(
  tx: Tx,
  h: { id: number; nomor: string; idPenghitung: number | null; waktuMulaiHitung: Date | null },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  if (h.idPenghitung !== pelaku.id || h.waktuMulaiHitung !== null) return;
  await tx
    .update(penyesuaianStok)
    .set({ waktuMulaiHitung: sql`now()` })
    .where(eq(penyesuaianStok.id, h.id));
  await catatLog(tx, {
    aksi: 'OPNAME_MULAI',
    idPengguna: pelaku.id,
    entitas: 'penyesuaian_stok',
    idEntitas: h.id,
    nomorDokumen: h.nomor,
    ringkasan: `Mulai menghitung ${h.nomor}`,
    ip: asal.ip,
  });
}

/** Lembar hitung (hitung buta) untuk penghitung; `hanyaBarang` = satu baris saja (sesudah mencatat hitungan). */
export async function lembarHitung(
  id: number,
  pelaku: PenggunaAktif,
  hanyaBarang?: number,
): Promise<LembarHitung> {
  const h = await repoPenyesuaian.penyesuaianById(db, id);
  if (h?.jenis !== 'OPNAME')
    throw new AppError('TIDAK_DITEMUKAN', 'Lembar opname tidak ditemukan.', 404);
  pastikanBolehLihatOpname(h, pelaku);
  const belumMulai =
    h.status === 'DRAFT' && h.idPenghitung === pelaku.id && h.waktuMulaiHitung === null;
  const kepala = {
    id: h.id,
    nomor: h.nomor,
    status: h.status,
    catatan: h.catatan,
    penghitung: h.idPenghitung ? { id: h.idPenghitung, nama: h.namaPenghitung ?? '' } : null,
    waktuMulaiHitung: h.waktuMulaiHitung?.toISOString() ?? null,
    belumMulai,
    jumlahBaris: h.jumlahBaris,
  };
  if (belumMulai) return { ...kepala, baris: [] };
  const rows = (await repoPenyesuaian.detailPenyesuaian(db, id)).filter(
    (r) => hanyaBarang === undefined || r.idBarang === hanyaBarang,
  );
  const stok = new Map(rows.map((r) => [r.idBarang, r.stokFisikKini]));
  const semua = await hitunganDokumen(db, id);
  const hitungan = new Map([...semua].filter(([b]) => stok.has(b)));
  const bernilai = await nilaiHitungan(db, hitungan, (b) => stok.get(b) ?? '0');
  const kelas = await kelasBarang();
  const toleransiRp = await toleransiOpname();
  const baris: BarisLembarHitung[] = rows.map((r) => {
    const hit = bernilai.get(r.idBarang) ?? [];
    const nilai = nilaiBaris({
      hitungan: hit,
      hpp: r.hppKini,
      kelas: kelas.get(r.idBarang) ?? 'C',
      toleransiRp,
    });
    const saya = hit.filter((x) => x.idPenghitung === pelaku.id).at(-1) ?? null;
    return {
      idBarang: r.idBarang,
      kodeBarang: r.kodeBarang,
      namaBarang: r.namaBarang,
      namaKategori: r.namaKategori,
      kodeSatuan: r.kodeSatuan,
      satuanBulat: r.jenisDimensi === 'JUMLAH',
      timbang:
        r.timbangJumlahSampel !== null && r.timbangBeratSampelGram !== null
          ? { jumlahSampel: r.timbangJumlahSampel, beratSampelGram: r.timbangBeratSampelGram }
          : null,
      segel:
        r.segelIsi !== null && r.segelKode !== null
          ? { kodeSatuan: r.segelKode, isi: rapikanDesimal(r.segelIsi) }
          : null,
      // Uji petik cukup sekali per barang: hilang setelah ada hitungan yang membuka box.
      ujiPetik: r.ujiPetik && !hit.some((x) => x.isiUjiPetik !== null),
      dikecualikan: r.dikecualikan,
      hitunganSaya: saya ? keRespons(saya, false) : null,
      dihitungOrangLain: hit.some((x) => x.idPenghitung !== pelaku.id),
      perluDihitung:
        !r.dikecualikan &&
        saya === null &&
        (hit.length === 0 || (nilai.perluHitungUlang && !nilai.terkonfirmasi)),
    };
  });
  return { ...kepala, baris };
}

/** Mencatat satu hasil hitung dari lembar hitung. TIMBANG: jumlah dihitung dari berat bersih. */
export async function catatHitung(
  id: number,
  input: DataHitungOpname,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisLembarHitung> {
  await dalamTransaksi(async (tx) => {
    const h = await kunciDrafOpname(tx, id);
    pastikanBolehLihatOpname({ ...h, namaPenghitung: null }, pelaku);
    await catatMulai(tx, h, pelaku, asal);
    const [b] = await tx
      .select({
        idDetail: penyesuaianStokDetail.id,
        dikecualikan: penyesuaianStokDetail.dikecualikan,
        ujiPetik: penyesuaianStokDetail.ujiPetik,
        namaBarang: barang.namaBarang,
        kodeSatuan: satuan.kode,
        jenisDimensi: satuan.jenisDimensi,
        jumlahSampel: barang.timbangJumlahSampel,
        beratSampel: barang.timbangBeratSampelGram,
      })
      .from(penyesuaianStokDetail)
      .innerJoin(barang, eq(barang.id, penyesuaianStokDetail.idBarang))
      .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
      .where(
        and(
          eq(penyesuaianStokDetail.idPenyesuaian, id),
          eq(penyesuaianStokDetail.idBarang, input.idBarang),
          eq(penyesuaianStokDetail.kondisi, 'BAIK'),
        ),
      );
    if (!b) throw galatKolom('idBarang', 'Barang ini tidak ada di lembar opname.');
    if (b.dikecualikan) {
      throw galatKolom('idBarang', `${b.namaBarang} dikecualikan dari opname ini; tidak dihitung.`);
    }
    const kemasan = await kemasanSegel(tx, input.idBarang);
    if (input.qtySegel !== null && !kemasan) {
      throw galatKolom(
        'qtySegel',
        `${b.namaBarang} tidak punya kemasan tersegel; isi jumlah saja.`,
      );
    }
    if (kemasan && b.ujiPetik && input.qtySegel !== null && Number(input.qtySegel) >= 1) {
      // Uji petik cukup sekali per barang: penghitung ulang tidak membuka box lagi.
      const [sudahUji] = await tx
        .select({ id: opnameHitung.id })
        .from(opnameHitung)
        .where(
          and(
            eq(opnameHitung.idPenyesuaian, id),
            eq(opnameHitung.idBarang, input.idBarang),
            isNotNull(opnameHitung.isiUjiPetik),
          ),
        )
        .limit(1);
      if (input.isiUjiPetik === null && !sudahUji) {
        throw galatKolom(
          'isiUjiPetik',
          `${b.namaBarang} diminta uji petik: buka 1 box segel acak, hitung isinya, lalu isi jumlahnya.`,
        );
      }
    }
    let qty: string;
    if (input.cara === 'TIMBANG') {
      if (b.jumlahSampel === null || b.beratSampel === null || input.beratGram === null) {
        throw galatKolom(
          'beratGram',
          `${b.namaBarang} belum punya data timbang (berat sekian buah). Isi di Data Barang atau hitung manual.`,
        );
      }
      qty = qtyDariTimbang(
        input.beratGram,
        b.jumlahSampel,
        b.beratSampel,
        b.jenisDimensi === 'JUMLAH',
      );
    } else {
      qty = keQty(input.qty ?? '0');
    }
    // K-227: barang tersegel: jumlah = box utuh × isi + isi box uji petik + ecer (qty di atas).
    const ecer = qty;
    const uji = input.isiUjiPetik !== null && input.qtySegel !== null;
    if (kemasan && input.qtySegel !== null) {
      const utuh = Number(input.qtySegel) - (uji ? 1 : 0);
      qty = tambahQty(
        tambahQty(kaliQty(utuh, kemasan.isi), uji ? (input.isiUjiPetik ?? '0') : '0'),
        ecer,
      );
    }
    await tambahHitungan(tx, {
      idPenyesuaian: id,
      idBarang: input.idBarang,
      idPenghitung: pelaku.id,
      qty,
      cara: input.cara,
      beratGram: input.cara === 'TIMBANG' ? input.beratGram : null,
      qtySegel: kemasan && input.qtySegel !== null ? keQty(input.qtySegel) : null,
      isiSegel: kemasan && input.qtySegel !== null ? kemasan.isi : null,
      isiUjiPetik: kemasan && uji ? keQty(input.isiUjiPetik ?? '0') : null,
    });
    await tx
      .update(penyesuaianStokDetail)
      .set({ qtyFisik: qty })
      .where(eq(penyesuaianStokDetail.id, b.idDetail));
    await catatLog(tx, {
      aksi: 'OPNAME_HITUNG',
      idPengguna: pelaku.id,
      entitas: 'penyesuaian_stok',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Hitung ${h.nomor}: ${b.namaBarang} ${qty} ${b.kodeSatuan}${
        kemasan && input.qtySegel !== null
          ? ` = ${input.qtySegel} ${kemasan.kodeSatuan} segel + ecer ${ecer}${
              uji ? `; uji petik isi ${input.isiUjiPetik} dari ${rapikanDesimal(kemasan.isi)}` : ''
            }`
          : ''
      }${input.cara === 'TIMBANG' ? ` (ecer ditimbang ${input.beratGram} g)` : ''}`.slice(0, 1000),
      ip: asal.ip,
    });
  });
  const lembar = await lembarHitung(id, pelaku, input.idBarang);
  const baris = lembar.baris[0];
  if (!baris) throw new Error('baris lembar hilang setelah dihitung');
  return baris;
}

/** Lembar opname draf yang bisa dikerjakan pengguna ini (ditugaskan kepadanya atau terbuka untuk semua). */
export async function tugasOpname(pelaku: PenggunaAktif): Promise<TugasOpname[]> {
  const r = await db.execute<{
    id: string;
    nomor: string;
    tanggal: Date;
    catatan: string | null;
    jumlah: string;
    saya: string;
    belum: string;
    ditugaskan: boolean;
    dimulai: boolean;
  }>(sql`
    select p.id::text id, p.nomor, p.tanggal, p.catatan,
           (select count(*) from penyesuaian_stok_detail d
             where d.id_penyesuaian = p.id and not d.dikecualikan)::text jumlah,
           (select count(distinct h.id_barang) from opname_hitung h
             where h.id_penyesuaian = p.id and h.id_penghitung = ${pelaku.id})::text saya,
           (select count(*) from penyesuaian_stok_detail d
             where d.id_penyesuaian = p.id and not d.dikecualikan
               and not exists (select 1 from opname_hitung h
                                where h.id_penyesuaian = p.id and h.id_barang = d.id_barang))::text belum,
           (p.id_penghitung is not null) ditugaskan,
           (p.waktu_mulai_hitung is not null) dimulai
      from penyesuaian_stok p
     where p.jenis = 'OPNAME' and p.status = 'DRAFT'
       and (p.id_penghitung is null or p.id_penghitung = ${pelaku.id})
     order by p.tanggal desc, p.id desc
     limit 50`);
  return r.rows.map((x) => ({
    id: Number(x.id),
    nomor: x.nomor,
    tanggal: new Date(x.tanggal).toISOString(),
    catatan: x.catatan,
    jumlahBaris: Number(x.jumlah),
    sudahSaya: Number(x.saya),
    belumDihitung: Number(x.belum),
    ditugaskan: x.ditugaskan,
    dimulai: x.dimulai,
  }));
}

/** Notifikasi: lembar yang ditugaskan ke pengguna ini dan masih ada barang yang belum dihitung siapa pun. */
export async function jumlahTugasOpname(idPengguna: number): Promise<number> {
  const r = await db.execute<{ n: string }>(sql`
    select count(*)::text n from penyesuaian_stok p
     where p.jenis = 'OPNAME' and p.status = 'DRAFT' and p.id_penghitung = ${idPengguna}
       and exists (select 1 from penyesuaian_stok_detail d
                    where d.id_penyesuaian = p.id and not d.dikecualikan and d.qty_fisik is null)`);
  return Number(r.rows[0]?.n ?? 0);
}

/** Notifikasi: lembar opname yang semua barangnya sudah dihitung atau dikecualikan. */
export async function jumlahOpnameSiap(): Promise<number> {
  const r = await db.execute<{ n: string }>(sql`
    select count(*)::text n from penyesuaian_stok p
     where p.jenis = 'OPNAME' and p.status = 'DRAFT'
       and exists (select 1 from penyesuaian_stok_detail d where d.id_penyesuaian = p.id)
       and not exists (select 1 from penyesuaian_stok_detail d
                        where d.id_penyesuaian = p.id and not d.dikecualikan and d.qty_fisik is null)`);
  return Number(r.rows[0]?.n ?? 0);
}

/** Kinerja opname: akurasi per bulan (6 bulan), per kelas dan per penghitung (90 hari), selisih per sebab. */
export async function kinerjaOpname(): Promise<KinerjaOpname> {
  const hariIni = tanggalOperasional();
  const bulanIni = hariIni.slice(0, 7);
  const daftarBulan: string[] = [];
  {
    let [t, b] = bulanIni.split('-').map(Number) as [number, number];
    for (let i = 0; i < 6; i++) {
      daftarBulan.unshift(`${t}-${String(b).padStart(2, '0')}`);
      b -= 1;
      if (b === 0) {
        b = 12;
        t -= 1;
      }
    }
  }
  const dari90 = tambahHari(hariIni, -90);
  const rb = await db.execute<{
    bulan: string;
    dihitung: string;
    cocok: string;
    nilai: string;
    bersih: string;
  }>(sql`
    select to_char(p.tanggal_operasional, 'YYYY-MM') bulan, count(*)::text dihitung,
           count(*) filter (where d.qty_selisih = 0)::text cocok,
           coalesce(sum(abs(d.qty_selisih) * d.hpp_satuan), 0)::bigint::text nilai,
           coalesce(sum(d.qty_selisih * d.hpp_satuan), 0)::bigint::text bersih
      from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
     where p.jenis = 'OPNAME' and p.status = 'SELESAI' and not d.dikecualikan
       and p.tanggal_operasional >= ${`${daftarBulan[0]}-01`}
     group by 1`);
  const perBulan = new Map(rb.rows.map((x) => [x.bulan, x]));
  const akurasi = (cocok: number, dihitung: number) =>
    dihitung === 0 ? null : Math.round((cocok / dihitung) * 1000) / 10;

  const rk = await db.execute<{ id_barang: string; dihitung: string; cocok: string }>(sql`
    select d.id_barang::text, count(*)::text dihitung,
           count(*) filter (where d.qty_selisih = 0)::text cocok
      from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
     where p.jenis = 'OPNAME' and p.status = 'SELESAI' and not d.dikecualikan
       and p.tanggal_operasional >= ${dari90}
     group by 1`);
  const kelas = await kelasBarang();
  const perKelas = new Map<KelasABC, { dihitung: number; cocok: number }>(
    (['A', 'B', 'C'] as const).map((k) => [k, { dihitung: 0, cocok: 0 }]),
  );
  for (const x of rk.rows) {
    const k = perKelas.get(kelas.get(Number(x.id_barang)) ?? 'C');
    if (!k) continue;
    k.dihitung += Number(x.dihitung);
    k.cocok += Number(x.cocok);
  }

  // Hitungan seorang penghitung "tepat" bila jumlahnya sama dengan hasil akhir baris yang disetujui.
  const rp = await db.execute<{ id: string; nama: string; hitungan: string; tepat: string }>(sql`
    select h.id_penghitung::text id, u.nama_pengguna nama, count(*)::text hitungan,
           count(*) filter (where h.qty = d.qty_fisik)::text tepat
      from opname_hitung h
      join penyesuaian_stok p on p.id = h.id_penyesuaian
      join penyesuaian_stok_detail d on d.id_penyesuaian = h.id_penyesuaian and d.id_barang = h.id_barang
      join pengguna u on u.id = h.id_penghitung
     where p.status = 'SELESAI' and not d.dikecualikan and p.tanggal_operasional >= ${dari90}
     group by 1, 2
     order by count(*) desc`);

  const rs = await db.execute<{
    sebab: string | null;
    baris: string;
    nilai: string;
    bersih: string;
  }>(sql`
    select d.sebab_selisih sebab, count(*)::text baris,
           coalesce(sum(abs(d.qty_selisih) * d.hpp_satuan), 0)::bigint::text nilai,
           coalesce(sum(d.qty_selisih * d.hpp_satuan), 0)::bigint::text bersih
      from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
     where p.jenis = 'OPNAME' and p.status = 'SELESAI' and not d.dikecualikan and d.qty_selisih <> 0
       and p.tanggal_operasional >= ${dari90}
     group by 1
     order by 3 desc`);

  // K-227 uji petik: hitungan terakhir tiap baris opname selesai yang membuka box.
  const ru = await db.execute<{ dibuka: string; kurang: string; qty: string }>(sql`
    select count(*)::text dibuka,
           count(*) filter (where h.isi_uji_petik < h.isi_segel)::text kurang,
           coalesce(sum(greatest(h.isi_segel - h.isi_uji_petik, 0)), 0)::text qty
      from (select distinct on (h.id_penyesuaian, h.id_barang) h.*
              from opname_hitung h
             where h.isi_uji_petik is not null
             order by h.id_penyesuaian, h.id_barang, h.waktu desc, h.id desc) h
      join penyesuaian_stok p on p.id = h.id_penyesuaian
     where p.status = 'SELESAI' and p.tanggal_operasional >= ${dari90}`);
  const uji = ru.rows[0];

  return {
    ujiPetik: {
      dibuka: Number(uji?.dibuka ?? 0),
      kurang: Number(uji?.kurang ?? 0),
      kurangQty: keQty(uji?.qty ?? '0'),
    },
    bulan: daftarBulan.map((bulan) => {
      const x = perBulan.get(bulan);
      const dihitung = Number(x?.dihitung ?? 0);
      const cocok = Number(x?.cocok ?? 0);
      return {
        bulan,
        dihitung,
        cocok,
        akurasi: akurasi(cocok, dihitung),
        nilaiSelisih: Number(x?.nilai ?? 0),
        nilaiBersih: Number(x?.bersih ?? 0),
      };
    }),
    kelas: [...perKelas].map(([k, v]) => ({
      kelas: k,
      dihitung: v.dihitung,
      cocok: v.cocok,
      akurasi: akurasi(v.cocok, v.dihitung),
    })),
    penghitung: rp.rows.map((x) => ({
      idPengguna: Number(x.id),
      nama: x.nama,
      hitungan: Number(x.hitungan),
      tepat: Number(x.tepat),
      akurasi: akurasi(Number(x.tepat), Number(x.hitungan)),
    })),
    sebab: rs.rows.map((x) => ({
      sebab:
        x.sebab !== null && (SEBAB_SELISIH as readonly string[]).includes(x.sebab)
          ? (x.sebab as SebabSelisih)
          : null,
      baris: Number(x.baris),
      nilaiSelisih: Number(x.nilai),
      nilaiBersih: Number(x.bersih),
    })),
  };
}

/** Data timbang barang (berat sekian buah) untuk hitung dengan timbangan. */
export async function aturTimbang(
  idBarang: number,
  input: DataTimbangBarang,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ jumlahSampel: string; beratSampelGram: string } | null> {
  return dalamTransaksi(async (tx) => {
    const [b] = await tx
      .update(barang)
      .set({
        timbangJumlahSampel: input.jumlahSampel === null ? null : keQty(input.jumlahSampel),
        timbangBeratSampelGram: input.beratSampelGram,
        diubahPada: sekarang(),
      })
      .where(eq(barang.id, idBarang))
      .returning({
        namaBarang: barang.namaBarang,
        jumlahSampel: barang.timbangJumlahSampel,
        beratSampelGram: barang.timbangBeratSampelGram,
      });
    if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);
    await catatLog(tx, {
      aksi: 'BARANG_TIMBANG_UBAH',
      idPengguna: pelaku.id,
      entitas: 'barang',
      idEntitas: idBarang,
      ringkasan:
        b.jumlahSampel === null
          ? `Data timbang ${b.namaBarang} dihapus`
          : `Data timbang ${b.namaBarang}: ${b.jumlahSampel} = ${b.beratSampelGram} g`,
      ip: asal.ip,
    });
    return b.jumlahSampel === null || b.beratSampelGram === null
      ? null
      : { jumlahSampel: b.jumlahSampel, beratSampelGram: b.beratSampelGram };
  });
}
