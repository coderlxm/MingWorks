<script setup lang="ts" name="ReceiptDialog">
import { computed, shallowRef } from 'vue'
import { WEDDING_CONFIG } from '../data/weddingConfig'
import type { ReceiptResult, ThemeConfig } from '../types'

interface Props {
  visible: boolean
  theme: ThemeConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  confirmed: [result: ReceiptResult]
}>()

const noteText = shallowRef('')
const submitting = shallowRef(false)
const errorMessage = shallowRef('')

const panelStyle = computed(() => ({
  borderColor: props.theme.palette.cardBorder,
  color: props.theme.palette.textMain,
}))

const accentStyle = computed(() => ({
  color: props.theme.palette.primary,
}))

const ctaStyle = computed(() => ({
  background: props.theme.palette.pillActiveBg,
  color: props.theme.palette.pillActiveText,
}))

const mutedStyle = computed(() => ({
  color: props.theme.palette.textMuted,
}))

function applyQuickNote(text: string) {
  errorMessage.value = ''
  noteText.value = noteText.value === text ? '' : text
}

async function submitReceipt() {
  if (submitting.value) return
  errorMessage.value = ''
  submitting.value = true
  try {
    const response = await fetch('/api/bless-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeLabel: props.theme.label,
        note: noteText.value.trim(),
      }),
    })
    const payload = await response.json() as Partial<ReceiptResult> & { error?: string }
    if (!response.ok || !payload.ok || typeof payload.receivedAt !== 'string') {
      throw new Error(payload.error || `通知发送失败（HTTP ${response.status}）`)
    }
    emit('confirmed', { ok: true, receivedAt: payload.receivedAt })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发送回执时发生异常'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dialog-backdrop"
      data-no-stage-drag
      @click.self="emit('close')"
    >
      <section class="dialog-panel" :style="panelStyle" aria-label="收下新婚祝福">
        <header class="dialog-header">
          <h3 class="dialog-title" :style="accentStyle">💌 收下表哥小明的祝福</h3>
          <button type="button" class="dialog-close" :disabled="submitting" @click="emit('close')">
            取消
          </button>
        </header>

        <p class="dialog-desc" :style="mutedStyle">
          点击确认后，会立即给表哥小明的 Telegram 悄悄发一条「祝福已拆阅」报喜消息～
        </p>

        <div class="quick-chips">
          <button
            v-for="chip in WEDDING_CONFIG.quickReceiptNotes"
            :key="chip"
            type="button"
            :class="{ 'chip-btn': true, 'chip-btn-active': noteText === chip }"
            @click="applyQuickNote(chip)"
          >
            {{ chip }}
          </button>
        </div>

        <label class="note-label" for="bless-receipt-note">附上一句回话（选填）</label>
        <textarea
          id="bless-receipt-note"
          v-model="noteText"
          class="note-input"
          rows="3"
          maxlength="200"
          placeholder="可以直接点上面快捷回复，或者留空一键签收…"
          :disabled="submitting"
        />

        <p v-if="errorMessage" class="dialog-error" role="alert">
          {{ errorMessage }}
        </p>

        <button
          type="button"
          class="submit-btn"
          :style="ctaStyle"
          :disabled="submitting"
          @click="submitReceipt"
        >
          {{ submitting ? '正在推给小明…' : '🎊 确认签收祝福并放礼花' }}
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(8, 5, 14, 0.74);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 18px;
}

.dialog-panel {
  width: min(100%, 440px);
  border-radius: 24px;
  border: 1px solid;
  padding: 22px;
  background: linear-gradient(160deg, rgba(32, 22, 26, 0.97), rgba(16, 11, 14, 0.98));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.dialog-close {
  border: 1px solid rgba(255, 240, 200, 0.22);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
}

.dialog-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-btn {
  border: 1px solid rgba(245, 208, 138, 0.28);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 12px;
  text-align: left;
}

.chip-btn-active {
  border-color: rgba(245, 208, 138, 0.85);
  background: rgba(245, 208, 138, 0.2);
}

.note-label {
  font-size: 12px;
  opacity: 0.78;
}

.note-input {
  width: 100%;
  resize: none;
  border-radius: 14px;
  border: 1px solid rgba(245, 208, 138, 0.3);
  background: rgba(0, 0, 0, 0.3);
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
}

.note-input:focus {
  border-color: rgba(245, 208, 138, 0.8);
}

.dialog-error {
  margin: 0;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid rgba(251, 113, 133, 0.52);
  background: rgba(159, 18, 57, 0.3);
  color: #fecdd3;
  font-size: 12.5px;
  line-height: 1.5;
}

.submit-btn {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  margin-top: 2px;
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}
</style>
