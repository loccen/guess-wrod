# 行为分析与评分质量评估

## 1. 目标

本文件定义 V0.1 内测阶段如何使用埋点、业务表和 AI 调用日志判断三个问题：

1. 用户是否愿意完成一局并继续玩。
2. AI 评分是否稳定、合理、可调。
3. 模型调用成本和响应速度是否可控。

埋点只记录事实，分析机制负责把事实转成指标、排行和待处理样本。

## 2. 数据来源

| 数据源 | 用途 |
| --- | --- |
| `event_logs` | 行为漏斗、复玩、异常事件 |
| `games` | 游戏状态、完成率、放弃率、耗时 |
| `guesses` | 猜词次数、分数分布、关系类型分布、缓存命中 |
| `score_feedback` | 用户标记的不合理评分 |
| `score_cache` | 全局缓存命中和热门答案猜词 |
| `ai_call_logs` | AI 调用次数、耗时、错误、token 和成本 |
| 人工样本集 | 评分规则回归测试和模型对比 |

## 3. 事件字段规范

### 3.1 通用字段

所有 `event_logs.payload` 建议包含：

| 字段 | 说明 |
| --- | --- |
| `visitor_id` | 匿名访客 ID |
| `session_id` | 会话 ID |
| `event_time` | 事件时间 |
| `client_ts` | 前端上报时间，可选 |
| `page` | 当前页面 |
| `referrer` | 来源页面，可选 |
| `user_agent_hash` | 浏览器信息摘要，可选 |

### 3.2 游戏事件字段

| 事件 | 必填字段 |
| --- | --- |
| `game_created` | `game_id`, `answer_id`, `rule_version` |
| `guess_submitted` | `game_id`, `guess_id`, `answer_id`, `score`, `relation_type`, `source`, `counted`, `guess_count`, `latency_ms`, `model_name`, `rule_version` |
| `guess_reused` | `game_id`, `guess_id`, `answer_id`, `normalized_guess`, `score`, `guess_count` |
| `game_success` | `game_id`, `answer_id`, `guess_count`, `duration_ms`, `best_score` |
| `game_give_up` | `game_id`, `answer_id`, `guess_count`, `duration_ms`, `best_score` |
| `game_expired` | `game_id`, `answer_id`, `reason`, `guess_count`, `duration_ms`, `best_score` |
| `score_feedback_submitted` | `game_id`, `guess_id`, `answer_id`, `score`, `relation_type`, `feedback_type` |
| `ai_error` | `game_id`, `guess_id`, `answer_id`, `error_code`, `model_name`, `rule_version` |

## 4. 行为分析

### 4.1 漏斗

V0.1 每日行为漏斗：

```text
访问 H5
  ↓
创建或恢复会话
  ↓
创建游戏
  ↓
提交首次猜词
  ↓
产生第 3 次有效猜词
  ↓
游戏结束
  ↓
猜中
  ↓
再来一局
```

### 4.2 指标公式

| 指标 | 公式 |
| --- | --- |
| 开局率 | `game_created visitors / active visitors` |
| 首猜率 | `first_guess games / created games` |
| 深度猜测率 | `games with guess_count >= 3 / created games` |
| 完成率 | `success games / created games` |
| 放弃率 | `give_up games / created games` |
| 过期率 | `expired games / created games` |
| 复玩率 | `visitors with games >= 2 / active visitors` |
| 平均有效猜词次数 | `sum(guess_count) / ended games` |
| 中位有效猜词次数 | `median(guess_count of ended games)` |
| 平均完成耗时 | `avg(duration_ms of success games)` |

### 4.3 行为判断规则

| 现象 | 可能问题 | 优先检查 |
| --- | --- | --- |
| 开局率低 | 首页不清楚、加载慢、按钮不明显 | 首屏耗时、首页点击 |
| 首猜率低 | 游戏页不知如何操作、输入体验差 | 游戏页停留、错误提示 |
| 放弃率高 | 题太难、反馈误导 | 答案难度、最高分路径 |
| 过期率高 | 猜测上限太高或用户离开 | 有效猜词次数分布 |
| 复玩率低 | 结果页动力不足、评分体验差 | 结果页再来一局点击 |

## 5. 评分质量评估

### 5.1 核心指标

| 指标 | 公式或口径 |
| --- | --- |
| 评分反馈率 | `score_feedback count / counted guesses` |
| 答案反馈率 | `feedback count by answer_id / guesses by answer_id` |
| 关系类型反馈率 | `feedback count by relation_type / guesses by relation_type` |
| 高分放弃率 | `give_up games with best_score >= 80 / give_up games` |
| 高分未猜中率 | `non-success games with best_score >= 85 / ended games` |
| 低分猜中前跳跃 | 猜中前一次分数低于 50 的成功局占比 |
| 上限修正率 | `was_rule_adjusted guesses / model guesses` |
| AI 非法响应率 | `invalid_json ai calls / ai calls` |

### 5.2 问题样本优先级

优先人工复查这些样本：

1. 用户提交评分反馈的猜词。
2. 放弃前最高分 >= 80 的游戏。
3. 非猜中词被打到 >= 90 的猜词。
4. 同一 `answer_id + guess_normalized` 多次被反馈。
5. 某个 `relation_type` 反馈率明显高于平均值。
6. 被后端上限修正的高频猜词。
7. AI 返回 `is_exact=true` 但本地词库未命中的猜词。

### 5.3 答案维度质量排行

每日生成以下排行：

| 排行 | 用途 |
| --- | --- |
| 最高放弃率答案 | 找过难或误导性答案 |
| 最高反馈率答案 | 找评分争议答案 |
| 平均猜词次数最高答案 | 找难度过高答案 |
| 平均猜词次数最低答案 | 找过简单答案 |
| 高分未猜中最多答案 | 找容易误导的答案 |
| AI 调用次数最高答案 | 找高成本热门答案 |

### 5.4 关系类型质量排行

按 `relation_type` 每日统计：

1. 猜词数量。
2. 平均分。
3. 反馈数量。
4. 反馈率。
5. 上限修正率。
6. 猜中前最后一次关系类型分布。

用途：判断某类关系是否整体偏高或偏低。例如 `service_context` 反馈率高，可能说明服务场景词给分太高。

## 6. 人工样本集机制

### 6.1 样本结构

```json
{
  "answer": "手机",
  "guess": "电话",
  "expected_relation_type": "synonym",
  "expected_score_min": 90,
  "expected_score_max": 95,
  "note": "近义词但不是显式别名"
}
```

### 6.2 使用方式

1. 每次调整 prompt、模型、关系上限或词库别名后运行一次。
2. 记录通过率、越界样本和严重错误样本。
3. 与线上反馈样本合并，定期扩充样本集。

### 6.3 通过标准

| 项目 | 标准 |
| --- | --- |
| 总体通过率 | >= 80% |
| `exact/alias` | 100% |
| 明显无关词高分 | 0 个严重样本 |
| 强搭配词越上限 | 0 个严重样本 |

## 7. 成本与性能分析

### 7.1 核心指标

| 指标 | 公式 |
| --- | --- |
| 单局平均 AI 调用 | `ai calls / games` |
| 单次平均 token | `(input_tokens + output_tokens) / ai calls` |
| 单局平均 token | `total tokens / games` |
| 单局平均成本 | `total ai cost / games` |
| AI 超时率 | `timeout ai calls / ai calls` |
| AI 错误率 | `error ai calls / ai calls` |
| 单局缓存命中率 | `game_cache guesses / all guess requests` |
| 全局缓存命中率 | `global_cache guesses / counted guesses` |
| P90 评分耗时 | `p90(guess request latency_ms)` |

### 7.2 成本判断规则

| 现象 | 处理 |
| --- | --- |
| 单局 AI 调用过高 | 检查重复猜词缓存、限流、单局上限 |
| 全局缓存命中率低 | 检查答案分布、热门词、缓存键版本 |
| token 过高 | 缩短 prompt，不传历史 |
| 超时率高 | 降低模型复杂度或调整超时 |
| 错误率高 | 检查 JSON 模式、重试策略和模型稳定性 |

## 8. 聚合表或视图

V0.1 可以先用 SQL 视图或定时脚本生成，不强制做管理后台。

### 8.1 `daily_behavior_metrics`

| 字段 | 说明 |
| --- | --- |
| `date` | 日期 |
| `active_visitors` | 活跃访客 |
| `created_games` | 创建局数 |
| `first_guess_games` | 有首猜的局数 |
| `success_games` | 猜中局数 |
| `give_up_games` | 放弃局数 |
| `expired_games` | 过期局数 |
| `replay_visitors` | 玩 2 局以上访客 |
| `avg_guess_count` | 平均有效猜词次数 |
| `median_guess_count` | 中位有效猜词次数 |

### 8.2 `daily_scoring_quality`

| 字段 | 说明 |
| --- | --- |
| `date` | 日期 |
| `answer_id` | 答案 ID，可为空表示全局 |
| `relation_type` | 关系类型，可为空表示全局 |
| `counted_guesses` | 有效猜词数 |
| `feedback_count` | 反馈数 |
| `feedback_rate` | 反馈率 |
| `adjusted_count` | 后端修正数 |
| `adjusted_rate` | 修正率 |
| `high_score_non_success_count` | 高分未猜中样本数 |

### 8.3 `daily_ai_cost`

| 字段 | 说明 |
| --- | --- |
| `date` | 日期 |
| `provider` | AI 服务商 |
| `model_name` | 模型 |
| `ai_calls` | 调用次数 |
| `input_tokens` | 输入 token |
| `output_tokens` | 输出 token |
| `timeout_count` | 超时数 |
| `error_count` | 错误数 |
| `avg_latency_ms` | 平均耗时 |
| `p90_latency_ms` | P90 耗时 |
| `estimated_cost` | 估算成本 |

## 9. 内测日报模板

```text
日期：

行为：
- 活跃访客：
- 创建局数：
- 首猜率：
- 完成率：
- 放弃率：
- 复玩率：
- 平均有效猜词次数：

评分质量：
- 评分反馈率：
- 反馈最多答案：
- 高分未猜中样本数：
- 上限修正率：
- 需要人工复查样本：

成本与性能：
- AI 调用次数：
- 单局平均 AI 调用：
- 单局平均成本：
- 全局缓存命中率：
- AI 超时率：
- P90 评分耗时：

今日处理：
- 新增/禁用词条：
- 调整别名：
- 调整评分规则：
- 待继续观察：
```

## 10. 内测前最低要求

1. 能按天统计行为漏斗。
2. 能按答案查看完成率、放弃率、反馈率。
3. 能列出评分反馈样本。
4. 能列出高分未猜中和高分放弃样本。
5. 能统计 AI 调用次数、token、耗时和错误率。
6. 能输出一份人工可读的内测日报。
