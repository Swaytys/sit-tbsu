import { defineConfig } from 'vitest/config';
import { muatEnvFile } from './src/lib/env-file.ts';

muatEnvFile();

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/setup-global.ts'],
    setupFiles: ['./test/setup.ts'],
    // Tes memakai satu database uji; dijalankan berurutan agar tidak saling mengganggu.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Semua kode (db/client.ts) diarahkan ke database uji, bukan tbsu_dev.
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
    },
  },
});
