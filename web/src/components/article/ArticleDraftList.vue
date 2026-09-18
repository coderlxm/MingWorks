<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { deleteArticleDraft, fetchArticleDrafts } from '../../api/articles';
import type { JournalEntry } from '../../types';
import { showMessage } from '../../utils/message';
const drafts = shallowRef<JournalEntry[]>([]);
const busy = shallowRef<number | null>(null);
const error = shallowRef('');
async function remove(draft: JournalEntry): Promise<void> {
  if (!window.confirm(`永久删除草稿“${draft.title}”及其素材？`)) return;
  busy.value = draft.id;
  try { await deleteArticleDraft(draft.id); drafts.value = drafts.value.filter(item => item.id !== draft.id); }
  catch (reason) { showMessage({ message: reason instanceof Error ? reason.message : String(reason), type: 'error' }); }
  finally { busy.value = null; }
}
onMounted(async () => {
  try { drafts.value = (await fetchArticleDrafts()).articles; }
  catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason); }
});
</script>
<template>
  <details v-if="drafts.length || error" class="article-drafts">
    <summary>恢复文章草稿（{{ drafts.length }}）</summary>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-for="draft in drafts" :key="draft.id" class="content-controls">
      <RouterLink :to="{ name: 'article-edit', params: { articleId: draft.id } }">{{ draft.title }}</RouterLink>
      <span>{{ new Date(draft.updatedAt).toLocaleString() }}</span>
      <button type="button" :disabled="busy !== null" @click="remove(draft)">{{ busy === draft.id ? '删除中…' : '删除草稿' }}</button>
    </div>
  </details>
</template>
