<script setup lang="ts">
import { computed, h, shallowRef, type VNodeChild } from 'vue';
import { common, createLowlight } from 'lowlight';
import { showMessage } from '../../utils/message';
const props = defineProps<{ text: string; language: string; streaming: boolean }>();
const lowlight = createLowlight(common);
const copied = shallowRef(false);
type HighlightNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HighlightNode[] };
function render(node: HighlightNode): VNodeChild { return node.type === 'text' ? node.value : h(node.tagName!, { class: node.properties?.className }, node.children?.map(render)); }
const highlighted = computed(() => {
  if (props.streaming || !props.language || !lowlight.registered(props.language)) return props.text;
  return lowlight.highlight(props.language, props.text).children.map(render);
});
const HighlightedCode = () => h('code', { class: props.language ? `language-${props.language}` : undefined }, highlighted.value);
async function copy(): Promise<void> {
  try { await navigator.clipboard.writeText(props.text); copied.value = true; }
  catch (reason) { showMessage({ message: reason instanceof Error ? reason.message : String(reason), type: 'error' }); }
}
</script>
<template>
  <div class="content-code"><div class="content-code__tools"><span>{{ language || 'text' }}</span><button type="button" @click="copy">{{ copied ? '已复制' : '复制代码' }}</button></div><pre><HighlightedCode /></pre></div>
</template>
