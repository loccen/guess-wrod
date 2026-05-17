# 实际开发阶段编排 Handoff

## 已验证基线

- 当前仓库只有文档和原型图，没有 `package.json`、Wrangler 配置、前端入口或 Functions 入口。
- 已读取 `AGENTS.md`、关键设计文档、实施计划和原型说明。
- `.agent-handoff` task bundle 已创建：`202605171630-development-orchestration`。
- 首批四个独立 worktree 已创建，路径和分支见 `evidence/dispatch-plan.md`。
- 首批四个子代理已派发，子代理 ID 见 `evidence/dispatch-plan.md`。
- 首批四个子任务均已有提交并完成主代理初步复验。

## 未完成

- 把四个分支合入 `main`。
- 运行合并后的项目验证。
- 清理已合入 worktree 和临时分支。

## 第一步该做什么

- 从 T01 项目骨架开始用 `git merge --no-ff --no-commit` 合入，使用 `ai-commit` 创建中文 merge commit。

## 先看哪些文件/命令

- `AGENTS.md`
- `.agent-handoff/ACTIVE.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/task.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/evidence/dispatch-plan.md`
- `docs/07-implementation-plan.md`
- `docs/ui-prototypes/README.md`
- `git status --short --branch`
- `ai-task show`
- `git worktree list`

## 风险

- 主代理不能直接写业务或前端实现；具体实现必须由子代理完成。
- 前端任务如果不使用 `image2code-skill`，不满足用户硬性要求。
- 数据、T01 和前端规格都改了 `docs/07-implementation-plan.md` 或 docs 目录，合并时可能有文档冲突。
- 子代理曾发送 ntfy；后续派发必须明确禁止子代理发送通知。
