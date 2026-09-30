/**
 * Адаптер catalog.
 * Версия 1.1.1. Принят 19.09.2026.
 *
 * Назначение: нормализация источников-справочников сущностей.
 * Пример: OFAC SDN (санкционные лица/организации/судна), CoinGecko (криптовалюты).
 * Формат сырья: {..., entries: [{id, name, type, price, addresses: [{country}], ...}]}
 * или массив таких записей.
 *
 * Особенности:
 *   - нет series (нет дат)
 *   - нет points (нет координат, если нет lat/lon в записях)
 *   - regions строятся из addresses[].country (агрегат по странам)
 *   - ПОЛНЫЙ каталог записей сохраняется в extra.entries (без потерь)
 *
 * Изменение 1.1.0: автоопределение value_type по полям записей (было — 'count').
 * Изменение 1.1.1: 'indicators' добавлен в ARRAY_KEYS (для FRED и подобных макро-источников).
 *   Приоритет: price → magnitude → severity → ratio → index → temperature
 *   → probability → count (fallback для справочников без числового значения).
 *
 * Контракт: export async function normalize(rawData, meta) -> объект.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { warmup as mapperWarmup, resolveRegionKeySync, getCountry, getCountrySync } from '../region-mapper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const COUNTRIES_PATH = join(ROOT, 'data', 'reference', 'countries.json');


const ARRAY_KEYS = ['entries', 'objects', 'items', 'data', 'records', 'rows', 'results', 'values', 'list', 'nodes', 'indicators'];
const COUNTRY_FIELDS = ['country', 'country_code', 'countryCode', 'iso3', 'iso', 'nationality', 'citizenship'];

const VALUE_TYPE_PRIORITY = [
  { type: 'price', keys: ['price', 'price_usd', 'current_price'] },
  { type: 'magnitude', keys: ['magnitude'] },
  { type: 'severity', keys: ['severity'] },
  { type: 'ratio', keys: ['ratio'] },
  { type: 'index', keys: ['index', 'vix', 'score'] },
  { type: 'temperature', keys: ['temperature', 'temp'] },
  { type: 'probability', keys: ['probability', 'prob'] },
];

function detectValueType(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'count';
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue;
    for (const { type, keys } of VALUE_TYPE_PRIORITY) {
      for (const k of keys) {
        if (typeof entry[k] === 'number') return type;
      }
    }
  }
  return 'count';
}

function extractCountriesFromEntry(entry) {
  const codes = new Set();
  // 1. Прямые поля entry
  for (const f of COUNTRY_FIELDS) {
    if (typeof entry[f] === 'string' && entry[f].trim()) {
      const iso3 = resolveRegionKeySync(entry[f].trim());
      if (iso3) codes.add(iso3);
    }
  }
  // 2. addresses[].country
  if (Array.isArray(entry.addresses)) {
    for (const a of entry.addresses) {
      if (a && typeof a.country === 'string' && a.country.trim()) {
        const iso3 = resolveRegionKeySync(a.country.trim());
        if (iso3) codes.add(iso3);
      }
    }
  }
  // 3. nationalities[], citizenships[]
  for (const arr of ['nationalities', 'citizenships']) {
    if (Array.isArray(entry[arr])) {
      for (const v of entry[arr]) {
        if (typeof v === 'string' && v.trim()) {
          const iso3 = resolveRegionKeySync(v.trim());
          if (iso3) codes.add(iso3);
        }
      }
    }
  }
  return Array.from(codes);
}

export async function normalize(rawData, meta) {
  await mapperWarmup();

  // Ищем массив внутри объекта или принимаем массив напрямую
  let arr = rawData;
  let outerExtra = {};
  if (!Array.isArray(rawData)) {
    if (rawData && typeof rawData === 'object') {
      const found = ARRAY_KEYS.find(k => Array.isArray(rawData[k]));
      if (found) {
        arr = rawData[found];
        for (const k of Object.keys(rawData)) {
          if (k !== found) outerExtra[k] = rawData[k];
        }
        outerExtra.inner_array_key = found;
      } else {
        arr = [rawData];
        outerExtra.wrapped_single_object = true;
      }
    } else {
      throw new Error(`catalog.normalize: ожидается массив или объект, получено ${typeof rawData}`);
    }
  }

  const regionCounts = new Map();
  const typeCounts = new Map();
  let processed = 0;

  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue;
    processed++;

    // Тип сущности (для статистики)
    const type = entry.type || entry.sdnType || 'unknown';
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);

    // Страны
    const codes = extractCountriesFromEntry(entry);
    for (const code of codes) {
      regionCounts.set(code, (regionCounts.get(code) || 0) + 1);
    }
  }

  const regions = Array.from(regionCounts.entries())
    .map(([region, count]) => ({ region, value: count, count, aggregation: 'count' }))
    .sort((a, b) => b.value - a.value);

  const rawMeta = meta || {};
  const detectedType = detectValueType(arr);

  return {
    schema: 'crucix.basket.v1',
    count: processed,
    granularity: 'snapshot',
    value_unit: rawMeta.value_unit || (detectedType === 'price' ? 'usd' : 'count'),
    value_scale: rawMeta.value_scale || null,
    value_type: detectedType,
    value_range: null,
    series: [],
    points: [],
    regions,
    extra: {
      adapter: 'catalog',
      adapter_version: '1.1.0',
      type_counts: Object.fromEntries(typeCounts),
      regions_count: regions.length,
      // Сохраняем ПОЛНЫЙ каталог, чтобы ничего не потерять
      entries: arr,
      entries_count: arr.length,
      ...outerExtra
    }
  };
}
