# 首批子代理派发计划

- 更新时间：`2026-05-17T23:22:54+08:00`
- 主仓：`/Users/loccen/Documents/guess-wrod`
- 当前分支：`main`
- 当前状态：仓库只有设计文档和 H5 原型图，没有实现骨架。

## 事实依据

- `AGENTS.md`：要求业务层和领域层不直接依赖 Cloudflare 平台对象，平台能力通过 adapter 暴露。
- `docs/07-implementation-plan.md`：T01 是首个任务，T02/T03/T05/T17 等后续任务依赖 T01。
- `docs/ui-prototypes/README.md`：前端原型图和交互说明位于 `docs/ui-prototypes/images`，包含首页、游戏页、反馈弹层、三类结果页、规则隐私页、设计规范和素材看板。
- `rg --files`：当前仓库没有 `package.json`、Wrangler 配置、前端入口或后端 Functions 入口。

## 首批任务

1. `T01 项目骨架`
   - 子代理：`019e368b-b9ef-72f1-ba5c-704cb858fe72`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/t01-skeleton`
   - Branch：`codex/guessword-t01-skeleton`
   - 负责范围：创建 Cloudflare Pages + Functions 的 TypeScript 项目骨架、Wrangler 配置、本地 stub/bypass/noop/file 模式、基础健康检查、目录分层。
   - 验收重点：本地可启动空页面和 `/api/health`，目录体现 `domain`、`usecases`、`infrastructure/adapters`、`routes/handlers`。

2. `数据与词库准备`
   - 初始子代理：`019e368b-f18e-7791-979e-25efe0161549`，状态：失败退出，留下 staged 改动但未提交。
   - 接手子代理：`019e3691-940e-7110-80a8-d1ca0557516f`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/data-seed`
   - Branch：`codex/guessword-data-seed`
   - 负责范围：D1 migration 草案、seed 机制、首批 50 个本地测试词条起步、敏感词初筛资料。
   - 验收重点：不依赖业务实现也能提供可合入的数据文件和 migration；不得泄露敏感内容；词条避免抽象概念。

3. `评分规则准备`
   - 子代理：`019e368c-2d1b-71c2-ab33-5c29ca0c8ce6`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/scoring-rules`
   - Branch：`codex/guessword-scoring-rules`
   - 负责范围：输入归一化、关系类型、分数上限、AI 输出后处理、人工样本集起步。
   - 验收重点：领域规则保持平台中立；提供单元测试或可直接接入测试的规则模块。

4. `前端原型规格准备`
   - 子代理：`019e368c-715f-75e1-ae1a-b7996614ff61`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/frontend-spec`
   - Branch：`codex/guessword-frontend-spec`
   - 负责范围：使用 `image2code-skill` 处理 `docs/ui-prototypes/images`，输出规范化图片引用、`ui-spec.json` 或页面规格、视觉验收配置建议。
   - 验收重点：必须遵守 image2code 流程；若暂未能实现页面，需把可由后续前端实现任务直接使用的规格写入仓库。

## 主代理验收要求

- 每个子任务完成后先读对应 worktree 的 `ai-task show`。
- 核对 `git diff`、提交记录、测试命令输出和实际启动或脚本运行结果。
- 具体实现分支合入主线默认使用 `git merge --no-ff`。
- 不能只凭子代理文字汇报认定完成。
- 子代理超过十分钟没有任何文件变更时，主代理只做状态诊断、总结阻塞并重新派发或调整对应 worktree，不直接替代实现。
- 子代理完成后应及时合入 `main`；后续新派发子代理必须从最新 `main` 创建分支和 worktree。

## 异常处理记录

- 数据与词库准备初始子代理 `019e368b-f18e-7791-979e-25efe0161549` 返回“暂时不能继续完成提交”。
- 主代理检查到该 worktree 已有 staged 改动，未替代实现，只在同一 worktree 重派 `019e3691-940e-7110-80a8-d1ca0557516f` 接手审查、修正、验证和提交。
- T01、评分、数据、前端规格子代理均曾发送或声称发送 ntfy；这不符合“只有主代理最终答复前发送 ntfy”的规则，后续派发需显式禁止子代理发送通知。

## 首批完成状态

- T01 项目骨架：提交 `54eb07269d90e1b0bceecf7ed1db1057ede0f683`，主代理复验 `npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check`、`npm run dev:pages`、`curl /`、`curl /api/health` 通过。
- 数据与词库准备：提交 `a7a7f8c`，主代理复验 `node scripts/validate-seed.mjs` 与 SQLite migration + seed 导入通过，`words` 计数为 `50`。
- 评分规则准备：提交 `f8eb4bf3ac335c644ff5d9a1a9c44f1c5b30a2a4`，主代理复验 `node --test tests/domain/scoring.test.mjs` 通过，14 项通过；新增领域代码未命中平台绑定关键字。
- 前端原型规格准备：提交 `d4a9b23ae10bff47bcb216988e2cbd907cbfc158`，主代理复验 JSON 可解析、10 个 normalization 全部 `confirmed=true`、单页规格引用 normalized PNG、high/medium requiredNodes 未仅使用 visible 检查。

## 首批合并与清理

- T01 merge commit：`908c819`
- 数据与词库 merge commit：`644f1f5`
- 评分规则 merge commit：`85bf33f`
- 前端原型规格 merge commit：`68a650f`
- 合并后验证：
  - `npm run typecheck` 通过
  - `npm test` 通过，2 个 Vitest 文件 3 个用例
  - `node --test tests/domain/scoring.test.mjs` 通过，14 项通过
  - `npm run build` 通过
  - `npm run cf:check` 通过
  - `node scripts/validate-seed.mjs` 通过，50 个词条、74 个别名、25 个敏感词片段
  - SQLite 执行 migration 并导入 seed 通过，`words` 计数为 `50`
  - 前端规格 JSON 解析通过，10 个 normalization 全部 confirmed
  - `python3 validate_handoff.py --repo-root .` 通过
  - `npm run dev:pages` 启动后，`curl /` 和 `curl /api/health` 均返回 200，健康检查显示 `stub/bypass/noop/file`
- 清理结果：四个 worktree 已删除，四个 `codex/guessword-*` 临时分支已删除，当前只剩主仓 worktree。

## 第二批任务

第二批从最新 `main` 的 `b90d215` 创建，不复用首批旧 worktree。

1. `存储基础`
   - 子代理：`019e36a1-7c11-7d31-9808-11d64d446cf6`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/storage-foundation`
   - Branch：`codex/guessword-storage-foundation`
   - 负责范围：repository 接口、D1/SQLite adapter 边界、必要类型和测试；不实现完整业务 API。

2. `评分客户端`
   - 子代理：`019e36a1-bdd4-7dc2-9e05-7b8708d5f178`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/scoring-client`
   - Branch：`codex/guessword-scoring-client`
   - 负责范围：`ScoringGateway` / `AiScoringClient` 抽象、stub 实现、AI Gateway/DeepSeek adapter 边界和测试；不接猜词 API。

3. `前端静态主流程`
   - 子代理：`019e36a2-13da-7312-a54d-600c598c53ac`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/frontend-static-flow`
   - Branch：`codex/guessword-frontend-static-flow`
   - 负责范围：使用 `image2code-skill` 和已合入规格实现移动端静态主流程、路由、mock 状态和视觉验收；不接真实 API。

第二批共同约束：

- 子代理不得发送 ntfy。
- 完成后主代理应及时验收并合入 `main`。
- 后续第三批必须继续从合入后的最新 `main` 创建 worktree。

## 第二批合并与暂停状态

- 评分客户端：
  - 子任务提交：`04e3329e55643583975f446febb68a571ae116f3`
  - merge commit：`8bb623f`
  - 验证：`npm run typecheck`、`npm test`、`node --test tests/domain/scoring.test.mjs`、`npm run build` 通过。
- 存储基础：
  - 子任务提交：`51cdf42f46205ba964366ebedb41ec8eed7fdb49`
  - merge commit：`8369b0f`
  - 验证：`npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check` 通过；本地 D1 migration + seed 导入已由子代理验证。
- 前端静态主流程：
  - 子任务提交：`1e63d2b5e32a8f92b1d66173d21d0125280b8b53`
  - merge commit：`42aaf31`
  - 验证：`npm run typecheck`、`npm test`、`npm run build`、`npm run cf:check` 通过；`npm run dev:pages` 启动后 `/`、`/session`、`/games/demo-playing`、`/games/demo-playing?feedback=1`、三类结果页、`/rules`、`/api/health` 均返回 200。
  - 未通过：`docs/ui-prototypes/visual-qa/report/01-home/visual-qa-report.json` 显示 `passed=false`、8 个失败项；`docs/ui-prototypes/visual-qa/report/02-game-playing/visual-qa-report.json` 显示 `passed=false`、12 个失败项。
- 合并后总验证：
  - `npm run typecheck` 通过
  - `npm test` 通过，5 个 Vitest 文件 17 个用例
  - `node --test tests/domain/scoring.test.mjs` 通过，14 项
  - `npm run build` 通过
  - `npm run cf:check` 通过
  - `node scripts/validate-seed.mjs` 通过，50 个词条、74 个别名、25 个敏感词片段
  - SQLite migration + seed 导入通过，`words` 计数为 `50`
  - `.agent-handoff` 校验通过
- 清理结果：第二批 worktree 和临时分支已删除，当前只剩主仓 worktree。

## 暂停后下一步

用户要求当前批次完成后暂停，后续将用 GPT-5.4 新会话接续。

下一会话建议先做：

1. 从最新 `main` 开始，先读 `.agent-handoff/ACTIVE.md`、本文件、`handoff.md`、`manifest.json`。
2. 先处理前端视觉 QA 失败，或在确认视觉差异可接受后转入 API 主流程。
3. 后端下一批建议拆：会话 API、游戏创建/状态/放弃 API、猜词提交流程集成。每批完成后及时合入 `main`，新子代理必须基于最新 `main`。

## 第三批准备

- 恢复时间：`2026-05-18T00:11:09+08:00`
- 恢复基线：`main` 的 `6b8c171`
- 第三批建议：
  1. 前端 visual QA 修复：使用 `image2code-skill`，目标是首页和游戏页 visual QA high/medium 失败清零，尽量让报告 `passed=true`。
  2. 后端基础 API：实现会话、游戏创建、游戏状态、放弃接口的 stub/bypass 本地链路，不实现猜词提交。

## 第三批任务

第三批从最新 `main` 的 `1689aca` 创建。

1. `前端 visual QA 修复`
   - 子代理：`019e36b5-e4ac-7742-8894-ed31d8cec553`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/visual-qa-fix`
   - Branch：`codex/guessword-visual-qa-fix`
   - 负责范围：使用 `image2code-skill` 修复首页和游戏页 visual QA 失败，重新生成报告；不接真实 API。

2. `后端基础 API`
   - 子代理：`019e36b6-2c62-7c73-b474-b73113c42756`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/backend-base-api`
   - Branch：`codex/guessword-backend-base-api`
   - 负责范围：实现 `POST /api/sessions`、`GET /api/session`、`POST /api/games`、`GET /api/games/{game_id}`、`POST /api/games/{game_id}/give-up` 的本地 stub/bypass 链路；不实现提交猜词。

第三批共同约束：

- 子代理不得发送 ntfy。
- 完成后主代理应及时验收并合入 `main`。
- 后续新任务必须继续从合入后的最新 `main` 创建 worktree。

## 第三批合并状态

- 前端 visual QA 修复：
  - 子任务提交：`6b1b5fd`
  - merge commit：`3719d4c`
  - 结果：首页 visual QA 从 8 个失败项降到 6 个，游戏页从 12 个降到 6 个；仍未通过。
- 后端基础 API：
  - 子任务提交：`283817a5c7630adba381fd90a0002342e478bee2`
  - merge commit：`9e7a1a5`
  - 结果：已支持 `POST /api/sessions`、`GET /api/session`、`POST /api/games`、`GET /api/games/{id}`、`POST /api/games/{id}/give-up` 的本地 stub/bypass 链路。
- 第三批合并后主验证：
  - `npm run typecheck` 通过
  - `npm test` 通过，7 个文件 25 个用例
  - `node --test tests/domain/scoring.test.mjs` 通过，14 项
  - `npm run build` 通过
  - `npm run cf:check` 通过
  - seed/migration 校验通过
  - `.agent-handoff` 校验通过
  - `npm run dev:pages` 下，`POST /api/sessions -> POST /api/games -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}` 真实链路通过
- 清理结果：第三批两个 worktree 与临时分支已删除。

## 第四批建议

基于第三批后的最新 `main`，优先拆这两条：

1. `POST /api/games/{id}/guesses` 后端链路
   - 范围：输入归一化、敏感词过滤、exact/alias、本局缓存、全局缓存、评分客户端接入、计次规则和错误处理。
2. 前端真实 API 接入
   - 范围：会话恢复、建局、状态查询、放弃、结果页改为真实数据；前端继续保留 image2code 约束。

## 第四批任务

第四批从最新 `main` 的 `ca60508` 创建。

1. `猜词提交流程`
   - 子代理：`019e36c5-e115-7043-b000-e727e8748d61`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/guess-api`
   - Branch：`codex/guessword-guess-api`
   - 负责范围：实现 `POST /api/games/{game_id}/guesses`、缓存计次、评分客户端接入和相关测试；不改前端。

2. `前端真实 API 接入`
   - 子代理：`019e36c6-2599-71e3-9080-3343412cf6fd`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/frontend-live-flow`
   - Branch：`codex/guessword-frontend-live-flow`
   - 负责范围：把会话恢复、建局、状态查询、放弃、结果页切到真实 API；继续保留 image2code 结构；不实现后端路由。

第四批共同约束：

- 子代理不得发送 ntfy。
- 完成后主代理应及时验收并合入 `main`。
- 后续新任务必须继续从合入后的最新 `main` 创建 worktree。

## 第四批合并状态

- 猜词提交流程：
  - 子任务提交：`1488646432bfcbd3dc48523bebcf26db03d35fdd`
  - merge commit：`166d10c`
  - 结果：`POST /api/games/{id}/guesses` 已接通，支持归一化、敏感词、exact/alias、本局缓存、全局缓存、stub/model 评分、best guess 更新和结束态拒绝。
- 前端真实 API 接入：
  - 子任务提交：`b845f626a630662e060e4d34a70c137a63bacf0e`
  - merge commit：`51ff6f5`
  - 结果：前端已接入会话恢复、建局、状态查询、放弃和结果页真实 API；猜词提交和反馈仍是占位。
- 第四批合并后主验证：
  - `npm run typecheck` 通过
  - `npm test` 通过，8 个文件 39 个用例
  - `node --test tests/domain/scoring.test.mjs` 通过，14 项
  - `npm run build` 通过
  - `npm run cf:check` 通过
  - seed/migration 校验通过
  - `.agent-handoff` 校验通过
  - `npm run dev:pages` 下，`POST /api/sessions -> POST /api/games -> POST /api/games/{id}/guesses -> GET /api/games/{id} -> POST /api/games/{id}/give-up -> GET /api/games/{id}` 真实链路通过
- 清理结果：第四批两个 worktree 与临时分支已删除。

## 第五批建议

基于第四批后的最新 `main`，优先拆这两条：

1. `前端真实猜词流程`
   - 范围：把游戏页输入、提交、加载、历史和结果切到真实 `POST /api/games/{id}/guesses` 与 `GET /api/games/{id}`，并继续维持 image2code 结构。
2. `评分反馈后端链路`
   - 范围：实现 `POST /api/games/{id}/feedback`、`score_feedback` 写入和相关契约/测试，为前端反馈入口铺路。

## 第五批任务

第五批从最新 `main` 的 `359fb62` 创建。

1. `前端真实猜词流程`
   - 子代理：`019e36d5-8bc1-7213-8773-1c3380ae173e`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/frontend-live-guess`
   - Branch：`codex/guessword-frontend-live-guess`
   - 负责范围：把游戏页输入、提交、加载、历史和结果切到真实 `POST /api/games/{id}/guesses` 与 `GET /api/games/{id}`，并继续维持 image2code 结构。

2. `评分反馈后端链路`
   - 子代理：`019e36d5-c1c6-75a3-855b-557b0120b230`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/feedback-api`
   - Branch：`codex/guessword-feedback-api`
   - 负责范围：实现 `POST /api/games/{id}/feedback`、`score_feedback` 写入和相关契约/测试。

第五批共同约束：

- 子代理不得发送 ntfy。
- 完成后主代理应及时验收并合入 `main`。
- 后续新任务必须继续从合入后的最新 `main` 创建 worktree。

## 第五批合并状态

- 前端真实猜词流程：
  - 子任务提交：`6a7a062` 与补充报告提交 `5054767`
  - merge commit：`dbdf55e`
  - 结果：游戏页真实接入 `POST /api/games/{id}/guesses`，提交、加载、历史刷新、重复猜词提示与猜中跳转已接通。
- 评分反馈后端链路：
  - 子任务提交：`84cc92787e4017668cae4a1d601e7560abaeb611`
  - merge commit：`bd3d226`
  - 结果：`POST /api/games/{id}/feedback` 已接通，支持 `score_unreasonable`、guess 归属校验、重复反馈拦截和 note 校验。
- 第五批合并后主验证：
  - `npm run typecheck` 通过
  - `npm test` 通过，8 个文件 46 个用例
  - `node --test tests/domain/scoring.test.mjs` 通过，14 项
  - `npm run build` 通过
  - `npm run cf:check` 通过
  - seed/migration 校验通过
  - `.agent-handoff` 校验通过
  - `npm run dev:pages` 下，`POST /api/sessions -> POST /api/games -> POST /api/games/{id}/guesses -> GET /api/games/{id} -> POST /api/games/{id}/feedback -> POST /api/games/{id}/give-up -> GET /api/games/{id}` 真实链路通过
- 清理结果：第五批两个 worktree 与临时分支已删除。

## 第六批建议

基于第五批后的最新 `main`，优先拆这两条：

1. `前端反馈接入与交互收尾`
   - 范围：把反馈弹层/按钮接到真实 `POST /api/games/{id}/feedback`，把 disabled 占位替换成真实提交与失败态；视需要同步结果页/历史展示。
2. `过期与上限规则`
   - 范围：实现单局 100 次上限、TTL 过期状态、相关状态查询和结果页支持；必要时补最小 cron/usecase 边界，但不强求真实计划任务部署。
