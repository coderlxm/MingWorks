import type { drive_v3 } from 'googleapis';
import {
  journalDriveVideoCatalogSchema,
  type JournalDriveVideoCatalog,
  type JournalDriveVideoFolder,
  type JournalDriveVideoItem,
} from '../../shared/journalProtocol.js';
import type { JournalRepository } from '../data/repository.js';
import { JournalDriveVideoError, type JournalVideoDriveClient } from './videoDriveClient.js';

export function isDownloadableDriveVideo(file: drive_v3.Schema$File): boolean {
  return file.trashed !== true
    && file.shortcutDetails == null
    && file.capabilities?.canDownload === true
    && (file.mimeType === 'video/mp4' || file.mimeType === 'video/webm')
    && Number.isSafeInteger(Number(file.size)) && Number(file.size) > 0
    && typeof file.md5Checksum === 'string' && file.md5Checksum.length > 0;
}

export class JournalVideoLibraryService {
  private cache: { catalog: JournalDriveVideoCatalog; expiresAt: number } | null = null;
  private inFlight: Promise<JournalDriveVideoCatalog> | null = null;

  constructor(
    private readonly drive: JournalVideoDriveClient,
    private readonly repository: JournalRepository,
    private readonly rootFolderId: string,
  ) {}

  async list(refresh = false): Promise<JournalDriveVideoCatalog> {
    let catalog: JournalDriveVideoCatalog;
    if (this.inFlight !== null) {
      catalog = await this.inFlight;
    } else if (!refresh && this.cache !== null && this.cache.expiresAt > Date.now()) {
      catalog = this.cache.catalog;
    } else {
      // A failed refresh must not leave an older catalog available as a substitute.
      this.cache = null;
      const pending = this.scan();
      this.inFlight = pending;
      try {
        catalog = await pending;
        this.cache = { catalog, expiresAt: Date.now() + 60_000 };
      } finally {
        this.inFlight = null;
      }
    }
    const counts = this.repository.countDriveVideoLinks(catalog.videos.map(video => video.driveFileId));
    return {
      ...catalog,
      videos: catalog.videos.map(video => ({
        ...video, linkedEntryCount: counts.get(video.driveFileId) ?? 0,
      })),
    };
  }

  async requireVideo(fileId: string, signal: AbortSignal): Promise<drive_v3.Schema$File> {
    const file = await this.drive.getFile(fileId, signal);
    if (file.trashed === true) throw new JournalDriveVideoError('云盘文件已在回收站。', 404);
    let insideRoot = file.parents?.includes(this.rootFolderId) === true;
    if (!insideRoot) {
      for (const parentId of file.parents ?? []) {
        const parent = await this.drive.getFile(parentId, signal);
        if (
          parent.trashed !== true && parent.shortcutDetails == null
          && parent.mimeType === 'application/vnd.google-apps.folder'
          && parent.parents?.includes(this.rootFolderId) === true
        ) {
          insideRoot = true;
          break;
        }
      }
    }
    if (!insideRoot) throw new JournalDriveVideoError('只能绑定视频根目录或其一级子文件夹中的视频。', 403);
    if (!isDownloadableDriveVideo(file)) {
      throw new JournalDriveVideoError('文件必须是可下载、非快捷方式且具有内容校验和的 MP4 或 WebM 视频。');
    }
    if (!file.id || !file.name) throw new JournalDriveVideoError('云盘文件缺少 ID 或名称。');
    return file;
  }

  private async scan(): Promise<JournalDriveVideoCatalog> {
    const children = await this.drive.listChildren(this.rootFolderId);
    const folders: JournalDriveVideoFolder[] = [];
    const videos: JournalDriveVideoItem[] = [];
    this.collect(children, this.rootFolderId, null, videos);
    for (const folder of children) {
      if (
        folder.trashed === true || folder.shortcutDetails != null
        || folder.mimeType !== 'application/vnd.google-apps.folder'
      ) continue;
      if (!folder.id || !folder.name) throw new Error('Google Drive 视频文件夹缺少 ID 或名称。');
      folders.push({ id: folder.id, name: folder.name });
      this.collect(await this.drive.listChildren(folder.id), folder.id, folder.name, videos);
    }
    videos.sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime));
    return journalDriveVideoCatalogSchema.parse({ folders, videos, fetchedAt: new Date().toISOString() });
  }

  private collect(
    files: drive_v3.Schema$File[],
    folderId: string,
    folderName: string | null,
    videos: JournalDriveVideoItem[],
  ): void {
    for (const file of files) {
      if (!isDownloadableDriveVideo(file)) continue;
      if (!file.id || !file.name || !file.modifiedTime || !file.md5Checksum) {
        throw new Error('Google Drive 视频缺少目录所需元数据。');
      }
      if (file.mimeType !== 'video/mp4' && file.mimeType !== 'video/webm') {
        throw new Error('Google Drive 视频 MIME 类型无效。');
      }
      videos.push({
        driveFileId: file.id,
        name: file.name,
        folderId,
        folderName,
        mimeType: file.mimeType,
        byteSize: Number(file.size),
        modifiedTime: file.modifiedTime,
        width: file.videoMediaMetadata?.width ?? null,
        height: file.videoMediaMetadata?.height ?? null,
        durationMillis: file.videoMediaMetadata?.durationMillis == null
          ? null : Number(file.videoMediaMetadata.durationMillis),
        md5Checksum: file.md5Checksum,
        linkedEntryCount: 0,
      });
    }
  }
}
