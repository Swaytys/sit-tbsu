/*
 * Tanggal kalender `YYYY-MM-DD` tanpa objek `Date` (CLAUDE.md "Jangan memakai Date untuk aritmatika
 * tanggal bisnis"): nomor hari dihitung dengan algoritma kalender sipil (proleptik Gregorian), sehingga
 * hasilnya sama di server (UTC) dan peramban (zona apa pun).
 */

export const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

function pecah(iso: string): [number, number, number] {
  const [t = '0', b = '0', h = '0'] = iso.slice(0, 10).split('-');
  return [Number(t), Number(b), Number(h)];
}

/** Nomor hari sejak 1970-01-01 (boleh negatif). */
export function nomorHari(iso: string): number {
  const [t0, b, h] = pecah(iso);
  const t = b <= 2 ? t0 - 1 : t0;
  const era = Math.floor(t / 400);
  const tahunEra = t - era * 400;
  const bulanMaret = (b + 9) % 12;
  const hariTahun = Math.floor((153 * bulanMaret + 2) / 5) + h - 1;
  const hariEra =
    tahunEra * 365 + Math.floor(tahunEra / 4) - Math.floor(tahunEra / 100) + hariTahun;
  return era * 146097 + hariEra - 719468;
}

/** Kebalikan `nomorHari`. */
export function dariNomorHari(n: number): string {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const hariEra = z - era * 146097;
  const tahunEra = Math.floor(
    (hariEra -
      Math.floor(hariEra / 1460) +
      Math.floor(hariEra / 36524) -
      Math.floor(hariEra / 146096)) /
      365,
  );
  const hariTahun =
    hariEra - (365 * tahunEra + Math.floor(tahunEra / 4) - Math.floor(tahunEra / 100));
  const bulanMaret = Math.floor((5 * hariTahun + 2) / 153);
  const h = hariTahun - Math.floor((153 * bulanMaret + 2) / 5) + 1;
  const b = bulanMaret < 10 ? bulanMaret + 3 : bulanMaret - 9;
  const t = tahunEra + era * 400 + (b <= 2 ? 1 : 0);
  return `${String(t).padStart(4, '0')}-${String(b).padStart(2, '0')}-${String(h).padStart(2, '0')}`;
}

/** `2026-02-30` tidak sah; `2026-02-28` sah. */
export function tanggalSah(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && dariNomorHari(nomorHari(iso)) === iso;
}

/** Jumlah hari kalender dari `dari` sampai `sampai`, keduanya termasuk. */
export function jumlahHari(dari: string, sampai: string): number {
  return nomorHari(sampai) - nomorHari(dari) + 1;
}

/** `2026-10-03` → `3 Oktober 2026`. */
export function teksTanggalPanjang(iso: string): string {
  const [t, b, h] = pecah(iso);
  return `${h} ${NAMA_BULAN[b - 1] ?? '?'} ${t}`;
}

/** `2026-10-03` → `03/10/2026`. */
export function teksTanggalAngka(iso: string): string {
  const [t, b, h] = iso.slice(0, 10).split('-');
  return `${h}/${b}/${t}`;
}

/** Tanggal terakhir bulan kalender tanggal `iso`. */
export function akhirBulan(iso: string): string {
  const [t, b] = pecah(iso);
  const awalBerikut = b === 12 ? `${t + 1}-01-01` : `${t}-${String(b + 1).padStart(2, '0')}-01`;
  return dariNomorHari(nomorHari(awalBerikut) - 1);
}

/**
 * Keterangan periode laporan: satu hari → "Tanggal 3 Oktober 2026"; satu bulan penuh → "Bulan Januari 2026";
 * satu tahun penuh → "Tahun 2026"; selain itu → "Periode 1 Januari 2026 s.d. 15 Januari 2026".
 */
export function teksPeriode(dari: string, sampai: string): string {
  if (dari === sampai) return `Tanggal ${teksTanggalPanjang(dari)}`;
  const [t1, b1, h1] = pecah(dari);
  const [t2, b2] = pecah(sampai);
  if (t1 === t2 && b1 === 1 && h1 === 1 && sampai === `${t2}-12-31`) return `Tahun ${t1}`;
  if (t1 === t2 && b1 === b2 && h1 === 1 && sampai === akhirBulan(dari)) {
    return `Bulan ${NAMA_BULAN[b1 - 1] ?? '?'} ${t1}`;
  }
  return `Periode ${teksTanggalPanjang(dari)} s.d. ${teksTanggalPanjang(sampai)}`;
}
