<script setup lang="ts" name="ThemeDock">
import { computed } from 'vue'
import type { ThemeConfig, ThemeId } from '../types'

interface Props {
  activeTheme: ThemeId
  themes: readonly ThemeConfig[]
  activePalette: ThemeConfig['palette']
}

const props = defineProps<Props>()
const emit = defineEmits<{
  selectTheme: [theme: ThemeId]
  fireBurst: []
  openCode: []
}>()

const dockStyle = computed(() => ({
  background: props.activePalette.pillBg,
  borderColor: props.activePalette.cardBorder,
  color: props.activePalette.textMain,
}))

function getThemeBtnStyle(themeId: ThemeId) {
  if (themeId !== props.activeTheme) return undefined
  return {
    background: props.activePalette.pillActiveBg,
    color: props.activePalette.pillActiveText,
  }
}
</script>

<template>
  <nav class="dock-wrapper" aria-label="贺卡风格与互动控制">
    <div class="dock-bar" :style="dockStyle" data-no-stage-drag>
      <div class="dock-themes">
        <button
          v-for="item in themes"
          :key="item.id"
          type="button"
          :class="{ 'dock-pill': true, 'dock-pill-active': item.id === activeTheme }"
          :style="getThemeBtnStyle(item.id)"
          @click="emit('selectTheme', item.id)"
        >
          <span>{{ item.emoji }}</span>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <span class="dock-divider" aria-hidden="true" />

      <div class="dock-actions">
        <button type="button" class="dock-action-btn" @click="emit('fireBurst')">
          🎆 放礼花
        </button>
        <button type="button" class="dock-action-btn dock-code-btn" @click="emit('openCode')">
          &lt;/&gt; 彩蛋
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.dock-wrapper {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 25;
  display: flex;
  justify-content: center;
  padding: 10px 12px calc(14px + env(safe-area-inset-bottom));
  pointer-events: none;
}

.dock-bar {
  pointer-events: auto;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid;
  backdrop-filter: blur(22px);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.55);
  overflow-x: auto;
  scrollbar-width: none;
}

.dock-bar::-webkit-scrollbar {
  display: none;
}

.dock-themes,
.dock-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.dock-pill,
.dock-action-btn {
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: transform 0.16s ease, background 0.25s ease;
}

.dock-pill:hover,
.dock-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dock-pill:active,
.dock-action-btn:active {
  transform: scale(0.95);
}

.dock-pill-active {
  font-weight: 700;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.dock-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 240, 200, 0.2);
  flex-shrink: 0;
}

.dock-code-btn {
  font-family: var(--font-mono);
  font-size: 12px;
}

@media (max-width: 560px) {
  .dock-bar {
    border-radius: 22px;
    padding: 6px 8px;
  }

  .dock-pill,
  .dock-action-btn {
    padding: 7px 10px;
    font-size: 12px;
  }
}
</style>
