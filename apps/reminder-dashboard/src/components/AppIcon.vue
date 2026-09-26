<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  list: 'M9 3h6v3H9zM9 11h6m-6 5h6M6 4H5v17h14V4h-1',
  repeat: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
  leaf: 'M20 4C12 2 5 7 5 13a6 6 0 0 0 6 6c6 0 9-7 9-15ZM4 21 15 10',
  clock: 'M12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  water: 'M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12ZM8 15a4 4 0 0 0 4 4',
  book: 'M12 5v16M3 4c4-1 6-1 9 1 3-2 5-2 9-1v15c-4-1-6-1-9 2-3-3-5-3-9-2V4Z',
  capsule: 'm5 11 6-6a5.7 5.7 0 0 1 8 8l-6 6a5.7 5.7 0 0 1-8-8Zm3-3 8 8',
  check: 'm5 12 4 4L19 6',
  refresh: 'M20 9a8 8 0 1 0 0 6M20 4v5h-5',
  bus: 'M5 17V5h14v12H5Zm0-7h14M8 5v5m8-5v5M7 17v3m10-3v3M8 14h1m6 0h1',
  work: 'M8 6V3h8v3M3 7h18v13H3V7Zm0 5h18M10 11h4v3h-4',
}
</script>
<template><svg viewBox="0 0 24 24" aria-hidden="true" class="app-icon"><circle v-if="name === 'clock'" cx="12" cy="12" r="9"/><circle v-if="name === 'sun'" cx="12" cy="12" r="4"/><path :d="paths[name]"/></svg></template>
