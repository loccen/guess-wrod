# H5 技术架构

## 1. 架构目标

1. 首版能快速部署为公网 H5。
2. 前端不保存答案。
3. AI 调用、日志、限流和观测都尽量留在 Cloudflare 体系内。
4. 评分、缓存、日志和成本都能追踪。
5. 后续可平滑增加微信网页授权、每日挑战和分享能力。

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

## 8. 后续扩展点

1. 接入微信网页授权，把匿名用户升级为微信用户。
2. 当单库压力上来后，按答案集或租户方向拆分 D1。
3. 增加每日挑战和分享页面。
4. 增加管理后台，查看词库、评分反馈和成本。
