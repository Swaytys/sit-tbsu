import { kaliQty, kurangQty, type BarisBarang } from '@sit/shared';
import { formatDesimal } from './format';

/**
 * K-227: teks lapisan stok barang berkemasan tersegel, mis. "6 box segel + 226 ecer". Hanya tampilan; angka dari API
 * (stok fisik, jumlah box segel, isi kemasan). `null` bila barang tanpa kemasan tersegel.
 */
export function teksLapisanSegel(
  stokFisik: string,
  stokSegel: string,
  segel: { kodeSatuan: string; isi: string } | null,
): string | null {
  if (!segel) return null;
  const ecer = kurangQty(stokFisik, kaliQty(stokSegel, segel.isi));
  return `${formatDesimal(stokSegel)} ${segel.kodeSatuan} segel + ${formatDesimal(ecer)} ecer`;
}

/** Kemasan tersegel aktif dari daftar satuan jual barang. */
export function kemasanSegelBarang(b: Pick<BarisBarang, 'satuanJual'>) {
  const k = b.satuanJual.find((s) => s.kemasanSegel && s.statusAktif === 'AKTIF');
  return k ? { kodeSatuan: k.kodeSatuan, isi: k.faktor } : null;
}
