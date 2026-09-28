<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type {
  JournalAdminResumeSummary,
  JournalResumeAccessInput,
  JournalResumeAccessMode,
} from '../../types';
import { formatEntryTime } from '../../utils/formatters';
import SettingsCard from './SettingsCard.vue';

const props = defineProps<{
  summary: JournalAdminResumeSummary;
  busy: boolean;
  shareUrl: string | null;
}>();

const emit = defineEmits<{
  update: [input: JournalResumeAccessInput];
  copyShareUrl: [];
}>();

type TemporaryPreset = '1h' | '24h' | '3d' | '7d' | 'custom';

const presetOptions: Array<{ value: TemporaryPreset; label: string }> = [
  { value: '1h', label: '1 小时' },
  { value: '24h', label: '24 小时' },
  { value: '3d', label: '3 天' },
  { value: '7d', label: '7 天' },
  { value: 'custom', label: '自定义' },
];

const presetDurations: Record<Exclude<TemporaryPreset, 'custom'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const maxTemporaryMs = 30 * 24 * 60 * 60 * 1000;
const modeOptions: Array<{ value: JournalResumeAccessMode; label: string; description: string }> = [
  { value: 'private', label: '仅自己可见', description: '保存后立即撤销当前口令会话或限时链接' },
  { value: 'protected', label: '访问口令', description: '访客在「关于我」入口输入 6 位口令解锁' },
  { value: 'temporary', label: '限时链接', description: '生成带随机 token 的地址，到期后自动失效' },
  { value: 'public', label: '完全公开', description: '任何人都可以访问并下载' },
];
const modeLabels = Object.fromEntries(
  modeOptions.map(option => [option.value, option.label]),
) as Record<JournalResumeAccessMode, string>;

const selectedMode = shallowRef<JournalResumeAccessMode>(props.summary.accessMode);
const password = shallowRef('');
const presetValue = shallowRef<TemporaryPreset>('24h');
const customExpiresAt = shallowRef('');

const passwordValid = computed(() => /^\d{6}$/.test(password.value));

const temporaryExpiresAt = computed<string | null>(() => {
  if (selectedMode.value !== 'temporary') return null;
  const selectedPreset = presetValue.value;
  if (selectedPreset === 'custom') {
    if (!customExpiresAt.value) return null;
    const date = new Date(customExpiresAt.value);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getTime() > Date.now() + maxTemporaryMs) return null;
    return date.toISOString();
  }
  return new Date(Date.now() + presetDurations[selectedPreset]).toISOString();
});

const canSave = computed(() => {
  if (props.busy) return false;
  if (selectedMode.value === 'protected') return passwordValid.value;
  if (selectedMode.value === 'temporary') return temporaryExpiresAt.value !== null;
  return true;
});

function selectPreset(preset: TemporaryPreset): void {
  presetValue.value = preset;
}

function save(): void {
  if (!canSave.value) return;
  if (selectedMode.value === 'protected') {
    emit('update', { accessMode: 'protected', password: password.value });
    return;
  }
  if (selectedMode.value === 'temporary') {
    if (!temporaryExpiresAt.value) return;
    emit('update', { accessMode: 'temporary', expiresAt: temporaryExpiresAt.value });
    return;
  }
  emit('update', { accessMode: selectedMode.value });
}
</script>

<template>
  <SettingsCard title="访问权限" description="选择访客查看这份简历的方式，保存后立即生效。">
    <template #aside>
      <span class="resume-access__current">当前：{{ modeLabels[summary.accessMode] }}</span>
    </template>

    <div class="resume-access__options" role="radiogroup" aria-label="简历访问权限">
      <label v-for="option in modeOptions" :key="option.value" class="resume-access__option">
        <input v-model="selectedMode" type="radio" name="resume-access-mode" :value="option.value" :disabled="busy">
        <span>
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </span>
      </label>
    </div>

    <div v-if="selectedMode === 'protected'" class="resume-access__detail">
      <label class="field">
        <span class="field__label">访问口令</span>
        <input
          v-model="password"
          type="password"
          inputmode="numeric"
          maxlength="6"
          autocomplete="new-password"
          placeholder="6 位数字口令"
          :aria-invalid="password ? !passwordValid : undefined"
        >
      </label>
      <small v-if="password && !passwordValid" class="resume-access__error">
        请输入 6 位数字口令
      </small>
      <small v-else class="resume-access__hint">页面不会回显已有口令，保存后以新口令为准。</small>
    </div>

    <div v-if="selectedMode === 'temporary'" class="resume-access__detail">
      <span class="field__label">有效期</span>
      <div class="resume-access__presets">
        <button
          v-for="preset in presetOptions"
          :key="preset.value"
          class="resume-access__preset"
          :class="{ 'resume-access__preset--active': presetValue === preset.value }"
          type="button"
          :aria-pressed="presetValue === preset.value"
          :disabled="busy"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
      <label v-if="presetValue === 'custom'" class="field">
        <span class="field__label">自定义到期时间（不超过 30 天）</span>
        <input v-model="customExpiresAt" type="datetime-local" :disabled="busy">
      </label>
      <dl v-if="summary.temporaryShare" class="resume-access__share-times">
        <div>
          <dt>创建</dt>
          <dd>{{ formatEntryTime(summary.temporaryShare.createdAt) }}</dd>
        </div>
        <div>
          <dt>到期</dt>
          <dd>{{ formatEntryTime(summary.temporaryShare.expiresAt) }}</dd>
        </div>
      </dl>
      <label v-if="shareUrl" class="field">
        <span class="field__label">本次生成的限时链接</span>
        <span class="resume-access__link-row">
          <input :value="shareUrl" type="text" readonly>
          <button
            class="button button--quiet"
            type="button"
            :disabled="busy"
            @click="emit('copyShareUrl')"
          >
            复制链接
          </button>
        </span>
        <small class="resume-access__hint">完整链接只在本次生成后显示；离开页面后需要重新生成。</small>
      </label>
    </div>

    <template #footer>
      <small class="resume-access__footer-hint">
        <template v-if="selectedMode === 'temporary'">重新生成限时链接会立即替换旧链接。</template>
        <template v-else-if="selectedMode === 'public'">任何访客都可以从「关于我」进入、阅读并下载这份简历。</template>
      </small>
      <button
        class="button button--primary"
        type="button"
        :disabled="!canSave"
        :aria-busy="busy"
        @click="save"
      >
        {{ selectedMode === 'temporary' ? '生成限时链接' : '保存权限' }}
      </button>
    </template>
  </SettingsCard>
</template>

<style scoped>
.resume-access__current {
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.resume-access__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.resume-access__option {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.resume-access__option:hover {
  border-color: var(--border-strong);
}

.resume-access__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.resume-access__option:has(input:disabled) {
  cursor: wait;
}

.resume-access__option input {
  flex: none;
  margin: 0.18rem 0 0;
  accent-color: var(--accent);
}

.resume-access__option span {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.resume-access__option strong {
  font-size: 0.82rem;
}

.resume-access__option small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.5;
}

.resume-access__detail {
  display: grid;
  gap: 0.6rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-subtle);
}

.resume-access__detail input {
  width: 100%;
}

.resume-access__error,
.resume-access__hint {
  font-size: 0.7rem;
  line-height: 1.5;
}

.resume-access__error {
  color: var(--danger);
}

.resume-access__hint {
  color: var(--text-muted);
}

.resume-access__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.resume-access__preset {
  min-height: 2.2rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-card);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.76rem;
}

.resume-access__preset:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.resume-access__preset--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 650;
}

.resume-access__share-times {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.25rem;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.resume-access__share-times div {
  display: flex;
  gap: 0.4rem;
}

.resume-access__share-times dd {
  margin: 0;
  color: var(--text-primary);
}

.resume-access__link-row {
  display: flex;
  min-width: 0;
  gap: 0.5rem;
}

.resume-access__link-row input {
  min-width: 0;
  flex: 1 1 auto;
}

.resume-access__link-row .button {
  flex: none;
}

.resume-access__footer-hint {
  min-width: 0;
  margin-right: auto;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.5;
}

@media (max-width: 599px) {
  .resume-access__options {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
