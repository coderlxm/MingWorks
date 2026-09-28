<script setup lang="ts">
import { ArrowLeft, ArrowRight, Close } from '@element-plus/icons-vue';
import { reactive } from 'vue';
import type { ChannelTags, JournalChannel } from '../../types';
import { showMessage } from '../../utils/message';
import SettingsCard from './SettingsCard.vue';
import SettingsSection from './SettingsSection.vue';

const MAX_CHANNEL_TAGS = 8;
const MAX_CHANNEL_TAG_LENGTH = 32;

type ChannelTagKey = JournalChannel;

const channelTags = defineModel<ChannelTags>({ required: true });

const props = withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const channelTagGroups: Array<{ key: ChannelTagKey; label: string }> = [
  { key: 'life', label: '生活' },
  { key: 'article', label: '文章' },
  { key: 'interest', label: '兴趣' },
];

const tagInputs = reactive<Record<ChannelTagKey, string>>({
  life: '',
  article: '',
  interest: '',
});

function replaceChannelTags(channel: ChannelTagKey, tags: string[]): void {
  channelTags.value = {
    ...channelTags.value,
    [channel]: tags,
  };
}

function addChannelTag(channel: ChannelTagKey): void {
  const tag = tagInputs[channel].trim();
  if (!tag) return;
  if (tag.includes('#')) {
    showMessage({ message: '标签名称不需要输入 #。', type: 'error' });
    return;
  }
  if (tag === '全部') {
    showMessage({ message: '“全部”是固定入口，不需要配置。', type: 'error' });
    return;
  }

  const tags = channelTags.value[channel];
  if (tags.includes(tag)) {
    showMessage({ message: `“${tag}”已经在当前频道中。`, type: 'error' });
    return;
  }
  if (tags.length >= MAX_CHANNEL_TAGS) {
    showMessage({ message: `每个频道最多配置 ${MAX_CHANNEL_TAGS} 个标签。`, type: 'error' });
    return;
  }

  replaceChannelTags(channel, [...tags, tag]);
  tagInputs[channel] = '';
}

function removeChannelTag(channel: ChannelTagKey, index: number): void {
  replaceChannelTags(channel, channelTags.value[channel].filter((_, itemIndex) => itemIndex !== index));
}

function moveChannelTag(channel: ChannelTagKey, index: number, offset: -1 | 1): void {
  const tags = [...channelTags.value[channel]];
  const targetIndex = index + offset;
  [tags[index], tags[targetIndex]] = [tags[targetIndex]!, tags[index]!];
  replaceChannelTags(channel, tags);
}
</script>

<template>
  <SettingsSection
    title="频道标签"
    :description="`编排公开信息流中常驻的标签入口及展示顺序，每个频道最多 ${MAX_CHANNEL_TAGS} 个，“全部”入口固定显示。`"
  >
    <SettingsCard
      v-for="group in channelTagGroups"
      :key="group.key"
      :title="`${group.label}频道`"
    >
      <template #aside>
        <span class="channel-tags__count">{{ channelTags[group.key].length }} / {{ MAX_CHANNEL_TAGS }}</span>
      </template>

      <ol v-if="channelTags[group.key].length" class="channel-tags__list">
        <li
          v-for="(tag, index) in channelTags[group.key]"
          :key="tag"
          class="channel-tags__chip"
        >
          <span class="channel-tags__order">{{ index + 1 }}</span>
          <span class="channel-tags__name" :title="tag">{{ tag }}</span>
          <span class="channel-tags__actions">
            <button
              type="button"
              :aria-label="`向前移动${tag}`"
              :disabled="props.disabled || index === 0"
              @click="moveChannelTag(group.key, index, -1)"
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              :aria-label="`向后移动${tag}`"
              :disabled="props.disabled || index === channelTags[group.key].length - 1"
              @click="moveChannelTag(group.key, index, 1)"
            >
              <ArrowRight aria-hidden="true" />
            </button>
            <button
              class="channel-tags__remove"
              type="button"
              :aria-label="`删除${tag}`"
              :disabled="props.disabled"
              @click="removeChannelTag(group.key, index)"
            >
              <Close aria-hidden="true" />
            </button>
          </span>
        </li>
      </ol>
      <p v-else class="channel-tags__empty">暂未配置常驻标签，访客只会看到“全部”。</p>

      <div class="channel-tags__input-row">
        <input
          v-model="tagInputs[group.key]"
          type="text"
          :maxlength="MAX_CHANNEL_TAG_LENGTH"
          :placeholder="`添加${group.label}标签`"
          :aria-label="`添加${group.label}标签`"
          :disabled="props.disabled || channelTags[group.key].length >= MAX_CHANNEL_TAGS"
          @keydown.enter.prevent="addChannelTag(group.key)"
        >
        <button
          class="button button--quiet"
          type="button"
          :disabled="props.disabled || channelTags[group.key].length >= MAX_CHANNEL_TAGS"
          @click="addChannelTag(group.key)"
        >
          添加
        </button>
      </div>
    </SettingsCard>
  </SettingsSection>
</template>

<style scoped>
.channel-tags__count {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.channel-tags__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.channel-tags__chip {
  display: inline-flex;
  max-width: 100%;
  min-height: 2.1rem;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.25rem 0.2rem 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-page);
}

.channel-tags__order {
  display: inline-grid;
  width: 1.35rem;
  height: 1.35rem;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
}

.channel-tags__name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-tags__actions {
  display: inline-flex;
  flex: none;
  align-items: center;
}

.channel-tags__actions button {
  display: inline-grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.channel-tags__actions svg {
  width: 0.72rem;
  height: 0.72rem;
}

.channel-tags__actions button:hover:not(:disabled) {
  background: var(--surface-card);
  color: var(--accent-strong);
}

.channel-tags__actions button:disabled {
  cursor: default;
  opacity: 0.3;
}

.channel-tags__actions .channel-tags__remove:hover:not(:disabled) {
  color: var(--danger);
}

.channel-tags__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.74rem;
}

.channel-tags__input-row {
  display: flex;
  gap: 0.5rem;
}

.channel-tags__input-row input {
  min-width: 0;
  flex: 1;
}

.channel-tags__input-row .button {
  flex: none;
}
</style>
