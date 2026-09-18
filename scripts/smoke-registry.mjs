/**
 * scripts/smoke-registry.mjs — SMOKE-ТЕСТ ВСЕГО РЕЕСТРА CRUCIX
 *
 * ПРОМЫШЛЕННЫЙ SMOKE-ТЕСТ уровня DataDog/New Relic.
 * Читает server/registry.generated.json, дёргает все маршруты (Layer + Service)
 * и собирает полный отчёт о состоянии API.
 *
 * ВОЗМОЖНОСТИ:
 *   1. Читает server/registry.generated.json (SSOT).
 *   2. Фильтр wildcard-дублей (/api/layers/pmi/* пропускаем, оставляем точный).
 *   3. HTTP-запросы через нативный fetch с таймаутом (AbortController).
 *   4. Параллельность с ограничением (батчи по N запросов).
 *   5. Категоризация ответов: ok / empty / degraded / not_found / fail / timeout.
 *   6. Дополнительные проверки для Layer: наличие features / legend / series / stats.
 *   7. CLI-флаги: --layers-only, --services-only, --timeout=N, --concurrency=N,
 *      --quiet, --verbose, --json.
 *   8. Отчёт: сводка по категориям + топ-10 упавших + топ-10 пустых.
 *   9. JSON-экспорт: /tmp/smoke-report-<timestamp>.json.
 *   10. Нулевые побочные эффекты при импорте (CLI-хук через pathToFileURL).
 *
 * ЛОГИ: logs/smoke-registry.log
 * ЗАПУСК: node scripts/smoke-registry.mjs [--layers-only] [--services-only]
 *         [--timeout=8000] [--concurrency=10] [--quiet] [--verbose] [--json]
 * ИМПОРТ: import { runSmoke } from './smoke-registry.mjs';
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const REGISTRY_FILE = join(PROJECT_ROOT, 'server', 'registry.generated.json');
const LOGS_DIR     = join(PROJECT_ROOT, 'logs');
const LOG_FILE     = join(LOGS_DIR, 'smoke-registry.log');
const BASE_URL     = `http://127.0.0.1:${process.env.PORT || 3117}`;

// ============================================================
//  CLI-КОНФИГ
// ============================================================

const args = process.argv.slice(2);
const CLI = {
  layersOnly:    args.includes('--layers-only'),
  servicesOnly:  args.includes('--services-only'),
  quiet:         args.includes('--quiet'),
  verbose:       args.includes('--verbose'),
  jsonOnly:      args.includes('--json'),
  timeoutMs: (() => {
    const a = args.find(x => x.startsWith('--timeout='));
    return a ? parseInt(a.slice('--timeout='.length), 10) || 8000 : 8000;
  })(),
  concurrency: (() => {
    const a = args.find(x => x.startsWith('--concurrency='));
    return a ? parseInt(a.slice('--concurrency='.length), 10) || 10 : 10;
  })(),
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureLogsDir() {
  try { await fs.mkdir(LOGS_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

async function appendLog(line) {
  try {
    await ensureLogsDir();
    await fs.appendFile(LOG_FILE, `[${nowIso()}] ${line}\n`);
  } catch (e) { /* ignore */ }
}

function log(level, msg) {
  if (CLI.quiet && level !== 'ERROR') return;
  const line = `[${nowIso()}] [${level}] ${msg}`;
  process.stdout.write(line + '\n');
  appendLog(`[${level}] ${msg}`);
}

// ============================================================
//  КАТЕГОРИЗАЦИЯ ОТВЕТА
// ============================================================

function classifyResponse(status, bodyText, bodyJson) {
  if (status === 200) {
    if (bodyJson) {
      // FeatureCollection — проверим features
      if (Array.isArray(bodyJson.features)) {
        return bodyJson.features.length > 0 ? 'ok' : 'empty';
      }
      // Массив
      if (Array.isArray(bodyJson)) {
        return bodyJson.length > 0 ? 'ok' : 'empty';
      }
      // Объект — проверим features/data/items/series
      const keys = ['features', 'data', 'items', 'series', 'layers', 'vessels'];
      for (const k of keys) {
        if (Array.isArray(bodyJson[k])) {
          return bodyJson[k].length > 0 ? 'ok' : 'empty';
        }
      }
      // Если объект без массивов, но не пустой — ok
      return Object.keys(bodyJson).length > 0 ? 'ok' : 'empty';
    }
    return bodyText && bodyText.length > 0 ? 'ok' : 'empty';
  }
  if (status === 204) return 'empty';
  if (status === 503) return 'degraded';
  if (status === 301 || status === 302 || status === 307 || status === 308) return 'redirect';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'fail';
  if (status >= 400) return 'fail';
  return 'unknown';
}

function pickMeta(bodyJson) {
  if (!bodyJson || typeof bodyJson !== 'object') return {};
  const meta = {};
  const metaKeys = ['type', 'meta', 'stats', 'legend'];
  for (const k of metaKeys) {
    if (bodyJson[k] !== undefined) meta[k] = true;
  }
  // Layer-поля
  if (bodyJson.features !== undefined) meta.features = Array.isArray(bodyJson.features) ? bodyJson.features.length : 'non-array';
  if (bodyJson.series !== undefined)   meta.series   = Array.isArray(bodyJson.series)   ? bodyJson.series.length   : 'non-array';
  return meta;
}

// ============================================================
//  ЗАПРОС ОДНОГО ЭНДПОИНТА
// ============================================================

async function probeOne(route, kind) {
  const started = Date.now();
  const result = {
    route,
    kind,
    status: 0,
    category: 'unknown',
    size: 0,
    durationMs: 0,
    error: null,
    meta: {},
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLI.timeoutMs);
    const resp = await fetch(BASE_URL + route, { signal: controller.signal });
    clearTimeout(timer);
    result.status = resp.status;
    const bodyText = await resp.text();
    result.size = Buffer.byteLength(bodyText, 'utf-8');
    let bodyJson = null;
    try { bodyJson = JSON.parse(bodyText); } catch (e) { /* не JSON */ }
    result.category = classifyResponse(resp.status, bodyText, bodyJson);
    result.meta = pickMeta(bodyJson);
  } catch (e) {
    result.error = e.message;
    result.category = /abort/i.test(e.message) ? 'timeout' : 'fail';
  } finally {
    result.durationMs = Date.now() - started;
  }

  return result;
}

// ============================================================
//  ЗАГРУЗКА РЕЕСТРА
// ============================================================

async function loadRegistry() {
  const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed;
}

function collectRoutes(registry) {
  const layers = registry.routes || {};
  const services = registry.services || {};
  const tasks = [];

  if (!CLI.servicesOnly) {
    for (const [route, entry] of Object.entries(layers)) {
      // Пропускаем wildcard-дубли
      if (route.endsWith('/*')) continue;
      tasks.push({ route, kind: 'layer', moduleId: entry.moduleId || null });
    }
  }

  if (!CLI.layersOnly) {
    for (const [route, entry] of Object.entries(services)) {
      // Service wildcard: /api/services/nlp/* — но у Service обычно базовый + wildcard.
      // Если route заканчивается /* — пропускаем, оставляем базовый.
      // Но если базовый отсутствует (только wildcard) — берём wildcard без звёздочки.
      if (route.endsWith('/*')) {
        const base = route.slice(0, -2);
        if (!services[base]) tasks.push({ route: base, kind: 'service', moduleId: entry.moduleId || null });
        continue;
      }
      tasks.push({ route, kind: 'service', moduleId: entry.moduleId || null });
    }
  }

  return tasks;
}

// ============================================================
//  БАТЧИРОВАННЫЙ ПРОГОН
// ============================================================

async function runBatch(tasks, concurrency) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(t => probeOne(t.route, t.kind)));
    results.push(...batchResults);
    if (CLI.verbose) {
      log('INFO', `батч ${Math.floor(i / concurrency) + 1}/${Math.ceil(tasks.length / concurrency)}: ${batchResults.filter(r => r.category === 'ok').length}/${batch.length} ok`);
    }
    // Пауза между батчами
    if (i + concurrency < tasks.length) await sleep(100);
  }
  return results;
}

// ============================================================
//  ОТЧЁТ
// ============================================================

function buildSummary(results) {
  const byCategory = {};
  const byKind = { layer: {}, service: {} };
  for (const r of results) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    if (!byKind[r.kind]) byKind[r.kind] = {};
    byKind[r.kind][r.category] = (byKind[r.kind][r.category] || 0) + 1;
  }
  const durations = results.map(r => r.durationMs).filter(Number.isFinite);
  const sizes = results.map(r => r.size).filter(Number.isFinite);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const p95Duration = (() => {
    if (!durations.length) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)];
  })();
  return {
    total: results.length,
    by_category: byCategory,
    by_kind: byKind,
    avg_duration_ms: avgDuration,
    p95_duration_ms: p95Duration,
    total_bytes: sizes.reduce((a, b) => a + b, 0),
  };
}

function printReport(summary, results) {
  const s = summary;
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SMOKE REGISTRY REPORT — Crucix');
  console.log(`  ${nowIso()}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Всего эндпоинтов:       ${s.total}`);
  console.log(`Средняя длительность:   ${s.avg_duration_ms} мс`);
  console.log(`P95 длительность:       ${s.p95_duration_ms} мс`);
  console.log(`Общий объём ответов:    ${(s.total_bytes / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('ПО КАТЕГОРИЯМ:');
  const catOrder = ['ok', 'empty', 'degraded', 'not_found', 'fail', 'timeout', 'redirect', 'unknown'];
  for (const cat of catOrder) {
    if (s.by_category[cat]) console.log(`  ${cat.padEnd(12)} ${s.by_category[cat]}`);
  }
  console.log('');
  console.log('LAYER:');
  const layerCats = Object.keys(s.by_kind.layer || {}).sort();
  for (const cat of layerCats) console.log(`  ${cat.padEnd(12)} ${s.by_kind.layer[cat]}`);
  console.log('');
  console.log('SERVICE:');
  const svcCats = Object.keys(s.by_kind.service || {}).sort();
  for (const cat of svcCats) console.log(`  ${cat.padEnd(12)} ${s.by_kind.service[cat]}`);
  console.log('');

  // Топ упавших
  const failed = results.filter(r => r.category === 'fail' || r.category === 'timeout');
  if (failed.length) {
    console.log(`ПРОВАЛЫ (${failed.length}):`);
    for (const r of failed.slice(0, 15)) {
      const err = r.error ? ` — ${r.error}` : '';
      console.log(`  [${r.status || r.category}] ${r.route}${err}`);
    }
    console.log('');
  }

  // Топ пустых
  const empty = results.filter(r => r.category === 'empty');
  if (empty.length) {
    console.log(`ПУСТЫЕ (${empty.length}) — топ-15:`);
    for (const r of empty.slice(0, 15)) {
      console.log(`  ${r.route} (${r.size} B)`);
    }
    console.log('');
  }

  // Топ медленных
  const slow = results.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
  if (slow.length) {
    console.log('ТОП-10 МЕДЛЕННЫХ:');
    for (const r of slow) {
      console.log(`  ${r.durationMs} мс  ${r.route}`);
    }
    console.log('');
  }
}

async function exportJson(results, summary) {
  const path = `/tmp/smoke-report-${Date.now()}.json`;
  await fs.writeFile(path, JSON.stringify({ generated_at: nowIso(), summary, results }, null, 2), 'utf8');
  return path;
}

// ============================================================
//  ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function runSmoke() {
  await ensureLogsDir();
  log('INFO', '🚀 Запуск smoke-registry');
  log('INFO', `CLI: layersOnly=${CLI.layersOnly} servicesOnly=${CLI.servicesOnly} timeout=${CLI.timeoutMs} concurrency=${CLI.concurrency} quiet=${CLI.quiet} verbose=${CLI.verbose}`);

  const started = Date.now();
  const registry = await loadRegistry();
  const tasks = collectRoutes(registry);
  log('INFO', `маршрутов к проверке: ${tasks.length}`);

  if (!tasks.length) {
    log('WARN', 'нет маршрутов — проверь filters (--layers-only/--services-only)');
    return { summary: { total: 0 }, results: [] };
  }

  const results = await runBatch(tasks, CLI.concurrency);
  const summary = buildSummary(results);
  const elapsed = ((Date.now() - started) / 1000).toFixed(2);

  if (CLI.jsonOnly) {
    const path = await exportJson(results, summary);
    console.log(JSON.stringify({ summary, report_path: path }, null, 2));
    return { summary, results };
  }

  printReport(summary, results);
  const path = await exportJson(results, summary);
  console.log('');
  log('INFO', `✅ Готово за ${elapsed}с. JSON-отчёт: ${path}`);
  log('INFO', `ok=${summary.by_category.ok || 0}  empty=${summary.by_category.empty || 0}  degraded=${summary.by_category.degraded || 0}  not_found=${summary.by_category.not_found || 0}  fail=${summary.by_category.fail || 0}  timeout=${summary.by_category.timeout || 0}`);

  return { summary, results };
}

// ============================================================
//  CLI-ЗАПУСК
// ============================================================

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmoke().catch(e => {
    console.error('[smoke-registry] Fatal:', e.message);
    console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  });
}
