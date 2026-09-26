import { generateText, getSchema, getText, type TextSerializer } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { generateHTML } from '@tiptap/html/server';
import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import {
  isAllowedJournalCodeLanguage,
  isAllowedJournalExternalImageUrl,
  isAllowedJournalLinkHref,
  journalImageAlignments,
  journalTableAlignments,
  parseJournalInternalImageId,
} from '../../shared/journalContentPolicy.js';
import {
  addJournalHeadingIds,
  createJournalRichTextExtensions,
  journalHeadingIdPattern,
} from '../../shared/journalRichText.js';
import type { JournalRichDocument, JournalRichNode } from '../../shared/journalProtocol.js';

const serverExtensions = createJournalRichTextExtensions({ updateHeadingIds: false });

const textSerializers: Record<string, TextSerializer> = {
      image: ({ node }) => [node.attrs.alt, node.attrs.caption].filter(Boolean).join(' '),
      taskItem: ({ node }) => `[${node.attrs.checked ? 'x' : ' '}] ${getText(node, { blockSeparator: '\n', textSerializers })}\n`,
      tableRow: ({ node }) => {
        const cells: string[] = [];
        node.forEach(cell => cells.push(getText(cell, { blockSeparator: ' / ', textSerializers })));
        return `${cells.join(' | ')}\n`;
      },
      hardBreak: () => '\n',
};

export function extractContentText(document: JournalRichDocument): string {
  return generateText(document, serverExtensions, { textSerializers });
}

export function collectInlineAssetIds(document: JournalRichDocument): number[] {
  const ids: number[] = [];
  const visit = (node: JournalRichNode): void => {
    if (node.type === 'image') {
      const attrs = node.attrs ?? {};
      const value = attrs['data-asset-id'];
      if (value !== undefined && value !== null) {
        const numeric = Number(value);
        if (Number.isInteger(numeric) && numeric > 0) ids.push(numeric);
      }
    }
    if (node.content) {
      for (const child of node.content) visit(child);
    }
  };
  visit(document);
  return ids;
}

function assertImageNode(node: JournalRichNode): void {
  const attrs = node.attrs ?? {};
  const src = attrs.src;
  if (typeof src !== 'string' || src.length === 0) {
    throw new Error('Image nodes must contain src.');
  }
  const internalId = parseJournalInternalImageId(src);
  if (internalId === null) {
    if (isAllowedJournalExternalImageUrl(src) === false) {
      throw new Error(`Image src ${src} must point to /media/:assetId or an HTTPS URL.`);
    }
    if (attrs['data-asset-id'] !== null && attrs['data-asset-id'] !== undefined) {
      throw new Error('External images must not contain data-asset-id.');
    }
  } else {
    const numeric = Number(attrs['data-asset-id']);
    if (Number.isInteger(numeric) === false || numeric <= 0) {
      throw new Error('Image nodes must reference an inline asset id.');
    }
    if (src !== `/media/${numeric}`) {
      throw new Error('Image src must match its inline asset id.');
    }
  }

  const width = attrs.width;
  if (width !== null && width !== undefined) {
    if (typeof width !== 'number' || Number.isFinite(width) === false || width <= 0) {
      throw new Error('Image width must be a positive number.');
    }
  }
  const height = attrs.height;
  if (height !== null && height !== undefined) {
    if (typeof height !== 'number' || Number.isFinite(height) === false || height <= 0) {
      throw new Error('Image height must be a positive number.');
    }
  }
  const align = attrs.align;
  if (align !== null && align !== undefined) {
    if (typeof align !== 'string' || journalImageAlignments.includes(align as typeof journalImageAlignments[number]) === false) {
      throw new Error('Image align must be left, center, or right.');
    }
  }
  for (const key of ['alt', 'title', 'caption']) {
    const value = attrs[key];
    if (value !== null && value !== undefined && typeof value !== 'string') {
      throw new Error(`Image ${key} must be a string.`);
    }
  }
}

function assertTableNode(node: JournalRichNode): void {
  if (node.content === undefined || node.content.length === 0) {
    throw new Error('Table nodes must contain rows.');
  }
  if (node.content.some((child) => child.type !== 'tableRow')) {
    throw new Error('Table content must only contain table rows.');
  }
}

function assertTableRowNode(node: JournalRichNode): void {
  if (node.content === undefined || node.content.length === 0) {
    throw new Error('Table rows must contain cells.');
  }
  if (node.content.some((child) => child.type !== 'tableCell' && child.type !== 'tableHeader')) {
    throw new Error('Table row content must only contain table cells.');
  }
}

function assertTableCellNode(node: JournalRichNode): void {
  const attrs = node.attrs ?? {};
  for (const key of ['colspan', 'rowspan']) {
    const value = attrs[key];
    if (value !== null && value !== undefined && (Number.isInteger(value) === false || Number(value) <= 0)) {
      throw new Error(`Table cell ${key} must be a positive integer.`);
    }
  }
  const colwidth = attrs.colwidth;
  if (colwidth !== null && colwidth !== undefined) {
    if (Array.isArray(colwidth)) {
      if (colwidth.length !== (attrs.colspan ?? 1) || colwidth.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        throw new Error('Table colwidth must match colspan; zero means unspecified width.');
      }
    } else {
      throw new Error('Table cell colwidth must be an array of positive numbers.');
    }
  }
  const align = attrs.align;
  if (align !== null && align !== undefined) {
    if (typeof align !== 'string' || journalTableAlignments.includes(align as typeof journalTableAlignments[number]) === false) {
      throw new Error('Table cell align must be left, center, or right.');
    }
  }
}

function assertNodeMarks(node: JournalRichNode): void {
  if (Array.isArray(node.marks) === false) return;
  for (const mark of node.marks) {
    if (mark.type === 'link') {
      const href = mark.attrs?.href;
      if (typeof href !== 'string' || isAllowedJournalLinkHref(href) === false) {
        throw new Error(`Link href ${String(href)} uses an unsupported protocol or format.`);
      }
    }
  }
}

export function hasImageNode(document: JournalRichDocument): boolean {
  const visit = (node: JournalRichNode): boolean => {
    if (node.type === 'image') return true;
    return node.content?.some(visit) ?? false;
  };
  return visit(document);
}

export function assertRichDocument(document: JournalRichDocument, options: { allowImages: boolean }): void {
  if (options.allowImages === false && hasImageNode(document)) {
    throw new Error('Images are not allowed in this document.');
  }

  const headingIds = new Set<string>();
  const visit = (node: JournalRichNode): void => {
    assertNodeMarks(node);
    if (node.type === 'paragraph' || node.type === 'heading') {
      const align = node.attrs?.textAlign;
      if (align != null && !['left', 'center', 'right'].includes(String(align))) throw new Error('Text alignment must be left, center, or right.');
    }
    if (node.type === 'heading') {
      const level = node.attrs?.level;
      if (typeof level !== 'number' || Number.isInteger(level) === false || level < 1 || level > 6) {
        throw new Error('Heading nodes must use level 1 through 6.');
      }
      const anchorId = node.attrs?.anchorId;
      if (typeof anchorId !== 'string' || journalHeadingIdPattern.test(anchorId) === false) {
        throw new Error('Heading nodes must contain a valid anchor id.');
      }
      if (headingIds.has(anchorId)) {
        throw new Error(`Heading anchor id ${anchorId} is duplicated.`);
      }
      headingIds.add(anchorId);
    }
    if (node.type === 'image') {
      assertImageNode(node);
    }
    if (node.type === 'table') {
      assertTableNode(node);
    }
    if (node.type === 'tableRow') {
      assertTableRowNode(node);
    }
    if (node.type === 'tableCell' || node.type === 'tableHeader') {
      assertTableCellNode(node);
    }
    if (node.type === 'taskItem') {
      const checked = node.attrs?.checked;
      if (typeof checked !== 'boolean') {
        throw new Error('Task items must contain a boolean checked attribute.');
      }
    }
    if (node.type === 'codeBlock') {
      const language = node.attrs?.language;
      if (language !== null && language !== undefined) {
        if (typeof language !== 'string' || isAllowedJournalCodeLanguage(language) === false) {
          throw new Error('Code blocks must use a simple language name.');
        }
      }
    }
    if (node.content) {
      for (const child of node.content) visit(child);
    }
  };
  visit(document);
  const node = ProseMirrorNode.fromJSON(getSchema(serverExtensions), document);
  node.check();
  node.descendants(child => {
    if (child.type.name === 'table' && TableMap.get(child).problems !== null) {
      throw new Error('Table cells must form a valid rectangular grid.');
    }
  });
}

export function normalizeRichDocument(document: JournalRichDocument): JournalRichDocument {
  return addJournalHeadingIds(document) as JournalRichDocument;
}

export function generateArticleHtml(document: JournalRichDocument, publicBaseUrl: string, articleUrl = publicBaseUrl): string {
  const raw = generateHTML(document as unknown as Parameters<typeof generateHTML>[0], serverExtensions);
  const $ = load(raw);
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')!;
    if (!isAllowedJournalLinkHref(href)) throw new Error('Invalid article link.');
    $(element).attr('href', new URL(href, href.startsWith('#') ? articleUrl : publicBaseUrl).href);
  });
  $('[data-anchorid]').each((_, element) => { $(element).attr('id', $(element).attr('data-anchorid')!); });
  $('img[src^="/media/"]').each((_, element) => {
    const src = $(element).attr('src') ?? '';
    $(element).attr('src', `${publicBaseUrl}${src}`);
  });
  $('img[src^="https://"]').each((_, element) => {
    $(element).attr('referrerpolicy', 'no-referrer');
    $(element).attr('loading', 'lazy');
  });

  return sanitizeHtml($.html(), {
    allowedTags: [
      'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 's', 'del', 'u', 'mark', 'sub', 'sup',
      'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'a', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
      'figure', 'figcaption',
      'label', 'input', 'span', 'div',
    ],
    allowedAttributes: {
      '*': ['id'],
      a: ['href', 'rel', 'target'],
      code: ['class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'data-asset-id', 'data-caption', 'data-align', 'referrerpolicy', 'loading'],
      figure: ['data-type', 'data-align'],
      h1: ['data-anchorid', 'style'],
      h2: ['data-anchorid', 'style'],
      h3: ['data-anchorid', 'style'],
      h4: ['data-anchorid', 'style'],
      h5: ['data-anchorid', 'style'],
      h6: ['data-anchorid', 'style'],
      p: ['style'],
      ul: ['data-type'],
      ol: ['start'],
      li: ['data-type', 'data-checked'],
      input: ['type', 'checked', 'disabled'],
      table: ['style'],
      th: ['colspan', 'rowspan', 'colwidth', 'align', 'style'],
      td: ['colspan', 'rowspan', 'colwidth', 'align', 'style'],
      col: ['span', 'width', 'style'],
      colgroup: ['style'],
    },
    allowedClasses: {
      code: [/^language-/],
      span: [/^hljs-/],
    },
    allowedStyles: {
      '*': {
        'text-align': [/^(left|center|right)$/],
      },
      table: {
        'min-width': [/^\d+(?:\.\d+)?px$/],
        width: [/^\d+(?:\.\d+)?px$/],
      },
      col: {
        'min-width': [/^\d+(?:\.\d+)?px$/],
        width: [/^\d+(?:\.\d+)?px$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' },
      }),
      input: (_tagName, attribs) => ({
        tagName: 'input',
        attribs: { ...attribs, disabled: 'disabled' },
      }),
    },
  });
}
