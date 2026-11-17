import { computed, onMounted, onUnmounted, shallowRef } from 'vue'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function useTiltParallax() {
  const targetX = shallowRef(0)
  const targetY = shallowRef(0)
  const smoothX = shallowRef(0)
  const smoothY = shallowRef(0)
  const gyroActive = shallowRef(false)

  let baseBeta: number | null = null
  let baseGamma: number | null = null
  let stepTimer: ReturnType<typeof globalThis.setInterval> | null = null
  let pointerListenerAttached = false
  let gyroListenerAttached = false

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' && gyroActive.value) return
    const width = window.innerWidth || 1
    const height = window.innerHeight || 1
    const nx = (event.clientX / width) * 2 - 1
    const ny = (event.clientY / height) * 2 - 1
    targetX.value = clamp(nx, -1, 1)
    targetY.value = clamp(ny, -1, 1)
  }

  function onPointerLeave() {
    targetX.value = 0
    targetY.value = 0
  }

  function onDeviceOrientation(event: DeviceOrientationEvent) {
    if (event.beta === null || event.gamma === null) return
    if (baseBeta === null || baseGamma === null) {
      baseBeta = event.beta
      baseGamma = event.gamma
    }
    const deltaGamma = clamp((event.gamma - baseGamma) / 28, -1, 1)
    const deltaBeta = clamp((event.beta - baseBeta) / 28, -1, 1)
    gyroActive.value = true
    targetX.value = deltaGamma
    targetY.value = deltaBeta
  }

  function attachOrientationListener() {
    if (gyroListenerAttached) return
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true })
    gyroListenerAttached = true
  }

  async function requestGyroPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      return false
    }
    const orientationCtor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    if (typeof orientationCtor.requestPermission === 'function') {
      try {
        const result = await orientationCtor.requestPermission()
        if (result !== 'granted') return false
      } catch {
        return false
      }
    }
    baseBeta = null
    baseGamma = null
    attachOrientationListener()
    return true
  }

  function tick() {
    if (document.visibilityState === 'hidden') return
    const dx = targetX.value - smoothX.value
    const dy = targetY.value - smoothY.value
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return
    smoothX.value += dx * 0.14
    smoothY.value += dy * 0.14
  }

  onMounted(() => {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave, { passive: true })
    pointerListenerAttached = true

    const orientationCtor = typeof DeviceOrientationEvent !== 'undefined'
      ? (DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<'granted' | 'denied'>
        })
      : undefined
    if (orientationCtor && typeof orientationCtor.requestPermission !== 'function') {
      attachOrientationListener()
    }

    stepTimer = globalThis.setInterval(tick, 16)
  })

  onUnmounted(() => {
    if (stepTimer !== null) {
      globalThis.clearInterval(stepTimer)
      stepTimer = null
    }
    if (pointerListenerAttached) {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      pointerListenerAttached = false
    }
    if (gyroListenerAttached) {
      window.removeEventListener('deviceorientation', onDeviceOrientation)
      gyroListenerAttached = false
    }
  })

  const tiltX = computed(() => smoothX.value)
  const tiltY = computed(() => smoothY.value)

  const cardTransformStyle = computed(() => {
    const rotateY = (smoothX.value * 9).toFixed(2)
    const rotateX = (-smoothY.value * 7).toFixed(2)
    const sheenX = (50 + smoothX.value * 28).toFixed(1)
    const sheenY = (35 + smoothY.value * 24).toFixed(1)
    return {
      transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      '--sheen-x': `${sheenX}%`,
      '--sheen-y': `${sheenY}%`,
    }
  })

  return {
    tiltX,
    tiltY,
    gyroActive,
    cardTransformStyle,
    requestGyroPermission,
  }
}
