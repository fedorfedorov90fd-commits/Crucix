/**
 * Crucix API: router-rss-alias — алиас /api/rss/* на рабочие API-модули.
 * Версия 2.1.0. Принят 22.10.2026.
 *
 * ИСПРАВЛЕНО В v2.1.0 (по сравнению с v2.0.0):
 *   - Перехватывается res.writeHead ТОЖЕ. В v2.0.0 оригинальный модуль
 *     успевал отправить заголовки с Content-Length от исходного тела,
 *     второй writeHead игнорировался, браузер видел pending с 0 байт.
 *   - Конвертация FeatureCollection → items теперь в res.end ДО отправки
 *     заголовков. Content-Length пересчитывается через Buffer.byteLength.
 *   - Конвертация расширена: если j.items уже есть (алиас вызвал
 *     rss-feeds-api, который сам вернул FeatureCollection), конвертируем
 *     features → items. Если j.features нет — оставляем как есть.
 *   - Кэш /init на 60 секунд сохранён.
 *   - Прокси /storage → /api/services/storage сохранён.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export const route   = '/api/rss';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Алиас /api/rss/*: адаптер форматов для rss-feeds-api (FeatureCollection→items), кэш /init 60с, прокси /storage на storage-api.',
  cache: 0,
  version: '2.1.0',
};

// ---------- Утилиты ----------

function pickTarget(subpath, method) {
  if (subpath.startsWith('/storage')) return 'storage';
  if (method === 'GET') {
    if (subpath === '' || subpath === '/' || subpath === '/feeds') return 'feeds';
    if (subpath === '/regions' || subpath === '/sources' ||
        subpath === '/timeline' || subpath === '/latest' ||
        subpath === '/featurecollection') return 'feeds';
  }
  return 'manager';
}

function buildTargetUrl(subpath, search, target) {
  let base, path;
  if (target === 'feeds') {
    base = '/api/layers/rss-feeds';
    path = (subpath && subpath !== '/') ? subpath : '';
  } else if (target === 'storage') {
    base = '/api/services/storage';
    path = subpath.replace(/^\/storage/, '') || '';
  } else {
    base = '/api/services/rss-manager';
    path = (subpath && subpath !== '/') ? subpath : '';
  }
  return base + path + (search || '');
}

// ---------- Кэш /init ----------
const initCache = { data: null, at: 0, ttl: 60_000 };

// ---------- Ленивая загрузка целевых модулей ----------
let _feedsModule = null, _managerModule = null, _storageModule = null;

async function getTargetModule(target) {
  if (target === 'feeds') {
    if (!_feedsModule) _feedsModule = await import(join(__dirname, 'rss-feeds-api.mjs'));
    return _feedsModule;
  }
  if (target === 'storage') {
    if (!_storageModule) _storageModule = await import(join(__dirname, 'storage-api.mjs'));
    return _storageModule;
  }
  if (!_managerModule) _managerModule = await import(join(__dirname, 'rss-manager-api.mjs'));
  return _managerModule;
}

// ---------- Перехват res ----------
function interceptResponse(req, res, target, onDone) {
  const origWriteHead = res.writeHead.bind(res);
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);

  let pendingWriteHead = null;
  const chunks = [];
  let finished = false;

  res.writeHead = function (statusCode, headers) {
    if (finished) return res;
    pendingWriteHead = { statusCode: statusCode || 200, headers: headers || res.getHeaders() };
    return res;
  };

  res.write = function (chunk, enc) {
    if (finished) return true;
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc || 'utf8'));
    return true;
  };

  res.end = function (chunk, enc, cb) {
    if (finished) return res;
    finished = true;
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc || 'utf8'));

    let body = Buffer.concat(chunks).toString('utf8');
    const statusCode = pendingWriteHead ? pendingWriteHead.statusCode : 200;
    let headers = { ...(pendingWriteHead ? pendingWriteHead.headers : res.getHeaders()) };

    // Адаптер форматов для feeds: FeatureCollection → items
    if (target === 'feeds' && statusCode === 200) {
      try {
        const j = JSON.parse(body);
        if (j && j.type === 'FeatureCollection' && Array.isArray(j.features)) {
          const items = j.features.map(f => {
            const p = (f && f.properties) || {};
            const coords = (f && f.geometry && f.geometry.coordinates) || [null, null];
            return {
              id: p.id || '',
              title: p.title || '',
              source: p.source || '',
              category: p.category || '',
              region: p.region || 'world',
              regionLabel: p.regionLabel || '',
              date: p.date || '',
              url: p.url || '',
              color: p.color || '',
              icon: p.icon || '',
              lat: coords[1],
              lon: coords[0],
            };
          });
          body = JSON.stringify({
            items,
            total: items.length,
            meta: j.meta || {},
            legend: j.legend || [],
            series: j.series || [],
            stats: j.stats || [],
          });
        }
      } catch { /* не JSON — отдаём как есть */ }
    }

    // Кэш /init
    if (target === 'manager' && req.method === 'GET' && req.url.includes('/init') && statusCode === 200) {
      initCache.data = body;
      initCache.at = Date.now();
    }

    // Восстанавливаем
    res.writeHead = origWriteHead;
    res.write = origWrite;
    res.end = origEnd;

    // Пересчитываем Content-Length
    delete headers['content-length'];
    headers['content-length'] = Buffer.byteLength(body, 'utf8');
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/json; charset=utf-8';
    }

    try { origWriteHead(statusCode, headers); } catch { /* заголовки уже отправлены */ }
    try { origEnd(body); } catch { /* уже закрыт */ }
    if (onDone) onDone();
    return res;
  };
}

// ---------- Обработчик ----------
export async function handler(req, res) {
  const originalUrl = req.url;
  try {
    const url = new URL(req.url, 'http://x');
    const subpath = url.pathname.replace(/^\/api\/rss/, '') || '/';
    const target = pickTarget(subpath, req.method);
    const targetUrl = buildTargetUrl(subpath, url.search, target);

    // Кэш /init
    if (target === 'manager' && subpath === '/init' && req.method === 'GET' &&
        initCache.data && (Date.now() - initCache.at) < initCache.ttl) {
      res.setHeader('X-RSS-Alias-Cache', 'hit');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end(initCache.data);
      return;
    }

    req.url = targetUrl;
    const targetModule = await getTargetModule(target);

    if (typeof targetModule.handler !== 'function') {
      req.url = originalUrl;
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'alias_target_broken', target }));
      return;
    }

    res.setHeader('X-RSS-Alias-Target', target);
    res.setHeader('X-RSS-Alias-Original', subpath);

    interceptResponse(req, res, target, () => { req.url = originalUrl; });

    try {
      await targetModule.handler(req, res);
    } catch (e) {
      req.url = originalUrl;
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'alias_handler_error', message: e.message }));
      }
    }
  } catch (e) {
    req.url = originalUrl;
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'alias_error', message: e.message }));
    }
  }
}
