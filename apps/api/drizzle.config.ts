import { defineConfig } from 'drizzle-kit';
import { muatEnvFile } from './src/lib/env-file';

muatEnvFile();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
