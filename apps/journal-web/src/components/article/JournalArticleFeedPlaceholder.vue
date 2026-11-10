<template>
  <div class="index-placeholder" role="status" aria-label="正在读取文章">
    <div class="index-placeholder__lead">
      <div class="index-placeholder__lead-copy">
        <span class="index-placeholder__bar index-placeholder__bar--date" />
        <span class="index-placeholder__bar index-placeholder__bar--headline" />
        <span class="index-placeholder__bar index-placeholder__bar--headline-short" />
        <span class="index-placeholder__bar index-placeholder__bar--line" />
        <span class="index-placeholder__bar index-placeholder__bar--line-short" />
      </div>
      <span class="index-placeholder__bar index-placeholder__plate" />
    </div>

    <div v-for="index in 4" :key="index" class="index-placeholder__row">
      <span class="index-placeholder__bar index-placeholder__bar--day" />
      <div class="index-placeholder__row-copy">
        <span class="index-placeholder__bar index-placeholder__bar--title" />
        <span class="index-placeholder__bar index-placeholder__bar--line" />
        <span class="index-placeholder__bar index-placeholder__bar--line-short" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.index-placeholder {
  display: grid;
}

.index-placeholder__lead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 36%);
  gap: clamp(1.5rem, 3cqi, 3rem);
  margin-bottom: 2.75rem;
  padding: clamp(1rem, 0.5rem + 2.2cqi, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: 1.25rem;
  background: var(--surface-card);
}

.index-placeholder__lead-copy,
.index-placeholder__row-copy {
  display: grid;
  min-width: 0;
  align-content: start;
}

.index-placeholder__lead-copy {
  gap: 0.9rem;
}

.index-placeholder__row-copy {
  gap: 0.7rem;
}

.index-placeholder__row {
  position: relative;
  display: grid;
  grid-template-columns: var(--index-date-col) minmax(0, 1fr);
  column-gap: var(--index-gap);
  padding: 1.55rem 1rem 1.55rem 0;
}

.index-placeholder__row::before {
  position: absolute;
  inset: 0 0 0 calc(var(--index-date-col) + var(--index-gap) / 2);
  border-top: 1px solid var(--border-subtle);
  border-left: 1px solid var(--border-subtle);
  content: '';
}

.index-placeholder__bar {
  display: block;
  border-radius: 6px;
  background: var(--surface-muted);
  animation: index-placeholder-pulse 1.4s ease-in-out infinite;
}

.index-placeholder__bar--date {
  width: 8.5rem;
  height: 2.6rem;
}

.index-placeholder__bar--headline {
  width: 88%;
  height: 2rem;
}

.index-placeholder__bar--headline-short {
  width: 54%;
  height: 2rem;
}

.index-placeholder__bar--title {
  width: min(32rem, 78%);
  height: 1.5rem;
}

.index-placeholder__bar--line {
  width: min(44rem, 94%);
  height: 0.8rem;
}

.index-placeholder__bar--line-short {
  width: min(28rem, 60%);
  height: 0.8rem;
}

.index-placeholder__bar--day {
  width: 2.6rem;
  height: 2.2rem;
  justify-self: end;
}

.index-placeholder__plate {
  min-height: 15rem;
  border-radius: var(--radius-media);
}

@keyframes index-placeholder-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@container article-index (max-width: 819px) {
  .index-placeholder__lead {
    grid-template-columns: minmax(0, 1fr);
  }

  .index-placeholder__plate {
    min-height: 0;
    order: -1;
    aspect-ratio: 5 / 2;
  }
}

@container article-index (max-width: 599px) {
  .index-placeholder__lead {
    margin-bottom: 2rem;
  }

  .index-placeholder__row {
    padding: 1.1rem 0;
  }

  .index-placeholder__bar--day {
    width: 1.7rem;
    height: 1.5rem;
  }
}
</style>
