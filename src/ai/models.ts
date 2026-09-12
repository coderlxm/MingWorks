export const DEEPSEEK_MODELS = {
  flash: 'deepseek-v4-flash',
  pro: 'deepseek-v4-pro',
} as const;

export const DEEPSEEK_TASK_MODELS = {
  structured: DEEPSEEK_MODELS.flash,
  writing: DEEPSEEK_MODELS.pro,
} as const;
