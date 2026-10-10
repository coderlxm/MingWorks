# FTG 看板浏览器 Web Push 通知

## 目标

bot 每次向 Telegram 发送 start.gg 比赛结果汇总（`sendStartggEventSummary`）时，同步向已订阅的浏览器发送一条 Web Push 系统通知。看板标签页关闭后，只要浏览器进程在运行即可收到；点击通知打开看板对应项目页。

只覆盖比赛结果汇总推送，不覆盖其他 Telegram 消息。

## 后端（bot，`src/`）

### 依赖

- 根 `package.json` 新增 `web-push`（及 `@types/web-push`）。bot 在服务器上按完整仓库 `pnpm install --frozen-lockfile` 安装，无需改部署脚本。
- 通知正文由 Telegram HTML 消息转纯文本：用 `sanitize-html`（已有依赖）剥离全部标签，再用成熟库解码 HTML 实体（如 `entities` 的 `decodeHTML`，需加为直接依赖），不手写。转换后截断到 600 字符，保证加密载荷不超过 Web Push 约 4KB 上限。

### 数据

`src/reminders/migrations.ts` 新增 version 25：

```sql
CREATE TABLE startgg_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  subscription_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE startgg_push_vapid (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL
);
```

VAPID 密钥首次需要时用 `webpush.generateVAPIDKeys()` 生成并写入 `startgg_push_vapid`，此后一直复用。不引入环境变量，部署无需改 `.env`。subject 固定 `https://ftg.xmcloud.buzz`。

### 模块 `src/services/startgg/webPush.ts`

- `startggPushPublicKey()`：读取或生成 VAPID，返回公钥。
- `saveStartggPushSubscription(subscription)` / `deleteStartggPushSubscription(endpoint)`：upsert / 删除。
- `sendStartggWebPush(payload, endpoint?)`：payload 为 `{ title, body, url }`；不传 endpoint 时发给全部订阅，传入时只发给该订阅（不存在则抛 404 错误）。逐个 `webpush.sendNotification(sub, JSON.stringify(payload), { vapidDetails, TTL: 3600, timeout: 10000 })`。
  - 推送服务返回 404 / 410 表示订阅已失效（Web Push 协议语义），删除该订阅；单发测试时随后抛出“订阅已失效，请重新开启”。
  - 其他错误抛出，错误信息带上 `statusCode` 与推送服务返回的 body，不重试。

### 接入发送主路径（`tracker.ts`）

浏览器推送是 Telegram 之外的附加通道，不能让它影响监控本身（`runStartggWatchOnce` 抛错会中断后续事件的 Telegram 发送和加速轮询续排）。因此：

- `sendStartggEventSummary` 返回本事件的 push payload（无汇总时不产生）；`runStartggWatchOnce` 收集全部 payload。
- 在整个 Telegram 循环和 `clearDashboardNotificationError('global')` 之后，依次发送收集到的 push。
- push 失败：`markDashboardError('global', error, true)` 写入 `notificationError` 并 `console.error`，不再向上抛出，`runStartggWatchOnce` 正常返回。错误由看板顶部已有提示展示，其文案“Telegram 通知失败”改为“通知发送失败”。
- 一个事件汇总只推一条（Telegram 可能拆成多条消息，push 不拆）。
- title：`{tournamentName} · {eventName}`（取自 `result.summary`）。
- body：全部 Telegram 消息合并后转纯文本并截断。
- url：`/events/{eventId}`，eventId 为 start.gg event id，取 `processEvent` 中的 `resolvedEventId`（加入 `EventProcessResult`），不能用数据库行 id。

### 内部 API（`dashboardApi.ts`）

- `GET /api/startgg/push/public-key` → `{ publicKey }`
- `PUT /api/startgg/push/subscriptions` body：`PushSubscriptionJSON`（zod 校验 `endpoint` URL、`keys.p256dh`、`keys.auth`）→ `{ ok: true }`
- `DELETE /api/startgg/push/subscriptions` body：`{ endpoint }` → `{ ok: true }`
- `POST /api/startgg/push/test` body：`{ endpoint }` → 只向该浏览器发送 `{ title: 'FTG 看板', body: '浏览器通知已开启，比赛结果推送时会在这里提醒。', url: '/' }`，返回 `{ ok: true }`；订阅未保存返回 404，其他失败返回错误信息。

成功响应均返回 JSON（看板 `request()` 会解析响应体，不能用 204）。

这些都是同步小操作，不走 `submitOperation` 队列。

## 看板（`apps/startgg-dashboard`）

### 代理 `server/server.mjs`

无需改动：上述路径均不在公开只读白名单内，自动要求管理登录；写请求已有 Origin 校验。

### Service Worker `public/sw.js`

- `push`：`event.waitUntil(self.registration.showNotification(title, { body, data: { url }, tag: url }))`。
- `notificationclick`：关闭通知；若已有同源窗口则 `navigate(url)` 并 `focus()`，否则 `clients.openWindow(url)`。
- Vite 会把 `public/sw.js` 原样复制到 `dist/sw.js`，fastify-static 以 `no-cache` 提供，作用域为 `/`。

### 界面

管理抽屉「监控设置」新增「浏览器通知」小节（仅管理登录可见，与其他管理操作一致）：

- 状态：本浏览器未开启 / 已开启 / 浏览器已禁止通知（需在浏览器站点设置中允许）/ 当前浏览器不支持。
- 开启：`Notification.requestPermission()` → `navigator.serviceWorker.register('/sw.js')` → `ready` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: 公钥 })` → `PUT` 订阅。
- 关闭：`subscription.unsubscribe()` → `DELETE`。
- 发送测试通知：`POST /push/test`，带当前浏览器的 endpoint。服务器未保存该订阅时提示重新开启。
- 打开小节时读取 `pushManager.getSubscription()` 决定状态；“开启”是幂等的（已有订阅时直接重新 PUT），用于修复浏览器已订阅但服务器未保存的情况。操作中按钮禁用并显示进行中文案，错误就地展示。
- 顶部通知失败提示文案改为“比赛数据已采集，通知发送失败：…”。

## 部署

bot 与看板都会因改动自动发布，无环境变量变更。Safari / Chrome / Firefox 桌面版均支持标准 Web Push（站点已是 HTTPS）。
