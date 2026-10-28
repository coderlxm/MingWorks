<script setup lang="ts">
import { computed } from 'vue'
import { WARN_RATIO } from '../utils/format'

const props = defineProps<{ label: string; valueText: string; ratios: number[] }>()
const warn = computed(() => props.ratios.some(ratio => ratio >= WARN_RATIO))
</script>

<template>
  <div class="metric">
    <div class="metric-head">
      <span class="metric-name">
        {{ label }}
        <span v-if="warn" class="warn-tag">偏高</span>
      </span>
      <span class="metric-value" :class="{ warn }">{{ valueText }}</span>
    </div>
    <div class="meter" :style="{ gridTemplateColumns: `repeat(${ratios.length}, minmax(0, 1fr))` }" aria-hidden="true">
      <span v-for="(ratio, index) in ratios" :key="index" class="meter-track">
        <span class="meter-fill" :class="{ warn: ratio >= WARN_RATIO }" :style="{ width: `${Math.min(ratio, 1) * 100}%` }"></span>
      </span>
    </div>
  </div>
</template>
