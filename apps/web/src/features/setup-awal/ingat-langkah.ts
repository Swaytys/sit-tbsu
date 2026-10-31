/*
 * K-212: langkah setup awal terakhir diingat selama tab peramban terbuka (sessionStorage; preferensi navigasi,
 * bukan data bisnis), supaya halaman lain yang dibuka dari setup bisa menampilkan bilah "Kembali ke setup awal".
 */

const KUNCI = 'bonsaiurip.setupLangkah';

export function ingatLangkahSetup(langkah: string | null): void {
  try {
    if (langkah) sessionStorage.setItem(KUNCI, langkah);
    else sessionStorage.removeItem(KUNCI);
  } catch {
    // Penyimpanan diblokir peramban: bilah kembali tidak tampil, setup tetap bisa dibuka dari Dashboard.
  }
}

export function langkahSetupTerakhir(): string | null {
  try {
    return sessionStorage.getItem(KUNCI);
  } catch {
    return null;
  }
}
