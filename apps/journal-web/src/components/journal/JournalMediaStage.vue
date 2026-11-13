<script lang="ts">
let preferredMuted = true;
let preferredVolume = 1;
let lastAudibleVolume = 1;
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, shallowRef, useTemplateRef } from 'vue';
import type { CSSProperties } from 'vue';
import type { JournalAsset } from '../../types';
import { formatMediaDuration } from '../../utils/formatters';
import { resolveJournalMediaType } from '../../utils/journalMedia';
import { mountJournalVideo, releaseJournalVideo } from '../../utils/journalVideoPlayerPool';

const props = defineProps<{ assets: readonly JournalAsset[] }>();
const emit = defineEmits<{ aspectRatioChange: [aspectRatio: number | null] }>();
type StageAsset = JournalAsset & { mediaType: 'image' | 'video' };
type SafariVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

const stage = useTemplateRef<HTMLElement>('stage');
const viewport = useTemplateRef<HTMLElement>('viewport');
const currentIndex = shallowRef(0);
const videoReady = shallowRef(false);
const videoPlaying = shallowRef(false);
const videoMuted = shallowRef(true);
const videoVolume = shallowRef(1);
const videoCurrentTime = shallowRef(0);
const videoDuration = shallowRef(0);
const videoError = shallowRef<string | null>(null);
const controlError = shallowRef<string | null>(null);
const fullscreen = shallowRef(false);
let currentMountedVideo: SafariVideo | null = null;
let currentMountedUrl: string | null = null;
let currentVideoHost: HTMLElement | null = null;
let lastAspectRatio: number | null | undefined;
let surfaceClickTimer: ReturnType<typeof setTimeout> | null = null;

const stageAssets = computed<StageAsset[]>(() => props.assets.map(asset => ({
  ...asset,
  mediaType: resolveJournalMediaType(asset) === 'video' ? 'video' : 'image',
})));
const currentAsset = computed(() => stageAssets.value[currentIndex.value]);
const positionLabel = computed(() => `${currentIndex.value + 1} / ${stageAssets.value.length}`);
const currentAdaptiveAspectRatio = computed(() => {
  const asset = currentAsset.value;
  if (!asset || asset.kind === 'sticker' || asset.kind === 'video_note' || !asset.width || !asset.height) return null;
  const ratio = asset.width / asset.height;
  return ratio >= 0.45 && ratio <= 2.2 ? ratio : null;
});
const stageStyle = computed<CSSProperties>(() => currentAdaptiveAspectRatio.value
  ? { '--media-stage-aspect-ratio': String(currentAdaptiveAspectRatio.value) }
  : {});
const currentAssetFullBleed = computed(() => currentAdaptiveAspectRatio.value !== null);
const displayDuration = computed(() => videoDuration.value > 0 ? videoDuration.value : (currentAsset.value?.duration ?? 0));
const timelineLabel = computed(() => `${formatMediaDuration(videoCurrentTime.value)} / ${formatMediaDuration(displayDuration.value)}`);
const videoProgressStyle = computed(() => ({
  '--video-progress': `${displayDuration.value > 0 ? (videoCurrentTime.value / displayDuration.value) * 100 : 0}%`,
}));

function notifyAspectRatio(): void {
  const ratio = currentAdaptiveAspectRatio.value;
  if (lastAspectRatio === ratio) return;
  lastAspectRatio = ratio;
  emit('aspectRatioChange', ratio);
}

function handleVideoReady(): void { videoReady.value = true; }
function handleVideoPlay(): void { videoPlaying.value = true; controlError.value = null; }
function handleVideoPause(): void { videoPlaying.value = false; }
function handleVideoTimelineChange(): void {
  const video = currentMountedVideo!;
  videoCurrentTime.value = video.currentTime;
  videoDuration.value = Number.isFinite(video.duration) ? video.duration : 0;
}
function handleVolumeChange(): void {
  const video = currentMountedVideo!;
  videoMuted.value = video.muted;
  videoVolume.value = video.volume;
  preferredMuted = video.muted;
  preferredVolume = video.volume;
  if (video.volume > 0) lastAudibleVolume = video.volume;
}
function handleVideoError(): void {
  const video = currentMountedVideo!;
  videoPlaying.value = false;
  videoReady.value = false;
  const code = video.error?.code;
  const reason = video.error?.message;
  videoError.value = `视频加载失败${code ? `（错误 ${code}${reason ? `：${reason}` : ''}）` : ''}。`
    + (currentAsset.value?.sourceKind === 'drive'
      ? '请确认云盘原文件仍可访问且未被替换；如有版本冲突，请移除旧附件后重新绑定。'
      : '请检查媒体文件是否可访问。');
}
function syncFullscreen(): void {
  fullscreen.value = (viewport.value !== null && document.fullscreenElement === viewport.value)
    || currentMountedVideo?.webkitDisplayingFullscreen === true;
}
function handleSafariFullscreen(event: Event): void {
  fullscreen.value = event.type === 'webkitbeginfullscreen';
}

const videoEvents: Array<[string, EventListener]> = [
  ['loadeddata', handleVideoReady],
  ['canplay', handleVideoReady],
  ['play', handleVideoPlay],
  ['pause', handleVideoPause],
  ['ended', handleVideoPause],
  ['timeupdate', handleVideoTimelineChange],
  ['durationchange', handleVideoTimelineChange],
  ['loadedmetadata', handleVideoTimelineChange],
  ['volumechange', handleVolumeChange],
  ['error', handleVideoError],
  ['webkitbeginfullscreen', handleSafariFullscreen],
  ['webkitendfullscreen', handleSafariFullscreen],
];

function clearSurfaceClick(): void {
  if (surfaceClickTimer !== null) clearTimeout(surfaceClickTimer);
  surfaceClickTimer = null;
}

function playVideo(video: HTMLVideoElement): void {
  controlError.value = null;
  void video.play().catch((reason: unknown) => {
    if (video !== currentMountedVideo) return;
    videoPlaying.value = false;
    controlError.value = `播放失败：${reason instanceof Error ? reason.message : String(reason)}`;
  });
}

function handleVideoHostMount(container: HTMLElement | null): void {
  const asset = currentAsset.value;
  if (container === currentVideoHost && currentMountedUrl === asset?.url) return;
  clearSurfaceClick();
  if (currentMountedVideo) {
    for (const [event, listener] of videoEvents) currentMountedVideo.removeEventListener(event, listener);
    currentMountedVideo.pause();
    currentMountedVideo.remove();
    currentMountedVideo = null;
  }
  if (currentMountedUrl) releaseJournalVideo(currentMountedUrl);
  currentMountedUrl = null;
  currentVideoHost = container;
  videoReady.value = false;
  videoPlaying.value = false;
  videoCurrentTime.value = 0;
  videoDuration.value = 0;
  videoError.value = null;
  controlError.value = null;
  syncFullscreen();
  if (!container || !asset || asset.mediaType !== 'video') return;

  const video = mountJournalVideo(asset.url, container, { preload: asset.sourceKind === 'drive' ? 'metadata' : 'auto' });
  currentMountedVideo = video;
  currentMountedUrl = asset.url;
  video.controls = false;
  video.autoplay = true;
  video.muted = preferredMuted;
  video.volume = preferredVolume;
  video.playsInline = true;
  video.tabIndex = -1;
  video.poster = asset.previewUrl ?? '';
  videoReady.value = video.readyState >= 2;
  videoPlaying.value = !video.paused && !video.ended;
  handleVideoTimelineChange();
  handleVolumeChange();
  for (const [event, listener] of videoEvents) video.addEventListener(event, listener);
  if (video.error) handleVideoError();
  else playVideo(video);
}

const setVideoHostRef = (element: unknown): void => handleVideoHostMount(element as HTMLElement | null);
function toggleVideoPlayback(): void {
  const video = currentMountedVideo;
  if (!video || videoError.value) return;
  if (video.paused || video.ended) playVideo(video);
  else video.pause();
}
function toggleVideoMuted(): void {
  if (!currentMountedVideo) return;
  if (currentMountedVideo.muted || currentMountedVideo.volume === 0) {
    if (currentMountedVideo.volume === 0) currentMountedVideo.volume = lastAudibleVolume;
    currentMountedVideo.muted = false;
  } else {
    currentMountedVideo.muted = true;
  }
}
function setVolume(event: Event): void {
  if (!currentMountedVideo) return;
  const value = Number((event.currentTarget as HTMLInputElement).value);
  currentMountedVideo.volume = value;
  currentMountedVideo.muted = value === 0;
}
function handleVideoSurfaceClick(event: MouseEvent): void {
  stage.value?.focus({ preventScroll: true });
  if (event.detail > 1) return;
  clearSurfaceClick();
  surfaceClickTimer = setTimeout(() => {
    surfaceClickTimer = null;
    toggleVideoPlayback();
  }, 220);
}
function seekVideo(event: Event): void {
  if (!currentMountedVideo) return;
  currentMountedVideo.currentTime = Number((event.currentTarget as HTMLInputElement).value);
  handleVideoTimelineChange();
}
async function toggleFullscreen(): Promise<void> {
  controlError.value = null;
  try {
    if (document.fullscreenElement === viewport.value) await document.exitFullscreen();
    else if (currentMountedVideo?.webkitDisplayingFullscreen) currentMountedVideo.webkitExitFullscreen!();
    else if (viewport.value?.requestFullscreen && document.fullscreenEnabled) await viewport.value.requestFullscreen();
    else if (currentMountedVideo?.webkitEnterFullscreen) currentMountedVideo.webkitEnterFullscreen();
    else throw new Error('当前浏览器不支持全屏播放。');
  } catch (reason) {
    controlError.value = `全屏切换失败：${reason instanceof Error ? reason.message : String(reason)}`;
  }
}
function handleSurfaceDoubleClick(): void {
  if (currentAsset.value?.mediaType !== 'video') return;
  clearSurfaceClick();
  void toggleFullscreen();
}
function goTo(index: number): void {
  if (index === currentIndex.value) return;
  clearSurfaceClick();
  currentMountedVideo?.pause();
  currentIndex.value = index;
}
function previous(): void { goTo(currentIndex.value - 1); }
function next(): void { goTo(currentIndex.value + 1); }
function handleKeyboard(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.code === 'Space' && currentAsset.value?.mediaType === 'video') {
    if (target.closest('button')) return;
    event.preventDefault();
    if (!event.repeat) toggleVideoPlayback();
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  if (stageAssets.value.length === 1 && currentMountedVideo) {
    if (videoDuration.value <= 0 || videoError.value) return;
    event.preventDefault();
    currentMountedVideo.currentTime = Math.min(videoDuration.value, Math.max(0,
      currentMountedVideo.currentTime + (event.key === 'ArrowLeft' ? -5 : 5)));
    handleVideoTimelineChange();
  } else if (event.key === 'ArrowLeft' && currentIndex.value > 0) {
    event.preventDefault();
    previous();
  } else if (event.key === 'ArrowRight' && currentIndex.value < stageAssets.value.length - 1) {
    event.preventDefault();
    next();
  }
}

onMounted(() => {
  notifyAspectRatio();
  document.addEventListener('fullscreenchange', syncFullscreen);
});
onUpdated(notifyAspectRatio);
onBeforeUnmount(() => {
  clearSurfaceClick();
  document.removeEventListener('fullscreenchange', syncFullscreen);
  handleVideoHostMount(null);
});
</script>

<template>
  <section
    ref="stage"
    class="media-stage"
    :class="{ 'media-stage--adaptive-image': currentAssetFullBleed }"
    :style="stageStyle"
    aria-label="视觉媒体"
    tabindex="0"
    @keydown="handleKeyboard"
  >
    <div v-if="currentAsset" ref="viewport" class="media-stage__viewport" @dblclick="handleSurfaceDoubleClick">
      <div
        :key="currentAsset.id"
        class="media-stage__item"
        :class="{
          'media-stage__item--sticker': currentAsset.kind === 'sticker',
          'media-stage__item--round': currentAsset.kind === 'video_note',
          'media-stage__item--full-bleed': currentAssetFullBleed,
          'media-stage__item--contained': !currentAssetFullBleed,
        }"
      >
        <img v-if="currentAsset.mediaType === 'image'" class="media-stage__media media-stage__image" :src="currentAsset.url" alt="" draggable="false">
        <div
          v-else
          :ref="setVideoHostRef"
          class="media-stage__media media-stage__video-host"
          :class="{ 'media-stage__video-host--ready': videoReady }"
          :aria-busy="!videoReady && !videoError && !controlError"
          @click="handleVideoSurfaceClick"
        />
        <div v-if="currentAsset.mediaType === 'video'" class="media-stage__video-controls" @click.stop @dblclick.stop>
          <input
            class="media-stage__progress"
            type="range"
            min="0"
            :max="displayDuration"
            step="0.1"
            :value="videoCurrentTime"
            :style="videoProgressStyle"
            aria-label="视频进度"
            :disabled="videoDuration <= 0 || !!videoError"
            @input="seekVideo"
          >
          <div class="media-stage__video-toolbar">
            <button class="media-stage__control-button" type="button" :aria-label="videoPlaying ? '暂停视频' : '播放视频'" :disabled="!!videoError" @click="toggleVideoPlayback">
              <svg class="media-stage__control-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path v-if="videoPlaying" d="M8 6v12M16 6v12" />
                <path v-else d="m9 6 9 6-9 6Z" />
              </svg>
            </button>
            <span class="media-stage__time">{{ timelineLabel }}</span>
            <div class="media-stage__volume-group">
              <button class="media-stage__control-button" type="button" :aria-label="videoMuted || videoVolume === 0 ? '打开声音' : '静音'" :aria-pressed="!videoMuted && videoVolume > 0" @click="toggleVideoMuted">
                <svg class="media-stage__control-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                  <path v-if="videoMuted || videoVolume === 0" d="m17 9 4 4m0-4-4 4" />
                  <path v-else d="M16 9.5a4 4 0 0 1 0 5m2.5-7.5a7 7 0 0 1 0 10" />
                </svg>
              </button>
              <input class="media-stage__volume" type="range" min="0" max="1" step="0.05" :value="videoVolume" aria-label="视频音量" @input="setVolume">
            </div>
            <button class="media-stage__control-button" type="button" :aria-label="fullscreen ? '退出全屏' : '全屏播放'" :aria-pressed="fullscreen" @click="toggleFullscreen">
              <svg class="media-stage__control-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path v-if="fullscreen" d="M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5" />
                <path v-else d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5" />
              </svg>
            </button>
          </div>
        </div>
        <div v-if="videoError || controlError" class="media-stage__error" role="alert">{{ videoError || controlError }}</div>
      </div>
    </div>

    <footer v-if="stageAssets.length > 1" class="media-stage__controls">
      <div class="media-stage__pager">
        <button
          class="media-stage__arrow"
          type="button"
          aria-label="上一项媒体"
          :disabled="currentIndex === 0"
          @click="previous"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="media-stage__position" aria-live="polite">{{ positionLabel }}</span>
        <button
          class="media-stage__arrow"
          type="button"
          aria-label="下一项媒体"
          :disabled="currentIndex === stageAssets.length - 1"
          @click="next"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div class="media-stage__thumbnails" aria-label="选择媒体">
        <button
          v-for="(asset, index) in stageAssets"
          :key="asset.id"
          class="media-stage__thumbnail"
          :class="{ 'media-stage__thumbnail--active': index === currentIndex }"
          type="button"
          :aria-label="`查看第 ${index + 1} 项媒体`"
          :aria-current="index === currentIndex ? 'true' : undefined"
          @click="goTo(index)"
        >
          <img :src="asset.previewUrl" alt="" loading="lazy">
          <span v-if="asset.mediaType === 'video'" class="media-stage__video-mark" aria-hidden="true">
            ▶
          </span>
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.media-stage {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
  background: #20201e;
  color: #f7f7f5;
  outline: none;
}

.media-stage:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.media-stage__viewport {
  display: grid;
  min-height: 0;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  overflow: hidden;
}

.media-stage__item {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  overflow: hidden;
  place-items: center;
  animation: media-stage-enter 160ms ease-out;
}

.media-stage__media {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-area: 1 / 1;
  object-fit: contain;
}

.media-stage__item--contained {
  padding: clamp(20px, 3vw, 48px);
}

.media-stage__item--full-bleed .media-stage__media {
  object-fit: contain;
}

.media-stage__video-host {
  pointer-events: none;
  overflow: hidden;
}

.media-stage__video-host--ready {
  pointer-events: auto;
}

.media-stage__video-host :deep(video) {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: inherit;
  border-radius: inherit;
}

.media-stage__video-controls {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  gap: 0.1rem;
  padding: 0.4rem 0.75rem 0.5rem;
  background: linear-gradient(transparent, rgb(0 0 0 / 75%));
  color: #fff;
}

.media-stage__video-toolbar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.media-stage__control-button {
  display: grid;
  flex: none;
  width: 2rem;
  height: 2rem;
  padding: 0.3rem;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  place-items: center;
}

.media-stage__control-button:hover { background: rgb(255 255 255 / 16%); }
.media-stage__control-button:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.media-stage__control-button:disabled { opacity: 0.45; cursor: not-allowed; }
.media-stage__control-icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.media-stage__time { margin-right: auto; font-size: 0.72rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.media-stage__volume-group { display: flex; align-items: center; }
.media-stage__volume { width: 0; min-width: 0; height: 2rem; margin: 0; padding: 0; opacity: 0; accent-color: #fff; }
.media-stage__volume-group:hover .media-stage__volume,
.media-stage__volume-group:focus-within .media-stage__volume { width: 4rem; opacity: 1; }

.media-stage__progress {
  width: 100%;
  min-width: 0;
  height: 1.1rem;
  padding: 0;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.media-stage__error {
  position: absolute;
  z-index: 3;
  top: 1rem;
  right: 1rem;
  left: 1rem;
  max-height: calc(100% - 6rem);
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 6px;
  background: rgb(20 20 20 / 88%);
  color: #fff;
  font-size: 0.8rem;
  line-height: 1.6;
}

.media-stage__progress::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgb(255 255 255 / 92%) 0 var(--video-progress),
    rgb(255 255 255 / 32%) var(--video-progress) 100%
  );
}

.media-stage__progress::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  margin-top: -5px;
  -webkit-appearance: none;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 32%);
}

.media-stage__progress::-moz-range-track {
  height: 3px;
  border-radius: 999px;
  background: rgb(255 255 255 / 32%);
}

.media-stage__progress::-moz-range-progress {
  height: 3px;
  border-radius: 999px;
  background: rgb(255 255 255 / 92%);
}

.media-stage__progress::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 32%);
}

.media-stage__progress:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.media-stage__progress:focus,
.media-stage__progress:focus-visible {
  border-color: transparent;
  outline: 2px solid #fff;
  outline-offset: 2px;
  box-shadow: none;
}

.media-stage__item--sticker .media-stage__media {
  width: min(72%, 440px);
  height: min(72%, 440px);
  max-width: min(72%, 440px);
  max-height: min(72%, 440px);
  object-fit: contain;
}

.media-stage__item--round .media-stage__media {
  width: min(72%, 520px);
  height: auto;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
}

.media-stage__controls {
  display: grid;
  height: 130px;
  gap: 10px;
  padding: 12px 20px 16px;
  background: linear-gradient(to top, rgb(0 0 0 / 34%), transparent);
}

.media-stage__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.media-stage__arrow {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  cursor: pointer;
  place-items: center;
}

.media-stage__arrow svg {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
}

.media-stage__arrow:hover:not(:disabled) {
  background: rgb(255 255 255 / 16%);
}

.media-stage__arrow:focus-visible,
.media-stage__thumbnail:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.media-stage__arrow:disabled {
  cursor: default;
  opacity: 0.32;
}

.media-stage__position {
  min-width: 4rem;
  color: rgb(255 255 255 / 82%);
  font-family: var(--font-condensed);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-align: center;
}

.media-stage__thumbnails {
  display: flex;
  max-width: 100%;
  justify-content: center;
  gap: 7px;
  padding: 3px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-color: rgb(255 255 255 / 30%) transparent;
  scrollbar-width: thin;
}

.media-stage__thumbnail {
  position: relative;
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  padding: 2px;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 7px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  cursor: pointer;
  place-items: center;
}

.media-stage__thumbnail--active {
  border-color: var(--accent);
}

.media-stage__thumbnail img {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}

.media-stage__video-mark {
  z-index: 1;
  display: grid;
  width: 22px;
  height: 22px;
  grid-area: 1 / 1;
  border-radius: 50%;
  background: rgb(0 0 0 / 62%);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 32%);
  color: #fff;
  font-size: 0.58rem;
  place-items: center;
}

@keyframes media-stage-enter {
  from {
    opacity: 0;
    transform: scale(0.992);
  }
}

@media (max-width: 959px) {
  .media-stage {
    height: clamp(19rem, 52dvh, 34rem);
    flex: 0 0 auto;
  }

  .media-stage__viewport {
    padding: max(56px, calc(env(safe-area-inset-top) + 48px)) 16px 16px;
  }

  .media-stage--adaptive-image {
    height: auto;
    min-height: 0;
    grid-template-rows: auto auto;
  }

  .media-stage--adaptive-image .media-stage__viewport {
    min-height: 0;
    padding: 0;
    grid-template-rows: auto;
  }

  .media-stage--adaptive-image .media-stage__item {
    width: 100%;
    height: auto;
    align-self: center;
    aspect-ratio: var(--media-stage-aspect-ratio);
  }

  .media-stage__item--contained {
    padding: 0;
  }

  .media-stage__controls {
    padding-right: max(14px, env(safe-area-inset-right));
    padding-left: max(14px, env(safe-area-inset-left));
  }
}

.media-stage__viewport:fullscreen {
  width: 100vw;
  height: 100dvh;
  padding: 0;
  background: #20201e;
}

.media-stage__viewport:fullscreen .media-stage__item {
  width: 100%;
  height: 100%;
  padding: 0;
  aspect-ratio: auto;
}

@media (hover: none) and (pointer: coarse) {
  .media-stage__volume { width: 3rem; opacity: 1; }
  .media-stage__video-controls { padding-right: 0.4rem; padding-left: 0.4rem; }
}

:global(html[data-theme='dark'] .media-stage) {
  background: #171715;
}

@media (prefers-reduced-motion: reduce) {
  .media-stage__media,
  .media-stage__control-button,
  .media-stage__progress {
    animation: none;
    transition: none;
  }
}
</style>
