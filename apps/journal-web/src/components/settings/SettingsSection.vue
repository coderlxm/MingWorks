<script setup lang="ts">
import { useId } from 'vue';

defineProps<{
  title: string;
  description: string;
}>();

const titleId = useId();
</script>

<template>
  <section class="settings-section" :aria-labelledby="titleId">
    <header class="settings-section__header">
      <h2 :id="titleId">{{ title }}</h2>
      <p>{{ description }}</p>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  min-width: 0;
  gap: 1rem;
}

.settings-section__header {
  display: grid;
  gap: 0.3rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-section__header h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.2rem;
}

.settings-section__header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.6;
}
</style>
