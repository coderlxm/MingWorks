<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  exchangeResumeShareToken,
  fetchPublicResume,
  JournalRequestError,
  unlockResume,
} from '../../api';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type { JournalPublicResume } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import MarkdownResumeViewer from './MarkdownResumeViewer.vue';
import PdfResumeViewer from './PdfResumeViewer.vue';
import ResumeAccessGate from './ResumeAccessGate.vue';
import ResumeFloatingDock from './ResumeFloatingDock.vue';
import ResumeHero from './ResumeHero.vue';

const route = useRoute();
const router = useRouter();
const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);

const loading = shallowRef(true);
const busy = shallowRef(false);
const unlockError = shallowRef<string | null>(null);
const loadError = shallowRef<string | null>(null);
const content = shallowRef<JournalPublicResume | null>(null);
const enteredViaShareToken = shallowRef(false);
const view = useTemplateRef<HTMLElement>('view');
const pdfViewer = useTemplateRef<InstanceType<typeof PdfResumeViewer>>('pdfViewer');
let loadVersion = 0;

const locked = computed(() => content.value?.kind === 'locked');
const resume = computed(() => content.value?.kind === 'resume' ? content.value : null);
const fixedShareUrl = computed(() => (
  !enteredViaShareToken.value
  && (resume.value?.accessMode === 'protected' || resume.value?.accessMode === 'public')
    ? `${window.location.origin}/resume`
    : null
));

onMounted(() => {
  view.value?.focus({ preventScroll: true });
  void load(route.hash);
});
onBeforeUnmount(() => { loadVersion += 1; });

function exitReading(): void {
  void router.push('/about');
}

function handleEscape(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  if (!pdfViewer.value?.closeEnlargedPage()) exitReading();
}

onBeforeRouteUpdate((to, from) => {
  if (to.name === 'resume' && to.hash !== '' && to.hash !== from.hash) {
    void load(to.hash);
  }
});

async function load(hash: string): Promise<void> {
  const version = ++loadVersion;
  loading.value = true;
  loadError.value = null;
  content.value = null;
  const token = readShareToken(hash);
  try {
    if (token !== null) {
      enteredViaShareToken.value = true;
      const response = await exchangeResumeShareToken(token);
      if (version !== loadVersion) return;
      content.value = response;
      await router.replace({ path: route.path, query: route.query, hash: '' });
    } else {
      const response = await fetchPublicResume();
      if (version !== loadVersion) return;
      content.value = response;
    }
  } catch (reason) {
    if (version !== loadVersion) return;
    handleLoadFailure(reason);
    return;
  }
  if (version === loadVersion) loading.value = false;
}

function readShareToken(hash: string): string | null {
  if (!hash.startsWith('#token=')) return null;
  return hash.slice('#token='.length);
}

function handleLoadFailure(reason: unknown): void {
  loading.value = false;
  if (reason instanceof JournalRequestError && reason.status === 404) {
    void router.replace('/404');
    return;
  }
  loadError.value = reason instanceof Error ? reason.message : String(reason);
}

async function unlock(password: string): Promise<void> {
  const version = loadVersion;
  busy.value = true;
  unlockError.value = null;
  try {
    const response = await unlockResume(password);
    if (version !== loadVersion) return;
    content.value = response;
  } catch (reason) {
    if (version !== loadVersion) return;
    if (reason instanceof JournalRequestError && reason.status === 401) {
      unlockError.value = '简历访问口令不正确';
    } else if (reason instanceof JournalRequestError && reason.status === 404) {
      handleLoadFailure(reason);
    } else {
      unlockError.value = reason instanceof Error ? reason.message : String(reason);
    }
  } finally {
    if (version === loadVersion) busy.value = false;
  }
}
</script>

<template>
  <main ref="view" class="resume-view" tabindex="-1" @keydown.esc="handleEscape">
    <header class="resume-view__bar">
      <span class="resume-view__title">个人简历</span>
      <RouterLink class="resume-view__exit" to="/about" title="退出阅读（Esc）">
        退出阅读 <span aria-hidden="true">×</span>
      </RouterLink>
    </header>

    <div class="resume-view__body">
      <div v-if="loading" class="resume-view__message">
        <JournalLoading variant="reading" label="正在打开简历…" />
      </div>

      <div v-else-if="locked" class="resume-view__message">
        <ResumeAccessGate :busy="busy" :error="unlockError" @unlock="unlock" />
      </div>

      <PdfResumeViewer
        v-else-if="resume?.format === 'pdf'"
        ref="pdfViewer"
        :key="resume.updatedAt"
        :pages="resume.previewPages"
        :content-url="resume.contentUrl"
        :download-url="resume.downloadUrl"
        :original-name="resume.originalName"
        :updated-at="resume.updatedAt"
        :share-url="fixedShareUrl"
        :contacts="profile?.contactItems"
      />

      <div v-else-if="resume?.format === 'markdown'" class="resume-view__markdown-scroll">
        <div class="resume-view__markdown">
          <ResumeHero :profile="profile" :resume="resume" />
          <MarkdownResumeViewer :html="resume.renderedHtml" />
          <ResumeFloatingDock
            format="markdown"
            :download-url="resume.downloadUrl"
            :share-url="fixedShareUrl"
          />
        </div>
      </div>

      <div v-else-if="loadError" class="resume-view__message">
        <p class="resume-view__error" role="alert">{{ loadError }}</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.resume-view {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.35rem;
  padding: max(0.35rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: var(--surface-page);
}

.resume-view__bar {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.resume-view__title {
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.85rem;
}

.resume-view__exit {
  display: inline-flex;
  min-height: 2.25rem;
  flex: none;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: 0.8rem;
  text-decoration: none;
}

.resume-view__exit:hover { border-color: var(--accent); color: var(--accent-strong); }

.resume-view__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
}

.resume-view__message,
.resume-view__markdown-scroll {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.resume-view__message {
  display: grid;
  align-items: start;
  justify-items: center;
}

.resume-view__markdown {
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 1.5rem 0;
}

.resume-view__error {
  margin: 2rem 0;
  max-width: var(--reading-width);
  color: var(--danger);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

@media (max-width: 599px) {
  .resume-view {
    padding-right: max(0.5rem, env(safe-area-inset-right));
    padding-left: max(0.5rem, env(safe-area-inset-left));
  }
}
</style>
