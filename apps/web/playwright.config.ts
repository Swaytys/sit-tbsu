import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Password akun demo = SEED_OWNER_PASSWORD di .env root (dipakai tes login lewat form).
const berkasEnv = new URL('../../.env', import.meta.url);
if (existsSync(berkasEnv)) process.loadEnvFile(berkasEnv);

// Tes e2e membutuhkan `pnpm dev` sedang berjalan dan `pnpm db:seed` (akun demo) sudah dijalankan.
export default defineConfig({
  testDir: './e2e',
  // Menonaktifkan sementara tier harga selain tier dasar, dan memulihkannya setelah tes (K-106).
  globalSetup: './e2e/penyiapan-global.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:5173',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
