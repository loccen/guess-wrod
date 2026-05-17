import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const wordsPath = resolve(repoRoot, 'data/seed-words.v0.1.json');
const sensitivePath = resolve(repoRoot, 'data/sensitive-terms.v0.1.txt');

const normalize = (value) => String(value ?? '').trim().normalize('NFKC').toLowerCase();
const errors = [];

const words = JSON.parse(readFileSync(wordsPath, 'utf8'));
const sensitiveTerms = readFileSync(sensitivePath, 'utf8')
  .split(/\r?\n/)
  .map((line) => normalize(line))
  .filter((line) => line && !line.startsWith('#'));

const ids = new Set();
const normalizedWords = new Set();
const aliases = new Map();

if (!Array.isArray(words)) {
  errors.push('seed-words.v0.1.json 必须是数组');
  console.error(`seed 校验失败：${errors.length} 个问题`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (words.length < 50) {
  errors.push(`词条数量不足 50，当前 ${words.length}`);
}

for (const entry of words) {
  const word = normalize(entry?.word);
  if (word) normalizedWords.add(word);
}

for (const [index, entry] of words.entries()) {
  const place = `第 ${index + 1} 条`;
  const id = normalize(entry.id);
  const word = normalize(entry.word);
  const wordNormalized = normalize(entry.word_normalized);

  if (!id) errors.push(`${place}: id 为空`);
  if (!word) errors.push(`${place}: word 为空`);
  if (!wordNormalized) errors.push(`${place}: word_normalized 为空`);
  if (id && ids.has(id)) errors.push(`${place}: id 重复 ${entry.id}`);
  if (id) ids.add(id);
  const duplicateWord = words.findIndex((item, itemIndex) => itemIndex !== index && normalize(item?.word) === word);
  if (word && duplicateWord !== -1) errors.push(`${place}: word 重复 ${entry.word}`);
  if (word && word !== wordNormalized) {
    errors.push(`${place}: word_normalized 应为 ${word}，当前 ${entry.word_normalized}`);
  }

  if (!Array.isArray(entry.aliases)) errors.push(`${place}: aliases 必须是数组`);
  if (!Array.isArray(entry.categories) || entry.categories.length === 0) {
    errors.push(`${place}: categories 必须是非空数组`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
    errors.push(`${place}: tags 必须是非空数组`);
  }
  if (!['easy', 'normal', 'hard'].includes(entry.difficulty)) {
    errors.push(`${place}: difficulty 非法 ${entry.difficulty}`);
  }
  if (typeof entry.enabled !== 'boolean') {
    errors.push(`${place}: enabled 必须是 boolean`);
  }

  const fieldsForSensitiveCheck = [
    entry.word,
    ...(Array.isArray(entry.aliases) ? entry.aliases : []),
    ...(Array.isArray(entry.categories) ? entry.categories : []),
    ...(Array.isArray(entry.tags) ? entry.tags : []),
  ];

  for (const field of fieldsForSensitiveCheck) {
    const normalizedField = normalize(field);
    const hit = sensitiveTerms.find((term) => normalizedField.includes(term));
    if (hit) errors.push(`${place}: 字段命中敏感词初筛 "${hit}"，值为 "${field}"`);
  }

  if (Array.isArray(entry.aliases)) {
    const localAliases = new Set();
    for (const alias of entry.aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) errors.push(`${place}: alias 为空`);
      if (normalizedAlias === wordNormalized) {
        errors.push(`${place}: alias 不应等于标准答案 ${alias}`);
      }
      if (localAliases.has(normalizedAlias)) {
        errors.push(`${place}: alias 在当前词条内重复 ${alias}`);
      }
      localAliases.add(normalizedAlias);
      const previous = aliases.get(normalizedAlias);
      if (previous) {
        errors.push(`${place}: alias "${alias}" 与 ${previous} 重复`);
      } else if (normalizedAlias) {
        aliases.set(normalizedAlias, entry.id);
      }
      if (normalizedWords.has(normalizedAlias) && normalizedAlias !== wordNormalized) {
        errors.push(`${place}: alias "${alias}" 与其他标准词重复`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`seed 校验失败：${errors.length} 个问题`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`seed 校验通过：${words.length} 个词条，${aliases.size} 个别名，${sensitiveTerms.length} 个敏感词片段`);
