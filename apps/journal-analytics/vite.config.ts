import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { analyticsPlugins } from './vite.plugins';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/analytics/',
  plugins: analyticsPlugins(),
  server: {
    host: 'localhost',
    port: 5178,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3100', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
