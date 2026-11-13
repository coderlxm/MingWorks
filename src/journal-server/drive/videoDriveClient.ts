import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { google, type drive_v3 } from 'googleapis';
import { JournalNoRetryOAuth2Client } from './driveAuth.js';

const driveFileFields = [
  'id', 'name', 'mimeType', 'parents', 'trashed', 'md5Checksum', 'headRevisionId',
  'modifiedTime', 'size', 'capabilities(canDownload)', 'shortcutDetails',
  'videoMediaMetadata(width,height,durationMillis)',
].join(',');

export class JournalDriveVideoError extends Error {
  constructor(message: string, readonly statusCode: number = 400) {
    super(message);
  }
}

export interface JournalDriveMediaResponse {
  status: 200 | 206 | 416;
  stream: Readable;
  contentType: string | null;
  contentLength: string | null;
  contentRange: string | null;
}

export interface JournalVideoByteRange {
  start: number;
  end: number;
}

// undefined means a full response; null means an invalid or unsatisfiable range.
export function parseDriveVideoRange(
  header: string | undefined,
  byteSize: number,
): JournalVideoByteRange | null | undefined {
  if (header === undefined) return undefined;
  if (byteSize <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, byteSize - suffix), end: byteSize - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : byteSize - 1;
  if (
    !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start >= byteSize || end < start
  ) return null;
  return { start, end: Math.min(end, byteSize - 1) };
}

export function assertDriveMediaVersion(media: JournalDriveMediaResponse, byteSize: number): void {
  if (media.status === 206 || media.status === 416) {
    const match = media.status === 206
      ? /^bytes \d+-\d+\/(\d+)$/.exec(media.contentRange ?? '')
      : /^bytes \*\/(\d+)$/.exec(media.contentRange ?? '');
    if (!match) throw new Error('Google Drive 返回了无效的 Content-Range。');
    if (Number(match[1]) !== byteSize) {
      throw new JournalDriveVideoError('云盘文件已更新，请移除旧附件并重新绑定。', 409);
    }
  } else if (media.contentLength !== null && Number(media.contentLength) !== byteSize) {
    throw new JournalDriveVideoError('云盘文件已更新，请移除旧附件并重新绑定。', 409);
  }
}

function assertDriveId(id: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new JournalDriveVideoError('Google Drive 文件 ID 无效。');
}

export class JournalVideoDriveClient {
  private readonly auth: JournalNoRetryOAuth2Client;
  private readonly drive: drive_v3.Drive;

  constructor(options: { clientId: string; clientSecret: string; refreshToken: string }) {
    this.auth = new JournalNoRetryOAuth2Client({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      forceRefreshOnFailure: false,
    });
    this.auth.setCredentials({ refresh_token: options.refreshToken });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async listChildren(parentFolderId: string): Promise<drive_v3.Schema$File[]> {
    assertDriveId(parentFolderId);
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and trashed = false`,
        orderBy: 'modifiedTime desc,name',
        pageSize: 1000,
        fields: `nextPageToken,files(${driveFileFields})`,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        ...(pageToken ? { pageToken } : {}),
      }, { retry: false });
      files.push(...(response.data.files ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return files;
  }

  async getFile(fileId: string, signal?: AbortSignal): Promise<drive_v3.Schema$File> {
    assertDriveId(fileId);
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: driveFileFields,
        supportsAllDrives: true,
      }, { retry: false, ...(signal ? { signal } : {}) });
      return response.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 403 || status === 404) {
        throw new JournalDriveVideoError(
          status === 404 ? '云盘文件不存在或不可访问。' : '无权读取此云盘文件。', status,
        );
      }
      throw error;
    }
  }

  async openMediaStream(
    fileId: string,
    options: { range?: string; signal: AbortSignal },
  ): Promise<JournalDriveMediaResponse> {
    assertDriveId(fileId);
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    options.signal.throwIfAborted();
    const headers = await this.auth.getRequestHeaders(url);
    headers.set('Accept-Encoding', 'identity');
    if (options.range !== undefined) headers.set('Range', options.range);
    const response = await fetch(url, { headers, signal: options.signal, redirect: 'follow' });
    const encoding = response.headers.get('content-encoding');
    if (encoding !== null && encoding.trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new Error(`Google Drive 返回了不支持的 Content-Encoding: ${encoding}。`);
    }
    if (response.status !== 200 && response.status !== 206 && response.status !== 416) {
      const summary = (await response.text()).slice(0, 1000);
      throw new Error(`Google Drive 视频请求失败（HTTP ${response.status}）：${summary}`);
    }
    if (response.body === null) throw new Error('Google Drive 视频响应缺少媒体流。');
    return {
      status: response.status,
      stream: Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      contentRange: response.headers.get('content-range'),
    };
  }
}
