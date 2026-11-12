<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUpdated, shallowRef } from 'vue';
import {
  isProtectedJournalEntry,
  type JournalEntry,
  type PublicJournalFeedItem,
} from '../../types';
import ArticleIndexEntry from './ArticleIndexEntry.vue';
import ArticleIndexLocked from './ArticleIndexLocked.vue';
import JournalArticleFeedPlaceholder from './JournalArticleFeedPlaceholder.vue';

interface ArticleIndexItem {
  key: string;
  entry: PublicJournalFeedItem;
  order: number;
}

interface ArticleIndexGroup {
  key: string;
  label: string;
  pinned: boolean;
  order: number;
  items: ArticleIndexItem[];
}

const FEED_PAGE_SIZE = 20;
const ENTRANCE_STAGGER_LIMIT = 10;

const props = defineProps<{
  entries: readonly PublicJournalFeedItem[];
  loading: boolean;
  reactionPendingPublicId?: string | null;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  selectTag: [tag: string];
  toggleReaction: [entry: JournalEntry];
  openComments: [entry: JournalEntry];
}>();

const yearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

// Replaying the entrance when a cached feed is shown again would read as a reload.
const entering = shallowRef(true);

let active = true;
let previousEntries = props.entries;
let previousLoading = props.loading;

function entryKey(entry: PublicJournalFeedItem): string {
  return isProtectedJournalEntry(entry) ? `protected:${entry.publicId}` : `entry:${entry.id}`;
}

const preparing = computed(() => props.loading && props.entries.length === 0);
const leadEntry = computed<JournalEntry | null>(() => {
  const first = props.entries[0];
  return first !== undefined && !isProtectedJournalEntry(first) ? first : null;
});
const groups = computed<ArticleIndexGroup[]>(() => {
  const result: ArticleIndexGroup[] = [];
  let current: ArticleIndexGroup | undefined;

  for (const [index, entry] of props.entries.entries()) {
    if (entry === leadEntry.value) continue;

    const pinned = !isProtectedJournalEntry(entry) && entry.pinned;
    const label = pinned ? '置顶' : yearFormatter.format(new Date(entry.sourceCreatedAt));
    const order = Math.min(index % FEED_PAGE_SIZE, ENTRANCE_STAGGER_LIMIT);

    if (current === undefined || current.label !== label) {
      current = { key: `${result.length}:${label}`, label, pinned, order, items: [] };
      result.push(current);
    }
    current.items.push({ key: entryKey(entry), entry, order });
  }
  return result;
});

function reportLayout(): void {
  if (preparing.value) return;
  emit('layoutReady');
}

onMounted(reportLayout);

onUpdated(() => {
  const entriesChanged = props.entries !== previousEntries;
  const loadingCompleted = previousLoading && !props.loading;

  previousEntries = props.entries;
  previousLoading = props.loading;

  if (active && (entriesChanged || (loadingCompleted && props.entries.length === 0))) reportLayout();
});

onDeactivated(() => {
  active = false;
  entering.value = false;
});

onActivated(() => {
  if (active) return;
  active = true;
  reportLayout();
});
</script>

<template>
  <div class="article-index" :aria-busy="preparing">
    <div class="article-index__body" :class="{ 'article-index__body--entering': entering }">
      <JournalArticleFeedPlaceholder v-if="preparing" />

      <template v-else>
        <div v-if="leadEntry" class="article-index__lead">
          <ArticleIndexEntry
            :entry="leadEntry"
            lead
            :reaction-pending="props.reactionPendingPublicId === leadEntry.publicId"
            @open-entry="emit('openEntry', $event)"
            @select-tag="emit('selectTag', $event)"
            @toggle-reaction="emit('toggleReaction', $event)"
            @open-comments="emit('openComments', $event)"
          />
        </div>

        <section v-for="group in groups" :key="group.key" class="article-index__group">
          <h2
            class="article-index__heading"
            :class="{ 'article-index__heading--pinned': group.pinned }"
            :style="{ '--index-order': group.order }"
          >
            <span class="article-index__heading-label">{{ group.label }}</span>
          </h2>

          <ol class="article-index__list">
            <li
              v-for="item in group.items"
              :key="item.key"
              class="article-index__item"
              :style="{ '--index-order': item.order }"
            >
              <ArticleIndexLocked
                v-if="isProtectedJournalEntry(item.entry)"
                :entry="item.entry"
                @open="emit('openEntry', $event)"
              />
              <ArticleIndexEntry
                v-else
                :entry="item.entry"
                :show-year="group.pinned"
                :reaction-pending="props.reactionPendingPublicId === item.entry.publicId"
                @open-entry="emit('openEntry', $event)"
                @select-tag="emit('selectTag', $event)"
                @toggle-reaction="emit('toggleReaction', $event)"
                @open-comments="emit('openComments', $event)"
              />
            </li>
          </ol>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.article-index {
  width: 100%;
  max-width: 82rem;
  min-width: 0;
  margin-inline: auto;
  container: article-index / inline-size;
}

.article-index__body {
  --index-date-col: 5.5rem;
  --index-gap: 2.5rem;
  --index-heading-pad: 2.75rem;
}

.article-index__group:first-of-type {
  --index-heading-pad: 2rem;
}

.article-index__heading {
  position: relative;
  display: grid;
  grid-template-columns: var(--index-date-col) minmax(0, 1fr);
  align-items: end;
  column-gap: var(--index-gap);
  margin: 0;
  padding: var(--index-heading-pad) 0 0.8rem;
}

/* The rail of each year starts beside its heading and runs down through the rows. */
.article-index__heading::before,
.article-index__heading::after {
  position: absolute;
  left: calc(var(--index-date-col) + var(--index-gap) / 2);
  bottom: 0;
  content: '';
}

.article-index__heading::before {
  top: var(--index-heading-pad);
  width: 1px;
  background: var(--border-subtle);
}

.article-index__heading::after {
  width: 2.6rem;
  height: 3px;
  background: var(--accent);
}

.article-index__heading-label {
  justify-self: end;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(1.45rem, 1.1rem + 1.2cqi, 2rem);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 0.9;
  white-space: nowrap;
}

.article-index__heading--pinned .article-index__heading-label {
  font-size: 1.15rem;
  letter-spacing: 0.08em;
  line-height: 1.1;
}

.article-index__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.article-index__body--entering .article-index__lead,
.article-index__body--entering .article-index__heading,
.article-index__body--entering .article-index__item {
  animation: article-index-rise 560ms var(--ease-card) both;
  animation-delay: calc(var(--index-order, 0) * 45ms);
}

@keyframes article-index-rise {
  from {
    opacity: 0;
    transform: translateY(0.9rem);
  }
}

@container article-index (max-width: 599px) {
  .article-index__body {
    --index-date-col: 2.6rem;
    --index-gap: 1.6rem;
    --index-heading-pad: 2rem;
  }

  .article-index__heading {
    padding-bottom: 0.65rem;
  }

  .article-index__heading::before {
    content: none;
  }

  .article-index__heading-label {
    grid-column: 1 / -1;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-index__body--entering .article-index__lead,
  .article-index__body--entering .article-index__heading,
  .article-index__body--entering .article-index__item {
    animation: none;
  }
}
</style>
