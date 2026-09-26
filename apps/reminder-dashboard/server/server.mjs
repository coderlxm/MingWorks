import { createHash, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import staticFiles from '@fastify/static'

const password = process.env.REMINDER_DASHBOARD_PASSWORD
const cookieSecret = process.env.REMINDER_DASHBOARD_COOKIE_SECRET
const apiToken = process.env.REMINDER_DASHBOARD_API_TOKEN
if (!password || !cookieSecret || cookieSecret.length < 32 || !apiToken) {
  throw new Error('Reminder dashboard password, cookie secret (32+ characters), and API token are required')
}

const production = process.env.NODE_ENV === 'production'
const origin = production ? 'https://remind.xmcloud.buzz' : 'http://localhost:5176'
const sessionName = 'reminder_session'
const sessionSeconds = 7 * 24 * 60 * 60
const cookieOptions = { signed: true, httpOnly: true, sameSite: 'strict', secure: production, path: '/', maxAge: sessionSeconds }
const app = Fastify({ logger: true, bodyLimit: 32 * 1024 })
await app.register(cookie, { secret: cookieSecret })

function authenticated(request) {
  const value = request.cookies[sessionName]
  if (!value) return false
  const signed = request.unsignCookie(value)
  return signed.valid && Number(signed.value) > Date.now()
}

app.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/api/')) return
  reply.header('Cache-Control', 'no-store')
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin !== origin) {
    return reply.code(403).send({ error: '请求来源不匹配' })
  }
})

app.setErrorHandler((error, _request, reply) => {
  reply.code(error.statusCode ?? 500).send({ error: error.message })
})

app.get('/api/session', async request => ({ authenticated: authenticated(request) }))
app.post('/api/session', {
  schema: { body: { type: 'object', required: ['password'], additionalProperties: false, properties: { password: { type: 'string', minLength: 1, maxLength: 1024 } } } },
}, async (request, reply) => {
  const digest = value => createHash('sha256').update(value).digest()
  if (!timingSafeEqual(digest(request.body.password), digest(password))) {
    return reply.code(401).send({ error: '站点口令不正确' })
  }
  reply.setCookie(sessionName, String(Date.now() + sessionSeconds * 1000), cookieOptions)
  return { authenticated: true }
})
app.delete('/api/session', async (_request, reply) => {
  reply.clearCookie(sessionName, { path: '/', secure: production, sameSite: 'strict', httpOnly: true })
  return { authenticated: false }
})

app.route({
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  url: '/api/reminders/*',
  handler: async (request, reply) => {
    if (!authenticated(request)) return reply.code(401).send({ error: '请先输入站点口令' })
    const response = await fetch(`http://127.0.0.1:3421${request.url}`, {
      method: request.method,
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(15000),
    })
    reply.code(response.status).type(response.headers.get('content-type') || 'application/json')
    return reply.send(Buffer.from(await response.arrayBuffer()))
  },
})

await app.register(staticFiles, {
  root: fileURLToPath(new URL('../dist/', import.meta.url)),
  cacheControl: false,
  setHeaders(reply, path) {
    reply.header('Cache-Control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  },
})
app.setNotFoundHandler((request, reply) => {
  if (request.method === 'GET' && /^\/(?:reminders|rules|life|history)?$/.test(request.url.split('?')[0])) {
    return reply.sendFile('index.html')
  }
  return reply.code(404).send({ error: '页面或接口不存在' })
})

await app.listen({ port: 3420, host: process.env.REMINDER_DASHBOARD_HOST || '127.0.0.1' })
