<script setup lang="ts" name="BlessingCard3D">
import { computed } from 'vue'
import { WEDDING_CONFIG } from '../data/weddingConfig'
import type { ThemeConfig } from '../types'

interface Props {
  theme: ThemeConfig
  tiltStyle: Record<string, string>
  receiptDone: boolean
  receiptTimeLabel: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  openReceipt: []
  openCode: []
}>()

const cardFrameStyle = computed(() => ({
  ...props.tiltStyle,
  background: props.theme.palette.cardSurface,
  borderColor: props.theme.palette.cardBorder,
  boxShadow: props.theme.palette.cardShadow,
  color: props.theme.palette.textMain,
}))

const primaryTextStyle = computed(() => ({
  color: props.theme.palette.primary,
}))

const secondaryTextStyle = computed(() => ({
  color: props.theme.palette.secondary,
}))

const mutedTextStyle = computed(() => ({
  color: props.theme.palette.textMuted,
}))

const stampStyle = computed(() => ({
  borderColor: props.theme.palette.stampBorder,
  color: props.theme.palette.stampText,
}))

const ctaStyle = computed(() => ({
  background: props.theme.palette.pillActiveBg,
  color: props.theme.palette.pillActiveText,
}))
</script>

<template>
  <article class="card-perspective">
    <div class="card-3d" :style="cardFrameStyle" data-no-stage-drag>
      <div class="card-sheen" aria-hidden="true" />
      <div class="card-inner-border" aria-hidden="true" />

      <div class="card-header">
        <span class="card-badge" :style="primaryTextStyle">{{ theme.badge }}</span>
        <span class="card-date" :style="mutedTextStyle">{{ WEDDING_CONFIG.dateFull }} · {{ WEDDING_CONFIG.city }}</span>
      </div>

      <div v-if="theme.hudText" class="coop-hud" :style="secondaryTextStyle">
        <span class="hud-dot" />
        <span>{{ theme.hudText }}</span>
      </div>

      <div class="couple-banner">
        <span class="couple-name">{{ WEDDING_CONFIG.groom }}</span>
        <span class="couple-amp" :style="secondaryTextStyle">♥</span>
        <span class="couple-name">{{ WEDDING_CONFIG.bride }}</span>
      </div>

      <p class="theme-subtitle" :style="mutedTextStyle">{{ theme.subtitle }}</p>

      <div class="wish-hero">
        <span class="wish-rule" :style="primaryTextStyle" />
        <h2 class="wish-title" :style="primaryTextStyle">{{ theme.headline }}</h2>
        <span class="wish-rule" :style="primaryTextStyle" />
      </div>

      <div class="bless-copy" :style="mutedTextStyle">
        <p v-for="(line, index) in theme.blessLines" :key="index" class="bless-paragraph">
          {{ line }}
        </p>
      </div>

      <footer class="card-footer">
        <div class="signature-group">
          <div class="seal-stamp" :style="stampStyle">
            <span>{{ WEDDING_CONFIG.stampText }}</span>
          </div>
          <div class="signature-meta">
            <span class="signature-name">{{ WEDDING_CONFIG.senderTitle }} 敬祝</span>
            <button
              type="button"
              class="code-link-btn"
              :style="mutedTextStyle"
              data-no-stage-drag
              @click="emit('openCode')"
            >
              &lt;/&gt; 查看祝福源码
            </button>
          </div>
        </div>

        <button
          v-if="!receiptDone"
          type="button"
          class="receipt-btn"
          :style="ctaStyle"
          data-no-stage-drag
          @click="emit('openReceipt')"
        >
          💌 收下表哥的祝福
        </button>

        <div v-else class="receipt-badge" :style="stampStyle">
          <span class="receipt-badge-title">囍 祝福已签收</span>
          <span class="receipt-badge-time" :style="mutedTextStyle">{{ receiptTimeLabel }}</span>
        </div>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.card-perspective {
  width: min(100%, 452px);
  perspective: 1400px;
}

.card-3d {
  position: relative;
  border-radius: 28px;
  border: 1px solid;
  padding: 24px 24px 22px;
  backdrop-filter: blur(20px);
  transform-style: preserve-3d;
  transition:
    background 0.45s ease,
    border-color 0.45s ease,
    box-shadow 0.45s ease;
  overflow: hidden;
}

.card-sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle 340px at var(--sheen-x, 50%) var(--sheen-y, 30%),
    rgba(255, 248, 228, 0.14),
    transparent 65%
  );
}

.card-inner-border {
  position: absolute;
  inset: 10px;
  border-radius: 20px;
  border: 1px solid rgba(255, 240, 200, 0.14);
  pointer-events: none;
}

.card-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.card-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  font-weight: 700;
}

.card-date {
  font-size: 12px;
  letter-spacing: 0.08em;
}

.coop-hud {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-bottom: 14px;
  border-radius: 999px;
  border: 1px solid rgba(244, 114, 182, 0.36);
  background: rgba(19, 10, 44, 0.65);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.hud-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fbbf24;
  box-shadow: 0 0 10px #fbbf24;
}

.couple-banner {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.couple-name {
  font-family: var(--font-serif);
  font-size: clamp(26px, 5.4vw, 32px);
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.couple-amp {
  font-size: 20px;
  transform: translateZ(18px);
}

.theme-subtitle {
  position: relative;
  margin: 0 0 16px;
  font-size: 13px;
  letter-spacing: 0.06em;
}

.wish-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 250, 240, 0.05);
  border: 1px solid rgba(245, 208, 138, 0.22);
}

.wish-rule {
  flex: 1;
  height: 1px;
  background: currentColor;
  opacity: 0.35;
}

.wish-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(21px, 4.6vw, 25px);
  font-weight: 700;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.bless-copy {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.bless-paragraph {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
}

.card-footer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 240, 200, 0.14);
}

.signature-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.seal-stamp {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1.5px solid;
  display: grid;
  place-items: center;
  padding: 2px;
  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  transform: rotate(-6deg);
}

.signature-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.signature-name {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.code-link-btn {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 11px;
  text-decoration: underline;
  text-underline-offset: 3px;
  opacity: 0.86;
}

.receipt-btn {
  border: 0;
  border-radius: 999px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.receipt-btn:hover {
  transform: translateY(-2px);
}

.receipt-btn:active {
  transform: scale(0.97);
}

.receipt-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 7px 14px;
  border-radius: 14px;
  border: 1px solid;
  background: rgba(255, 248, 228, 0.06);
}

.receipt-badge-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.receipt-badge-time {
  font-size: 11px;
  margin-top: 2px;
}
</style>
