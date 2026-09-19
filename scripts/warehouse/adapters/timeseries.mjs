/**
 * Адаптер timeseries.
 * Версия 2.1.0. Принят 19.09.2026.
 *
 * Назначение: нормализация источников с временным рядом без координат.
 * Формат сырья: массив объектов с полем date и числовым полем (magnitude,
 * value, count и т.п.). Опционально поле region — текстовое название региона.
 *
 * ВЕРСИЯ 2.1.0 (изменения от 2.0.0):
 *   1. value_type: приоритет rawMeta.value_type, иначе deriveValueType по value_unit.
 *      Устранён баг с регистром (было 'usd' → 'unknown', стало → 'price').
 *   2. granularity: приоритет rawMeta.granularity ('daily'/'hourly'/'event'/'snapshot').
 *   3. series[i].extra: сохраняются ВСЕ поля точки, кроме date/value/region.
 *      Числовые — как числа, строковые — как строки. Устранена потеря
 *      symbol/name/unit в мульти-серийных источниках (EIA: 5 символов).
 *
 * Результат: объект crucix.basket.v1 с series + regions + points.
 *
 * Контракт: export async function normalize(rawData, meta) -> объект.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {warmup as mapperWarmup, resolveRegionKeySync, getCountry, getCountrySync } from '../region-mapper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const COUNTRIES_PATH = join(ROOT, 'data', 'reference', 'countries.json');


const VALUE_FIELDS = ['magnitude', 'value', 'count', 'index', 'amount', 'close', 'price', 'ships', 'fires', 'events', 'alerts', 'incidents', 'cases', 'deaths', 'casualties', 'fatalities', 'score'];
const DATE_FIELDS = ['date', 'timestamp', 'time', 'datetime'];
const REGION_FIELDS = ['region', 'country', 'area', 'location'];
const EXTRA_NUMERIC_FIELDS = ['depth', 'severity', 'intensity', 'temperature', 'wind', 'precipitation', 'frp', 'confidence', 'brightness', 'fatalities', 'casualties', 'deaths', 'gold', 'oil', 'ratio', 'open', 'high', 'low', 'volume', 'change', 'score', 'count'];

// Поля, которые НЕ идут в extra (они уже учтены в структуре)
const SKIP_FIELDS = new Set(['date', 'timestamp', 'time', 'datetime', 'value', 'magnitude', 'count', 'index', 'amount', 'close', 'price', 'region', 'country', 'area', 'location', 'lat', 'lon', 'lng']);

function pickFirst(obj, fields) {
  for (const f of fields) {
    if (obj[f] !== undefined && obj[f] !== null) return { key: f, value: obj[f] };
  }
  return null;
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDate(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    if (raw.length === 10) return raw;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      return iso.length >= 10 ? iso.slice(0, 10) : iso;
    }
  }
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      return iso.length >= 10 ? iso.slice(0, 10) : iso;
    }
  }
  return null;
}

function deriveValueType(valueUnit) {
  if (!valueUnit) return 'unknown';
  const norm = String(valueUnit).toLowerCase();
  const map = {
    'magnitude': 'magnitude',
    'severity_0_1': 'severity',
    'severity_0_10': 'severity',
    'percent': 'ratio',
    'usd': 'price',
    'eur': 'price',
    'index': 'index',
    'count': 'count',
    'ratio': 'ratio',
    'mw': 'count',
    'meters': 'count',
    'events_per_day': 'count',
    'temperature': 'temperature',
    'probability': 'probability',
    'unknown': 'unknown'
  };
  return map[norm] || 'unknown';
}

function deriveValueRange(valueUnit) {
  if (!valueUnit) return null;
  const norm = String(valueUnit).toLowerCase();
  const map = {
    'magnitude': [0, 10],
    'severity_0_1': [0, 1],
    'severity_0_10': [0, 10],
    'percent': [0, 100],
    'probability': [0, 1]
  };
  return map[norm] || null;
}

function deriveAggregation(valueType) {
  if (valueType === 'magnitude' || valueType === 'severity') return 'max';
  if (valueType === 'count') return 'sum';
  if (valueType === 'index' || valueType === 'ratio' || valueType === 'price') return 'mean';
  return 'mean';
}

function inferValueUnit(rawData) {
  if (!Array.isArray(rawData) || rawData.length === 0) return 'unknown';
  const first = rawData[0];
  if (!first || typeof first !== 'object') return 'unknown';
  if ('magnitude' in first) return 'magnitude';
  if ('severity' in first) return 'severity_0_1';
  if ('value' in first) return 'unknown';
  return 'unknown';
}

// Собирает extra из всех полей точки, кроме структурных.
// Числа → числа; строки → строки; массивы/объекты → как есть (если не пусто).
function collectExtraFields(row, alreadyUsed) {
  const extra = {};
  for (const k of Object.keys(row)) {
    if (SKIP_FIELDS.has(k)) continue;
    if (alreadyUsed.has(k)) continue;
    const v = row[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number') {
      extra[k] = v;
    } else if (typeof v === 'string') {
      if (v.length > 0 && v.length < 200) extra[k] = v;
    } else if (Array.isArray(v)) {
      if (v.length > 0) extra[k] = v;
    } else if (typeof v === 'object') {
      if (Object.keys(v).length > 0) extra[k] = v;
    }
  }
  return extra;
}

export async function normalize(rawData, meta) {
  if (!Array.isArray(rawData)) {
    throw new Error(`timeseries.normalize: ожидается массив, получено ${typeof rawData}`);
  }

  const countries = await mapperWarmup();

  const series = [];
  const points = [];
  const regionsMap = new Map();
  const unmappedRegions = new Set();
  const uniqueDates = new Set();

  for (const row of rawData) {
    if (!row || typeof row !== 'object') continue;

    const valuePick = pickFirst(row, VALUE_FIELDS);
    const datePick = pickFirst(row, DATE_FIELDS);
    const regionPick = pickFirst(row, REGION_FIELDS);

    if (!valuePick) continue;
    const value = toNumber(valuePick.value);
    if (value === null) continue;

    const date = datePick ? normalizeDate(datePick.value) : null;
    const regionRaw = regionPick ? String(regionPick.value) : null;
    const regionIso3 = resolveRegionKeySync(regionRaw);

    if (date) uniqueDates.add(date);

    // Собираем extra: сначала известные числовые поля, затем — все остальные
    // не-структурные поля точки (символы, имена, единицы).
    const usedKeys = new Set();
    if (valuePick) usedKeys.add(valuePick.key);
    if (datePick) usedKeys.add(datePick.key);
    if (regionPick) usedKeys.add(regionPick.key);

    const extra = collectExtraFields(row, usedKeys);

    // Дополнительно проверим известные числовые поля — если они не попали,
    // добавим их через toNumber (на случай строковых чисел).
    for (const f of EXTRA_NUMERIC_FIELDS) {
      if (row[f] !== undefined && row[f] !== null && extra[f] === undefined) {
        const n = toNumber(row[f]);
        if (n !== null) extra[f] = n;
      }
    }

    if (!regionIso3 && regionRaw) {
      extra.unmapped_region = true;
      extra.unmapped_original = regionRaw;
      unmappedRegions.add(regionRaw);
    }

    const seriesEntry = {
      date: date || (datePick ? String(datePick.value) : 'unknown'),
      value
    };
    if (regionIso3) seriesEntry.region = regionIso3;
    else if (regionRaw) seriesEntry.region = regionRaw;
    if (Object.keys(extra).length > 0) seriesEntry.extra = extra;
    series.push(seriesEntry);

    // Points — центроид страны, если регион распознан
    if (regionIso3) {
      const info = getCountrySync(regionIso3);
      if (info && info.centroid && typeof info.centroid.lat === 'number' && typeof info.centroid.lon === 'number') {
        const point = {
          lat: info.centroid.lat, lon: info.centroid.lon,
          value,
          label: `${valuePick.key}=${value}`,
          region: regionIso3
        };
        if (date) point.timestamp = date + 'T00:00:00Z';
        points.push(point);
      }
    }

    const regionKey = regionIso3 || regionRaw || 'GLOBAL';
    if (!regionsMap.has(regionKey)) {
      regionsMap.set(regionKey, { region: regionKey, sum: 0, count: 0, max: -Infinity });
    }
    const agg = regionsMap.get(regionKey);
    agg.sum += value;
    agg.count += 1;
    if (value > agg.max) agg.max = value;
  }

  const rawMeta = meta || {};
  const valueUnit = rawMeta.value_unit || inferValueUnit(rawData);
  // Приоритет: явный value_type из сборщика → вывод из value_unit.
  const valueType = rawMeta.value_type || deriveValueType(valueUnit);
  const valueRange = rawMeta.value_range !== undefined ? rawMeta.value_range : deriveValueRange(valueUnit);
  const aggregation = rawMeta.aggregation || deriveAggregation(valueType);
  // Приоритет: явный granularity из сборщика → вывод из числа дат.
  const granularity = rawMeta.granularity || (uniqueDates.size > 1 ? 'daily' : 'snapshot');

  const regions = Array.from(regionsMap.values()).map(a => ({
    region: a.region,
    value: a.count > 0 ? a.sum / a.count : 0,
    count: a.count,
    aggregation: aggregation,
    extra: { max: a.max === -Infinity ? null : a.max, sum: a.sum }
  }));

  return {
    schema: 'crucix.basket.v1',
    count: series.length,
    granularity,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || null,
    value_type: valueType,
    value_range: valueRange,
    series,
    points,
    regions,
    extra: {
      adapter: 'timeseries',
      adapter_version: '2.1.0',
      unique_dates: uniqueDates.size,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size
    }
  };
}
