/**
 * scripts/warehouse/lineage.mjs
 * Модуль происхождения данных (lineage).
 *
 * Отвечает на вопрос: "откуда взялась эта цифра в basket?"
 * Цепочка: raw snapshot → адаптер → basket → потребитель.
 *
 * Контракт:
 *   loadLineage() → {schema, updated_at, items: {id: [records]}}
 *   addLineageEntry(id, entry) → мутирует объект в памяти
 *   saveLineage(lineage) → атомарная запись
 *   getLineageFor(id) → массив записей для источника
 *   getAllLineage() → весь объект
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const LINEAGE_PATH = join(ROOT, 'data', 'warehouse', 'lineage.json');

const MAX_ENTRIES_PER_SOURCE = 50;

export async function loadLineage() {
  if (!existsSync(LINEAGE_PATH)) {
    return { schema: 'crucix.warehouse.lineage.v1', updated_at: null, items: {} };
  }
  try {
    const raw = await readFile(LINEAGE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { schema: 'crucix.warehouse.lineage.v1', updated_at: null, items: {} };
  }
}

export async function saveLineage(lineage) {
  lineage.updated_at = new Date().toISOString();
  await mkdir(dirname(LINEAGE_PATH), { recursive: true });
  const tmp = LINEAGE_PATH + '.tmp';
  const payload = JSON.stringify(lineage, null, 2);
  await writeFile(tmp, payload, 'utf-8');
  await writeFile(LINEAGE_PATH, payload, 'utf-8');
}

export function addLineageEntry(lineage, id, entry) {
  if (!lineage.items[id]) lineage.items[id] = [];
  const record = {
    ts: new Date().toISOString(),
    raw_file: entry.raw_file || null,
    raw_checksum: entry.raw_checksum || null,
    adapter: entry.adapter || null,
    adapter_version: entry.adapter_version || null,
    records_in: entry.records_in ?? null,
    records_out: entry.records_out ?? null,
    dropped_fields: entry.dropped_fields || [],
    added_fields: entry.added_fields || [],
    unmapped_count: entry.unmapped_count ?? 0,
    skipped_count: entry.skipped_count ?? 0,
    notes: entry.notes || null
  };
  lineage.items[id].push(record);
  // Оставляем только последние MAX_ENTRIES_PER_SOURCE
  if (lineage.items[id].length > MAX_ENTRIES_PER_SOURCE) {
    lineage.items[id] = lineage.items[id].slice(-MAX_ENTRIES_PER_SOURCE);
  }
}

export async function getLineageFor(id) {
  const lineage = await loadLineage();
  return lineage.items[id] || [];
}

export async function getAllLineage() {
  return await loadLineage();
}

export const LINEAGE_FILE = LINEAGE_PATH;
