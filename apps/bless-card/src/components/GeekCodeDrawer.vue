<script setup lang="ts" name="GeekCodeDrawer">
import { computed, shallowRef } from 'vue'
import { COMPILE_LOGS, SOURCE_BLESSING_CODE } from '../data/weddingConfig'
import type { ThemeConfig } from '../types'

interface Props {
  visible: boolean
  theme: ThemeConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  rerunCompile: []
}>()

const activeTab = shallowRef<'logs' | 'source'>('logs')

const panelStyle = computed(() => ({
  borderColor: props.theme.palette.cardBorder,
  color: props.theme.palette.textMain,
}))

const accentStyle = computed(() => ({
  color: props.theme.palette.primary,
}))

const secondaryStyle = computed(() => ({
  color: props.theme.palette.secondary,
}))

const ctaStyle = computed(() => ({
  background: props.theme.palette.pillActiveBg,
  color: props.theme.palette.pillActiveText,
}))

function handleRerun() {
  activeTab.value = 'logs'
  emit('rerunCompile')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="drawer-backdrop"
      data-no-stage-drag
      @click.self="emit('close')"
    >
      <section class="drawer-panel" :style="panelStyle" aria-label="极客编译祝福彩蛋">
        <header class="drawer-header">
          <div class="drawer-title-group">
            <div class="window-dots" aria-hidden="true">
              <span class="dot-rose" />
              <span class="dot-amber" />
              <span class="dot-lavender" />
            </div>
            <span class="drawer-title">MingWorks · 婚礼编译彩蛋</span>
          </div>
          <button type="button" class="drawer-close" @click="emit('close')">关闭</button>
        </header>

        <div class="drawer-tabs">
          <button
            type="button"
            :class="{ 'tab-btn': true, 'tab-btn-active': activeTab === 'logs' }"
            :style="activeTab === 'logs' ? accentStyle : undefined"
            @click="activeTab = 'logs'"
          >
            build.log
          </button>
          <button
            type="button"
            :class="{ 'tab-btn': true, 'tab-btn-active': activeTab === 'source' }"
            :style="activeTab === 'source' ? accentStyle : undefined"
            @click="activeTab = 'source'"
          >
            blessing.ts
          </button>
        </div>

        <div v-if="activeTab === 'logs'" class="log-console">
          <div v-for="entry in COMPILE_LOGS" :key="entry.step" class="log-row">
            <span class="log-step">{{ entry.step }}</span>
            <span class="log-tag" :style="secondaryStyle">[{{ entry.tag }}]</span>
            <span
              :class="{ 'log-detail': true, 'log-detail-highlight': Boolean(entry.highlight) }"
              :style="entry.highlight ? accentStyle : undefined"
            >
              {{ entry.detail }}
            </span>
          </div>
        </div>

        <pre v-else class="code-viewer" :style="accentStyle"><code class="code-block">{{ SOURCE_BLESSING_CODE }}</code></pre>

        <footer class="drawer-footer">
          <span class="nameplate" :style="secondaryStyle">MingWorks · 表哥小明亲手敲代码定制</span>
          <button type="button" class="rerun-btn" :style="ctaStyle" @click="handleRerun">
            ▶ 重新运行编译并放礼花
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(8, 5, 14, 0.72);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 18px;
}

.drawer-panel {
  width: min(100%, 560px);
  max-height: 84dvh;
  border-radius: 22px;
  border: 1px solid;
  background: linear-gradient(160deg, rgba(24, 17, 29, 0.97), rgba(14, 10, 18, 0.98));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 240, 200, 0.12);
}

.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.window-dots {
  display: flex;
  gap: 6px;
}

.dot-rose,
.dot-amber,
.dot-lavender {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.dot-rose {
  background: #fb7185;
}

.dot-amber {
  background: #fbbf24;
}

.dot-lavender {
  background: #c4b5fd;
}

.drawer-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
}

.drawer-close {
  border: 1px solid rgba(255, 240, 200, 0.22);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
}

.drawer-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 18px 0;
  border-bottom: 1px solid rgba(255, 240, 200, 0.1);
}

.tab-btn {
  border: 0;
  background: transparent;
  padding: 8px 12px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  opacity: 0.65;
  border-bottom: 2px solid transparent;
}

.tab-btn-active {
  opacity: 1;
  font-weight: 700;
  border-bottom-color: currentColor;
}

.log-console,
.code-viewer {
  margin: 0;
  padding: 16px 18px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.72;
}

.log-console {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.log-step {
  opacity: 0.45;
  font-size: 11px;
}

.log-tag {
  font-weight: 700;
  flex-shrink: 0;
}

.log-detail {
  color: #f4ece1;
  word-break: break-word;
}

.log-detail-highlight {
  font-weight: 700;
}

.code-viewer {
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.24);
}

.code-block {
  font-family: inherit;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 18px 16px;
  border-top: 1px solid rgba(255, 240, 200, 0.12);
}

.nameplate {
  font-size: 12px;
  font-weight: 600;
}

.rerun-btn {
  border: 0;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 12.5px;
  font-weight: 700;
}
</style>
