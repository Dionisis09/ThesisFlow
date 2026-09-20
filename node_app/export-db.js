import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DB = path.join(ROOT, 'data', 'dev.db');
const OUTPUT_DIR = path.join(ROOT, 'database');
const OUTPUT_SQL = path.join(OUTPUT_DIR, 'thesisflow.sql');

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot export a non-finite number.');
    return String(value);
  }
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

const source = new DatabaseSync(SOURCE_DB);
const tables = source.prepare(`
  SELECT name, sql
  FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
  ORDER BY name
`).all();
const indexes = source.prepare(`
  SELECT name, sql
  FROM sqlite_master
  WHERE type = 'index' AND sql IS NOT NULL
  ORDER BY name
`).all();

const lines = [
  '-- ThesisFlow SQLite export',
  '-- Generated from data/dev.db with: npm run db:export',
  'PRAGMA foreign_keys = OFF;',
  'BEGIN TRANSACTION;',
  '',
];

let exportedRows = 0;
const sourceCounts = new Map();

for (const table of tables) {
  lines.push(`${table.sql};`, '');
}

for (const table of tables) {
  const tableName = quoteIdentifier(table.name);
  const rows = source.prepare(`SELECT * FROM ${tableName} ORDER BY rowid`).all();
  sourceCounts.set(table.name, rows.length);
  exportedRows += rows.length;
  if (!rows.length) continue;

  const columns = Object.keys(rows[0]);
  const columnList = columns.map(quoteIdentifier).join(', ');
  for (const row of rows) {
    const values = columns.map((column) => sqlValue(row[column])).join(', ');
    lines.push(`INSERT INTO ${tableName} (${columnList}) VALUES (${values});`);
  }
  lines.push('');
}

for (const index of indexes) {
  lines.push(`${index.sql};`);
}

lines.push('', 'COMMIT;', 'PRAGMA foreign_keys = ON;', '');
const sql = lines.join('\n');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_SQL, sql, 'utf8');
source.close();

// Rebuild the database in memory to verify that the export is self-contained.
const restored = new DatabaseSync(':memory:');
restored.exec(sql);
const integrity = restored.prepare('PRAGMA integrity_check').get().integrity_check;
const foreignKeyViolations = restored.prepare('PRAGMA foreign_key_check').all().length;
for (const [tableName, expectedCount] of sourceCounts) {
  const restoredCount = restored.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`).get().count;
  if (restoredCount !== expectedCount) {
    throw new Error(`Row count mismatch for ${tableName}: expected ${expectedCount}, restored ${restoredCount}.`);
  }
}
restored.close();

if (integrity !== 'ok' || foreignKeyViolations !== 0) {
  throw new Error(`Export verification failed: integrity=${integrity}, foreignKeyViolations=${foreignKeyViolations}.`);
}

console.log(JSON.stringify({
  output: path.relative(ROOT, OUTPUT_SQL),
  tables: tables.length,
  rows: exportedRows,
  indexes: indexes.length,
  integrity,
  foreignKeyViolations,
}, null, 2));
