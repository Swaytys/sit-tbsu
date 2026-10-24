import { describe, expect, it } from 'vitest';
import {
  barisKiriKanan,
  bungkusTeks,
  keAsciiStruk,
  lebarKarakterStruk,
  lebarTitikStruk,
  rasterDariAbu,
  StrukEscPos,
} from './escpos';
import { ukuranKertasCss } from './enums';

/** Teks yang tercetak (tanpa byte perintah), per baris. */
function barisTercetak(b: Uint8Array): string[] {
  const teks: string[] = [];
  let kini = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i]!;
    if (c === 0x1b) i += b[i + 1] === 0x40 ? 1 : b[i + 1] === 0x70 ? 4 : 2;
    else if (c === 0x1d) i += b[i + 1] === 0x56 ? 3 : 2;
    else if (c === 0x0a) {
      teks.push(kini);
      kini = '';
    } else kini += String.fromCharCode(c);
  }
  return teks;
}

describe('ESC/POS struk', () => {
  it('lebar karakter mengikuti lebar kertas', () => {
    expect(lebarKarakterStruk(57)).toBe(32);
    expect(lebarKarakterStruk(58)).toBe(32);
    expect(lebarKarakterStruk(80)).toBe(48);
  });

  it('teks menjadi ASCII: aksen dibuang, tanda baca khusus diganti, sisanya "?"', () => {
    expect(keAsciiStruk('Café · 6 m — 2×')).toBe('Cafe - 6 m - 2x');
    expect(keAsciiStruk('Rp 12.500')).toBe('Rp 12.500');
    expect(keAsciiStruk('半')).toBe('?');
  });

  it('teks dibungkus di spasi; kata terlalu panjang dipotong', () => {
    expect(bungkusTeks('Semen Gresik 40 kg tipe PCC', 12)).toEqual([
      'Semen Gresik',
      '40 kg tipe',
      'PCC',
    ]);
    expect(bungkusTeks('ABCDEFGHIJKL', 5)).toEqual(['ABCDE', 'FGHIJ', 'KL']);
    expect(bungkusTeks('baris 1\nbaris 2', 20)).toEqual(['baris 1', 'baris 2']);
    // Inden baris rincian barang dipertahankan di tiap pecahan.
    expect(bungkusTeks('  2 sak x 55.000 promo', 12)).toEqual(['  2 sak x', '  55.000', '  promo']);
  });

  it('kiri-kanan: nilai selalu rata kanan dan utuh, keterangan yang panjang turun baris', () => {
    expect(barisKiriKanan('TOTAL', 'Rp 125.000', 32)).toEqual(['TOTAL                 Rp 125.000']);
    const b = barisKiriKanan('  12 sak x 55.000 promo akhir tahun', '660.000', 32);
    expect(b.every((x) => x.length <= 32)).toBe(true);
    expect(b.at(-1)!.endsWith(' 660.000')).toBe(true);
    expect(b.at(-1)).toHaveLength(32);
  });

  it('dokumen diawali reset printer; baris tidak melebihi lebar; potong dan laci di akhir', () => {
    const b = new StrukEscPos(32)
      .teks('BonsaiUrip', { tengah: true, tebal: true, besar: true })
      .teks('UD. Sumber Urip, Jl. Raya Peterongan No. 1 Jombang', { tengah: true })
      .garis()
      .kiriKanan('TOTAL', 'Rp 125.000', { tebal: true })
      .maju(3)
      .potong()
      .bukaLaci()
      .selesai();
    // ESC @ (reset), ESC V 0 (tegak/potret), ESC M 0 (font A), ESC G 0 (tanpa double-strike).
    expect([...b.slice(0, 11)]).toEqual([0x1b, 0x40, 0x1b, 0x56, 0, 0x1b, 0x4d, 0, 0x1b, 0x47, 0]);
    // Cetak tebal: double-strike menyala sejak awal dan tidak pernah dimatikan di tengah dokumen.
    const pekat = [
      ...new StrukEscPos(32, { kepekatan: 'TEBAL' }).teks('A', { tebal: true }).selesai(),
    ];
    expect(pekat.slice(8, 11)).toEqual([0x1b, 0x47, 1]);
    expect(pekat.join(',').includes('27,71,0')).toBe(false);
    const baris = barisTercetak(b);
    expect(baris[0]).toBe('BonsaiUrip');
    expect(baris).toContain('-'.repeat(32));
    expect(baris).toContain('TOTAL                 Rp 125.000');
    expect(baris.every((x) => x.length <= 32)).toBe(true);
    // GS V 66 0 (potong) lalu ESC p 0 25 250 (laci) menutup dokumen.
    expect([...b.slice(-9)]).toEqual([0x1d, 0x56, 0x42, 0x00, 0x1b, 0x70, 0x00, 0x19, 0xfa]);
    // Hanya ASCII dan byte perintah yang dikenal.
    expect([...b].every((x) => x <= 0xfa)).toBe(true);
  });

  it('huruf besar memakai setengah lebar baris', () => {
    const b = new StrukEscPos(32).teks('TOKO BANGUNAN SUMBER URIP JOMBANG', { besar: true });
    expect(barisTercetak(b.selesai()).every((x) => x.length <= 16)).toBe(true);
  });

  it('K-124: kepekatan Tebal menebalkan semua huruf; Paling tebal menambah waktu pemanasan', () => {
    const normal = [...new StrukEscPos(32).teks('A').selesai()];
    expect(normal.join(',')).toContain('27,69,0');
    expect(normal.join(',')).not.toContain('27,55,');
    const tebal = [
      ...new StrukEscPos(32, { kepekatan: 'TEBAL' }).teks('A').kiriKanan('B', 'C').selesai(),
    ];
    expect(tebal.join(',')).toContain('27,69,1,29,33,0,65,10');
    expect(tebal.join(',')).toContain('27,69,1,66');
    expect(tebal.join(',')).not.toContain('27,55,');
    const palingTebal = [...new StrukEscPos(32, { kepekatan: 'PALING_TEBAL' }).selesai()];
    expect(palingTebal.slice(11, 16)).toEqual([0x1b, 0x37, 7, 200, 2]);
  });

  it('K-124: logo jadi raster hitam-putih (dithering) dan dikirim per pita GS v 0', () => {
    expect(lebarTitikStruk(32)).toBe(384);
    expect(lebarTitikStruk(48)).toBe(576);
    // 10×2: kiri hitam, kanan putih; titik paling kiri = bit tertinggi.
    const abu = [
      0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255,
    ];
    const r = rasterDariAbu(abu, 10, 2);
    expect(r.lebarByte).toBe(2);
    expect([...r.data]).toEqual([0xf0, 0x00, 0xf0, 0x00]);
    // Abu-abu tengah menjadi pola: kira-kira separuh titik hitam.
    const tengah = rasterDariAbu(new Array(64).fill(128), 8, 8);
    const hitam = [...tengah.data].reduce((n, b) => n + b.toString(2).replace(/0/g, '').length, 0);
    expect(hitam).toBeGreaterThan(20);
    expect(hitam).toBeLessThan(44);
    // Gambar 130 baris = 3 pita (64 + 64 + 2), tiap pita diawali GS v 0 0 xL xH yL yH.
    const tinggi = 130;
    const besar = { lebarByte: 3, tinggi, data: new Uint8Array(3 * tinggi) };
    const b = [...new StrukEscPos(32).gambar(besar).selesai()].join(',');
    expect(b.split('29,118,48,0,3,0,').length - 1).toBe(3);
    expect(b).toContain('29,118,48,0,3,0,2,0');
  });

  it('K-124: pilihan kertas dokumen menjadi ukuran CSS @page', () => {
    expect(ukuranKertasCss('A4_LANSKAP')).toBe('A4 landscape');
    expect(ukuranKertasCss('A4_POTRET')).toBe('A4 portrait');
    expect(ukuranKertasCss('A5_LANSKAP')).toBe('A5 landscape');
    expect(ukuranKertasCss('LETTER_POTRET')).toBe('letter portrait');
    expect(ukuranKertasCss('F4_POTRET')).toBe('215mm 330mm');
    expect(ukuranKertasCss('F4_LANSKAP')).toBe('330mm 215mm');
  });
});
