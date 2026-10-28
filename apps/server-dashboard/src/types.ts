export interface ServerTarget {
  alias: string
  name: string
  host: string
  role: string
  provider?: string
  note?: string
}

export type ServerHealthResult =
  | { target: ServerTarget; online: false; error: string }
  | {
      target: ServerTarget
      online: true
      hostname: string
      uptimeSeconds: number
      load: [number, number, number]
      cores: number
      memTotal: number
      memAvailable: number
      diskTotal: number
      diskUsed: number
    }

export interface BackupTarget {
  alias: string
  name: string
  host: string
  serviceUnit: string
  timerUnit: string
}

export interface BackupHealthResult {
  target: BackupTarget
  healthy: boolean
  timerState?: string
  timerSubState?: string
  serviceResult?: string
  exitStatus?: string
  exitAt?: string
  error?: string
}

export interface CheckSnapshot {
  checkedAt: string
  trigger: 'daily' | 'manual'
  servers: ServerHealthResult[]
  backups: BackupHealthResult[]
}

export interface HistoryDay {
  date: string
  online: boolean | null
}

export interface Overview {
  latest: CheckSnapshot | null
  history: { alias: string; days: HistoryDay[] }[]
  lastOnlineAt: Record<string, string | null>
}
