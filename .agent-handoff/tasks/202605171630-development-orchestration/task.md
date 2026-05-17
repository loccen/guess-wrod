# 实际开发阶段编排

- Task ID: `202605171630-development-orchestration`
- Created At: `2026-05-17T23:22:27+08:00`
- Updated At: `2026-05-18T04:35:44+08:00`
- Status: `active`

## 目标

- 要解决的问题：在设计文档和 H5 原型图已完成后，进入实际开发阶段，并用主代理编排、子代理实现的方式推进。
- 完成后的可见结果：仓库从纯文档状态推进到可本地启动、可测试、可继续拆分实施的 Cloudflare 全栈项目；所有具体实现由子代理在独立 worktree 完成，主代理只做派发、监督、验收、整合和交接管理。

## 范围

- 包含：任务拆分、worktree 创建、子代理派发、子代理结果验收、合并、提交、`.agent-handoff` 状态维护、最终验证与清理。
- 不包含：主代理直接编写业务代码、前端页面代码、测试代码、实现文档同步内容。

## 事实源

- AGENTS.md
- docs/02-architecture.md
- docs/04-api-contract.md
- docs/05-scoring-spec.md
- docs/07-implementation-plan.md
- docs/08-analytics-and-quality.md
- docs/ui-prototypes/images

## 关键决策

- 决策：前端视觉任务按 `image2code-skill` 走，并把 `06-result-expired-live` 收敛到只剩 page-level diff。
- 决策：云侧优先走真实资源和真实部署证据，而不是继续做本地推断。
- 决策：AI Gateway 相关问题按“请求路径 -> 鉴权头 -> BYOK alias -> provider config/default -> deployment 根目录结构”逐层拆开推进。

## 验收标准

- `python3 /Users/loccen/.codex/skills/agent-handoff/scripts/validate_handoff.py --repo-root .`
- 子任务验收必须读取 `ai-task show`、diff、提交、测试和运行证据。
- 主代理不得直接实现业务或前端代码；如子代理超过十分钟没有任何文件变更，只诊断和重派，不替代实现。
- 每个子代理必须使用独立 worktree，并维护自己的 `ai-task` 状态。
- 交付 Git 改动必须通过 `ai-commit` 中文提交；多分支合入 `main` 默认使用 `git merge --no-ff`。

## 当前状态

- 已完成：主仓本地链路可跑通 `session -> game -> guess -> feedback -> give-up -> status`，类型检查、测试、构建、`cf:check`、handoff 校验通过。
- 已完成：Cloudflare 资源基线已建立并回填文档。
  - Pages 项目：`guess-wrod`
  - D1 正式库：`guess-wrod-prod`
  - AI Gateway：`guess-wrod-gateway`
- 已完成：D1 正式库已建表并导入 50 条 `words` seed。
- 已完成：expired 页面最新视觉基线已合入 `main`，`06-result-expired-live` 仅剩 page-level diff，报告保留 `only-page-level-diff` 说明。
- 已完成：后续已合入多轮 AI Gateway adapter 修复：
  - provider 基础 URL 自动补 `/chat/completions`
  - `cf-aig-authorization` 头替代错误的 provider `Authorization`
  - 可选 `cf-aig-byok-alias`
- 已完成：Pages production env 已确认存在：
  - `AI_MODE=live`
  - `AI_MODEL_NAME=deepseek-v4-flash`
  - `AI_GATEWAY_ENDPOINT_URL=https://gateway.ai.cloudflare.com/v1/656612e8bac6e750ae630a5ad3320858/guess-wrod-gateway/custom-guessword-deepseek/v1`
  - `AI_GATEWAY_API_KEY`（secret）
  - `AI_GATEWAY_BYOK_ALIAS=guess-word`
- 已完成：AI Gateway `guess-wrod-gateway` 已重新开启 authenticated gateway。
- 已完成：公网已能跑通：
  - `GET /api/health`
  - `POST /api/sessions`
  - `POST /api/games`
  - `POST /api/games/{id}/give-up`
  - `GET /api/games/{id}` 结果页
- 未完成：公网完整一局仍未完成，`POST /api/games/{id}/guesses` 继续返回 `500 system_error`，反馈链路无法真实触发。
- 未完成：`guess-wrod.pages.dev` 的生产 alias 与最新 direct upload 根目录结构仍未完全对齐；多次 direct upload 都落成 `/dist/*` 或根目录上传未真正进入列表。
- 未完成：R2 仍提示需先在 Dashboard 启用；Turnstile live 写操作仍未打通。
- 残留现场：`/Users/loccen/Documents/guess-wrod-worktrees/expired-visual-qa` 只包含未提交的旧视觉尝试，当前不可安全清理。

## 当前阻塞

- AI Gateway 历史日志显示 `provider=custom-guessword-deepseek`、`status_code=401`、`response_head=Authentication Fails (governor)`，且 `byok=null`。
- 现有 provider config 只有一条：`alias=guess-word`、`default_config=0`、`secret_preview=********ed5`。
- API 无法直接把现有 provider config 改成默认；Dashboard 若想改默认会要求重新提供明文 secret。
- 最新 production deployment 元数据虽然已带上 `AI_GATEWAY_API_KEY(secret)`、`AI_GATEWAY_BYOK_ALIAS=guess-word` 和 custom provider endpoint，但公网猜词仍失败。
- Direct Upload UI 目前无法稳定把 `_worker.js`、`index.html`、`assets` 作为根级站点内容上传；若继续走 drag-and-drop，容易把内容落成 `/dist/*`。

## 下一步

- 1. 继续解决 AI Gateway custom provider/BYOK 的 401，优先确认 provider config secret 的真实生效条件，必要时改走别的 Gateway/provider 方案。
- 2. 并行确认 Direct Upload / Wrangler 哪条路线能真正把 `_worker.js`、`index.html`、`assets` 作为根级站点内容发到 production。
- 3. 只有在公网 `POST /api/games/{id}/guesses` 恢复成功后，才继续补公网反馈提交和至少一轮完整实玩证据。
