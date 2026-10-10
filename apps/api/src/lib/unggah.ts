import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from './errors';
import { UKURAN_XLSX_MAKS } from './excel';
import type { EnvApp } from './konteks';
import { UKURAN_GAMBAR_MAKS } from './penyimpanan';

/*
 * Unggahan berkas lewat multipart (kolom `berkas`). Batas badan permintaan = ukuran berkas maksimal ditambah
 * sedikit ruang untuk pembungkus multipart. Isi berkas tetap diperiksa lagi oleh pembacanya (tanda tangan
 * byte di `penyimpanan.ts` dan `excel.ts`); batas di sini hanya mencegah badan raksasa dibaca ke memori.
 */

const RUANG_MULTIPART = 64 * 1024;

function batasUnggah(ukuranMaks: number, pesan: string) {
  return bodyLimit({
    maxSize: ukuranMaks + RUANG_MULTIPART,
    onError: () => {
      throw new AppError('VALIDASI', pesan, 413);
    },
  });
}

export const batasUnggahGambar = batasUnggah(UKURAN_GAMBAR_MAKS, 'Ukuran gambar maksimal 2 MB.');
export const batasUnggahXlsx = batasUnggah(UKURAN_XLSX_MAKS, 'Ukuran berkas Excel maksimal 5 MB.');

const PESAN_KOSONG = {
  gambar: 'Pilih berkas gambar untuk diunggah.',
  xlsx: 'Pilih berkas Excel (.xlsx) untuk diunggah.',
} as const;

/** Berkas pada kolom `berkas` permintaan multipart. Nama asli hanya untuk catatan, tidak untuk nama simpan. */
export async function berkasKiriman(
  c: Context<EnvApp>,
  jenis: keyof typeof PESAN_KOSONG,
): Promise<{ isi: Uint8Array; nama: string }> {
  const { berkas } = await c.req.parseBody();
  if (!(berkas instanceof File)) throw new AppError('VALIDASI', PESAN_KOSONG[jenis], 400);
  return { isi: new Uint8Array(await berkas.arrayBuffer()), nama: berkas.name.slice(0, 100) };
}
