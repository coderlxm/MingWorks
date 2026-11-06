import { createHmac } from 'node:crypto';
import Bowser from 'bowser';
import { isBot } from 'isbot';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  analyticsActivitySchema,
  analyticsEventSchema,
  analyticsPageviewSchema,
  analyticsPublicPathPattern,
  type AnalyticsDevice,
  type AnalyticsEventName,
} from '../../shared/analyticsProtocol.js';
import type { AnalyticsRepository } from '../analytics/analyticsRepository.js';
import type { JournalAuth } from '../auth.js';

const dayMs = 86_400_000;
const visitorIdentitySchema = z.string().uuid();
const filtersSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  path: z.string().max(300).regex(analyticsPublicPathPattern).optional(),
  referrer: z.string().max(253).optional(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional(),
}).refine(input => {
  const span = Date.parse(input.to) - Date.parse(input.from);
  return span >= 0 && span < 366 * dayMs;
}, { message: '统计日期范围需要在 1 至 366 天之间。' });

const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const entryPathPattern = /^\/p\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function referrerHost(value: string, publicHostname: string): string {
  if (!value) return '';
  // Accept a hostname only; URLs, queries and paths must never enter storage.
  const hostname = value.toLowerCase();
  if (!hostnamePattern.test(hostname) || hostname.length > 253) {
    throw badRequest('访问来源需要是有效主机名。');
  }
  return hostname === publicHostname ? '' : hostname;
}

function eventTarget(name: AnalyticsEventName, target: string): string {
  if (name === 'outbound_click') {
    const hostname = target.toLowerCase();
    if (!hostnamePattern.test(hostname)) throw badRequest('外链事件需要有效目标主机名。');
    return hostname;
  }
  if ((name === 'reaction' || name === 'comment') && entryPathPattern.test(target)) return target;
  if (name === 'search' && target === '/search') return target;
  if (name === 'guestbook_message' && target === '/guestbook') return target;
  if (name === 'resume_download_click' && target === '/resume') return target;
  throw badRequest('埋点事件的目标无效。');
}

export function registerAnalyticsRoutes(
  server: FastifyInstance,
  options: {
    auth: JournalAuth;
    repository: AnalyticsRepository;
    visitorSecret: string;
    publicBaseUrl: string;
  },
): void {
  const { auth, repository, visitorSecret } = options;
  const publicUrl = new URL(options.publicBaseUrl);
  const hash = (scope: string, value: string) => createHmac('sha256', visitorSecret)
    .update(`journal-analytics:${scope}:${value}`)
    .digest('hex');
  const visitorRateLimitKey = (request: FastifyRequest): string => hash(
    'rate-limit',
    visitorIdentitySchema.parse(request.headers['x-journal-visitor-id']),
  );

  const collect = async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'private, no-store');
    const origin = request.headers.origin;
    if (typeof origin !== 'string') {
      return reply.code(403).send({ error: '埋点请求缺少来源。' });
    }
    const parsedOrigin = z.url().safeParse(origin);
    if (!parsedOrigin.success) {
      return reply.code(403).send({ error: '埋点请求来源无效。' });
    }
    const originUrl = new URL(parsedOrigin.data);
    const localRequest = localHostnames.has(request.hostname)
      && localHostnames.has(originUrl.hostname)
      && (originUrl.protocol === 'http:' || originUrl.protocol === 'https:');
    if (originUrl.origin !== publicUrl.origin && !localRequest) {
      return reply.code(403).send({ error: '埋点请求来源不被允许。' });
    }
    if (auth.isAdmin(request) || isBot(request.headers['user-agent'])) {
      return reply.code(204).send();
    }
  };

  server.post('/api/analytics/pageviews', {
    bodyLimit: 8192,
    preHandler: collect,
    config: { rateLimit: { max: 120, timeWindow: '1 minute', keyGenerator: visitorRateLimitKey } },
  }, async (request, reply) => {
    const input = analyticsPageviewSchema.parse(request.body);
    const userAgent = request.headers['user-agent'];
    const agent = userAgent ? Bowser.parse(userAgent) : null;
    const platform = agent?.platform.type;
    const device: AnalyticsDevice = platform === 'desktop' || platform === 'mobile' || platform === 'tablet'
      ? platform
      : 'unknown';
    repository.recordPageview({
      id: hash('pageview', input.id),
      visitorHash: hash('visitor', input.visitorId),
      sessionHash: hash('session', `${input.visitorId}:${input.sessionId}`),
      path: input.path,
      referrer: referrerHost(input.referrer, publicUrl.hostname),
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      browser: agent?.browser.name || 'unknown',
      system: agent?.os.name || 'unknown',
      device,
      now: Date.now(),
    });
    return reply.code(204).send();
  });

  server.post('/api/analytics/activity', {
    bodyLimit: 1024,
    preHandler: collect,
    config: { rateLimit: { max: 600, timeWindow: '1 minute', keyGenerator: visitorRateLimitKey } },
  }, async (request, reply) => {
    const input = analyticsActivitySchema.parse(request.body);
    const updated = repository.recordActivity(
      hash('pageview', input.pageviewId),
      hash('visitor', input.visitorId),
      input.activeMs,
      Date.now(),
    );
    if (!updated) return reply.code(404).send({ error: '对应页面访问记录不存在。' });
    return reply.code(204).send();
  });

  server.post('/api/analytics/events', {
    bodyLimit: 2048,
    preHandler: collect,
    config: { rateLimit: { max: 120, timeWindow: '1 minute', keyGenerator: visitorRateLimitKey } },
  }, async (request, reply) => {
    const input = analyticsEventSchema.parse(request.body);
    const recorded = repository.recordEvent({
      pageviewId: hash('pageview', input.pageviewId),
      visitorHash: hash('visitor', input.visitorId),
      name: input.name,
      target: eventTarget(input.name, input.target),
      now: Date.now(),
    });
    if (!recorded) return reply.code(404).send({ error: '对应页面访问记录不存在。' });
    return reply.code(204).send();
  });

  server.get('/api/me/analytics', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const input = filtersSchema.parse(request.query);
    reply.header('Cache-Control', 'private, no-store');
    return repository.overview({
      from: input.from,
      to: input.to,
      ...(input.path ? { path: input.path } : {}),
      ...(input.referrer ? { referrer: input.referrer } : {}),
      ...(input.device ? { device: input.device } : {}),
    });
  });
}
