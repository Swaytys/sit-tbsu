// Skrip cadangan baris perintah (K-084), dipakai scripts/server/perbarui-server.ps1 dan Task Scheduler:
//   node apps/api/dist/cadangan.js            -> cadangan sekarang (pemicu SEBELUM_PEMBARUAN)
//   node apps/api/dist/cadangan.js --uji-pulih -> uji pulih snapshot terbaru
// Keluar dengan kode 1 bila gagal.
import { pool } from './db/client';
import { logger } from './lib/logger';
import { jalankanCadangan, jalankanUjiPulih } from './modules/sistem/cadangan/service';

const uji = process.argv.includes('--uji-pulih');
try {
  const h = uji
    ? await jalankanUjiPulih({ pemicu: 'MANUAL', tunggu: true })
    : await jalankanCadangan({ pemicu: 'SEBELUM_PEMBARUAN', tunggu: true });
  const [akhir] = await pool
    .query<{ status: string; pesan: string | null }>(
      'select status, pesan from cadangan where id = $1',
      [h.id],
    )
    .then((r) => r.rows);
  process.stdout.write(
    `${uji ? 'Uji pulih' : 'Cadangan'}: ${akhir?.status} ${akhir?.pesan ?? ''}\n`,
  );
  process.exitCode = akhir?.status === 'BERHASIL' ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'Cadangan gagal');
  process.stdout.write(`Gagal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
