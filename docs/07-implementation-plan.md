# 实施计划

## 1. 目标

按 H5 首发方案完成一个可内测的 AI 评分猜词游戏。第一阶段只要求随机局、匿名会话、AI 评分、结果页、基础日志和评分反馈。

技术路线默认采用 Cloudflare 全栈：

1. Pages 托管前端。
2. Functions/Workers 提供 API。
3. D1 存业务主数据。
4. Workers Analytics Engine 存事件分析数据。
5. AI Gateway 承接 `deepseek-v4-flash` 调用。
6. R2 存原始归档和日报产物。

## 2. 优先级定义

| 优先级 | 含义 |
| --- | --- |
| P0 | 没有它无法完成首版主流程 |
| P1 | 内测质量明显受影响，但不阻塞主流程 |
| P2 | 后续优化项 |

## 3. 里程碑

| 里程碑 | 目标 | 完成标准 |
| --- | --- | --- |
| M1 文档与 Cloudflare 骨架 | 项目结构、Wrangler、Pages、D1、基础 bindings 确定 | 本地预览可启动 |
| M2 后端主流程 | 会话、游戏、猜词、评分 API 可用 | 可用 HTTP 完成一局 |
| M3 前端主流程 | H5 首页、游戏页、结果页可用 | 手机浏览器可完整游玩 |
| M4 质量与内测 | Analytics Engine、AI Gateway 观测、反馈和成本统计可用 | 可邀请小范围试玩 |

## 4. 开发强制约束

以下约束对所有后续 agent 开发都生效：

1. 不得为了实现快，直接在业务逻辑里操作 D1、R2、AI Gateway、Workers Analytics Engine、Turnstile。
2. 入口层可以依赖 Cloudflare 平台对象；业务层和领域层不可以。
3. 所有基础设施能力都要先经过接口或适配层，再供业务用例调用。
4. 新增功能时，优先补接口和 adapter，不要把 provider 细节散落进各个 use case。
5. 若某处必须使用 Cloudflare 专有能力，提交前必须说明原因和未来替代点。
6. 验收时除了功能正确，还要检查是否新增了平台耦合点。

最低边界要求：

| 能力 | 最低实现约束 |
| --- | --- |
| 主库访问 | 通过 repository 接口 |
| AI 调用 | 通过 `AiScoringClient` / `ScoringGateway` |
| 行为事件 | 通过 `AnalyticsSink` |
| 原始归档 | 通过 `ArchiveSink` |
| 风控校验 | 通过 `RiskControlService` / `CaptchaVerifier` |
| 定时任务 | 通过可复用 use case，不把逻辑写死在 Cron 入口 |

## 5. 原子任务

| ID | 任务 | 优先级 | 依赖 | 可并行 | 交付物 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | 初始化 Cloudflare 项目结构和技术栈 | P0 | 无 | 否 | Pages/Functions/Wrangler 骨架 | 本地能启动空页面和健康检查，且目录分出 domain/usecases/adapters 责任边界 |
| T02 | 建立 D1 migration、bindings 和 seed 机制 | P0 | T01 | 是 | migration 脚本 | 可创建全部业务表 |
| T03 | 实现匿名会话接口和 Turnstile 校验 | P0 | T01,T02 | 是 | `POST /api/sessions`, `GET /api/session` | token 可创建、校验、过期 |
| T04 | 准备首批词库 seed | P0 | T02 | 是 | 300-500 个词条 | 无敏感词、无抽象概念 |
| T05 | 实现游戏创建接口 | P0 | T03,T04 | 否 | `POST /api/games` | 创建后不返回答案 |
| T06 | 实现游戏状态接口 | P0 | T05 | 是 | `GET /api/games/{id}` | 进行中不返回答案，结束后返回答案 |
| T07 | 实现输入归一化和校验 | P0 | T01 | 是 | 归一化工具和测试 | 覆盖空值、全半角、大小写、emoji |
| T08 | 实现敏感词过滤 | P0 | T07 | 是 | 敏感词检查模块 | 命中后不调用 AI |
| T09 | 实现精确命中判断 | P0 | T04,T07 | 是 | answer/alias 匹配 | 标准答案和显式别名 100 分 |
| T10 | 实现单局缓存（D1） | P0 | T05,T07 | 是 | game cache 查询逻辑 | 重复猜词不计次 |
| T11 | 实现全局评分缓存（D1） | P0 | T02,T07 | 是 | `score_cache` 读写 | 命中后计为新有效猜词 |
| T12 | 封装 AI Gateway + DeepSeek 评分服务 | P0 | T07 | 是 | ScoringService | 使用 `deepseek-v4-flash` 返回结构化评分，且业务层不直接感知 AI Gateway |
| T13 | 实现 AI 输出后处理和重试 | P0 | T12 | 是 | 裁剪、重试、错误处理 | 非法 JSON 和越界分数处理正确 |
| T14 | 实现提交猜词接口 | P0 | T05,T07,T08,T09,T10,T11,T13 | 否 | `POST /api/games/{id}/guesses` | 所有计次规则正确 |
| T15 | 实现放弃接口 | P0 | T05 | 是 | `POST /api/games/{id}/give-up` | 放弃后返回答案并禁止继续猜 |
| T16 | 实现游戏过期和 Cron 清理 | P0 | T14 | 是 | 次数上限和 TTL 处理 | 第 100 次后仍未命中则过期 |
| T17 | 前端基础布局、路由和 Pages 构建 | P0 | T01 | 是 | 首页、游戏页、结果页路由 | 移动端可访问 |
| T18 | 前端会话恢复 | P0 | T03,T17 | 是 | token 保存和恢复逻辑 | 刷新后仍有会话 |
| T19 | 前端首页和开局 | P0 | T05,T17,T18 | 是 | 首页开始按钮 | 点击后进入游戏页 |
| T20 | 前端游戏页猜词交互 | P0 | T14,T17,T18 | 否 | 输入、提交、加载、历史 | 可连续猜词 |
| T21 | 前端结果页 | P0 | T06,T15,T20 | 是 | 结果展示和再来一局 | 猜中、放弃、过期都能展示 |
| T22 | 接入 Workers Analytics Engine 事件写入 | P1 | T03,T05,T14 | 是 | `guess_events` 数据点 | 核心事件可查询，且事件写入通过独立 sink |
| T23 | 写入 `ai_call_logs` 镜像并接入 AI Gateway 观测 | P1 | T12,T13 | 是 | D1 镜像和网关日志配置 | 可按天统计调用量和耗时，且业务层不直接操作网关日志 |
| T24 | 实现评分反馈接口 | P1 | T14 | 是 | `POST /api/games/{id}/feedback` | 能记录用户反馈 |
| T25 | 前端评分反馈入口 | P1 | T20,T24 | 是 | 反馈按钮和提交状态 | 能提交“不合理”反馈 |
| T26 | 人工评分样本集 | P1 | T04,T12 | 是 | 约 300 条样本 | 覆盖全部关系类型 |
| T27 | 行为分析聚合脚本 | P1 | T22 | 是 | 每日漏斗和留存统计 | 可产出每日行为指标 |
| T28 | 评分质量分析 | P1 | T14,T24,T26 | 是 | 质量排行和问题样本 | 可定位高反馈答案和异常评分 |
| T29 | 成本分析和日报产出 | P1 | T23 | 是 | 成本日报、R2 报告 | 可计算单局成本和缓存收益 |
| T30 | 后端接口测试 | P0 | T03,T05,T14,T15,T16 | 是 | API 测试 | 主流程和异常通过 |
| T31 | 前端主流程测试 | P0 | T19,T20,T21 | 是 | 浏览器测试 | 手机视口可完整游玩 |
| T32 | Cloudflare 部署配置 | P0 | T01,T30,T31 | 否 | Pages、D1、Analytics Engine、R2、Turnstile 配置 | 公网可访问 |
| T33 | 上线前检查 | P0 | T22,T23,T27,T28,T29,T30,T31,T32 | 否 | 检查记录 | HTTPS、密钥、答案安全、限流、日报均通过 |

## 6. 依赖关系

```text
T01
  ├─ T02
  │   ├─ T03
  │   ├─ T04
  │   ├─ T11
  │   └─ T22
  ├─ T07
  │   ├─ T08
  │   ├─ T09
  │   ├─ T10
  │   └─ T12 ─ T13
  └─ T17

T03 + T04 → T05 → T06/T14/T15/T16
T17 + T18 + T19 → T20 → T21
T14 → T24 → T25
T22 → T27
T14 + T24 + T26 → T28
T23 → T29
T30 + T31 + T32 → T33
```

## 7. 可并行实施安排

### 7.1 第一批：Cloudflare 基础准备

可并行任务：

| 子代理 | 任务范围 | 依赖 |
| --- | --- | --- |
| A | D1 migration 和业务表 | T01 |
| B | 前端路由和移动端基础布局 | T01 |
| C | 词库 seed 和敏感词初筛 | T01 |
| D | 归一化工具和单元测试 | T01 |

主代理保留：

1. Cloudflare 技术栈选择。
2. 项目结构初始化。
3. Functions、Pages 和 bindings 命名决策。

### 7.2 第二批：后端能力

可并行任务：

| 子代理 | 任务范围 | 依赖 |
| --- | --- | --- |
| A | 匿名会话接口和 Turnstile 校验 | T02 |
| B | AI Gateway + DeepSeek 评分服务 | T07 |
| C | 单局缓存和全局缓存 | T05,T07 |
| D | Analytics Engine 事件写入和 AI 调用镜像 | T02 |

主代理保留：

1. `POST /api/games/{id}/guesses` 集成。
2. 状态机和计次规则验收。
3. API 契约与文档一致性检查。

### 7.3 第三批：前端主流程

可并行任务：

| 子代理 | 任务范围 | 依赖 |
| --- | --- | --- |
| A | 首页和开局 | T17,T18,T05 |
| B | 游戏页基础交互 | T17,T14 |
| C | 结果页 | T06,T15 |
| D | 评分反馈入口 | T20,T24 |

主代理保留：

1. 页面状态流转。
2. 移动端真实浏览器验收。
3. 网络异常和刷新恢复检查。

### 7.4 第四批：验证和上线准备

可并行任务：

| 子代理 | 任务范围 | 依赖 |
| --- | --- | --- |
| A | 后端 API 测试 | T14,T15,T16 |
| B | 前端浏览器测试 | T19,T20,T21 |
| C | 人工评分样本集和质量分析 | T04,T12,T24 |
| D | 行为和成本统计检查 | T22,T23 |

主代理保留：

1. Cloudflare 部署配置。
2. 上线前检查。
3. 最终验收判断。

## 8. 建议实施顺序

1. T01 项目初始化。
2. T02-T04、T07、T17 并行。
3. T03、T05、T12、T13 并行。
4. T08-T11、T14、T15、T16。
5. T18-T21。
6. T22-T26。
7. T27-T33。

## 9. 风险点

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| AI 评分不稳定 | 用户觉得分数不可信 | 缓存、低随机性、人工样本集 |
| D1 单库写入压力过高 | 高并发时延迟或报错 | 控制日志写入到 D1 的范围，事件分析拆到 Analytics Engine |
| Turnstile 过度拦截 | 影响转化和猜词体验 | 先保护会话创建，高风险接口再加二次校验 |
| 成本超出预期 | 内测成本上升 | AI Gateway 观测、全局缓存、限流 |
| 为了开发省事把业务绑死在 Cloudflare | 后续迁移成本陡增 | 验收时检查 repository、adapter、sink 和 risk service 边界 |
| 文档与实现偏离 | 后续返工 | 每个任务验收时对照 docs |

## 10. 第一周建议目标

1. 完成 T01-T07。
2. 完成 T12-T14 的最小链路。
3. 前端能通过接口完整猜一局。
4. 至少有 50 个词条可用于本地测试。

## 11. 本地开发命令

T01 项目骨架使用 React + Vite + TypeScript + Cloudflare Pages Functions。

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装依赖并生成锁文件 |
| `npm run dev` | 只启动 Vite 前端开发服务 |
| `npm run build` | 类型检查并构建静态前端到 `dist/` |
| `npm run dev:pages` | 构建后用 `wrangler pages dev dist --port 8788` 启动 Pages + Functions 本地服务 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run cf:check` | 编译 Pages Functions，检查入口和运行时类型 |

本地默认模式由 `wrangler.jsonc` 提供：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `AI_MODE` | `stub` | 本地默认不调用真实模型 |
| `CAPTCHA_MODE` | `bypass` | 本地默认不接真实验证码 |
| `ANALYTICS_MODE` | `noop` | 本地默认不写真实分析数据 |
| `ARCHIVE_MODE` | `file` | 本地默认预留文件归档 adapter |

当前健康检查地址为 `GET /api/health`。该接口用于验证 Pages Functions、routes handler、use case 和运行时配置 adapter 的最小链路；不包含业务主流程、数据库、词库 seed、评分规则或真实 AI 调用。
