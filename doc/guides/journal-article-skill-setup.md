# 在工作电脑启用自动文章 skill

桌面已提供 journal-article-publishing 文件夹，包含 SKILL.md、自动选择元数据和已发布版本的 CLI，不包含 token。无需复制整个项目。

## 一次性准备

1. 工作电脑安装 Node.js 24。
2. 将整个 journal-article-publishing 文件夹复制到用户主目录的 .agents/skills 下。最终应为 .agents/skills/journal-article-publishing/SKILL.md；不要多套一层文件夹，也不要同时在多个技能目录装同名副本。
3. 在用户主目录创建 .config/journal，将此前桌面的 Journal-article-token.8BCDGN 文件复制进去，改名 article.env。该文件已经包含 JOURNAL_API_URL 和 JOURNAL_ARTICLE_TOKEN 两行，不用再填一遍。macOS/Linux 仅允许本人读写；Windows 使用本人账户的私有目录。
4. 重新进入 Codex CLI 会话。

macOS/Linux 用户主目录通常是 /Users/用户名 或 /home/用户名；Windows 通常是 C:\Users\用户名。以工作电脑实际目录为准。

skill 调用时由 Node 的 --env-file 加载固定位置的凭据，不需要每次打开终端手动 export。如果模型进程已经设置了同名环境变量，Node 优先使用那些值，应保持配置一致。

## 日常使用

在讨论完一个问题后直接说：

- 帮我把刚才的问题总结成一篇复盘报告。
- 帮我把今天处理的事情写成一篇工作记录。
- 把刚才的处理方法沉淀成经验文章。

skill 会整理正文、生成 CLI 输入、调用写入接口、返回阅读链接，默认公开。无需手工排版和再点发布。

说“先给我看，不要发布”时只生成内容；说“私有保存”时传 private。普通问题回答、开发方案和代码交付摘要不会自动发表。

自然语言由模型根据技能描述匹配；如果本次没有选择，可以写“使用 $journal-article-publishing，把刚才的问题整理成复盘报告”。宿主的网络和工具权限仍然适用。

## 范围与交付

首版支持文字、标题、普通列表、引用、代码和链接；不支持图片、表格、附件或通过 CLI 更新既有文章。接口失败直接报告，不自动重发；断线后结果可能不确定，先查看网站避免重复文章。

本机安装位置为 /Users/xiaomingli/.codex/skills/journal-article-publishing；桌面副本用于迁移。没有改动全局 AGENTS.md，也没有因为创建 skill 发布任何文章。工作电脑凭据仅配置一次，之后由 skill 自动加载。

依据：[Codex skills](https://developers.openai.com/codex/skills) 的用户技能目录与隐式调用说明，以及 [Node 命令行文档](https://nodejs.org/api/cli.html#--env-filefile) 的环境文件加载机制。
