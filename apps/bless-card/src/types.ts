export type ThemeId = 'gilded' | 'crimson' | 'starlight'

export interface CompileLogEntry {
  step: string
  tag: string
  detail: string
  highlight?: boolean
}

export interface ThemeConfig {
  id: ThemeId
  label: string
  emoji: string
  badge: string
  subtitle: string
  headline: string
  blessLines: readonly string[]
  sealTitle: string
  sealSubtitle: string
  hudText?: string
  musicLabel: string
  palette: {
    backdrop: string
    glowTop: string
    glowBottom: string
    cardSurface: string
    cardBorder: string
    cardShadow: string
    primary: string
    secondary: string
    textMain: string
    textMuted: string
    pillBg: string
    pillActiveBg: string
    pillActiveText: string
    stampBorder: string
    stampText: string
  }
}

export interface ReceiptResult {
  ok: true
  receivedAt: string
}
