# 实际开发阶段编排 Handoff

## 已验证基线

- 当前仓库只有文档和原型图，没有 `package.json`、Wrangler 配置、前端入口或 Functions 入口。
- 已读取 `AGENTS.md`、关键设计文档、实施计划和原型说明。
- `.agent-handoff` task bundle 已创建：`202605171630-development-orchestration`。
- 首批四个独立 worktree 已创建，路径和分支见 `evidence/dispatch-plan.md`。
- 首批四个子代理已派发，子代理 ID 见 `evidence/dispatch-plan.md`。
- 首批四个子任务均已有提交并完成主代理初步复验。
- 首批四个子任务已合入 `main`，合并后验证通过，临时 worktree 和分支已清理。

## 未完成

- 派发下一批子代理，必须从最新 `main` 创建 worktree。
- 完成会话、游戏、猜词、放弃、缓存、AI stub/live adapter 和前端页面主流程。

## 第一步该做什么

- 从最新 `main` 拆下一批任务，不要基于旧 worktree 或已删除分支继续派发。

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
- 当前 `main` 已有项目骨架、migration/seed、评分规则和前端规格，但还不是可完整游玩的一局。
- 子代理曾发送 ntfy；后续派发必须明确禁止子代理发送通知。
