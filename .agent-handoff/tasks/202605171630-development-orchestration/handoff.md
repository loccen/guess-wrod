# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、`/api/health`、migration/seed、评分规则、评分客户端抽象、存储 repository/adapter、前端静态 mock 主流程、image2code 规格与视觉报告。
- 第二批已合入 `main`：评分客户端 `8bb623f`、存储基础 `8369b0f`、前端静态主流程 `42aaf31`。
- 第三批已合入 `main`：前端 visual QA 修复 `3719d4c`、后端基础 API `9e7a1a5`。
- 第四批已合入 `main`：猜词提交流程 `166d10c`、前端真实流程 `51ff6f5`。
- 第五批已合入 `main`：前端真实猜词流程 `dbdf55e`、评分反馈接口 `bd3d226`。
- 第六批已合入 `main`：前端反馈接入 `aae5b1f`、过期规则 `57234af`。
- 第七批已合入 `main`：基础分析写入 `5a4326e`、视觉验收收尾 `c5299d8`。
- 当前会话新增已合入 `main`：
  - 后端 live adapter `a3a448a`（子任务提交：`80ea9c2`、`531a84a`）
  - Cloudflare 资源基线 `05e07bd`（子任务提交：`8c06241`、`a714445`）
  - expired 数据流 `ce6e89e`（子任务提交：`7f9ebc6`）
- 合并后验证通过：`npm run typecheck`、`npm test`、`node --test tests/domain/scoring.test.mjs`、`npm run build`、`npm run cf:check`、seed/migration、`.agent-handoff` 校验。
- `npm run dev:pages` 启动后，8 个静态路由和 `/api/health` 均返回 200；`POST /api/sessions -> POST /api/games -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}` 真实链路通过。
- 当前主仓还能本地跑通 `POST /api/sessions -> POST /api/games -> POST /api/games/{id}/guesses -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}`。
- 当前主仓还能本地跑通 `POST /api/sessions -> POST /api/games -> POST /api/games/{id}/guesses -> GET /api/games/{id} -> POST /api/games/{id}/feedback -> POST /api/games/{id}/give-up -> GET /api/games/{id}`。
- 首页、游戏页、live guess、live feedback 四份既有关键 visual QA 报告仍在仓库中；新增 `06-result-expired-live` 报告已落库但当前 `passed=false`。
- 当前仍保留一个未清理现场：`/Users/loccen/Documents/guess-wrod-worktrees/expired-visual-qa`，原因是其中仅有未提交的视觉微调尝试，尚未验收。

## 未完成

- expired 结果页的真实数据流已接上，但视觉验收仍未通过；最新未提交尝试的剩余差值为：
  - `answer-card` bbox: `{ x: 2, y: 17.359375, width: 4, height: 17 }`
  - `best-path-card` bbox: `{ x: 2, y: 3.359375, width: 4, height: 24.734375 }`
  - `play-again-button` bbox: `{ x: 0, y: 17.09375, width: 0, height: 0 }`
  - `answer-card` region-diff: `0.1413426353407886`
  - `page-diff`: `0.17458682707497875`
- 真实资源层面目前只确认并创建了 Pages 与 D1；R2 仍需先在 Dashboard 启用，Turnstile 写操作未打通。
- Pages 项目配置写入存在权限/交互双重阻塞：
  - Cloudflare API `PATCH /pages/projects/guess-wrod` 返回 `10000: Authentication error`
  - Chrome 路径可进入 `Workers 和 Pages -> guess-wrod -> 设置`，但 D1 绑定面板保存后字段会回退为空并显示 `必需`，尚未出现稳定成功反馈。
- 目前还没有任何 Pages deployment，`guess-wrod.pages.dev` 尚未形成可验收的公网入口。

## 第一步该做什么

- 当前主仓基线已提升到 `main` 的 `ce6e89e`。
- 下一步优先级应改为：
  1. 从 `ce6e89e` 新开前端 worktree，专门收 `06-result-expired-live` 视觉差异，不复用旧 worktree 的未提交尝试。
  2. 从 `ce6e89e` 新开部署 worktree，继续处理 Pages 生产绑定、deployment 创建、远端 D1 migration/seed。
  3. 若仍需浏览器路径，优先从 Dashboard UI 进入 `Workers 和 Pages -> guess-wrod -> 设置/部署`，不要再猜直链 URL。

## 先看哪些文件/命令

- `AGENTS.md`
- `.agent-handoff/ACTIVE.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/task.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/evidence/dispatch-plan.md`
- `docs/07-implementation-plan.md`
- `docs/ui-prototypes/README.md`
- `git status --short --branch`
- `ai-task show`
- `git worktree list`
- `docs/ui-prototypes/visual-qa/report/01-home/visual-qa-report.json`
- `docs/ui-prototypes/visual-qa/report/02-game-playing/visual-qa-report.json`

## 风险

- 当前还不是可公网实玩的一局：没有可用 deployment，也没有公网链路证据。
- expired 页面视觉收尾仍未完成，不能宣称关键 visual QA 已全部过线。
- 存在一个需人工判断的残留现场：`/Users/loccen/Documents/guess-wrod-worktrees/expired-visual-qa`。
- 后续子代理不得发送 ntfy；最终通知只由主代理发送。
