/**
 * server/build-registry.mjs — ГЕНЕРАТОР РЕЕСТРА CRUCIX v3.3.1
 *
 * ШАПКА-ПАСПОРТ (требование А от 20.09.2026):
 *   Создан:      scripts-командой Crucix (AI-ассистент под руководством хозяина)
 *   Принят:      20.09.2026
 *   Назначение:  генерация единого реестра Crucix из фактов файловой системы
 *   Справка RU:  docs/help/ru/api/build-registry.md
 *   Справка EN:  docs/help/en/api/build-registry.md
 *   Схема meta:  crucix.registry.generated.v1
 *
 * ТРИ СЕКЦИИ РЕЕСТРА:
 *   routes   — Layer-модули (слои карты, /api/layers/*).
 *   services — Service-модули (инфраструктура, /api/services/*).
 *   basket   — реестр корзины данных (data/basket/*.json).
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
 * НОВОЕ в v3.3.1 (20.09.2026):
 *  15. РАСШИРЕННЫЙ сбор readers. Теперь ловятся ТРИ паттерна:
 *      - 'basket/<id>.json' (было в v3.3.0);
 *      - "basket/<id>.json" (двойные кавычки);
 *      - BASKET_DIR, '<id>.json' (переменная пути — новый паттерн).
 *      После расширения readers появятся у inflation, news, rss, rss-latest
 *      и других модулей, читающих basket через переменную BASKET_DIR.
 *  16. РАЗДЕЛЕНИЕ warnings на три категории:
 *      - basket_file_missing_static — статическая ссылка на отсутствующий файл;
 *      - basket_source_multi — meta.source содержит '+', парсер разбирает пути;
 *      - read_error / route_does_not_start_with_api / unknown_category — как было.
 *  17. РАЗБОР meta.source СО ЗНАКОМ '+'. Если meta.source = 'basket/a.json + basket/b.json',
 *      парсер разделяет по '+' и проверяет КАЖДЫЙ путь отдельно. Ложное
 *      предупреждение у unique-indicators-api (pentagon-pizza + langley-taxis)
 *      больше не возникает — оба файла на месте.
 *  18. Поле basket_readers_count в meta — сколько basket-файлов имеют хотя бы
 *      одного reader.
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
//  ИЗВЛЕЧЕНИЕ ПОЛЕЙ (без изменений с v3.2.0)
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
//  РАЗБОР META.SOURCE (новое в v3.3.1)
// ============================================================

/**
 * Разбирает meta.source и извлекает список basket-имён файлов.
 *
 * Примеры:
 *   'basket/acled.json' → ['acled.json']
 *   'basket/pentagon-pizza.json + basket/langley-taxis.json' → ['pentagon-pizza.json', 'langley-taxis.json']
 *   'FRED GSCPI + Shipping Indicators' → [] (не basket-пути)
 *
 * Возвращает { paths: [...], isBasket: true|false }.
 * isBasket = true, если хотя бы один путь начинается с 'basket/'.
 */
function parseMetaSource(source) {
  if (typeof source !== 'string' || source.length === 0) {
    return { paths: [], isBasket: false };
  }
  // Разбиваем по '+' и по ',' (оба встречаются как разделители).
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
//  СКАНИРОВАНИЕ МОДУЛЕЙ (расширено в v3.3.1)
// ============================================================

function isOfficial(filename) {
  if (!filename.endsWith('.mjs')) return false;
  if (filename.startsWith('.')) return false;
  if (/[А-Яа-яЁё]/.test(filename)) return false;
  if (/[()\s=&%#]/.test(filename)) return false;
  return true;
}

/**
 * Извлекает из источника модуля все ссылки на basket-файлы.
 *
 * Паттерн 1 (v3.3.0): строковые литералы 'basket/<id>.json' или "basket/<id>.json"
 * Паттерн 2 (v3.3.1): строковые литералы BASKET_DIR, '<id>.json' или "…"
 *
 * Динамические чтения (join(BASKET_DIR, filename)) не обнаруживаются статически
 * и остаются вне readers — это не ошибка, а ограничение метода.
 */
function extractBasketRefs(source) {
  const refs = new Set();

  // Паттерн 1: 'basket/<id>.json' в любых кавычках.
  const re1 = /['"`](?:data\/)?basket\/([a-z0-9_\-]+)\.json['"`]/gi;
  let m;
  while ((m = re1.exec(source)) !== null) {
    refs.add(m[1]);
  }

  // Паттерн 2: BASKET_DIR, '<id>.json' или BASKET_DIR, "<id>.json"
  const re2 = /BASKET_DIR\s*,\s*['"`]([a-z0-9_\-]+)\.json['"`]/gi;
  while ((m = re2.exec(source)) !== null) {
    refs.add(m[1]);
  }

  // Паттерн 3: join(BASKET_DIR, '<id>.json') или join(BASKET_DIR, "<id>.json")
  const re3 = /join\s*\(\s*BASKET_DIR\s*,\s*['"`]([a-z0-9_\-]+)\.json['"`]/gi;
  while ((m = re3.exec(source)) !== null) {
    refs.add(m[1]);
  }

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

    const route  = extractStringConst(source, 'route');
    const method = extractStringConst(source, 'method');
    const methods = extractStringArray(source, 'methods');
    const meta   = extractMeta(source) || {};
    const handlerOk = hasHandler(source);

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
          // Ни одного из указанных файлов нет.
          warnings.push({
            file,
            reason: 'basket_file_missing_static',
            basket: parsed.paths.join(' + '),
            basket_expected: parsed.paths,
          });
        } else if (missing.length > 0) {
          // Часть есть, часть нет.
          warnings.push({
            file,
            reason: 'basket_file_missing_static',
            basket: missing.join(' + '),
            basket_expected: parsed.paths,
            basket_found: parsed.paths.filter(p => basketFiles.has(p)),
          });
        }
        // Если все найдены — предупреждения нет.
        // Случай multi (meta.source содержит '+' и все пути найдены) —
        // это НЕ предупреждение, это корректная работа с несколькими файлами.
      }
      layers.push(entry);
    }
  }

  return { layers, services, skipped, warnings, basketReaders };
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
    byRoute[m.route] = entry;

    const wildcardRoute = m.route.endsWith('/*') ? m.route : (m.route + '/*');
    if (!byRoute[wildcardRoute]) {
      byRoute[wildcardRoute] = { ...entry, subpath: true };
    }
  }
  return { byRoute, duplicates };
}

function buildRegistry(scan, basketScan) {
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

  // Сколько basket-файлов имеют хотя бы одного reader (v3.3.1).
  let basketReadersCount = 0;
  for (const it of basketScan.items) {
    if (it.readers && it.readers.length > 0) basketReadersCount++;
  }

  return {
    meta: {
      schema_version: SCHEMA_VER,
      generated_by: SCRIPT_PATH,
      generated_at: new Date().toISOString(),
      description: 'Единый реестр Crucix: маршруты API (layers + services) и корзина данных (basket).',
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
    },
    routes: layersIdx.byRoute,
    services: servicesIdx.byRoute,
    basket: basketScan.items,
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
  console.log('=== BUILD REGISTRY v3.3.1 ===\n');
  console.log(`Просканировано файлов:     ${m.total_scanned}
м. total_scanned}
`);
  console.log(`Модулей с route+handler:   ${m.total_modules}
м. total_modules}
`);
  console.log(`  ├─ Layer (карта):        ${m.total_layers}
m. total_layers}
  →  ${m.total_routes}
м. total_routes}
 маршрутов (точный + wildcard)`);
  console.log(`  └─ Service (инфра):      ${m.total_services}
м. total_services}
  →  ${m.total_service_routes}
м. total_service_routes}
 маршрутов (точный + wildcard)`);
  console.log(`Пропущено:                 ${m.skipped}
m. skipped}
`);
  console.log(`Дубликатов маршрутов:      ${m.duplicates}
m. дублирует}
`);
  console.log(`Предупреждений:            ${m.warnings}
м. предупреждения}
`);
  console.log('');
  console.log(`КОРЗИНА (data/basket/):`);
  console.log(`  Всего файлов:            ${m.total_basket_files}
м. total_basket_files}
`);
  console.log(`  С полным meta:           ${m.total_basket_with_meta}
m. total_basket_with_meta}
`);
  console.log(`  Без полного meta:        ${m.total_basket_without_meta}
м. total_basket_without_meta}
`);
  console.log(`  С readers (кто-то читает): ${m.total_basket_with_readers}
m. total_basket_with_readers}
`);
  console.log(`  По статусу:`);
  for (const [st, n] of Object.entries(m.basket_by_status).sort((a,b)=>b[1]-a[1])) {
    console.log(`    ${st.padEnd(12)} ${n}`);
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
      console.log(`  ${w.file}
w. file}
  [${w.reason}
w. reason}
]${extra}`);
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
  const registry = buildRegistry(scan, basketScan);
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

  console.log('[watch] следим за apis/sources/*.mjs и data/basket/ — Ctrl+C для выхода');
  await buildOnce();

  let timer = null;
  const debounce = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { buildOnce().catch(e => console.error(e)); }, 500);
  };
  watch(API_SOURCES, { persistent: true }, debounce);
  watch(BASKET_DIR, { persistent: true }, debounce);
}

main().catch(e => { console.error('ОШИБКА:', e); process.exit(1); });
