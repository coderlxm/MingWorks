import type { CompileLogEntry } from '../types'

export const WEDDING_CONFIG = {
  groom: '马勋豪',
  bride: '张郡桐',
  dateFull: '2026年11月28日',
  dateCompact: '2026 · 11 · 28',
  city: '昆明',
  venueLabel: '中国 · 昆明',
  kinship: '表哥',
  sender: '小明',
  senderTitle: '表哥 小明',
  stampText: '小明贺印',
  waxSymbol: '囍',
  coreWish: '百年好合 · 万事顺意',
  coreWishRaw: '百年好合、万事顺意',
  quickReceiptNotes: [
    '谢谢表哥！祝福收到啦 🥂',
    '来自昆明的感谢，这 3D 礼花太酷了！🎆',
    '收到！一定百年好合、万事顺意 ✨',
  ] as const,
} as const

export const COMPILE_LOGS: readonly CompileLogEntry[] = [
  {
    step: '01',
    tag: 'INIT',
    detail: 'Mounting wedding card target: 马勋豪 ♥ 张郡桐',
  },
  {
    step: '02',
    tag: 'GEO',
    detail: 'Syncing stage coordinates -> 2026-11-28 · 昆明 (Spring City)',
  },
  {
    step: '03',
    tag: 'AUTH',
    detail: 'Verified signature: Kinship(表哥) · Author(小明) · MingWorks',
  },
  {
    step: '04',
    tag: '3D_FX',
    detail: 'Compiled 3 interactive scenes [鎏金圣殿 / 绯红良缘 / 星夜电玩]',
  },
  {
    step: '05',
    tag: 'AUDIO',
    detail: 'Synthesizing zero-latency Web Audio wedding music box tracks',
  },
  {
    step: '06',
    tag: 'BLESS',
    detail: 'Payload locked: 百年好合、万事顺意 [✓]',
    highlight: true,
  },
]

export const SOURCE_BLESSING_CODE = `// 专属于 马勋豪 & 张郡桐 的新婚祝福源码
// Crafted with love by 表哥 · 小明 @ MingWorks

interface WeddingUnion {
  readonly groom: '马勋豪';
  readonly bride: '张郡桐';
  readonly date: '2026-11-28';
  readonly city: '昆明';
  readonly author: '表哥 · 小明';
}

export function grantLifetimeBlessing(union: WeddingUnion) {
  const buffs = [
    '百年好合',
    '万事顺意',
    '三餐四季常暖',
    '携手欢喜顺遂',
  ] as const;

  return {
    ...union,
    status: 'FOREVER_CO_OP' as const,
    blessing: buffs.join(' · '),
    signature: '表哥 小明 敬祝',
  };
}`
