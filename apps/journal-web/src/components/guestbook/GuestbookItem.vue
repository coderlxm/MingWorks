<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue';
import { useDraggable } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useSiteProfileStore } from '../../stores/siteProfile';
import { formatEntryTime } from '../../utils/formatters';
import JournalCommentForm from '../interaction/JournalCommentForm.vue';
import type {
  GuestbookMessage,
  GuestbookStatus,
} from '../../../../../src/shared/guestbookProtocol';

const props = withDefaults(defineProps<{
  message: GuestbookMessage;
  // 从留言板底部往上数的序号，决定左右位置
  sequence: number;
  // 在留言板上从上到下的次序：置顶在前，其余从新到旧
  rank: number;
  // null：首屏靠下的便签，直接就位，不做入场动画
  enterDelay: number | null;
  ownerMode: boolean;
  busy: boolean;
  actionsDisabled?: boolean;
  replyOpen: boolean;
  submittingReply: boolean;
}>(), {
  actionsDisabled: false,
});

const emit = defineEmits<{
  openReply: [];
  closeReply: [];
  submitReply: [content: string];
  setStatus: [id: number, status: GuestbookStatus];
  setPinned: [id: number, pinned: boolean];
  remove: [id: number];
}>();

const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);
const confirmingDeletionId = shallowRef<number | null>(null);

const isHidden = computed(() => 'status' in props.message && props.message.status === 'hidden');
const avatarCharacter = computed(() => {
  const characters = [...props.message.authorName.trim()];
  return characters.length > 0 ? characters[0]! : '?';
});
const avatarPaletteIndex = computed(() => {
  const characters = [...props.message.authorName.trim()];
  const total = characters.reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return total % 6;
});
const ownerAvatar = computed(() => (profile.value ? profile.value.avatarUrl : null));
// 由 id 生成稳定的伪随机数，同一张便签每次渲染的位置、角度和颜色都一致
function scatter(seed: number): number {
  const value = Math.sin(props.message.id * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// 横向位置取黄金分割序列：配合按 rank 均匀下移的纵向位置，铺出接近斐波那契点阵的均匀分布
function spread(): number {
  const value = 0.5 + props.sequence * 0.6180339887;
  return value - Math.floor(value);
}

const dragOffset = shallowRef({ x: 0, y: 0 });

const noteStyle = computed(() => ({
  '--x': spread().toFixed(4),
  '--rank': props.rank,
  '--drift': scatter(2).toFixed(4),
  '--rotate': `${(scatter(1) * 14 - 7).toFixed(2)}deg`,
  '--width': `${Math.round(220 + scatter(4) * 80)}px`,
  '--pin-x': `${Math.round(30 + scatter(5) * 40)}%`,
  '--stain-x': `${Math.round(15 + scatter(9) * 70)}%`,
  '--stain-y': `${Math.round(30 + scatter(10) * 60)}%`,
  '--stain-alpha': scatter(11) > 0.55 ? 0.16 : 0,
  '--layer': props.rank,
  '--enter-delay': `${props.enterDelay ?? 0}ms`,
  '--drag-x': `${dragOffset.value.x}px`,
  '--drag-y': `${dragOffset.value.y}px`,
  '--drag-tilt': `${Math.max(-12, Math.min(12, dragOffset.value.x / 18)).toFixed(2)}deg`,
}));
const tone = computed(() => Math.floor(scatter(7) * 5));

// 便签可以随手拖着玩，松手后偏移清零，由 CSS 过渡弹回原位
const noteElement = useTemplateRef<HTMLElement>('note');
const dragging = shallowRef(false);
let dragOrigin = { x: 0, y: 0 };

useDraggable(noteElement, {
  preventDefault: true,
  onStart(_, event) {
    if ((event.target as Element).closest('button, a, input, textarea, form')) return false;
    dragOrigin = { x: event.clientX, y: event.clientY };
    dragging.value = true;
  },
  onMove(_, event) {
    dragOffset.value = { x: event.clientX - dragOrigin.x, y: event.clientY - dragOrigin.y };
  },
  onEnd() {
    dragging.value = false;
    dragOffset.value = { x: 0, y: 0 };
  },
});
const pinTone = computed(() => (props.message.pinned ? 0 : Math.floor(scatter(8) * 3)));

function replyCharacter(replyAuthorName: string): string {
  const characters = [...replyAuthorName.trim()];
  return characters.length > 0 ? characters[0]! : '?';
}

function replyPaletteIndex(replyAuthorName: string): number {
  const characters = [...replyAuthorName.trim()];
  const total = characters.reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return total % 6;
}

function isReplyHidden(reply: { status?: string }): boolean {
  return reply.status === 'hidden';
}

function requestDeletion(id: number): void {
  confirmingDeletionId.value = id;
}

function cancelDeletion(): void {
  confirmingDeletionId.value = null;
}

function confirmDeletion(): void {
  const id = confirmingDeletionId.value;
  confirmingDeletionId.value = null;
  if (id !== null) emit('remove', id);
}
</script>

<template>
  <article
    ref="note"
    class="guestbook-note"
    :class="[`guestbook-note--tone-${tone}`, {
      'guestbook-note--hidden': isHidden,
      'guestbook-note--pinned': message.pinned,
      'guestbook-note--busy': busy,
      'guestbook-note--replying': replyOpen,
      'guestbook-note--dragging': dragging,
      'guestbook-note--settled': enterDelay === null,
    }]"
    :style="noteStyle"
    :aria-busy="busy"
    tabindex="0"
  >
    <span class="guestbook-note__pin" :class="`guestbook-note__pin--${pinTone}`" aria-hidden="true" />

    <!-- 便签头部：头像 + 作者 / 标记 + 时间 -->
    <header class="guestbook-note__header">
      <span
        class="guestbook-note__avatar"
        :class="`guestbook-note__avatar--${avatarPaletteIndex}`"
        aria-hidden="true"
      >{{ avatarCharacter }}</span>

      <div class="guestbook-note__meta">
        <div class="guestbook-note__title-row">
          <span class="guestbook-note__author">{{ message.authorName }}</span>
          <span v-if="message.pinned" class="guestbook-note__pinned">置顶</span>
          <span v-if="ownerMode && isHidden" class="guestbook-note__hidden-mark">已隐藏</span>
        </div>
        <time class="guestbook-note__time" :datetime="message.createdAt">{{ formatEntryTime(message.createdAt) }}</time>
      </div>
    </header>

    <!-- 删除确认提示 -->
    <div
      v-if="ownerMode && confirmingDeletionId === message.id"
      class="guestbook-note__confirm"
      role="alert"
    >
      <span>永久删除这条留言及其回复？</span>
      <button
        type="button"
        class="guestbook-note__action"
        :disabled="actionsDisabled"
        @click="cancelDeletion"
      >
        取消
      </button>
      <button
        type="button"
        class="guestbook-note__action guestbook-note__action--danger"
        :disabled="actionsDisabled"
        @click="confirmDeletion"
      >
        确认删除
      </button>
    </div>

    <!-- 留言正文 -->
    <div class="guestbook-note__content" v-html="message.contentHtml" />

    <!-- 博主回复 -->
    <div v-if="message.replies.length > 0" class="guestbook-note__replies">
      <article
        v-for="reply in message.replies"
        :key="reply.id"
        class="guestbook-reply"
        :class="{ 'guestbook-reply--hidden': isReplyHidden(reply) }"
      >
        <header class="guestbook-reply__header">
          <img
            v-if="ownerAvatar"
            class="guestbook-reply__avatar guestbook-reply__avatar--profile"
            :src="ownerAvatar"
            alt=""
            width="20"
            height="20"
          >
          <span
            v-else
            class="guestbook-reply__avatar"
            :class="`guestbook-reply__avatar--${replyPaletteIndex(reply.authorName)}`"
            aria-hidden="true"
          >{{ replyCharacter(reply.authorName) }}</span>

          <span class="guestbook-reply__author">{{ reply.authorName }}</span>
          <span class="guestbook-reply__badge">博主</span>
          <span
            v-if="ownerMode && isReplyHidden(reply)"
            class="guestbook-reply__hidden-mark"
          >已隐藏</span>
          <time class="guestbook-reply__time" :datetime="reply.createdAt">{{ formatEntryTime(reply.createdAt) }}</time>

          <div v-if="ownerMode" class="guestbook-reply__actions">
            <button
              type="button"
              class="guestbook-note__action"
              :disabled="actionsDisabled"
              @click="emit('setStatus', reply.id, isReplyHidden(reply) ? 'published' : 'hidden')"
            >
              {{ isReplyHidden(reply) ? '恢复' : '隐藏' }}
            </button>
            <button
              v-if="confirmingDeletionId !== reply.id"
              type="button"
              class="guestbook-note__action guestbook-note__action--danger"
              :disabled="actionsDisabled"
              @click="requestDeletion(reply.id)"
            >
              删除
            </button>
          </div>
        </header>

        <div
          v-if="confirmingDeletionId === reply.id"
          class="guestbook-note__confirm"
          role="alert"
        >
          <span>永久删除这条回复？</span>
          <button
            type="button"
            class="guestbook-note__action"
            :disabled="actionsDisabled"
            @click="cancelDeletion"
          >
            取消
          </button>
          <button
            type="button"
            class="guestbook-note__action guestbook-note__action--danger"
            :disabled="actionsDisabled"
            @click="confirmDeletion"
          >
            确认删除
          </button>
        </div>

        <div class="guestbook-note__content guestbook-reply__content" v-html="reply.contentHtml" />
      </article>
    </div>

    <!-- 底部操作（博主模式） -->
    <footer
      v-if="ownerMode && confirmingDeletionId !== message.id"
      class="guestbook-note__actions"
    >
      <button
        type="button"
        class="guestbook-note__action"
        :disabled="actionsDisabled"
        @click="replyOpen ? emit('closeReply') : emit('openReply')"
      >
        {{ replyOpen ? '取消' : '回复' }}
      </button>
      <button
        type="button"
        class="guestbook-note__action"
        :disabled="actionsDisabled"
        @click="emit('setPinned', message.id, !message.pinned)"
      >
        {{ message.pinned ? '取消置顶' : '置顶' }}
      </button>
      <button
        type="button"
        class="guestbook-note__action"
        :disabled="actionsDisabled"
        @click="emit('setStatus', message.id, isHidden ? 'published' : 'hidden')"
      >
        {{ isHidden ? '恢复' : '隐藏' }}
      </button>
      <button
        type="button"
        class="guestbook-note__action guestbook-note__action--danger"
        :disabled="actionsDisabled"
        @click="requestDeletion(message.id)"
      >
        删除
      </button>
    </footer>

    <!-- 回复输入框 -->
    <JournalCommentForm
      v-if="replyOpen"
      class="guestbook-note__reply-form"
      mode="owner"
      context="guestbook"
      :busy="submittingReply"
      :disabled="actionsDisabled"
      :reply-to-name="message.authorName"
      @submit="emit('submitReply', $event.content)"
    />
  </article>
</template>

<style scoped>
/* 便签按 rank 从上到下散落，上下再随机错开一点；靠下的压住上面那张的底边，图钉和作者都露在外面。
   悬停、聚焦或回复时摆正并浮到最上层 */
.guestbook-note {
  /* 旧纸在亮暗主题下都保持纸色，内部改用一套固定的墨色变量，回复框等子组件随之一致 */
  --paper: #f7f2e4;
  --ink: #2b2118;
  --text-primary: #2f251c;
  --text-muted: #7a6a58;
  --surface-card: #fbf6ea;
  --surface-muted: rgb(110 75 35 / 10%);
  --border-subtle: rgb(90 60 30 / 16%);
  --border-strong: rgb(90 60 30 / 30%);
  --accent: #a8443c;
  --accent-strong: #8a3029;
  --accent-soft: rgb(168 68 60 / 13%);
  --danger: #9c2f2a;
  --danger-soft: rgb(156 47 42 / 10%);
  --focus: #8a3029;
  --tooth: 10px;
  --paper-dim: transparent;
  --note-width: min(var(--width), 86%);
  position: absolute;
  top: calc(1.5rem + var(--rank) / var(--count) * (100% - 16rem - var(--drift-span)) + var(--drift) * var(--drift-span));
  left: calc(1rem + var(--x) * (100% - var(--note-width) - 2rem));
  z-index: var(--layer);
  display: flex;
  width: var(--note-width);
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.4rem 1.2rem 1.1rem;
  color: var(--text-primary);
  color-scheme: light;
  overflow-wrap: anywhere;
  cursor: grab;
  touch-action: none;
  transform: translate(0, 0) rotate(var(--rotate)) scale(1);
  transform-origin: var(--pin-x) 0;
  /* 各状态用同一组 translate/rotate/scale；离开拖拽或悬停后延迟降回原层级，弹回途中仍压在最上面 */
  transition:
    transform 640ms cubic-bezier(0.34, 1.45, 0.64, 1),
    z-index 0s 640ms;
  animation: guestbook-note-rise 820ms cubic-bezier(0.2, 0.9, 0.25, 1) var(--enter-delay) backwards;
}

/* 投影单独一层，用 box-shadow 而不是 drop-shadow 滤镜：上百张便签叠在一起时，滤镜的离屏绘制会拖慢每次重绘。
   投影框缩进半个齿深，落在锯齿根部，看起来仍是贴着锯齿的投影 */
.guestbook-note::after {
  position: absolute;
  inset: calc(var(--tooth) / 2);
  z-index: -2;
  box-shadow: 0 1px 1px rgb(40 25 10 / 16%), 0 7px 9px rgb(40 25 10 / 16%);
  content: '';
  transition: box-shadow 320ms ease;
}

/* 纸张层：花边剪刀式的锯齿四边，叠加纸纹颗粒、泛黄边缘和偶尔一圈咖啡渍 */
.guestbook-note::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(var(--paper-dim) 0 0),
    radial-gradient(circle 46px at var(--stain-x) var(--stain-y), rgb(150 105 45 / calc(var(--stain-alpha) * 0.35)) 0 38px, rgb(130 85 35 / var(--stain-alpha)) 40px 42px, transparent 45px),
    radial-gradient(ellipse 120% 110% at 50% 45%, transparent 55%, rgb(120 78 28 / 10%) 100%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.36 0 0 0 0 0.26 0 0 0 0 0.14 0 0 0 0.2 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E"),
    var(--paper);
  content: '';
  mask:
    conic-gradient(from 135deg at 50% 0, #0000, #000 1deg 89deg, #0000 90deg) top / var(--tooth) calc(var(--tooth) / 2) round no-repeat,
    conic-gradient(from -45deg at 50% 100%, #0000, #000 1deg 89deg, #0000 90deg) bottom / var(--tooth) calc(var(--tooth) / 2) round no-repeat,
    conic-gradient(from 45deg at 0 50%, #0000, #000 1deg 89deg, #0000 90deg) left / calc(var(--tooth) / 2) var(--tooth) no-repeat round,
    conic-gradient(from 225deg at 100% 50%, #0000, #000 1deg 89deg, #0000 90deg) right / calc(var(--tooth) / 2) var(--tooth) no-repeat round,
    linear-gradient(#000 0 0) center / calc(100% - var(--tooth)) calc(100% - var(--tooth)) no-repeat;
}

.guestbook-note--tone-1 {
  --paper: #f4e9ce;
}

.guestbook-note--tone-2 {
  --paper: #f5eddb;
}

.guestbook-note--tone-3 {
  --paper: #ebebdb;
}

.guestbook-note--tone-4 {
  --paper: #f4e7de;
}

/* 暗色主题下纸面压暗一点，不刺眼 */
:global(html[data-theme='dark'] .guestbook-note) {
  --paper-dim: rgb(0 0 0 / 14%);
}

.guestbook-note--settled,
.guestbook-note--settled .guestbook-note__pin,
.guestbook-note--settled .guestbook-note__pin::after {
  animation: none;
}

.guestbook-note--busy {
  opacity: 0.82;
}

.guestbook-note:hover,
.guestbook-note:focus-within,
.guestbook-note--replying {
  z-index: 1000000;
  transform: translate(0, -8px) rotate(0deg) scale(1.04);
  transition:
    transform 640ms cubic-bezier(0.34, 1.45, 0.64, 1),
    z-index 0s;
}

.guestbook-note:hover::after,
.guestbook-note:focus-within::after,
.guestbook-note--replying::after {
  box-shadow: 0 3px 3px rgb(40 25 10 / 16%), 0 18px 18px rgb(40 25 10 / 22%);
}

/* 拖拽中：跟手移动，不做 transform 过渡；向拖动方向轻微摆动。单独成层，移动时不重绘压在下面的便签 */
.guestbook-note.guestbook-note--dragging {
  z-index: 2000000;
  cursor: grabbing;
  transform: translate(var(--drag-x), var(--drag-y)) rotate(var(--drag-tilt)) scale(1.07);
  transition: z-index 0s;
  will-change: transform;
}

.guestbook-note.guestbook-note--dragging::after {
  box-shadow: 0 6px 6px rgb(40 25 10 / 18%), 0 28px 26px rgb(40 25 10 / 26%);
  transition-duration: 200ms;
}

.guestbook-note:focus {
  outline: none;
}

.guestbook-note:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 4px;
}

/* 隐藏状态：纸张褪成灰白，图钉变灰，正文保持清晰可读 */
.guestbook-note--hidden {
  --paper: #f4f2ed;
}

.guestbook-note--hidden .guestbook-note__avatar {
  opacity: 0.55;
}

/* 图钉 */
.guestbook-note__pin {
  --pin-color: var(--accent);
  --pin-shade: var(--accent-strong);
  position: absolute;
  top: -7px;
  left: var(--pin-x);
  z-index: 1;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 30%, rgb(255 255 255 / 80%) 0 14%, transparent 32%),
    radial-gradient(circle at 50% 50%, var(--pin-color) 0 55%, var(--pin-shade) 100%);
  box-shadow: 0 1px 1px rgb(0 0 0 / 22%), 0 3px 6px -1px rgb(0 0 0 / 30%);
  animation: guestbook-pin-drop 420ms cubic-bezier(0.3, 1.4, 0.5, 1) calc(var(--enter-delay) + 560ms) backwards;
}

.guestbook-note__pin--1 {
  --pin-color: #6b6660;
  --pin-shade: #34302b;
}

.guestbook-note__pin--2 {
  --pin-color: #b8913f;
  --pin-shade: #7a581c;
}

.guestbook-note__pin::after {
  position: absolute;
  inset: -5px;
  border: 1.5px solid var(--pin-color);
  border-radius: 50%;
  opacity: 0;
  content: '';
  animation: guestbook-pin-ripple 560ms ease-out calc(var(--enter-delay) + 800ms) both;
}

.guestbook-note--pinned .guestbook-note__pin {
  top: -8px;
  width: 16px;
  height: 16px;
  margin-left: -8px;
}

.guestbook-note--hidden .guestbook-note__pin {
  filter: grayscale(1);
  opacity: 0.6;
}

/* 头部 */
.guestbook-note__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.guestbook-note__meta {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.guestbook-note__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.4rem;
  min-width: 0;
}

.guestbook-note__author {
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.guestbook-note__time {
  color: var(--text-muted);
  font-size: 0.68rem;
  white-space: nowrap;
}

/* 作者头像与博主头像 */
.guestbook-note__avatar,
.guestbook-reply__avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-family: var(--font-sans);
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.guestbook-note__avatar {
  width: 28px;
  height: 28px;
  font-size: 0.78rem;
}

.guestbook-reply__avatar {
  width: 20px;
  height: 20px;
  font-size: 0.6rem;
}

.guestbook-reply__avatar--profile {
  object-fit: cover;
  border: 1px solid var(--border-strong);
  filter: sepia(0.35);
}

.guestbook-note__avatar--0,
.guestbook-reply__avatar--0 {
  background: #f0e9df;
  color: #785b3a;
}

.guestbook-note__avatar--1,
.guestbook-reply__avatar--1 {
  background: #e2ece4;
  color: #3e6b4e;
}

.guestbook-note__avatar--2,
.guestbook-reply__avatar--2 {
  background: #e3e8f0;
  color: #41577a;
}

.guestbook-note__avatar--3,
.guestbook-reply__avatar--3 {
  background: #f2e3e1;
  color: #8a4943;
}

.guestbook-note__avatar--4,
.guestbook-reply__avatar--4 {
  background: #eee5f2;
  color: #6e487d;
}

.guestbook-note__avatar--5,
.guestbook-reply__avatar--5 {
  background: #e1ebed;
  color: #3b656e;
}

/* 置顶 / 博主 小标签 */
.guestbook-note__pinned,
.guestbook-reply__badge {
  flex: none;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.3;
}

.guestbook-note__hidden-mark,
.guestbook-reply__hidden-mark {
  flex: none;
  color: var(--text-muted);
  font-size: 0.68rem;
}

/* 操作按钮（底部与博主回复头部共用） */
.guestbook-note__actions,
.guestbook-reply__actions {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.1rem;
  opacity: 0;
  transition: opacity 140ms ease;
}

.guestbook-note__actions {
  justify-content: flex-end;
}

.guestbook-note:hover .guestbook-note__actions,
.guestbook-note:focus-within .guestbook-note__actions,
.guestbook-note:hover .guestbook-reply__actions,
.guestbook-note:focus-within .guestbook-reply__actions {
  opacity: 1;
}

@media (hover: none) {
  .guestbook-note__actions,
  .guestbook-reply__actions {
    opacity: 1;
  }
}

.guestbook-note__action {
  padding: 0.25rem 0.4rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  white-space: nowrap;
  transition: color 120ms ease;
}

.guestbook-note__action:hover:not(:disabled) {
  color: var(--text-primary);
}

.guestbook-note__action--danger:hover:not(:disabled) {
  color: var(--danger);
}

.guestbook-note__action:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-radius: 0.35rem;
}

.guestbook-note__action:disabled {
  cursor: default;
  opacity: 0.6;
}

.guestbook-note__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 10px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.76rem;
}

/* 正文：衬线字体，Markdown 排版 */
.guestbook-note__content {
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.7;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.guestbook-note__content :deep(p) {
  margin: 0 0 0.4rem;
}

.guestbook-note__content :deep(p:last-child) {
  margin-bottom: 0;
}

.guestbook-note__content :deep(a) {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.guestbook-note__content :deep(code) {
  padding: 0.1rem 0.35rem;
  border-radius: 0.35rem;
  background: var(--surface-muted);
  font-family: ui-monospace, monospace;
  font-size: 0.84em;
}

.guestbook-note__content :deep(pre) {
  margin: 0.45rem 0;
  padding: 0.55rem 0.75rem;
  border-radius: 0.55rem;
  background: var(--surface-muted);
  font-family: ui-monospace, monospace;
  font-size: 0.82em;
  overflow-x: auto;
}

.guestbook-note__content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.guestbook-note__content :deep(blockquote) {
  margin: 0.45rem 0;
  padding: 0.15rem 0 0.15rem 0.75rem;
  border-left: 2px solid var(--border-strong);
  color: var(--text-muted);
}

.guestbook-note__content :deep(ul),
.guestbook-note__content :deep(ol) {
  margin: 0.45rem 0;
  padding-left: 1.3rem;
}

/* 博主回复：顶部分隔线，无底色 */
.guestbook-note__replies {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.guestbook-reply {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  margin-top: 0.15rem;
  padding-top: 0.7rem;
  border-top: 1px dashed color-mix(in srgb, var(--ink) 14%, transparent);
}

.guestbook-reply--hidden .guestbook-reply__content,
.guestbook-reply--hidden .guestbook-reply__avatar,
.guestbook-reply--hidden .guestbook-reply__author {
  opacity: 0.58;
}

.guestbook-reply__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.45rem;
  min-width: 0;
}

.guestbook-reply__author {
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.guestbook-reply__time {
  flex: none;
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.68rem;
  white-space: nowrap;
}

.guestbook-reply__content {
  font-size: 0.86rem;
  font-weight: 450;
  line-height: 1.65;
}

/* 回复框：不再是卡片，直接写在同一张纸的横线上；选择器前缀 .guestbook-note 用来压过共用表单自身的样式 */
.guestbook-note .guestbook-note__reply-form {
  --rule-color: color-mix(in srgb, var(--ink) 13%, transparent);
  gap: 0.35rem;
  margin-top: 0.15rem;
  padding: 0.7rem 0 0;
  border: 0;
  border-top: 1px dashed color-mix(in srgb, var(--ink) 14%, transparent);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.guestbook-note .guestbook-note__reply-form:focus-within {
  --rule-color: color-mix(in srgb, var(--ink) 24%, transparent);
  border-color: color-mix(in srgb, var(--ink) 14%, transparent);
  box-shadow: none;
}

.guestbook-note .guestbook-note__reply-form :deep(.comment-form__reply-context) {
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.guestbook-note .guestbook-note__reply-form :deep(.comment-form__reply-context::before) {
  content: '↳ ';
}

/* 信纸横线：每行文字落在一条线上，滚动时横线跟着文字走 */
.guestbook-note .guestbook-note__reply-form :deep(.comment-form__content) {
  --rule: 1.6rem;
  min-height: calc(var(--rule) * 3);
  padding: 0 0.1rem;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent calc(var(--rule) - 1px),
    var(--rule-color) calc(var(--rule) - 1px),
    var(--rule-color) var(--rule)
  );
  background-attachment: local;
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 450;
  line-height: var(--rule);
}

.guestbook-note .guestbook-note__reply-form :deep(.comment-form__auxiliary) {
  justify-content: flex-end;
  padding-top: 0.15rem;
  border-top: 0;
}

/* 发送按钮做成红色邮戳：双线框、微斜，按下时像盖章一样压一下 */
.guestbook-note .guestbook-note__reply-form :deep(.comment-form__submit) {
  position: relative;
  min-height: 2rem;
  padding: 0.2rem 0.75rem 0.2rem calc(0.75rem + 0.3em);
  border: 1.5px solid var(--accent);
  border-radius: 3px;
  background: transparent;
  color: var(--accent);
  font-family: var(--font-serif);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  transform: rotate(-4deg);
  transition: transform 220ms cubic-bezier(0.34, 1.45, 0.64, 1), background 160ms ease, opacity 160ms ease;
}

.guestbook-note .guestbook-note__reply-form :deep(.comment-form__submit::after) {
  content: '';
  position: absolute;
  inset: 2px;
  border: 1px solid currentColor;
  border-radius: 2px;
  opacity: 0.5;
  pointer-events: none;
}

.guestbook-note .guestbook-note__reply-form :deep(.comment-form__submit:not(:disabled):hover) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  transform: rotate(-2deg) scale(1.05);
}

.guestbook-note .guestbook-note__reply-form :deep(.comment-form__submit:not(:disabled):active) {
  transform: rotate(-4deg) scale(0.9);
  transition-duration: 80ms;
}

@keyframes guestbook-note-rise {
  0% {
    opacity: 0;
    transform: translate(0, 90px) rotate(calc(var(--rotate) - 12deg)) scale(0.82);
  }

  55% {
    opacity: 1;
    transform: translate(0, -10px) rotate(calc(var(--rotate) + 3deg)) scale(1.03);
  }

  78% {
    opacity: 1;
    transform: translate(0, 3px) rotate(calc(var(--rotate) - 1deg)) scale(0.99);
  }

  100% {
    opacity: 1;
    transform: translate(0, 0) rotate(var(--rotate)) scale(1);
  }
}

@keyframes guestbook-pin-drop {
  0% {
    opacity: 0;
    transform: translateY(-18px) scale(1.6);
    box-shadow: 0 14px 12px -6px rgb(0 0 0 / 12%);
  }

  60% {
    opacity: 1;
    transform: translateY(1px) scale(0.86);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    box-shadow: 0 1px 1px rgb(0 0 0 / 22%), 0 3px 6px -1px rgb(0 0 0 / 30%);
  }
}

@keyframes guestbook-pin-ripple {
  0% {
    opacity: 0.45;
    transform: scale(0.6);
  }

  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

@media (max-width: 599px) {
  .guestbook-note {
    padding: 1.25rem 1rem 1rem;
  }

  .guestbook-note__actions,
  .guestbook-reply__actions {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guestbook-note,
  .guestbook-note__pin,
  .guestbook-note__pin::after {
    animation: none;
  }

  .guestbook-note,
  .guestbook-note::after,
  .guestbook-note__actions,
  .guestbook-reply__actions {
    transition: none;
  }
}
</style>
