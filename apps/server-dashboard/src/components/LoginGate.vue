<script setup lang="ts">
import { shallowRef } from 'vue'

defineProps<{ busy: boolean; error: string }>()
const emit = defineEmits<{ login: [password: string] }>()
const password = shallowRef('')
</script>

<template>
  <section class="login-wrap">
    <form class="login card" @submit.prevent="emit('login', password)">
      <h2 class="login-title">请输入站点口令</h2>
      <label class="field">
        站点口令
        <input v-model="password" type="password" name="password" required autocomplete="current-password" :disabled="busy">
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" type="submit" :disabled="busy">{{ busy ? '正在进入…' : '进入看板' }}</button>
    </form>
  </section>
</template>
