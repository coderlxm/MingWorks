<script setup lang="ts">
import { ElSwitch } from 'element-plus';
import 'element-plus/es/components/switch/style/css';
import type { SiteContactItem } from '../../types';
import SettingsCard from './SettingsCard.vue';
import SettingsSection from './SettingsSection.vue';

const props = defineProps<{
  contactItems: SiteContactItem[];
  disabled: boolean;
  maxValueLength: number;
  maxUrlLength: number;
}>();

const emit = defineEmits<{
  'update:contactItems': [contactItems: SiteContactItem[]];
}>();

const contactMetadata: Record<SiteContactItem['kind'], {
  description: string;
  valuePlaceholder: string;
  urlPlaceholder: string | null;
}> = {
  telegram: {
    description: '公开 Telegram 用户名',
    valuePlaceholder: '@xiaoming',
    urlPlaceholder: 'https://t.me/xiaoming',
  },
  email: {
    description: '公开邮箱并支持访客复制',
    valuePlaceholder: 'name@example.com',
    urlPlaceholder: 'mailto:name@example.com',
  },
  wechat: {
    description: '公开微信号，访客点击后复制',
    valuePlaceholder: '微信号',
    urlPlaceholder: null,
  },
  github: {
    description: '公开 GitHub 主页',
    valuePlaceholder: 'github.com/xiaoming',
    urlPlaceholder: 'https://github.com/xiaoming',
  },
  website: {
    description: '公开个人网站或其他个人链接',
    valuePlaceholder: 'example.com',
    urlPlaceholder: 'https://example.com',
  },
};

type ContactPatch = Partial<Pick<SiteContactItem, 'enabled' | 'value' | 'url'>>;

function updateContact(kind: SiteContactItem['kind'], patch: ContactPatch): void {
  emit('update:contactItems', props.contactItems.map(item =>
    item.kind === kind ? { ...item, ...patch } : item,
  ));
}

function updateEnabled(kind: SiteContactItem['kind'], enabled: boolean | string | number): void {
  updateContact(kind, { enabled: Boolean(enabled) });
}

function urlInvalid(url: string | null): boolean {
  const value = url?.trim();
  return !value || !URL.canParse(value);
}

function updateText(
  kind: SiteContactItem['kind'],
  field: 'value' | 'url',
  event: Event,
): void {
  updateContact(kind, { [field]: (event.target as HTMLInputElement).value });
}
</script>

<template>
  <SettingsSection title="联系方式" description="启用的联系方式会展示在「关于我」页面，访客可以直接跳转或复制。">
    <SettingsCard flush>
      <ul class="contact-list">
        <li
          v-for="item in props.contactItems"
          :key="item.kind"
          class="contact-row"
        >
          <div class="contact-row__heading">
            <div class="contact-row__copy">
              <h3>{{ item.label }}</h3>
              <p>{{ contactMetadata[item.kind].description }}</p>
            </div>
            <ElSwitch
              class="contact-row__switch"
              :model-value="item.enabled"
              :disabled="props.disabled"
              :aria-label="`${item.enabled ? '关闭' : '启用'}${item.label}`"
              @update:model-value="updateEnabled(item.kind, $event)"
            />
          </div>

          <div
            v-if="item.enabled"
            class="contact-row__fields"
            :class="{ 'contact-row__fields--single': item.kind === 'wechat' }"
          >
            <label class="field">
              <span class="field__label">展示内容</span>
              <input
                :value="item.value"
                type="text"
                :maxlength="props.maxValueLength"
                required
                :disabled="props.disabled"
                :aria-invalid="!item.value.trim()"
                :placeholder="contactMetadata[item.kind].valuePlaceholder"
                @input="updateText(item.kind, 'value', $event)"
              >
            </label>

            <label v-if="item.kind !== 'wechat'" class="field">
              <span class="field__label">跳转链接</span>
              <input
                :value="item.url ?? ''"
                type="url"
                :maxlength="props.maxUrlLength"
                required
                :disabled="props.disabled"
                :aria-invalid="urlInvalid(item.url)"
                :placeholder="contactMetadata[item.kind].urlPlaceholder ?? ''"
                @input="updateText(item.kind, 'url', $event)"
              >
            </label>
          </div>
        </li>
      </ul>
    </SettingsCard>
  </SettingsSection>
</template>

<style scoped>
.contact-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.contact-row {
  display: grid;
  gap: 0.9rem;
  padding: 1rem 1.15rem;
}

.contact-row + .contact-row {
  border-top: 1px solid var(--border-subtle);
}

.contact-row__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.contact-row__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.contact-row__copy h3 {
  margin: 0;
  font-size: 0.86rem;
}

.contact-row__copy p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.5;
}

.contact-row__switch {
  --el-switch-on-color: var(--accent);
  --el-switch-off-color: var(--border-strong);

  flex: none;
}

.contact-row__fields {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 0.75rem;
}

.contact-row__fields--single {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 599px) {
  .contact-row {
    padding: 0.9rem 0.95rem;
  }

  .contact-row__fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
