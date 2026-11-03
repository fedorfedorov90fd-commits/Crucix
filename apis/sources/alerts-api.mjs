/**
 * apis/sources/alerts-api.mjs — API-МОДУЛЬ: ЕДИНЫЙ ПОТОК АЛЕРТОВ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/alerts.json — { alerts:[...], meta? } ИЛИ [...].
 * Сборщик: scripts/collectors/collect-alerts.mjs.
 *
 * Алерты — объединение silence + taxonomy-gaps + narrative-framing.
 * Только severity=high идёт в тикер (короткие сообщения).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?severity=, ?type=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                    — корень (все алерты)
 *   GET /stats               — агрегированная статистика
 *   GET /status              — health-check
 *   GET /high                — только severity=high
 *   GET /ticker              — топ-N для бегущей строки (short)
 *   GET /by-type/:type       — фильтр по типу
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'alerts.json');

export const route  = '/api/layers/alerts';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '🚨',
  color: '#ef4444',
  vizType: 'marker',
  source: 'basket/alerts.json',
  collector: 'collect-alerts.mjs',
  cache: 60,
  description: 'Единый поток алертов (silence + taxonomy-gaps + narrative-framing)',
  unit: 'alerts',
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

async function loadBasket() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  try {
    const raw = await fs.readFile(BASKET_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    let alerts = [];
    if (Array.isArray(parsed)) alerts = parsed;
    else if (Array.isArray(parsed.alerts)) alerts = parsed.alerts;

    _cache = {
      schema: parsed.schema || 'crucix.basket.v1',
      meta: parsed.meta || {},
      alerts,
      source: 'basket/alerts.json',
      loaded_at: new Date().toISOString(),
    };
    _cacheTime = now;
    return _cache;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {
        schema: 'crucix.basket.v1',
        meta: { count: 0 },
        alerts: [],
        source: 'basket/alerts.json',
        error: 'not_found',
        hint: 'запустите scripts/collectors/collect-alerts.mjs',
      };
    }
    throw e;
  }
}

function applyFilters(alerts, query) {
  let result = [...alerts];
  if (query.severity) result = result.filter(a => a.severity === query.severity);
  if (query.type) result = result.filter(a => a.type === query.type);
  const limit = parseInt(query.limit, 10) || 100;
  return result.slice(0, limit);
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '') || '/';
  const query = Object.fromEntries(url.searchParams);

  try {
    const data = await loadBasket();

    if (path === '/stats') {
      const bySeverity = {};
      const byType = {};
      for (const a of data.alerts) {
        bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
        byType[a.type] = (byType[a.type] || 0) + 1;
      }
      return res.end(JSON.stringify({
        stats: {
          count: data.alerts.length,
          by_severity: bySeverity,
          by_type: byType,
          count_high: data.alerts.filter(a => a.severity === 'high').length,
        },
        source: data.source,
        meta: data.meta,
      }));
    }

    if (path === '/status') {
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count: data.alerts.length,
        high: data.alerts.filter(a => a.severity === 'high').length,
        source: data.error ? null : data.source,
        hint: data.hint || null,
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/high') {
      const alerts = data.alerts.filter(a => a.severity === 'high');
      return res.end(JSON.stringify({ count: alerts.length, alerts }));
    }

    if (path === '/ticker') {
      const n = parseInt(query.n, 10) || 8;
      const alerts = data.alerts.filter(a => a.severity === 'high').slice(0, n).map(a => ({
        id: a.id,
        type: a.type,
        short: a.short,
        url: a.url,
        severity: a.severity,
      }));
      return res.end(JSON.stringify({ count: alerts.length, alerts }));
    }

    if (path.startsWith('/by-type/')) {
      const type = path.replace('/by-type/', '');
      const alerts = data.alerts.filter(a => a.type === type);
      return res.end(JSON.stringify({ count: alerts.length, alerts }));
    }

    const alerts = applyFilters(data.alerts, query);
    return res.end(JSON.stringify({
      _meta: data.meta,
      count: alerts.length,
      total: data.alerts.length,
      alerts,
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
