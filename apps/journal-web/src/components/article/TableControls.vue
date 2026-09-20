<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';
const props = defineProps<{ editor: Editor; disabled: boolean }>();
const actions = [
  ['addRowBefore', '上方加行'], ['addRowAfter', '下方加行'], ['deleteRow', '删除行'],
  ['addColumnBefore', '左侧加列'], ['addColumnAfter', '右侧加列'], ['deleteColumn', '删除列'],
  ['toggleHeaderRow', '表头行'], ['toggleHeaderColumn', '表头列'],
  ['mergeCells', '合并单元格'], ['splitCell', '拆分单元格'], ['deleteTable', '删除表格'],
] as const;
function run(command: typeof actions[number][0]): void { props.editor.chain().focus()[command]().run(); }
function align(value: string): void { props.editor.chain().focus().setCellAttribute('align', value).run(); }
</script>
<template>
  <div class="content-controls" aria-label="表格操作">
    <button v-for="[command, label] in actions" :key="command" type="button" :disabled="disabled || !editor.can()[command]()" @click="run(command)">{{ label }}</button>
    <button v-for="[value, label] in [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']]" :key="value" type="button" :disabled="disabled" @click="align(value)">{{ label }}</button>
  </div>
</template>
