#!/usr/bin/env node

/**
 * collect-worldbank.mjs — Сборщик данных World Bank (v2.3.0)
 *
 * ИСПРАВЛЕНО 12.09.2026:
 * - v2.2.0 с рекурсивным retry давал взрыв запросов (100→50+50→25×4→...)
 *   до 128 запросов при одном падении. Это вызывало throttle WB.
 * - v2.3.0: retry УБРАН. Пауза 1.5 сек между батчами.
 *   При падении — пропускаем батч, продолжаем.
 *
 * ПРАВИЛА (по правилу #WB-limit от 12.09.2026):
 * - Максимум 12 запросов на запуск (2 батча × 6 индикаторов)
 * - Пауза 1.5 сек между запросами
 * - Не чаще 1 раза в 6 часов
 * - WB_BLACKLIST = ['TWN', 'VAT']
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const REFERENCE_DIR = join(PROJECT_ROOT, 'data', 'reference');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-worldbank.log');

const CHARACTERISTICS_FILE = join(REFERENCE_DIR, 'country-characteristics.json');
const BASKET_FILE = join(BASKET_DIR, 'worldbank-latest.json');

const INDICATORS = {
  'GDP':          'NY.GDP.MKTP.CD',
  'GDP_PC':       'NY.GDP.PCAP.CD',
  'INFLATION':    'FP.CPI.TOTL.ZG',
  'UNEMPLOYMENT': 'SL.UEM.TOTL.ZS',
  'DEBT':         'DT.DOD.DECT.CD',
  'POPULATION':   'SP.POP.TOTL'
};

const WB_API = 'https://api.worldbank.org/v2';
const MRV = 5;
const PER_PAGE = 1000;
const MAX_TIME_MS = 60000;
const BATCH_SIZE = 100;
const PAUSE_BETWEEN_REQUESTS_MS = 1500;
const WB_BLACKLIST = ['TWN', 'VAT'];

function ensureDirs() {
  if (!existsSync(BASKET_DIR)) mkdirSync(BASKET_DIR, { recursive: true });
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(msg);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs = MAX_TIME_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function loadCountryCodes() {
  if (!existsSync(CHARACTERISTICS_FILE)) {
    throw new Error(`Справочник не найден: ${CHARACTERISTICS_FILE}`);
  }
  const data = JSON.parse(readFileSync(CHARACTERISTICS_FILE, 'utf-8'));
  if (!data.countries || typeof data.countries !== 'object') {
    throw new Error('Справочник не содержит поля countries');
  }
  return Object.keys(data.countries);
}

function makeBatches(items, size) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function fetchIndicatorBatch(indicatorCode, countryList) {
  const url = `${WB_API}/country/${countryList}/indicator/${indicatorCode}?format=json&mrv=${MRV}&per_page=${PER_PAGE}`;
  const t0 = Date.now();

  try {
    const response = await fetchWithTimeout(url);
    const duration = Date.now() - t0;
    const httpStatus = response.status;

    if (!response.ok) {
      return { records: [], duration, httpStatus, error: `HTTP ${httpStatus}` };
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length === 1 && data[0].message) {
      return { records: [], duration, httpStatus, error: 'API error: ' + data[0].message[0].value };
    }

    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      return { records: [], duration, httpStatus, error: 'Invalid response structure' };
    }

    return { records: data[1], duration, httpStatus, error: null };
  } catch (e) {
    return { records: [], duration: Date.now() - t0, httpStatus: 0, error: e.message };
  }
}

function groupByCountry(records) {
  const byCountry = new Map();
  for (const rec of records) {
    const code = rec.countryiso3code;
    if (!code) continue;
    if (rec.value === null || rec.value === undefined) continue;
    const year = parseInt(rec.date, 10);
    if (!Number.isFinite(year)) continue;
    const existing = byCountry.get(code);
    if (!existing || year > existing.year) {
      byCountry.set(code, { value: rec.value, year });
    }
  }
  return byCountry;
}

async function collect() {
  ensureDirs();
  const t0 = Date.now();
  log('[WorldBank] Запуск сборщика v2.3.0 (без retry, с паузами)');

  const allCountryCodes = loadCountryCodes();
  log(`[WorldBank] Загружено ${allCountryCodes.length} стран`);

  const countryCodes = allCountryCodes.filter(c => !WB_BLACKLIST.includes(c));
  const skipped = allCountryCodes.filter(c => WB_BLACKLIST.includes(c));
  log(`[WorldBank] Blacklist: ${skipped.join(', ')}`);
  log(`[WorldBank] Осталось: ${countryCodes.length}`);

  const batches = makeBatches(countryCodes, BATCH_SIZE);
  log(`[WorldBank] Батчей: ${batches.length}, всего запросов: ${batches.length * Object.keys(INDICATORS).length}`);

  const result = {
    source: 'WorldBank',
    version: '2.3.0',
    lastUpdated: new Date().toISOString(),
    indicators: INDICATORS,
    mrv: MRV,
    batch_size: BATCH_SIZE,
    batches_count: batches.length,
    blacklist: WB_BLACKLIST,
    countries: {},
    meta: {
      requested_countries: allCountryCodes.length,
      queried_countries: countryCodes.length,
      blacklisted_countries: skipped.length,
      blacklisted_list: skipped,
      indicators_count: Object.keys(INDICATORS).length,
      total_requests: batches.length * Object.keys(INDICATORS).length,
      successful_requests: 0,
      failed_requests: 0,
      fetched_at: null,
      duration_ms: null,
      errors: []
    }
  };

  for (const code of allCountryCodes) {
    result.countries[code] = {};
  }

  let requestCount = 0;
  const totalRequests = batches.length * Object.keys(INDICATORS).length;

  for (const [key, code] of Object.entries(INDICATORS)) {
    log(`[WorldBank] === ${key} (${code}) ===`);
    const accumulated = new Map();

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];

      // Пауза между запросами (кроме первого)
      if (requestCount > 0) {
        await sleep(PAUSE_BETWEEN_REQUESTS_MS);
      }
      requestCount++;

      const batchList = batch.join(';');
      log(`  [${requestCount}/${totalRequests}] Батч ${bIdx + 1}/${batches.length}: ${batch.length} стран`);

      const { records, duration, httpStatus, error } = await fetchIndicatorBatch(code, batchList);

      if (error) {
        log(`    ❌ ${error}`);
        result.meta.failed_requests++;
        result.meta.errors.push({ indicator: key, batch: bIdx + 1, error });
        continue;
      }

      result.meta.successful_requests++;
      const byCountry = groupByCountry(records);
      log(`    ✓ записей ${records.length}, стран ${byCountry.size}, ${duration}мс`);

      for (const [iso, val] of byCountry.entries()) {
        const existing = accumulated.get(iso);
        if (!existing || val.year > existing.year) {
          accumulated.set(iso, val);
        }
      }
    }

    log(`  → ${key}: ${accumulated.size} стран с данными`);

    for (const [iso, val] of accumulated.entries()) {
      if (result.countries[iso]) {
        result.countries[iso][key] = { value: val.value, year: String(val.year) };
      }
    }

    for (const iso of allCountryCodes) {
      if (!result.countries[iso][key]) {
        result.countries[iso][key] = null;
      }
    }
  }

  let withAnyData = 0;
  let withoutAnyData = 0;
  const withoutDataList = [];
  for (const iso of allCountryCodes) {
    const fields = Object.values(result.countries[iso]).filter(v => v !== null);
    if (fields.length > 0) withAnyData++;
    else { withoutAnyData++; withoutDataList.push(iso); }
  }

  result.meta.fetched_at = new Date().toISOString();
  result.meta.duration_ms = Date.now() - t0;
  result.meta.countries_with_data = withAnyData;
  result.meta.countries_without_data = withoutAnyData;
  result.meta.countries_without_data_list = withoutDataList;

  // Преобразуем countries (объект) в массив entries для catalog-адаптера.
  const entries = Object.entries(result.countries).map(([iso3, indicators]) => {
    const flat = { iso3, country: iso3 };
    for (const [k, v] of Object.entries(indicators)) {
      if (v && typeof v === 'object' && 'value' in v) {
        flat[k] = v.value;
        flat[k + '_year'] = v.year;
      }
    }
    return flat;
  });

  const result2 = await saveRaw('worldbank', { ...result, entries }, {
    collector: 'collect-worldbank.mjs',
    source: 'WorldBank API',
    source_url: 'https://api.worldbank.org/v2',
    license: 'cc-by',
    format_hint: 'catalog',
    value_unit: 'unknown',
    granularity: 'snapshot',
    record_count: entries.length,
    notes: `${INDICATORS ? Object.keys(INDICATORS).length : 6} индикаторов, ${entries.length} стран`,
    backwardCompat: true
  });
  log(`[WorldBank] Сохранено через saveRaw → ${result2.raw_file}`);
  log(`[WorldBank] ${result.meta.duration_ms}мс, стран с данными ${withAnyData}/${allCountryCodes.length}, без данных ${withoutAnyData}`);
  log(`[WorldBank] Успешных: ${result.meta.successful_requests}/${result.meta.total_requests}, ошибок: ${result.meta.failed_requests}`);

  if (withoutAnyData > 0) {
    log(`[WorldBank] Без данных: ${withoutDataList.join(', ')}`);
  }

  return result;
}

collect()
  .then(() => process.exit(0))
  .catch((e) => {
    log(`[WorldBank] ❌ КРИТИЧЕСКАЯ: ${e.message}`);
    console.error(e);
    process.exit(1);
  });
