# 实际开发阶段编排

- Task ID: `202605171630-development-orchestration`
- Created At: `2026-05-17T23:22:27+08:00`
- Updated At: `2026-05-17T23:22:27+08:00`
- Status: `active`

## 目标

- 要解决的问题：在设计文档和 H5 原型图已完成后，进入实际开发阶段，并用主代理编排、子代理实现的方式推进。
- 完成后的可见结果：仓库从纯文档状态推进到可本地启动、可测试、可继续拆分实施的 Cloudflare 全栈项目；所有具体实现由子代理在独立 worktree 完成，主代理只做派发、监督、验收、整合和交接管理。

## 范围

- 包含：任务拆分、worktree 创建、子代理派发、子代理结果验收、合并、提交、`.agent-handoff` 状态维护、最终验证与清理。
- 不包含：主代理直接编写业务代码、前端页面代码、测试代码、实现文档同步内容。

## 事实源

- AGENTS.md
- docs/02-architecture.md
- docs/04-api-contract.md
- docs/05-scoring-spec.md
- docs/07-implementation-plan.md
- docs/08-analytics-and-quality.md
- docs/ui-prototypes/images

## 关键决策

- 决策：首批先派发 T01 项目骨架；同时派发不依赖骨架的资料准备任务，降低后续阻塞。
- 原因：当前仓库只有文档和原型图，没有 `package.json`、Wrangler、Pages Functions、前端入口或测试配置；T02/T03/T05/T17 等多数任务依赖 T01 的技术栈和目录边界。
- 决策：前端子任务必须显式使用 `image2code-skill`，并引用 `docs/ui-prototypes/images`。
- 原因：用户要求前端实现必须按该 skill 处理原型图，且原型图已包含页面、设计规范和模块素材清单。
- 决策：业务层和领域层不得直接依赖 Cloudflare 平台对象，平台能力只出现在入口层或 adapter。
- 原因：`AGENTS.md`、`docs/02-architecture.md` 与 `docs/07-implementation-plan.md` 均把平台中立边界列为强约束。

## 验收标准

- python3 /Users/loccen/.codex/skills/agent-handoff/scripts/validate_handoff.py --repo-root .
- 子任务验收必须读取 ai-task show、diff、提交、测试和运行证据
- 主代理不得直接实现业务或前端代码；如子代理超过十分钟没有任何文件变更，只诊断和重派，不替代实现。
- 每个子代理必须使用独立 worktree，并维护自己的 `ai-task` 状态。
- 具体实现涉及接口、评分、架构、本地开发、分析质量或前端交互时，必须同步更新对应 docs。
- 交付 Git 改动必须通过 `ai-commit` 中文提交；多分支合入 main 默认使用 `git merge --no-ff`。

## 当前状态

- 已完成：读取 `AGENTS.md`、`docs/02-architecture.md`、`docs/04-api-contract.md`、`docs/05-scoring-spec.md`、`docs/07-implementation-plan.md`、`docs/08-analytics-and-quality.md`、`docs/ui-prototypes/README.md`。
- 已完成：确认仓库当前只有文档和原型图，尚无实现骨架；已创建本 task bundle 和本线程 `ai-task`。
- 未完成：创建首批独立 worktree，派发子代理，等待子代理提交后验收并合入。
- 阻塞：T02/T03/T05/T17 等实现任务依赖 T01 的项目骨架与目录结构。

## 下一步

- 创建首批 worktree，并派发：T01 项目骨架、数据与词库准备、评分规则准备、前端原型规格准备。
