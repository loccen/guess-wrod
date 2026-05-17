# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、`/api/health`、migration/seed、评分规则、评分客户端抽象、存储 repository/adapter、前端静态 mock 主流程、image2code 规格与视觉报告。
- 第二批已合入 `main`：评分客户端 `8bb623f`、存储基础 `8369b0f`、前端静态主流程 `42aaf31`。
- 第三批已合入 `main`：前端 visual QA 修复 `3719d4c`、后端基础 API `9e7a1a5`。
- 第四批已合入 `main`：猜词提交流程 `166d10c`、前端真实流程 `51ff6f5`。
- 第五批已合入 `main`：前端真实猜词流程 `dbdf55e`、评分反馈接口 `bd3d226`。
- 第六批已合入 `main`：前端反馈接入 `aae5b1f`、过期规则 `57234af`。
- 第七批已合入 `main`：基础分析写入 `5a4326e`、视觉验收收尾 `c5299d8`。
- 合并后验证通过：`npm run typecheck`、`npm test`、`node --test tests/domain/scoring.test.mjs`、`npm run build`、`npm run cf:check`、seed/migration、`.agent-handoff` 校验。
- `npm run dev:pages` 启动后，8 个静态路由和 `/api/health` 均返回 200；`POST /api/sessions -> POST /api/games -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}` 真实链路通过。
- 当前主仓还能本地跑通 `POST /api/sessions -> POST /api/games -> POST /api/games/{id}/guesses -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}`。
- 当前主仓还能本地跑通 `POST /api/sessions -> POST /api/games -> POST /api/games/{id}/guesses -> GET /api/games/{id} -> POST /api/games/{id}/feedback -> POST /api/games/{id}/give-up -> GET /api/games/{id}`。
- 首页、游戏页、live guess、live feedback 四份关键 visual QA 报告当前都为 `passed=true`。
- 当前只剩主仓 worktree；第二批临时 worktree 和分支已清理。

## 未完成

- 过期/上限规则虽然有了后端，但 expired 结果页还没走完整前端真实流程验收。
- 真实 Workers Analytics Engine、R2 归档 writer、AI Gateway 成本/request id 映射还没接。
- 真实 Cloudflare D1/AI Gateway/Turnstile/Analytics/R2 尚未联动；`wrangler.jsonc` 中 D1 id 仍是本地占位。

## 第一步该做什么

- 当前会话已完成第七批合并。下一步从最新 `main` 派发更贴近上线的剩余项。
- 建议下一批优先：expired 前端真实流、真实云资源联动或 analytics live writer。
- 完成一个验收一个并及时合入 `main`。
- 第七批结果和后续建议见 `evidence/dispatch-plan.md`。

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

- 当前还不是可完整游玩的一局，只有静态 mock 前端和后端基础能力。
- 前端 visual QA 未通过，不能宣称视觉还原完成。
- 后续子代理不得发送 ntfy；最终通知只由主代理发送。
