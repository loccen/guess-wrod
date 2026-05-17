import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const wordsPath = resolve(repoRoot, 'data/seed-words.v0.1.json');
const words = JSON.parse(readFileSync(wordsPath, 'utf8'));

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonString = (value) => sqlString(JSON.stringify(value));

console.log('BEGIN;');
for (const entry of words) {
  const values = [
    sqlString(entry.id),
    sqlString(entry.word),
    sqlString(entry.word_normalized),
    jsonString(entry.aliases),
    jsonString(entry.categories),
    jsonString(entry.tags),
    sqlString(entry.difficulty),
    entry.enabled ? '1' : '0',
  ];
  console.log(
    `INSERT OR REPLACE INTO words (id, word, word_normalized, aliases, categories, tags, difficulty, enabled) VALUES (${values.join(', ')});`,
  );
}
console.log('COMMIT;');
