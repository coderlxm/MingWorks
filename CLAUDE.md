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
- 后端需求 → Codex（模型 `gpt-6.1-sol`，推理强度 high，fast 模式）实现。
- 前端需求 → Claude 的 Haiku 5.5 子 agent（推理强度 high）实现。
- UI 审阅、文案、从用户角度改进使用体验的咨询 → Gemini（agy），只产出意见和文案，不直接改代码；采纳后交给对应实现者落地。
- 实现者与审查者必须不同（Claude 亲自完成的 bug 修复除外）。

### 调用方式
- Codex 后端实现：`codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" -c service_tier="fast" --cd <dir> --dangerously-bypass-approvals-and-sandbox -o <scratch>/<task>.md "<任务说明>"`
- Codex 后端方案二审：`codex exec -m gpt-6-astra -c model_reasoning_effort="xhigh" -c service_tier="fast" --cd <dir> --sandbox read-only -o <scratch>/<task>-review.md "<方案与审查要求>"`
- 调用 Codex 时必须显式带上模型、推理强度和 `-c service_tier="fast"`，不依赖本机默认配置。
- Haiku：通过 Agent 工具启动子 agent，`model: "haiku"`、`effort: "high"`，任务说明写入 prompt。
- Gemini：`agy -p "<任务说明>" --mode plan --dangerously-skip-permissions --output-format json`
- 为快速交付，允许使用跳过权限确认的参数。
- 并行写代码时，每个执行者使用独立 git worktree；只读任务可直接并行。

### 任务说明必须包含
1. 目标（用户想要的效果，而不只是技术动作）
2. 允许修改的文件或目录范围
3. 完成标准（可观察的行为或结果）
4. 禁止事项：不得运行任何测试、类型检查、构建或启动应用验证，不得 commit/push/部署，不得读取 `doc/` 与 git 提交记录，不得扩大范围
5. 输出要求：改动摘要、未解决问题、自己没把握的地方

### 测试与验收
- 以快速交付为目标：除非用户明确指定某处需要测试，否则 Claude 和执行者都不运行测试、类型检查、构建或启动应用验证。
- 用户明确要求测试时，只测试用户指定的部分。
- Claude 只通过阅读 diff 验收：确认改动符合目标、没有越出允许范围；不达标时附上具体问题退回，同一任务最多退回 2 次，之后自己接手或上报用户。
- AGENTS.md 中的交付质量要求仍然有效，由 Claude 在审查时负责，执行者不承担。
- commit、push、部署只由 Claude 执行。

### 必须找用户拍板
- 存在多种合理理解且结果明显不同（遵循 AGENTS.md 的歧义规则）
- 新增运行时依赖、数据结构或接口变更、删除功能或数据
- 执行者之间的方案分歧无法用事实判定
- 涉及线上环境的写操作

### 向用户汇报
只报：结果、关键决策及理由、未解决风险。不转述执行过程。
