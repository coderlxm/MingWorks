import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { Feed, type Enclosure } from 'feed';
import type { JournalEntry } from '../../shared/journalProtocol.js';
import type { JournalRepository } from '../data/repository.js';
import { generateArticleHtml } from '../articles/richText.js';
import type { JournalStorage } from '../media/storage.js';
import type { JournalSiteProfileService } from '../siteProfileService.js';

function itemTitle(entry: JournalEntry): string {
  if (entry.title) return entry.title;
  const compact = entry.contentText.replace(/\s+/g, ' ').trim();
  return compact === '' ? `${entry.contentType} 记录` : compact.slice(0, 80);
}

function itemContent(entry: JournalEntry, publicBaseUrl: string): string {
  if (entry.bodyFormat === 'rich' && entry.richBody) {
    return generateArticleHtml(entry.richBody, publicBaseUrl, `${publicBaseUrl}/p/${entry.publicId}`);
  }
  return entry.contentText;
}

function itemDescription(entry: JournalEntry): string {
  if (entry.title) {
    const summary = entry.contentText.replace(/\s+/g, ' ').trim();
    return summary === '' ? entry.title : summary;
  }
  return entry.contentText;
}

async function buildFeed(
  repository: JournalRepository,
  siteProfileService: JournalSiteProfileService,
  publicBaseUrl: string,
  storage: JournalStorage,
): Promise<Feed> {
  const entries = repository.list({ visibility: 'public', limit: 50 }).entries;
  const feed = new Feed({
    title: '小明同学',
    description: siteProfileService.getProfile().bio,
    id: publicBaseUrl,
    link: publicBaseUrl,
    language: 'zh-CN',
    copyright: `Copyright ${new Date().getFullYear()} 小明同学`,
    feedLinks: {
      rss: `${publicBaseUrl}/rss.xml`,
      json: `${publicBaseUrl}/feed.json`,
    },
    author: { name: '小明同学', link: publicBaseUrl },
  });

  for (const entry of entries) {
    const link = `${publicBaseUrl}/p/${entry.publicId}`;
    const firstAsset = entry.assets.find((asset) => asset.role === 'cover') ?? entry.assets[0];
    let enclosure = firstAsset
      ? {
          url: `${publicBaseUrl}${firstAsset.url}`,
          ...(firstAsset.mimeType ? { type: firstAsset.mimeType } : {}),
          ...(firstAsset.byteSize !== null ? { length: firstAsset.byteSize } : {}),
        }
      : undefined;
    let image: Enclosure | undefined;
    if (firstAsset?.sourceKind === 'drive') {
      const access = repository.getAssetAccess(firstAsset.id);
      if (!firstAsset.previewUrl || !access?.previewRelativePath) {
        throw new Error(`Drive video asset ${firstAsset.id} is missing its preview.`);
      }
      const preview = await fs.promises.stat(storage.absoluteAssetPath(access.previewRelativePath));
      // feed@6 uses image.url for JSON and lets image override enclosure in RSS.
      image = { url: `${publicBaseUrl}${firstAsset.previewUrl}`, type: 'image/webp', length: preview.size };
      enclosure = image;
    }
    feed.addItem({
      title: itemTitle(entry),
      id: link,
      link,
      date: new Date(entry.sourceCreatedAt),
      description: itemDescription(entry),
      content: itemContent(entry, publicBaseUrl),
      category: entry.tags.map((tag) => ({ name: tag })),
      ...(enclosure ? { enclosure } : {}),
      ...(image ? { image } : {}),
    });
  }
  return feed;
}

export async function registerFeedRoutes(
  server: FastifyInstance,
  repository: JournalRepository,
  siteProfileService: JournalSiteProfileService,
  publicBaseUrl: string,
  storage: JournalStorage,
): Promise<void> {
  server.get('/rss.xml', async (_request, reply) => {
    reply.type('application/rss+xml; charset=utf-8');
    return (await buildFeed(repository, siteProfileService, publicBaseUrl, storage)).rss2();
  });

  server.get('/feed.json', async (_request, reply) => {
    reply.type('application/feed+json; charset=utf-8');
    return (await buildFeed(repository, siteProfileService, publicBaseUrl, storage)).json1();
  });
}
