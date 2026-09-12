import { Marked, type RendererObject, type Tokens } from 'marked';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeUrl(href: string): string | null {
  if (!URL.canParse(href, window.location.origin)) return null;
  const url = new URL(href, window.location.origin);
  if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'mailto:') {
    return null;
  }
  return url.toString();
}

const aiRenderer: RendererObject<string, string> = {
  html({ text }: Tokens.HTML | Tokens.Tag): string {
    return escapeHtml(text);
  },
  link({ href, tokens }: Tokens.Link): string {
    const label = this.parser.parseInline(tokens);
    const url = safeUrl(href);
    if (url === null) return label;
    return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  },
  image({ text }: Tokens.Image): string {
    return escapeHtml(text);
  },
  text(token: Tokens.Text | Tokens.Escape): string {
    if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
    return escapeHtml(token.text);
  },
};

const marked = new Marked({ renderer: aiRenderer, gfm: true, breaks: true });

export function renderAiMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}
