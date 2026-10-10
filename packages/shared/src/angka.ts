/**
 * Hasil hitung di luar batas angka yang didukung: rupiah di atas `Number.MAX_SAFE_INTEGER` atau kuantitas di
 * luar numeric(14,3). Muncul dari isian yang sah per kolom tetapi terlalu besar setelah dikalikan
 * (mis. qty raksasa × harga raksasa), jadi API menjawabnya sebagai kesalahan isian (400), bukan kesalahan
 * server. Turunan `RangeError` agar pemanggil lama yang menangkap `RangeError` tetap bekerja.
 */
export class GalatAngka extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'GalatAngka';
  }
}
