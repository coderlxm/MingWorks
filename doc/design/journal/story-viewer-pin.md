# Story Viewer 内容置顶方案

## 目标与取舍

本方案把置顶定义为同一条 Journal 内容在列表和 Story Viewer 中优先展示，而不是新增一套只属于 Story 的内容池。继续复用现有的 `pinned` 布尔字段，不增加 `storyPinned`、置顶排序号、自动取消置顶或过期时间。

这样可以让一次设置在公开记录、我的资产和近期动态中保持一致，也避免维护两份容易分叉的展示状态。

## 源码已确认的现状

- 最近两个提交 `41c2e3b feat: add profile story viewer` 与 `d070722 feat: display story channels and merge feeds` 新增了个人头像打开的 Story Viewer。
- `useProfileStories` 分别读取 life 和 interest 的公开 feed，去重后只按 `sourceCreatedAt`（缺失时用 `capturedAt`）倒序，截取前 8 条。因此服务端已经返回的置顶优先级会在前端合并时丢失。
- `JournalEntry`、SQLite 的 `journal_entries` 表、私有/公开 feed 游标和列表排序已拥有 `pinned`。数据库默认值为 `0`，列表目前按 `pinned DESC, source_created_at DESC, id DESC` 排序。
- 已发布内容已有 `PATCH /api/me/entries/:id/pinned` 和卡片操作菜单中的“置顶/取消置顶”；卡片和表格也已有置顶标识。
- 普通记录的创建、草稿发布、已发布编辑请求，以及文章的创建、编辑请求目前都没有携带 `pinned`。因此作者不能在发布或编辑表单中把置顶状态与内容一起保存。

## 拟定交互

### 普通记录

- 在 `EntryPublisherView` 右侧“这条记录”设置中加入复用的 `EntryPinField`，使用单选式复选框，文案为“置顶这条内容”。
- 新记录默认不置顶。点击“发布”时，当前选中状态随发布请求提交。
- 已发布的 Web 记录打开编辑页后，控件从 `entry.pinned` 回显；点击“保存修改”时，内容、可见范围、发布时间和置顶状态一起保存。
- 草稿没有对外的排序位置，因此保存草稿时不写入置顶状态；界面明确说明“仅在发布时生效”。草稿再次发布时可重新选择。
- Telegram 导入记录继续使用现有卡片菜单的置顶操作，不把 Web 发布表单的设置强行扩展到这条编辑路径。

### 富文本文章

- 在 `ArticleEditorSidebar` 复用同一控件。文章创建和编辑均把 `pinned` 随正文请求提交，并从已有文章回显。
- 文章仍只出现在文章频道，不加入当前仅合并 life 与 interest 的 Story Viewer；置顶会继续影响文章列表的顺序。

### Story Viewer

- 继续只读取公开的 life 与 interest 内容，过滤非公开条目、按 `id` 去重，并保留最多 8 条的容量。
- 合并后的排序改为：`pinned` 在前；同一置顶状态内按 `sourceCreatedAt`（缺失时 `capturedAt`）倒序；时间相同再按 `id` 倒序。这样一个较早的置顶内容会在近期内容之前播放。
- 多条内容可以同时置顶，沿用当前数据模型；它们按内容时间排序，并共同占用 8 条容量，不引入“只能置顶一条”的额外约束。
- 当前未读判断和“已看完”标记都假定数组第一项是最新内容。置顶改变数组顺序后，这两处改为在全部 8 条中计算最大内容时间。置顶旧内容会被排到最前，但不会仅因置顶或编辑而重新点亮未读环；未读仍由内容时间决定。

## 数据与请求设计

不在表单保存成功后再额外调用现有的置顶接口。那会把一次用户保存拆成两次独立写入，正文成功而置顶失败时会留下不一致的结果。

改为将 `pinned: boolean` 纳入已有发布和编辑请求，并在现有记录写入事务中一起落库：

| 内容路径 | 请求字段 | 仓储写入 |
| --- | --- | --- |
| 新建 Web 记录并发布 | `journalWebEntryPublishFieldsSchema` | `createWebEntry` 的 `INSERT` 写入 `pinned` |
| 草稿发布 | 草稿发布分支继承的发布字段 | `publishWebDraft` 的 `UPDATE` 写入 `pinned` |
| 编辑已发布 Web 记录 | `journalPublishedWebEntryUpdateFieldsSchema` | `updatePublishedWebEntry` 的 `UPDATE` 写入 `pinned` |
| 新建或编辑文章 | `journalArticleCreateRequestSchema`，其更新 schema 复用该定义 | `insertArticle`、`updateArticle` 写入 `pinned` |

现有单独的 `PATCH /api/me/entries/:id/pinned` 保留不动，继续服务卡片菜单和 Telegram 导入内容。表已存在字段和排序索引，因而不需要数据库迁移。

## 实现范围

1. 在 `src/shared/journalProtocol.ts` 为上述发布/编辑 payload 加入 `pinned`，并保持草稿分支不接受该字段。
2. 将该字段沿 `src/journal-server/routes/privateEntries.ts`、`webEntryService.ts`、`articleService.ts` 和 `repository.ts` 传至既有 Web 记录、草稿发布、已发布记录和文章的写入 SQL。
3. 更新 `web/src/api/entries.ts`、`web/src/api/articles.ts`、`useEntryPublisher.ts` 和 `useArticleEditor.ts` 的输入类型与请求组装。
4. 新增小型共享 `EntryPinField.vue`，接入 `EntryPublisherView.vue` 与 `ArticleEditorSidebar.vue`；编辑加载时从 `JournalEntry.pinned` 初始化本地状态。
5. 调整 `web/src/composables/useProfileStories.ts` 的合并排序及最新时间计算。卡片菜单、卡片置顶标识、正常 feed 查询和前端 `JournalEntry` 类型已有支持，不改动它们。

## 保持不变的边界

- 置顶不改变内容的频道、公开范围、发布时间或 URL。
- 置顶不把私有、加密或 article 频道内容送入 Story Viewer；当前 Viewer 的公开 life/interest 范围保持不变。
- 不新增置顶数量限制、手工排序、定时撤销、独立 Story 排期或因置顶触发的未读通知。
