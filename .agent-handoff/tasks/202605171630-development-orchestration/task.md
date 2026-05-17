# 实际开发阶段编排

- Task ID: `202605171630-development-orchestration`
- Created At: `2026-05-17T23:22:27+08:00`
- Updated At: `2026-05-18T06:39:03+08:00`
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

## 当前状态

- 已完成：主仓本地链路可跑通 `session -> game -> guess -> feedback -> give-up -> status`，类型检查、测试、构建、`cf:check`、handoff 校验通过。
- 已完成：Cloudflare 资源基线已建立并回填文档。
  - Pages 项目：`guess-wrod`
  - D1 正式库：`guess-wrod-prod`
  - AI Gateway：`guess-wrod-gateway`
- 已完成：D1 正式库已建表并导入 50 条 `words` seed。
- 已完成：expired 页面视觉已收敛为 only-page-level-diff，已不再是当前主阻塞。
- 已完成：后续已合入多轮 AI Gateway adapter 与诊断修复：
  - provider 基础 URL 自动补 `/chat/completions`
  - `cf-aig-authorization` 头替代错误的 provider `Authorization`
  - 可选发送 `cf-aig-byok-alias`
  - `/api/health` 暴露 `runtime.version`、`runtime.source`、`aiRuntime` 布尔摘要
  - `guess` 的 `system_error` 暴露最小非敏感 `debug` 摘要
- 已完成：`guess-wrod.pages.dev/api/health` 当前命中最新 worker，并返回：
  - `runtime.version = bdc5cb5a287b`
  - `runtime.source = cf_pages_commit_sha`
  - `aiRuntime.hasAiGatewayEndpoint = true`
  - `aiRuntime.hasAiGatewayApiKey = false`
  - `aiRuntime.hasAiGatewayByokAlias = true`
- 已完成：公网 `POST /api/sessions`、`POST /api/games`、`POST /api/games/{id}/give-up`、`GET /api/games/{id}` 已可跑通。
- 已完成：Wrangler OAuth 登录已成功，且 CLI 可创建 preview / production deployment。

## 未完成

- 公网 `POST /api/games/{id}/guesses` 仍返回 `500 system_error`，因此反馈链路无法真实触发。
- 最新公网 `guess` 错误摘要已经明确为：
  - `response_status = 401`
  - `request_path = /v1/656612e8bac6e750ae630a5ad3320858/guess-wrod-gateway/custom-guessword-deepseek/v1/chat/completions`
  - `response_summary_prefix = Authentication Fails (governor)`
  - `has_gateway_auth = false`
  - `has_byok_alias = true`
  - `runtime.version = bdc5cb5a287b`
- 外部探针使用最新新建并写入 `/tmp/cf_aig_token.txt` 的 gateway token 时：
  - 打 `/openai/chat/completions` 返回 Cloudflare `2009 Unauthorized`
  - 打 custom provider 路径也返回 Cloudflare `2009 Unauthorized`
- 现有 provider config 仍只有一条：`alias=guess-word`、`default_config=0`、`secret_preview=********ed5`。
- API 无法直接把现有 config 改成默认；Dashboard 若想改默认会要求重新提供明文 secret。
- `R2` 仍需先在 Dashboard 启用；Turnstile live 写操作仍未打通。

## 当前阻塞

- 当前最强阻塞已从“代码猜测”收敛到“authenticated gateway token / custom provider secret 生效链路”：
  - 要么 token 本身生成/复制后就无效
  - 要么 custom provider secret/default 与当前请求路径组合不生效
- 生产 alias 已明确命中最新 worker，因此继续在“是不是旧部署命中”上花时间价值很低。

## 下一步

- 1. 先继续解决 authenticated gateway token 与 custom provider secret/default 的 401；只要公网 `POST /guesses` 还 500，就不要宣称“公网可玩”。
- 2. 优先确认“Dashboard 新建 token 为何外部直接探针也 2009 Unauthorized”，再决定是继续走 `AI_GATEWAY_API_KEY` 路线，还是回退到 provider secret/default 路线。
- 3. 只有在公网 `POST /guesses` 恢复成功后，才继续补公网反馈提交和至少一轮完整实玩证据。
