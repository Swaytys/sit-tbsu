import type { KepekatanStruk } from '@sit/shared';

/*
 * Cetak langsung ke printer struk thermal lewat Web Serial (K-103, K-105): printer Bluetooth (port COM
 * "Serial over Bluetooth") atau USB-serial dibuka dari peramban, lalu byte ESC/POS dikirim apa adanya. Tidak
 * ada jendela cetak, tidak ada driver, tidak ada pengaturan kertas. Hanya ada di Chrome/Edge desktop pada
 * halaman HTTPS atau localhost; di peramban lain struk tetap dicetak lewat jendela cetak biasa.
 *
 * Izin memakai printer diberikan sekali per komputer (peramban mengingatnya). Pilihan di bawah juga per
 * komputer, jadi disimpan di localStorage (preferensi perangkat, bukan data bisnis).
 */

/** Sebagian Web Serial API yang dipakai (belum ada di tipe DOM bawaan TypeScript). */
export type InfoPort = {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
};
type PortSerial = {
  getInfo(): InfoPort;
  open(opsi: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  /** Mencabut izin port ini (Chrome 103+). */
  forget?: () => Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
};
type Serial = {
  getPorts(): Promise<PortSerial[]>;
  requestPort(): Promise<PortSerial>;
};

function serial(): Serial | null {
  return 'serial' in navigator ? (navigator as unknown as { serial: Serial }).serial : null;
}

export function dukungCetakLangsung(): boolean {
  return serial() !== null;
}

export const PILIHAN_BAUD = [9600, 19200, 38400, 57600, 115200] as const;

export type PengaturanPrinter = {
  /** Struk dikirim langsung ke printer; mati = jendela cetak peramban. */
  langsung: boolean;
  baud: number;
  /** Karakter per baris; `null` = menurut lebar kertas di pengaturan toko (32 atau 48). */
  lebarKarakter: number | null;
  /** K-124: Normal / Tebal / Paling tebal, untuk printer kecil yang hasilnya pudar. */
  kepekatan: KepekatanStruk;
  potong: boolean;
  bukaLaci: boolean;
  /** Ciri printer yang dipilih, untuk mengenalinya lagi bila ada beberapa port berizin. */
  info: InfoPort | null;
  /** Pengguna sudah memastikan uji cetak keluar dari port yang dipilih. */
  teruji: boolean;
};

const KUNCI = 'tbsu:printer-struk';
const BAWAAN: PengaturanPrinter = {
  langsung: false,
  baud: 9600,
  lebarKarakter: null,
  kepekatan: 'TEBAL',
  potong: true,
  bukaLaci: false,
  info: null,
  teruji: false,
};

export function bacaPengaturanPrinter(): PengaturanPrinter {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return BAWAAN;
    const lama = JSON.parse(mentah) as Partial<PengaturanPrinter> & { pekat?: boolean };
    // Setelan sebelum K-124 menyimpan saklar `pekat`.
    const kepekatan = lama.kepekatan ?? (lama.pekat === false ? 'NORMAL' : 'TEBAL');
    delete lama.pekat;
    return { ...BAWAAN, ...lama, kepekatan };
  } catch {
    return BAWAAN;
  }
}

export function simpanPengaturanPrinter(p: PengaturanPrinter): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(p));
  } catch {
    // Penyimpanan peramban diblokir: pengaturan hanya berlaku sampai halaman dimuat ulang.
  }
}

/** Struk dicetak langsung di komputer ini? (peramban mendukung dan pengguna menyalakannya) */
export function cetakLangsungAktif(): boolean {
  return dukungCetakLangsung() && bacaPengaturanPrinter().langsung;
}

function sama(a: InfoPort, b: InfoPort): boolean {
  return (
    a.usbVendorId === b.usbVendorId &&
    a.usbProductId === b.usbProductId &&
    a.bluetoothServiceClassId === b.bluetoothServiceClassId
  );
}

/**
 * Pembuat perangkat USB yang sering muncul di daftar port padahal bukan printer: modem seluler bawaan
 * laptop dan adaptor Bluetooth. Kunci = USB vendor id.
 */
const BUKAN_PRINTER: Record<number, string> = {
  0x1199: 'modem seluler Sierra Wireless (mis. EM7455) bawaan laptop',
  0x12d1: 'modem seluler Huawei',
  0x19d2: 'modem seluler ZTE',
  0x2c7c: 'modem seluler Quectel',
  0x1bc7: 'modem seluler Telit',
  0x05c6: 'modem seluler Qualcomm',
  0x8087: 'adaptor Bluetooth Intel bawaan laptop',
};

/** Keterangan singkat port untuk ditampilkan. Peramban tidak memberi tahu nama atau nomor COM port. */
export function namaPort(info: InfoPort | null): string {
  if (!info) return 'Belum dipilih';
  if (info.usbVendorId !== undefined) {
    const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(4, '0');
    return `Perangkat kabel USB (kode ${hex(info.usbVendorId)}:${hex(info.usbProductId)})`;
  }
  return info.bluetoothServiceClassId !== undefined
    ? 'Perangkat Bluetooth'
    : 'Port serial (COM) Bluetooth atau kabel';
}

/** Peringatan bila port yang dipilih dikenali sebagai perangkat yang bukan printer; `null` bila wajar. */
export function peringatanPort(info: InfoPort | null): string | null {
  if (info?.usbVendorId === undefined) return null;
  const apa = BUKAN_PRINTER[info.usbVendorId];
  return apa
    ? `Yang dipilih adalah ${apa}, bukan printer. Tekan "Pilih printer" lagi dan pilih baris lain.`
    : null;
}

/** Port hasil pilihan terakhir di sesi halaman ini; dipakai lebih dulu daripada mencocokkan ciri port. */
let portKini: PortSerial | null = null;

/**
 * Membuka pemilih port milik peramban (harus dari klik pengguna) dan mengingat pilihannya. Printer
 * Bluetooth harus sudah dipasangkan di Windows. Izin port lain yang pernah diberikan dicabut, sehingga hanya
 * ada satu printer berizin: port COM tidak punya ciri pembeda, jadi tanpa ini pilihan yang salah bisa
 * terpakai lagi setelah halaman dimuat ulang.
 */
export async function pilihPrinter(): Promise<InfoPort> {
  const s = serial();
  if (!s) throw new Error('Peramban ini tidak mendukung cetak langsung. Pakai Chrome atau Edge.');
  let port: PortSerial;
  try {
    port = await s.requestPort();
  } catch {
    throw new Error(
      'Tidak ada yang dipilih. Tekan "Pilih printer" lagi, klik satu baris, lalu Hubungkan.',
    );
  }
  for (const lain of await s.getPorts()) {
    if (lain !== port) await lain.forget?.().catch(() => undefined);
  }
  portKini = port;
  const info = port.getInfo();
  simpanPengaturanPrinter({ ...bacaPengaturanPrinter(), info, teruji: false });
  return info;
}

async function portTerpilih(): Promise<PortSerial> {
  const s = serial();
  if (!s) throw new Error('Peramban ini tidak mendukung cetak langsung. Pakai Chrome atau Edge.');
  const berizin = await s.getPorts();
  if (portKini && berizin.includes(portKini)) return portKini;
  const { info } = bacaPengaturanPrinter();
  const port = (info && berizin.find((p) => sama(p.getInfo(), info))) ?? berizin[0];
  if (!port) {
    throw new Error(
      'Printer struk belum dipilih di komputer ini. Buka Pengaturan › Struk & printer, kerjakan Langkah 2.',
    );
  }
  return port;
}

/** Sambungan Bluetooth dibuat saat port dibuka dan bisa makan beberapa detik. */
const BATAS_BUKA_MS = 15000;
const UKURAN_POTONG = 256;

const tunggu = (ms: number) => new Promise<void>((lanjut) => setTimeout(lanjut, ms));

function denganBatasWaktu<T>(janji: Promise<T>, ms: number, pesan: string): Promise<T> {
  return Promise.race([
    janji,
    new Promise<never>((_, tolak) => setTimeout(() => tolak(new Error(pesan)), ms)),
  ]);
}

async function kirim(data: Uint8Array): Promise<void> {
  const port = await portTerpilih();
  const { baud } = bacaPengaturanPrinter();
  try {
    await denganBatasWaktu(
      port.open({ baudRate: baud }),
      BATAS_BUKA_MS,
      'Printer tidak menjawab dalam 15 detik. Pastikan printer menyala, dekat dengan komputer, dan Bluetooth komputer hidup.',
    );
  } catch (err) {
    // Port masih terbuka dari cetakan sebelumnya yang terputus: pakai saja.
    if (!(err instanceof DOMException && err.name === 'InvalidStateError')) {
      throw err instanceof DOMException
        ? new Error(
            'Port printer tidak bisa dibuka. Pastikan printer menyala dan tidak sedang dipakai aplikasi lain (tutup aplikasi printer bawaan dan antrean cetak Windows), lalu coba lagi.',
          )
        : err;
    }
  }
  try {
    const penulis = port.writable?.getWriter();
    if (!penulis) throw new Error('Printer tidak siap menerima data.');
    try {
      // Dikirim sepotong-sepotong: penyangga printer Bluetooth kecil.
      for (let i = 0; i < data.length; i += UKURAN_POTONG) {
        await penulis.write(data.subarray(i, i + UKURAN_POTONG));
      }
      // Beri waktu data sampai ke printer sebelum sambungan ditutup; menutup sambungan Bluetooth terlalu
      // cepat memotong ekor struk.
      await tunggu(Math.min(1500, 250 + Math.ceil(data.length / 4)));
    } finally {
      penulis.releaseLock();
    }
  } finally {
    await port.close().catch(() => undefined);
  }
}

/** Antrean: dua struk yang dicetak berdekatan tidak membuka port bersamaan. */
let antrean: Promise<void> = Promise.resolve();

/** Mengirim byte ESC/POS ke printer struk komputer ini. Menolak dengan pesan yang bisa ditampilkan. */
export function kirimKePrinter(data: Uint8Array): Promise<void> {
  const hasil = antrean.then(() => kirim(data));
  antrean = hasil.catch(() => undefined);
  return hasil;
}
