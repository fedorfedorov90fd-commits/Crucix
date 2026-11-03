/**
 * apis/sources/legacy-fallback-api.mjs — FALLBACK ДЛЯ СТАРЫХ API
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 *
 * Проблема: старые страницы (dashboard-5in1.html, dashboard-ai.html, etc.)
 * вызывают /api/vix/, /api/dxy/, /api/inflation/ и т.д. — но этих
 * API-модулей нет в v2 (они были legacy, удалены или переименованы).
 *
 * Решение: этот модуль — прокси. Он перехватывает старые пути
 * /api/{name}/ и перенаправляет на /api/layers/{name}.
 *
 * Если /api/layers/{name} существует — отдаёт данные из него.
 * Если нет — отдаёт пустой массив с ошибкой.
 *
 * ЭТО НЕ УДАЛЕНИЕ. Это ремонт: старые страницы продолжают работать,
 * получая данные из новых API.
 *
 * Регистрация: через build-registry.mjs (route = '/api/legacy').
 * Использование: см. router.mjs (legacy-алиасы).
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

export const route  = '/api/legacy';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🔧',
  color: '#f59e0b',
  vizType: 'marker',
  source: 'legacy-fallback',
  cache: 60,
  description: 'Fallback для старых API-путей (перенаправляет на v2)',
  unit: 'legacy',
};

// ─── Маппинг: старый путь → v2 путь ───
const LEGACY_MAP = {
  '/api/vix': '/api/layers/vix',
  '/api/dxy': '/api/layers/dxy',
  '/api/yield-curve': '/api/layers/yield-curve',
  '/api/gold-oil-ratio': '/api/layers/gold-oil-ratio',
  '/api/copper-gold': '/api/layers/copper-gold',
  '/api/bdi': '/api/layers/bdi',
  '/api/viirs': '/api/layers/viirs',
  '/api/uranium': '/api/layers/uranium',
  '/api/big-mac': '/api/layers/big-mac',
  '/api/debt-gdp': '/api/layers/debt-gdp',
  '/api/sp500-vix': '/api/layers/sp500-vix',
  '/api/crypto-fear': '/api/layers/crypto-fear',
  '/api/oil-gas': '/api/layers/oil-gas',
  '/api/gold-silver': '/api/layers/gold-silver',
  '/api/happiness': '/api/layers/happiness',
  '/api/big-mac-alt': '/api/layers/big-mac-alt',
  '/api/big-mac-main': '/api/layers/big-mac-main',
  '/api/vxx': '/api/layers/vxx',
  '/api/happiness-alt': '/api/layers/happiness-alt',
  '/api/inflation': '/api/layers/inflation',
  '/api/unemployment': '/api/layers/unemployment',
  '/api/pmi': '/api/layers/pmi',
  '/api/recession': '/api/layers/recession',
  '/api/tips': '/api/layers/tips',
  '/api/ovx': '/api/layers/ovx',
  '/api/hy-spread': '/api/layers/hy-spread',
  '/api/war-preparation': '/api/layers/war-preparation',
  '/api/consumer-confidence': '/api/layers/consumer-confidence',
  '/api/nuclear-monitor': '/api/layers/nuclear-monitor',
  '/api/social-unrest': '/api/layers/social-unrest',
  '/api/notam': '/api/layers/notam',
  '/api/gps-jamming': '/api/layers/gps-jamming',
  '/api/google-trends': '/api/layers/google-trends',
  '/api/eia': '/api/layers/eia',
  '/api/fred': '/api/layers/fred',
  '/api/bls': '/api/layers/bls',
  '/api/firms': '/api/layers/firms',
  '/api/noaa': '/api/layers/noaa',
  '/api/usgs': '/api/layers/usgs',
  '/api/safecast': '/api/layers/safecast',
  '/api/epa': '/api/layers/epa',
  '/api/who': '/api/layers/who',
  '/api/covid': '/api/layers/covid',
};

// ─── Базовый URL сервера ───
const BASE_URL = process.env.CRUCIX_BASE_URL || 'http://localhost:3117';

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '').replace(/\/$/, '');

  // Если путь не в LEGACY_MAP — ищем по префиксу
  let v2Path = LEGACY_MAP[path];
  if (!v2Path) {
    // Пробуем найти по префиксу (например, /api/vix/stats → /api/layers/vix/stats)
    for (const [oldP, newP] of Object.entries(LEGACY_MAP)) {
      if (path.startsWith(oldP)) {
        v2Path = newP + path.slice(oldP.length);
        break;
      }
    }
  }

  if (!v2Path) {
    res.statusCode = 404;
    return res.end(JSON.stringify({
      error: 'legacy_path_not_mapped',
      path,
      hint: 'Add mapping to LEGACY_MAP in legacy-fallback-api.mjs',
    }));
  }

  try {
    const fullUrl = BASE_URL + v2Path + url.search;
    const response = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Crucix-Legacy-Fallback/1.0' },
    });
    const data = await response.text();
    res.statusCode = response.status;
    res.setHeader('Content-Type', 'application/json');
    return res.end(data);
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message, v2Path }));
  }
}
