import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Port bawaan 5173 (web) dan 3000 (API). Bisa diubah bila bentrok, mis. PORT_WEB=5174 PORT_API=3100.
const portWeb = Number(process.env.PORT_WEB ?? 5173);
const portApi = Number(process.env.PORT_API ?? 3000);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: portWeb,
    strictPort: true,
    // Dev: /api diteruskan ke server API sehingga web dan API tampak satu origin (docs/02 §8).
    proxy: { '/api': `http://localhost:${portApi}` },
  },
});
