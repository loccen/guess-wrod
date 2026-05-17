# 猜不到的词 H5 原型图说明

本目录保存 V0.1 H5 前端原型图。视觉方向采用浅色现代休闲益智风：暖白底、薄荷渐变、主青按钮、珊瑚危险态、阳光黄提示态、圆角卡片和轻量线性图标。

## 文件清单

| 文件 | 页面或看板 | 说明 |
| --- | --- | --- |
| `images/00-session-restore.png` | 启动 / 恢复会话 | 首次进入、匿名会话创建、未结束游戏恢复 |
| `images/01-home.png` | 首页 | 开始随机局、玩法说明、最近成绩、隐私入口 |
| `images/02-game-playing.png` | 游戏页 | 猜词输入、AI 评分中、最高分、历史、反馈、放弃 |
| `images/03-score-feedback.png` | 评分反馈弹层 | 对单次猜词标记分数不合理，并提交备注 |
| `images/04-result-success.png` | 猜中结果 | 展示答案、别名、统计、最接近未命中词、再来一局 |
| `images/05-result-give-up.png` | 放弃结果 | 展示答案、最高分路径、鼓励提示、再来一局 |
| `images/06-result-expired.png` | 过期结果 | 展示答案、过期原因、统计、最高分路径、再来一局 |
| `images/07-rules-privacy.png` | 玩法与隐私 | 游戏规则、AI 评分说明、隐私说明、异常不计次 |
| `images/08-design-spec-board.png` | 设计规范图 | 字体、图标、组件、色彩、数据内容规范和样例 |
| `images/09-module-assets-board.png` | 模块素材清单图 | 页面模块、核心组件、图标素材、数据样例、交互状态 |

## Image2Code 规格产物

本目录已按 `image2code-skill` 流程补充后续前端实现可直接使用的规格：

| 路径 | 说明 |
| --- | --- |
| `normalized/<id>/<id>.normalized.png` | 由 normalizer 生成的 confirmed PNG，后续视觉验收必须使用这些图片作为 reference |
| `normalized/<id>/<id>.normalized.crop-preview.png` | 对应裁剪预览；本批输入均按 `--crop full` 处理 |
| `normalized/<id>/prototype-normalization.json` | 每张输入图的 confirmed normalization metadata |
| `normalized/prototype-normalization.json` | 汇总索引，便于查找每张图的 normalized 文件与 metadata |
| `specs/design-dna.json` | 从设计规范图和模块素材清单提取的设计 DNA |
| `specs/page-specs.json` | 8 个关键页面的结构化规格索引、关键节点和 visual QA 建议 |
| `specs/pages/*.ui-spec.json` | 每个关键页面可单独交给 visual QA runner 的完整规格 |
| `visual-qa/visual-qa-plan.json` | 后续实现后的视觉验收运行建议 |

注意：`08-design-spec-board` 和 `09-module-assets-board` 是设计/素材看板，不作为页面还原目标 URL 的 reference；它们只进入 `design-dna.json`。8 张业务页面的 visual QA reference 均指向 `normalized/` 下的 confirmed PNG。

## 页面功能与交互

1. 启动 / 恢复会话：进入 H5 后创建或恢复匿名会话；若 `GET /api/session` 返回 `active_game_id`，进入游戏页；无进行中游戏则进入首页。
2. 首页：点击“开始一局”调用 `POST /api/games`，成功后跳转 `/games/:gameId`；玩法说明进入 `07-rules-privacy` 页面。
3. 游戏页：输入 1-20 个字符猜词；点击“提交”调用 `POST /api/games/{game_id}/guesses`；展示加载态，不清空输入；返回分数后更新最高分和历史列表。
4. 评分反馈：点击历史行“反馈”打开底部弹层；选择“分数偏高 / 分数偏低 / 关系不对”，可填写 100 字以内备注；提交 `POST /api/games/{game_id}/feedback`。
5. 放弃：点击“放弃看答案”调用 `POST /api/games/{game_id}/give-up`；成功后进入放弃结果页。
6. 结果页：`success`、`give_up`、`expired` 三种结果都展示答案、统计和复盘列表；点击“再来一局”重新调用 `POST /api/games`。
7. 玩法与隐私：只展示说明，不收集表单信息；底部“知道了”返回上一页或首页。

## 业务规则

1. 答案在游戏结束前不可见。
2. 前端只展示最终百分比，不展示 AI `reason`。
3. 标准答案或显式别名命中时显示 `100%` 并进入猜中结果。
4. 重复猜词、非法输入、敏感词、限流、AI 超时和系统错误不增加有效次数。
5. 单局最多 100 次有效猜词；达到上限仍未猜中则进入过期结果。
6. 从创建时间起 24 小时未完成的游戏进入过期结果。
7. `401` 清理本地 token 后重新创建匿名会话。
8. `403 turnstile_required` 补安全校验后重试原请求。
9. `409 game_ended` 刷新游戏状态并进入对应结果页。
10. `503/500` 保留当前页面状态，允许用户重试。

## 设计规范

| 项目 | 规范 |
| --- | --- |
| 标题字体 | 圆润黑体风格，700 字重 |
| 正文字体 | 清晰无衬线，400-500 字重 |
| 主色 | `#1B9AAA` |
| 背景 | `#FFF8EA` 到 `#B8F3D4` 的轻渐变 |
| 危险态 | `#FF7A6B` |
| 提示态 | `#FFD166` |
| 文字深色 | `#243447` |
| 卡片 | 白色或暖白，20-28px 圆角，轻阴影 |
| 图标 | 2px 线性图标，圆角端点，优先 SVG |
| 控件高度 | 主按钮 56-64px，输入框 52-56px，状态徽章 28-34px |

## 样例数据

```json
{
  "game": {
    "status": "playing",
    "guess_count": 7,
    "expires_in_text": "剩余 23 小时",
    "best_guess": {
      "guess": "平板",
      "score": 76,
      "relation_label": "同类"
    }
  },
  "guesses": [
    { "guess": "平板", "score": 76, "relation_label": "同类", "counted": true },
    { "guess": "充电器", "score": 74, "relation_label": "配件", "counted": true },
    { "guess": "维修", "score": 72, "relation_label": "场景", "counted": true },
    { "guess": "电器", "score": 66, "relation_label": "上位", "counted": true }
  ],
  "result": {
    "answer": "手机",
    "answer_aliases": ["智能手机", "移动电话", "📱"],
    "duration_text": "6分18秒"
  }
}
```
