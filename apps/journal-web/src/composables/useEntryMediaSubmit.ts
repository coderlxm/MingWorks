import { computed, onBeforeUnmount, readonly, shallowRef } from 'vue';
import { Upload } from 'tus-js-client';
import { bindEntryUploadDriveVideo, createEntryUpload, discardEntryUpload, processEntryUpload } from '../api';
import type { PendingPublisherMedia } from '../types';
import { markPublishProbe } from '../utils/publishProbe';

const chunkSize = 32 * 1024 * 1024;

export function useEntryMediaSubmit() {
  const uploading = shallowRef(false);
  const progress = shallowRef(0);
  const stageText = shallowRef('');
  const error = shallowRef<string | null>(null);
  const activeUpload = shallowRef<Upload | null>(null);
  let activeUploadId: string | null = null;
  let activeController: AbortController | null = null;

  const busy = computed(() => uploading.value);

  async function uploadFile(
    file: File,
    uploadId: string,
    token: string,
    position: number,
    itemCount: number,
    signal: AbortSignal,
  ): Promise<string> {
    let cancel!: () => void;
    return await new Promise<string>((resolve, reject) => {
      cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      const upload = new Upload(file, {
        endpoint: '/api/me/entry-file-uploads',
        chunkSize,
        retryDelays: [],
        storeFingerprintForResuming: false,
        headers: { Authorization: `Bearer ${token}` },
        metadata: {
          entryUploadId: uploadId,
          filename: file.name,
          filetype: file.type,
          position: String(position),
        },
        onProgress(bytesUploaded, bytesTotal) {
          progress.value = Math.floor(((position + bytesUploaded / bytesTotal * 0.9) / itemCount) * 100);
        },
        onError(reason) {
          reject(reason);
        },
        onSuccess() {
          const assetUploadId = upload.url
            ? new URL(upload.url, window.location.origin).pathname.split('/').pop()
            : null;
          if (!assetUploadId) {
            reject(new Error('服务器没有返回媒体上传标识。'));
            return;
          }
          resolve(assetUploadId);
        },
      });
      activeUpload.value = upload;
      upload.start();
    }).finally(() => {
      signal.removeEventListener('abort', cancel);
      activeUpload.value = null;
    });
  }

  async function submit(items: readonly PendingPublisherMedia[], entryId?: number): Promise<string | null> {
    uploading.value = true;
    progress.value = 0;
    stageText.value = '正在创建媒体会话…';
    error.value = null;
    const controller = new AbortController();
    activeController = controller;
    let uploadId: string | null = null;
    try {
      markPublishProbe('UPLOAD_REQUEST_STARTED');
      const upload = await createEntryUpload(entryId);
      markPublishProbe('UPLOAD_REQUEST_COMPLETED');
      uploadId = upload.uploadId;
      activeUploadId = uploadId;
      controller.signal.throwIfAborted();
      for (const [position, item] of items.entries()) {
        controller.signal.throwIfAborted();
        if (item.kind === 'drive') {
          stageText.value = `正在验证云盘视频并提取封面…（${position + 1}/${items.length}）`;
          await bindEntryUploadDriveVideo(uploadId, item.video.driveFileId, controller.signal);
        } else {
          stageText.value = `正在上传 ${item.file.name}…（${position + 1}/${items.length}）`;
          const assetUploadId = await uploadFile(item.file, uploadId, upload.token, position, items.length, controller.signal);
          controller.signal.throwIfAborted();
          stageText.value = `正在处理 ${item.file.name}…`;
          await processEntryUpload(uploadId, assetUploadId);
        }
        controller.signal.throwIfAborted();
        progress.value = Math.round(((position + 1) / items.length) * 100);
      }
      progress.value = 100;
      stageText.value = '媒体已准备完成';
      activeUploadId = null;
      return uploadId;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason);
      if (uploadId && activeUploadId === uploadId) {
        activeUploadId = null;
        await discardEntryUpload(uploadId);
      }
      return null;
    } finally {
      uploading.value = false;
      activeController = null;
    }
  }

  onBeforeUnmount(() => {
    activeController?.abort();
    void activeUpload.value?.abort();
    if (activeUploadId) {
      const uploadId = activeUploadId;
      activeUploadId = null;
      void discardEntryUpload(uploadId);
    }
  });

  return { busy: readonly(busy), progress: readonly(progress), stageText: readonly(stageText), error: readonly(error), submit };
}
