<script setup lang="ts">
import { computed } from 'vue';
import SettingsCard from './SettingsCard.vue';
import SettingsSection from './SettingsSection.vue';

const props = defineProps<{
  avatarUrl: string | null;
  disabled: boolean;
  maxBioLength: number;
  maxAboutIntroLength: number;
}>();

const emit = defineEmits<{
  chooseAvatar: [];
}>();

const bio = defineModel<string>('bio', { required: true });
const aboutIntro = defineModel<string>('aboutIntro', { required: true });

const normalizedBio = computed(() => bio.value.trim());
const bioLength = computed(() => normalizedBio.value.length);
const aboutIntroLength = computed(() => aboutIntro.value.trim().length);
</script>

<template>
  <SettingsSection title="公开资料" description="站点头像、Bio 与「关于我」中的自我介绍，保存后对所有访客生效。">
    <SettingsCard title="头像" description="显示在站点顶部与「关于我」页面，支持 JPEG、PNG、WebP，单张不超过 5 MB。">
      <div class="profile-identity">
        <img v-if="props.avatarUrl" class="profile-identity__avatar" :src="props.avatarUrl" alt="头像预览">
        <div class="profile-identity__copy">
          <strong>小明同学</strong>
          <p>{{ normalizedBio || '尚未填写 Bio' }}</p>
        </div>
        <button
          class="button button--quiet profile-identity__action"
          type="button"
          :disabled="props.disabled"
          @click="emit('chooseAvatar')"
        >
          更换头像
        </button>
      </div>
    </SettingsCard>

    <SettingsCard title="介绍" description="Bio 是站点顶部的一句话简介，自我介绍会完整展示在「关于我」页面。">
      <label class="field">
        <span class="profile-field__heading">
          <span class="field__label">Bio</span>
          <span
            class="profile-field__counter"
            :class="{ 'profile-field__counter--invalid': bioLength > props.maxBioLength }"
          >
            {{ bioLength }} / {{ props.maxBioLength }}
          </span>
        </span>
        <textarea
          v-model="bio"
          rows="3"
          :disabled="props.disabled"
          :aria-invalid="bioLength > props.maxBioLength"
          placeholder="用一句话介绍自己"
        />
      </label>

      <label class="field">
        <span class="profile-field__heading">
          <span class="field__label">自我介绍</span>
          <span
            class="profile-field__counter"
            :class="{ 'profile-field__counter--invalid': aboutIntroLength > props.maxAboutIntroLength }"
          >
            {{ aboutIntroLength }} / {{ props.maxAboutIntroLength }}
          </span>
        </span>
        <textarea
          v-model="aboutIntro"
          rows="8"
          :maxlength="props.maxAboutIntroLength"
          :disabled="props.disabled"
          :aria-invalid="aboutIntroLength > props.maxAboutIntroLength"
          placeholder="补充一段比 Bio 更完整的自我介绍"
        />
      </label>
    </SettingsCard>
  </SettingsSection>
</template>

<style scoped>
.profile-identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
}

.profile-identity__avatar {
  display: block;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
  object-fit: cover;
}

.profile-identity__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
  font-family: var(--font-serif);
}

.profile-identity__copy strong {
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}

.profile-identity__copy p {
  margin: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-field__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.profile-field__counter {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.profile-field__counter--invalid {
  color: var(--danger);
}

.field textarea {
  width: 100%;
  resize: vertical;
  line-height: 1.7;
}

@media (max-width: 520px) {
  .profile-identity {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .profile-identity__action {
    grid-column: 1 / -1;
  }
}
</style>
