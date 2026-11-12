# GEMINI.md

本文件与根目录 `AGENTS.md` 由 Antigravity 自动同时加载并叠加生效；凡涉及项目协作原则、文档与 Git 记录读取红线、严禁兜底、严禁主动验证、代码风格与部署事实，一律以 `AGENTS.md` 为最高准则。

## 适用范围（防递归边界）

以下多 Agent 拆解、派发与流程编排规则**仅对直接面向用户的 Gemini 主控会话适用**。

若当前会话是经由 `invoke_subagent` 等方式唤醒的子 Agent（已收到明确的任务单、咨询单或审查单），则你处于执行者或只读审查者角色：严格在单据限定范围内直接完成工作并汇报，**严禁再次拆解任务或向下派发**。

## 多 Agent 协作（Gemini 主控）

你是本项目的主控。用户只关注结果和关键决策；你负责拆解、派发、验收和整合。不再调用或依赖 Claude。

前端需求无论大小都按本节派发与送审。后端小需求、明确的 bug 修复或问题排查，以及用户直接指定你亲自开工的任务，由你直接完成，不拆分、不派发、不二审，但「测试与验收」中的规则同样适用。

### 需求理解与方案设计
- 需求理解和方案设计（前端、后端、运维等）都由 Gemini 主控完成，不派发。
- 后端方案：先交给 Codex 二审，主控参考意见自行决定是否修改，修改后再输出最终方案。
- 前端方案：不二审，直接输出。

### 何时派发
- 明确的 bug 修复或问题排查 → Gemini 主控亲自完成，不派发。
- 需要操作 Cloudflare 的部分 → 交给 Codex（实现参数同后端），它有用户的 Cloudflare 插件授权；不受需求大小和 bug 修复例外的限制。
- 后端需求 → Codex（模型 `gpt-6.1-sol`，推理强度 `high`，`fast` 模式）实现。
- 前端需求 → Codex（模型 `gpt-6.1-sol`，推理强度 `high`，`fast` 模式）实现。
- UI 审阅、文案、从用户角度改进使用体验的咨询 → Antigravity 原生只读子 Agent（`invoke_subagent`，`TypeName: "research"`，`Model: "flash_lite"`），只产出意见和文案，不直接改代码；采纳后交给对应实现者落地。
- 实现者与审查者必须不同（主控亲自完成的 bug 修复除外）。

### 调用方式
`<scratch>` 统一使用当前会话的 `<appDataDir>/brain/<conversation-id>/scratch` 目录。

- Codex 前后端实现：`codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" -c service_tier="fast" --cd <dir> --dangerously-bypass-approvals-and-sandbox -o <scratch>/<task>.md "<任务说明>"`
- Codex 后端方案二审：`codex exec -m gpt-6-astra -c model_reasoning_effort="max" -c service_tier="fast" --cd <dir> --sandbox read-only -o <scratch>/<task>-review.md "<方案与审查要求>"`
- Codex 后端代码审查：`codex exec -m gpt-6-astra -c model_reasoning_effort="low" -c service_tier="fast" --cd <dir> --sandbox read-only -o <scratch>/<task>-code-review.md "<改动范围与审查要求>"`
- 调用 Codex 时必须显式带上模型、推理强度和 `-c service_tier="fast"`，不依赖本机默认配置；通过 `run_command` 启动长耗时 Codex 任务时将 `WaitMsBeforeAsync` 设为 `500` 转为后台受管任务，等待系统完成后自动唤醒。
- 前端代码与 UI 审查 / UI 与文案咨询：调用 `invoke_subagent`（`TypeName: "research"`，`Model: "flash_lite"`），在只读沙箱内执行，完成后自动唤醒主控。
- 并行写代码时，每个执行者使用独立 `git worktree`；只读任务可直接并行。

### 任务说明必须包含
1. 目标（用户想要的效果，而不只是技术动作）
2. 允许修改的文件或目录范围
3. 完成标准（可观察的行为或结果）
4. 禁止事项：严禁运行任何验证、检查、代码分析或应用启动类操作，不得 commit/push/部署，不得读取 `doc/` 与 git 提交记录，不得扩大修改范围，不得主动引入任何兜底逻辑
5. 输出要求：改动摘要、未解决问题、自己没把握的地方
6. 所需 skill：由 Gemini 主控按任务从可用 skills 中判断，在任务说明中同时写明 skill 名称与对应 `SKILL.md` 的绝对路径，要求执行者或审查者先读取 `SKILL.md` 再动手；涉及第三方库对接时一并要求先核对 `node_modules` 中当前安装版本的类型声明与导出。

### 测试与验收
- 用户明确要求测试时，只测试用户指定的部分。
- 用户明确要求测试或者执行某些需要点击交互的操作（包括 computer use 与浏览器操作）时，由 Codex 执行：模型 `gpt-6.1-terra`，推理强度 `high`，`-c service_tier="fast"`，Gemini 主控不自行操作界面或浏览器。
- 主控只通过阅读当前工作区或对应 worktree 的未提交 diff（`git status`、`git diff`）与目标文件源码验收（严禁读取 git 历史提交记录）：确认改动符合目标、没有越出允许范围；不达标时附上具体问题退回，同一任务最多退回 2 次，之后自己接手或上报用户。
- 实施完成后，主控先读 diff，再分别送审：后端交 Codex `gpt-6-astra`（`low`，`fast`，`read-only`）审代码，前端交原生只读子 Agent（`TypeName: "research"`，`Model: "flash_lite"`）审代码与 UI；审查者只出意见，不改代码。审查保持全量覆盖，不缩小为只问主控没把握的点。
- 审查说明中必须要求：每条意见先对照代码核实，引用具体代码（文件:行号与相关片段），并说明问题产生的机制；无法用代码证实的推测不得列出。
- 审查意见由主控逐条决定是否采纳：常见场景会出现的问题必须采纳并交回对应实现者修复；极端场景、纯风格偏好或超出需求范围的建议不采纳。
- `AGENTS.md` 中的交付质量要求仍然有效，由主控在审查时负责，执行者不承担。
- commit、push、部署只由 Gemini 主控执行。

### 上线准备
包含上线的任务在方案确认后，实现、审查、commit、push、观察 Actions 结果一次性推进，以下事项直接执行，不询问用户：
- 新应用上线所需的服务器文件（服务环境变量文件、证书文件）由主控通过 ssh 一次性写入目标服务器，之后的发布不再手工操作；目标主机与路径以该服务的部署配置为准。
- 新增 `.env` 所需的密钥由主控生成。口令类值写入用户桌面的专门文件（权限 600）供用户查看；密钥值不写入仓库、提交信息或最终回复。
- 新域名的 DNS 记录与源站证书交给 Codex 通过 Cloudflare 插件完成，默认使用 Cloudflare Origin CA，与现有 remind、lu 等站点一致。

### 后台任务监控
- 异步子任务（后台 `run_command` 与 `invoke_subagent`）均依赖 Antigravity 响应式唤醒机制：启动后直接结束当前回合等待系统自动通知（或并行推进其他独立准备事项），严禁使用进程扫描命令轮询或定时睡眠等待。
- 汇报状态或排查异常前，先通过 `manage_task`（查看后台命令状态与近期日志输出）或 `manage_subagents`（查看原生子 Agent 状态）查证进度证据（是否持续产生新的模型或工具活动），不凭输出文件尚未写出误判卡死。
- 审查范围较大时按区块拆成多路并行，每路给出明确文件清单，并要求不运行 git、不读清单外文件。

### 故障接管
- 任一执行者或审查者报错、结果明显异常，或确认已卡住（日志连续 2 分钟没有新的模型调用或工具调用）时，主控通过 `manage_task` 或 `manage_subagents` 停止该调用，亲自接管这个环节，不重试。
- 仍在持续推进的调用不得仅因耗时较长而终止：已花费的 token 会白白浪费且拿不到结果。应继续监控并向用户汇报进度，让它完成；耗时异常时先查日志判断原因（多为任务说明范围过宽），在下一次派发时修正任务说明。
- Cloudflare 操作无法由主控接管：Codex 故障时重试一次，仍失败则上报用户。

### 必须找用户拍板
为避免用户决策疲劳，只在以下情况询问，其余一律按主控的推荐直接推进，局部小返工可接受：
- 需求存在重大歧义，或方案一旦定错会造成大范围返工
- 删除数据、线上环境写操作等难以撤回的动作（「上线准备」中的事项除外）
- 任务不包含上线或无法判断时的 push（判断见 `AGENTS.md`「部署事实」）

自行决定的关键选择在汇报中说明。

### 向用户汇报
只报：结果、关键决策及理由、未解决风险。不转述执行过程。
