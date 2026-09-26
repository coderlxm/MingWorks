import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { encode } from 'eventsource-encoder';
import { z } from 'zod';
import { journalAiSendMessageRequestSchema } from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import { JournalKnowledgeAgentService } from '../knowledge/knowledgeAgentService.js';

const sessionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const messageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const stopParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  messageId: z.coerce.number().int().positive(),
});

export async function registerKnowledgeRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  service: JournalKnowledgeAgentService,
): Promise<void> {
  server.get('/api/me/ai/sessions', {
    preHandler: auth.requireAdmin,
  }, async () => ({ sessions: service.listSessions() }));

  server.post('/api/me/ai/sessions', {
    preHandler: auth.requireAdmin,
  }, async () => service.createSession());

  server.get('/api/me/ai/sessions/:id', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = sessionParamsSchema.parse(request.params);
    const detail = service.getSession(id);
    if (detail === null) {
      return reply.code(404).send({ error: 'AI 会话不存在。' });
    }
    return detail;
  });

  server.delete('/api/me/ai/sessions/:id', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = sessionParamsSchema.parse(request.params);
    if (service.deleteSession(id) === false) {
      return reply.code(404).send({ error: 'AI 会话不存在。' });
    }
    return { ok: true };
  });

  server.post('/api/me/ai/sessions/:id/messages', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = sessionParamsSchema.parse(request.params);
    const { content } = journalAiSendMessageRequestSchema.parse(request.body);
    const { assistantMessage, events } = service.startMessage(id, content);
    const stream = Readable.from((async function* () {
      for await (const event of events) {
        yield encode({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    })(), { objectMode: false });

    reply.raw.on('close', () => {
      void service.cancelMessage(id, assistantMessage.id);
    });
    try {
      return reply
        .header('Content-Type', 'text/event-stream; charset=utf-8')
        .header('Cache-Control', 'private, no-store, no-transform')
        .header('X-Accel-Buffering', 'no')
        .send(stream);
    }
    catch (error) {
      void service.cancelMessage(id, assistantMessage.id);
      throw error;
    }
  });

  server.post('/api/me/ai/sessions/:id/messages/:messageId/stop', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id, messageId } = stopParamsSchema.parse(request.params);
    const message = await service.stopMessage(id, messageId);
    if (message === null) {
      return reply.code(404).send({ error: 'AI 消息不存在。' });
    }
    return message;
  });

  server.post('/api/me/ai/messages/:id/save-article', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = messageParamsSchema.parse(request.params);
    const article = await service.saveMessageAsArticle(id);
    return { article };
  });
}
