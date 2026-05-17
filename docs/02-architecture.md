# H5 技术架构

## 1. 架构目标

1. 首版能快速部署为公网 H5。
2. 前端不保存答案。
3. AI 调用只发生在后端。
4. 评分、缓存、日志都能追踪。
5. 后续可平滑增加微信网页授权、每日挑战和分享能力。

## 2. 系统组成

```text
Mobile Browser / WeChat Browser
  ↓ HTTPS
H5 Frontend
  ↓ HTTPS JSON API
Backend API
  ├─ Session Service
  ├─ Game Service
  ├─ Scoring Service
  ├─ Cache Service
  └─ Event Log Service
       ↓
Database
       ↓
AI Provider API
```

## 3. 前端

### 3.1 推荐技术

| 选择 | 建议 |
| --- | --- |
| 框架 | React + Vite 或 Vue + Vite |
| UI | 移动端自定义样式，不引入重型组件库 |
| 状态 | 页面级状态 + 请求状态管理 |
| 存储 | `session_token` 存浏览器本地存储 |
| 适配 | 以 360-430px 宽度手机为主要设计目标 |

如果后续要接 SSR、SEO 或更完整路由能力，再考虑 Next.js。

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
| API 服务 | Node.js / TypeScript，或 Python / FastAPI |
| 数据库 | PostgreSQL 优先，SQLite 可用于本地开发 |
| 缓存 | V0.1 可先用数据库表，后续接 Redis |
| AI 调用 | 封装为独立 `ScoringService` |
| 部署 | 单体 API 服务即可 |

### 4.2 后端模块

| 模块 | 职责 |
| --- | --- |
| Session Service | 匿名会话创建、校验和续期 |
| Game Service | 创建游戏、状态机、答案读取 |
| Guess Service | 输入校验、计次、历史记录 |
| Scoring Service | AI 调用、输出校验、后处理 |
| Cache Service | 单局缓存、全局评分缓存 |
| Event Log Service | 埋点、错误和成本日志 |

## 5. 核心链路

### 5.1 首次访问

```text
前端打开
  ↓
检查本地 session_token
  ↓
没有 token：POST /api/sessions
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
后端选择答案并写入 games
  ↓
返回 game_id
  ↓
前端跳转游戏页
```

### 5.3 提交猜词

```text
POST /api/games/{game_id}/guesses
  ↓
校验会话和游戏状态
  ↓
归一化和敏感词检查
  ↓
标准答案 / 显式别名匹配
  ↓
单局缓存
  ↓
全局缓存
  ↓
AI 评分
  ↓
后处理、记录、返回
```

## 6. 部署形态

### 6.1 V0.1 最小部署

1. 一个 H5 静态站点。
2. 一个后端 API 服务。
3. 一个数据库。
4. 一个 AI Provider API Key。

### 6.2 域名

建议：

1. H5：`https://guess.example.com`
2. API：`https://guess-api.example.com`

也可以用同域反向代理：

1. H5：`https://guess.example.com`
2. API：`https://guess.example.com/api`

同域方案能减少跨域和 Cookie 配置成本。

## 7. 配置项

| 配置 | 说明 |
| --- | --- |
| `APP_BASE_URL` | H5 地址 |
| `API_BASE_URL` | API 地址 |
| `DATABASE_URL` | 数据库连接 |
| `AI_PROVIDER` | AI 服务商 |
| `AI_MODEL` | 默认评分模型 |
| `AI_API_KEY` | AI 密钥 |
| `SCORING_RULE_VERSION` | 评分规则版本 |
| `SESSION_TOKEN_TTL_DAYS` | 匿名会话有效期 |
| `GAME_TTL_HOURS` | 游戏有效时长 |
| `MAX_VALID_GUESSES_PER_GAME` | 单局有效猜词上限 |

## 8. 后续扩展点

1. 接入微信网页授权，把匿名用户升级为微信用户。
2. 增加 Redis，替代数据库缓存热点评分。
3. 增加每日挑战和分享页面。
4. 增加管理后台，查看词库、评分反馈和成本。
