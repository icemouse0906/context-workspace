# GitHub 发布前检查 · 2026-10-09

## 结论

在本次检查范围内，没有发现阻止作为 **MVP 0.2.0 试用版本** 上传 GitHub 的重大功能问题。已处理开发依赖安全审计问题，源码可从锁文件重新安装并构建。该结论不等于所有人工验收已完成，也不代表 Chrome Web Store 审核或正式商用认证。

本次范围包括源码安全边界检查、依赖审计、单元测试、真实 Chromium 扩展集成回归、安装说明与压缩包结构检查。原先的真实 Side Panel 人工验收记录和 9 张截图完整保留在 [人工验收文件夹](manual-acceptance-2026-10-04/README.md)。

## 已处理的问题

1. **测试工具链依赖漏洞。** 原 Vitest 3.2.7 的依赖树经 `npm audit` 报告 3 个受影响节点（2 critical、1 moderate），涉及 `vitest`、`@vitest/mocker`、`tinypool`。将 Vitest 固定升级到 4.1.11 并更新锁文件后，完整依赖审计为 **0 项漏洞**。这些是开发工具依赖，不是打包进扩展的 React 运行时依赖。本机 npm 10 在升级解析时内部报错，使用 npm 11.6.2 完成升级；随后使用原 npm 10.9.3 执行 `npm ci` 及构建也成功，无需其他开发者强制升级 npm。
2. **集成测试定位不稳定。** 初次运行在关闭清单中的复选框定位超时，原定位依赖标题与 URL 之间恰好一个空格的完整无障碍名称。诊断复跑通过，未复现对应的产品功能失败。现改为按物理 tab ID 对应的 label 定位，并独立断言可见标题和完整 URL，继续检查未勾选页面保持打开。修改后连续两次集成回归通过。根因未单独证明，不将其描述为已确认的产品缺陷。
3. **GitHub 源码安装说明。** 修正“交付包含 dist、可以跳过构建”的说明，区分源码构建与 Release 压缩包直接加载。补充验收入口，忽略环境文件及日志，避免把本机临时文件带入仓库。

依赖公告：[Vitest / mocker](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)、[tinypool 公告一](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)、[tinypool 公告二](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)。审计反映检查当日已知公告，不能保证未来不会出现新公告。

## 检查结果

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 全部依赖审计 | 通过 | `npm audit --json`：0 vulnerabilities，包含开发依赖。 |
| 可复现安装 | 通过 | Node 22.18.0、npm 10.9.3，`npm ci` 成功。 |
| 单元测试 | 通过 | Vitest 4.1.11，37 / 37 通过；从锁文件重装后再次通过。 |
| 类型检查与正式构建 | 通过 | `npm run build` 包括 `tsc --noEmit`；重装后构建成功。 |
| 浏览器集成回归 | 通过 | 修改测试定位后连续两次通过，独立临时 Chromium 配置；不接触个人 Chrome 数据。 |
| 安全关闭边界 | 通过（检查范围内） | 显式 tab ID + 完整 URL 校验；保留无关、共享及其他窗口标签；未保存标签勾选；存储失败中止关闭；重启不猜测旧标签归属。相关单元与集成测试通过。 |
| 一键关闭产品红线 | 通过 | 没有新增未保存标签时，不出现确认框；集成测试断言不存在 dialog。 |
| 普通标签页窄宽布局 | 通过 | 390px 页面无横向溢出，另检查 320 / 280 / 240px；不能替代真实容器拖拽验收。 |
| 本次页面运行异常 | 未发现 | 集成测试收集的 `pageerror` 为空；未在本轮重新打开真实侧边栏与后台 DevTools，因此不扩大为本轮所有控制台零错误的结论。 |
| 权限与远程行为 | 检查未发现阻断问题 | 仅 storage、tabs、sidePanel；无 host_permissions / content script / 远程代码。URL 数据只本地保存，恢复网页会正常访问目标网站。 |
| 上传文件检查 | 通过 | 常见密钥格式扫描未命中；无超过 10 MB 的异常文件；不上传 node_modules、dist、临时浏览器配置、环境文件及日志。扫描不替代专业审计。 |

## 尚需注意

- **B3 真实 Side Panel 拖到最窄再拉宽仍未完成验收。** 历史记录为 9 项通过、1 项未完成，不将普通标签页缩窄测试算作 B3 通过。建议下一位测试者优先用实体鼠标补验。
- Context 数据目前没有导入导出或自动备份；卸载扩展会删除本地数据。研究记录导出不是 Context 备份。
- 浏览器重启、扩展刷新或更新会清空临时标签与窗口映射，但保留 Context；恢复可能与 Chrome 自动恢复的旧网页重复。
- 仅恢复 URL，不恢复表单输入、滚动位置或页面内部状态；浏览器关闭前校验与真正关闭之间仍有极短并发窗口。
- 本轮未新增产品功能，也未重新执行 10 月 4 日的完整人工操作清单；历史截图仍保留当时的界面文字。

## 交付与复核

- GitHub 源码包含项目说明、测试、产品取舍、人工验收记录与截图。
- Release 的 `context-workspace-0.2.0.zip` 只包含正式构建文件；解压后 `manifest.json` 在根目录，可通过 Chrome「加载已解压的扩展程序」加载。
- Release 同时提供 `SHA256SUMS.txt` 校验文件；GitHub 自动提供对应标签的源码压缩包。
- 本版本按 MVP 预发布版本提供试用，不是 Chrome Web Store 上架。

后续验证：`npm ci` → `npm test` → `npm run build` → `npx playwright install chromium --no-shell` → `npm run test:e2e`。真实 UI 验收用 `node tests/manual-check.mjs` 启动独立配置，读取该次输出的本地测试端口。
