/**
 * Адаптер timeseries.
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

const VALUE_FIELDS = ['magnitude', 'value', 'count', 'index', 'amount', 'close', 'price', 'ships', 'fires', 'events', 'alerts', 'incidents', 'cases', 'deaths', 'casualties', 'fatalities', 'score'];
const DATE_FIELDS = ['date', 'timestamp', 'time', 'datetime'];
const REGION_FIELDS = ['region', 'country', 'area', 'location'];
const EXTRA_NUMERIC_FIELDS = ['depth', 'severity', 'intensity', 'temperature', 'wind', 'precipitation', 'frp', 'confidence', 'brightness', 'fatalities', 'casualties', 'deaths', 'gold', 'oil', 'ratio', 'open', 'high', 'low', 'volume', 'change', 'score', 'count'];
const SKIP_FIELDS = new Set(['date', 'timestamp', 'time', 'datetime', 'value', 'magnitude', 'count', 'index', 'amount', 'close', 'price', 'region', 'country', 'area', 'location', 'lat', 'lon', 'lng']);

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
    if (Number.isNaN(d.getTime()) === false) {
      const iso = d.toISOString();
      return iso.length >= 10 ? iso.slice(0, 10) : iso;
    }
  }
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime()) === false) {
      const iso = d.toISOString();
      return iso.length >= 10 ? iso.slice(0, 10) : iso;
    }
  }
  return null;
}

function deriveValueType(valueUnit) {
  if (valueUnit === undefined || valueUnit === null) return 'unknown';
  const norm = String(valueUnit).toLowerCase();
  const map = {
    'magnitude': 'magnitude', 'severity_0_1': 'severity', 'severity_0_10': 'severity',
    'percent': 'ratio', 'usd': 'price', 'eur': 'price', 'index': 'index',
    'count': 'count', 'ratio': 'ratio', 'mw': 'count', 'meters': 'count',
    'events_per_day': 'count', 'temperature': 'temperature', 'probability': 'probability',
    'unknown': 'unknown'
  };
  return map[norm] || 'unknown';
}

function deriveValueRange(valueUnit) {
  if (valueUnit === undefined || valueUnit === null) return null;
  const norm = String(valueUnit).toLowerCase();
  const map = {
    'magnitude': [0, 10], 'severity_0_1': [0, 1], 'severity_0_10': [0, 10],
    'percent': [0, 100], 'probability': [0, 1]
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
  if (Array.isArray(rawData) === false || rawData.length === 0) return 'unknown';
  const first = rawData[0];
  if (!first || typeof first !== 'object') return 'unknown';
  if ('magnitude' in first) return 'magnitude';
  if ('severity' in first) return 'severity_0_1';
  if ('value' in first) return 'unknown';
  return 'unknown';
}

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
    count, granularity,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || rawData.value_scale || null,
    value_type: valueType,
    value_range: valueRange,
    series,
    points,
    regions: regions.map(r => ({ ...r, aggregation: r.aggregation || aggregation })),
    extra: {
      adapter: 'timeseries',
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
      console.warn('[timeseries] unwrapWrapper: ключ "' + unwrapped.via + '", элементов: ' + unwrapped.array.length + (unwrapped.nested ? ' (вложенный)' : '') + (unwrapped.single ? ' (single-object)' : ''));
      rawData = unwrapped.array;
    }
  }

  if (Array.isArray(rawData) === false) {
    const keys = rawData && typeof rawData === 'object' ? Object.keys(rawData).join(',') : String(typeof rawData);
    throw new Error('timeseries.normalize: ожидается массив, v1-объект или объект-обёртка, получено объект с ключами [' + keys + ']');
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

    const usedKeys = new Set();
    if (valuePick) usedKeys.add(valuePick.key);
    if (datePick) usedKeys.add(datePick.key);
    if (regionPick) usedKeys.add(regionPick.key);

    const extra = collectExtraFields(row, usedKeys);

    for (const f of EXTRA_NUMERIC_FIELDS) {
      if (row[f] !== undefined && row[f] !== null && extra[f] === undefined) {
        const n = toNumber(row[f]);
        if (n !== null) extra[f] = n;
      }
    }

    if (regionIso3 === null && regionRaw) {
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

    if (regionIso3) {
      const info = getCountrySync(regionIso3);
      if (info && info.centroid && typeof info.centroid.lat === 'number' && typeof info.centroid.lon === 'number') {
        const point = {
          lat: info.centroid.lat, lon: info.centroid.lon,
          value,
          label: valuePick.key + '=' + value,
          region: regionIso3
        };
        if (date) point.timestamp = date + 'T00:00:00Z';
        points.push(point);
      }
    }

    const regionKey = regionIso3 || regionRaw || 'GLOBAL';
    if (regionsMap.has(regionKey) === false) {
      regionsMap.set(regionKey, { region: regionKey, sum: 0, count: 0, max: -Infinity });
    }
    const agg = regionsMap.get(regionKey);
    agg.sum += value;
    agg.count += 1;
    if (value > agg.max) agg.max = value;
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
      adapter_version: '2.2.1',
      unique_dates: uniqueDates.size,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size
    }
  };
}
