import {
  formatRupiah,
  LABEL_JENIS_PENJUALAN,
  LABEL_METODE_PEMBAYARAN,
  LABEL_PENYELESAIAN_RETUR,
  LABEL_STATUS_ITEM,
  LABEL_STATUS_PEMBAYARAN,
  LABEL_STATUS_PERSETUJUAN,
  LABEL_STATUS_TRANSAKSI,
  teksQty,
  teksTanggalPanjang,
  type BagianLaporan,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type KandidatInvoiceLaporan,
  type ParamCariInvoiceLaporan,
} from '@sit/shared';
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { pelanggan, penjualan, returPenjualan, voidTransaksi } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { polaCari } from '../../lib/paginasi';
import { detailPenjualan } from '../penjualan/penjualan/service';
import { angka, KOSONG, qty, SATUAN_RUPIAH, susunDokumen, teks, uang, waktuTeks } from './umum';

/*
 * Laporan Detail Invoice (docs/05 §14): satu penjualan — header, baris barang, rincian tagihan, pembayaran,
 * retur, void, dan surat jalan. Untuk verifikasi transaksi dan penelusuran pembayaran.
 */

export async function cariInvoice(
  p: Required<Pick<ParamCariInvoiceLaporan, 'cari'>> &
    Pick<ParamCariInvoiceLaporan, 'dari' | 'sampai'>,
): Promise<KandidatInvoiceLaporan[]> {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return db
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      tanggalOperasional: penjualan.tanggalOperasional,
      jenisPenjualan: penjualan.jenisPenjualan,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
      totalNeto: penjualan.totalNeto,
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(
      and(
        pola
          ? or(
              ilike(penjualan.nomor, pola),
              ilike(penjualan.namaPembeli, pola),
              ilike(pelanggan.namaPelanggan, pola),
            )
          : undefined,
        p.dari ? gte(penjualan.tanggalOperasional, p.dari) : undefined,
        p.sampai ? lte(penjualan.tanggalOperasional, p.sampai) : undefined,
      ),
    )
    .orderBy(desc(penjualan.tanggalOperasional), desc(penjualan.id))
    .limit(20);
}

export async function laporanDetailInvoice(
  id: number,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const d = await detailPenjualan(id, new Set());
  const retur = await db
    .select({
      nomor: returPenjualan.nomor,
      tanggal: returPenjualan.tanggalOperasional,
      penyelesaian: returPenjualan.penyelesaian,
      status: returPenjualan.status,
      nilai: returPenjualan.totalRetur,
      alasan: returPenjualan.alasan,
    })
    .from(returPenjualan)
    .where(eq(returPenjualan.idPenjualan, id))
    .orderBy(asc(returPenjualan.id));
  const batal = await db
    .select({
      nomor: voidTransaksi.nomor,
      tanggal: voidTransaksi.tanggalOperasional,
      lingkup: voidTransaksi.lingkup,
      status: voidTransaksi.status,
      nominal: voidTransaksi.nominalVoid,
      alasan: voidTransaksi.alasan,
    })
    .from(voidTransaksi)
    .where(eq(voidTransaksi.idPenjualan, id))
    .orderBy(asc(voidTransaksi.id));

  const pembeli = d.namaPelanggan ?? d.namaPembeli ?? 'Pembeli umum';
  const adaStatusKhusus = d.baris.some((b) => b.statusItem !== 'NORMAL');
  const jumlahBarang = d.baris.reduce((t, b) => t + b.subtotal, 0);
  const isiBarang: BarisTabelLaporan[] = d.baris.map((b, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      teks(b.kodeBarang, { mono: true }),
      teks(b.namaBarang),
      qty(b.qty),
      teks(b.kodeSatuan),
      uang(b.hargaSatuan),
      b.diskonBaris > 0 ? uang(b.diskonBaris) : KOSONG,
      uang(b.subtotal),
      ...(adaStatusKhusus
        ? [
            teks(LABEL_STATUS_ITEM[b.statusItem], {
              nada: b.statusItem === 'NORMAL' ? undefined : 'peringatan',
            }),
          ]
        : []),
    ],
  }));
  isiBarang.push({
    gaya: 'total',
    label: 'Jumlah harga barang',
    sel: [
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      uang(jumlahBarang),
      ...(adaStatusKhusus ? [KOSONG] : []),
    ],
  });

  const totalSetelahKoreksi = d.totalNeto - d.totalVoid - d.totalRetur;
  const bagian: BagianLaporan[] = [
    {
      jenis: 'info',
      pasangan: [
        { label: 'No. transaksi', nilai: d.nomor },
        { label: 'Status transaksi', nilai: LABEL_STATUS_TRANSAKSI[d.statusTransaksi] },
        { label: 'Tanggal', nilai: `${waktuTeks(d.tanggal)} WIB` },
        { label: 'Status pembayaran', nilai: LABEL_STATUS_PEMBAYARAN[d.statusPembayaran] },
        { label: 'Pembeli', nilai: pembeli },
        {
          label: 'Jatuh tempo',
          nilai: d.tanggalJatuhTempo ? teksTanggalPanjang(d.tanggalJatuhTempo) : '—',
        },
        { label: 'Jenis penjualan', nilai: LABEL_JENIS_PENJUALAN[d.jenisPenjualan] },
        { label: 'Dibuat oleh', nilai: d.namaKasir },
        ...(d.alamatKirim ? [{ label: 'Alamat kirim', nilai: d.alamatKirim }] : []),
        ...(d.nomorOrder ? [{ label: 'No. order', nilai: d.nomorOrder }] : []),
        ...(d.catatan ? [{ label: 'Catatan', nilai: d.catatan }] : []),
      ],
    },
    {
      jenis: 'tabel',
      judul: 'Rincian Barang',
      tabel: {
        kolom: [
          { judul: 'No', jenis: 'angka', lebar: 5 },
          { judul: 'Kode', jenis: 'teks', lebar: 12 },
          { judul: 'Nama Barang', jenis: 'teks', lebar: 28 },
          { judul: 'Qty', jenis: 'qty', lebar: 8 },
          { judul: 'Satuan', jenis: 'teks', lebar: 8 },
          { judul: 'Harga Satuan', jenis: 'uang', lebar: 13 },
          { judul: 'Diskon', jenis: 'uang', lebar: 11 },
          { judul: 'Subtotal', jenis: 'uang', lebar: 14 },
          ...(adaStatusKhusus ? [{ judul: 'Status', jenis: 'teks' as const, lebar: 12 }] : []),
        ],
        baris: isiBarang,
      },
    },
    {
      jenis: 'ikhtisar',
      judul: 'Rincian Tagihan',
      baris: [
        { label: 'Jumlah harga barang', nilai: uang(jumlahBarang), tingkat: 1 },
        ...(d.diskonTransaksi > 0
          ? [
              {
                label: 'Diskon transaksi',
                nilai: uang(d.diskonTransaksi),
                tingkat: 1 as const,
                gaya: 'kurang' as const,
              },
            ]
          : []),
        ...(d.ongkir > 0
          ? [{ label: 'Ongkos kirim', nilai: uang(d.ongkir), tingkat: 1 as const }]
          : []),
        { label: 'Total invoice', nilai: uang(d.totalNeto), gaya: 'subtotal' },
        ...(d.totalVoid > 0 || d.totalRetur > 0
          ? [
              {
                label: 'Void',
                nilai: uang(d.totalVoid),
                tingkat: 1 as const,
                gaya: 'kurang' as const,
              },
              {
                label: 'Retur',
                nilai: uang(d.totalRetur),
                tingkat: 1 as const,
                gaya: 'kurang' as const,
              },
              {
                label: 'Total setelah koreksi',
                nilai: uang(totalSetelahKoreksi),
                gaya: 'subtotal' as const,
              },
            ]
          : []),
        { label: 'Pembayaran diterima', nilai: uang(d.totalDibayar), tingkat: 1, gaya: 'kurang' },
        ...(d.totalRefund > 0
          ? [
              {
                label: 'Uang dikembalikan (refund)',
                nilai: uang(d.totalRefund),
                tingkat: 1 as const,
              },
            ]
          : []),
        { label: 'SISA TAGIHAN', nilai: uang(d.sisaTagihan), gaya: 'total' },
      ],
    },
    {
      jenis: 'tabel',
      judul: 'Riwayat Pembayaran',
      tabel: {
        kolom: [
          { judul: 'No. Pembayaran', jenis: 'teks', lebar: 17 },
          { judul: 'Waktu', jenis: 'teks', lebar: 16 },
          { judul: 'Jenis', jenis: 'teks', lebar: 10 },
          { judul: 'Metode', jenis: 'teks', lebar: 10 },
          { judul: 'Rekening / Referensi', jenis: 'teks', lebar: 22 },
          { judul: 'Diterima oleh', jenis: 'teks', lebar: 16 },
          { judul: 'Nominal', jenis: 'uang', lebar: 14 },
        ],
        baris: [
          ...d.pembayaran.map((b) => ({
            gaya: 'data' as const,
            sel: [
              teks(b.nomor, { mono: true }),
              teks(waktuTeks(b.tanggal)),
              teks(b.jenis === 'PENUH' ? 'Penuh' : b.jenis === 'DP' ? 'DP' : 'Pelunasan'),
              teks(LABEL_METODE_PEMBAYARAN[b.metode]),
              teks([b.rekening, b.referensi].filter(Boolean).join(' · ') || '—'),
              teks(b.namaPengguna),
              uang(b.nominal),
            ],
          })),
          ...(d.pembayaran.length > 0
            ? [
                {
                  gaya: 'total' as const,
                  label: 'Jumlah pembayaran',
                  sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(d.totalDibayar)],
                },
              ]
            : []),
        ],
        kosong: 'Belum ada pembayaran.',
      },
    },
  ];
  if (retur.length > 0) {
    bagian.push({
      jenis: 'tabel',
      judul: 'Retur',
      tabel: {
        kolom: [
          { judul: 'No. Retur', jenis: 'teks', lebar: 17 },
          { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
          { judul: 'Penyelesaian', jenis: 'teks', lebar: 14 },
          { judul: 'Alasan', jenis: 'teks', lebar: 26 },
          { judul: 'Status', jenis: 'teks', lebar: 11 },
          { judul: 'Nilai', jenis: 'uang', lebar: 14 },
        ],
        baris: retur.map((r) => ({
          gaya: 'data' as const,
          sel: [
            teks(r.nomor, { mono: true }),
            { j: 'tanggal' as const, v: r.tanggal },
            teks(LABEL_PENYELESAIAN_RETUR[r.penyelesaian]),
            teks(r.alasan),
            teks(LABEL_STATUS_PERSETUJUAN[r.status]),
            uang(r.nilai),
          ],
        })),
      },
    });
  }
  if (batal.length > 0) {
    bagian.push({
      jenis: 'tabel',
      judul: 'Void',
      tabel: {
        kolom: [
          { judul: 'No. Void', jenis: 'teks', lebar: 17 },
          { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
          { judul: 'Lingkup', jenis: 'teks', lebar: 12 },
          { judul: 'Alasan', jenis: 'teks', lebar: 28 },
          { judul: 'Status', jenis: 'teks', lebar: 11 },
          { judul: 'Nominal', jenis: 'uang', lebar: 14 },
        ],
        baris: batal.map((v) => ({
          gaya: 'data' as const,
          sel: [
            teks(v.nomor, { mono: true }),
            { j: 'tanggal' as const, v: v.tanggal },
            teks(v.lingkup === 'TRANSAKSI' ? 'Transaksi' : 'Per barang'),
            teks(v.alasan),
            teks(LABEL_STATUS_PERSETUJUAN[v.status]),
            uang(v.nominal),
          ],
        })),
      },
    });
  }
  if (d.suratJalan.length > 0) {
    bagian.push({
      jenis: 'tabel',
      judul: 'Surat Jalan',
      tabel: {
        kolom: [
          { judul: 'No. Surat Jalan', jenis: 'teks', lebar: 18 },
          { judul: 'Waktu', jenis: 'teks', lebar: 16 },
          { judul: 'Barang', jenis: 'teks', lebar: 34 },
          { judul: 'Sopir', jenis: 'teks', lebar: 14 },
          { judul: 'Status', jenis: 'teks', lebar: 11 },
        ],
        baris: [...d.suratJalan].reverse().map((s) => ({
          gaya: 'data' as const,
          sel: [
            teks(s.nomor, { mono: true }),
            teks(waktuTeks(s.tanggal)),
            teks(s.baris.map((b) => `${b.namaBarang} ${teksQty(b.qtyKirim)}`).join(', ')),
            teks(s.sopir ?? '—'),
            teks(s.status.charAt(0) + s.status.slice(1).toLowerCase()),
          ],
        })),
      },
    });
  }

  return susunDokumen('detail-invoice', pelaku, {
    subjudul: [`Nomor ${d.nomor} · ${teksTanggalPanjang(d.tanggalOperasional)}`, SATUAN_RUPIAH],
    orientasi: 'potret',
    bagian,
    catatan: [
      'Laporan ini merupakan rincian lengkap satu transaksi beserta seluruh koreksi (void/retur) dan pembayarannya.',
      ...(d.sisaTagihan > 0 && d.tanggalJatuhTempo
        ? [
            `Sisa tagihan ${formatRupiah(d.sisaTagihan)} harap dilunasi paling lambat ${teksTanggalPanjang(d.tanggalJatuhTempo)}.`,
          ]
        : []),
    ],
    berkas: d.nomor,
  });
}
