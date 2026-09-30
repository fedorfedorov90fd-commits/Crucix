#!/usr/bin/env node
/**
 * scripts/lint-contract.mjs — ВАЛИДАТОР КОНТРАКТА CRUCIX v3.1.0
 *
 * ДВУХВЕТОЧНЫЙ ВАЛИДАТОР: Layer (слои карты) и Service (инфраструктура).
 * Поддержка single-method (method) и multi-method (methods).
 *
 * ─────────────────────────────────────────────────────────────
 *  LAYER-КОНТРАКТ:
 *    export const route  = '/api/layers/<id>';
 *    export const method = 'GET';
 *    export const meta = { category, icon, color, vizType, source, description, collector?, cache?, unit? };
 *    export async function handler(req, res) {}
 *
 *  SERVICE-КОНТРАКТ (single):
 *    export const route  = '/api/services/<id>';
 *    export const method = 'GET';
 *    export const meta = { service: true, description, cache? };
 *    export async function handler(req, res) {}
 *
 *  SERVICE-КОНТРАКТ (multi):
 *    export const route   = '/api/services/<id>';
 *    export const methods = ['GET', 'POST'];
 *    export const meta    = { service: true, description, cache? };
 *    export async function handler(req, res) {}
 * ─────────────────────────────────────────────────────────────
 *
 * ПРАВИЛА ПО МЕТОДАМ:
 *   - Разрешено: только method (строка) ИЛИ только methods (массив).
 *   - Запрещено: оба одновременно; method массив; methods строка.
 *   - Для мультиметодного Service — обязателен methods.
 *   - Для Layer — только method = 'GET'.
 *
 * РЕЖИМЫ:
 *   --quiet, --json, --file, --layers-only, --services-only, --stats
 */

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const API_SOURCES  = join(PROJECT_ROOT, 'apis', 'sources');

const ALLOWED_LAYER_CATEGORIES = new Set([
  'economics', 'finance', 'military', 'geopolitical', 'ecological',
  'cyber', 'space', 'news', 'esg', 'threats', 'health', 'energy',
  'transport', 'infrastructure', 'social', 'intelligence', 'other',
  'index', 'detector', 'forecast', 'semantic', 'flow', 'market', 'specialist',
]);

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

const LAYER_REQUIRED_META = ['category', 'icon', 'color', 'vizType', 'source', 'description'];
const SERVICE_REQUIRED_META = ['service', 'description'];

// ============================================================
//  ОБЩИЕ ПРОВЕРКИ
// ============================================================

function checkHeader(source) {
  const first60 = source.split('\n').slice(0, 60).join('\n');
  if (!/\/\*\*/.test(first60)) return 'нет шапки /** в первых 60 строках';
  if (!/\*\//.test(first60)) return 'шапка /** открыта, но не закрыта в первых 60 строках';
  return null;
}

function checkNoDefault(source) {
  if (/export\s+default/.test(source)) return 'обнаружен export default (запрещён — используйте export async function handler)';
  return null;
}

function extractRoute(source) {
  const m = source.match(/export\s+const\s+route\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function extractMethod(source) {
  const m = source.match(/export\s+const\s+method\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1].toUpperCase() : null;
}

function extractMethods(source) {
  const m = source.match(/export\s+const\s+methods\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  const inner = m[1];
  const arr = [];
  const re = /['"]([^'"]+)['"]/g;
  let sm;
  while ((sm = re.exec(inner)) !== null) {
    arr.push(sm[1].toUpperCase());
  }
  return arr.length > 0 ? arr : null;
}

function extractMeta(source) {
  const marker = 'export const meta';
  const idx = source.lastIndexOf(marker);
  if (idx < 0) return null;
  const braceIdx = source.indexOf('{', idx);
  if (braceIdx < 0) return null;
  const body = source.slice(braceIdx);
  const isService = /service\s*:\s*true/.test(body.slice(0, 500));
  return { body: body.slice(0, 3000), isService };
}

function checkHandler(source) {
  const canonical = /export\s+async\s+function\s+handler\s*\(\s*req\s*,\s*res\s*\)/.test(source);
  if (canonical) return null;
  if (/export\s+(async\s+)?function\s+handle[A-Z]/.test(source))
    return 'handler в форме "handleXxxAPI" — переименовать в export async function handler(req, res)';
  if (/export\s+const\s+handler\s*=/.test(source))
    return 'handler объявлен как const — должен быть export async function handler(req, res)';
  return 'нет export async function handler(req, res)';
}

function checkProjectRoot(source) {
  if (/PROJECT_ROOT/.test(source)) return null;
  if (/fileURLToPath\(import\.meta\.url\)/.test(source) && /join\(__dirname/.test(source)) return null;
  return 'нет PROJECT_ROOT и нет стандартного __dirname-пути';
}

function checkTryCatch(source) {
  if (/try\s*\{[\s\S]{0,3000}catch\s*\(/.test(source)) return null;
  return 'нет try/catch';
}

/**
 * Проверка методов. Возвращает { ok, method, methods, error }.
 * Разрешено: только method (строка) ИЛИ только methods (массив), не оба.
 */
function checkMethods(source) {
  const method = extractMethod(source);
  const methods = extractMethods(source);

  if (method && methods) {
    return { ok: false, method, methods, error: 'объявлены одновременно method и methods — выберите одно' };
  }
  if (methods) {
    for (const m of methods) {
      if (!ALLOWED_METHODS.has(m)) return { ok: false, method, methods, error: `methods содержит недопустимый "${m}"` };
    }
    return { ok: true, method, methods };
  }
  if (method) {
    if (!ALLOWED_METHODS.has(method)) return { ok: false, method, methods, error: `method недопустим: "${method}"` };
    return { ok: true, method, methods };
  }
  return { ok: false, method, methods, error: 'не объявлен ни method, ни methods' };
}

// ============================================================
//  LAYER / SERVICE — проверки
// ============================================================

function checkLayerRoute(route) {
  if (!route) return 'нет export const route';
  if (!route.startsWith('/api/layers/')) return `Layer-route должен начинаться с /api/layers/: "${route}"`;
  return null;
}

function checkLayerMethods(methodInfo) {
  if (!methodInfo.ok) return methodInfo.error;
  if (methodInfo.methods) return 'Layer-модуль не может быть мультиметодным — используйте method (строка)';
  if (methodInfo.method !== 'GET') return `Layer-модуль должен иметь method = 'GET', а не "${methodInfo.method}"`;
  return null;
}

function checkLayerMeta(meta) {
  if (!meta) return 'нет export const meta';
  for (const field of LAYER_REQUIRED_META) {
    const re = new RegExp(`\\b${field}\\s*:`);
    if (!re.test(meta.body)) return `Layer-meta без обязательного поля "${field}"`;
  }
  const catMatch = meta.body.match(/category\s*:\s*['"]([^'"]+)['"]/);
  if (catMatch && !ALLOWED_LAYER_CATEGORIES.has(catMatch[1])) {
    return `Layer-meta.category недопустима: "${catMatch[1]}"`;
  }
  return null;
}

function checkServiceRoute(route) {
  if (!route) return 'нет export const route';
  if (!route.startsWith('/api/services/')) return `Service-route должен начинаться с /api/services/: "${route}"`;
  return null;
}

function checkServiceMethods(methodInfo) {
  if (!methodInfo.ok) return methodInfo.error;
  return null;
}

function checkServiceMeta(meta) {
  if (!meta) return 'нет export const meta';
  for (const field of SERVICE_REQUIRED_META) {
    const re = new RegExp(`\\b${field}\\s*:`);
    if (!re.test(meta.body)) return `Service-meta без обязательного поля "${field}"`;
  }
  return null;
}

// ============================================================
//  ЛИНТ ОДНОГО ФАЙЛА
// ============================================================

export async function lintFile(filePath) {
  let source;
  try {
    source = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    return { ok: false, kind: 'unknown', file: filePath, errors: ['read_error: ' + e.message] };
  }

  const route = extractRoute(source);
  const methodInfo = checkMethods(source);
  const meta = extractMeta(source);

  let kind = 'unknown';
  if (route && route.startsWith('/api/services/')) kind = 'service';
  else if (meta && meta.isService) kind = 'service';
  else if (route && route.startsWith('/api/layers/')) kind = 'layer';
  else if (meta && !meta.isService && route) kind = 'layer';
  else if (route && route.startsWith('/api/')) kind = 'layer';

  const errors = [];

  const common = [
    ['шапка',        checkHeader(source)],
    ['no-default',   checkNoDefault(source)],
    ['handler',      checkHandler(source)],
    ['project-root', checkProjectRoot(source)],
    ['try-catch',    checkTryCatch(source)],
  ];
  for (const [, err] of common) if (err) errors.push(err);

  if (kind === 'layer') {
    const checks = [
      checkLayerRoute(route),
      checkLayerMethods(methodInfo),
      checkLayerMeta(meta),
    ];
    for (const err of checks) if (err) errors.push(err);
  } else if (kind === 'service') {
    const checks = [
      checkServiceRoute(route),
      checkServiceMethods(methodInfo),
      checkServiceMeta(meta),
    ];
    for (const err of checks) if (err) errors.push(err);
  } else {
    errors.push(`не удалось определить kind: route="${route || '—'}", meta.service=${meta?.isService}`);
  }

  return {
    ok: errors.length === 0,
    kind,
    file: filePath,
    route,
    method: methodInfo.method || null,
    methods: methodInfo.methods || null,
    errors,
  };
}

// ============================================================
//  ЛИНТ ВСЕХ ФАЙЛОВ
// ============================================================

export async function lintAll(opts = {}) {
  const entries = await fs.readdir(API_SOURCES);
  let files = entries.filter(f => f.endsWith('-api.mjs') && !f.startsWith('.')).sort();

  const results = [];
  for (const f of files) {
    const r = await lintFile(join(API_SOURCES, f));
    results.push({ ...r, name: f });
  }

  let filtered = results;
  if (opts.layersOnly)   filtered = results.filter(r => r.kind === 'layer');
  if (opts.servicesOnly) filtered = results.filter(r => r.kind === 'service');

  const stats = {
    total: results.length,
    layer: results.filter(r => r.kind === 'layer').length,
    service: results.filter(r => r.kind === 'service').length,
    unknown: results.filter(r => r.kind === 'unknown').length,
    failed: results.filter(r => !r.ok).length,
  };

  const ok = filtered.every(r => r.ok);
  return { ok, files: filtered, stats };
}

// ============================================================
//  CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const asJson = args.includes('--json');
  const statsOnly = args.includes('--stats');
  const fileArg = args.indexOf('--file');
  const layersOnly = args.includes('--layers-only');
  const servicesOnly = args.includes('--services-only');

  if (fileArg >= 0 && args[fileArg + 1]) {
    const file = args[fileArg + 1];
    const full = file.startsWith('/') ? file : join(API_SOURCES, file);
    const r = await lintFile(full);
    if (asJson) console.log(JSON.stringify(r, null, 2));
    else if (r.ok) console.log(`OK  [${r.kind}]  ${basename(full)}`);
    else { console.log(`FAIL  [${r.kind}]  ${basename(full)}`); r.errors.forEach(e => console.log('    - ' + e)); }
    process.exit(r.ok ? 0 : 1);
  }

  const report = await lintAll({ layersOnly, servicesOnly });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  if (statsOnly) {
    console.log('=== LINT CONTRACT v3.1.0 — СВОДКА ===');
    console.log(`Всего:      ${report.stats.total}`);
    console.log(`Layer:      ${report.stats.layer}`);
    console.log(`Service:    ${report.stats.service}`);
    console.log(`Unknown:    ${report.stats.unknown}`);
    console.log(`Нарушений:  ${report.stats.failed}`);
    process.exit(report.stats.failed > 0 ? 1 : 0);
  }

  if (!quiet) {
    console.log('=== LINT CONTRACT v3.1.0 ===');
    console.log(`Файлов всего:      ${report.stats.total}`);
    console.log(`  Layer:           ${report.stats.layer}`);
    console.log(`  Service:         ${report.stats.service}`);
    console.log(`  Unknown:         ${report.stats.unknown}`);
    console.log(`Соответствуют:     ${report.stats.total - report.stats.failed}`);
    console.log(`Нарушений:         ${report.stats.failed}`);
    console.log('');
  }

  if (report.stats.failed > 0) {
    console.log('НАРУШИТЕЛИ:');
    for (const r of report.files.filter(x => !x.ok)) {
      console.log(`  [${r.kind}] ${r.name}`);
      for (const e of r.errors) console.log(`      - ${e}`);
    }
    console.log('');
    console.log('=== ГОТОВО: FAIL ===');
    process.exit(1);
  }

  console.log('=== ГОТОВО: OK (все модули соответствуют контракту) ===');
  process.exit(0);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('lint-contract.mjs');
if (invokedDirectly) {
  main().catch(e => { console.error('LINT ERROR:', e.message); process.exit(1); });
}
