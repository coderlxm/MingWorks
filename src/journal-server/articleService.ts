import { randomUUID } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { Lexer, walkTokens } from 'marked';
import { fileTypeFromFile } from 'file-type';
import {
  journalArticleAssetResponseSchema,
  journalArticleCreateRequestSchema,
  journalArticleUpdateRequestSchema,
  journalAutomationArticleRequestSchema,
  type JournalArticleAssetResponse,
  type JournalArticleCreateRequest,
  type JournalArticleUpdateRequest,
  type JournalAutomationArticleRequest,
  type JournalEntry,
  type JournalRichDocument,
} from '../shared/journalProtocol.js';
import {
  type CoverAssetRecord,
  type CreateArticleInput,
  type WebEntryAssetInput,
  JournalRepository,
} from './repository.js';
import {
  JournalArticleInputError,
  markdownToRichDocument,
} from './articleMarkdown.js';
import {
  type JournalImageDimensions,
  JournalImagePreviewService,
} from './imagePreview.js';
import {
  assertRichDocument,
  collectInlineAssetIds,
  extractContentText,
  hasImageNode,
  normalizeRichDocument,
} from './richText.js';
import { JournalStorage } from './storage.js';
import {
  assertWebImageUpload,
  webImageKind,
} from './webImage.js';

const maxRichBodyBytes = 512 * 1024;

export interface ArticleUploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string | null;
}
export interface ArticleFileInput {
  path: string;
  mimeType: string;
  originalName: string | null;
}

export class JournalArticleService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly previews: JournalImagePreviewService,
  ) {}

  createArticle(rawInput: unknown): JournalEntry {
    const input = journalArticleCreateRequestSchema.parse(rawInput) as JournalArticleCreateRequest;
    if (collectInlineAssetIds(input.richBody).length) throw new JournalArticleInputError(400, '新文章的站内图片必须先上传到该文章草稿。');
    const richBodyJson = this.serializeRichBody(input.richBody, { allowImages: true });
    const contentText = extractContentText(input.richBody);
    this.assertBodyIsNotEmpty(contentText, [], hasImageNode(input.richBody));
    return this.repository.createArticle({
      title: input.title,
      richBodyJson,
      tags: input.tags,
      contentText,
      aiGenerated: input.aiGenerated,
      visibility: 'private',
    });
  }

  async createArticleFromMarkdown(rawInput: unknown, uploads: Map<string, ArticleFileInput> = new Map()): Promise<JournalEntry> {
    const input = journalAutomationArticleRequestSchema.parse(rawInput) as JournalAutomationArticleRequest;
    const aliases = new Map<string, ArticleFileInput>();
    const imageAliases = new Map<string, string>();
    const tokens = Lexer.lex(input.markdown, { gfm: true, breaks: true });
    walkTokens(tokens, token => {
      if (token.type !== 'image' || !token.href.startsWith('asset:')) return;
      const key = token.href.slice(6);
      const upload = uploads.get(key);
      if (!upload) throw new JournalArticleInputError(400, `缺少图片文件 ${key}。`);
      const alias = `https://journal-upload.invalid/${encodeURIComponent(key)}`;
      aliases.set(alias, upload);
      imageAliases.set(token.href, alias);
    });
    if (aliases.size !== uploads.size) throw new JournalArticleInputError(400, '上传文件必须全部在 Markdown 中通过 asset:key 引用。');
    // Render the original token tree, never rewrite Markdown with regular expressions.
    const richBody = markdownToRichDocument(input.markdown, { imageAliases });
    return await this.createWithImages(input, richBody, aliases, []);
  }

  async createArticleFromAiMessage(
    messageId: number,
    input: Omit<JournalArticleCreateRequest, 'aiGenerated'>,
    sourceEntryIds: number[],
  ): Promise<JournalEntry> {
    return await this.createWithImages({ ...input, aiGenerated: true, visibility: 'private' }, input.richBody, new Map(), sourceEntryIds, messageId);
  }

  private async createWithImages(
    input: Pick<CreateArticleInput, 'title' | 'tags' | 'aiGenerated' | 'visibility'>,
    document: JournalRichDocument,
    aliases: Map<string, ArticleFileInput>,
    sourceEntryIds: number[],
    messageId?: number,
  ): Promise<JournalEntry> {
    for (const assetId of new Set(collectInlineAssetIds(document))) {
      const source = this.repository.findImageForCopy(assetId, sourceEntryIds);
      if (!source) throw new JournalArticleInputError(400, `图片 ${assetId} 不是本次允许引用的来源图片。`);
      const path = this.storage.absoluteAssetPath(source.relative_path);
      const detected = await fileTypeFromFile(path);
      if (!detected) throw new JournalArticleInputError(400, `来源图片 ${assetId} 的文件格式无法识别。`);
      aliases.set(`/media/${assetId}`, {
        path,
        mimeType: detected.mime, originalName: source.original_name,
      });
    }
    let bytes = 0;
    for (const file of aliases.values()) bytes += (await stat(file.path)).size;
    if (aliases.size > 10 || bytes > 40 * 1024 * 1024) {
      throw new JournalArticleInputError(413, '每篇文章最多 10 张本地图片，总计不超过 40 MB。');
    }
    const publicId = randomUUID();
    const sourceCreatedAt = new Date().toISOString();
    const session = await this.storage.begin(publicId, sourceCreatedAt);
    let finalized = false;
    let committed = false;
    try {
      const assets: WebEntryAssetInput[] = [];
      for (const file of aliases.values()) {
        const detected = await fileTypeFromFile(file.path);
        if (!detected || detected.mime !== file.mimeType) throw new JournalArticleInputError(400, '上传图片实际格式与 MIME 不一致。');
        const upload = { ...file, buffer: await readFile(file.path) };
        assertWebImageUpload(upload);
        const target = this.storage.assetTarget(session);
        await writeFile(target.absolutePath, upload.buffer, { flag: 'wx' });
        const dimensions = await this.previews.generate(target.absolutePath, target.previewAbsolutePath);
        const kind = webImageKind(upload.mimeType);
        if (kind === 'animation') await this.previews.generatePoster(target.absolutePath, target.posterAbsolutePath);
        assets.push({ relativePath: target.relativePath, previewRelativePath: target.previewRelativePath,
          posterRelativePath: kind === 'animation' ? target.posterRelativePath : null,
          kind, mimeType: upload.mimeType, originalName: upload.originalName, byteSize: upload.buffer.length, ...dimensions });
      }
      await this.storage.finalize(session);
      finalized = true;
      const result = this.repository.createArticleWithAssets({ ...input, publicId, sourceCreatedAt, richBodyJson: '{"type":"doc","content":[]}', contentText: '' }, assets, ids => {
        const mapping = new Map([...aliases.keys()].map((key, index) => [key, ids[index]!]));
        const body = structuredClone(document);
        const visit = (node: JournalRichDocument['content'][number]): void => {
          if (node.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src.startsWith('https://journal-upload.invalid/') && !mapping.has(node.attrs.src)) {
            throw new JournalArticleInputError(400, '图片上传引用不存在。');
          }
          if (node.type === 'image' && typeof node.attrs?.src === 'string' && mapping.has(node.attrs.src)) {
            const id = mapping.get(node.attrs.src)!;
            node.attrs = { ...node.attrs, src: `/media/${id}`, 'data-asset-id': String(id) };
          }
          node.content?.forEach(visit);
        };
        body.content.forEach(visit);
        const richBodyJson = this.serializeRichBody(body, { allowImages: true });
        const contentText = extractContentText(body);
        this.assertBodyIsNotEmpty(contentText, [], hasImageNode(body));
        return { richBodyJson, contentText };
      }, messageId);
      committed = result.created;
      return result.entry;
    } finally {
      if (!committed) {
        if (finalized) await this.storage.discardFinal(session);
        else await this.storage.discardTemporary(session);
      }
    }
  }

  createDraft(rawInput: unknown): JournalEntry {
    const input = journalArticleCreateRequestSchema.parse(rawInput);
    if (collectInlineAssetIds(input.richBody).length) throw new JournalArticleInputError(400, '草稿不能引用其他文章图片。');
    return this.repository.createArticle({ ...input, visibility: 'private', publicationStatus: 'draft',
      richBodyJson: this.serializeRichBody(input.richBody, { allowImages: true }), contentText: extractContentText(input.richBody) });
  }

  listDrafts(): JournalEntry[] { return this.repository.listArticleDrafts(); }

  async deleteDraft(id: number): Promise<void> {
    const article = this.repository.getArticleForEditing(id);
    if (!article || article.publicationStatus !== 'draft') throw new JournalArticleInputError(404, '文章草稿不存在。');
    const target = this.repository.findDeletionTargetById(id)!;
    await this.storage.deleteEntryAssets(target.entries);
    this.repository.deleteTarget(target);
  }

  async updateArticle(id: number, rawInput: unknown, complete = false): Promise<JournalEntry> {
    const input = journalArticleUpdateRequestSchema.parse(rawInput) as JournalArticleUpdateRequest;
    const existing = this.repository.getArticleForEditing(id);
    if (!existing) {
      throw new Error(`Article ${id} was not found.`);
    }
    const richBodyJson = this.serializeRichBody(input.richBody, { allowImages: true });

    const referencedIds = collectInlineAssetIds(input.richBody);
    const contentText = extractContentText(input.richBody);
    if (complete || existing.publicationStatus === 'published') this.assertBodyIsNotEmpty(contentText, referencedIds, hasImageNode(input.richBody));
    const existingInline = this.repository.listInlineAssets(id);
    const existingInlineIds = new Set(existingInline.map((asset) => asset.id));
    for (const referenced of referencedIds) {
      if (!existingInlineIds.has(referenced)) {
        throw new Error(`Inline image ${referenced} does not belong to article ${id}.`);
      }
    }

    return this.repository.updateArticle(id, {
      title: input.title,
      richBodyJson,
      tags: input.tags,
      contentText,
      aiGenerated: input.aiGenerated,
    }, [], complete);
  }

  getArticleForEditing(id: number): JournalEntry | null {
    return this.repository.getArticleForEditing(id);
  }

  async uploadAsset(
    id: number,
    role: 'cover' | 'inline',
    input: ArticleUploadInput,
  ): Promise<JournalArticleAssetResponse> {
    assertWebImageUpload(input);
    const article = this.repository.getArticleForEditing(id);
    if (!article) {
      throw new Error(`Article ${id} was not found.`);
    }

    const relativePath = await this.storage.writeWebAsset(
      article.publicId,
      article.sourceCreatedAt,
      input.buffer,
    );
    const previewRelativePath = this.storage.previewRelativePath(relativePath);
    const kind = webImageKind(input.mimeType);
    const posterRelativePath = kind === 'animation'
      ? this.storage.posterRelativePath(relativePath)
      : null;
    let dimensions: JournalImageDimensions;
    try {
      dimensions = await this.previews.generate(
        this.storage.absoluteAssetPath(relativePath),
        this.storage.absoluteAssetPath(previewRelativePath),
      );
    } catch (error) {
      await this.storage.deleteAsset(relativePath);
      throw error;
    }
    if (posterRelativePath !== null) {
      try {
        await this.previews.generatePoster(
          this.storage.absoluteAssetPath(relativePath),
          this.storage.absoluteAssetPath(posterRelativePath),
        );
      } catch (error) {
        await this.storage.deleteAssetFiles(relativePath, previewRelativePath, null);
        throw error;
      }
    }

    let previousCover: CoverAssetRecord | null = null;
    if (role === 'cover') {
      previousCover = this.repository.findCover(id);
    }
    let newAssetId: number;
    try {
      const sortOrder = role === 'cover' ? 0 : this.repository.listInlineAssets(id).length;
      newAssetId = this.repository.insertWebAsset({
        entryId: id,
        role,
        relativePath,
        previewRelativePath,
        posterRelativePath,
        kind,
        mimeType: input.mimeType,
        originalName: input.originalName,
        byteSize: input.buffer.byteLength,
        width: dimensions.width,
        height: dimensions.height,
        sortOrder,
      });
    } catch (error) {
      await this.storage.deleteAssetFiles(relativePath, previewRelativePath, posterRelativePath);
      throw error;
    }

    if (previousCover) {
      await this.storage.deleteAssetFiles(
        previousCover.relativePath,
        previousCover.previewRelativePath,
        previousCover.posterRelativePath,
      );
    }
    return journalArticleAssetResponseSchema.parse({
      id: newAssetId,
      role,
      kind,
      url: `/media/${newAssetId}`,
      originalName: input.originalName,
      mimeType: input.mimeType,
      byteSize: input.buffer.byteLength,
    });
  }

  async deleteAsset(id: number, assetId: number): Promise<void> {
    const asset = this.repository.findWebAsset(id, assetId);
    if (!asset) {
      throw new Error(`Article asset ${assetId} does not belong to article ${id}.`);
    }
    if (asset.role === 'inline') {
      const article = this.repository.getArticleForEditing(id);
      if (article?.richBody) {
        const referenced = new Set(collectInlineAssetIds(article.richBody));
        if (referenced.has(assetId)) {
          throw new Error('Inline image is still referenced in the article body.');
        }
      }
    }
    if (asset.preview_relative_path === null) {
      throw new Error(`Article asset ${assetId} does not have an image preview.`);
    }
    await this.storage.deleteAssetFiles(
      asset.relative_path,
      asset.preview_relative_path,
      asset.poster_relative_path,
    );
    this.repository.deleteAssets([assetId]);
  }

  private serializeRichBody(document: JournalRichDocument, options: { allowImages: boolean }): string {
    const normalized = normalizeRichDocument(document);
    const json = JSON.stringify(normalized);
    if (Buffer.byteLength(json, 'utf8') > maxRichBodyBytes) {
      throw new JournalArticleInputError(413, 'Article rich body exceeds the 512 KB limit.');
    }
    assertRichDocument(normalized, options);
    return json;
  }

  private assertBodyIsNotEmpty(contentText: string, inlineAssetIds: number[], hasImage = false): void {
    if (contentText.trim() === '' && inlineAssetIds.length === 0 && hasImage === false) {
      throw new JournalArticleInputError(400, 'Article body must not be empty.');
    }
  }
}
