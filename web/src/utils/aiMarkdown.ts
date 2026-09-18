import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import {
  isAllowedJournalExternalImageUrl,
  isAllowedJournalLinkHref,
  parseJournalInternalImageId,
} from '../../../src/shared/journalContentPolicy';

const marked = new Marked({ gfm: true, breaks: true });

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.nodeName === 'IMG' && data.attrName === 'src') {
    const src = data.attrValue.trim();
    if (parseJournalInternalImageId(src) === null && isAllowedJournalExternalImageUrl(src) === false) {
      data.keepAttr = false;
    }
    return;
  }
  if (node.nodeName === 'A' && data.attrName === 'href') {
    if (isAllowedJournalLinkHref(data.attrValue) === false) {
      data.keepAttr = false;
    }
    return;
  }
  if (data.attrName === 'style') {
    const style = data.attrValue.trim().toLowerCase();
    const allowed = /^(?:text-align:\s*(?:left|center|right)\s*;?|(?:min-)?width:\s*\d+(?:\.\d+)?px\s*;?)$/.test(style);
    data.keepAttr = allowed;
  }
  if (data.attrName === 'class') data.keepAttr = node.nodeName === 'CODE' && /^language-[\w+-]+$/.test(data.attrValue);
  if (node.nodeName === 'INPUT' && data.attrName === 'type') data.attrValue = 'checkbox';
});

const sanitizeOptions = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 's', 'del', 'u', 'mark', 'sub', 'sup',
    'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
    'figure', 'figcaption',
    'label', 'input', 'span', 'div',
  ],
  ALLOWED_ATTR: [
    'href', 'rel', 'target',
    'src', 'alt', 'title', 'width', 'height', 'data-asset-id', 'data-caption', 'data-align',
    'data-anchorid', 'style', 'class',
    'data-type', 'data-checked', 'checked', 'disabled', 'type',
    'colspan', 'rowspan', 'colwidth', 'align',
    'span', 'loading', 'referrerpolicy', 'start',
  ],
  ALLOW_DATA_ATTR: false,
};

export function renderAiMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return sanitizeJournalHtml(raw);
}

export function sanitizeJournalHtml(html: string): string { return DOMPurify.sanitize(html, sanitizeOptions); }
