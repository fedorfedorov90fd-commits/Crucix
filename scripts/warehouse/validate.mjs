/**
 * scripts/warehouse/validate.mjs
 * Валидатор basket.v1 по JSON Schema (упрощённый, без ajv).
 *
 * Версия 2.0.0 (19.09.2026): добавлены value_type, value_range, aggregation,
 * documents, graph.
 */

const REQUIRED_META = ['id', 'source', 'source_url', 'fetched_at', 'normalized_at', 'collector', 'license', 'count', 'granularity', 'value_unit', 'value_type'];
const VALID_GRANULARITY = ['event', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'snapshot'];
const VALID_LICENSE = ['public-domain', 'cc-by', 'cc-by-sa', 'cc-zero', 'odc-by', 'ogl', 'proprietary', 'unknown'];
const VALID_VALUE_TYPE = ['magnitude', 'severity', 'price', 'ratio', 'index', 'count', 'temperature', 'probability', 'unknown'];
const VALID_AGGREGATION = ['max', 'min', 'mean', 'median', 'sum', 'count', 'first', 'last'];

function isIsoDateTime(s) {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function isIsoDate(s) {
  if (typeof s !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

export function validateBasket(normalized) {
  const errors = [];

  if (!normalized || typeof normalized !== 'object') {
    errors.push({ path: '$', error: 'normalized не объект' });
    return { ok: false, errors };
  }

  // schema
  if (normalized.schema !== 'crucix.basket.v1') {
    errors.push({ path: '$.schema', error: `Ожидается 'crucix.basket.v1', получено '${normalized.schema}'` });
  }

  // meta
  if (!normalized.meta || typeof normalized.meta !== 'object') {
    errors.push({ path: '$.meta', error: 'meta отсутствует или не объект' });
  } else {
    for (const f of REQUIRED_META) {
      if (normalized.meta[f] === undefined || normalized.meta[f] === null) {
        errors.push({ path: `$.meta.${f}`, error: 'обязательное поле отсутствует' });
      }
    }
    if (normalized.meta.fetched_at && !isIsoDateTime(normalized.meta.fetched_at)) {
      errors.push({ path: '$.meta.fetched_at', error: 'не ISO 8601 date-time' });
    }
    if (normalized.meta.normalized_at && !isIsoDateTime(normalized.meta.normalized_at)) {
      errors.push({ path: '$.meta.normalized_at', error: 'не ISO 8601 date-time' });
    }
    if (normalized.meta.granularity && !VALID_GRANULARITY.includes(normalized.meta.granularity)) {
      errors.push({ path: '$.meta.granularity', error: `не в ${VALID_GRANULARITY.join(', ')}` });
    }
    if (normalized.meta.license && !VALID_LICENSE.includes(normalized.meta.license)) {
      errors.push({ path: '$.meta.license', error: `не в ${VALID_LICENSE.join(', ')}` });
    }
    if (normalized.meta.value_type && !VALID_VALUE_TYPE.includes(normalized.meta.value_type)) {
      errors.push({ path: '$.meta.value_type', error: `не в ${VALID_VALUE_TYPE.join(', ')}` });
    }
    if (typeof normalized.meta.count !== 'number' || normalized.meta.count < 0) {
      errors.push({ path: '$.meta.count', error: 'должно быть неотрицательным числом' });
    }
    if (normalized.meta.value_range !== undefined && normalized.meta.value_range !== null) {
      const vr = normalized.meta.value_range;
      if (!Array.isArray(vr) || vr.length !== 2 || typeof vr[0] !== 'number' || typeof vr[1] !== 'number') {
        errors.push({ path: '$.meta.value_range', error: 'должен быть массив из 2 чисел [min, max]' });
      } else if (vr[0] > vr[1]) {
        errors.push({ path: '$.meta.value_range', error: 'min не может быть больше max' });
      }
    }
  }

  // series
  if (!Array.isArray(normalized.series)) {
    errors.push({ path: '$.series', error: 'не массив' });
  } else {
    for (let i = 0; i < normalized.series.length; i++) {
      const s = normalized.series[i];
      if (!s || typeof s !== 'object') {
        errors.push({ path: `$.series[${i}]`, error: 'не объект' });
        continue;
      }
      if (!s.date) errors.push({ path: `$.series[${i}].date`, error: 'отсутствует' });
      else if (!isIsoDate(s.date)) errors.push({ path: `$.series[${i}].date`, error: 'не ISO 8601 date' });
      if (typeof s.value !== 'number') errors.push({ path: `$.series[${i}].value`, error: 'не число' });
    }
  }

  // points
  if (!Array.isArray(normalized.points)) {
    errors.push({ path: '$.points', error: 'не массив' });
  } else {
    for (let i = 0; i < normalized.points.length; i++) {
      const p = normalized.points[i];
      if (!p || typeof p !== 'object') {
        errors.push({ path: `$.points[${i}]`, error: 'не объект' });
        continue;
      }
      if (typeof p.lat !== 'number' || p.lat < -90 || p.lat > 90) {
        errors.push({ path: `$.points[${i}].lat`, error: 'вне диапазона [-90, 90]' });
      }
      if (typeof p.lon !== 'number' || p.lon < -180 || p.lon > 180) {
        errors.push({ path: `$.points[${i}].lon`, error: 'вне диапазона [-180, 180]' });
      }
    }
  }

  // regions
  if (!Array.isArray(normalized.regions)) {
    errors.push({ path: '$.regions', error: 'не массив' });
  } else {
    for (let i = 0; i < normalized.regions.length; i++) {
      const r = normalized.regions[i];
      if (!r || typeof r !== 'object') {
        errors.push({ path: `$.regions[${i}]`, error: 'не объект' });
        continue;
      }
      if (!r.region) errors.push({ path: `$.regions[${i}].region`, error: 'отсутствует' });
      if (typeof r.value !== 'number') errors.push({ path: `$.regions[${i}].value`, error: 'не число' });
      if (r.aggregation !== undefined && r.aggregation !== null && !VALID_AGGREGATION.includes(r.aggregation)) {
        errors.push({ path: `$.regions[${i}].aggregation`, error: `не в ${VALID_AGGREGATION.join(', ')}` });
      }
    }
  }

  // documents (опционально)
  if (normalized.documents !== undefined && normalized.documents !== null) {
    if (!Array.isArray(normalized.documents)) {
      errors.push({ path: '$.documents', error: 'не массив' });
    } else {
      for (let i = 0; i < normalized.documents.length; i++) {
        const d = normalized.documents[i];
        if (!d || typeof d !== 'object') {
          errors.push({ path: `$.documents[${i}]`, error: 'не объект' });
          continue;
        }
        if (!d.id) errors.push({ path: `$.documents[${i}].id`, error: 'отсутствует' });
        if (typeof d.text !== 'string') errors.push({ path: `$.documents[${i}].text`, error: 'не строка' });
      }
    }
  }

  // graph (опционально, может быть null)
  if (normalized.graph !== undefined && normalized.graph !== null) {
    if (typeof normalized.graph !== 'object') {
      errors.push({ path: '$.graph', error: 'не объект' });
    } else {
      if (!Array.isArray(normalized.graph.nodes)) errors.push({ path: '$.graph.nodes', error: 'не массив' });
      if (!Array.isArray(normalized.graph.edges)) errors.push({ path: '$.graph.edges', error: 'не массив' });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function summarizeErrors(errors, maxShow = 5) {
  if (errors.length === 0) return '';
  const shown = errors.slice(0, maxShow).map(e => `  ${e.path}: ${e.error}`).join('\n');
  const more = errors.length > maxShow ? `\n  ... и ещё ${errors.length - maxShow}` : '';
  return `${errors.length} ошибок:\n${shown}${more}`;
}

export const __internal = { isIsoDateTime, isIsoDate };
