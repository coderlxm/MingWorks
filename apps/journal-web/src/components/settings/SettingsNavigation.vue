<script setup lang="ts">
import { ArrowRight, SwitchButton } from '@element-plus/icons-vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { settingsGroups, settingsSections, type SettingsSectionName } from './settingsSections';

const props = defineProps<{
  variant: 'sidebar' | 'list';
  activeSection: SettingsSectionName | null;
  dirtySections: SettingsSectionName[];
  loggingOut: boolean;
}>();

const emit = defineEmits<{
  select: [section: SettingsSectionName];
  logout: [];
}>();

const groupedSections = settingsGroups.map(group => ({
  ...group,
  sections: settingsSections.filter(section => section.group === group.name),
}));
</script>

<template>
  <nav class="settings-nav" :class="`settings-nav--${props.variant}`" aria-label="设置分区">
    <div v-for="group in groupedSections" :key="group.name" class="settings-nav__group">
      <span class="settings-nav__group-label">{{ group.label }}</span>
      <ul class="settings-nav__list">
        <li v-for="section in group.sections" :key="section.name">
          <button
            class="settings-nav__item"
            :class="{ 'settings-nav__item--active': props.activeSection === section.name }"
            type="button"
            :aria-current="props.activeSection === section.name ? 'page' : undefined"
            @click="emit('select', section.name)"
          >
            <component :is="section.icon" class="settings-nav__icon" aria-hidden="true" />
            <span class="settings-nav__copy">
              <span class="settings-nav__label">{{ section.label }}</span>
              <span class="settings-nav__description">{{ section.description }}</span>
            </span>
            <span
              v-if="props.dirtySections.includes(section.name)"
              class="settings-nav__dirty"
              role="img"
              aria-label="有未保存修改"
            />
            <ArrowRight class="settings-nav__chevron" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>

    <div class="settings-nav__group">
      <span class="settings-nav__group-label">账户</span>
      <ul class="settings-nav__list">
        <li>
          <button
            class="settings-nav__item settings-nav__item--danger"
            type="button"
            :disabled="props.loggingOut"
            :aria-busy="props.loggingOut"
            @click="emit('logout')"
          >
            <SwitchButton class="settings-nav__icon" aria-hidden="true" />
            <span class="settings-nav__copy">
              <JournalLoading v-if="props.loggingOut" variant="inline" label="退出中…" />
              <span v-else class="settings-nav__label">退出登录</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.settings-nav {
  display: grid;
  align-content: start;
  gap: 1.35rem;
  min-width: 0;
}

.settings-nav__group {
  display: grid;
  gap: 0.4rem;
}

.settings-nav__group-label {
  padding: 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.settings-nav__list {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.settings-nav__item {
  display: flex;
  width: 100%;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.75rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;
  transition: background-color 140ms ease, color 140ms ease;
}

.settings-nav__item:hover:not(:disabled) {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.settings-nav__item:disabled {
  cursor: wait;
  opacity: 0.6;
}

.settings-nav__item--active,
.settings-nav__item--active:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.settings-nav__item--danger:hover:not(:disabled) {
  color: var(--danger);
}

.settings-nav__icon {
  width: 1rem;
  height: 1rem;
  flex: none;
}

.settings-nav__copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.12rem;
}

.settings-nav__label {
  font-size: 0.8rem;
  font-weight: 650;
}

.settings-nav__description {
  display: none;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav__dirty {
  width: 0.4rem;
  height: 0.4rem;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
}

.settings-nav__chevron {
  display: none;
  width: 0.8rem;
  height: 0.8rem;
  flex: none;
  color: var(--border-strong);
}

.settings-nav--list {
  gap: 1.25rem;
}

.settings-nav--list .settings-nav__group-label {
  padding: 0 0.2rem;
}

.settings-nav--list .settings-nav__list {
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.settings-nav--list li + li {
  border-top: 1px solid var(--border-subtle);
}

.settings-nav--list .settings-nav__item {
  min-height: 3.6rem;
  gap: 0.8rem;
  padding: 0.7rem 0.95rem;
  border-radius: 0;
  color: var(--text-primary);
}

.settings-nav--list .settings-nav__item--danger {
  color: var(--danger);
}

.settings-nav--list .settings-nav__icon {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--accent-strong);
}

.settings-nav--list .settings-nav__item--danger .settings-nav__icon {
  color: currentColor;
}

.settings-nav--list .settings-nav__label {
  font-size: 0.86rem;
}

.settings-nav--list .settings-nav__description,
.settings-nav--list .settings-nav__chevron {
  display: block;
}
</style>
