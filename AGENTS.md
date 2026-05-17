# guess-wrod Agent Rules

本文件只定义仓库级强约束。具体产品、接口、评分、分析和实施细节，按需继续读取：

1. [docs/02-architecture.md](docs/02-architecture.md)
2. [docs/04-api-contract.md](docs/04-api-contract.md)
3. [docs/05-scoring-spec.md](docs/05-scoring-spec.md)
4. [docs/07-implementation-plan.md](docs/07-implementation-plan.md)
5. [docs/08-analytics-and-quality.md](docs/08-analytics-and-quality.md)

## 1. 总原则

1. 当前默认技术路线是 Cloudflare 全栈，但实现不得绑死 Cloudflare。
2. 业务层和领域层不得直接依赖 D1、R2、AI Gateway、Workers Analytics Engine、Turnstile、Workers/Pages runtime 对象。
3. 所有平台能力必须通过适配层暴露给业务层。
4. 前端和 API 契约保持平台中立，不把 Cloudflare 平台名暴露给用户侧。

## 2. 本地开发默认模式

本地调测优先追求快反馈，不默认依赖真实线上能力。

1. 前端和 API 本地统一用 `wrangler pages dev` 跑。
2. D1 默认使用本地数据库与本地 migration，不默认直连远端库。
3. AI 默认使用 `stub` 模式；只有在专门验证评分链路时才切 `live` 模式调用 `deepseek-v4-flash`。
4. Turnstile 默认使用本地 `bypass` 验证器；只有在专门验证风控链路时才切真实校验。
5. Analytics 默认使用 `noop` 或本地 file sink；Archive 默认使用本地 file sink。
6. 不要把“本地临时放行”写进业务规则；本地放行只能存在于 adapter 或开发配置层。

建议至少区分这些本地模式开关：

1. `AI_MODE=stub|live`
2. `CAPTCHA_MODE=bypass|live`
3. `ANALYTICS_MODE=noop|live`
4. `ARCHIVE_MODE=file|live`

## 3. 代码边界

至少保留这些接口或等价抽象：

1. `SessionRepository` / `GameRepository` / `GuessRepository` / `FeedbackRepository`
2. `ScoreCacheRepository`
3. `AiScoringClient` 或 `ScoringGateway`
4. `AnalyticsSink`
5. `ArchiveSink`
6. `RiskControlService` 或 `CaptchaVerifier`

建议目录责任：

1. `routes/handlers`：Cloudflare 入口、请求解析、依赖装配
2. `usecases/services`：业务流程
3. `domain/models`：领域模型、枚举、错误码
4. `infrastructure/adapters`：D1、AI Gateway、R2、Analytics、Turnstile 实现

## 4. 开发顺序

默认按这个顺序推进：

1. 先改领域模型和 use case
2. 再补 repository / adapter 接口
3. 最后接 Cloudflare 实现
4. 完成后先过本地 `stub` 链路，再做一次真实 `live` 集成验证

## 5. 文档同步

如果改动影响下列任一项，必须同步更新对应文档：

1. 架构或边界：更新 [docs/02-architecture.md](docs/02-architecture.md)
2. 接口或错误码：更新 [docs/04-api-contract.md](docs/04-api-contract.md)
3. 评分规则或模型模式：更新 [docs/05-scoring-spec.md](docs/05-scoring-spec.md)
4. 本地开发、任务拆分、验收口径：更新 [docs/07-implementation-plan.md](docs/07-implementation-plan.md)
5. 事件、成本、分析口径：更新 [docs/08-analytics-and-quality.md](docs/08-analytics-and-quality.md)

## 6. 验收重点

除了功能正确，还必须回答：

1. 去掉 Cloudflare 后，这段业务逻辑是否还能保留不变。
2. 更换数据库、AI 网关或验证码服务后，是否只需要替换 adapter。
