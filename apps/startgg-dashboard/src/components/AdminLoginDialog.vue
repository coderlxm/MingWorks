<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
const props = defineProps<{ login: (password: string) => Promise<boolean>; error: string; submitting: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const password = shallowRef('')
function close() { if (!props.submitting) emit('close') }
async function submit() { if (await props.login(password.value)) emit('close') }
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <dialog ref="dialog" class="login-dialog" aria-labelledby="login-title" @cancel.prevent="close" @click="($event.target === dialog) && close()">
    <header class="drawer-heading"><div><p class="eyebrow">FTG · 管理模式</p><h2 id="login-title">管理登录</h2></div><button :disabled="submitting" aria-label="关闭登录面板" @click="close">关闭 ×</button></header>
    <p class="muted">比赛信息始终开放。登录后可管理关注、赛事与监控。</p>
    <form @submit.prevent="submit">
      <label class="field">站点口令<input v-model="password" type="password" required autocomplete="current-password" placeholder="输入本站口令" autofocus :disabled="submitting"></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary login-submit" :disabled="submitting">{{ submitting ? '登录中…' : '进入管理模式' }}</button>
    </form>
  </dialog>
</template>
<style scoped>
.login-dialog{width:min(440px,calc(100% - 32px));max-height:calc(100dvh - 32px);margin:auto;padding:28px;border:1px solid var(--line-hi);border-top:3px solid var(--accent);border-radius:2px;background:linear-gradient(180deg,#15151e,#0d0d13);color:inherit;box-shadow:0 24px 60px #000a}
.login-dialog::backdrop{background:#030306cc;backdrop-filter:blur(3px)}
.login-dialog>.muted{font-size:13px;line-height:1.8;margin-top:20px}
@media(max-width:680px){.login-dialog{padding:22px}}
</style>
