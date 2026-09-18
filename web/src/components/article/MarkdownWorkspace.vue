<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { Lexer, walkTokens } from 'marked';
import type { JournalRichDocument } from '../../types';
import { exportArticleMarkdown, importArticleMarkdown } from '../../api/articles';
import { isAllowedJournalExternalImageUrl, parseJournalInternalImageId } from '../../../../src/shared/journalContentPolicy';
import { showMessage } from '../../utils/message';
import MarkdownBody from '../content/MarkdownBody.vue';

const props = defineProps<{
  document: JournalRichDocument;
  disabled: boolean;
  uploadImage: (file: File) => Promise<{ id: number; url: string } | null>;
}>();
const emit = defineEmits<{ apply: [document: JournalRichDocument]; dirty: [dirty: boolean]; busy: [busy: boolean] }>();
const source = shallowRef('');
const baseline = shallowRef('');
const busy = shallowRef(false);
const preview = shallowRef(true);
const files = shallowRef<Record<string, File>>({});
const fileInput = shallowRef<HTMLInputElement | null>(null);
const localImages = computed(() => {
  const refs = new Set<string>();
  walkTokens(Lexer.lex(source.value, { gfm: true }), token => {
    if (token.type === 'image' && parseJournalInternalImageId(token.href) === null && !isAllowedJournalExternalImageUrl(token.href)) refs.add(token.href);
  });
  return [...refs];
});
function report(error: unknown): void { showMessage({ message: error instanceof Error ? error.message : String(error), type: 'error' }); }
function edit(): void { emit('dirty', source.value !== baseline.value); }
function bindImage(ref: string, event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) files.value = { ...files.value, [ref]: file };
}
async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true; emit('busy', true);
  try { await action(); } catch (error) { report(error); }
  finally { busy.value = false; emit('busy', false); }
}
async function apply(): Promise<void> {
  if (!window.confirm('应用 Markdown 将替换当前正文，可在富文本中撤销。继续？')) return;
  await run(async () => {
    for (const ref of localImages.value) if (!files.value[ref]) throw new Error(`请为 ${ref} 选择本地图片。`);
    const aliases: Record<string, string> = {};
    for (const ref of localImages.value) {
      const asset = await props.uploadImage(files.value[ref]!);
      if (!asset) throw new Error('图片上传失败，正文尚未替换。已上传的图片保留在素材面板。');
      aliases[ref] = asset.url;
    }
    const document = await importArticleMarkdown(source.value, aliases);
    emit('apply', document);
  });
}
async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  await run(async () => {
    if (file.size > 1024 * 1024) throw new Error('Markdown 文件不能超过 1 MB。');
    if (source.value !== baseline.value && !window.confirm('替换尚未应用的 Markdown？')) return;
    source.value = await file.text(); files.value = {}; edit();
  });
}
async function pasteMarkdown(): Promise<void> {
  await run(async () => {
    if (source.value !== baseline.value && !window.confirm('替换尚未应用的 Markdown？')) return;
    source.value = await navigator.clipboard.readText(); files.value = {}; edit();
  });
}
async function download(mode: 'faithful' | 'gfm'): Promise<void> {
  await run(async () => {
    const markdown = await exportArticleMarkdown(props.document, mode);
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `article-${mode}.md`; anchor.click(); URL.revokeObjectURL(url);
  });
}
onMounted(() => { void run(async () => { source.value = await exportArticleMarkdown(props.document, 'faithful'); baseline.value = source.value; }); });
</script>
<template>
  <section class="markdown-workspace" :aria-busy="busy">
    <div class="content-controls">
      <button type="button" :disabled="disabled || busy" @click="fileInput?.click()">导入 .md</button>
      <button type="button" :disabled="disabled || busy" @click="pasteMarkdown">粘贴为 Markdown</button>
      <input ref="fileInput" type="file" accept=".md,.markdown,text/markdown,text/plain" hidden @change="importFile">
      <button type="button" :disabled="disabled || busy" @click="apply">应用到正文</button>
      <button type="button" @click="preview = !preview">{{ preview ? '收起预览' : '预览' }}</button>
      <button type="button" :disabled="disabled || busy" @click="download('faithful')">导出已应用正文（保真）</button>
      <button type="button" :disabled="disabled || busy" @click="download('gfm')">导出已应用正文（纯 GFM）</button>
    </div>
    <p>此处是待应用的 Markdown。正文仅在点击“应用”后改变；保真导出包含受控 HTML 和本站图片引用，不会打包图片。</p>
    <textarea v-model="source" aria-label="Markdown 源码" :disabled="disabled || busy" spellcheck="false" @input="edit" />
    <label v-for="ref in localImages" :key="ref" class="markdown-workspace__binding">{{ ref }} <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" :disabled="busy" @change="bindImage(ref, $event)"></label>
    <MarkdownBody v-if="preview" :content="source" :gate-external-images="true" />
  </section>
</template>
<style scoped>
.markdown-workspace { display: grid; gap: .8rem; min-width: 0; }
.markdown-workspace p { font-size: .8rem; color: var(--text-muted); }
textarea { box-sizing: border-box; width: 100%; min-height: 25rem; resize: vertical; padding: 1rem; background: var(--surface-card); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: .6rem; font-family: monospace; }
.markdown-workspace__binding { display: grid; gap: .3rem; overflow-wrap: anywhere; }
</style>
