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
| T12 | 封装 AI Gateway + DeepSeek 评分服务 | P0 | T07 | 是 | ScoringGateway / AiScoringClient / adapter | 使用 `deepseek-v4-flash` 返回结构化评分，且业务层不直接感知 AI Gateway |
| T13 | 实现 AI 输出后处理和重试 | P0 | T12 | 是 | 裁剪、重试、错误处理 | 非法 JSON、非法关系类型、AI 非本地 exact/alias 和越界分数处理正确 |
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
| T24 | 实现评分反馈接口 | P1 | T14 | 是 | `POST /api/games/{id}/feedback` | 能记录用户反馈，并校验 `guess_id` 归属、重复提交和非法输入 |
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
| `DB` | `guess-wrod-local` | 本地 D1 binding，当前只用于 `wrangler pages dev` / 本地 D1 验证 |

当前健康检查地址为 `GET /api/health`。该接口用于验证 Pages Functions、routes handler、use case 和运行时配置 adapter 的最小链路；不包含业务主流程、数据库、词库 seed、评分规则或真实 AI 调用。

## 12.1 评分客户端当前边界

T12/T13 当前完成最小前置：

1. `src/usecases/scoring/scoringGateway.ts` 定义平台中立的 `AiScoringClient` 和 `ScoringGateway`。
2. 业务层先走本地标准答案和显式别名匹配，未命中才调用 AI client。
3. stub adapter 位于 `src/infrastructure/adapters/stubScoringClient.ts`，本地默认配合 `AI_MODE=stub` 使用。
4. DeepSeek + AI Gateway adapter 位于 `src/infrastructure/adapters/deepseekAiGatewayScoringClient.ts`，只接受注入的 endpoint、apiKey、model 和 fetch，不读取 env，不暴露 Cloudflare binding 到 usecase。
5. live adapter 当前是边界骨架和最小请求封装；真实 endpoint、apiKey、model 都只允许通过入口层注入。

## 12.2 前端真实 API 接入进度

截至 `codex/guessword-frontend-live-flow`：

1. 已接通 `POST /api/sessions`、`GET /api/session`、`POST /api/games`、`GET /api/games/{id}`、`POST /api/games/{id}/give-up`。
2. 前端已保存并恢复本地 `session_token`，`401 unauthorized` 时会清理后自动重建匿名会话。
3. 首页、启动页、游戏页、放弃结果页已经改为真实数据或真实请求驱动。
4. `POST /api/games/{id}/guesses` 与反馈提交仍由并行任务负责，当前页面仅保留输入区、反馈弹层和错误/重试结构。
5. 旧的 `/games/demo-playing` 与 `/games/demo/result/*` 路由仍保留给 visual QA；真实业务入口使用 `/games/:gameId` 与 `/games/:gameId/result/:mode`。

## 13. 当前资料基线

本仓库已准备一组不依赖项目骨架的 T02/T04/T08 基础资料：

1. `migrations/0001_initial_business_tables.sql` 可在 SQLite / 本地 D1 中创建首版业务主数据表。
2. `data/seed-words.v0.1.json` 当前提供 50 条本地测试词条；T04 后续目标仍是扩充到 300-500 条。
3. `data/sensitive-terms.v0.1.txt` 当前只是初筛清单，后续 T08 实现时应进入输入校验模块，并保证命中后不调用 AI。
4. `scripts/validate-seed.mjs` 可在无第三方依赖的 Node 环境中检查 seed 重复、空值、归一化和敏感词命中。
5. `scripts/print-word-seed-sql.mjs` 可把 JSON seed 转成 `words` 表插入语句，便于后续接入本地 D1 / SQLite 初始化流程。

## 13. 存储基础当前状态

T02 后半和 T03/T05/T14 前置存储基础已具备：

1. `src/domain/models/storage.ts` 定义会话、词条、游戏、猜词、反馈、评分缓存和 AI 调用镜像类型。
2. `src/usecases/repositories/storageRepositories.ts` 定义平台中立 repository 接口。
3. `src/infrastructure/adapters/storage/sqliteStorageRepositories.ts` 提供 D1/SQLite 风格 adapter，使用 `migrations/0001_initial_business_tables.sql` 的表和列。
4. `src/routes/handlers/storage/createStorageRepositories.ts` 提供入口层依赖装配辅助，但没有实现 `POST /api/sessions`、`POST /api/games` 或猜词 API。
5. `src/infrastructure/adapters/storage/sqliteStorageRepositories.test.ts` 用 fake executor 覆盖 SQL 映射、JSON 字段、空值、布尔值和缓存命中更新。

后续 T03/T05/T14 实现业务 API 时，应从 handler 层创建 repositories，再注入 use case。use case 不得 import `SqlExecutor`、D1 binding 或 Cloudflare runtime 类型。

本地 D1 复验建议：

```sh
npx wrangler d1 execute guess-wrod-local --local --file migrations/0001_initial_business_tables.sql
node scripts/print-word-seed-sql.mjs > .wrangler/word-seed.sql
grep -v -E '^(BEGIN;|COMMIT;)$' .wrangler/word-seed.sql > .wrangler/word-seed-no-transaction.sql
npx wrangler d1 execute guess-wrod-local --local --file .wrangler/word-seed-no-transaction.sql
npx wrangler d1 execute guess-wrod-local --local --command "SELECT COUNT(*) AS count FROM words;"
```

当前 wrangler 本地 D1 执行器会拒绝脚本里的 `BEGIN` / `COMMIT` 事务语句，所以本地复验时使用临时过滤文件。`.wrangler/` 是本地状态目录，不要提交。

## 14. T03/T05/T06/T15 当前基础链路

以下能力已在本地 stub / bypass 模式下落地：

1. `POST /api/sessions`：创建匿名访客、生成签名 session token、只保存 token 哈希；`CAPTCHA_MODE=bypass` 时允许省略 `turnstile_token`。
2. `GET /api/session`：校验 Bearer token、校验过期时间、返回 `visitor_id`、`expires_at` 和当前 `active_game_id`。
3. `POST /api/games`：在会话下创建随机局；若当前已存在 `playing` 游戏，则直接返回该游戏，避免同一会话并存多条进行中记录。
4. `GET /api/games/{game_id}`：进行中状态不返回答案；结束状态返回 `answer` 与 `answer_aliases`。
5. `POST /api/games/{game_id}/give-up`：把游戏状态更新为 `give_up`，返回答案。
6. `POST /api/games/{game_id}/guesses`：完成输入归一化、敏感词拦截、exact/alias、本局重复猜词缓存、全局缓存和 stub/model 评分最小链路。

当前仍未覆盖：

1. 真实 Turnstile 校验 adapter。
2. AI 调用镜像、反馈与分析链路。
3. 基于 24 小时 TTL 的自动过期处理。

## 15. T14 当前验收基线

截至 2026-05-18，`POST /api/games/{game_id}/guesses` 已覆盖以下场景：

1. 空输入返回 `invalid_guess`。
2. 全角/大小写归一化后参与评分。
3. 敏感词返回 `sensitive_word`，且不计次。
4. 标准答案和显式别名直接 100 分成功。
5. 同一局重复猜词返回 `game_cache`，不增加有效次数。
6. 跨局复用 `score_cache` 时返回 `global_cache`，并增加当前局有效次数。
7. stub/model 路径会写入 `guesses` 和 `score_cache`。
8. 游戏结束后继续提交返回 `game_ended`。
