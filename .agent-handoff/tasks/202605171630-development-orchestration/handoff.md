# 实际开发阶段编排 Handoff

## 已验证基线

- 当前 `main` 已包含：React + Vite + Pages Functions 骨架、D1 业务表、评分规则、前端真实主流程、视觉收尾、AI Gateway adapter 修复、health 运行时版本和 AI 配置摘要、以及公网 guess 的最小错误诊断。
- 主仓本地验证仍通过：`npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check`、handoff validate。
- D1 正式库 `guess-wrod-prod` 已建表并导入 50 条 `words`。
- 当前主域名 `https://guess-wrod.pages.dev/api/health` 已确认命中最新 worker，且包含：
  - `runtime.version = 03670e15b594`
  - `runtime.source = cf_pages_commit_sha`
  - `aiRuntime.hasAiGatewayEndpoint = false`
  - `aiRuntime.hasAiGatewayApiKey = true`
  - `aiRuntime.hasAiGatewayByokAlias = true`
  - `modes.captchaMode = live`
  - `modes.archiveMode = live`
  - `captchaRuntime.hasTurnstileSiteKey = true`
- 当前 production 真实浏览器链路已验证可完整游玩一局：
  - 首页正常渲染，Turnstile 自动成功。
  - “开始一局”可进入真实 game 页面。
  - 提交猜词 `phone` 成功返回 `55% / 弱相关`。
  - “放弃看答案”成功进入 give-up 结果页，答案显示 `肥皂 / 香皂`。
  - “再来一局”后回到首页。
- live archive 已收到真实公网样本：`guess-wrod-archive` 中出现 `ai_call_logs/2026-05-18T01:57:56.962Z`。
- `main` 已合入 health 摘要修正提交，后续部署后 `hasAiGatewayEndpoint` 会优先读取 `AI_GATEWAY_ENDPOINT_URL`。

## 未完成

- 当前 `M3 前端主流程` 与 `T32 Cloudflare 部署配置` 已有真实公网证据，可视为已满足“手机浏览器可完整游玩”“公网可访问”的要求。
- 当前主要未完成项转为 `M4 质量与内测`：
  - T22：真实 Workers Analytics Engine 事件写入仍未接通。
  - T23：`ai_call_logs` 仍缺 token/cache/cost/request-id 等 AI Gateway 观测字段。
  - T27/T28/T29：日报聚合、评分质量分析、成本分析脚本与产物尚未实现。
  - T33：上线前检查里的“日报均通过”尚未满足。
- 当前 production 仍是 `analyticsMode=noop`，所以即使公网主流程可用，也还不能按文档口径说“可邀请小范围试玩”。

## 第一步该做什么

- 当前主仓基线已提升到 `16faa1f`。
- 下一步优先级：
  1. 先补 T22：把 `LiveAnalyticsSink` 从 `console.log` 升到真实 Workers Analytics Engine dataset 写入，并把 binding 配进代码与 Cloudflare 配置。
  2. 再补 T23：让 AI 评分链路把 `input_tokens`、`output_tokens`、`cache_status`、`estimated_cost_usd`、`gateway_request_id`、`provider_request_id` 等观测字段写进 `ai_call_logs` / archive。
  3. 最后补 T27/T28/T29：新增日报聚合脚本和 `daily-report.md` 生成链路，把内测前最低要求补齐。

## 风险

- 旧的“公网 guess 500 / 上游 key 阻塞”结论已经失效，不应再作为主线判断。
- 当前最大的真实风险不是玩法可用性，而是观测数据不足，导致 M4 / T33 无法按文档验收。
- `guess_events` 事件模型还不完整，缺 `page_view`、`session_restored`、`replay_started` 与 `guess_submitted.latency_ms`，会影响漏斗和 P90 耗时统计。
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
