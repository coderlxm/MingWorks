<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  sourceCreatedAt: string;
  layout: 'rail' | 'strip';
  showYear?: boolean;
}>(), {
  showYear: false,
});

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  day: '2-digit',
});
const monthFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  month: 'short',
});
const yearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const fullDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const date = computed(() => new Date(props.sourceCreatedAt));
const day = computed(() => dayFormatter.format(date.value));
const month = computed(() => monthFormatter.format(date.value).toUpperCase());
const year = computed(() => yearFormatter.format(date.value));
const time = computed(() => timeFormatter.format(date.value));
const fullDateTime = computed(() => fullDateTimeFormatter.format(date.value));
</script>

<template>
  <time
    class="index-date"
    :class="`index-date--${layout}`"
    :datetime="sourceCreatedAt"
    :title="fullDateTime"
  >
    <span class="index-date__day">{{ day }}</span>
    <span class="index-date__detail">
      <span class="index-date__month">{{ month }}</span>
      <span v-if="showYear" class="index-date__year">{{ year }}</span>
      <span class="index-date__time">{{ time }}</span>
    </span>
  </time>
</template>

<style scoped>
.index-date {
  display: flex;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  line-height: 1;
  white-space: nowrap;
}

.index-date__day {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.02em;
  transition: color 200ms ease;
}

.index-date__month {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.index-date__year {
  color: var(--text-primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.index-date__time {
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
}

.index-date--rail {
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.index-date--rail .index-date__day {
  font-size: 2.5rem;
  line-height: 0.92;
}

.index-date--rail .index-date__detail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.36rem;
}

.index-date--rail .index-date__month {
  margin-right: -0.14em;
}

.index-date--strip {
  align-items: center;
  gap: 0.75rem;
  padding-left: 0.9rem;
  border-left: 3px solid var(--accent);
}

.index-date--strip .index-date__day {
  font-size: clamp(2.4rem, 1.9rem + 1.6cqi, 3.4rem);
  line-height: 0.86;
}

.index-date--strip .index-date__detail {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: start;
  gap: 0.42rem 0.45rem;
}

.index-date--strip .index-date__month,
.index-date--strip .index-date__year {
  font-size: 0.78rem;
}

.index-date--strip .index-date__time {
  grid-column: 1 / -1;
  font-size: 0.74rem;
}

@container article-index (max-width: 599px) {
  .index-date--rail {
    gap: 0.38rem;
  }

  .index-date--rail .index-date__day {
    font-size: 1.65rem;
  }

  .index-date--rail .index-date__month {
    margin-right: -0.1em;
    font-size: 0.58rem;
    letter-spacing: 0.1em;
  }

  .index-date--rail .index-date__year {
    font-size: 0.62rem;
  }

  .index-date--rail .index-date__time {
    display: none;
  }
}
</style>
