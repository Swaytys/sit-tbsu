import { describe, expect, it } from 'vitest';
import { hitungCelah } from './service';

/* K-242: celah kosong stok sebelum barang datang (Perencanaan Pengadaan). */

const dasar = {
  hariIni: '2026-11-08',
  rata: '20.000',
  stokTersedia: '100.000', // cukup 5 hari → habis 13/11
  lamaKirimHari: 3,
  order: [],
  lamaKirimPemasok: (id: number) => (id === 2 ? 2 : 10),
  pemasokLain: [
    { id: 1, nama: 'Lambat' },
    { id: 2, nama: 'Cepat' },
  ],
  hargaJual: 60_000,
  hpp: 50_000,
};

describe('hitungCelah (K-242)', () => {
  it('tanpa order: aman bila barang yang dipesan hari ini datang sebelum habis', () => {
    expect(hitungCelah(dasar)).toBeNull();
    expect(hitungCelah({ ...dasar, rata: '0' })).toBeNull();
  });

  it('order dengan janji kirim setelah stok habis: hari kosong, penjualan hilang, pemasok lebih cepat', () => {
    const c = hitungCelah({
      ...dasar,
      order: [
        {
          idBarang: 1,
          nomor: 'PO-261108-001',
          idPemasok: 1,
          namaPemasok: 'Lambat',
          noHp: '+6281',
          janji: '2026-11-18',
          diminta: '2026-11-12',
          dipesan: '2026-11-08',
        },
      ],
    });
    expect(c).toMatchObject({
      habisPada: '2026-11-13',
      datangPada: '2026-11-18',
      sumberDatang: 'JANJI',
      nomorOrder: 'PO-261108-001',
      hariKosong: 5,
      qtyHilang: '100.000',
      omzetHilang: 6_000_000,
      labaHilang: 1_000_000,
    });
    expect(c?.pemasokCepat).toEqual([
      { idPemasok: 2, namaPemasok: 'Cepat', lamaKirimHari: 2, datangPada: '2026-11-10' },
    ]);
  });

  it('stok sudah habis dan belum dipesan: kosong selama lama kirim', () => {
    const c = hitungCelah({ ...dasar, stokTersedia: '0', lamaKirimHari: 4 });
    expect(c).toMatchObject({
      habisPada: '2026-11-08',
      datangPada: '2026-11-12',
      sumberDatang: 'PESAN_HARI_INI',
      hariKosong: 4,
    });
  });
});
