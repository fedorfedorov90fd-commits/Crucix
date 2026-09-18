/**
 * apis/sources/lenses-api.mjs — SERVICE-МОДУЛЬ: ТЕМАТИЧЕСКИЕ ЛИНЗЫ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: data/config/lenses.json (если есть) ИЛИ встроенный DEFAULT_LENSES (fallback).
 *
 * Тематические линзы — предустановленные конфигурации отображения:
 * наборы модулей и панелей для быстрого переключения между сценариями
 * (геополитика, экономика, безопасность, технологии).
 *
 * ЭНДПОИНТЫ:
 *   GET /              — корень (список эндпоинтов + версия)
 *   GET /status        — health-check
 *   GET /list          — все линзы
 *   GET /current       — текущая линза (по умолчанию первая)
 *   GET /get/:id       — конкретная линза
 *   GET /categories    — группировка по категориям
 *   GET /search?q=     — поиск по названию/описанию
 *   GET /modules       — все модули всех линз (уникально)
 *   GET /raw           — сырое содержимое файла
 *
 * ФОРМАТ: JSON.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const CONFIG_FILE = join(PROJECT_ROOT, 'data', 'config', 'lenses.json');

export const route  = '/api/services/lenses';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Lenses service: preset thematic view configurations (geopolitics, economy, security, tech). Manage which modules are visible per scenario.',
  cache: 60,
  version: '2.0.0',
};

// Встроенный fallback (используется если нет data/config/lenses.json)
const DEFAULT_LENSES = [
  { id: 'geopolitics', name: '🌍 Геополитика', description: 'Фокус на геополитических событиях и аналитике',
    modules: ['geo-map', 'global-index', 'early-warning'],
    panels: ['conflicts', 'diplomacy', 'sanctions'] },
  { id: 'economy', name: '📊 Экономика', description: 'Мониторинг финансовых рынков и экономических показателей',
    modules: ['market-predictor', 'correlation', 'basket'],
    panels: ['markets', 'macro', 'commodities'] },
  { id: 'security', name: '🛡️ Безопасность', description: 'Отслеживание угроз и критической инфраструктуры',
    modules: ['trust', 'infrastructure', 'scheduler'],
    panels: ['cyber', 'infrastructure', 'military'] },
  { id: 'tech', name: '💻 Технологии', description: 'Космос, ИИ, кибербезопасность',
    modules: ['ai-chat', 'ai-gateway', 'hidden-links'],
    panels: ['ai', 'space', 'cyber'] },
];

const CATEGORY_MAP = {
  geopolitics: 'analysis',
  economy: 'analysis',
  security: 'operations',
  tech: 'operations',
};

async function loadLenses() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { lenses: parsed, source: 'config' };
    if (parsed && Array.isArray(parsed.lenses)) return { lenses: parsed.lenses, source: 'config' };
    return { lenses: DEFAULT_LENSES, source: 'builtin' };
  } catch {
    return { lenses: DEFAULT_LENSES, source: 'builtin' };
  }
}

function applyFilters(lenses, query) {
  let r = lenses.slice();
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(l => (l.name || '').toLowerCase().includes(s) || (l.description || '').toLowerCase().includes(s));
  }
  if (query.category) r = r.filter(l => CATEGORY_MAP[l.id] === String(query.category));
  if (query.module)   r = r.filter(l => (l.modules || []).includes(String(query.module)));
  return r;
}

function computeStats(lenses) {
  const allModules = new Set();
  const allPanels = new Set();
  for (const l of lenses) {
    for (const m of (l.modules || [])) allModules.add(m);
    for (const p of (l.panels || [])) allPanels.add(p);
  }
  return {
    count: lenses.length,
    total_modules: allModules.size,
    total_panels: allPanels.size,
    modules: [...allModules],
    panels: [...allPanels],
  };
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/lenses/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'lenses',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { lenses, source } = await loadLenses();

    if (subPath === '/' || subPath === '') {
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/', data: {
        version: meta.version, source, count: lenses.length,
        endpoints: ['/status', '/list', '/current', '/get/:id', '/categories', '/search?q=', '/modules', '/raw'],
        lenses: lenses.map(l => ({ id: l.id, name: l.name, description: l.description })),
      }}, extra);
    }
    if (subPath === '/status') {
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/status', data: { status: 'online', count: lenses.length, source } }, extra);
    }
    if (subPath === '/list') {
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/list', data: { lenses, total: lenses.length, source } }, extra);
    }
    if (subPath === '/current') {
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/current', data: { current: lenses[0] || null, source } }, extra);
    }
    if (subPath.startsWith('/get/')) {
      const id = subPath.slice('/get/'.length).split('/')[0];
      const lens = lenses.find(l => l.id === id);
      if (!lens) return sendJSON(res, 404, { error: 'lens_not_found', id }, extra);
      return sendJSON(res, 200, { service: 'lenses', endpoint: subPath, data: { lens, source } }, extra);
    }
    if (subPath === '/categories') {
      const byCat = {};
      for (const l of lenses) {
        const cat = CATEGORY_MAP[l.id] || 'other';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push({ id: l.id, name: l.name });
      }
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/categories', data: { categories: byCat, total: Object.keys(byCat).length } }, extra);
    }
    if (subPath === '/search') {
      const results = applyFilters(lenses, query);
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/search', data: { query: query.q || null, results, total: results.length } }, extra);
    }
    if (subPath === '/modules') {
      const stats = computeStats(lenses);
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/modules', data: stats }, extra);
    }
    if (subPath === '/raw') {
      return sendJSON(res, 200, { service: 'lenses', endpoint: '/raw', data: { source, lenses } }, extra);
    }

    return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath, available: ['/', '/status', '/list', '/current', '/get/:id', '/categories', '/search', '/modules', '/raw'] }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    try { sendJSON(res, status, { error: 'service_error', message: e.message }, extra); } catch {}
  }
}
