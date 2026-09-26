<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import AppIcon from './AppIcon.vue'
defineProps<{ busy: boolean; error: string; uncertain: boolean }>()
const emit = defineEmits<{ login: [password: string]; reload: [] }>()
const password = shallowRef('')
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
onMounted(() => dialog.value!.showModal())
onBeforeUnmount(() => dialog.value!.close())
</script>
<template>
  <dialog ref="dialog" class="session-dialog" aria-labelledby="login-title" @cancel.prevent>
    <form class="login-card" @submit.prevent="emit('login', password)"><div class="login-mark"><AppIcon name="leaf" /></div><p class="eyebrow">A LITTLE SPACE FOR YOURSELF</p><h1 id="login-title">拾时</h1><p class="login-intro">把重要的小事，轻轻放在这里。</p><p class="muted">这是你的私人日程，请输入站点口令。</p><label class="field">站点口令<input v-model="password" type="password" required autocomplete="current-password" autofocus :disabled="busy"></label><p v-if="error" class="error" role="alert">{{ error }}</p><button class="primary full-width" :disabled="busy">{{ busy ? '正在打开日程…' : '进入我的日程' }}</button><button v-if="uncertain && error" class="text-button full-width" type="button" :disabled="busy" @click="emit('reload')">重新读取登录状态</button><p class="login-foot">北京时间 · 提醒仍由 Telegram Bot 发出</p></form>
  </dialog>
</template>
