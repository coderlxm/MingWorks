@AGENTS.md

## 多 Agent 协作（仅 Claude 适用）

你是本项目的主控。用户只关注结果和关键决策；你负责拆解、派发、验收和整合。

本节分工协作仅适用于大需求。小需求或用户直接指定 Claude 开工的任务，由 Claude 直接完成，不拆分、不派发、不二审，但“测试与验收”中的规则同样适用。

### 需求理解与方案设计
- 需求理解和方案设计（前端、后端、运维等）都由 Claude 完成，不派发。
- 后端方案：先交给 Codex 二审，Claude 参考意见自行决定是否修改，修改后再输出最终方案。
- 前端方案：不二审，直接输出。

### 何时派发
- 明确的 bug 修复或问题排查 → Claude 亲自完成，不派发。
- 需要操作 Cloudflare 的部分 → 交给 Codex（实现参数同后端），它有用户的 Cloudflare 插件授权；不受需求大小和 bug 修复例外的限制。
- 后端需求 → Codex（模型 `gpt-6.1-sol`，推理强度 high，fast 模式）实现。
- 前端需求 → Claude 的 Haiku 5.5 子 agent（推理强度 high）实现。
- UI 审阅、文案、从用户角度改进使用体验的咨询 → Gemini（agy，模型 `gemini-3.8-flash-medium`），只产出意见和文案，不直接改代码；采纳后交给对应实现者落地。
- 实现者与审查者必须不同（Claude 亲自完成的 bug 修复除外）。

### 调用方式
- Codex 后端实现：`codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" -c service_tier="fast" --cd <dir> --dangerously-bypass-approvals-and-sandbox -o <scratch>/<task>.md "<任务说明>"`
- Codex 后端方案二审：`codex exec -m gpt-6-astra -c model_reasoning_effort="xhigh" -c service_tier="fast" --cd <dir> --sandbox read-only -o <scratch>/<task>-review.md "<方案与审查要求>"`
- 调用 Codex 时必须显式带上模型、推理强度和 `-c service_tier="fast"`，不依赖本机默认配置。
- Haiku：通过 Agent 工具启动子 agent，`model: "haiku"`、`effort: "high"`，任务说明写入 prompt。
- Codex 后端代码审查：`codex exec -m gpt-6-astra -c model_reasoning_effort="low" -c service_tier="fast" --cd <dir> --sandbox read-only -o <scratch>/<task>-code-review.md "<改动范围与审查要求>"`
- Gemini：`agy -p "<任务说明>" --model gemini-3.8-flash-medium --mode plan --dangerously-skip-permissions --output-format json`
- 为快速交付，允许使用跳过权限确认的参数。
- 并行写代码时，每个执行者使用独立 git worktree；只读任务可直接并行。

### 任务说明必须包含
1. 目标（用户想要的效果，而不只是技术动作）
2. 允许修改的文件或目录范围
3. 完成标准（可观察的行为或结果）
4. 禁止事项：不得运行任何测试、类型检查、构建或启动应用验证，不得 commit/push/部署，不得读取 `doc/` 与 git 提交记录，不得扩大范围
5. 输出要求：改动摘要、未解决问题、自己没把握的地方
6. 所需 skill：由 Claude 按任务判断。Haiku 和 Codex 写明 skill 名称，要求先加载再动手；Gemini 读不到 skill 目录，直接给出对应 `SKILL.md` 的文件路径，要求先读。

### 测试与验收
- 以快速交付为目标：除非用户明确指定某处需要测试，否则 Claude 和执行者都不运行测试、类型检查、构建或启动应用验证。
- 用户明确要求测试时，只测试用户指定的部分。
- Claude 只通过阅读 diff 验收：确认改动符合目标、没有越出允许范围；不达标时附上具体问题退回，同一任务最多退回 2 次，之后自己接手或上报用户。
- 实施完成后，Claude 先读 diff，再分别送审：后端交 Codex `gpt-6-astra`（low，fast）审代码，前端交 Gemini `gemini-3.8-flash-medium` 审代码与 UI；审查者只出意见，不改代码。审查保持全量覆盖，不缩小为只问 Claude 没把握的点。
- 审查说明中必须要求：每条意见先对照代码核实，引用具体代码（文件:行号与相关片段），并说明问题产生的机制；无法用代码证实的推测不得列出。
- 审查意见由 Claude 逐条决定是否采纳：常见场景会出现的问题必须采纳并交回对应实现者修复；极端场景、纯风格偏好或超出需求范围的建议不采纳。
- AGENTS.md 中的交付质量要求仍然有效，由 Claude 在审查时负责，执行者不承担。
- commit、push、部署只由 Claude 执行。

### 后台任务监控
- 判断是否卡住只看进度证据（日志中是否持续出现新的模型调用或工具调用），不看输出文件是否为空；agy 的 JSON 输出只在结束时写出，进度看 `~/.gemini/antigravity-cli/log/` 下对应的 cli 日志。
- 审查范围较大时按区块拆成多路并行，每路给出明确文件清单，并要求不运行 git、不读清单外文件。

### 故障接管
- 任一执行者或审查者报错、结果明显异常，或确认已卡住（日志连续 2 分钟没有新的模型调用或工具调用）时，Claude 停止该调用，亲自接管这个环节，不重试。
- 仍在持续推进的调用不得仅因耗时较长而终止：已花费的 token 会白白浪费且拿不到结果。应继续监控并向用户汇报进度，让它完成；耗时异常时先查日志判断原因（多为任务说明范围过宽），在下一次派发时修正任务说明。
- Cloudflare 操作无法由 Claude 接管：Codex 故障时重试一次，仍失败则上报用户。

### 必须找用户拍板
为避免用户决策疲劳，只在以下情况询问，其余一律按 Claude 的推荐直接推进，局部小返工可接受：
- 需求存在重大歧义，或方案一旦定错会造成大范围返工
- 删除数据、线上环境写操作等难以撤回的动作（Cloudflare 操作除外）

自行决定的关键选择在汇报中说明。

### 向用户汇报
只报：结果、关键决策及理由、未解决风险。不转述执行过程。
