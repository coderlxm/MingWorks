<script setup lang="ts" name="App">
import { computed, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import BlessingCard3D from './components/BlessingCard3D.vue'
import GeekCodeDrawer from './components/GeekCodeDrawer.vue'
import ReceiptDialog from './components/ReceiptDialog.vue'
import Stage3DCanvas from './components/Stage3DCanvas.vue'
import ThemeDock from './components/ThemeDock.vue'
import WaxSealEnvelope from './components/WaxSealEnvelope.vue'
import { useTiltParallax } from './composables/useTiltParallax'
import { useWeddingMusicBox } from './composables/useWeddingMusicBox'
import { THEME_ORDER, WEDDING_THEMES } from './data/themes'
import { WEDDING_CONFIG } from './data/weddingConfig'
import type { ReceiptResult, ThemeId } from './types'

const activeThemeId = shallowRef<ThemeId>('gilded')
const isOpening = shallowRef(false)
const isOpened = shallowRef(false)
const codeDrawerOpen = shallowRef(false)
const receiptDialogOpen = shallowRef(false)
const receiptTimeLabel = shallowRef('')

const stageRef = useTemplateRef<InstanceType<typeof Stage3DCanvas>>('stageRef')

const { tiltX, tiltY, cardTransformStyle, requestGyroPermission } = useTiltParallax()
const {
  isPlaying,
  startMusic,
  toggleMusic,
  switchThemeMusic,
  playSparkleChime,
} = useWeddingMusicBox()

let openTimer: ReturnType<typeof globalThis.setTimeout> | null = null

const activeTheme = computed(() => WEDDING_THEMES[activeThemeId.value])
const orderedThemes = computed(() => THEME_ORDER.map(id => WEDDING_THEMES[id]))

const rootBackgroundStyle = computed(() => ({
  background: activeTheme.value.palette.backdrop,
  color: activeTheme.value.palette.textMain,
}))

const topPillStyle = computed(() => ({
  background: activeTheme.value.palette.pillBg,
  borderColor: activeTheme.value.palette.cardBorder,
  color: activeTheme.value.palette.textMain,
}))

const receiptDone = computed(() => receiptTimeLabel.value.length > 0)

function clearOpenTimer() {
  if (openTimer !== null) {
    globalThis.clearTimeout(openTimer)
    openTimer = null
  }
}

async function handleOpenEnvelope() {
  if (isOpening.value || isOpened.value) return
  isOpening.value = true
  void requestGyroPermission()
  startMusic(activeThemeId.value)
  playSparkleChime(activeThemeId.value)
  stageRef.value?.burstFireworks(4)

  clearOpenTimer()
  openTimer = globalThis.setTimeout(() => {
    openTimer = null
    isOpened.value = true
    isOpening.value = false
  }, 520)
}

function handleReopenEnvelope() {
  clearOpenTimer()
  isOpening.value = false
  isOpened.value = false
}

function handleSelectTheme(themeId: ThemeId) {
  if (activeThemeId.value === themeId) {
    stageRef.value?.burstFireworks(2)
    return
  }
  activeThemeId.value = themeId
  stageRef.value?.setTheme(themeId)
  switchThemeMusic(themeId)
  playSparkleChime(themeId)
}

function handleFireBurst() {
  playSparkleChime(activeThemeId.value)
  stageRef.value?.burstFireworks(4)
}

function handleRerunCompile() {
  playSparkleChime(activeThemeId.value)
  stageRef.value?.burstFireworks(4)
}

function handleReceiptConfirmed(result: ReceiptResult) {
  receiptDialogOpen.value = false
  receiptTimeLabel.value = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(result.receivedAt))
  playSparkleChime(activeThemeId.value)
  stageRef.value?.burstFireworks(5)
}

onUnmounted(() => {
  clearOpenTimer()
})
</script>

<template>
  <div class="bless-app" :style="rootBackgroundStyle">
    <Stage3DCanvas
      ref="stageRef"
      :initial-theme="activeThemeId"
      :tilt-x="tiltX"
      :tilt-y="tiltY"
    />

    <header class="top-bar">
      <span class="top-pill" :style="topPillStyle">
        {{ WEDDING_CONFIG.dateCompact }} · {{ WEDDING_CONFIG.city }}
      </span>

      <div class="top-controls" data-no-stage-drag>
        <button
          type="button"
          class="top-pill top-btn"
          :style="topPillStyle"
          @click="toggleMusic(activeThemeId)"
        >
          <span :class="{ 'music-disc': true, 'music-disc-spinning': isPlaying }">♪</span>
          <span class="music-label">{{ isPlaying ? activeTheme.musicLabel : '开启八音盒' }}</span>
        </button>

        <button
          v-if="isOpened"
          type="button"
          class="top-pill top-btn"
          :style="topPillStyle"
          @click="handleReopenEnvelope"
        >
          重温拆封
        </button>
      </div>
    </header>

    <main class="main-stage">
      <WaxSealEnvelope
        v-if="!isOpened"
        :theme="activeTheme"
        :opening="isOpening"
        @open="handleOpenEnvelope"
      />

      <div v-else class="opened-grid">
        <div class="sculpture-window" aria-hidden="true">
          <span class="drag-hint">拖拽空白处可旋转 3D 雕塑</span>
        </div>

        <BlessingCard3D
          :theme="activeTheme"
          :tilt-style="cardTransformStyle"
          :receipt-done="receiptDone"
          :receipt-time-label="receiptTimeLabel"
          @open-receipt="receiptDialogOpen = true"
          @open-code="codeDrawerOpen = true"
        />
      </div>
    </main>

    <ThemeDock
      v-if="isOpened"
      :active-theme="activeThemeId"
      :themes="orderedThemes"
      :active-palette="activeTheme.palette"
      @select-theme="handleSelectTheme"
      @fire-burst="handleFireBurst"
      @open-code="codeDrawerOpen = true"
    />

    <GeekCodeDrawer
      :visible="codeDrawerOpen"
      :theme="activeTheme"
      @close="codeDrawerOpen = false"
      @rerun-compile="handleRerunCompile"
    />

    <ReceiptDialog
      :visible="receiptDialogOpen"
      :theme="activeTheme"
      @close="receiptDialogOpen = false"
      @confirmed="handleReceiptConfirmed"
    />
  </div>
</template>

<style scoped>
.bless-app {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  overflow-x: hidden;
  transition: background 0.5s ease;
}

.top-bar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: calc(14px + env(safe-area-inset-top)) 18px 8px;
}

.top-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-pill {
  border-radius: 999px;
  border: 1px solid;
  padding: 7px 13px;
  font-size: 12px;
  letter-spacing: 0.06em;
  backdrop-filter: blur(16px);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.top-btn {
  font-weight: 600;
}

.music-disc {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 240, 200, 0.16);
  font-size: 11px;
}

.music-disc-spinning {
  animation: discSpin 3.4s linear infinite;
}

.main-stage {
  position: relative;
  z-index: 12;
  min-height: calc(100dvh - 58px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 16px calc(92px + env(safe-area-inset-bottom));
}

.opened-grid {
  width: min(100%, 1060px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 28px;
}

.sculpture-window {
  min-height: 360px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
  pointer-events: none;
}

.drag-hint {
  font-size: 11.5px;
  letter-spacing: 0.14em;
  opacity: 0.56;
}

@media (max-width: 919px) {
  .main-stage {
    justify-content: flex-end;
  }

  .opened-grid {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 10px;
  }

  .sculpture-window {
    min-height: 32dvh;
  }
}

@media (max-width: 480px) {
  .top-bar {
    padding: calc(12px + env(safe-area-inset-top)) 14px 6px;
  }

  .top-pill {
    padding: 6px 10px;
    font-size: 11px;
  }

  .music-label {
    max-width: 108px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
