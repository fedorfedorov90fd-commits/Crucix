#!/usr/bin/env node
/**
 * scripts/migrate-to-contract.mjs — МИГРАТОР К КОНТРАКТУ CRUCIX v2.0.0
 *
 * Приводит старые модули apis/sources/*-api.mjs к канону (эталон acled-api.mjs):
 *   1. Добавляет шапку /**, если её нет.
 *   2. Добавляет export const route = '/api/layers/<id>'; если нет.
 *   3. Добавляет export const method = 'GET'; если нет.
 *   4. Добавляет export const meta = { category, icon, color, vizType, source, description, ... };
 *      если нет. Meta берётся из data/basket/ и из layers.js (по совпадению id).
 *   5. Переименовывает export async function handleXxxAPI → export async function handler.
 *   6. Удаляет export default { handleXxxAPI }; и export default handleXxxAPI; в конце.
 *   7. Делает бэкап каждого файла в backups/migrate-<timestamp>/.
 *   8. Пишет отчёт: изменено/пропущено/ошибок.
 *
 * РЕЖИМЫ:
 *   node scripts/migrate-to-contract.mjs --dry-run     — показать, что будет сделано, ничего не менять
 *   node scripts/migrate-to-contract.mjs --all         — мигрировать все файлы без export const route
 *   node scripts/migrate-to-contract.mjs --file <name> — мигрировать один файл
 *   node scripts/migrate-to-contract.mjs --all --force — перезаписать даже те, у которых route есть (ОСТОРОЖНО)
 */

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const API_SOURCES  = join(PROJECT_ROOT, 'apis', 'sources');
const BASKET_DIR   = join(PROJECT_ROOT, 'data', 'basket');
const LAYERS_JS    = join(PROJECT_ROOT, 'dashboard', 'public', 'geo-map', 'js', 'layers.js');
const BACKUP_DIR   = join(PROJECT_ROOT, 'backups', `migrate-${timestamp()}`);

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ============================================================
//  ИЗВЛЕЧЕНИЕ META ИЗ LAYERS.JS
// ============================================================

async function loadLayersMap() {
  // Строит map: id → { name, color, icon, category, vizType, description }
  const map = new Map();
  let source;
  try { source = await fs.readFile(LAYERS_JS, 'utf8'); }
  catch { return map; }

  // Простой парсер: ищем объекты вида { id: 'xxx', name: '...', color: '#...', icon: '...', category: '...', vizType: '...' }
  const re = /\{\s*id\s*:\s*['"]([^'"]+)['"]([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const id = m[1];
    const tail = m[2];
    const get = (key) => {
      const r = new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`);
      const x = tail.match(r);
      return x ? x[1] : null;
    };
    map.set(id, {
      name: get('name'),
      color: get('color'),
      icon: get('icon'),
      category: get('category'),
      vizType: get('vizType'),
      description: get('description'),
    });
  }
  return map;
}

// ============================================================
//  ПРОВЕРКА ФАЙЛА ДАННЫХ
// ============================================================

async function basketFileExists(id) {
  try { await fs.access(join(BASKET_DIR, `${id}.json`)); return true; }
  catch { return false; }
}

// ============================================================
//  МИГРАЦИЯ ОДНОГО ФАЙЛА
// ============================================================

function extractRouteId(fileName) {
  // "acled-api.mjs" → "acled"; "=collector-logs-api.mjs" → "=collector-logs" (мусорное — отфильтруется)
  return basename(fileName).replace(/-api\.mjs$/, '');
}

function buildHeader(id, meta, basketExists, collectorGuess) {
  const lines = [
    '/**',
    ` * apis/sources/${id}-api.mjs — API-МОДУЛЬ`,
    ' *',
    ' * КОНТРАКТ CRUCIX v2.',
    ` * ИСТОЧНИК: data/basket/${id}.json${basketExists ? '' : ' (файл данных отсутствует — данные нужно собрать коллектором)'}.`,
    ` * Сборщик: ${collectorGuess}.`,
    ' *',
    ' * ФОРМАТЫ: json, csv, stats, raw.',
    ' * ФИЛЬТРЫ: ?limit=, ?since=, ?until=.',
    ' */',
    '',
  ];
  return lines.join('\n');
}

function buildMetaBlock(meta, id, basketExists) {
  const m = {
    category: meta.category || 'other',
    icon: meta.icon || '📊',
    color: meta.color || '#64748b',
    vizType: meta.vizType || 'marker',
    source: basketExists ? `basket/${id}.json` : null,
    collector: `collect-${id}.mjs`,
    cache: 300,
    description: meta.description || meta.name || `Слой ${id}`,
    unit: 'records',
  };
  return (
    'export const meta = {\n' +
    Object.entries(m).map(([k, v]) => `  ${k}: ${v === null ? 'null' : JSON.stringify(v)},`).join('\n') +
    '\n};\n'
  );
}

function insertAfterImports(source, block) {
  // Вставляем блок после последнего import ... ;
  const lines = source.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i]) || /^const .* = (require|await import)/.test(lines[i])) {
      lastImportIdx = i;
    }
    // Прекращаем искать после первой пустой строки + 3 не-import строк
  }
  if (lastImportIdx < 0) return block + '\n' + source;
  const before = lines.slice(0, lastImportIdx + 1).join('\n');
  const after  = lines.slice(lastImportIdx + 1).join('\n');
  return before + '\n\n' + block + '\n' + after;
}

function renameHandler(source) {
  // export async function handleXxxAPI(req, res) → export async function handler(req, res)
  source = source.replace(
    /export\s+async\s+function\s+handle[A-Za-z0-9_]+API\s*\(\s*([^)]+)\)/g,
    (m, args) => `export async function handler(${args})`
  );
  source = source.replace(
    /export\s+function\s+handle[A-Za-z0-9_]+API\s*\(\s*([^)]+)\)/g,
    (m, args) => `export function handler(${args})`
  );
  return source;
}

function removeDefaultExport(source) {
  // Удалить строку: export default { handleXxxAPI };
  source = source.replace(/^\s*export\s+default\s*\{[^}]*\}\s*;?\s*$/gm, '');
  // Удалить строку: export default handleXxxAPI;
  source = source.replace(/^\s*export\s+default\s+[A-Za-z0-9_]+\s*;?\s*$/gm, '');
  return source.replace(/\n{3,}/g, '\n\n');
}

async function migrateFile(fileName, layersMap, opts) {
  const id = extractRouteId(fileName);
  const fullPath = join(API_SOURCES, fileName);
  const changes = [];

  let source;
  try { source = await fs.readFile(fullPath, 'utf8'); }
  catch (e) { return { ok: false, file: fileName, reason: 'read_error: ' + e.message }; }

  const hasRoute = /export\s+const\s+route\s*=/.test(source);
  if (hasRoute && !opts.force) {
    return { ok: true, file: fileName, skipped: true, reason: 'already has route' };
  }

  // Мусорные имена (начинаются с не-буквы или содержат явно сервисные суффиксы)
  if (!/^[a-z][a-z0-9-]*$/.test(id)) {
    return { ok: false, file: fileName, skipped: true, reason: `suspicious id: "${id}"` };
  }

  const layerMeta = layersMap.get(id) || {};
  const basketExists = await basketFileExists(id);

  // 1. Шапка (если нет /**  в первых 20 строках)
  const first20 = source.split('\n').slice(0, 20).join('\n');
  if (!/\/\*\*/.test(first20)) {
    source = buildHeader(id, layerMeta, basketExists, `collect-${id}.mjs`) + source;
    changes.push('шапка');
  }

  // 2. route + method + meta — вставляем после импортов
  const blocks = [];
  if (!/export\s+const\s+route\s*=/.test(source)) {
    blocks.push(`export const route  = '/api/layers/${id}';\nexport const method = 'GET';\n`);
    changes.push('route+method');
  }
  if (!/export\s+const\s+meta\s*=/.test(source)) {
    blocks.push(buildMetaBlock(layerMeta, id, basketExists));
    changes.push('meta');
  }
  if (blocks.length > 0) {
    source = insertAfterImports(source, blocks.join('\n'));
  }

  // 3. Переименовать handler
  const beforeHandler = source;
  source = renameHandler(source);
  if (source !== beforeHandler) changes.push('handler-rename');

  // 4. Удалить export default
  const beforeDefault = source;
  source = removeDefaultExport(source);
  if (source !== beforeDefault) changes.push('remove-default');

  if (!opts.dryRun) {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.copyFile(fullPath, join(BACKUP_DIR, fileName));
    await fs.writeFile(fullPath, source, 'utf8');
  }

  return { ok: true, file: fileName, changes, backup: opts.dryRun ? null : join(BACKUP_DIR, fileName) };
}

// ============================================================
//  ОСНОВНОЙ ПРОХОД
// ============================================================

async function listTargets(all, force) {
  const entries = await fs.readdir(API_SOURCES);
  const files = entries.filter(f => f.endsWith('-api.mjs') && !f.startsWith('.'));
  const targets = [];
  for (const f of files) {
    const src = await fs.readFile(join(API_SOURCES, f), 'utf8');
    const hasRoute = /export\s+const\s+route\s*=/.test(src);
    if (all && (!hasRoute || force)) targets.push(f);
  }
  return targets;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all    = args.includes('--all');
  const force  = args.includes('--force');
  const fileIdx = args.indexOf('--file');

  const layersMap = await loadLayersMap();
  console.log(`[migrate] загружено meta из layers.js: ${layersMap.size} записей`);

  let targets = [];
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    targets = [args[fileIdx + 1]];
  } else if (all) {
    targets = await listTargets(all, force);
  } else {
    console.log('Укажи --all или --file <name>.');
    process.exit(1);
  }

  console.log(`[migrate] режим: ${dryRun ? 'DRY-RUN' : 'ЗАПИСЬ'} | целей: ${targets.length}`);
  if (!dryRun) console.log(`[migrate] бэкапы → ${BACKUP_DIR}`);
  console.log('');

  const report = { ok: 0, skipped: 0, failed: 0, results: [] };
  for (const f of targets) {
    const r = await migrateFile(f, layersMap, { dryRun, force });
    report.results.push(r);
    if (r.ok && r.skipped) report.skipped++;
    else if (r.ok)          report.ok++;
    else                    report.failed++;
    const mark = r.ok ? (r.skipped ? '·' : '✓') : '✗';
    const info = r.changes ? ' [' + r.changes.join(', ') + ']' : '';
    const note = r.reason ? ' — ' + r.reason : '';
    console.log(`  ${mark} ${f}${info}${note}`);
  }

  console.log('');
  console.log('=== ИТОГО ===');
  console.log(`Изменено:   ${report.ok}`);
  console.log(`Пропущено:  ${report.skipped}`);
  console.log(`Ошибок:     ${report.failed}`);
  if (dryRun) console.log('(dry-run — файлы НЕ изменены)');
  console.log('=== ГОТОВО ===');
}

main().catch(e => { console.error('MIGRATE ERROR:', e); process.exit(1); });
