# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、`/api/health`、migration/seed、评分规则、评分客户端抽象、存储 repository/adapter、前端真实主流程、image2code 规格与视觉报告。
- 当前会话新增已合入 `main`：
  - 后端 live adapter `a3a448a`
  - Cloudflare 资源基线 `05e07bd`
  - expired 数据流 `ce6e89e`
  - expired 视觉收尾 `e6cbf7c`
  - AI Gateway 请求路径修复 `bc56a44`
  - AI Gateway 鉴权头修复 `e985f4a`
  - AI Gateway BYOK alias 支持 `cf9883a`
- 主仓本地验证仍通过：`npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check`、handoff validate。
- D1 正式库 `guess-wrod-prod` 已建表并导入 50 条 `words`。
- Pages production env 已确认存在：
  - `AI_MODE=live`
  - `AI_MODEL_NAME=deepseek-v4-flash`
  - `AI_GATEWAY_ENDPOINT_URL=https://gateway.ai.cloudflare.com/v1/656612e8bac6e750ae630a5ad3320858/guess-wrod-gateway/custom-guessword-deepseek/v1`
  - `AI_GATEWAY_API_KEY`（secret）
  - `AI_GATEWAY_BYOK_ALIAS=guess-word`
- AI Gateway `guess-wrod-gateway` 已重新开启 authenticated gateway。
- 公网 `https://guess-wrod.pages.dev/api/health` 返回 `status=ok`。
- 公网 `POST /api/sessions`、`POST /api/games`、`POST /api/games/{id}/give-up`、`GET /api/games/{id}` 已可跑通。
- `06-result-expired-live` 已收敛为 only-page-level-diff，视觉不再是当前主阻塞。

## 未完成

- 公网 `POST /api/games/{id}/guesses` 仍返回 `500 system_error`，因此反馈链路无法真实触发。
- AI Gateway 历史日志显示 `provider=custom-guessword-deepseek`、`status_code=401`、`response_head=Authentication Fails (governor)`，且 `byok=null`。
- 现有 provider config 只有一条：`alias=guess-word`、`default_config=0`、`secret_preview=********ed5`。
- API 无法直接把现有 config 改成默认；Dashboard 若想改默认会要求重新提供明文 secret。
- Direct Upload UI 目前无法稳定把 `_worker.js`、`index.html`、`assets` 作为根级站点内容上传；多次 deployment 都落成 `/dist/*`，导致 production alias 与 deployment 文件结构不一致。
- `R2` 仍需先在 Dashboard 启用；Turnstile live 写操作仍未打通。

## 第一步该做什么

- 当前主仓基线已提升到 `main` 的 `cf9883a`。
- 下一步优先级：
  1. 先继续解决 AI Gateway custom provider/BYOK 401；只要公网 `POST /guesses` 还 500，就不要宣称“公网可玩”。
  2. 并行确认 Direct Upload / Wrangler 哪条路线能真正把 `_worker.js`、`index.html`、`assets` 作为根级站点内容发到 production。
  3. 一旦猜词恢复，再补公网反馈提交和至少一轮完整实玩证据。

## 先看哪些文件/命令

- `AGENTS.md`
- `.agent-handoff/ACTIVE.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/task.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/evidence/dispatch-plan.md`
- `docs/05-scoring-spec.md`
- `docs/07-implementation-plan.md`
- `git status --short --branch`
- `git worktree list`
- `ai-task show`
- `docs/ui-prototypes/visual-qa/report/06-result-expired-live/visual-qa-report.json`

## 风险

- 当前还不是可公网完整游玩的一局：公网猜词提交仍失败，反馈链路无法真实触发。
- Direct Upload 与 production alias 的根目录行为仍不稳定，容易出现最新 deployment 成功但根页面继续返回旧资源或 404。
- 仍存在一个需人工判断的残留现场：`/Users/loccen/Documents/guess-wrod-worktrees/expired-visual-qa`。
- 后续子代理不得发送 ntfy；最终通知只由主代理发送。
