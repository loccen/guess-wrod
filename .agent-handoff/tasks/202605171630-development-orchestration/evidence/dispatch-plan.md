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
