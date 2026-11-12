import type { JournalEntry, JournalRichNode } from '../types';

const EXCLUDED_BLOCKS = new Set([
  'heading', 'codeBlock', 'table', 'image', 'journalImage', 'horizontalRule',
]);
const LIST_BLOCKS = new Set(['bulletList', 'orderedList', 'taskList']);
const BLOCK_CONTAINERS = new Set(['blockquote', 'listItem', 'taskItem', ...LIST_BLOCKS]);
const SEGMENT_END = /[。！？；.!?;:：…]$/u;

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function extractPlainText(node: JournalRichNode): string {
  if (EXCLUDED_BLOCKS.has(node.type)) return '';
  if (node.type === 'hardBreak') return ' ';
  if (node.text !== undefined) return node.text;
  if (node.content === undefined) return '';
  return node.content.map(extractPlainText).join(BLOCK_CONTAINERS.has(node.type) ? ' ' : '');
}

function joinSegments(segments: string[]): string {
  return segments.reduce((summary, segment) => {
    if (summary.length === 0) return segment;
    return `${summary}${SEGMENT_END.test(summary) ? ' ' : ' · '}${segment}`;
  }, '');
}

export function extractArticleSummary(entry: Pick<JournalEntry, 'richBody' | 'contentText'>): string {
  const segments: string[] = [];

  if (entry.richBody !== null) {
    for (const node of entry.richBody.content) {
      if (node.type === 'paragraph' || node.type === 'blockquote') {
        segments.push(normalizeText(extractPlainText(node)));
      }
      else if (LIST_BLOCKS.has(node.type) && node.content !== undefined) {
        for (const item of node.content) {
          if (item.type === 'listItem' || item.type === 'taskItem') {
            segments.push(normalizeText(extractPlainText(item)));
          }
        }
      }
    }
  }

  const narrativeSegments = segments.filter(segment => segment.length > 0);
  if (narrativeSegments.length > 0) return joinSegments(narrativeSegments);

  return joinSegments(entry.contentText.split(/\n+/u).map(normalizeText).filter(line => line.length > 0));
}
