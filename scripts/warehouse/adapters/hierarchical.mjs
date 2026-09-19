/**
 * Адаптер hierarchical.
 * Версия 1.0.0. Принят 18.09.2026.
 *
 * Назначение: нормализация объектов с вложенной структурой, где данных
 * нет в виде плоского массива — они лежат в подобъекте ({objects}, {features},
 * {data}, {items}, {rows}). Также сюда попадают объекты-снапшоты.
 *
 * Стратегия: найти первый массив в верхнеуровневых ключах, применить
 * композицию timeseries + points адаптеров (в зависимости от формы элементов).
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

export async function normalize(rawData, meta) {
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
        adapter_version: '1.0.0',
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
      adapter_version: '1.0.0',
      inner_shape: shape,
      inner_array_key: key,
      original_type: Array.isArray(rawData) ? 'array' : 'object'
    }
  };
}
