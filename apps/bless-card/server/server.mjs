import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import { sendBlessReceipt } from './receiptHandler.mjs'

if (!process.env.TG_TOKEN || !process.env.TG_CHAT_ID) {
  throw new Error('TG_TOKEN and TG_CHAT_ID are required for bless-card server')
}

const production = process.env.NODE_ENV === 'production'
const origin = production ? 'https://bless.xmcloud.buzz' : 'http://localhost:5180'
const port = Number(process.env.BLESS_CARD_PORT || '3440')
const host = process.env.BLESS_CARD_HOST || '127.0.0.1'

const app = Fastify({ logger: true, bodyLimit: 16 * 1024, trustProxy: true })
await app.register(rateLimit, { global: false })

app.addHook('onRequest', async (request, reply) => {
  reply.header('X-Robots-Tag', 'noindex, nofollow')
  if (!request.url.startsWith('/api/')) return
  reply.header('Cache-Control', 'no-store')
  if (production && request.method === 'POST' && request.headers.origin !== origin) {
    return reply.code(403).send({ error: '请求来源不匹配' })
  }
})

app.setErrorHandler((error, _request, reply) => {
  reply.code(error.statusCode ?? 500).send({ error: error.message })
})

app.get('/api/health', async () => ({ status: 'ok' }))

app.post('/api/bless-receipt', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: 60_000,
      errorResponseBuilder: () => ({ error: '签收请求太频繁，请一分钟后再试' }),
    },
  },
}, async request => sendBlessReceipt(request.body))

await app.register(staticFiles, {
  root: fileURLToPath(new URL('../dist/', import.meta.url)),
  cacheControl: false,
  setHeaders(reply, filePath) {
    reply.header('Cache-Control', filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  },
})

app.setNotFoundHandler((request, reply) => {
  if (request.method === 'GET' && request.url.split('?')[0] === '/') {
    return reply.sendFile('index.html')
  }
  return reply.code(404).send({ error: '页面或接口不存在' })
})

await app.listen({ port, host })
