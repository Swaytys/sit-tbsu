import type { Peran } from './enums';
import type { Izin } from './permissions';

/*
 * Peran → izin (matriks docs/04 §3). Menambah atau memindahkan kemampuan cukup mengubah berkas ini; route tidak
 * menyebut nama peran.
 *
 * K-225 (V2): peran dipisah menurut pemisahan tugas. Nilai `ADMIN` dipertahankan untuk akun lama dan kini berarti
 * **Kepala Toko** (manajemen harian toko, menyetujui koreksi dan pembelian). Peran baru:
 *  - ADMIN_SISTEM: akun karyawan, cadangan, akses perangkat; tanpa uang, tanpa harga modal, tanpa persetujuan;
 *  - ADMIN_PERSEDIAAN: barang, pembelian (draf), penerimaan, opname, pengiriman; tanpa menyetujui dan membayar;
 *  - PETUGAS_GUDANG: melihat barang/stok dan mencatat muat/hasil kirim (akun HP gudang).
 * Staf ⊂ Kasir ⊂ Kepala Toko ⊂ Owner tetap bertingkat; tiga peran baru berdiri sendiri.
 */

const IZIN_STAF: readonly Izin[] = [
  'master.barang.lihat',
  'master.pelanggan.lihat',
  'master.pelanggan.kelola',
  'penjualan.order.buat',
  'penjualan.order.batal_sendiri',
  'persediaan.stok.lihat_tersedia',
  'dashboard.dasar',
];

const IZIN_KASIR: readonly Izin[] = [
  ...IZIN_STAF,
  'penjualan.order.batal',
  'penjualan.order.lihat_semua',
  'penjualan.checkout',
  'penjualan.pembayaran.catat',
  // K-243: kasir bawaan tanpa tugas pengantaran; diberikan per akun bila toko mendelegasikannya.
  'penjualan.riwayat.lihat',
  'penjualan.piutang.lihat',
  'retur.ajukan',
  'void.ajukan',
  'kas.shift.kelola_sendiri',
  'kas.rekening.lihat',
  'dashboard.omzet',
  'laporan.penjualan',
  'laporan.piutang',
  'laporan.ekspor',
];

/** Pekerjaan administrasi persediaan dan pembelian (dipakai Admin Persediaan dan Kepala Toko). */
const IZIN_ADMINISTRASI_PERSEDIAAN: readonly Izin[] = [
  'master.barang.lihat',
  'master.barang.lihat_hpp',
  'master.barang.kelola',
  'master.kategori.kelola',
  'master.satuan.kelola',
  'master.harga.kelola',
  'master.harga.tinjau',
  'master.pemasok.lihat',
  'master.pemasok.kelola',
  'master.armada.kelola',
  'master.import.jalankan',
  'master.pelanggan.lihat',
  'persediaan.stok.lihat_tersedia',
  'persediaan.stok.lihat',
  'persediaan.penerimaan.kelola',
  'persediaan.penyesuaian.kelola',
  'persediaan.opname.hitung',
  'persediaan.segel.buka',
  'persediaan.retur_pemasok.kelola',
  'penjualan.surat_jalan.kelola',
  'penjualan.riwayat.lihat',
  'hutang.lihat',
  'konsinyasi.kelola',
  'laporan.persediaan',
  'laporan.hutang',
  'laporan.ekspor',
  'dashboard.dasar',
];

/** Kepala Toko (nilai lama `ADMIN`). */
const IZIN_KEPALA_TOKO: readonly Izin[] = [
  ...new Set<Izin>([
    ...IZIN_KASIR,
    ...IZIN_ADMINISTRASI_PERSEDIAAN,
    'sistem.pengaturan.kelola',
    'master.pelanggan.atur_kredit',
    'penjualan.harga_manual',
    'penjualan.order.lepas_paksa',
    'retur.setujui',
    'void.setujui',
    'hutang.kelola',
    'kas.shift.lihat_semua',
    'kas.nontunai.verifikasi',
    'laporan.laba',
    'promo.kelola',
    'pembelian.setujui',
    'persediaan.opname.atur',
  ]),
];

const IZIN_ADMIN_SISTEM: readonly Izin[] = [
  'master.barang.lihat',
  'master.pengguna.kelola',
  'sistem.cadangan.kelola',
  'sistem.akses.kelola',
  'persediaan.stok.lihat_tersedia',
  'dashboard.dasar',
];

const IZIN_PETUGAS_GUDANG: readonly Izin[] = [
  'master.barang.lihat',
  'persediaan.stok.lihat_tersedia',
  'persediaan.stok.lihat',
  // K-227: penghitung opname (lewat HP gudang) dan pembuka box segel.
  'persediaan.opname.hitung',
  'persediaan.segel.buka',
  'penjualan.surat_jalan.kelola',
  'dashboard.dasar',
];

const IZIN_OWNER: readonly Izin[] = [
  ...new Set<Izin>([
    ...IZIN_KEPALA_TOKO,
    ...IZIN_ADMIN_SISTEM,
    'sistem.log.lihat',
    'sistem.data.kelola',
    'pembelian.setujui_semua',
    'sistem.izin.atur',
  ]),
];

export const IZIN_PER_PERAN: Readonly<Record<Peran, ReadonlySet<Izin>>> = {
  STAF_PENJUALAN: new Set(IZIN_STAF),
  KASIR: new Set(IZIN_KASIR),
  ADMIN: new Set(IZIN_KEPALA_TOKO),
  ADMIN_SISTEM: new Set(IZIN_ADMIN_SISTEM),
  ADMIN_PERSEDIAAN: new Set(IZIN_ADMINISTRASI_PERSEDIAAN),
  PETUGAS_GUDANG: new Set(IZIN_PETUGAS_GUDANG),
  OWNER: new Set(IZIN_OWNER),
};

/**
 * K-243: izin yang hanya milik Owner dan tidak bisa diberikan ke akun/peran khusus lain (menentukan siapa pemilik:
 * mengganti data toko, menyetujui pembelian tanpa batas, dan mengatur izin itu sendiri).
 */
export const IZIN_KHUSUS_OWNER: readonly Izin[] = [
  'sistem.data.kelola',
  'pembelian.setujui_semua',
  'sistem.izin.atur',
];

/** K-243: penyesuaian izin (peran khusus atau akun): ditambah/dicabut dari izin bawaan peran. */
export type PenyesuaianIzin = { tambah: readonly string[]; cabut: readonly string[] };

const IZIN_SAH = new Set<string>(Object.values(IZIN_PER_PERAN).flatMap((s) => [...s]));

/**
 * K-243: izin efektif = izin bawaan peran, lalu penyesuaian peran khusus, lalu penyesuaian akun. Owner selalu
 * memegang semua izin; izin khusus Owner tidak pernah ikut untuk peran lain; nilai yang tidak dikenal diabaikan.
 */
export function izinEfektif(
  peran: Peran,
  kustom: PenyesuaianIzin | null,
  akun: PenyesuaianIzin | null,
): Set<Izin> {
  if (peran === 'OWNER') return new Set(IZIN_PER_PERAN.OWNER);
  const s = new Set<Izin>(IZIN_PER_PERAN[peran]);
  for (const p of [kustom, akun]) {
    if (!p) continue;
    for (const i of p.tambah) if (IZIN_SAH.has(i)) s.add(i as Izin);
    for (const i of p.cabut) s.delete(i as Izin);
  }
  for (const i of IZIN_KHUSUS_OWNER) s.delete(i);
  return s;
}

export function punyaIzin(peran: Peran, izin: Izin): boolean {
  return IZIN_PER_PERAN[peran].has(izin);
}

/** Daftar izin sebuah peran (dikirim ke web setelah login untuk menyaring menu). */
export function izinPeran(peran: Peran): Izin[] {
  return [...IZIN_PER_PERAN[peran]];
}

export const LABEL_PERAN: Record<Peran, string> = {
  STAF_PENJUALAN: 'Staf Penjualan',
  KASIR: 'Kasir',
  ADMIN: 'Kepala Toko',
  ADMIN_SISTEM: 'Administrator Sistem',
  ADMIN_PERSEDIAAN: 'Admin Persediaan',
  PETUGAS_GUDANG: 'Petugas Gudang',
  OWNER: 'Owner',
};

/** Penjelasan singkat tiap peran untuk form Data Pengguna (K-225). */
export const KET_PERAN: Record<Peran, string> = {
  STAF_PENJUALAN: 'Mencatat order pembeli; tidak memegang uang.',
  KASIR: 'Shift, pembayaran, struk; mengajukan retur/void.',
  ADMIN:
    'Manajemen harian toko: menyetujui retur/void, pembelian sampai batas, selisih stok; harga, laporan laba.',
  ADMIN_SISTEM:
    'Akun karyawan, cadangan, akses HP/tablet. Tidak memegang uang dan tidak melihat harga modal.',
  ADMIN_PERSEDIAAN:
    'Barang & harga, order pembelian (draf), penerimaan, opname, pengiriman. Tidak menyetujui dan tidak membayar.',
  PETUGAS_GUDANG: 'Melihat barang dan stok, mencatat muat dan hasil kirim (akun HP gudang).',
  OWNER: 'Semua, termasuk persetujuan di atas batas, data toko, dan log aktivitas.',
};

/**
 * Peran yang boleh diatur Administrator Sistem (bukan Owner). Akun Owner, Kepala Toko, dan Administrator Sistem
 * hanya diatur Owner, agar bawahan tidak bisa menaikkan wewenang sendiri.
 */
export const PERAN_DIATUR_ADMIN_SISTEM: readonly Peran[] = [
  'STAF_PENJUALAN',
  'KASIR',
  'ADMIN_PERSEDIAAN',
  'PETUGAS_GUDANG',
];
