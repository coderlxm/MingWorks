import type { FastifyInstance } from 'fastify';
import { journalAutomationArticleResponseSchema } from '../../shared/journalProtocol.js';
import type { ArticleFileInput, JournalArticleService } from '../articleService.js';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { JournalArticleInputError } from '../articleMarkdown.js';
import type { JournalAuth } from '../auth.js';

export async function registerAutomationArticleRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  articleService: JournalArticleService,
  publicBaseUrl: string,
): Promise<void> {
  server.post('/api/automation/articles', {
    bodyLimit: 40 * 1024 * 1024,
    preHandler: auth.requireArticleAutomation,
  }, async (request, reply) => {
    const uploads = new Map<string, ArticleFileInput>();
    const temporaryDirectory = request.isMultipart() ? await mkdtemp(join(tmpdir(), 'journal-article-')) : null;
    try {
      let input = request.body;
      if (request.isMultipart()) {
        let payload: string | null = null;
        let total = 0;
        for await (const part of request.parts({ limits: { files: 10, fileSize: 20 * 1024 * 1024, fields: 1, fieldSize: 1024 * 1024, parts: 11 } })) {
          if (part.type === 'field') {
            if (part.fieldname !== 'payload' || payload !== null || part.valueTruncated) throw new JournalArticleInputError(400, '无效的文章 payload。');
            payload = String(part.value);
            total += Buffer.byteLength(payload);
          } else {
            if (!/^[a-zA-Z0-9_-]{1,80}$/.test(part.fieldname) || uploads.has(part.fieldname)) throw new JournalArticleInputError(400, '图片 key 无效或重复。');
            const path = join(temporaryDirectory!, part.fieldname);
            const counter = new Transform({ transform(chunk, _encoding, callback) {
              total += chunk.length;
              if (total > 40 * 1024 * 1024) callback(new JournalArticleInputError(413, '图文上传总量不能超过 40 MB。'));
              else callback(null, chunk);
            } });
            await pipeline(part.file, counter, createWriteStream(path, { flags: 'wx' }));
            if (part.file.truncated) throw new JournalArticleInputError(413, '单张图片不能超过 20 MB。');
            uploads.set(part.fieldname, { path, mimeType: part.mimetype, originalName: part.filename });
          }
          if (total > 40 * 1024 * 1024) throw new JournalArticleInputError(413, '图文上传总量不能超过 40 MB。');
        }
        if (payload === null) throw new JournalArticleInputError(400, '缺少文章 payload。');
        try { input = JSON.parse(payload); }
        catch { throw new JournalArticleInputError(400, 'payload 必须是有效 JSON。'); }
      } else if (Buffer.byteLength(JSON.stringify(input)) > 1024 * 1024) {
        throw new JournalArticleInputError(413, '文章 JSON 不能超过 1 MB。');
      }
      const entry = await articleService.createArticleFromMarkdown(input, uploads);
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
    } finally {
      if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true });
    }
  });
}
