<script setup lang="ts">
import { computed } from 'vue';
import { renderAiMarkdown, sanitizeJournalHtml } from '../../utils/aiMarkdown';
import ContentHtml from './ContentHtml.vue';
const props = withDefaults(defineProps<{ content?: string; html?: string; streaming?: boolean; gateExternalImages?: boolean }>(), { content: '', streaming: false, gateExternalImages: true });
// Stable block components keep completed code and loaded images alive during streaming.
const blocks = computed(() => {
  const html = props.html === undefined ? renderAiMarkdown(props.content) : sanitizeJournalHtml(props.html);
  const template = document.createElement('template');
  template.innerHTML = html;
  return Array.from(template.content.childNodes).filter(node => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim()).map(node => node instanceof HTMLElement ? node.outerHTML : node.textContent ?? '');
});
</script>
<template><div class="journal-prose"><ContentHtml v-for="(block, index) in blocks" :key="index" :html="block" :gate-external-images="gateExternalImages" :streaming="streaming && index === blocks.length - 1" /></div></template>
