import { afterAll } from 'vitest';
import { pool } from '../src/db/client';

// Setiap berkas tes membuka pool sendiri; tutup setelah berkas selesai.
afterAll(async () => {
  await pool.end();
});
