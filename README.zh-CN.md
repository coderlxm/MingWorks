# MingWorks

<p align="right">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

> 小明的个人 Telegram Bot 与自用应用集合 ✨

MingWorks 是小明的个人工具集合，涵盖常驻 Telegram Bot、Journal、Lu Dashboard、start.gg Dashboard、Reminder Dashboard、Server Dashboard 与 Journal Analytics，明确为单用户自用打造，不打算做成通用 SaaS。Bot 负责提醒、定时推送、订阅追踪和生活记录，各个应用则为个人记录、日常兴趣与系统运维提供独立、轻快且各司其职的操作界面。

```text
Telegram
   │
   ├── 常驻 Bot ── 提醒 / 定时推送 / 订阅与状态追踪
   │       ├── SQLite：data/notinews.sqlite
   │       └── 配套看板：Reminder Dashboard / start.gg Dashboard
   │
   └── Journal 采集 ── 私有笔记 / 公开动态 / 媒体相册
           └── Journal 服务 ── Vue Web / Analytics 面板（JOURNAL_DATA_DIR）

独立自托管看板 ── Lu Dashboard / Server Dashboard
```

## 现在能做什么 🧰

### Telegram 日常助手 💬

- **提醒管理**：一次性提醒、循环提醒、自然语言解析、按时间范围取消，以及完成、稍后提醒、暂停等操作都能在聊天里完成。
- **日常推送**：按 `Asia/Shanghai` 时区送上天气与游戏新闻、英语内容、GitHub Trending、V2EX 热帖，还有睡眠/起床/工作日咖啡、维生素循环提醒和服务器状态报告。
- **中国日历逻辑**：依照 `data/china-holiday-2026.json` 判断工作日与节假日；节假日的 V2EX 内容会先存起来，等下一个工作日早晨再送达。
- **生活状态**：每日生活状态初始化、工作日打卡跟进与收口、随手拍提醒、维生素服用状态和个人状态记录都可通过 Telegram 按钮与命令维护；健身计划模块代码保留，固定推送暂时休息中。
- **X 点赞视频**：可以手动同步 X 点赞视频，早安消息也会带上最新状态。

### 订阅与追踪 👀

- **start.gg 赛事监控**：同步预置选手、自动发现其正在参加的赛事，也可手动添加选手或赛事；推送对局与状态变化，支持 Top 16 / Top 32 种子关注。普通轮询为 15 分钟，存在进行中对局时切换为 2 分钟快速轮询，赛事结束后自动关闭。
- **内容订阅**：按预设目标跟踪内容更新，记录已推送项目并以 Telegram 图文消息通知；支持手动检查与强制重发。
- **Steam 价格监控**：按 App URL 或 AppID 设置目标价，固定时段检查价格，在达到或跨过目标价时通知。
- **服务器巡检与备份体检**：读取 `data/server-health-targets.json` 进行 HTTP、端口或 TLS 证书检查；每日清晨对服务备份状态进行体检，发现异常立即警报。

### 独立应用版图 🖥️

- **Journal**：从 Telegram 到个人网站。支持公开展示与私密资产沉浸式管理。
- **Reminder Dashboard**（`apps/reminder-dashboard/`）：生活日程与提醒管理看板，直接操作和总览各类提醒事项与规则。
- **Server Dashboard**（`apps/server-dashboard/`）：服务器巡检、服务连通性与备份状态看板。
- **Lu Dashboard**（`apps/lu-dashboard/`）：个人专属定制看板与数据视图。
- **start.gg Dashboard**（`apps/startgg-dashboard/`）：格斗游戏赛事与关注选手实时监控面板。
- **Journal Analytics**（`apps/journal-analytics/`）：Journal 访问与阅读统计面板。

### Journal：从 Telegram 到个人网站 📓

Journal 是仓库里的核心应用之一：由 Telegram 采集、Fastify 服务和 Vue 前端紧密协同。

- 在 Telegram 用 `/note` 保存私有笔记、用 `/post` 保存公开动态；支持文字、图片、视频、语音、文件、位置、相册等消息内容，也支持回复一条已有消息后保存。
- 采集结果可在消息内切换公开/私有、打开网站或删除记录；`/cancel` 可退出等待输入的采集状态。
- **公开端**：涵盖「生活 / 文章 / 兴趣」多频道，其中文章采用独立杂志目录式索引与富文本阅读，其余频道为流畅的瀑布流；集成 Google Drive 相册、游戏库、留言板、外部投稿、AI 知识问答与沉浸式简历阅读，并提供 RSS / JSON Feed 与访问统计。
- **管理端（我的资产）**：支持私有/公开内容筛选、全文搜索、日期和类型筛选、置顶、编辑、删除与“那年今日”。
- 文章编辑器基于 Tiptap，支持富文本、封面和内嵌图片；Telegram 附件与文章媒体存入 Journal 的数据目录。

## Telegram 交互入口 🎛️

| 范畴 | 主要入口 |
| --- | --- |
| 基础 | `/start`、`/help` |
| 提醒 | `/remind`，或直接发送自然语言，如“10 分钟后提醒我收衣服”“每天 22:00 做俯卧撑” |
| Journal | `/note`、`/post`、`/cancel` |
| start.gg | `/startgg`、`/startgg go [关键词]`、`/startgg status`、`/startgg seeds`、`/startggpoll on \| off`、`/watch`、`/watchlist`、`/fetchstartgg` |
| Steam | `/steam add \| list \| set \| remove \| check` |
| 其他 | `/syncx` |

所有 Telegram 交互均以 `TG_CHAT_ID` 限定为单一授权会话。

## 它是怎么跑起来的 ⚙️

| 组成 | 源码入口 | 角色 | 持久化 |
| --- | --- | --- | --- |
| 常驻 Bot | `src/resident.ts` | Telegraf long polling、提醒恢复、固定任务、交互命令、内置看板 API 与 Journal 采集 | `data/notinews.sqlite` 及 `data/` 下状态文件 |
| 一次性分发器 | `src/index.ts` | 按当前北京时间选择一项推送模式；保留给手动或 GitHub Actions 场景 | 共用 Bot 数据 |
| Journal 服务 | `src/journal-server/index.ts` | Fastify API、附件存储、公开 Feed、静态 Web 托管 | `JOURNAL_DATA_DIR/journal.sqlite` 与 `assets/` |
| Journal 前端 | `apps/journal-web/` | Vue 3 单页应用，提供公开记录、管理后台和文章编辑器 | 构建产物由 Journal 服务托管 |
| Reminder Dashboard | `apps/reminder-dashboard/` | 提醒与生活日程前端看板 | 调用 Bot 暴露的看板 API |
| Server Dashboard | `apps/server-dashboard/` | 服务器巡检与备份健康状态看板 | 读取监控配置与状态记录 |
| Lu Dashboard | `apps/lu-dashboard/` | 个人定制数据看板 | 独立服务端与前端 |
| start.gg Dashboard | `apps/startgg-dashboard/` | 赛事监控与选手对局看板 | 读取赛事缓存与轮询状态 |
| Journal Analytics | `apps/journal-analytics/` | Journal 访问统计面板 | 聚合访问与互动日志 |

常驻 Bot 启动后会接回未完成提醒、循环规则、已持久化的 start.gg 轮询和维生素提醒循环，然后把固定任务安排好；以下时间均为北京时间：

| 时间或规则 | 任务 |
| --- | --- |
| 00:00 | 每日生活状态初始化 |
| 00:10 | 睡眠提醒 |
| 05:10 | 备份健康检查警报 |
| 08:30 | 早安与起床提醒 |
| 08:41（工作日） | 节假日暂存的 V2EX 内容推送 |
| 08:58（工作日） | 咖啡提醒 |
| 09:10 | 服务器健康巡检 |
| 09:55 | 天气与游戏新闻推送 |
| 09:59 / 10:00（工作日） | 工作日打卡跟进 / 打卡超时自动收口 |
| 10:30（非工作日） / 13:30（每日） | 英语内容推送 |
| 12:55–14:00（工作日） | 随手拍随机提醒（窗口期内随机送达） |
| 每周六 15:00 | GitHub Trending 精选 |
| 20:00 | V2EX 热帖推送 |
| 07:30 / 15:30 / 23:30 | 内容订阅更新检查 |
| 02:15 / 08:15 / 14:15 / 20:15 | Steam 关注游戏价格检查 |
| 循环规则（非工作日 18:30，工作日 20:45–21:00） | 维生素服用循环提醒 |
| 22:00（当日未打卡时） | 个人状态记录提醒 |

## 环境与数据 🗂️

项目使用 Node.js 24（`>=24 <25`）、TypeScript 与 pnpm 12。根目录的 [.env.example](.env.example) 是常驻 Bot 的配置模板；Journal 部署使用 [deploy/journal/.env.example](deploy/journal/.env.example) 作为服务端模板。

| 变量 | 使用模块 | 用途 |
| --- | --- | --- |
| `TG_TOKEN`、`TG_CHAT_ID` | Bot 与 Journal | Bot 鉴权、Telegram 收发与 Journal 消息附件下载 |
| `QWEATHER_API_KEY`、`QWEATHER_CITY_ID` | 日常推送 | 和风天气 |
| `DEEPSEEK_API_KEY` | AI 内容与提醒 | 新闻、GitHub、V2EX、英语、生活建议与自然语言提醒解析 |
| `STARTGG_API_TOKEN` | start.gg | 赛事、选手与对局状态查询 |
| `JOURNAL_API_BASE_URL`、`JOURNAL_INGEST_TOKEN`、`JOURNAL_PUBLIC_BASE_URL` | 常驻 Bot | 将 Telegram Journal 内容写入 Journal 服务，并生成网页链接 |
| `JOURNAL_ADMIN_PASSWORD`、`JOURNAL_COOKIE_SECRET` | Journal 服务 | 管理端登录与 Cookie 签名 |
| `JOURNAL_WEB_HOST`、`JOURNAL_WEB_PORT`、`JOURNAL_DATA_DIR`、`JOURNAL_WEB_ROOT` | Journal 服务 | HTTP 监听、数据目录和静态前端目录；均有服务端默认值 |

这些数据各有各的家：

- `data/notinews.sqlite`：提醒、循环规则、订阅推送历史、V2EX 缓冲、维生素、Steam、start.gg、Journal 采集会话和个人状态等 Bot 侧数据。
- `data/startgg_preset_players.json`：start.gg 预置选手配置。
- `data/server-health-targets.json`：服务器巡检目标。
- `data/fitness_status.json`：健身模块状态。
- `JOURNAL_DATA_DIR/journal.sqlite` 与 `JOURNAL_DATA_DIR/assets/`：Journal 条目、附件和图片预览。

数据库初始化和迁移分别由 `src/reminders/db.ts`、`src/reminders/migrations.ts` 与 `src/journal-server/data/migrations.ts` 管理。

## 代码地图 🗺️

```text
src/
├── bot/                 Telegram Bot 创建、鉴权、命令与回调
├── reminders/           一次性/循环提醒、解析、SQLite 和调度
├── scheduled/           固定任务与一次性推送模式分发
├── services/            start.gg、内容订阅、Steam、X、健康检查及生活状态服务
├── fetchers/            天气、游戏新闻、英语、GitHub、V2EX 数据源
├── ai/                  DeepSeek 调用
├── calendar/            中国工作日和倒计时逻辑
├── publishers/          Telegram 消息发送
├── formatters/          Telegram HTML 消息格式化
├── journal-bot/         Telegram Journal 采集和 API 客户端
├── journal-server/      Fastify、Journal 数据库、媒体和 Feed
└── shared/              Bot、服务端与前端共用的 Journal 协议
apps/
├── journal-web/         Vue 3 + Vite + Pinia + Vue Router Journal 前端
├── reminder-dashboard/  Vue 3 + Vite 提醒与日程管理看板
├── server-dashboard/    Vue 3 + Vite 服务器状态与巡检看板
├── lu-dashboard/        个人定制数据看板
├── startgg-dashboard/   start.gg 赛事与选手监控看板
└── journal-analytics/   Journal 访问与阅读统计看板
deploy/                  systemd、Bot 备份与 Journal Docker 部署资产
data/                    受版本控制的日历、监控目标与预置选手数据
```

## 部署现状 🚀

生产环境目前有清晰独立的部署链路：

- **Bot 与配套看板**：`systemd` 运行常驻 Bot，进程内由 `node-schedule` 管理固定任务并提供看板接口；主数据位于服务器项目目录的 `data/`。仓库中同时保留单容器 Bot 的 `Dockerfile` 与 `docker-compose.yml`。
- **Journal**：独立 Docker 镜像运行 Fastify 服务和已构建的 Vue 前端，数据挂载到 `/opt/journal/data`，仅将服务端口绑定在本机回环地址，由外部 Web 服务代理访问。
- **自动发布**：`.github/workflows/deploy.yml` 根据变更范围分别发布各应用服务；文档改动不会触发自动发布。`daily-push.yml` 仍保留为手动触发的一次性推送工作流，不是常驻 Bot 的主路径。
- **Bot 备份**：仓库包含每天 04:50（北京时间）执行的 `notinews-backup.timer` 与相应 systemd service，备份期间会停止并在结束后重新启动 Bot。

部署实现和运维细节位于 [deploy/](deploy/)；Journal 的发布顺序说明位于 [doc/deploy/journal-progressive-loading-release-order.md](doc/deploy/journal-progressive-loading-release-order.md)。

## 技术栈

- **Bot 与服务端**：TypeScript、Telegraf、Fastify、better-sqlite3、node-schedule、rrule、Zod
- **外部数据与 AI**：Axios、RSS Parser、GraphQL Request、OpenAI SDK（DeepSeek 兼容接口）
- **Web 前端**：Vue 3、Vite、Vue Router、Pinia、VueUse、Vant、Element Plus、Tiptap、`@egjs/grid`、PhotoSwipe（统计面板使用 React 19、Recharts、Tailwind CSS）
- **内容与媒体**：Feed、Sharp、Cheerio、sanitize-html

## 延伸阅读 📚

- [start.gg 使用说明](doc/startgg/mvp-usage.md)
- [Steam 价格监控说明](doc/steam/price-watch-usage.md)
- [循环提醒验收记录](doc/acceptance/recurring-reminder.md)
- [服务器定时表](doc/reference/server-schedule.md)

---

个人工具，保持主路径直接、看得见、好维护就够了。🌿
