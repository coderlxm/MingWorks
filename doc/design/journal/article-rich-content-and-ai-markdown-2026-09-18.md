# Journal 文章与 AI 富内容完整能力方案

日期：2026-09-18  
阶段：设计，供 DeepSeek 后续实施。本文不是已实现说明，也不授权自动提交或部署。

## 1. 结论与目标

**保留 Tiptap 3，重构内容转换和展示链路，不更换编辑器。** 当前不足主要来自项目只启用了少量节点，以及协议、转换器、清洗规则和图片归属规则没有贯通，并非 Tiptap 无法编辑表格或图文内容。

本轮目标是把以下路径做完整：

1. 手写文章：富文本编辑，插入图片、表格、代码和任务列表，保存后继续编辑，公开或私密阅读。
2. Markdown 写作：导入、粘贴、编辑源码、预览、导出；常用 Markdown 不再需要人工改成分条描述。
3. AI 回答：流式展示 Markdown、表格和图文；保存为文章后保留结构，可以继续编辑。
4. 自动发文：现有文章 API / CLI 与人工编辑、AI 保存使用相同转换规则，不出现“页面支持但自动发布拒绝”的割裂。
5. 分发与检索：正文阅读、目录、摘要、RSS、搜索和 AI 读取都认识新增内容。

这里的“完整”指上述主路径完整，不承诺支持所有 Markdown 方言或成为 Word、Notion 的全功能替代品。采用单用户个人工具设计，不引入协作服务、付费编辑器云、通用插件平台或额外内容数据库。

## 2. 当前源码事实与缺口

依据为本次读取的实际源码、依赖声明、锁文件、已安装包及官方公开资料；没有引用历史 `doc/` 文档。当前 Git 基线为 `a713935`，实施时应先对照实际源码差异，不机械套用本文路径或历史实现。

| 位置 | 当前行为 | 必须补齐的内容 |
| --- | --- | --- |
| `src/shared/journalRichText.ts` | Tiptap StarterKit、图片、标题 UniqueID；只启用 H2/H3，关闭下划线 | 表格、任务列表、更多标题、常用 marks；统一所有消费者的节点定义 |
| `src/shared/journalProtocol.ts` | rich node/mark 枚举不含表格、任务列表等 | 同步 JSON 协议、节点属性与结构约束 |
| `RichTextEditor.vue` | 基础工具栏；图片选择、粘贴、拖入只处理第一张；首次保存前不能上传 | 完整编辑操作、多图顺序、上传位置、新文章图片路径 |
| `src/journal-server/articleMarkdown.ts` | 自动发文明确拒绝表格、图片、任务列表、HTML；转换白名单很窄，标题降级 | 拆掉业务限制，建立不会静默删结构的转换规则 |
| `web/src/utils/aiMarkdown.ts` | Marked 开启 GFM，但图片只输出替代文字；自行处理部分转义和 URL | 正式支持图片，采用成熟清洗库，统一语法语义 |
| `knowledgeAgentService.ts` | 已复用 `articleMarkdown.ts` 保存 AI 回答；读取工具主要得到纯文本 | 保留格式转换，增加受控图片引用数据，不改变模型职责 |
| `richText.ts` | 图片只能为 `/media/:id` 且带对应资产 ID；文章 HTML 白名单不含表格 | 图片分类、结构校验、纯文本提取、RSS HTML 同步扩展 |
| `articleService.ts` | 创建不接受图片；更新要求图片属于当前文章，并删除未引用 inline 资产 | 新文章图片、跨文章复制、删除与撤销不能互相破坏 |
| `repository.ts` | 文章编辑/更新只接受 `publication_status='published'`；现有草稿方法主要面向 plain 记录 | 若加入富文本草稿，不能直接套用 plain 草稿查询 |
| `RichArticleRenderer.vue` | 使用只读 Tiptap Editor；各展示区排版样式分散 | 保持只读方式，补齐节点和统一样式，无需同时更换渲染引擎 |
| `articleHeadings.ts`、目录组件 | 目录只接受 H2/H3 | 支持 H1–H6 与旧 anchorId，深层标题合理缩进 |
| `routes/automationArticles.ts`、`scripts/journal-article.mjs` | JSON Markdown 单请求创建文章，默认 public，严格字段协议 | 保持旧请求兼容，支持图片输入，不扩大令牌为通用管理权限 |

本地 Tiptap 核心、图片、StarterKit 等版本为 **3.30.2**，Marked 为 **18.0.10**，sanitize-html 为 **2.17.7**。`@tiptap/extension-list` 作为 StarterKit 间接依赖存在，但不是根目录可直接导入的已声明依赖；表格、DOMPurify、Turndown、Tiptap Markdown 尚未作为当前直接依赖接入。

## 3. 能力范围和交付边界

### 3.1 本轮必须完整交付

| 能力 | 写作端 | AI / 阅读端 | Markdown 与保存要求 |
| --- | --- | --- | --- |
| 基础排版 | H1–H6、段落、粗体、斜体、删除线、下划线、单色高亮、上下标 | 统一排版 | 标准语法保留；非 GFM marks 用受控 HTML 表达 |
| 列表与引用 | 有序/无序、嵌套、任务勾选、引用、分隔线、硬换行 | 勾选状态可见，阅读端不可改状态 | GFM 任务列表来回转换不丢 checked |
| 链接 | 插入、修改、移除，支持文章锚点 | 外链安全打开，站内锚点定位 | 支持 http/https/mailto、合法站内相对链接、锚点 |
| 图片 | 本地选择、截图粘贴、拖入、多图、图片 URL、替代文字、图注、尺寸、对齐 | 图文块混排、原比例展示、放大阅读 | 站内资产与外链有明确区别；来源权限不被绕过 |
| 表格 | 插入、行列增删、表头、合并/拆分、列宽、单元格对齐 | 移动端横向滚动，不挤爆页面 | 普通 GFM 表格直接支持，复杂结构不强行压成管道表格 |
| 代码 | 行内代码、代码块、语言、语法高亮、复制 | 代码原文可复制，长行局部滚动 | 语言、空格、换行、反引号原样保存 |
| Markdown | 导入 `.md`、粘贴为 Markdown、源码编辑、预览、导出 | 流式和最终结果语义一致 | 有明确保真约定，不声称字节级往返一致 |
| 内容延续 | 撤销重做、离开未保存提示、编辑/预览切换保留草稿 | 保存 AI 回答后继续编辑 | 不用请求返回覆盖当前正在输入的正文 |

图片“图文混排”按文章块流处理：文字、图片、图注、表格可以任意穿插；保留段落中图片前后的文字，导入时可拆成前段落、图片块、后段落。本轮不做 Word 式文字绕图、自由画布和多栏拖拽布局。

### 3.2 扩展路线，不作为本轮核心完成的替代品

公式、Mermaid、脚注、提示块/折叠块属于下一批明确扩展点，见第 13 节。不得因为完成其中一项而留下表格、图片保存或 CLI 导入的半成品。

本轮不实现视频/音频内嵌、任意 iframe、脚本执行、DOCX/PDF 双向排版转换、多人协作、OCR、图片生成或多模态模型。上传附件与在正文中插入图片不是同一个能力。

## 4. 编辑器和库的选择

### 4.1 为什么保留 Tiptap

Tiptap 的 TableKit 提供 table、row、cell、header，Table 支持行列操作、合并拆分和列宽；Image 已有尺寸属性和缩放能力。当前安装的 Image 源码也包含 `width`、`height` 和 `resize` 配置，属于可以直接扩展的基础，而不是需要重新开发一个编辑器。[TableKit 官方说明](https://tiptap.dev/docs/editor/extensions/functionality/table-kit)、[Table 官方命令](https://tiptap.dev/docs/editor/extensions/nodes/table)、[Image 官方说明](https://tiptap.dev/docs/editor/extensions/nodes/image)。

更换编辑器反而需要迁移现有 Tiptap JSON、图片资产属性、标题锚点、服务端 HTML 转换和所有阅读入口，当前没有这种必要。允许的较大重构用于统一内容链路、草稿图片和转换保真，不用于换框架。

### 4.2 推荐依赖

| 依赖 | 用途与接入方式 |
| --- | --- |
| 现有 Tiptap 3.30.2 系列 | 保留；新增扩展必须与 core/pm 的 peer 版本一致，不混用不同 minor 的包 |
| `@tiptap/extension-table` | 新增直接依赖，采用命名导出 `TableKit`；公开 3.30.2 包声明要求 core/pm 3.30.2 |
| `@tiptap/extension-list` | 新增直接依赖，使用 `TaskList`、`TaskItem`；不再额外注册 StarterKit 已含的普通列表 |
| `@tiptap/extension-highlight`、`extension-subscript`、`extension-superscript`、`extension-text-align` | 对应明确的写作功能；下划线直接启用 StarterKit 的现有选项 |
| `@tiptap/extension-code-block-lowlight`、`lowlight` | 替换 StarterKit 的 codeBlock 扩展，节点名仍为 `codeBlock`；配置时关闭原 codeBlock，避免重复注册 |
| 现有 `marked` | 继续负责 Markdown 词法/解析，不手写 Markdown 解析器 |
| 现有 `sanitize-html`、`cheerio` | 服务端 HTML 清洗与结构适配 |
| `dompurify` | 浏览器 Markdown/HTML 展示清洗，移除当前零散手写转义主路径 |
| `turndown`、`turndown-plugin-gfm` | HTML → Markdown 导出；少量项目节点适配规则，不自研序列化器 |
| 现有 FileHandler、Image、UniqueID、PhotoSwipe、上传接口 | 继续复用；FileHandler 是文件事件入口，不是上传服务 |

本次公开包元数据查询到 DOMPurify 3.4.15、Turndown 7.2.4、turndown-plugin-gfm 1.0.2、lowlight 3.3.0；这些是设计调研时的可选版本，不表示已经安装。实施时读取实际包 exports、types、peerDependencies 和锁文件，使用匹配版本；需要导入的包必须是直接依赖，不能依赖偶然提升。

Lowlight 当前公开 API 使用 `createLowlight`，不要照抄部分文档中的旧 `lowlight/lib/core` 导入。代码高亮转换为 HTML 时使用成熟的 HAST 序列化工具并显式声明依赖，不手工拼接未转义代码。[Lowlight 官方仓库](https://github.com/wooorm/lowlight)、[CodeBlockLowlight 官方说明](https://tiptap.dev/docs/editor/extensions/nodes/code-block-lowlight)。

### 4.3 不把 `@tiptap/markdown` Beta 作为本轮主链路

官方 Markdown 扩展提供双向转换，但当前文档仍标记 Beta，并明确说明 Markdown 表格不能完整表示复杂单元格。已有 Marked + HTML 转换可以继续使用，本轮选成熟链路配合 Turndown，不增加另一套 Markdown 引擎。若后续决定改用官方扩展，必须把全部转换入口整体切换，不能各入口各用一套。[Tiptap Markdown 状态与限制](https://tiptap.dev/docs/editor/markdown)、[Turndown](https://github.com/mixmark-io/turndown)、[GFM 插件](https://github.com/mixmark-io/turndown-plugin-gfm)。

## 5. 数据模型：一份正文，不做双主存储

### 5.1 保持现有事实来源

- 文章唯一可编辑正文仍为 `rich_body_json` / `richBody`，使用 Tiptap JSON。
- `content_text` 是派生的检索与摘要文本，不用它还原富文本。
- HTML 是展示/分发产物，Markdown 是输入输出格式；不另存一份需要同步维护的文章 Markdown 正文。
- AI 消息继续存原始 Markdown。流式期间只更新消息文本，不反复写文章 JSON。
- 不批量重写旧文章，不为了新增节点重置旧标题锚点。

```text
编辑器 JSON ───────────────────────────┐
Markdown / CLI / AI 完整回答 → 统一转换 ├→ 结构与资产校验 → richBody
本地图片 → 现有资产服务 → 引用解析 ────┘                    │
                                        ┌─────────────────┼──────────────┐
                                     编辑/阅读         RSS HTML      content_text
                                        │
                                  Markdown 导出

AI 增量 Markdown → 浏览器安全渲染（不逐片转换成文章）
```

### 5.2 节点和属性契约

扩展 `journalRichNodeSchema`、mark schema 和实际 Tiptap schema，三者同时完成：

- 新节点：`table`、`tableRow`、`tableHeader`、`tableCell`、`taskList`、`taskItem`。
- 新 marks：`underline`、`highlight`、`subscript`、`superscript`；高亮先使用固定主题色，不增加任意 CSS。
- 标题：`level` 为 1–6，保留 `anchorId` 规则与 UniqueID；首次导入生成 ID，旧文更新沿用 ID。
- 任务项：`checked` 为布尔值，子内容为合法块，不把原生 checkbox 任意写进文档。
- 表格：限制为合法行/单元格树；保留 `colspan`、`rowspan`、`colwidth`；跨度和宽度为有限正值；单元格支持文字、段落与允许的块。对齐仅 left/center/right。
- 图片：保留节点名 `image` 和原来的 `data-asset-id`；增加 `caption`、`width`、`height`、`align`，`alt`、`title` 继续保留。图注为纯文本属性，不能混入可执行 HTML。
- 代码：仍为 `codeBlock`，保存 `language`，高亮装饰不进入 JSON。

Zod 枚举通过不代表文档结构有效。服务端必须使用共享 Tiptap schema 的结构能力检查节点层次，不能让不认识的节点在转换中被自动忽略。原有 512 KB 正文 JSON 限额暂不扩大；超限明确报错，图片二进制不放入正文。

## 6. 统一 Markdown、HTML 与 JSON 转换

### 6.1 共享语义，分开运行环境

新增小型 `src/shared/journalContentPolicy.ts`，只放可支持的语法、标签/属性策略、图片 URL 分类、语言与对齐枚举等纯配置。不要把 DOMPurify、浏览器 DOM、Node 文件系统或服务端 HTML 库混放进共享文件。

继续以 `articleMarkdown.ts` 为服务端入口，明确拆出：

- 完整输入内容检查：发现不支持的结构或危险输入时返回具体原因与位置。
- Marked 解析和受控结构适配。
- sanitize-html 清洗。
- Tiptap `generateJSON`、标题 ID 规范化和结构检查。
- 图片解析由文章服务提供上下文：新上传文件、当前文章资产、允许复制的 AI 来源资产。

浏览器复用相同 Marked 配置和语义，采用 DOMPurify 做最终 HTML 清洗。不要直接把服务端 `sanitize-html` 整包搬入浏览器，也不要认为 Marked 会自动处理 XSS；官方明确要求在使用场景中自行清洗输出。[Marked 安全说明](https://marked.js.org/)、[DOMPurify 官方仓库](https://github.com/cure53/DOMPurify)、[sanitize-html 官方仓库](https://github.com/apostrophecms/sanitize-html)。

### 6.2 必须显式处理的格式转换

1. GFM 表格 → Tiptap table 树；保留对齐。不能只在 sanitizer 放开 `<table>` 就认为已经完成。
2. GFM 任务列表 → `ul[data-type=taskList]` / `li[data-type=taskItem][data-checked]` 对应的 Tiptap 语义。Marked 的默认 disabled checkbox HTML 不等同于 Tiptap taskItem，必须有适配。
3. 图片与同段文字：使用解析后的 token / DOM 结构切分，保留前后文字与 marks；禁止用正则截取整段 Markdown。
4. 图注图片：`image.caption` 序列化为受控 `figure/img/figcaption`；parseHTML 能读回，普通 `<img>` 仍对应旧图片节点。保留 `data-asset-id` 与尺寸。
5. 代码块：保留语言；清洗只接受约定的语言 class，不接受任意 class/style。高亮 HTML 和复制按钮只是展示层。
6. 链接：使用同一 URL 分类策略，锚点及站内相对链接不能再被 `new URL(href)` 的绝对地址要求一律拒绝；拒绝 javascript/data/file 等执行或本地协议。
7. 标题：保留原始 H1–H6 层级，不再把 H4–H6 全压成 H3。AI 保存已有“去掉与文章标题重复的首标题”规则可以保留，但仅处理明确匹配的首标题。
8. `breaks: true` 保留当前行为，并作为本站 Markdown 规则说明；软换行不以未经确认的 CommonMark 默认行为替换。

### 6.3 Markdown 源码和导出的保真规则

源码编辑是显式的工作区，不是另一个数据库字段：点击进入时从当前 JSON 生成文本；点击应用才解析并替换 JSON；取消回到原来的 JSON。一次应用对应一次可撤销编辑动作，预览不触发保存。

导出分两种用途：

- **本站保真 Markdown（源码模式默认）**：常规内容使用 Markdown；合并单元格、多段落单元格、图注/图片尺寸、下划线/高亮等使用约定的安全 HTML。已有标题用携带 `data-anchorid` 的受控标题 HTML 保留锚点，新输入 Markdown 标题生成新 ID。保留的 HTML 节点及属性都必须可以再导入。
- **纯 GFM 导出**：仅在当前文档可无损表达时允许。若含合并单元格、图片排版属性等，列出不能表达的内容并停止导出，用户可以选择本站保真格式；禁止默认丢弃这些属性。

这是两个明确的输出产品规则，不是转换失败后的自动降级。Turndown 的普通转换可能忽略项目自定义属性，必须给项目节点添加专用规则；不能以一次序列化成功推断无损。本站保真格式不承诺所有第三方平台都保留其 HTML。

普通粘贴维持浏览器 HTML 富文本体验；另提供“粘贴为 Markdown”和 `.md` 导入，避免把每次普通文本粘贴猜测成 Markdown。导入覆盖已有正文前明确确认；解析有问题保持原正文与待导入文本，展示错误，不截断保存。

### 6.4 内容安全不是静默删内容

完整文章导入/保存时，先识别不支持的元素，明确拒绝并指出位置，再做清洗；不能先删掉表格、图片、任务项后返回成功。粘贴网页的无关样式可以按明确的格式清理规则移除，但脚本、iframe、事件属性等内容应提示并拒绝应用该次导入。

允许的 HTML 子集与上述节点一一对应；不要允许任意 style、任意 class、任意 data-*、SVG 或脚本。表格对齐/尺寸、图注、任务属性、标题锚点只放开精确名单。流式未闭合语法按当前文本展示，不视为完整文章保存成功；最终解析错误应可见。

## 7. 图片：从展示做到可保存、可发布

### 7.1 两类持久化图片

1. **站内管理图片**：`src=/media/:id`，`data-asset-id` 必须匹配；属于当前文章的 inline 资产。保留现有上传、预览、尺寸提取和访问控制。
2. **HTTPS 外链图片**：`src` 为完整 HTTPS URL，资产 ID 为 null；显式标为外链。支持直接展示和导入，不声称本站永久托管。用户可以自行上传本地副本替换；本轮不增加服务器任意 URL 下载/代理接口。

拒绝 `file:`、持久化 `blob:`、正文 base64、协议相对 URL、非 HTTPS 外链图片。上传预览的临时 object URL 只存在于当前浏览器操作中，不进入最终 JSON。外链访问可能带来第三方请求，应使用 `referrerpolicy=no-referrer`；AI 输出外链默认先显示“加载外链图片”入口，用户点击后加载，站内合法图片可直接显示。

外链是有意支持的一类图片，不是站内上传失败时的替代方案；站内上传出错直接报告，不能改成外链或删掉图片继续保存。

### 7.2 新文章首次插图

把“必须先写正文保存，才能插图”改成明确的富文本草稿流程：

- 用户第一次明确执行上传/保存草稿时，创建 `body_format=rich`、`content_type=article`、`publication_status=draft`、`visibility=private` 的文章草稿，允许空正文；尚未填写标题时显示业务上的“未命名文章”。不在仅打开编辑器时自动产生空文章。
- 复用现有 `draft/published` 状态，不增加另一套文章状态机。草稿有正常编辑 URL，用户能从文章草稿入口找到并删除，不能成为隐藏记录。
- 同步改造文章 get/update/upload/delete 所需的仓储过滤，允许站主操作 rich draft；不能直接套用只支持 plain draft 的方法。
- 第一次正式“保存文章”要求合法标题和非空内容，转换为 published + private；公开仍由独立可见性操作决定。`published` 表示内容完成，不等于 public。
- `/media` 的资产查询要能让站主读取 rich draft 图片；未登录者和 RSS、公开详情、AI 检索不能因放开编辑查询而看到草稿。
- 不要仅创建草稿 API，却漏掉列表恢复、删除、首次转正式文章和离开后继续写作。

如果实施希望缩减本项，应先让用户决定是否保留首次保存限制，不能偷偷保留限制并声称图文写作已完整。

### 7.3 上传、位置与资产删除

- 多文件按用户选择顺序插入，复用当前图片 MIME 范围与每文件 20 MB 限制。图片计数/总量约束在对应接口明确执行，不把已有常量误当成所有文章接口已执行的规则。
- 开始上传时记录编辑器实例、文章 ID 和 ProseMirror 位置映射；上传期间继续输入，完成后仍落在原插入位置。文档/页面已切换时不向新文章插图。
- 拖拽、粘贴与文件选择进入同一上传流程；失败显示在对应操作，不自动重试或改发其他通道。
- 可见的待上传标记是编辑器 decoration，不进入持久化 JSON；最后保存等待当前明确发起的上传完成，不能保存假 URL。
- 图片宽高使用已有 Image 缩放能力，保持比例；对齐由受控属性和样式完成。若加图注 NodeView，要与 resize 组合，不得覆盖掉原有缩放却留着失效按钮。
- 删除正文图片不立即物理删除文件。**改掉当前每次保存时删除所有未引用 inline 资产的行为**：未引用图片仍在该文章素材区；用户显式删除素材才移除资产，仍被正文引用时禁止删除。这样撤销、重新插入和上传后的编辑不会指向已删文件。
- 不加定时孤儿清理任务；文章删除沿用完整资产删除路径。用户真正删除素材后，旧撤销记录不得复活无效引用，应在该明确删除动作后重建相关编辑历史或要求先关闭编辑操作。

### 7.4 AI 图片引用和另存文章

当前 read_entries 只读 `content_text`，仅放开 Markdown 图片标签不会让模型知道有哪些真实图片。给读取结果增加小型 `images` 列表：来源 entryId、assetId、规范 `/media/:id`、alt/图注、尺寸；只返回该次允许读取记录中真实存在的图片，设定明确数量上限，不发送图片二进制，也不宣称模型识图。

模型提示词要求优先引用这些已返回图片，不编造 assetId。保存时根据消息已有来源记录核对图片归属；模型输出本身不是授权依据。

将来源文章 A 的站内图片保存到文章 B 时，不能直接复用 A 的资产 ID：

1. 核对来源属于允许引用的来源记录且文件存在。
2. 为新文章复制本站文件/预览并准备新的 inline 资产记录。
3. 生成旧 ID → 新 ID 映射，重写新文章 JSON 中的 src 和资产 ID。
4. 数据库事务内一起提交文章、资产关联、最终正文和 AI message.article_id；成功后才返回文章。
5. 保留现有重复保存返回同一篇文章的语义。异步文件准备引入竞争时，提交前重新读取关联；不能产生两篇文章。

文件操作不放入 SQLite 同步事务的 await 中。文件准备失败立即报错；数据库提交失败清理本次新准备的文件后继续向调用方报告原操作失败，不创建“成功但没图”的文章。这是失败操作的资源释放，不是另一路保存方案。

新文章是否公开只由新文章的权限决定，不修改来源文章。将私有来源图片复制到待公开文章，公开操作要明确显示包含复制图片；发布后不依赖来源会话 Cookie。AI 在聊天中引用的原来源图片如后来删除，应显示资源错误，不假装仍有永久副本。

## 8. 编辑器、阅读与流式 UI

### 8.1 编辑器组件职责

采用 Vue Composition API 和 `<script setup lang="ts">`；需要显式组件名时遵守本项目 name 属性写法。此次 Vue 技能用于确定数据流和组件职责，不引入额外组件框架。

| 组件/模块 | 单一职责与契约 |
| --- | --- |
| `ArticleEditorView.vue` | 文章路由、草稿加载、保存和可见性编排；不直接实现表格命令和 Markdown 解析 |
| `RichTextEditor.vue` | 唯一 Tiptap 实例，输入 richBody、disabled、图片服务，输出正文更新与操作错误 |
| 新增 `RichTextToolbar.vue` | 基础格式及插入入口，接收 editor 命令能力与选择状态 |
| 新增 `TableControls.vue` | 当前表格/单元格操作，非法操作禁用，命令委托 Tiptap |
| 新增 `ImageControls.vue` | 当前图片 alt、图注、对齐、尺寸与明确删除操作 |
| 新增 `MarkdownSourcePanel.vue` | 临时源码草稿、应用/取消和预览，不直接写数据库 |
| 新增 `MarkdownBody.vue` | AI 安全 Markdown 展示及代码复制、图片阅读；输入 content、streaming 和图片上下文 |
| `RichArticleRenderer.vue` | 只读富文本呈现，使用相同 schema 和主题，不绑定保存行为 |

工具栏按“正文格式 / 列表 / 插入 / 更多”分组；表格和图片被选中时显示对应局部操作，移动端使用可滚动工具条和明确菜单，不把几十个按钮铺满屏幕。

### 8.2 状态与交互主路径

- 页面框架常驻，加载、上传和保存只在对应区域反馈；切换预览不重新请求文章，也不销毁当前编辑器/撤销历史。
- 当前编辑文档是唯一正文状态；响应返回只更新资产、保存版本和文章信息，不用旧快照替换上传期间新输入的文字。
- 通过 editor transaction / update / selection 事件更新 UI；禁止每次内容变化整体 setContent，避免光标和输入法状态跳变。
- 路由切换、上传取消、组件卸载和源码取消都要归还对应操作状态。新一轮操作不能被旧 Promise 回写。
- 新增 watch 仅用于明确的外部实例同步且说明必要性，不用双向 watch 同步两份正文；不使用任何 RAF API。
- 链接移除应在 URL 格式判断前单独处理空输入，避免已有 prompt 的“清空链接却先报非法 URL”路径继续存在。

### 8.3 统一阅读样式

新增共享 `.journal-prose` 排版样式，编辑器内容、文章正文、Markdown 展示共用字号节奏、标题、列表、引用、代码、表格、图片和图注规则。保留各容器自己的宽度与背景，不把整个页面样式绑定到编辑器。

表格外层横向滚动、容器 `min-width: 0`，窄屏不压缩到不可读；代码只在块内滚动；图片遵循保存比例且最大不超过正文宽度；阅读端任务框只展示状态，不写回。代码复制失败可见，不能显示虚假的“已复制”。

目录扩展到 1–6 层，保留当前 anchorId/hash 协议和旧链接。未改标题的普通编辑不得重新生成 ID。源码里显式删除标题及其锚点时，原锚点失效属于用户删除内容的结果，而不是后台全量重建造成的结果。

### 8.4 流式 Markdown 的边界

- 保留 SSE、停止、completed/interrupted 和现有会话状态，不重做传输协议。
- 累积原始 Markdown；不能把每个 delta 单独解析后拼 HTML。
- 缺半个表格或代码围栏时展示当前解析结果，流式 UI 明示生成中；禁止手工补齐字符串后当作真实内容持久化。
- 只处理变化中的 round，已结束 round 使用缓存；不因一个 token 重算全部历史消息。需要合并频繁渲染时采用明确的短时间批量更新，结束/停止时冲刷最后文本；不引入人为逐字延迟或 RAF。
- 代码块在未完成阶段展示原文；高亮和昂贵增强在完整块/最终回答时进行，这是展示阶段规则，不是吞掉渲染错误。
- 图片必须在解析出完整 URL 且通过策略后才建立请求。已建立的图片节点尽量保持稳定，避免整段 innerHTML 替换导致每个 token 重建图片；可用稳定块组件配合成熟解析结果，但不要自研完整增量 Markdown 解析器。
- 保存只针对 completed 的最终回答。流式界面能显示表格，不代表服务端保存已经支持表格，两端必须同时交付。

## 9. API 与 CLI：同一能力，不同输入通道

### 9.1 既有接口保持兼容

- 现有文章 create/update 的 `richBody` 字段保留，只扩展受支持的节点和合法属性。
- 原 `POST /api/automation/articles` JSON 字段及默认 public 行为保持兼容；不要在本轮悄悄改变自动发布默认可见性。
- AI 保存仍通过原入口返回文章，转换与图片复制放进文章服务，不在路由中重复实现。
- 所有输入最终进入同一文档校验、资产归属和纯文本提取函数。

### 9.2 新增的最小接口

- 站主管理新增富文本草稿创建/列表以及草稿转正式文章动作，复用现有管理员鉴权；具体 URL 可沿文章路由，例如 `/api/me/articles/drafts`、`/api/me/articles/:id/complete`。这是方案新增接口，不是当前已有 API。
- 如浏览器不共享完整转换器，可增加仅站主可调用的内容转换端点，明确输入 Markdown、输出 richBody 与格式问题；不保存文章、不执行外部 URL 抓取。不能为每个流式片段调用它。
- 原 automation 创建端点增加 multipart 输入分支，JSON 旧分支保留。multipart 中一个 JSON payload，加按逻辑 key 标识的文件；复用当前 multipart 和图片处理库，不造上传协议。

### 9.3 CLI 本地图片约定

CLI 输入可增加客户端专属 `assets` 文件清单，例如：

```json
{
  "title": "部署复盘",
  "markdown": "## 拓扑\n\n![部署拓扑](asset:topology)",
  "tags": ["部署"],
  "visibility": "private",
  "aiGenerated": true,
  "assets": [{ "key": "topology", "path": "./images/topology.png" }]
}
```

`path` 只由 CLI 在本地读取，不发送给服务器让服务器读文件。相对路径以输入 JSON 文件所在目录解析；stdin 输入时必须给出明确的资源基目录或绝对路径。`asset:key` 是导入占位引用，只能在成功上传后解析成 `/media/:id`，不进入最终正文。

没有本地图片时沿用 JSON 请求；有文件时 CLI 构造 multipart。每个 key 必须唯一且能对应正文引用，缺文件/重复 key/不支持 MIME 在请求前明确报错。`.md` 中的相对图片路径由导入 UI 或 CLI 的清单明确绑定，服务端不自行猜测路径或抓取 URL。

图片创建先准备文件和文档，再在事务中提交文章、资产与重写后的正文；在完整成功前不对外发布。multipart 建议最多 10 个图片文件、每个不超过现有 20 MB、总请求不超过 40 MB，正文仍不超过 512 KB JSON；这些是新增入口的设计限额，需在路由实际生效，并与代理限制保持一致。采用顺序处理/落盘，避免同时把全部图片展开在内存中。

同步调整 CLI 与该上传路径的超时，使其适合用户上传量；不自动重发创建请求，网络结果不确定时明确报告不确定性。令牌只新增本次“创建带图片文章”权限，不开放删除任意文章、读取私密文章或通用文件读写。

## 10. 搜索、AI 上下文、RSS 与权限

- `content_text` 提取要包含表格各行各列的清晰分隔、任务文字/状态、图片 alt/图注和代码原文，不能把整张表拼成没有边界的一行。使用 Tiptap text serializer 的扩展点，不重新编写通用遍历解析器。
- 文章只含图片时，应按图片节点判定非空，不能只依赖站内 assetId 数组；否则合法外链图片文章仍会被当前逻辑拒绝。
- AI 阅读 rich 文章时可在文本之外返回选中段落对应的结构化 Markdown 或表格结构，明确分页单位与正文长度规则；图片元信息独立返回，不把图片转为未经模型看过的视觉结论。不要直接把所有整篇 JSON 塞进每次模型上下文。
- RSS 的 `generateArticleHtml` 同步保留表格、任务状态、图注与语言信息。站内图片/链接输出绝对地址，外链保持原地址；feed 不依赖客户端脚本、编辑器 NodeView 或 Vue CSS 才能表达基本语义。
- 私有、密码保护、public 权限沿用原规则；不能为了图片展示直接放开 `/media`。草稿媒体的站主读取与公开媒体读取必须明确区分。
- 更新纯文本规则只影响后续保存/新建文章；若要回填旧文章检索文本，属于单独确认的数据操作，不在本轮自动全库执行。

## 11. 文件级实施清单

| 文件/目录 | 必要工作 |
| --- | --- |
| `src/shared/journalProtocol.ts` | 扩展 node/mark/attrs 协议、草稿与 multipart payload 的契约；避免复制两套类型 |
| `src/shared/journalRichText.ts` | 统一扩展注册；图片属性、表格、任务、标题、marks；编辑/只读只区别交互选项，不区别 schema |
| 新增 `src/shared/journalContentPolicy.ts` | 无环境依赖的内容策略与枚举 |
| `src/journal-server/articleMarkdown.ts` | Markdown 导入、结构适配、导出，替换当前 blanket rejection 与标题压缩 |
| `src/journal-server/richText.ts` | 结构/URL/图片分类检查、plain text、RSS HTML |
| `articleService.ts`、`repository.ts`、`storage.ts` | 富文本草稿、图片文件准备/复制、事务关联；移除保存即删除未引用素材的副作用 |
| `routes/articles.ts`、`routes/automationArticles.ts` | 原接口扩展、草稿入口、multipart 和明确错误 |
| `routes/media.ts` 及资产访问查询 | 站主草稿图片读取；原公开/保护/私有边界不变 |
| `knowledgeRepository.ts`、`knowledgeAgentService.ts` | read_entries 图片元信息；AI 另存图片归属与统一转换；保持模型及调用次数策略 |
| `web/src/components/article/*`、`useArticleEditor.ts` | 编辑 UI、局部操作、草稿恢复、取消/重入、图片位置与素材管理 |
| `web/src/utils/aiMarkdown.ts`、`AiMessageBubble.vue` | 成熟清洗、安全图文、表格、流式渲染与最终内容一致 |
| 新增 `web/src/components/content/MarkdownBody.vue` | 提供单一 Markdown 展示入口，避免各页面重复渲染实现 |
| `articleHeadings.ts`、目录组件 | 1–6 级标题与锚点保留 |
| 新增共享正文 CSS | 编辑、阅读、AI 的统一排版规则 |
| `scripts/journal-article.mjs` | JSON 兼容、文件清单、multipart 构造、明确错误和不自动重发 |
| `package.json`、`pnpm-lock.yaml` | 仅增加实际采用的直接依赖，Tiptap 版本对齐 |

不顺带迁移简历 Markdown 页面、Telegram 文本格式器或其他应用；如发现能复用的逻辑，只在本任务消费者范围内归并。

## 12. 实施顺序、交付条件与部署边界

### 第一步：内容契约与转换闭环

先完成表格/任务/图片/marks 的 schema、转换与服务端保存，再接前端按钮。最早消除的应是“AI 看得到表格，保存文章却丢表格”的不一致。旧 JSON、旧图片和 anchorId 都能按新 schema 原样读取。

### 第二步：文章编辑与一致阅读

接入工具栏、表格/图片操作、共享排版和目录；实现 Markdown 导入、源码工作区和两类导出。暂存编辑态不能被预览或资产刷新替换。

### 第三步：图片完整生命周期

完成 rich draft、第一次插图、多文件/位置映射、图注尺寸、外链、素材显式删除、AI 图片复制。不能把“先创建一个空文章”当作全部完成，恢复/删除/转正式文章必须一起实现。

### 第四步：AI 与自动发布贯通

AI 图文/表格流式展示、保存保真、read_entries 图片元信息，CLI multipart、RSS 与文本提取一起收尾。所有新增运行时包应进入根运行时依赖和锁文件。

### 用户可观察的完成条件

以下是功能效果要求，不是运行命令或自动化流程：

1. 一篇包含中文、多级标题、任务、代码、普通表格和图片的 Markdown，导入、保存、重新编辑、阅读和 RSS 中内容结构一致。
2. 合并表格、图片图注/尺寸和下划线在本站源码工作区往返后仍存在；纯 GFM 无法保真的内容会明确阻止导出。
3. 新文章不必先写一段占位正文即可上传截图；关闭后能找到草稿继续写；草稿不会出现在公开阅读、RSS 或 AI 检索中。
4. 多图按顺序插入；上传时继续输入、取消、切换文章后，图片和正文不会跑到另一个文档。
5. 移除图片再撤销仍能显示原图；显式删除素材会告知实际删除，不留下假成功。
6. AI 生成表格与图片的过程中可阅读，停止状态不被误当完成；保存后的文章表格可编辑，复制的来源图片属于新文章。
7. 私有来源配图被保存为私有文章时仍私有；用户明确公开新文章后，其图片不依赖对来源文章的登录权限。
8. CLI 原 JSON 输入继续可用；带本地图片的新输入可以一次创建完整文章；失败不发布残缺文章或自动再次创建。
9. 手机阅读长表格/代码只局部滚动；编辑、预览和保存不造成整页闪烁或光标跳走。
10. 输入不支持的结构、危险链接或无法解析的图片引用会得到明确原因，不通过删内容伪装保存成功。

### 兼容与部署

新增节点本身无需新增正文字段；富文本草稿复用现有 publication_status。只有确有新增持久化信息无法用现有字段表达时再提出迁移，不预先增加版本表、资源中台或后台队列。

当前 Dockerfile 会复制根依赖、`src/shared`、Journal 服务端和前端产物；共享模块必须保持浏览器可用，不把服务端-only 库拖入前端。新模块放在这些范围内，通常不需调整镜像结构。若加入字体或其他静态资源，需同时覆盖前端产物和实际引用路径。

新 schema 对旧内容向后兼容，但旧程序不一定认识新节点。发布前应明确“有新内容后不能直接回退旧阅读程序”，不能用批量删除新增节点解决兼容问题。

本方案不包含提交、部署或生产数据改写授权。后续明确进入发布阶段时沿用项目现有 main → GitHub Actions 路径，不另建部署方案；代理与服务端新增上传限制只改对应文章入口。

## 13. 后续扩展点：公式、图表与注释

这些是有价值但与表格/图片闭环独立的增量，需单独确认实施，不在本轮偷偷引入大体积依赖：

- **公式**：使用 Tiptap Mathematics + KaTeX，保存 LaTeX 源码，不保存计算后的 DOM。Markdown 词法使用成熟插件，统一 `$...$` / `$$...$$` 规则；正文、AI 和 RSS 都需要约定输出，禁用会引入外部资源的信任选项，解析失败明确显示公式错误。[Mathematics 官方说明](https://tiptap.dev/docs/editor/extensions/nodes/mathematics)。
- **Mermaid**：保留 `codeBlock.language=mermaid` 和源码，阅读端在完整块后由 Mermaid 渲染，源码与图显式切换；流式阶段不重复渲染半张图。采用 strict 安全设置，禁止模型通过初始化指令降低策略；渲染错误明示而不是悄悄换成普通代码。SVG 是可信库生成后的展示产物，不因此放开任意用户 SVG。RSS 的图形输出需另行明确服务端静态资产策略。[Mermaid 配置说明](https://mermaid.js.org/config/schema-docs/config.html)。
- **脚注**：必须一起设计脚注定义、引用、编号、回跳、JSON 节点和 Markdown 导出，采用成熟解析扩展；不能只在聊天里加上标而保存后丢失定义。
- **提示/折叠块**：映射到明确的自定义节点，选用成熟扩展或 Tiptap Details，保持源码与导出约定；不把任意 div HTML 当成支持了所有布局。

## 14. 给 DeepSeek 的实施要求摘要

先对照当前源码，保留 Tiptap 和文章 JSON；按第 12 节顺序完成第 3.1 节全部主路径。重点不是工具栏按钮数量，而是同一内容经过 AI、编辑器、接口、数据库、阅读页和 RSS 时不丢结构。

不要手写 Markdown/HTML 通用解析器；不要用开放任意 HTML 解决格式问题；不要给出“表格已支持”但服务端仍过滤表格的局部实现。新包依据实际安装版本 API 接入，不能套用官方示例里的旧导入。所有失败明确暴露，不增加重试、兜底或静默降级；不引入 RAF。

只做这条内容链路需要的修改，保留现有无关成果。遵守项目当前对命令执行、提交和部署的授权约束，不把方案交接当成发布授权。
