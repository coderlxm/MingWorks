# MingWorks 全仓项目审计报告

审计日期：2026-09-26（Asia/Shanghai）  
源码基线：bbfec3470fbe9d7f86ad5bc79c061d5b072d8dda  
审计阶段：调研与诊断  
交付范围：本报告；问题修复与发布另行安排。

后续更新：用户已指定修复 A01–A04、A24，源码处理记录见第九节。前八节保留原审计基线与当时的证据边界。

## 一、结论与证据边界

仓库已经形成 Telegram Bot、Journal、Lu Dashboard、start.gg Dashboard 四条清晰的业务链路。当前最值得优先投入的是消息处理、提醒恢复、服务启动依赖和发布切换这四个主路径，其次是数据提交结果、页面缓存与媒体生命周期的一致性。

本报告收录 **32 项问题和优化点：P1 4 项、P2 20 项、P3 8 项**。没有列入 P0。排序依据是对当前个人工具的业务影响、触发路径与修复收益，不以引入更多架构或安全组件为目标。

证据来源包括当前源码、依赖声明与锁文件、相关已安装依赖实现、部署脚本、近期提交以及必要的上游官方资料。开始审计时工作区没有已显示的未提交改动。遵守仓库约束，既有 doc 文档不作为当前事实来源。

本文使用三种证据标记：

- **S：源码确定。** 所述控制流、计算、资源生命周期可以由当前实现直接确定；具体影响以条目中列出的触发条件为前提。
- **C：条件推断。** 代码在给定输入下的结果确定，但外部数据语义或生产配置仍需直接证据才能确定实际影响。
- **O：优化机会。** 当前实现的成本或累积方式明确，实际耗时、内存、磁盘占用没有在本文中量化。

生产服务器日志、当前外部 API 响应、线上数据库存量及实际页面表现不在本报告的证据集合内。因此，本报告不把源码中的风险表述成已经发生的线上事故，也不据此认定不存在其他问题。浏览器交互、数据迁移与真实恢复过程同样不由静态审阅推定成功。

## 二、覆盖范围与当前结构

| 业务链路 | 当前入口与数据路径 | 本次审阅重点 |
| --- | --- | --- |
| 常驻 Bot | src/resident.ts → Telegraf、进程内调度；data/notinews.sqlite | 授权、命令与回调、单次/循环提醒、工作日、生活记录、订阅、内容抓取、AI 摘要、视频任务、巡检 |
| 一次性推送 | src/index.ts；daily-push.yml 手动触发 | 入口结构、时间选择、与常驻入口的关系 |
| Journal | src/journal-server/index.ts → Fastify；SQLite、附件目录；apps/journal-web | 公开/私有/口令内容、文章与普通记录、投稿、媒体、评论、留言、照片、游戏、简历、AI、路由与状态 |
| Journal Telegram 与 CLI | src/journal-bot、scripts/journal-article.mjs | 消息采集、内外部鉴权、文章创建、附件归属与结果反馈 |
| Lu Dashboard | apps/lu-dashboard/src/server.ts；只读 Bot 数据库 | 登录、统计口径、图表与主题生命周期、镜像挂载 |
| start.gg Dashboard | 独立 Fastify 代理 → Bot 内部 API | 公开读取/管理操作边界、任务状态、轮询、结果缓存、赛事状态计算 |
| 发布与数据维护 | GitHub Actions → main 对应服务；deploy、scripts | 变更范围、镜像复制、宿主配置同步、版本标记、备份/恢复脚本、产物清理 |
| 依赖与维护入口 | package.json、workspace、lockfile、Dockerfile、根 README | 声明与实际使用、运行依赖进入镜像、说明与当前配置的一致性 |

源码路径与行号以本次基线为准。下文链接均相对本报告所在目录指向仓库文件；行号写在链接之后。

## 三、优先级总表

P1：应优先修复，会让主要功能停止、无法启动或使发布破坏当前服务。  
P2：正常业务路径下产生错误状态、数据结果、体验或发布遗漏。  
P3：在高优先级问题之后处理的性能、资源与维护优化。

| 编号 | 优先级 | 问题或优化点 | 证据 |
| --- | --- | --- | --- |
| A01 | P1 | 长视频任务占住 Telegram 长轮询，后续消息无法进入处理 | S |
| A02 | P1 | 过期循环提醒在重启后永久脱离调度 | S |
| A03 | P1 | 照片目录初始化失败阻断整个 Journal 启动 | S |
| A04 | P1 | Bot 发布直接删除运行目录，并提前写入成功版本标记 | S |
| A05 | P2 | 重启取消已发送待处理提醒，旧卡片可能显示虚假推迟成功 | S |
| A06 | P2 | V2EX 摘要失败仍消费整批缓存话题 | S |
| A07 | P2 | 媒体目录绑定可变业务时间，跨月追加或提交后删除失败 | S |
| A08 | P2 | 评论/留言已保存，通知失败却使提交表现为整体失败 | S |
| A09 | P2 | 普通记录编辑缺少离开保护，未保存输入直接丢失 | S |
| A10 | P2 | 编辑/发布返回资产页，缓存列表仍保留旧数据 | S |
| A11 | P2 | 瀑布筛选与分页响应乱序会混入错误结果和游标 | S |
| A12 | P2 | 旧记录的解锁响应会清空后来打开的记录弹层 | S |
| A13 | P2 | 六位口令解锁无限流，并同步执行耗时密码派生 | S |
| A14 | P2 | Journal 与 Lu 会话没有服务端过期判断 | S |
| A15 | P2 | 部署等待队列替换与单次 push 差异判断可能共同漏发服务 | S |
| A16 | P2 | 发布过滤遗漏运行配置及 Journal 的共享天气实现 | S |
| A17 | P2 | Journal 代理配置变更触发发布，却没有配置交付步骤 | S |
| A18 | P2 | 备份停机覆盖压缩、远程传输与远端清理全过程 | S |
| A19 | P2 | 已有推送历史的 AV 订阅被外键阻止删除 | S |
| A20 | P2 | 维生素旧卡片会修改当天记录 | S |
| A21 | P2 | Lu 七日移动平均的前六点采用错误计算窗口 | S |
| A22 | P2 | 一次性推送入口花括号未闭合 | S |
| A23 | P2 | 投稿中途离开后，上传会话与临时素材持续占用资源 | S |
| A24 | P2 | start.gg 败者组标记可能压过最终名次 | C |
| A25 | P3 | 视频卡片预加载资源与 KeepAlive 生命周期不匹配 | O |
| A26 | P3 | 发现页翻页重复同步读取和处理全部正文 | O |
| A27 | P3 | 游戏图片移除或替换后，旧资产仍然保留 | O |
| A28 | P3 | SSH 巡检使用同步子进程，阻塞 Bot 主线程 | O |
| A29 | P3 | Journal 镜像携带整个根依赖集合，发布耦合偏大 | O |
| A30 | P3 | start.gg 每次发布保留完整旧目录，缺少产物保留边界 | O |
| A31 | P3 | README 的包管理器版本与部署组成说明落后于实现 | S |
| A32 | P3 | AI 知识读取的 Telegram 相册素材范围不完整 | S |

## 四、P1：优先修复主路径

### A01 · 长视频任务阻塞后续 Telegram 消息处理

**依据：** [命令处理](../../src/bot/interactive.ts) 第 355–364、395–398 行；[Bot 配置](../../src/bot/createBot.ts) 第 15–18 行；[下载任务](../../src/services/videoDownload.ts) 第 8–25 行；[X 同步](../../src/services/xLikedVideoSync.ts) 第 31–44 行。

执行 /dld 或 /syncx 时，命令处理函数会等待整个任务完成。当前 handlerTimeout 为 Infinity，而安装的 Telegraf 4.16.3 会等待当前更新批次的全部处理函数结束，再获取下一批更新。因此，长任务运行期间，新消息和按钮无法进入处理；进程内定时发送仍可运行。下载任务配置的最长时限为 6 小时，X 同步为 30 分钟，这些是配置上限，不是实测耗时。[上游对应版本源码](https://raw.githubusercontent.com/telegraf/telegraf/v4.16.3/src/core/network/polling.ts)第 75–76 行与本地实现一致。

**最小处理：** 命令建立进度卡后，把任务交给现有服务函数管理并及时结束消息处理；成功和失败明确更新原卡片。占用标志应在首次异步等待前建立，避免两条同批命令都通过运行中判断。

### A02 · 过期循环提醒重启后不再触发

**依据：** [提醒调度](../../src/reminders/scheduler.ts) 第 67–70、107、118–131 行；[常驻入口](../../src/resident.ts) 第 27 行。依赖依据为安装的 node-schedule 2.1.1：lib/Job.js 第 228–235 行、lib/schedule.js 第 39–43 行。

若停机跨过某条规则的 next_trigger_at，恢复时仍将过去时间传给 scheduleJob。依赖对此返回 null，不抛异常；现有处理会继续保留 active 状态并输出恢复日志，但没有真正注册后续任务。影响会延续到未来周期，而不只是错过停机时的一次提醒。

**最小处理：** 恢复时依据原规则求出未来有效触发点，持久化后再注册。对已错过的一次是否补发，应明确业务规则；未来周期必须继续。此修复不涉及更换 rrule 导入方式。

### A03 · 照片索引成为整个 Journal 的启动前置条件

**依据：** [服务组装](../../src/journal-server/server.ts) 第 163–167 行；[监听入口](../../src/journal-server/index.ts) 第 6–7 行；[照片索引](../../src/journal-server/photos/photoLibraryService.ts) 第 252–254、303–319 行。

服务开始监听前必须完成 Google Drive 照片索引。Drive 请求失败、凭据失效、空根目录或任意空相册都会直接使创建服务失败。正常的“先建相册、再上传图片”中间状态也可能触发此路径，进而影响文章、管理端、投稿和健康接口。

**最小处理：** 将索引建立放到照片业务入口；照片请求直接呈现对应错误。照片媒体直达请求也应使用同一初始化路径，使文章服务监听不依赖外部相册当时的状态。

### A04 · Bot 发布在新版本准备完成前破坏运行目录

**依据：** [发布 workflow](../../.github/workflows/deploy.yml) 第 423–445、457–474 行；[Bot 服务](../../deploy/notinews-bot.service) 第 9–18 行。

发布先删除运行目录内的源码和 node_modules，解压新文件并立即写 .deploy-commit，之后才安装依赖和媒体工具，最后重启服务。旧进程此时仍可能访问已删除或已替换的文件；如果安装阶段失败，目录会停留在不完整的新版本，版本标记却已宣称切换完成。下载任务还会从同一目录启动子进程，进一步放大该时间窗口。

**最小处理：** 在独立候选目录准备完整文件与依赖，准备完成后进行一次短暂的服务切换；成功激活后再记录版本。保留现有 main → GitHub Actions → systemd 路径即可，不必另建发布平台。

## 五、P2：数据、交互与发布一致性

### A05 · 重启错误取消已发送待处理的单次提醒

**依据：** [提醒调度](../../src/reminders/scheduler.ts) 第 28、46–59 行；[提醒仓储](../../src/reminders/repository.ts) 第 66–92 行；[推迟回调](../../src/bot/interactive.ts) 第 1695–1713 行。

发送后提醒仍为 pending，等待用户完成。重启却把所有触发时间已过的 pending 无差别改为 cancelled，包括已经送达但尚未处理的提醒。旧卡片的推迟操作只更新 pending，因而可能没有实际更改记录，却显示推迟成功。

**最小处理：** 使用已有 sent_message_id 区分已送达待处理和未发送记录；保留前者的业务状态。回调根据实际状态修改结果更新卡片。与 A02 一起覆盖“触发前重启、触发后待处理重启、再次点击原卡片”的完整路径。

### A06 · V2EX 摘要失败后误消费缓存批次

**依据：** [摘要生成](../../src/ai/deepseek.ts) 第 277–286 行；[缓存推送](../../src/services/v2exBufferedPush.ts) 第 81–87 行。

DeepSeek 异常或空结果被转换成正常错误文案；调用方将这段文字发送后，继续把缓存话题标为已消费。结果是用户没有收到实际简报，这批节假日话题也不再进入后续补充简报。

**最小处理：** 摘要失败直接抛出；仅在真实摘要生成并发送完成后标记消费。移除当前把异常转换为正常业务数据的行为。

### A07 · 媒体目录由可修改的发布时间推导

**依据：** [素材存储](../../src/journal-server/media/storage.ts) 第 43–53、150–174、231–239 行；[记录上传](../../src/journal-server/entries/webEntryUploadService.ts) 第 127–151 行；[仓储](../../src/journal-server/data/repository.ts) 第 740–767、1060–1068 行；[文章上传](../../src/journal-server/articles/articleService.ts) 第 241–246 行；[投稿处理](../../src/journal-server/contributions/contributionService.ts) 第 51–56、133–157、188–206 行。

素材按 UTC 年/月/publicId 存放，发布或调整时间只改变 source_created_at。8 月草稿在 9 月发布并追加图片时，新旧素材可能分属两个目录；删除入口却要求同一条目的全部素材必须位于一个目录，因而拒绝删除。

投稿存在同类问题：上传目录取会话 createdAt，删除目录却用 submittedAt 重算。跨 UTC 月提交后，两者指向不同位置；删除最后一张素材时还可能出现数据库素材先删除、目录清理随后报错的部分完成状态。

**最小处理：** 存储位置使用稳定事实，追加素材复用实际目录；删除依据数据库记录的真实路径。处理已经跨目录的数据时应覆盖所有所属素材，不能只修正未来上传。

### A08 · 评论和留言保存结果与通知结果混为一体

**依据：** [评论服务](../../src/journal-server/interactions/interactionService.ts) 第 120–138 行；[留言服务](../../src/journal-server/guestbook/guestbookService.ts) 第 128–143 行；[错误响应](../../src/journal-server/server.ts) 第 189–201 行。

两个入口都先写 SQLite，再等待 Telegram 通知。通知抛错时，内容已经保存并可能公开，但请求返回整体失败。访客再次提交便会生成重复记录。

**最小处理：** 结果明确携带已持久化记录及其 ID，并显式呈现通知错误；前端依据实际保存状态更新列表。保持通知失败可见，避免让访客重新创建已经存在的内容。

### A09 · 普通记录编辑离开时丢失未保存输入

**依据：** [普通记录编辑](../../apps/journal-web/src/components/publisher/EntryPublisherView.vue) 第 39–47、139–151、308 行；[路由出口](../../apps/journal-web/src/components/app/AppRouteViewport.vue) 第 200–204 行。对照 [文章编辑](../../apps/journal-web/src/components/article/ArticleEditorView.vue) 第 44–55、154–159 行。

新建或编辑普通记录时，正文、媒体与其他表单状态仅在组件内。返回按钮、站内导航和浏览器后退会销毁该页面；没有脏状态提醒或离开保护，重新进入无法找回刚才的输入。文章编辑已有对应机制。

**最小处理：** 沿用文章编辑的保存基线和离开确认，覆盖正文、主题、媒体增删、权限及发布时间；成功保存后更新基线。

### A10 · 成功编辑/发布后资产缓存不失效

**依据：** [私有资产页](../../apps/journal-web/src/components/journal/private-feed/PrivateAssetFeedView.vue) 第 166–184、198–204 行；[路由标识](../../apps/journal-web/src/app/appRoute.ts) 第 51–52 行；[普通记录返回](../../apps/journal-web/src/components/publisher/EntryPublisherView.vue) 第 146–151、190–224 行。

资产页通过固定 key 与 KeepAlive 保留。编辑完成时的 journalAssetChanged 只绕过一次提前返回，没有使已加载的表格/瀑布缓存失效；激活钩子也仅处理直接进入详情。于是返回原列表后，正文、权限、发布状态或新记录仍可能不更新。文章编辑返回也缺少统一变更通知。

**最小处理：** 成功写入统一通知资产数据变化，更新对应行或当前列表，并使另一种展示缓存失效；保留筛选、页码和滚动状态。[Vue 官方 KeepAlive 生命周期](https://vuejs.org/guide/built-ins/keep-alive.html#lifecycle-of-cached-instance)确认停用缓存组件并不会卸载。

### A11 · 瀑布列表筛选与分页存在响应竞态

**依据：** [列表请求](../../apps/journal-web/src/composables/useJournalApi.ts) 第 72–76、239–255 行；[筛选切换](../../apps/journal-web/src/components/journal/private-feed/PrivateAssetFeedView.vue) 第 210–224 行；[工具栏](../../apps/journal-web/src/components/journal/AssetManagementToolbar.vue) 第 63–68 行。

条件 A 发出后切为 B，若 A 最后返回，会直接覆盖 B 的列表和游标。旧筛选的分页请求也会向当前列表无条件追加，导致筛选条件、条目与下一页游标不对应。350ms 防抖只减少请求次数，不能约束返回顺序。

**最小处理：** 首屏和分页共用同一个筛选版本，只有仍属于当前条件的结果才能写入。可沿用 [表格请求](../../apps/journal-web/src/composables/usePrivateAssetTable.ts) 第 19–40 行已有的请求序号方式。

### A12 · 旧解锁响应破坏后来打开的加密记录弹层

**依据：** [详情状态](../../apps/journal-web/src/composables/useJournalApi.ts) 第 66–70、117–142 行；[公开列表](../../apps/journal-web/src/components/journal/public-feed/PublicFeedView.vue) 第 50–54、293–298 行；[弹层](../../apps/journal-web/src/components/journal/JournalDetailOverlay.vue) 第 134–155、200–205、230–239 行。

打开 A 并提交口令，在返回前关闭，再打开同频道的 B。A 返回后仍会写入 A 详情并清空 protectedDetail，覆盖 B 的保护预览。B 的 ID 判断会挡住 A 的正文，但弹层也失去 B 的内容，落入空的等待容器。

**最小处理：** 选择或关闭详情时更新请求身份；解锁响应应用前确认当前仍为同一条记录，同时约束详情、错误和解锁中的状态。

### A13 · 六位口令解锁缺少尝试限制

**依据：** [口令协议](../../src/shared/journalProtocol.ts) 第 7 行；[公开解锁](../../src/journal-server/routes/publicFeed.ts) 第 74–89 行；[密码比较](../../src/journal-server/auth.ts) 第 23–37 行；[限流注册](../../src/journal-server/server.ts) 第 173–176 行；[管理员登录](../../src/journal-server/routes/privateEntries.ts) 第 86–93 行。

内容口令限定六位数字，解锁入口没有启用已安装的限流插件；插件设置 global:false。每次格式正确的尝试还会同步执行 scrypt，占用服务线程。管理员登录同样没有路由限流。简历解锁已有单独限制，因此这里是具体入口遗漏。

**最小处理：** 复用 [简历路由](../../src/journal-server/routes/resume.ts) 第 79–80 行的限制机制，并结合实际代理确定客户端来源；密码派生采用异步 API。无需扩展成账户体系。

### A14 · Journal 与 Lu 登录有效期只由浏览器执行

**依据：** [Journal 鉴权](../../src/journal-server/auth.ts) 第 4–7、84–88、117–134 行；[Lu 鉴权](../../apps/lu-dashboard/src/server/auth.ts) 第 8–17、33–57 行；对照 [start.gg 会话](../../apps/startgg-dashboard/server/server.mjs) 第 22–26、45 行。

Journal 与 Lu 都签名固定字符串 authenticated，只在 Cookie 属性上设置 30 天或 7 天。服务端校验不包含签发时间、过期时间或会话版本；持有旧 Cookie 值的客户端重新提交时，只要签名密钥不变就仍被接受。仅修改登录密码也不会使该值失效。Journal 管理 Cookie 还固定设置 secure:false。

**最小处理：** 参考现有 start.gg 实现，将过期时间纳入签名并由服务端判断；明确改密码时的会话失效方式，并让生产管理 Cookie 使用 Secure。没有证据表明当前 Cookie 已泄露。[Hono Cookie 文档](https://hono.dev/docs/helpers/cookie)和[Fastify Cookie 文档](https://github.com/fastify/fastify-cookie)分别说明签名读取与 Cookie 属性，不能把签名本身当作服务端有效期。

### A15 · 部署排队替换会漏掉中间提交对应的服务

**依据：** [workflow 并发与变更判断](../../.github/workflows/deploy.yml) 第 37–39、55–58、102–105、153–166 行。

同组只设置 cancel-in-progress:false，没有开启多项等待队列。GitHub 默认仍会用新等待任务替换旧等待任务。若 A 正在发布、B 只改 Journal 并等待、C 只改 Lu，B 可以被 C 替换；C 的差异判断只看到本次 push，Journal 变更不一定被部署。根依赖比较明确使用 github.event.before，同样没有累计被替换任务的差异。

**最小处理：** 为现有部署并发组开启官方提供的 queue:max，让正常等待任务顺序保留；失败任务仍沿用当前明确处理流程。若以后需要合并发布，则差异基线应改为各服务实际发布版本。[GitHub 并发语义](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency)、[paths-filter 对长期分支的差异基线](https://github.com/dorny/paths-filter#supported-workflows)支持上述推导。这里不主张仓库已发生过漏发。

### A16 · 发布范围遗漏真实运行依赖

**依据：** [发布过滤](../../.github/workflows/deploy.yml) 第 60–96 行；[Journal 镜像](../../deploy/journal/Dockerfile) 第 50 行；[Journal 天气服务](../../src/journal-server/weatherService.ts) 第 1 行；[工作日日历](../../src/calendar/chinaWorkday.ts) 第 20–32 行。

至少有三个直接可见的缺口：

- data 下的节假日、监控目标、预置选手 JSON 由 Bot 实际读取，但单独修改这些文件不会选中 Bot 发布。
- scripts/ensure-node-lts.mjs 是根启动脚本的前置依赖，单独修改同样未被过滤规则覆盖。
- src/fetchers/qweatherCurrent.ts 已复制进 Journal 镜像并被 Journal 引用，但该路径只命中 Bot。

**最小处理：** 按当前真实依赖补齐现有过滤规则；日历年度更新也应走此路径。共享依赖变更要同时选中实际使用的服务。数据文件应按用途逐项纳入：start.gg 预置配置还存在运行时回写，不能将整个 data 目录当作可以整体覆盖的静态发布资产。

### A17 · Journal 代理配置不随对应发布交付

**依据：** [Journal 宿主资产打包](../../.github/workflows/deploy.yml) 第 259–265 行；[宿主安装](../../deploy/journal/deploy-release) 第 49–67 行；[代理配置](../../deploy/journal/feeds.xmcloud.buzz.conf)。

该配置属于 deploy/journal，修改会触发 Journal 发布，但打包清单不包含它，激活脚本也没有安装代理配置的步骤。修改上传体积、请求时限或缓存规则后，单靠现有自动发布不会让配置生效。

**最小处理：** 明确该文件是发布资产还是外部维护的模板。若属于发布资产，接入现有宿主资产交付和代理激活步骤；若由 1Panel 独立管理，在实际操作路径中明确此边界。源码只能证明交付链条缺失，不能证明线上代理目前配置错误。

### A18 · 备份停机时间被远程传输放大

**依据：** [Journal 备份服务](../../deploy/journal/journal-backup.service) 第 12–14 行及 [备份脚本](../../scripts/journal-backup) 第 40、53–78 行；[Bot 备份](../../scripts/notinews-backup) 第 25–43、55–80 行。

Journal 在完整脚本结束后才恢复容器；Bot 在退出清理时才恢复服务。停机因此包含本地副本校验、压缩、全部远程上传与旧备份清理。网络越慢、媒体越多，正常备份带来的停机越长，并可能触发 A02/A05 的提醒恢复问题。

**最小处理：** 保留停止写入后取得一致本地副本的方式；副本完成即恢复服务，后续操作针对静态副本进行。当前服务单元已经先停止 Journal，因此没有把这里误判为 SQLite WAL 热拷贝问题。

### A19 · 有推送历史的 AV 订阅无法删除

**依据：** [订阅删除](../../src/services/avRepository.ts) 第 101–112 行；[数据库](../../src/reminders/db.ts) 第 16、75–81 行；[命令入口](../../src/bot/interactive.ts) 第 522–533 行。

push_history 外键引用 tracked_targets，且没有级联删除。删除入口只删除父订阅，所以订阅一旦产生推送历史，SQLite 就会拒绝删除。

**最小处理：** 在同一事务内先删除该订阅所属历史，再删除订阅；保持其他订阅数据完整。

### A20 · 维生素旧卡片操作落到今天

**依据：** [按钮生成](../../src/formatters/index.ts) 第 201–206 行；[回调](../../src/bot/interactive.ts) 第 1541–1565 行；[状态处理](../../src/services/vitaminReminder.ts) 第 121–150 行。

按钮只包含动作，没有所属日期；回调统一调用 todayKey。第二天点击昨日“已吃”，会把今天标记为已吃并影响今晚提醒；点击旧的稍后提醒也会启动今天的循环。

**最小处理：** 沿用现有打卡和下车提醒的日期回调方式，把日期带入按钮并更新对应日期的状态与消息。

### A21 · Lu 七日移动平均窗口错误

**依据：** [统计计算](../../apps/lu-dashboard/src/client/src/analytics.ts) 第 75–92 行；[趋势图](../../apps/lu-dashboard/src/client/src/components/TrendChart.vue) 第 55、74 行。

代码先截取展示日期范围，再计算最多七个点的平均。首六个点实际上分别使用 1～6 天，因此同一天在 30 天图左边界与 90 天图中部可能得到不同均值。例如展示首日前一天有 1 条、首日为 0，且其余五天为 0，当前首点为 0，完整七日平均应为 1/7。

**最小处理：** 将计算序列向前延伸六天，按完整七天计算后再裁剪显示范围。现有 counts 已经包含所需历史数据。

### A22 · 一次性推送入口存在语法结构错误

**依据：** [一次性入口](../../src/index.ts) 第 87–102 行；[入口声明](../../package.json)；[手动 workflow](../../.github/workflows/daily-push.yml)。

关闭 v2ex 分支所需的右花括号被包含在停用 fitness 的注释中，导致 main 函数最终没有闭合，入口不能解析。影响是保留的手动一次性推送链路；常驻服务的入口是 resident.ts。

**最小处理：** 恢复必要的分支闭合结构，将停用代码整理到不会跨越其他分支边界的位置。

### A23 · 投稿上传缺少放弃会话的释放路径

**依据：** [前端上传](../../apps/journal-web/src/composables/useContributionSubmit.ts) 第 237–280 行；[上传服务](../../src/journal-server/contributions/contributionUploadService.ts) 第 55–62、80–95、124–159 行；[投稿会话](../../src/journal-server/contributions/contributionService.ts) 第 51–61、112–120 行；[存储初始化](../../src/journal-server/media/storage.ts) 第 24、32–36 行。

前端先传完原始文件，再处理和提交。离开时只中止当前传输，没有结束业务 uploadId。部分成功文件、已经处理的临时素材与会话 Map 因而继续保留，服务持续运行期间可以累积。

安装的 tus-js-client 4.3.1 在 lib/upload.js 第 456–479 行区分中止与终止删除；现有 abort 不传 true。安装的 @tus/file-store 2.1.1 默认过期时间为 0，也不能代替业务会话回收。服务启动会清空临时目录，因此这里不是声称文件永远无法释放。

**最小处理：** 补齐明确的取消/释放入口，清理该会话的原始文件、转换文件和内存记录；为失去客户端的会话定义有效期。客户端主动结束与服务端资源释放应属于同一上传生命周期。

### A24 · start.gg 败者组信号可能压过最终名次（条件推断）

**依据：** [状态判断](../../src/services/startgg/tracker.ts) 第 337–364 行；[名次查询](../../src/services/startgg/client.ts) 第 199–220 行。

给定“最近一场已输、处于败者组、没有进行中比赛、standing.isFinal 为 true 且非冠军”这一组输入，inLosersSignal 会使第 351 行条件成立，代码仍返回 in_losers，而不会进入 eliminated。

**最小处理方向：** 在实际赛事响应确认字段语义后，优先用最终名次与是否仍有比赛判定结束，再判断仍参赛选手的组别。[start.gg 官方术语](https://developer.start.gg/docs/glossary/)说明 Standing 可以表示当前或最终名次，但没有单独解决本次 isFinal 数据时序问题；因此不将此项写为某位线上选手已被错判。

## 六、P3：性能、资源与维护优化

### A25 · 视频预加载资源缺少合理释放边界

**依据：** [视频卡片](../../apps/journal-web/src/components/ui/JournalProgressiveVideo.vue) 第 22–40 行；[播放器池](../../apps/journal-web/src/utils/journalVideoPlayerPool.ts) 第 6–25、38–49 行。

卡片首次进入视区就创建 preload=auto 视频并永久停止观察，直到组件卸载才释放。列表使用 KeepAlive 后，切换频道不会卸载全部卡片，浏览过的视频引用可能持续保留。

**最小优化：** 卡片优先使用预览图，把完整媒体加载放到详情；需要预加载时限定范围，并在停用时释放。源码支持“引用保留”的结论；[MDN preload 说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#preload)明确它只是浏览器提示，实际下载量和内存不能据此虚构。

### A26 · 发现页每一页都处理全部候选正文

**依据：** [发现查询](../../src/journal-server/data/repository.ts) 第 1350–1407 行；匹配处理第 443–505 行。

查询读取全部已发布公开/口令记录的 e.*，包含非搜索必需的富文本及原始字段，再在 JavaScript 中匹配、排序、截取游标和 20 条结果。翻到第二页仍重复全量工作。

**最小优化：** 先只读取搜索必需列，将适合的候选过滤和分页交给 SQLite；数据规模确有需要时再考虑现有 SQLite 的全文检索能力。实际慢查询时长不在本次证据内。

### A27 · 游戏图片替换后旧文件和链接继续保留

**依据：** [游戏服务](../../src/journal-server/games/gameService.ts) 第 40–78 行；[游戏仓储](../../src/journal-server/games/gameRepository.ts) 第 95–138 行；[图片路由](../../src/journal-server/routes/games.ts) 第 102–117 行。

替换封面、横幅或移除截图只更新引用，没有删除失去引用的图片记录和磁盘文件。旧媒体 URL 仍可按 ID 访问。当前代码能确定资源累积，不能据此断言磁盘已经不足。

**最小优化：** 在引用更新成功后对比新旧资产集合，确认不存在其他引用，再释放已移除资产。同步明确“移除图片”是否应撤下原链接。

### A28 · SSH 巡检阻塞进程事件循环

**依据：** [服务器巡检](../../src/services/serverHealth.ts) 第 55–79、118–131 行；[备份巡检](../../src/services/backupHealth.ts) 第 95–118、164–165 行。

两处使用 spawnSync，单次配置最长 8 秒。外层 Promise.all 不会将同步子进程变成异步；等待期间，同进程的消息和 start.gg API 也无法正常推进。该问题与 A01 的长轮询批次等待机制不同，应分别处理。

**最小优化：** 使用项目已有的异步子进程方式，保留明确的超时与错误结果。同步梳理现有额外重试是否符合当前业务规则。

### A29 · Journal 运行镜像包含完整根依赖集合

**依据：** [根依赖声明](../../package.json)；[Journal Dockerfile](../../deploy/journal/Dockerfile) 第 13–14、44–45 行；[发布依赖范围](../../.github/workflows/deploy.yml) 第 126–129 行。

Journal 安装并复制根 node_modules，其中同时包含 Bot、前端工具和开发依赖；根依赖任意变化也会同时选择 Journal 与 Bot 发布。随着模块增加，镜像体积和无关部署成本会继续叠加。

**最小优化：** 优先明确 Journal 实际运行依赖清单，按收益逐步收紧产物。当前运行入口依赖 tsx，不能直接删除全部 devDependencies；任何依赖边界调整都必须同步修改镜像复制范围。这里不建议为拆包而整体重构仓库。

### A30 · start.gg 发布目录无限保留

**依据：** [start.gg 发布脚本](../../deploy/startgg-dashboard/deploy-release) 第 10–20、30–31 行。

每个提交都会创建 releases/提交号 并解压完整产物；脚本只清除上传 tar，没有清除历史发布目录。Journal 和 Lu 已有当前/上一镜像保留逻辑，start.gg 尚无对应边界。

**最小优化：** 记录当前与上一有效版本，清理其余不再使用的发布目录。保留范围明确即可，实际磁盘占用不在本次证据内。

### A31 · 根 README 的部分事实需要跟随实现更新

**依据：** [英文 README](../../README.md)“Environment and data”“Deployment today”；[中文 README](../../README.zh-CN.md)对应章节；[package.json](../../package.json)及 [发布 workflow](../../.github/workflows/deploy.yml)。

两份说明仍写 pnpm 11，而 packageManager 为 pnpm@12.5.1；部署说明主要围绕 Bot 和 Journal，未完整体现当前 Lu 与 start.gg 独立发布任务。README 同时描述服务器巡检为 HTTP/端口/TLS 探测，而当前 serverHealth 主路径执行 SSH 获取主机与运行时间。

**最小优化：** 更新少量版本、入口和部署事实，并以当前源码为准维护。历史 doc 内容继续按项目约束只作为历史记录。

### A32 · AI 知识读取遗漏相册其他消息的素材

**依据：** [知识仓储](../../src/journal-server/knowledge/knowledgeRepository.ts) 第 258–263、320–342、426–438 行；对照 [普通详情聚合](../../src/journal-server/data/repository.ts) 第 2578–2598 行。

知识搜索返回 Telegram 相册代表消息，后续 readEntry 只读取该 entry_id 的图片。同一 media_group_id 的其他消息图片没有进入读取结果，而普通详情会聚合全部同组素材。因此用户看到的相册与 AI 整理时可引用的素材范围不一致。

**最小优化：** 搜索代表项、知识读取与允许复制的来源资产共用相册集合规则。这里指素材元信息和可引用 ID 的完整性，不推定模型已具备图片内容理解能力。

## 七、已有实现中值得保留的部分

- Journal 的管理员入口、自动文章入口、Telegram 内部入口已有分开的授权边界；公开媒体读取包含可见性判断，不能仅因媒体 ID 可枚举就认定越权。
- 评论与富文本使用成熟解析/消毒库、受控标签和链接协议；站内图片检查归属，存储路径也有根目录与 publicId 约束。
- SQLite 已启用 WAL 与外键，主要业务写入使用事务。AV 删除问题是局部父子记录处理遗漏，不支持整体替换数据库的结论。
- Journal 的文章编辑已有离开保护；表格请求已有响应身份约束；AI 会话已有 epoch 与 AbortController。修复相关页面可沿用这些现成模式。
- start.gg 前端有跨会话响应隔离、按查询条件保存结果、页面隐藏时停调度等处理；Lu 图表有 ResizeObserver 与销毁释放逻辑。
- better-sqlite3 当前安装版本 13.0.3 随包提供 prebuilds，没有依赖传统 install 脚本。不能仅凭 workspace 中 allowBuilds:false 就认定数据库二进制缺失。
- Journal 备份服务已经先停止容器，不能只看到备份脚本的目录复制就认定在热拷贝数据库。

## 八、建议处理批次

| 顺序 | 范围 | 希望得到的业务结果 |
| --- | --- | --- |
| 第一批 | A01、A02、A03、A04；关联 A05、A18 | 下载不影响其他命令，重启不破坏提醒，照片异常不阻断文章服务，发布和备份的停机边界清晰 |
| 第二批 | A06–A12、A19–A23 | 保存、删除、编辑返回和连续操作的结果与真实数据一致 |
| 第三批 | A13–A17；A24 在外部数据语义确认后处理 | 口令与会话边界明确，实际变更能进入对应服务和代理配置 |
| 第四批 | A25–A32 | 收紧媒体、搜索、镜像和历史产物成本，修正维护说明与素材聚合 |

每批以覆盖对应完整主路径为完成标准，优先使用已有数据、事件、库和发布方式。上述批次是后续处理建议，本次仅形成审计报告。

## 九、首批修复记录（2026-09-26）

本批范围由用户指定为全部 P1（A01–A04）及 P2 的 A24，其余条目未纳入本批实现。

| 编号 | 源码处理 | 业务行为 |
| --- | --- | --- |
| A01 | 命令同步占位后启动后台任务，任务全程更新同一进度卡 | 长下载与 X 同步不再占住更新批次；重复命令提示正在运行；任务失败显示在原卡片 |
| A02 | 统一调度入口将过期触发点推进到未来有效周期并持久化 | 重启恢复及任务耗时跨周期后继续调度；已错过的周期不补发；保留原时区、工作日筛选与 rrule 导入 |
| A03 | 移除照片索引启动前置调用，媒体直达也使用现有索引加载入口 | 照片业务首次请求建立索引；照片错误由对应请求呈现，不再阻断 Journal 监听 |
| A04 | 候选目录先准备源码和依赖，互斥激活时才停止并切换 Bot，启动后写版本标记 | 依赖准备失败时运行目录保持原版；固定 data 路径保留；当前 release 保留安装位置，成功后清理旧 release |
| A24 | 最终名次且无活跃对局时优先判定冠军或淘汰 | 历史败者组信息不再覆盖已确定的最终结果；未结算阶段沿用胜败者组判断 |

### 补充依据

- **A04：** 服务器既有入口 `/usr/local/bin/pnpm` 通过项目的 packageManager 选择 12.5.1。该版本生成的脚本含安装目录，故本批保留完整候选 workspace，通过固定项目的 node_modules 链接使用依赖，不搬迁已安装目录。源码与依赖来自同一份提交。激活复用现有下载/备份锁，有任务占用时直接失败，不进入切换。[固定版本执行器源码](https://github.com/pnpm/pnpm/blob/v12.5.1/pnpm/crates/executor/src/lifecycle.rs)、[脚本生成实现](https://github.com/pnpm/pnpm/blob/v12.5.1/pnpm/crates/cmd-shim/src/shim/sh.rs)
- **A24：** 后续对 bwgdc01 现有记录及赛事结果的只读核对发现：已于 2026-09-20 完赛的本地 event 1247 中，DCQ（第 33）、Zhen（第 25）、Vxbao（第 13）均已取得最终名次、没有活跃对局，原持久化状态仍为 in_losers。该条已从原审计的条件推断补充为具体线上实例。[官方 Entrant 定义](https://developer.start.gg/reference/entrant.doc.html)明确 standing 属于整个 event。

本节记录实现及其依据；实际发布结果以对应提交的 GitHub Actions 记录为准。
