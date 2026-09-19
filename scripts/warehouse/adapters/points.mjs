/**
 * Адаптер points.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Назначение: нормализация источников с пространственными точками.
 * Формат сырья: массив объектов с полями lat + lon|lng, опционально
 * value, timestamp, country|region, label|title|name.
 *
 * ВЕРСИЯ 2.0.0 использует ЕДИНЫЙ справочник data/reference/countries.json
 * (собран из country-characteristics, country-coords, country-aliases и alpha-2).
 * Одна карта by_alias_lower — для всех видов входных данных.
 *
 * Результат: объект crucix.basket.v1 с points + regions + series (если
 * найдено больше одного уникального дня).
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


const LAT_FIELDS = ['lat', 'latitude', 'y'];
const LON_FIELDS = ['lon', 'lng', 'longitude', 'x'];
const VALUE_FIELDS = ['value', 'magnitude', 'severity', 'intensity', 'count', 'capacity', 'amount'];
const LABEL_FIELDS = ['label', 'title', 'name', 'description', 'summary'];
const REGION_FIELDS = ['region', 'country', 'area', 'location', 'country_code'];
const TS_FIELDS = ['timestamp', 'date', 'time', 'datetime', 'ts'];
const ID_FIELDS = ['id', '_id', 'uid', 'code'];
const TYPE_FIELDS = ['type', 'category', 'kind'];
const STATUS_FIELDS = ['status', 'state', 'condition'];

function pickNumeric(obj, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/,/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickString(obj, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

function normalizeTimestamp(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function isValidCoords(lat, lon) {
  return lat !== null && lon !== null
    && lat >= -90 && lat <= 90
    && lon >= -180 && lon <= 180
    && !(lat === 0 && lon === 0);
}

function deriveValueType(valueUnit) {
  if (!valueUnit) return 'unknown';
  const map = {
    'magnitude': 'magnitude',
    'severity_0_1': 'severity',
    'severity_0_10': 'severity',
    'percent': 'ratio',
    'USD': 'price',
    'EUR': 'price',
    'index': 'index',
    'count': 'count',
    'ratio': 'ratio',
    'MW': 'count',
    'meters': 'count',
    'events_per_day': 'count',
    'temperature': 'temperature',
    'probability': 'probability',
    'unknown': 'unknown'
  };
  return map[valueUnit] || 'unknown';
}

function deriveValueRange(valueUnit) {
  if (!valueUnit) return null;
  const map = {
    'magnitude': [0, 10],
    'severity_0_1': [0, 1],
    'severity_0_10': [0, 10],
    'percent': [0, 100],
    'probability': [0, 1]
  };
  return map[valueUnit] || null;
}

function deriveAggregation(valueType) {
  if (valueType === 'magnitude' || valueType === 'severity') return 'max';
  if (valueType === 'count') return 'sum';
  if (valueType === 'index' || valueType === 'ratio' || valueType === 'price') return 'mean';
  return 'mean';
}

function inferValueUnit(rawData) {
  if (!Array.isArray(rawData) || rawData.length === 0) return 'unknown';
  const f = rawData[0];
  if (!f || typeof f !== 'object') return 'unknown';
  if ('magnitude' in f) return 'magnitude';
  if ('severity' in f) return 'severity_0_1';
  if ('capacity' in f) return 'MW';
  if ('value' in f) return 'unknown';
  return 'unknown';
}

export async function normalize(rawData, meta) {
  if (!Array.isArray(rawData)) {
    throw new Error(`points.normalize: ожидается массив, получено ${typeof rawData}`);
  }

  await mapperWarmup();

  const points = [];
  const seriesRaw = [];
  const series = [];
  const regionsMap = new Map();
  const unmappedRegions = new Set();
  let skippedInvalidCoords = 0;

  for (const row of rawData) {
    if (!row || typeof row !== 'object') continue;

    const lat = pickNumeric(row, LAT_FIELDS);
    const lon = pickNumeric(row, LON_FIELDS);

    if (!isValidCoords(lat, lon)) {
      skippedInvalidCoords++;
      continue;
    }

    const value = pickNumeric(row, VALUE_FIELDS);
    const label = pickString(row, LABEL_FIELDS);
    const rawRegion = pickString(row, REGION_FIELDS);
    const tsRaw = pickString(row, TS_FIELDS);
    const timestamp = normalizeTimestamp(tsRaw);

    const regionIso3 = resolveRegionKeySync(rawRegion);
    const point = { lat, lon };
    if (value !== null) point.value = value;
    if (label) point.label = label;
    if (regionIso3) point.region = regionIso3;
    else if (rawRegion) point.region = rawRegion;
    if (timestamp) point.timestamp = timestamp;

    const extra = {};
    for (const k of ID_FIELDS) if (row[k] !== undefined) { extra.id = row[k]; break; }
    for (const k of TYPE_FIELDS) if (row[k] !== undefined) { extra.type = row[k]; break; }
    for (const k of STATUS_FIELDS) if (row[k] !== undefined) { extra.status = row[k]; break; }
    if (!regionIso3 && rawRegion) {
      extra.unmapped_region = true;
      extra.unmapped_original = rawRegion;
      unmappedRegions.add(rawRegion);
    }
    if (Object.keys(extra).length > 0) point.extra = extra;

    points.push(point);

    if (timestamp && value !== null) {
      seriesRaw.push({ date: timestamp.slice(0, 10), value, region: regionIso3 || null });
    }

    const regionKey = regionIso3 || rawRegion || 'GLOBAL';
    if (!regionsMap.has(regionKey)) {
      regionsMap.set(regionKey, { region: regionKey, sum: 0, count: 0, max: -Infinity });
    }
    if (value !== null) {
      const agg = regionsMap.get(regionKey);
      agg.sum += value;
      agg.count += 1;
      if (value > agg.max) agg.max = value;
    }
  }

  const uniqueDates = new Set(seriesRaw.map(s => s.date));
  if (uniqueDates.size > 1) {
    for (const s of seriesRaw) {
      const entry = { date: s.date, value: s.value };
      if (s.region) entry.region = s.region;
      series.push(entry);
    }
  }

  const rawMeta = meta || {};
  const valueUnit = rawMeta.value_unit || inferValueUnit(rawData);
  const valueType = deriveValueType(valueUnit);
  const valueRange = rawMeta.value_range !== undefined ? rawMeta.value_range : deriveValueRange(valueUnit);
  const aggregation = rawMeta.aggregation || deriveAggregation(valueType);

  const regions = Array.from(regionsMap.values()).map(a => ({
    region: a.region,
    value: a.count > 0 ? a.sum / a.count : 0,
    count: a.count,
    aggregation: aggregation,
    extra: { max: a.max === -Infinity ? null : a.max, sum: a.sum }
  }));

  return {
    schema: 'crucix.basket.v1',
    count: points.length,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || null,
    value_type: valueType,
    value_range: valueRange,
    series,
    points,
    regions,
    extra: {
      adapter: 'points',
      adapter_version: '2.0.0',
      skipped_invalid_coords: skippedInvalidCoords,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size
    }
  };
}
