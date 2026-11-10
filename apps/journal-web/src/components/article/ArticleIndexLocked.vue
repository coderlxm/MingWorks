<script setup lang="ts">
import { Lock } from '@element-plus/icons-vue';
import type { ProtectedJournalEntryPreview } from '../../types';
import ArticleIndexDate from './ArticleIndexDate.vue';

defineProps<{
  entry: ProtectedJournalEntryPreview;
}>();

const emit = defineEmits<{
  open: [entry: ProtectedJournalEntryPreview];
}>();
</script>

<template>
  <article class="index-locked" @click="emit('open', entry)">
    <ArticleIndexDate
      class="index-locked__date"
      :source-created-at="entry.sourceCreatedAt"
      layout="rail"
    />

    <button class="index-locked__button" type="button" aria-label="加密文章，输入密码查看">
      <span class="index-locked__icon" aria-hidden="true">
        <Lock />
      </span>
      <span class="index-locked__title">加密文章</span>
      <span class="index-locked__action">输入密码查看</span>
    </button>
  </article>
</template>

<style scoped>
.index-locked {
  --locked-pad: 1.55rem;
  --locked-title-size: clamp(1.18rem, 0.95rem + 0.75cqi, 1.55rem);
  --locked-rail: calc(var(--index-date-col) + var(--index-gap) / 2);

  position: relative;
  display: grid;
  grid-template-columns: var(--index-date-col) minmax(0, 1fr);
  column-gap: var(--index-gap);
  padding: var(--locked-pad) 1rem var(--locked-pad) 0;
  cursor: pointer;
  isolation: isolate;
}

.index-locked::before {
  position: absolute;
  z-index: -1;
  inset: 0 0 0 var(--locked-rail);
  border-top: 1px solid var(--border-subtle);
  border-left: 1px solid var(--border-subtle);
  background-image: repeating-linear-gradient(
    -45deg,
    transparent 0 0.5rem,
    color-mix(in srgb, var(--text-primary) 3.5%, transparent) 0.5rem calc(0.5rem + 1px)
  );
  content: '';
  transition: background-color 220ms ease;
}

.index-locked::after {
  position: absolute;
  top: calc(var(--locked-pad) + var(--locked-title-size) * 0.7 - 0.25rem);
  left: calc(var(--locked-rail) - 0.25rem + 0.5px);
  box-sizing: border-box;
  width: 0.5rem;
  height: 0.5rem;
  border: 1.5px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-page);
  content: '';
  transition: border-color 220ms ease, background-color 220ms ease, transform 220ms var(--ease-card);
}

.index-locked:hover::before,
.index-locked:focus-within::before {
  background-color: color-mix(in srgb, var(--surface-muted) 42%, transparent);
}

.index-locked:hover::after,
.index-locked:focus-within::after {
  border-color: var(--accent);
  background: var(--accent);
  transform: scale(1.3);
}

.index-locked:hover :deep(.index-date__day),
.index-locked:focus-within :deep(.index-date__day) {
  color: var(--accent-strong);
}

.index-locked__date {
  justify-self: end;
}

.index-locked__button {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  align-self: start;
  gap: 0.4rem 0.7rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.index-locked__icon {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  flex: none;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-strong);
  place-items: center;
}

.index-locked__icon svg {
  width: 0.95rem;
  height: 0.95rem;
}

.index-locked__title {
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: var(--locked-title-size);
  font-weight: 750;
  line-height: 1.4;
}

.index-locked__action {
  margin-left: auto;
  color: var(--accent-strong);
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

@container article-index (max-width: 599px) {
  .index-locked {
    --locked-pad: 1.1rem;

    padding-right: 0;
  }

  .index-locked__icon {
    width: 1.6rem;
    height: 1.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .index-locked:hover::after {
    transform: none;
  }
}
</style>
