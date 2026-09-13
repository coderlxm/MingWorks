<script setup lang="ts" name="ProfileStoryViewer">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { JournalEntry, SiteProfile } from '../../types';
import { resolveJournalMediaType } from '../../utils/journalMedia';
import { stripJournalTags } from '../../utils/journalText';

const props = defineProps<{
  stories: JournalEntry[];
  profile: SiteProfile | null;
}>();

const emit = defineEmits<{
  close: [];
  selectEntry: [entry: JournalEntry];
  finished: [];
}>();

const currentIndex = ref(0);
const progress = ref(0);
const isPaused = ref(false);

const STORY_DURATION_MS = 5000;
const TICK_INTERVAL_MS = 30;
let timerId: ReturnType<typeof setInterval> | null = null;
let pointerDownTime = 0;

const currentStory = computed<JournalEntry | null>(() => props.stories[currentIndex.value] ?? null);

const currentImage = computed(() => {
  if (!currentStory.value) return null;
  return currentStory.value.assets.find(asset => resolveJournalMediaType(asset) === 'image') ?? null;
});

const currentText = computed(() => {
  if (!currentStory.value) return '';
  return stripJournalTags(currentStory.value.contentText, currentStory.value.tags);
});

function formatStoryTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}天前`;
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

function startTimer(): void {
  stopTimer();
  timerId = setInterval(() => {
    if (isPaused.value) return;
    progress.value += (TICK_INTERVAL_MS / STORY_DURATION_MS) * 100;
    if (progress.value >= 100) {
      if (currentIndex.value < props.stories.length - 1) {
        currentIndex.value += 1;
        progress.value = 0;
      } else {
        stopTimer();
        emit('finished');
        emit('close');
      }
    }
  }, TICK_INTERVAL_MS);
}

function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function goToPrev(): void {
  if (progress.value > 25) {
    progress.value = 0;
    return;
  }
  if (currentIndex.value > 0) {
    currentIndex.value -= 1;
    progress.value = 0;
  } else {
    progress.value = 0;
  }
}

function goToNext(): void {
  if (currentIndex.value < props.stories.length - 1) {
    currentIndex.value += 1;
    progress.value = 0;
  } else {
    stopTimer();
    emit('finished');
    emit('close');
  }
}

function handlePointerDown(): void {
  pointerDownTime = Date.now();
  isPaused.value = true;
}

function handlePointerUp(): void {
  isPaused.value = false;
}

function handleTapLeft(event: MouseEvent): void {
  event.stopPropagation();
  if (Date.now() - pointerDownTime > 280) return;
  goToPrev();
}

function handleTapRight(event: MouseEvent): void {
  event.stopPropagation();
  if (Date.now() - pointerDownTime > 280) return;
  goToNext();
}

function handleViewDetail(event: MouseEvent): void {
  event.stopPropagation();
  if (!currentStory.value) return;
  emit('selectEntry', currentStory.value);
  emit('close');
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close');
  } else if (event.key === 'ArrowLeft') {
    goToPrev();
  } else if (event.key === 'ArrowRight') {
    goToNext();
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', handleKeydown);
  startTimer();
});

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', handleKeydown);
  stopTimer();
});
</script>

<template>
  <Teleport to="body">
    <div class="story-overlay" role="dialog" aria-modal="true" aria-label="近期动态快拍" @click="emit('close')">
      <!-- Desktop prev arrow -->
      <button
        v-if="currentIndex > 0"
        type="button"
        class="story-arrow story-arrow--prev"
        aria-label="上一条动态"
        @click.stop="goToPrev"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <!-- Main story card -->
      <div
        class="story-card"
        @click.stop
        @mousedown="handlePointerDown"
        @mouseup="handlePointerUp"
        @touchstart.passive="handlePointerDown"
        @touchend.passive="handlePointerUp"
      >
        <!-- Top controls & progress -->
        <div class="story-card__top">
          <!-- Segmented progress bars -->
          <div class="story-progress-group">
            <div
              v-for="(_, index) in stories"
              :key="index"
              class="story-progress-bar"
            >
              <div
                class="story-progress-bar__fill"
                :style="{
                  width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%',
                }"
              />
            </div>
          </div>

          <!-- Author info & close button -->
          <div class="story-header">
            <div class="story-header__author">
              <img
                v-if="profile?.avatarUrl"
                :src="profile.avatarUrl"
                alt="小明同学"
                class="story-header__avatar"
              >
              <div class="story-header__meta">
                <span class="story-header__name">小明同学</span>
                <span class="story-header__dot">·</span>
                <span v-if="currentStory" class="story-header__badge">
                  {{ currentStory.channel === 'interest' ? '兴趣' : '生活' }}
                </span>
                <span v-if="currentStory" class="story-header__dot">·</span>
                <span v-if="currentStory" class="story-header__time">
                  {{ formatStoryTime(currentStory.sourceCreatedAt || currentStory.capturedAt) }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="story-header__close"
              aria-label="关闭快拍"
              @click.stop="emit('close')"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Left / Right Tap Zones -->
        <div class="story-tap story-tap--left" @click="handleTapLeft" />
        <div class="story-tap story-tap--right" @click="handleTapRight" />

        <!-- Story Visual Content -->
        <div v-if="currentStory" class="story-content">
          <!-- Image post style -->
          <template v-if="currentImage">
            <img
              :src="currentImage.url"
              alt="动态配图背景"
              class="story-media__blur-bg"
              aria-hidden="true"
            >
            <img
              :src="currentImage.url"
              alt="近期动态配图"
              class="story-media__main"
            >
            <div v-if="currentText || currentStory.title" class="story-caption-overlay">
              <h3 v-if="currentStory.title" class="story-caption__title">{{ currentStory.title }}</h3>
              <p v-if="currentText" class="story-caption__text">{{ currentText }}</p>
            </div>
          </template>

          <!-- Text post poster style -->
          <template v-else>
            <div class="story-text-poster">
              <div class="story-text-poster__aura" aria-hidden="true" />
              <div class="story-text-poster__tags">
                <span v-for="tag in currentStory.tags" :key="tag" class="story-text-poster__tag">
                  #{{ tag }}
                </span>
                <span v-if="!currentStory.tags.length" class="story-text-poster__tag">
                  #{{ currentStory.channel === 'interest' ? '兴趣探索' : '生活随记' }}
                </span>
              </div>
              <h3 v-if="currentStory.title" class="story-text-poster__title">
                {{ currentStory.title }}
              </h3>
              <div class="story-text-poster__body">
                {{ currentText }}
              </div>
            </div>
          </template>
        </div>

        <!-- Bottom Action CTA -->
        <div class="story-card__footer">
          <button
            type="button"
            class="story-detail-btn"
            @click="handleViewDetail"
          >
            <span>查看完整记录</span>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Desktop next arrow -->
      <button
        type="button"
        class="story-arrow story-arrow--next"
        aria-label="下一条动态"
        @click.stop="goToNext"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.story-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 12, 14, 0.88);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  user-select: none;
  animation: story-fade-in 0.22s ease-out;
}

@keyframes story-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.story-card {
  position: relative;
  width: min(420px, 92vw);
  height: min(740px, 90vh);
  background: #151518;
  border-radius: 20px;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Top Bar: Progress + Header */
.story-card__top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 14px 16px 36px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.25) 65%, transparent 100%);
  pointer-events: none;
}

.story-progress-group {
  display: flex;
  gap: 4px;
  width: 100%;
  margin-bottom: 12px;
}

.story-progress-bar {
  flex: 1;
  height: 2.5px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.32);
  overflow: hidden;
}

.story-progress-bar__fill {
  height: 100%;
  background: #ffffff;
  transition: width 0.04s linear;
}

.story-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.story-header__author {
  display: flex;
  align-items: center;
  gap: 8px;
}

.story-header__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.story-header__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.story-header__name {
  color: #ffffff;
  font-family: var(--font-serif);
  font-size: 0.94rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.story-header__badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.story-header__dot {
  color: rgba(255, 255, 255, 0.5);
}

.story-header__time {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.8rem;
  font-weight: 400;
}

.story-header__close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.18s ease, transform 0.18s ease;
}

.story-header__close:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: scale(1.08);
}

/* Tap areas */
.story-tap {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 10;
  cursor: pointer;
}

.story-tap--left {
  left: 0;
  width: 32%;
}

.story-tap--right {
  right: 0;
  width: 68%;
}

/* Content Area */
.story-content {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0e0e11;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Photo style */
.story-media__blur-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(28px) brightness(0.6);
  transform: scale(1.15);
  pointer-events: none;
}

.story-media__main {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.story-caption-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 5;
  padding: 30px 20px 72px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.45) 60%, transparent 100%);
  pointer-events: none;
}

.story-caption__title {
  margin: 0 0 6px;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.story-caption__text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Text Poster style */
.story-text-poster {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 90px 26px 84px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: radial-gradient(circle at 50% 25%, #2a2238 0%, #15131b 60%, #0d0c11 100%);
  box-sizing: border-box;
}

.story-text-poster__aura {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(220, 39, 67, 0.22) 0%, rgba(240, 148, 51, 0.12) 50%, transparent 70%);
  filter: blur(32px);
  pointer-events: none;
}

.story-text-poster__tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 20px;
  position: relative;
  z-index: 2;
}

.story-text-poster__tag {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #f7a072;
  background: rgba(247, 160, 114, 0.14);
  padding: 3px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(247, 160, 114, 0.25);
}

.story-text-poster__title {
  margin: 0 0 14px;
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 750;
  color: #ffffff;
  line-height: 1.35;
  position: relative;
  z-index: 2;
}

.story-text-poster__body {
  font-family: var(--font-serif);
  font-size: 1.12rem;
  line-height: 1.75;
  color: #ede9e1;
  max-height: 60%;
  overflow-y: auto;
  position: relative;
  z-index: 2;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

/* Bottom CTA button */
.story-card__footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 16px 20px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.story-detail-btn {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.26);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.story-detail-btn:hover {
  background: rgba(255, 255, 255, 0.26);
  transform: translateY(-1.5px);
}

/* Desktop Arrow Buttons */
.story-arrow {
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 46px;
  height: 46px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffffff;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, transform 0.18s ease;
  z-index: 2005;
}

.story-arrow:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-50%) scale(1.08);
}

.story-arrow--prev {
  left: max(16px, calc(50% - 210px - 64px));
}

.story-arrow--next {
  right: max(16px, calc(50% - 210px - 64px));
}

@media (min-width: 600px) {
  .story-arrow {
    display: flex;
  }
}

@media (max-width: 599px) {
  .story-card {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    border-radius: 0;
    box-shadow: none;
  }

  .story-card__top {
    padding-top: max(14px, env(safe-area-inset-top));
  }

  .story-card__footer {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}
</style>
