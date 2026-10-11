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
    <div class="drawer-inner">
      <span class="drawer-handle" aria-hidden="true"></span>
      <header class="drawer-header">
        <div>
          <h2 id="drawer-title">{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
        <button type="button" class="icon-button" aria-label="关闭面板" :disabled="busy" @click="emit('close')"><AppIcon name="close" /></button>
      </header>
      <div class="drawer-body"><slot /></div>
    </div>
  </dialog>
</template>
