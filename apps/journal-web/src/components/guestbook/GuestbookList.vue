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

// rank 决定便签从上到下的位置：置顶在最前，其余从新到旧；sequence 是从留言板底部往上数的序号，决定左右位置，
// 新留言插在置顶下面时，它下面的便签 sequence 不变，不会左右挪动。
// DOM 按 id 固定排序，增删改和置顶只改位置，不会重建已有便签
const boardNotes = computed(() => {
  if (props.messages === null) return [];
  const count = props.messages.length;
  const rankById = new Map([...props.messages]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id)
    .map((message, rank) => [message.id, rank]));
  return [...props.messages]
    .sort((a, b) => a.id - b.id)
    .map((message) => {
      const rank = rankById.get(message.id)!;
      return { message, rank, sequence: count - 1 - rank };
    });
});

// 首次铺开时最上面的一批便签从上往下逐条钉上来，下面的直接就位，避免上百张便签同时做动画；
// 之后新增的留言立即入场
const introNoteCount = 24;
let introDelays: ReadonlyMap<number, number | null> | null = null;

function enterDelay(id: number): number | null {
  if (introDelays === null) {
    const step = Math.min(90, 1800 / Math.min(introNoteCount, boardNotes.value.length));
    introDelays = new Map(boardNotes.value.map(({ message, rank }) => [
      message.id,
      rank < introNoteCount ? Math.round(rank * step) : null,
    ]));
  }
  const delay = introDelays.get(id);
  return delay === undefined ? 0 : delay;
}

function isMessageBusy(message: GuestbookMessage): boolean {
  if (props.mutatingId === null) return false;
  return props.mutatingId === message.id
    || message.replies.some(reply => reply.id === props.mutatingId);
}
</script>

<template>
  <div class="guestbook-board" :style="{ '--count': boardNotes.length }" aria-live="polite">
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

    <!-- 便签从上到下散落，留言多时留言板跟着变高 -->
    <template v-else>
      <GuestbookItem
        v-for="{ message, sequence, rank } in boardNotes"
        :key="message.id"
        :message="message"
        :sequence="sequence"
        :rank="rank"
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
/* 留言多时留言板跟着变高：每排约 --cols 张便签、排高 --band，叠放密度不随留言数量增加。
   断点按留言板实际宽度约 290px 一列折算（宽屏左侧有 180px 侧栏）。
   独立层叠上下文：便签的大 z-index 只在留言板内部比较 */
.guestbook-board {
  --cols: 1;
  --band: 210px;
  /* 每张便签在自己那一排里上下随机错开的幅度 */
  --drift-span: calc(0.3 * var(--band));
  position: relative;
  flex: 1 1 auto;
  min-height: max(30rem, calc(var(--count) / var(--cols) * var(--band) + var(--drift-span) + 16rem));
  isolation: isolate;
}

@media (min-width: 600px) {
  .guestbook-board {
    --cols: 2;
    --band: 170px;
  }
}

@media (min-width: 1050px) {
  .guestbook-board {
    --cols: 3;
  }
}

@media (min-width: 1340px) {
  .guestbook-board {
    --cols: 4;
  }
}

@media (min-width: 1630px) {
  .guestbook-board {
    --cols: 5;
  }
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
  background: #f7f2e4;
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
