import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist' },
  server: {
    host: 'localhost',
    port: 5177,
    strictPort: true,
    proxy: { '/api': { target: 'https://srv.xmcloud.buzz', changeOrigin: true, headers: { origin: 'https://srv.xmcloud.buzz' } } },
  },
})
