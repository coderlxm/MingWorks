# MingWorks

<p align="right">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
</p>

> Xiaoming's personal Telegram bot and self-hosted apps ✨

MingWorks is Xiaoming's collection of personal tools: a resident Telegram bot, Journal, Lu Dashboard, start.gg Dashboard, Reminder Dashboard, Server Dashboard, and Journal Analytics. It is intentionally built as a single-user suite rather than a general-purpose SaaS. The bot manages reminders, scheduled notifications, subscriptions, and daily life tracking; dedicated web applications provide focused, lightweight interfaces for personal records, daily interests, and operations.

```text
Telegram
   │
   ├── Resident Bot ── Reminders / Scheduled updates / Subscriptions & life tracking
   │       ├── SQLite: data/notinews.sqlite
   │       └── Companion panels: Reminder Dashboard / start.gg Dashboard
   │
   └── Journal Ingestion ── Private notes / Public posts / Media albums
           └── Journal Service ── Vue Web / Analytics panel (JOURNAL_DATA_DIR)

Standalone Panels ── Lu Dashboard / Server Dashboard
```

## What it can do 🧰

### Everyday Telegram helper 💬

- **Reminders**: One-off and recurring reminders, natural-language parsing, date-range cancellation, and in-chat done, snooze, or pause actions.
- **Scheduled updates**: Weather and game news, English learning content, GitHub Trending, V2EX topics, sleep/wake/workday coffee nudges, vitamin reminder cycles, and server health alerts—all scheduled in the `Asia/Shanghai` time zone.
- **China calendar awareness**: Workdays and holidays are determined via `data/china-holiday-2026.json`; V2EX topics collected over holidays are held in storage until the next workday morning.
- **Life status**: Daily status initialization, workday check-in tracking and automatic closure, random snapshot prompts, vitamin intake tracking, and evening life status records can all be managed via Telegram buttons and commands. The fitness planning module remains in code, while its scheduled pushes are temporarily paused.
- **X liked videos**: Liked videos can be synced on demand, with the latest sync status summarized in the morning briefing.

### Subscriptions and tracking 👀

- **start.gg tournament watch**: Syncs preset players and automatically discovers tournaments they are competing in; players and events can also be added manually. It pushes match results and status changes, with support for Top 16 / Top 32 seed tracking. Normal polling runs every 15 minutes, switches to 2-minute fast polling during active matches, and shuts off automatically once events conclude.
- **Content subscriptions**: Tracks content updates from configured targets, records delivered items, and sends Telegram rich-media messages. Manual checks and forced re-delivery are supported.
- **Steam price watches**: Sets target prices by App URL or AppID; prices are checked during fixed schedules and trigger Telegram alerts when the target is met or crossed.
- **Server health & backup checks**: Reads `data/server-health-targets.json` to perform HTTP, port, or TLS certificate checks; runs early-morning backup integrity checks and alerts immediately on failures.

### Self-hosted apps 🖥️

- **Journal**: From Telegram directly to a personal website, covering public browsing and private archive management.
- **Reminder Dashboard** (`apps/reminder-dashboard/`): Life schedule and reminder dashboard for inspecting and managing upcoming items and recurring rules.
- **Server Dashboard** (`apps/server-dashboard/`): Health status, service connectivity, and backup monitoring dashboard.
- **Lu Dashboard** (`apps/lu-dashboard/`): Personalized custom dashboard and data view.
- **start.gg Dashboard** (`apps/startgg-dashboard/`): Live match tracking and player tournament monitoring panel.
- **Journal Analytics** (`apps/journal-analytics/`): Visitor traffic and reading analytics panel for Journal.

### Journal: from Telegram to personal site 📓

Journal is a flagship application in the repository, formed by Telegram capture, a Fastify service, and a Vue 3 frontend working seamlessly together.

- Capture private notes with `/note` and publish public posts with `/post` directly in Telegram. Supports text, photos, videos, voice messages, files, locations, albums, and replies to existing messages.
- Captured items allow inline toggling between private and public, jumping to the web entry, or deleting records directly from Telegram; `/cancel` exits an active capture session.
- **Public site**: Spans multiple channels (“Life”, “Articles”, and “Interests”). Articles feature an editorial magazine-style table of contents with rich-text reading, while other channels render as a smooth waterfall stream. Includes Google Drive photo albums, a gaming library, guestbook, external submissions, an AI knowledge Q&A assistant, an immersive resume reader, RSS / JSON Feed outputs, and web analytics.
- **Archive (“My Archive”)**: Supports private/public filtering, full-text search, date and type filters, pinning, editing, deletion, and an “On This Day” memory view.
- The article editor is powered by Tiptap, supporting rich text, cover images, and inline media. Telegram attachments and article assets are stored in the Journal data directory.

## Telegram shortcuts 🎛️

| Area | Main shortcuts |
| --- | --- |
| Basics | `/start`, `/help` |
| Reminders | `/remind`, or natural language like “remind me to hang out the laundry in 10 minutes” |
| Journal | `/note`, `/post`, `/cancel` |
| start.gg | `/startgg`, `/startgg go [keyword]`, `/startgg status`, `/startgg seeds`, `/startggpoll on \| off`, `/watch`, `/watchlist`, `/fetchstartgg` |
| Steam | `/steam add \| list \| set \| remove \| check` |
| Other | `/syncx` |

Every Telegram interaction is strictly restricted to the authorized session identified by `TG_CHAT_ID`.

## How it runs ⚙️

| Component | Source entry point | Role | Persistence |
| --- | --- | --- | --- |
| Resident bot | `src/resident.ts` | Telegraf long polling, reminder recovery, scheduled jobs, interactive commands, embedded dashboard APIs, and Telegram Journal capture | `data/notinews.sqlite` and state files under `data/` |
| One-shot dispatcher | `src/index.ts` | Dispatches a single push mode based on current Beijing time; kept for manual triggers and GitHub Actions | Shared bot data |
| Journal service | `src/journal-server/index.ts` | Fastify API, asset storage, public feeds, and static web hosting | `JOURNAL_DATA_DIR/journal.sqlite` and `assets/` |
| Journal frontend | `apps/journal-web/` | Vue 3 SPA providing the public journal, management archive, and article editor | Built assets served by the Journal service |
| Reminder Dashboard | `apps/reminder-dashboard/` | Frontend dashboard for reminders and life schedules | Consumes dashboard APIs exposed by the resident bot |
| Server Dashboard | `apps/server-dashboard/` | Server health and backup inspection dashboard | Reads monitoring configurations and state records |
| Lu Dashboard | `apps/lu-dashboard/` | Personalized custom dashboard | Independent server and frontend |
| start.gg Dashboard | `apps/startgg-dashboard/` | Tournament and match tracking dashboard | Reads tournament caches and polling states |
| Journal Analytics | `apps/journal-analytics/` | Visitor traffic and reading analytics panel | Aggregates visit and interaction logs |

On startup, the resident bot restores pending reminders, recurring rules, persisted start.gg polling, and vitamin reminder loops, then registers all scheduled jobs. All times below are in Beijing time:

| Time or rule | Job |
| --- | --- |
| 00:00 | Daily life status initialization |
| 00:10 | Sleep reminder |
| 05:10 | Backup health check and alert |
| 08:30 | Good morning & wake-up reminder |
| 08:41 (workdays) | Delivery of V2EX topics buffered during holidays |
| 08:58 (workdays) | Coffee reminder |
| 09:10 | Server health inspection |
| 09:55 | Weather forecast and game news |
| 09:59 / 10:00 (workdays) | Workday check-in follow-up / automatic check-in expiration |
| 10:30 (non-workdays) / 13:30 (daily) | English content delivery |
| 12:55–14:00 (workdays) | Random photo prompt (dispatched within window) |
| Saturdays 15:00 | GitHub Trending highlights |
| 20:00 | V2EX hot topics |
| 07:30 / 15:30 / 23:30 | Content subscription update checks |
| 02:15 / 08:15 / 14:15 / 20:15 | Steam watchlist price checks |
| Recurring rule (18:30 non-workdays, 20:45–21:00 workdays) | Vitamin reminder loop |
| 22:00 (when no entry today) | Evening personal status tracking reminder |

## Environment and data 🗂️

The project requires Node.js 24 (`>=24 <25`), TypeScript, and pnpm 12. The repository root [.env.example](.env.example) serves as the configuration template for the resident bot; Journal deployments use [deploy/journal/.env.example](deploy/journal/.env.example).

| Variable | Used by | Purpose |
| --- | --- | --- |
| `TG_TOKEN`, `TG_CHAT_ID` | Bot & Journal | Bot authorization, Telegram messaging, and Journal attachment downloads |
| `QWEATHER_API_KEY`, `QWEATHER_CITY_ID` | Scheduled updates | QWeather API credentials |
| `DEEPSEEK_API_KEY` | AI content & reminders | News, GitHub, V2EX, English, life tips, and natural-language reminder parsing |
| `STARTGG_API_TOKEN` | start.gg | Tournaments, players, and match status queries |
| `JOURNAL_API_BASE_URL`, `JOURNAL_INGEST_TOKEN`, `JOURNAL_PUBLIC_BASE_URL` | Resident bot | Sends Telegram Journal content to the Journal service and generates web links |
| `JOURNAL_ADMIN_PASSWORD`, `JOURNAL_COOKIE_SECRET` | Journal service | Admin archive authentication and cookie signing |
| `JOURNAL_WEB_HOST`, `JOURNAL_WEB_PORT`, `JOURNAL_DATA_DIR`, `JOURNAL_WEB_ROOT` | Journal service | HTTP listener, data directory, and static frontend directory; all have server-side defaults |

Data storage is neatly categorized:

- `data/notinews.sqlite`: Bot-side reminders, recurring rules, subscription delivery history, V2EX buffers, vitamins, Steam, start.gg, Journal capture sessions, and life status logs.
- `data/startgg_preset_players.json`: start.gg preset player configuration.
- `data/server-health-targets.json`: Server health targets.
- `data/fitness_status.json`: Fitness module state.
- `JOURNAL_DATA_DIR/journal.sqlite` and `JOURNAL_DATA_DIR/assets/`: Journal entries, attachments, and image previews.

Database initialization and migrations are managed by `src/reminders/db.ts`, `src/reminders/migrations.ts`, and `src/journal-server/data/migrations.ts`.

## Code map 🗺️

```text
src/
├── bot/                 Telegram bot creation, authorization, commands, and callbacks
├── reminders/           One-off/recurring reminders, parsing, SQLite, and scheduling
├── scheduled/           Fixed jobs and one-shot push-mode dispatching
├── services/            start.gg, content subscriptions, Steam, X, health checks, and life-status services
├── fetchers/            Weather, game news, English, GitHub, and V2EX sources
├── ai/                  DeepSeek integration
├── calendar/            China workday and countdown logic
├── publishers/          Telegram delivery
├── formatters/          Telegram HTML message formatting
├── journal-bot/         Telegram Journal capture and API client
├── journal-server/      Fastify, Journal database, media, and feeds
└── shared/              Journal protocol shared by bot, server, and frontend
apps/
├── journal-web/         Vue 3 + Vite + Pinia + Vue Router Journal frontend
├── reminder-dashboard/  Vue 3 + Vite reminder and life schedule dashboard
├── server-dashboard/    Vue 3 + Vite server status and inspection dashboard
├── lu-dashboard/        Personalized custom dashboard
├── startgg-dashboard/   start.gg tournament and player monitoring panel
└── journal-analytics/   Journal traffic and reading analytics panel
deploy/                  systemd, bot backup, and Journal Docker deployment assets
data/                    Versioned calendar, monitoring targets, and preset player data
```

## Deployment today 🚀

Production uses clean, independent deployment paths:

- **Bot and Dashboards**: A `systemd` service runs the resident bot, with fixed jobs managed in-process by `node-schedule` while serving dashboard APIs; primary data resides in `data/` within the server's project directory. The repository also retains a single-container bot `Dockerfile` and `docker-compose.yml`.
- **Journal**: An independent Docker container runs the Fastify service and pre-built Vue frontend. Data is mounted at `/opt/journal/data`; the application port binds strictly to localhost and is proxied by an external web server.
- **Automatic release**: `.github/workflows/deploy.yml` deploys application services independently based on changed file paths. Documentation changes do not trigger automated deployment. `daily-push.yml` remains a manually triggered, one-shot workflow rather than the resident bot's primary path.
- **Bot backups**: `notinews-backup.timer` and its companion systemd service run daily at 04:50 Beijing time. The bot is temporarily stopped during backups and restarted immediately afterward.

Deployment assets and operational details live in [deploy/](deploy/). Journal release-order notes are in [doc/deploy/journal-progressive-loading-release-order.md](doc/deploy/journal-progressive-loading-release-order.md).

## Stack

- **Bot and server**: TypeScript, Telegraf, Fastify, better-sqlite3, node-schedule, rrule, Zod
- **External data and AI**: Axios, RSS Parser, GraphQL Request, OpenAI SDK (DeepSeek-compatible API)
- **Web frontend**: Vue 3, Vite, Vue Router, Pinia, VueUse, Vant, Element Plus, Tiptap, `@egjs/grid`, PhotoSwipe (React 19, Recharts, and Tailwind CSS for the analytics panel)
- **Content and media**: Feed, Sharp, Cheerio, sanitize-html

## Further reading 📚

- [start.gg usage notes](doc/startgg/mvp-usage.md)
- [Steam price-watch guide](doc/steam/price-watch-usage.md)
- [Recurring-reminder acceptance record](doc/acceptance/recurring-reminder.md)
- [Server schedule](doc/reference/server-schedule.md)

---

A personal tool: direct, visible, and easy to maintain is plenty. 🌿
