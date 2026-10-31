import { getDb } from '../../reminders/db.js';
import { bj, bjDate } from '../../utils/time.js';
import { checkServerHealth, type ServerHealthResult } from './serverHealth.js';
import { checkDashboardBackupHealth, type BackupHealthResult } from './backupHealth.js';

type CheckTrigger = 'daily' | 'manual';

interface CheckResult {
  servers: ServerHealthResult[];
  backups: BackupHealthResult[];
}

export interface ServerHealthSnapshot extends CheckResult {
  checkedAt: string;
  trigger: CheckTrigger;
}

export interface ServerHealthOverview {
  latest: ServerHealthSnapshot | null;
  history: { alias: string; days: { date: string; online: boolean | null }[] }[];
  lastOnlineAt: Record<string, string | null>;
}

interface CheckRow {
  checked_at: string;
  trigger: CheckTrigger;
  result_json: string;
}

export function saveServerHealthSnapshot(snapshot: ServerHealthSnapshot): void {
  const { checkedAt, trigger, servers, backups } = snapshot;
  getDb().prepare(`INSERT INTO server_health_checks (checked_at, trigger, result_json) VALUES (?, ?, ?)`)
    .run(checkedAt, trigger, JSON.stringify({ servers, backups }));
}

export async function runServerHealthCheck(trigger: CheckTrigger): Promise<ServerHealthSnapshot> {
  const [servers, backups] = await Promise.all([checkServerHealth(), checkDashboardBackupHealth()]);
  const snapshot = { checkedAt: new Date().toISOString(), trigger, servers, backups };
  saveServerHealthSnapshot(snapshot);
  return snapshot;
}

export function readServerHealthOverview(): ServerHealthOverview {
  const rows = getDb().prepare(`SELECT checked_at, trigger, result_json FROM server_health_checks ORDER BY checked_at DESC, id DESC`)
    .all() as CheckRow[];
  const snapshots = rows.map(row => ({
    checkedAt: row.checked_at,
    trigger: row.trigger,
    ...(JSON.parse(row.result_json) as CheckResult),
  }));
  const latest = snapshots[0];
  if (!latest) return { latest: null, history: [], lastOnlineAt: {} };

  const today = bj().startOf('day');
  const dates = Array.from({ length: 30 }, (_, index) => today.subtract(29 - index, 'day').format('YYYY-MM-DD'));
  const dailySnapshots = new Map<string, ServerHealthSnapshot>();
  const lastOnlineAt: Record<string, string | null> = Object.fromEntries(latest.servers.map(server => [server.target.alias, null]));
  for (const snapshot of snapshots) {
    const date = bjDate(snapshot.checkedAt);
    if (dates.includes(date) && !dailySnapshots.has(date)) dailySnapshots.set(date, snapshot);
    for (const server of snapshot.servers) {
      if (server.online && lastOnlineAt[server.target.alias] === null) lastOnlineAt[server.target.alias] = snapshot.checkedAt;
    }
  }

  return {
    latest,
    history: latest.servers.map(server => ({
      alias: server.target.alias,
      days: dates.map(date => ({
        date,
        online: dailySnapshots.get(date)?.servers.find(item => item.target.alias === server.target.alias)?.online ?? null,
      })),
    })),
    lastOnlineAt,
  };
}
