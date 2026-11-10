<script setup lang="ts">
import { Flag, Unlock } from '@element-plus/icons-vue';
import { computed } from 'vue';
import type { JournalEntry } from '../../types';
import { resolveJournalCardImageSource } from '../../utils/journalMedia';
import EntryInteractionSummary from '../interaction/EntryInteractionSummary.vue';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';
import ArticleIndexDate from './ArticleIndexDate.vue';

const CHARACTERS_PER_MINUTE = 400;
const LEAD_SUMMARY_LENGTH = 240;
const ROW_SUMMARY_LENGTH = 160;

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  lead?: boolean;
  showYear?: boolean;
  reactionPending?: boolean;
}>(), {
  lead: false,
  showYear: false,
  reactionPending: false,
});

const emit = defineEmits<{
  openEntry: [entry: JournalEntry];
  selectTag: [tag: string];
  toggleReaction: [entry: JournalEntry];
  openComments: [entry: JournalEntry];
}>();

const characterCountFormatter = new Intl.NumberFormat('zh-CN');

const cover = computed(() => props.entry.assets.find(asset =>
  asset.sourceKind === 'web' && asset.role === 'cover') ?? null);
const summary = computed(() => props.entry.contentText
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, props.lead ? LEAD_SUMMARY_LENGTH : ROW_SUMMARY_LENGTH));
const characterCount = computed(() => props.entry.contentText.replace(/\s+/g, '').length);
const formattedCharacterCount = computed(() => characterCountFormatter.format(characterCount.value));
const readingMinutes = computed(() =>
  Math.max(1, Math.round(characterCount.value / CHARACTERS_PER_MINUTE)));
const titleInitial = computed(() => props.entry.title?.match(/[\p{L}\p{N}]/u)?.[0] ?? null);

function openEntry(): void {
  emit('openEntry', props.entry);
}

function handleEntryClick(event: MouseEvent): void {
  if ((event.target as Element).closest('button, a')) return;
  openEntry();
}
</script>

<template>
  <article
    class="index-entry"
    :class="{
      'index-entry--lead': lead,
      'index-entry--with-cover': cover,
    }"
    @click="handleEntryClick"
  >
    <ArticleIndexDate
      class="index-entry__date"
      :source-created-at="entry.sourceCreatedAt"
      :layout="lead ? 'strip' : 'rail'"
      :show-year="lead || showYear"
    />

    <div class="index-entry__main">
      <component :is="lead ? 'h2' : 'h3'" v-if="entry.title" class="index-entry__title">
        <button type="button" class="index-entry__title-button" @click="openEntry">
          <span class="index-entry__title-text">{{ entry.title }}</span>
        </button>
      </component>

      <p v-if="summary" class="index-entry__summary">{{ summary }}</p>

      <p class="index-entry__meta">
        <span v-if="entry.pinned" class="index-entry__stamp index-entry__stamp--solid">
          <Flag aria-hidden="true" />置顶
        </span>
        <span v-if="entry.aiGenerated" class="index-entry__stamp">AI 生成</span>
        <span class="index-entry__reading">
          {{ formattedCharacterCount }} 字<span aria-hidden="true"> · </span>约 {{ readingMinutes }} 分钟
        </span>
        <span
          v-if="entry.visibility === 'protected'"
          class="index-entry__unlocked"
          title="已解锁的加密内容"
          aria-label="已解锁的加密内容"
          role="img"
        >
          <Unlock aria-hidden="true" />
        </span>
      </p>
    </div>

    <div class="index-entry__aside">
      <div v-if="entry.tags.length" class="index-entry__tags" aria-label="标签">
        <button
          v-for="tag in entry.tags"
          :key="tag"
          class="index-entry__tag"
          type="button"
          @click="emit('selectTag', tag)"
        >
          #{{ tag }}
        </button>
      </div>

      <div class="index-entry__interactions">
        <EntryInteractionSummary
          :summary="entry.interactions"
          interactive
          :reaction-pending="reactionPending"
          @toggle-reaction="emit('toggleReaction', entry)"
          @open-comments="emit('openComments', entry)"
        />
      </div>
    </div>

    <figure
      v-if="cover || lead"
      class="index-entry__visual"
      :class="{ 'index-entry__visual--plate': !cover }"
    >
      <JournalProgressiveImage
        v-if="cover"
        class="index-entry__image"
        :src="resolveJournalCardImageSource(cover)"
        :preview-src="cover.previewUrl!"
        :alt="entry.title ?? '文章封面'"
        fit="cover"
        loading="lazy"
      />
      <span v-else class="index-entry__plate" aria-hidden="true">
        <span v-if="titleInitial" class="index-entry__plate-glyph">{{ titleInitial }}</span>
      </span>
    </figure>
  </article>
</template>

<style scoped>
.index-entry {
  --entry-pad: 1.55rem;
  --entry-title-size: clamp(1.18rem, 0.95rem + 0.75cqi, 1.55rem);
  --entry-rail: calc(var(--index-date-col) + var(--index-gap) / 2);

  position: relative;
  display: grid;
  grid-template-areas: "date main aside";
  grid-template-columns: var(--index-date-col) minmax(0, 1fr) 15rem;
  column-gap: var(--index-gap);
  padding: var(--entry-pad) 1rem var(--entry-pad) 0;
  cursor: pointer;
  isolation: isolate;
}

.index-entry--with-cover {
  grid-template-areas: "date main aside visual";
  grid-template-columns: var(--index-date-col) minmax(0, 1fr) 15rem 11rem;
}

/* Row rule, timeline rail and hover band share one layer behind the content. */
.index-entry::before {
  position: absolute;
  z-index: -1;
  inset: 0 0 0 var(--entry-rail);
  border-top: 1px solid var(--border-subtle);
  border-left: 1px solid var(--border-subtle);
  content: '';
  transition: background-color 220ms ease;
}

.index-entry::after {
  position: absolute;
  top: calc(var(--entry-pad) + var(--entry-title-size) * 0.7 - 0.25rem);
  left: calc(var(--entry-rail) - 0.25rem + 0.5px);
  box-sizing: border-box;
  width: 0.5rem;
  height: 0.5rem;
  border: 1.5px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-page);
  content: '';
  transition: border-color 220ms ease, background-color 220ms ease, transform 220ms var(--ease-card);
}

.index-entry:hover::before,
.index-entry:focus-within::before {
  background-color: color-mix(in srgb, var(--surface-muted) 42%, transparent);
}

.index-entry:hover::after,
.index-entry:focus-within::after {
  border-color: var(--accent);
  background: var(--accent);
  transform: scale(1.3);
}

.index-entry:hover :deep(.index-date__day),
.index-entry:focus-within :deep(.index-date__day) {
  color: var(--accent-strong);
}

.index-entry__date {
  grid-area: date;
  justify-self: end;
}

.index-entry__main {
  display: grid;
  grid-area: main;
  min-width: 0;
  align-content: start;
  gap: 0.55rem;
}

.index-entry__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--entry-title-size);
  font-weight: 750;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.index-entry__title-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.index-entry__title-text {
  padding-bottom: 0.06em;
  background: linear-gradient(var(--accent), var(--accent)) 0 100% / 0 1px no-repeat;
  transition: background-size 420ms var(--ease-card);
}

.index-entry:hover .index-entry__title-text,
.index-entry:focus-within .index-entry__title-text {
  background-size: 100% 1px;
}

.index-entry__summary {
  display: -webkit-box;
  max-width: 48rem;
  margin: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.75;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.index-entry__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  margin: 0.1rem 0 0;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.74rem;
  letter-spacing: 0.05em;
  line-height: 1.3;
}

.index-entry__stamp {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.12rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 3px;
  color: var(--accent-strong);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.index-entry__stamp--solid {
  border-color: transparent;
  background: var(--accent-soft);
}

.index-entry__stamp svg,
.index-entry__unlocked svg {
  width: 0.78rem;
  height: 0.78rem;
}

.index-entry__reading {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.index-entry__unlocked {
  display: inline-grid;
  color: var(--accent-strong);
  place-items: center;
}

.index-entry__aside {
  display: flex;
  grid-area: aside;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
  padding-top: 0.3rem;
}

.index-entry__tags {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.1rem 0.15rem;
  margin-left: -0.35rem;
}

.index-entry__tag {
  max-width: 100%;
  padding: 0.12rem 0.35rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.76rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: left;
  transition: color 150ms ease, background-color 150ms ease;
}

.index-entry__tag:hover,
.index-entry__tag:focus-visible {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.index-entry__interactions {
  display: flex;
  flex: none;
  align-items: center;
  margin-left: -0.35rem;
}

.index-entry__visual {
  position: relative;
  grid-area: visual;
  align-self: start;
  width: 100%;
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
  aspect-ratio: 3 / 2;
}

.index-entry__visual .index-entry__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transition: transform 700ms var(--ease-card);
}

.index-entry:hover .index-entry__visual .index-entry__image {
  transform: scale(1.04);
}

@container article-index (max-width: 999px) {
  .index-entry {
    grid-template-areas:
      "date main"
      "date aside";
    grid-template-columns: var(--index-date-col) minmax(0, 1fr);
    row-gap: 0.7rem;
  }

  .index-entry--with-cover {
    grid-template-areas:
      "date main visual"
      "date aside visual";
    grid-template-columns: var(--index-date-col) minmax(0, 1fr) 8.5rem;
  }

  .index-entry__aside {
    flex-direction: row;
    align-items: flex-end;
    padding-top: 0;
  }

  .index-entry__interactions {
    margin-left: auto;
  }
}

@container article-index (max-width: 599px) {
  .index-entry {
    --entry-pad: 1.1rem;

    padding-right: 0;
  }

  .index-entry--with-cover {
    grid-template-areas:
      "date main visual"
      "date aside aside";
    grid-template-columns: var(--index-date-col) minmax(0, 1fr) 4.75rem;
  }

  .index-entry__visual {
    aspect-ratio: 1;
  }

  .index-entry__summary {
    font-size: 0.84rem;
    line-height: 1.65;
  }

  .index-entry__tag {
    font-size: 0.72rem;
  }
}

/* Lead story: the newest entry becomes the cover of the index. */
.index-entry--lead {
  --entry-title-size: clamp(1.5rem, 1rem + 2cqi, 2.7rem);

  grid-template-areas:
    "date visual"
    "main visual"
    "aside visual";
  grid-template-rows: auto 1fr auto;
  grid-template-columns: minmax(0, 1fr) minmax(0, 36%);
  gap: 1.15rem clamp(1.5rem, 3cqi, 3rem);
  padding: clamp(1rem, 0.5rem + 2.2cqi, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: 1.25rem;
  background: var(--surface-card);
  transition: border-color 180ms ease, transform 180ms ease;
}

.index-entry--lead::before,
.index-entry--lead::after {
  content: none;
}

.index-entry--lead:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.index-entry--lead .index-entry__date {
  justify-self: start;
}

.index-entry--lead .index-entry__main {
  gap: 0.8rem;
}

.index-entry--lead .index-entry__title {
  font-weight: 800;
  line-height: 1.28;
}

.index-entry--lead .index-entry__summary {
  max-width: 52rem;
  color: color-mix(in srgb, var(--text-primary) 78%, transparent);
  font-size: 1rem;
  line-height: 1.85;
  -webkit-line-clamp: 3;
}

.index-entry--lead .index-entry__aside {
  flex-direction: row;
  align-items: flex-end;
  padding-top: 0.9rem;
  border-top: 1px solid var(--border-subtle);
}

.index-entry--lead .index-entry__interactions {
  margin-left: auto;
}

.index-entry--lead .index-entry__visual {
  min-height: 15rem;
  align-self: stretch;
  aspect-ratio: auto;
}

.index-entry__plate {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 86% 14%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 48%),
    linear-gradient(
      90deg,
      transparent 2.1rem,
      color-mix(in srgb, var(--accent) 55%, transparent) 2.1rem calc(2.1rem + 1px),
      transparent calc(2.1rem + 1px)
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 1.85rem,
      color-mix(in srgb, var(--text-primary) 7%, transparent) 1.85rem calc(1.85rem + 1px)
    ),
    var(--surface-page);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  container-type: size;
}

.index-entry__plate-glyph {
  position: absolute;
  right: 6cqw;
  bottom: -0.16em;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: min(98cqh, 62cqw);
  font-weight: 800;
  line-height: 1;
  transition: transform 700ms var(--ease-card);
}

.index-entry--lead:hover .index-entry__plate-glyph {
  transform: translate(-0.02em, -0.03em);
}

@container article-index (max-width: 819px) {
  .index-entry--lead {
    grid-template-areas:
      "visual"
      "date"
      "main"
      "aside";
    grid-template-rows: auto;
    grid-template-columns: minmax(0, 1fr);
  }

  .index-entry--lead .index-entry__visual {
    min-height: 0;
    aspect-ratio: 16 / 9;
  }

  .index-entry--lead .index-entry__visual--plate {
    aspect-ratio: 5 / 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .index-entry--lead:hover,
  .index-entry:hover::after,
  .index-entry:hover .index-entry__visual .index-entry__image,
  .index-entry--lead:hover .index-entry__plate-glyph {
    transform: none;
  }
}
</style>
