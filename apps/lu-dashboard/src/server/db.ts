import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import type { MasturbationRecord } from '../shared/dashboard'
import { config } from './config'

const dbPath = resolve(config.databasePath)
const db = new Database(dbPath, { fileMustExist: true })

const columns = db.prepare('PRAGMA table_info(masturbation_records)').all() as Array<{ name: string }>
if (!columns.some((column) => column.name === 'is_auto')) {
  db.exec('ALTER TABLE masturbation_records ADD COLUMN is_auto INTEGER NOT NULL DEFAULT 0 CHECK (is_auto IN (0, 1))')
}

interface RecordRow {
  id: number
  occurred_at: string
  is_auto: number
}

const stmt = db.prepare(
  'SELECT id, occurred_at, is_auto FROM masturbation_records ORDER BY occurred_at ASC, id ASC',
)

export function loadRecords(): MasturbationRecord[] {
  return (stmt.all() as RecordRow[]).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    isAuto: row.is_auto === 1,
  }))
}

const insertRecord = db.prepare(
  'INSERT INTO masturbation_records (occurred_at, created_at, note, is_auto) VALUES (?, ?, NULL, 0)',
)

export function recordNow(): void {
  const now = new Date().toISOString()
  insertRecord.run(now, now)
}
