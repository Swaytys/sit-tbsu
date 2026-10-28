import type {
  InputBarang,
  InputKendaraan,
  InputPelanggan,
  InputPemasok,
  InputSopir,
} from '@sit/shared';

/*
 * K-168: contoh data bernama wajar untuk mencoba aplikasi sebelum data asli diisi. Berbeda dari akun/data demo
 * pengembangan. Ditandai lewat keterangan/catatan dan dicatat id-nya, sehingga bisa dinonaktifkan sekali klik
 * (data master tidak dihapus, CLAUDE.md aturan 4). Barang contoh sengaja tanpa stok: saldo awal adalah transaksi
 * yang tidak bisa dihapus, jadi stok hanya diisi dari data asli.
 */

export const TANDA_CONTOH = 'Data contoh (boleh dinonaktifkan)';

/** Barang: kategori dan satuan dicari dari nama/kode seed; harga jual = harga tetap tier dasar. */
export const CONTOH_BARANG: (Omit<InputBarang, 'idKategori' | 'idSatuanDasar' | 'hargaTier'> & {
  kategori: string;
  satuan: string;
  hargaJual: number;
})[] = [
  {
    namaBarang: 'Semen Gresik 40 kg',
    kategori: 'Semen',
    satuan: 'sak',
    hargaModalAwal: 52_000,
    hargaJual: 56_000,
    muatan: { beratKg: '40', panjangCm: '60', lebarCm: '40', tinggiCm: '12', volumeM3: null },
  },
  {
    namaBarang: 'Pasir Lumajang',
    kategori: 'Agregat',
    satuan: 'm3',
    hargaModalAwal: 250_000,
    hargaJual: 300_000,
    muatan: {
      beratKg: '1500',
      panjangCm: null,
      lebarCm: null,
      tinggiCm: null,
      curah: true,
      volumeM3: '1',
    },
  },
  {
    namaBarang: 'Bata Merah Press',
    kategori: 'Bata & Blok',
    satuan: 'buah',
    hargaModalAwal: 700,
    hargaJual: 850,
    muatan: { beratKg: '2.5', panjangCm: '22', lebarCm: '10', tinggiCm: '5', volumeM3: null },
  },
  {
    namaBarang: 'Cat Tembok Avitex Putih 5 kg',
    kategori: 'Cat & Pelapis',
    satuan: 'pail',
    hargaModalAwal: 95_000,
    hargaJual: 110_000,
    muatan: { beratKg: '5.5', panjangCm: '22', lebarCm: '22', tinggiCm: '20', volumeM3: null },
  },
  {
    namaBarang: 'Pipa PVC Rucika AW 1/2 inci 4 m',
    kategori: 'Pipa & Sanitasi',
    satuan: 'batang',
    hargaModalAwal: 22_000,
    hargaJual: 27_000,
    muatan: { beratKg: '1.1', panjangCm: '400', lebarCm: '2.2', tinggiCm: '2.2', volumeM3: null },
  },
];

export const CONTOH_PELANGGAN: InputPelanggan[] = [
  {
    namaPelanggan: 'Toko Bangunan Makmur',
    noHp: '081230000101',
    alamat: 'Jl. Raya Peterongan No. 12, Jombang',
  },
  {
    namaPelanggan: 'CV Sumber Rejeki',
    noHp: '081230000102',
    alamat: 'Jl. Gatot Subroto 45, Jombang',
  },
  {
    namaPelanggan: 'Pak Slamet (tukang)',
    noHp: '081230000103',
    alamat: 'Dsn. Kepuhrejo RT 02/RW 01, Peterongan',
  },
  {
    namaPelanggan: 'UD Karya Jaya',
    noHp: '081230000104',
    alamat: 'Jl. KH. Wahid Hasyim 88, Jombang',
  },
  {
    namaPelanggan: 'Bu Siti Aminah',
    noHp: '081230000105',
    alamat: 'Perum Griya Indah Blok C-7, Jombang',
  },
];

export const CONTOH_PEMASOK: InputPemasok[] = [
  {
    namaPemasok: 'CV Sinar Bangunan',
    noHp: '081230000201',
    kontakPerson: 'Pak Hadi (sales semen)',
    alamat: 'Jl. Raya Mojoagung 7, Jombang',
  },
  {
    namaPemasok: 'UD Maju Jaya Abadi',
    noHp: '081230000202',
    kontakPerson: 'Bu Rina',
    alamat: 'Desa Sumbermulyo, Jogoroto',
  },
  {
    namaPemasok: 'PT Bahan Bangunan Nusantara',
    noHp: '081230000203',
    kontakPerson: 'Mas Andi (cat & pelapis)',
    alamat: 'Jl. Rungkut Industri 3, Surabaya',
  },
  {
    namaPemasok: 'Toko Besi Sentosa',
    noHp: '081230000204',
    kontakPerson: 'Koh Liem',
    alamat: 'Jl. Merdeka 21, Jombang',
  },
  {
    namaPemasok: 'CV Cahaya Pipa',
    noHp: '081230000205',
    kontakPerson: 'Pak Yusuf',
    alamat: 'Jl. Panglima Sudirman 60, Mojokerto',
  },
];

export const CONTOH_KENDARAAN: InputKendaraan[] = [
  {
    plat: 'S 8123 KA',
    jenis: 'Pikap L300',
    kapasitasKg: 1000,
    bakPanjangCm: 250,
    bakLebarCm: 160,
    bakTinggiCm: 40,
  },
  {
    plat: 'S 9041 KB',
    jenis: 'Truk engkel',
    kapasitasKg: 4000,
    bakPanjangCm: 420,
    bakLebarCm: 200,
    bakTinggiCm: 50,
  },
];

export const CONTOH_SOPIR: InputSopir[] = [
  { nama: 'Pak Darto', noHp: '081230000301' },
  { nama: 'Mas Yoyok', noHp: '081230000302' },
];
