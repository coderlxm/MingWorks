import type { JSONContent } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';
import { mergeAttributes } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Highlight } from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { generateUniqueIds, UniqueID } from '@tiptap/extension-unique-id';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import {
  journalImageAlignments,
  parseJournalInternalImageId,
} from './journalContentPolicy.js';

export const journalHeadingIdPattern = /^section-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const lowlight = createLowlight(common);

function parseImageWidth(value: string | null): number | null {
  if (value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function imageAlignFromElement(element: HTMLElement): string | null {
  const value = element.getAttribute('data-align') ?? element.getAttribute('align') ?? '';
  return journalImageAlignments.includes(value as typeof journalImageAlignments[number]) ? value : null;
}

export const journalImageExtension = Image.extend({
  addNodeView() {
    const render = this.parent?.();
    if (!render) return null;
    return props => {
      const view = render(props);
      const caption = document.createElement('figcaption');
      const root = view.dom as HTMLElement;
      root.append(caption);
      const sync = (attrs: Record<string, unknown>) => {
        caption.textContent = String(attrs.caption ?? '');
        caption.hidden = !attrs.caption;
        root.dataset.align = String(attrs.align ?? 'left');
      };
      sync(props.node.attrs);
      const update = view.update?.bind(view);
      view.update = (node, decorations, innerDecorations) => {
        const accepted = update ? update(node, decorations, innerDecorations) : false;
        if (accepted) sync(node.attrs);
        return accepted;
      };
      return view;
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-asset-id': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-asset-id'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const value = attributes['data-asset-id'];
          return value == null ? {} : { 'data-asset-id': String(value) };
        },
      },
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          if (element.tagName.toLowerCase() === 'figure') {
            return element.querySelector('figcaption')?.textContent?.trim() ?? null;
          }
          return element.getAttribute('data-caption');
        },
        renderHTML: (attributes: Record<string, unknown>) => (
          attributes.caption == null || attributes.caption === ''
            ? {}
            : { 'data-caption': String(attributes.caption) }
        ),
      },
      align: {
        default: null,
        parseHTML: (element: HTMLElement) => imageAlignFromElement(element),
        renderHTML: (attributes: Record<string, unknown>) => (
          attributes.align == null ? {} : { 'data-align': String(attributes.align) }
        ),
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => parseImageWidth(element.getAttribute('width')),
        renderHTML: (attributes: Record<string, unknown>) => (
          attributes.width == null ? {} : { width: String(attributes.width) }
        ),
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => parseImageWidth(element.getAttribute('height')),
        renderHTML: (attributes: Record<string, unknown>) => (
          attributes.height == null ? {} : { height: String(attributes.height) }
        ),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'img[src]' },
      {
        tag: 'figure',
        getAttrs: (element: HTMLElement) => {
          const image = element.querySelector('img[src]');
          if (image === null) return false;
          const src = image.getAttribute('src') ?? '';
          if (src === '') return false;
          return {
            src,
            alt: image.getAttribute('alt'),
            title: image.getAttribute('title'),
            width: parseImageWidth(image.getAttribute('width')),
            height: parseImageWidth(image.getAttribute('height')),
            'data-asset-id': image.getAttribute('data-asset-id'),
            caption: element.querySelector('figcaption')?.textContent?.trim() ?? null,
            align: imageAlignFromElement(element),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const imageAttributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { referrerpolicy: 'no-referrer', loading: 'lazy' });
    const caption = node.attrs.caption;
    const align = node.attrs.align;
    if (caption == null && align == null) {
      return ['img', imageAttributes];
    }
    const figureAttributes: Record<string, string> = { 'data-type': 'journalImage' };
    if (align != null) figureAttributes['data-align'] = String(align);
    return [
      'figure',
      figureAttributes,
      ['img', imageAttributes],
      ...(caption == null || caption === '' ? [] : [['figcaption', {}, String(caption)]]),
    ] as unknown as DOMOutputSpec;
  },
});

export function createJournalRichTextExtensions(options: { updateHeadingIds?: boolean; resizeImages?: boolean } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      underline: {},
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),
    TableKit.configure({
      table: {
        resizable: true,
        renderWrapper: false,
        allowTableNodeSelection: true,
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: false }),
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right'],
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: null,
      languageClassPrefix: 'language-',
    }),
    UniqueID.configure({
      attributeName: 'anchorId',
      types: ['heading'],
      generateID: () => `section-${crypto.randomUUID()}`,
      updateDocument: options.updateHeadingIds ?? true,
    }),
    journalImageExtension.configure({
      HTMLAttributes: { referrerpolicy: 'no-referrer', loading: 'lazy' },
      resize: options.resizeImages ? { enabled: true, alwaysPreserveAspectRatio: true } : false,
    }),
  ];
}

export function addJournalHeadingIds(document: JSONContent): JSONContent {
  return generateUniqueIds(
    document,
    createJournalRichTextExtensions({ updateHeadingIds: false }),
  );
}

export function isInternalJournalImageSrc(src: string): boolean {
  return parseJournalInternalImageId(src) !== null;
}
