<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';
const props = defineProps<{ editor: Editor; disabled: boolean }>();
function update(name: string, event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  const value = name === 'width' || name === 'height' ? (raw === '' ? null : Number(raw)) : raw || null;
  props.editor.chain().focus().updateAttributes('image', { [name]: value }).run();
}
</script>
<template>
  <fieldset class="content-controls" :disabled="disabled">
    <legend>图片设置</legend>
    <label>替代文字 <input :value="editor.getAttributes('image').alt" maxlength="200" @change="update('alt', $event)"></label>
    <label>图注 <input :value="editor.getAttributes('image').caption" maxlength="500" @change="update('caption', $event)"></label>
    <label>宽 <input type="number" min="1" max="10000" :value="editor.getAttributes('image').width" @change="update('width', $event)"></label>
    <label>高 <input type="number" min="1" max="10000" :value="editor.getAttributes('image').height" @change="update('height', $event)"></label>
    <label>对齐 <select :value="editor.getAttributes('image').align ?? ''" @change="update('align', $event)"><option value="">默认</option><option value="left">左</option><option value="center">居中</option><option value="right">右</option></select></label>
    <button type="button" @click="editor.chain().focus().updateAttributes('image', { width: null, height: null }).run()">原始比例</button>
    <button type="button" @click="editor.chain().focus().deleteSelection().run()">移出正文（保留素材）</button>
  </fieldset>
</template>
