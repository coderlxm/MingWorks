<script setup lang="ts">
import { computed, h, type VNodeChild } from 'vue';
import ContentImage from './ContentImage.vue';
import ContentCode from './ContentCode.vue';
const props = defineProps<{ html: string; gateExternalImages: boolean; streaming: boolean }>();
function render(node: Node, path: string): VNodeChild {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof HTMLElement)) return null;
  const tag = node.tagName.toLowerCase();
  const attrs: Record<string, string | boolean> = {};
  for (const attr of node.attributes) attrs[attr.name] = attr.value;
  if (tag === 'img') {
    if (!attrs.src) return h('span', '图片地址不受支持');
    const image = h(ContentImage, { key: `${path}:${attrs.src}`, src: String(attrs.src), alt: node.getAttribute('alt') ?? '', title: node.getAttribute('title') ?? '', width: node.getAttribute('width') ?? undefined, height: node.getAttribute('height') ?? undefined, gateExternal: props.gateExternalImages });
    if (node.parentElement?.tagName !== 'FIGURE' && (attrs['data-caption'] || attrs['data-align'])) {
      return h('figure', { key: path, 'data-align': attrs['data-align'] }, [image, attrs['data-caption'] ? h('figcaption', String(attrs['data-caption'])) : null]);
    }
    return image;
  }
  if (tag === 'pre') {
    const code = node.querySelector('code');
    return h(ContentCode, { key: path, text: code?.textContent ?? node.textContent ?? '', language: code?.className.match(/(?:^|\s)language-([\w+-]+)/)?.[1] ?? '', streaming: props.streaming });
  }
  if (tag === 'a') {
    attrs.rel = 'noopener noreferrer';
    if (!String(attrs.href ?? '').startsWith('#')) attrs.target = '_blank';
    else delete attrs.target;
  }
  if (tag === 'input') { attrs.type = 'checkbox'; attrs.disabled = true; attrs.checked = node.hasAttribute('checked'); }
  if (attrs['data-anchorid']) attrs.id = attrs['data-anchorid'];
  const children = Array.from(node.childNodes, (child, index) => render(child, `${path}.${index}`));
  if (tag === 'li' && attrs['data-type'] === 'taskItem' && !node.querySelector('input')) {
    return h('li', { ...attrs, key: path }, [h('label', [h('input', { type: 'checkbox', checked: attrs['data-checked'] === 'true', disabled: true })]), h('div', children)]);
  }
  const result = h(tag, { ...attrs, key: path }, children);
  return tag === 'table' ? h('div', { class: 'table-scroll', tabindex: 0, role: 'region', 'aria-label': '表格（可横向滚动）', key: path }, [result]) : result;
}
const nodes = computed(() => {
  const template = document.createElement('template');
  template.innerHTML = props.html;
  return Array.from(template.content.childNodes, (node, index) => render(node, String(index)));
});
const RenderContent = () => nodes.value;
</script>
<template><RenderContent /></template>
