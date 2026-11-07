// K-211: memulihkan akses Owner dari komputer tempat BonsaiUrip terpasang. Dijalankan peluncur
// (`peluncur.js --pulihkan-owner --jawaban=…`, setelah kode jawaban pengembang diperiksa, K-232), bukan lewat
// jaringan. Mencetak JSON:
//   {"username":…,"namaPengguna":…,"passwordSementara":…,"kodePemulihan":…}  atau  {"galat":"…"}
import { pool } from './db/client';
import { pulihkanAksesOwnerLokal } from './modules/auth/pemulihan';

try {
  process.stdout.write(`${JSON.stringify(await pulihkanAksesOwnerLokal())}\n`);
} catch (err) {
  process.stdout.write(
    `${JSON.stringify({ galat: err instanceof Error ? err.message : String(err) })}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
