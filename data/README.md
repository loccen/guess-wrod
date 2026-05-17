# 本地 seed 资料

## 文件

- `seed-words.v0.1.json`：V0.1 本地测试词库，当前 50 条。
- `sensitive-terms.v0.1.txt`：敏感词初筛清单，用于 seed 检查和后续输入过滤资料。

## 词条字段

词条字段与 `docs/03-data-model.md` 的 `words` 表保持一致：

- `id`：稳定词条 ID。
- `word`：标准答案。
- `word_normalized`：按 V0.1 归一化规则处理后的标准答案。
- `aliases`：显式等价答案，命中后可直接给 100 分。
- `categories`：粗分类。
- `tags`：便于后续挑题、质量分析和人工扩充的标签。
- `difficulty`：`easy`、`normal`、`hard`。
- `enabled`：是否进入随机抽题池。

## 扩充方式

1. 优先补充日常具体物品、常见场景和明确设施，避免过抽象概念。
2. 新词条先放入 JSON，再运行 `node scripts/validate-seed.mjs`。
3. 别名只放显式等价答案；近义词、上位类、同类词留给评分规则处理。
4. 扩充到 300-500 条前，按分类保持均衡，避免某一类词过多影响随机体验。
5. 入库前继续使用敏感词清单检查；正式过滤模块可以复用此清单，也可以替换为 adapter 后的更完整策略。

## 本地导入验证

在已有 SQLite 数据库中导入词条：

```sh
node scripts/print-word-seed-sql.mjs | sqlite3 local.sqlite
```

从空库验证 migration 和 seed：

```sh
rm -f /tmp/guessword-seed-check.sqlite
sqlite3 /tmp/guessword-seed-check.sqlite < migrations/0001_initial_business_tables.sql
node scripts/print-word-seed-sql.mjs | sqlite3 /tmp/guessword-seed-check.sqlite
sqlite3 /tmp/guessword-seed-check.sqlite "SELECT COUNT(*) FROM words;"
```
