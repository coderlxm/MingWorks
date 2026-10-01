<script setup lang="ts">
defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  refresh: [];
  defer: [];
}>();
</script>

<template>
  <aside v-if="visible" class="app-update-notice" role="status" aria-live="polite">
    <p class="app-update-notice__text">网站已更新，有新版本可用。</p>
    <div class="app-update-notice__actions">
      <button class="app-update-notice__button" type="button" @click="emit('defer')">
        稍后
      </button>
      <button
        class="app-update-notice__button app-update-notice__button--primary"
        type="button"
        @click="emit('refresh')"
      >
        立即刷新
      </button>
    </div>
  </aside>
</template>

<style scoped>
.app-update-notice {
  position: fixed;
  z-index: 3000;
  right: 1rem;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  left: 1rem;
  display: flex;
  width: fit-content;
  max-width: calc(100% - 2rem);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin: 0 auto;
  padding: 0.9rem 1rem;
  border: 1px solid #e4e4df;
  border-radius: 12px;
  background: #fff;
  color: #20201e;
  box-shadow: 0 6px 24px rgb(0 0 0 / 12%);
  font-size: 0.875rem;
}

.app-update-notice__text {
  margin: 0;
}

.app-update-notice__actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.app-update-notice__button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e4e4df;
  border-radius: 8px;
  background: #fff;
  color: #20201e;
  font: inherit;
  cursor: pointer;
}

.app-update-notice__button--primary {
  border-color: #a92d38;
  background: #a92d38;
  color: #fff;
}

.app-update-notice__button:focus-visible {
  outline: 2px solid #a92d38;
  outline-offset: 3px;
}
</style>
