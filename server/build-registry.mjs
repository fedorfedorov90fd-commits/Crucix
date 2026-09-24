/**
 * server/build-registry.mjs — ГЕНЕРАТОР РЕЕСТРА CRUCIX v3.4.0
 *
 * ШАПКА-ПАСПОРТ (требование А от 20.09.2026):
 *   Создан:      scripts-командой Crucix (AI-ассистент под руководством хозяина)
 *   Принят:      20.09.2026
 *   Обновлён:    23.09.2026 — v3.4.0 (версии модулей во всём проекте)
 *   Назначение:  генерация единого реестра Crucix из фактов файловой системы
 *   Справка RU:  docs/help/ru/api/build-registry.md
 *   Справка EN:  docs/help/en/api/build-registry.md
 *   Схема meta:  crucix.registry.generated.v1
 *
 * ТРИ СЕКЦИИ РЕЕСТРА (v3.3.1) + ОДНА НОВАЯ (v3.4.0):
 *   routes   — Layer-модули (слои карты, /api/layers/*).
 *   services — Service-модули (инфраструктура, /api/services/*).
 *   basket   — реестр корзины данных (data/basket/*.json).
 *   modules  — НОВОЕ v3.4.0: сводка по всем .mjs проекта
 *              (apis/sources/, apis/predict/, scripts/analyzers/,
 *              scripts/warehouse/, scripts/collectors/, scripts/logs/, server/)
 *              с полем version, извлечённым из шапки файла.
 *
 * КОНТРАКТЫ:
 *   LAYER (single-method):
 *     export const route  = '/api/layers/<id>';
 *     export const method = 'GET';
 *     export const meta   = { category, icon, color, vizType, source, description, ... };
 *     export async function handler(req, res) {}
 *   SERVICE (single-method):
 *     export const route  = '/api/services/<id>';
 *     export const method = 'GET';
 *     export const meta   = { service: true, description, cache? };
 *     export async function handler(req, res) {}
 *   SERVICE (multi-method):
 *     export const route   = '/api/services/<id>';
 *     export const methods = ['GET', 'POST'];
 *     export const meta    = { service: true, description, cache? };
 *     export async function handler(req, res) {}
 *
 * ВОЗМОЖНОСТИ v3.2.0 (сохранены полностью):
 *   1. Поддержка method (string) И methods (array) — мультиметодные Service.
 *   2. Разделение на routes (Layer) и services (Service).
 *   3. Точный парсинг meta через баланс скобок + Function (без eval).
 *   4. Валидация category Layer-модулей по списку допустимых.
 *   5. Сбор дубликатов внутри каждой секции.
 *   6. Группировка Layer по category, Service по methods.
 *   7. Проверка basket-файлов для Layer (meta.source).
 *   8. Режимы --check (exit 1 если реестр устарел) и --watch.
 *   9. КАЖДЫЙ маршрут регистрируется ДВАЖДЫ: точный + wildcard '/ *'.
 *
 * ВОЗМОЖНОСТИ v3.3.0 (сохранены полностью):
 *  10. Секция basket — полный реестр data/basket/*.json с колонками:
 *      id, file, schema, has_meta, missing_meta_fields, series_len,
 *      readers, writers, status, help_ru_link, help_en_link.
 *  11. Сводка basket в meta: total_basket_files, total_basket_with_meta,
 *      total_basket_without_meta, basket_by_status.
 *  12. Связь basket ↔ API: readers (какие apis/sources/*.mjs читают)
 *      и writers (collector из meta).
 *  13. Генерация ВТОРОГО файла: data/registry/registry-basket.json.
 *  14. Шапка-паспорт в meta основного реестра.
 *
 * ВОЗМОЖНОСТИ v3.3.1 (сохранены полностью):
 *  15. РАСШИРЕННЫЙ сбор readers: 'basket/<id>.json', "basket/<id>.json",
 *      BASKET_DIR, '<id>.json', join(BASKET_DIR, '<id>.json').
 *  16. РАЗДЕЛЕНИЕ warnings на три категории.
 *  17. РАЗБОР meta.source СО ЗНАКОМ '+'.
 *  18. Поле basket_readers_count в meta.
 *
 * НОВОЕ в v3.4.0 (23.09.2026):
 *  19. Функция extractVersionFromHeader(source) — 6 паттернов:
 *      // Версия: X.Y.Z  |  * Версия X.Y.Z  |  export const version = 'X.Y.Z'
 *      |  const (ENGINE_)?VERSION = 'X.Y.Z'.
 *      Ограничение: только первые 200 строк файла (шапка).
 *  20. Секция modules — сводка по всем .mjs в 7 директориях проекта:
 *      apis/sources/, apis/predict/, scripts/analyzers/, scripts/warehouse/,
 *      scripts/collectors/, scripts/logs/, server/.
 *      Каждая запись: { version, has_header_version, dir }.
 *  21. Поле version в записях routes — из шапки соответствующего *-api.mjs.
 *  22. meta.total_modules_all, meta.modules_with_version, meta.modules_without_version,
 *      meta.versions_summary (распределение по major).
 *  23. meta.versioning_policy — описание трёх категорий модулей по версионированию
 *      (факт реальности проекта на 23.09.2026).
 *
 * ПРИНЦИП (правило хозяина 23.09.2026): версии модулей РАЗНЫЕ ПО СМЫСЛУ —
 * это норма (semver каждого модуля по своей истории). Реестр ФИКСИРУЕТ
 * фактические версии, НЕ синхронизирует их. Один источник правды.
 */

import { promises as fs, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const API_SOURCES  = join(PROJECT_ROOT, 'apis', 'sources');
const BASKET_DIR   = join(PROJECT_ROOT, 'data', 'basket');
const REGISTRY_DIR = join(PROJECT_ROOT, 'data', 'registry');
const OUT_FILE     = join(__dirname, 'registry.generated.json');
const BASKET_OUT   = join(REGISTRY_DIR, 'registry-basket.json');

const SCRIPT_PATH  = 'server/build-registry.mjs';
const SCHEMA_VER   = 'crucix.registry.generated.v1';
const BASKET_SCHEMA_VER = 'crucix.registry.basket.v1';

// НОВОЕ v3.4.0: директории для сканирования секции modules.
const MODULE_DIRS = [
  { path: join(PROJECT_ROOT, 'apis', 'sources'),       label: 'apis/sources' },
  { path: join(PROJECT_ROOT, 'apis', 'predict'),       label: 'apis/predict' },
  { path: join(PROJECT_ROOT, 'scripts', 'analyzers'),  label: 'scripts/analyzers' },
  { path: join(PROJECT_ROOT, 'scripts', 'warehouse'),  label: 'scripts/warehouse' },
  { path: join(PROJECT_ROOT, 'scripts', 'collectors'), label: 'scripts/collectors' },
  { path: join(PROJECT_ROOT, 'scripts', 'logs'),       label: 'scripts/logs' },
  { path: join(PROJECT_ROOT, 'server'),                label: 'server' },
];

const CHECK_MODE = process.argv.includes('--check');
const WATCH_MODE = process.argv.includes('--watch');

const ALLOWED_CATEGORIES = [
  "economics", "finance", "military", "geopolitical", "ecological",
  "cyber", "space", "news", "esg", "threats", "health", "energy",
  "transport", "infrastructure", "social", "intelligence", "other",
  "index", "detector", "forecast", "semantic", "flow", "market", "specialist",
];

// Обязательные поля meta по схеме crucix.basket.v1.
const BASKET_REQUIRED_META = [
  'id', 'source', 'source_url', 'fetched_at', 'normalized_at',
  'collector', 'license', 'count', 'granularity', 'value_unit', 'value_type'
];

// ============================================================
//  ИЗВЛЕЧЕНИЕ ПОЛЕЙ (без изменений с v3.3.1)
// ============================================================

function extractStringConst(source, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['"]([^'"]*)['"]`);
  const m = source.match(re);
  return m ? m[1] : null;
}

function extractStringArray(source, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`);
  const m = source.match(re);
  if (!m) return null;
  const arr = [];
  const inner = m[1];
  const strRe = /['"]([^'"]+)['"]/g;
  let sm;
  while ((sm = strRe.exec(inner)) !== null) {
    arr.push(sm[1].toUpperCase());
  }
  return arr.length > 0 ? arr : null;
}

function extractObjectBody(source, startIndex) {
  let depth = 0, inString = false, stringChar = '', i = startIndex;
  while (i < source.length) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === stringChar) { inString = false; }
    } else {
      if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; }
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return source.slice(startIndex, i + 1); }
    }
    i++;
  }
  return null;
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractMeta(source) {
  const clean = stripBlockComments(source);
  const marker = "export const meta";
  let idx = -1, searchFrom = 0;
  while (true) {
    const next = clean.indexOf(marker, searchFrom);
    if (next < 0) break;
    idx = next;
    searchFrom = next + marker.length;
  }
  if (idx < 0) return null;
  const braceIdx = clean.indexOf("{", idx);
  if (braceIdx < 0) return null;
  const body = extractObjectBody(clean, braceIdx);
  if (!body) return null;
  if (/`[^`]*\$\{/.test(body)) return null;
  if (/\brequire\s*\(/.test(body)) return null;
  if (/\bfunction\b/.test(body)) return null;
  if (/=>/.test(body)) return null;
  try {
    const fn = new Function(`return (${body});`);
    const obj = fn();
    if (obj && typeof obj === "object") return obj;
  } catch { return null; }
  return null;
}

function hasHandler(source) {
  return /export\s+(async\s+)?function\s+handler\s*\(/.test(source)
      || /export\s+const\s+handler\s*=/.test(source);
}

// ============================================================
//  НОВОЕ v3.4.0: ИЗВЛЕЧЕНИЕ ВЕРСИИ ИЗ ШАПКИ МОДУЛЯ
// ============================================================

/**
 * Извлекает версию модуля из шапки-комментария или экспортируемой константы.
 *
 * Паттерн 1: // Версия: X.Y.Z        (однострочный комментарий с двоеточием)
 * Паттерн 2: // Версия X.Y.Z         (однострочный комментарий без двоеточия)
 * Паттерн 3: * Версия X.Y.Z. Принят ... (многострочный комментарий)
 * Паттерн 4: export const version = 'X.Y.Z'
 * Паттерн 5: const VERSION = 'X.Y.Z'
 * Паттерн 6: const ENGINE_VERSION = 'X.Y.Z' (или любой *VERSION)
 *
 * Возвращает строку 'X.Y.Z' или null, если версия не найдена.
 * Ищет только в первых 200 строках (шапка файла), чтобы не поймать
 * случайное совпадение внутри тела модуля.
 */
function extractVersionFromHeader(source) {
  const header = source.split('\n').slice(0, 200).join('\n');

  // Паттерн 1, 2: // Версия: X.Y.Z  или  // Версия X.Y.Z
  let m = header.match(/\/\/\s*Версия[:\s]+([0-9]+\.[0-9]+\.[0-9]+)/);
  if (m) return m[1];

  // Паттерн 3: * Версия X.Y.Z
  m = header.match(/\*\s*Версия\s+([0-9]+\.[0-9]+\.[0-9]+)/);
  if (m) return m[1];

  // Паттерн 4: export const version = 'X.Y.Z'
  m = header.match(/export\s+const\s+version\s*=\s*['"`]([0-9]+\.[0-9]+\.[0-9]+)/);
  if (m) return m[1];

  // Паттерн 5, 6: const (ENGINE_)?VERSION = 'X.Y.Z'
  m = header.match(/(?:const|let|var)\s+(?:[A-Z_]*VERSION|[A-Z_]+_VERSION)\s*=\s*['"`]([0-9]+\.[0-9]+\.[0-9]+)/);
  if (m) return m[1];

  return null;
}

// ============================================================
//  РАЗБОР META.SOURCE (v3.3.1)
// ============================================================

function parseMetaSource(source) {
  if (typeof source !== 'string' || source.length === 0) {
    return { paths: [], isBasket: false };
  }
  const parts = source.split(/[+,]/).map(s => s.trim()).filter(Boolean);
  const paths = [];
  let isBasket = false;
  for (const p of parts) {
    if (p.startsWith('basket/')) {
      isBasket = true;
      const file = p.replace(/^basket\//, '');
      if (file) paths.push(file);
    }
  }
  return { paths, isBasket };
}

// ============================================================
//  СКАНИРОВАНИЕ МОДУЛЕЙ (routes/services) — v3.3.1
// ============================================================

function isOfficial(filename) {
  if (!filename.endsWith('.mjs')) return false;
  if (filename.startsWith('.')) return false;
  if (/[А-Яа-яЁё]/.test(filename)) return false;
  if (/[()\s=&%#]/.test(filename)) return false;
  return true;
}

function extractBasketRefs(source) {
  const refs = new Set();
  let m;
  const re1 = /['"`](?:data\/)?basket\/([a-z0-9_\-]+)\.json['"`]/gi;
  while ((m = re1.exec(source)) !== null) refs.add(m[1]);
  const re2 = /BASKET_DIR\s*,\s*['"`]([a-z0-9_\-]+)\.json['"`]/gi;
  while ((m = re2.exec(source)) !== null) refs.add(m[1]);
  const re3 = /join\s*\(\s*BASKET_DIR\s*,\s*['"`]([a-z0-9_\-]+)\.json['"`]/gi;
  while ((m = re3.exec(source)) !== null) refs.add(m[1]);
  return Array.from(refs);
}

async function scanModules() {
  const entries = await fs.readdir(API_SOURCES);
  const files = entries.filter(isOfficial).sort();

  const layers = [];
  const services = [];
  const skipped = [];
  const warnings = [];
  const basketReaders = new Map();

  let basketFiles = new Set();
  try { basketFiles = new Set(await fs.readdir(BASKET_DIR)); } catch {}

  for (const file of files) {
    const fullPath = join(API_SOURCES, file);
    let source = '';
    try { source = await fs.readFile(fullPath, 'utf8'); }
    catch (e) { warnings.push({ file, reason: 'read_error', message: e.message }); continue; }

    const route   = extractStringConst(source, 'route');
    const method  = extractStringConst(source, 'method');
    const methods = extractStringArray(source, 'methods');
    const meta    = extractMeta(source) || {};
    const handlerOk = hasHandler(source);
    const version = extractVersionFromHeader(source); // НОВОЕ v3.4.0

    const moduleId = file.replace(/\.mjs$/, '');

    // Расширенный сбор readers (v3.3.1): паттерны 1, 2, 3.
    const basketRefs = extractBasketRefs(source);
    for (const basketId of basketRefs) {
      if (!basketReaders.has(basketId)) basketReaders.set(basketId, new Set());
      basketReaders.get(basketId).add(moduleId);
    }

    if (!route) { skipped.push({ file, reason: 'no_route', hasHandler: handlerOk }); continue; }
    if (!handlerOk) { skipped.push({ file, reason: 'no_handler', route }); continue; }
    if (!route.startsWith('/api/')) { warnings.push({ file, reason: 'route_does_not_start_with_api', route }); continue; }

    const kind = (meta.service === true || route.startsWith('/api/services/')) ? 'service' : 'layer';

    const entry = { moduleId, file, route, meta, kind };
    if (methods) entry.methods = methods;
    if (method)  entry.method = method.toUpperCase();
    if (version) entry.version = version; // НОВОЕ v3.4.0

    if (kind === 'service') {
      if (meta.category && !ALLOWED_CATEGORIES.includes(meta.category)) {
        warnings.push({ file, reason: 'unknown_category', category: meta.category });
      }
      services.push(entry);
    } else {
      if (meta.category && !ALLOWED_CATEGORIES.includes(meta.category)) {
        warnings.push({ file, reason: 'unknown_category', category: meta.category });
      }
      // Проверка basket-файлов (v3.3.1): разбор meta.source с '+'.
      const parsed = parseMetaSource(meta.source);
      if (parsed.isBasket) {
        const missing = parsed.paths.filter(p => !basketFiles.has(p));
        if (missing.length === parsed.paths.length && parsed.paths.length > 0) {
          warnings.push({
            file,
            reason: 'basket_file_missing_static',
            basket: parsed.paths.join(' + '),
            basket_expected: parsed.paths,
          });
        } else if (missing.length > 0) {
          warnings.push({
            file,
            reason: 'basket_file_missing_static',
            basket: missing.join(' + '),
            basket_expected: parsed.paths,
            basket_found: parsed.paths.filter(p => basketFiles.has(p)),
          });
        }
      }
      layers.push(entry);
    }
  }

  return { layers, services, skipped, warnings, basketReaders };
}

// ============================================================
//  НОВОЕ v3.4.0: СКАНИРОВАНИЕ ВСЕХ МОДУЛЕЙ ПРОЕКТА (для секции modules)
// ============================================================

/**
 * Рекурсивно собирает все .mjs файлы в директории (глубина ограничена 3 уровнями).
 * Пропускает служебные файлы (начинающиеся с точки).
 * Возвращает отсортированный массив абсолютных путей.
 */
async function collectMjsFiles(rootDir, maxDepth = 3) {
  const result = [];
  const walk = async (dir, depth) => {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.mjs') && !e.name.startsWith('.')) {
        result.push(join(dir, e.name));
      } else if (e.isDirectory() && !e.name.startsWith('.')) {
        await walk(join(dir, e.name), depth + 1);
      }
    }
  };
  await walk(rootDir, 1);
  return result.sort();
}

/**
 * Сканирует все MODULE_DIRS, извлекает версии, возвращает:
 *   { modules: {relativePath: {version, has_header_version, dir}}, summary: {...} }
 *
 * Записи с версией: version = 'X.Y.Z', has_header_version = true.
 * Записи без версии: version = null, has_header_version = false.
 *
 * by_major: распределение по мажорной версии, только для файлов с версией.
 */
async function scanAllModules() {
  const modules = {};
  let withVersion = 0;
  let withoutVersion = 0;
  const byMajor = {};

  for (const { path: dir, label } of MODULE_DIRS) {
    let files = [];
    try { files = await collectMjsFiles(dir, 3); } catch { continue; }

    for (const fullPath of files) {
      let source = '';
      try { source = await fs.readFile(fullPath, 'utf8'); } catch { continue; }

      const version = extractVersionFromHeader(source);
      const relativePath = fullPath.replace(PROJECT_ROOT + '/', '');

      modules[relativePath] = {
        version: version || null,
        has_header_version: version !== null,
        dir: label,
      };

      if (version) {
        withVersion++;
        const major = version.split('.')[0];
        byMajor[major] = (byMajor[major] || 0) + 1;
      } else {
        withoutVersion++;
      }
    }
  }

  return {
    modules,
    summary: {
      total: withVersion + withoutVersion,
      with_version: withVersion,
      without_version: withoutVersion,
      by_major: byMajor,
    },
  };
}

// ============================================================
//  СКАНИРОВАНИЕ КОРЗИНЫ (без изменений с v3.3.0)
// ============================================================

function classifyBasketStatus(basketData, hasMeta) {
  if (!basketData || typeof basketData !== 'object') return 'unknown';
  const schema = basketData.schema;
  if (schema === 'crucix.basket.v1') {
    return hasMeta ? 'active' : 'legacy';
  }
  return 'unknown';
}

async function scanBasket(basketReaders) {
  const items = [];
  let total = 0, withMeta = 0, withoutMeta = 0;
  const byStatus = { active: 0, legacy: 0, unknown: 0 };

  let basketFiles = [];
  try { basketFiles = (await fs.readdir(BASKET_DIR)).filter(f => f.endsWith('.json')).sort(); }
  catch {}

  for (const file of basketFiles) {
    total++;
    const fullPath = join(BASKET_DIR, file);
    let data = null;
    let parseError = null;
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      data = JSON.parse(raw);
    } catch (e) {
      parseError = e.message;
    }

    const id = file.replace(/\.json$/, '');
    const schema = data && typeof data === 'object' ? (data.schema || null) : null;
    const meta = (data && typeof data === 'object' && data.meta && typeof data.meta === 'object') ? data.meta : null;

    const missing = [];
    if (meta) {
      for (const field of BASKET_REQUIRED_META) {
        if (meta[field] === undefined || meta[field] === null || meta[field] === '') {
          missing.push(field);
        }
      }
    } else {
      missing.push(...BASKET_REQUIRED_META);
    }
    const hasMeta = missing.length === 0;

    let seriesLen = 0;
    if (data && Array.isArray(data.series)) seriesLen = data.series.length;
    else if (data && Array.isArray(data.points)) seriesLen = data.points.length;
    else if (data && Array.isArray(data.regions)) seriesLen = data.regions.length;

    const status = classifyBasketStatus(data, hasMeta);
    const readers = basketReaders.has(id) ? Array.from(basketReaders.get(id)).sort() : [];
    const writers = meta && typeof meta.collector === 'string' && meta.collector.length > 0
      ? [meta.collector] : [];

    if (hasMeta) withMeta++; else withoutMeta++;
    byStatus[status] = (byStatus[status] || 0) + 1;

    items.push({
      id,
      file: `data/basket/${file}`,
      schema: schema || null,
      has_meta: hasMeta,
      missing_meta_fields: missing,
      series_len: seriesLen,
      readers,
      writers,
      status,
      help_ru_link: `docs/help/ru/basket/${id}.md`,
      help_en_link: `docs/help/en/basket/${id}.md`,
      parse_error: parseError,
    });
  }

  return { items, summary: { total, withMeta, withoutMeta, byStatus } };
}

// ============================================================
//  СБОРКА РЕЕСТРА
// ============================================================

function getAllowedMethodsList(entry) {
  if (Array.isArray(entry.methods) && entry.methods.length > 0) return entry.methods.map(m => String(m).toUpperCase());
  if (typeof entry.method === 'string' && entry.method.length > 0) return [entry.method.toUpperCase()];
  return [];
}

function indexByRoute(modules, label) {
  const byRoute = {};
  const duplicates = [];
  for (const m of modules) {
    if (byRoute[m.route]) {
      duplicates.push({ section: label, route: m.route, kept: byRoute[m.route].moduleId, dropped: m.moduleId });
      continue;
    }
    const entry = { moduleId: m.moduleId, file: m.file, meta: m.meta };
    if (m.methods) entry.methods = m.methods;
    if (m.method)  entry.method = m.method;
    if (m.version) entry.version = m.version; // НОВОЕ v3.4.0
    byRoute[m.route] = entry;

    const wildcardRoute = m.route.endsWith('/*') ? m.route : (m.route + '/*');
    if (!byRoute[wildcardRoute]) {
      byRoute[wildcardRoute] = { ...entry, subpath: true };
    }
  }
  return { byRoute, duplicates };
}

function buildRegistry(scan, basketScan, allModulesScan) {
  const layersIdx = indexByRoute(scan.layers, 'routes');
  const servicesIdx = indexByRoute(scan.services, 'services');

  const layerByCategory = {};
  for (const m of scan.layers) {
    const cat = m.meta && m.meta.category ? m.meta.category : 'unknown';
    layerByCategory[cat] = (layerByCategory[cat] || 0) + 1;
  }

  const servicesByMethod = {};
  for (const m of scan.services) {
    const methods = getAllowedMethodsList(m);
    if (methods.length === 0) {
      servicesByMethod['ANY'] = (servicesByMethod['ANY'] || 0) + 1;
    } else {
      for (const method of methods) {
        servicesByMethod[method] = (servicesByMethod[method] || 0) + 1;
      }
    }
  }

  let basketReadersCount = 0;
  for (const it of basketScan.items) {
    if (it.readers && it.readers.length > 0) basketReadersCount++;
  }

  return {
    meta: {
      schema_version: SCHEMA_VER,
      generated_by: SCRIPT_PATH,
      generated_at: new Date().toISOString(),
      description: 'Единый реестр Crucix: маршруты API (layers + services), корзина данных (basket), версии всех модулей (modules).',
      help_ru_link: 'docs/help/ru/api/build-registry.md',
      help_en_link: 'docs/help/en/api/build-registry.md',
      source_dir: 'apis/sources',

      total_scanned: scan.layers.length + scan.services.length + scan.skipped.length,
      total_modules: scan.layers.length + scan.services.length,
      total_layers: scan.layers.length,
      total_services: scan.services.length,
      total_routes: Object.keys(layersIdx.byRoute).length,
      total_service_routes: Object.keys(servicesIdx.byRoute).length,
      skipped: scan.skipped.length,
      duplicates: layersIdx.duplicates.length + servicesIdx.duplicates.length,
      warnings: scan.warnings.length,

      total_basket_files: basketScan.summary.total,
      total_basket_with_meta: basketScan.summary.withMeta,
      total_basket_without_meta: basketScan.summary.withoutMeta,
      total_basket_with_readers: basketReadersCount,
      basket_by_status: basketScan.summary.byStatus,

      layer_by_category: layerByCategory,
      services_by_method: servicesByMethod,

      // НОВОЕ v3.4.0: сводка по всем модулям проекта.
      total_modules_all: allModulesScan.summary.total,
      modules_with_version: allModulesScan.summary.with_version,
      modules_without_version: allModulesScan.summary.without_version,
      versions_summary: allModulesScan.summary.by_major,

      // НОВОЕ v3.4.0: описание трёх категорий версионирования (факт реальности на 23.09.2026).
      versioning_policy: {
        apis_sources: 'Контракт CRUCIX v2. Версия модуля в шапке НЕ указывается. Единый стиль: "КОНТРАКТ CRUCIX v2" + описание источника. Semver модуля не применяется.',
        scripts_collectors: 'Стандарт "* Версия X.Y.Z. Принят <дата>" в шапке. Semver модуля по истории изменений.',
        scripts_warehouse: 'Стандарт "* Версия X.Y.Z. Принят <дата>" в шапке. Semver модуля по истории изменений.',
        scripts_analyzers: 'Стандарт "* Версия X.Y.Z. Принят <дата>" в шапке. Semver модуля по истории изменений.',
        apis_predict: 'Стандарт "// Версия: X.Y.Z" в шапке или ENGINE_VERSION = "..." в теле. Semver модуля.',
        scripts_logs: 'Версия в шапке не указывается. Модули инфраструктуры логирования.',
        server: 'Версия в шапке не указывается (кроме build-registry.mjs — версия в первой строке комментария).',
      },
    },
    routes: layersIdx.byRoute,
    services: servicesIdx.byRoute,
    basket: basketScan.items,
    modules: allModulesScan.modules, // НОВОЕ v3.4.0
    skipped: scan.skipped,
    duplicates: [...layersIdx.duplicates, ...servicesIdx.duplicates],
    warnings: scan.warnings,
  };
}

// ============================================================
//  ВЫВОД
// ============================================================

function printSummary(registry) {
  const m = registry.meta;
  console.log('=== BUILD REGISTRY v3.4.0 ===\n');
  console.log(`Просканировано файлов:     ${m.total_scanned}`);
  console.log(`Модулей с route+handler:   ${m.total_modules}`);
  console.log(`  ├─ Layer (карта):        ${m.total_layers}  →  ${m.total_routes} маршрутов (точный + wildcard)`);
  console.log(`  └─ Service (инфра):      ${m.total_services}  →  ${m.total_service_routes} маршрутов (точный + wildcard)`);
  console.log(`Пропущено:                 ${m.skipped}`);
  console.log(`Дубликатов маршрутов:      ${m.duplicates}`);
  console.log(`Предупреждений:            ${m.warnings}`);
  console.log('');
  console.log(`КОРЗИНА (data/basket/):`);
  console.log(`  Всего файлов:            ${m.total_basket_files}`);
  console.log(`  С полным meta:           ${m.total_basket_with_meta}`);
  console.log(`  Без полного meta:        ${m.total_basket_without_meta}`);
  console.log(`  С readers (кто-то читает): ${m.total_basket_with_readers}`);
  console.log(`  По статусу:`);
  for (const [st, n] of Object.entries(m.basket_by_status).sort((a,b)=>b[1]-a[1])) {
    console.log(`    ${st.padEnd(12)} ${n}`);
  }
  console.log('');
  console.log(`ВСЕ МОДУЛИ ПРОЕКТА (секция modules, 7 директорий):`);
  console.log(`  Всего .mjs файлов:       ${m.total_modules_all}`);
  console.log(`  С версией в шапке:       ${m.modules_with_version}`);
  console.log(`  Без версии в шапке:      ${m.modules_without_version}`);
  if (Object.keys(m.versions_summary).length > 0) {
    console.log(`  Распределение по major:`);
    for (const [major, n] of Object.entries(m.versions_summary).sort((a,b)=>parseInt(b[0])-parseInt(a[0]))) {
      console.log(`    v${major}.x.x             ${n}`);
    }
  }
  console.log('');

  if (Object.keys(m.layer_by_category).length > 0) {
    console.log('LAYERS по категориям:');
    for (const [cat, n] of Object.entries(m.layer_by_category).sort((a,b)=>b[1]-a[1])) {
      console.log(`  ${cat.padEnd(20)} ${n}`);
    }
    console.log('');
  }

  if (Object.keys(m.services_by_method).length > 0) {
    console.log('SERVICES по методам (мультиметодные считаются по каждому):');
    for (const [method, n] of Object.entries(m.services_by_method).sort((a,b)=>b[1]-a[1])) {
      console.log(`  ${method.padEnd(20)} ${n}`);
    }
    console.log('');
  }

  const reasons = {};
  for (const s of registry.skipped) reasons[s.reason] = (reasons[s.reason]||0)+1;
  if (Object.keys(reasons).length > 0) {
    console.log('Причины пропуска:');
    for (const [r, c] of Object.entries(reasons)) console.log(`  ${r.padEnd(20)} ${c}`);
    console.log('');
  }

  if (registry.warnings.length > 0) {
    console.log('Предупреждения (первые 20):');
    for (const w of registry.warnings.slice(0, 20)) {
      const extra = w.basket ? ' ' + w.basket : (w.category ? ' ' + w.category : (w.route ? ' ' + w.route : ''));
      console.log(`  ${w.file}  [${w.reason}]${extra}`);
    }
    console.log('');
  }
}

function buildBasketRegistry(basketScan) {
  return {
    meta: {
      schema_version: BASKET_SCHEMA_VER,
      generated_by: SCRIPT_PATH,
      generated_at: new Date().toISOString(),
      description: 'Детальный реестр корзины Crucix (data/basket/*.json). Источник: server/registry.generated.json и прямой скан файлов.',
      help_ru_link: 'docs/help/ru/basket/README.md',
      help_en_link: 'docs/help/en/basket/README.md',
      source_dir: 'data/basket',
      total_files: basketScan.summary.total,
      total_with_meta: basketScan.summary.withMeta,
      total_without_meta: basketScan.summary.withoutMeta,
      by_status: basketScan.summary.byStatus,
    },
    items: basketScan.items,
  };
}

// ============================================================
//  ОСНОВНОЙ ПРОХОД
// ============================================================

async function buildOnce() {
  const scan = await scanModules();
  const basketScan = await scanBasket(scan.basketReaders);
  const allModulesScan = await scanAllModules(); // НОВОЕ v3.4.0
  const registry = buildRegistry(scan, basketScan, allModulesScan);
  const json = JSON.stringify(registry, null, 2);
  const sizeKB = (json.length / 1024).toFixed(1);

  const basketRegistry = buildBasketRegistry(basketScan);
  const basketJson = JSON.stringify(basketRegistry, null, 2);
  const basketSizeKB = (basketJson.length / 1024).toFixed(1);

  if (CHECK_MODE) {
    let existing = null;
    let existingBasket = null;
    try { existing = await fs.readFile(OUT_FILE, 'utf8'); } catch {}
    try { existingBasket = await fs.readFile(BASKET_OUT, 'utf8'); } catch {}
    if (existing === json && existingBasket === basketJson) {
      console.log('Реестр актуален.');
      return true;
    }
    console.log('Реестр УСТАРЕЛ. Запусти без --check.');
    return false;
  }

  await fs.writeFile(OUT_FILE, json, 'utf8');
  await fs.writeFile(BASKET_OUT, basketJson, 'utf8');

  printSummary(registry);
  console.log(`Реестр записан: ${OUT_FILE} (${sizeKB} КБ)`);
  console.log(`Реестр basket записан: ${BASKET_OUT} (${basketSizeKB} КБ)`);
  console.log('\n=== ГОТОВО ===');
  return true;
}

async function main() {
  if (!WATCH_MODE) {
    const ok = await buildOnce();
    if (CHECK_MODE && !ok) process.exit(1);
    return;
  }

  console.log('[watch] следим за apis/sources/*.mjs, data/basket/ и MODULE_DIRS — Ctrl+C для выхода');
  await buildOnce();

  let timer = null;
  const debounce = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { buildOnce().catch(e => console.error(e)); }, 500);
  };
  watch(API_SOURCES, { persistent: true }, debounce);
  watch(BASKET_DIR, { persistent: true }, debounce);
  for (const { path } of MODULE_DIRS) {
    try { watch(path, { persistent: true }, debounce); } catch {}
  }
}

main().catch(e => { console.error('ОШИБКА:', e); process.exit(1); });
