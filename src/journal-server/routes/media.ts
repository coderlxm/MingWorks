import { create as contentDisposition } from 'content-disposition';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { JournalAuth } from '../auth.js';
import type { JournalRepository } from '../data/repository.js';
import {
  assertDriveMediaVersion,
  parseDriveVideoRange,
  type JournalVideoDriveClient,
} from '../drive/videoDriveClient.js';
import type { JournalAssetAccess } from '../types.js';

const assetParamsSchema = z.object({
  assetId: z.coerce.number().int().positive(),
});

function authorizeAssetAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  asset: JournalAssetAccess,
  auth: JournalAuth,
): boolean {
  if (asset.visibility === 'private' && !auth.isAdmin(request)) {
    reply.code(401).send({ error: 'Journal administrator login is required.' });
    return false;
  }
  if (
    asset.visibility === 'protected'
    && !auth.isAdmin(request)
    && !auth.hasProtectedAccess(request, asset.publicId, asset.accessRevision)
  ) {
    reply.code(401).send({ error: 'Journal access password is required.' });
    return false;
  }
  return true;
}

export async function registerMediaRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  repository: JournalRepository,
  dataDir: string,
  videoDrive: JournalVideoDriveClient,
): Promise<void> {
  server.get('/media/:assetId/preview', async (request, reply) => {
    const { assetId } = assetParamsSchema.parse(request.params);
    const asset = repository.getAssetAccess(assetId);
    if (!asset) return reply.code(404).send({ error: 'Journal asset was not found.' });
    if (!authorizeAssetAccess(request, reply, asset, auth)) return reply;
    if (asset.previewRelativePath === null) {
      return reply.code(404).send({ error: 'Journal asset preview was not found.' });
    }

    reply.header(
      'Cache-Control',
      asset.visibility === 'public' ? 'public, no-cache' : 'private, no-store',
    );
    reply.type('image/webp');
    return reply.sendFile(asset.previewRelativePath, dataDir, {
      acceptRanges: true,
      cacheControl: false,
      contentType: false,
    });
  });

  server.get('/media/:assetId/poster', async (request, reply) => {
    const { assetId } = assetParamsSchema.parse(request.params);
    const asset = repository.getAssetAccess(assetId);
    if (!asset) return reply.code(404).send({ error: 'Journal asset was not found.' });
    if (!authorizeAssetAccess(request, reply, asset, auth)) return reply;
    if (asset.posterRelativePath === null) {
      return reply.code(404).send({ error: 'Journal asset poster was not found.' });
    }

    reply.header(
      'Cache-Control',
      asset.visibility === 'public' ? 'public, no-cache' : 'private, no-store',
    );
    reply.type('image/webp');
    return reply.sendFile(asset.posterRelativePath, dataDir, {
      acceptRanges: true,
      cacheControl: false,
      contentType: false,
    });
  });

  const serveAsset = async (request: FastifyRequest, reply: FastifyReply, head: boolean) => {
    const { assetId } = assetParamsSchema.parse(request.params);
    const asset = repository.getAssetAccess(assetId);
    if (!asset) return reply.code(404).send({ error: 'Journal asset was not found.' });
    if (!authorizeAssetAccess(request, reply, asset, auth)) return reply;

    const filename = asset.originalName ?? `journal-asset-${asset.id}`;
    const dispositionType = asset.kind === 'document' ? 'attachment' : 'inline';
    reply.header('Content-Disposition', contentDisposition(filename, { type: dispositionType }));
    reply.header(
      'Cache-Control',
      asset.visibility === 'public' ? 'public, no-cache' : 'private, no-store',
    );
    if (asset.mimeType) reply.type(asset.mimeType);

    if (asset.sourceKind !== 'drive') {
      if (asset.relativePath === null) throw new Error('Local Journal asset is missing its file path.');
      return reply.sendFile(asset.relativePath, dataDir, {
        acceptRanges: true,
        cacheControl: false,
        contentType: false,
      });
    }
    if (asset.driveFileId === null || asset.byteSize === null || asset.mimeType === null) {
      throw new Error('Drive video asset is missing its media metadata.');
    }
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Cache-Control', 'private, no-store');
    reply.header('X-Accel-Buffering', 'no');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Disposition', contentDisposition(filename, { type: 'inline' }));
    const range = parseDriveVideoRange(request.headers.range, asset.byteSize);
    if (range === null) {
      return reply.code(416).header('Content-Range', `bytes */${asset.byteSize}`).send();
    }
    if (head) {
      reply.code(range ? 206 : 200);
      reply.header('Content-Length', String(range ? range.end - range.start + 1 : asset.byteSize));
      if (range) reply.header('Content-Range', `bytes ${range.start}-${range.end}/${asset.byteSize}`);
      return reply.send();
    }

    const controller = new AbortController();
    reply.raw.once('close', () => {
      if (!reply.raw.writableEnded) controller.abort();
    });
    try {
      const media = await videoDrive.openMediaStream(asset.driveFileId, {
        signal: controller.signal,
        ...(range ? { range: `bytes=${range.start}-${range.end}` } : {}),
      });
      // Fastify owns stream failures after send; this also covers the pre-send cancellation window.
      media.stream.on('error', (error: Error) => {
        if (!controller.signal.aborted) request.log.error(error);
      });
      if (controller.signal.aborted) {
        media.stream.destroy();
        return reply;
      }
      try {
        assertDriveMediaVersion(media, asset.byteSize);
      } catch (error) {
        media.stream.destroy();
        throw error;
      }
      if (media.status === 416) {
        media.stream.destroy();
        return reply.code(416).header('Content-Range', `bytes */${asset.byteSize}`).send();
      }
      reply.code(media.status);
      if (media.contentLength !== null) reply.header('Content-Length', media.contentLength);
      if (media.contentRange !== null) reply.header('Content-Range', media.contentRange);
      return reply.send(media.stream);
    } catch (error) {
      if (controller.signal.aborted) return reply;
      reply.removeHeader('Content-Type');
      throw error;
    }
  };

  server.head('/media/:assetId', (request, reply) => serveAsset(request, reply, true));
  server.get('/media/:assetId', { exposeHeadRoute: false }, (request, reply) => serveAsset(request, reply, false));
}
