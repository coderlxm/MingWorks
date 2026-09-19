# DeepSeek 模型切换与集中管理方案

状态：已批准，已执行

## 1. 目标

本次拆成两个相互关联但范围独立的任务：

1. 将项目当前使用的 `deepseek-v4-flash` 切换为用户指定的 `deepseek-v4-pro`。
2. 将散落在各模块中的模型名称集中到一个共享源码位置，后续切换模型只改一处。

集中管理同时保留按真实业务场景选择 Flash 或 Pro 的空间；当前按“结构化解析”和“文字工作”两类管理，不预先建立复杂的场景路由。

目标只覆盖模型标识的管理，不改变提示词、请求参数、错误处理、client 生命周期或业务行为。

## 2. 当前源码盘点

写入本方案前，工作区无未提交改动；本次新增本方案文件是当前预期的唯一变更。源码中没有发现其他 AI 模型名称；`photoLibraryService.ts` 中的 `model` 是相机元数据字段，不属于 AI 模型配置。

### 2.1 直接写死 `deepseek-v4-flash` 的位置

| 文件 | 位置 | 用途 |
| --- | --- | --- |
| `src/services/avContentParser.ts` | 185 | AI 选择最佳磁力文件 |
| `src/services/avContentParser.ts` | 214 | AI 翻译并整理 AV 标签 |
| `src/services/avTracker.ts` | 130 | 翻译 AV 标题 |
| `src/services/avTracker.ts` | 166 | 批量翻译 AV 标题 |
| `src/reminders/parser.ts` | 271 | 自然语言解析提醒 |
| `src/journal-server/aiSuggestionService.ts` | 16、109 | Journal 标签和主题建议共用的请求模型 |

### 2.2 已有间接集中但仍需纳入统一入口的位置

`src/ai/client.ts:16` 已经定义了 `DEEPSEEK_MODEL`，当前值为 `deepseek-v4-flash`。

它被以下请求使用：

- `src/ai/deepseek.ts`：新闻、GitHub、生活小贴士、英语微课、英语替补内容、V2EX、健身计划，共 7 个请求位置。
- `src/services/masturbationParser.ts`：记录解析，共 1 个请求位置。

因此当前实际存在两种指定方式：

- 一部分请求引用 `src/ai/client.ts` 中的常量。
- 另一部分请求直接写入模型字符串，Journal server 还额外维护了一个局部常量。

## 3. 建议方案

### 3.1 新增独立的共享模型目录

新增：

```text
src/ai/models.ts
```

该文件维护模型目录和按任务类型划分的模型：

```ts
export const DEEPSEEK_MODELS = {
  flash: 'deepseek-v4-flash',
  pro: 'deepseek-v4-pro',
} as const;

export const DEEPSEEK_TASK_MODELS = {
  structured: DEEPSEEK_MODELS.flash,
  writing: DEEPSEEK_MODELS.pro,
} as const;
```

选择独立模块的原因：

- 模型名称是跨 bot、提醒、AV 和 Journal server 共享的策略配置，不应继续附着在某一个 client 工厂上。
- `DEEPSEEK_MODELS` 为模型标识提供唯一入口，`DEEPSEEK_TASK_MODELS` 表达业务任务类型；结构化解析使用 Flash，文字工作使用 Pro。
- Journal server 目前使用自己注入 API key 的 OpenAI client；让它只依赖模型常量，不会额外依赖根目录 bot 的配置或 singleton client。
- 保留简单的编译期常量，不引入新的环境变量、运行时配置层或多模型抽象，符合个人工具的最短维护路径。

### 3.2 统一所有请求调用

按以下方向调整导入：

- `src/ai/deepseek.ts` 从 `./models.js` 引入 `DEEPSEEK_TASK_MODELS.writing`。
- `src/services/masturbationParser.ts` 将模型常量的来源从 `../ai/client.js` 调整为 `../ai/models.js`，使用 `structured`，client 工厂仍从原位置引入。
- `src/services/avContentParser.ts` 使用 `structured` 进行磁力候选筛选，使用 `writing` 进行标签翻译和整理。
- `src/services/avTracker.ts` 使用 `writing` 进行标题翻译。
- `src/reminders/parser.ts` 引入 `structured`，替换直接字符串。
- `src/journal-server/aiSuggestionService.ts` 删除局部 `deepSeekModel`，在请求构造处使用 `writing`。
- `src/ai/client.ts` 删除原本放在 client 文件中的模型常量，避免形成第二个模型配置入口。

当未来出现新的任务类型时，只需在 `DEEPSEEK_TASK_MODELS` 中增加有语义的任务映射；不在业务调用处重新写模型字符串。

### 3.3 保持 client 边界不变

不合并现有 OpenAI client：

- `src/ai/client.ts` 继续负责根目录 bot 侧的 singleton client。
- AV 服务和提醒解析目前各自创建 client，暂不借此次改动重构其生命周期。
- `src/journal-server/aiSuggestionService.ts` 继续持有自己的 client，并保留 `maxRetries: 0`。

这样本次改动只改变模型选择，不会顺带改变重试策略、API key 来源、实例复用方式或 Journal server 的依赖边界。

## 4. 实施顺序

1. 新增 `src/ai/models.ts`，将模型值设为 `deepseek-v4-pro`。
2. 将所有间接引用和直接字符串引用迁移到共享常量。
3. 删除 `src/ai/client.ts` 和 `src/journal-server/aiSuggestionService.ts` 中的重复模型定义。
4. 以源码结果为准确认旧模型值不再作为生产请求配置存在，且所有 DeepSeek 请求都从共享入口取得模型名。

## 5. 完成判据

- `deepseek-v4-flash` 不再出现在生产源码的模型配置中。
- `deepseek-v4-pro` 和 `deepseek-v4-flash` 只在 `src/ai/models.ts` 的模型目录中维护。
- 当前 3 个结构化请求位置使用 Flash，11 个文字工作请求位置使用 Pro；所有请求都通过 `DEEPSEEK_TASK_MODELS` 选择模型。
- 现有 14 个 DeepSeek 请求位置的请求结构和业务逻辑保持不变，仅模型字段的来源统一。
- Journal server 的标签建议和主题建议继续共用原有服务与 client 配置。
- 不新增环境变量，不改数据库，不改提示词，不改变部署结构。

补充：Journal 镜像本身已经通过 `deploy/journal/Dockerfile` 单独复制 `src/ai/models.ts`；同时在 GitHub Actions 的 Journal 变更范围中加入该文件，确保仅调整共享模型映射时也能触发对应发布流程。

## 6. 外部依据与注意事项

DeepSeek 官方模型与计费文档当前列出 `deepseek-v4-pro`，并标明 OpenAI 兼容接口和 JSON Output 可用；这与项目当前使用的 Chat Completions 调用方式相容。正式实施时仍按官方当前文档确认模型名和请求能力，以用户指定的 `deepseek-v4-pro` 为目标值。

参考：[DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)、[DeepSeek Your First API Call](https://api-docs.deepseek.com/)。

## 7. 本次不做

- 不把模型名改为环境变量或数据库配置。
- 不抽象通用的多供应商、多模型路由，也不预先建立按业务场景动态分配模型的配置系统。
- 不合并各模块的 OpenAI client。
- 不调整 `thinking`、`response_format`、`temperature`、`max_tokens` 或重试策略。
- 不在本次方案中扩展到前端显示、运行时模型切换或管理页面。
