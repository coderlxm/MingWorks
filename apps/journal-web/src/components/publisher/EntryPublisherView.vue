<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { vLoading } from 'element-plus';
import { useRouter } from 'vue-router';
import AiSuggestionButton from '../ui/AiSuggestionButton.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { useEntryPublisher } from '../../composables/useEntryPublisher';
import { useEntryMediaSubmit } from '../../composables/useEntryMediaSubmit';
import { useTagSuggestions } from '../../composables/useTagSuggestions';
import { useTopicSuggestion } from '../../composables/useTopicSuggestion';
import { plainJournalChannels } from '../../journalChannels';
import type { JournalAsset, JournalPlainChannel, JournalVisibility } from '../../types';
import { showMessage } from '../../utils/message';
import { copyEntryAccessLink } from '../../utils/accessLink';
import { appendJournalTags } from '../../utils/journalTags';
import {
  beginPublishProbe,
  clearPublishProbe,
  markPublishProbe,
  previousPublishProbe,
} from '../../utils/publishProbe';
import EntryImagePicker from './EntryImagePicker.vue';
import EntryMediaPreviewGrid from './EntryMediaPreviewGrid.vue';
import EntryChannelField from './EntryChannelField.vue';
import EntryVisibilityField from './EntryVisibilityField.vue';
import EntryPublishedTimeField from './EntryPublishedTimeField.vue';
import EntryTopicField from './EntryTopicField.vue';

const props = withDefaults(defineProps<{
  entryId?: number;
}>(), {
  entryId: undefined,
});

const router = useRouter();
const publisher = useEntryPublisher();
const tagSuggestions = useTagSuggestions();
const topicSuggestion = useTopicSuggestion();
const title = shallowRef('');
const contentText = shallowRef('');
const channel = shallowRef<JournalPlainChannel>('life');
const visibility = shallowRef<JournalVisibility>('public');
const accessPassword = shallowRef('');
const newMedia = shallowRef<File[]>([]);
const removedAssetIds = shallowRef<ReadonlySet<number>>(new Set());
const specifyTime = shallowRef(false);
const specifiedTime = shallowRef('');
const initializedEntryId = shallowRef<number | null>(null);
const assetChanged = shallowRef(false);
const stalledPublishProbe = shallowRef(previousPublishProbe());
const mediaSubmit = useEntryMediaSubmit();
let terminalErrorMessage: ReturnType<typeof showMessage> | null = null;

const isEditing = computed(() => props.entryId !== undefined);
const isPublished = computed(() => publisher.entry.value?.publicationStatus === 'published');
const topicEditable = computed(() => !isPublished.value || publisher.entry.value?.sourceKind === 'web');
const mediaEditable = computed(() => !isPublished.value || publisher.entry.value?.sourceKind === 'web');
const formAvailable = computed(() => !isEditing.value || publisher.entry.value !== null);
const existingAssets = computed<JournalAsset[]>(() =>
  (publisher.entry.value?.assets ?? []).filter(asset => !removedAssetIds.value.has(asset.id)),
);
const busy = computed(() =>
  publisher.loading.value
  || (isEditing.value && publisher.entry.value === null)
  || publisher.submitting.value !== null
  || mediaSubmit.busy.value,
);
const hasContent = computed(() =>
  contentText.value.trim().length > 0 || existingAssets.value.length + newMedia.value.length > 0,
);
const canSaveDraft = computed(() =>
  formAvailable.value
  && hasContent.value
  && !busy.value,
);
const hasExistingPassword = computed(() =>
  isPublished.value && publisher.entry.value?.visibility === 'protected',
);
const accessSettingsValid = computed(() =>
  visibility.value !== 'protected'
  || /^\d{6}$/.test(accessPassword.value)
  || (hasExistingPassword.value && accessPassword.value === ''),
);
const canPublish = computed(() =>
  canSaveDraft.value
  && accessSettingsValid.value
  && (!specifyTime.value || specifiedTime.value !== ''),
);
const canSavePublished = computed(() =>
  isPublished.value
  && hasContent.value
  && specifiedTime.value !== ''
  && accessSettingsValid.value
  && !busy.value,
);
const routeError = computed(() => publisher.error.value);
const tagSuggestionInputAvailable = computed(() =>
  title.value.trim().length > 0 || contentText.value.trim().length > 0,
);
const topicSuggestionInputAvailable = computed(() => contentText.value.trim().length > 0);

watch(() => publisher.entry.value, (entry) => {
  if (!entry || initializedEntryId.value === entry.id) return;
  initializedEntryId.value = entry.id;
  title.value = entry.title ?? '';
  contentText.value = entry.contentText;
  channel.value = entry.channel as JournalPlainChannel;
  visibility.value = entry.visibility;
  accessPassword.value = '';
  specifyTime.value = true;
  specifiedTime.value = entry.sourceCreatedAt;
  newMedia.value = [];
  removedAssetIds.value = new Set();
});

watch(routeError, (error) => {
  if (!error) {
    terminalErrorMessage?.close();
    terminalErrorMessage = null;
    return;
  }
  if (!formAvailable.value) {
    terminalErrorMessage?.close();
    terminalErrorMessage = showMessage({ message: error, type: 'error', duration: 0 });
    return;
  }
  showMessage({ message: error, type: 'error' });
});

watch(() => mediaSubmit.error.value, (error) => {
  if (error) showMessage({ message: error, type: 'error' });
});

onMounted(async () => {
  if (props.entryId === undefined) return;
  await publisher.load(props.entryId);
});

onBeforeUnmount(() => terminalErrorMessage?.close());

function removeExisting(assetId: number): void {
  if (!mediaEditable.value) return;
  removedAssetIds.value = new Set([...removedAssetIds.value, assetId]);
}

const returnPath = (window.history.state as { journalReturnPath?: string } | null)?.journalReturnPath ?? '/me';
const returnLabel = returnPath.startsWith('/me') ? '我的全部记录' : '首页';

function returnToAssets(): void {
  const { path, query, hash } = router.resolve(returnPath);
  void router.push({
    path,
    query,
    hash,
    state: { journalAssetChanged: assetChanged.value },
  });
}

function buildInput() {
  return {
    title: title.value.trim() || null,
    contentText: contentText.value,
    uploadId: '',
    removedAssetIds: [...removedAssetIds.value],
    channel: channel.value,
    visibility: visibility.value,
    ...(visibility.value === 'protected' && accessPassword.value
      ? { accessPassword: accessPassword.value }
      : {}),
    sourceCreatedAt: specifyTime.value ? specifiedTime.value : undefined,
  };
}

function channelLabel(value: JournalPlainChannel): string {
  return plainJournalChannels.find(option => option.value === value)!.label;
}

function formatProbeTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp);
}

async function saveDraft(): Promise<void> {
  const uploadId = await mediaSubmit.submit(newMedia.value, publisher.entry.value?.id);
  if (!uploadId) return;
  const saved = await publisher.saveDraft({ ...buildInput(), uploadId });
  if (!saved) return;
  initializedEntryId.value = saved.id;
  assetChanged.value = true;
  title.value = saved.title ?? '';
  contentText.value = saved.contentText;
  newMedia.value = [];
  removedAssetIds.value = new Set();
  showMessage({
    message: `草稿已保存到“${channelLabel(channel.value)}”频道`,
    type: 'success',
  });
  if (!isEditing.value) {
    await router.replace({ name: 'entry-edit', params: { entryId: saved.id } });
  }
}

async function publish(): Promise<void> {
  beginPublishProbe();
  const uploadId = await mediaSubmit.submit(newMedia.value, publisher.entry.value?.id);
  if (!uploadId) {
    clearPublishProbe();
    return;
  }
  const published = await publisher.publish({ ...buildInput(), uploadId });
  if (!published) {
    clearPublishProbe();
    return;
  }
  showMessage({
    message: `已发布到“${channelLabel(channel.value)}”频道`,
    type: 'success',
  });
  assetChanged.value = true;
  markPublishProbe('NAVIGATION_STARTED');
  returnToAssets();
  clearPublishProbe();
  stalledPublishProbe.value = null;
}

async function savePublished(): Promise<void> {
  const uploadId = publisher.entry.value?.sourceKind === 'web'
    ? await mediaSubmit.submit(newMedia.value, publisher.entry.value.id)
    : '';
  if (publisher.entry.value?.sourceKind === 'web' && !uploadId) return;
  const saved = await publisher.updatePublished({
    ...buildInput(),
    uploadId,
    sourceCreatedAt: specifiedTime.value,
  });
  if (!saved) return;
  assetChanged.value = true;
  title.value = saved.title ?? '';
  newMedia.value = [];
  removedAssetIds.value = new Set();
  showMessage({ message: '记录修改已保存', type: 'success' });
}

async function submit(): Promise<void> {
  if (isPublished.value) await savePublished();
  else await publish();
}

async function copyAccessLink(): Promise<void> {
  const entry = publisher.entry.value;
  if (!entry) return;
  try {
    await copyEntryAccessLink(entry.publicId);
    showMessage({ message: '访问链接已复制', type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}

async function generateTags(): Promise<void> {
  try {
    const tags = await tagSuggestions.generate({
      kind: 'entry',
      channel: channel.value,
      title: title.value.trim() || null,
      contentText: contentText.value,
    });
    const result = appendJournalTags(contentText.value, tags);
    if (result.addedTags.length === 0) {
      showMessage({ message: '没有新的标签可补充', type: 'info' });
      return;
    }
    contentText.value = result.contentText;
    showMessage({ message: `已补充 ${result.addedTags.length} 个标签`, type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}

async function generateTopic(): Promise<void> {
  try {
    const topic = await topicSuggestion.generate(contentText.value);
    title.value = topic;
    showMessage({ message: '主题已生成', type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}
</script>

<template>
  <main class="publisher-view">
    <header class="publisher-view__heading">
      <button class="text-button" type="button" @click="returnToAssets">← 返回{{ returnLabel }}</button>
      <h1>{{ isEditing ? '编辑记录' : '写一条新记录' }}</h1>
    </header>

    <aside v-if="stalledPublishProbe" class="publisher-view__probe">
      <span>检测到上次发布在刷新前停留于</span>
      <code>{{ stalledPublishProbe.stage }}</code>
      <time :datetime="new Date(stalledPublishProbe.updatedAt).toISOString()">
        {{ formatProbeTime(stalledPublishProbe.updatedAt) }}
      </time>
    </aside>

    <div class="publisher-view__stage" :aria-busy="publisher.loading.value">
        <form v-loading="publisher.loading.value" class="publisher-view__form" @submit.prevent="submit">
          <div class="publisher-view__manuscript">
            <div class="publisher-view__copy">
              <EntryTopicField v-if="topicEditable" v-model="title" :disabled="busy" />

              <div class="field publisher-view__body">
                <div class="publisher-view__field-heading">
                  <label class="field__label" for="entry-content">正文</label>
                  <div class="publisher-view__ai-actions">
                    <AiSuggestionButton
                      v-if="topicEditable"
                      label="AI 生成主题"
                      busy-label="生成中…"
                      :disabled="!topicSuggestionInputAvailable || tagSuggestions.busy.value"
                      :busy="topicSuggestion.busy.value"
                      @generate="generateTopic"
                    />
                    <AiSuggestionButton
                      label="AI 生成标签"
                      busy-label="生成中…"
                      :disabled="!tagSuggestionInputAvailable || topicSuggestion.busy.value"
                      :busy="tagSuggestions.busy.value"
                      @generate="generateTags"
                    />
                  </div>
                </div>
                <textarea
                  id="entry-content"
                  v-model="contentText"
                  placeholder="写下内容，可直接使用 #标签"
                  :disabled="busy"
                />
              </div>
            </div>

            <EntryImagePicker
              v-if="mediaEditable"
              class="publisher-view__media"
              v-model="newMedia"
              :existing-assets="existingAssets"
              :disabled="busy"
            >
              <EntryMediaPreviewGrid
                v-if="existingAssets.length || newMedia.length"
                v-model="newMedia"
                :existing-assets="existingAssets"
                :disabled="busy"
                @remove-existing="removeExisting"
              />
            </EntryImagePicker>
            <div v-else-if="existingAssets.length" class="publisher-view__media">
              <div class="publisher-view__media-strip">
                <EntryMediaPreviewGrid
                  v-model="newMedia"
                  :existing-assets="existingAssets"
                  :disabled="true"
                  @remove-existing="removeExisting"
                />
              </div>
            </div>
          </div>

          <aside class="publisher-view__sidebar">
            <div class="publisher-view__settings">
              <EntryChannelField v-model="channel" :disabled="busy" />

              <EntryVisibilityField
                :key="publisher.entry.value?.updatedAt ?? 'new'"
                v-model="visibility"
                v-model:access-password="accessPassword"
                :disabled="busy"
                :has-existing-password="hasExistingPassword"
              />

              <EntryPublishedTimeField
                :key="publisher.entry.value?.updatedAt ?? 'new'"
                v-model:enabled="specifyTime"
                v-model:value="specifiedTime"
                :disabled="busy"
              />
            </div>

            <div class="publisher-view__actions">
              <button
                v-if="isPublished && publisher.entry.value?.visibility === 'protected'"
                class="button button--quiet"
                type="button"
                :disabled="busy"
                @click="copyAccessLink"
              >
                复制访问链接
              </button>
              <button
                v-if="!isPublished"
                class="button button--quiet"
                type="button"
                :disabled="!canSaveDraft"
                :aria-busy="publisher.submitting.value === 'draft'"
                @click="saveDraft"
              >
                <JournalLoading v-if="publisher.submitting.value === 'draft'" variant="inline" label="保存中…" />
                <template v-else>保存草稿</template>
              </button>
              <button
                class="button button--primary"
                type="submit"
                :disabled="isPublished ? !canSavePublished : !canPublish"
                :aria-busy="publisher.submitting.value === 'publish'"
              >
                <JournalLoading v-if="publisher.submitting.value === 'publish'" variant="inline" :label="isPublished ? '保存中…' : '发布中…'" />
                <template v-else>{{ isPublished ? '保存修改' : '发布' }}</template>
              </button>
            </div>
          </aside>
        </form>
    </div>
  </main>
</template>

<style scoped>
.publisher-view {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  flex: 1 0 0;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-workspace-width));
  min-height: 36rem;
  margin: 0 auto;
  padding: 1rem 0 1.25rem;
}

.publisher-view__heading {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.publisher-view__heading .text-button {
  color: var(--text-muted);
}

.publisher-view__heading h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.publisher-view__probe {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: baseline;
  margin-bottom: 0.75rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 0.78rem;
}

.publisher-view__probe code {
  color: var(--text-primary);
  font-weight: 650;
}

.publisher-view__stage {
  display: flex;
  grid-row: 3;
  min-height: 0;
}

.publisher-view__form {
  --el-color-primary: var(--accent-strong);
  display: grid;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 17rem;
  grid-template-rows: minmax(0, 1fr);
  gap: 2rem;
  align-items: stretch;
}

.publisher-view__form :deep(.el-loading-mask) {
  background: color-mix(in srgb, var(--surface-page) 82%, transparent);
}

.publisher-view__manuscript {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  min-height: 0;
  padding: 1.25rem 1.5rem;
  border-radius: 4px;
  background: var(--surface-card);
}

.publisher-view__copy {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 1.1rem;
  min-height: 0;
}

.publisher-view__copy :deep(.topic-field input) {
  width: 100%;
  padding: 0.25rem 0 0.6rem;
  border: 0;
  border-bottom: 1px solid var(--border-subtle);
  border-radius: 0;
  background: transparent;
  font-family: var(--font-serif);
  font-size: 1.2rem;
  line-height: 1.6;
}

.publisher-view__copy :deep(.topic-field input:focus) {
  border-bottom-color: var(--accent);
}

.publisher-view__copy :deep(input::placeholder),
.publisher-view__copy textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.publisher-view__body {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
}

.publisher-view__field-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.5rem;
}

.publisher-view__ai-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.publisher-view__form textarea {
  flex: 1 1 0;
  width: 100%;
  min-height: 8rem;
  padding: 0.5rem 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: 0.95rem;
  line-height: 1.9;
  resize: none;
}

.publisher-view__media {
  flex: none;
  padding-top: 0.9rem;
  border-top: 1px solid var(--border-subtle);
}

.publisher-view__media-strip {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.publisher-view__sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0.25rem 0 0 1.5rem;
  overflow-y: auto;
  border-left: 1px solid var(--border-subtle);
}

.publisher-view__settings {
  display: grid;
  align-content: start;
  gap: 1.1rem;
  min-width: 0;
}

.publisher-view__sidebar :deep(.visibility-field) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  min-width: 0;
}

.publisher-view__sidebar :deep(.visibility-field__label) {
  grid-column: 1 / -1;
  margin: 0;
}

.publisher-view__sidebar :deep(.visibility-field__option) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.25rem;
  padding: 0 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: 0.86rem;
  cursor: pointer;
}

.publisher-view__sidebar :deep(.visibility-field__option small) {
  display: none;
}

.publisher-view__sidebar :deep(.visibility-field__option input) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.publisher-view__sidebar :deep(.visibility-field__option:has(input:checked)) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.publisher-view__sidebar :deep(.visibility-field__option:has(input:focus-visible)) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.publisher-view__sidebar :deep(.visibility-field__password) {
  margin-top: 0.25rem;
}

.publisher-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: auto;
  padding-top: 1.1rem;
}

.publisher-view__actions .button {
  flex: 1 1 6rem;
  height: 2.5rem;
  min-height: 2.5rem;
}

.publisher-view__actions .button--quiet {
  background: transparent;
}

@media (max-width: 999px) {
  .publisher-view__form {
    grid-template-columns: minmax(0, 1fr);
  }

  .publisher-view__manuscript {
    padding: 1.25rem;
  }
}

@media (min-width: 600px) and (max-width: 999px) {
  .publisher-view__form {
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 1rem;
  }

  .publisher-view__sidebar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 2rem;
    row-gap: 1rem;
    align-items: start;
    padding: 1rem 0 0;
    border-top: 1px solid var(--border-subtle);
    border-left: 0;
    overflow: visible;
  }

  .publisher-view__settings {
    display: contents;
  }

  .publisher-view__actions {
    align-self: end;
    margin-top: 0;
    padding-top: 0;
    justify-content: flex-end;
  }

  .publisher-view__actions .button {
    flex: 0 1 8rem;
  }
}

@media (max-width: 599px) {
  .publisher-view {
    display: block;
    flex: none;
    min-height: auto;
    max-width: var(--editor-width);
    padding-top: 1.25rem;
  }

  .publisher-view__form {
    grid-template-rows: auto;
    gap: 1.5rem;
  }

  .publisher-view__copy,
  .publisher-view__body {
    flex: none;
  }

  .publisher-view__form textarea {
    flex: none;
    min-height: 12rem;
  }

  .publisher-view__sidebar {
    padding: 0 0.5rem;
    border-left: 0;
    overflow: visible;
  }

  .publisher-view__actions {
    justify-content: flex-end;
    margin-top: 0;
  }

  .publisher-view__actions .button {
    flex: 0 1 10rem;
  }

  .publisher-view__heading {
    padding-inline: 0.5rem;
  }

  .publisher-view__manuscript {
    gap: 1.5rem;
    padding: 1rem;
  }

  .publisher-view__copy :deep(.topic-field input) {
    font-size: 1.05rem;
  }
}
</style>
