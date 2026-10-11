/*
 * Cetak langsung ke printer struk thermal lewat Web Serial (K-103): printer Bluetooth (port COM "Serial over
 * Bluetooth") atau USB-serial dibuka dari peramban, lalu byte ESC/POS dikirim apa adanya. Tidak ada jendela
 * cetak, tidak ada driver, tidak ada pengaturan kertas. Hanya ada di Chrome/Edge desktop pada halaman HTTPS
 * atau localhost; di peramban lain struk tetap dicetak lewat jendela cetak biasa.
 *
 * Izin memakai printer diberikan sekali per komputer (peramban mengingatnya). Pilihan di bawah juga per
 * komputer, jadi disimpan di localStorage (preferensi perangkat, bukan data bisnis).
 */

/** Sebagian Web Serial API yang dipakai (belum ada di tipe DOM bawaan TypeScript). */
type InfoPort = {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
};
type PortSerial = {
  getInfo(): InfoPort;
  open(opsi: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
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
  potong: boolean;
  bukaLaci: boolean;
  /** Ciri printer yang dipilih, untuk mengenalinya lagi bila ada beberapa port berizin. */
  info: InfoPort | null;
};

const KUNCI = 'tbsu:printer-struk';
const BAWAAN: PengaturanPrinter = {
  langsung: false,
  baud: 9600,
  lebarKarakter: null,
  potong: true,
  bukaLaci: false,
  info: null,
};

export function bacaPengaturanPrinter(): PengaturanPrinter {
  try {
    const mentah = localStorage.getItem(KUNCI);
    return mentah ? { ...BAWAAN, ...(JSON.parse(mentah) as Partial<PengaturanPrinter>) } : BAWAAN;
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

/** Keterangan singkat port untuk ditampilkan. */
export function namaPort(info: InfoPort | null): string {
  if (!info) return 'belum dipilih';
  if (info.usbVendorId !== undefined) {
    const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(4, '0');
    return `USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}`;
  }
  return info.bluetoothServiceClassId !== undefined ? 'Bluetooth' : 'port serial';
}

/**
 * Membuka pemilih port milik peramban (harus dari klik pengguna) dan mengingat pilihannya. Printer
 * Bluetooth harus sudah dipasangkan di Windows; ia tampil sebagai "Standard Serial over Bluetooth (COMx)".
 */
export async function pilihPrinter(): Promise<InfoPort> {
  const s = serial();
  if (!s) throw new Error('Peramban ini tidak mendukung cetak langsung. Pakai Chrome atau Edge.');
  let port: PortSerial;
  try {
    port = await s.requestPort();
  } catch {
    throw new Error('Tidak ada printer yang dipilih.');
  }
  const info = port.getInfo();
  simpanPengaturanPrinter({ ...bacaPengaturanPrinter(), info });
  return info;
}

async function portTerpilih(): Promise<PortSerial> {
  const s = serial();
  if (!s) throw new Error('Peramban ini tidak mendukung cetak langsung. Pakai Chrome atau Edge.');
  const berizin = await s.getPorts();
  const { info } = bacaPengaturanPrinter();
  const port = (info && berizin.find((p) => sama(p.getInfo(), info))) ?? berizin[0];
  if (!port) throw new Error('Printer struk belum dipilih (Pengaturan › Struk & printer).');
  return port;
}

const BATAS_BUKA_MS = 8000;
const UKURAN_POTONG = 256;

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
      'Printer tidak menjawab. Pastikan menyala dan Bluetooth/USB tersambung.',
    );
  } catch (err) {
    // Port masih terbuka dari cetakan sebelumnya yang terputus: pakai saja.
    if (!(err instanceof DOMException && err.name === 'InvalidStateError')) {
      throw err instanceof DOMException
        ? new Error('Printer tidak bisa dibuka. Pastikan menyala dan tidak dipakai aplikasi lain.')
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
