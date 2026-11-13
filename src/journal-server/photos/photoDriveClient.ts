import type { Readable } from 'node:stream';
import { type drive_v3, google } from 'googleapis';
import { JournalNoRetryOAuth2Client } from '../drive/driveAuth.js';

const driveChildFields = [
  'id',
  'name',
  'mimeType',
  'parents',
  'md5Checksum',
  'modifiedTime',
  'size',
  'capabilities(canDownload)',
  'imageMediaMetadata(width,height,rotation,time,cameraMake,cameraModel,lens,focalLength,aperture,exposureTime,isoSpeed)',
].join(',');

export interface JournalPhotoDriveClientOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function driveRequestError(operation: string, reason: unknown): Error {
  const status = reason && typeof reason === 'object' && 'response' in reason
    ? (reason as { response?: { status?: unknown } }).response?.status
    : undefined;
  return new Error(
    typeof status === 'number'
      ? `${operation} failed with HTTP ${status}.`
      : `${operation} failed.`,
  );
}

export class JournalPhotoDriveClient {
  private readonly drive: drive_v3.Drive;

  constructor(options: JournalPhotoDriveClientOptions) {
    const auth = new JournalNoRetryOAuth2Client({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      forceRefreshOnFailure: false,
    });
    auth.setCredentials({ refresh_token: options.refreshToken });
    this.drive = google.drive({ version: 'v3', auth });
  }

  async listChildren(parentFolderId: string): Promise<drive_v3.Schema$File[]> {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      try {
        const response = await this.drive.files.list({
          q: `'${parentFolderId}' in parents and trashed = false`,
          spaces: 'drive',
          pageSize: 1000,
          ...(pageToken ? { pageToken } : {}),
          fields: `nextPageToken,files(${driveChildFields})`,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        }, { retry: false });
        files.push(...(response.data.files ?? []));
        pageToken = response.data.nextPageToken ?? undefined;
      } catch (reason) {
        throw driveRequestError('Google Drive photo folder listing', reason);
      }
    } while (pageToken);

    return files;
  }

  async openFile(fileId: string, signal: AbortSignal): Promise<Readable> {
    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      }, {
        responseType: 'stream',
        retry: false,
        signal,
      });
      return response.data;
    } catch (reason) {
      throw driveRequestError('Google Drive photo media request', reason);
    }
  }
}
