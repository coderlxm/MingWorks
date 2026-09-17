# AI 总结直接写入 Journal：详细实现方案

日期：2026-09-17。用途：交给 DeepSeek 实施，完成后由 Codex review。本轮仅编写方案，不实施接口、修改全局指令、安装工具或部署。

## 已确认的产品决策

- 主要使用 Codex CLI，兼顾其他能执行本地命令的 harness；首版只做 CLI，不实现 MCP。
- 自动保存默认公开，保存完成即在公开文章页面可读，无需每篇再次确认发布。
- 用户表达“整理成文章”“沉淀经验”“复盘报告”等成文意图时自动写入，普通聊天和代码改动总结不触发。
- 首版不支持图片和表格，使用文字、列表、引用、链接和代码块。
- 明确说“不要发布”“先给我看”“只写本地文件”时不调用；明确说“私有保存”时保存为 private。
- 本次请求是实现方案交接，不触发把本方案公开成文章。

## 目标与建议

工作过程中，模型根据讨论和材料整理经验文章，直接保存到 Journal；需要公开时，同一次调用完成发布并返回阅读链接。用户不再复制正文、手动排版、进入编辑器和点击发布。生成后的文章仍可在现有编辑器继续修改。

第一版确定采用 **Journal 写入 API + 薄 CLI + 模型工作约定**。正文使用 Markdown，服务器复用现有转换和文章存储能力。CLI 不绑定模型厂商，其他能执行本地命令的 harness 使用相同入口；不为尚未出现的远程客户端需求增加 MCP。

浏览器代操作可以完成单篇发布，但每次都依赖登录状态和页面交互。这里存在持续重复的写入需求，增加一个明确的程序入口比长期模拟点击更合适。无需新建文章系统，也无需让模型接触数据库。

## 已有实现与依据

以下来自当前源码阅读，不代表线上运行结果：

| 当前能力 | 源码依据 | 对本方案的意义 |
| --- | --- | --- |
| 文章创建、更新、附件上传 | `src/journal-server/routes/articles.ts`、`articleService.ts` | 复用文章业务逻辑，不另外维护文章格式 |
| Markdown → HTML → Tiptap JSON | `src/journal-server/knowledgeAgentService.ts` 的 `markdownToRichDocument` | 已使用 marked、sanitize-html 和 Tiptap，可抽出复用 |
| 标题锚点、正文纯文本、内容限制 | `src/journal-server/richText.ts`、`src/shared/journalRichText.ts` | 目录、摘要等继续沿用现有数据 |
| 创建文章固定为私有 | `src/journal-server/repository.ts` 的 `insertArticle` | 当前创建接口不等于公开发布 |
| 文章创建没有写入 draft 状态，表默认 published | `repository.ts`、`migrations.ts` | 私有文章不能混称为已有草稿状态 |
| 网页文章接口依赖管理员 Cookie；内部接口使用 ingest Bearer token | `src/journal-server/auth.ts`、`routes/internal.ts` | 需要明确的工具鉴权入口，不能直接假设现有文章接口支持 token |
| 阅读与编辑地址 | `web/src/router.ts` | 复用 `/p/:publicId` 与 `/me/articles/:articleId/edit` |

本地依赖声明和安装文件显示 marked 18.0.10、@tiptap/html 3.30.2；后者已导出 `@tiptap/html/server` 和 `generateJSON`，现有知识助手也在使用该入口。第一版不需要引入另一个 Markdown 解析器。

## 用户使用路径

1. 用户在日常 AI 会话中完成问题讨论或经验总结。
2. 模型按预先约定整理为标题、标签、Markdown 正文；只有材料支持的结论才写成经验，不把推测写成已经发生的结果。
3. 模型调用工具，一次传入内容和明确的可见性。
4. Journal 转换内容并保存；选择 public 时，这次保存同时完成公开。
5. 工具返回文章 ID、实际可见性、编辑地址和阅读地址，模型在回答中给出结果。

新打开或刷新现有文章列表后即可看到符合可见性条件的文章。第一版不增加推送通知、实时刷新机制或新的管理页面。private 只在登录后的私人界面可见，不能承诺匿名访客能读到。

## 接口设计（拟新增）

新增 `POST /api/automation/articles`，请求使用 JSON，认证使用专用于文章工具的 Bearer token。它调用现有文章服务，不调用网页 Cookie 登录流程，也不使用 Telegram ingest token。

| 字段 | 约定 |
| --- | --- |
| `title` | 必填，沿用现有 1–120 字符约束 |
| `markdown` | 必填，文章正文；标题单独提供，正文从二级标题开始 |
| `tags` | 必填，可为空数组；沿用现有最多 20 个、单个 1–32 字符约束 |
| `visibility` | 可省略，仅 `private` 或 `public`；API schema 统一默认 public，显式 null 属于错误 |
| `aiGenerated` | 必填，模型生成或实质改写时设为 true |

成功返回 HTTP 201 和 `id`、`publicId`、`title`、`visibility`、`editorUrl`、`readerUrl`。URL 由服务端配置的公开站点地址生成；private 的阅读地址需登录，返回可见性必须与真实存储一致。

创建时直接在同一数据库事务内写入正文和可见性。现有网页及知识助手创建仍保持 private；自动化请求在 schema 解析后得到明确的 public/private，再传给 repository。避免由 CLI 先创建、再调用第二个接口公开，从而让“一次发布”具有清晰结果。沿用现有 article 频道、rich 正文格式、web 来源和发布时间规则，不新增一种来源枚举或状态体系。

第一版只创建文章，不开放任意 SQL、删除、按标题覆盖和批量同步。模型在调用前完成正文整理；修改已存在文章暂用现有编辑器。只有出现明确的持续更新需求时，再设计按 ID 更新的工具契约。

## 正文转换与排版

将现有 `markdownToRichDocument` 抽到 Journal 服务端可共享的模块，知识助手和自动化入口共用。继续使用 marked 解析、sanitize-html 清理、Tiptap 生成 JSON，以及现有标题锚点和正文约束。服务器只负责转换和保存，不再调用另一个模型重新总结。

第一版支持现有文章格式能表达的段落、二三级标题、粗体、斜体、删除线、引用、有序/无序列表、代码块、行内代码、链接和分隔线。一级标题及四至六级标题沿用当前转换规则，归入二三级标题。

现有转换会过滤部分不支持的结构，不能据此宣称任意 Markdown 均能无损导入。新入口在转换前用成熟解析器的 token 识别表格、图片、任务复选框、原始 HTML 等未支持输入，明确返回不支持的结构，避免无声丢失内容。模型工作约定直接要求输出上述支持范围；引用链接保留来源，代码块保留代码与语言信息所能表达的内容。转换后的富文本继续遵守现有 512 KB 限制，请求体大小限制与 JSON 开销一并明确。

第一版不含封面、内嵌图片、PDF/Word 文件上传，也不自动抓取远程图片。用户已有文档时，由当前模型读取并整理成 Markdown 后再提交。日常经验总结可先用纯文字、列表和代码块覆盖，无需为本次目标扩展前端编辑器。

## CLI 与 MCP 的取舍

| 入口 | 合适场景 | 本次选择 |
| --- | --- | --- |
| CLI | 模型宿主能够执行本地程序、读取生成的文件 | 已确定，按需运行，不维护常驻服务 |
| 本地 stdio MCP | 宿主支持本地 MCP，需要工具自动发现与参数描述 | 有明确使用需求时，薄封装同一 HTTP API |
| 远程 MCP | 模型宿主只能连接远程工具 | 确认客户端和其认证支持后采用，不能假设所有宿主通用 |

拟提供一个文章创建命令，输入为 UTF-8 JSON 文件或标准输入，字段与 API 一致；不把长正文拼进 shell 参数。标准输出只输出成功结果 JSON，错误走标准错误并返回非零退出码。站点地址和 token 由宿主环境配置，模型不必读取或输出凭据。

CLI 只承担读取输入、发送 HTTP 和报告结果，转换留在服务器，避免每个客户端拥有不同排版规则。若后续采用 MCP，工具可命名为 `journal_create_article`，使用相同字段和返回值，不复制文章业务逻辑。采用官方 SDK；具体版本、导出路径和宿主支持范围在实现该入口时核对，不在本方案中锁定未经安装的 SDK API。

MCP 官方资料区分本地 stdio 和远程 Streamable HTTP；这决定接入方式，不意味着工具本身能够定时运行或主动发现尚未发送的总结。[官方 SDK 服务端说明](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)

## 如何解决“经常忘记发”

工具解决“能写入”，模型宿主中的长期工作约定解决“何时调用”。需要把约定放在日常总结所在的模型工作环境，而不仅是这个仓库里。

建议约定：用户明确要求沉淀经验、复盘或形成文章时，模型在完成正文后直接调用文章工具，并以返回的文章链接作为本次工作的交付结果。普通问答不自动转成文章。已经选择自动公开的工作流，不再每篇要求用户进入网页点发布。

用户已确认默认公开。模型工作约定明确传 public；API 在调用方省略字段时也按同一产品规则使用 public。明确说“私人归档”时传 private，不擅自改为私有或再要求逐篇批准。

这是任务收尾约定，不是后台监控。用户没有发起总结、宿主没有挂载工具或没有遵循约定时，系统不会凭空发现材料。第一版不增加定时扫描工作目录、通知催发、自动重试或发布队列。

## 鉴权与错误表达

新增一个专用配置项，例如 `JOURNAL_ARTICLE_TOKEN`，仅用于自动化文章入口；复用现有 Bearer 校验方式，不扩展到全站管理员权限。凭据通过部署环境和本地工具环境提供，不写进文章、参数示例或仓库。

输入不支持、内容超限、鉴权失败和写入失败均直接返回明确错误，不降级为纯文本、不静默保存一部分，也不在工具内部自动重发。网络中断后若没有收到服务器成功响应，模型应明确表示写入结果未知，不能宣称发布完成，也不能盲目再创建一篇。第一版不新增去重表或幂等状态系统；同标题并不是同一篇文章的可靠身份。

## 最小实施范围

1. 提取现有 Markdown 转换函数，补齐自动化输入的格式边界，保持知识助手原有调用语义。
2. 在共享协议中增加自动化请求/响应；文章服务及 repository 增加显式可见性的创建路径，旧入口保持原行为。
3. 增加专用文章 token 配置、鉴权方法和自动化路由，接入现有 Journal 服务。
4. 增加薄 CLI 入口及模型调用说明，配置总结完成后的调用约定。命令行参数处理使用平台已有能力或成熟库。
5. 沿用已有阅读页和编辑器，不改变前端交互。发布阶段仍使用项目既有 GitHub Actions 流程，本次方案不执行发布。

现有 Journal 镜像复制 `src/journal-server`、`src/shared` 及安装后的 `node_modules`。服务端新增文件放在这些范围内；本地 CLI 无需进入服务端镜像。若实现时增加运行时依赖或跨目录模块，必须同步调整对应复制范围。此方案复用已安装的 Markdown 和 Tiptap 能力，不要求新建数据库表。

## 预期交付结果

在选定的模型宿主中，一次“把这次经验整理并发布”的任务能够得到现有页面可读、可编辑的文章和明确链接；不要求用户再次打开后台排版。private/public 行为与工具返回一致，不支持的内容直接说明原因。第一版的完成标准是这条日常路径成立，而不是同时具备 CLI、两种 MCP 和后台自动化平台。

## 外部资料

- [Tiptap HTML Utility](https://tiptap.dev/docs/editor/api/utilities/html)：服务器端 HTML 与 JSON 转换能力；本文的具体调用依据还包括已安装版本的导出声明和项目现有实现。
- [MCP TypeScript SDK 服务端说明](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)：本地与远程接入方式；后续实现须以选定 SDK 版本和实际宿主能力为准。

## 详细实施规格

以下是首版实施约定，文件名可在确有源码冲突时局部调整，接口语义和范围不得自行扩大。前文描述整体设计，本节补齐实现细节。

### 1. 文件改动清单

| 文件 | 最小职责 |
| --- | --- |
| `src/shared/journalProtocol.ts` | 新增自动化文章请求、响应 schema 与推导类型 |
| `src/journal-server/articleMarkdown.ts`（新增） | 承载从知识助手提取的转换函数，以及自动化入口专用 Markdown 格式约束 |
| `src/journal-server/knowledgeAgentService.ts` | 改为导入转换函数，移除已迁出的依赖导入；保留知识助手原行为 |
| `src/journal-server/articleService.ts` | 新增 `createArticleFromMarkdown`，复用正文序列化、大小限制和非空约束 |
| `src/journal-server/repository.ts` | 创建文章输入增加必填 visibility，INSERT 参数化可见性 |
| `src/journal-server/routes/automationArticles.ts`（新增） | 注册创建接口、专用鉴权、组装响应和 HTTP 201 |
| `src/journal-server/auth.ts` | 增加文章工具 token 及 `requireArticleAutomation`，复用 secretsEqual |
| `src/journal-server/config.ts`、`types.ts` | 必填 `JOURNAL_ARTICLE_TOKEN` / `articleToken` |
| `src/journal-server/server.ts` | 传入新 token、注册新路由，沿用现有错误处理 |
| `deploy/journal/.env.example` | 增加 token 占位说明，不写入真实值 |
| `scripts/journal-article.mjs`（新增） | 可独立运行的 Node CLI，仅使用 Node 标准库与内置 fetch |
| `doc/guides/journal-article-cli.md`（新增） | CLI 参数、配置、输入格式、模型工作约定、首次启用说明 |

不改前端、不增加数据库迁移、不更换构建工具、不安装 MCP SDK、不把此事扩展为通用自动化框架。新增指南直接依据实现编写，不读取其他历史文档作为依据。工作区已有两份暂存设计文档属于其他任务，应保持原状。

### 2. HTTP 请求与响应

接口为 `POST /api/automation/articles`，仅接受 JSON。新请求 schema 使用 strict，避免多余字段被静默忽略。字段约束复用现有 title/tags 定义，`markdown` 只用 trim 判断非空，不 trim 实际正文，以免破坏缩进代码。`aiGenerated` 是必填 boolean，模型整理文章时传 true。

请求示例只是数据，不会执行发布：

```json
{
  "title": "一次部署差异的排查复盘",
  "markdown": "## 背景\n\n描述现象与使用场景。\n\n## 处理过程\n\n1. 对照实际产物。\n2. 根据证据定位原因。\n\n## 可复用经验\n\n区分源码声明和线上实际行为。",
  "tags": ["工程实践", "问题排查"],
  "visibility": "public",
  "aiGenerated": true
}
```

响应示例：

```json
{
  "id": 123,
  "publicId": "5bdc0430-4ddd-4c30-9a45-327d9e410e1b",
  "title": "一次部署差异的排查复盘",
  "visibility": "public",
  "editorUrl": "https://feeds.xmcloud.buzz/me/articles/123/edit",
  "readerUrl": "https://feeds.xmcloud.buzz/p/5bdc0430-4ddd-4c30-9a45-327d9e410e1b"
}
```

响应 schema 约束正整数 ID、UUID、可见性枚举及 URL，路由使用真实落库返回值构造，不直接回显请求假装成功。`readerUrl` 和 `editorUrl` 基于 `config.publicBaseUrl`，不用客户端 Host 头推断。

路由设置 `bodyLimit: 1024 * 1024`，只影响该入口。转换后的富文本 JSON 仍限制 512 * 1024 字节；两者不同，前者包含 Markdown 和 JSON 编码开销。正文转换、链接约束、空内容和大小约束都在数据库写入之前完成。

沿用 `{ "error": "明确错误信息" }` 的错误形状：

| HTTP 状态 | 含义 |
| --- | --- |
| 400 | JSON/schema 错误、非空要求、无效链接、图片/表格等不支持的结构 |
| 401 | 没有或错误的文章 token |
| 413 | 请求体或富文本大小超限 |
| 415 | 不支持的 Content-Type，沿用框架处理 |
| 500 | 未预期的内部错误或数据库异常 |

当前全局错误处理识别 ZodError 为 400、带 statusCode 的错误为对应状态，其余为 500。新入口的明确输入错误须携带适当 statusCode，不通过捕获所有异常统一包装成 400。现有文章服务的非空/大小方法目前抛普通 Error，应在实际抛出点赋予正确状态，不靠匹配错误字符串判断。无需改写全站错误系统。

### 3. Markdown 转换边界

先原样提取知识助手现有转换函数，保留其 h1→h2、h4/h5/h6→h3、链接处理与标题锚点规则。自动化入口先调用独立的 `assertAutomationArticleMarkdown`，再调用共享转换函数；知识助手不调用这个新增约束，以免扩展改变其输入语义。

用已安装 marked 的 lexer 与 walkTokens 访问嵌套 token，不用正则自行解析 Markdown，也不调用全局 setOptions 改变其他功能。递归处理引用、列表和链接内容中的 token：拒绝 table、image、html 及 task list item。错误应指出具体结构，例如“暂不支持 Markdown 表格，请改为分条描述”。在 fenced code 或 inline code 中出现 HTML、图片语法、竖线属于代码内容，不拒绝；普通段落中的竖线也不是表格。引用式图片同样属于 image，需要拒绝。

代码语言需要特别处理：现有 sanitizer 只允许 a 的属性，会移除 marked 生成的 `code.class=language-*`。共享转换提取应保持知识助手的现状；为自动化入口提供一个明确的转换选项保留 `code` 上的 `language-*` class，由 Tiptap 生成 codeBlock 的 language 属性。只放开该属性范围，不放开任意 class/style。代码正文的换行、缩进和 HTML 字面量必须保留。若在实施版本中 API 行为与这一路径不一致，先依据安装版本修正实现，不扩大富文本 schema。

标题由单独 title 字段提供，模型正文从二级标题或段落开始；服务器不猜测并删除“重复标题”。链接沿用 http/https/mailto 范围；自动化 Markdown 中明确不支持的链接协议应在 token 层报错，不能经 sanitizer 悄悄丢掉链接后继续发布。模型生成可被现有绝对 URL 规则接受的链接。

复用文章服务现有 normalizeRichDocument、assertRichDocument、extractContentText。不要让模型生成 Tiptap JSON 或锚点 ID，也不要把原始 Markdown 存进 rich_body_json。

### 4. 服务与事务改法

在 repository 的 `CreateArticleInput` 中增加必填 `visibility: 'private' | 'public'`。它只用于创建，不修改与其相邻但独立的 `UpdateArticleInput`。所有创建调用点显式传值：网页 createArticle 和 createArticleFromAiMessage 为 private，自动化入口使用解析后的值。

`insertArticle` 将 SQL 中固定的 private 换成占位符；沿用 createArticle 的现有 transaction。正文、title、tags、content_text、ai_generated 和 visibility 在一次 INSERT 中完成。既有 publication_status 默认 published，无需新增 draft 流程。不要在事务外第二次 updateVisibility，也不要把自动化入口的 public 默认扩散到 repository 或网页创建 schema。

文章服务新增 `createArticleFromMarkdown(rawInput)`：解析自动化请求 → 约束 Markdown → 转富文本 → 使用现有序列化与非空逻辑 → repository.createArticle。返回 JournalEntry，路由负责映射专用响应。避免复制一套正文序列化实现；若需要抽取内部准备函数，只抽出这些实际共享步骤。

knowledgeAgentService 的 saveMessageAsArticle、消息与文章关联事务以及已有重复保存行为保持现状，不为自动化入口复用 AI 消息 ID 或修改知识助手状态。

### 5. CLI 的确定契约

交付单文件 `scripts/journal-article.mjs`，目标运行环境与项目一致为 Node 24。选择 .mjs 是为了从任意工作目录执行时不依赖此仓库的 TypeScript loader、包管理器或 node_modules；不为一个命令新增 npm 包发布流程。

接口语法为 `journal-article create --input <JSON文件路径>`，`--input -` 表示标准输入。另支持 `--help`。这里的 `journal-article` 指安装后的可执行入口；源码文件包含 Node shebang 并提交可执行权限，启用时可放置到已有 PATH 目录或使用绝对路径。说明文档必须写清真实可执行路径，不假设命令已经全局存在。

只提供 create 子命令。用 `node:util.parseArgs` 解析参数，拒绝未知参数及多余位置参数；无参数显示用法并非零退出。使用 `node:fs/promises` 读取 UTF-8 文件，标准输入读取后同样 JSON.parse。文件路径按调用者工作目录解析，不切换到仓库根目录。JSON 解析后要求顶层为对象，业务字段的完整校验交给服务端，不在 .mjs 中手写第二份 schema。

客户端环境变量：

- `JOURNAL_API_URL`：必填，站点 HTTPS 基地址，例如 `https://feeds.xmcloud.buzz`，不是接口完整地址。
- `JOURNAL_ARTICLE_TOKEN`：必填，与服务端值一致。

客户端不自动读取当前目录的 .env，不加载整个项目环境；模型宿主启动时继承这两个变量。配置缺失直接报错，不回退其他 token 或 Cookie。`--help` 无需配置和网络。URL 用标准 URL API 处理，拒绝带用户名/密码、query 或 fragment 的配置；首版配置契约为 HTTPS 站点根地址。

网络请求只发一次 POST，设置 JSON Content-Type 和 Bearer，`redirect: 'error'`，不给重定向自动重发写请求。可用 Node 内置 AbortSignal.timeout 设置固定 30 秒请求上限；超时是终止并暴露错误，不是重试。不记录 headers/token，也不将凭据放进 shell 参数。

成功必须同时满足 HTTP 201 和完整响应对象：所需字段类型正确，ID/publicId/visibility/URL 符合约定。CLI 不需要新增完整 schema 库，按响应契约做简短明确的结果校验即可。输出单行 JSON 到 stdout，退出码 0；--help 为唯一非 JSON 的正常输出。

失败只在顶层捕获以输出 stderr、设置非零退出码，然后终止。HTTP 非 201 保留状态码及服务端错误文本；不要因为代理返回 HTML 而用 JSON 解析错误掩盖原 HTTP 错误。网络中断、超时、HTTP 500、201 但响应不完整时，要说明写入结果可能不确定。禁止输出 fabricated ID 或成功 URL，禁止自动再次调用。

### 6. 全局模型指令与其他 harness

仅在仓库中放 CLI 不足以实现跨项目自动调用，还需要把简短触发规则合并进日常 harness 的长期指令。首版交付普通 Markdown 指令片段即可，不必创建技能或插件体系。

Codex 的全局指令默认位于 Codex home 的 AGENTS.md；若存在非空 AGENTS.override.md，优先使用后者。项目指令也会影响最终规则；更新后由新会话读取。启用时根据实际生效文件合并，保留既有内容，不覆盖整个文件，也不主动创建 override 绕过原规则。这一接入依据官方指令文档，非本轮对用户全局文件的实际修改。[官方 AGENTS.md 说明](https://developers.openai.com/codex/guides/agents-md)

以下片段应在交付指南中提供，将 CLI 路径替换为启用后的真实路径：

> 当我要求整理成文章、沉淀经验、形成复盘报告，或表达同等的独立成文意图时，将最终正文整理为标题、标签和 Markdown，通过 Journal CLI 创建文章，默认 public、aiGenerated=true，不需要我再说一次发布。正文首版仅使用段落、标题、列表、引用、代码和链接，不使用图片、表格、任务复选框或原始 HTML。先完成最终内容，再发送一次。只总结材料中有依据的经验，不把未实施的方案写成已完成事实。普通问答、代码交付说明、实现计划和对方案的讨论不自动发表。当前明确要求不要发布、先预览、只保存本地时不调用；明确要求私有保存时传 private。只有工具成功后才能说已发布并返回真实 readerUrl。失败说明错误，结果未知时不自动再建一篇。工具凭据由环境提供，不读取、打印或写入正文。

这是模型的行为约定，不是关键词字符串匹配程序，不新增 hook、结束会话监听或后台模型调用。其他 harness 把相同片段放在其支持的长期指令位置，并提供相同 CLI 路径和环境即可；本次不猜测未指定 harness 的配置文件名。

指令片段与服务启用是独立步骤：DeepSeek 先交付代码及配置说明供 review，不提前安装全局触发规则，避免 API 尚未上线时影响日常会话。

### 7. 配置与发布交接

`JOURNAL_ARTICLE_TOKEN` 服务端为必填且至少 32 字符，沿用项目配置风格，不加“缺失就禁用功能”的隐式分支。JournalAuth 构造处同步传入，新增 requireArticleAutomation 只校验这一个 token。网页接口不增加 Bearer 登录，Telegram ingest token 也不能访问新接口。

现有 compose 从 `/opt/journal/.env` 注入环境。因此正式发布前必须先准备新 token，使服务端和本地模型环境一致；否则新版本配置解析会直接失败。不要为此改造 GitHub Secrets 体系或更换部署方式。实际生成、配置和部署在用户进入发布阶段后进行，review 前不修改生产环境。

新增服务端文件都位于当前 Dockerfile 已复制的目录；CLI 留在使用者本地。首版预期不新增运行时依赖，无需为 CLI 修改生产镜像。实现中如果改变了这些前提，要先说明理由和影响。

交付指南必须列出三项启用动作及顺序：服务器 token 与 API 随既有发布流程就绪；本地可执行入口和两项环境变量可用；最后合并模型指令并进入新会话。不能把“代码完成”直接表述为“日常自动发布已启用”。

### 8. Review 的业务判据

以下是后续代码审阅要对照的行为，不授权实施者运行测试、构建、服务或创建真实文章；执行仍遵守项目 AGENTS.md 和用户当时的授权。

| 场景 | 必须成立的行为 |
| --- | --- |
| 自动化请求省略 visibility | public；只创建一条完整文章 |
| 明确 private | 仅本人可见，响应明确 private |
| 网页新文章／知识助手转文章 | 仍按原逻辑 private |
| 嵌套列表、引用中的图片或表格 | 写库前拒绝，无半篇文章 |
| 代码中的图片语法、HTML、竖线 | 保留为代码，不能误判为不支持结构 |
| 带语言的代码块 | 保留正文、换行、缩进和 language |
| Markdown 标题 | 生成现有合法且唯一的锚点，可继续在编辑器使用 |
| 空白正文、过大正文、错误链接 | 对应明确输入错误，不写库 |
| 使用管理员 Cookie 或 ingest token 调用自动化入口 | 不能替代专用文章 token |
| 从其他项目目录调用 CLI | 不依赖当前项目的依赖、.env 或相对脚本路径 |
| 成功、非 JSON 错误响应、超时 | stdout/stderr/退出码符合约定，不把未知结果说成成功 |
| 自动化接口未上线、CLI 未配置 | 报出实际错误，不退回浏览器发布或重试 |
| 普通总结与独立成文任务 | 全局约定区分意图，不把每次代码交付都发布 |

### 9. 给 DeepSeek 的交付边界

按此顺序实施：共享协议和转换 → 服务及 repository → 鉴权与路由 → 单文件 CLI → 使用指南。完成后提供实际文件改动摘要、与本方案的差异及启用所需配置，保留工作区供 Codex review。

本阶段不 commit、不 push、不部署、不修改用户全局 harness 配置、不创建正式或临时文章。遵守项目关于命令执行、既有文档、最小变更和禁止兜底的约束。不要顺手修改其他前端、其他服务或此前暂存的设计文档。

本方案已经明确首版方向，无需再询问 CLI/MCP、是否默认公开、触发时机和图片表格范围。只有当前实际源码与方案依据发生冲突，或完成需求确需扩大范围时，才提出具体差异并暂停相关改动。
