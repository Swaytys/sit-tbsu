import {
  dariNomorHari,
  LABEL_METODE_PEMBAYARAN,
  METODE_PEMBAYARAN,
  nomorHari,
  persenDari,
  type BarisBarangHasil,
  type BarisNilai,
  type HasilPenjualanHalaman,
  type Izin,
  type KelasAbc,
  type MetodePembayaran,
  type RingkasanHasilPenjualan,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { hitungLabaKotor } from '../laporan/laba-kotor';
import { hitungPenjualanPeriode } from '../laporan/penjualan-periode';
import { hitungProdukTerlaris } from '../laporan/produk-terlaris';
import { hitungLaporanPromo } from '../laporan/promo';

/*
 * K-126 Hasil Penjualan: ringkasan kinerja penjualan satu periode untuk layar (bukan dokumen laporan). Memakai
 * fungsi hitung laporan yang sama (angka layar = angka laporan); tambahan per kasir, jam, hari, dan metode bayar
 * lewat kueri baca berparameter. Laba hanya untuk `laporan.laba`.
 */

type Periode = { dari: string; sampai: string };

const NAMA_HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const BATAS_BARANG = 20;
const BATAS_DAFTAR = 10;

/** Periode sebanding tepat sebelum `dari` dengan jumlah hari sama. */
export function periodeSebelum(p: Periode): Periode {
  const panjang = nomorHari(p.sampai) - nomorHari(p.dari) + 1;
  return {
    dari: dariNomorHari(nomorHari(p.dari) - panjang),
    sampai: dariNomorHari(nomorHari(p.dari) - 1),
  };
}

async function ringkasan(p: Periode, laba: boolean) {
  const h = await hitungPenjualanPeriode({ ...p, jenis: undefined });
  const ik = h.ikhtisar;
  const r: RingkasanHasilPenjualan = {
    omzet: ik.omzet,
    jumlahTransaksi: ik.jumlahTransaksi,
    rataTransaksi: ik.jumlahTransaksi > 0 ? Math.round(ik.omzet / ik.jumlahTransaksi) : 0,
    retur: ik.retur,
    penjualanBersih: ik.penjualanBersih,
    diskon: ik.diskon,
    ongkir: ik.ongkir,
    voidPenuh: ik.voidPenuh,
    voidSebagian: ik.voidSebagian,
  };
  if (laba) {
    const l = (await hitungLabaKotor({ ...p, tampilan: 'BARANG' })).ikhtisar;
    r.labaKotor = l.labaKotor;
    r.marginPersen = persenDari(l.labaKotor, l.penjualanBersih);
  }
  return { r, h };
}

function kelas(kumulatifSebelum: number | null): KelasAbc {
  // Barang masuk kelas menurut kumulatif SEBELUM dirinya, supaya barang yang melewati batas tetap di kelas atas.
  const k = kumulatifSebelum ?? 0;
  return k < 80 ? 'A' : k < 95 ? 'B' : 'C';
}

async function barisSql(q: ReturnType<typeof sql>): Promise<BarisNilai[]> {
  const r = await db.execute<{ kunci: string; label: string; jumlah: string; nilai: string }>(q);
  return r.rows.map((x) => ({
    kunci: String(x.kunci),
    label: x.label,
    jumlah: Number(x.jumlah),
    nilai: Number(x.nilai),
  }));
}

const omzetBaris = sql`case when j.status_transaksi = 'VOID' then 0 else j.total_neto - j.total_void end`;

export async function hasilPenjualan(
  p: Periode,
  izin: ReadonlySet<Izin>,
): Promise<HasilPenjualanHalaman> {
  const laba = izin.has('laporan.laba');
  const lalu = periodeSebelum(p);
  const [kini, sebelum, barangAll, promo] = await Promise.all([
    ringkasan(p, laba),
    ringkasan(lalu, laba),
    hitungProdukTerlaris({ ...p, idKategori: undefined, batas: 0 }),
    hitungLaporanPromo(p),
  ]);

  // Harian: semua tanggal dalam periode tercantum.
  const peta = new Map<string, { jumlah: number; omzet: number }>();
  for (const t of kini.h.transaksi) {
    if (t.statusTransaksi === 'VOID') continue;
    const x = peta.get(t.tanggal) ?? { jumlah: 0, omzet: 0 };
    x.jumlah += 1;
    x.omzet += t.omzet;
    peta.set(t.tanggal, x);
  }
  const harian: HasilPenjualanHalaman['harian'] = [];
  for (let n = nomorHari(p.dari); n <= nomorHari(p.sampai); n++) {
    const tgl = dariNomorHari(n);
    harian.push({ tanggal: tgl, ...(peta.get(tgl) ?? { jumlah: 0, omzet: 0 }) });
  }

  // Pelanggan: dari transaksi (nama pelanggan terdaftar atau nama pembeli; kosong = Umum).
  const pel = new Map<string, BarisNilai>();
  for (const t of kini.h.transaksi) {
    if (t.statusTransaksi === 'VOID') continue;
    const nama = t.namaPembeli?.trim() || 'Umum (tanpa nama)';
    const x = pel.get(nama) ?? { kunci: nama, label: nama, jumlah: 0, nilai: 0 };
    x.jumlah += 1;
    x.nilai += t.omzet;
    pel.set(nama, x);
  }
  const perPelanggan = [...pel.values()].sort((a, b) => b.nilai - a.nilai).slice(0, BATAS_DAFTAR);

  // Barang + ABC + kategori.
  const abc: HasilPenjualanHalaman['abc'] = {
    A: { jumlahBarang: 0, nilai: 0 },
    B: { jumlahBarang: 0, nilai: 0 },
    C: { jumlahBarang: 0, nilai: 0 },
  };
  const kat = new Map<string, BarisNilai>();
  let sebelumKum: number | null = 0;
  const barang: BarisBarangHasil[] = [];
  for (const b of barangAll.baris) {
    const k = kelas(sebelumKum);
    sebelumKum = b.kumulatif;
    abc[k].jumlahBarang += 1;
    abc[k].nilai += b.nilai;
    if (barang.length < BATAS_BARANG) {
      barang.push({
        peringkat: b.peringkat,
        kode: b.kode,
        namaBarang: b.namaBarang,
        namaKategori: b.namaKategori,
        kodeSatuan: b.kodeSatuan,
        qty: b.qty,
        nilai: b.nilai,
        kontribusi: b.kontribusi,
        kelas: k,
      });
    }
    const x = kat.get(b.namaKategori) ?? {
      kunci: b.namaKategori,
      label: b.namaKategori,
      jumlah: 0,
      nilai: 0,
    };
    x.jumlah += 1;
    x.nilai += b.nilai;
    kat.set(b.namaKategori, x);
  }

  const [perKasir, perJam, perHari, metode, retur] = await Promise.all([
    barisSql(sql`
      select u.id::text kunci, u.nama_pengguna label, count(*)::text jumlah, sum(${omzetBaris})::text nilai
        from penjualan j join pengguna u on u.id = j.id_kasir
       where j.tanggal_operasional between ${p.dari} and ${p.sampai} and j.status_transaksi <> 'VOID'
       group by u.id, u.nama_pengguna order by sum(${omzetBaris}) desc`),
    barisSql(sql`
      select extract(hour from j.tanggal at time zone 'Asia/Jakarta')::int::text kunci, '' label,
             count(*)::text jumlah, sum(${omzetBaris})::text nilai
        from penjualan j
       where j.tanggal_operasional between ${p.dari} and ${p.sampai} and j.status_transaksi <> 'VOID'
       group by 1`),
    barisSql(sql`
      select extract(isodow from j.tanggal_operasional)::int::text kunci, '' label,
             count(*)::text jumlah, sum(${omzetBaris})::text nilai
        from penjualan j
       where j.tanggal_operasional between ${p.dari} and ${p.sampai} and j.status_transaksi <> 'VOID'
       group by 1`),
    barisSql(sql`
      select b.metode kunci, '' label, count(*)::text jumlah, sum(b.nominal)::text nilai
        from pembayaran_penjualan b
       where (b.tanggal at time zone 'Asia/Jakarta')::date between ${p.dari}::date and ${p.sampai}::date
       group by b.metode`),
    db.execute<{ n: string }>(sql`
      select count(*)::text n from retur_penjualan r
       where r.status = 'DISETUJUI' and r.tanggal_operasional between ${p.dari} and ${p.sampai}`),
  ]);

  const jamPeta = new Map(perJam.map((x) => [x.kunci, x]));
  const hariPeta = new Map(perHari.map((x) => [x.kunci, x]));
  const metodePeta = new Map(metode.map((x) => [x.kunci, x]));

  return {
    periode: p,
    periodeLalu: lalu,
    ringkasan: kini.r,
    ringkasanLalu: sebelum.r,
    harian,
    perJenis: kini.h.ikhtisar.perJenis,
    barang,
    abc,
    jumlahBarangTerjual: barangAll.baris.length,
    perKategori: [...kat.values()].sort((a, b) => b.nilai - a.nilai),
    perPelanggan,
    perKasir,
    perJam: Array.from({ length: 24 }, (_, j) => ({
      kunci: String(j),
      label: `${String(j).padStart(2, '0')}.00`,
      jumlah: jamPeta.get(String(j))?.jumlah ?? 0,
      nilai: jamPeta.get(String(j))?.nilai ?? 0,
    })),
    perHari: Array.from({ length: 7 }, (_, i) => ({
      kunci: String(i + 1),
      label: NAMA_HARI[i + 1] ?? '',
      jumlah: hariPeta.get(String(i + 1))?.jumlah ?? 0,
      nilai: hariPeta.get(String(i + 1))?.nilai ?? 0,
    })),
    perMetode: METODE_PEMBAYARAN.filter((m) => metodePeta.has(m)).map((m: MetodePembayaran) => ({
      kunci: m,
      label: LABEL_METODE_PEMBAYARAN[m],
      jumlah: metodePeta.get(m)?.jumlah ?? 0,
      nilai: metodePeta.get(m)?.nilai ?? 0,
    })),
    promo: {
      diskonPromo: promo.promo.reduce((t, x) => t + x.diskonPromo, 0),
      transaksiBerpromo: promo.transaksiBerpromo,
      teratas: [...promo.promo]
        .sort((a, b) => b.diskonPromo - a.diskonPromo)
        .slice(0, 5)
        .map((x) => ({
          kunci: String(x.id),
          label: x.nama,
          jumlah: x.transaksi,
          nilai: x.diskonPromo,
        })),
    },
    returDokumen: Number(retur.rows[0]?.n ?? 0),
  };
}
