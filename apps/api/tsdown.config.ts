import { defineConfig } from 'tsdown';

// `pnpm build` api → dist/index.js. Paket workspace (@sit/shared) berupa sumber TypeScript,
// jadi ikut dibundel; dependency npm lain tetap diimpor dari node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  dts: false,
  deps: { alwaysBundle: [/^@sit\//] },
});
