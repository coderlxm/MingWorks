<script setup lang="ts">
import type { JournalResumePreviewPage } from '../../types';

defineProps<{ page: JournalResumePreviewPage }>();
const emit = defineEmits<{ error: [pageNumber: number] }>();
</script>

<template>
  <div class="resume-page-image">
    <img
      class="resume-page-image__image resume-page-image__image--light"
      :src="page.lightUrl"
      :width="page.width"
      :height="page.height"
      :alt="`简历第 ${page.pageNumber} 页`"
      draggable="false"
      @error="emit('error', page.pageNumber)"
    >
    <img
      class="resume-page-image__image resume-page-image__image--dark"
      :src="page.darkUrl"
      :width="page.width"
      :height="page.height"
      alt=""
      aria-hidden="true"
      draggable="false"
      @error="emit('error', page.pageNumber)"
    >
  </div>
</template>

<style scoped>
.resume-page-image {
  position: relative;
  width: 100%;
  height: 100%;
}

.resume-page-image__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.resume-page-image__image--dark {
  opacity: 0;
}

:global(html[data-theme='dark'] .resume-page-image__image--light) {
  opacity: 0;
}

:global(html[data-theme='dark'] .resume-page-image__image--dark) {
  opacity: 1;
}
</style>
