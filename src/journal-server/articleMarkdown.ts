import { Lexer, marked, walkTokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { generateJSON } from '@tiptap/html/server';
import { createJournalRichTextExtensions } from '../shared/journalRichText.js';
import type { JournalRichDocument } from '../shared/journalProtocol.js';
import { assertRichDocument, normalizeRichDocument } from './richText.js';

const allowedAutomationLinkProtocols = new Set(['http:', 'https:', 'mailto:']);

export class JournalArticleInputError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'JournalArticleInputError';
  }
}

function assertAutomationLink(href: string): void {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new JournalArticleInputError(400, `暂不支持 Markdown 链接 ${href}，请使用有效的绝对 URL。`);
  }
  if (allowedAutomationLinkProtocols.has(url.protocol) === false) {
    throw new JournalArticleInputError(400, `暂不支持 Markdown 链接协议 ${url.protocol}，请使用 http、https 或 mailto。`);
  }
}

export function assertAutomationArticleMarkdown(markdown: string): void {
  const tokens = Lexer.lex(markdown, { gfm: true, breaks: true });
  walkTokens(tokens, (token) => {
    switch (token.type) {
      case 'table':
        throw new JournalArticleInputError(400, '暂不支持 Markdown 表格，请改为分条描述。');
      case 'image':
        throw new JournalArticleInputError(400, '暂不支持 Markdown 图片，请移除图片后重试。');
      case 'html':
        throw new JournalArticleInputError(400, '暂不支持 Markdown 原始 HTML，请改写为受支持的 Markdown。');
      case 'checkbox':
        throw new JournalArticleInputError(400, '暂不支持 Markdown 任务复选框，请改为普通列表。');
      case 'list_item':
        if (token.task) {
          throw new JournalArticleInputError(400, '暂不支持 Markdown 任务复选框，请改为普通列表。');
        }
        break;
      case 'link':
        assertAutomationLink(token.href);
        break;
    }
  });
}

export interface MarkdownToRichDocumentOptions {
  preserveCodeLanguage?: boolean;
}

export function markdownToRichDocument(
  markdown: string,
  options: MarkdownToRichDocumentOptions = {},
): JournalRichDocument {
  const allowedAttributes = options.preserveCodeLanguage === true
    ? {
        a: ['href', 'rel', 'target'],
        code: ['class'],
      }
    : {
        a: ['href', 'rel', 'target'],
      };

  const html = sanitizeHtml(
    marked.parse(markdown, { gfm: true, breaks: true, async: false }) as string,
    {
      allowedTags: [
        'p', 'br', 'hr', 'h2', 'h3', 'strong', 'em', 's', 'code', 'pre',
        'blockquote', 'ul', 'ol', 'li', 'a',
      ],
      allowedAttributes,
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        h1: 'h2',
        h4: 'h3',
        h5: 'h3',
        h6: 'h3',
        a: sanitizeHtml.simpleTransform('a', {
          rel: 'noopener noreferrer',
          target: '_blank',
        }),
      },
      ...(options.preserveCodeLanguage === true
        ? { allowedClasses: { code: [/^language-/] } }
        : {}),
    },
  );
  const document = generateJSON(
    html,
    createJournalRichTextExtensions({ updateHeadingIds: false }),
  ) as JournalRichDocument;
  const normalized = normalizeRichDocument(document);
  assertRichDocument(normalized, { allowImages: false });
  return normalized;
}
