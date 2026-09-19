import type { Telegraf } from 'telegraf';
import { config } from '../../config/index.js';
import { getDb } from '../../reminders/db.js';
import { enableStartggPolling, disableStartggPolling, isStartggPollingEnabled, updateStartggFastWatch } from '../../scheduled/jobs.js';
import { runStartggGo, runStartggWatchNow, syncStartggPresetPlayers, syncFeaturedEntrantsForActiveEvents, resyncFeaturedEntrantsForActiveEvents } from '../startggPresetSync.js';
import { createStartggWatchPlayer, findStartggWatchPlayerByPlayerId, updateStartggWatchPlayerIdentity, listActiveStartggWatchEvents, listEnabledStartggWatchPlayers, replaceActiveStartggWatchEvent, setFeaturedSeedCount, type StartggFeaturedSeedCount } from '../startggRepository.js';
import { findStartggPendingEventById, isStartggVideogameFollowed, hasStartggEventInterestOverride, isStartggEventDismissed, followStartggVideogame, addStartggEventInterestOverride, dismissStartggEvent, deleteStartggPendingEvent, deleteStartggPendingEventsByVideogame, type StartggPendingEvent } from '../startggInterestRepository.js';
import { discoverStartggActiveEventsForPlayers } from '../startggDiscovery.js';
import { fetchEventMeta, listEventEntrantPlayers, resolveUserToPlayer, runStartggWatchOnce } from './tracker.js';
import { StartggNotificationError, markDashboardAttempt, markDashboardError } from './dashboardRepository.js';
import { runStartggTask } from './taskQueue.js';

export async function syncStartggDashboard(bot: Telegraf, resume = false) {
  return runStartggTask(async () => {
    markDashboardAttempt('global');
    try {
      const summary = await runStartggWatchNow(bot);
      if (resume) enableStartggPolling(bot, false);
      if (isStartggPollingEnabled()) updateStartggFastWatch(bot, summary.activeEventSlugs);
      return summary;
    } catch (error) {
      markDashboardError('global', error);
      throw error;
    }
  });
}
export async function pauseStartggDashboard() {
  return runStartggTask(async () => ({ paused: disableStartggPolling() }));
}
export async function setStartggDashboardSeeds(bot: Telegraf, count: StartggFeaturedSeedCount) {
  return runStartggTask(async () => {
    await resyncFeaturedEntrantsForActiveEvents(count);
    setFeaturedSeedCount(count);
    const summary = await runStartggWatchOnce(bot);
    if (isStartggPollingEnabled()) updateStartggFastWatch(bot, summary.activeEventSlugs);
    return { count, ...summary };
  });
}
export async function startStartggDashboardEvent(bot: Telegraf, eventSlug: string, interest: 'follow' | 'event' = 'follow') {
  return runStartggTask(async () => {
    const event = await fetchEventMeta(eventSlug);
    if (!event.tournamentName || event.tournamentEndAt === null || event.videogameId === null || !event.videogameName) throw new Error('该项目缺少大会或游戏资料。');
    if (interest === 'event' && isStartggVideogameFollowed(event.videogameId)) throw new Error('该游戏已长期关注；本届关注不会取消长期偏好，请使用已关注游戏的启动操作。');
    await syncStartggPresetPlayers();
    if (interest === 'follow') followStartggVideogame(event.videogameId, event.videogameName);
    else addStartggEventInterestOverride(event.slug, new Date(event.tournamentEndAt * 1000).toISOString());
    replaceActiveStartggWatchEvent(event.slug, `${event.tournamentName} / ${event.name}`, event.tournamentName, event.name, new Date(event.tournamentEndAt * 1000).toISOString(), event.videogameId, event.videogameName);
    let summary;
    try {
      await syncFeaturedEntrantsForActiveEvents();
      summary = await runStartggWatchOnce(bot);
    } catch (error) {
      const message = `已保存关注并切换项目，启动失败：${error instanceof Error ? error.message : String(error)}`;
      const failure = error instanceof StartggNotificationError
        ? new StartggNotificationError(message, { cause: error })
        : new Error(message, { cause: error });
      markDashboardError('global', failure);
      throw failure;
    }
    enableStartggPolling(bot, false);
    updateStartggFastWatch(bot, summary.activeEventSlugs);
    const pending = getDb().prepare(`SELECT * FROM startgg_pending_events WHERE ${interest === 'follow' ? 'videogame_id' : 'event_slug'}=?`).all(interest === 'follow' ? event.videogameId : event.slug) as StartggPendingEvent[];
    if (interest === 'follow') deleteStartggPendingEventsByVideogame(event.videogameId);
    else for (const item of pending) deleteStartggPendingEvent(item.id);
    await updateInterestPrompts(bot, pending, `已${interest === 'follow' ? '长期关注游戏' : '关注本届此项目'}：${interest === 'follow' ? event.videogameName : event.name}\n已启动监控。`);
    return { eventId: event.id, eventSlug: event.slug, interest, ...summary };
  });
}
export async function applyStartggInterest(bot: Telegraf, pendingId: number, action: 'follow' | 'event' | 'dismiss', updatePrompt = true) {
  return runStartggTask(async () => {
    const pending = findStartggPendingEventById(pendingId);
    if (!pending || pending.tournament_end_at <= new Date().toISOString()) throw new Error('该赛事确认项已失效，请刷新当前状态。');
    const affected = action === 'follow'
      ? getDb().prepare('SELECT * FROM startgg_pending_events WHERE videogame_id=?').all(pending.videogame_id) as StartggPendingEvent[]
      : [pending];
    if (action === 'follow') followStartggVideogame(pending.videogame_id, pending.videogame_name);
    if (action === 'event') addStartggEventInterestOverride(pending.event_slug, pending.tournament_end_at);
    if (action === 'dismiss') dismissStartggEvent(pending.event_slug, pending.tournament_end_at);
    if (action !== 'dismiss') {
      try {
        const summary = await runStartggGo(bot, '', pending.event_slug);
        if (summary.status !== 'started') throw new Error('所选赛事未启动监控。');
        enableStartggPolling(bot, false);
        updateStartggFastWatch(bot, summary.activeEventSlugs);
      } catch (error) {
        const message = `已保存关注，启动失败：${error instanceof Error ? error.message : String(error)}`;
        if (error instanceof StartggNotificationError) throw new StartggNotificationError(message, { cause: error });
        throw new Error(message, { cause: error });
      }
    }
    if (action === 'follow') deleteStartggPendingEventsByVideogame(pending.videogame_id);
    else deleteStartggPendingEvent(pending.id);
    if (updatePrompt) await updateInterestPrompts(bot, affected,
      action === 'dismiss' ? `本届此项目不关注：${pending.event_name}` : `已${action === 'follow' ? '长期关注游戏' : '关注本届此项目'}：${action === 'follow' ? pending.videogame_name : pending.event_name}\n已启动监控。`);

    return { action, eventSlug: pending.event_slug };
  });
}
export async function discoverStartggDashboard() {
  await syncStartggPresetPlayers();
  const events = await discoverStartggActiveEventsForPlayers(listEnabledStartggWatchPlayers());
  return { events: events.map(event => ({ ...event, isFollowed: isStartggVideogameFollowed(event.videogameId),
    interest: isStartggVideogameFollowed(event.videogameId) ? 'follow' : hasStartggEventInterestOverride(event.eventSlug) ? 'event' : isStartggEventDismissed(event.eventSlug) ? 'dismissed' : 'none' })) };
}
export interface ResolvedDashboardPlayer { playerId: number; playerName: string; userId: number | null; gamerTag: string }
export async function resolveStartggDashboardPlayers(input: string): Promise<ResolvedDashboardPlayer[]> {
  if (/^(?:https?:\/\/)?(?:www\.)?start\.gg\/user\//i.test(input) || input.startsWith('user/')) return [await resolveUserToPlayer(input)];
  const candidates = new Map<number, ResolvedDashboardPlayer>();
  for (const event of listActiveStartggWatchEvents()) {
    for (const player of await listEventEntrantPlayers(event.event_slug)) {
      if (player.playerName.toLocaleLowerCase().includes(input.toLocaleLowerCase())) candidates.set(player.playerId, player);
    }
  }
  return [...candidates.values()];
}
export function addStartggDashboardPlayer(candidate: ResolvedDashboardPlayer) {
  const existing = findStartggWatchPlayerByPlayerId(candidate.playerId);
  if (existing) updateStartggWatchPlayerIdentity(existing.id, candidate.playerName, candidate.userId, candidate.gamerTag);
  else createStartggWatchPlayer(candidate.playerId, candidate.playerName, candidate.userId, candidate.gamerTag);
  return { playerId: candidate.playerId, playerName: candidate.playerName };
}

async function updateInterestPrompts(bot: Telegraf, pending: StartggPendingEvent[], text: string): Promise<void> {
  const messageIds = [...new Set(pending.map(item => item.prompt_message_id).filter((id): id is number => id !== null))];
  for (const messageId of messageIds) {
    try { await bot.telegram.editMessageText(config.tgChatId, messageId, undefined, text); }
    catch (error) { throw new StartggNotificationError(`关注已生效，Telegram 卡片更新失败：${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
  }
}

export async function dismissDiscoveredStartggEvent(bot: Telegraf, eventSlug: string) {
  return runStartggTask(async () => {
    const event = await fetchEventMeta(eventSlug);
    if (event.tournamentEndAt === null || event.videogameId === null) throw new Error('项目缺少大会结束时间或游戏资料。');
    if (isStartggVideogameFollowed(event.videogameId) || hasStartggEventInterestOverride(event.slug)) throw new Error('该项目已关注；发现列表的不关注操作不取消已有关注。');
    const pending = getDb().prepare('SELECT * FROM startgg_pending_events WHERE event_slug=?').all(event.slug) as StartggPendingEvent[];
    dismissStartggEvent(event.slug, new Date(event.tournamentEndAt * 1000).toISOString());
    for (const item of pending) deleteStartggPendingEvent(item.id);
    await updateInterestPrompts(bot, pending, `本届此项目不关注：${event.name}`);
    return { eventSlug: event.slug, interest: 'dismissed' };
  });
}
