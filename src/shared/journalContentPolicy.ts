export const journalLinkProtocols = ['http:', 'https:', 'mailto:'] as const;
export const journalImageAlignments = ['left', 'center', 'right'] as const;
export const journalTableAlignments = ['left', 'center', 'right'] as const;
export const journalCodeLanguagePattern = /^[a-z0-9_+-]+$/i;
export const journalControlledHtmlTags = [
  'u', 'mark', 'sub', 'sup', 'br', 'a', 'hr',
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'ul', 'ol', 'li',
  'strong', 'em', 's', 'del',
  'figure', 'figcaption', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
] as const;

export function parseJournalInternalImageId(src: string): number | null {
  const match = /^\/media\/(\d+)$/.exec(src);
  if (match === null) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isAllowedJournalExternalImageUrl(src: string): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return url.protocol === 'https:'
    && url.username.length === 0
    && url.password.length === 0;
}

export function isAllowedJournalLinkHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;
  if (/[\u0000-\u0020\u007f\\]/.test(trimmed)) return false;
  if (trimmed.startsWith('#')) return trimmed.length > 1;
  if (trimmed.startsWith('//')) return false;

  let url: URL;
  try {
    url = new URL(trimmed, 'https://journal.invalid');
  } catch {
    return false;
  }
  return journalLinkProtocols.includes(url.protocol as typeof journalLinkProtocols[number]);
}

export function isAllowedJournalCodeLanguage(language: string): boolean {
  return journalCodeLanguagePattern.test(language);
}
