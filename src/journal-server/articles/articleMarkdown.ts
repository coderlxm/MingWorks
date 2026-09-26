import { Lexer, Parser, walkTokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { load } from 'cheerio';
import { generateJSON } from '@tiptap/html/server';
import { generateHTML } from '@tiptap/html/server';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import {
  isAllowedJournalCodeLanguage,
  isAllowedJournalExternalImageUrl,
  isAllowedJournalLinkHref,
  journalControlledHtmlTags,
  parseJournalInternalImageId,
} from '../../shared/journalContentPolicy.js';
import { createJournalRichTextExtensions, journalHeadingIdPattern } from '../../shared/journalRichText.js';
import type { JournalRichDocument } from '../../shared/journalProtocol.js';
import { assertRichDocument, normalizeRichDocument } from './richText.js';

const controlledHtmlTagSet = new Set<string>(journalControlledHtmlTags);
const controlledHtmlAttributes: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  p: new Set(['style']),
  ul: new Set(['data-type']),
  ol: new Set(['start']),
  li: new Set(['data-type', 'data-checked']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'data-asset-id', 'data-caption', 'data-align', 'referrerpolicy', 'loading']),
  figure: new Set(['data-type', 'data-align']),
  code: new Set(['class']),
  h1: new Set(['data-anchorid']),
  h2: new Set(['data-anchorid']),
  h3: new Set(['data-anchorid']),
  h4: new Set(['data-anchorid']),
  h5: new Set(['data-anchorid']),
  h6: new Set(['data-anchorid']),
  table: new Set(['data-type', 'style']),
  th: new Set(['colspan', 'rowspan', 'colwidth', 'align', 'style']),
  td: new Set(['colspan', 'rowspan', 'colwidth', 'align', 'style']),
  col: new Set(['span', 'width', 'style']),
  colgroup: new Set(['span', 'width']),
};
for (const level of [1, 2, 3, 4, 5, 6]) controlledHtmlAttributes[`h${level}`]!.add('style');

export class JournalArticleInputError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'JournalArticleInputError';
  }
}

function assertArticleImageSrc(src: string, location = 'Markdown 图片'): number | null {
  const trimmed = src.trim();
  const internalId = parseJournalInternalImageId(trimmed);
  if (internalId !== null) return internalId;
  if (isAllowedJournalExternalImageUrl(trimmed)) return null;
  throw new JournalArticleInputError(400, `${location} ${trimmed} 不受支持，请使用站内 /media/:id 或 HTTPS 外链图片。`);
}

function assertControlledHtml(raw: string): void {
  const $ = load(raw, null, false);
  $('*').each((_, element) => {
    const tagName = element.tagName.toLowerCase();
    if (controlledHtmlTagSet.has(tagName) === false) {
      throw new JournalArticleInputError(400, `暂不支持 Markdown 原始 HTML 标签 <${tagName}>。`);
    }
    const allowedAttributes = controlledHtmlAttributes[tagName] ?? new Set<string>();
    for (const [name, value] of Object.entries(element.attribs)) {
      const attributeName = name.toLowerCase();
      if (attributeName.startsWith('on')) {
        throw new JournalArticleInputError(400, `原始 HTML 属性 ${attributeName} 不受支持。`);
      }
      if (allowedAttributes.has(attributeName) === false) {
        throw new JournalArticleInputError(400, `原始 HTML 属性 ${attributeName} 不受支持。`);
      }
      if (attributeName === 'src') {
        assertArticleImageSrc(value, '原始 HTML 图片');
      }
      if (attributeName === 'href' && !isAllowedJournalLinkHref(value)) {
        throw new JournalArticleInputError(400, '原始 HTML 链接无效。');
      }
      if (attributeName === 'data-anchorid' && journalHeadingIdPattern.test(value) === false) {
        throw new JournalArticleInputError(400, '原始 HTML 标题锚点格式无效。');
      }
      if (attributeName === 'class') {
        const classes = value.split(/\s+/).filter((item) => item.length > 0);
        if (tagName !== 'code' || classes.some((item) => item.startsWith('language-') === false)) {
          throw new JournalArticleInputError(400, '原始 HTML class 仅支持代码语言 language-*。');
        }
      }
      if (attributeName === 'style') {
        const normalized = value.trim().toLowerCase();
        const allowedStyle = /^(?:text-align:\s*(?:left|center|right)\s*;?|(?:min-)?width:\s*\d+(?:\.\d+)?px\s*;?)$/.test(normalized);
        if (allowedStyle === false) {
          throw new JournalArticleInputError(400, '原始 HTML style 仅支持受控的表格对齐或宽度。');
        }
      }
    }
  });
}

function adaptTaskLists(html: string): string {
  const $ = load(html, null, false);
  $('li').each((_, element) => {
    const item = $(element);
    const checkbox = item.children('input[type="checkbox"]').add(item.children('p').children('input[type="checkbox"]')).first();
    if (checkbox.length === 0) return;
    const checked = checkbox.attr('checked') === undefined ? false : true;
    checkbox.remove();
    item.children('label').remove();
    item.attr('data-type', 'taskItem');
    item.attr('data-checked', checked ? 'true' : 'false');
  });
  // Split mixed ordinary/task lists into consecutive groups, preserving every item.
  $('ul, ol').each((_, element) => {
    const list = $(element);
    if (!list.children('li[data-type="taskItem"]').length) return;
    let group: ReturnType<typeof $> | null = null;
    let previousTask: boolean | null = null;
    list.children('li').each((index, child) => {
      const task = $(child).attr('data-type') === 'taskItem';
      if (task !== previousTask) {
        group = task ? $('<ul data-type="taskList"></ul>') : $(`<${element.tagName}></${element.tagName}>`);
        if (!task && element.tagName === 'ol') group.attr('start', String(Number(list.attr('start') ?? 1) + index));
        list.before(group);
        previousTask = task;
      }
      group!.append(child);
    });
    list.remove();
  });
  $('img[src]').each((_, element) => {
    const image = $(element);
    const src = image.attr('src') ?? '';
    const internalId = parseJournalInternalImageId(src);
    if (internalId === null) return;
    image.attr('data-asset-id', String(internalId));
  });
  return $.html();
}

export function assertArticleMarkdown(markdown: string, imageAliases?: ReadonlyMap<string, string>): void {
  const tokens = Lexer.lex(markdown, { gfm: true, breaks: true });
  walkTokens(tokens, (token) => {
    switch (token.type) {
      case 'link':
        if (isAllowedJournalLinkHref(token.href) === false) {
          throw new JournalArticleInputError(400, `暂不支持 Markdown 链接 ${token.href}，请使用 http、https、mailto、站内相对地址或页面锚点。`);
        }
        break;
      case 'image':
        assertArticleImageSrc(imageAliases?.get(token.href) ?? token.href);
        break;
      case 'html':
        assertControlledHtml(token.raw);
        break;
      case 'code':
        if (token.lang !== undefined && token.lang !== '' && isAllowedJournalCodeLanguage(token.lang) === false) {
          throw new JournalArticleInputError(400, `暂不支持代码语言 ${token.lang}。`);
        }
        break;
      default:
        break;
    }
  });
}

export function assertAutomationArticleMarkdown(markdown: string): void {
  assertArticleMarkdown(markdown);
}

export interface MarkdownToRichDocumentOptions {
  preserveCodeLanguage?: boolean;
  imageAliases?: ReadonlyMap<string, string>;
}

export function markdownToRichDocument(
  markdown: string,
  options: MarkdownToRichDocumentOptions = {},
): JournalRichDocument {
  assertArticleMarkdown(markdown, options.imageAliases);
  const preserveCodeLanguage = options.preserveCodeLanguage ?? true;
  const tokens = Lexer.lex(markdown, { gfm: true, breaks: true });
  walkTokens(tokens, token => {
    if (token.type === 'image' && options.imageAliases?.has(token.href)) token.href = options.imageAliases.get(token.href)!;
  });
  const parsedHtml = Parser.parse(tokens, { gfm: true, breaks: true });
  const adaptedHtml = adaptTaskLists(parsedHtml);
  const html = sanitizeHtml(adaptedHtml, {
    allowedTags: [
      'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 's', 'del', 'u', 'mark', 'sub', 'sup',
      'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'a', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
      'figure', 'figcaption',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      h1: ['data-anchorid', 'style'], h2: ['data-anchorid', 'style'], h3: ['data-anchorid', 'style'],
      h4: ['data-anchorid', 'style'], h5: ['data-anchorid', 'style'], h6: ['data-anchorid', 'style'],
      ol: ['start'], p: ['style'],
      code: preserveCodeLanguage ? ['class'] : [],
      img: ['src', 'alt', 'title', 'width', 'height', 'data-asset-id', 'data-caption', 'data-align'],
      ul: ['data-type'],
      li: ['data-type', 'data-checked'],
      th: ['colspan', 'rowspan', 'colwidth', 'align', 'style'],
      td: ['colspan', 'rowspan', 'colwidth', 'align', 'style'],
      table: ['data-type', 'style'],
      col: ['span', 'width', 'style'],
      colgroup: ['style'],
      figure: ['data-type', 'data-align'],
    },
    allowedClasses: preserveCodeLanguage ? { code: [/^language-/] } : undefined,
    allowedStyles: {
      '*': { 'text-align': [/^(left|center|right)$/] },
      p: { 'text-align': [/^(left|center|right)$/] },
      table: {
        'min-width': [/^\d+(?:\.\d+)?px$/],
        width: [/^\d+(?:\.\d+)?px$/],
      },
      th: {
        'text-align': [/^(left|center|right)$/],
      },
      td: {
        'text-align': [/^(left|center|right)$/],
      },
      col: {
        'min-width': [/^\d+(?:\.\d+)?px$/],
        width: [/^\d+(?:\.\d+)?px$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  });
  const document = generateJSON(
    html,
    createJournalRichTextExtensions({ updateHeadingIds: false }),
  ) as JournalRichDocument;
  const normalized = normalizeRichDocument(document);
  assertRichDocument(normalized, { allowImages: true });
  return normalized;
}

export function richDocumentToMarkdown(document: JournalRichDocument, mode: 'faithful' | 'gfm'): string {
  assertRichDocument(document, { allowImages: true });
  const html = generateHTML(document, createJournalRichTextExtensions({ updateHeadingIds: false }));
  const $ = load(html, null, false);
  // Editor checkbox chrome is not document content.
  $('li[data-type="taskItem"]').each((_, element) => {
    const item = $(element);
    item.children('label').remove();
    const content = item.children('div');
    content.replaceWith(content.contents());
  });
  $('th, td').each((_, element) => {
    const cell = $(element);
    const align = cell.attr('style')?.match(/text-align:\s*(left|center|right)/)?.[1];
    if (align) cell.attr('align', align);
  });
  const advanced: string[] = [];
  if ($('u, mark, sub, sup').length) advanced.push('下划线、高亮或上下标');
  if ($('figure, img[width], img[height], img[data-align], img[data-caption]').length) advanced.push('图片尺寸、对齐或图注');
  if ($('p[style], h1[style], h2[style], h3[style], h4[style], h5[style], h6[style]').length) advanced.push('段落或标题对齐');
  if ($('a[href^="#section-"]').length) advanced.push('固定标题锚点链接');
  $('table').each((_, element) => {
    const table = $(element);
    const firstRow = table.find('tr').first();
    const headerAlignments = firstRow.children().toArray().map(cell => $(cell).attr('align') ?? null);
    const complex = table.find('td, th').toArray().some(cell =>
      Number($(cell).attr('colspan') ?? 1) !== 1 || Number($(cell).attr('rowspan') ?? 1) !== 1
      || $(cell).attr('colwidth') !== undefined || $(cell).children().length > 1
      || $(cell).find('ul, ol, pre, table, img, blockquote, h1, h2, h3, h4, h5, h6, br').length > 0
      || $(cell).attr('align') !== firstRow.children().eq($(cell).index()).attr('align'),
    );
    if (complex || firstRow.children('th').length !== headerAlignments.length || table.find('th').length !== firstRow.children('th').length) advanced.push('复杂表格');
  });
  if (mode === 'gfm' && advanced.length) {
    throw new JournalArticleInputError(400, `纯 GFM 无法保留：${[...new Set(advanced)].join('、')}。请选择本站保真 Markdown。`);
  }
  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  converter.use(gfm);
  converter.addRule('journalTask', {
    filter: node => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
    replacement: (content, node) => `- [${node.getAttribute('data-checked') === 'true' ? 'x' : ' '}] ${content.trim().replace(/\n/g, '\n    ')}\n`,
  });
  converter.addRule('gfmCell', {
    filter: ['td', 'th'],
    replacement: (content, node) => `${node.previousSibling ? '' : '|'} ${content.trim().replace(/\|/g, '\\|')} |`,
  });
  converter.addRule('codeLanguage', {
    filter: 'pre',
    replacement: (_content, node) => {
      const code = node.querySelector('code');
      const text = code?.textContent ?? node.textContent ?? '';
      const language = code?.getAttribute('class')?.replace(/^language-/, '') ?? '';
      const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), match => match[0].length));
      const fence = '`'.repeat(longest + 1);
      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });
  if (mode === 'faithful') {
    converter.addRule('journalStructure', {
      filter: (node) => /^(H[1-6]|TABLE|FIGURE|IMG|U|MARK|SUB|SUP|PRE)$/.test(node.nodeName)
        || node.nodeName === 'P' && node.hasAttribute('style'),
      replacement: (_content, node) => {
        const block = /^(H[1-6]|TABLE|FIGURE|P|PRE)$/.test(node.nodeName);
        const copy = node.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('input').forEach(input => input.remove());
        return `${block ? '\n\n' : ''}${copy.outerHTML}${block ? '\n\n' : ''}`;
      },
    });
  }
  return converter.turndown($.html());
}
