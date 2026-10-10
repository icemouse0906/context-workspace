# Context Workspace · MVP 0.2

一个按「正在做的事情」保存网页的 Chrome Side Panel 扩展。当前版本验证手动保存、按窗口关闭和恢复 Context；没有后端、登录、数据库服务或 AI 功能。

三个作品集项目的统一链接、修补结果、验证边界和代表截图见 [2026-10-10 统一总结](docs/portfolio-review-2026-10-10/README.md)。

## 产品假设与验证目标

浏览器目前主要按页面 / 标签管理，但用户实际经常按「正在做的事情」组织数字资源。我们希望验证：用户是否愿意把同一任务相关标签页保存成 Context，并通过「关闭 + 恢复 Context」降低任务切换成本。

首个测试场景是秋招多岗位投递；底层数据和状态保持通用，同样可以表示创作、学习、娱乐。不能据此认定 Context 已优于浏览器现有工具。

## 安装与运行

**直接试用：** 从本仓库的 Releases 下载 `context-workspace-0.2.0.zip` 并解压。在 `chrome://extensions` 打开「开发者模式」，点击「加载已解压的扩展程序」，选择解压后包含 `manifest.json` 的文件夹。然后固定工具栏中的 Context Workspace 图标，点击即可打开侧边栏。

**从源码构建：** GitHub 源码不包含生成目录 `dist/`。按以下步骤安装依赖并构建，后续修改源码也需要重新构建。

环境：macOS、Node.js 22.12+（建议 Node 22 LTS）、npm、Chrome 116+。支持 Side Panel API 的 Chromium 浏览器可尝试；其他浏览器兼容性尚未全面验证。

1. 在终端进入本项目目录 `context-workspace`。如已安装 nvm，可运行 `nvm use`。
2. 安装锁定依赖：

   ```bash
   npm ci
   ```

3. 构建：

   ```bash
   npm run build
   ```

4. Chrome 地址栏输入 `chrome://extensions`，打开右上角「开发者模式」，点击「加载已解压的扩展程序」，选择本项目的 **`dist` 文件夹**（不是项目根目录）。
5. 在工具栏扩展菜单中固定 Context Workspace；点击扩展图标打开侧边栏。
6. 新建 Context，或点击空列表中的「载入 2 个演示 Context」。载入示例不会自动打开网页。
7. 切换到普通 HTTP / HTTPS 网页，在侧边栏选择 Context，点击「添加当前标签页」。保存几个页面后试用「保存当前窗口」、「关闭 Context 窗口」和「恢复为新窗口」。

### 开发方式

```bash
npm run dev             # 普通网页预览，终端显示本地 URL
npm run dev:extension   # 构建并监听源文件，输出到 dist/
npm run typecheck      # TypeScript 检查
npm test               # 核心逻辑与安全关闭边界测试
npm run build          # 正式构建
npm run preview        # 预览构建后的页面
```

`npm run dev` 的网页预览仅支持 Context 编辑、搜索、演示数据；通过明确提示和禁用按钮区分扩展功能。预览数据存于该网页的 localStorage，与扩展数据互相独立。要验证真实标签操作，使用 `dev:extension` 或 `build` 后在 Chrome 加载 `dist`。

扩展开发没有自动重载：构建完成后，在 `chrome://extensions` 点击扩展的刷新按钮，关闭并重新打开侧边栏。刷新扩展会清空临时会话映射，但保留 Context；需再次添加或恢复页面来建立关联。不要卸载扩展，否则本地数据会随之删除。始终加载同一个 `dist` 路径。

### 浏览器集成测试

```bash
npx playwright install chromium --no-shell
npm run build
npm run test:e2e
```

使用临时独立配置运行 Chrome for Testing，不访问个人 Chrome 配置。测试网页由本机 HTTP 服务提供；测试涵盖实际 MV3 加载、service worker、UI、浏览器重启持久化和窄屏布局。测试结束删除临时配置，并在 `docs/preview.png` 保存界面截图。受限网络环境可能需要代理才能安装依赖和测试浏览器。具体已执行结果见 [自检记录](docs/SELF_CHECK.md)。

发布前检查见 [2026-10-09 检查记录](docs/PRE_RELEASE_CHECK_2026-10-09.md)；真人操作结果和截图见 [2026-10-04 人工验收](docs/manual-acceptance-2026-10-04/README.md)。B3 真实侧栏最窄/拉宽已补验通过，见 [补验报告与截图](docs/manual-acceptance-B3-2026-10-09/README.md)。浏览器集成测试在普通标签页渲染扩展界面，不能替代真实 Side Panel 容器的人工验收。

[查看侧边栏界面截图](docs/preview.png)（由 0.2 浏览器集成测试自动生成）。

## 0.2 功能

- Context 创建、列表、名称 / 分类 / 状态 / 备注修改、删除。
- 通用状态 `active / waiting / done / archived`；归档仅是状态，不隐藏列表，不自动关闭页面。
- 保存当前窗口当前活动标签的标题、完整 URL、favicon 地址和加入时间。
- 查看、移除、单独重新打开网页；单 Context 内相同 URL 去重。
- 「保存当前窗口」列出当前窗口的 HTTP / HTTPS 标签，默认全部勾选。确认后保存到所选 Context，并关联选中的物理标签；同一 Context 内相同完整 URL 只保存一份资源。提交前重新核对 tab id、完整 URL 和窗口归属，已关闭、跳转或移走的标签会跳过并提示。此操作不会把当前窗口设为 Context 专属窗口，也不会关闭标签。
- 「恢复为新窗口」首次在独立窗口打开保存的网页并建立 Context–窗口映射；再次恢复会聚焦仍有效的关联窗口，只补开缺失网页。其他窗口已有的标签不会搬入或被当作此窗口的恢复结果。单个网页点击仍会激活有效的关联标签，必要时聚焦其窗口。侧边栏所在窗口不会因此被绑定；未绑定窗口仍会说明「保存网页不会绑定窗口」。
- 「关闭 Context 窗口」在有关联窗口时，仅关闭该窗口内明确关联且完整 URL 仍匹配的标签。其他窗口中的有效关联标签保持打开，结果明确提示「另有 N 个本 Context 的标签在其他窗口，未关闭」。若没有未保存的新标签，一次点击直接关闭，不增加确认。
- 窗口内新开标签不会自动归属 Context。关闭关联窗口时，若发现尚未关联的 HTTP / HTTPS 标签，会列出并默认勾选：勾选项先保存再按安全规则关闭；未勾选项保持打开。取消不保存也不关闭；确认期间新出现的未关联标签保持打开；提交前再次核对 id、完整 URL 和窗口归属，变化项跳过。保存或会话映射失败时中止关闭。
- `Discreet（只显示名称）` 隐藏列表与详情中的分类文字、状态文字、备注、网页数量及资源标题 / URL；名称、操作入口、状态色点和更新时间仍可见。编辑与主动打开的标签确认清单仍可能展示内容。它只减少日常界面的内容展示，不提供加密或隐私隔离。搜索不受影响：discreet Context 仍可按网页标题搜到，命中后列表依然只显示 Context 名称。
- 按 Context 名称或标签页标题搜索，大小写不敏感。按 `DECISIONS.md` D5，discreet 不影响搜索：名称与资源标题一视同仁参与匹配。
- 手动载入两个示例：秋招与小说写作。没有私人网址；JD / 简历为 example.com 网页占位，不支持文件上传。
- 本地持久化、操作成功 / 失败反馈、基本空状态与删除确认。

## 安全关闭规则与当前已知限制

每次「添加当前标签页」或「恢复 / 打开网页」时，在 `chrome.storage.session` 中记录 `{ contextId, resourceId, tabId, url, windowId? }`；批量保存也采用相同映射规则。

关闭前必须同时匹配明确记录的 tab id 和完整 URL（优先校验 pendingUrl），不按域名匹配，也不查找同 URL 的陌生标签。导航到不同 URL、标签关闭或标签替换时撤销映射。URL 包括路径、查询参数和 hash。

- **同域名、甚至完全同 URL 的未关联标签都保留。**
- 同一个物理标签明确加入多个 Context 后，共享标签会保留；可移除另一个 Context 中的网页记录再关闭。
- 页面跳转 / 重定向后会失去关联，即使之后返回原 URL，也需要重新添加。此策略可能少关页面，但不会根据网址猜测归属。
- **D3：浏览器重启后窗口映射丢失，行为退回 0.1 语义。** 标签映射也会清空，Context 和资源仍保留。没有窗口映射时，Close 不检查整个窗口的新标签、不弹窗口保存确认，只处理当前会话明确关联的标签；刚重启尚未重新关联时不会关闭任何旧标签。Restore 会新建窗口重新建立映射，可能与 Chrome 自动恢复的旧页面重复。扩展刷新、更新或停用也会清空会话映射，不会按 URL 猜测并认领旧标签。
- Chrome 的「读取 URL」和「关闭 tab」不是原子操作，存在极短并发导航窗口；MVP 通过事件撤销和关闭前校验降低风险，不承诺浏览器层面的绝对原子性。
- 删除 Context / 移除资源只删除保存记录与映射，不关闭浏览器标签。
- 只恢复 URL，不恢复滚动位置、表单输入、页面内状态、窗口布局或标签顺序。关闭前请自行保存网页中正在编辑的内容。
- 仅支持 HTTP / HTTPS。内部页、扩展页、file URL 不支持；未启用隐身模式支持，也不进行隐私模式识别。
- 资源里的 favicon 保存为地址但不远程加载；UI 使用本地编号，避免查看列表时产生额外图标网络请求。
- 存储失败会显示错误；多个页面恢复 / 关闭部分失败会显示成功和失败数，可重试。没有 Context 数据的自动备份或导入导出；研究事件的手动导出见下文。
- 多个面板的写操作由单个 service worker 排队，避免覆盖不同 Context；同一 Context 若在多面板同时编辑，后提交者覆盖前提交者。

## 技术与文件结构

使用原定组合：**Manifest V3 + TypeScript + React + Vite**。Side Panel 能在用户切换网页时持续操作，适合「添加当前页」；因此没有采用 Popup。Vite 使用两个入口直接输出静态界面和模块 service worker，不额外引入扩展构建框架或状态管理框架。

```text
context-workspace/
├── public/manifest.json       # MV3、权限与 Side Panel 声明
├── src/
│   ├── background.ts          # 消息入口、浏览器事件、操作队列
│   ├── main.tsx
│   ├── styles.css
│   ├── components/
│   │   ├── ContextForm.tsx
│   │   ├── ContextList.tsx
│   │   ├── ContextDetail.tsx
│   │   ├── ResourceList.tsx
│   │   ├── ReviewDialog.tsx    # 保存窗口 / 关闭前的新标签确认
│   │   └── UsageExport.tsx     # 研究事件检查与手动导出
│   ├── pages/Workspace.tsx    # 列表 / 搜索 / 详情与反馈
│   ├── storage/
│   │   ├── workspace.ts       # local 与 session 读写
│   │   ├── service.ts         # CRUD、保存 / 恢复 / 关闭
│   │   ├── client.ts          # 扩展消息与网页预览适配
│   │   ├── demo.ts
│   │   └── usage.ts           # 临时本地研究脚手架
│   ├── types/index.ts
│   └── utils/context.ts       # 校验与搜索
├── tests/
│   ├── service.test.ts
│   └── extension.e2e.mjs
├── docs/
│   ├── PRODUCT_NOTES.md
│   ├── SELF_CHECK.md
│   └── preview.png
├── dist/                     # 可加载的构建结果（生成目录）
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
└── README.md
```

### 数据模型

```ts
type ContextStatus = 'active' | 'waiting' | 'done' | 'archived';
interface TabResource {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  addedAt: number;
}
interface Context {
  id: string;
  name: string;
  category?: string;
  status: ContextStatus;
  note?: string;
  discreet?: boolean; // 老数据缺省为 false
  createdAt: number;
  updatedAt: number;
  resources: TabResource[];
}
```

所有时间为 epoch 毫秒。`note` 同时承载一句话备注和「上次做到哪里」，不引入第二套进度数据。完整文档以 `{ version: 1, contexts: Context[] }` 写入 `chrome.storage.local` 的 `context-workspace-v1`，无自动升级或覆盖不识别版本的行为。0.1 数据格式保持兼容，缺失的 `discreet` 按 `false` 读取，原有名称、备注和资源保留。临时标签映射放在 session 的 `context-tabs-v1`，窗口映射放在 `context-windows-v1`，都不会保存到 local。

## 临时研究脚手架

`src/storage/usage.ts` 仅用于当前用户研究，研究结束后应移除该模块及调用点。它在 `chrome.storage.local` 的 `context-usage-research-v1` 中最多保留最近 500 条事件，只包含 `event`、`timestamp`、`resource_count` 三个字段。事件类型为创建 Context、保存标签、恢复 Context、关闭 Context；不记录 URL、标题、Context 名称、正文或用户标识。

记录读写错误会被捕获，不影响创建、保存、恢复或关闭主流程。用户可通过「检查并导出研究记录」先查看、编辑，再手动导出；没有自动上传、远程遥测或网络分析服务。这些记录不是 Context 数据备份。

## 当前不验证什么

MVP 边界仅限网页标签页。本轮不验证 AI 自动分类、多模态资源、云同步、隐私空间或求职自动化，也不验证商业模式和跨设备体验。

## 隐私原则草案

- 数据仅保存在当前浏览器配置的本地存储，不上传网页内容。
- 不读取网页正文，不注入 content script，无远程脚本、远程埋点、遥测或 LLM API；仅有上述临时本地研究事件。
- `storage` 用于数据与会话映射；`tabs` 用于显式保存网页的标题、URL、favicon，以及安全校验 tab id / URL；`sidePanel` 用于侧边栏。无 `history`、`scripting`、`host_permissions` 权限。
- `tabs` 权限允许访问敏感的标题 / URL 元数据，但代码只在用户操作和已关联标签校验中使用，不扫描浏览历史。
- 点击恢复会正常访问所保存的网站，由网站处理其自身登录、Cookie 和网络行为；这不是云端同步。
- 本地存储不等于加密保险箱，URL 可能含查询参数或私密链接，应谨慎保存。卸载扩展会删除本地数据。
- 后续任何 AI 分类必须明确考虑隐私、数据最小化与用户授权，再决定是否开发。

## Future Ideas（仅记录，本轮全部未实现）

- AI 判断页面所属 Context；「这个页面似乎属于某 Context，是否加入？」。
- LLM API、页面正文读取、Context Summary，均需先讨论用户授权和隐私。
- 本地文件资源、文件上传、图片 / 视频等多模态资产管理、AI 对话资源类型。
- 用户账户、云同步、多设备同步。
- Privacy Context、Context 间隔离；隐私模式自动识别、成人内容识别、自动关闭危险页面均只作为待讨论议题，不代表承诺实施。
- 更结构化的「上次做到哪里」（当前仅手写 note）、自动归档。
- 求职场景模板、创作场景模板；求职网站自动解析、JD 自动抽取、自动读取招聘状态。
- 浏览器历史大规模扫描、Agent 自动操作网页：均不在 MVP 范围，需要重新评估必要性与权限。

## 实现参考

使用 Chrome 官方 API 文档确认权限与生命周期：[Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)、[Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)、[Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)。本项目的产品取舍和测试结果以代码及自检记录为准。
