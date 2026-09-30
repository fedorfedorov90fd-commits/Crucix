/**
 * Адаптер regions.
 * Версия 2.1.0. Принят 19.09.2026.
 *
 * Назначение: нормализация источников с региональными агрегатами без
 * временного ряда. Формат сырья: массив объектов с полем region|country
 * + числовое поле (value, count, score).
 *
 * ВЕРСИЯ 2.0.0 использует ЕДИНЫЙ справочник data/reference/countries.json
 * (собран из country-characteristics, country-coords, country-aliases и alpha-2).
 * Одна карта by_alias_lower — для всех видов входных данных.
 *
 * Если регион распознан в ISO3 и у страны есть центроид — добавляется точка.
 *
 * Изменение 2.1.0: passThroughV1Object для готовых v1-объектов.
 * Универсальный принцип: адаптер НЕ теряет данные.
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


// Порядок важен: сначала специфичные коды стран, потом названия, и только в конце — общий region.
// Иначе поле region='Asia' перекрывает iso3='AFG'.
const REGION_FIELDS = ['iso3', 'iso_a3', 'country_code', 'country', 'name', 'nameRu', 'area', 'location', 'region'];
const VALUE_FIELDS = ['value', 'count', 'score', 'index', 'amount', 'risk', 'baseRisk'];

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

// v2.1.0: pass-through готового v1-объекта.
function passThroughV1Object(rawData, rawMeta) {
  const points = Array.isArray(rawData.points) ? rawData.points : [];
  const series = Array.isArray(rawData.series) ? rawData.series : [];
  const regions = Array.isArray(rawData.regions) ? rawData.regions : [];
  const documents = Array.isArray(rawData.documents) ? rawData.documents : [];
  const graph = rawData.graph && typeof rawData.graph === 'object' ? rawData.graph : null;
  const count = points.length + series.length + regions.length + documents.length;
  const valueUnit = rawMeta.value_unit || rawData.value_unit || 'index';
  const valueType = rawMeta.value_type || rawData.value_type || 'index';
  const granularity = rawMeta.granularity || rawData.granularity || 'snapshot';
  const aggregation = rawMeta.aggregation || rawData.aggregation || 'mean';
  const result = {
    schema: 'crucix.basket.v1',
    count, granularity,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || rawData.value_scale || null,
    value_type: valueType,
    value_range: rawMeta.value_range !== undefined ? rawMeta.value_range : (rawData.value_range || null),
    series, points,
    regions: regions.map(r => ({ ...r, aggregation: r.aggregation || aggregation })),
    extra: {
      adapter: 'regions',
      adapter_version: '2.1.0',
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

  // v2.1.0: ГОТОВЫЙ v1-объект
  if (rawData && !Array.isArray(rawData) && typeof rawData === 'object'
      && (Array.isArray(rawData.points) || Array.isArray(rawData.series) || Array.isArray(rawData.regions))) {
    return passThroughV1Object(rawData, rawMeta);
  }

  if (!Array.isArray(rawData)) {
    throw new Error(`regions.normalize: ожидается массив или v1-объект, получено ${typeof rawData}`);
  }

  const countries = await mapperWarmup();

  const regions = [];
  const points = [];
  const unmappedRegions = new Set();
  let skipped = 0;
  let pointsFromCentroids = 0;

  const valueUnit = rawMeta.value_unit || 'index';
  const valueTypeMap = {
    'magnitude': 'magnitude', 'severity_0_1': 'severity', 'severity_0_10': 'severity',
    'percent': 'ratio', 'USD': 'price', 'EUR': 'price',
    'index': 'index', 'count': 'count', 'ratio': 'ratio'
  };
  const valueType = valueTypeMap[valueUnit] || 'unknown';
  const valueRangeMap = {
    'magnitude': [0, 10], 'severity_0_1': [0, 1], 'severity_0_10': [0, 10], 'percent': [0, 100]
  };
  const valueRange = rawMeta.value_range !== undefined ? rawMeta.value_range : (valueRangeMap[valueUnit] || null);
  const aggregation = rawMeta.aggregation || (valueType === 'magnitude' || valueType === 'severity' ? 'max' : valueType === 'count' ? 'sum' : 'mean');
  for (const row of rawData) {
    if (!row || typeof row !== 'object') continue;

    const rawRegion = pickString(row, REGION_FIELDS);
    const value = pickNumeric(row, VALUE_FIELDS);

    if (!rawRegion || value === null) {
      skipped++;
      continue;
    }

    const regionIso3 = resolveRegionKeySync(rawRegion);
    const key = regionIso3 || rawRegion;
    const entry = {
      region: key,
      value,
      count: pickNumeric(row, ['count', 'events', 'total']) || 1,
      aggregation: aggregation
    };

    const extra = {};
    for (const k of ['regime', 'tier', 'region', 'multiplier', 'baseRisk']) {
      if (row[k] !== undefined) extra[k] = row[k];
    }
    if (!regionIso3) {
      extra.unmapped_region = true;
      extra.unmapped_original = rawRegion;
      unmappedRegions.add(rawRegion);
    }
    if (Object.keys(extra).length > 0) entry.extra = extra;

    regions.push(entry);

    // Point в центроиде страны, если регион распознан
    if (regionIso3) {
      const info = getCountrySync(regionIso3);
      if (info && info.centroid && typeof info.centroid.lat === 'number' && typeof info.centroid.lon === 'number') {
        points.push({
          lat: info.centroid.lat, lon: info.centroid.lon,
          value,
          label: key,
          region: regionIso3
        });
        pointsFromCentroids++;
      }
    }
  }

  return {
    schema: 'crucix.basket.v1',
    count: regions.length,
    granularity: 'snapshot',
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || null,
    value_type: valueType,
    value_range: valueRange,
    series: [],
    points,
    regions,
    extra: {
      adapter: 'regions',
      adapter_version: '2.1.0',
      skipped_rows: skipped,
      points_from_centroids: pointsFromCentroids,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size
    }
  };
}
