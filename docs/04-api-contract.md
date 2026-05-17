# API 定义

## 1. 通用约定

### 1.1 Base URL

```text
/api
```

说明：

1. 首版建议前端和 API 同域部署在 Cloudflare Pages / Functions 下。
2. 前端页面走静态资源，接口统一走 `/api/*`。

### 1.2 认证

除 `POST /sessions` 外，其余接口都需要携带匿名会话 token。

Header:

```http
Authorization: Bearer <session_token>
```

### 1.3 风控

`turnstile_token` 指前端从 Cloudflare Turnstile 拿到的一次性校验 token。

规则建议：

1. `POST /sessions` 必传 `turnstile_token`。
2. `POST /games`、`POST /games/{game_id}/guesses`、`POST /games/{game_id}/feedback` 在普通情况下可不传。
3. 当服务端风控命中高风险、WAF 规则或二次校验策略时，上述接口会返回 `turnstile_required`，前端需拿新 token 后重试。
4. 本地 `CAPTCHA_MODE=bypass` 调试时，`POST /api/sessions` 可省略 `turnstile_token`；放行只存在于验证码 adapter，不进入业务规则。

### 1.4 响应格式

成功：

```json
{
  "data": {}
}
```

失败：

```json
{
  "error": {
    "code": "invalid_guess",
    "message": "猜词不能为空",
    "counted": false
  }
}
```

## 2. 会话接口

### 2.1 创建匿名会话

```http
POST /api/sessions
```

Request:

```json
{
  "client_timezone": "Asia/Shanghai",
  "turnstile_token": "cf-turnstile-response-token"
}
```

Response:

```json
{
  "data": {
    "visitor_id": "visitor_xxx",
    "session_token": "token_xxx",
    "expires_at": "2026-06-16T10:00:00+08:00"
  }
}
```

### 2.2 获取当前会话

```http
GET /api/session
```

Response:

```json
{
  "data": {
    "visitor_id": "visitor_xxx",
    "expires_at": "2026-06-16T10:00:00+08:00",
    "active_game_id": "game_xxx"
  }
}
```

`active_game_id` 没有进行中的游戏时返回 `null`。

## 3. 游戏接口

### 3.1 创建随机局

```http
POST /api/games
```

Request:

```json
{
  "mode": "random"
}
```

可选字段：

1. `turnstile_token`：当服务端要求二次校验时必填。

Response:

```json
{
  "data": {
    "game_id": "game_xxx",
    "mode": "random",
    "status": "playing",
    "guess_count": 0,
    "started_at": "2026-05-17T10:00:00+08:00",
    "expires_at": "2026-05-18T10:00:00+08:00"
  }
}
```

约束：

1. V0.1 只接受 `mode=random`。
2. 不能返回答案。
3. 同一匿名会话若已有进行中的游戏，重复调用 `POST /api/games` 会返回现有游戏，不再新建第二条 `playing` 记录。

### 3.2 获取游戏状态

```http
GET /api/games/{game_id}
```

Response:

```json
{
  "data": {
    "game_id": "game_xxx",
    "status": "playing",
    "guess_count": 3,
    "best_guess": {
      "guess_id": "guess_003",
      "guess": "平板",
      "score": 76
    },
    "guesses": [
      {
        "guess_id": "guess_001",
        "guess": "电器",
        "score": 66,
        "relation_type": "parent_category",
        "source": "model",
        "counted": true,
        "created_at": "2026-05-17T10:01:00+08:00"
      }
    ],
    "started_at": "2026-05-17T10:00:00+08:00",
    "ended_at": null
  }
}
```

说明：

1. `best_guess` 在还没有有效猜词时返回 `null`。
2. `guesses` 在还没有历史记录时返回空数组。

结束状态追加：

```json
{
  "data": {
    "answer": "手机",
    "answer_aliases": ["智能手机", "移动电话", "📱"]
  }
}
```

### 3.3 提交猜词

```http
POST /api/games/{game_id}/guesses
```

Request:

```json
{
  "guess": "电器"
}
```

可选字段：

1. `turnstile_token`：当服务端要求二次校验时必填。

Response:

```json
{
  "data": {
    "guess_id": "guess_003",
    "guess": "电器",
    "normalized_guess": "电器",
    "score": 66,
    "relation_type": "parent_category",
    "is_exact": false,
    "status": "playing",
    "source": "model",
    "counted": true,
    "guess_count": 3,
    "best_guess": {
      "guess_id": "guess_003",
      "guess": "电器",
      "score": 66
    }
  }
}
```

重复猜词示例：

```json
{
  "data": {
    "guess_id": "guess_001",
    "guess": "电器",
    "normalized_guess": "电器",
    "score": 66,
    "relation_type": "parent_category",
    "is_exact": false,
    "status": "playing",
    "source": "game_cache",
    "counted": false,
    "guess_count": 2
  }
}
```

猜中示例：

```json
{
  "data": {
    "guess_id": "guess_010",
    "guess": "手机",
    "normalized_guess": "手机",
    "score": 100,
    "relation_type": "exact",
    "is_exact": true,
    "status": "success",
    "source": "exact_match",
    "counted": true,
    "guess_count": 10,
    "answer": "手机"
  }
}
```

### 3.4 放弃游戏

```http
POST /api/games/{game_id}/give-up
```

Response:

```json
{
  "data": {
    "game_id": "game_xxx",
    "status": "give_up",
    "answer": "手机",
    "guess_count": 8,
    "ended_at": "2026-05-17T10:10:00+08:00"
  }
}
```

### 3.5 提交评分反馈

```http
POST /api/games/{game_id}/feedback
```

Request:

```json
{
  "guess_id": "guess_003",
  "feedback_type": "score_unreasonable",
  "note": "这个词给高了"
}
```

可选字段：

1. `turnstile_token`：当服务端要求二次校验时必填。

Response:

```json
{
  "data": {
    "success": true
  }
}
```

## 4. 错误码

| code | HTTP | counted | 场景 |
| --- | --- | --- | --- |
| `unauthorized` | 401 | false | 无会话或会话失效 |
| `turnstile_required` | 403 | false | 需要补做人机校验 |
| `turnstile_failed` | 400 | false | Turnstile token 无效、过期或校验失败 |
| `invalid_request` | 400 | false | 请求体缺字段、字段值不支持或模式非法 |
| `invalid_guess` | 400 | false | 空输入、超长、格式非法 |
| `sensitive_word` | 400 | false | 命中敏感词 |
| `game_not_found` | 404 | false | 游戏不存在或无权访问 |
| `game_ended` | 409 | false | 游戏已结束 |
| `rate_limited` | 429 | false | 触发限流 |
| `ai_timeout` | 503 | false | AI 超时 |
| `system_error` | 500 | false | 系统异常 |

## 5. 前端处理要求

1. 401：清理本地 token 后重新创建匿名会话。
2. `turnstile_required`：刷新 Turnstile token 后重试原请求。
3. `turnstile_failed`：提示用户重新验证，不清空当前业务输入。
4. 400：展示错误提示，不清空输入框。
5. 409：刷新游戏状态并跳转结果页。
6. 429：提示稍后再试。
7. 503/500：保留当前页面状态，允许用户重试。
