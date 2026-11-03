/**
 * apis/sources/recession-api.mjs — API-МОДУЛЬ: recession
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/recession.json
 * Сборщик: scripts/collectors/collect-recession.mjs.
 *
 * Автосозданный fallback-API для recession.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'recession.json');

export const route  = '/api/layers/recession';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '⚠️',
  color: '#ef4444',
  vizType: 'choropleth',
  source: 'basket/recession.json',
  collector: 'collect-recession.mjs',
  cache: 120,
  description: 'recession (автосозданный API)',
  unit: 'value',
};

let _cache = null;
let _cacheTime = 0;

async function loadBasket() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < 2 * 60 * 1000) return _cache;

  try {
    const raw = await fs.readFile(BASKET_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    _cache = { data: parsed, loaded_at: new Date().toISOString() };
    _cacheTime = now;
    return _cache;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { data: null, error: 'not_found', hint: 'запустите collect-recession.mjs' };
    }
    throw e;
  }
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '') || '/';

  try {
    const data = await loadBasket();

    if (path === '/status') {
      const count = Array.isArray(data.data?.series) ? data.data.series.length
                   : Array.isArray(data.data) ? data.data.length : 0;
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count,
        source: 'basket/recession.json',
        hint: data.hint || null,
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/stats') {
      const d = data.data || {};
      const series = Array.isArray(d.series) ? d.series : [];
      return res.end(JSON.stringify({
        stats: {
          count: series.length,
          date_from: d.meta?.date_from || null,
          date_to: d.meta?.date_to || null,
        },
        source: 'basket/recession.json',
      }));
    }

    // Корень — отдаём данные как есть
    if (data.data) {
      return res.end(JSON.stringify(data.data));
    }

    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'not_found', path }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
