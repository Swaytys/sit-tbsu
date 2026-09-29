/**
 * Menampilkan desimal dari API (string, mis. "1250.500000") dengan gaya Indonesia: "1.250,5".
 * Diolah sebagai teks, tanpa diubah ke float, sehingga tidak ada pembulatan diam-diam.
 */
export function formatDesimal(nilai: string): string {
  const [bulat = '0', pecahan = ''] = nilai.split('.');
  const pecahanRingkas = pecahan.replace(/0+$/, '');
  const bulatBertitik = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return pecahanRingkas ? `${bulatBertitik},${pecahanRingkas}` : bulatBertitik;
}
