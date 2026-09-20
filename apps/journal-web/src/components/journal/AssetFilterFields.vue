<script setup lang="ts">
import type { FeedFilters } from '../../types';

defineProps<{
  showVisibility: boolean;
  showDetails: boolean;
  stacked?: boolean;
}>();

const visibility = defineModel<FeedFilters['visibility']>('visibility', { required: true });
const tag = defineModel<string>('tag', { required: true });
const contentType = defineModel<string>('contentType', { required: true });
const emit = defineEmits<{
  change: [];
  textInput: [event: Event];
  compositionStart: [];
  compositionEnd: [];
}>();

const visibilityOptions = [
  { value: 'all', label: '全部权限' },
  { value: 'private', label: '私有' },
  { value: 'protected', label: '加密' },
  { value: 'public', label: '公开' },
] satisfies { value: FeedFilters['visibility']; label: string }[];

const contentTypes = [
  { value: '', label: '全部格式' },
  { value: 'text', label: '文字' },
  { value: 'photo', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'video_note', label: '圆形视频' },
  { value: 'voice', label: '语音' },
  { value: 'audio', label: '音频' },
  { value: 'document', label: '文件' },
  { value: 'sticker', label: '贴纸' },
  { value: 'contact', label: '联系人' },
  { value: 'location', label: '位置' },
  { value: 'venue', label: '地点' },
  { value: 'poll', label: '投票' },
  { value: 'dice', label: '骰子' },
  { value: 'game', label: '游戏' },
  { value: 'story', label: 'Story 引用' },
  { value: 'paid_media', label: '付费媒体元数据' },
  { value: 'article', label: '文章' },
];
</script>

<template>
  <div class="filter-fields" :class="{ 'filter-fields--stacked': stacked }">
    <label v-if="showVisibility" class="field filter-fields__visibility">
      <span v-if="stacked" class="field__label">可见性</span>
      <select v-model="visibility" class="filter-fields__input" aria-label="可见性" @change="emit('change')">
        <option v-for="option in visibilityOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <template v-if="showDetails">
      <label class="field filter-fields__tag">
        <span v-if="stacked" class="field__label">标签</span>
        <input
          v-model.trim="tag"
          class="filter-fields__input"
          type="text"
          placeholder="标签"
          aria-label="标签"
          @input="emit('textInput', $event)"
          @compositionstart="emit('compositionStart')"
          @compositionend="emit('compositionEnd')"
        >
      </label>
      <label class="field filter-fields__type">
        <span v-if="stacked" class="field__label">格式</span>
        <select v-model="contentType" class="filter-fields__input" aria-label="格式" @change="emit('change')">
          <option v-for="option in contentTypes" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </template>
  </div>
</template>

<style scoped>
.filter-fields {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5rem;
}

.filter-fields__visibility {
  width: 6.5rem;
}

.filter-fields__tag,
.filter-fields__type {
  width: 7.5rem;
}

.filter-fields__input {
  width: 100%;
  height: 2.5rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.875rem;
  text-overflow: ellipsis;
}

.filter-fields--stacked {
  display: grid;
  gap: 0.7rem;
}

.filter-fields--stacked .field {
  width: 100%;
}
</style>
