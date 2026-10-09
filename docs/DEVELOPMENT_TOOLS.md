# Chrome 官方开发辅助工具

安装日期：2026-10-03。仅配置开发环境，MVP 的运行代码与产品功能未改变。

## 已安装

- `chrome-extensions`：GoogleChrome/modern-web-guidance 官方技能，安装到 `~/.codex/skills/chrome-extensions`，包含 MV3、Side Panel、存储与权限等开发参考。
- `modern-web-guidance`：同一官方仓库的 Web 平台技能，安装到 `~/.codex/skills/modern-web-guidance`，提供布局、兼容性、性能和无障碍指南。技能按需通过官方 npx CLI 搜索更新的指南。
- `chrome-devtools-mcp` 1.10.1：安装在 `~/.codex/tools/chrome-devtools-mcp`，以 `chrome-devtools` 名称登记在 Codex 的用户 MCP 配置中。

两个技能通过 Codex 的 skill-installer 从 Google 官方 Git 仓库安装，是当前版本的本地副本；未设置自动更新。MCP 版本已固定，后续升级应先检查兼容性。

## 调试配置

启用了扩展调试工具，使用独立临时 Chrome 配置（`--isolated`），未启用连接日常 Chrome 的 `autoConnect`。关闭了使用统计（`--no-usage-statistics`）和向 CrUX 查询性能数据（`--no-performance-crux`）。文件访问根限定为桌面项目与原始交付项目。

无需向产品添加 LLM API、AI 分类、账户或云同步。后续开发可使用这些工具检查扩展侧边栏、service worker、控制台与网络问题。

## 验证与启用

已验证 MCP 启动、初始化握手和工具列表，返回 35 个工具，其中包含 `install_extension`、`list_extensions`、`reload_extension`、`trigger_extension_action`、`uninstall_extension`。本次安装验证未操作个人 Chrome，也未改变 MVP 源码；未用新 MCP 重跑产品测试。

新技能将在下一轮可用。MCP 配置已写入；若当前 Codex 会话尚未显示新工具，可重新启动 Codex 后使用。

查看配置：`codex mcp get chrome-devtools`。移除连接：`codex mcp remove chrome-devtools`（仅移除登记，不删除已下载包与技能）。

MCP 使用本机 Node 22.18.0 的绝对路径；若以后删除或迁移该 Node 安装，需要相应更新配置。技能与 MCP 是这台电脑的开发环境，不打包进 Chrome 扩展。

## 来源

- [Chrome 官方指南：使用编码智能体构建扩展程序](https://developer.chrome.com/docs/extensions/ai/build-with-ai?hl=zh-CN)
- [GoogleChrome / Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Chrome DevTools MCP 配置](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
