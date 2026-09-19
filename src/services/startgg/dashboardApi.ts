import Fastify from 'fastify';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import type { Telegraf } from 'telegraf';
import { z } from 'zod';
import { listStartggWatchEvents } from '../startggRepository.js';
import { getStartggPollingRuntimeStatus } from '../../scheduled/jobs.js';
import { dashboardEvent, dashboardFollowing, dashboardEventPlayers, dashboardSeeds, findDashboardEvent, readDashboardSets, readDashboardSnapshot, readDashboardSync, markDashboardError } from './dashboardRepository.js';
import { dismissDiscoveredStartggEvent, addStartggDashboardPlayer, applyStartggInterest, discoverStartggDashboard, pauseStartggDashboard, resolveStartggDashboardPlayers, setStartggDashboardSeeds, startStartggDashboardEvent, syncStartggDashboard, type ResolvedDashboardPlayer } from './control.js';
import { queueStartggTask, getStartggTaskQueueStatus } from './taskQueue.js';

interface Operation {
  id: string; type: string; status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string; startedAt: string | null; finishedAt: string | null; result: unknown; error: string | null;
}
const operations = new Map<string, Operation>();
let currentOperation: Operation | null = null;
let resolvedPlayers: ResolvedDashboardPlayer[] = [];

function submitOperation(type: string, action: () => Promise<unknown>) {
  const unfinished = [...operations.values()].filter(item => item.status === 'queued' || item.status === 'running');
  if ((type !== 'pause' && (getStartggTaskQueueStatus().busy || unfinished.length > 0)) || (type === 'pause' && unfinished.some(item => item.type === 'pause'))) {
    throw Object.assign(new Error('当前任务尚未完成，请等待结果后再操作。'), { statusCode: 409 });
  }
  const operation: Operation = { id: randomUUID(), type, status: 'queued', createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, result: null, error: null };
  operations.set(operation.id, operation);
  currentOperation = operation;
  void queueStartggTask(async () => {
    operation.status = 'running';
    operation.startedAt = new Date().toISOString();
    try {
      operation.result = await action();
      operation.status = 'succeeded';
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      if (['sync', 'start', 'resume', 'seeds', 'interest'].includes(type)) markDashboardError('global', error);
      console.error(`start.gg dashboard ${type} failed`, error);
    } finally {
      operation.finishedAt = new Date().toISOString();
      // Keep pending operations and the two most recently completed outcomes.
      const finished = [...operations.values()].filter(item => item.finishedAt !== null);
      for (const item of finished.slice(0, -2)) operations.delete(item.id);
    }
  });
  return { operationId: operation.id };
}

export async function startStartggDashboardApi(bot: Telegraf): Promise<void> {
  const token = process.env.STARTGG_DASHBOARD_API_TOKEN;
  if (!token) return;
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.STARTGG_DASHBOARD_API_PORT ?? '3411');
  const api = Fastify({ bodyLimit: 16384 });
  api.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply.code(401).send({ error: 'Unauthorized' });
  });
  api.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof z.ZodError ? 400 : (error as { statusCode?: number }).statusCode ?? 500;
    reply.code(statusCode).send({ error: error instanceof Error ? error.message : String(error) });
  });
  api.get('/api/startgg/board', async () => {
    const rows = listStartggWatchEvents();
    const following = dashboardFollowing();
    return { servedAt: new Date().toISOString(), events: rows.map(dashboardEvent),
      players: rows.filter(row => row.active === 1 && row.event_id !== null).flatMap(row => dashboardEventPlayers(row.id).map(player => ({ ...player, eventId: row.event_id!, eventName: row.event_display_name ?? row.event_name }))),
      liveSets: rows.filter(row => row.active === 1).flatMap(row => readDashboardSets(row.id, true)),
      pendingCount: following.pending.length, runtime: { ...getStartggPollingRuntimeStatus(), ...readDashboardSync('global'), ...getStartggTaskQueueStatus() }, operation: currentOperation };
  });
  api.get<{ Params: { eventId: string } }>('/api/startgg/events/:eventId', async (request, reply) => {
    const row = findDashboardEvent(z.coerce.number().int().positive().parse(request.params.eventId));
    if (!row) return reply.code(404).send({ error: '项目记录不存在或已清空。' });
    const snapshot = readDashboardSnapshot(row.id);
    return { servedAt: new Date().toISOString(), event: dashboardEvent(row),
      players: dashboardEventPlayers(row.id, row.active === 1),
      seeds: snapshot?.snapshot.seeds ?? dashboardSeeds(row.id), finalPhase: snapshot?.snapshot.finalPhase ?? null,
      liveSets: readDashboardSets(row.id, true), recentSets: readDashboardSets(row.id).filter(set => set.completedAt !== null).slice(0, 20) };
  });
  api.get<{ Params: { eventId: string } }>('/api/startgg/events/:eventId/sets', async (request, reply) => {
    const row = findDashboardEvent(z.coerce.number().int().positive().parse(request.params.eventId));
    if (!row) return reply.code(404).send({ error: '项目记录不存在或已清空。' });
    const query = z.object({ source: z.enum(['player', 'seed', 'final']).optional(), entrantId: z.coerce.number().int().positive().optional(), cursor: z.string().optional() }).parse(request.query);
    let sets = readDashboardSets(row.id).filter(set => set.completedAt !== null);
    if (query.source) sets = sets.filter(set => set.sources.includes(query.source!));
    if (query.entrantId) sets = sets.filter(set => set.slots.some(slot => slot.entrantId === query.entrantId));
    if (query.cursor) {
      const [completedAt, setId] = z.tuple([z.coerce.number().int(), z.coerce.number().int()]).parse(query.cursor.split(':'));
      sets = sets.filter(set => set.completedAt! < completedAt || (set.completedAt === completedAt && set.setId < setId));
    }
    const page = sets.slice(0, 20);
    const last = page.at(-1);
    return { servedAt: new Date().toISOString(), sets: page, nextCursor: sets.length > 20 && last ? `${last.completedAt}:${last.setId}` : null };
  });
  api.get('/api/startgg/following', async () => dashboardFollowing());
  api.get<{ Params: { operationId: string } }>('/api/startgg/operations/:operationId', async (request, reply) => {
    const operation = operations.get(request.params.operationId);
    if (!operation) return reply.code(404).send({ error: '操作结果不可用，请重新读取当前状态。' });
    return operation;
  });
  api.post('/api/startgg/discover', async (_request, reply) => reply.code(202).send(submitOperation('discover', discoverStartggDashboard)));
  api.post('/api/startgg/discover/dismiss', async (request, reply) => {
    const { eventSlug } = z.object({ eventSlug: z.string().trim().min(1).max(2048) }).parse(request.body);
    return reply.code(202).send(submitOperation('dismiss', () => dismissDiscoveredStartggEvent(bot, eventSlug)));
  });
  api.post('/api/startgg/monitoring/start', async (request, reply) => {
    const { eventSlug, interest } = z.object({ eventSlug: z.string().trim().min(1).max(2048), interest: z.enum(['follow', 'event']).default('follow') }).parse(request.body);
    return reply.code(202).send(submitOperation('start', () => startStartggDashboardEvent(bot, eventSlug, interest)));
  });
  api.post('/api/startgg/monitoring/pause', async (_request, reply) => reply.code(202).send(submitOperation('pause', pauseStartggDashboard)));
  api.post('/api/startgg/monitoring/resume', async (_request, reply) => reply.code(202).send(submitOperation('resume', () => syncStartggDashboard(bot, true))));
  api.post('/api/startgg/sync', async (_request, reply) => reply.code(202).send(submitOperation('sync', () => syncStartggDashboard(bot))));
  api.post<{ Params: { pendingId: string } }>('/api/startgg/interests/:pendingId', async (request, reply) => {
    const pendingId = z.coerce.number().int().positive().parse(request.params.pendingId);
    const { action } = z.object({ action: z.enum(['follow', 'event', 'dismiss']) }).parse(request.body);
    return reply.code(202).send(submitOperation('interest', () => applyStartggInterest(bot, pendingId, action)));
  });
  api.post('/api/startgg/players/resolve', async (request, reply) => {
    const { input } = z.object({ input: z.string().trim().min(1).max(2048) }).parse(request.body);
    return reply.code(202).send(submitOperation('resolve-player', async () => {
      resolvedPlayers = await resolveStartggDashboardPlayers(input);
      return { candidates: resolvedPlayers };
    }));
  });
  api.post('/api/startgg/players', async (request, reply) => {
    const { playerId } = z.object({ playerId: z.number().int().positive() }).parse(request.body);
    const candidate = resolvedPlayers.find(player => player.playerId === playerId);
    if (!candidate) return reply.code(409).send({ error: '候选选手已变化，请重新查找。' });
    return reply.code(202).send(submitOperation('add-player', async () => addStartggDashboardPlayer(candidate)));
  });
  api.put('/api/startgg/settings/featured-seeds', async (request, reply) => {
    const { count } = z.object({ count: z.union([z.literal(0), z.literal(16), z.literal(32)]) }).parse(request.body);
    return reply.code(202).send(submitOperation('seeds', () => setStartggDashboardSeeds(bot, count)));
  });
  await api.listen({ host: '127.0.0.1', port });
  process.once('SIGINT', () => { void api.close(); });
  process.once('SIGTERM', () => { void api.close(); });
  console.log(`start.gg internal dashboard API listening on 127.0.0.1:${port}`);
}
