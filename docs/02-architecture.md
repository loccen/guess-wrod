# H5 技术架构

## 1. 架构目标

1. 首版能快速部署为公网 H5。
2. 前端不保存答案。
3. AI 调用、日志、限流和观测都尽量留在 Cloudflare 体系内。
4. 评分、缓存、日志和成本都能追踪。
5. 后续可平滑增加微信网页授权、每日挑战和分享能力。

## 1.1 已确认 Cloudflare 资源（2026-05-18）

1. Account：`656612e8bac6e750ae630a5ad3320858`
2. Zone：`uuss.top`（`fc0d07f4234bbb477ee44e2a6f47e041`）
3. Pages 项目：`guess-wrod`（项目 ID：`3bd20fb8-15fd-443f-ac81-792fa3cfdd62`，默认子域：`guess-wrod.pages.dev`）
4. D1 正式库：`guess-wrod-prod`（UUID：`35412c0c-e8b9-4a0b-bf89-ddcdc89b63b3`）
5. AI Gateway：`guess-wrod-gateway`（provider alias：`guess-word`，已存在）

当前受限项：

1. R2 API 当前返回需先在 Dashboard 启用，暂未创建 bucket。
2. Turnstile API 当前认证报错，暂未创建 widget。

## 2. 系统组成

```text
Mobile Browser / WeChat Browser
  ↓ HTTPS
Cloudflare CDN / WAF / Turnstile
  ↓
Cloudflare Pages (H5 Frontend)
  ↓ same-origin /api
Cloudflare Pages Functions / Workers API
  ├─ Session Service
  ├─ Game Service
  ├─ Guess Service
  ├─ Scoring Service
  ├─ Analytics Service
  └─ Archive Service
       ├─ D1
       ├─ Workers Analytics Engine
       ├─ R2
       └─ AI Gateway
              ↓
         DeepSeek API
```

补充能力：

1. `Workers Logs`：运行时排障日志。
2. `Cron Triggers`：过期处理、日报聚合、归档任务。
3. `AI Gateway`：统一做 DeepSeek 调用、缓存、日志和成本观测。

## 3. 前端

### 3.1 推荐技术

| 选择 | 建议 |
| --- | --- |
| 框架 | React + Vite 或 Vue + Vite |
| 托管 | Cloudflare Pages |
| UI | 移动端自定义样式，不引入重型组件库 |
| 状态 | 页面级状态 + 请求状态管理 |
| 存储 | `session_token` 存浏览器本地存储 |
| 风控 | Cloudflare Turnstile，默认用于匿名会话创建，必要时用于二次校验 |
| 适配 | 以 360-430px 宽度手机为主要设计目标 |

如果后续要接 SSR、SEO 或更完整路由能力，再考虑 Cloudflare Pages + Next.js/React Router 的同体系方案。

### 3.2 前端页面

| 页面 | 路由建议 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 开始游戏、玩法说明、最近成绩 |
| 游戏页 | `/games/:gameId` | 输入猜词、展示历史 |
| 结果页 | `/games/:gameId/result` | 展示答案、次数、再来一局 |

### 3.3 前端职责

1. 创建或恢复匿名会话。
2. 发起创建游戏、提交猜词、放弃、反馈请求。
3. 展示后端返回的状态和分数。
4. 处理加载、错误、重试和页面恢复。
5. 不保存答案，不生成评分，不绕过后端状态。

## 4. 后端

### 4.1 推荐技术

| 模块 | 建议 |
| --- | --- |
| API 服务 | Cloudflare Pages Functions 或 Workers，TypeScript 优先 |
| 主数据库 | Cloudflare D1 |
| 行为分析 | Workers Analytics Engine |
| 原始归档 | Cloudflare R2 |
| AI 接入 | Cloudflare AI Gateway -> DeepSeek API |
| 人机校验 | Cloudflare Turnstile |
| 平台防护 | Cloudflare WAF + Rate Limiting |
| 观测 | Workers Logs + AI Gateway Logs |
| 定时任务 | Cron Triggers |

### 4.2 后端模块

| 模块 | 职责 |
| --- | --- |
| Session Service | 匿名会话创建、校验和续期 |
| Game Service | 创建游戏、状态机、答案读取 |
| Guess Service | 输入校验、计次、历史记录 |
| ScoringService | 经 AI Gateway 调用 `deepseek-v4-flash`，做输出校验和后处理 |
| Cache Service | 单局缓存、全局评分缓存 |
| Analytics Service | 写入行为事件、质量指标和成本镜像 |
| Archive Service | 每日把原始事件和 AI 调用记录归档到 R2 |
| Risk Control Service | Turnstile 校验、WAF 配合、请求限流 |

## 5. 核心链路

### 5.1 首次访问

```text
前端打开
  ↓
检查本地 session_token
  ↓
没有 token：获取 Turnstile token
  ↓
POST /api/sessions
  ↓
Functions 校验 Turnstile 并写入 D1
  ↓
保存 token
  ↓
进入首页
```

### 5.2 创建游戏

```text
前端点击开始
  ↓
POST /api/games
  ↓
Functions 校验会话和风控
  ↓
后端选择答案并写入 D1.games
  ↓
写入 guess_events
  ↓
返回 game_id
  ↓
前端跳转游戏页
```

### 5.3 提交猜词

```text
POST /api/games/{game_id}/guesses
  ↓
校验会话、状态和限流
  ↓
归一化和敏感词检查
  ↓
标准答案 / 显式别名匹配
  ↓
单局缓存（D1）
  ↓
全局缓存（D1）
  ↓
AI Gateway -> DeepSeek V4 Flash
  ↓
后处理、写入 D1.guesses
  ↓
写入 guess_events 和 ai_call_logs 镜像
  ↓
返回结果
```

## 6. 部署形态

### 6.1 V0.1 最小部署

1. 一个 Cloudflare Pages 项目承载 H5。
2. 一个同域 `/api` Functions/Workers API。
3. 一个 D1 数据库承载业务主数据。
4. 一个 Workers Analytics Engine 数据集承载事件分析。
5. 一个 R2 bucket 承载原始日志归档和日报产物。
6. 一个 AI Gateway 统一承接 DeepSeek 调用。

### 6.2 域名

推荐直接走同域：

1. H5：`https://guess.example.com`
2. API：`https://guess.example.com/api`

同域方案能减少跨域、Cookie 和浏览器风控成本，也更适合 Turnstile 和 WAF 规则统一管理。

## 7. 配置项

| 配置 | 说明 |
| --- | --- |
| `APP_BASE_URL` | H5 地址 |
| `API_BASE_URL` | API 地址 |
| `D1_DATABASE_NAME` | D1 数据库名 |
| `ANALYTICS_DATASET` | Workers Analytics Engine 数据集名 |
| `R2_LOG_BUCKET` | 原始日志归档 bucket |
| `TURNSTILE_SITE_KEY` | 前端 Turnstile site key |
| `TURNSTILE_SECRET_KEY` | 服务端 Turnstile secret |
| `AI_GATEWAY_BASE_URL` | AI Gateway 基础地址 |
| `AI_GATEWAY_SLUG` | AI Gateway 标识 |
| `AI_PROVIDER` | 默认 `deepseek` |
| `AI_MODEL` | 默认 `deepseek-v4-flash` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_THINKING_MODE` | 默认 `disabled` |
| `SCORING_RULE_VERSION` | 评分规则版本 |
| `SESSION_TOKEN_TTL_DAYS` | 匿名会话有效期 |
| `GAME_TTL_HOURS` | 游戏有效时长 |
| `MAX_VALID_GUESSES_PER_GAME` | 单局有效猜词上限 |

## 8. 可迁移实现约束

虽然 V0.1 默认采用 Cloudflare 全栈，但实现时必须把 Cloudflare 视为基础设施提供方，而不是业务模型本身。

### 8.1 总原则

1. 领域层、应用层不得直接依赖 Cloudflare SDK 类型、请求对象、响应对象或 binding 对象。
2. 所有 Cloudflare 特有能力只能出现在入口层和适配层，例如 Pages/Workers handler、D1 adapter、AI Gateway adapter、Turnstile adapter。
3. 前端除了 Turnstile site key 和 `/api` 地址，不应感知任何 Cloudflare 平台细节。
4. API 契约保持平台中立，不把 D1、R2、AI Gateway、Workers 之类平台名暴露给前端。

### 8.2 必须抽象的边界

实现时至少保留以下接口或等价抽象：

| 边界 | 约束 |
| --- | --- |
| 会话与游戏存储 | 通过 `SessionRepository`、`GameRepository`、`GuessRepository`、`FeedbackRepository` 一类仓储接口访问，业务逻辑不得直接写 D1 查询 |
| 全局缓存 | 通过 `ScoreCacheRepository` 访问，不得在评分业务里直接依赖 D1 |
| AI 调用 | 通过 `AiScoringClient` 或 `ScoringGateway` 访问，不得让业务层直接拼 AI Gateway 请求 |
| 事件分析 | 通过 `AnalyticsSink` 写入，不得在用例里直接调用 Workers Analytics Engine API |
| 原始归档 | 通过 `ArchiveSink` 写入，不得在业务用例里直接操作 R2 |
| 人机校验 | 通过 `CaptchaVerifier` 或 `RiskControlService` 校验，不得在业务逻辑里直接耦合 Turnstile 参数 |
| 定时任务 | Cron 入口只负责触发 use case，不得把主要业务规则写死在 Cron handler 里 |

### 8.3 代码分层建议

建议分成四层：

1. `routes/handlers`：Cloudflare Pages/Workers 入口，请求解析、鉴权、组装依赖。
2. `usecases/services`：会话、游戏、评分、反馈等业务流程。
3. `domain/models`：领域对象、枚举、错误码、规则常量。
4. `infrastructure/adapters`：D1、AI Gateway、Analytics Engine、R2、Turnstile 的具体实现。

要求：

1. `usecases/services` 不得 import Cloudflare 平台包。
2. `domain/models` 不得 import 平台包，也不得出现平台环境变量名。
3. Cloudflare bindings 到通用接口的转换只允许发生在 `routes/handlers` 或 `infrastructure/adapters`。

### 8.4 数据与 SQL 约束

1. D1 只是当前默认主库，不得把 D1 当成唯一目标数据库来写死业务模型。
2. 建表、索引和查询优先使用通用 SQL 语义，避免为方便而大量使用难以迁移的 D1 特有写法。
3. 若必须使用 D1 或 SQLite 专有能力，必须在代码注释和文档中说明替代方案。
4. 分析数据、原始归档、AI 调用镜像和业务主表必须继续分层，不能为了省事全部回写到 D1。

### 8.5 配置约束

1. 环境变量命名优先表达业务角色，而不是平台实现细节。
2. 允许存在 `D1_DATABASE_NAME`、`R2_LOG_BUCKET` 这类当前实现变量，但业务服务内部应尽量只看到通用配置对象。
3. 不得在业务代码里到处读取 `env`；应在入口层集中读取后注入。

### 8.5.1 当前项目骨架

T01 已按 Pages + Functions、React + Vite + TypeScript 初始化基础目录：

| 目录 | 当前职责 |
| --- | --- |
| `functions/` | Cloudflare Pages Functions 入口，只负责接收平台上下文并调用 routes handler |
| `src/routes/handlers/` | HTTP 请求处理、响应组装和依赖注入边界 |
| `src/usecases/services/` | 平台中立的业务服务 |
| `src/usecases/repositories/` | 平台中立 repository 接口，覆盖会话、词库、游戏、猜词、反馈、缓存、AI 调用镜像 |
| `src/domain/models/` | 平台中立的领域类型和返回模型 |
| `src/infrastructure/adapters/` | 运行时配置和后续基础设施 adapter |

当前 `/api/health` 会读取 `AI_MODE`、`CAPTCHA_MODE`、`ANALYTICS_MODE`、`ARCHIVE_MODE`，并额外读取运行时版本候选字段（`CF_PAGES_COMMIT_SHA`、`GIT_COMMIT_SHA`、`BUILD_ID`、`RUNTIME_VERSION`）。健康检查返回会包含清洗后的 `runtime.version` 与 `runtime.source`，用于区分不同 alias 实际命中的 worker 版本。`domain/models` 与 `usecases/services` 不导入 Cloudflare 类型，也不直接读取 Pages/Workers runtime 对象。

T02 后半已补存储基础：

1. `src/domain/models/storage.ts` 定义平台中立实体、枚举和新增记录类型。
2. `src/usecases/repositories/storageRepositories.ts` 定义 `SessionRepository`、`WordRepository`、`GameRepository`、`GuessRepository`、`ScoreCacheRepository`、`FeedbackRepository`、`AiCallLogRepository`。
3. `src/infrastructure/adapters/storage/sqlExecutor.ts` 定义最小 SQL executor，D1 binding 和本地 SQLite 风格执行器都只需满足 `prepare().bind().first/all/run()`。
4. `src/infrastructure/adapters/storage/sqliteStorageRepositories.ts` 提供 D1/SQLite 风格 adapter；SQL、JSON 字段转换和布尔值转换只出现在 adapter 层。
5. `src/routes/handlers/storage/createStorageRepositories.ts` 只负责从入口层 binding 组装 repository，不实现业务 API。

`wrangler.jsonc` 当前只配置本地优先的 `DB` binding，占位 `database_id` 为 `local-development-only`，不得视为已创建线上 D1 资源。需要真实 Cloudflare 联动时再读取账号资源并回填真实 ID。

### 8.6 迁移映射

| 当前默认实现 | 未来可替代方向 |
| --- | --- |
| Cloudflare Pages | 任意静态托管或自建前端服务 |
| Cloudflare Functions / Workers | Node.js / FastAPI / Go API 服务 |
| D1 | PostgreSQL / MySQL / SQLite |
| AI Gateway | 自建 AI 网关层或直接调用模型厂商 API |
| Workers Analytics Engine | ClickHouse / PostHog / 自建埋点仓 |
| R2 | 任意 S3 兼容对象存储 |
| Turnstile | hCaptcha / reCAPTCHA / 自建风控校验 |
| Cron Triggers | 系统 cron / 队列调度 / 工作流系统 |

验收时必须能回答两个问题：

1. 如果把 Cloudflare 去掉，这段业务逻辑是否还能在不改领域规则的前提下继续使用。
2. 如果把当前 provider 换掉，是否只需要重写 adapter，而不是重写业务用例。

## 9. 后续扩展点

1. 接入微信网页授权，把匿名用户升级为微信用户。
2. 当单库压力上来后，按答案集或租户方向拆分 D1。
3. 增加每日挑战和分享页面。
4. 增加管理后台，查看词库、评分反馈和成本。
