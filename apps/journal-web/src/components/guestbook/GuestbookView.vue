<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { GuestbookStatus } from '../../../../../src/shared/guestbookProtocol';
import {
  useGuestbookStore,
  type GuestbookScope,
} from '../../stores/guestbook';
import { useSessionStore } from '../../stores/session';
import {
  getOrCreateJournalVisitorId,
  getRememberedJournalVisitorName,
  rememberJournalVisitorName,
} from '../../utils/journalVisitorIdentity';
import { showMessage } from '../../utils/message';
import JournalCommentForm from '../interaction/JournalCommentForm.vue';
import GuestbookList from './GuestbookList.vue';

interface JournalCommentFormInstance {
  clearContent: () => void;
  markFailed: () => void;
}

const session = useSessionStore();
const guestbook = useGuestbookStore();
const {
  messages,
  loadedScope,
  loading,
  loadError,
  submittingVisitor,
  submittingReply,
  mutatingId,
} = storeToRefs(guestbook);
const {
  ownerAuthenticated,
  authenticationChecked,
  authenticationError,
} = storeToRefs(session);

const replyTargetId = shallowRef<number | null>(null);
const rememberedVisitorName = getRememberedJournalVisitorName();
const visitorForm = useTemplateRef<JournalCommentFormInstance>('visitorForm');

const ownerMode = computed(() => authenticationChecked.value && ownerAuthenticated.value);
const scope = computed<GuestbookScope | null>(() => {
  if (!authenticationChecked.value) return null;
  return ownerAuthenticated.value ? 'admin' : 'public';
});
const renderedMessages = computed(() =>
  scope.value !== null && loadedScope.value === scope.value ? messages.value : null,
);
const renderedLoadError = computed(() => {
  if (scope.value === null) return authenticationError.value;
  return loadedScope.value === scope.value ? loadError.value : null;
});
const renderedLoading = computed(() =>
  renderedLoadError.value === null
  && (scope.value === null || loadedScope.value !== scope.value || loading.value),
);
const visitorFormDisabled = computed(() =>
  renderedLoading.value || renderedLoadError.value !== null);

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

onMounted(() => {
  void initialize();
});

async function initialize(): Promise<void> {
  await session.load();
  if (!authenticationChecked.value) return;
  await guestbook.ensureLoaded(ownerAuthenticated.value ? 'admin' : 'public');
}

async function handleVisitorSubmit(input: {
  authorName: string;
  content: string;
  website: string;
}): Promise<void> {
  const visitorId = getOrCreateJournalVisitorId();
  if (visitorId === null) {
    showMessage({ message: '浏览器匿名身份不可用，无法发送留言。', type: 'error' });
    visitorForm.value?.markFailed();
    return;
  }
  try {
    await guestbook.createVisitorMessage(input, visitorId);
    rememberJournalVisitorName(input.authorName);
    visitorForm.value?.clearContent();
    showMessage({ message: '留言已发送', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
    visitorForm.value?.markFailed();
  }
}

function openReply(parentId: number): void {
  replyTargetId.value = parentId;
}

function closeReply(): void {
  replyTargetId.value = null;
}

async function handleReplySubmit(parentId: number, content: string): Promise<void> {
  try {
    await guestbook.createOwnerReply(parentId, content);
    replyTargetId.value = null;
    showMessage({ message: '回复已发送', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}

async function handleSetStatus(id: number, status: GuestbookStatus): Promise<void> {
  try {
    await guestbook.setStatus(id, status);
    showMessage({ message: status === 'hidden' ? '已隐藏' : '已恢复公开', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}

async function handleSetPinned(id: number, pinned: boolean): Promise<void> {
  try {
    await guestbook.setPinned(id, pinned);
    showMessage({ message: pinned ? '已置顶' : '已取消置顶', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}

async function handleRemove(id: number): Promise<void> {
  try {
    await guestbook.remove(id);
    if (replyTargetId.value === id) replyTargetId.value = null;
    showMessage({ message: '已删除', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}
</script>

<template>
  <main class="guestbook-view">
    <!-- 留言板：铺满整个内容区 -->
    <section class="guestbook-view__list" aria-label="留言列表">
      <GuestbookList
        :messages="renderedMessages"
        :loading="renderedLoading"
        :load-error="renderedLoadError"
        :owner-mode="ownerMode"
        :mutating-id="mutatingId"
        :submitting-reply="submittingReply"
        :reply-target-id="replyTargetId"
        @open-reply="openReply"
        @close-reply="closeReply"
        @reply="handleReplySubmit"
        @set-status="handleSetStatus"
        @set-pinned="handleSetPinned"
        @remove="handleRemove"
      />
    </section>

    <!-- 访客留言输入框：吸附在屏幕底部，留言板再长也随时能写 -->
    <section v-if="!ownerMode" class="guestbook-view__composer" aria-label="写留言">
      <JournalCommentForm
        v-if="authenticationChecked"
        ref="visitorForm"
        mode="visitor"
        context="guestbook"
        :busy="submittingVisitor"
        :disabled="visitorFormDisabled"
        :initial-author-name="rememberedVisitorName"
        @submit="handleVisitorSubmit"
      />
    </section>
  </main>
</template>

<style scoped>
.guestbook-view {
  position: relative;
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  min-height: 30rem;
  overflow-x: clip;
}

.guestbook-view__list {
  display: flex;
  flex: 1 1 auto;
}

.guestbook-view__composer {
  position: sticky;
  bottom: calc(1.25rem + env(safe-area-inset-bottom));
  z-index: 1;
  align-self: center;
  width: min(560px, calc(100% - 2rem));
  margin-bottom: calc(1.25rem + env(safe-area-inset-bottom));
}

.guestbook-view__composer :deep(.comment-form) {
  box-shadow:
    0 2px 6px rgb(0 0 0 / 6%),
    0 18px 40px -16px rgb(0 0 0 / 30%);
}
</style>
