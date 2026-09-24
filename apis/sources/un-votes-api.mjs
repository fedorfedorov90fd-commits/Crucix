/**
 * apis/sources/un-votes-api.mjs — API-МОДУЛЬ: ГОЛОСОВАНИЯ ООН
 *
 * КОНТРАКТ CRUCIX v2.
 * Версия 1.0.0. Принят 23.09.2026.
 *
 * ИСТОЧНИК: data/basket/un-votes.json — схема crucix.basket.v1.
 * Сборщик: scripts/collectors/collect-un-votes.mjs.
 *
 * Роль: отдаёт ideal points стран ООН (ось "запад ↔ остальные") для
 * choropleth-карты. Положительные значения = западный блок, отрицательные = другой.
 *
 * Форматы: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * Фильтры: ?iso3=, ?min=, ?max=, ?session=, ?top=, ?limit=.
 *
 * Эндпоинты:
 *   GET /               — корень (json по умолчанию)
 *   GET /stats          — агрегированная статистика
 *   GET /series         — временной ряд среднего ideal point
 *   GET /latest         — только последняя сессия
 *   GET /status         — health-check
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'un-votes.json');

export const route  = '/api/layers/un-votes';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '🗳️',
  color: '#4a90d9',
  vizType: 'choropleth',
  source: 'basket/un-votes.json',
  collector: 'collect-un-votes.mjs',
  cache: 3600,
  description: 'Голосования ГА ООН (ideal points, Erik Voeten dataset) — ось запад↔остальные',
  unit: 'ideal_point',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Module': 'un-votes-api',
    'X-Module-Version': '1.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
  });
  res.end(JSON.stringify(obj));
}

function sendText(res, code, text, ct) {
  res.writeHead(code, {
    'Content-Type': ct,
    'X-Module': 'un-votes-api',
    'X-Module-Version': '1.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
  });
  res.end(text);
}

async function loadData() {
  const raw = await fs.readFile(BASKET_FILE, 'utf8');
  const d = JSON.parse(raw);
  if (!d || d.schema !== 'crucix.basket.v1') {
    const err = new Error('unrecognized_basket_format: ожидался schema crucix.basket.v1');
    err.statusCode = 500;
    throw err;
  }
  return d;
}

function toFeatureCollection(data, options = {}) {
  let regions = [...(data.regions || [])];
  if (options.iso3) regions = regions.filter(r => String(r.region).toLowerCase().includes(options.iso3.toLowerCase()));
  if (options.min != null) regions = regions.filter(r => r.value >= options.min);
  if (options.max != null) regions = regions.filter(r => r.value <= options.max);
  regions.sort((a, b) => b.value - a.value);
  if (options.top) regions = regions.slice(0, options.top);
  if (options.limit) regions = regions.slice(0, options.limit);

  // Диапазон ideal point для нормализации цвета
  const values = regions.map(r => r.value).filter(Number.isFinite);
  const minVal = values.length ? Math.min(...values) : -3;
  const maxVal = values.length ? Math.max(...values) : 3;

  const features = regions.map(r => ({
    type: 'Feature',
    geometry: null, // choropleth — заливка полигонов по свойствам
    properties: {
      iso3: r.region,
      country: r.country || null,
      value: r.value,
      session: r.session,
      n_votes: r.n_votes,
      state_abb: r.state_abb || null,
      block: r.value > 0.5 ? 'west' : r.value < -0.5 ? 'other' : 'neutral',
      min: minVal,
      max: maxVal,
      issuer: 'US-OFAC',
      source: 'Voeten-UNGA',
    },
  }));

  return {
    type: 'FeatureCollection',
    metadata: {
      module: 'un-votes-api',
      source: 'Erik Voeten UNGA Ideal Points',
      latest_session: data.latest_session,
      total_countries: regions.length,
      min_value: minVal,
      max_value: maxVal,
      generated_at: new Date().toISOString(),
    },
    features,
  };
}

function toStats(data) {
  const regions = data.regions || [];
  const series = data.series || [];
  const values = regions.map(r => r.value).filter(Number.isFinite);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const west = regions.filter(r => r.value > 0.5).length;
  const other = regions.filter(r => r.value < -0.5).length;
  const neutral = regions.length - west - other;
  const top10 = [...regions].sort((a, b) => b.value - a.value).slice(0, 10);
  const bottom10 = [...regions].sort((a, b) => a.value - b.value).slice(0, 10);
  return {
    module: 'un-votes-api',
    source: 'Erik Voeten UNGA Ideal Points',
    latest_session: data.latest_session,
    total_countries: regions.length,
    total_sessions: series.length,
    mean_ideal_point: Math.round(mean * 10000) / 10000,
    blocks: { west, other, neutral },
    top_west: top10.map(r => ({ iso3: r.region, country: r.country, value: r.value })),
    top_other: bottom10.map(r => ({ iso3: r.region, country: r.country, value: r.value })),
    generated_at: new Date().toISOString(),
  };
}

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    if (path.endsWith('/status')) {
      return sendJSON(res, 200, {
        module: 'un-votes-api',
        version: '1.0.0',
        status: 'ok',
        basket_file: 'data/basket/un-votes.json',
      });
    }

    let data;
    try {
      data = await loadData();
    } catch (e) {
      return sendJSON(res, 503, {
        error: 'no_data',
        message: e.message,
        hint: 'run scripts/collectors/collect-un-votes.mjs && node scripts/warehouse/managerbasket.mjs',
      });
    }

    if (path.endsWith('/stats')) {
      return sendJSON(res, 200, toStats(data));
    }

    if (path.endsWith('/series')) {
      const session = parseInt(query.session, 10);
      let series = data.series || [];
      if (Number.isFinite(session)) series = series.filter(s => s.session === session);
      return sendJSON(res, 200, {
        module: 'un-votes-api',
        series,
        total: series.length,
      });
    }

    if (path.endsWith('/latest')) {
      const latestSession = data.latest_session;
      const regions = (data.regions || []).filter(r => r.session === latestSession);
      return sendJSON(res, 200, toFeatureCollection({ ...data, regions }, {
        top: parseInt(query.top, 10) || 0,
        limit: parseInt(query.limit, 10) || 0,
      }));
    }

    const format = (query.format || 'json').toLowerCase();

    if (format === 'csv') {
      const rows = [...(data.regions || [])].sort((a, b) => b.value - a.value);
      const csv = ['iso3,country,session,ideal_point,n_votes', ...rows.map(r =>
        `"${r.region}","${(r.country || '').replace(/"/g, '""')}",${r.session},${r.value},${r.n_votes}`
      )].join('\n');
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }

    if (format === 'series') {
      return sendJSON(res, 200, { module: 'un-votes-api', series: data.series });
    }

    if (format === 'stats') {
      return sendJSON(res, 200, toStats(data));
    }

    if (format === 'raw') {
      return sendJSON(res, 200, data);
    }

    // json (по умолчанию)
    const fc = toFeatureCollection(data, {
      iso3: query.iso3,
      min: query.min != null ? parseFloat(query.min) : null,
      max: query.max != null ? parseFloat(query.max) : null,
      top: parseInt(query.top, 10) || 0,
      limit: parseInt(query.limit, 10) || 0,
    });
    fc.series = data.series;
    fc.stats = toStats(data);
    return sendJSON(res, 200, fc);

  } catch (e) {
    const code = e.statusCode || 500;
    return sendJSON(res, code, { error: 'internal_error', message: e.message });
  }
}
