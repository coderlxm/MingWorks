import { onMounted, onUnmounted, shallowRef } from 'vue'
import type { ThemeId } from '../types'

interface StepNote {
  freq: number
  bass?: number
  duration: number
}

// Three distinct synthesized wedding music box scores (zero external audio files).
const THEME_SCORES: Record<ThemeId, { tempoMs: number; wave: OscillatorType; notes: readonly StepNote[] }> = {
  gilded: {
    tempoMs: 360,
    wave: 'triangle',
    notes: [
      { freq: 659.25, bass: 261.63, duration: 0.72 },
      { freq: 587.33, duration: 0.55 },
      { freq: 523.25, duration: 0.55 },
      { freq: 493.88, bass: 196.0, duration: 0.72 },
      { freq: 440.0, duration: 0.55 },
      { freq: 392.0, duration: 0.55 },
      { freq: 440.0, bass: 220.0, duration: 0.72 },
      { freq: 493.88, duration: 0.55 },
      { freq: 523.25, bass: 261.63, duration: 0.72 },
      { freq: 587.33, duration: 0.55 },
      { freq: 659.25, bass: 196.0, duration: 0.75 },
      { freq: 783.99, duration: 0.85 },
      { freq: 659.25, bass: 174.61, duration: 0.7 },
      { freq: 587.33, duration: 0.6 },
      { freq: 523.25, bass: 196.0, duration: 0.9 },
      { freq: 0, duration: 0.25 },
    ],
  },
  crimson: {
    tempoMs: 340,
    wave: 'sine',
    notes: [
      { freq: 523.25, bass: 261.63, duration: 0.65 },
      { freq: 587.33, duration: 0.5 },
      { freq: 659.25, duration: 0.5 },
      { freq: 783.99, bass: 196.0, duration: 0.8 },
      { freq: 880.0, duration: 0.55 },
      { freq: 783.99, duration: 0.6 },
      { freq: 659.25, bass: 220.0, duration: 0.7 },
      { freq: 587.33, duration: 0.55 },
      { freq: 659.25, bass: 261.63, duration: 0.65 },
      { freq: 783.99, duration: 0.6 },
      { freq: 1046.5, bass: 261.63, duration: 0.9 },
      { freq: 880.0, duration: 0.55 },
      { freq: 783.99, bass: 196.0, duration: 0.75 },
      { freq: 659.25, duration: 0.55 },
      { freq: 587.33, duration: 0.6 },
      { freq: 523.25, bass: 261.63, duration: 0.95 },
    ],
  },
  starlight: {
    tempoMs: 260,
    wave: 'square',
    notes: [
      { freq: 523.25, bass: 130.81, duration: 0.38 },
      { freq: 659.25, duration: 0.35 },
      { freq: 783.99, duration: 0.38 },
      { freq: 1046.5, bass: 196.0, duration: 0.5 },
      { freq: 987.77, duration: 0.38 },
      { freq: 783.99, duration: 0.42 },
      { freq: 659.25, bass: 220.0, duration: 0.42 },
      { freq: 783.99, duration: 0.38 },
      { freq: 880.0, bass: 174.61, duration: 0.45 },
      { freq: 1046.5, duration: 0.42 },
      { freq: 1174.66, bass: 196.0, duration: 0.52 },
      { freq: 1046.5, duration: 0.45 },
      { freq: 987.77, bass: 196.0, duration: 0.45 },
      { freq: 783.99, duration: 0.45 },
      { freq: 1046.5, bass: 261.63, duration: 0.7 },
      { freq: 0, duration: 0.25 },
    ],
  },
}

export function useWeddingMusicBox() {
  const isPlaying = shallowRef(false)
  const activeTheme = shallowRef<ThemeId>('gilded')

  let audioCtx: AudioContext | null = null
  let stepIndex = 0
  let sequencerTimer: ReturnType<typeof globalThis.setInterval> | null = null

  function ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext
    if (!Ctor) return null
    if (!audioCtx) {
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  }

  function triggerTone(ctx: AudioContext, freq: number, duration: number, wave: OscillatorType, volume: number) {
    if (freq <= 0) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const overtone = ctx.createOscillator()
    const gain = ctx.createGain()
    const overtoneGain = ctx.createGain()

    osc.type = wave
    osc.frequency.setValueAtTime(freq, now)

    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(freq * 2, now)

    const peak = wave === 'square' ? volume * 0.42 : volume
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    overtoneGain.gain.setValueAtTime(0.0001, now)
    overtoneGain.gain.exponentialRampToValueAtTime(peak * 0.28, now + 0.012)
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.65)

    osc.connect(gain)
    overtone.connect(overtoneGain)
    gain.connect(ctx.destination)
    overtoneGain.connect(ctx.destination)

    osc.start(now)
    overtone.start(now)
    osc.stop(now + duration + 0.04)
    overtone.stop(now + duration + 0.04)
  }

  function playStep() {
    if (!isPlaying.value || document.visibilityState === 'hidden') return
    const ctx = ensureContext()
    if (!ctx) return
    const score = THEME_SCORES[activeTheme.value]
    const note = score.notes[stepIndex % score.notes.length]
    stepIndex += 1
    if (!note) return
    if (note.freq > 0) {
      triggerTone(ctx, note.freq, note.duration, score.wave, 0.085)
    }
    if (note.bass) {
      triggerTone(ctx, note.bass, note.duration * 1.15, 'sine', 0.045)
    }
  }

  function clearSequencer() {
    if (sequencerTimer !== null) {
      globalThis.clearInterval(sequencerTimer)
      sequencerTimer = null
    }
  }

  function scheduleSequencer() {
    clearSequencer()
    const score = THEME_SCORES[activeTheme.value]
    playStep()
    sequencerTimer = globalThis.setInterval(playStep, score.tempoMs)
  }

  function startMusic(theme: ThemeId) {
    activeTheme.value = theme
    isPlaying.value = true
    stepIndex = 0
    scheduleSequencer()
  }

  function stopMusic() {
    isPlaying.value = false
    clearSequencer()
    if (audioCtx && audioCtx.state === 'running') {
      void audioCtx.suspend()
    }
  }

  function toggleMusic(theme: ThemeId) {
    activeTheme.value = theme
    if (isPlaying.value) {
      stopMusic()
    } else {
      startMusic(theme)
    }
  }

  function switchThemeMusic(theme: ThemeId) {
    activeTheme.value = theme
    if (isPlaying.value) {
      stepIndex = 0
      scheduleSequencer()
    }
  }

  function playSparkleChime(theme: ThemeId) {
    const ctx = ensureContext()
    if (!ctx) return
    const arpeggio = theme === 'crimson'
      ? [523.25, 659.25, 783.99, 1046.5]
      : theme === 'starlight'
        ? [587.33, 783.99, 987.77, 1318.51]
        : [523.25, 659.25, 783.99, 987.77, 1318.51]

    arpeggio.forEach((freq, idx) => {
      globalThis.setTimeout(() => {
        if (!audioCtx) return
        triggerTone(audioCtx, freq, 0.42, theme === 'starlight' ? 'triangle' : 'sine', 0.075)
      }, idx * 65)
    })
  }

  function handleVisibilityChange() {
    if (!audioCtx) return
    if (document.visibilityState === 'hidden' && audioCtx.state === 'running') {
      void audioCtx.suspend()
    } else if (document.visibilityState === 'visible' && isPlaying.value && audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    clearSequencer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (audioCtx) {
      void audioCtx.close()
      audioCtx = null
    }
  })

  return {
    isPlaying,
    startMusic,
    stopMusic,
    toggleMusic,
    switchThemeMusic,
    playSparkleChime,
  }
}
