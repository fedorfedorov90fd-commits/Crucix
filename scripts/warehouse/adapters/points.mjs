/**
 * Адаптер points.
 * Версия 2.2.1. Принят 20.09.2026.
 *
 * Изменения от 2.2.0:
 *   1. UNWRAP_KEYS расширены: values, measurements, cities, airports, iss.
 *   2. Single-object handler: если найденный ключ вернул объект-не-массив (iss),
 *      оборачивается в [obj].
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

const UNWRAP_KEYS = [
  'data', 'items', 'records', 'rows', 'entries', 'results', 'list',
  'series', 'history', 'observations', 'points', 'daily', 'hourly',
  'vessels', 'aircraft', 'ports', 'alerts', 'indicators', 'objects',
  'satellites', 'ships', 'fires', 'events', 'regions', 'markers',
  'values', 'measurements', 'cities', 'airports', 'iss'
];

function unwrapWrapper(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return null;

  for (const key of UNWRAP_KEYS) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0) {
      return { array: v, via: key, nested: false };
    }
    if (v && typeof v === 'object' && Array.isArray(v) === false) {
      const subArrays = [];
      let hasSubArrays = false;
      for (const subKey of Object.keys(v)) {
        if (Array.isArray(v[subKey]) && v[subKey].length > 0) {
          hasSubArrays = true;
          for (const el of v[subKey]) {
            if (el && typeof el === 'object' && el.__group === undefined) {
              subArrays.push({ ...el, __group: subKey });
            } else {
              subArrays.push(el);
            }
          }
        }
      }
      if (hasSubArrays && subArrays.length > 0) {
        return { array: subArrays, via: key, nested: true };
      }
      if (Object.keys(v).length > 0) {
        return { array: [{ ...v, __key: key }], via: key, nested: false, single: true };
      }
    }
  }
  return null;
}

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
    if (Number.isNaN(d.getTime()) === false) return d.toISOString();
  }
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime()) === false) return d.toISOString();
  }
  return null;
}

function isValidCoords(lat, lon) {
  if (lat === null || lon === null) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  if (lat === 0 && lon === 0) return false;
  return true;
}

function deriveValueType(valueUnit) {
  if (valueUnit === undefined || valueUnit === null) return 'unknown';
  const map = {
    'magnitude': 'magnitude', 'severity_0_1': 'severity', 'severity_0_10': 'severity',
    'percent': 'ratio', 'USD': 'price', 'EUR': 'price', 'index': 'index',
    'count': 'count', 'ratio': 'ratio', 'MW': 'count', 'meters': 'count',
    'events_per_day': 'count', 'temperature': 'temperature', 'probability': 'probability',
    'unknown': 'unknown'
  };
  return map[valueUnit] || 'unknown';
}

function deriveValueRange(valueUnit) {
  if (valueUnit === undefined || valueUnit === null) return null;
  const map = {
    'magnitude': [0, 10], 'severity_0_1': [0, 1], 'severity_0_10': [0, 10],
    'percent': [0, 100], 'probability': [0, 1]
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
  if (Array.isArray(rawData) === false || rawData.length === 0) return 'unknown';
  const f = rawData[0];
  if (!f || typeof f !== 'object') return 'unknown';
  if ('magnitude' in f) return 'magnitude';
  if ('severity' in f) return 'severity_0_1';
  if ('capacity' in f) return 'MW';
  if ('value' in f) return 'unknown';
  return 'unknown';
}

function passThroughV1Object(rawData, rawMeta) {
  const points = Array.isArray(rawData.points) ? rawData.points : [];
  const series = Array.isArray(rawData.series) ? rawData.series : [];
  const regions = Array.isArray(rawData.regions) ? rawData.regions : [];
  const documents = Array.isArray(rawData.documents) ? rawData.documents : [];
  const graph = rawData.graph && typeof rawData.graph === 'object' ? rawData.graph : null;
  const count = points.length + series.length + regions.length + documents.length;

  const valueUnit = rawMeta.value_unit || rawData.value_unit || 'unknown';
  const valueType = rawMeta.value_type || rawData.value_type || deriveValueType(valueUnit);
  const valueRange = rawMeta.value_range !== undefined ? rawMeta.value_range
    : (rawData.value_range !== undefined ? rawData.value_range : deriveValueRange(valueUnit));
  const aggregation = rawMeta.aggregation || rawData.aggregation || deriveAggregation(valueType);
  const granularity = rawMeta.granularity || rawData.granularity || 'event';

  const result = {
    schema: 'crucix.basket.v1',
    count,
    granularity,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || rawData.value_scale || null,
    value_type: valueType,
    value_range: valueRange,
    series,
    points,
    regions: regions.map(r => ({ ...r, aggregation: r.aggregation || aggregation })),
    extra: {
      adapter: 'points',
      adapter_version: '2.2.1',
      passthrough_v1: true,
      series_count: series.length,
      points_count: points.length,
      regions_count: regions.length
    }
  };
  if (documents.length > 0) result.documents = documents;
  if (graph) result.graph = graph;
  if (rawData.extra && typeof rawData.extra === 'object') Object.assign(result.extra, rawData.extra);
  return result;
}

export async function normalize(rawData, meta) {
  const rawMeta = meta || {};

  if (rawData && Array.isArray(rawData) === false && typeof rawData === 'object'
      && (Array.isArray(rawData.points) || Array.isArray(rawData.series) || Array.isArray(rawData.regions))) {
    return passThroughV1Object(rawData, rawMeta);
  }

  if (rawData && Array.isArray(rawData) === false && typeof rawData === 'object') {
    const unwrapped = unwrapWrapper(rawData);
    if (unwrapped) {
      console.warn('[points] unwrapWrapper: ключ "' + unwrapped.via + '", элементов: ' + unwrapped.array.length + (unwrapped.nested ? ' (вложенный)' : '') + (unwrapped.single ? ' (single-object)' : ''));
      rawData = unwrapped.array;
    }
  }

  if (Array.isArray(rawData) === false) {
    const keys = rawData && typeof rawData === 'object' ? Object.keys(rawData).join(',') : String(typeof rawData);
    throw new Error('points.normalize: ожидается массив точек, v1-объект или объект-обёртка, получено объект с ключами [' + keys + ']');
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

    if (isValidCoords(lat, lon) === false) {
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
    if (row.__group !== undefined) extra.__group = row.__group;
    if (row.__key !== undefined) extra.__key = row.__key;
    if (regionIso3 === null && rawRegion) {
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
    if (regionsMap.has(regionKey) === false) {
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

  const valueUnit = rawMeta.value_unit || inferValueUnit(rawData);
  const valueType = rawMeta.value_type || deriveValueType(valueUnit);
  const valueRange = rawMeta.value_range !== undefined ? rawMeta.value_range : deriveValueRange(valueUnit);
  const aggregation = rawMeta.aggregation || deriveAggregation(valueType);
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
    count: points.length,
    granularity,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || null,
    value_type: valueType,
    value_range: valueRange,
    series,
    points,
    regions,
    extra: {
      adapter: 'points',
      adapter_version: '2.2.1',
      skipped_invalid_coords: skippedInvalidCoords,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size
    }
  };
}
