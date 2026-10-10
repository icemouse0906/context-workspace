# 三个作品集项目 · 统一交接

整理日期：2026-10-10（检查从 10 月 9 日开始）。本次范围为用户确认的考研助手、Word 插件、Context Workspace。以下区分源码和离线验证、真实宿主验收及上线状态，不将原型写成生产产品。

## 项目入口

| 项目 | GitHub | 展示与试用入口 | 当前定位 |
| --- | --- | --- | --- |
| 考研陪伴助手 | [仓库](https://github.com/icemouse0906/kaoyan-ai-companion) | [启动与部署说明](https://github.com/icemouse0906/kaoyan-ai-companion#本地运行) · [本次检查](https://github.com/icemouse0906/kaoyan-ai-companion/blob/main/docs/PORTFOLIO_REVIEW_2026-10-10.md) | 微信小程序原型；需自己的云环境与测试账号，仍有上游依赖风险 |
| Word 智能排版插件 | [仓库](https://github.com/icemouse0906/thesis-format-addin) | [macOS 侧载说明](https://github.com/icemouse0906/thesis-format-addin/blob/main/README.md) · [本次检查](https://github.com/icemouse0906/thesis-format-addin/blob/main/docs/PORTFOLIO_REVIEW_2026-10-10.md) | Office.js 开发侧载原型；本轮未做真实 Word 套用验收 |
| Context Workspace | [仓库](https://github.com/icemouse0906/context-workspace) | [v0.2.0 安装包](https://github.com/icemouse0906/context-workspace/releases/tag/v0.2.0) · [人工验收](https://github.com/icemouse0906/context-workspace/blob/main/docs/manual-acceptance-2026-10-04/README.md) · [宽度补验](https://github.com/icemouse0906/context-workspace/blob/main/docs/manual-acceptance-B3-2026-10-09/README.md) | 可加载的 Chrome 扩展 MVP；没有上架 Chrome 商店 |

[GitHub 个人主页](https://github.com/icemouse0906) 已补齐三个项目介绍与入口。Context Workspace 经用户明确同意改为公开；仓库可公开访问不等于扩展已上架应用商店。

## 本次修补与验证

| 项目 | 修补内容 | 已执行验证 | 尚待处理 |
| --- | --- | --- | --- |
| 考研助手 | 按可信 OPENID 隔离待办；拦截跨用户读写和伪造参数；截止时间恢复后台计时；AI 消息/响应大小与总超时限制；SDK 升至 4.0.2 | 10 项行为回归通过；真实 SDK 可加载，身份接口与查询接口存在，无身份调用按预期被拒绝 | 云端重新部署、两账号真机联调；旧记录归属迁移；上游依赖仍 6 项风险；限流/配额未实现 |
| Word 插件 | 首次证书顺序和缺证书提示；准确的密钥去向说明；HTTPS 地址与请求超时；规则类型/范围校验；补小五字号；用真实模块测试替换关键词检查；修补构建依赖 | 6 项回归通过；TypeScript 与 Vite 构建通过；smoke 通过；依赖审计 0 | 真实 Word 中套用、撤销和不同文档兼容性待验；本轮没有调用付费 AI |
| Context Workspace | 此轮未改产品逻辑；复核既有安装包、人工记录和 B3 补验材料；公开仓库 | 历史自动化 37 项、构建及浏览器集成检查通过；原人工清单 10 项均已有通过证据 | 数据备份、重启后的窗口映射等 MVP 限制仍在 README；未声称本轮重跑全套验收 |

考研助手依赖审计由 **18 项（3 critical / 7 high / 8 moderate）降为 6 项（0 critical / 5 high / 1 moderate）**；剩余集中在官方 SDK 固定的传递依赖。不能把这个项目表述为“零漏洞、已可公开运营”。没有修改或部署用户现有云环境、真实数据。

代码更新已发布：

- [考研助手修补提交](https://github.com/icemouse0906/kaoyan-ai-companion/commit/4820cf2fa2d07bf92fcf9da8b6b4d04b2375f07b)
- [Word 插件修补提交](https://github.com/icemouse0906/thesis-format-addin/commit/616af03065746c023e76dcfed2ef8f9e2bee3926)

## Context Workspace 人工验收总表

| 项目 | 结论 | 依据 |
| --- | --- | --- |
| A1 拼图菜单打开 | 通过 | 10 月 4 日真实工具栏操作 |
| A2 固定图标开关 | 通过 | 10 月 4 日真实工具栏操作 |
| B1 实际宽度 | 通过 | DevTools 实测 CSS 像素 |
| B2 真实侧栏布局 | 通过 | 360px 无横向滚动、明显遮挡或重叠 |
| B3 最窄后再拉宽 | 通过 | 10 月 9 日用户实体鼠标拖动，710 → 360 → 1078px；scrollWidth 均等于 innerWidth |
| C 新建并保存两页 | 通过 | 10 月 4 日；B3 补验也实际保存了两页 |
| D 恢复独立窗口 | 通过 | 10 月 4 日 |
| E 新标签勾选清单 | 通过 | 10 月 4 日；细节见原报告 |
| F 无新标签直接关闭 | 通过 | 10 月 4 日独立验证，没有确认框 |
| G 只显示名称 | 通过 | 10 月 4 日 |

没有确认的功能失败项，没有失败提示可逐字抄录。10 月 4 日侧边栏和 Service Worker 控制台均记录“没有报错”；10 月 9 日补验侧边栏“没有报错”，后台控制台未重查。旧报告曾记录 DevTools 表单改进提示：`A form field element should have an id or name attribute`，它不是运行时错误；完整截图和后续检查以链接内原报告为准。

初用最困惑的是“网页已关联”和“窗口未关联”的区别，以及关闭操作会影响哪些标签。原英文关键按钮与密集关闭说明增加了理解成本，后续已经改为中文按钮和更直接的说明；这些反馈与当时界面文案均保留在原报告中。

### 真实侧栏截图

以下为 10 月 9 日原始截图副本，无图像编辑。全部 17 张验收截图仍保留在原两份报告目录中。

![360px 最窄侧栏](screenshots/minimum-resources.jpg)

![1078px 再次拉宽](screenshots/wide-again-resources.jpg)

## 可直接用于作品集的三句话

- **考研陪伴助手：** 面向备考任务与情绪陪伴，快速搭建 Todo、番茄钟和 AI 对话原型，再补齐用户隔离、后台恢复及请求边界，通过测试明确原型能力。
- **Word 智能排版插件：** 将自然语言格式要求解析为可检查的结构化规则，再交给 Office.js 执行，展示 AI 与确定性操作的分工和宿主兼容问题处理。
- **Context Workspace：** 围绕多任务切换，把相关网页组织为 Context，通过独立窗口恢复和安全关闭规则降低任务中断成本，并用真实 Chrome 侧栏验收验证窄屏操作。

不要将“已做原型”换成“已规模化上线”，不要补写没有证据的用户数量、转化率或效率提升百分比。优先展示需求取舍、关键交互、失败边界和验证证据。

## 文件导航

- 本目录的 `*-tests.txt`、`word-build.txt`、`word-smoke.txt`：本轮执行记录。
- `*-dependency-audit*.json`：依赖审计机器记录。
- `screenshots/`：真实侧栏的两张代表截图。
- 三个项目的完整源码以以上 GitHub 仓库为准；考研与 Word 的修补基于核对过远程 HEAD 的工作副本，没有覆盖旧桌面目录中的其他未提交修改。
