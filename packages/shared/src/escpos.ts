/*
 * Penyusun perintah ESC/POS untuk printer struk thermal (K-103). Struk dikirim sebagai TEKS dan perintah
 * printer (bukan gambar halaman), sehingga hasilnya tajam, cepat, dan tidak bergantung pada ukuran kertas
 * atau driver di komputer. Berkas ini murni menyusun byte; pengirimannya (Bluetooth/USB serial) di web.
 *
 * Printer struk umum mencetak 32 karakter per baris pada kertas 57/58 mm dan 48 pada 80 mm (font A).
 * Teks dikirim sebagai ASCII: huruf beraksen dan tanda baca khusus diganti padanannya, agar tidak
 * bergantung pada halaman kode (code page) printer.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Karakter per baris bawaan menurut lebar kertas (mm). */
export function lebarKarakterStruk(lebarMm: number): number {
  return lebarMm >= 72 ? 48 : 32;
}

const PENGGANTI: Record<string, string> = {
  '·': '-',
  '•': '*',
  '–': '-',
  '—': '-',
  '…': '...',
  '×': 'x',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '→': '->',
  '≤': '<=',
  '≥': '>=',
};

/** Teks → ASCII yang bisa dicetak; karakter lain yang tidak dikenal menjadi "?". */
export function keAsciiStruk(teks: string): string {
  return (
    teks
      // Huruf beraksen → huruf dasar (é → e).
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7e\n]/g, (c) => PENGGANTI[c] ?? (c === '\t' ? ' ' : '?'))
  );
}

/**
 * Memecah teks menjadi baris selebar `lebar`, memutus di spasi bila bisa. Spasi di awal paragraf (inden)
 * dipertahankan di setiap baris pecahannya.
 */
export function bungkusTeks(teks: string, lebar: number): string[] {
  const hasil: string[] = [];
  for (const paragraf of keAsciiStruk(teks).split('\n')) {
    const inden = (/^ */.exec(paragraf)?.[0] ?? '').slice(0, Math.max(0, lebar - 1));
    if (inden) {
      hasil.push(...bungkusTeks(paragraf.trimStart(), lebar - inden.length).map((b) => inden + b));
      continue;
    }
    let baris = '';
    for (const kata of paragraf.split(' ')) {
      let sisa = kata;
      // Kata yang lebih panjang dari satu baris dipotong paksa.
      while (sisa.length > lebar) {
        if (baris) {
          hasil.push(baris);
          baris = '';
        }
        hasil.push(sisa.slice(0, lebar));
        sisa = sisa.slice(lebar);
      }
      if (baris === '') baris = sisa;
      else if (baris.length + 1 + sisa.length <= lebar) baris += ` ${sisa}`;
      else {
        hasil.push(baris);
        baris = sisa;
      }
    }
    hasil.push(baris);
  }
  return hasil;
}

/**
 * `kiri` rata kiri dan `kanan` rata kanan dalam satu baris. Bila tidak muat, `kiri` dibungkus dan `kanan`
 * menempel di baris terakhir (angka tidak pernah dipotong).
 */
export function barisKiriKanan(kiri: string, kanan: string, lebar: number): string[] {
  const k = keAsciiStruk(kanan);
  const ruangKiri = Math.max(1, lebar - k.length - 1);
  const potongan = bungkusTeks(kiri, ruangKiri);
  const akhir = potongan.pop() ?? '';
  return [...potongan, akhir + ' '.repeat(Math.max(1, lebar - akhir.length - k.length)) + k];
}

export type OpsiTeksStruk = { tebal?: boolean; tengah?: boolean; besar?: boolean };

/**
 * K-124: kepekatan cetak. NORMAL = apa adanya. TEBAL = tiap titik dicetak dua kali (double-strike, K-105) dan
 * semua huruf tebal. PALING_TEBAL = TEBAL + waktu pemanasan kepala cetak lebih lama (ESC 7), perintah yang
 * dikenali banyak printer thermal murah dan diabaikan printer lain. Makin pekat makin lambat dan boros baterai.
 */
export const KEPEKATAN_STRUK = ['NORMAL', 'TEBAL', 'PALING_TEBAL'] as const;
export type KepekatanStruk = (typeof KEPEKATAN_STRUK)[number];

export const LABEL_KEPEKATAN_STRUK: Record<KepekatanStruk, string> = {
  NORMAL: 'Normal',
  TEBAL: 'Tebal',
  PALING_TEBAL: 'Paling tebal',
};

export type OpsiStrukEscPos = {
  kepekatan?: KepekatanStruk;
};

/** Gambar hitam-putih untuk dicetak: 1 bit per titik, baris demi baris, bit tertinggi = titik paling kiri. */
export type RasterStruk = {
  /** Lebar dalam byte (titik = lebarByte × 8). */
  lebarByte: number;
  tinggi: number;
  data: Uint8Array;
};

/**
 * Lebar area cetak (titik) menurut karakter per baris: font A selebar 12 titik, jadi 32 karakter = 384 titik
 * (kertas 58 mm) dan 48 karakter = 576 titik (80 mm).
 */
export function lebarTitikStruk(lebarKarakter: number): number {
  return lebarKarakter * 12;
}

/**
 * Gambar abu-abu (0 = hitam, 255 = putih, `lebar × tinggi` nilai) menjadi raster hitam-putih dengan
 * Floyd–Steinberg dithering: area abu-abu menjadi pola titik sehingga logo berwarna tetap terbaca. Piksel
 * tembus pandang harus sudah dijadikan putih oleh pemanggil.
 */
export function rasterDariAbu(abu: ArrayLike<number>, lebar: number, tinggi: number): RasterStruk {
  const lebarByte = Math.ceil(lebar / 8);
  const data = new Uint8Array(lebarByte * tinggi);
  const nilai = Float32Array.from(abu);
  for (let y = 0; y < tinggi; y++) {
    for (let x = 0; x < lebar; x++) {
      const i = y * lebar + x;
      const lama = nilai[i]!;
      const hitam = lama < 128;
      if (hitam) data[y * lebarByte + (x >> 3)]! |= 0x80 >> (x & 7);
      const galat = lama - (hitam ? 0 : 255);
      if (x + 1 < lebar) nilai[i + 1]! += (galat * 7) / 16;
      if (y + 1 < tinggi) {
        if (x > 0) nilai[i + lebar - 1]! += (galat * 3) / 16;
        nilai[i + lebar]! += (galat * 5) / 16;
        if (x + 1 < lebar) nilai[i + lebar + 1]! += galat / 16;
      }
    }
  }
  return { lebarByte, tinggi, data };
}

/** Pita gambar per perintah: penyangga printer murah kecil, gambar besar dikirim bertahap. */
const TINGGI_PITA = 64;

/** Penyusun satu dokumen struk. Setiap metode mengembalikan `this` agar bisa dirangkai. */
export class StrukEscPos {
  private readonly isi: number[] = [];
  /** Kepekatan TEBAL ke atas: semua huruf tebal. */
  private readonly tebalSemua: boolean;

  /** `lebar` = karakter per baris pada ukuran huruf biasa. */
  constructor(
    readonly lebar: number,
    opsi: OpsiStrukEscPos = {},
  ) {
    // ESC @ : kembalikan printer ke keadaan awal (membuang format sisa cetakan sebelumnya).
    this.isi.push(ESC, 0x40);
    // Selalu tegak (potret) dengan huruf bawaan printer: ESC V 0 mematikan putaran 90 derajat yang mungkin
    // tersisa dari aplikasi lain, ESC M 0 memilih font A (12x24 titik, paling tajam).
    this.isi.push(ESC, 0x56, 0, ESC, 0x4d, 0);
    const k = opsi.kepekatan ?? 'NORMAL';
    this.tebalSemua = k !== 'NORMAL';
    // ESC G n : double-strike. Tidak ikut dimatikan oleh ESC E 0 di akhir tiap baris.
    this.isi.push(ESC, 0x47, this.tebalSemua ? 1 : 0);
    // ESC 7 n1 n2 n3 : titik pemanasan (8×(n1+1)), waktu pemanasan (×10 µs), jeda. Bawaan umumnya 7, 80, 2.
    if (k === 'PALING_TEBAL') this.isi.push(ESC, 0x37, 7, 200, 2);
  }

  private mentah(...byte: number[]): this {
    this.isi.push(...byte);
    return this;
  }

  private tulis(teks: string): this {
    for (const c of keAsciiStruk(teks)) this.isi.push(c.charCodeAt(0));
    this.isi.push(LF);
    return this;
  }

  /** Satu atau beberapa baris teks (dibungkus otomatis). `besar` = tinggi dan lebar dua kali. */
  teks(teks: string, opsi: OpsiTeksStruk = {}): this {
    const lebar = opsi.besar ? Math.floor(this.lebar / 2) : this.lebar;
    this.mentah(ESC, 0x61, opsi.tengah ? 1 : 0); // ESC a n : rata tengah/kiri
    this.mentah(ESC, 0x45, opsi.tebal || this.tebalSemua ? 1 : 0); // ESC E n : tebal
    this.mentah(GS, 0x21, opsi.besar ? 0x11 : 0x00); // GS ! n : ukuran huruf
    for (const b of bungkusTeks(teks, lebar)) this.tulis(b);
    return this.mentah(GS, 0x21, 0x00, ESC, 0x45, 0, ESC, 0x61, 0);
  }

  /** Keterangan di kiri, nilai di kanan (mis. "TOTAL" … "Rp 125.000"). */
  kiriKanan(kiri: string, kanan: string, opsi: { tebal?: boolean } = {}): this {
    this.mentah(ESC, 0x45, opsi.tebal || this.tebalSemua ? 1 : 0);
    for (const b of barisKiriKanan(kiri, kanan, this.lebar)) this.tulis(b);
    return this.mentah(ESC, 0x45, 0);
  }

  /** Gambar hitam-putih (logo) di tengah, dikirim per pita dengan GS v 0. */
  gambar(r: RasterStruk): this {
    this.mentah(ESC, 0x61, 1);
    for (let y = 0; y < r.tinggi; y += TINGGI_PITA) {
      const t = Math.min(TINGGI_PITA, r.tinggi - y);
      this.mentah(GS, 0x76, 0x30, 0, r.lebarByte & 0xff, r.lebarByte >> 8, t & 0xff, t >> 8);
      for (const b of r.data.subarray(y * r.lebarByte, (y + t) * r.lebarByte)) this.isi.push(b);
    }
    return this.mentah(ESC, 0x61, 0);
  }

  garis(): this {
    return this.tulis('-'.repeat(this.lebar));
  }

  /** Mengeluarkan kertas `n` baris kosong. */
  maju(n: number): this {
    return this.mentah(ESC, 0x64, Math.max(0, Math.min(255, n))); // ESC d n
  }

  /** Memotong kertas (printer tanpa pemotong mengabaikannya). */
  potong(): this {
    return this.mentah(GS, 0x56, 0x42, 0x00); // GS V 66 0 : maju lalu potong sebagian
  }

  /** Membuka laci uang yang tersambung ke printer (pin 2). */
  bukaLaci(): this {
    return this.mentah(ESC, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
  }

  selesai(): Uint8Array {
    return Uint8Array.from(this.isi);
  }
}
