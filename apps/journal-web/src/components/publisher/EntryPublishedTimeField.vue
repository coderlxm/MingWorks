<script setup lang="ts">
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { onMounted, shallowRef } from 'vue';

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = 'Asia/Shanghai';
const enabled = defineModel<boolean>('enabled', { required: true });
const value = defineModel<string>('value', { required: true });

defineProps<{
  disabled: boolean;
}>();

const date = shallowRef('');
const time = shallowRef('');

function combine(): string {
  return dayjs.tz(`${date.value} ${time.value}`, timeZone)
    .second(0)
    .millisecond(0)
    .utc()
    .toISOString();
}

function fillNow(): void {
  const now = dayjs().tz(timeZone).second(0).millisecond(0);
  date.value = now.format('YYYY-MM-DD');
  time.value = now.format('HH:mm');
  value.value = combine();
}

function fillPublishedTime(): void {
  const publishedTime = dayjs(value.value).tz(timeZone);
  date.value = publishedTime.format('YYYY-MM-DD');
  time.value = publishedTime.format('HH:mm');
}

onMounted(() => {
  if (!enabled.value) return;
  if (value.value) fillPublishedTime();
  else fillNow();
});

function updateEnabled(event: Event): void {
  const nextEnabled = (event.target as HTMLInputElement).checked;
  enabled.value = nextEnabled;
  if (nextEnabled) {
    if (date.value && time.value) value.value = combine();
    else fillNow();
  }
  else {
    value.value = '';
  }
}

function updateDate(event: Event): void {
  date.value = (event.target as HTMLInputElement).value;
  updateValue();
}

function updateTime(event: Event): void {
  time.value = (event.target as HTMLInputElement).value;
  updateValue();
}

function updateValue(): void {
  if (!enabled.value) return;
  value.value = date.value && time.value ? combine() : '';
}
</script>

<template>
  <fieldset class="published-time-field" :disabled="disabled">
    <legend class="published-time-field__label">发布时间</legend>
    <label class="published-time-field__option">
      <input :checked="enabled" type="checkbox" @change="updateEnabled">
      <span>指定发布时间</span>
    </label>
    <div v-if="enabled" class="published-time-field__inputs">
      <label class="published-time-field__input">
        <span>日期</span>
        <input :value="date" type="date" required :disabled="disabled" @input="updateDate">
      </label>
      <label class="published-time-field__input">
        <span>时间</span>
        <input :value="time" type="time" required step="60" :disabled="disabled" @input="updateTime">
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.published-time-field {
  display: grid;
  align-content: start;
  gap: 0.45rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.published-time-field__label {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.published-time-field__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
  font-size: 0.86rem;
  cursor: pointer;
}

.published-time-field__option input {
  margin: 0;
  accent-color: var(--accent);
}

.published-time-field__inputs {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 0.5rem;
  min-width: 0;
}

.published-time-field__input {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.published-time-field__input input {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 2.25rem;
  -webkit-appearance: none;
  appearance: none;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-strong);
  border-radius: 0.5rem;
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 400;
}

.published-time-field__input input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.published-time-field__input input::-webkit-date-and-time-value {
  min-height: 1.5em;
  text-align: left;
}
</style>
