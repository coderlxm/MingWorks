<script setup lang="ts">
import { computed } from 'vue';
import GuestbookItem from './GuestbookItem.vue';
import type {
  GuestbookMessage,
  GuestbookStatus,
} from '../../../../../src/shared/guestbookProtocol';

const props = defineProps<{
  messages: readonly GuestbookMessage[] | null;
  loading: boolean;
  loadError: string | null;
  ownerMode: boolean;
  mutatingId: number | null;
  submittingReply: boolean;
  replyTargetId: number | null;
}>();

const emit = defineEmits<{
  openReply: [parentId: number];
  closeReply: [];
  reply: [parentId: number, content: string];
  setStatus: [id: number, status: GuestbookStatus];
  setPinned: [id: number, pinned: boolean];
  remove: [id: number];
}>();

const skeletonNotes = [
  { x: 6, y: 8, width: 260, rotate: -5, lines: [100, 92, 64] },
  { x: 38, y: 4, width: 230, rotate: 4, lines: [100, 78] },
  { x: 68, y: 12, width: 290, rotate: -2, lines: [100, 96, 88, 40] },
  { x: 18, y: 42, width: 240, rotate: 6, lines: [100, 84, 52] },
  { x: 52, y: 38, width: 270, rotate: -6, lines: [100, 90] },
  { x: 74, y: 56, width: 250, rotate: 3, lines: [100, 88, 70, 46] },
] as const;

const showSkeleton = computed(() =>
  props.loading || (props.messages === null && props.loadError === null),
);

// 位置和层级由 CSS 决定，DOM 按 id 固定排序，增删改和置顶都不会移动已有便签
const boardMessages = computed(() =>
  props.messages === null ? [] : [...props.messages].sort((a, b) => a.id - b.id),
);

// 首次铺开时旧留言先钉、新留言后钉；之后新增的留言立即入场
let introDelays: ReadonlyMap<number, number> | null = null;

function enterDelay(id: number): number {
  if (introDelays === null) {
    const step = Math.min(90, 1800 / boardMessages.value.length);
    introDelays = new Map(boardMessages.value.map((message, index) => [message.id, Math.round(index * step)]));
  }
  return introDelays.get(id) ?? 0;
}

function isMessageBusy(message: GuestbookMessage): boolean {
  if (props.mutatingId === null) return false;
  return props.mutatingId === message.id
    || message.replies.some(reply => reply.id === props.mutatingId);
}
</script>

<template>
  <div class="guestbook-board" aria-live="polite">
    <!-- 骨架屏 -->
    <template v-if="showSkeleton">
      <div
        v-for="(note, noteIndex) in skeletonNotes"
        :key="noteIndex"
        class="guestbook-board__skeleton-note"
        aria-hidden="true"
        :style="{
          left: `calc(${note.x / 100} * (100% - min(${note.width}px, 86%)))`,
          top: `${note.y}%`,
          width: `min(${note.width}px, 86%)`,
          transform: `rotate(${note.rotate}deg)`,
        }"
      >
        <div class="guestbook-board__skeleton-head">
          <span class="guestbook-board__skeleton-avatar" />
          <span class="guestbook-board__skeleton-line guestbook-board__skeleton-line--name" />
        </div>
        <span
          v-for="(width, lineIndex) in note.lines"
          :key="lineIndex"
          class="guestbook-board__skeleton-line"
          :style="{ width: `${width}%` }"
        />
      </div>
    </template>

    <!-- 错误状态 -->
    <div v-else-if="loadError !== null" class="guestbook-board__state guestbook-board__state--error" role="alert">
      <h2>留言板没有加载完成</h2>
      <p>{{ loadError }}</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="messages !== null && messages.length === 0" class="guestbook-board__state">
      <h2>还没有留言</h2>
      <p>写下第一句话，打个招呼吧。</p>
    </div>

    <!-- 便签散落铺满整个留言板，留言多时自然叠成一堆 -->
    <template v-else>
      <GuestbookItem
        v-for="message in boardMessages"
        :key="message.id"
        :message="message"
        :enter-delay="enterDelay(message.id)"
        :owner-mode="ownerMode"
        :busy="isMessageBusy(message)"
        :actions-disabled="mutatingId !== null || submittingReply"
        :reply-open="replyTargetId === message.id"
        :submitting-reply="submittingReply"
        @open-reply="emit('openReply', message.id)"
        @close-reply="emit('closeReply')"
        @submit-reply="emit('reply', message.id, $event)"
        @set-status="(id, status) => emit('setStatus', id, status)"
        @set-pinned="(id, pinned) => emit('setPinned', id, pinned)"
        @remove="id => emit('remove', id)"
      />
    </template>
  </div>
</template>

<style scoped>
/* 独立层叠上下文：便签的大 z-index 只在留言板内部比较 */
.guestbook-board {
  position: relative;
  flex: 1 1 auto;
  min-height: 30rem;
  isolation: isolate;
}

.guestbook-board__skeleton-note {
  position: absolute;
  display: grid;
  align-content: start;
  gap: 0.6rem;
  padding: 1.3rem 1.1rem 1.1rem;
  background: #f4ecd8;
  box-shadow:
    0 1px 1px rgb(40 25 10 / 10%),
    0 8px 18px -10px rgb(40 25 10 / 24%);
  opacity: 0.7;
}

.guestbook-board__skeleton-head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.25rem;
}

.guestbook-board__skeleton-avatar {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: rgb(110 75 35 / 14%);
  animation: guestbook-skeleton-pulse 1.4s ease-in-out infinite;
}

.guestbook-board__skeleton-line {
  height: 0.7rem;
  border-radius: 999px;
  background: rgb(110 75 35 / 14%);
  animation: guestbook-skeleton-pulse 1.4s ease-in-out infinite;
}

.guestbook-board__skeleton-line--name {
  flex: 1 1 auto;
  height: 0.8rem;
  width: 40%;
}

/* 状态卡片居中放在留言板上 */
.guestbook-board__state {
  position: absolute;
  top: 38%;
  left: 50%;
  display: grid;
  width: min(360px, calc(100% - 2rem));
  gap: 0.65rem;
  padding: 1.6rem 1.5rem;
  background: #f4ecd8;
  box-shadow:
    0 1px 1px rgb(40 25 10 / 12%),
    0 12px 28px -14px rgb(40 25 10 / 30%);
  color: #2f251c;
  text-align: center;
  transform: translate(-50%, -50%) rotate(-2deg);
}

.guestbook-board__state h2,
.guestbook-board__state p {
  margin: 0;
}

.guestbook-board__state h2 {
  font-family: var(--font-serif);
  font-size: 1.15rem;
}

.guestbook-board__state p {
  color: #7a6a58;
  font-size: 0.84rem;
  line-height: 1.7;
}

.guestbook-board__state--error h2,
.guestbook-board__state--error p {
  color: #9c2f2a;
}

@keyframes guestbook-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guestbook-board__skeleton-avatar,
  .guestbook-board__skeleton-line {
    animation: none;
  }
}
</style>
