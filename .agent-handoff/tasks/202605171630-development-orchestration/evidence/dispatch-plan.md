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
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/t01-skeleton`
   - Branch：`codex/guessword-t01-skeleton`
   - 负责范围：创建 Cloudflare Pages + Functions 的 TypeScript 项目骨架、Wrangler 配置、本地 stub/bypass/noop/file 模式、基础健康检查、目录分层。
   - 验收重点：本地可启动空页面和 `/api/health`，目录体现 `domain`、`usecases`、`infrastructure/adapters`、`routes/handlers`。

2. `数据与词库准备`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/data-seed`
   - Branch：`codex/guessword-data-seed`
   - 负责范围：D1 migration 草案、seed 机制、首批 50 个本地测试词条起步、敏感词初筛资料。
   - 验收重点：不依赖业务实现也能提供可合入的数据文件和 migration；不得泄露敏感内容；词条避免抽象概念。

3. `评分规则准备`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/scoring-rules`
   - Branch：`codex/guessword-scoring-rules`
   - 负责范围：输入归一化、关系类型、分数上限、AI 输出后处理、人工样本集起步。
   - 验收重点：领域规则保持平台中立；提供单元测试或可直接接入测试的规则模块。

4. `前端原型规格准备`
   - Worktree：`/Users/loccen/Documents/guess-wrod-worktrees/frontend-spec`
   - Branch：`codex/guessword-frontend-spec`
   - 负责范围：使用 `image2code-skill` 处理 `docs/ui-prototypes/images`，输出规范化图片引用、`ui-spec.json` 或页面规格、视觉验收配置建议。
   - 验收重点：必须遵守 image2code 流程；若暂未能实现页面，需把可由后续前端实现任务直接使用的规格写入仓库。

## 主代理验收要求

- 每个子任务完成后先读对应 worktree 的 `ai-task show`。
- 核对 `git diff`、提交记录、测试命令输出和实际启动或脚本运行结果。
- 具体实现分支合入主线默认使用 `git merge --no-ff`。
- 不能只凭子代理文字汇报认定完成。
