import { getDb } from '../../reminders/db.js';
import { listStartggWatchEvents, listEnabledStartggWatchPlayers, findStartggWatchSnapshot, listEventFeaturedEntrants, getFeaturedSeedCount, type StartggWatchEvent } from '../startggRepository.js';
import { hasStartggEventInterestOverride, isStartggVideogameFollowed, type StartggPendingEvent } from '../startggInterestRepository.js';
import { loadStartggPresetPlayersConfig } from '../startggPresetConfig.js';

export class StartggNotificationError extends Error {}

export interface DashboardSet {
  eventId: number; setId: number; roundLabel: string | null; displayScore: string | null;
  state: number | null; startedAt: number | null; completedAt: number | null; winnerId: number | null;
  slots: Array<{ entrantId: number | null; name: string | null }>;
  sources: Array<'player' | 'seed' | 'final'>; observedAt: string; url: string;
}
export interface DashboardPlayer {
  id: number; playerId: number; playerName: string; entrantId: number | null;
  status: string | null; placement: number | null; placementIsFinal: boolean;
  lastSetScoreText: string | null; lastSetRoundLabel: string | null; capturedAt: string | null; isPreset: boolean;
}
export interface DashboardSeed { seedNum: number; entrantId: number; entrantName: string; phaseId: number; phaseName: string | null }
export interface DashboardSnapshot {
  players: DashboardPlayer[]; seeds: DashboardSeed[];
  finalPhase: { id: number; name: string; numSeeds: number; entrants: DashboardSeed[]; standings: Array<{ placement: number; entrantId: number; entrantName: string }> } | null;
  eventState: string | null;
}
export function readDashboardSnapshot(rowId: number): { snapshot: DashboardSnapshot; snapshotAt: string } | null {
  const row = getDb().prepare('SELECT snapshot_json, snapshot_at FROM startgg_dashboard_event_state WHERE watch_event_id = ?').get(rowId) as { snapshot_json: string; snapshot_at: string } | undefined;
  return row ? { snapshot: JSON.parse(row.snapshot_json), snapshotAt: row.snapshot_at } : null;
}
export function markDashboardAttempt(scope: string): void {
  getDb().prepare(`INSERT INTO startgg_dashboard_sync_state(scope,last_attempt_at) VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET last_attempt_at=excluded.last_attempt_at`).run(scope, new Date().toISOString());
}
export function markDashboardSuccess(scope: string, full: boolean): void {
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO startgg_dashboard_sync_state(scope,last_success_at,last_full_success_at) VALUES (?,?,?) ON CONFLICT(scope) DO UPDATE SET last_success_at=excluded.last_success_at,last_full_success_at=CASE WHEN ? THEN excluded.last_success_at ELSE last_full_success_at END,last_error=NULL`).run(scope, now, full ? now : null, full ? 1 : 0);
}
export function markDashboardError(scope: string, error: unknown, notification = false): void {
  const column = notification || error instanceof StartggNotificationError ? 'notification_error' : 'last_error';
  getDb().prepare(`INSERT INTO startgg_dashboard_sync_state(scope,${column}) VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET ${column}=excluded.${column}`).run(scope, error instanceof Error ? error.message : String(error));
}
export function clearDashboardNotificationError(scope: string): void {
  getDb().prepare('UPDATE startgg_dashboard_sync_state SET notification_error=NULL WHERE scope=?').run(scope);
}
export function setDashboardStopReason(reason: string | null): void {
  getDb().prepare(`INSERT INTO startgg_dashboard_sync_state(scope,stop_reason) VALUES ('global',?) ON CONFLICT(scope) DO UPDATE SET stop_reason=excluded.stop_reason`).run(reason);
}
export function readDashboardSync(scope: string) {
  const row = getDb().prepare(`SELECT last_attempt_at AS lastAttemptAt,last_success_at AS lastSuccessAt,last_full_success_at AS lastFullSuccessAt,last_error AS lastError,notification_error AS notificationError,stop_reason AS stopReason FROM startgg_dashboard_sync_state WHERE scope=?`).get(scope) as { lastAttemptAt: string | null; lastSuccessAt: string | null; lastFullSuccessAt: string | null; lastError: string | null; notificationError: string | null; stopReason: string | null } | undefined;
  return row ?? { lastAttemptAt: null, lastSuccessAt: null, lastFullSuccessAt: null, lastError: null, notificationError: null, stopReason: null };
}
export function saveDashboardSnapshot(rowId: number, snapshot: DashboardSnapshot, sets: DashboardSet[], full: boolean): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE startgg_dashboard_sets SET current_scope=0 WHERE watch_event_id=?').run(rowId);
    const insert = db.prepare(`INSERT INTO startgg_dashboard_sets(watch_event_id,set_id,payload_json,completed_at,current_scope) VALUES (?,?,?,?,1) ON CONFLICT(watch_event_id,set_id) DO UPDATE SET payload_json=excluded.payload_json,completed_at=excluded.completed_at,current_scope=1`);
    const existingSet = db.prepare('SELECT payload_json FROM startgg_dashboard_sets WHERE watch_event_id=? AND set_id=?');
    for (const set of sets) {
      const previous = existingSet.get(rowId, set.setId) as { payload_json: string } | undefined;
      if (previous) {
        const old = JSON.parse(previous.payload_json) as DashboardSet;
        set.sources = [...new Set([...old.sources, ...set.sources])];
      }
      insert.run(rowId, set.setId, JSON.stringify(set), set.completedAt);
    }
    db.prepare(`INSERT INTO startgg_dashboard_event_state(watch_event_id,snapshot_json,snapshot_at) VALUES (?,?,?) ON CONFLICT(watch_event_id) DO UPDATE SET snapshot_json=excluded.snapshot_json,snapshot_at=excluded.snapshot_at`).run(rowId, JSON.stringify(snapshot), new Date().toISOString());
    markDashboardSuccess(String(rowId), full);
  })();
}
export function readDashboardSets(rowId: number, live = false): DashboardSet[] {
  const rows = getDb().prepare(`SELECT payload_json FROM startgg_dashboard_sets WHERE watch_event_id=? ${live ? 'AND current_scope=1 AND completed_at IS NULL' : ''} ORDER BY completed_at DESC,set_id DESC`).all(rowId) as Array<{ payload_json: string }>;
  const sets = rows.map(row => JSON.parse(row.payload_json) as DashboardSet);
  return live ? sets.filter(set => set.startedAt !== null) : sets;
}
export function dashboardEvent(row: StartggWatchEvent) {
  const snapshot = readDashboardSnapshot(row.id);
  return { eventId: row.event_id, eventSlug: row.event_slug, eventName: row.event_display_name ?? row.event_name,
    tournamentName: row.tournament_name, videogameName: row.videogame_name, active: row.active === 1,
    eventState: snapshot?.snapshot.eventState ?? row.event_state,
    interest: row.videogame_id !== null && isStartggVideogameFollowed(row.videogame_id) ? 'follow' : hasStartggEventInterestOverride(row.event_slug) ? 'event' : 'none',
    snapshotAt: snapshot?.snapshotAt ?? null, ...readDashboardSync(String(row.id)), liveCount: row.active === 1 ? readDashboardSets(row.id, true).length : 0 };
}
export function dashboardPlayers(rowId?: number): DashboardPlayer[] {
  const presetIds = new Set(loadStartggPresetPlayersConfig().players.map(player => player.player_id));
  return listEnabledStartggWatchPlayers().map(player => {
    const snapshot = rowId === undefined ? null : findStartggWatchSnapshot(player.id, rowId);
    return { id: player.id, playerId: player.player_id, playerName: player.player_name, entrantId: null,
      status: snapshot?.status ?? null, placement: snapshot?.placement ?? null, placementIsFinal: false,
      lastSetScoreText: snapshot?.last_set_score_text ?? null, lastSetRoundLabel: snapshot?.last_set_round_label ?? null,
      capturedAt: snapshot?.captured_at ?? null, isPreset: presetIds.has(player.player_id) };
  });
}
export function dashboardEventPlayers(rowId: number, active = true): DashboardPlayer[] {
  const snapshot = readDashboardSnapshot(rowId);
  if (!snapshot) return dashboardPlayers(rowId);
  if (!active) return snapshot.snapshot.players;
  const knownIds = new Set(snapshot.snapshot.players.map(player => player.id));
  // New configuration is visible immediately, with no invented collected status.
  const awaitingFirstCollection = dashboardPlayers().filter(player => !knownIds.has(player.id));
  return [...snapshot.snapshot.players, ...awaitingFirstCollection];
}
export function dashboardSeeds(rowId: number): DashboardSeed[] {
  return listEventFeaturedEntrants(rowId).map(seed => ({ seedNum: seed.seed_num, entrantId: seed.entrant_id, entrantName: seed.entrant_name, phaseId: seed.phase_id, phaseName: null }));
}
export function dashboardFollowing() {
  const db = getDb();
  const pending = db.prepare('SELECT * FROM startgg_pending_events WHERE tournament_end_at > ? ORDER BY id').all(new Date().toISOString()) as StartggPendingEvent[];
  return { servedAt: new Date().toISOString(), players: dashboardPlayers(),
    preferences: db.prepare(`SELECT videogame_id AS videogameId,videogame_name AS videogameName FROM startgg_videogame_preferences WHERE preference='follow'`).all(),
    eventInterests: db.prepare('SELECT event_slug AS eventSlug,tournament_end_at AS expiresAt FROM startgg_event_interest_overrides WHERE tournament_end_at > ?').all(new Date().toISOString()),
    pending: pending.map(item => ({ id: item.id, eventSlug: item.event_slug, eventName: item.event_name, tournamentName: item.tournament_name, videogameName: item.videogame_name, playerNames: JSON.parse(item.player_names) as string[] })),
    featuredSeedCount: getFeaturedSeedCount() };
}
export function findDashboardEvent(eventId: number): StartggWatchEvent | undefined {
  return listStartggWatchEvents().find(row => row.event_id === eventId);
}
