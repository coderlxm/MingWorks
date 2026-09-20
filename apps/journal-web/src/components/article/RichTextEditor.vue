<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { Editor, EditorContent, useEditor } from '@tiptap/vue-3';
import { FileHandler } from '@tiptap/extension-file-handler';
import { EditorState } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import Placeholder from '@tiptap/extension-placeholder';
import JournalLoading from '../ui/JournalLoading.vue';
import { isAllowedJournalLinkHref } from '../../../../../src/shared/journalContentPolicy';
import { createJournalRichTextExtensions } from '../../../../../src/shared/journalRichText';
import type { JournalAsset, JournalRichDocument } from '../../types';
import { isAllowedJournalExternalImageUrl } from '../../../../../src/shared/journalContentPolicy';
import { ArticleUploadAnchor, articleUploadKey } from '../../utils/articleUploadAnchor';
import { showMessage } from '../../utils/message';
import TableControls from './TableControls.vue';
import ImageControls from './ImageControls.vue';
import MarkdownWorkspace from './MarkdownWorkspace.vue';
import RichArticleRenderer from './RichArticleRenderer.vue';

const props = withDefaults(defineProps<{
  assets?: readonly JournalAsset[];
  disabled?: boolean;
  imagesEnabled?: boolean;
  uploadImage: (file: File) => Promise<{ id: number; url: string } | null>;
}>(), {
  assets: () => [],
  disabled: false,
  imagesEnabled: true,
});

const model = defineModel<JournalRichDocument>({ required: true });
const inlineAssets = computed(() => props.assets.filter((asset) => asset.role === 'inline'));
const selectedAssetId = shallowRef('');
const sourceOpen = shallowRef(false);
const sourceChanged = shallowRef(false);
const workspaceBusy = shallowRef(false);
const previewOpen = shallowRef(false);
const emit = defineEmits<{ sourceDirty: [dirty: boolean]; busy: [busy: boolean] }>();

const editor = useEditor({
  editable: !props.disabled,
  extensions: [
    ...createJournalRichTextExtensions({ resizeImages: true }),
    ArticleUploadAnchor,
    Placeholder.configure({ placeholder: '在这里写下你的文章…' }),
    FileHandler.configure({
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      consumePasteEvent: true,
      onPaste: (editorInstance, files) => {
        void handleFiles(files, editorInstance);
      },
      onDrop: (editorInstance, files, position) => {
        void handleFiles(files, editorInstance, position);
      },
    }),
  ],
  content: model.value,
  onUpdate: ({ editor }) => {
    model.value = editor.getJSON() as JournalRichDocument;
  },
});

watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled);
});

watch(model, (next) => {
  if (!editor.value) return;
  const current = JSON.stringify(editor.value.getJSON());
  if (current === JSON.stringify(next)) return;
  editor.value.commands.setContent(next, { emitUpdate: false });
});

const busy = shallowRef(false);
const fileInput = shallowRef<HTMLInputElement | null>(null);

function run(editorInstance: Editor | null | undefined, command: string): void {
  if (!editorInstance) return;
  const chain = editorInstance.chain().focus();
  switch (command) {
    case 'undo': chain.undo().run(); break;
    case 'redo': chain.redo().run(); break;
    case 'paragraph': chain.setParagraph().run(); break;
    case 'h1': chain.toggleHeading({ level: 1 }).run(); break;
    case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
    case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
    case 'h4': chain.toggleHeading({ level: 4 }).run(); break;
    case 'h5': chain.toggleHeading({ level: 5 }).run(); break;
    case 'h6': chain.toggleHeading({ level: 6 }).run(); break;
    case 'bold': chain.toggleBold().run(); break;
    case 'italic': chain.toggleItalic().run(); break;
    case 'strike': chain.toggleStrike().run(); break;
    case 'underline': chain.toggleUnderline().run(); break;
    case 'highlight': chain.toggleHighlight().run(); break;
    case 'subscript': chain.toggleSubscript().run(); break;
    case 'superscript': chain.toggleSuperscript().run(); break;
    case 'code': chain.toggleCode().run(); break;
    case 'bulletList': chain.toggleBulletList().run(); break;
    case 'orderedList': chain.toggleOrderedList().run(); break;
    case 'taskList': chain.toggleTaskList().run(); break;
    case 'table': chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
    case 'blockquote': chain.toggleBlockquote().run(); break;
    case 'codeBlock': chain.toggleCodeBlock().run(); break;
    case 'hr': chain.setHorizontalRule().run(); break;
    case 'hardBreak': chain.setHardBreak().run(); break;
    case 'link': promptLink(editorInstance); break;
    default: break;
  }
}

function promptLink(editorInstance: Editor): void {
  const previous = editorInstance.getAttributes('link').href;
  const href = window.prompt('链接地址（http://、https://、mailto:、站内相对地址或 #锚点）', previous ?? 'https://');
  if (href === null) return;
  if (href === '') {
    editorInstance.chain().focus().unsetLink().run();
    return;
  }
  if (isAllowedJournalLinkHref(href) === false) {
    window.alert('仅支持 http、https、mailto、站内相对地址和页面锚点。');
    return;
  }
  editorInstance.chain().focus().extendMarkRange('link').setLink({ href }).run();
}

function openFilePicker(): void {
  fileInput.value?.click();
}

function insertImage(
  editorInstance: Editor,
  asset: { id: number; url: string },
  alt: string,
  position?: number,
): void {
  const content = {
    type: 'image',
    attrs: {
      src: asset.url,
      'data-asset-id': String(asset.id),
      alt,
    },
  };
  const chain = editorInstance.chain().focus();
  if (position === undefined) chain.insertContent(content).run();
  else chain.insertContentAt(position, content).run();
}

function insertSelectedAsset(): void {
  const asset = inlineAssets.value.find((item) => String(item.id) === selectedAssetId.value);
  if (!asset || !editor.value) return;
  insertImage(editor.value, asset, asset.originalName ?? '');
  selectedAssetId.value = '';
}

async function handleFiles(
  files: readonly File[],
  editorInstance: Editor | null | undefined,
  position?: number,
): Promise<void> {
  if (busy.value) { showMessage({ message: '请等待当前批次上传完成，再插入图片。', type: 'info' }); return; }
  if (props.disabled || !editorInstance || !props.imagesEnabled) return;
  const id = {};
  busy.value = true;
  emit('busy', true);
  editorInstance.view.dispatch(editorInstance.state.tr.setMeta(articleUploadKey, { add: { id, position: position ?? editorInstance.state.selection.from } }));
  try {
    for (const file of files) {
      const asset = await props.uploadImage(file);
      if (!asset || editorInstance.isDestroyed) break;
      const anchor = articleUploadKey.getState(editorInstance.state)?.find(undefined, undefined, spec => spec.id === id)[0];
      if (!anchor) throw new Error('上传位置已删除；图片已保留在素材面板，可重新插入。');
      insertImage(editorInstance, asset, file.name, anchor.from);
    }
  } catch (error) {
    showMessage({ message: error instanceof Error ? error.message : String(error), type: 'error' });
  } finally {
    if (!editorInstance.isDestroyed) editorInstance.view.dispatch(editorInstance.state.tr.setMeta(articleUploadKey, { remove: id }));
    busy.value = false;
    emit('busy', false);
  }
}

function insertExternalImage(): void {
  const src = window.prompt('HTTPS 图片地址（外部图片可能失效，服务器不会下载）');
  if (src === null) return;
  if (!isAllowedJournalExternalImageUrl(src)) { window.alert('请输入有效的 HTTPS 图片地址。'); return; }
  editor.value?.chain().focus().setImage({ src, alt: '' }).run();
}

function applyMarkdown(document: JournalRichDocument): void {
  const instance = editor.value!;
  instance.chain().focus().command(({ tr }) => { closeHistory(tr); return true; }).selectAll().insertContent(document.content).run();
  instance.view.dispatch(closeHistory(instance.state.tr));
  sourceOpen.value = false;
  sourceChanged.value = false;
  emit('sourceDirty', false);
}
function toggleSource(): void {
  if (sourceOpen.value && sourceChanged.value && !window.confirm('放弃尚未应用的 Markdown 修改？')) return;
  sourceOpen.value = !sourceOpen.value;
  sourceChanged.value = false;
  emit('sourceDirty', false);
}
async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(editor.value!.state.selection.$from.parent.textContent);
    showMessage({ message: '代码已复制', type: 'success' });
  } catch (error) { showMessage({ message: error instanceof Error ? error.message : String(error), type: 'error' }); }
}

function clearHistory(): void {
  const instance = editor.value;
  if (!instance) return;
  instance.view.updateState(EditorState.create({ schema: instance.schema, doc: instance.state.doc, plugins: instance.state.plugins }));
}
defineExpose({ clearHistory });

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = '';
  if (files.length > 0) void handleFiles(files, editor.value);
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="rich-editor">
    <div class="content-controls">
      <button type="button" :disabled="disabled || busy || workspaceBusy" @click="toggleSource">{{ sourceOpen ? '返回富文本' : 'Markdown 工作区 / 导入导出' }}</button>
      <button v-if="!sourceOpen" type="button" :disabled="busy" @click="previewOpen = !previewOpen">{{ previewOpen ? '继续编辑' : '预览正文' }}</button>
    </div>
    <MarkdownWorkspace v-if="sourceOpen" :document="model" :upload-image="uploadImage" :disabled="disabled || busy" @apply="applyMarkdown" @dirty="sourceChanged = $event; emit('sourceDirty', $event)" @busy="workspaceBusy = $event; emit('busy', $event)" />
    <RichArticleRenderer v-if="previewOpen && !sourceOpen" :document="model" />
    <div v-show="!sourceOpen && !previewOpen">
    <div class="rich-editor__toolbar" role="toolbar">
      <button type="button" :disabled="disabled" @click="run(editor, 'undo')">撤销</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'redo')">重做</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('paragraph')" @click="run(editor, 'paragraph')">正文</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 1 })" @click="run(editor, 'h1')">H1</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 2 })" @click="run(editor, 'h2')">H2</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 3 })" @click="run(editor, 'h3')">H3</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 4 })" @click="run(editor, 'h4')">H4</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 5 })" @click="run(editor, 'h5')">H5</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 6 })" @click="run(editor, 'h6')">H6</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('bold')" @click="run(editor, 'bold')">粗体</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('italic')" @click="run(editor, 'italic')">斜体</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('strike')" @click="run(editor, 'strike')">删除线</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('underline')" @click="run(editor, 'underline')">下划线</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('highlight')" @click="run(editor, 'highlight')">高亮</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('subscript')" @click="run(editor, 'subscript')">下标</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('superscript')" @click="run(editor, 'superscript')">上标</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('code')" @click="run(editor, 'code')">代码</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('bulletList')" @click="run(editor, 'bulletList')">无序</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('orderedList')" @click="run(editor, 'orderedList')">有序</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('taskList')" @click="run(editor, 'taskList')">任务</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'table')">表格</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('blockquote')" @click="run(editor, 'blockquote')">引用</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('codeBlock')" @click="run(editor, 'codeBlock')">代码块</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'hr')">分隔线</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'hardBreak')">换行</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" @click="run(editor, 'link')">链接</button>
      <button type="button" :disabled="disabled" @click="insertExternalImage">外链图片</button>
      <button v-for="[align, label] in [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']]" :key="align" type="button" :disabled="disabled" @click="editor?.chain().focus().setTextAlign(align).run()">{{ label }}</button>
      <button
        type="button"
        :disabled="disabled || busy || !imagesEnabled"
        :aria-busy="busy"
        @click="openFilePicker"
      >
        <JournalLoading v-if="busy" variant="inline" label="上传中…" />
        <template v-else>上传并插入图片</template>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        @change="onFileChange"
      >
    </div>
    <div v-if="imagesEnabled && inlineAssets.length" class="rich-editor__asset-picker">
      <select v-model="selectedAssetId" :disabled="disabled || busy" aria-label="选择已上传图片">
        <option value="">选择已上传图片</option>
        <option v-for="asset in inlineAssets" :key="asset.id" :value="String(asset.id)">
          {{ asset.originalName ?? `图片 ${asset.id}` }}
        </option>
      </select>
      <button class="button button--quiet" type="button" :disabled="disabled || busy || !selectedAssetId" @click="insertSelectedAsset">
        插入正文
      </button>
    </div>
    <TableControls v-if="editor?.isActive('table')" :editor="editor" :disabled="disabled" />
    <ImageControls v-if="editor?.isActive('image')" :editor="editor" :disabled="disabled" />
    <label v-if="editor?.isActive('codeBlock')">代码语言 <input :value="editor.getAttributes('codeBlock').language" placeholder="例如 typescript" @change="editor.chain().focus().updateAttributes('codeBlock', { language: ($event.target as HTMLInputElement).value || null }).run()"></label>
    <button v-if="editor?.isActive('codeBlock')" type="button" @click="copyCode">复制代码</button>
    <EditorContent :editor="editor" class="rich-editor__content journal-prose" />
    </div>
  </div>
</template>

<style scoped>
.rich-editor {
  display: grid;
  gap: 0.6rem;
}

.rich-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.7rem;
  background: var(--surface-card);
  overflow-x: auto;
}

.rich-editor__toolbar button {
  padding: 0.3rem 0.5rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.78rem;
}

.rich-editor__toolbar button:hover:not(:disabled) {
  background: var(--surface-muted);
}

.rich-editor__toolbar button[aria-pressed="true"] {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.rich-editor__toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.rich-editor__asset-picker,
.rich-editor__alt-field {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.rich-editor__asset-picker select,
.rich-editor__alt-field input {
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: var(--surface-card);
  color: var(--text-primary);
}

.rich-editor__asset-picker select {
  flex: 1;
}

.rich-editor__alt-field span {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.rich-editor__alt-field input {
  flex: 1;
}

.rich-editor__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--border-subtle);
}

.rich-editor__content {
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.7rem;
  background: var(--surface-card);
  min-height: 18rem;
}

.rich-editor__content :deep(.ProseMirror) {
  min-height: 16rem;
  font-family: var(--font-serif);
  font-size: 1.02rem;
  line-height: 1.78;
  outline: none;
}

.rich-editor__content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-muted);
  float: left;
  pointer-events: none;
  height: 0;
}

@media (max-width: 620px) {
  .rich-editor__toolbar { flex-wrap: nowrap; overflow-x: auto; }
}
</style>
