import {
  formatRupiah,
  teksPeriode,
  teksTanggalAngka,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanPengawasanPembelian,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import type { PenggunaAktif } from '../../lib/konteks';
import { ambilAngka } from '../sistem/konfigurasi/service';
import { angka, KOSONG, SATUAN_RUPIAH, susunDokumen, teks, uang } from './umum';

/*
 * K-225 butir 9: Laporan Pengawasan Pembelian untuk Kepala Toko/Owner. Mengumpulkan kejadian yang perlu diawasi
 * dalam siklus pembelian selama periode: persetujuan order, penerimaan tanpa order, harga faktur naik dari order,
 * bayar kurang dari kesepakatan, barang ditolak, perpanjangan jatuh tempo, pemasok baru dan perubahan rekening.
 */

export type DataPengawasanPembelian = z.output<typeof skemaLaporanPengawasanPembelian>;

type Kejadian = {
  kelompok: string;
  tanggal: string;
  dokumen: string;
  pemasok: string;
  nilai: number | null;
  oleh: string;
  keterangan: string;
};

async function baris<T extends Record<string, unknown>>(q: ReturnType<typeof sql>) {
  return (await db.execute<T>(q)).rows;
}

export async function hitungPengawasanPembelian(p: DataPengawasanPembelian): Promise<Kejadian[]> {
  const { dari, sampai } = p;
  const ambang = await ambilAngka('po_ambang_naik_persen', 10);
  const k: Kejadian[] = [];

  for (const r of await baris<{
    tanggal: string;
    dokumen: string;
    pemasok: string;
    nilai: string;
    pembuat: string;
    penyetuju: string | null;
    alasan: string | null;
    catatan: string | null;
  }>(sql`
    select o.disetujui_pada::date::text tanggal, coalesce(o.nomor, 'Draf #' || o.id) dokumen,
           pm.nama_pemasok pemasok,
           (select coalesce(sum(coalesce(d.qty_konfirmasi, d.qty_pesan) * coalesce(d.harga_konfirmasi, d.harga_perkiraan)), 0)
              from order_pembelian_detail d where d.id_order_pembelian = o.id)::bigint::text nilai,
           u1.nama_pengguna pembuat, u2.nama_pengguna penyetuju, o.alasan_persetujuan alasan,
           o.catatan_persetujuan catatan
      from order_pembelian o
      join pemasok pm on pm.id = o.id_pemasok
      join pengguna u1 on u1.id = o.id_pembuat
      left join pengguna u2 on u2.id = o.id_penyetuju
     where o.disetujui_pada is not null
       and (o.disetujui_pada at time zone 'Asia/Jakarta')::date between ${dari} and ${sampai}
     order by o.disetujui_pada`)) {
    k.push({
      kelompok: 'Order disetujui',
      tanggal: r.tanggal,
      dokumen: r.dokumen,
      pemasok: r.pemasok,
      nilai: Number(r.nilai),
      oleh: `${r.penyetuju ?? '-'} (dibuat ${r.pembuat})`,
      keterangan: [r.alasan?.replace(/\n/g, ' '), r.catatan].filter(Boolean).join(' · '),
    });
  }

  for (const r of await baris<{
    tanggal: string;
    dokumen: string;
    pemasok: string;
    nilai: string;
    oleh: string;
    syarat: string | null;
  }>(sql`
    select pb.tanggal_operasional::text tanggal, pb.nomor dokumen, pm.nama_pemasok pemasok,
           pb.total_faktur::text nilai, u.nama_pengguna oleh, pb.syarat_bayar syarat
      from penerimaan_barang pb
      join pemasok pm on pm.id = pb.id_pemasok
      join pengguna u on u.id = pb.id_pengguna
     where pb.jenis = 'PEMBELIAN' and pb.id_order_pembelian is null
       and pb.tanggal_operasional between ${dari} and ${sampai}
     order by pb.id`)) {
    k.push({
      kelompok: 'Penerimaan tanpa order',
      tanggal: r.tanggal,
      dokumen: r.dokumen,
      pemasok: r.pemasok,
      nilai: Number(r.nilai),
      oleh: r.oleh,
      keterangan: r.syarat === 'TEMPO' ? 'Tempo' : 'Tunai',
    });
  }

  for (const r of await baris<{
    tanggal: string;
    dokumen: string;
    pemasok: string;
    barang: string;
    harga_order: string;
    harga_faktur: string;
    oleh: string;
  }>(sql`
    select pb.tanggal_operasional::text tanggal, pb.nomor dokumen, pm.nama_pemasok pemasok,
           b.nama_barang barang, coalesce(od.harga_konfirmasi, od.harga_perkiraan)::text harga_order,
           d.harga_modal_masuk::text harga_faktur, u.nama_pengguna oleh
      from penerimaan_barang_detail d
      join penerimaan_barang pb on pb.id = d.id_penerimaan
      join order_pembelian_detail od on od.id = d.id_order_pembelian_detail
      join barang b on b.id = d.id_barang
      join pemasok pm on pm.id = pb.id_pemasok
      join pengguna u on u.id = pb.id_pengguna
     where pb.tanggal_operasional between ${dari} and ${sampai}
       and coalesce(od.harga_konfirmasi, od.harga_perkiraan) > 0
       and d.harga_modal_masuk > coalesce(od.harga_konfirmasi, od.harga_perkiraan) * (1 + ${ambang}::numeric / 100)
     order by pb.id`)) {
    k.push({
      kelompok: `Harga faktur naik > ${ambang}% dari order`,
      tanggal: r.tanggal,
      dokumen: r.dokumen,
      pemasok: r.pemasok,
      nilai: Number(r.harga_faktur),
      oleh: r.oleh,
      keterangan: `${r.barang}: ${formatRupiah(Number(r.harga_order))} → ${formatRupiah(Number(r.harga_faktur))}`,
    });
  }

  for (const r of await baris<{
    tanggal: string;
    dokumen: string;
    pemasok: string;
    sisa: string;
    oleh: string;
    alasan: string | null;
    jatuh: string | null;
  }>(sql`
    select pb.tanggal_operasional::text tanggal, pb.nomor dokumen, pm.nama_pemasok pemasok,
           (pb.total_faktur - pb.total_dibayar)::text sisa, u.nama_pengguna oleh,
           pb.alasan_penyimpangan alasan, pb.tanggal_jatuh_tempo::text jatuh
      from penerimaan_barang pb
      join pemasok pm on pm.id = pb.id_pemasok
      join pengguna u on u.id = coalesce(pb.id_penyetuju_penyimpangan, pb.id_pengguna)
     where pb.penyimpangan_bayar and pb.tanggal_operasional between ${dari} and ${sampai}
     order by pb.id`)) {
    k.push({
      kelompok: 'Bayar kurang dari kesepakatan',
      tanggal: r.tanggal,
      dokumen: r.dokumen,
      pemasok: r.pemasok,
      nilai: Number(r.sisa),
      oleh: r.oleh,
      keterangan: `${r.alasan ?? ''} · jatuh tempo ${r.jatuh ? teksTanggalAngka(r.jatuh) : '-'}`,
    });
  }

  for (const r of await baris<{
    tanggal: string;
    dokumen: string;
    pemasok: string;
    barang: string;
    qty: string;
    alasan: string;
    tindakan: string;
    oleh: string;
  }>(sql`
    select pb.tanggal_operasional::text tanggal, pb.nomor dokumen, pm.nama_pemasok pemasok,
           b.nama_barang barang, t.qty::text qty, t.alasan, t.tindakan, u.nama_pengguna oleh
      from penerimaan_barang_tolak t
      join penerimaan_barang pb on pb.id = t.id_penerimaan
      join barang b on b.id = t.id_barang
      join pemasok pm on pm.id = pb.id_pemasok
      join pengguna u on u.id = pb.id_pengguna
     where pb.tanggal_operasional between ${dari} and ${sampai}
     order by t.id`)) {
    k.push({
      kelompok: 'Barang ditolak saat datang',
      tanggal: r.tanggal,
      dokumen: r.dokumen,
      pemasok: r.pemasok,
      nilai: null,
      oleh: r.oleh,
      keterangan: `${r.barang} ${Number(r.qty)}: ${r.alasan} (${r.tindakan === 'GANTI' ? 'minta ganti' : 'kurangi order'})`,
    });
  }

  for (const r of await baris<{
    tanggal: string;
    dokumen: string;
    pemasok: string;
    lama: string;
    baru: string;
    alasan: string;
    oleh: string;
  }>(sql`
    select (x.dibuat_pada at time zone 'Asia/Jakarta')::date::text tanggal, pb.nomor dokumen,
           pm.nama_pemasok pemasok, x.tanggal_lama::text lama, x.tanggal_baru::text baru, x.alasan,
           u.nama_pengguna oleh
      from perpanjangan_jatuh_tempo x
      join penerimaan_barang pb on pb.id = x.id_penerimaan
      join pemasok pm on pm.id = pb.id_pemasok
      join pengguna u on u.id = x.id_pengguna
     where (x.dibuat_pada at time zone 'Asia/Jakarta')::date between ${dari} and ${sampai}
     order by x.id`)) {
    k.push({
      kelompok: 'Jatuh tempo diperpanjang',
      tanggal: r.tanggal,
      dokumen: r.dokumen,
      pemasok: r.pemasok,
      nilai: null,
      oleh: r.oleh,
      keterangan: `${teksTanggalAngka(r.lama)} → ${teksTanggalAngka(r.baru)}: ${r.alasan}`,
    });
  }

  for (const r of await baris<{
    tanggal: string;
    aksi: string;
    oleh: string;
    ringkasan: string;
  }>(sql`
    select (l.waktu at time zone 'Asia/Jakarta')::date::text tanggal, l.aksi, coalesce(u.nama_pengguna, '-') oleh,
           coalesce(l.ringkasan, '') ringkasan
      from log_aktivitas l
      left join pengguna u on u.id = l.id_pengguna
     where (l.aksi = 'PEMASOK_BUAT' or (l.aksi = 'PEMASOK_UBAH' and l.ringkasan like '%rekening%'))
       and (l.waktu at time zone 'Asia/Jakarta')::date between ${dari} and ${sampai}
     order by l.id`)) {
    k.push({
      kelompok: r.aksi === 'PEMASOK_BUAT' ? 'Pemasok baru' : 'Rekening pemasok diubah',
      tanggal: r.tanggal,
      dokumen: '-',
      pemasok: '-',
      nilai: null,
      oleh: r.oleh,
      keterangan: r.ringkasan,
    });
  }
  return k;
}

export async function laporanPengawasanPembelian(
  p: DataPengawasanPembelian,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const k = await hitungPengawasanPembelian(p);
  const kelompok = [...new Set(k.map((x) => x.kelompok))];
  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  for (const g of kelompok) {
    const anggota = k.filter((x) => x.kelompok === g);
    isi.push({ gaya: 'grup', sel: [], label: `${g} (${anggota.length})` });
    for (const x of anggota) {
      isi.push({
        gaya: 'data',
        sel: [
          angka(++no),
          teks(teksTanggalAngka(x.tanggal)),
          teks(x.dokumen, { mono: true }),
          teks(x.pemasok),
          x.nilai === null ? KOSONG : uang(x.nilai),
          teks(x.oleh),
          teks(x.keterangan),
        ],
      });
    }
  }
  const jumlah = (g: string) => k.filter((x) => x.kelompok.startsWith(g)).length;
  return susunDokumen('pengawasan-pembelian', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), SATUAN_RUPIAH],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'info',
        judul: 'I. Ikhtisar',
        pasangan: [
          { label: 'Order disetujui', nilai: String(jumlah('Order disetujui')) },
          { label: 'Penerimaan tanpa order', nilai: String(jumlah('Penerimaan tanpa order')) },
          { label: 'Harga faktur naik dari order', nilai: String(jumlah('Harga faktur naik')) },
          { label: 'Bayar kurang dari kesepakatan', nilai: String(jumlah('Bayar kurang')) },
          { label: 'Barang ditolak saat datang', nilai: String(jumlah('Barang ditolak')) },
          { label: 'Jatuh tempo diperpanjang', nilai: String(jumlah('Jatuh tempo')) },
          {
            label: 'Pemasok baru / rekening diubah',
            nilai: `${jumlah('Pemasok baru')} / ${jumlah('Rekening pemasok')}`,
          },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'II. Rincian Kejadian',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Tanggal', jenis: 'teks', lebar: 10 },
            { judul: 'Dokumen', jenis: 'teks', lebar: 15 },
            { judul: 'Pemasok', jenis: 'teks', lebar: 20 },
            { judul: 'Nilai', jenis: 'uang', lebar: 13 },
            { judul: 'Oleh', jenis: 'teks', lebar: 18 },
            { judul: 'Keterangan', jenis: 'teks', lebar: 45 },
          ],
          baris: isi,
          kosong: 'Tidak ada kejadian yang perlu diawasi dalam periode ini.',
        },
      },
    ],
    catatan: [
      'Order disetujui: nilai = jumlah qty × harga berlaku; "Oleh" = penyetuju (pembuat order dalam kurung).',
      'Nilai baris harga faktur naik = harga faktur per satuan; bayar kurang = sisa yang menjadi hutang.',
      'Pemasok baru dan perubahan rekening diambil dari log aktivitas.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
