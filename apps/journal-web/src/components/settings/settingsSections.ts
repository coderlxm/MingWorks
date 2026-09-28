import { CollectionTag, Document, Link, Postcard, User } from '@element-plus/icons-vue';

export const settingsGroups = [
  { name: 'site', label: '站点资料' },
  { name: 'sharing', label: '内容与分享' },
] as const;

export const settingsSections = [
  { name: 'profile', group: 'site', label: '公开资料', description: '头像、Bio 与自我介绍', icon: User },
  { name: 'contacts', group: 'site', label: '联系方式', description: '「关于我」中的联系入口', icon: Postcard },
  { name: 'tags', group: 'site', label: '频道标签', description: '信息流常驻标签与顺序', icon: CollectionTag },
  { name: 'resume', group: 'sharing', label: '个人简历', description: '简历文件与访问权限', icon: Document },
  { name: 'contribution', group: 'sharing', label: '投稿链接', description: '朋友投稿入口与二维码', icon: Link },
] as const;

export type SettingsSectionName = typeof settingsSections[number]['name'];

export function isSettingsSectionName(value: unknown): value is SettingsSectionName {
  return settingsSections.some(section => section.name === value);
}
