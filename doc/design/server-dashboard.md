# 服务器监控看板方案

## 目标

把每天 09:10 的「服务器巡检」消息变成一个可随时打开的看板：一眼看出几台服务器是否在线、跑了多久、资源是否吃紧、备份是否正常，并能看到最近 30 天的在线记录；需要时手动点一次「立即巡检」拿到最新状态。

Telegram 推送保持不变，看板只是同一份探测结果的另一个展示面。

## 现状

- 探测：`src/services/serverHealth.ts`，bot 在 bwgdc01 上用 `notinews_health_ed25519` 密钥 SSH 到 `data/server-health-targets.json` 中的 4 台机器（bwgdc01 主机、bwgdc6 备机、rndc02、jp888），执行 `hostname && uptime -p`，得到 在线/主机名/运行时长/错误。
- 备份：`src/services/backupHealth.ts` 每天 05:10 检查 bwgdc01、rndc02 的备份 systemd 单元，只在异常时告警。
- 结果不落库，推送完即丢失，因此目前没有历史。
- 已有同类看板 `apps/reminder-dashboard`：Vue 3 + Vite 前端，Fastify 服务端负责口令登录与静态资源，`/api/*` 带 token 反代到 bot 内部 API（`src/reminders/dashboardApi.ts`，127.0.0.1:3421）。

## 关键决策

1. **探测命令顺带采集负载、内存、根分区磁盘。** 仍是同一次 SSH、同一条命令，只多读几行 `/proc` 与 `df`，几乎不增加复杂度；个人 VPS 最常见的真实故障是磁盘写满和内存吃紧，只显示「在线」的看板价值太低。不采集容器、进程、网络流量等，暂不需要。
2. **每次巡检整体存一行 JSON。** 每天一次加偶尔手动，量极小；整份结果（服务器 + 备份）作为 JSON 存入 SQLite，看板读取时直接用，不为各项指标建表。
3. **看板只读 + 一个「立即巡检」按钮。** 手动巡检只更新看板与历史，不发 Telegram。
4. **沿用 reminder-dashboard 的部署形态。** 新应用 `apps/server-dashboard`，部署在 bwgdc01，域名 `srv.xmcloud.buzz`，端口 3430，口令登录。

## 后端

### 探测扩展（`src/services/serverHealth.ts`）

远端命令改为一次输出 `key=value` 行，以 `set -euo pipefail` 开头，并先把每项采集结果赋给变量再输出，任何一步失败都让整条命令非零退出，而不是被 `echo $(…)` 或管道末尾的 `awk` 掩盖：

```sh
set -euo pipefail
hostname=$(hostname)
uptime=$(cut -d' ' -f1 /proc/uptime)
load=$(cut -d' ' -f1-3 /proc/loadavg)
cores=$(nproc)
mem=$(free -b | awk '/^Mem:/{print $2" "$7}')
disk=$(df -B1 --output=size,used / | awk 'NR==2{print $1" "$2}')
printf '%s\n' "hostname=$hostname" "uptime_seconds=$uptime" "load=$load" "cores=$cores" "mem=$mem" "disk=$disk"
```

本地解析用 zod 校验字段齐全且为有效数值，校验不通过直接抛错，不补零、不补“未知”，也不作为正常快照保存。

`ServerHealthResult` 在线时增加：`uptimeSeconds`、`load: [number, number, number]`、`cores`、`memTotal`、`memAvailable`、`diskTotal`、`diskUsed`。离线（SSH 失败）时只有 `error`。

Telegram 消息中「运行」改用 dayjs duration 由 `uptimeSeconds` 格式化，另加一行「负载 / 内存 / 磁盘」摘要；其余格式不变。

### 落库

在 bot 现有 SQLite（`data/notinews.sqlite`）新建表：

```sql
CREATE TABLE server_health_checks (
  id INTEGER PRIMARY KEY,
  checked_at TEXT NOT NULL,     -- ISO 时间
  trigger TEXT NOT NULL,        -- 'daily' | 'manual'
  result_json TEXT NOT NULL     -- { servers: ServerHealthResult[], backups: BackupHealthResult[] }
);
```

- 表结构接入现有 `src/reminders/db.ts` 的 `getDb` 与 `src/reminders/migrations.ts` 的迁移入口。
- 09:10 定时巡检：在原有 `checkServerHealth()` 之外同时采集备份状态，写入一行，然后照常推送。
- 备份状态拆分：`backupHealth.ts` 中的 systemd 状态采集抽成共用函数；「今天 04:50 之后必须完成」的判断保留在 05:10 告警入口，告警逻辑与告警状态文件不变。看板按**最近一个已到期的备份周期**判断：当前时间早于今天 04:50 时，以昨天 04:50 为基准，否则以今天 04:50 为基准；最近一次完成时间晚于基准且结果成功即为正常。避免凌晨手动巡检时把昨天正常完成的备份误判为异常。
- 全量保留，不做清理。

### 内部 API（挂在现有 bot 内部 API 上）

在 3421 的内部 API 上注册，同一 token 鉴权：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/servers/overview` | 最新一次巡检 + 最近 30 天每天最后一次巡检中各服务器的在线状态 |
| POST | `/api/servers/checks` | 立即执行一次巡检（服务器 + 备份），写入 `trigger='manual'`，返回与 overview 相同结构 |

overview 返回：

```ts
{
  latest: { checkedAt: string; trigger: 'daily' | 'manual'; servers: ServerHealthResult[]; backups: BackupHealthResult[] } | null;
  history: { alias: string; days: { date: string; online: boolean | null }[] }[]; // 30 天，无记录为 null
  lastOnlineAt: Record<string, string | null>; // 每台服务器最近一次在线的巡检时间，供离线卡片显示
}
```

`lastOnlineAt` 在组装 overview 时从已保存的快照按 `alias` 倒序查找得到，不另存状态。

服务器名称、用途、服务商、备注来自 `target`，与推送一致。

## 看板前端（`apps/server-dashboard`）

技术栈与 reminder-dashboard 一致：Vue 3 + Vite + dayjs，Fastify 服务端负责口令登录、静态资源和反代 `/api/servers/*`。单页面，无路由。

### 页面结构

1. **顶栏**：标题「服务器」；总体状态（`全部在线` / `1 台离线`）；最近巡检时间与来源（`今天 09:10 · 每日巡检` / `3 分钟前 · 手动`）；「立即巡检」按钮。
2. **服务器卡片**（4 张，桌面 2×2 或 4 列，手机单列）：
   - 头部：状态点 + `alias` + 名称；用途、服务商、备注一行弱化显示。
   - 在线：主机名、运行时长；三条指标——负载（1/5/15 分钟，以核数为满格）、内存（已用/总量）、磁盘（已用/总量）；磁盘 / 内存 / 负载达到 80% 即变色（警示色），单一阈值。
   - 离线：整卡转为异常态，显示错误原因（如「SSH 连接超时」）和最近一次在线时间。
3. **备份**：每个备份目标一行——名称、所在服务器、最近完成时间、结果（成功/失败）、定时器状态。
4. **近 30 天**：每台服务器一行 30 个日格，绿=在线、红=离线、灰=无记录；悬停/点按显示日期。

### 交互

- 首次进入：框架常驻，数据区骨架占位，加载完成后填充。
- 立即巡检：按钮进入加载态（约 10 秒内完成），卡片保持旧数据并淡化，结果返回后原地替换，顶栏时间更新；不整页刷新。失败直接显示错误信息。
- 未登录时显示口令输入页，登录后进入看板。

## 部署

- `deploy/server-dashboard/`：systemd service、nginx 配置（`srv.xmcloud.buzz` → 3430）、deploy-release 脚本，照 reminder-dashboard 写。
- Fastify 服务端反代 `/api/servers/*`：只有请求带请求体时才加 `content-type: application/json`。「立即巡检」是不带请求体的 POST，照搬 reminder-dashboard 的反代会被 bot 侧 Fastify 以空 JSON 拒绝（400）。
- 发布接入要补齐全部登记点：`pnpm-workspace.yaml` 注册新应用；`.github/workflows/deploy.yml` 中的路径过滤、`affected` / `scopes` 映射、对应 output 与发布 job 条件都要加上（漏掉 `affected` 映射会让 changes 阶段 KeyError），发布顺序沿用 reminder-dashboard 对 bot 发布结果的依赖。
- 环境变量写在 `/opt/server-dashboard/.env`（权限 600）：`SERVER_DASHBOARD_PASSWORD`、`SERVER_DASHBOARD_COOKIE_SECRET`，以及 `SERVER_DASHBOARD_API_TOKEN`（与 `/opt/reminder-dashboard/.env` 中 `REMINDER_DASHBOARD_API_TOKEN` 同值，即 bot 内部 API 的 token）。
- Cloudflare 新增 `srv.xmcloud.buzz` DNS 记录，并申请 Cloudflare Origin CA 证书（与 remind、lu 等站点一致），写入 bwgdc01 的 `/home/web/certs/srv.xmcloud.buzz_{cert,key}.pem`。以上由 Codex 操作。

## 实施顺序

1. 原型与方案审阅（已完成）。
2. 后端实现（Codex）与前端实现（Haiku）并行，各自独立 worktree。
3. 审查：后端 Codex 代码审查，前端 Gemini 代码与 UI 审查。
4. 部署配置、DNS 与证书；合并后 push 到 main 触发 GitHub Actions。
