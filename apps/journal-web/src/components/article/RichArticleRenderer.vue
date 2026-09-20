<script setup lang="ts">
import { computed } from 'vue';
import { generateHTML } from '@tiptap/html';
import MarkdownBody from '../content/MarkdownBody.vue';
import { createJournalRichTextExtensions } from '../../../../../src/shared/journalRichText';
import type { JournalRichDocument } from '../../types';

const props = defineProps<{
  document: JournalRichDocument | null;
}>();

const extensions = createJournalRichTextExtensions({ updateHeadingIds: false });
const html = computed(() => props.document ? generateHTML(props.document, extensions) : '');
</script>

<template>
  <MarkdownBody class="rich-article" :html="html" :gate-external-images="false" />
</template>

<style scoped>
.rich-article { font-family: var(--font-serif); font-size: 1.02rem; }
</style>
