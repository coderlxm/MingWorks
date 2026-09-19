<script setup lang="ts">
import { ArrowDown, Calendar, Filter } from '@element-plus/icons-vue';
import { useResizeObserver } from '@vueuse/core';
import { ElPopover } from 'element-plus';
import 'element-plus/es/components/popover/style/css';
import { computed, onDeactivated, reactive, shallowRef, useTemplateRef } from 'vue';
import { useImeAwareDebouncedAction } from '../../composables/useImeAwareDebouncedAction';
import { emptyFeedFilters, type AssetView, type FeedFilters } from '../../types';
import AssetFilterFields from './AssetFilterFields.vue';
import AssetViewSwitch from './AssetViewSwitch.vue';

const props = defineProps<{
  filters: FeedFilters;
  view: AssetView;
}>();

const emit = defineEmits<{
  apply: [filters: FeedFilters];
  changeView: [view: AssetView];
}>();

const draft = reactive<FeedFilters>({ ...props.filters });
const layout = shallowRef<'desktop' | 'compact' | 'mobile'>('mobile');
const expanded = shallowRef(false);
const toolbar = useTemplateRef<HTMLElement>('toolbar');
const popover = useTemplateRef<InstanceType<typeof ElPopover>>('popover');
const panel = useTemplateRef<HTMLElement>('panel');
const panelTrigger = useTemplateRef<HTMLButtonElement>('panelTrigger');
const desktop = computed(() => layout.value === 'desktop');
const mobile = computed(() => layout.value === 'mobile');

useResizeObserver(toolbar, ([entry]) => {
  const width = entry!.borderBoxSize[0]!.inlineSize;
  const nextLayout = width >= 1140 ? 'desktop' : width >= 600 ? 'compact' : 'mobile';
  if (layout.value !== nextLayout) {
    popover.value?.hide();
    layout.value = nextLayout;
  }
}, { box: 'border-box' });
onDeactivated(() => popover.value?.hide());

const hasDateRange = computed(() => draft.from !== '' || draft.to !== '');
const dateSummary = computed(() => {
  if (draft.from && draft.to) return `${draft.from} — ${draft.to}`;
  if (draft.from) return `${draft.from} 起`;
  if (draft.to) return `截至 ${draft.to}`;
  return '日期范围';
});
const hiddenFilterCount = computed(() =>
  Number(hasDateRange.value)
  + Number(draft.tag !== '')
  + Number(draft.contentType !== '')
  + Number(mobile.value && draft.visibility !== 'all'),
);
const hasDraftFilters = computed(() =>
  draft.visibility !== 'all'
  || draft.query !== ''
  || draft.tag !== ''
  || draft.contentType !== ''
  || hasDateRange.value,
);

const {
  queue: queueApply,
  handleInput: queueTextApply,
  handleCompositionStart,
  handleCompositionEnd,
} = useImeAwareDebouncedAction(() => emit('apply', { ...draft }), 350);

function reset(): void {
  Object.assign(draft, emptyFeedFilters());
  void queueApply();
}

function clearDates(): void {
  draft.from = '';
  draft.to = '';
  void queueApply();
}

function handlePanelClose(): void {
  expanded.value = false;
  if (panel.value?.contains(document.activeElement)) {
    panelTrigger.value?.focus({ preventScroll: true });
  }
}
</script>

<template>
  <section ref="toolbar" class="toolbar" :class="`toolbar--${layout}`" aria-label="资产管理工具栏">
    <AssetViewSwitch :view="view" :compact="mobile" @change="emit('changeView', $event)" />
    <label class="field toolbar__search">
      <input
        v-model.trim="draft.query"
        class="toolbar__input"
        type="search"
        placeholder="主题或正文"
        aria-label="主题或正文"
        @input="queueTextApply"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
      >
    </label>

    <AssetFilterFields
      v-if="!mobile"
      v-model:visibility="draft.visibility"
      v-model:tag="draft.tag"
      v-model:content-type="draft.contentType"
      :show-visibility="true"
      :show-details="desktop"
      @change="queueApply"
      @text-input="queueTextApply"
      @composition-start="handleCompositionStart"
      @composition-end="handleCompositionEnd"
    />

    <ElPopover
      ref="popover"
      trigger="click"
      placement="bottom-end"
      :width="320"
      :hide-after="0"
      :show-arrow="false"
      :teleported="true"
      popper-class="asset-filter-popover"
      @before-enter="expanded = true"
      @after-enter="panel?.focus({ preventScroll: true })"
      @before-leave="handlePanelClose"
    >
      <template #reference>
        <button
          ref="panelTrigger"
          class="button button--quiet toolbar__filter"
          :class="{ 'toolbar__filter--active': desktop ? hasDateRange : hiddenFilterCount > 0 }"
          type="button"
          :aria-expanded="expanded"
          aria-haspopup="dialog"
          :aria-label="desktop ? `日期范围：${dateSummary}` : `筛选，已设置 ${hiddenFilterCount} 项`"
          :title="desktop ? dateSummary : '筛选条件'"
          @keydown.esc.stop="popover?.hide()"
        >
          <Calendar v-if="desktop" class="toolbar__icon" aria-hidden="true" />
          <Filter v-else class="toolbar__icon" aria-hidden="true" />
          <span class="toolbar__filter-label">{{ desktop ? dateSummary : '筛选' }}</span>
          <span v-if="!desktop && hiddenFilterCount" class="toolbar__count">{{ hiddenFilterCount }}</span>
          <ArrowDown v-if="!mobile" class="toolbar__icon" aria-hidden="true" />
        </button>
      </template>

      <div
        ref="panel"
        class="toolbar__panel"
        role="dialog"
        :aria-label="desktop ? '日期范围' : '筛选条件'"
        tabindex="-1"
        @keydown.esc.stop="popover?.hide()"
      >
        <AssetFilterFields
          v-if="!desktop"
          v-model:visibility="draft.visibility"
          v-model:tag="draft.tag"
          v-model:content-type="draft.contentType"
          :show-visibility="mobile"
          :show-details="true"
          stacked
          @change="queueApply"
          @text-input="queueTextApply"
          @composition-start="handleCompositionStart"
          @composition-end="handleCompositionEnd"
        />
        <div class="toolbar__dates" role="group" aria-label="日期范围">
          <label class="field">
            <span class="field__label">开始日期</span>
            <input v-model="draft.from" class="toolbar__date" type="date" @change="queueApply">
          </label>
          <label class="field">
            <span class="field__label">结束日期</span>
            <input v-model="draft.to" class="toolbar__date" type="date" @change="queueApply">
          </label>
        </div>
        <div class="toolbar__panel-actions">
          <button
            class="button button--quiet"
            type="button"
            :disabled="desktop ? !hasDateRange : !hasDraftFilters"
            @click="desktop ? clearDates() : reset()"
          >
            {{ desktop ? '清空日期' : '清空全部' }}
          </button>
          <button class="button button--quiet" type="button" @click="popover?.hide()">关闭</button>
        </div>
      </div>
    </ElPopover>

    <button
      v-if="!mobile"
      class="button button--quiet toolbar__clear"
      type="button"
      :disabled="!hasDraftFilters"
      @click="reset"
    >
      清空
    </button>
  </section>
</template>

<style scoped>
.toolbar {
  --asset-toolbar-control-height: 2.5rem;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.toolbar__search {
  flex: 1;
}

.toolbar__input {
  width: 100%;
  height: var(--asset-toolbar-control-height);
  padding: 0.5rem 0.65rem;
  font-size: 0.875rem;
}

.toolbar__filter,
.toolbar__clear {
  flex: none;
  height: var(--asset-toolbar-control-height);
  gap: 0.4rem;
  white-space: nowrap;
}

.toolbar--desktop .toolbar__filter {
  width: 13rem;
  justify-content: flex-start;
}

.toolbar__filter--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.toolbar__filter-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar__icon {
  flex: none;
  width: 0.95rem;
  height: 0.95rem;
}

.toolbar__count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.toolbar__panel {
  display: grid;
  gap: 0.85rem;
  max-height: min(32rem, calc(100dvh - 6rem));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.toolbar__dates {
  display: grid;
  min-width: 0;
  gap: 0.7rem;
}

.toolbar__date {
  width: 100%;
  min-height: 2.5rem;
}

.toolbar__panel-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.toolbar--mobile {
  gap: 0.375rem;
  padding-inline: 0.5rem;
}

.toolbar--mobile .toolbar__filter {
  padding-inline: 0.5rem;
}

:global(.el-popover.asset-filter-popover) {
  max-width: calc(100vw - 24px);
  padding: 1rem;
  border-color: var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: var(--font-sans);
}
</style>
