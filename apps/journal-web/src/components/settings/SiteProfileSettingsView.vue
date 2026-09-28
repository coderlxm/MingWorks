<script setup lang="ts">
import { useFileDialog, useMediaQuery, useObjectUrl } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminContributionLinkSettings from '../contribution/AdminContributionLinkSettings.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { logout as logoutRequest } from '../../api';
import { useSessionStore } from '../../stores/session';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type { ChannelTags, SiteContactItem, SiteProfile } from '../../types';
import { showMessage } from '../../utils/message';
import SettingsChannelTagsPanel from './SettingsChannelTagsPanel.vue';
import SettingsContactsPanel from './SettingsContactsPanel.vue';
import SettingsNavigation from './SettingsNavigation.vue';
import SettingsPublicProfilePanel from './SettingsPublicProfilePanel.vue';
import SettingsResumePanel from './SettingsResumePanel.vue';
import {
  isSettingsSectionName,
  settingsSections,
  type SettingsSectionName,
} from './settingsSections';

const MAX_BIO_LENGTH = 120;
const MAX_ABOUT_INTRO_LENGTH = 1200;
const MAX_CONTACT_VALUE_LENGTH = 120;
const MAX_CONTACT_URL_LENGTH = 500;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const route = useRoute();
const router = useRouter();
const compactSettings = useMediaQuery('(max-width: 799px)');
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const {
  ownerAuthenticated,
  authenticationChecked,
  authenticationError,
} = storeToRefs(session);
const { profile, loading, loadError } = storeToRefs(siteProfile);
const draftBio = shallowRef('');
const draftAboutIntro = shallowRef('');
const draftAvatarFile = shallowRef<File | null>(null);
const draftChannelTags = shallowRef<ChannelTags | null>(null);
const draftContactItems = shallowRef<SiteContactItem[]>([]);
const submitting = shallowRef(false);
const loggingOut = shallowRef(false);
const initialized = shallowRef(false);
let persistentMessage: ReturnType<typeof showMessage> | null = null;
const draftAvatarPreviewUrl = useObjectUrl(draftAvatarFile);
const {
  open: openFileDialog,
  reset: resetFileDialog,
  onChange: onAvatarChange,
} = useFileDialog({
  accept: 'image/jpeg,image/png,image/webp',
  multiple: false,
  reset: true,
});

const activeSection = computed<SettingsSectionName | null>(() => {
  const requestedSection = route.query.section;
  if (isSettingsSectionName(requestedSection)) return requestedSection;
  return compactSettings.value ? null : 'profile';
});
const showSectionIndex = computed(() => compactSettings.value && activeSection.value === null);
const normalizedDraftBio = computed(() => draftBio.value.trim());
const normalizedDraftAboutIntro = computed(() => draftAboutIntro.value.trim());
const bioLength = computed(() => normalizedDraftBio.value.length);
const aboutIntroLength = computed(() => normalizedDraftAboutIntro.value.length);
const previewAvatarUrl = computed(() =>
  draftAvatarPreviewUrl.value ?? profile.value?.avatarUrl ?? null,
);
const editableChannelTags = computed<ChannelTags>({
  get: () => draftChannelTags.value ?? profile.value!.channelTags,
  set: value => draftChannelTags.value = value,
});
const incompleteContact = computed(() => draftContactItems.value.find(item =>
  item.enabled
  && (!item.value.trim() || (item.kind !== 'wechat' && !item.url?.trim())),
));
const invalidUrlContact = computed(() => draftContactItems.value.find(item =>
  item.enabled && item.kind !== 'wechat' && item.url?.trim() && !URL.canParse(item.url.trim()),
));
const validationError = computed(() => {
  if (bioLength.value > MAX_BIO_LENGTH) return `Bio 不能超过 ${MAX_BIO_LENGTH} 个字符。`;
  if (aboutIntroLength.value > MAX_ABOUT_INTRO_LENGTH) {
    return `自我介绍不能超过 ${MAX_ABOUT_INTRO_LENGTH} 个字符。`;
  }
  if (incompleteContact.value) {
    return `${incompleteContact.value.label}已启用，请补充完整的展示内容和跳转链接。`;
  }
  if (invalidUrlContact.value) {
    return `${invalidUrlContact.value.label}的跳转链接需要是完整地址，例如 https:// 或 mailto: 开头。`;
  }
  return null;
});
const profileDirty = computed(() => profile.value !== null && (
  draftAvatarFile.value !== null
  || normalizedDraftBio.value !== profile.value.bio.trim()
  || normalizedDraftAboutIntro.value !== profile.value.aboutIntro.trim()
));
const contactsDirty = computed(() => profile.value !== null
  && JSON.stringify(draftContactItems.value) !== JSON.stringify(profile.value.contactItems));
const tagsDirty = computed(() => profile.value !== null
  && JSON.stringify(editableChannelTags.value) !== JSON.stringify(profile.value.channelTags));
const dirtySections = computed<SettingsSectionName[]>(() => [
  ...(profileDirty.value ? ['profile' as const] : []),
  ...(contactsDirty.value ? ['contacts' as const] : []),
  ...(tagsDirty.value ? ['tags' as const] : []),
]);
const hasUnsavedChanges = computed(() => dirtySections.value.length > 0);
const unsavedSummary = computed(() => `未保存：${settingsSections
  .filter(section => dirtySections.value.includes(section.name))
  .map(section => section.label)
  .join('、')}`);
const accessError = computed(() => authenticationError.value
  ?? (authenticationChecked.value && !ownerAuthenticated.value
    ? '请先返回“我的资产”登录后再修改公开资料。'
    : loadError.value));
const accessMessage = computed(() => authenticationError.value
  ?? (authenticationChecked.value && !ownerAuthenticated.value
    ? '请先返回“我的资产”登录后再修改公开资料。'
    : null));
const waitingForAccess = computed(() => accessError.value === null && (
  !authenticationChecked.value
  || (ownerAuthenticated.value && loading.value)
));
const canSubmit = computed(() =>
  ownerAuthenticated.value
  && profile.value !== null
  && !submitting.value
  && validationError.value === null
  && hasUnsavedChanges.value,
);

function resetDrafts(value: SiteProfile): void {
  draftBio.value = value.bio;
  draftAboutIntro.value = value.aboutIntro;
  draftContactItems.value = value.contactItems.map(item => ({ ...item }));
  draftAvatarFile.value = null;
  draftChannelTags.value = null;
  resetFileDialog();
}

watch(profile, (value) => {
  if (!value || initialized.value) return;
  resetDrafts(value);
  initialized.value = true;
}, { immediate: true });

function showPersistentMessage(message: string): void {
  persistentMessage?.close();
  persistentMessage = showMessage({ message, type: 'error', duration: 0 });
}

watch(accessMessage, (error) => {
  if (error) showPersistentMessage(error);
  else {
    persistentMessage?.close();
    persistentMessage = null;
  }
}, { immediate: true });

onBeforeUnmount(() => persistentMessage?.close());

onAvatarChange((files) => {
  const file = files?.item(0);
  if (!file) return;
  if (!AVATAR_TYPES.has(file.type)) {
    draftAvatarFile.value = null;
    showMessage({ message: '头像仅支持 JPEG、PNG 或 WebP 图片。', type: 'error' });
    return;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    draftAvatarFile.value = null;
    showMessage({ message: '头像文件不能超过 5 MB。', type: 'error' });
    return;
  }
  draftAvatarFile.value = file;
});

function chooseAvatar(): void {
  openFileDialog();
}

function selectSection(section: SettingsSectionName): void {
  if (compactSettings.value) {
    void router.push({ query: { ...route.query, section } });
    return;
  }
  const query = { ...route.query };
  if (section === 'profile') delete query.section;
  else query.section = section;
  void router.replace({ query });
}

function returnToSectionIndex(): void {
  const query = { ...route.query };
  delete query.section;
  const indexLocation = router.resolve({ query });
  if (router.options.history.state.back === indexLocation.fullPath) {
    router.back();
    return;
  }
  void router.replace(indexLocation);
}

function discardChanges(): void {
  resetDrafts(profile.value!);
}

function replaceContactItems(contactItems: SiteContactItem[]): void {
  draftContactItems.value = contactItems;
}

async function save(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const updated = await siteProfile.update({
      bio: normalizedDraftBio.value,
      avatar: draftAvatarFile.value,
      weatherEnabled: profile.value!.weatherEnabled,
      channelTags: editableChannelTags.value,
      aboutIntro: normalizedDraftAboutIntro.value,
      contactItems: draftContactItems.value.map(item => ({
        ...item,
        value: item.value.trim(),
        url: item.url?.trim() || null,
      })),
    });
    resetDrafts(updated);
    showMessage({ message: '站点设置已保存。', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: reason instanceof Error ? reason.message : String(reason), type: 'error' });
  }
  finally {
    submitting.value = false;
  }
}

async function logout(): Promise<void> {
  loggingOut.value = true;
  try {
    await logoutRequest();
    session.setAuthenticated(false);
    await router.replace({ name: 'private' });
  }
  catch (reason) {
    showMessage({ message: reason instanceof Error ? reason.message : String(reason), type: 'error' });
  }
  finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <main class="settings-view">
    <header v-if="showSectionIndex || !compactSettings" class="settings-view__header">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的资产</button>
      <span class="settings-view__eyebrow">SITE SETTINGS</span>
      <h1>站点设置</h1>
      <p>管理公开资料、联系方式与频道标签，以及简历和投稿链接的分享方式。</p>
    </header>
    <header v-else class="settings-view__header settings-view__header--detail">
      <button class="text-button" type="button" @click="returnToSectionIndex">← 站点设置</button>
    </header>

    <div v-if="ownerAuthenticated && profile" class="settings-layout">
      <aside v-if="!compactSettings" class="settings-layout__sidebar">
        <SettingsNavigation
          variant="sidebar"
          :active-section="activeSection"
          :dirty-sections="dirtySections"
          :logging-out="loggingOut"
          @select="selectSection"
          @logout="logout"
        />
      </aside>

      <form class="settings-layout__content" novalidate @submit.prevent="save">
        <SettingsNavigation
          v-if="showSectionIndex"
          variant="list"
          :active-section="null"
          :dirty-sections="dirtySections"
          :logging-out="loggingOut"
          @select="selectSection"
          @logout="logout"
        />

        <SettingsPublicProfilePanel
          v-show="activeSection === 'profile'"
          v-model:bio="draftBio"
          v-model:about-intro="draftAboutIntro"
          :avatar-url="previewAvatarUrl"
          :disabled="submitting"
          :max-bio-length="MAX_BIO_LENGTH"
          :max-about-intro-length="MAX_ABOUT_INTRO_LENGTH"
          @choose-avatar="chooseAvatar"
        />
        <SettingsContactsPanel
          v-show="activeSection === 'contacts'"
          :contact-items="draftContactItems"
          :disabled="submitting"
          :max-value-length="MAX_CONTACT_VALUE_LENGTH"
          :max-url-length="MAX_CONTACT_URL_LENGTH"
          @update:contact-items="replaceContactItems"
        />
        <SettingsChannelTagsPanel
          v-show="activeSection === 'tags'"
          v-model="editableChannelTags"
          :disabled="submitting"
        />
        <SettingsResumePanel v-show="activeSection === 'resume'" />
        <AdminContributionLinkSettings v-show="activeSection === 'contribution'" />

        <Transition name="settings-savebar">
          <div v-if="hasUnsavedChanges" class="settings-savebar">
            <p
              class="settings-savebar__status"
              :class="{ 'settings-savebar__status--invalid': validationError }"
              aria-live="polite"
            >
              {{ validationError ?? unsavedSummary }}
            </p>
            <div class="settings-savebar__actions">
              <button
                class="button button--quiet"
                type="button"
                :disabled="submitting"
                @click="discardChanges"
              >
                放弃修改
              </button>
              <button
                class="button button--primary"
                type="submit"
                :disabled="!canSubmit"
                :aria-busy="submitting"
              >
                <JournalLoading v-if="submitting" variant="inline" label="保存中…" />
                <template v-else>保存修改</template>
              </button>
            </div>
          </div>
        </Transition>
      </form>
    </div>

    <div v-else-if="waitingForAccess" class="settings-view__loading">
      <JournalLoading
        variant="reading"
        :label="authenticationChecked ? '正在读取公开资料…' : '正在确认管理会话…'"
      />
    </div>
  </main>
</template>

<style scoped>
.settings-view {
  --settings-sidebar-width: 12.5rem;
  --settings-layout-gap: 2.5rem;

  display: grid;
  align-content: start;
  gap: 1.5rem;
  width: min(
    calc(100% - (var(--page-gutter) * 2)),
    calc(var(--settings-sidebar-width) + var(--settings-layout-gap) + var(--editor-width))
  );
  min-height: 100%;
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.settings-view__header {
  display: grid;
  justify-items: start;
  gap: 0.25rem;
}

.settings-view__header .text-button {
  margin-bottom: 1rem;
  color: var(--text-muted);
}

.settings-view__header .text-button:hover {
  color: var(--text-primary);
}

.settings-view__header--detail .text-button {
  margin-bottom: 0;
}

.settings-view__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.settings-view__header h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.55rem;
}

.settings-view__header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.6;
}

.settings-layout {
  display: grid;
  grid-template-columns: var(--settings-sidebar-width) minmax(0, 1fr);
  align-items: start;
  gap: var(--settings-layout-gap);
}

.settings-layout__sidebar {
  position: sticky;
  top: 1.3rem;
}

.settings-layout__content {
  display: grid;
  min-width: 0;
  gap: 1.5rem;
}

.settings-savebar {
  position: sticky;
  bottom: 0.9rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0.7rem 0.65rem 1rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--surface-card) 92%, transparent);
  box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 10%);
  backdrop-filter: blur(12px);
}

.settings-savebar__status {
  min-width: 0;
  flex: 1;
  margin: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-savebar__status--invalid {
  color: var(--danger);
}

.settings-savebar__actions {
  display: flex;
  flex: none;
  gap: 0.5rem;
}

.settings-savebar-enter-active,
.settings-savebar-leave-active {
  transition: opacity var(--dur-loading-enter) var(--ease-card), transform var(--dur-loading-enter) var(--ease-card);
}

.settings-savebar-enter-from,
.settings-savebar-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

.settings-view__loading {
  min-height: 50vh;
}

@media (max-width: 799px) {
  .settings-view {
    gap: 1.1rem;
    padding-top: 0.9rem;
  }

  .settings-view__header .text-button {
    margin-bottom: 0.6rem;
  }

  .settings-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-layout__content {
    gap: 1.25rem;
  }
}

@media (max-width: 520px) {
  .settings-savebar {
    flex-wrap: wrap;
    gap: 0.55rem;
    padding: 0.7rem;
  }

  .settings-savebar__status {
    flex-basis: 100%;
    white-space: normal;
  }

  .settings-savebar__actions {
    flex: 1;
  }

  .settings-savebar__actions .button {
    flex: 1;
  }
}
</style>
