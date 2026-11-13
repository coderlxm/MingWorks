# Journal「兴趣」频道接入 Google Drive 视频闭环方案

## 1. 背景、目标与设计边界

当前 `apps/journal-web` 的本地视频上传方案面向短动态设计（限制单条总大小 `<= 500 MiB`、单段时长 `<= 5 分钟`，上传后在 `rndc02` 服务器通过 `ffmpeg` 重封装并完整落盘至 `/opt/journal/data/assets/`）。对于**游戏游玩剪辑或其它中长视频**（常为 1080p60 / 4K60、数百 MiB 至数 GiB），如果直接上传到服务器，会迅速挤占 VPS 磁盘空间。

与此同时，Journal 已接入了持有 5 TB 容量的 Google Drive（当前用于 `/photos` 照片墙），且已配置 `drive.readonly` 只读凭据。本方案旨在**零视频文件落盘、零新增重资产系统**的前提下，打通「剪辑导出 → 云盘存储 → 兴趣频道发帖 → 流畅播放 → 安全清理」的个人使用闭环：

1. **零视频本体落盘**：视频二进制文件仅保存在 Google Drive；`rndc02` 磁盘只保存几十 KB 的本地 `960px` WebP 封面图（`.preview.webp`）及 SQLite 元数据。
2. **复用现有一等模型**：云盘视频作为 `journal_assets` 的一种资产来源直接挂入「兴趣」（`interest`）频道常规条目（`journal_entries`），完整复用现有的瀑布流、详情舞台、`#标签` 筛选、点赞评论、访问控制（公开 / 6 位口令保护 / 私密）以及本地图片与云盘视频同帖混排能力，不另建冗余的独立视频站或管理后台。
3. **只读物理安全**：服务端继续沿用 `drive.readonly` 权限；在 Journal 内删除记录或移除视频附件时，仅清理数据库行与本地 `.preview.webp` 封面，绝不会、也不可能误删 Google Drive 中的原视频。
4. **严禁任何兜底**：不引入自动重试、不引入降级转码或低清缩略图替代路径、不吞掉上游或编码校验错误；任何格式、权限或版本不一致直接暴露具体原因。

---

## 2. 成熟库与组件调研结论

在确定技术栈前，对仓库既有依赖与社区主流方案核实如下：

| 能力域 | 候选方案 | 调研结论与最终选择 |
|---|---|---|
| Google Drive API 客户端 | `googleapis@181.0.0`（项目已安装）vs 自研 REST 客户端 | **复用 `googleapis@181.0.0` 做目录检索与元数据查询；媒体字节流读取绕过 `apirequest` 改用 Node 24 原生 `fetch`**。原因：核查 `node_modules/.pnpm/googleapis@181.0.0/node_modules/googleapis-common/build/src/apirequest.js:238` 可见其强制覆盖请求头 `Accept-Encoding: gzip`，而底层 `node-fetch`（`node_modules/.pnpm/gaxios@7.3.1/node_modules/node-fetch/src/index.js:302`）会在流上自动解压 gzip 却把原始响应头中的压缩后 `Content-Length` 保留给调用方，导致媒体字节范围与 `Content-Length` 错配；此外 `googleapis` 默认开启重试。通过共享自定义无重试 `JournalNoRetryOAuth2Client` 获取短期 Bearer 头，再由 Node 24 原生 `fetch` 显式携带 `Accept-Encoding: identity` 拉取 `alt=media` 流并用 `Readable.fromWeb` 转为 Node `Readable`，可同时保证「零重试 + 零压缩错配 + 标准 Web `Headers` 读取」。 |
| Web 视频播放器 | `vidstack`、`plyr`、`media-chrome`、`artplayer` vs 增强现有 `JournalMediaStage.vue` 原生 `<video>` | **不引入任何第三方播放器库，直接增强现有 `JournalMediaStage.vue`**。原因：`vidstack` 与 `plyr` 在 npm 均已进入 deprecated（仅做安全补丁维护）；`media-chrome` 与 `artplayer` 虽在活跃维护，但内部进度条/帧同步渲染逻辑使用 `requestAnimationFrame`（违反项目禁令），且引入独立样式体系与运行期包体。基于原生 HTML5 `<video>` 事件（`timeupdate` / `loadedmetadata` / `durationchange` / `volumechange` + 原生 Fullscreen API）即可完整满足 16:9 游戏剪辑的时间读数、拖动跳转、音量与全屏需求，无依赖负担。 |
| 媒体探测与封面抽帧 | `ffprobe` + `ffmpeg` + `sharp`（容器已安装） | **继续复用现有工具链**。`deploy/journal/Dockerfile:26` 已在运行镜像中预装 `ffmpeg`（含 `ffprobe`），且 `sharp@0.35.4` 已是服务端依赖。 |

---

## 3. 日常使用闭环（4 步流程）

```
[1. 剪辑导出并放入云盘]
  桌面端 Google Drive 同步文件夹 / 网页端拖入 NotiNewsVideos（支持一级子目录按游戏归档）
          │
          ▼
[2. Journal 发布器一键选片]
  进入 /me/entries/new（从 /interest 跳转时自动选中“兴趣”频道）
  点击「从谷歌云盘选择视频」弹窗 → 按子目录/文件名筛选 → 支持与本地截图混排
          │
          ▼
[3. 绑定时轻量探测 + 封面落盘（0 字节视频落盘）]
  后端校验文件归属与浏览器直出编码 → 回环 HTTP Range 抽取 3 帧 → 生成本地 960px .preview.webp
  记录 drive_file_id、drive_md5_checksum、byte_size、宽高、时长与 MIME，写库发布
          │
          ▼
[4. 前台零预载瀑布流 + 舞台按需流播]
  /interest 瀑布流只显示本地封面 + 时长角标（禁止预加载云盘流）
  点开详情进入舞台 → Fastify /media/:assetId + Nginx 透传 HTTP Range (206) 秒开与拖拽 → 支持全屏/音量
```

### 日常导出规格约定（单用户端）
由于服务端**不做视频转码**，直接流式透传给浏览器播放，因此游戏剪辑导出时需遵循浏览器原生兼容格式（上传/绑定阶段由 `ffprobe` 严格把关，不合规则当场报错退回）：
- **封装与体积**：支持 **MP4**（`.mp4`）与 **WebM**（`.webm`），**不限制** 500 MiB 体积与 5 分钟时长。
- **编码要求**：
  - **MP4**：视频流须为 `H.264`，或 `HEVC (Main / Main 10)` 且流标签必须为 `hvc1`（确保 Safari / iOS 可播，避免不可播的 `hev1`）；若含音轨，至少一条音轨为 `AAC` 或 `MP3`（建议剪映/DaVinci/OBS 导出时勾选 **Fast Start / 网络优化**，将 `moov` 原子置于文件头部以实现零等待秒开）。
  - **WebM**：视频流须为 `VP8`、`VP9` 或 `AV1`；若含音轨，至少一条音轨为 `Opus` 或 `Vorbis`。
- **分辨率与帧率**：长边 `<= 3840`、短边 `<= 2160`（最高 4K）、帧率 `<= 60 fps`。

---

## 4. 环境变量与 Google Drive 客户端改造

### 4.1 环境变量最小增量
- 涉及文件：`src/journal-server/config.ts`、`src/journal-server/types.ts`、`deploy/journal/.env.example`。
- 复用线上已配置的只读 OAuth 凭据（同一 Google 账号、`drive.readonly` 作用域，无需重新扫码授权）：
  - `JOURNAL_PHOTO_DRIVE_CLIENT_ID`
  - `JOURNAL_PHOTO_DRIVE_CLIENT_SECRET`
  - `JOURNAL_PHOTO_DRIVE_REFRESH_TOKEN`
- 仅新增 **1 个**必填环境变量：
  - `JOURNAL_VIDEO_DRIVE_ROOT_FOLDER_ID`：在 `config.ts` 中通过 Zod 校验 `z.string().regex(/^[A-Za-z0-9_-]+$/)`，防止字符串直接拼入 Drive `q` 查询语法产生注入风险。

### 4.2 提取共享无重试 OAuth 与视频 Drive 客户端
为避免与照片墙逻辑耦合，同时防止 OAuth 刷新永久挂起，在 `src/journal-server/drive/`（处于 `deploy/journal/Dockerfile:42` 复制范围 `src/journal-server` 内）组织共享底座：
1. **共享无重试 OAuth 客户端（`src/journal-server/drive/driveAuth.ts`）**：
   - 迁移并复用 `src/journal-server/photos/photoDriveClient.ts:33-63` 中的 `JournalNoRetryOAuth2Client`（保持 `retry: false`、`forceRefreshOnFailure: false`）。
   - 在 `refreshTokenNoCache` 的 POST 请求中显式附带超时控制（例如 `AbortSignal.timeout(15_000)`，或支持调用方传入 `signal`），确保网络卡顿时 OAuth 刷新能够在可控时间内失败暴露，不会无限阻塞媒体请求或绑定任务。
   - **关于 `google-auth-library` 调用签名**：`auth.getRequestHeaders(url)` 用于获取 Bearer 授权头，随后由请求方执行实际 HTTP 请求。
2. **视频专用 Drive 客户端（`src/journal-server/drive/videoDriveClient.ts`）**：
   - `listChildren(parentFolderId: string)`：校验 `parentFolderId` 匹配 `/^[A-Za-z0-9_-]+$/`，调用 `drive.files.list`（`{ retry: false }`）：
     - `q: `'${parentFolderId}' in parents and trashed = false``
     - `orderBy: 'modifiedTime desc,name'`
     - `fields: 'nextPageToken,files(id,name,mimeType,parents,md5Checksum,headRevisionId,modifiedTime,size,capabilities(canDownload),shortcutDetails,videoMediaMetadata(width,height,durationMillis))'`
     - `includeItemsFromAllDrives: true, supportsAllDrives: true`
   - `getFile(fileId: string)`：校验 `fileId` 匹配 `/^[A-Za-z0-9_-]+$/`，调用 `drive.files.get`（`{ retry: false }`）获取上述完整字段及 `trashed`、`parents`。
   - `openMediaStream(fileId: string, options: { range?: string; signal: AbortSignal })`：
     - **不走 `drive.files.get(..., { alt: 'media' })`**（规避 `apirequest.js:238` 强制写死 `Accept-Encoding: gzip` 与 `node-fetch` 自动解压导致 `Content-Length` 失真）。
     - 改为构造 `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`，通过 `auth.getRequestHeaders(url)` 获取授权头后，调用 Node 24 原生 `fetch(url, { headers: { ...authHeaders, ...(range ? { Range: range } : {}), 'Accept-Encoding': 'identity' }, signal, redirect: 'follow' })`。
     - 严格校验 `response.status` 仅接受 `200`、`206`、`416`（其余状态码读取文本错误摘要并直接抛错，不重试、不静默吞错）。
     - 在调用方读取流之前，确认响应头无未声明的 `content-encoding`（若为非 `identity` 则销毁流并抛错），提取规范化的小写单值头部 `{ contentType, contentLength, contentRange }`，并将 `response.body` 通过 `Readable.fromWeb(response.body as ReadableStream)` 转换为 Node `Readable` 返回给 Fastify 或回环代理。

---

## 5. 共享协议与数据库演进（Migration v26）

### 5.1 共享协议（`src/shared/journalProtocol.ts`）
- `journal_entries.source_kind` 维持 `'telegram' | 'web'` 不变（云盘视频条目从 Web 发布器创建，属于 `'web'` 条目）。
- 资产级来源扩展：
  ```ts
  export const journalAssetSourceKindSchema = z.enum(['telegram', 'web', 'drive']);
  ```
- 新增云盘选片目录与绑定契约：
  - `journalDriveVideoFolderSchema`：`{ id, name }`
  - `journalDriveVideoItemSchema`：`{ driveFileId, name, folderId, folderName, mimeType, byteSize, modifiedTime, width, height, durationMillis, md5Checksum, linkedEntryCount }`
  - `journalDriveVideoCatalogSchema`：`{ folders, videos, fetchedAt }`
  - `journalBindDriveVideoRequestSchema`：`z.object({ driveFileId: z.string().regex(/^[A-Za-z0-9_-]+$/) }).strict()`
  - 扩展 `journalWebEntryUploadSessionAsset` / 处理接口返回，使前端有序媒体队列在提交时统一按 `uploadId` 驱动。

### 5.2 SQLite Migration v26（`src/journal-server/data/migrations.ts`）
采用当前代码库（见 Migration v24 `migrations.ts:1446` 与执行框架 `migrations.ts:1626-1639`）一致的**重建表**模式，设置 `disableForeignKeys: true`，保留已有 `id` 与 `sqlite_sequence`，并在结束时执行 `PRAGMA foreign_key_check`：
- **列变更**：
  - `source_kind TEXT NOT NULL CHECK (source_kind IN ('telegram', 'web', 'drive'))`
  - 新增 `drive_file_id TEXT`
  - 新增 `drive_md5_checksum TEXT`（记录绑定时的文件内容校验和，用于感知源文件被替换并保持版本一致性）
  - `relative_path TEXT UNIQUE`（放宽为可空；`telegram` 与 `web` 仍强制 `NOT NULL`，`drive` 强制 `IS NULL`）
- **严格三态来源 `CHECK` 约束**（特别注意 SQLite 三值逻辑下 `NULL IN (...)` 返回 `NULL` 会被 `CHECK` 放行，因此必须显式 `IS NOT NULL`）：
  - `source_kind = 'telegram'`：
    `telegram_file_id IS NOT NULL AND telegram_file_unique_id IS NOT NULL AND drive_file_id IS NULL AND drive_md5_checksum IS NULL AND relative_path IS NOT NULL`
  - `source_kind = 'web'`：
    `telegram_file_id IS NULL AND telegram_file_unique_id IS NULL AND drive_file_id IS NULL AND drive_md5_checksum IS NULL AND relative_path IS NOT NULL`
  - `source_kind = 'drive'`：
    `role = 'attachment' AND kind = 'video' AND telegram_file_id IS NULL AND telegram_file_unique_id IS NULL AND drive_file_id IS NOT NULL AND drive_md5_checksum IS NOT NULL AND relative_path IS NULL AND preview_relative_path IS NOT NULL AND poster_relative_path IS NULL AND mime_type IS NOT NULL AND mime_type IN ('video/mp4', 'video/webm') AND byte_size IS NOT NULL AND byte_size > 0`
- **索引**：重建 `idx_journal_assets_entry`、`idx_journal_assets_one_cover`、`idx_journal_assets_preview_relative_path`、`idx_journal_assets_poster_relative_path`，新增：
  ```sql
  CREATE INDEX idx_journal_assets_drive_file_id
  ON journal_assets(drive_file_id)
  WHERE drive_file_id IS NOT NULL;
  ```
  （不设 `UNIQUE`，允许同一段云盘视频按需在不同记录或草稿/正式帖间复用。）

### 5.3 存储与 Repository 全链路修订（修复类型与跨月/删改边界）
逐一核对现有源码中所有假定 `relative_path` 非空或 `source_kind = 'web'` 的触点：

1. **类型精准收窄（`src/journal-server/data/repository.ts` & `src/journal-server/types.ts`）**：
   - 富文本文章的 `cover` / `inline`（`repository.ts:615, 628, 935`）、Telegram 导入及贡献发布（`repository.ts:1987`）仍只接受非空 `relativePath: string` 的 `WebEntryAssetInput`，**保持不变**。
   - 仅针对普通记录附件引入可区分联合类型：
     ```ts
     export type WebPlainAttachmentInput =
       | (WebEntryAssetInput & { sourceKind: 'web' })
       | {
           sourceKind: 'drive';
           driveFileId: string;
           driveMd5Checksum: string;
           relativePath: null;
           previewRelativePath: string;
           posterRelativePath: null;
           kind: 'video';
           mimeType: 'video/mp4' | 'video/webm';
           originalName: string;
           byteSize: number;
           width: number;
           height: number;
           duration: number;
         };
     ```
   - 同步将 `AssetRow`、`WebDraftAssetRecord`、`JournalAssetAccess` 中的 `relativePath` 调整为 `string | null`，并在 `JournalAssetAccess` 增加 `sourceKind: JournalAssetSourceKind`、`driveFileId: string | null`、`driveMd5Checksum: string | null`。

2. **编辑目录锁死与跨月追加修复（`src/journal-server/media/storage.ts` & `webEntryUploadService.ts`）**：
   - 问题根因：目前 `storage.begin(publicId, sourceCreatedAt)` 用 `sourceCreatedAt` 计算 `assets/YYYY/MM/<publicId>`，而发布草稿时会更新 `sourceCreatedAt`（`webEntryService.ts:141`）；之后若在跨月后编辑追加资产，`storage.deleteEntryAssets`（`storage.ts:155-160`）会因旧附件与新附件不在同一目录而报错拒绝删除。
   - 修订：`JournalStorage.begin(publicId, sourceCreatedAt, existingRelativeDir?: string)` 支持直接沿用已有条目的实际目录。当 `webEntryUploads.create({ entryId })` 为已有条目创建编辑会话时，查询该条目任意已有资产的 `relative_path ?? preview_relative_path` 的 `path.posix.dirname(...)` 传入 `existingRelativeDir`；仅当该条目尚无任何资产时才由 `sourceCreatedAt` 计算新目录。
   - 新增 `JournalStorage.previewOnlyTarget(session)`：严格沿用 `assetTarget` 的物理/数据库路径约定——物理写入路径采用 `path.join(session.tempDir, `${filename}.preview.webp`)`，数据库相对路径采用 `path.posix.join(session.relativeDir, `${filename}.preview.webp`)`，确保 `finalize` / `appendToFinal` / `discardTemporary` 完全受控。
   - 修订 `JournalStorage.deleteAssetFiles(relativePath: string | null, previewRelativePath: string, posterRelativePath: string | null)`：当 `relativePath !== null` 时删除主文件，当 `relativePath === null`（Drive 资产）时仅删除本地 `previewRelativePath`（及非空 `posterRelativePath`）。

3. **会话用途隔离与异常回滚边界（`webEntryUploadService.ts` & `webEntryService.ts`）**：
   - 问题根因：`PreparedWebEntryUpload` 当前未绑定用途（新建 vs 编辑某特定 `entryId`），`createPrepared` 在写库失败时会调用 `discardFinal` 删除整个目录，若误用编辑会话会导致已有条目的全部本地资产被误删。
   - 修订：`PreparedWebEntryUpload` 记录 `targetEntryId: number | null`。
     - `createPrepared` 严格校验 `upload.targetEntryId === null`；
     - `updatePreparedDraft` / `updatePreparedPublished` 严格校验 `upload.targetEntryId === id`；
     - 在 `createPrepared`、`updatePreparedDraft`、`updatePreparedPublished` 中，若前置的 `assertActionVisibility` / `assertContent` / `assertMediaCount` 在 `take(uploadId)` 之后抛错，必须先调用 `storage.discardTemporary(upload.storageSession)`（在 `finalize` / `appendToFinal` 之前）清理临时目录中的已上传文件或已生成 Drive 封面，杜绝孤立文件残留。

4. **Repository 检索、替换与删除 SQL 修正（`src/journal-server/data/repository.ts`）**：
   - `listWebDraftAssets`（`repository.ts:818`）、`listPublishedWebEntryAssets`（`repository.ts:842`）、`replaceWebEntryAssets` 的两处 SQL（包括 **`repository.ts:2407` DELETE 语句的 `AND source_kind = 'web'`** 和 **`repository.ts:2428` SELECT 语句的 `AND a.source_kind = 'web'`**）必须全部同步放宽为 `IN ('web', 'drive')`。
   - `deletionTarget`（`repository.ts:2489`）改为查询 `SELECT entry_id, COALESCE(relative_path, preview_relative_path) AS effective_path FROM journal_assets WHERE entry_id IN (...)`，对云盘资产同样提取 `assets/YYYY/MM/<publicId>/<uuid>.preview.webp` 交由 `JournalStorage.deleteEntryAssets` 删除整条条目目录。
   - `listImageAssetsMissingPreview`、`listAnimatedAssetsMissingPoster`、`listVideoAssetsMissingPreview`（`repository.ts:1665, 1697, 1720`）显式追加 `AND relative_path IS NOT NULL`。

---

## 6. 云盘选片目录与零落盘探测抽帧

### 6.1 选片目录接口：`GET /api/me/drive-videos`
- **权限**：仅管理员可用（`preHandler: auth.requireAdmin`）。
- **扫描范围（`JournalVideoLibraryService`）**：
  - 扫描 `JOURNAL_VIDEO_DRIVE_ROOT_FOLDER_ID` 下直接子项中的视频文件 + 一级子文件夹（`mimeType === 'application/vnd.google-apps.folder'`）中的视频文件；深度限制为根目录 + 一级分类文件夹，保持结构直观、接口响应快。
  - 仅保留满足：`trashed !== true`、`shortcutDetails == null`、`capabilities?.canDownload === true`、`mimeType === 'video/mp4' || mimeType === 'video/webm'`、`Number(size) > 0`、`md5Checksum != null` 的文件。
  - 结合 SQLite `SELECT drive_file_id, COUNT(DISTINCT entry_id) AS cnt FROM journal_assets WHERE drive_file_id IN (...) GROUP BY drive_file_id` 计算 `linkedEntryCount`，并在列表按 `modifiedTime desc` 排序。
- **缓存**：内存保留 60 秒目录索引，并以单飞（single-flight）`Promise` 合并并发请求；前端传入 `?refresh=1` 时跳过缓存重新向 Drive 拉取，刷新失败直接向前端报错，不做静默旧数据兜底。

### 6.2 绑定抽帧接口：`POST /api/me/entry-uploads/:uploadId/drive-assets`
复用 `JournalWebEntryUploadService` 的 `uploadId` 会话，统一纳入**占位计数、进行中状态锁与取消清理**生命周期：

1. **会话占位与并发控制**：
   - `JournalWebEntryUploadService` 新增 `pendingDriveBindings`（映射 `bindingId -> { entryUploadId, abortController, promise }`）。
   - 请求到达后，校验 `upload` 存在、且当前会话总媒体数（`upload.assets.length + pendingTusCount + pendingDriveCount`）`< 10`、视频数（`upload.videoCount + pendingTusVideoCount + pendingDriveCount`）`< 5`；不计入本地上传的 `500 MiB` 总字节限制。
   - 在任何异步 I/O 前立即向 `pendingDriveBindings` 登记占位与 `AbortController`；`take(uploadId)` 发现任意 TUS 或 Drive 绑定仍在进行时直接拒绝消费；`discard(uploadId)` 时先遍历触发所有相关 `abortController.abort()` 并等待其清理完成后再销毁 `storageSession.tempDir`。
2. **目录边界与元数据核验**：
   - 调用 `videoDriveClient.getFile(driveFileId)`，校验未进回收站、非快捷方式、`canDownload === true`、`mimeType` 为 `video/mp4` 或 `video/webm`、`size > 0`、`md5Checksum` 存在。
   - **越权路径校验**：检查 `file.parents` 是否直接包含 `rootFolderId`；若否，取其父文件夹调用 `getFile(parentId)` 确认父文件夹未进回收站且 `parent.parents` 包含 `rootFolderId`（保证无法借接口探测或绑定配置根目录之外的私有云盘文件）。
3. **进程内回环 HTTP `Range` 代理 + `ffprobe` / `ffmpeg` 零落盘探测抽帧（`JournalDriveVideoIngestService`）**：
   - 在 `127.0.0.1:0` 临时启动一个仅供本次绑定使用的原生 `http.Server`，生成一次性随机路径前缀 `/${randomToken}`（**token 在本次绑定周期内对多次 Range 请求均有效**，仅绑定完毕后关闭服务器），整条链路绑定一个 `30 秒` 超时 + 会话取消联合 `AbortSignal`（`AbortSignal.any([bindingController.signal, AbortSignal.timeout(30_000)])`）。
   - 回环代理仅接受 `HEAD`（直接用 Drive 元数据 `size` 与 `mimeType` 返回 `200` + `Accept-Ranges: bytes` + `Content-Length`）与 `GET`（解析单个 `Range` 头并透传至 `videoDriveClient.openMediaStream`）。本地 HTTP 响应提前关闭时立即 `abort()` 对应的上游 Drive 请求。绝不在子进程命令行参数中传递任何 OAuth Token。
   - 第一步：调用 `execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name,duration:stream=index,codec_type,codec_name,codec_tag_string,profile,width,height,duration,r_frame_rate:stream_disposition=attached_pic', '-of', 'json', loopbackUrl], { maxBuffer: 1024 * 1024, signal })`：
     - 严格校验浏览器直出能力（不满足则明确返回对应中文失败原因）：
       - **MP4**：`format_name` 含 `mp4`；主视频流 `codec_name === 'h264'`，或 `codec_name === 'hevc'` 且 `profile` 为 `Main`/`Main 10` 且 `codec_tag_string === 'hvc1'`；若含音频流，必须存在 `aac` 或 `mp3` 音轨。
       - **WebM**：`format_name` 含 `webm`；主视频流 `codec_name` 为 `vp8` / `vp9` / `av1`；若含音频流，必须存在 `opus` 或 `vorbis` 音轨。
       - 尺寸长边 `<= 3840`、短边 `<= 2160`，帧率 `> 0 && <= 60`，时长 `> 0`。
   - 第二步：扩展 `JournalVideoPreviewService.generate(source, previewPath, options?: { duration?: number; signal?: AbortSignal })`：
     - 当已传入 `duration` 时跳过内部二次 `readDuration(ffprobe)`；
     - 每次启动 `ffmpeg` 均透传 `signal` 并保持输入端 `-ss <duration * pos>` 放在 `-i <loopbackUrl>` 之前，通过 HTTP Range 直接定位关键帧抽取 `[0.1, 0.35, 0.6]` 三个候选帧，再由 `sharp` 按亮度/方差/信息熵选出最佳帧输出 `960x960` `.preview.webp` 写入 `storage.previewOnlyTarget(upload.storageSession)`。
   - `finally` 块中强制关闭临时 `http.Server` 并在出错时删除已生成的 `.preview.webp`（若尚未入列 `upload.assets`）。
   - 返回新绑定资产元数据给前端预览；整个过程仅产生数 MB 的头信息与 3 帧定位流量，0 字节视频落盘。

---

## 7. HTTP Range 流式播放、版本一致性与运维配置

### 7.1 Fastify 媒体路由（`src/journal-server/routes/media.ts`）
保留并复用既有 `authorizeAssetAccess`（`public` 公开、`protected` 校对 6 位口令 Cookie、`private` 校验管理员 Cookie），在 `/media/:assetId` 内按 `asset.sourceKind` 分流：

1. **独立注册 `server.head('/media/:assetId', ...)`**：
   - 原因：核查 `node_modules/fastify/lib/head-route.js:4-16` 可知，Fastify 为 `GET` 自动生成的 `HEAD` 钩子会在无 body 时强行把 `Content-Length` 改写为 `'0'`，或对返回流执行 `.resume()` 造成无意义的上游回源消耗。
   - 处理：独立 `HEAD` 路由先执行 `authorizeAssetAccess`；对于 `'drive'` 资产，直接依据 SQLite 中的 `asset.byteSize` 与 `asset.mimeType` 校验可选单段 `Range` 后返回 `200 OK`（带 `Content-Length: String(asset.byteSize)`）或 `206` / `416`（不请求 Google Drive）；对于本地 `'telegram'` / `'web'` 资产，沿用原有静态文件元数据响应。

2. **`server.get('/media/:assetId', ...)` 的 Drive 分支**：
   - **响应头设计**：
     - `Accept-Ranges: bytes`
     - `Content-Type: asset.mimeType`
     - `Content-Disposition: contentDisposition(filename, { type: 'inline' })`
     - `Cache-Control: private, no-store`（包括公开条目也使用 `no-store`，明确禁止 Cloudflare 边缘与反向代理缓冲/回源拉取整个 GB 级视频，不影响浏览器当前标签页 `<video>` 自身的媒体缓冲区）
     - `X-Accel-Buffering: no`
     - `X-Content-Type-Options: nosniff`
   - **客户端 `Range` 校验**：
     - 依据已落库的 `asset.byteSize` 解析请求头 `Range`（支持单段 `bytes=start-end`、`bytes=start-`、`bytes=-suffix`）。若包含多段范围（逗号分隔）或字节越界，直接返回 `416 Range Not Satisfiable` 并设置 `Content-Range: bytes */${asset.byteSize}`，不发无意义的上游请求。
   - **并发、版本一致性与断连立即止损**：
     - 在调用 `openMediaStream` **之前**注册 `reply.raw.once('close', ...)` 监听并持续到响应完全结束，一旦浏览器拖动进度条、暂停弃流或关闭详情弹窗（`!reply.raw.writableEnded`），即刻调用 `abortController.abort()` 中断 `rndc02 -> Google Drive` TCP 连接，防止慢速断开演变为后台全量带宽浪费。
     - **版本一致性校验**：上游返回 `206` 时校验 `Content-Range` 中的 `/<total>` 是否等于数据库记录的 `asset.byteSize`（或返回 `200` 且非空时校验 `Content-Length` 是否等于 `asset.byteSize`）。若云盘原文件已被原地替换导致长度不一致，立即销毁上游流并返回 `409 Conflict`（提示云盘文件已更新，需重新绑定），禁止混用旧封面/旧编码结果与新字节流。
     - 若上游返回 `416`：若需要原样返回 `416`，须显式将上游 `416` 流接管或先调用 `stream.destroy()` 释放底层连接后再发送空响应体（不能遗留未消费的流或保留上游错误体 `Content-Length`）。

### 7.2 RSS / JSON Feed 处理（`src/journal-server/routes/feeds.ts`）
核查 `node_modules/feed/lib/feed.js:180` 与 `365`：
- `feed@6.0.0` 在 `/feed.json` 中只消费 `item.image`，完全忽略 `enclosure`；
- 在 `/rss.xml` 中若省略 `enclosure.length`，会自动输出非法占位值 `length="0"`。
- 因此在 `feeds.ts` 构造条目时，当 `firstAsset.sourceKind === 'drive'`：
  - 将 `item.image` 设为 `${publicBaseUrl}${firstAsset.previewUrl}`（令 JSON Feed 正常呈现封面）；
  - 对 RSS `<enclosure>` **要么指向本地 `.preview.webp` 并填入通过 `fs.promises.stat` 读取的实际字节数（`type: 'image/webp'`），要么不输出视频 `enclosure`**——优先输出本地封面 `enclosure`（精确 `length` + `image/webp`），既能让 RSS 阅读器看到缩略图，又避免阅读器自动后台下载数 GiB 云盘视频。

### 7.3 Nginx 反向代理完整配置（`deploy/journal/feeds.xmcloud.buzz.conf`）
正则表达式 `location` 与兄弟 `location /`（`feeds.xmcloud.buzz.conf:174`）不会继承 `proxy_pass` 与转发头，因此新增的 `location ~ ^/media/\d+$` 必须写全完整反代配置，并显式关闭磁盘代理缓冲：

```nginx
    location ~ ^/media/\d+$ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 300s;
    }
```
注：`/media/:assetId/preview` 与 `/media/:assetId/poster` 不匹配 `\d+$`，继续走默认规则；而主视频流关闭 `proxy_buffering`，确保不会把大视频写入 `/var/cache/nginx/proxy_temp` 撑爆 VPS 磁盘。

### 7.4 容器镜像覆盖核对
核对 `deploy/journal/Dockerfile:40-46`：`COPY --chown=node:node src/journal-server ./src/journal-server` 与 `COPY --chown=node:node src/shared ./src/shared` 已完整包含 `src/journal-server/drive/`、`routes/`、`media/`、`entries/` 及协议改动，且运行环境已安装 `ffmpeg`，无需改动 Dockerfile 依赖清单。

---

## 8. 前端发布与播放体验改造（`apps/journal-web`）

> 样式与代码约束提醒：所有新增与修改组件必须遵循暖灰纸感视觉规范，**严禁任何绿色系主题**；显式命名组件采用 `<script setup lang="ts" name="...">`；**严禁使用 `watch`/`watchEffect`（除明确必要的边界外，本功能均通过状态计算与事件驱动）**；**严禁使用 `requestAnimationFrame` / `cancelAnimationFrame`**。

### 8.1 发布器：便捷发往「兴趣」与本地/云盘混排（`EntryPublisherView.vue`、`EntryImagePicker.vue`、`EntryMediaPreviewGrid.vue`、`useEntryMediaSubmit.ts`）
1. **默认频道识别**：`/me/entries/new` 读取路由 `query.channel`（当值为 `'interest'` 时默认选中「兴趣」频道）；从 `/interest` 瀑布流页点击新建入口跳转时自动附带 `?channel=interest`。
2. **统一有序待提交队列**：
   - 将发布器 `newMedia` 从纯 `File[]` 升级为有序项数组 `PendingPublisherMedia[]`（`{ kind: 'local'; file: File } | { kind: 'drive'; video: JournalDriveVideoItem }`），保留本地图片与云盘视频的混合选择与先后顺序（列表第一项决定瀑布流卡片封面）。
   - `EntryImagePicker.vue` 增加「从谷歌云盘选择视频」操作按钮；`EntryMediaPreviewGrid.vue` 对已有 `'drive'` 资产直接展示 `<img :src="asset.previewUrl">` 与视频角标，对新选云盘项展示文件名、分辨率与时长标签，避免在编辑页预拉取视频流。
   - `useEntryMediaSubmit.ts` 在生成一次性 `uploadId` 后，按 `PendingPublisherMedia[]` 队列顺序依次执行：本地项走 TUS 分片上传 + `processEntryUpload`，云盘项调用 `POST /api/me/entry-uploads/:uploadId/drive-assets`（显示「正在验证云盘视频并提取封面…」阶段进度提示）。
3. **云盘选片弹窗（新增 `DriveVideoPickerDialog.vue`）**：
   - 使用 `<script setup lang="ts" name="DriveVideoPickerDialog">` 与标准中性暖灰表面/字体变量，不使用绿色。
   - 支持：一级子文件夹 Tab 筛选（含「全部」与根目录直属文件）、关键词搜索、右上角「刷新云盘」按钮（`?refresh=1`）、视频信息展示（名称、子文件夹、体积、分辨率、`mm:ss` 时长、`已关联 N 条` 标签）及多选追加，并同步前端 `<= 10 项媒体 / <= 5 段视频` 配额提示。

### 8.2 瀑布流卡片：零预载与时长角标（`MediaGallery.vue`、`JournalProgressiveVideo.vue`）
- 当前 `JournalProgressiveVideo.vue:22-33` 会在卡片进入视口 `240px` 范围时立即调用 `acquireJournalVideo(props.src)`（`journalVideoPlayerPool.ts:15-20` 设为 `preload = 'auto'` 并立即 `.load()`）。对于大体积云盘剪辑，只要滚动浏览「兴趣」页就会并发回源数十个 Google Drive 视频流。
- **改造**：
  - `JournalProgressiveVideo.vue` 新增属性 `preloadVideo?: boolean`（默认 `true` 保持本地短视频既有体验）与 `duration?: number | null`。
  - `MediaGallery.vue:102-110` 传入 `:preload-video="asset.sourceKind !== 'drive'"` 与 `:duration="asset.duration"`。
  - 当 `preloadVideo === false` 时，组件仅渲染高清晰度的本地 `.preview.webp` 封面，彻底跳过 `IntersectionObserver` 预拉流，并在卡片封面角落渲染半透明黑色磨砂 `mm:ss` 时长角标（复用现有右上角白色播放角标的玻璃质感样式）。

### 8.3 详情舞台：适配 16:9 游戏剪辑的播放控件（`JournalMediaStage.vue`、`journalVideoPlayerPool.ts`）
当前 `JournalMediaStage.vue` 为短小生活视频设计（无时间戳、无音量调节、无全屏按钮、视频不透传宽高比且强制静音自动播）。为提升游戏游玩剪辑的观感：
1. **比例与池化策略优化**：
   - `journalVideoPlayerPool.ts` 的 `acquireJournalVideo` 支持传 `{ preload?: 'auto' | 'metadata' | 'none' }`；舞台挂载播放时由浏览器按播放进度自适应缓冲，关闭详情时立即 `pause()` + `removeAttribute('src')` + `.load()` 释放活跃连接（触发后端 `reply.raw.close` 止损上游）。
   - `JournalMediaStage.vue:34-39` 的 `currentAdaptiveAspectRatio` 对具备有效宽高比的视频（`asset.kind === 'video'`）同样纳入适配，使 16:9 横屏游戏剪辑在桌面与移动端舞台内保持贴合边缘的清晰视野。
2. **原生控件栏补齐（纯 DOM 事件驱动，零 `requestAnimationFrame`）**：
   - 底部控制条除现有的进度 `<input type="range">` 外，整合：
     - **播放/暂停按钮**与键盘快捷键（`Space` 播放/暂停、`←/→` 在视频聚焦时步进 5 秒 seek 或在多图间切换）；
     - **时间读数**：`formatMediaDuration(currentTime) / formatMediaDuration(duration)`（支持 `hh:mm:ss` 长视频格式）；
     - **音量调节**：保留静音开关，桌面端悬停/点击展开轻量音量滑块，同时记忆用户上一次手动取消静音状态；
     - **全屏观看**：桌面与常规移动端调用舞台媒体容器 `.requestFullscreen()`，iOS Safari 兼容调用 `<video>.webkitEnterFullscreen()`，支持双击画面切换全屏。

---

## 9. 已知风险与运行边界

1. **Cloudflare 代理带宽边界**：当前主站域名 `feeds.xmcloud.buzz` 启用 Cloudflare Origin CA 代理。个人低频自用通过 `/media/:assetId`（`Cache-Control: private, no-store` + `Range 206`）完全可用；但若未来公开分享引流导致单域名视频流量过大触发 Cloudflare 非 HTML 大媒体流量限制，应为媒体流单独拆出无橙云代理的二级域名（如直连源站 CDN/DNS Only，仅需配置层切换，业务架构不变）。
2. **Google Drive 原文件被用户手动更新或删除**：
   - 本系统通过 `drive_md5_checksum` + `byte_size` 绑定内容版本。若用户在 Google Drive 中**原地覆盖替换**同一个 fileId 的视频，前台流播检测到 `Content-Range` 总长度变化时会主动以 `409 Conflict` 中断并暴露不一致（选片弹窗亦会提示），此时需在编辑页移除旧附件并重新绑定一次以刷新封面与编码探测。
   - 若用户在 Google Drive 中将已绑定的视频移入回收站或彻底删除，该条目的文字与本地 `.preview.webp` 封面仍可浏览，点击播放时将明确暴露不可访问错误。
3. **非快启动（`moov` 在文件尾部）大文件体验**：对于数 GiB 的 MP4 若导出时未将 `moov` 置前，播放器与 `ffprobe` 均会额外多发一次尾部字节范围请求，首次起播会多出 1–2 秒寻址延迟，不影响播放完整性，建议剪辑软件固定开启 Fast Start / 网络流式优化导出。
