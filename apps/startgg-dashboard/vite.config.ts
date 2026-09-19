import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist' },
  server: {
    host: 'localhost',
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://ftg.xmcloud.buzz',
        changeOrigin: true,
        headers: { origin: 'https://ftg.xmcloud.buzz' },
      },
    },
  },
})
