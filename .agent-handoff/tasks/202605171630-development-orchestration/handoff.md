# 实际开发阶段编排 Handoff

## 已验证基线

- 当前仓库只有文档和原型图，没有 `package.json`、Wrangler 配置、前端入口或 Functions 入口。
- 已读取 `AGENTS.md`、关键设计文档、实施计划和原型说明。
- `.agent-handoff` task bundle 已创建：`202605171630-development-orchestration`。
- 首批四个独立 worktree 已创建，路径和分支见 `evidence/dispatch-plan.md`。

## 未完成

- 派发子代理执行 T01 项目骨架、数据与词库准备、评分规则准备、前端原型规格准备。
- 等待子代理提交后验收、合并、清理。

## 第一步该做什么

- 派发四个子代理；T01 项目骨架是主要阻塞项。

## 先看哪些文件/命令

- `AGENTS.md`
- `.agent-handoff/ACTIVE.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/task.md`
- `.agent-handoff/tasks/202605171630-development-orchestration/evidence/dispatch-plan.md`
- `docs/07-implementation-plan.md`
- `docs/ui-prototypes/README.md`
- `git status --short --branch`
- `ai-task show`

## 风险

- 主代理不能直接写业务或前端实现；具体实现必须由子代理完成。
- 前端任务如果不使用 `image2code-skill`，不满足用户硬性要求。
- T01 未完成前，后续 API、D1 和前端实现都可能因目录结构变化返工。
