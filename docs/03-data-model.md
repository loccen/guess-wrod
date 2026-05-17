# 数据模型

## 1. 设计原则

1. 答案只保存在后端。
2. 匿名会话可恢复，但不绑定真实身份。
3. 猜词记录必须能复查评分来源和模型输出。
4. 缓存键必须包含评分规则版本。
5. AI 密钥、请求头、原始服务商响应不写入业务表。

## 2. 实体关系

```text
visitors 1 ── n sessions
visitors 1 ── n games
games 1 ── n guesses
words 1 ── n games
words 1 ── n score_cache
guesses 1 ── n score_feedback
```

## 3. 表结构

### 3.1 `visitors`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 访客 ID |
| `created_at` | datetime | 首次访问时间 |
| `last_seen_at` | datetime | 最近访问时间 |
| `user_agent_hash` | string nullable | 用于粗略排查异常，不保存完整 UA |

### 3.2 `sessions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 会话 ID |
| `visitor_id` | string | 访客 ID |
| `session_token_hash` | string | 会话 token 哈希 |
| `expires_at` | datetime | 过期时间 |
| `created_at` | datetime | 创建时间 |
| `revoked_at` | datetime nullable | 主动作废时间 |

### 3.3 `words`

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

### 3.4 `games`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 游戏 ID |
| `visitor_id` | string | 访客 ID |
| `answer_id` | string | 答案 ID |
| `status` | enum | `playing/success/give_up/expired` |
| `rule_version` | string | 评分规则版本 |
| `model_name` | string | 当前模型 |
| `guess_count` | int | 有效猜词次数 |
| `best_guess_id` | string nullable | 当前最高分猜词 |
| `started_at` | datetime | 开始时间 |
| `ended_at` | datetime nullable | 结束时间 |
| `expire_reason` | string nullable | `guess_limit/ttl` |

默认不保存 `answer_word` 明文快照。展示答案时按 `answer_id` 查询词库。

### 3.5 `guesses`

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
| `reason` | text nullable | AI 解释，仅后台使用 |
| `source` | string | `exact_match/game_cache/global_cache/model/fallback` |
| `counted` | boolean | 是否计入有效次数 |
| `reject_reason` | string nullable | 拒绝原因 |
| `was_rule_adjusted` | boolean | 是否经过规则修正 |
| `created_at` | datetime | 创建时间 |

建议唯一约束：

```text
unique(game_id, guess_normalized) where counted = true
```

### 3.6 `score_cache`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cache_key` | string | 缓存键 |
| `answer_id` | string | 答案 ID |
| `guess_normalized` | string | 归一化猜词 |
| `rule_version` | string | 评分规则版本 |
| `model_name` | string | 产出缓存的模型 |
| `score` | int | 最终分数 |
| `ai_score` | int nullable | AI 原始分数 |
| `relation_type` | string | 关系类型 |
| `reason` | text nullable | 后台解释 |
| `created_at` | datetime | 创建时间 |
| `hit_count` | int | 命中次数 |
| `last_hit_at` | datetime nullable | 最近命中时间 |

缓存键：

```text
sha256(answer_id + ":" + guess_normalized + ":" + rule_version)
```

### 3.7 `score_feedback`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 反馈 ID |
| `game_id` | string | 游戏 ID |
| `guess_id` | string | 猜词 ID |
| `visitor_id` | string | 访客 ID |
| `feedback_type` | string | `score_unreasonable` |
| `note` | text nullable | 用户补充 |
| `created_at` | datetime | 创建时间 |

### 3.8 `event_logs`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 日志 ID |
| `visitor_id` | string nullable | 访客 ID |
| `game_id` | string nullable | 游戏 ID |
| `event_name` | string | 事件名 |
| `payload` | json | 脱敏后的事件字段 |
| `created_at` | datetime | 创建时间 |

### 3.9 `ai_call_logs`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 调用日志 ID |
| `game_id` | string | 游戏 ID |
| `guess_id` | string nullable | 猜词 ID |
| `provider` | string | AI 服务商 |
| `model_name` | string | 模型 |
| `rule_version` | string | 评分规则版本 |
| `input_tokens` | int nullable | 输入 token |
| `output_tokens` | int nullable | 输出 token |
| `latency_ms` | int | 调用耗时 |
| `status` | string | `success/timeout/error/invalid_json` |
| `error_code` | string nullable | 错误码 |
| `created_at` | datetime | 创建时间 |

不记录完整 prompt、密钥、请求头、服务商原始响应。需要排查时记录脱敏摘要。

## 4. 枚举

### 4.1 游戏状态

```text
playing
success
give_up
expired
```

### 4.2 评分来源

```text
exact_match
game_cache
global_cache
model
fallback
```

### 4.3 拒绝原因

```text
invalid_guess
sensitive_word
game_ended
rate_limited
ai_timeout
system_error
duplicate_guess
```

### 4.4 关系类型

见 [05-scoring-spec.md](05-scoring-spec.md)。

## 5. 索引建议

| 表 | 索引 |
| --- | --- |
| `sessions` | `session_token_hash`, `visitor_id` |
| `games` | `visitor_id`, `status`, `answer_id`, `started_at` |
| `guesses` | `game_id`, `visitor_id`, `guess_normalized`, `created_at` |
| `score_cache` | `cache_key`, `answer_id`, `guess_normalized`, `rule_version` |
| `score_feedback` | `game_id`, `guess_id`, `created_at` |
| `ai_call_logs` | `game_id`, `status`, `created_at` |
