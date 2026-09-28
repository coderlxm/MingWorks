<script setup lang="ts">
import QRCode from 'qrcode';
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useAdminContributionLink } from '../../composables/useAdminContributionLink';
import type { ContributionLinkLifetime } from '../../types';
import { formatEntryTime } from '../../utils/formatters';
import { showMessage } from '../../utils/message';
import SettingsCard from '../settings/SettingsCard.vue';
import SettingsSection from '../settings/SettingsSection.vue';
import JournalLoading from '../ui/JournalLoading.vue';

const contributionLink = useAdminContributionLink();
const qrCodeUrl = shallowRef<string | null>(null);
const copied = shallowRef(false);
const selectedLifetime = shallowRef<ContributionLinkLifetime>('temporary');
let qrSequence = 0;

const shareUrl = computed(() => contributionLink.link.value?.url ?? null);
const activeExpiresAt = computed(() => contributionLink.link.value?.expiresAt ?? null);
const busy = computed(() => contributionLink.mutation.value !== null);
const canSystemShare = computed(() =>
  shareUrl.value !== null && typeof navigator.share === 'function',
);

watch(shareUrl, async (url) => {
  const sequence = ++qrSequence;
  qrCodeUrl.value = null;
  if (!url) return;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: {
        dark: '#20201e',
        light: '#ffffff',
      },
    });
    if (sequence === qrSequence) qrCodeUrl.value = dataUrl;
  }
  catch (reason) {
    if (sequence === qrSequence) contributionLink.setError(reason);
  }
}, { immediate: true });

watch(contributionLink.error, (error) => {
  if (error) showMessage({ message: error, type: 'error' });
});

async function createLink(): Promise<void> {
  if (
    contributionLink.link.value
    && !window.confirm('创建新链接会立即使当前分享链接失效，确定继续吗？')
  ) return;
  copied.value = false;
  await contributionLink.create(selectedLifetime.value);
}

async function copyLink(): Promise<void> {
  if (!shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
  }
  catch (reason) {
    contributionLink.setError(reason);
  }
}

async function shareLink(): Promise<void> {
  if (!shareUrl.value) return;
  try {
    await navigator.share({
      title: '送给小明',
      text: '用这条链接把聚会照片、视频和想说的话送给小明。',
      url: shareUrl.value,
    });
  }
  catch (reason) {
    contributionLink.setError(reason);
  }
}

async function revokeLink(): Promise<void> {
  if (!window.confirm('确定撤销当前投稿链接吗？朋友打开后将无法继续投稿。')) return;
  copied.value = false;
  await contributionLink.revoke();
}

onMounted(() => {
  void contributionLink.load();
});
</script>

<template>
  <SettingsSection
    title="投稿链接"
    description="把链接或二维码发给朋友，朋友无需登录即可送来照片、视频和想说的话。这里的操作会立即生效。"
  >
    <SettingsCard title="当前链接">
      <template v-if="contributionLink.link.value" #aside>
        <span class="link-settings__badge">
          <template v-if="activeExpiresAt">{{ formatEntryTime(activeExpiresAt) }} 到期</template>
          <template v-else>长期有效</template>
        </span>
      </template>

      <JournalLoading
        v-if="contributionLink.loading.value"
        variant="inline"
        label="正在读取投稿链接…"
      />
      <div v-else-if="contributionLink.link.value" class="link-settings__active">
        <div class="link-settings__content">
          <span class="link-settings__meta">
            {{ formatEntryTime(contributionLink.link.value.createdAt) }} 创建
          </span>

          <template v-if="shareUrl">
            <div class="link-settings__url">
              <span :title="shareUrl">{{ shareUrl }}</span>
              <button class="button button--quiet" type="button" :disabled="busy" @click="copyLink">
                <span aria-live="polite">{{ copied ? '已复制' : '复制' }}</span>
              </button>
            </div>
            <button
              v-if="canSystemShare"
              class="button button--quiet link-settings__system-share"
              type="button"
              :disabled="busy"
              @click="shareLink"
            >
              系统分享
            </button>
          </template>
          <p v-else class="link-settings__note">
            出于安全考虑，服务端只保存令牌摘要，无法再次读取这条链接。若链接没有保存，请创建新链接。
          </p>
        </div>

        <figure v-if="shareUrl && qrCodeUrl" class="link-settings__qr">
          <img :src="qrCodeUrl" alt="朋友投稿链接二维码">
          <figcaption>让朋友扫码打开投稿页</figcaption>
        </figure>
      </div>
      <p v-else class="link-settings__note">
        目前没有可用的投稿链接。创建后可以直接分享、复制或让朋友扫描二维码。
      </p>

      <template v-if="contributionLink.link.value" #footer>
        <button
          class="button button--quiet link-settings__revoke"
          type="button"
          :disabled="busy"
          :aria-busy="contributionLink.mutation.value === 'revoke'"
          @click="revokeLink"
        >
          <JournalLoading
            v-if="contributionLink.mutation.value === 'revoke'"
            variant="inline"
            label="撤销中…"
          />
          <template v-else>撤销当前链接</template>
        </button>
      </template>
    </SettingsCard>

    <SettingsCard
      :title="contributionLink.link.value ? '创建新链接' : '创建链接'"
      description="同一时间只保留一条链接，创建新链接会让当前链接立即失效。"
    >
      <div class="link-settings__create">
        <fieldset
          class="link-settings__lifetime"
          aria-label="投稿链接有效期"
          :disabled="busy || contributionLink.loading.value"
        >
          <label class="link-settings__choice">
            <input v-model="selectedLifetime" type="radio" name="contribution-link-lifetime" value="temporary">
            <span>72 小时</span>
          </label>
          <label class="link-settings__choice">
            <input v-model="selectedLifetime" type="radio" name="contribution-link-lifetime" value="permanent">
            <span>长期有效</span>
          </label>
        </fieldset>
        <button
          class="button"
          :class="contributionLink.link.value ? 'button--quiet' : 'button--primary'"
          type="button"
          :disabled="busy || contributionLink.loading.value"
          :aria-busy="contributionLink.mutation.value === 'create'"
          @click="createLink"
        >
          <JournalLoading
            v-if="contributionLink.mutation.value === 'create'"
            variant="inline"
            label="创建中…"
          />
          <template v-else>{{ contributionLink.link.value ? '创建新链接' : '创建链接' }}</template>
        </button>
      </div>
    </SettingsCard>
  </SettingsSection>
</template>

<style scoped>
.link-settings__badge {
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.link-settings__active {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 1.25rem;
}

.link-settings__content {
  display: grid;
  min-width: 0;
  gap: 0.75rem;
}

.link-settings__meta,
.link-settings__note {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.55;
}

.link-settings__note {
  margin: 0;
}

.link-settings__url {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding-left: 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface-page);
}

.link-settings__url > span {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-settings__url .button {
  flex: none;
  border-width: 0 0 0 1px;
  border-color: var(--border-strong);
  border-radius: 0 7px 7px 0;
}

.link-settings__system-share {
  justify-self: start;
}

.link-settings__qr {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  width: 10rem;
  margin: 0;
  padding: 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: #fff;
}

.link-settings__qr img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
}

.link-settings__qr figcaption {
  color: #72716c;
  font-size: 0.68rem;
}

.link-settings__revoke {
  color: var(--danger);
}

.link-settings__create {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.link-settings__lifetime {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-page);
}

.link-settings__choice {
  cursor: pointer;
}

.link-settings__choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.link-settings__choice span {
  display: inline-flex;
  min-height: 1.85rem;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 0.74rem;
  white-space: nowrap;
}

.link-settings__choice input:checked + span {
  background: var(--surface-card);
  box-shadow: 0 1px 2px rgb(0 0 0 / 10%);
  color: var(--accent-strong);
  font-weight: 700;
}

.link-settings__choice input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.link-settings__lifetime:disabled .link-settings__choice {
  cursor: wait;
  opacity: 0.55;
}

@media (max-width: 599px) {
  .link-settings__active {
    grid-template-columns: minmax(0, 1fr);
  }

  .link-settings__qr {
    justify-self: center;
    width: min(12rem, 100%);
  }

  .link-settings__system-share {
    justify-self: stretch;
  }

  .link-settings__create {
    align-items: stretch;
    flex-direction: column;
  }

  .link-settings__lifetime {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
