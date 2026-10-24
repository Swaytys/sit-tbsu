import { rasterDariAbu, type RasterStruk } from '@sit/shared';

/*
 * K-124: logo toko untuk struk thermal. Gambar logo (dilayani API) digambar ke kanvas dengan latar putih,
 * diperkecil agar muat, diubah ke abu-abu, lalu ke raster hitam-putih (dithering di @sit/shared). Hasil
 * disimpan di memori halaman per alamat logo dan lebar, jadi gambar hanya diolah sekali.
 */

export type LogoStruk = {
  raster: RasterStruk;
  /** Pratinjau hasil hitam-putih (data URL PNG), sama persis dengan yang dikirim ke printer. */
  pratinjau: string;
};

const simpanan = new Map<string, Promise<LogoStruk>>();

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((lanjut, tolak) => {
    const img = new Image();
    img.onload = () => lanjut(img);
    img.onerror = () => tolak(new Error('Logo toko tidak bisa dimuat.'));
    img.src = url;
  });
}

async function olah(url: string, lebarTitik: number): Promise<LogoStruk> {
  const img = await muatGambar(url);
  // Logo selebar paling banyak separuh kertas dan setinggi paling banyak 160 titik (± 2 cm).
  const skala = Math.min(1, (lebarTitik * 0.5) / img.naturalWidth, 160 / img.naturalHeight);
  const lebar = Math.max(8, Math.round(img.naturalWidth * skala));
  const tinggi = Math.max(1, Math.round(img.naturalHeight * skala));
  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ktx = kanvas.getContext('2d');
  if (!ktx) throw new Error('Peramban tidak bisa mengolah gambar logo.');
  ktx.fillStyle = '#fff';
  ktx.fillRect(0, 0, lebar, tinggi);
  ktx.drawImage(img, 0, 0, lebar, tinggi);
  const piksel = ktx.getImageData(0, 0, lebar, tinggi).data;
  const abu = new Uint8Array(lebar * tinggi);
  for (let i = 0; i < abu.length; i++) {
    abu[i] = Math.round(
      0.299 * piksel[i * 4]! + 0.587 * piksel[i * 4 + 1]! + 0.114 * piksel[i * 4 + 2]!,
    );
  }
  const raster = rasterDariAbu(abu, lebar, tinggi);

  // Pratinjau: gambar ulang raster apa adanya.
  const hasil = ktx.createImageData(lebar, tinggi);
  for (let y = 0; y < tinggi; y++) {
    for (let x = 0; x < lebar; x++) {
      const hitam = (raster.data[y * raster.lebarByte + (x >> 3)]! & (0x80 >> (x & 7))) !== 0;
      const j = (y * lebar + x) * 4;
      const n = hitam ? 0 : 255;
      hasil.data[j] = n;
      hasil.data[j + 1] = n;
      hasil.data[j + 2] = n;
      hasil.data[j + 3] = 255;
    }
  }
  ktx.putImageData(hasil, 0, 0);
  return { raster, pratinjau: kanvas.toDataURL('image/png') };
}

/** Logo siap cetak untuk lebar kertas (titik) tertentu. Menolak bila logo tidak bisa dimuat. */
export function logoStruk(url: string, lebarTitik: number): Promise<LogoStruk> {
  const kunci = `${url}|${lebarTitik}`;
  let janji = simpanan.get(kunci);
  if (!janji) {
    janji = olah(url, lebarTitik);
    simpanan.set(kunci, janji);
    janji.catch(() => simpanan.delete(kunci));
  }
  return janji;
}
