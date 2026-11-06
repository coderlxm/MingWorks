# Journal 访问统计与看板

## 目标与范围

回答「有多少访客、看了什么、从哪里来、做了哪些操作」。采集接入现有 Journal；React + Tailwind 看板位于 `apps/journal-analytics`，入口 `/analytics`，沿用 Journal 管理员密码和登录 Cookie。Journal 管理员登录后，页头提供「访问统计」链接。

这次只完成本地代码和提交，不推送或部署。统计从实际接入后开始，不能还原接入前的历史访客。

## 方案选择

调研了现成统计服务与通用库：

| 候选 | 官方资料与取舍 |
| --- | --- |
| [Umami](https://github.com/umami-software/umami) | 持续维护的成熟统计服务，需要额外 Node 服务、PostgreSQL；本次只需现有个人站的统计，避免增加服务运维。 |
| [Plausible CE](https://github.com/plausible/community-edition) | 成熟的网站分析方案，需要额外应用、PostgreSQL 和 ClickHouse，超出当前规模。 |
| [PostHog](https://posthog.com/docs/self-host) | 产品分析能力广，自托管维护成本较高，官方不提供自托管版本及支持保证。 |
| [Recharts 3.10.1](https://github.com/recharts/recharts/releases/tag/v3.10.1) | 复用其 React 图表能力，关闭图表动画，配套日数据表。 |
| [isbot](https://github.com/omrilotan/isbot) | 复用已知爬虫 UA 识别；无法保证识别伪装成普通浏览器的机器人。 |
| [Bowser 2.15.0](https://github.com/bowser-js/bowser/releases/tag/v2.15.0) | MIT，复用浏览器、系统、设备识别。未选择采用 AGPL 的 UAParser.js v2。 |

最终使用现有 Fastify + SQLite 实现业务采集与聚合，通用图表、设备解析和爬虫识别复用库。不增加第三方账号、独立统计服务器、消息队列或事件重试系统。

## 采集路径

`Journal 公开页面 → 同源采集 API → journal.sqlite → 管理员统计 API → React 看板`

- 采集公开首页、记录详情、关于、简历、搜索、归档、照片墙与相册、游戏墙、AI 和留言板。
- 首次进入、SPA 路径切换、前进后退、浏览器往返缓存恢复均记录页面访问。同一路径只改变查询条件或 hash 不增加 PV。
- 私有管理页、投稿凭证页、404 和看板不采集。服务端排除管理员 Cookie 和已知爬虫；浏览器开启 DNT 时不启动采集。
- 页面可见期间每 15 秒提交累计可见时长；隐藏、离开和路由切换结算。重复累计值不重复增加时长。后台页面不累计，浏览器被强制关闭时最后一段时长可能丢失。
- 浏览器 localStorage 保存随机访客标识和最近会话；30 分钟没有可见活动后开始新会话。同源多个标签页共享已保存的标识，首次同时打开多个标签页时可能产生短暂竞争，UV 与会话均属于近似统计。
- 页面记录成功后才关联事件和时长；采集失败在控制台明确报告，不重试，不改变业务操作结果。

## 事件表

| 事件 | 触发条件 | 保存目标 |
| --- | --- | --- |
| `outbound_click` | 点击 HTTP/HTTPS 外部链接 | 目标主机名 |
| `search` | 带搜索查询首次进入、SPA 导航进入搜索路由或修改搜索查询 | `/search`，不保存搜索词 |
| `reaction` | 点赞接口成功 | 对应公开记录路径 |
| `comment` | 记录评论接口成功 | 对应公开记录路径 |
| `guestbook_message` | 留言接口成功 | `/guestbook` |
| `resume_download_click` | 点击原生简历下载链接 | `/resume`，仅表示点击 |

## 指标口径

- **UV**：所选范围内去重浏览器标识数。不是自然人数；不同设备、清除存储或无痕窗口可能被计作新访客。
- **PV**：公开路径的页面访问次数。记录详情表示打开详情路径，不等于完整阅读；同一次页面访问的心跳不增加 PV。
- **会话**：所选范围内涉及的去重会话数；可见页面的定时活动会延续会话。
- **跳出率**：过滤后的范围内只有一个 PV 的会话占比。按页面筛选后也使用这一口径，不表示整站会话跳出率。
- **平均停留**：过滤后的页面累计可见秒数除以会话数；可见不代表用户一直在阅读，多个可见窗口的时长会分别累计。
- **日期**：北京时间，开始日与结束日均包含，单次范围 1–366 天。页面指标及时长归属页面打开日期，事件归属事件发生日期。环比采用紧邻的等长上一周期；今日与上一整天相比，当前周期尚未结束时需注意差异。
- **每日趋势**：按天独立去重，不能把每日 UV 或会话直接相加当作周期总数。
- **来源**：文档初始外部来源主机名，同站来源和无 Referrer 归为直接访问；SPA 内部导航延续文档初始来源，刷新可能变为直接访问。不做跨会话归因。
- **UTM**：仅保存 `utm_source`、`utm_medium`、`utm_campaign`，每项最多 100 字符，不保存其他查询参数。投放标签中不要填写个人信息。
- **实时**：最近 5 分钟有页面或时长上报的去重访客，独立于日期筛选，沿用路径、来源和设备条件；活跃页面数表示这些页面记录数量，不能当作近 5 分钟新增 PV。
- **排行榜**：页面、来源、设备、浏览器、系统、活动最多展示前 20 项，事件及目标前 30 项。CSV 导出当前报表及其排行榜，不是全部明细下载。

## 数据与接口

迁移 v25 只新增 `journal_analytics_pageviews`、`journal_analytics_events` 和查询索引，不修改原有内容数据。数据随现有 SQLite 文件保存、备份，不主动清理历史数据。

| API | 用途 |
| --- | --- |
| `POST /api/analytics/pageviews` | 创建页面记录；同一页面 ID 幂等 |
| `POST /api/analytics/activity` | 更新累计时长和最后活动时间，不创建页面 |
| `POST /api/analytics/events` | 关联已存在的页面记录 |
| `GET /api/me/analytics` | 管理员读取统计；支持 `from/to/path/referrer/device` |

只接受本站来源的采集请求，本地开发仅允许请求主机和 Origin 都在 loopback。数据输入受 schema、事件目标白名单和按匿名访客标识的请求频率限制；这不能阻止有意伪造的浏览器事件。

不落库 IP、完整 User-Agent、原始 UUID、正文、搜索词、密码、投稿 token 或完整 URL。访客、会话和页面 ID 使用现有 Cookie 密钥做带域区分的 HMAC；更换密钥后新数据无法与旧访客标识合并。设备识别只保存分类结果。请求日志沿用服务器原有行为，不属于统计数据库。

## 看板与项目集成

看板包含概览指标、趋势图、日数据表、实时活动、页面排行、来源、UTM、设备、浏览器、系统和事件；支持预设及自定义日期、精确维度筛选、清除条件、刷新和 CSV 导出。空数据、读取失败、登录过期分别呈现，不填充演示数据。

`apps/journal-analytics` 保存 React 源码、独立 HTML、Vite 配置和依赖；Journal 的 `analytics.html` 是同一 React 入口的发布壳。现有 Journal Vite 多页面配置将其一起打包，后端从当前 Web 目录提供 `/analytics`，继续沿用原有 Web 发布包和数据卷。没有新域名或代理配置。

独立开发看板的 API 指向本机 Journal 后端（3100）。Journal 开发配置新增可选变量 `JOURNAL_API_TARGET`，统一控制 `/api` 和 `/media`，默认保留既有线上目标；本地查看整条采集链路时将其设置为 `http://127.0.0.1:3100`。看板 API 和采集必须连接同一套后端数据；访问生产站点采集的数据不会出现在本地 SQLite。

新增服务端依赖 isbot、Bowser 位于根依赖，现有 Journal 镜像已完整复制根 `node_modules`、`src/journal-server` 和 `src/shared`，无需新增运行时复制路径。React 和图表等前端依赖编译为静态资源。GitHub Actions 只增加看板源码和依赖到 Journal Web 的变更范围，没有触发任何发布。
