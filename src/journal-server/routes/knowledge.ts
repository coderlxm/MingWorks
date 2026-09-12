import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { journalAiSendMessageRequestSchema } from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import { JournalKnowledgeAgentService } from '../knowledgeAgentService.js';

const sessionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const messageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
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
  }, async (request) => {
    const { id } = sessionParamsSchema.parse(request.params);
    const { content } = journalAiSendMessageRequestSchema.parse(request.body);
    return await service.sendMessage(id, content);
  });

  server.post('/api/me/ai/messages/:id/save-article', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = messageParamsSchema.parse(request.params);
    const article = service.saveMessageAsArticle(id);
    return { article };
  });
}
