# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、D1 业务表、评分规则、前端真实主流程、视觉收尾、AI Gateway adapter 修复、health 运行时版本和 AI 配置摘要、以及公网 guess 的最小错误诊断。
- 主仓本地验证仍通过：`npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check`、handoff validate。
- D1 正式库 `guess-wrod-prod` 已建表并导入 50 条 `words`。
- 当前主域名 `https://guess-wrod.pages.dev/api/health` 已确认命中最新 worker，且包含：
  - `runtime.version = bdc5cb5a287b`
  - `runtime.source = cf_pages_commit_sha`
  - `aiRuntime.hasAiGatewayEndpoint = true`
  - `aiRuntime.hasAiGatewayApiKey = false`
  - `aiRuntime.hasAiGatewayByokAlias = true`

## 未完成

- 公网 `POST /api/games/{id}/guesses` 仍返回 `500 system_error`，反馈链路无法真实触发。
- 最新公网错误响应已能直接返回：
  - `response_status = 401`
  - `request_path = /v1/656612e8bac6e750ae630a5ad3320858/guess-wrod-gateway/custom-guessword-deepseek/v1/chat/completions`
  - `response_summary_prefix = Authentication Fails (governor)`
  - `has_gateway_auth = false`
  - `has_byok_alias = true`
  - `runtime.version = bdc5cb5a287b`
- 使用浏览器新建并写入 `/tmp/cf_aig_token.txt` 的 gateway token 做外部探针时，不论是 `/openai/chat/completions` 还是 custom provider 路径，都返回 Cloudflare `2009 Unauthorized`。
- 使用浏览器登录态到 DeepSeek 控制台后，连续新建两把新的 API key，并通过本机 shell 直接请求官方 API：
  - `https://api.deepseek.com/chat/completions`
  - `https://api.deepseek.com/v1/chat/completions`
  两条都返回 `401 authentication_error`，摘要为 `Authentication Fails, Your api key: ****ined is invalid`。
- Dashboard 当前 provider key 控制面边界：
  - 现有 key `Guess Wrod DeepSeek` 的 alias 为 `guess-word`
  - alias 输入框禁用，无法直接改成 `default`
  - 未见“设为默认”“复制配置为默认”“测试连接”
  - 要继续编辑，只能重新输入明文 `API 密钥`

## 第一步该做什么

- 当前主仓基线已提升到 `10e2068`。
- 下一步优先级：
  1. 先确认 DeepSeek 控制台当前是否能产出一把真正可用的 API key；这是现在的最高优先级。
  2. 若能拿到可用 key，再回到 Cloudflare provider config/default 路线继续推进。
  3. 若不能拿到可用 key，则当前“公网可玩”目标在现有控制面能力下存在上游实质阻塞，应保留现场并等待新的密钥来源。

## 风险

- 当前还不是可公网完整游玩的一局：猜词仍失败，反馈链路无法真实触发。
- 现有控制面边界已经比较清楚，继续在没有可用上游 key 的前提下重复尝试 Cloudflare token / alias 调整，产出很可能极低。
- 当前保留现场：
  - `/Users/loccen/Documents/guess-wrod-worktrees/expired-visual-qa`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v5`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v6`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v7`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v8`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v9`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v10`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v11`
  - `/Users/loccen/Documents/guess-wrod-worktrees/prod-deploy-v12`
