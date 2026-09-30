/**
 * apis/sources/rss-manager-api.mjs — SERVICE-МОДУЛЬ: УПРАВЛЕНИЕ OPML-ЛЕНТАМИ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК:
 *   - data/feeds/feeds.opml — основной OPML-файл с лентами.
 *   - data/feeds/feeds-status.json — persist-файл со статусом проверки.
 *
 * Управление RSS-лентами через OPML: парсинг, добавление, удаление,
 * категории, проверка доступности, импорт/экспорт OPML, статистика.
 * Обслуживает страницу управления лентами и связку с rss-feeds-api.
 *
 * ПОЧЕМУ SERVICE:
 *   - Мультиметодный (GET + POST + DELETE).
 *   - Хранит состояние (OPML-файл).
 *   - Не слой карты.
 *
 * НЕ ПУТАТЬ: rss-feeds-api.mjs (Layer) — отдаёт сами новости из basket/rss.json.
 * Этот модуль — управление ИСТОЧНИКАМИ (лентами).
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET    /                  — корень
 *   GET    /status            — health-check
 *   GET    /init              — загрузить ленты из OPML
 *   GET    /feeds             — список лент (?category=)
 *   GET    /feeds/:id         — конкретная лента
 *   GET    /stats             — статистика
 *   GET    /categories        — группировка по категориям
 *   GET    /export            — OPML (совместимо с /api/rss/export)
 *   GET    /export.json       — JSON со всеми лентами
 *   GET    /render            — рендер-конфиг
 *   POST   /feeds             — добавить ленту {name, url, category?}
 *   POST   /feeds/bulk        — массовое добавление {feeds: [...]}
 *   POST   /update            — проверить все ленты (максимум 50)
 *   POST   /update/:id        — проверить одну ленту
 *   POST   /import            — импорт OPML {xml}
 *   POST   /check-url         — проверить URL {url}
 *   DELETE /feeds/:id         — удалить ленту
 *   DELETE /feeds             — очистить все (confirm: true)
 *
 * ФОРМАТЫ: json, csv, series, stats, raw, opml.
 * СОГЛАШЕНИЯ: /update ограничен 50 лент за раз, таймаут 5 сек на ленту.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { loadPersist, savePersist } from './lib/basket-loader.mjs';
import http from 'node:http';
import https from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const FEEDS_DIR = join(PROJECT_ROOT, 'data', 'feeds');
const FEEDS_FILE = join(FEEDS_DIR, 'feeds.opml');
const FEEDS_BACKUP = join(FEEDS_DIR, 'feeds.opml.bak');
const STATUS_FILE = join(FEEDS_DIR, 'feeds-status.json');

export const route = '/api/services/rss-manager';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Управление RSS-лентами через OPML: парсинг, добавление/удаление, категории, проверка доступности, импорт/экспорт',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 2_000_000;
const MAX_FEEDS = 2_000;
const MAX_BULK_ITEMS = 100;
const MAX_UPDATE_PER_REQUEST = 50;
const FETCH_TIMEOUT_MS = 5000;
const MAX_OPML_BYTES = 5_000_000;

// ============================================================
//  УТИЛИТЫ
// ============================================================

function hashFeedId(url) {
  return createHash('md5').update(String(url)).digest('hex').slice(0, 8);
}

function sanitizeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.href;
  } catch { return null; }
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  // v2.0.1 (21.09.2026): добавлен таймаут 2 секунды.
  // ПРИЧИНА: undici (node fetch) держит keep-alive и событие 'end'
  // не срабатывает, если клиент не закрыл write-сторону. Curl закрывает
  // соединение — поэтому работал. readBody висел — router.mjs Promise.race
  // возвращал 504 через 25с. Фикс: если 'end' не наступил за 2 секунды,
  // возвращаем пустой объект (для /update body не нужен).
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      // Если что-то успело прийти — отдаём, иначе {}
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch { resolve({ __raw: raw }); }
    }, 2000);
    req.on('data', c => {
      if (done) return;
      total += c.length;
      if (total > maxBytes) {
        done = true;
        clearTimeout(timer);
        req.destroy();
        reject(new Error('body_too_large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch { resolve({ __raw: raw }); }
    });
    req.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    });
  });
}

// ============================================================
//  ПАРСИНГ OPML
// ============================================================

function parseOPML(xml) {
  const feeds = [];
  if (!xml || typeof xml !== 'string') return feeds;

  // Ищем все outline с type="rss" и xmlUrl
  const feedRegex = /<outline\b[^>]*type="rss"[^>]*>/gi;
  const matches = xml.match(feedRegex) || [];

  // Определяем категории по контексту: родительский outline с text, без type="rss"
  // Упрощённо: парсим построчно, отслеживаем текущую категорию
  let currentCategory = 'Общее';
  const lines = xml.split(/\r?\n/);
  for (const line of lines) {
    const catMatch = line.match(/<outline\b[^>]*text="([^"]+)"[^>]*>(?!.*type="rss")/);
    if (catMatch && !/type="rss"/i.test(line)) {
      currentCategory = catMatch[1];
      continue;
    }
    const feedMatch = line.match(/<outline\b[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/i);
    if (!feedMatch) {
      // Порядок атрибутов может быть разный — пробуем другой вариант
      const altMatch = line.match(/<outline\b[^>]*xmlUrl="([^"]*)"[^>]*text="([^"]*)"[^>]*type="rss"/i);
      if (altMatch) {
        const url = altMatch[1], name = altMatch[2];
        if (url) feeds.push(makeFeed(name || url, url, currentCategory));
      }
      continue;
    }
    const name = feedMatch[1], url = feedMatch[2];
    if (url) feeds.push(makeFeed(name || url, url, currentCategory));
  }

  // Дедупликация по URL
  const seen = new Set();
  return feeds.filter(f => {
    if (seen.has(f.url)) return false;
    seen.add(f.url);
    return true;
  });
}

function makeFeed(name, url, category) {
  return {
    id: hashFeedId(url),
    name: String(name || url).trim().slice(0, 200),
    url: String(url).trim(),
    category: String(category || 'Общее').trim().slice(0, 100),
    status: 'unknown',
    lastCheck: null,
    lastUpdate: null,
    errorCount: 0,
  };
}

// ============================================================
//  OPML — ЧТЕНИЕ / ЗАПИСЬ
// ============================================================

async function ensureDir() {
  try { await fs.mkdir(FEEDS_DIR, { recursive: true }); } catch {}
}

async function loadOPML() {
  await ensureDir();
  let xml;
  try { xml = await fs.readFile(FEEDS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return { feeds: [], source: 'fallback', xml: null };
    throw e;
  }
  const feeds = parseOPML(xml);
  return { feeds, source: 'opml', xml };
}

async function saveOPML(feeds) {
  await ensureDir();
  const categories = {};
  for (const f of feeds) {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
  }

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<opml version="1.0">');
  lines.push('  <head>');
  lines.push('    <title>Crucix RSS Feeds</title>');
  lines.push(`    <dateCreated>${new Date().toISOString()}</dateCreated>`);
  lines.push('  </head>');
  lines.push('  <body>');
  for (const [cat, list] of Object.entries(categories)) {
    lines.push(`    <outline text="${escapeXml(cat)}">`);
    for (const f of list) {
      lines.push(`      <outline type="rss" text="${escapeXml(f.name)}" xmlUrl="${escapeXml(f.url)}"/>`);
    }
    lines.push('    </outline>');
  }
  lines.push('  </body>');
  lines.push('</opml>');
  const xml = lines.join('\n') + '\n';

  // Бэкап
  try { await fs.copyFile(FEEDS_FILE, FEEDS_BACKUP); } catch {}

  // Атомарная запись
  const tmp = `${FEEDS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, xml, 'utf8');
  await fs.rename(tmp, FEEDS_FILE);

  return { ok: true, bytes: Buffer.byteLength(xml, 'utf8') };
}

// ============================================================
//  СТАТУС
// ============================================================

async function loadStatus() {
  const result = await loadPersist({ persistFile: STATUS_FILE, defaults: { feeds: {} } });
  const data = result.data || {};
  if (!data.feeds || typeof data.feeds !== 'object') data.feeds = {};
  return { status: data.feeds, source: result.source };
}

async function saveStatus(status) {
  return savePersist({ persistFile: STATUS_FILE, data: { feeds: status, updated_at: new Date().toISOString() } });
}

function mergeStatus(feeds, status) {
  return feeds.map(f => {
    const s = status[f.id] || {};
    return {
      ...f,
      status: s.alive === true ? 'online' : (s.alive === false ? 'offline' : 'unknown'),
      lastCheck: s.lastCheck || null,
      errorCount: s.errorCount || 0,
    };
  });
}

// ============================================================
//  ПРОВЕРКА ЛЕНТ
// ============================================================

export async function checkFeed(url) {
  // v2.0.4 (21.09.2026): fix утечки сокетов.
  // ПРИЧИНА: без agent:false каждый https.request оставляет сокет в globalAgent
  // (keep-alive). После 33 запросов пул забивается — следующий висит вечно.
  // ДИАГНОСТИКА: тест 39 URL последовательно зависал на #34 (после 33 успешных).
  // РЕШЕНИЕ: agent: false (новый сокет на каждый запрос) + Connection: close.
  // Дополнительно: clearTimeout только в end/error (не при получении response),
  // res.resume() для явного потребления потока, флаг resolved от двойного resolve,
  // req.setTimeout + req.on('timeout') для двойной защиты.
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); }
    catch (e) { return resolve({ alive: false, error: 'invalid_url' }); }
    const isHttps = parsed.protocol === 'https:';
    const httpMod = isHttps ? https : http;
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    const timer = setTimeout(() => {
      try { req.destroy(); } catch {}
      done({ alive: false, error: 'timeout' });
    }, FETCH_TIMEOUT_MS);
    const req = httpMod.request({
      method: 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      agent: false,
      headers: {
        'User-Agent': 'Crucix-RSS-Manager/2.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Connection': 'close'
      }
    }, (res) => {
      const status = res.statusCode;
      res.resume();
      res.on('end', () => { clearTimeout(timer); done({ alive: status >= 200 && status < 400, status }); });
      res.on('error', () => { clearTimeout(timer); done({ alive: false, error: 'res_error' }); });
    });
    req.on('error', (e) => { clearTimeout(timer); done({ alive: false, error: e.message }); });
    req.on('timeout', () => { clearTimeout(timer); try { req.destroy(); } catch {} done({ alive: false, error: 'req_timeout' }); });
    req.setTimeout(FETCH_TIMEOUT_MS);
    req.end();
  });
}

export async function updateAllFeeds(feeds) {
  // v2.0.3 (21.09.2026): параллельная обработка батчами по 5.
  // ПРИЧИНА: последовательная обработка 39 фидов × (400мс запрос + 100мс пауза)
  // = ~20-25с, иногда упирается в таймаут router.mjs (25с) → 504.
  // Параллельно по 5 батчей: 8 батчей × 400мс + 7 × 50мс пауза = ~3.5с.
  const CONCURRENCY = 5;
  const BATCH_PAUSE_MS = 50;
  const limit = Math.min(feeds.length, MAX_UPDATE_PER_REQUEST);
  const targets = feeds.slice(0, limit);
  const results = [];
  const statusUpdates = {};
  let checked = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(f => checkFeed(f.url)));
    for (let j = 0; j < batch.length; j++) {
      const feed = batch[j];
      const r = batchResults[j];
      checked++;
      statusUpdates[feed.id] = {
        alive: r.alive,
        status: r.status,
        lastCheck: new Date().toISOString(),
        errorCount: r.alive ? 0 : (feed.errorCount || 0) + 1,
      };
      results.push({ id: feed.id, name: feed.name, url: feed.url, alive: r.alive, status: r.status });
    }
    if (i + CONCURRENCY < targets.length) {
      await new Promise(res => setTimeout(res, BATCH_PAUSE_MS));
    }
  }

  const { status: existing } = await loadStatus();
  const merged = { ...existing, ...statusUpdates };
  await saveStatus(merged);

  return {
    checked,
    total: feeds.length,
    limited: feeds.length > limit,
    limit: MAX_UPDATE_PER_REQUEST,
    results,
  };
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(feeds) {
  const byCategory = {};
  const byStatus = { online: 0, offline: 0, unknown: 0 };
  for (const f of feeds) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
  }
  const top = (obj, limit = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));

  return {
    total: feeds.length,
    alive: byStatus.online,
    dead: byStatus.offline,
    unknown: byStatus.unknown,
    unique_categories: Object.keys(byCategory).length,
    by_category: byCategory,
    by_status: byStatus,
    top_categories: top(byCategory, 15),
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(feeds) {
  const lines = ['id,name,url,category,status,lastCheck,errorCount'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const f of feeds) lines.push([f.id, f.name, f.url, f.category, f.status, f.lastCheck, f.errorCount].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toSeries(feeds) {
  return feeds.map(f => ({
    id: f.id, name: f.name, url: f.url, category: f.category,
    status: f.status, lastCheck: f.lastCheck, errorCount: f.errorCount,
  }));
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text, 'utf8')), ...extra });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Service': 'rss-manager',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/rss-manager/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // ============================================================
    //  GET
    // ============================================================
    if (req.method === 'GET') {
      let loaded, statusLoaded;
      try {
        [loaded, statusLoaded] = await Promise.all([loadOPML(), loadStatus()]);
      } catch (e) {
        return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra);
      }
      const feeds = mergeStatus(loaded.feeds, statusLoaded.status);

      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, {
          service: 'rss-manager',
          version: meta.version,
          description: meta.description,
          feeds_count: feeds.length,
          stats: computeStats(feeds),
          endpoints: {
            'GET /status': 'health-check',
            'GET /init': 'загрузить ленты',
            'GET /feeds': 'список лент',
            'GET /feeds/:id': 'конкретная лента',
            'GET /stats': 'статистика',
            'GET /categories': 'группировка по категориям',
            'GET /export': 'OPML',
            'GET /export.json': 'JSON лент',
            'GET /render': 'рендер-конфиг',
            'POST /feeds': 'добавить {name, url, category?}',
            'POST /feeds/bulk': 'массовое добавление {feeds: [...]}',
            'POST /update': 'проверить все ленты (до 50 за раз)',
            'POST /update/:id': 'проверить одну',
            'POST /import': 'импорт OPML {xml}',
            'POST /check-url': 'проверить URL {url}',
            'DELETE /feeds/:id': 'удалить ленту',
            'DELETE /feeds': 'очистить все (confirm:true)',
          },
        }, extra);
      }

      if (sub === '/status') {
        return sendJSON(res, 200, {
          success: true,
          module: 'rss-manager',
          status: 'online',
          feeds: feeds.length,
          source: loaded.source,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/init') {
        return sendJSON(res, 200, { success: true, stats: computeStats(feeds), feeds, source: loaded.source }, extra);
      }

      if (sub === '/feeds') {
        const catFilter = query.category ? String(query.category) : null;
        const filtered = catFilter && catFilter !== 'all' ? feeds.filter(f => f.category === catFilter) : feeds;
        if (format === 'csv') return sendText(res, 200, toCSV(filtered), 'text/csv; charset=utf-8');
        if (format === 'series') return sendJSON(res, 200, { series: toSeries(filtered), count: filtered.length }, extra);
        if (format === 'raw') return sendJSON(res, 200, { data: filtered, total: feeds.length }, extra);
        return sendJSON(res, 200, { success: true, feeds: filtered, total: filtered.length, total_all: feeds.length }, extra);
      }

      if (sub.startsWith('/feeds/')) {
        const id = decodeURIComponent(sub.slice('/feeds/'.length));
        const feed = feeds.find(f => f.id === id);
        if (!feed) return sendJSON(res, 404, { success: false, error: 'feed_not_found', id }, extra);
        return sendJSON(res, 200, { success: true, feed }, extra);
      }

      if (sub === '/stats' || format === 'stats') {
        return sendJSON(res, 200, { success: true, stats: computeStats(feeds), source: loaded.source }, extra);
      }

      if (sub === '/categories') {
        const byCat = {};
        for (const f of feeds) {
          if (!byCat[f.category]) byCat[f.category] = { name: f.category, count: 0, feeds: [] };
          byCat[f.category].count++;
          byCat[f.category].feeds.push({ id: f.id, name: f.name, url: f.url });
        }
        return sendJSON(res, 200, { success: true, categories: Object.values(byCat), total: Object.keys(byCat).length }, extra);
      }

      if (sub === '/export' || format === 'opml') {
        if (!loaded.xml) {
          // Пустой OPML
          const empty = '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="1.0">\n  <head><title>Crucix RSS Feeds</title></head>\n  <body/>\n</opml>\n';
          return sendText(res, 200, empty, 'application/xml; charset=utf-8', { 'Content-Disposition': 'attachment; filename="feeds.opml"' });
        }
        return sendText(res, 200, loaded.xml, 'application/xml; charset=utf-8', { 'Content-Disposition': 'attachment; filename="feeds.opml"' });
      }

      if (sub === '/export.json') {
        return sendJSON(res, 200, { success: true, feeds, stats: computeStats(feeds) }, extra);
      }

      if (sub === '/render') {
        return sendJSON(res, 200, {
          render: {
            type: 'table',
            columns: ['name', 'url', 'category', 'status'],
            feeds,
            stats: computeStats(feeds),
          },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'endpoint_not_found',
        path: sub,
        available: ['/', '/status', '/init', '/feeds', '/feeds/:id', '/stats', '/categories', '/export', '/export.json', '/render'],
      }, extra);
    }

    // ============================================================
    //  POST
    // ============================================================
    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      let loaded;
      try { loaded = await loadOPML(); }
      catch (e) { return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra); }
      let feeds = loaded.feeds;

      if (sub === '/feeds') {
        const name = String(body.name || '').trim();
        const url = sanitizeUrl(body.url);
        const category = String(body.category || 'Пользовательские').trim();
        if (!name) return sendJSON(res, 400, { success: false, error: 'field_required: name' }, extra);
        if (!url) return sendJSON(res, 400, { success: false, error: 'field_required: valid url' }, extra);
        if (feeds.length >= MAX_FEEDS) return sendJSON(res, 409, { success: false, error: 'limit_reached', max: MAX_FEEDS }, extra);
        if (feeds.some(f => f.url === url)) return sendJSON(res, 409, { success: false, error: 'feed_exists', url }, extra);

        const newFeed = makeFeed(name, url, category);
        feeds.push(newFeed);
        const saveRes = await saveOPML(feeds);
        if (!saveRes.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saveRes.error }, extra);
        return sendJSON(res, 200, { success: true, feed: newFeed, total: feeds.length }, extra);
      }

      if (sub === '/feeds/bulk') {
        const items = Array.isArray(body.feeds) ? body.feeds : [];
        if (items.length === 0) return sendJSON(res, 400, { success: false, error: 'field_required: feeds[]' }, extra);
        if (items.length > MAX_BULK_ITEMS) return sendJSON(res, 400, { success: false, error: 'too_many', max: MAX_BULK_ITEMS, got: items.length }, extra);

        const existingUrls = new Set(feeds.map(f => f.url));
        const added = [];
        const skipped = [];

        for (const item of items) {
          if (feeds.length >= MAX_FEEDS) break;
          const name = String(item.name || '').trim();
          const url = sanitizeUrl(item.url);
          const category = String(item.category || 'Пользовательские').trim();
          if (!name || !url) { skipped.push({ item, reason: 'invalid' }); continue; }
          if (existingUrls.has(url)) { skipped.push({ url, reason: 'exists' }); continue; }
          const nf = makeFeed(name, url, category);
          feeds.push(nf);
          existingUrls.add(url);
          added.push(nf);
        }

        const saveRes = await saveOPML(feeds);
        if (!saveRes.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saveRes.error }, extra);
        return sendJSON(res, 200, { success: true, added: added.length, skipped: skipped.length, feeds: added, total: feeds.length }, extra);
      }

      if (sub === '/update') {
        const result = await updateAllFeeds(feeds);
        // Перезагрузить с обновлённым статусом
        const [reloaded, statusLoaded] = await Promise.all([loadOPML(), loadStatus()]);
        const merged = mergeStatus(reloaded.feeds, statusLoaded.status);
        return sendJSON(res, 200, { success: true, ...result, stats: computeStats(merged) }, extra);
      }

      if (sub.startsWith('/update/')) {
        const id = decodeURIComponent(sub.slice('/update/'.length));
        const feed = feeds.find(f => f.id === id);
        if (!feed) return sendJSON(res, 404, { success: false, error: 'feed_not_found', id }, extra);
        const r = await checkFeed(feed.url);
        const { status } = await loadStatus();
        status[id] = { alive: r.alive, status: r.status, lastCheck: new Date().toISOString(), errorCount: r.alive ? 0 : (status[id]?.errorCount || 0) + 1 };
        await saveStatus(status);
        return sendJSON(res, 200, { success: true, id, name: feed.name, url: feed.url, alive: r.alive, status: r.status }, extra);
      }

      if (sub === '/check-url') {
        const url = sanitizeUrl(body.url);
        if (!url) return sendJSON(res, 400, { success: false, error: 'field_required: valid url' }, extra);
        const r = await checkFeed(url);
        return sendJSON(res, 200, { success: true, url, ...r }, extra);
      }

      if (sub === '/import') {
        const xml = body.xml || body.__raw;
        if (!xml || typeof xml !== 'string') return sendJSON(res, 400, { success: false, error: 'field_required: xml' }, extra);
        if (xml.length > MAX_OPML_BYTES) return sendJSON(res, 413, { success: false, error: 'opml_too_large', max_bytes: MAX_OPML_BYTES }, extra);

        const parsed = parseOPML(xml);
        if (parsed.length === 0) return sendJSON(res, 400, { success: false, error: 'no_feeds_in_opml' }, extra);

        // Слияние с существующими — дедупликация по url
        const existingUrls = new Set(feeds.map(f => f.url));
        const mergedFeeds = [...feeds];
        let importedCount = 0;
        for (const f of parsed) {
          if (feeds.length + importedCount >= MAX_FEEDS) break;
          if (existingUrls.has(f.url)) continue;
          mergedFeeds.push(f);
          existingUrls.add(f.url);
          importedCount++;
        }

        const saveRes = await saveOPML(mergedFeeds);
        if (!saveRes.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saveRes.error }, extra);
        return sendJSON(res, 200, { success: true, imported: importedCount, parsed: parsed.length, total: mergedFeeds.length }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'post_endpoint_not_found',
        path: sub,
        available: ['/feeds', '/feeds/bulk', '/update', '/update/:id', '/import', '/check-url'],
      }, extra);
    }

    // ============================================================
    //  DELETE
    // ============================================================
    if (req.method === 'DELETE') {
      let loaded;
      try { loaded = await loadOPML(); }
      catch (e) { return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra); }
      let feeds = loaded.feeds;

      if (sub === '/feeds') {
        let body;
        try { body = await readBody(req); } catch { body = {}; }
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/rss-manager/feeds with body {"confirm": true}',
            will_remove: feeds.length,
          }, extra);
        }
        const removed = feeds.length;
        const saveRes = await saveOPML([]);
        if (!saveRes.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saveRes.error }, extra);
        // Очистить статус
        await saveStatus({});
        return sendJSON(res, 200, { success: true, cleared: removed, total: 0 }, extra);
      }

      if (sub.startsWith('/feeds/')) {
        const id = decodeURIComponent(sub.slice('/feeds/'.length));
        const idx = feeds.findIndex(f => f.id === id);
        if (idx === -1) return sendJSON(res, 404, { success: false, error: 'feed_not_found', id }, extra);
        const removed = feeds.splice(idx, 1)[0];
        const saveRes = await saveOPML(feeds);
        if (!saveRes.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saveRes.error }, extra);
        // Удалить из статуса
        const { status } = await loadStatus();
        delete status[id];
        await saveStatus(status);
        return sendJSON(res, 200, { success: true, removed: { id: removed.id, name: removed.name, url: removed.url }, total: feeds.length }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'delete_endpoint_not_found', path: sub, available: ['/feeds', '/feeds/:id'] }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 400 ? 'bad_request' : 'handler_error', message: e.message };
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
