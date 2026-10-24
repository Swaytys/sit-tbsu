import {
  formatRupiah,
  LABEL_KEPEKATAN_STRUK,
  LABEL_METODE_PEMBAYARAN,
  lebarKarakterStruk,
  lebarTitikStruk,
  StrukEscPos,
  type DetailPenjualan,
  type KepekatanStruk,
  type RasterStruk,
  type TampilanToko,
} from '@sit/shared';
import { formatDesimal, formatTanggal, formatWaktu } from './format';
import { logoStruk } from './logo-struk';
import { bacaPengaturanPrinter, kirimKePrinter } from './printer-thermal';

/*
 * Struk penjualan sebagai perintah ESC/POS (K-103). Isinya sama dengan komponen `Struk` (cetak lewat
 * peramban): logo (K-124, bila dinyalakan), kop, nomor, barang, total, pembayaran, sisa tagihan, penutup.
 */

/** Angka rupiah tanpa "Rp" untuk kolom sempit. */
const angka = (n: number) => formatRupiah(n).replace('Rp ', '');

export function strukKeEscPos(
  p: DetailPenjualan,
  toko: TampilanToko,
  opsi: {
    lebar: number;
    kepekatan: KepekatanStruk;
    potong: boolean;
    bukaLaci: boolean;
    logo?: RasterStruk | null;
  },
): Uint8Array {
  const s = new StrukEscPos(opsi.lebar, { kepekatan: opsi.kepekatan });
  if (opsi.logo) s.gambar(opsi.logo);
  if (toko.strukTampilkanNama) s.teks(toko.namaToko, { tengah: true, tebal: true, besar: true });
  s.teks(toko.namaBadanUsaha, { tengah: true });
  if (toko.alamatToko) s.teks(toko.alamatToko, { tengah: true });
  if (toko.telpToko) s.teks(`Telp. ${toko.telpToko}`, { tengah: true });
  s.garis();
  s.kiriKanan(p.nomor, formatWaktu(p.tanggal));
  s.kiriKanan('Kasir', p.namaKasir);
  const pembeli = p.namaPelanggan ?? p.namaPembeli;
  if (pembeli) s.kiriKanan('Pembeli', pembeli);
  s.garis();
  for (const b of p.baris) {
    s.teks(b.namaBarang);
    s.kiriKanan(
      `  ${formatDesimal(b.qty)} ${b.kodeSatuan} x ${angka(b.hargaSatuan)}`,
      angka(b.subtotal + b.diskonBaris + b.diskonPromo),
    );
    if (b.diskonPromo > 0) s.kiriKanan(`  Promo ${b.namaPromo ?? ''}`, `-${angka(b.diskonPromo)}`);
    if (b.diskonBaris > 0) s.kiriKanan('  Disc', `-${angka(b.diskonBaris)}`);
  }
  s.garis();
  s.kiriKanan('Subtotal', formatRupiah(p.totalBruto - (p.totalDiskon - p.diskonTransaksi)));
  if (p.diskonTransaksi > 0) s.kiriKanan('Diskon', `-${formatRupiah(p.diskonTransaksi)}`);
  if (p.ongkir > 0) s.kiriKanan('Ongkir', formatRupiah(p.ongkir));
  s.kiriKanan('TOTAL', formatRupiah(p.totalNeto), { tebal: true });
  for (const b of p.pembayaran) {
    s.kiriKanan(LABEL_METODE_PEMBAYARAN[b.metode], formatRupiah(b.uangDiterima ?? b.nominal));
  }
  const kembalian = p.pembayaran.reduce((t, b) => t + b.kembalian, 0);
  if (kembalian > 0) s.kiriKanan('Kembali', formatRupiah(kembalian));
  if (p.sisaTagihan > 0) {
    s.kiriKanan('Sisa tagihan', formatRupiah(p.sisaTagihan), { tebal: true });
    if (p.tanggalJatuhTempo) s.kiriKanan('Jatuh tempo', formatTanggal(p.tanggalJatuhTempo));
  }
  if (p.statusPengambilan === 'BELUM_DIAMBIL') {
    s.garis().teks('BARANG BELUM DIAMBIL', { tengah: true, tebal: true });
  }
  if (toko.footerStruk) s.garis().teks(toko.footerStruk, { tengah: true });
  // Kertas dikeluarkan sampai melewati pisau/sobekan.
  s.maju(4);
  if (opsi.potong) s.potong();
  if (opsi.bukaLaci) s.bukaLaci();
  return s.selesai();
}

/** Karakter per baris yang berlaku di komputer ini. */
export function lebarStrukKini(toko: TampilanToko): number {
  return bacaPengaturanPrinter().lebarKarakter ?? lebarKarakterStruk(toko.lebarStrukMm);
}

/**
 * K-124: raster logo toko bila "logo di struk" dinyalakan di Pengaturan; `null` bila mati, belum ada logo,
 * atau gambar gagal dimuat (struk tetap dicetak tanpa logo).
 */
export async function logoUntukStruk(toko: TampilanToko): Promise<RasterStruk | null> {
  if (!toko.strukTampilkanLogo || !toko.logo) return null;
  try {
    return (await logoStruk(toko.logo, lebarTitikStruk(lebarStrukKini(toko)))).raster;
  } catch {
    return null;
  }
}

/**
 * Mencetak struk langsung ke printer thermal komputer ini. Laci uang hanya dibuka pada cetakan pertama
 * penjualan yang menerima tunai (bukan cetak ulang).
 */
export async function cetakStrukLangsung(
  p: DetailPenjualan,
  toko: TampilanToko,
  opsi: { cetakUlang: boolean },
): Promise<void> {
  const atur = bacaPengaturanPrinter();
  const tunai = p.pembayaran.some((b) => b.metode === 'TUNAI');
  const logo = await logoUntukStruk(toko);
  return kirimKePrinter(
    strukKeEscPos(p, toko, {
      lebar: lebarStrukKini(toko),
      kepekatan: atur.kepekatan,
      logo,
      potong: atur.potong,
      bukaLaci: atur.bukaLaci && tunai && !opsi.cetakUlang,
    }),
  );
}

/** Halaman uji: memeriksa sambungan, logo, lebar baris, huruf tebal/besar, kepekatan, dan pemotong. */
export async function cetakUjiLangsung(toko: TampilanToko): Promise<void> {
  const atur = bacaPengaturanPrinter();
  const lebar = lebarStrukKini(toko);
  const logo = await logoUntukStruk(toko);
  const s = new StrukEscPos(lebar, { kepekatan: atur.kepekatan });
  if (logo) s.gambar(logo);
  s.teks(toko.namaToko, { tengah: true, tebal: true, besar: true })
    .teks('UJI CETAK STRUK', { tengah: true, tebal: true })
    .garis()
    .teks(`${lebar} karakter per baris. Baris angka di bawah harus pas satu baris, tidak turun.`)
    .teks('1234567890'.repeat(Math.ceil(lebar / 10)).slice(0, lebar))
    .garis()
    .teks(`Kepekatan: ${LABEL_KEPEKATAN_STRUK[atur.kepekatan]}`)
    .teks(`Logo: ${logo ? 'dicetak' : 'tidak dicetak'}`)
    // Sama dengan susunan baris barang pada struk sungguhan: nama, lalu rincian menjorok dan jumlah di kanan.
    .teks('Semen Gresik 40 kg')
    .kiriKanan('  2 sak x 55.000', '110.000')
    .kiriKanan('TOTAL', 'Rp 110.000', { tebal: true })
    .garis()
    .teks('Bila semua baris di atas terbaca jelas dan tegak, printer siap dipakai.')
    .teks(formatWaktu(new Date().toISOString()), { tengah: true })
    .maju(4);
  if (atur.potong) s.potong();
  if (atur.bukaLaci) s.bukaLaci();
  return kirimKePrinter(s.selesai());
}
