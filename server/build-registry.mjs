/**
 * server/build-registry.mjs — ГЕНЕРАТОР РЕЕСТРА CRUCIX v3.2.0
 *
 * ДВЕ СЕКЦИИ РЕЕСТРА:
 *   routes   — Layer-модули (слои карты, /api/layers/*).
 *   services — Service-модули (инфраструктура, /api/services/*).
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
 * ВОЗМОЖНОСТИ v3.2.0:
 *   1. Поддержка method (string) И methods (array) — мультиметодные Service.
 *   2. Разделение на routes (Layer) и services (Service).
 *   3. Точный парсинг meta через баланс скобок + Function (без eval).
 *   4. Валидация category Layer-модулей по списку допустимых.
 *   5. Сбор дубликатов внутри каждой секции.
 *   6. Группировка Layer по category, Service по methods.
 *   7. Проверка basket-файлов для Layer (meta.source).
 *   8. Режимы --check (exit 1 если реестр устарел) и --watch.
 *   9. КАЖДЫЙ маршрут регистрируется ДВАЖДЫ: точный + wildcard '/ *'.
 *      Это даёт единый механизм подпутей для всех модулей (Layer + Service).
 *      Точный ресурс: /api/layers/pmi. Поддерево: /api/layers/pmi/phase.
 */

import { promises as fs, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const API_SOURCES  = join(PROJECT_ROOT, 'apis', 'sources');
const BASKET_DIR   = join(PROJECT_ROOT, 'data', 'basket');
const OUT_FILE     = join(__dirname, 'registry.generated.json');

const CHECK_MODE = process.argv.includes('--check');
const WATCH_MODE = process.argv.includes('--watch');

const ALLOWED_CATEGORIES = [
  "economics", "finance", "military", "geopolitical", "ecological",
  "cyber", "space", "news", "esg", "threats", "health", "energy",
  "transport", "infrastructure", "social", "intelligence", "other",
  "index", "detector", "forecast", "semantic", "flow", "market", "specialist",
];

// ============================================================
//  ИЗВЛЕЧЕНИЕ ПОЛЕЙ
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
//  СКАНИРОВАНИЕ
// ============================================================

function isOfficial(filename) {
  if (!filename.endsWith('.mjs')) return false;
  if (filename.startsWith('.')) return false;
  if (/[А-Яа-яЁё]/.test(filename)) return false;
  if (/[()\s=&%#]/.test(filename)) return false;
  return true;
}

async function scanModules() {
  const entries = await fs.readdir(API_SOURCES);
  const files = entries.filter(isOfficial).sort();

  const layers = [];
  const services = [];
  const skipped = [];
  const warnings = [];

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

    if (!route) { skipped.push({ file, reason: 'no_route', hasHandler: handlerOk }); continue; }
    if (!handlerOk) { skipped.push({ file, reason: 'no_handler', route }); continue; }
    if (!route.startsWith('/api/')) { warnings.push({ file, reason: 'route_does_not_start_with_api', route }); continue; }

    const moduleId = file.replace(/\.mjs$/, '');
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
      if (typeof meta.source === 'string' && meta.source.startsWith('basket/')) {
        const basketFile = meta.source.replace(/^basket\//, '');
        if (!basketFiles.has(basketFile)) {
          warnings.push({ file, reason: 'basket_file_missing', basket: basketFile });
        }
      }
      layers.push(entry);
    }
  }

  return { layers, services, skipped, warnings };
}

// ============================================================
//  СБОРКА РЕЕСТРА
// ============================================================

function getAllowedMethodsList(entry) {
  if (Array.isArray(entry.methods) && entry.methods.length > 0) return entry.methods.map(m => String(m).toUpperCase());
  if (typeof entry.method === 'string' && entry.method.length > 0) return [entry.method.toUpperCase()];
  return [];
}

/**
 * Индексирует модули по route. КАЖДЫЙ маршрут регистрируется ДВАЖДЫ:
 *   1. Точный путь:        /api/layers/pmi       (точечный ресурс)
 *   2. Wildcard-поддерево: /api/layers/pmi/*     (все подпути)
 *
 * router.mjs уже умеет matchRoute с wildcard (spec 15 для корня без слеша,
 * spec 10 для подпутей), и findRoute выбирает лучший по specificity.
 * Таким образом, /api/layers/pmi даёт spec 100 (точное совпадение),
 * /api/layers/pmi/phase даёт spec 10 (wildcard).
 *
 * Дубликаты не считаются, если они получены из одного модуля (route + route/*).
 */
function indexByRoute(modules, label) {
  const byRoute = {};
  const duplicates = [];
  for (const m of modules) {
    // Точный маршрут
    if (byRoute[m.route]) {
      duplicates.push({ section: label, route: m.route, kept: byRoute[m.route].moduleId, dropped: m.moduleId });
      continue;
    }
    const entry = { moduleId: m.moduleId, file: m.file, meta: m.meta };
    if (m.methods) entry.methods = m.methods;
    if (m.method)  entry.method = m.method;
    byRoute[m.route] = entry;

    // Wildcard-поддерево (для подпутей). Если route уже с /* — не дублируем.
    const wildcardRoute = m.route.endsWith('/*') ? m.route : (m.route + '/*');
    if (!byRoute[wildcardRoute]) {
      byRoute[wildcardRoute] = { ...entry, subpath: true };
    }
  }
  return { byRoute, duplicates };
}

function buildRegistry(scan) {
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

  return {
    meta: {
      generated_at: new Date().toISOString(),
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
      layer_by_category: layerByCategory,
      services_by_method: servicesByMethod,
    },
    routes: layersIdx.byRoute,
    services: servicesIdx.byRoute,
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
  console.log('=== BUILD REGISTRY v3.2.0 ===\n');
  console.log(`Просканировано файлов:     ${m.total_scanned}`);
  console.log(`Модулей с route+handler:   ${m.total_modules}`);
  console.log(`  ├─ Layer (карта):        ${m.total_layers}  →  ${m.total_routes} маршрутов (точный + wildcard)`);
  console.log(`  └─ Service (инфра):      ${m.total_services}  →  ${m.total_service_routes} маршрутов (точный + wildcard)`);
  console.log(`Пропущено:                 ${m.skipped}`);
  console.log(`Дубликатов маршрутов:      ${m.duplicates}`);
  console.log(`Предупреждений:            ${m.warnings}`);
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
    console.log('Предупреждения (первые 15):');
    for (const w of registry.warnings.slice(0, 15)) {
      console.log(`  ${w.file}  [${w.reason}]${w.basket ? ' ' + w.basket : ''}${w.category ? ' ' + w.category : ''}${w.route ? ' ' + w.route : ''}`);
    }
    console.log('');
  }
}

// ============================================================
//  ОСНОВНОЙ ПРОХОД
// ============================================================

async function buildOnce() {
  const scan = await scanModules();
  const registry = buildRegistry(scan);
  const json = JSON.stringify(registry, null, 2);
  const sizeKB = (json.length / 1024).toFixed(1);

  if (CHECK_MODE) {
    let existing = null;
    try { existing = await fs.readFile(OUT_FILE, 'utf8'); } catch {}
    if (existing === json) { console.log('Реестр актуален.'); return true; }
    console.log('Реестр УСТАРЕЛ. Запусти без --check.');
    return false;
  }

  await fs.writeFile(OUT_FILE, json, 'utf8');
  printSummary(registry);
  console.log(`Реестр записан: ${OUT_FILE} (${sizeKB} КБ)`);
  console.log('\n=== ГОТОВО ===');
  return true;
}

async function main() {
  if (!WATCH_MODE) {
    const ok = await buildOnce();
    if (CHECK_MODE && !ok) process.exit(1);
    return;
  }

  console.log('[watch] следим за apis/sources/*.mjs — Ctrl+C для выхода');
  await buildOnce();

  let timer = null;
  watch(API_SOURCES, { persistent: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { buildOnce().catch(e => console.error(e)); }, 500);
  });
}

main().catch(e => { console.error('ОШИБКА:', e); process.exit(1); });
