import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { WebPlainAttachmentInput } from '../data/repository.js';
import type { EntryStorageSession, JournalStorage } from '../media/storage.js';
import type { JournalVideoPreviewService } from '../media/videoPreview.js';
import {
  assertDriveMediaVersion,
  JournalDriveVideoError,
  parseDriveVideoRange,
  type JournalVideoDriveClient,
} from './videoDriveClient.js';
import type { JournalVideoLibraryService } from './videoLibraryService.js';

const execFileAsync = promisify(execFile);
const probeSchema = z.object({
  format: z.object({ format_name: z.string(), duration: z.string().optional() }),
  streams: z.array(z.object({
    index: z.number().int().nonnegative(),
    codec_type: z.string(),
    codec_name: z.string().optional(),
    codec_tag_string: z.string().optional(),
    profile: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.string().optional(),
    r_frame_rate: z.string().optional(),
    disposition: z.object({ attached_pic: z.number().int() }).optional(),
    tags: z.object({ rotate: z.string().optional() }).optional(),
    side_data_list: z.array(z.object({ rotation: z.number().optional() })).optional(),
  })),
});

export class JournalDriveVideoIngestService {
  constructor(
    private readonly drive: JournalVideoDriveClient,
    private readonly library: JournalVideoLibraryService,
    private readonly storage: JournalStorage,
    private readonly videoPreviews: JournalVideoPreviewService,
  ) {}

  async ingest(
    fileId: string,
    session: EntryStorageSession,
    cancellation: AbortSignal,
  ): Promise<Extract<WebPlainAttachmentInput, { sourceKind: 'drive' }>> {
    const proxyAbort = new AbortController();
    const signal = AbortSignal.any([cancellation, AbortSignal.timeout(30_000), proxyAbort.signal]);
    const file = await this.library.requireVideo(fileId, signal);
    signal.throwIfAborted();
    if (
      !file.md5Checksum || !file.name
      || (file.mimeType !== 'video/mp4' && file.mimeType !== 'video/webm')
    ) throw new JournalDriveVideoError('云盘视频缺少绑定所需元数据。');
    const byteSize = Number(file.size);
    const mimeType = file.mimeType;
    const tokenPath = `/${randomBytes(24).toString('hex')}`;
    const serve = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      if (request.url !== tokenPath) {
        response.writeHead(404).end();
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const range = parseDriveVideoRange(request.headers.range, byteSize);
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Type', mimeType);
      if (range === null) {
        response.writeHead(416, { 'Content-Range': `bytes */${byteSize}` }).end();
        return;
      }
      if (request.method === 'HEAD') {
        response.writeHead(range ? 206 : 200, {
          'Content-Length': String(range ? range.end - range.start + 1 : byteSize),
          ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${byteSize}` } : {}),
        }).end();
        return;
      }
      const controller = new AbortController();
      response.once('close', () => {
        if (!response.writableEnded) controller.abort();
      });
      const requestSignal = AbortSignal.any([signal, controller.signal]);
      try {
        const media = await this.drive.openMediaStream(fileId, {
          signal: requestSignal,
          ...(range ? { range: `bytes=${range.start}-${range.end}` } : {}),
        });
        // Own stream errors even if cancellation happens before pipeline is attached.
        media.stream.on('error', (error: Error) => {
          if (!requestSignal.aborted) {
            proxyAbort.abort(error);
          }
        });
        try {
          requestSignal.throwIfAborted();
          assertDriveMediaVersion(media, byteSize);
        } catch (error) {
          media.stream.destroy();
          throw error;
        }
        if (media.status === 416) {
          media.stream.destroy();
          response.writeHead(416, { 'Content-Range': `bytes */${byteSize}` }).end();
          return;
        }
        response.statusCode = media.status;
        if (media.contentLength !== null) response.setHeader('Content-Length', media.contentLength);
        if (media.contentRange !== null) response.setHeader('Content-Range', media.contentRange);
        await pipeline(media.stream, response, { signal: requestSignal });
      } catch (error) {
        // ffprobe/ffmpeg deliberately close individual ranges when seeking.
        if (controller.signal.aborted && !signal.aborted) {
          response.destroy();
          return;
        }
        throw error;
      }
    };
    const server = createServer((request, response) => {
      void serve(request, response).catch((error: unknown) => {
        if (!signal.aborted) proxyAbort.abort(error);
        response.destroy();
      });
    });
    const target = this.storage.previewOnlyTarget(session);
    const stop = () => server.closeAllConnections();
    signal.addEventListener('abort', stop, { once: true });
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once('error', onError);
        server.listen({ host: '127.0.0.1', port: 0, signal }, () => {
          server.removeListener('error', onError);
          resolve();
        });
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      signal.throwIfAborted();
      const address = server.address();
      if (address === null || typeof address === 'string') throw new Error('视频回环代理地址无效。');
      const url = `http://127.0.0.1:${address.port}${tokenPath}`;
      const result = await execFileAsync('ffprobe', [
        '-v', 'error', '-show_entries',
        'format=format_name,duration:stream=index,codec_type,codec_name,codec_tag_string,profile,width,height,duration,r_frame_rate:stream_disposition=attached_pic:stream_tags=rotate:stream_side_data=rotation',
        '-of', 'json', url,
      ], { maxBuffer: 1024 * 1024, signal });
      const probe = probeSchema.parse(JSON.parse(result.stdout));
      const video = probe.streams.find(stream => (
        stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1
      ));
      if (!video?.width || !video.height) throw new JournalDriveVideoError('视频没有可用的主视频轨道或尺寸。');
      const audio = probe.streams.filter(stream => stream.codec_type === 'audio');
      const formats = probe.format.format_name.split(',');
      if (mimeType === 'video/mp4') {
        if (!formats.includes('mp4')) throw new JournalDriveVideoError('MP4 文件封装不符合要求。');
        if (
          video.codec_name !== 'h264'
          && !(video.codec_name === 'hevc' && video.codec_tag_string === 'hvc1'
            && (video.profile === 'Main' || video.profile === 'Main 10'))
        ) throw new JournalDriveVideoError('MP4 视频须为 H.264 或带 hvc1 标签的 HEVC Main / Main 10。');
        if (audio.length > 0 && !audio.some(stream => stream.codec_name === 'aac' || stream.codec_name === 'mp3')) {
          throw new JournalDriveVideoError('MP4 音轨须包含 AAC 或 MP3。');
        }
      } else {
        if (!formats.includes('webm')) throw new JournalDriveVideoError('WebM 文件封装不符合要求。');
        if (!['vp8', 'vp9', 'av1'].includes(video.codec_name ?? '')) {
          throw new JournalDriveVideoError('WebM 视频须为 VP8、VP9 或 AV1。');
        }
        if (audio.length > 0 && !audio.some(stream => stream.codec_name === 'opus' || stream.codec_name === 'vorbis')) {
          throw new JournalDriveVideoError('WebM 音轨须包含 Opus 或 Vorbis。');
        }
      }
      const rotation = video.side_data_list?.find(data => data.rotation !== undefined)?.rotation
        ?? Number(video.tags?.rotate ?? 0);
      if (!Number.isFinite(rotation)) throw new JournalDriveVideoError('视频旋转信息无效。');
      const swapped = Math.abs(rotation % 180) === 90;
      const width = swapped ? video.height : video.width;
      const height = swapped ? video.width : video.height;
      if (Math.max(width, height) > 3840 || Math.min(width, height) > 2160) {
        throw new JournalDriveVideoError('视频长边不能超过 3840，短边不能超过 2160。');
      }
      const rateParts = video.r_frame_rate?.split('/').map(Number);
      const frameRate = rateParts?.length === 2
        ? Number(rateParts[0]) / Number(rateParts[1]) : Number(video.r_frame_rate);
      if (!Number.isFinite(frameRate) || frameRate <= 0 || frameRate > 60) {
        throw new JournalDriveVideoError('视频帧率须大于 0 且不超过 60 fps。');
      }
      const duration = Number(video.duration ?? probe.format.duration);
      if (!Number.isFinite(duration) || duration <= 0) throw new JournalDriveVideoError('视频时长须大于 0。');
      await this.videoPreviews.generate(url, target.previewAbsolutePath, { duration, signal });
      signal.throwIfAborted();
      return {
        sourceKind: 'drive', driveFileId: fileId, driveMd5Checksum: file.md5Checksum,
        relativePath: null, previewRelativePath: target.previewRelativePath, posterRelativePath: null,
        kind: 'video', mimeType, originalName: file.name, byteSize, width, height,
        duration: Math.ceil(duration),
      };
    } catch (error) {
      await fs.promises.rm(target.previewAbsolutePath, { force: true });
      if (proxyAbort.signal.aborted) throw proxyAbort.signal.reason;
      if (error instanceof JournalDriveVideoError) throw error;
      if (signal.aborted) throw new JournalDriveVideoError('云盘视频绑定已取消或超过 30 秒。');
      throw new JournalDriveVideoError(`云盘视频探测或封面抽帧失败：${(error as Error).message}`);
    } finally {
      signal.removeEventListener('abort', stop);
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolve();
        });
        server.closeAllConnections();
      });
    }
  }
}
