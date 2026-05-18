# AI 评分规格

## 1. 评分目标

AI 只负责判断普通猜词与答案之间的语义接近程度。后端负责答案、状态、缓存、计次和异常处理。

### 1.1 当前模型选择

V0.2 默认配置：

1. AI 服务商：DeepSeek 官方 API。
2. 模型：`deepseek-v4-flash`。
3. 接入路径：Cloudflare AI Gateway 转发到 DeepSeek。
4. 思考模式：默认关闭，即 `thinking.type=disabled`。
5. 输出模式：强制 JSON 输出，不启用工具调用。

## 2. 输入归一化

后端收到 `guess` 后按顺序处理：

1. `trim` 首尾空白。
2. Unicode NFKC 归一化。
3. 全角字符转半角。
4. 拉丁字母转小写。

V0.1 不做：

1. 繁简转换。
2. 拼音匹配。
3. 错别字纠正。

## 3. 输入限制

| 项目 | 规则 |
| --- | --- |
| 最小长度 | 1 个字符 |
| 最大长度 | 20 个字符 |
| 非法输入 | 空字符串、纯控制字符、归一化后为空 |
| emoji | 可提交；只有显式别名中的 emoji 可命中 100 分 |
| 敏感词 | 直接拒绝，不调用 AI |

## 4. 精确命中

后端先用 `guess_normalized` 匹配：

1. `word.word_normalized`
2. `word.aliases` 归一化结果

命中时：

1. `score=100`
2. `relation_type=exact` 或 `alias`
3. `is_exact=true`
4. `source=exact_match`
5. `counted=true`
6. 游戏状态变为 `success`
7. 不调用 AI

样例：

```json
{
  "word": "手机",
  "aliases": ["智能手机", "移动电话", "📱"]
}
```

`电话` 不作为别名，它应由 AI 按 `synonym` 类型评分。

## 5. 评分流水线

```text
校验会话和游戏状态
  ↓
归一化
  ↓
格式检查
  ↓
敏感词检查
  ↓
精确命中
  ↓
单局缓存
  ↓
全局缓存
  ↓
AI 评分
  ↓
后处理
  ↓
写入记录并返回
```

## 6. 关系类型

| relation_type | 含义 | 示例，答案为“手机” |
| --- | --- | --- |
| `exact` | 标准答案 | 手机 |
| `alias` | 显式别名 | 智能手机、移动电话、📱 |
| `synonym` | 近义词但不直接接受 | 电话 |
| `parent_category` | 上位类 | 电子产品 |
| `same_category` | 同类事物 | 平板、电脑 |
| `attribute` | 属性 | 智能、便携、触屏 |
| `function` | 功能 | 通话、拍照、上网 |
| `component` | 组成部件 | 屏幕、电池 |
| `accessory` | 配件 | 充电器、手机壳 |
| `service_context` | 服务或操作场景 | 维修、刷机 |
| `usage_context` | 使用场景 | 社交、支付 |
| `weak_context` | 弱相关 | 旅游、食物 |
| `unrelated` | 基本无关 | 石头、云朵 |
| `invalid` | 无效输入 | 乱码 |

## 7. 分数区间

| 分数 | 含义 |
| --- | --- |
| 100 | 标准答案或显式别名 |
| 90-99 | 极近，但仍不是接受答案 |
| 80-89 | 强相关 |
| 65-79 | 中强相关 |
| 45-64 | 中等相关 |
| 20-44 | 弱相关 |
| 0-19 | 基本无关 |

## 8. 关系上限

| relation_type | 上限 |
| --- | --- |
| `exact` / `alias` | 100 |
| `synonym` | 95 |
| `parent_category` | 80 |
| `same_category` | 85 |
| `attribute` | 82 |
| `function` | 80 |
| `component` | 82 |
| `accessory` | 78 |
| `service_context` | 78 |
| `usage_context` | 75 |
| `weak_context` | 55 |
| `unrelated` | 25 |
| `invalid` | 0 |

后端必须按关系上限修正 AI 返回分数。

## 9. 样例

| 猜词 | 分数 | relation_type |
| --- | --- | --- |
| 手机 | 100 | `exact` |
| 智能手机 | 100 | `alias` |
| 移动电话 | 100 | `alias` |
| 电话 | 92 | `synonym` |
| 电子产品 | 78 | `parent_category` |
| 平板 | 76 | `same_category` |
| 屏幕 | 72 | `component` |
| 充电器 | 74 | `accessory` |
| 维修 | 72 | `service_context` |
| 拍照 | 70 | `function` |
| 社交 | 62 | `usage_context` |
| 食物 | 18 | `weak_context` |
| 石头 | 8 | `unrelated` |

## 10. AI 输入输出

### 10.1 业务评分输入

```json
{
  "answer": "手机",
  "answer_context": {
    "aliases": ["智能手机", "移动电话"],
    "categories": ["电子产品"],
    "tags": ["可携带"]
  },
  "guess": "维修",
  "guess_history": {
    "total_previous_guesses": 2,
    "best_score": 76,
    "best_guess": "平板",
    "guesses": [
      {
        "order": 1,
        "guess": "电子产品",
        "score": 78,
        "relation_type": "parent_category",
        "source": "model"
      },
      {
        "order": 2,
        "guess": "平板",
        "score": 76,
        "relation_type": "same_category",
        "source": "model"
      }
    ]
  },
  "language": "zh-CN",
  "scoring_rules_version": "v0.2",
  "relation_caps": {
    "synonym": 95,
    "parent_category": 80,
    "same_category": 85,
    "attribute": 82,
    "function": 80,
    "component": 82,
    "accessory": 78,
    "service_context": 78,
    "usage_context": 75,
    "weak_context": 55,
    "unrelated": 25
  }
}
```

V0.2 起，默认回灌答案上下文和本局历史猜词，避免模型把玩家继续带向已经验证过的宽泛错误方向。

### 10.2 模型调用约定

1. 业务层只依赖平台中立的 `AiScoringClient` / `ScoringGateway` 接口。
2. 本地默认 `AI_MODE=stub`，使用 stub scoring client 返回结构化评分，不调用真实模型。
3. live 模式由 adapter 层通过 AI Gateway 转发到 DeepSeek；usecase 不拼接 AI Gateway 请求，也不读取 env。
4. `model` 默认值为 `deepseek-v4-flash`，由 adapter 配置注入。
5. 默认使用非思考模式，以控制延迟和成本。
6. 要求模型返回合法 JSON；如果返回非法 JSON，后端按重试规则处理。
7. 不启用工具调用，但要把答案上下文和本局历史猜词一并传给模型。
8. AI Gateway 日志、缓存和成本观测只作为基础设施能力，不替代业务侧 D1 缓存语义。

### 10.2.1 系统提示词约束重点

V0.2 的系统提示词不再只要求“返回 JSON”，而是显式强调以下规则：

1. 分数代表“是否真的帮助玩家缩小答案空间”，不是“能否牵强找到一点关系”。
2. `parent_category` 只允许用于能明显收窄搜索空间的稳定类别，不允许把“名词”“东西”“物品”“用品”这类超宽泛概念判成高分上位类。
3. `service_context` / `usage_context` 只允许用于强绑定、具体的场景；“每天会用的”“生活中常见的”这类泛场景描述默认应明显降分。
4. `attribute` 只允许用于区分度高的稳定属性；颜色、常见性、弱描述句不能轻易高分。
5. 模型必须结合 `guess_history` 做动态纠偏：如果历史里已经出现多个宽泛高分方向，后续同方向词通常不应继续升高。
6. `reason` 必须明确指出高分是因为核心类别/功能/部件/具体场景，还是低分是因为词太宽泛、太抽象、太像重复误导方向。

当前 live adapter 已支持最小可用调用：`AI_GATEWAY_ENDPOINT_URL` 仍为必填，且应传入 Gateway provider 基础 URL；adapter 会自动补齐 OpenAI 兼容路径 `/chat/completions`。`AI_GATEWAY_API_KEY` 为可选网关鉴权字段；当使用 AI Gateway BYOK / Authenticated Gateway 时，请求应发送 `cf-aig-authorization: Bearer <CF_AIG_TOKEN>`，且不要再发送 provider `Authorization`。`AI_GATEWAY_BYOK_ALIAS` 为可选 alias 字段；当该值非空时，adapter 额外发送 `cf-aig-byok-alias: <ALIAS>`，用于命中非默认 BYOK key alias。密钥、endpoint、fetch 实现都必须由入口层或配置 adapter 注入；仓库内不得写入真实密钥。默认 runtime fetch 必须通过 `globalThis.fetch(...)` 形式调用，避免在 Workers 中因错误 `this` 绑定触发 `Illegal invocation`。

### 10.3 模型输出

```json
{
  "score": 72,
  "is_exact": false,
  "relation_type": "service_context",
  "reason": "维修是手机的常见服务场景，但不是同义词或同类物品。",
  "confidence": 0.86
}
```

前端只接收后端处理后的最终分数，不接收 `reason`。

## 11. 后处理

1. 非整数分数尝试转为整数。
2. 小于 0 裁剪为 0。
3. 大于 100 裁剪为 100。
4. 按 `relation_type` 上限再次裁剪。
5. `relation_type` 非法时重试一次。
6. AI 返回 `is_exact=true` 时，后端仍以本地词库匹配结果为准。
7. 若未命中本地标准答案或显式别名，AI 返回 `relation_type=exact` 或 `relation_type=alias` 也视为无效模型输出，并进入重试或失败处理。

## 12. 重试与失败

自动重试一次的情况：

1. 非 JSON。
2. 缺少 `score`。
3. 缺少 `relation_type`。
4. `relation_type` 不在枚举中。
5. 未命中本地标准答案或显式别名时，AI 返回 `relation_type=exact` 或 `relation_type=alias`。
6. `score` 不是可转换为有限数字的值。

重试后仍失败：

1. 返回 `system_error` 或 `ai_timeout`。
2. 不增加有效次数。
3. 不写入有效猜词。
4. 写入 AI 错误日志。

当前 `ScoringGateway` 已保留 retryable 错误判定和最大尝试次数；提交猜词 API、计次、缓存写入和 AI 错误日志仍由后续主流程接入。

## 13. 缓存

### 13.1 单局缓存

```text
game_id + guess_normalized
```

同一局重复猜词命中后返回原结果，`source=game_cache`，不增加有效次数。

### 13.2 全局缓存

```text
answer_id + guess_normalized + scoring_rules_version + model_name + thinking_mode
```

命中后作为新的有效猜词，`source=global_cache`，增加有效次数。

### 13.3 AI Gateway 缓存

AI Gateway 可对完全相同的模型请求体做网关级缓存，但它不是业务权威缓存。

规则：

1. 业务语义仍以 D1 的单局缓存和全局缓存为准。
2. AI Gateway 缓存只用于减少重复调用 DeepSeek 的次数和成本。
3. 当规则版本、模型名或思考模式变化时，业务缓存键必须变化，避免旧分数污染新版本结果。

## 13.4 当前本地实现

截至 2026-05-18，当前仓库已经接入以下最小链路：

1. 本地默认 `AI_MODE=stub`，通过 `StubScoringClient` 返回结构化评分。
2. `POST /api/games/{game_id}/guesses` 会把 stub/model 结果写入 `score_cache`，后续同答案同猜词可被全局缓存复用。
3. `guesses` 表会记录 `exact_match`、`game_cache`、`global_cache`、`model` 四类来源。
4. `exact/alias` 仍只由本地词库判断，stub/live 都不能绕过这条规则。

当前仍未接入：

1. AI 调用镜像表 `ai_call_logs`。
2. live 模式的真实 endpoint、密钥管理和线上成本观测。

## 14. 人工样本集

上线前准备约 300 条人工样本，覆盖：

1. `exact`
2. `alias`
3. `synonym`
4. `parent_category`
5. `same_category`
6. `attribute`
7. `function`
8. `component`
9. `accessory`
10. `service_context`
11. `usage_context`
12. `weak_context`
13. `unrelated`

验收目标：

1. 大多数样本落在预期分数区间。
2. 明显无关词不能长期出现高分。
3. 强搭配词不能普遍超过关系上限。
