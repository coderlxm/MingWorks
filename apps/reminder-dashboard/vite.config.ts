import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist' },
  server: {
    host: 'localhost',
    port: 5176,
    strictPort: true,
    proxy: { '/api': { target: 'https://remind.xmcloud.buzz', changeOrigin: true, headers: { origin: 'https://remind.xmcloud.buzz' } } },
  },
})
