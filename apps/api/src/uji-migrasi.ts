// K-166: uji migrasi pada salinan database toko (dipakai scripts/server/perbarui-server.ps1 dan `pnpm db:uji-migrasi`).
//   node apps/api/dist/uji-migrasi.js  -> kode keluar 0 bila aman, 1 bila migrasi gagal/menghilangkan data.
import { ujiMigrasiSalinan } from './db/uji-migrasi-salinan';
import { logger } from './lib/logger';

try {
  const h = await ujiMigrasiSalinan();
  const baris = Object.values(h.sebelum).reduce((a, b) => a + b, 0);
  process.stdout.write(
    h.berhasil
      ? `Uji migrasi pada salinan: AMAN (${Object.keys(h.sebelum).length} tabel, ${baris} baris utuh).\n`
      : `Uji migrasi pada salinan: GAGAL\n- ${h.pesan.join('\n- ')}\n`,
  );
  process.exitCode = h.berhasil ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'Uji migrasi gagal dijalankan');
  process.stdout.write(`Gagal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
