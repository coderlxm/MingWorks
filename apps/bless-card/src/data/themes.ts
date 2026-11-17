import type { ThemeConfig, ThemeId } from '../types'

export const THEME_ORDER: readonly ThemeId[] = ['gilded', 'crimson', 'starlight']

export const WEDDING_THEMES: Record<ThemeId, ThemeConfig> = {
  gilded: {
    id: 'gilded',
    label: '鎏金圣殿',
    emoji: '💍',
    badge: 'GILDED SANCTUARY',
    subtitle: '香槟金双戒浮光 · 春城初冬暖阳',
    headline: '百年好合 · 万事顺意',
    blessLines: [
      '把十一月底昆明的暖阳与好风景，都折进这张烫金贺卡里。',
      '愿往后朝朝暮暮，眉眼常带笑意，凡所期盼皆得圆满。',
    ],
    sealTitle: '鎏金喜帖 · 待君亲启',
    sealSubtitle: '表哥小明 为马勋豪 & 张郡桐 定制',
    musicLabel: '八音盒 · 圣殿圆舞',
    palette: {
      backdrop:
        'radial-gradient(circle at 50% 18%, rgba(240, 201, 120, 0.22), transparent 52%), radial-gradient(circle at 82% 84%, rgba(235, 169, 164, 0.16), transparent 48%), linear-gradient(165deg, #1d150f 0%, #140f0b 55%, #0c0907 100%)',
      glowTop: 'rgba(240, 201, 120, 0.34)',
      glowBottom: 'rgba(235, 169, 164, 0.26)',
      cardSurface:
        'linear-gradient(150deg, rgba(48, 34, 23, 0.86) 0%, rgba(26, 19, 13, 0.92) 60%, rgba(36, 24, 18, 0.88) 100%)',
      cardBorder: 'rgba(245, 208, 138, 0.42)',
      cardShadow: '0 26px 70px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 244, 214, 0.22)',
      primary: '#f5d08a',
      secondary: '#eba9a4',
      textMain: '#fdf5e8',
      textMuted: 'rgba(245, 224, 196, 0.78)',
      pillBg: 'rgba(30, 22, 16, 0.72)',
      pillActiveBg: 'linear-gradient(135deg, #f5d08a 0%, #dfa857 100%)',
      pillActiveText: '#23160b',
      stampBorder: 'rgba(235, 124, 124, 0.72)',
      stampText: '#f4a6b8',
    },
  },
  crimson: {
    id: 'crimson',
    label: '绯红良缘',
    emoji: '🏮',
    badge: 'CRIMSON DYNASTY',
    subtitle: '朱砂宫灯金喜 · 佳偶天成之喜',
    headline: '百年好合 · 万事顺意',
    blessLines: [
      '吉日良辰，红妆鎏金映春城；良缘永结，自此烟火共白头。',
      '谨祝勋豪与郡桐同心同德、喜乐安康，岁岁皆胜意。',
    ],
    sealTitle: '绯红鸾笺 · 金喜启封',
    sealSubtitle: '表哥小明 恭贺勋豪 & 郡桐新婚大喜',
    musicLabel: '八音盒 · 宫灯喜韵',
    palette: {
      backdrop:
        'radial-gradient(circle at 50% 16%, rgba(251, 191, 36, 0.2), transparent 50%), radial-gradient(circle at 20% 84%, rgba(225, 29, 72, 0.28), transparent 52%), linear-gradient(165deg, #420813 0%, #2a050b 52%, #170307 100%)',
      glowTop: 'rgba(251, 191, 36, 0.34)',
      glowBottom: 'rgba(244, 63, 94, 0.32)',
      cardSurface:
        'linear-gradient(155deg, rgba(92, 14, 28, 0.88) 0%, rgba(56, 8, 17, 0.93) 62%, rgba(72, 10, 22, 0.9) 100%)',
      cardBorder: 'rgba(251, 207, 118, 0.5)',
      cardShadow: '0 28px 72px rgba(24, 2, 7, 0.7), inset 0 1px 0 rgba(254, 240, 199, 0.25)',
      primary: '#fcd34d',
      secondary: '#fda4af',
      textMain: '#fff4e6',
      textMuted: 'rgba(254, 226, 212, 0.82)',
      pillBg: 'rgba(54, 8, 17, 0.76)',
      pillActiveBg: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
      pillActiveText: '#380710',
      stampBorder: 'rgba(252, 211, 77, 0.78)',
      stampText: '#fde68a',
    },
  },
  starlight: {
    id: 'starlight',
    label: '星夜电玩',
    emoji: '🎮',
    badge: 'STARLIGHT CO-OP',
    subtitle: '双人同屏主线开启 · 星河通关浪漫',
    headline: '百年好合 · 万事顺意',
    blessLines: [
      '人生副本正式切换为双人联机模式，所有好装备和好运气都双倍掉落。',
      '表哥给你们挂满「幸福常驻」和「万事顺意」永久满级 Buff！',
    ],
    sealTitle: '新婚联机卡带 · 按下启封',
    sealSubtitle: 'DEV BY 表哥小明 · PLAYER 1 & 2 READY',
    hudText: 'P1 马勋豪  ♥ CO-OP ♥  P2 张郡桐  ·  STAGE: KUNMING',
    musicLabel: '八音盒 · 星夜 8-Bit',
    palette: {
      backdrop:
        'radial-gradient(circle at 50% 18%, rgba(196, 181, 253, 0.24), transparent 52%), radial-gradient(circle at 80% 82%, rgba(244, 114, 182, 0.22), transparent 50%), linear-gradient(165deg, #1b103a 0%, #110927 56%, #090516 100%)',
      glowTop: 'rgba(196, 181, 253, 0.36)',
      glowBottom: 'rgba(244, 114, 182, 0.32)',
      cardSurface:
        'linear-gradient(152deg, rgba(35, 21, 74, 0.86) 0%, rgba(20, 12, 46, 0.92) 60%, rgba(33, 18, 63, 0.88) 100%)',
      cardBorder: 'rgba(244, 114, 182, 0.45)',
      cardShadow: '0 28px 72px rgba(7, 3, 20, 0.72), inset 0 1px 0 rgba(233, 213, 255, 0.24)',
      primary: '#fbbf24',
      secondary: '#f472b6',
      textMain: '#f7f1ff',
      textMuted: 'rgba(229, 214, 255, 0.8)',
      pillBg: 'rgba(24, 14, 52, 0.76)',
      pillActiveBg: 'linear-gradient(135deg, #f472b6 0%, #fbbf24 100%)',
      pillActiveText: '#1b0d33',
      stampBorder: 'rgba(244, 114, 182, 0.75)',
      stampText: '#f9a8d4',
    },
  },
}
