#!/usr/bin/env node
/**
 * Crucix Warehouse Manager (кладовщик).
 * Версия 1.2.0. Принят 20.09.2026.
 *
 * Изменение 1.2.0 (20.09.2026):
 *   - updateItemStatus: при смене статуса вычищает поля-«призраки» от предыдущих
 *     состояний (error, failed_at, processed_at, processed_to, format_used,
 *     archived_at, archived_reason). Ранее поля накапливались: если запись
 *     сначала упала (failed + error), а потом прошла (processed), поле error
 *     оставалось висеть, создавая ложную картину 'processed + validation failed'.
 *   - Добавлены поля: status_updated_at (единое время последнего изменения статуса)
 *     и status_prev (предыдущий статус для трассировки переходов).
 *   - Введена валидация накладной по схеме data/schemas/incoming.v1.json перед
 *     saveIncoming. Схема читается один раз в main (не на каждую запись).
 *     Реализована своя структурная проверка без внешних библиотек.
 *   - Философия: накладная хранит ТОЛЬКО АКТУАЛЬНОЕ состояние записи.
 *     История переходов — в lineage.mjs, не в накладной.
 *
 * Изменение 1.1.0:
 *   - updateItemStatus принимает объект item (не id). Два item с одинаковым id
 *     теперь обрабатываются оба (было: find по id → всегда первый).
 *   - detectFormatHint распознаёт catalog для объектов с ключами entries/objects/...
 *     (было: любой объект → hierarchical, что неверно для OFAC SDN).
 *   - Изменение 1.1.1: runAdapter приоритет данных над метаданными.
 *   - Изменение 1.1.2: metaInput передаёт value_type и granularity из накладной.
 *     Это позволяет passThroughV1Object использовать явные значения вместо дефолтов. Если
 *     format_hint в накладной = 'hierarchical', но detectFormatHint(data) даёт
 *     конкретный тип (catalog/timeseries/points/regions/events) — используется
 *     детект, лог WARN. Универсальное правило: данные важнее метаданных.
 *
 * Роль: забирает сырьё из data/raw/ по накладным incoming/*.json
 * со status=pending, нормализует через адаптеры, укладывает в data/basket/,
 * обновляет накладную и manifest, утилизирует переполненный raw.
 *
 * Не делает: запросов к внешним API (это роль сборщика),
 * удаления без превышения лимита raw_max_bytes,
 * разбора форматов (это роль адаптеров).
 *
 * Запуск: node scripts/warehouse/managerbasket.mjs
 * Cron: с задержкой +5 минут после сборщиков.
 */

import { readFile, writeFile, mkdir, appendFile, readdir, stat, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadLineage, saveLineage, addLineageEntry } from './lineage.mjs';
import { loadQuality, saveQuality, computeQualityFor } from './quality.mjs';
import { validateBasket, summarizeErrors } from './validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CONFIG_PATH = join(ROOT, 'data', 'warehouse', 'config.json');
const INCOMING_DIR = join(ROOT, 'data', 'warehouse', 'incoming');
const MANIFEST_PATH = join(ROOT, 'data', 'warehouse', 'manifest.json');
const EVICTION_LOG = join(ROOT, 'data', 'warehouse', 'eviction.log');
const RAW_DIR = join(ROOT, 'data', 'raw');
const BASKET_DIR = join(ROOT, 'data', 'basket');
const ADAPTERS_DIR = join(ROOT, 'scripts', 'warehouse', 'adapters');
const SCHEMA_INCOMING_PATH = join(ROOT, 'data', 'schemas', 'incoming.v1.json');
const LOG_FILE = join(ROOT, 'logs', 'collectors', 'managerbasket.log');

async function log(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  await mkdir(dirname(LOG_FILE), { recursive: true });
  await appendFile(LOG_FILE, line);
  process.stdout.write(line);
}

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { schema: 'crucix.warehouse.manifest.v1', items: {}, updated_at: null };
  }
  const raw = await readFile(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function saveManifest(manifest) {
  manifest.updated_at = new Date().toISOString();
  const tmp = MANIFEST_PATH + '.tmp';
  await writeFile(tmp, JSON.stringify(manifest, null, 2), 'utf-8');
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  await unlink(tmp).catch(() => {});
}

async function listIncomingFiles() {
  if (!existsSync(INCOMING_DIR)) return [];
  const entries = await readdir(INCOMING_DIR);
  return entries.filter(f => f.endsWith('.json')).sort();
}

// === СХЕМА НАКЛАДНОЙ ===

/**
 * Загружает схему накладной из data/schemas/incoming.v1.json.
 * Возвращает объект схемы или null, если схема не найдена (валидация
 * будет пропущена с предупреждением в лог).
 */
async function loadIncomingSchema() {
  if (!existsSync(SCHEMA_INCOMING_PATH)) {
    return null;
  }
  try {
    const raw = await readFile(SCHEMA_INCOMING_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    await log(`Схема ${SCHEMA_INCOMING_PATH} не парсится: ${e.message}`, 'WARN');
    return null;
  }
}

/**
 * Структурная валидация накладной по схеме. Без внешних библиотек —
 * проверяем обязательные поля, типы, enum, patterns и условные инварианты
 * (processed → processed_at+processed_to, failed → failed_at+error,
 * archived → archived_at+archived_reason).
 *
 * Возвращает { ok: true } или { ok: false, errors: [...] }.
 */
function validateIncoming(incoming, schema) {
  const errors = [];
  if (!schema) return { ok: true, errors: [] };

  if (!incoming || typeof incoming !== 'object') {
    return { ok: false, errors: ['накладная не объект'] };
  }
  if (typeof incoming.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(incoming.date)) {
    errors.push('$.date: ожидается YYYY-MM-DD');
  }
  if (!Array.isArray(incoming.items)) {
    errors.push('$.items: ожидается массив');
    return { ok: false, errors };
  }

  const itemSchema = schema.$defs && schema.$defs.item;
  const itemRequired = (itemSchema && itemSchema.required) || ['id', 'collector', 'source', 'raw_file', 'status'];
  const statusEnum = (itemSchema && itemSchema.properties && itemSchema.properties.status && itemSchema.properties.status.enum)
    || ['pending', 'processed', 'failed', 'archived'];

  for (let i = 0; i < incoming.items.length; i++) {
    const it = incoming.items[i];
    const p = `$.items[${i}]`;
    if (!it || typeof it !== 'object') {
      errors.push(`${p}: не объект`);
      continue;
    }
    for (const field of itemRequired) {
      if (it[field] === undefined || it[field] === null || it[field] === '') {
        errors.push(`${p}.${field}: обязательное поле отсутствует`);
      }
    }
    if (it.status !== undefined && !statusEnum.includes(it.status)) {
      errors.push(`${p}.status: '${it.status}' не из enum [${statusEnum.join(', ')}]`);
    }
    if (it.status === 'processed') {
      if (!it.processed_at) errors.push(`${p}.processed_at: обязателен при status='processed'`);
      if (!it.processed_to) errors.push(`${p}.processed_to: обязателен при status='processed'`);
      if (it.error) errors.push(`${p}.error: не должен присутствовать при status='processed' (поле-призрак)`);
      if (it.failed_at) errors.push(`${p}.failed_at: не должен присутствовать при status='processed' (поле-призрак)`);
    }
    if (it.status === 'failed') {
      if (!it.failed_at) errors.push(`${p}.failed_at: обязателен при status='failed'`);
      if (!it.error) errors.push(`${p}.error: обязателен при status='failed'`);
      if (it.processed_at) errors.push(`${p}.processed_at: не должен присутствовать при status='failed' (поле-призрак)`);
    }
    if (it.status === 'archived') {
      if (!it.archived_at) errors.push(`${p}.archived_at: обязателен при status='archived'`);
      if (!it.archived_reason) errors.push(`${p}.archived_reason: обязателен при status='archived'`);
    }
    if (it.checksum_sha256 !== undefined && !/^[a-f0-9]{64}$/.test(it.checksum_sha256)) {
      errors.push(`${p}.checksum_sha256: ожидается sha256 hex`);
    }
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

// === РАБОТА С НАКЛАДНЫМИ ===

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(buf).digest('hex');
}

async function loadIncoming(fileName) {
  const filePath = join(INCOMING_DIR, fileName);
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return { date: basename(fileName, '.json'), items: parsed, _path: filePath };
  }
  if (parsed && Array.isArray(parsed.items)) {
    return { date: parsed.date || basename(fileName, '.json'), items: parsed.items, _path: filePath };
  }
  throw new Error(`Накладная ${fileName}: неизвестная структура (ожидается массив или {items:[]})`);
}

async function saveIncoming(incoming, schema) {
  const output = {
    date: incoming.date,
    updated_at: new Date().toISOString(),
    items: incoming.items
  };

  const validation = validateIncoming(output, schema);
  if (!validation.ok) {
    await log(`ОТКЛОНЕНА накладная ${incoming.date}: ${validation.errors.length} ошибок схемы:`, 'ERROR');
    for (const err of validation.errors.slice(0, 10)) {
      await log(`  ${err}`, 'ERROR');
    }
    if (validation.errors.length > 10) {
      await log(`  ... и ещё ${validation.errors.length - 10}`, 'ERROR');
    }
    return false;
  }

  await writeFile(incoming._path, JSON.stringify(output, null, 2), 'utf-8');
  return true;
}

function findPendingItems(incoming) {
  return incoming.items.filter(item => item.status === 'pending');
}

async function verifyRawFile(item) {
  if (!item.raw_file) {
    return { ok: false, reason: 'raw_file не указан в накладной' };
  }
  const rawPath = join(ROOT, item.raw_file);
  if (!existsSync(rawPath)) {
    return { ok: false, reason: `сырой файл не найден: ${item.raw_file}` };
  }
  const st = await stat(rawPath);
  if (item.bytes && st.size !== item.bytes) {
    return { ok: false, reason: `размер не совпадает: ожидался ${item.bytes}, реальный ${st.size}` };
  }
  if (item.checksum_sha256) {
    const actual = await sha256File(rawPath);
    if (actual !== item.checksum_sha256) {
      return { ok: false, reason: `checksum не совпадает: ожидался ${item.checksum_sha256.slice(0, 12)}..., реальный ${actual.slice(0, 12)}...` };
    }
  }
  return { ok: true, rawPath, size: st.size };
}

/**
 * Обновляет статус записи в накладной.
 *
 * Изменение 1.2.0: при смене статуса вычищает поля-«призраки» от предыдущих
 * состояний. Философия: накладная хранит ТОЛЬКО АКТУАЛЬНОЕ состояние записи.
 * История переходов — в lineage.mjs.
 *
 * Правила очистки:
 *   - processed: удалить error, failed_at (призраки от прошлой неудачи)
 *   - failed:    удалить processed_at, processed_to, format_used (призраки от прошлого успеха)
 *   - archived:  удалить error, failed_at (архив — терминальное состояние)
 *   - pending:   удалить всё терминальное (error, failed_at, processed_at,
 *                processed_to, archived_at, archived_reason)
 */
function updateItemStatus(incoming, item, status, extra = {}) {
  if (!item || typeof item !== 'object') return false;
  if (!incoming.items.includes(item)) return false;

  const now = new Date().toISOString();
  const prevStatus = item.status;

  if (status === 'processed') {
    delete item.error;
    delete item.failed_at;
    item.processed_at = now;
  } else if (status === 'failed') {
    delete item.processed_at;
    delete item.processed_to;
    delete item.format_used;
    item.failed_at = now;
  } else if (status === 'archived') {
    delete item.error;
    delete item.failed_at;
    item.archived_at = item.archived_at || now;
  } else if (status === 'pending') {
    delete item.error;
    delete item.failed_at;
    delete item.processed_at;
    delete item.processed_to;
    delete item.archived_at;
    delete item.archived_reason;
  }

  item.status = status;
  item.status_updated_at = now;
  if (prevStatus && prevStatus !== status) {
    item.status_prev = prevStatus;
  }

  Object.assign(item, extra);
  return true;
}

// === РАБОТА С АДАПТЕРАМИ ===

const KNOWN_ADAPTERS = ['timeseries', 'points', 'regions', 'events', 'hierarchical', 'catalog'];

const CATALOG_ARRAY_KEYS = ['entries', 'objects', 'items', 'data', 'records', 'rows', 'results', 'values', 'list', 'nodes'];

function detectFormatHint(data) {
  if (!Array.isArray(data)) {
    // Объект: проверяем на catalog (внутри есть массив сущностей)
    if (data && typeof data === 'object') {
      const hasCatalogArray = CATALOG_ARRAY_KEYS.some(k => Array.isArray(data[k]));
      if (hasCatalogArray) return 'catalog';
    }
    return 'hierarchical';
  }
  if (data.length === 0) return 'unknown';
  const first = data[0];
  if (!first || typeof first !== 'object') return 'unknown';
  const hasDate = 'date' in first;
  const hasLat = 'lat' in first;
  const hasLon = 'lon' in first || 'lng' in first;
  const hasTimestamp = 'timestamp' in first;
  const hasRegion = 'region' in first || 'country' in first;
  if (hasLat && hasLon) {
    if (hasDate || hasTimestamp) return 'events';
    return 'points';
  }
  if (hasDate) return 'timeseries';
  if (hasRegion) return 'regions';
  return 'unknown';
}

async function loadAdapter(name) {
  const adapterPath = join(ADAPTERS_DIR, `${name}.mjs`);
  if (!existsSync(adapterPath)) {
    return { ok: false, reason: `адаптер не найден: ${name}.mjs` };
  }
  try {
    const url = pathToFileURL(adapterPath).href;
    const mod = await import(url);
    if (typeof mod.normalize !== 'function') {
      return { ok: false, reason: `адаптер ${name}.mjs: нет экспорта normalize` };
    }
    return { ok: true, adapter: mod, name };
  } catch (e) {
    return { ok: false, reason: `адаптер ${name}.mjs: ошибка импорта: ${e.message}` };
  }
}

async function runAdapter(formatHint, rawData, meta) {
  let hint = KNOWN_ADAPTERS.includes(formatHint) ? formatHint : detectFormatHint(rawData);
  // Изменение 1.1.1: данные важнее метаданных накладной.
  // Если накладная говорит 'hierarchical', но структура данных указывает на
  // конкретный тип — доверяем данным. Защита от устаревших hint.
  if (hint === 'hierarchical') {
    const detected = detectFormatHint(rawData);
    if (detected && detected !== 'unknown' && detected !== 'hierarchical') {
      await log(`WARN: format_hint='hierarchical' в накладной, но данные выглядят как '${detected}'. Использую '${detected}'.`, 'WARN');
      hint = detected;
    }
  }
  const loaded = await loadAdapter(hint);
  if (!loaded.ok) {
    return { ok: false, reason: loaded.reason, format_used: hint };
  }
  try {
    const result = await loaded.adapter.normalize(rawData, meta);
    return { ok: true, result, format_used: hint };
  } catch (e) {
    return { ok: false, reason: `адаптер ${hint}.mjs: ошибка обработки: ${e.message}`, format_used: hint };
  }
}

async function listAvailableAdapters() {
  if (!existsSync(ADAPTERS_DIR)) return [];
  const entries = await readdir(ADAPTERS_DIR);
  return entries.filter(f => f.endsWith('.mjs')).map(f => basename(f, '.mjs'));
}

// === УКЛАДКА В BASKET И ОБНОВЛЕНИЕ УЧЁТА ===

async function readRawData(item) {
  const rawPath = join(ROOT, item.raw_file);
  const raw = await readFile(rawPath, 'utf-8');
  return JSON.parse(raw);
}

function buildMeta(item, adapterMeta) {
  const now = new Date().toISOString();
  return {
    id: item.id,
    source: item.source || 'unknown',
    source_url: item.source_url || '',
    fetched_at: item.fetched_at || now,
    normalized_at: now,
    collector: item.collector || 'unknown',
    license: item.license || 'unknown',
    count: adapterMeta.count || 0,
    granularity: adapterMeta.granularity || item.granularity || 'event',
    value_unit: adapterMeta.value_unit || 'unknown',
    value_scale: adapterMeta.value_scale,
    value_type: adapterMeta.value_type || 'unknown',
    value_range: adapterMeta.value_range !== undefined ? adapterMeta.value_range : null,
    period: item.period || undefined,
    extra_meta: item.extra_meta || undefined
  };
}

async function writeBasket(itemId, normalized) {
  if (!existsSync(BASKET_DIR)) {
    await mkdir(BASKET_DIR, { recursive: true });
  }
  const basketPath = join(BASKET_DIR, `${itemId}.json`);
  const tmp = basketPath + '.tmp';
  const payload = JSON.stringify(normalized, null, 2);
  await writeFile(tmp, payload, 'utf-8');
  await writeFile(basketPath, payload, 'utf-8');
  await unlink(tmp).catch(() => {});
  return basketPath;
}

function updateManifest(manifest, item, normalized, basketPath) {
  const now = new Date().toISOString();
  const prev = manifest.items[item.id] || {};
  manifest.items[item.id] = {
    id: item.id,
    basket_file: basketPath.replace(ROOT + '/', ''),
    schema: normalized.schema,
    last_collector: item.collector || 'unknown',
    last_source_url: item.source_url || '',
    last_fetched_at: item.fetched_at || now,
    last_normalized_at: now,
    records: normalized.meta.count || 0,
    granularity: normalized.meta.granularity || 'event',
    period: normalized.meta.period || null,
    quality: 'ok',
    quality_notes: null,
    updates_count: (prev.updates_count || 0) + 1,
    first_seen_at: prev.first_seen_at || now
  };
}

async function processOneItem(item, manifest, lineage, quality) {
  if (!item.raw_file) {
    return { ok: false, reason: 'raw_file не указан' };
  }
  const verify = await verifyRawFile(item);
  if (!verify.ok) return { ok: false, reason: verify.reason };

  let rawData;
  try {
    rawData = await readRawData(item);
  } catch (e) {
    return { ok: false, reason: `ошибка чтения сырого файла: ${e.message}` };
  }

  const metaInput = {
    id: item.id,
    source: item.source,
    source_url: item.source_url,
    fetched_at: item.fetched_at,
    collector: item.collector,
    license: item.license,
    format_hint: item.format_hint,
    value_unit: item.value_unit,
    value_scale: item.value_scale,
    value_type: item.value_type || null,
    granularity: item.granularity || null
  };

  const adapterRun = await runAdapter(item.format_hint, rawData, metaInput);
  if (!adapterRun.ok) {
    return { ok: false, reason: adapterRun.reason, format_used: adapterRun.format_used };
  }

  const adapterResult = adapterRun.result;
  const meta = buildMeta(item, {
    count: adapterResult.count,
    granularity: adapterResult.granularity,
    value_unit: adapterResult.value_unit,
    value_scale: adapterResult.value_scale,
    value_type: adapterResult.value_type,
    value_range: adapterResult.value_range
  });

  const normalized = {
    schema: 'crucix.basket.v1',
    meta,
    series: adapterResult.series || [],
    points: adapterResult.points || [],
    regions: adapterResult.regions || [],
    documents: adapterResult.documents || [],
    graph: adapterResult.graph || null,
    extra: adapterResult.extra || {}
  };

  // Валидация перед записью.
  const validation = validateBasket(normalized);
  if (!validation.ok) {
    await log(`ОТКЛОНЁН ${item.id}: ${summarizeErrors(validation.errors)}`, 'ERROR');
    return { ok: false, reason: `validation failed: ${validation.errors.length} errors`, errors: validation.errors };
  }

  const basketPath = await writeBasket(item.id, normalized);
  updateManifest(manifest, item, normalized, basketPath);

  // Lineage: происхождение данных
  addLineageEntry(lineage, item.id, {
    raw_file: item.raw_file,
    raw_checksum: item.checksum_sha256,
    adapter: adapterRun.format_used,
    adapter_version: normalized.extra && normalized.extra.adapter_version ? normalized.extra.adapter_version : null,
    records_in: adapterResult.count ?? null,
    records_out: normalized.meta.count,
    unmapped_count: normalized.extra && normalized.extra.unmapped_count ? normalized.extra.unmapped_count : 0,
    skipped_count: normalized.extra && (normalized.extra.skipped_no_date || normalized.extra.skipped_invalid_coords || normalized.extra.skipped_rows || normalized.extra.skipped) ? (normalized.extra.skipped_no_date || normalized.extra.skipped_invalid_coords || normalized.extra.skipped_rows || normalized.extra.skipped) : 0
  });

  // Quality: метрики
  quality.items[item.id] = computeQualityFor(item.id, normalized);

  return { ok: true, basket_file: basketPath, format_used: adapterRun.format_used, count: meta.count };
}

// === УТИЛИЗАЦИЯ RAW (TIERED) ===

async function listRawFiles() {
  if (!existsSync(RAW_DIR)) return [];
  const entries = await readdir(RAW_DIR);
  const result = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const filePath = join(RAW_DIR, name);
    const st = await stat(filePath);
    result.push({ name, path: filePath, size: st.size, mtime: st.mtimeMs });
  }
  return result;
}

function classifyTier(ageDays, thresholds) {
  if (ageDays <= thresholds.fresh) return 'fresh';
  if (ageDays <= thresholds.working) return 'working';
  return 'archive';
}

async function evictRawIfNeeded(config) {
  const maxBytes = config.raw.max_bytes;
  const targetRatio = config.raw.eviction_target_ratio || 0.9;
  const thresholds = config.raw.tier_thresholds_days || { fresh: 7, working: 30 };
  const keepMinFiles = config.raw.keep_min_files || 100;
  const keepMinDays = config.raw.keep_min_days || 1;

  const files = await listRawFiles();
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  if (totalBytes <= maxBytes) {
    return { evicted: 0, freed_bytes: 0, total_before: totalBytes, total_after: totalBytes };
  }

  const now = Date.now();
  const dayMs = 86400000;
  const enriched = files.map(f => {
    const ageDays = (now - f.mtime) / dayMs;
    return { ...f, ageDays, tier: classifyTier(ageDays, thresholds) };
  });

  const tierOrder = { archive: 0, working: 1, fresh: 2 };
  enriched.sort((a, b) => {
    const t = tierOrder[a.tier] - tierOrder[b.tier];
    if (t !== 0) return t;
    return a.mtime - b.mtime;
  });

  const targetBytes = Math.floor(maxBytes * targetRatio);
  let currentBytes = totalBytes;
  let evicted = 0;
  let freedBytes = 0;
  const protectedFiles = enriched.filter(f => f.ageDays < keepMinDays).length;

  for (const f of enriched) {
    if (currentBytes <= targetBytes) break;
    if (f.ageDays < keepMinDays) continue;
    if (files.length - evicted <= keepMinFiles) break;
    try {
      await unlink(f.path);
      currentBytes -= f.size;
      freedBytes += f.size;
      evicted++;
      await appendFile(EVICTION_LOG, `${new Date().toISOString()} | ${f.name} | ${f.size} | ${f.tier} | до ${currentBytes} байт\n`);
    } catch (e) {
      await log(`Не удалось удалить ${f.name}: ${e.message}`, 'WARN');
    }
  }

  return { evicted, freed_bytes: freedBytes, total_before: totalBytes, total_after: currentBytes };
}

// === MAIN ===

async function main() {
  const started = Date.now();
  await log('=== Кладовщик запущен (v1.2.0) ===');
  const config = await loadConfig();
  const manifest = await loadManifest();
  const lineage = await loadLineage();
  const quality = await loadQuality();
  const schema = await loadIncomingSchema();
  if (!schema) {
    await log(`Схема ${SCHEMA_INCOMING_PATH} не найдена — валидация накладных отключена`, 'WARN');
  } else {
    await log(`Схема накладной загружена: ${schema.$id || 'incoming.v1'}`);
  }

  const incomingFiles = await listIncomingFiles();
  let processed = 0, failed = 0, skipped = 0, schemaRejected = 0;

  for (const fileName of incomingFiles) {
    let incoming;
    try {
      incoming = await loadIncoming(fileName);
    } catch (e) {
      await log(`Ошибка загрузки накладной ${fileName}: ${e.message}`, 'ERROR');
      continue;
    }
    const pending = findPendingItems(incoming);
    if (pending.length === 0) continue;
    await log(`Накладная ${fileName}: ${pending.length} записей со status=pending`);

    let anyChange = false;
    for (const item of pending) {
      const result = await processOneItem(item, manifest, lineage, quality);
      if (result.ok) {
        updateItemStatus(incoming, item, 'processed', {
          processed_to: result.basket_file.replace(ROOT + '/', ''),
          format_used: result.format_used
        });
        processed++;
        anyChange = true;
        await log(`OK ${item.id} → ${result.basket_file.replace(ROOT + '/', '')} (${result.count} записей, ${result.format_used})`);
      } else {
        updateItemStatus(incoming, item, 'failed', { error: result.reason });
        failed++;
        anyChange = true;
        await log(`FAIL ${item.id}: ${result.reason}`, 'ERROR');
      }
    }

    // Сохраняем накладную только если были изменения.
    if (anyChange) {
      const saved = await saveIncoming(incoming, schema);
      if (!saved) schemaRejected++;
    }
  }

  const evict = await evictRawIfNeeded(config);
  if (evict.evicted > 0) {
    await log(`Утилизация raw: удалено ${evict.evicted} файлов, освобождено ${evict.freed_bytes} байт (${evict.total_before} → ${evict.total_after})`);
  } else {
    await log(`Raw: ${evict.total_before} байт, лимит ${config.raw.max_bytes}, утилизация не требуется`);
  }

  await saveLineage(lineage);
  await saveQuality(quality);
  await saveManifest(manifest);
  const duration = Date.now() - started;
  await log(`=== Кладовщик завершён: processed=${processed}, failed=${failed}, skipped=${skipped}, schema_rejected=${schemaRejected}, evicted=${evict.evicted}, время=${duration}мс ===`);
  return { processed, failed, skipped, schema_rejected: schemaRejected, evicted: evict.evicted, duration_ms: duration };
}

main().catch(async (e) => {
  await log(`Фатальная ошибка: ${e.stack || e.message}`, 'FATAL');
  process.exit(1);
});
