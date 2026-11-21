import type { FastifyInstance } from 'fastify';
import { Telegraf } from 'telegraf';
import { z } from 'zod';
import {
  journalIngestRequestSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalDeletionService } from '../entries/deletion.js';
import type { JournalIngestService } from '../telegram/ingest.js';
import type { JournalRepository } from '../data/repository.js';

const publicIdParamsSchema = z.object({
  publicId: z.string().uuid(),
});

const internalVisibilityRequestSchema = z.object({
  visibility: z.enum(['private', 'public']),
});

const internalAlertRequestSchema = z.strictObject({
  source: z.string().trim().min(1).max(64).optional(),
  event: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(3000).optional(),
  lines: z.array(z.string().max(500)).min(1).max(40).optional(),
});

type InternalAlertInput = z.infer<typeof internalAlertRequestSchema>;

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatInternalAlertHtml(input: InternalAlertInput): string {
  const sections: string[] = [`<b>${escapeHtml(input.title)}</b>`];
  const meta: string[] = [];
  if (input.source !== undefined) meta.push(`来源：<code>${escapeHtml(input.source)}</code>`);
  if (input.event !== undefined) meta.push(`事件：<code>${escapeHtml(input.event)}</code>`);
  if (meta.length > 0) sections.push(meta.join(' · '));
  if (input.body !== undefined) sections.push('', escapeHtml(input.body));
  if (input.lines !== undefined) sections.push('', ...input.lines.map((line) => escapeHtml(line)));
  return sections.join('\n');
}

function sanitizeTelegramError(error: unknown, token: string): Error {
  const raw = error instanceof Error ? error.message : String(error);
  const sanitized = raw
    .replaceAll(token, '[REDACTED]')
    .replaceAll(/\/bot[^/\s]+/g, '/bot[REDACTED]');
  return new Error(sanitized);
}

interface InternalRoutesOptions {
  auth: JournalAuth;
  deletionService: JournalDeletionService;
  ingestService: JournalIngestService;
  repository: JournalRepository;
  telegramToken: string;
  allowedChatId: string;
}

export async function registerInternalRoutes(
  server: FastifyInstance,
  options: InternalRoutesOptions,
): Promise<void> {
  const alertBot = new Telegraf(options.telegramToken);

  server.post('/api/internal/alerts', {
    preHandler: options.auth.requireInternal,
  }, async (request, reply) => {
    const input = internalAlertRequestSchema.parse(request.body);
    const message = formatInternalAlertHtml(input);
    // Serialized HTML length is always >= rendered text length, keeping a safe margin under Telegram's 4096-char limit.
    if (message.length > 4096) {
      return reply.code(400).send({ error: 'Formatted alert exceeds Telegram 4096 character limit.' });
    }
    try {
      const sent = await alertBot.telegram.sendMessage(options.allowedChatId, message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      return { ok: true, messageId: sent.message_id };
    } catch (error) {
      throw sanitizeTelegramError(error, options.telegramToken);
    }
  });

  server.post('/api/internal/telegram-entries', {
    preHandler: options.auth.requireInternal,
  }, async (request) => {
    const input = journalIngestRequestSchema.parse(request.body);
    return options.ingestService.ingest(input);
  });

  server.patch('/api/internal/telegram-entries/:publicId/visibility', {
    preHandler: options.auth.requireInternal,
  }, async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const input = internalVisibilityRequestSchema.parse(request.body);
    const entry = options.repository.updateVisibilityByPublicId(publicId, input.visibility);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.delete('/api/internal/telegram-entries/:publicId', {
    preHandler: options.auth.requireInternal,
  }, async (request, reply) => {
    const { publicId } = publicIdParamsSchema.parse(request.params);
    const result = await options.deletionService.deleteByPublicId(publicId);
    if (!result) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return result;
  });
}
