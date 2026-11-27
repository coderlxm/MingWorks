# MingWorks 个人专属 Agent 演进规划与 Xboard 运维现状交接

- **日期**：2026-11-27
- **适用范围**：`NotiNewsForXiaoming`（MingWorks）后续演进为个人专属 Agent 的规划蓝图，以及当前 Xboard 机场、监控与工具链的完整背景交接，便于后续新开会话直接阅读并无缝展开实施。
- **安全声明**：本文档不含任何密码、私钥、UUID、订阅 Token、Webhook Secret 或用户邮箱。

---

## 一、背景与核心痛点

1. **MingWorks 现有资产已高度成熟**：
   - 已具备 24 小时常驻的 Telegram Bot（`src/resident.ts`、`src/bot/`、`src/journal-bot/`）、SQLite 业务库（`data/notinews.sqlite`：提醒、作息打卡、节假日历、start.gg 赛事追踪、X 点赞视频）、Journal 日记/笔记库、多个配套 Web 面板（Reminder / start.gg / Lu / Server Dashboard）以及 `src/ai/`（`client.ts`、`deepseek.ts`、`models.ts`）。
   - 同时已通过 `/api/internal/alerts` 承接本地 `node-ban-monitor` 的节点阻断与恢复推送。
2. **机场运维的现实痛点**：
   - 敏感时期海外 IPv4 节点可能不可预知地出现单端口阻断、UDP 全封或 IP 全阻断；
   - 目前已完成**第一层兜底**（客户端自动 `fallback` + 双机房纯 IPv4 Cloudflare CDN 兜底），解决了“用户端完全卡死”的问题；
   - 但当管理员出门在外收到告警时，仍希望能在手机端通过自己日常高频使用的 Telegram Bot，随时用自然语言查询状态、巡检风险、或以**二次确认的半自动方式**完成节点开关与恢复闭环，同时把日常的日记检索、提醒管理、生活复盘整合进同一个私人助理大脑。

---

## 二、当前 Xboard 机场与监控基础设施现状交接（截至 2026-11-27）

### 1. 五台海外 VPS 角色与状态

全部 5 台机器已统一加固：**SSH 端口 `22543`、关闭密码登录、仅保留密钥认证**；全部已完成 `/etc/sysctl.d/99-proxy-tuning.conf` 内核调优（`rmem_max/wmem_max=16MB`、`tcp_rmem/tcp_wmem` 上限 `16MB`、`tcp_slow_start_after_idle=0`、`tcp_mtu_probing=1`）。

| SSH 别名 | 公网 IPv4 / IPv6 | 核心角色 | 现行拥塞/队列 | 关键服务 |
| :--- | :--- | :--- | :--- | :--- |
| **`rndc02`** | `23.254.214.138` | Xboard 面板（经 CF 橙云 `pro.xmcloud.buzz`）、MySQL、Redis、1Panel、`id=6` 落地 | `bbr` / `fq` | `xboard-xboard-1`（`v20261102-d826a3b`，上游最新）、`xboard-node-test-6` |
| **`bwgdc01`** | `144.34.224.170` / `2607:8700:5501:dbf8::2` | 美国1 GIA 主力 + CF 兜底 1 | `bbr` / `fq` | `V2bX` (`:35143`)、`xboard-hy2` (`:24443`)、`xboard-hy2-hop` (`40000-40100→40200`)、Nginx + `xboard-us1-cf-ws` (`cf-us1.xmcloud.buzz:443`) |
| **`bwgdc6`** | `80.251.223.124` / `2607:8700:5501:a7bb::2` | 美国2 GIA 主力 + CF 兜底 2 | `bbr` / `fq` | `V2bX` (`:35143`)、`xboard-hy2` (`:28443`)、`xboard-hy2-hop` (`40000-40100→40200`)、独立 `xboard-us2-cf-ws` (`cf-us2.xmcloud.buzz:443`) |
| **`jp888`** | `45.66.216.45` | 日本主力 + 中转入口 | `bbrplus` / `fq` | `V2bX` (`:35153`，原 `5443` 已换端口)、`xboard-hy2` (`:28443`)、`xboard-hy2-hop` (`40000-40100→40200`)、`xboard-jp-us-relay` (`:35143`)、`xboard-jp-sg-relay` (`:35144`)；注意机上另有无关的 `lyz.service` 严禁触碰 |
| **`sgdata01`** | `94.118.188.63` / `2a0a:d687:f007::289` | 新加坡落地（日本中转 + 原有 IPv6）+ 个人专属 SS2022 落地 | `bbr` / `fq_codel` | `V2bX` (`:35144`)、`xboard-sg4-us1-entry` (`:35151`)、个人独立 `sg-ss2022-landing.service`（Xray `26.11.9`, `:443` TCP+UDP, `2022-blake3-aes-128-gcm`，与 Xboard 完全隔离） |

### 2. Xboard 面板与订阅现状（约 26–27 位有效用户，绝大多数纯 IPv4）
- **普通用户（`LV1 / LV2 / LV3`）当前订阅共 14 个可用节点**：
  - 主力 VLESS Reality / 中转（6 个）：`id=3` 美1、`id=2` 美2、`id=1` 日本 (`35153`)、`id=6` 美普通(日本中转)、`id=8` 新加坡(日本中转)、`id=9` 新加坡(移动专用 IPv6，应急前原有节点保留不动)。
  - 主力 Hysteria2（6 个）：`id=13`/`17` 美1 及跳跃、`id=14`/`18` 美2 及跳跃、`id=15`/`16` 日本及跳跃（均保留 `ignoreClientBandwidth: true` 温和 BBR 模式防 UDP 封禁）。
  - 双机房纯 IPv4 CF 兜底（2 个）：`id=27` `美国1 (CF兜底) (1x)`、`id=30` `美国2 (CF兜底) (1x)`（`VLESS + WS + TLS`，全客户端兼容）。
- **持久化两级自动高可用订阅模板**（写入数据库 `v2_subscribe_templates` 的 `clashmeta` / `stash`，不依赖容器临时文件）：
  - 顶层 `$app_name` (`select`)：默认选中 **`自动高可用`**，含 `主力自动选择`、`手动选择`、`DIRECT`（附 `/(?!)/` 防止重复展开全量节点）。
  - `自动高可用` (`fallback`, `interval: 180`, `https://www.gstatic.com/generate_204`)：`['主力自动选择', '/CF兜底/u']`。
  - `主力自动选择` (`url-test`, `interval: 180`, `tolerance: 50`)：`['/^(?!.*CF兜底)(?!.*移动专用)/u']`（平时 100% 走高速直连，0 业务流量走 CF；全主力失效时 1–3 分钟自动切美1 CF → 美2 CF，恢复后自动回切）。
- **隐藏节点与父节点鉴权铁律**：
  - `id=4`（美普通直连）与 `id=7`（新加坡 IPv4 `35144`）保持 **`show=0` + `group_ids=["1","2","3","4"]`**（因 `ServerService::getAvailableUsers` 按父节点 `group_ids` 同步白名单，若改为仅 `["4"]` 会导致子节点 `6/8/9` 对普通用户断连）。
  - 其余测试/纯 IPv6 应急节点 `25, 26, 28, 29` 均保持 `group_ids=["4"]`, `show=0`。

### 3. 本地监控与原生菜单栏工具现状
- **后台监控**：`~/.local/share/node-ban-monitor/`（`launchd` 每 60s 经物理网卡 `en0` 绕过 TUN 直连探测 13 个拆分后的 TCP/UDP 独立目标），具备 `fail_threshold=5`、`recover_threshold=3`、`alert_cooldown_sec=3600`、以及 `rndc02-v4` `require_all_ports_fail=true` 防抖机制，彻底解决刷屏问题；告警推送至 `https://feeds.xmcloud.buzz/api/internal/alerts`。
- **原生 macOS 菜单栏工具**：`NodeMonitorBar` v1（源码 `/Users/xiaomingli/Code/NodeMonitorBar`，私有仓库 `github.com/coderlxm/NodeMonitorBar`，安装于 `~/Applications/NodeMonitorBar.app`，`LaunchAgent` 开机自启与后台驻留，物理内存仅 ~29 MB，只读本地 `state.json`）。
- **本地详细运维文档位置**：`/Users/xiaomingli/Desktop/Desktop_Organized/xboard/`（含 `AGENTS.md`、`22-当前架构与文档口径.md`、`26-20261118应急状态收口与后续恢复清理指南.md`、`27-节点被Ban自动监控与方案1切换指南.md`）。

### 4. 不可违背的运维红线（接入 Agent 时必须编码为硬约束）
1. **禁止清空全部主力节点**：`ClashMeta.php` 会删除匹配结果为空的策略组；若主力节点全隐藏为 0，`主力自动选择` 被删会导致 `自动高可用` 出现悬空引用、客户端无法加载订阅。
2. **隐藏父节点用 `show=0` 而非收紧 `group_ids`**：凡有子节点挂载的父节点（`2/3/4/7` 等）不可随意改成仅 `["4"]`。
3. **不再推荐纯 IPv6 作为普通用户应急方案**：保留原有 `id=9` 不动，面向普通用户新增/恢复的节点须保证纯 IPv4 可用。
4. **任何面板/节点改动后须用 `LV1` 普通用户真连实测**，严禁只用 `admin` 验证。

---

## 三、MingWorks 升级为「个人专属 Agent」架构蓝图

### 1. 核心定位与分工（与本机 Hermes 互补）

| 维度 | MingWorks Agent（本项目） | 本机 Mac Hermes Agent（`~/.hermes`） |
| :--- | :--- | :--- |
| **运行位置** | 服务器 24 小时常驻（`feeds.xmcloud.buzz` 走 CF，手机 4G/5G 随时可达） | 本机 Mac（依赖 Mac 开机在线） |
| **核心优势** | 掌握全量私人生活数据（日记/提醒/打卡/赛事/服务器告警）、手机端秒回、严格白名单 Tool 极省 Token | 处于国内物理网络可跑 `direct-net-probe` 墙内探测、可直接操作本机代码与 SSH 深度排障 |
| **职责边界** | **生活 + 轻量运维私人助理**（查日记、管提醒、看生活复盘、收/查节点告警、受控一键确认式运维） | **重型终端 / 编码 / 墙内直连探测副驾驶** |
| **未来联动** | 可暴露私有受控 HTTP / MCP 接口，供本机 Hermes 或 IDE AI 直接调用 MingWorks 数据 | 作为高级客户端调用 MingWorks 记忆与提醒能力 |

### 1.1 云端部署选型与 5 台 VPS 资源实测评估（2026-11-27 现场采集）

| 服务器 | 配置与实测余量 | 现跑核心业务 | 云端 Agent 适配结论 |
| :--- | :--- | :--- | :--- |
| **`bwgdc01`** | 2 核 / 2 GB（可用 **910 MB**，盘剩 17 GB，内核 6.13） | **`notinews-bot`**、Reminder / Server / start.gg Dashboard + 美1主力 | **首选部署 `MingWorks Agent`**：Bot 与 SQLite/日记/告警本就在本机，新增 `src/agent/`（调外部 LLM API）仅增约 20–50 MB 内存，本地零延迟读库、零额外服务运维成本。 |
| **`rndc02`** | 3 核 / 3 GB（可用 **1,319 MB**，盘剩 27 GB） | Xboard 面板、MySQL、Redis、1Panel | **仅适合单独部署独立重型 Agent（如云端 Hermes）**：CPU 与内存余量最大；但因同机承载 Xboard 生产库，必须通过 systemd 限制 `MemoryMax=512M` 并严格最小权限隔离。 |
| **`bwgdc6`** | 1 核 / 1 GB（可用 528 MB） | 美2主力 + CF 兜底 2 | **不推荐**：留给代理业务保持清爽。 |
| **`sgdata01`** | 1 核 / 469 MB（可用 343 MB） | 新加坡落地 + 个人 SS2022 | **不推荐**：内存偏小且作为个人干净落地机应保持纯净。 |
| **`jp888`** | 1 核 / 354 MB（可用 186 MB，CentOS 7） | 日本主力 + 中转 | **严禁部署**：内存极限且内核较老。 |

> **推荐组合**：云端 Agent 直接内嵌在 **`bwgdc01`** 的现有 `notinews-bot.service` 中；因海外 VPS 无法探测国内被墙，未来如需 24 小时脱离 Mac 的墙内探活，再单独配一台 ¥10–20/月国内轻量云专职跑 `node-ban-monitor` 向其汇报即可。

### 2. 架构设计原则
1. **增量叠加，零破坏现有稳态**：所有既有定时任务（天气、新闻、V2EX、GitHub Trending、打卡、维生素提醒、Web 面板）保持原有确定性代码不变，**不额外消耗 LLM Token**。
2. **新增独立模块 `src/agent/`**：
   - `src/agent/router.ts`：Telegram 消息入口路由（一期建议通过 `/ask <内容>` 或明确前缀触发，成熟后再视需要接管未命中固定命令的自由文本），严格校验单用户 `TELEGRAM_CHAT_ID`。
   - `src/agent/runtime.ts`：基于 `src/ai/` 实现多轮 Tool-Calling 循环（限制最大步数如 `maxSteps = 5`、短期会话窗口如最近 6–10 轮且带超时清理，防止上下文膨胀和死循环）。
   - `src/agent/tools/`：按领域注册白名单工具（每个 Tool 明确定义 JSON Schema、只读/写操作属性 `mutating: boolean`、返回结构化摘要）。
   - `src/agent/confirm.ts`：写操作二次确认闸门（生成短期有效的一次性 `actionId` 存入内存/SQLite，通过 Telegram Inline Keyboard 发送「✅ 确认执行 / ❌ 取消」，过期自动失效、重复点击幂等）。

### 3. 分阶段实施路线

#### Phase 1（MVP，推荐首期优先落地）：个人生活 + 告警只读/轻量写入助理
目标：不引入任何高危运维权限，先把“每天都在用”的高频体验跑通。

建议首批封装 **5 个核心 Tool**：
1. **`search_journal`（只读）**：按关键词、时间范围、标签检索 Journal 私有/公开笔记，返回最相关片段供 Agent 归纳总结（如“我上个月日记里记的那个书名是什么”）。
2. **`manage_reminders`（查询只读 / 创建修改需确认或轻量直通）**：复用 `src/reminders/` 与 `data/china-holiday-2026.json`，支持自然语言查提醒、新建、顺延、按日期范围取消（如“下周三若放假就把早起提醒延后”）。
3. **`get_life_summary`（只读）**：聚合近期作息打卡、咖啡/维生素记录、生活状态统计，支持自然语言复盘（如“这周我漏吃了几天维生素”）。
4. **`get_startgg_events`（只读）**：查询近期关注的格斗游戏选手赛程与赛事状态。
5. **`get_server_and_node_alerts`（只读）**：查询 `Server Dashboard` 与 `/api/internal/alerts` 沉淀的最新节点状态、历史阻断/恢复时间线。

#### Phase 2（半自动机场运维闭环）：手机端受控操作
前提：若已按 `xboard/27` 将 `node-ban-monitor` 迁至国内轻量云（24h 在线），或在 Mac 在线时联动。
1. **只读探活触发**：接入受控 webhook/命令触发一轮实测并回传 5 台节点 TCP/UDP 最新状态表。
2. **受控面板节点可见性开关（强制二次确认）**：
   - 仅通过 Xboard 受控接口/最小权限脚本调整节点 `show` / `group_ids`，**严禁把 5 台 VPS 的全量 SSH root 私钥直接放到 MingWorks 服务器上**；
   - 内置三条代码级保险丝：① 禁止把主力节点清空为 0（防 `主力自动选择` 空组悬空）；② 禁止把已知父节点 `2/3/4/7` 的 `group_ids` 收紧为仅 `["4"]`；③ 操作前自动保存快照，提供「↩️ 撤销上次调整」按钮。
3. **写操作一律走 Telegram Inline Button 二次确认**并记录操作审计日志。

#### Phase 3（进阶体验升级）：智能简报 + 私有 MCP 能力开放
1. **有记忆的每日简报**：将每日早/晚固定模板升级为轻量 Agent 综合简报（仅提当天真正需要关注的提醒、异常告警与赛事，减少噪音）。
2. **私有只读/受控 MCP Server**：把 `src/agent/tools/` 复用暴露为本地/内网鉴权 MCP 端点，让本机 Hermes 或桌面 AI 助手也能跨端读取日记、提醒与告警历史。

---

## 四、安全边界与防自伤清单

1. **严格单用户鉴权**：`src/agent/` 入口必须强校验发送者 `chat_id` / `user_id` 等于管理员本人。
2. **最小权限原则**：
   - Phase 1 只操作本机已有 SQLite 与 Journal 目录，零外部高危权限；
   - Phase 2 不得在公网服务器保存全量 root SSH 私钥，任何写操作必须经过二次确认按钮与参数白名单校验，绝不允许大模型拼接任意 Shell 命令执行。
3. **防刷屏与成本控制**：
   - 保持单次 Agent 调用 `maxSteps <= 5`、工具返回截断上限（如单条最多 4 KB）、短期记忆 TTL（如 30 分钟）；
   - 选用高性价比支持 Function Calling 的模型，避免日常闲聊烧毁额度。
4. **复用既有工程规范**：遵循本仓库既有 TypeScript + ESLint + Commitlint 规范，改动完成后补充单元测试，并按全局工作区规则做 Codex 只读复审（要求每条意见写清“不改会怎么样”并独立甄别取舍）。

---

## 五、新会话开场参考提示词

后续新开会话准备实施 Phase 1 MVP 时，可直接发送：

> 请先阅读 `/Users/xiaomingli/Code/NotiNewsForXiaoming/doc/design/planning/personal-agent-and-xboard-ops-handoff-2026-11-27.md`，结合 `NotiNewsForXiaoming` 当前的 `src/ai/`、`src/bot/`、`src/reminders/`、`src/journal-server/` 代码结构，帮我细化并落地 **Phase 1（MVP）个人 Agent**（`/ask` 入口 + 5 个核心 Tool + 写操作二次确认按钮），不要影响现有定时任务和 Web 面板。
