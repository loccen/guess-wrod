# 猜不到的词 H5 文档索引

当前版本按“AI 评分版 H5 首发”整理。微信小程序不再作为 V0.1 发布目标。

## 文档列表

| 文档 | 内容 |
| --- | --- |
| [01-product-prd.md](01-product-prd.md) | 产品目标、范围、页面、玩法与验收 |
| [02-architecture.md](02-architecture.md) | 前后端架构、部署形态、运行链路 |
| [03-data-model.md](03-data-model.md) | 数据实体、表结构、缓存键、日志字段 |
| [04-api-contract.md](04-api-contract.md) | 前端与后端 HTTP API 契约 |
| [05-scoring-spec.md](05-scoring-spec.md) | AI 评分协议、归一化、关系类型、后处理 |
| [06-security-compliance.md](06-security-compliance.md) | H5 发布、内容安全、隐私和成本风险 |
| [07-implementation-plan.md](07-implementation-plan.md) | 原子任务、优先级、依赖和并行实施安排 |
| [08-analytics-and-quality.md](08-analytics-and-quality.md) | 行为分析、评分质量评估、成本指标和内测日报 |

## V0.1 默认判断

1. 发布形态：移动端 H5，可在微信内打开，也可在普通浏览器打开。
2. 核心玩法：用户输入猜测词，后端调用 AI 评分，前端只展示百分比。
3. 身份方案：先用匿名会话，不接微信登录。
4. 游戏模式：只做随机局，不做每日挑战、好友挑战、排行榜。
5. 管理方式：不做后台页面，先用数据库查询、日志和脚本处理运营数据。
6. 初期技术路线：前端、API、数据库、分析、日志与 AI 观测优先采用 Cloudflare 服务。
7. 初期评分模型：`deepseek-v4-flash`，默认走非思考模式，并通过 Cloudflare AI Gateway 调用。
8. 实现约束：虽然初期采用 Cloudflare，全体实现仍需保持可迁移，业务逻辑不得直接绑死 Cloudflare SDK 或平台专有能力。
