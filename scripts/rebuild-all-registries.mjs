#!/usr/bin/env node
/**
 * scripts/rebuild-all-registries.mjs — ПЕРЕСБОРКА ВСЕХ РЕЕСТРОВ CRUCIX
 *
 * ШАПКА-ПАСПОРТ:
 *   Создан:      20.09.2026 (шаг 4 плана единого дискового реестра)
 *   Назначение:  пересборка реестров data/registry/*.json в конце сессии
 *   Справка RU:  docs/help/ru/registry/rebuild-all-registries.md
 *   Справка EN:  docs/help/en/registry/rebuild-all-registries.md
 *
 * ЗАПУСК:
 *   cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/rebuild-all-registries.mjs
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Запускает server/build-registry.mjs → обновляет server/registry.generated.json
 *      и data/registry/registry-basket.json.
 *   2. Сканирует scripts/collectors/collect-*.mjs → обновляет
 *      data/registry/registry-collectors.json.
 *   3. Сканирует dashboard/public/*.html → обновляет
 *      data/registry/registry-pages.json.
 *   4. Сканирует apis/sources/*.mjs → обновляет
 *      data/registry/registry-api.json.
 *   5. Пишет лог в logs/registry/rebuild-<timestamp>.log.
 *   6. Показывает сводку — что пересобрано.
 *
 * ЧТО НЕ ДЕЛАЕТ:
 *   - не удаляет старые файлы (только перезаписывает через writeFile)
 *   - не трогает registry-broken.json и registry-architecture.json
 *     (они ведутся вручную, автомат не должен их затирать)
 *   - не запускает сервер
 */

import { readFile, writeFile, readdir, stat, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const COLLECTORS_DIR = join(ROOT, 'scripts', 'collectors');
const PAGES_DIR = join(ROOT, 'dashboard', 'public');
const API_DIR = join(ROOT, 'apis', 'sources');
const REGISTRY_DIR = join(ROOT, 'data', 'registry');
const LOGS_DIR = join(ROOT, 'logs', 'registry');
const BUILD_REGISTRY = join(ROOT, 'server', 'build-registry.mjs');

const OUT_COLLECTORS = join(REGISTRY_DIR, 'registry-collectors.json');
const OUT_PAGES = join(REGISTRY_DIR, 'registry-pages.json');
const OUT_API = join(REGISTRY_DIR, 'registry-api.json');

function nowIso() {
  return new Date().toISOString();
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function logLine(file, msg) {
  const l = '[' + nowIso() + '] ' + msg + '\n';
  await appendFile(file, l);
  process.stdout.write(l);
}

async function listMjs(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter(f => f.endsWith('.mjs') && !f.startsWith('.')).sort();
}

async function listHtml(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter(f => f.endsWith('.html') && !f.startsWith('.')).sort();
}

// --- Сборщики ---

async function scanCollectors() {
  const files = await listMjs(COLLECTORS_DIR);
  const items = [];
  for (const file of files) {
    const full = join(COLLECTORS_DIR, file);
    let content = '';
    try { content = await readFile(full, 'utf8'); }
    catch { continue; }
    const id = basename(file, '.mjs');
    let schedule = null;
    // Ищем cron-расписание в шапке или в коде: '0 3 * * *', '*/15 * * * *'
    const m = content.match(/['"]([\d\*\/,\-\s]{9,20})['"]/);
    if (m) schedule = m[1].trim();
    let status = 'active';
    if (/\bDEPRECATED\b|\bУСТАРЕЛ\b/i.test(content.slice(0, 400))) status = 'deprecated';
    items.push({
      id,
      path: 'scripts/collectors/' + file,
      schedule,
      status,
      detected: nowIso()
    });
  }
  return items;
}

async function writeCollectorsRegistry(items) {
  const doc = {
    meta: {
      schema_version: 'crucix.registry.collectors.v1',
      generated_by: 'scripts/rebuild-all-registries.mjs',
      generated_at: nowIso(),
      description: 'Реестр сборщиков Crucix (scripts/collectors/collect-*.mjs).',
      help_ru_link: 'docs/help/ru/collectors/README.md',
      help_en_link: 'docs/help/en/collectors/README.md',
      total: items.length
    },
    items
  };
  await writeFile(OUT_COLLECTORS, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

// --- Страницы ---

async function scanPages() {
  const files = await listHtml(PAGES_DIR);
  const items = [];
  for (const file of files) {
    const full = join(PAGES_DIR, file);
    let st;
    try { st = await stat(full); } catch { continue; }
    const id = basename(file, '.html');
    const item = {
      id,
      path: 'dashboard/public/' + file,
      title: id,
      category: 'dashboard',
      size_bytes: st.size,
      status: 'active',
      detected: nowIso()
    };
    // Пометим копии и личные файлы (по RULES.txt №42)
    if (/[А-Яа-яЁё]/.test(file) || /\(/.test(file) || /^\d/.test(file)) {
      item.status = 'personal';
    }
    items.push(item);
  }
  return items;
}

async function writePagesRegistry(items) {
  const doc = {
    meta: {
      schema_version: 'crucix.registry.pages.v1',
      generated_by: 'scripts/rebuild-all-registries.mjs',
      generated_at: nowIso(),
      description: 'Реестр страниц интерфейса Crucix (dashboard/public/*.html).',
      help_ru_link: 'docs/help/ru/pages/README.md',
      help_en_link: 'docs/help/en/pages/README.md',
      total: items.length
    },
    items
  };
  await writeFile(OUT_PAGES, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

// --- API-модули ---

async function scanApi() {
  const files = await listMjs(API_DIR);
  const items = [];
  for (const file of files) {
    const full = join(API_DIR, file);
    let content = '';
    try { content = await readFile(full, 'utf8'); }
    catch { continue; }
    const id = basename(file, '.mjs');
    const routeMatch = content.match(/export\s+const\s+route\s*=\s*['"]([^'"]+)['"]/);
    const methodMatch = content.match(/export\s+const\s+method\s*=\s*['"]([^'"]+)['"]/);
    const methodsMatch = content.match(/export\s+const\s+methods\s*=\s*\[([^\]]+)\]/);
    const hasHandler = /export\s+(async\s+)?function\s+handler\s*\(/.test(content)
                    || /export\s+const\s+handler\s*=/.test(content);
    if (!routeMatch) continue;
    const item = {
      id,
      path: 'apis/sources/' + file,
      endpoint: routeMatch[1],
      type: hasHandler ? 'data' : 'unknown',
      method: methodMatch ? methodMatch[1].toUpperCase() : null,
      methods: methodsMatch ? methodsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '').toUpperCase()) : null,
      status: hasHandler ? 'active' : 'no_handler',
      detected: nowIso()
    };
    items.push(item);
  }
  return items;
}

async function writeApiRegistry(items) {
  const doc = {
    meta: {
      schema_version: 'crucix.registry.api.v1',
      generated_by: 'scripts/rebuild-all-registries.mjs',
      generated_at: nowIso(),
      description: 'Реестр API-модулей Crucix (apis/sources/*.mjs).',
      help_ru_link: 'docs/help/ru/api/README.md',
      help_en_link: 'docs/help/en/api/README.md',
      total: items.length
    },
    items
  };
  await writeFile(OUT_API, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

// --- Главное ---

async function main() {
  const started = Date.now();
  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(REGISTRY_DIR, { recursive: true });
  const logFile = join(LOGS_DIR, 'rebuild-' + ts() + '.log');
  await writeFile(logFile, '', 'utf8');

  await logLine(logFile, '=== REBUILD ALL REGISTRIES — старт ===');

  // 1. server/build-registry.mjs
  let buildOk = false;
  if (existsSync(BUILD_REGISTRY)) {
    try {
      const { stdout, stderr } = await execFileAsync('node', [BUILD_REGISTRY], { cwd: ROOT });
      buildOk = true;
      await logLine(logFile, 'OK server/build-registry.mjs — выполнен');
      if (stdout) await appendFile(logFile, stdout);
      if (stderr) await appendFile(logFile, stderr);
    } catch (e) {
      await logLine(logFile, 'FAIL server/build-registry.mjs: ' + e.message);
    }
  } else {
    await logLine(logFile, 'SKIP server/build-registry.mjs — файл не найден');
  }

  // 2. Сборщики
  const collectors = await scanCollectors();
  await writeCollectorsRegistry(collectors);
  await logLine(logFile, 'OK registry-collectors.json — ' + collectors.length + ' записей');

  // 3. Страницы
  const pages = await scanPages();
  await writePagesRegistry(pages);
  await logLine(logFile, 'OK registry-pages.json — ' + pages.length + ' записей');

  // 4. API-модули
  const api = await scanApi();
  await writeApiRegistry(api);
  await logLine(logFile, 'OK registry-api.json — ' + api.length + ' записей');

  const duration = Date.now() - started;
  await logLine(logFile, '=== REBUILD ALL REGISTRIES — завершено за ' + duration + 'мс ===');

  // Сводка
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  ПЕРЕСБОРКА РЕЕСТРОВ ЗАВЕРШЕНА');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  server/build-registry.mjs:  ' + (buildOk ? 'OK' : 'FAIL/SKIP'));
  console.log('  registry-collectors.json:   ' + collectors.length + ' записей');
  console.log('  registry-pages.json:        ' + pages.length + ' записей');
  console.log('  registry-api.json:          ' + api.length + ' записей');
  console.log('  лог: ' + logFile);
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
}

main().catch(e => {
  console.error('ФАТАЛЬНАЯ ОШИБКА: ' + (e.stack || e.message));
  process.exit(1);
});
