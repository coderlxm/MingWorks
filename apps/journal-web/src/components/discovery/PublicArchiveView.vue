<script setup lang="ts" name="PublicArchiveView">
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, shallowRef } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { fetchPublicDiscoveryArchive } from '../../api';
import { usePublicDiscoveryCache } from '../../composables/usePublicDiscoveryCache';
import type { JournalDiscoveryArchiveOverview } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import { discoveryErrorMessage, publicArchiveMonthPath } from './discoveryRoutes';
import { usePublicDiscoveryHead } from './usePublicDiscoveryHead';

const props = defineProps<{
  accessScope: string;
}>();

const emit = defineEmits<{
  layoutReady: [];
}>();

const route = useRoute();
const router = useRouter();
const cache = usePublicDiscoveryCache();
const years = shallowRef<JournalDiscoveryArchiveOverview['years']>([]);
const loading = shallowRef(true);
const error = shallowRef<string | null>(null);
let activeIdentity = '';

const canonicalPath = '/archive';

const almanac = computed(() => {
  const maxCount = Math.max(...years.value.flatMap(yearEntry => yearEntry.months.map(monthEntry => monthEntry.count)));
  return years.value.map((yearEntry) => {
    const counts = new Map(yearEntry.months.map(monthEntry => [monthEntry.month, monthEntry.count]));
    return {
      year: yearEntry.year,
      total: yearEntry.months.reduce((sum, monthEntry) => sum + monthEntry.count, 0),
      activeMonths: yearEntry.months.length,
      months: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const count = counts.get(month) ?? 0;
        return { month, count, ratio: count / maxCount };
      }),
    };
  });
});

function archiveHead() {
  return {
    title: '时间归档 · 小明同学',
    robots: 'index, follow' as const,
    canonicalPath,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '时间归档',
      url: new URL(canonicalPath, window.location.origin).href,
    },
  };
}

const pageHead = usePublicDiscoveryHead(archiveHead);

async function announceLayout(identityAtRequest: string): Promise<void> {
  await nextTick();
  if (activeIdentity === identityAtRequest) emit('layoutReady');
}

async function loadArchive(): Promise<void> {
  const identityAtRequest = `${props.accessScope}\u0000${canonicalPath}`;
  activeIdentity = identityAtRequest;
  error.value = null;

  const cached = cache.read<JournalDiscoveryArchiveOverview>(props.accessScope, canonicalPath);
  if (cached) {
    years.value = cached.years;
    loading.value = false;
    await announceLayout(identityAtRequest);
    return;
  }

  loading.value = true;
  try {
    const response = await fetchPublicDiscoveryArchive();
    cache.write(props.accessScope, canonicalPath, response);
    if (activeIdentity !== identityAtRequest) return;
    years.value = response.years;
  }
  catch (reason) {
    if (activeIdentity === identityAtRequest) error.value = discoveryErrorMessage(reason);
  }
  finally {
    if (activeIdentity === identityAtRequest) {
      loading.value = false;
      await announceLayout(identityAtRequest);
    }
  }
}

onBeforeRouteUpdate((to) => {
  if (to.fullPath !== canonicalPath) return canonicalPath;
  if (!activeIdentity) void loadArchive();
});

onMounted(() => {
  if (route.fullPath !== canonicalPath) {
    void router.replace(canonicalPath);
    return;
  }
  void loadArchive();
});

onUpdated(() => {
  pageHead.apply(archiveHead());
});

onBeforeUnmount(() => {
  activeIdentity = '';
});
</script>

<template>
  <main class="archive-view">
    <header class="archive-view__header">
      <p class="archive-view__eyebrow">ARCHIVE</p>
      <h1 class="archive-view__title">时间归档</h1>
      <p class="archive-view__description">按年月回看公开记录、文章与受保护内容。</p>
    </header>

    <JournalLoading v-if="loading" label="正在整理时间归档…" />

    <section v-else-if="error" class="archive-view__state archive-view__state--error" role="alert">
      <h2>归档没有加载完成</h2>
      <p>{{ error }}</p>
    </section>

    <section v-else-if="years.length === 0" class="archive-view__state" aria-live="polite">
      <h2>还没有可以归档的公开内容</h2>
      <p>公开内容发布后，会按时间出现在这里。</p>
    </section>

    <div v-else class="archive-view__years">
      <section
        v-for="yearEntry in almanac"
        :key="yearEntry.year"
        class="archive-year"
        :aria-labelledby="`archive-year-${yearEntry.year}`"
      >
        <header class="archive-year__header">
          <h2 :id="`archive-year-${yearEntry.year}`" class="archive-year__title">
            {{ yearEntry.year }}
          </h2>
          <p class="archive-year__summary">
            {{ yearEntry.total }} 项<span aria-hidden="true">/</span>{{ yearEntry.activeMonths }} 个月
          </p>
        </header>
        <ol class="archive-year__months">
          <li v-for="monthEntry in yearEntry.months" :key="monthEntry.month">
            <RouterLink
              v-if="monthEntry.count"
              class="archive-month"
              :to="publicArchiveMonthPath(yearEntry.year, monthEntry.month)"
              :aria-label="`${yearEntry.year}年${monthEntry.month}月，${monthEntry.count} 项`"
              :style="{ '--ratio': monthEntry.ratio }"
            >
              <span class="archive-month__bar" aria-hidden="true" />
              <span class="archive-month__number">{{ String(monthEntry.month).padStart(2, '0') }}</span>
              <span class="archive-month__count">{{ monthEntry.count }}</span>
            </RouterLink>
            <span v-else class="archive-month archive-month--empty" aria-hidden="true">
              <span class="archive-month__bar" />
              <span class="archive-month__number">{{ String(monthEntry.month).padStart(2, '0') }}</span>
              <span class="archive-month__count">·</span>
            </span>
          </li>
        </ol>
      </section>
    </div>
  </main>
</template>

<style scoped>
.archive-view {
  display: grid;
  width: min(calc(100% - (var(--page-gutter) * 2)), 960px);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4.2rem) 0 5rem;
}

.archive-view__header {
  display: grid;
  gap: 0.45rem;
  margin-bottom: clamp(2rem, 5vw, 3.6rem);
}

.archive-view__eyebrow,
.archive-view__title,
.archive-view__description,
.archive-view__state h2,
.archive-view__state p,
.archive-year__title {
  margin: 0;
}

.archive-view__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.archive-view__title,
.archive-view__state h2,
.archive-year__title {
  font-family: var(--font-serif);
}

.archive-view__title {
  font-size: clamp(1.7rem, 4vw, 2.45rem);
}

.archive-view__description,
.archive-view__state p {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.7;
}

.archive-view__state {
  display: grid;
  min-height: 18rem;
  align-content: center;
  gap: 0.65rem;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.archive-view__state h2 {
  font-size: 1.15rem;
}

.archive-view__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.archive-view__state--error h2,
.archive-view__state--error p {
  color: var(--danger);
}

.archive-view__years {
  display: grid;
  gap: clamp(2.8rem, 7vw, 4.8rem);
}

.archive-year {
  display: grid;
  gap: clamp(1.2rem, 3vw, 1.8rem);
}

.archive-year__header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--text-primary);
}

.archive-year__title {
  color: var(--text-primary);
  font-size: clamp(2.4rem, 7vw, 3.8rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 0.9;
}

.archive-year__summary {
  margin: 0 0 0 auto;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.74rem;
  letter-spacing: 0.06em;
}

.archive-year__summary span {
  margin: 0 0.45rem;
  color: var(--border-strong);
}

.archive-year__months {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.archive-month {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  padding-bottom: 0.4rem;
  color: inherit;
  text-decoration: none;
}

.archive-month__bar {
  position: relative;
  width: 100%;
  height: clamp(4.2rem, 10vw, 6.5rem);
  margin-bottom: 0.45rem;
  border-bottom: 1px solid var(--border-strong);
}

.archive-month__bar::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: clamp(4px, 0.9vw, 7px);
  height: max(3px, calc(var(--ratio) * 100%));
  background: var(--text-primary);
  content: '';
  transform: translateX(-50%);
  transition: background-color 150ms ease, width 150ms ease;
}

.archive-month__number {
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(0.95rem, 2vw, 1.25rem);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  transition: color 150ms ease;
}

.archive-month__count {
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  transition: color 150ms ease;
}

.archive-month:hover .archive-month__bar::after,
.archive-month:focus-visible .archive-month__bar::after {
  width: clamp(6px, 1.4vw, 11px);
  background: var(--accent);
}

.archive-month:hover .archive-month__number,
.archive-month:hover .archive-month__count,
.archive-month:focus-visible .archive-month__number,
.archive-month:focus-visible .archive-month__count {
  color: var(--accent-strong);
}

.archive-month--empty .archive-month__bar::after {
  display: none;
}

.archive-month--empty .archive-month__number,
.archive-month--empty .archive-month__count {
  color: var(--border-strong);
  font-weight: 500;
}

@media (max-width: 520px) {
  .archive-year__months {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    row-gap: 1.2rem;
  }
}
</style>
