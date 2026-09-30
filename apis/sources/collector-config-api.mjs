/**
 * apis/sources/collector-config-api.mjs — SERVICE-МОДУЛЬ: КОНФИГ СБОРЩИКОВ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE). Мультиметодный CRUD.
 * ИСТОЧНИК: data/config/collectors-config.json — { sources: { category: { name: { enabled, limit, key } } } }.
 *
 * Управление источниками сборщиков: список, вкл/выкл, установка API-ключей.
 *
 * ЭНДПОИНТЫ (внутренние):
 *   GET    /                — весь конфиг
 *   GET    /sources         — только секция sources
 *   GET    /categories      — список категорий
 *   GET    /source?cat=&name= — один источник
 *   POST   /toggle?cat=&name= — переключить enabled
 *   POST   /key             — установить ключ (body: {category, name, key})
 *   DELETE /reset           — сброс к DEFAULT_CONFIG
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const CONFIG_DIR = join(PROJECT_ROOT, 'data', 'config');
const CONFIG_FILE = join(CONFIG_DIR, 'collectors-config.json');

export const route  = '/api/services/collector-config';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Collector config service: manage data source configs (enable/disable, API keys). Data at data/config/collectors-config.json.',
  cache: 0,
  version: '2.0.0',
};

const DEFAULT_CONFIG = {
  sources: {
    weather: {
      openmeteo:      { enabled: true,  limit: 0,   key: '' },
      noaa:           { enabled: true,  limit: 0,   key: '' },
      weathergov:     { enabled: false, limit: 0,   key: '' },
      openweathermap: { enabled: false, limit: 50,  key: '' },
      gismeteo:       { enabled: false, limit: 50,  key: '' },
      accuweather:    { enabled: false, limit: 50,  key: '' },
    },
    news: {
      newsapi: { enabled: true, limit: 100, key: '' },
      rss:     { enabled: true, limit: 0,   key: '' },
    },
    financial: {
      fred:  { enabled: true, limit: 0, key: '' },
      vix:   { enabled: true, limit: 0, key: '' },
      yield: { enabled: true, limit: 0, key: '' },
    },
    aviation: {
      opensky: { enabled: true, limit: 0, key: '' },
    },
    space: {
      celestrak: { enabled: true,  limit: 0, key: '' },
      nasa:      { enabled: false, limit: 0, key: '' },
    },
  },
};

async function loadConfig() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const content = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

async function saveConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function readBody(req, maxBytes = 100_000) {
  return new Promise((resolve, reject) => {
    let buf = ''; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      buf += c;
    });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

async function epRoot() { return { config: await loadConfig() }; }
async function epSources() { return { sources: (await loadConfig()).sources || {} }; }
async function epCategories() {
  const cfg = await loadConfig();
  const cats = Object.keys(cfg.sources || {});
  return { categories: cats, count: cats.length };
}
async function epSource(query) {
  if (!query.cat || !query.name) { const e = new Error('field_required: cat, name'); e.statusCode = 400; throw e; }
  const cfg = await loadConfig();
  const src = cfg.sources?.[query.cat]?.[query.name];
  if (!src) { const e = new Error('source_not_found'); e.statusCode = 404; throw e; }
  return { category: query.cat, name: query.name, source: src };
}
async function epToggle(query) {
  if (!query.cat || !query.name) { const e = new Error('field_required: cat, name'); e.statusCode = 400; throw e; }
  const cfg = await loadConfig();
  if (!cfg.sources?.[query.cat]?.[query.name]) { const e = new Error('source_not_found'); e.statusCode = 404; throw e; }
  cfg.sources[query.cat][query.name].enabled = !cfg.sources[query.cat][query.name].enabled;
  await saveConfig(cfg);
  return { category: query.cat, name: query.name, enabled: cfg.sources[query.cat][query.name].enabled };
}
async function epSetKey(body) {
  if (!body.category || !body.name) { const e = new Error('field_required: category, name'); e.statusCode = 400; throw e; }
  const cfg = await loadConfig();
  if (!cfg.sources?.[body.category]?.[body.name]) { const e = new Error('source_not_found'); e.statusCode = 404; throw e; }
  cfg.sources[body.category][body.name].key = String(body.key || '');
  await saveConfig(cfg);
  return { category: body.category, name: body.name, key_set: !!body.key };
}
async function epReset() {
  await saveConfig(DEFAULT_CONFIG);
  return { reset: true, message: 'Config reset to defaults' };
}

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/collector-config\/?/, '');
  const query = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'collector-config',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const segs = subPath.split('/').filter(Boolean);
    let result;

    if (req.method === 'GET') {
      if (segs.length === 0) result = await epRoot();
      else if (segs[0] === 'sources') result = await epSources();
      else if (segs[0] === 'categories') result = await epCategories();
      else if (segs[0] === 'source') result = await epSource(query);
      else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }
    } else if (req.method === 'POST') {
      let body = {};
      try { body = await readBody(req); } catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }
      if (segs[0] === 'toggle') result = await epToggle(query);
      else if (segs[0] === 'key') result = await epSetKey(body);
      else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }
    } else if (req.method === 'DELETE') {
      if (segs[0] === 'reset') result = await epReset();
      else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }
    } else {
      const e = new Error('method_not_allowed'); e.statusCode = 405; throw e;
    }

    return sendJSON(res, 200, { service: 'collector-config', endpoint: subPath || '/', data: result }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    try { sendJSON(res, status, { error: e.message || 'service_error' }, extra); } catch {}
  }
}
