<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
const props = defineProps<{ src: string; alt?: string; title?: string; width?: string; height?: string; gateExternal: boolean }>();
const allowed = shallowRef(false);
const failed = shallowRef(false);
const image = shallowRef<HTMLImageElement | null>(null);
const external = computed(() => props.src.startsWith('https://'));
const host = computed(() => external.value ? new URL(props.src).host : '');
const blocked = computed(() => props.gateExternal && external.value && !allowed.value);
let viewer: PhotoSwipe | null = null;
function open(): void {
  const element = image.value;
  if (!element?.naturalWidth) return;
  viewer = new PhotoSwipe({ dataSource: [{ src: props.src, width: element.naturalWidth, height: element.naturalHeight, alt: props.alt }], closeTitle: '关闭', zoomTitle: '缩放', errorMsg: '图片加载失败' });
  viewer.on('contentLoadImage', event => { if (event.content.element instanceof HTMLImageElement) event.content.element.referrerPolicy = 'no-referrer'; });
  viewer.init();
}
onBeforeUnmount(() => viewer?.destroy());
</script>
<template>
  <span class="content-image">
    <button v-if="blocked" type="button" class="content-image__notice" @click="allowed = true">加载外部图片：{{ alt || host }}（{{ host }}）</button>
    <span v-else-if="failed" role="status">图片加载失败：{{ alt || src }}</span>
    <img v-else ref="image" :src="src" :alt="alt" :title="title" :width="width" :height="height" loading="lazy" referrerpolicy="no-referrer" role="button" tabindex="0" aria-label="查看大图" @click.stop.prevent="open" @keydown.enter.prevent="open" @keydown.space.prevent="open" @error="failed = true">
  </span>
</template>
