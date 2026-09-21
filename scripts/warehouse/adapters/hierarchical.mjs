/**
 * Адаптер hierarchical.
 * Версия 1.1.0. Принят 19.09.2026.
 *
 * Назначение: нормализация объектов с вложенной структурой, где данных
 * нет в виде плоского массива — они лежат в подобъекте ({objects}, {features},
 * {data}, {items}, {rows}). Также сюда попадают объекты-снапшоты.
 *
 * Стратегия: найти первый массив в верхнеуровневых ключах, применить
 * композицию timeseries + points адаптеров (в зависимости от формы элементов).
 *
 * Изменение 1.1.0: если rawData — готовый v1-объект {points, series, regions,
 *   documents}, используется напрямую (pass-through). Универсальный принцип.
 *
 * Контракт: export async function normalize(rawData, meta) -> объект.
 */

import { normalize as tsNormalize } from './timeseries.mjs';
import { normalize as ptNormalize } from './points.mjs';

const ARRAY_KEYS = ['objects', 'features', 'data', 'items', 'rows', 'records', 'results', 'values', 'entries', 'countries', 'articles', 'events', 'news', 'list', 'nodes', 'edges'];

function findArray(parsed) {
  if (Array.isArray(parsed)) return { key: null, arr: parsed };
  if (parsed && typeof parsed === 'object') {
    for (const k of ARRAY_KEYS) {
      if (Array.isArray(parsed[k])) return { key: k, arr: parsed[k] };
    }
  }
  return { key: null, arr: null };
}

function detectShape(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'unknown';
  const f = arr[0];
  if (!f || typeof f !== 'object') return 'unknown';
  const hasCoords = ('lat' in f || 'latitude' in f) && ('lon' in f || 'lng' in f || 'longitude' in f);
  const hasDate = 'date' in f || 'timestamp' in f;
  if (hasCoords) return 'points';
  if (hasDate) return 'timeseries';
  return 'regions';
}

// v1.1.0: pass-through готового v1-объекта.
function passThroughV1Object(rawData, rawMeta) {
  const points = Array.isArray(rawData.points) ? rawData.points : [];
  const series = Array.isArray(rawData.series) ? rawData.series : [];
  const regions = Array.isArray(rawData.regions) ? rawData.regions : [];
  const documents = Array.isArray(rawData.documents) ? rawData.documents : [];
  const graph = rawData.graph && typeof rawData.graph === 'object' ? rawData.graph : null;
  const count = points.length + series.length + regions.length + documents.length;
  const result = {
    schema: 'crucix.basket.v1',
    count,
    granularity: rawMeta.granularity || rawData.granularity || 'event',
    value_unit: rawMeta.value_unit || rawData.value_unit || 'unknown',
    value_scale: rawMeta.value_scale || rawData.value_scale || null,
    value_type: rawMeta.value_type || rawData.value_type || 'unknown',
    value_range: rawMeta.value_range !== undefined ? rawMeta.value_range : (rawData.value_range || null),
    series, points, regions,
    extra: {
      adapter: 'hierarchical',
      adapter_version: '1.1.0',
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

  // v1.1.0: ГОТОВЫЙ v1-объект
  if (rawData && !Array.isArray(rawData) && typeof rawData === 'object'
      && (Array.isArray(rawData.points) || Array.isArray(rawData.series) || Array.isArray(rawData.regions))) {
    return passThroughV1Object(rawData, rawMeta);
  }

  const { key, arr } = findArray(rawData);

  if (!arr) {
    // Объект без массива — снапшот. Оборачиваем в одну region-запись.
    return {
      schema: 'crucix.basket.v1',
      count: 0,
      granularity: 'snapshot',
      value_unit: 'unknown',
      value_scale: null,
      series: [],
      points: [],
      regions: [],
      extra: {
        adapter: 'hierarchical',
        adapter_version: '1.1.0',
        original_type: 'object-snapshot',
        original_keys: rawData && typeof rawData === 'object' ? Object.keys(rawData).slice(0, 50) : []
      }
    };
  }

  const shape = detectShape(arr);
  const subMeta = { ...(meta || {}), format_hint: shape };

  let result;
  if (shape === 'points' || shape === 'events') {
    result = await ptNormalize(arr, subMeta);
  } else if (shape === 'timeseries') {
    result = await tsNormalize(arr, subMeta);
  } else {
    result = await tsNormalize(arr, subMeta);
  }

  return {
    ...result,
    extra: {
      ...(result.extra || {}),
      adapter: 'hierarchical',
      adapter_version: '1.1.0',
      inner_shape: shape,
      inner_array_key: key,
      original_type: Array.isArray(rawData) ? 'array' : 'object'
    }
  };
}
