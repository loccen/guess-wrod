# 数据模型

## 1. 设计原则

1. 答案只保存在后端。
2. 匿名会话可恢复，但不绑定真实身份。
3. 猜词记录必须能复查评分来源、模型版本和网关调用状态。
4. 缓存键必须包含评分规则版本、模型和思考模式。
5. AI 密钥、请求头、完整 prompt、完整响应正文不写入 D1 业务表。
6. 事务数据、分析数据和原始归档分层存储，不把所有日志都塞进 D1。
7. D1 只是当前默认主库，表结构和查询方式应尽量保持迁移到 PostgreSQL/MySQL 时可平移。

## 2. 存储分工

| 存储 | 承载内容 | 用途 |
| --- | --- | --- |
| Cloudflare D1 | `visitors`、`sessions`、`words`、`games`、`guesses`、`score_cache`、`score_feedback`、`ai_call_logs` | 业务主数据、结果回查、少量成本镜像 |
| Workers Analytics Engine | `guess_events` 数据集 | 漏斗、质量指标、延迟分析 |
| AI Gateway Logs | 原始 AI 请求观测 | token、耗时、缓存、错误、成本 |
| Cloudflare R2 | `events/`、`ai-calls/`、`reports/` 归档对象 | 原始样本、日报产物、后续离线分析 |

## 3. D1 主库实体关系

```text
visitors 1 ── n sessions
visitors 1 ── n games
games 1 ── n guesses
words 1 ── n games
words 1 ── n score_cache
guesses 1 ── n score_feedback
guesses 1 ── n ai_call_logs
```

## 4. D1 主库表结构

### 4.1 `visitors`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 访客 ID |
| `created_at` | datetime | 首次访问时间 |
| `last_seen_at` | datetime | 最近访问时间 |
| `user_agent_hash` | string nullable | 用于粗略排查异常，不保存完整 UA |

### 4.2 `sessions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 会话 ID |
| `visitor_id` | string | 访客 ID |
| `session_token_hash` | string | 会话 token 哈希 |
| `expires_at` | datetime | 过期时间 |
| `created_at` | datetime | 创建时间 |
| `revoked_at` | datetime nullable | 主动作废时间 |
| `turnstile_passed_at` | datetime nullable | 最近一次通过 Turnstile 的时间 |

### 4.3 `words`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 词条 ID |
| `word` | string | 标准答案 |
| `word_normalized` | string | 归一化标准答案 |
| `aliases` | json | 显式等价答案 |
| `categories` | json | 分类 |
| `tags` | json | 标签 |
| `difficulty` | enum | `easy/normal/hard` |
| `enabled` | boolean | 是否启用 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

样例：

```json
{
  "id": "word_000001",
  "word": "手机",
  "word_normalized": "手机",
  "aliases": ["智能手机", "移动电话", "📱"],
  "categories": ["电子产品", "通讯工具", "日常物品"],
  "tags": ["可携带", "可充电", "可拍照", "可上网"],
  "difficulty": "easy",
  "enabled": true
}
```

`电话` 不放入 `aliases`，它是 `synonym` 类型评分样例。

### 4.4 `games`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 游戏 ID |
| `visitor_id` | string | 访客 ID |
| `answer_id` | string | 答案 ID |
| `status` | enum | `playing/success/give_up/expired` |
| `rule_version` | string | 评分规则版本 |
| `model_name` | string | 当前模型，初期默认 `deepseek-v4-flash` |
| `thinking_mode` | string | `disabled/enabled` |
| `guess_count` | int | 有效猜词次数 |
| `best_guess_id` | string nullable | 当前最高分猜词 |
| `started_at` | datetime | 开始时间 |
| `ended_at` | datetime nullable | 结束时间 |
| `expires_at` | datetime nullable | 计划过期时间 |
| `expire_reason` | string nullable | `guess_limit/ttl` |

默认不保存 `answer_word` 明文快照。展示答案时按 `answer_id` 查询词库。

### 4.5 `guesses`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 猜词 ID |
| `game_id` | string | 游戏 ID |
| `visitor_id` | string | 访客 ID |
| `guess_raw` | string | 原始输入 |
| `guess_normalized` | string | 归一化输入 |
| `score` | int nullable | 最终展示分数 |
| `ai_score` | int nullable | AI 原始分数 |
| `relation_type` | string nullable | 关系类型 |
| `reason` | text nullable | AI 解释摘要，仅后台使用 |
| `source` | string | `exact_match/game_cache/global_cache/model/fallback` |
| `counted` | boolean | 是否计入有效次数 |
| `reject_reason` | string nullable | 拒绝原因 |
| `was_rule_adjusted` | boolean | 是否经过规则修正 |
| `created_at` | datetime | 创建时间 |

建议唯一约束：

```text
unique(game_id, guess_normalized) where counted = true
```

### 4.6 `score_cache`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cache_key` | string | 缓存键 |
| `answer_id` | string | 答案 ID |
| `guess_normalized` | string | 归一化猜词 |
| `rule_version` | string | 评分规则版本 |
| `provider` | string | 初期默认 `deepseek` |
| `model_name` | string | 产出缓存的模型 |
| `thinking_mode` | string | `disabled/enabled` |
| `score` | int | 最终分数 |
| `ai_score` | int nullable | AI 原始分数 |
| `relation_type` | string | 关系类型 |
| `reason` | text nullable | 后台解释摘要 |
| `created_at` | datetime | 创建时间 |
| `hit_count` | int | 命中次数 |
| `last_hit_at` | datetime nullable | 最近命中时间 |

缓存键：

```text
sha256(answer_id + ":" + guess_normalized + ":" + rule_version + ":" + model_name + ":" + thinking_mode)
```

### 4.7 `score_feedback`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 反馈 ID |
| `game_id` | string | 游戏 ID |
| `guess_id` | string | 猜词 ID |
| `visitor_id` | string | 访客 ID |
| `feedback_type` | string | `score_unreasonable` |
| `note` | text nullable | 用户补充 |
| `created_at` | datetime | 创建时间 |

### 4.8 `ai_call_logs`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 调用日志 ID |
| `game_id` | string | 游戏 ID |
| `guess_id` | string nullable | 猜词 ID |
| `provider` | string | AI 服务商，初期默认 `deepseek` |
| `model_name` | string | 模型，初期默认 `deepseek-v4-flash` |
| `thinking_mode` | string | `disabled/enabled` |
| `gateway_slug` | string nullable | AI Gateway 标识；本地 stub 模式可为空 |
| `gateway_request_id` | string nullable | AI Gateway 请求 ID |
| `provider_request_id` | string nullable | DeepSeek 请求 ID |
| `rule_version` | string | 评分规则版本 |
| `input_tokens` | int nullable | 输入 token |
| `output_tokens` | int nullable | 输出 token |
| `cache_status` | string nullable | `hit/miss/bypass` |
| `latency_ms` | int | 调用耗时 |
| `estimated_cost_usd` | decimal nullable | 估算成本 |
| `status` | string | `success/timeout/error/invalid_json` |
| `error_code` | string nullable | 错误码 |
| `archive_object_key` | string nullable | 对应 R2 归档对象路径 |
| `created_at` | datetime | 创建时间 |

说明：

1. D1 里的 `ai_call_logs` 只保留最小镜像，方便和 `games`、`guesses` 关联。
2. 完整 prompt、完整响应、思维链和大文本日志应保留在 AI Gateway 日志或 R2 归档里。

## 4.9 本地 migration 与 seed 资料

首版本地资料位置：

1. `migrations/0001_initial_business_tables.sql`：SQLite / 本地 D1 可执行的业务主数据表草案，覆盖 `visitors`、`sessions`、`words`、`games`、`guesses`、`score_cache`、`score_feedback`、`ai_call_logs`。
2. `data/seed-words.v0.1.json`：50 条本地测试词条，字段与 `words` 表一致。
3. `data/sensitive-terms.v0.1.txt`：敏感词初筛清单，用于 seed 检查和后续输入过滤资料。
4. `scripts/validate-seed.mjs`：无第三方依赖的 seed 校验脚本，检查重复、空值、归一化和敏感词命中。
5. `scripts/print-word-seed-sql.mjs`：无第三方依赖的词库 SQL 生成脚本，可把 JSON seed 导入 `words` 表。

## 4.10 Repository 与 adapter 基线

当前代码已按首版业务表提供平台中立 repository 接口：

| 接口 | 主要表 | 说明 |
| --- | --- | --- |
| `SessionRepository` | `visitors`、`sessions` | 访客 upsert、会话创建、token hash 查询、撤销 |
| `WordRepository` | `words` | 词条 upsert、按 ID 查询、按归一化答案查询、启用词列表 |
| `GameRepository` | `games` | 创建游戏、按 ID 查询、访客游戏列表、计数和结束状态更新 |
| `GuessRepository` | `guesses` | 写入猜词、查重、按游戏读取历史 |
| `ScoreCacheRepository` | `score_cache` | 写入全局评分缓存、按身份字段查询、记录命中 |
| `FeedbackRepository` | `score_feedback` | 写入和读取评分反馈 |
| `AiCallLogRepository` | `ai_call_logs` | 写入和读取 AI 调用最小镜像 |

接口位置为 `src/usecases/repositories/storageRepositories.ts`，领域类型位置为 `src/domain/models/storage.ts`。业务层只依赖这些类型，不依赖 D1 或 Workers runtime。

当前 adapter 位置为 `src/infrastructure/adapters/storage/sqliteStorageRepositories.ts`，它只依赖最小 `SqlExecutor`：

```ts
prepare(sql).bind(...values).first/all/run
```

该形状与 D1 prepared statement 兼容，也方便用本地 SQLite 或 fake executor 做测试。JSON 数组、`0/1` 布尔值和 snake_case/camelCase 字段转换都限制在 adapter 内。

`wrangler.jsonc` 已声明本地开发 `DB` binding。当前没有创建真实 Cloudflare D1 数据库；线上资源创建和真实 ID 回填应由专门部署任务处理。

## 5. 分析与归档结构

### 5.1 `guess_events`（Workers Analytics Engine 数据集）

该数据集不要求关系型表结构，按数据点写入。建议字段如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_name` | string | 事件名 |
| `event_time` | datetime | 事件时间 |
| `visitor_id_hash` | string | 脱敏后的访客标识 |
| `session_id` | string nullable | 会话 ID |
| `page` | string nullable | 页面 |
| `game_id` | string nullable | 游戏 ID |
| `answer_id` | string nullable | 答案 ID |
| `guess_id` | string nullable | 猜词 ID |
| `relation_type` | string nullable | 关系类型 |
| `source` | string nullable | 评分来源 |
| `model_name` | string nullable | 模型名 |
| `rule_version` | string nullable | 评分规则版本 |
| `score` | number nullable | 分数 |
| `guess_count` | number nullable | 当前有效次数 |
| `latency_ms` | number nullable | 接口耗时 |
| `duration_ms` | number nullable | 局耗时 |
| `counted` | boolean nullable | 是否计次 |
| `error_code` | string nullable | 错误码 |

### 5.2 R2 归档对象

建议目录布局：

```text
events/2026-05-17/guess-events-0001.jsonl.gz
ai-calls/2026-05-17/ai-calls-0001.jsonl.gz
reports/2026-05-17/daily-report.md
```

用途：

1. 保留原始事件样本。
2. 保留 AI 调用脱敏原件。
3. 生成日报、异常样本包和后续离线分析输入。

## 6. 枚举

### 6.1 游戏状态

```text
playing
success
give_up
expired
```

### 6.2 评分来源

```text
exact_match
game_cache
global_cache
model
fallback
```

### 6.3 拒绝原因

```text
invalid_guess
sensitive_word
game_ended
rate_limited
turnstile_required
turnstile_failed
ai_timeout
system_error
duplicate_guess
```

### 6.4 关系类型

见 [05-scoring-spec.md](05-scoring-spec.md)。

## 7. 索引建议

| 表 | 索引 |
| --- | --- |
| `sessions` | `session_token_hash`, `visitor_id` |
| `games` | `visitor_id`, `status`, `answer_id`, `started_at` |
| `guesses` | `game_id`, `visitor_id`, `guess_normalized`, `created_at` |
| `score_cache` | `cache_key`, `answer_id`, `guess_normalized`, `rule_version`, `model_name`, `thinking_mode` |
| `score_feedback` | `game_id`, `guess_id`, `created_at` |
| `ai_call_logs` | `game_id`, `guess_id`, `status`, `created_at`, `gateway_request_id` |
