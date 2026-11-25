# 「撸了吗」次日早间默认结算与看板适配方案

## 1. 背景与目标

现有逻辑在每晚 `22:00` 检查当天是否无记录，无记录时推送提示卡片，要求用户先点击「记一次」、再手动输入具体时间与备注；不操作则记为 `0` 次。该交互存在三个实际痛点：

1. **主路径方向相反**：日常绝大多数天数都会发生（不撸才是少数例外），“不操作 = 0 次、记录 = 点击 + 打字”把最高频场景做成了最高阻力操作。
2. **输入负担重**：点击按钮后还需进入 10 分钟文本录入会话填写时间，操作繁琐。
3. **晚间触发时机尴尬**：`22:00` 当天尚未结束（晚间至睡前常为实际发生时段），此时既无法提前确认“今天没撸”，也不便等到睡前再翻找消息操作。

调整目标：
- **高频场景零操作**：次日早上对已完整结束的「昨天」自动结算；昨天无记录时默认记入 `1` 次，不点消息即完成归档。
- **低频例外一键纠偏**：昨天没撸或撸了多次时，直接在推送卡片上单次点击完成修改，全程无需打字输入时间。
- **主动记录免打字**：日常主动调用 `/lu` 时支持一键记录「现在」，将手动输入时间/备注退化为可选补充能力。
- **看板统计不失真**：区分「按日自动记录」与「精确时刻记录」，保证日历热力图与频次汇总完整计入的同时，不污染时段分布热力图与分钟级间隔统计。

---

## 2. 核心业务与交互设计

### 2.1 定时任务：由每晚 `22:00` 改为次日早上 `08:35` 结算昨天

- **执行时间**：每天北京时间 `08:35`（紧随 `08:30` 起床提醒之后，此时前一日 `00:00–24:00` 已完整结束，且不会与前一日晚间的快捷指令或手动记录产生抢跑重复）。
- **判定与动作**：
  - 查询昨天（`yesterday = bj(now).subtract(1, 'day')`，日期键 `YYYY-MM-DD`）在 `[00:00+08:00, 24:00+08:00)` 范围内的记录数。
  - **昨天已有记录（`count > 0`）**：说明前一日已通过快捷接口 `/api/records/quick` 或 `/lu` 主动记录过，**不重复写入、不发送推送**。
  - **昨天无记录（`count === 0`）**：立即向 `masturbation_records` 写入 `1` 条归属昨天的按日自动记录（`is_auto = 1`，`occurred_at = "${dateKey}T12:00:00+08:00"`），并发送结算卡片。
- **联动说明更新**：同步更新 `src/reminders/lifeDashboard.ts` 中 `fixedRules` 的 `lu` 规则文案与时间（由 `22:00` 更新为 `08:35`）。

### 2.2 早间结算卡片与原地闭环按钮（零额外状态表）

早间推送卡片所有按钮均直接携带结算目标日期 `YYYY-MM-DD`，通过原地编辑同一条 Telegram 消息完成状态切换，不引入额外的待确认状态表：

1. **初始态（昨日已默认记 1 次，`dayCount === 1`）**
   - 文案展示：昨日日期（`MM-DD`）、当前计次（`1 次 · 默认记录`）、最近 7 天汇总（`X 次 / Y 天`），提示“没撸点「昨天没撸」，多撸点「+1 再记一次」，其余无需操作”。
   - 按钮：`[🚫 昨天没撸]` · `[➕ 再记一次]` · `[📊 统计]`
2. **点击 `[🚫 昨天没撸]`（清零态，`dayCount === 0`）**
   - 动作：删除 `dateKey` 当天全部记录。
   - 原地更新消息为「🚫 昨日（MM-DD）已记为未撸（0 次）」及最新近 7 天汇总。
   - 按钮切换为：`[↩️ 恢复记 1 次]` · `[📊 统计]`（防止误触后无法找回）。
3. **点击 `[➕ 再记一次]`（多次态，`dayCount >= 2`）**
   - 动作：为 `dateKey` 追加写入 `1` 条按日记录（`is_auto = 1`）。
   - 原地更新消息为「✅ 昨日（MM-DD）已记 N 次」及最新近 7 天汇总。
   - 按钮切换为：`[➖ 减 1 次]` · `[➕ 再记一次]` · `[📊 统计]`（点击 `减 1 次` 删除该日最新一条记录，减回 `1` 次或 `0` 次时自动切回对应卡片与按钮）。
4. **点击 `[📊 统计]`（从结算卡进入）**
   - `callback_data` 携带来源结算日期 `masturbation:stats:${dateKey}`，原地展示统计卡的同时附带 `[⬅️ 返回昨日结算]` 按钮（`masturbation:settle_view:${dateKey}`），避免看统计覆盖掉纠偏入口。

### 2.3 主动触发入口（`/lu`、`📝 撸了吗`、`/lu undo`）优化

- **`/lu` 与底部键盘 `📝 撸了吗` 状态卡**：
  - 按钮调整为：
    - 第一行：`[✅ 记一次（现在）]`（`masturbation:now`） · `[✏️ 填时间/备注]`（`masturbation:add`）
    - 第二行：`[📊 查看统计]`（`masturbation:stats`）
  - 点击 **`[✅ 记一次（现在）]`**：免打字，直接以当前时间写入 `is_auto = 0` 的精确记录，原地编辑为确认卡（含 `[↩️ 撤销本次]` 与 `[📊 查看统计]`）。
  - 点击 **`[✏️ 填时间/备注]`**：保留现有 10 分钟输入会话（`HH:mm 备注` 或 DeepSeek 自然语言解析），用于需要指定历史时刻或记录备注的低频场景，写入 `is_auto = 0`。
- **状态卡与统计卡展示细节**：
  - 当最新一条记录为 `is_auto = 1` 时，状态卡「上一次」展示为 `昨天 · 默认记录` 或 `MM-DD · 默认记录`（不展示占位时刻 `12:00`）；统计卡「距上一次」按自然日差展示为 `1 天（昨日默认记录）` 或 `N 天`。
  - `/lu undo` 撤销最新一条记录时，若该记录 `is_auto === 1`，反馈文案显示归属日期 `YYYY-MM-DD（默认记录）` 而非具体时分。

---

## 3. 数据模型与迁移设计

### 3.1 `masturbation_records` 新增 `is_auto` 字段

不新增业务表，仅在 `masturbation_records` 上增加一个整型布尔列标识是否缺少真实发生时刻：

```sql
ALTER TABLE masturbation_records
ADD COLUMN is_auto INTEGER NOT NULL DEFAULT 0 CHECK (is_auto IN (0, 1));
```

- **`is_auto = 0`（默认，精确时刻记录）**：
  - 来源：历史存量数据、`POST /api/records/quick` 快捷记录、Bot `[✅ 记一次（现在）]`、Bot `[✏️ 填时间/备注]`。
  - `occurred_at` 代表真实发生时刻。
- **`is_auto = 1`（按日结算记录，无真实时分）**：
  - 来源：`08:35` 早间自动结算写入、早间结算卡片上的 `[➕ 再记一次]` 与 `[↩️ 恢复记 1 次]`。
  - `occurred_at` 固定存为目标日期北京时间正午 `${dateKey}T12:00:00+08:00`（UTC `04:00:00.000Z`），确保按 `[startOfDay, endOfDay)` 范围检索和按日期分组时稳定落入目标自然日。

### 3.2 双进程共享数据库的启动兼容

线上 `notinews-bot` 与 `notinews-lu-dashboard` 共享同一个 `/root/NotiNewsForXiaoming/data/notinews.sqlite`，且 GitHub Actions 中两个部署任务并行执行。为避免 `lu-dashboard` 先于 `bot` 启动时在模块加载阶段 `db.prepare('SELECT id, occurred_at, is_auto ...')` 因列尚未创建而报错：
1. `src/reminders/db.ts` 建表语句与 `src/reminders/migrations.ts`（新增 `version: 27`）按常规检查 `tableHasColumn(db, 'masturbation_records', 'is_auto')` 并执行 `ALTER TABLE`。
2. `apps/lu-dashboard/src/server/db.ts` 在初始化连接、执行 `db.prepare` 前同样通过 `PRAGMA table_info(masturbation_records)` 做一次幂等列检查与补列，保证无论哪个服务先启动都能正常工作。

---

## 4. Lu Dashboard（`apps/lu-dashboard`）适配方案

### 4.1 接口与共享类型
- `apps/lu-dashboard/src/shared/dashboard.ts`：
  - `MasturbationRecord` 增加 `isAuto: boolean`。
  - `CurrentInterval` 扩展为同时表达精确分钟或按日粒度（如增加 `lastIsAuto: boolean` 与 `daysSinceLast: number | null`）。
- `apps/lu-dashboard/src/server/db.ts` & `routes.ts`：
  - `loadRecords()` 查询并返回 `isAuto: row.is_auto === 1`；`recordNow()`（`POST /api/records/quick`）显式写入 `is_auto = 0`。
  - `dashboardResponseSchema` 同步增加 `isAuto: z.boolean()`。

### 4.2 前端统计口径（`apps/lu-dashboard/src/client/src/analytics.ts` 及组件）

| 模块 | 组件 / 字段 | 对 `isAuto = true` 记录的处理规则 |
| --- | --- | --- |
| 总览指标卡 | `SummaryCards.vue` (`summary`) | **全部计入**（今天、近 7 天、近 30 天及活跃天数、历史总计均包含自动记录） |
| 年度活跃日历 | `CalendarHeatmap.vue` (`calendar`) | **全部计入**（按自然日聚合次数） |
| 频次与 7 日均线 | `TrendChart.vue` (`trend`) | **全部计入**（按自然日聚合次数与移动平均） |
| 距上次卡片 | `CurrentIntervalCard.vue` (`current`) | 若最新一条为 `isAuto = false`，保持原有分钟级展示（`X 天 Y 小时` / `MM 月 DD 日 HH:mm`）；若最新一条为 `isAuto = true`，按自然日差展示（`今天` / `1 天` / `N 天`），角标展示 `MM 月 DD 日 · 默认` |
| 星期 × 时段热力图 | `WeekdayTimeHeatmap.vue` (`weekdayTime`) | **仅统计 `isAuto = false` 的精确记录**，避免固定占位时刻把热力集中堆到单一时段；面板副标题/空态注明仅统计含具体时刻的记录 |
| 间隔统计（中位/最长） | `IntervalStats.vue` (`intervals`) | 遍历按时间排序的完整周期记录，**仅当相邻两条记录均为 `isAuto = false` 时**计算两者分钟差（既排除自动记录的固定 24h 干扰，也绝不跨过中间的自动记录日伪造多日断档间隔）；无有效相邻精确记录对时沿用现有的 `数据不足` 展示 |
| 最近 20 条记录 | `RecentRecords.vue` (`recent`) | 保留全部记录；当 `record.isAuto === true` 时，「发生时间」列显示 `默认记录` 而非虚假的 `12:00:00` |

---

## 5. 涉及改动文件清单

1. **数据库与迁移**
   - `src/reminders/db.ts`
   - `src/reminders/migrations.ts`
2. **Bot 服务、解析与消息卡片**
   - `src/services/life/masturbationRepository.ts`（新增 `is_auto` 字段读写、按日期增删查辅助函数）
   - `src/services/life/masturbationTracker.ts`（`formatSinceLatest` 兼容 `is_auto` 按日展示）
   - `src/formatters/masturbationFormatter.ts`（新增早间昨日结算卡各状态文案与按钮、`/lu` 状态卡新增「记一次（现在）」按钮、`is_auto` 显示适配）
   - `src/bot/callbacks.ts`（扩展 `MasturbationCallback` 支持 `now`、`settle_zero`、`settle_inc`、`settle_dec`、`settle_view` 及带返回上下文的 `stats`）
   - `src/bot/interactive.ts`（对接新增回调动作与 `/lu` 交互）
   - `src/scheduled/jobs.ts`（移除 `22:00` 任务，注册 `08:35` 昨日自动结算任务）
   - `src/reminders/lifeDashboard.ts`（同步更新 `fixedRules` 中 `lu` 的时间与规则说明）
3. **Lu Dashboard 前后端**
   - `apps/lu-dashboard/src/shared/dashboard.ts`
   - `apps/lu-dashboard/src/server/db.ts`
   - `apps/lu-dashboard/src/server/routes.ts`
   - `apps/lu-dashboard/src/client/src/analytics.ts`
   - `apps/lu-dashboard/src/client/src/components/CurrentIntervalCard.vue`
   - `apps/lu-dashboard/src/client/src/components/IntervalStats.vue`
   - `apps/lu-dashboard/src/client/src/components/WeekdayTimeHeatmap.vue`
   - `apps/lu-dashboard/src/client/src/components/RecentRecords.vue`
