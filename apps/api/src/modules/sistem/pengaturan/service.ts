import {
  DASAR_MARKUP,
  KODE_DOKUMEN,
  PERAN,
  type KodeDokumen,
  type Pengaturan,
  type Peran,
  type TipeKonfigurasi,
} from '@sit/shared';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
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

function bool(m: Peta, kode: string, bawaan: boolean): boolean {
  const nilai = m.get(kode);
  return nilai === 'true' ? true : nilai === 'false' ? false : bawaan;
}

/** Nilai bawaan sama dengan seed (docs/03 §6) bila baris konfigurasi belum ada. */
export function dariKonfigurasi(m: Peta): Pengaturan {
  const dasarMarkup = m.get('dasar_markup');
  return {
    profil: {
      namaToko: teks(m, 'nama_toko', 'BonsaiUrip'),
      namaBadanUsaha: teks(m, 'nama_badan_usaha', 'UD. Sumber Urip'),
      alamatToko: teks(m, 'alamat_toko', ''),
      telpToko: teks(m, 'telp_toko', ''),
      emailToko: teks(m, 'email_toko', ''),
      footerStruk: teks(m, 'footer_struk', ''),
      lebarStrukMm: angka(m, 'lebar_struk_mm', 80) === 58 ? 58 : 80,
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
    },
    harga: {
      dasarMarkup: DASAR_MARKUP.find((d) => d === dasarMarkup) ?? 'HARGA_BELI_TERAKHIR',
      pembulatanHarga: angka(m, 'pembulatan_harga', 100),
      batasDiskonPersen: Object.fromEntries(
        PERAN.map((p) => [
          p,
          angka(m, `batas_diskon_persen_${p}`, p === 'ADMIN' || p === 'OWNER' ? 100 : 0),
        ]),
      ) as Record<Peran, number>,
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
    t('alamat_toko', p.profil.alamatToko);
    t('telp_toko', p.profil.telpToko);
    t('email_toko', p.profil.emailToko);
    t('footer_struk', p.profil.footerStruk);
    a('lebar_struk_mm', p.profil.lebarStrukMm);
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
  }
  if (p.harga) {
    t('dasar_markup', p.harga.dasarMarkup);
    a('pembulatan_harga', p.harga.pembulatanHarga);
    for (const peran of PERAN) a(`batas_diskon_persen_${peran}`, p.harga.batasDiskonPersen[peran]);
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
  await dalamTransaksi(async (tx) => {
    for (const entri of berubah) await repo.simpanKonfigurasi(tx, entri, waktu);
    await catatLog(tx, {
      aksi: 'PENGATURAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'konfigurasi',
      ringkasan: `Mengubah pengaturan: ${berubah.map((e) => e.kode).join(', ')}`,
      dataLama: Object.fromEntries(berubah.map((e) => [e.kode, lama.get(e.kode) ?? null])),
      dataBaru: Object.fromEntries(berubah.map((e) => [e.kode, e.nilai])),
      ip: asal.ip,
    });
  });
  invalidasiKonfigurasi();
  return bacaPengaturan();
}
