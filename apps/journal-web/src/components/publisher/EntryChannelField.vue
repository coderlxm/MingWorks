<script setup lang="ts">
import { plainJournalChannels } from '../../journalChannels';
import type { JournalPlainChannel } from '../../types';

const channel = defineModel<JournalPlainChannel>({ required: true });

defineProps<{
  disabled: boolean;
}>();
</script>

<template>
  <fieldset class="channel-field" :disabled="disabled">
    <legend class="channel-field__label">内容频道</legend>
    <label
      v-for="option in plainJournalChannels"
      :key="option.value"
      class="channel-field__option"
      :title="option.description"
    >
      <input v-model="channel" type="radio" :value="option.value">
      <span>{{ option.label }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.channel-field {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.channel-field__label {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.channel-field__option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: 0.86rem;
  cursor: pointer;
}

.channel-field__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.channel-field__option:has(input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.channel-field__option input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
