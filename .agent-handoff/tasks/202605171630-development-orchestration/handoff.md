# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、`/api/health`、migration/seed、评分规则、评分客户端抽象、前端真实主流程、D1/adapter 边界、视觉收尾与基础 observability。
- 主仓本地验证仍通过：`npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check`、handoff validate。
- D1 正式库 `guess-wrod-prod` 已建表并导入 50 条 `words`。
- 当前主域名 `https://guess-wrod.pages.dev/api/health` 已明确命中最新 worker：
  - `runtime.version = bdc5cb5a287b`
  - `runtime.source = cf_pages_commit_sha`
  - `aiRuntime.hasAiGatewayEndpoint = true`
  - `aiRuntime.hasAiGatewayApiKey = false`
  - `aiRuntime.hasAiGatewayByokAlias = true`
- Pages production env 已确认存在过：
  - `AI_MODE=live`
  - `AI_MODEL_NAME=deepseek-v4-flash`
  - `AI_GATEWAY_ENDPOINT_URL=https://gateway.ai.cloudflare.com/v1/656612e8bac6e750ae630a5ad3320858/guess-wrod-gateway/custom-guessword-deepseek/v1`
  - `AI_GATEWAY_API_KEY`（后续为排查曾删除）
  - `AI_GATEWAY_BYOK_ALIAS=guess-word`

## 未完成

- 公网 `POST /api/games/{id}/guesses` 仍返回 `500 system_error`，反馈链路无法真实触发。
- 最新公网错误响应已能直接返回最小非敏感诊断：
  - `response_status=401`
  - `request_path=/v1/656612e8bac6e750ae630a5ad3320858/guess-wrod-gateway/custom-guessword-deepseek/v1/chat/completions`
  - `response_summary_prefix=Authentication Fails (governor)`
  - `has_gateway_auth=false`
  - `has_byok_alias=true`
  - `runtime.version=bdc5cb5a287b`
- 使用浏览器最新创建的 Authenticated Gateway token 写入本地文件后，外部探针直接打：
  - `/openai/chat/completions`
  - custom provider 路径
  都返回 Cloudflare `2009 Unauthorized`。
- 现有 provider config 仍只有一条：`alias=guess-word`、`default_config=0`、`secret_preview=********ed5`；API 无法直接改默认，Dashboard 改默认要求明文 secret。

## 第一步该做什么

- 当前主仓基线已提升到 `bdc5cb5`。
- 下一步优先级：
  1. 先继续解决 authenticated gateway token 是否可用；这是当前最强阻塞。
  2. 如果 token 路线继续 `2009 Unauthorized`，则优先回退到 provider secret/default 路线，继续验证 custom provider secret 本身是否有效。
  3. 一旦公网 `POST /guesses` 恢复成功，再补公网反馈提交和完整实玩证据。

## 风险

- 当前还不是可公网完整游玩的一局：猜词仍失败，反馈链路无法真实触发。
- 当前保留的参考/实验现场：
  - `/Users/loccen/Documents/guess-wrod-worktrees/expired-visual-qa`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v5`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v6`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v7`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v10`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v11`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v12`
