<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
  flush?: boolean;
}>();
</script>

<template>
  <div class="settings-card">
    <header v-if="title || $slots.aside" class="settings-card__header">
      <div class="settings-card__copy">
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.aside" class="settings-card__aside">
        <slot name="aside" />
      </div>
    </header>
    <div
      v-if="$slots.default"
      class="settings-card__body"
      :class="{ 'settings-card__body--flush': flush }"
    >
      <slot />
    </div>
    <footer v-if="$slots.footer" class="settings-card__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.settings-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
}

.settings-card__copy {
  display: grid;
  min-width: 0;
  gap: 0.22rem;
}

.settings-card__copy h3 {
  margin: 0;
  font-size: 0.88rem;
}

.settings-card__copy p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.55;
}

.settings-card__aside {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5rem;
}

.settings-card__body {
  display: grid;
  min-width: 0;
  gap: 1rem;
  padding: 1.15rem;
}

.settings-card__header + .settings-card__body {
  padding-top: 0.15rem;
}

.settings-card__body--flush,
.settings-card__header + .settings-card__body--flush {
  gap: 0;
  padding: 0;
}

.settings-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.75rem 1.15rem;
  border-top: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-page) 55%, var(--surface-card));
}

@media (max-width: 599px) {
  .settings-card__header {
    padding: 0.9rem 0.95rem;
  }

  .settings-card__body {
    padding: 0.95rem;
  }

  .settings-card__footer {
    padding: 0.7rem 0.95rem;
  }
}
</style>

<style>
.settings-card input:not([type='radio'], [type='checkbox']),
.settings-card textarea {
  border-color: var(--border-strong);
}

.settings-card input:not([type='radio'], [type='checkbox']):focus,
.settings-card textarea:focus {
  border-color: var(--accent);
}

.settings-card input[aria-invalid='true'],
.settings-card textarea[aria-invalid='true'] {
  border-color: var(--danger);
}
</style>
