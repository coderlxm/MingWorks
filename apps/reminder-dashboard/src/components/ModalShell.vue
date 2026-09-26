<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import AppIcon from './AppIcon.vue'
defineProps<{ title: string; subtitle?: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
onMounted(() => dialog.value!.showModal())
onBeforeUnmount(() => dialog.value!.close())
</script>
<template>
  <dialog ref="dialog" class="drawer-dialog" aria-labelledby="drawer-title" @cancel.prevent="!busy && emit('close')" @click="$event.target === dialog && !busy && emit('close')">
    <div class="drawer-inner"><header class="drawer-header"><div><p class="eyebrow">拾时 · 我的提醒</p><h2 id="drawer-title">{{ title }}</h2><p v-if="subtitle" class="muted">{{ subtitle }}</p></div><button type="button" class="icon-button" aria-label="关闭面板" :disabled="busy" @click="emit('close')"><AppIcon name="close" /></button></header><slot /></div>
  </dialog>
</template>
