<script setup lang="ts" name="Stage3DCanvas">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import type { ThemeId } from '../types'
import type { WeddingStageController } from '../three/weddingScene'

interface Props {
  initialTheme: ThemeId
  tiltX: number
  tiltY: number
}

const props = defineProps<Props>()
const canvasRef = useTemplateRef<HTMLCanvasElement>('stageCanvas')

let controller: WeddingStageController | null = null
let unmounted = false
let queuedTheme: ThemeId | null = null
let queuedBurst = 0

function setTheme(theme: ThemeId) {
  if (controller) {
    controller.setTheme(theme)
    return
  }
  queuedTheme = theme
}

function burstFireworks(shells = 3) {
  if (controller) {
    controller.burstFireworks(shells)
    return
  }
  queuedBurst = Math.max(queuedBurst, shells)
}

defineExpose({
  setTheme,
  burstFireworks,
})

onMounted(async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const { mountWeddingStage } = await import('../three/weddingScene')
  if (unmounted) return
  controller = mountWeddingStage(canvas, queuedTheme ?? props.initialTheme, () => ({
    x: props.tiltX,
    y: props.tiltY,
  }))
  if (queuedBurst > 0) {
    controller.burstFireworks(queuedBurst)
    queuedBurst = 0
  }
})

onUnmounted(() => {
  unmounted = true
  controller?.dispose()
  controller = null
})
</script>

<template>
  <canvas ref="stageCanvas" class="stage-canvas" aria-hidden="true" />
</template>

<style scoped>
.stage-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
  touch-action: pan-y;
}
</style>
