/**
 * apis/sources/lib/basket-legacy.mjs — LEGACY COMPATIBILITY LAYER
 *
 * НЕ API-МОДУЛЬ. Утилита. Используется basket-loader.mjs.
 *
 * Назначение: превращать старый формат basket (до контракта v1) в
 * v1-совместимый на лету. Нужно, чтобы старые API-модули (написанные
 * под плоский массив) продолжали работать, пока сборщики переводятся
 * на запись в data/raw/ и нормализацию через managerbasket.
 *
 * Контракт: export function wrapLegacy(parsed) -> объект basket.v1
 *
 * Возвращаемая структура: {schema, meta, series, points, regions, extra}
 * Старые модули читают .data — но basket-loader сохранит .data как
 * поле внутри meta, чтобы ничего не сломать. См. basket-loader.mjs.
 *
 * Обработка форматов сырья (старый basket):
 *   1. Плоский массив [{lat, lng|lon, value, ...}] → points + series + regions
 *   2. Плоский массив [{date, value, ...}]         → series + regions
 *   3. Плоский массив [{region, value, ...}]       → regions
 *   4. Объект {data: [...]} / {values: [...]}      → обёртка, рекурсия
 *   5. Объект {features: [...]}                    → points (GeoJSON-подобное)
 *   6. Объект без распознаваемых массивов          → extra, пустой series/points/regions
 */

export const LEGACY_SCHEMA = 'crucix.basket.legacy.v1';

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

function pickNumberRaw(obj, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
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
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      return iso.length >= 10 ? iso.slice(0, 10) : iso;
    }
  }
  return null;
}

const VALUE_FIELDS = ['value', 'magnitude', 'severity', 'count', 'index', 'amount', 'close', 'price', 'vix'];
const REGION_FIELDS = ['region', 'country', 'area', 'location'];
const LAT_FIELDS = ['lat', 'latitude'];
const LON_FIELDS = ['lon', 'lng', 'longitude'];
const DATE_FIELDS = ['date', 'timestamp', 'time', 'datetime', 'ts'];

function makeMeta({ count, valueUnit, granularity }) {
  return {
    id: 'legacy',
    source: 'legacy basket',
    source_url: '',
    fetched_at: new Date().toISOString(),
    normalized_at: new Date().toISOString(),
    collector: 'unknown',
    license: 'unknown',
    count: count || 0,
    granularity: granularity || 'event',
    value_unit: valueUnit || 'unknown'
  };
}

function classifyArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { hasCoords: false, hasDate: false, hasRegion: false, hasValue: false };
  }
  const f = arr[0];
  if (!f || typeof f !== 'object') {
    return { hasCoords: false, hasDate: false, hasRegion: false, hasValue: false };
  }
  return {
    hasCoords: pickNumberRaw(f, LAT_FIELDS) !== null && pickNumberRaw(f, LON_FIELDS) !== null,
    hasDate: pickString(f, DATE_FIELDS) !== null,
    hasRegion: pickString(f, REGION_FIELDS) !== null,
    hasValue: pickNumeric(f, VALUE_FIELDS) !== null
  };
}

function arrToPointsSeriesRegions(arr) {
  const shape = classifyArray(arr);
  const series = [];
  const points = [];
  const regionsMap = new Map();

  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const value = pickNumeric(row, VALUE_FIELDS);
    const region = pickString(row, REGION_FIELDS);

    if (shape.hasDate) {
      const dateStr = pickString(row, DATE_FIELDS);
      const date = normalizeDate(dateStr);
      const entry = { date: date || dateStr || 'unknown', value: value === null ? 0 : value };
      if (region) entry.region = region;
      series.push(entry);
    }

    if (shape.hasCoords) {
      const lat = pickNumberRaw(row, LAT_FIELDS);
      const lon = pickNumberRaw(row, LON_FIELDS);
      if (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const label = pickString(row, ['label', 'title', 'name', 'description']);
        points.push({ lat, lon, value: value === null ? 1 : value, label: label || null, region: region || null });
      }
    }

    if (region) {
      const key = region;
      if (!regionsMap.has(key)) {
        regionsMap.set(key, { region: key, sum: 0, count: 0, max: -Infinity });
      }
      const agg = regionsMap.get(key);
      const v = value === null ? 0 : value;
      agg.sum += v;
      agg.count += 1;
      if (v > agg.max) agg.max = v;
    }
  }

  const regions = Array.from(regionsMap.values()).map(a => ({
    region: a.region,
    value: a.count > 0 ? a.sum / a.count : 0,
    count: a.count,
    extra: { max: a.max === -Infinity ? null : a.max, sum: a.sum }
  }));

  const valueUnit = inferValueUnit(arr);
  const meta = makeMeta({
    count: arr.length,
    valueUnit,
    granularity: shape.hasDate ? 'event' : 'snapshot'
  });

  return { meta, series, points, regions };
}

function inferValueUnit(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'unknown';
  const f = arr[0];
  if (!f || typeof f !== 'object') return 'unknown';
  if ('magnitude' in f) return 'magnitude';
  if ('severity' in f) return 'severity_0_1';
  if ('vix' in f) return 'index';
  if ('price' in f || 'close' in f) return 'USD';
  if ('value' in f) return 'unknown';
  return 'unknown';
}

export function wrapLegacy(parsed) {
  const now = new Date().toISOString();

  // Уже v1 — не трогаем.
  if (parsed && typeof parsed === 'object' && parsed.schema === 'crucix.basket.v1') {
    return parsed;
  }

  // Плоский массив — самая частая форма старого basket.
  if (Array.isArray(parsed)) {
    const { meta, series, points, regions } = arrToPointsSeriesRegions(parsed);
    return {
      schema: 'crucix.basket.v1',
      meta,
      series,
      points,
      regions,
      extra: { legacy: true, legacy_original_type: 'array', wrapped_at: now }
    };
  }

  // Объект. Ищем распознаваемый массив внутри.
  if (parsed && typeof parsed === 'object') {
    const arrayKey = ['data', 'values', 'items', 'features', 'rows', 'records', 'results'].find(k => Array.isArray(parsed[k]));
    if (arrayKey) {
      const arr = parsed[arrayKey];
      const { meta, series, points, regions } = arrToPointsSeriesRegions(arr);
      return {
        schema: 'crucix.basket.v1',
        meta: { ...meta, extra_meta: { legacy_array_key: arrayKey } },
        series,
        points,
        regions,
        extra: { legacy: true, legacy_original_type: 'object', legacy_array_key: arrayKey, wrapped_at: now }
      };
    }

    // Объект-снапшот без массива — превращаем в одну точку региона.
    const value = pickNumeric(parsed, VALUE_FIELDS);
    const region = pickString(parsed, REGION_FIELDS);
    const series = value === null ? [] : [{ date: now.slice(0, 10), value, region: region || undefined }];
    const regions = (region && value !== null) ? [{ region, value, count: 1 }] : [];
    return {
      schema: 'crucix.basket.v1',
      meta: makeMeta({ count: series.length, valueUnit: inferValueUnit([parsed]), granularity: 'snapshot' }),
      series,
      points: [],
      regions,
      extra: { legacy: true, legacy_original_type: 'object-snapshot', original_keys: Object.keys(parsed).slice(0, 50), wrapped_at: now }
    };
  }

  // Примитив (строка, число, null).
  return {
    schema: 'crucix.basket.v1',
    meta: makeMeta({ count: 0, valueUnit: 'unknown', granularity: 'snapshot' }),
    series: [],
    points: [],
    regions: [],
    extra: { legacy: true, legacy_original_type: typeof parsed, wrapped_at: now }
  };
}
