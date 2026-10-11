#!/bin/bash
# Stop hook: 有本项目的 agy -p / codex exec 在跑，却没有带 agent-watch 标记的监控时，不允许结束回合。
project="$CLAUDE_PROJECT_DIR"

workers=""
while read -r pid args; do
  case "$args" in
    agy\ *-p\ *|*/agy\ *-p\ *|codex\ exec\ *|*/codex\ exec\ *) ;;
    *) continue ;;
  esac
  cwd=$(lsof -a -p "$pid" -d cwd -Fn | sed -n 's/^n//p')
  case "$cwd $args" in
    *"$project"*) workers+="- pid $pid: ${args:0:100}"$'\n' ;;
  esac
done < <(ps -axo pid=,args=)

[ -z "$workers" ] && exit 0
ps -axo args= | grep -q '[a]gent-watch' && exit 0

reason="以下后台任务仍在运行，但没有进度监控：
${workers}
结束回合前必须用 Monitor 挂上进度监控，命令以 \`: agent-watch;\` 开头（agy 看 ~/.gemini/antigravity-cli/log/ 下对应 cli 日志的 streamGenerateContent 行，codex 看它的输出文件），并向用户汇报真实进度。
如果确认它已卡住（日志连续 2 分钟没有新的模型或工具调用）或已不需要，先停止它并向用户说明，再结束回合。"

jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
