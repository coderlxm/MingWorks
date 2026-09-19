# Journal AI 文章发布：工作电脑使用与验收说明

适用版本：`892f660`，2026-09-17。

服务地址：https://feeds.xmcloud.buzz

该版本的 GitHub Actions 构建和部署已成功。下文区分已经实现的功能与需要你在工作电脑完成的使用确认。本文中的发布操作会真实创建文章，不是预览模式。

## 一、包含哪些功能

| 功能 | 当前行为 |
| --- | --- |
| 创建文章 | 把标题、Markdown 正文、标签一次写入 Journal |
| 默认公开 | 省略 visibility 时为 public，保存成功即公开 |
| 私有保存 | 显式传 private，仅本人登录后可读 |
| 自动排版 | Markdown 转成现有文章编辑器使用的富文本 |
| 支持格式 | 段落、标题、粗体、斜体、删除线、引用、普通列表、代码块、行内代码、链接、分隔线 |
| 标题目录 | 使用现有标题锚点；h1 转 h2，h4–h6 转 h3 |
| AI 标记 | 通过 aiGenerated 表明是否由 AI 生成或实质改写 |
| 返回地址 | 返回真实文章 ID、阅读地址、编辑地址和可见性 |
| 跨电脑使用 | CLI 是独立 .mjs 文件，不依赖仓库 node_modules |
| 输入方式 | UTF-8 JSON 文件，或标准输入 |
| 编辑已发布文章 | 在现有网页编辑器继续修改 |

首版没有：图片、封面、表格、任务复选框、原始 HTML、附件上传、Word/PDF 直接导入、CLI 更新/删除、按标题覆盖、重复内容去重、MCP、定时扫描、自动重试。

正文中的图片和表格会被拒绝，不会静默删除后继续发布。代码块和行内代码中的 HTML、图片语法等作为代码保留。仅支持 http、https、mailto 的绝对链接，不使用相对链接。

“自动发布”依靠模型的长期工作指令触发，CLI 本身不会监听聊天或自动发现文档。

## 二、工作电脑需要准备什么

1. 安装 Node.js 24，并让终端能够使用 node。无需安装项目依赖、数据库、Docker 或运行本地网站。
2. 从可信的项目仓库获取 `scripts/journal-article.mjs`，版本使用 `892f660` 或之后的版本。可从已更新的本地仓库直接复制这个文件，也可在 GitHub 对应提交中下载原始文件；不要把网页 HTML 保存成 .mjs。
3. 把文件放在固定位置，例如 macOS/Linux 的 `/Users/你的用户名/Tools/journal-article.mjs` 或 Windows 的 `C:\Tools\journal-article.mjs`。后续调用使用真实绝对路径。
4. 准备服务端已经配置的文章专用 token，以及能访问站点的网络。

工作电脑无需复制整个仓库。使用 `node` 加文件路径调用也不要求脚本有 Unix 可执行权限。

### 取得文章 token

本次发布已在 Journal 服务器 `/opt/journal/.env` 中配置 `JOURNAL_ARTICLE_TOKEN`。通过你自己的服务器管理入口取得该项，使用个人密码管理器或可信的私密渠道转移到工作电脑。

只取文章 token，不要复制整份服务器 .env。不要使用 Telegram ingest token、机器人 token 或管理员登录密码代替。本文不包含真实凭据。

如果工作电脑不能访问服务器，可以先在有权限的个人电脑上取得这一项再转移；工作电脑日常发布只需要访问网站，不需要 SSH 权限。

## 三、配置环境

CLI 读取两项环境变量：

| 变量 | 值 |
| --- | --- |
| `JOURNAL_API_URL` | `https://feeds.xmcloud.buzz` |
| `JOURNAL_ARTICLE_TOKEN` | 上一步取得的文章专用 token |

站点地址必须是 HTTPS 根地址，不能追加 `/api/automation/articles`、其他路径、查询参数或片段。

CLI 不自动读取当前目录的 .env。环境变量需在调用 CLI 的终端中设置；模型要自动调用时，应从这个终端进入模型会话，让它继承环境。

### macOS 默认 zsh

以下设置仅作用于当前终端，token 通过不回显输入录入，不要把占位文本当成真实 token：

```zsh
export JOURNAL_API_URL='https://feeds.xmcloud.buzz'
read -rs 'JOURNAL_ARTICLE_TOKEN?请输入文章 token：'
export JOURNAL_ARTICLE_TOKEN
```

### Linux / Bash

```bash
export JOURNAL_API_URL='https://feeds.xmcloud.buzz'
read -r -s -p '请输入文章 token：' JOURNAL_ARTICLE_TOKEN
export JOURNAL_ARTICLE_TOKEN
```

### Windows PowerShell

```powershell
$env:JOURNAL_API_URL = 'https://feeds.xmcloud.buzz'
$journalArticleSecret = Read-Host '请输入文章 token' -AsSecureString
$env:JOURNAL_ARTICLE_TOKEN = [System.Net.NetworkCredential]::new('', $journalArticleSecret).Password
Remove-Variable journalArticleSecret
```

关闭终端后，以上临时配置不会保留。首次使用先采用这一方式；日常使用可把两项变量配置到你现有的模型启动环境或凭据管理方式中。不要把真实 token 写进项目文件、模型指令或提交到 Git。

已经打开的模型会话不会因为你在另一个终端设置变量而自动获得它们。使用当前已配置的终端进入新的会话。

## 四、先完成一次实际发布

建议选择一篇你本来就打算公开的短经验总结，避免为了验收制造无用文章。若先熟悉流程，可显式使用 private；确认后在网页将同一篇改为公开，不必再创建副本。

### 准备输入文件

用编辑器保存一个 UTF-8、无 BOM 的 JSON 文件，例如 `article.json`。下面是可替换正文的格式示例，不包含真实凭据：

```json
{
  "title": "工作经验总结：先记录事实，再形成结论",
  "markdown": "## 背景\n\n在整理一次工作复盘时，需要把事实和推断分开。\n\n## 做法\n\n1. 记录现象和实际操作。\n2. 为结论保留依据。\n3. 将待确认内容单独说明。\n\n## 可复用经验\n\n**先记录事实，再形成结论。**\n\n> 复盘应让后续读者理解结论来自哪里。",
  "tags": ["工作复盘", "经验总结"],
  "visibility": "public",
  "aiGenerated": true
}
```

字段要求：

- title：必填，去除首尾空白后 1–120 字符。
- markdown：必填，非空正文字符串。JSON 内换行表示为 `\n`，引号和反斜杠需要正确转义；可让模型直接生成文件。
- tags：必填数组，可为 `[]`；最多 20 个，每个 1–32 字符。
- visibility：可省略，默认 public；也可显式 private。不支持 protected。
- aiGenerated：必填布尔值，AI 整理时为 true，不能写成字符串 `"true"`。

不要增加 schema 之外的字段。正文一般从二级标题或段落开始，避免再重复一遍文章标题。请求体上限 1 MiB，转换后的富文本上限 512 KiB。

### 发布调用

macOS/Linux，替换成实际文件路径：

```sh
node "/Users/你的用户名/Tools/journal-article.mjs" create --input "/你的文件目录/article.json"
```

Windows PowerShell，替换成实际文件路径：

```powershell
node "C:\Tools\journal-article.mjs" create --input "C:\你的文件目录\article.json"
```

这些是实际发布命令。一次成功调用创建一篇新文章，重复调用会创建另一篇；同标题不会覆盖。输入也支持 `--input -` 读取标准输入，但第一次使用文件方式更容易查看最终正文。

### 成功后应看到什么

终端输出一行 JSON，含 `id`、`publicId`、`title`、`visibility`、`readerUrl`、`editorUrl`，退出码为 0。不要把示例地址当作实际文章地址，使用工具本次返回的地址。

打开 readerUrl 阅读，打开 editorUrl 继续编辑；编辑需要网页管理员登录，CLI token 不会使浏览器自动登录。刷新站点文章频道，应看到这篇公开文章。已打开的列表不会自动实时更新，需要刷新。

## 五、接入 Codex CLI 和其他 harness

只复制脚本和配置环境后，模型不一定知道何时调用。还需要把以下工作约定加入模型实际生效的长期指令。

Codex 使用其 home 下的全局指令文件，默认是 `~/.codex/AGENTS.md`；如果设置了自定义 Codex home，以实际目录为准。如果已有非空 `AGENTS.override.md`，该层优先读它，不能假设修改普通 AGENTS.md 会生效。合并时保留既有内容，不要整份覆盖；新会话读取新指令。这里沿用官方的全局指令机制，不需要新增 MCP。[官方说明](https://developers.openai.com/codex/guides/agents-md)

其他 harness 把相同约定放到它实际支持的全局/长期指令位置，并让它能执行本地命令、继承上述变量。只支持远程工具的客户端不在当前 CLI 首版范围内。

### 可复制的工作约定

先把下面的 `<CLI绝对路径>` 换成工作电脑上的真实路径：

> 当我要求“整理成文章”“沉淀经验”“形成复盘报告”或同等独立成文任务时，在整理完成后直接通过 Journal CLI 创建文章，默认公开，不需要我再说一次发布。调用形式是 `node "<CLI绝对路径>" create --input "<正文JSON文件路径>"`。凭据由 JOURNAL_API_URL 和 JOURNAL_ARTICLE_TOKEN 环境变量提供，不读取、打印或写入正文。
>
> 输入为 UTF-8 无 BOM JSON，包含 title、markdown、tags、visibility、aiGenerated。默认显式传 visibility=public、aiGenerated=true。正文只用段落、标题、普通列表、引用、代码和绝对链接，不使用图片、表格、任务复选框或原始 HTML。用文件编辑工具生成 JSON，不将正文拼进 shell 命令。
>
> 先完成最终内容，再调用一次。区分事实、推断与未实施方案。普通问答、代码交付说明、实现计划及对方案的讨论不自动发布。当前明确说“不要发布”“先给我看”“只保存本地”时不调用；明确说“私有保存”时传 private。
>
> 成功后返回真实 readerUrl，并说明公开或私有状态。失败如实报告，不能声称发布完成。网络中断、超时或响应异常时，即使工具没有提醒，也先把结果视为可能不确定，不自动重复创建；先到网站确认是否已有文章。修改已发布文章使用现有编辑器，不能再建同标题文章冒充更新。

宿主本身的工具执行权限仍然适用，工作约定不绕过权限限制。如果模型报告无法执行命令或无法联网，应处理该宿主的具体配置，不能理解成服务器已发布失败。

## 六、实际验收内容

优先用一篇真实文章覆盖主路径。其余项目可在日常使用中确认，不需要批量创建验收数据。

| 场景 | 操作或表达 | 预期结果 |
| --- | --- | --- |
| 默认公开 | 发布输入省略 visibility | 响应为 public；未登录浏览器可读 |
| 明确私有 | 输入 visibility=private | 本人登录后可读；未登录窗口不可读，公开列表不出现 |
| 基本排版 | 正文含标题、段落、列表、引用、粗体、链接 | 页面结构与正文一致，链接可打开 |
| 代码块 | 文章包含需要保留缩进的代码 | 代码换行与缩进正常，HTML 字面量不会被当页面标签；保留语言信息不等于一定有语法高亮 |
| 继续编辑 | 打开返回的 editorUrl | 登录后进入同一篇文章，可继续修改 |
| 自动调用 | 对模型说“把刚才解决的问题沉淀成一篇经验文章” | 模型完成正文后调用 CLI，返回公开阅读链接 |
| 复盘触发 | 对模型说“把这次处理过程整理成复盘报告” | 按成文意图发布，不要求额外说“保存到网站” |
| 暂不发布 | 对模型说“先整理一版给我看，不要发布” | 只提供内容，不调用创建接口 |
| 跨项目 | 在另一个项目目录进行成文任务 | 模型仍可通过绝对 CLI 路径调用，不依赖该项目的 node_modules 或 .env |
| 不支持的格式 | 提交包含真实 Markdown 图片、表格或任务复选框的正文 | 返回明确错误，本次不创建文章 |

公开与私有访问请分别用已登录窗口和未登录/无痕窗口观察，避免管理员身份掩盖可见性差异。需要清理文章时，在现有网页管理界面处理，CLI 不提供删除功能。

## 七、遇到问题如何判断

| 现象 | 处理方向 |
| --- | --- |
| 找不到 node | 安装 Node.js 24 并使终端可使用；之后从该环境进入模型会话 |
| 找不到脚本或输入文件 | 使用真实绝对路径；路径含空格时保留引号 |
| 缺少环境变量 | 在实际执行 CLI 的终端/模型启动环境配置，而不是另一个终端 |
| JSON 无法解析 | 查看文件是否为 UTF-8 无 BOM、是否正确转义；不要把 Markdown 直接当 JSON 传入 |
| HTTP 401 | 文章 token 缺失或不一致；网站登录不能代替 token |
| HTTP 400 | 根据服务端信息调整字段或不支持的 Markdown；不是通过重复提交解决 |
| HTTP 413 | 缩短正文或拆成独立文章，不能只看原文件大小判断富文本大小 |
| HTTP 404 | 核对站点地址和目标服务是否为已部署版本 |
| 超时、网络中断、HTTP 5xx、成功响应不完整 | 结果可能不确定，先到网站查看是否已创建，不自动重发 |
| 返回成功但列表没有文章 | 看实际 visibility，并刷新正确的文章频道；先打开 readerUrl，勿直接重发 |
| 模型只生成文档不调用 | 查看当前会话是否读到了工作约定、是否有执行权限，以及是否属于暂不发布的意图 |

已知 P2：当前 CLI 在收到响应头后、读取响应正文时断线，可能只显示网络错误，没有附带“写入结果可能不确定”提示。因此，只要请求已经发出而没有拿到完整成功结果，都不能凭错误提示认定文章一定没写入。

## 八、向我反馈时提供什么

提供操作系统、使用的 harness、当时的自然语言要求、CLI 的完整错误文本或成功结果中的文章 ID/链接，以及页面与预期不符的具体位置。如果是排版问题，可附最小正文片段或页面截图。

不要附真实 token、Authorization 头或整份环境配置。我会根据这些信息定位问题；本文仅新增使用说明，没有在工作电脑安装工具、改动全局指令或创建文章。
