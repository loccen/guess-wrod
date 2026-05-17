# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、`/api/health`、migration/seed、评分规则、评分客户端抽象、存储 repository/adapter、前端静态 mock 主流程、image2code 规格与视觉报告。
- 第二批已合入 `main`：评分客户端 `8bb623f`、存储基础 `8369b0f`、前端静态主流程 `42aaf31`。
- 第三批已合入 `main`：前端 visual QA 修复 `3719d4c`、后端基础 API `9e7a1a5`。
- 合并后验证通过：`npm run typecheck`、`npm test`、`node --test tests/domain/scoring.test.mjs`、`npm run build`、`npm run cf:check`、seed/migration、`.agent-handoff` 校验。
- `npm run dev:pages` 启动后，8 个静态路由和 `/api/health` 均返回 200；`POST /api/sessions -> POST /api/games -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}` 真实链路通过。
- 当前只剩主仓 worktree；第二批临时 worktree 和分支已清理。

## 未完成

- 前端 visual QA 仍未通过：首页报告 6 个失败项，游戏页报告 6 个失败项。
- 后端还没有 `POST /api/games/{id}/guesses`。
- 前端仍未接真实 API，请求仍是静态 mock。
- 真实 Cloudflare D1/AI Gateway/Turnstile/Analytics/R2 尚未联动；`wrangler.jsonc` 中 D1 id 仍是本地占位。

## 第一步该做什么

- 当前会话已完成第三批合并。下一步从最新 `main` 创建第四批 worktree。
- 建议第四批先派两个独立子任务：猜词提交流程、前端真实 API 接入。
- 完成一个验收一个并及时合入 `main`。
- 第三批结果和第四批建议见 `evidence/dispatch-plan.md`。

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
