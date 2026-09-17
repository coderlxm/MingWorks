import type { FastifyInstance } from 'fastify';
import { journalAutomationArticleResponseSchema } from '../../shared/journalProtocol.js';
import type { JournalArticleService } from '../articleService.js';
import type { JournalAuth } from '../auth.js';

export async function registerAutomationArticleRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  articleService: JournalArticleService,
  publicBaseUrl: string,
): Promise<void> {
  server.post('/api/automation/articles', {
    bodyLimit: 1024 * 1024,
    preHandler: auth.requireArticleAutomation,
  }, async (request, reply) => {
    const entry = articleService.createArticleFromMarkdown(request.body);
    if (entry.title === null) {
      throw new Error('Created automation article did not contain a title.');
    }
    const response = journalAutomationArticleResponseSchema.parse({
      id: entry.id,
      publicId: entry.publicId,
      title: entry.title,
      visibility: entry.visibility,
      editorUrl: `${publicBaseUrl}/me/articles/${entry.id}/edit`,
      readerUrl: `${publicBaseUrl}/p/${entry.publicId}`,
    });
    return reply.code(201).send(response);
  });
}
