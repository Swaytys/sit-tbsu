import {
  DASAR_MARKUP,
  JENIS_USAHA,
  KERTAS_DOKUMEN,
  LAYANAN_TOKO,
  type LayananToko,
  KODE_DOKUMEN,
  PILIHAN_BARIS_PER_HALAMAN,
  type KertasDokumen,
  type KodeDokumen,
  type Pengaturan,
  type StrukCetak,
  type TampilanToko,
  type TipeKonfigurasi,
} from '@sit/shared';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { bacaGambar, hapusBerkas, simpanGambar } from '../../../lib/penyimpanan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { barangBerformula } from '../../master/harga/repo';
import { konteksDari, tanggapiPemicuHarga } from '../../master/harga/service';
import { invalidasiKonfigurasi, semuaNilai } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import * as repo from './repo';

/*
 * Halaman Pengaturan (roadmap Fase 2). Nilai disimpan sebagai key-value di tabel `konfigurasi`
 * (docs/03 §6); berkas ini memetakan kode konfigurasi ↔ bentuk terstruktur `Pengaturan`.
 */

type Peta = ReadonlyMap<string, string | null>;
type Entri = { kode: string; nilai: string; tipe: TipeKonfigurasi };

function teks(m: Peta, kode: string, bawaan: string): string {
  return m.get(kode) ?? bawaan;
}

function angka(m: Peta, kode: string, bawaan: number): number {
  const nilai = m.get(kode)?.trim();
  return nilai && /^-?\d+$/.test(nilai) ? Number.parseInt(nilai, 10) : bawaan;
}

/** K-095: cara cetak struk; nilai tidak dikenal dianggap OTOMATIS. */
function strukCetak(nilai: string | null | undefined): StrukCetak {
  return nilai === 'TANYA' || nilai === 'TIDAK' ? nilai : 'OTOMATIS';
}

/** K-124: kertas dokumen; nilai tidak dikenal memakai bawaan. */
function kertas(nilai: string | null | undefined, bawaan: KertasDokumen): KertasDokumen {
  return KERTAS_DOKUMEN.find((k) => k === nilai) ?? bawaan;
}

/** Lebar kertas struk thermal yang didukung; nilai lain dianggap 80 mm. */
function lebarStruk(mm: number): 57 | 58 | 80 {
  return mm === 57 || mm === 58 ? mm : 80;
}

function bool(m: Peta, kode: string, bawaan: boolean): boolean {
  const nilai = m.get(kode);
  return nilai === 'true' ? true : nilai === 'false' ? false : bawaan;
}

function barisPerHalaman(m: Peta): number {
  const n = angka(m, 'baris_per_halaman', 25);
  return (PILIHAN_BARIS_PER_HALAMAN as readonly number[]).includes(n) ? n : 25;
}

/** Nilai bawaan sama dengan seed (docs/03 §6) bila baris konfigurasi belum ada. */
export function dariKonfigurasi(m: Peta): Pengaturan {
  const dasarMarkup = m.get('dasar_markup');
  return {
    profil: {
      namaToko: teks(m, 'nama_toko', 'BonsaiUrip'),
      namaBadanUsaha: teks(m, 'nama_badan_usaha', ''),
      jenisUsaha: JENIS_USAHA.find((j) => j === m.get('jenis_usaha')) ?? 'BAHAN_BANGUNAN',
      jenisUsahaLain: teks(m, 'jenis_usaha_lain', ''),
      sloganToko: teks(m, 'slogan_toko', ''),
      kotaToko: teks(m, 'kota_toko', ''),
      alamatToko: teks(m, 'alamat_toko', ''),
      telpToko: teks(m, 'telp_toko', ''),
      emailToko: teks(m, 'email_toko', ''),
      footerStruk: teks(m, 'footer_struk', ''),
      lebarStrukMm: lebarStruk(angka(m, 'lebar_struk_mm', 80)),
      strukTampilkanNama: bool(m, 'struk_tampilkan_nama', true),
      strukTampilkanLogo: bool(m, 'struk_tampilkan_logo', false),
      strukCetak: strukCetak(m.get('struk_cetak')),
      // Bawaan K-124 = perilaku sebelumnya: invoice hanya bila diminta, surat jalan langsung dicetak.
      invoiceCetak: m.has('invoice_cetak') ? strukCetak(m.get('invoice_cetak')) : 'TIDAK',
      suratJalanCetak: strukCetak(m.get('surat_jalan_cetak')),
      kertasInvoice: kertas(m.get('kertas_invoice'), 'A4_LANSKAP'),
      kertasSuratJalan: kertas(m.get('kertas_surat_jalan'), 'A4_LANSKAP'),
      kertasDokumenLain: kertas(m.get('kertas_dokumen_lain'), 'A4_POTRET'),
      suratJalanRangkap: bool(m, 'surat_jalan_rangkap', true),
    },
    penomoran: {
      prefix: Object.fromEntries(KODE_DOKUMEN.map((k) => [k, teks(m, `prefix_${k}`, k)])) as Record<
        KodeDokumen,
        string
      >,
      digitNomor: angka(m, 'digit_nomor', 3),
    },
    operasional: {
      ambangRestockPersen: angka(m, 'ambang_restock_persen', 20),
      stokMinimumDefault: angka(m, 'stok_minimum_default', 5),
      batasUmurOrderJam: angka(m, 'batas_umur_order_jam', 24),
      autoBatalOrderBasi: bool(m, 'auto_batal_order_basi', false),
      batasKunciOrderMenit: angka(m, 'batas_kunci_order_menit', 30),
      termHariDefault: angka(m, 'term_hari_default', 0),
      jatuhTempoDefaultHari: angka(m, 'jatuh_tempo_default_hari', 7),
      checkoutWajibShift: bool(m, 'checkout_wajib_shift', true),
      shiftJamBuka: teks(m, 'shift_jam_buka', ''),
      shiftJamTutup: teks(m, 'shift_jam_tutup', ''),
      toleransiSelisihKas: angka(m, 'toleransi_selisih_kas', 1000),
      batasHitungBukaMenit: angka(m, 'batas_hitung_buka_menit', 60),
      saranPesanPeriodeHari: angka(m, 'saran_pesan_periode_hari', 30),
      saranPesanHariPengaman: angka(m, 'saran_pesan_hari_pengaman', 2),
      saranPesanLamaKirim: angka(m, 'saran_pesan_lama_kirim_default', 3),
      saranPesanJarakBelanja: angka(m, 'saran_pesan_jarak_belanja_default', 7),
      muatanFaktorIsiPersen: angka(m, 'muatan_faktor_isi_persen', 85),
      muatanJulurMaksCm: angka(m, 'muatan_julur_maks_cm', 100),
      muatanToleransiPersen: angka(m, 'muatan_toleransi_persen', 110),
      batasReturTanpaSetuju: angka(m, 'batas_retur_tanpa_persetujuan', 0),
      batasVoidTanpaSetuju: angka(m, 'batas_void_tanpa_persetujuan', 0),
      barisPerHalaman: barisPerHalaman(m),
    },
    harga: {
      dasarMarkup: DASAR_MARKUP.find((d) => d === dasarMarkup) ?? 'HARGA_BELI_TERAKHIR',
      pembulatanHarga: angka(m, 'pembulatan_harga', 100),
    },
    keamanan: {
      loginMaksGagal: angka(m, 'login_maks_gagal', 5),
      loginKunciMenit: angka(m, 'login_kunci_menit', 15),
      passwordMin: angka(m, 'password_min', 8),
    },
  };
}

/** Bagian pengaturan → baris konfigurasi (kode, nilai teks, tipe). */
function keKonfigurasi(p: Partial<Pengaturan>): Entri[] {
  const e: Entri[] = [];
  const t = (kode: string, nilai: string) => e.push({ kode, nilai, tipe: 'TEKS' });
  const a = (kode: string, nilai: number) => e.push({ kode, nilai: String(nilai), tipe: 'ANGKA' });
  const b = (kode: string, nilai: boolean) => e.push({ kode, nilai: String(nilai), tipe: 'BOOL' });

  if (p.profil) {
    t('nama_toko', p.profil.namaToko);
    t('nama_badan_usaha', p.profil.namaBadanUsaha);
    t('jenis_usaha', p.profil.jenisUsaha);
    t('jenis_usaha_lain', p.profil.jenisUsahaLain);
    t('slogan_toko', p.profil.sloganToko);
    t('kota_toko', p.profil.kotaToko);
    t('alamat_toko', p.profil.alamatToko);
    t('telp_toko', p.profil.telpToko);
    t('email_toko', p.profil.emailToko);
    t('footer_struk', p.profil.footerStruk);
    a('lebar_struk_mm', p.profil.lebarStrukMm);
    b('struk_tampilkan_nama', p.profil.strukTampilkanNama);
    b('struk_tampilkan_logo', p.profil.strukTampilkanLogo);
    t('struk_cetak', p.profil.strukCetak);
    t('invoice_cetak', p.profil.invoiceCetak);
    t('surat_jalan_cetak', p.profil.suratJalanCetak);
    t('kertas_invoice', p.profil.kertasInvoice);
    t('kertas_surat_jalan', p.profil.kertasSuratJalan);
    t('kertas_dokumen_lain', p.profil.kertasDokumenLain);
    b('surat_jalan_rangkap', p.profil.suratJalanRangkap);
  }
  if (p.penomoran) {
    for (const k of KODE_DOKUMEN) t(`prefix_${k}`, p.penomoran.prefix[k]);
    a('digit_nomor', p.penomoran.digitNomor);
  }
  if (p.operasional) {
    const o = p.operasional;
    a('ambang_restock_persen', o.ambangRestockPersen);
    a('stok_minimum_default', o.stokMinimumDefault);
    a('batas_umur_order_jam', o.batasUmurOrderJam);
    b('auto_batal_order_basi', o.autoBatalOrderBasi);
    a('batas_kunci_order_menit', o.batasKunciOrderMenit);
    a('term_hari_default', o.termHariDefault);
    a('jatuh_tempo_default_hari', o.jatuhTempoDefaultHari);
    b('checkout_wajib_shift', o.checkoutWajibShift);
    t('shift_jam_buka', o.shiftJamBuka);
    t('shift_jam_tutup', o.shiftJamTutup);
    a('toleransi_selisih_kas', o.toleransiSelisihKas);
    a('batas_hitung_buka_menit', o.batasHitungBukaMenit);
    a('saran_pesan_periode_hari', o.saranPesanPeriodeHari);
    a('saran_pesan_hari_pengaman', o.saranPesanHariPengaman);
    a('saran_pesan_lama_kirim_default', o.saranPesanLamaKirim);
    a('saran_pesan_jarak_belanja_default', o.saranPesanJarakBelanja);
    a('muatan_faktor_isi_persen', o.muatanFaktorIsiPersen);
    a('muatan_julur_maks_cm', o.muatanJulurMaksCm);
    a('muatan_toleransi_persen', o.muatanToleransiPersen);
    a('batas_retur_tanpa_persetujuan', o.batasReturTanpaSetuju);
    a('batas_void_tanpa_persetujuan', o.batasVoidTanpaSetuju);
    a('baris_per_halaman', o.barisPerHalaman);
  }
  if (p.harga) {
    t('dasar_markup', p.harga.dasarMarkup);
    a('pembulatan_harga', p.harga.pembulatanHarga);
  }
  if (p.keamanan) {
    a('login_maks_gagal', p.keamanan.loginMaksGagal);
    a('login_kunci_menit', p.keamanan.loginKunciMenit);
    a('password_min', p.keamanan.passwordMin);
  }
  return e;
}

export async function bacaPengaturan(): Promise<Pengaturan> {
  return dariKonfigurasi(await semuaNilai());
}

/**
 * Menyimpan bagian pengaturan yang dikirim. Hanya nilai yang benar-benar berubah yang ditulis dan
 * dicatat di log `PENGATURAN_UBAH` (nilai lama → baru per kode konfigurasi).
 */
export async function ubahPengaturan(
  input: Partial<Pengaturan>,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Pengaturan> {
  const lama = await semuaNilai();
  const berubah = keKonfigurasi(input).filter((e) => (lama.get(e.kode) ?? null) !== e.nilai);
  if (berubah.length === 0) return dariKonfigurasi(lama);

  const waktu = sekarang();
  const aturanHargaBerubah = berubah.some(
    (e) => e.kode === 'dasar_markup' || e.kode === 'pembulatan_harga',
  );
  try {
    await dalamTransaksi(async (tx) => {
      for (const entri of berubah) await repo.simpanKonfigurasi(tx, entri, waktu);
      let ringkasHarga = '';
      if (aturanHargaBerubah) {
        // H5/H7 (K-086): harga yang dihitung dari markup ditinjau ulang dengan aturan baru, di
        // transaksi yang sama. Konteks diambil dari nilai baru (cache konfigurasi belum diperbarui).
        const baru = new Map([...lama, ...berubah.map((e) => [e.kode, e.nilai] as const)]);
        const hasil = await tanggapiPemicuHarga(tx, await barangBerformula(tx), {
          sebab: 'aturan harga di Pengaturan diubah',
          idPengguna: pelaku.id,
          ip: asal.ip,
          tandaiBilaBerubah: true,
          konteks: konteksDari(
            angka(baru, 'pembulatan_harga', 100),
            teks(baru, 'dasar_markup', 'HARGA_BELI_TERAKHIR'),
          ),
        });
        if (hasil.ditandai > 0) ringkasHarga += `; ${hasil.ditandai} barang perlu tinjau harga`;
        if (hasil.diterapkan > 0)
          ringkasHarga += `; harga otomatis ${hasil.diterapkan} barang naik`;
      }
      await catatLog(tx, {
        aksi: 'PENGATURAN_UBAH',
        idPengguna: pelaku.id,
        entitas: 'konfigurasi',
        ringkasan: `Mengubah pengaturan: ${berubah.map((e) => e.kode).join(', ')}${ringkasHarga}`,
        dataLama: Object.fromEntries(berubah.map((e) => [e.kode, lama.get(e.kode) ?? null])),
        dataBaru: Object.fromEntries(berubah.map((e) => [e.kode, e.nilai])),
        ip: asal.ip,
      });
    });
  } finally {
    invalidasiKonfigurasi();
  }
  return bacaPengaturan();
}

// --- Tampilan toko dan logo (K-065) ---

const FOLDER_TOKO = 'toko';

function urlLogo(nama: string | null | undefined): string | null {
  return nama ? `/api/pengaturan/logo?v=${encodeURIComponent(nama)}` : null;
}

/** Nama toko, logo, dan jumlah baris per halaman: dibaca semua pengguna login (sidebar, tabel). */
export async function tampilanToko(): Promise<TampilanToko> {
  const m = await semuaNilai();
  const p = dariKonfigurasi(m);
  return {
    namaToko: p.profil.namaToko,
    namaBadanUsaha: p.profil.namaBadanUsaha,
    jenisUsaha: p.profil.jenisUsaha,
    sloganToko: p.profil.sloganToko,
    kotaToko: p.profil.kotaToko,
    layananToko: (m.get('layanan_toko') ?? 'LANGSUNG,ORDER,ANTAR')
      .split(',')
      .filter((l): l is LayananToko => (LAYANAN_TOKO as readonly string[]).includes(l)),
    logo: urlLogo(m.get('logo_toko')),
    barisPerHalaman: p.operasional.barisPerHalaman,
    alamatToko: p.profil.alamatToko,
    telpToko: p.profil.telpToko,
    emailToko: p.profil.emailToko,
    footerStruk: p.profil.footerStruk,
    lebarStrukMm: p.profil.lebarStrukMm,
    strukTampilkanNama: p.profil.strukTampilkanNama,
    strukTampilkanLogo: p.profil.strukTampilkanLogo,
    strukCetak: p.profil.strukCetak,
    invoiceCetak: p.profil.invoiceCetak,
    suratJalanCetak: p.profil.suratJalanCetak,
    kertasInvoice: p.profil.kertasInvoice,
    kertasSuratJalan: p.profil.kertasSuratJalan,
    kertasDokumenLain: p.profil.kertasDokumenLain,
    suratJalanRangkap: p.profil.suratJalanRangkap,
  };
}

async function gantiLogo(
  nama: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<string | null> {
  const lama = (await semuaNilai()).get('logo_toko') ?? '';
  if (lama === nama) return null;
  await dalamTransaksi(async (tx) => {
    await repo.simpanKonfigurasi(tx, { kode: 'logo_toko', nilai: nama, tipe: 'TEKS' }, sekarang());
    await catatLog(tx, {
      aksi: 'PENGATURAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'konfigurasi',
      ringkasan: nama ? 'Mengganti logo toko' : 'Menghapus logo toko',
      dataLama: { logo_toko: lama || null },
      dataBaru: { logo_toko: nama || null },
      ip: asal.ip,
    });
  });
  invalidasiKonfigurasi();
  return lama || null;
}

export async function unggahLogo(
  isi: Uint8Array,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TampilanToko> {
  const nama = await simpanGambar(FOLDER_TOKO, 'logo', isi);
  try {
    await hapusBerkas(FOLDER_TOKO, await gantiLogo(nama, pelaku, asal));
  } catch (err) {
    await hapusBerkas(FOLDER_TOKO, nama);
    throw err;
  }
  return tampilanToko();
}

export async function hapusLogo(pelaku: PenggunaAktif, asal: AsalRequest): Promise<TampilanToko> {
  await hapusBerkas(FOLDER_TOKO, await gantiLogo('', pelaku, asal));
  return tampilanToko();
}

export async function ambilLogo() {
  const nama = (await semuaNilai()).get('logo_toko');
  const berkas = nama ? await bacaGambar(FOLDER_TOKO, nama) : null;
  if (!berkas) throw new AppError('TIDAK_DITEMUKAN', 'Logo toko belum diunggah.', 404);
  return berkas;
}
