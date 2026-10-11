<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Preset } from '../types'
import { PRESET_REMINDERS } from '../../../../src/reminders/presets'
import AppIcon from './AppIcon.vue'
const emit = defineEmits<{ create: [preset: Preset] }>()
const text = ref('')
const value = computed(() => text.value.trim())
function submit() {
  emit('create', { id: 'quick', label: value.value, reminderText: value.value, minutes: 15 })
  text.value = ''
}
</script>
<template>
  <form class="card quick-add" @submit.prevent="submit">
    <div class="quick-input">
      <AppIcon name="plus" />
      <input v-model="text" type="text" maxlength="1000" placeholder="记一件小事，回车后选择时间" aria-label="记一件小事" />
      <button class="primary small" type="submit" :disabled="!value">安排</button>
    </div>
    <div class="preset-row">
      <button v-for="preset in PRESET_REMINDERS" :key="preset.id" type="button" class="preset-chip" @click="emit('create', preset)">
        {{ preset.emoji }} {{ preset.label }}<small>{{ preset.minutes }} 分钟</small>
      </button>
    </div>
  </form>
</template>
<style scoped>
.quick-add { display: grid; gap: 12px; }
.quick-input {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 8px 0 14px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  background: var(--surface);
}
.quick-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.quick-input > svg { width: 18px; height: 18px; flex: none; color: var(--muted); }
.quick-input input {
  flex: 1;
  min-width: 0;
  height: 40px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
}
.quick-input input::placeholder { color: var(--muted); }
.preset-row { display: flex; flex-wrap: wrap; gap: 8px; }
.preset-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  flex: none;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--body);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.preset-chip:hover { border-color: var(--accent); color: var(--accent-ink); }
.preset-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.preset-chip small { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
@media (max-width: 719px) {
  .preset-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .preset-row::-webkit-scrollbar { display: none; }
  .quick-input input { font-size: 16px; }
}
</style>
