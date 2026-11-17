<script setup lang="ts" name="WaxSealEnvelope">
import { computed } from 'vue'
import { WEDDING_CONFIG } from '../data/weddingConfig'
import type { ThemeConfig } from '../types'

interface Props {
  theme: ThemeConfig
  opening: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  open: []
}>()

const cardStyle = computed(() => ({
  background: props.theme.palette.cardSurface,
  borderColor: props.theme.palette.cardBorder,
  boxShadow: props.theme.palette.cardShadow,
  color: props.theme.palette.textMain,
}))

const accentStyle = computed(() => ({
  color: props.theme.palette.primary,
}))

const mutedStyle = computed(() => ({
  color: props.theme.palette.textMuted,
}))

const envelopeClasses = computed(() => ({
  'envelope-stage': true,
  'envelope-opening': props.opening,
}))

function handleOpen() {
  if (props.opening) return
  emit('open')
}
</script>

<template>
  <section :class="envelopeClasses" aria-label="婚礼喜帖封套">
    <div class="envelope-shell" :style="cardStyle">
      <div class="envelope-foil-edge" />
      <div class="envelope-flap" :style="cardStyle">
        <span class="envelope-flap-mark" :style="accentStyle">{{ theme.sealTitle }}</span>
      </div>

      <div class="envelope-body">
        <p class="envelope-eyebrow" :style="accentStyle">
          {{ WEDDING_CONFIG.dateCompact }} · {{ WEDDING_CONFIG.venueLabel }}
        </p>

        <h1 class="envelope-couple">
          <span>{{ WEDDING_CONFIG.groom }}</span>
          <span class="envelope-heart" :style="accentStyle">♥</span>
          <span>{{ WEDDING_CONFIG.bride }}</span>
        </h1>

        <p class="envelope-sub" :style="mutedStyle">{{ theme.sealSubtitle }}</p>

        <button
          type="button"
          class="wax-seal-btn"
          :disabled="opening"
          data-no-stage-drag
          @click="handleOpen"
        >
          <span class="wax-seal-ring" />
          <span class="wax-seal-glyph">{{ WEDDING_CONFIG.waxSymbol }}</span>
        </button>

        <button
          type="button"
          class="envelope-cta"
          :style="accentStyle"
          :disabled="opening"
          data-no-stage-drag
          @click="handleOpen"
        >
          轻触火漆印章 · 启封新婚祝福
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.envelope-stage {
  position: relative;
  z-index: 10;
  width: 100%;
  min-height: calc(100dvh - 120px);
  display: grid;
  place-items: center;
  padding: 20px 16px 32px;
  perspective: 1400px;
  transition: opacity 0.48s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.envelope-opening {
  opacity: 0;
  transform: scale(1.06) translateY(-18px);
  pointer-events: none;
}

.envelope-shell {
  position: relative;
  width: min(100%, 420px);
  border-radius: 28px;
  border: 1px solid;
  padding: 78px 26px 34px;
  overflow: hidden;
  backdrop-filter: blur(18px);
  transform-style: preserve-3d;
  animation: floatSlow 5.4s ease-in-out infinite;
}

.envelope-foil-edge {
  position: absolute;
  inset: 10px;
  border-radius: 20px;
  border: 1px dashed rgba(245, 208, 138, 0.28);
  pointer-events: none;
}

.envelope-flap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 76px;
  border-bottom: 1px solid rgba(245, 208, 138, 0.28);
  display: grid;
  place-items: center;
  transform-origin: top center;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent);
}

.envelope-opening .envelope-flap {
  transform: rotateX(-130deg);
}

.envelope-flap-mark {
  font-size: 12px;
  letter-spacing: 0.26em;
  font-weight: 600;
}

.envelope-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.envelope-eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.22em;
  font-weight: 600;
}

.envelope-couple {
  margin: 0 0 10px;
  font-family: var(--font-serif);
  font-size: clamp(26px, 6.4vw, 32px);
  font-weight: 700;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.envelope-heart {
  font-size: 20px;
}

.envelope-sub {
  margin: 0 0 28px;
  font-size: 13px;
  line-height: 1.6;
}

.wax-seal-btn {
  position: relative;
  width: 92px;
  height: 92px;
  border-radius: 999px;
  border: 2px solid rgba(253, 230, 138, 0.78);
  background: radial-gradient(circle at 32% 28%, #f43f5e 0%, #be123c 55%, #660822 100%);
  display: grid;
  place-items: center;
  padding: 0;
  animation: sealPulse 2.4s ease-in-out infinite;
  transition: transform 0.2s ease;
}

.wax-seal-btn:hover {
  transform: scale(1.06);
}

.wax-seal-btn:active {
  transform: scale(0.94);
}

.wax-seal-ring {
  position: absolute;
  inset: 7px;
  border-radius: 999px;
  border: 1px dashed rgba(254, 243, 199, 0.56);
  pointer-events: none;
}

.wax-seal-glyph {
  font-family: var(--font-serif);
  font-size: 36px;
  font-weight: 700;
  color: #fef3c7;
  text-shadow: 0 2px 6px rgba(68, 4, 18, 0.72);
  line-height: 1;
}

.envelope-cta {
  margin-top: 18px;
  border: 0;
  background: transparent;
  font-size: 13px;
  letter-spacing: 0.16em;
  padding: 6px 12px;
  font-weight: 600;
}
</style>
