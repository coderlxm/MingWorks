import type { MasturbationRecord } from '../services/life/masturbationRepository.js';
import { type MasturbationSummary, formatSinceLatest } from '../services/life/masturbationTracker.js';
import { bj, bjFormat } from '../utils/time.js';

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

function formatLatestDisplay(latest: MasturbationRecord | undefined, now: Date): string {
  if (!latest) return '还没有记录';
  const occurredAt = bj(latest.occurred_at);
  const today = bj(now);
  const occurredDate = occurredAt.format('YYYY-MM-DD');
  const isToday = occurredDate === today.format('YYYY-MM-DD');
  const isYesterday = occurredDate === today.subtract(1, 'day').format('YYYY-MM-DD');

  if (latest.is_auto === 1) {
    const dayText = isToday ? '今天' : isYesterday ? '昨天' : occurredAt.format('MM-DD');
    return `${dayText} · 默认记录`;
  }

  let timeText: string;
  if (isToday) {
    timeText = `今天 ${occurredAt.format('HH:mm')}`;
  } else if (isYesterday) {
    timeText = `昨天 ${occurredAt.format('HH:mm')}`;
  } else {
    timeText = occurredAt.format('MM-DD HH:mm');
  }
  return latest.note ? `${timeText} · ${latest.note}` : timeText;
}

export function formatMasturbationStatusCard(summary: MasturbationSummary, now: Date = new Date()): string {
  return [
    '📝 撸了吗',
    '',
    `今天：${summary.todayCount} 次`,
    `本周最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
    `上一次：${formatLatestDisplay(summary.latest, now)}`,
  ].join('\n');
}

function formatSettleDateLabel(dateKey: string, now: Date): string {
  const target = bj(dateKey);
  const yesterdayKey = bj(now).subtract(1, 'day').format('YYYY-MM-DD');
  const mmdd = target.format('MM-DD');
  return dateKey === yesterdayKey ? `昨日（${mmdd}）` : mmdd;
}

export function formatMasturbationSettleCard(
  dateKey: string,
  dayCount: number,
  summary: MasturbationSummary,
  isInitialAuto = false,
  now: Date = new Date(),
): string {
  const label = formatSettleDateLabel(dateKey, now);
  if (dayCount === 0) {
    return [
      `🚫 撸了吗 · ${label}未撸`,
      '',
      `${label}：0 次`,
      `最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
    ].join('\n');
  }
  if (dayCount === 1) {
    const title = isInitialAuto
      ? `📝 撸了吗 · ${label}已默认记 1 次`
      : `✅ 撸了吗 · ${label}已记 1 次`;
    const lines = [
      title,
      '',
      `${label}：1 次（默认记录）`,
      `最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
    ];
    if (isInitialAuto) {
      lines.push('', '没撸点「昨天没撸」撤回，多撸点「再记一次」，其余无需操作。');
    }
    return lines.join('\n');
  }
  return [
    `✅ 撸了吗 · ${label}已记 ${dayCount} 次`,
    '',
    `${label}：${dayCount} 次`,
    `最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
  ].join('\n');
}

export function buildMasturbationSettleButtons(
  dateKey: string,
  dayCount: number,
  now: Date = new Date(),
): { reply_markup: InlineKeyboardMarkup } {
  const isYesterday = dateKey === bj(now).subtract(1, 'day').format('YYYY-MM-DD');
  const zeroLabel = isYesterday ? '🚫 昨天没撸' : '🚫 当日没撸';
  if (dayCount === 0) {
    return {
      reply_markup: {
        inline_keyboard: [[
          { text: '↩️ 恢复记 1 次', callback_data: `masturbation:settle_inc:${dateKey}` },
          { text: '📊 统计', callback_data: `masturbation:stats:${dateKey}` },
        ]],
      },
    };
  }
  if (dayCount === 1) {
    return {
      reply_markup: {
        inline_keyboard: [[
          { text: zeroLabel, callback_data: `masturbation:settle_zero:${dateKey}` },
          { text: '➕ 再记一次', callback_data: `masturbation:settle_inc:${dateKey}` },
          { text: '📊 统计', callback_data: `masturbation:stats:${dateKey}` },
        ]],
      },
    };
  }
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '➖ 减 1 次', callback_data: `masturbation:settle_dec:${dateKey}` },
        { text: '➕ 再记一次', callback_data: `masturbation:settle_inc:${dateKey}` },
        { text: '📊 统计', callback_data: `masturbation:stats:${dateKey}` },
      ]],
    },
  };
}

export function formatMasturbationCapturePromptCard(): string {
  return [
    '📝 撸了吗 · 记录',
    '',
    '请输入本次实际撸的时间和备注，例如：',
    '20:30 在卧室',
    '',
    '也可用自然语言，例如：晚上8点多在沙发上看片撸了一次',
    '请在 10 分钟内回复，回复 /cancel 可取消。',
  ].join('\n');
}

export function formatMasturbationCaptureCancelledCard(): string {
  return '↩️ 已取消本次记录。';
}

export function formatMasturbationConfirmCard(record: MasturbationRecord, todayCount: number): string {
  const lines = [
    '✅ 已记录',
    '',
    `本次：${bjFormat(record.occurred_at)}`,
    `今天：${todayCount} 次`,
  ];
  if (record.note) {
    lines.push(`备注：${record.note}`);
  }
  return lines.join('\n');
}

export function formatMasturbationUndoCard(todayCount: number): string {
  return [
    '↩️ 已撤销本次记录',
    `今天：${todayCount} 次`,
  ].join('\n');
}

export function formatMasturbationUndoCommand(record: MasturbationRecord): string {
  const timeDisplay = record.is_auto === 1
    ? `${bjFormat(record.occurred_at, 'YYYY-MM-DD')}（默认记录）`
    : bjFormat(record.occurred_at);
  return [
    '↩️ 已撤销最新一次记录',
    `归属时间：${timeDisplay}`,
  ].join('\n');
}

export function formatMasturbationStatsCard(summary: MasturbationSummary, now: Date = new Date()): string {
  const lines: string[] = [
    '📊 撸了吗统计',
    '',
    `今天：${summary.todayCount} 次`,
    `最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
    `最近 30 天：${summary.thirtyDayCount} 次 / ${summary.thirtyDayActiveDays} 天`,
  ];

  if (summary.latest) {
    lines.push(`距上一次：${formatSinceLatest(summary.latest, now)}`);
  } else {
    lines.push('还没有记录');
  }

  lines.push('', '最近 7 天');
  for (const day of summary.dailyCounts) {
    lines.push(`${day.date}  ${day.count}`);
  }
  return lines.join('\n');
}

export function buildMasturbationStatusButtons(referenceDate?: string | undefined): { reply_markup: InlineKeyboardMarkup } {
  const addCallbackData = referenceDate
    ? `masturbation:add:${referenceDate}`
    : 'masturbation:add';
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ 记一次（现在）', callback_data: 'masturbation:now' },
          { text: '✏️ 填时间/备注', callback_data: addCallbackData },
        ],
        [
          { text: '📊 查看统计', callback_data: 'masturbation:stats' },
        ],
      ],
    },
  };
}

export function buildMasturbationConfirmButtons(recordId: number): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '↩️ 撤销本次', callback_data: `masturbation:undo:${recordId}` },
        { text: '📊 查看统计', callback_data: 'masturbation:stats' },
      ]],
    },
  };
}

export function buildMasturbationStatsButtons(returnSettleDate?: string | undefined): { reply_markup: InlineKeyboardMarkup } {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [[
    { text: '✅ 记一次（现在）', callback_data: 'masturbation:now' },
    { text: '✏️ 填时间/备注', callback_data: 'masturbation:add' },
  ]];
  if (returnSettleDate) {
    rows.push([{ text: '⬅️ 返回结算卡片', callback_data: `masturbation:settle_view:${returnSettleDate}` }]);
  }
  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}
