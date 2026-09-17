# Journal 文章 CLI 使用指南

本指南对应 Journal 自动化文章写入 API 与单文件 CLI。CLI 只读取 JSON、发送一次 HTTP 请求并输出结果，Markdown 转换和文章保存全部在 Journal 服务端完成。

## 启用顺序

1. 服务端先准备 `JOURNAL_ARTICLE_TOKEN`，并让新版本 API 随项目既有发布流程上线。
2. 本地让文章 CLI 可执行，并配置 `JOURNAL_API_URL`、`JOURNAL_ARTICLE_TOKEN` 两个环境变量。
3. 最后把下方“模型长期工作约定”合并到实际生效的 harness 指令，并开启新会话使用。

代码完成不等于自动发布已经启用，上述三步都完成后日常路径才成立。

## 服务端配置

Journal 服务通过 `/opt/journal/.env` 注入环境变量。新增配置项：

```dotenv
JOURNAL_ARTICLE_TOKEN=replace-with-a-generated-article-token
```

要求至少 32 个字符，服务端和本地模型环境必须使用同一个值。该 token 只用于 `POST /api/automation/articles`，不能使用管理员 Cookie、Telegram ingest token 或其它服务凭据替代。

接口成功时返回 HTTP 201，响应包含 `id`、`publicId`、`title`、`visibility`、`editorUrl`、`readerUrl`。`visibility` 省略时默认为 `public`，显式传 `private` 时仅登录后的私人界面可见。网页创建和知识助手转文章仍保持原有的私有行为。

## 本地 CLI

源码中的真实入口是仓库内的 `scripts/journal-article.mjs`。文件带有 Node shebang，可直接执行，也可以使用 `node <绝对路径>` 执行：

```bash
node /absolute/path/to/NotiNewsForXiaoming/scripts/journal-article.mjs --help
```

如果希望日常使用短命令 `journal-article`，需要由使用者把它链接或复制到已有 PATH 目录，或者直接在长期指令中写绝对路径。文档不假设该命令已经全局存在。

Node 目标版本与项目一致为 Node 24。CLI 只使用 Node 标准库和内置 `fetch`，从任意工作目录执行都不依赖仓库的包管理器、TypeScript loader、`.env` 或 `node_modules`。

客户端环境变量：

- `JOURNAL_API_URL`：必填，站点 HTTPS 根地址，例如 `https://feeds.xmcloud.buzz`。不要写接口完整地址；不能包含用户名、密码、query、fragment 或额外路径。
- `JOURNAL_ARTICLE_TOKEN`：必填，与服务端 `JOURNAL_ARTICLE_TOKEN` 一致。

CLI 不自动读取当前目录的 `.env`，也不回退到其它 token 或 Cookie。请在模型宿主启动时继承这两个变量。

### 命令语法

```bash
journal-article create --input <JSON文件路径>
journal-article create --input -
journal-article --help
```

`--input -` 表示从标准输入读取 UTF-8 JSON。`create` 是首版唯一子命令；未知参数和多余位置参数会直接报错并以非零退出码结束。CLI 不在本地校验业务字段，完整校验交给服务端。

### 输入格式

输入文件或标准输入必须是一个 JSON 对象，字段与接口一致：

```json
{
  "title": "一次部署差异的排查复盘",
  "markdown": "## 背景\n\n描述现象与使用场景。\n\n## 处理过程\n\n1. 对照实际产物。\n2. 根据证据定位原因。\n\n## 可复用经验\n\n区分源码声明和线上实际行为。",
  "tags": ["工程实践", "问题排查"],
  "visibility": "public",
  "aiGenerated": true
}
```

字段约定：

- `title`：必填，1–120 字符。
- `markdown`：必填，正文从二级标题或段落开始；是否为空按去除首尾空白后的内容判断，但实际存储不会 trim 正文，以免破坏代码缩进。
- `tags`：必填，可为空数组；最多 20 个，单个标签 1–32 字符。
- `visibility`：可选，仅 `private` 或 `public`；省略或为 `undefined` 时默认 `public`，显式 `null` 属于错误。
- `aiGenerated`：必填布尔值，模型生成或实质改写时传 `true`。

正文首版支持段落、二至三级标题、粗体、斜体、删除线、引用、有序与无序列表、代码块、行内代码、链接和分隔线。代码块会保留正文、换行、缩进和可识别的 `language-*` 语言信息。模型生成链接时必须使用可按现有绝对 URL 规则接受的 `http`、`https` 或 `mailto` 地址。

暂不支持图片、表格、任务复选框、原始 HTML、封面和附件上传。Markdown 转换前会在 token 层检查这些结构，发现后直接返回错误，不会静默保存一部分内容。代码块或行内代码中的图片语法、HTML 字面量和竖线不会被误判为不支持结构。

## CLI 输出与错误

成功时标准输出只输出一行完整的结果 JSON，退出码为 0：

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

`--help` 是唯一不输出 JSON 的正常输出。其它错误只写标准错误并返回非零退出码：

- HTTP 400：请求 JSON、schema、正文为空、链接错误或不支持结构。
- HTTP 401：没有或错误的文章 token。
- HTTP 413：请求体或转换后的富文本超出限制。
- HTTP 415：不支持的 Content-Type。
- HTTP 500：服务端未预期错误。
- 网络中断、30 秒超时、HTTP 500 或 HTTP 201 但响应不完整时，错误说明会提示“写入结果可能不确定”。此时不要自动再创建一篇，也不要宣称已经发布。

CLI 只发送一次 POST，不自动重试，不跟随重定向，不记录 headers 或 token，也不会把 token 放进 shell 参数。失败时保留服务端返回的状态码和错误文本。

## 模型长期工作约定

把下面片段合并到实际生效的 harness 长期指令中，并把 CLI 路径替换成启用后的真实路径。Codex 的全局指令默认位于 Codex home 的 `AGENTS.md`；若存在非空 `AGENTS.override.md`，优先使用后者。更新后由新会话读取，不要覆盖整个文件。

> 当我要求整理成文章、沉淀经验、形成复盘报告，或表达同等的独立成文意图时，将最终正文整理为标题、标签和 Markdown，通过 Journal CLI 创建文章，默认 public、aiGenerated=true，不需要我再说一次发布。正文首版仅使用段落、标题、列表、引用、代码和链接，不使用图片、表格、任务复选框或原始 HTML。先完成最终内容，再发送一次。只总结材料中有依据的经验，不把未实施的方案写成已完成事实。普通问答、代码交付说明、实现计划和对方案的讨论不自动发表。当前明确要求不要发布、先预览、只保存本地时不调用；明确要求私有保存时传 private。只有工具成功后才能说已发布并返回真实 readerUrl。失败说明错误，结果未知时不自动再建一篇。工具凭据由环境提供，不读取、打印或写入正文。

这是模型的行为约定，不是后台关键词匹配。其它 harness 把相同片段放在其支持的长期指令位置，并提供相同 CLI 路径和环境变量即可。
