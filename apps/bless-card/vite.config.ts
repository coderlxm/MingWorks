import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vueSetupExtend from 'vite-plugin-vue-setup-extend'
import { sendBlessReceipt } from './server/receiptHandler.mjs'

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

const MAX_BODY_BYTES = 16 * 1024

function readJsonBody(request: NodeJS.ReadableStream): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    request.on('data', (chunk: Buffer | string) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      totalBytes += buffer.length
      if (totalBytes > MAX_BODY_BYTES) {
        const error = new Error('请求体过大') as Error & { statusCode?: number }
        error.statusCode = 413
        reject(error)
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        const error = new Error('请求内容不能为空') as Error & { statusCode?: number }
        error.statusCode = 400
        reject(error)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        const error = new Error('请求体不是有效的 JSON') as Error & { statusCode?: number }
        error.statusCode = 400
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function blessReceiptDevApiPlugin(): Plugin {
  return {
    name: 'bless-receipt-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/bless-receipt', async (request, response, next) => {
        if (request.method !== 'POST') {
          next()
          return
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        try {
          const payload = await readJsonBody(request)
          const result = await sendBlessReceipt(payload)
          response.statusCode = 200
          response.end(JSON.stringify(result))
        } catch (error) {
          const detail = error as Error & { statusCode?: number }
          response.statusCode = typeof detail.statusCode === 'number' ? detail.statusCode : 500
          response.end(JSON.stringify({ error: detail.message || '通知发送失败' }))
        }
      })
    },
  }
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), vueSetupExtend(), blessReceiptDevApiPlugin()],
  server: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'vendor-three',
              test: /[\\/]node_modules[\\/]three[\\/]/,
            },
          ],
        },
      },
    },
  },
})
