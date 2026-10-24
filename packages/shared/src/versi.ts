/*
 * K-166: nomor versi dan catatan perubahan yang tampil di aplikasi (menu pengguna › Tentang aplikasi). Dinaikkan
 * setiap rilis ke server toko: angka tengah = fase/gelombang, angka akhir = perbaikan. Catatan ditulis untuk
 * pengguna (bukan istilah teknis); rincian teknis tetap di docs/11.
 */

export const VERSI_APLIKASI = '1.14.0';

export type CatatanRilis = { versi: string; tanggal: string; isi: string[] };

export const CATATAN_RILIS: CatatanRilis[] = [
  {
    versi: '1.14.0',
    tanggal: '2026-10-24',
    isi: [
      'Logistik › Pengiriman: papan rit (rencanakan, seret order kirim, dimuat, berangkat, catat hasil).',
      'Data muatan barang dan kendaraan; pemeriksaan muatan saat berangkat; isi massal lewat Excel.',
      'Catatan BBM dan servis, pengingat servis dan STNK/KIR, statistik armada.',
      'Kampanye promo: waktu sampai menit, hari/jam berlaku, banyak barang/kategori/merk, harga khusus, beli X gratis Y, templat.',
      'Arsip tahunan (Pengaturan › Arsip tahunan): tutup tahun, berkas arsip, periksa, buka kembali.',
      'Pencarian universal Ctrl+K; kiriman ganda dicegah; perubahan data master bersamaan terdeteksi.',
      'Pembaruan aplikasi lebih aman: uji migrasi pada salinan database dan pemeriksaan setelah menyala.',
    ],
  },
];
