/**
 * apis/sources/rss-feeds-api.mjs — API-МОДУЛЬ: RSS-ЛЕНТЫ
 *
 * КОНТРАКТ CRUCIX v2 / v3.
 * ИСТОЧНИК: data/basket/rsshub.json (основной, crucix.basket.v1, 500 documents)
 *           ИЛИ data/basket/rss-universal.json (fallback, crucix.basket.v1)
 *           ИЛИ data/basket/rss-latest.json (легаси, {items:[]}, 18.09.2026).
 * Сборщик: scripts/collectors/collect-rsshub.mjs (активный).
 *          scripts/collectors/collect-rss-feeds.mjs — УДАЛЁН, файлы rss-latest.json/rss.json остались как сироты.
 *
 * Агрегатор RSS-новостей из глобальных источников. Классифицирует каждую новость
 * по региону (europe/us/asia-pacific/middle-east/africa/latin-america/energy/
 * government/thinktank/forecast/world) на основе источника и категории.
 * Регион определяет координаты на карте (REGION_COORDS).
 *
 * Чтение через basket-loader.mjs (loadWithFallback) — поддерживает и basket.v1
 * (документы), и легаси-формат ({items:[]}, массив) на случай перехода.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?source=, ?category=, ?q=, ?since=, ?until=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                    — корень (список эндпоинтов)
 *   GET /stats               — агрегированная статистика
 *   GET /status              — health-check
 *   GET /latest              — последние 50 новостей
 *   GET /regions             — группировка по регионам
 *   GET /sources             — топ источников
 *   GET /categories          — топ категорий
 *   GET /timeline            — динамика по дням
 *   GET /featurecollection   — чистый GeoJSON
 *
 * Изменение 20.09.2026: переключение с rss-latest.json на rsshub.json (basket.v1).
 * Чтение через loadWithFallback. Совместимость с обоими форматами.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

const PRIMARY_FILE  = join(BASKET_DIR, 'rsshub.json');
const FALLBACK_FILE = join(BASKET_DIR, 'rss-universal.json');
const LEGACY_FILE   = join(BASKET_DIR, 'rss-latest.json');

export const route  = '/api/layers/rss-feeds';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📰',
  color: '#ec4899',
  vizType: 'marker',
  source: 'basket/rsshub.json',
  collector: 'collect-rsshub.mjs',
  cache: 300,
  description: 'RSS-новости из глобальных источников с классификацией по регионам',
  unit: 'articles',
};

// ============================================================
//  КООРДИНАТЫ РЕГИОНОВ (для точек на карте)
// ============================================================

const REGION_COORDS = {
  'europe':         [50.0, 15.0],
  'us':             [45.0, -100.0],
  'asia-pacific':   [10.0, 110.0],
  'middle-east':    [31.0, 40.0],
  'africa':         [0.0, 20.0],
  'latin-america':  [-15.0, -60.0],
  'energy':         [50.0, 15.0],
  'government':     [45.0, -100.0],
  'thinktank':      [50.0, 15.0],
  'forecast':       [45.0, -100.0],
  'world':          [0.0, 0.0],
};

const REGION_LABELS = {
  'europe':         { label: 'Европа', color: '#3b82f6' },
  'us':             { label: 'США', color: '#dc2626' },
  'asia-pacific':   { label: 'Азия-Тихоокеанский', color: '#f97316' },
  'middle-east':    { label: 'Ближний Восток', color: '#eab308' },
  'africa':         { label: 'Африка', color: '#22c55e' },
  'latin-america':  { label: 'Латинская Америка', color: '#84cc16' },
  'energy':         { label: 'Энергетика', color: '#0ea5e9' },
  'government':     { label: 'Правительство', color: '#8b5cf6' },
  'thinktank':      { label: 'Аналитические центры', color: '#a855f7' },
  'forecast':       { label: 'Прогнозы и рынки', color: '#14b8a6' },
  'world':          { label: 'Мир', color: '#64748b' },
};

// ============================================================
//  КЛАССИФИКАТОР РЕГИОНОВ
// ============================================================

function detectRegion(source, category) {
  const s = (source || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (s.includes('тасс') || s.includes('tass') || s.includes('lenta.ru') || s.includes('lenta') ||
      s.includes('интерфакс') || s.includes('interfax') || s.includes('коммерсантъ') || s.includes('kommersant') ||
      s.includes('ведомости') || s.includes('vedomosti') || s.includes('ria') || s.includes('риа') ||
      s.includes('sputnik') || s.includes('спутник') || s.includes('москва') || s.includes('moscow') ||
      s.includes('кремль') || s.includes('kremlin') || s.includes('путин') || s.includes('putin') ||
      s.includes('лавров') || s.includes('lavrov') || s.includes('мишустин') || s.includes('mishustin') ||
      s.includes('днр') || s.includes('лнр') || s.includes('donetsk') || s.includes('lugansk') ||
      s.includes('севастополь') || s.includes('sevastopol') || s.includes('крым') || s.includes('crimea') ||
      s.includes('украина') || s.includes('киев') || s.includes('kiev') || s.includes('kyiv')) {
    return 'europe';
  }

  if (s.includes('fox news') || s.includes('cnn') || s.includes('nytimes') || s.includes('washington post') ||
      s.includes('wsj') || s.includes('bloomberg') || s.includes('reuters') || s.includes('ap news') ||
      s.includes('associated press') || s.includes('white house') || s.includes('pentagon') ||
      s.includes('npr') || s.includes('abc news') || s.includes('nbc news') || s.includes('cbs news') ||
      s.includes('politico') || s.includes('the hill') || s.includes('axios') || s.includes('usatoday') ||
      s.includes('usa today') || s.includes('new york post') || s.includes('ny post') ||
      s.includes('la times') || s.includes('los angeles times') || s.includes('boston globe') ||
      s.includes('miami herald') || s.includes('houston chronicle') || s.includes('seattle times') ||
      s.includes('denver post') || s.includes('cnbc') || s.includes('msnbc') ||
      s.includes('the atlantic') || s.includes('new yorker') || s.includes('time magazine') ||
      s.includes('newsweek') || s.includes('foreign affairs') || s.includes('national interest') ||
      s.includes('heritage') || s.includes('cato') || s.includes('rand') || s.includes('brookings') ||
      s.includes('carnegie')) {
    return 'us';
  }

  if (s.includes('guardian') || s.includes('bbc') || s.includes('sky news') || s.includes('independent') ||
      s.includes('telegraph') || s.includes('the times') || s.includes('economist') ||
      s.includes('euobserver') || s.includes('euractiv') || s.includes('france24') || s.includes('le monde') ||
      s.includes('le figaro') || s.includes('liberation') || s.includes('spiegel') || s.includes('bild') ||
      s.includes('faz') || s.includes('zeit') || s.includes('corriere') || s.includes('republica') ||
      s.includes('el pais') || s.includes('elmundo') || s.includes('nrc') || s.includes('volkskrant') ||
      s.includes('aftonbladet') || s.includes('dagens nyheter') || s.includes('berlingske') ||
      s.includes('politiken') || s.includes('jyllands-posten') || s.includes('helsingin sanomat') ||
      s.includes('aftenposten') || s.includes('dagbladet') || s.includes('irish times') || s.includes('rte') ||
      s.includes('swissinfo') || s.includes('neue zürcher') || s.includes('tages anzeiger') ||
      s.includes('der standard') || s.includes('wiener zeitung') || s.includes('euronews') ||
      s.includes('london') || s.includes('paris') || s.includes('berlin') || s.includes('madrid') ||
      s.includes('rome') || s.includes('amsterdam') || s.includes('brussels') || s.includes('vienna') ||
      s.includes('zurich') || s.includes('geneva') || s.includes('stockholm') || s.includes('oslo') ||
      s.includes('copenhagen') || s.includes('helsinki') || s.includes('dublin') ||
      s.includes('deutsche ') || s.includes('deutschland') || s.includes('germany') ||
      s.includes('merz') || s.includes('berbok')) {
    return 'europe';
  }

  if (s.includes('africa') || s.includes('nigeria') || s.includes('kenya') || s.includes('south africa') ||
      s.includes('egypt') || s.includes('morocco') || s.includes('tunisia') || s.includes('algeria') ||
      s.includes('ghana') || s.includes('ethiopia') || s.includes('tanzania') || s.includes('uganda') ||
      s.includes('rwanda') || s.includes('zimbabwe') || s.includes('zambia') || s.includes('mozambique') ||
      s.includes('angola') || s.includes('senegal') || s.includes('ivory coast') || s.includes('congo') ||
      s.includes('mali') || s.includes('niger') || s.includes('chad') || s.includes('sudan') ||
      s.includes('libya')) {
    return 'africa';
  }

  if (s.includes('al jazeera') || s.includes('middle east') || s.includes('haaretz') ||
      s.includes('times of israel') || s.includes('jerusalem post') || s.includes('israel') ||
      s.includes('palestine') || s.includes('iran') || s.includes('iraq') || s.includes('syria') ||
      s.includes('lebanon') || s.includes('jordan') || s.includes('saudi') || s.includes('uae') ||
      s.includes('dubai') || s.includes('qatar') || s.includes('bahrain') || s.includes('yemen') ||
      s.includes('turkey') || s.includes('ankara') || s.includes('istanbul') || s.includes('doha') ||
      s.includes('riyadh') || s.includes('tehran') || s.includes('baghdad') || s.includes('beirut') ||
      s.includes('damascus') || s.includes('jerusalem') || s.includes('gaza') || s.includes('west bank') ||
      s.includes('golan') || s.includes('sinai') || s.includes('netanyahu') || s.includes('hamas') ||
      s.includes('hezbollah') || s.includes('houthi') || s.includes('persian gulf')) {
    return 'middle-east';
  }

  if (s.includes('latin') || s.includes('mexico') || s.includes('brazil') || s.includes('argentina') ||
      s.includes('chile') || s.includes('colombia') || s.includes('peru') || s.includes('venezuela') ||
      s.includes('ecuador') || s.includes('bolivia') || s.includes('paraguay') || s.includes('uruguay') ||
      s.includes('costa rica') || s.includes('panama') || s.includes('guatemala') || s.includes('honduras') ||
      s.includes('cuba') || s.includes('dominican') || s.includes('puerto rico') ||
      s.includes('sao paulo') || s.includes('buenos aires') || s.includes('santiago') ||
      s.includes('bogota') || s.includes('lima') || s.includes('caracas') || s.includes('mexico city') ||
      s.includes('la paz') || s.includes('quito') || s.includes('caribbean')) {
    return 'latin-america';
  }

  if (s.includes('asia') || s.includes('china') || s.includes('japan') || s.includes('south korea') ||
      s.includes('korea') || s.includes('india') || s.includes('australia') || s.includes('new zealand') ||
      s.includes('singapore') || s.includes('malaysia') || s.includes('indonesia') || s.includes('philippines') ||
      s.includes('vietnam') || s.includes('thailand') || s.includes('myanmar') || s.includes('cambodia') ||
      s.includes('bangladesh') || s.includes('pakistan') || s.includes('sri lanka') || s.includes('nepal') ||
      s.includes('mongolia') || s.includes('taiwan') || s.includes('hong kong') || s.includes('seoul') ||
      s.includes('tokyo') || s.includes('beijing') || s.includes('shanghai') || s.includes('delhi') ||
      s.includes('mumbai') || s.includes('sydney') || s.includes('melbourne') || s.includes('auckland') ||
      s.includes('wellington') || s.includes('bangkok') || s.includes('kuala lumpur') ||
      s.includes('jakarta') || s.includes('manila') || s.includes('ho chi minh') || s.includes('taipei') ||
      s.includes('hongkong') || s.includes('macau')) {
    return 'asia-pacific';
  }

  if (c.includes('energy') || c.includes('oil') || c.includes('gas') || s.includes('oilprice') ||
      c.includes('power') || c.includes('renewable') || c.includes('electricity') || c.includes('fuel') ||
      c.includes('petrol') || c.includes('refinery') || s.includes('opec') || s.includes('brent') ||
      s.includes('wti') || s.includes('natural gas') || s.includes('crude') || c.includes('solar') ||
      c.includes('wind') || c.includes('nuclear') || c.includes('coal') || c.includes('hydro') ||
      c.includes('geothermal')) {
    return 'energy';
  }

  if (c.includes('government') || c.includes('politics') || c.includes('election') || c.includes('policy') ||
      c.includes('state') || c.includes('parliament') || c.includes('congress') || c.includes('senate') ||
      c.includes('house') || c.includes('president') || c.includes('prime minister') ||
      c.includes('minister') || c.includes('official') || c.includes('diplomacy') ||
      c.includes('foreign') || c.includes('interior') || c.includes('justice') || c.includes('defense') ||
      c.includes('defence') || s.includes('capitol') || s.includes('duma') ||
      c.includes('legislation') || c.includes('regulation') || s.includes('biden') || s.includes('trump') ||
      s.includes('zelensky') || s.includes('modi')) {
    return 'government';
  }

  if (c.includes('thinktank') || c.includes('analysis') || c.includes('research') || c.includes('institute') ||
      c.includes('foundation') || c.includes('center') || c.includes('centre') || c.includes('academy') ||
      s.includes('chatham') || s.includes('csis') || s.includes('atlantic council') ||
      s.includes('hoover') || s.includes('peterson') || s.includes('wilson center') ||
      s.includes('stimson') || s.includes('council on foreign') || s.includes('cfr') ||
      s.includes('international crisis') || s.includes('icg') || s.includes('stockholm peace') ||
      s.includes('sipri') || s.includes('eiu') || s.includes('economist intelligence')) {
    return 'thinktank';
  }

  if (c.includes('forecast') || c.includes('prediction') || c.includes('outlook') ||
      c.includes('projection') || c.includes('estimate') || c.includes('forecasting') ||
      s.includes('forex') || s.includes('trading') || s.includes('market') || s.includes('finance') ||
      s.includes('economy') || s.includes('gold') || s.includes('stock') || s.includes('investing') ||
      s.includes('market watch') || s.includes('seeking alpha') || c.includes('economic') ||
      c.includes('financial') || c.includes('budget') || c.includes('deficit') || c.includes('inflation') ||
      c.includes('recession') || c.includes('gdp') || c.includes('growth') || c.includes('interest rate') ||
      c.includes('fed') || c.includes('central bank') || c.includes('monetary')) {
    return 'forecast';
  }

  return 'world';
}

// ============================================================
//  ЗАГРУЗКА — через basket-loader.mjs (поддерживает basket.v1 и легаси)
// ============================================================

async function loadData() {
  const primary = await loadWithFallback({
    basketFile: PRIMARY_FILE,
    fallbackData: null,
    hint: 'run node scripts/collectors/collect-rsshub.mjs && node scripts/warehouse/managerbasket.mjs',
  });

  if (primary.source === 'basket-v1' && primary.data) return primary.data;
  if (primary.source === 'basket-legacy' && primary.legacy) return primary.legacy;

  const secondary = await loadWithFallback({
    basketFile: FALLBACK_FILE,
    fallbackData: null,
    hint: 'run node scripts/collectors/collect-rss-universal.mjs',
  });
  if (secondary.data || secondary.legacy) return secondary.data || secondary.legacy;

  const legacy = await loadWithFallback({
    basketFile: LEGACY_FILE,
    fallbackData: null,
    hint: 'legacy rss-latest.json, сборщик collect-rss-feeds.mjs удалён',
  });
  if (legacy.legacy) return legacy.legacy;

  const err = new Error('no_data');
  err.statusCode = 503;
  err.hint = 'run node scripts/collectors/collect-rsshub.mjs && node scripts/warehouse/managerbasket.mjs';
  throw err;
}

/**
 * Универсальное извлечение документов/записей из разных форматов:
 *  - basket.v1: {schema:'crucix.basket.v1', documents:[{id,text,url,title,timestamp,region,extra}]}
 *  - легаси:    {items:[...]} | {feeds:[...]} | {data:[...]} | [...]
 *  - объекты:   любой массив внутри объекта.
 */
function extractDocuments(doc) {
  if (Array.isArray(doc)) return doc;
  if (!doc || typeof doc !== 'object') return [];
  if (Array.isArray(doc.documents)) return doc.documents;
  if (Array.isArray(doc.items)) return doc.items;
  if (Array.isArray(doc.feeds)) return doc.feeds;
  if (Array.isArray(doc.articles)) return doc.articles;
  if (Array.isArray(doc.data)) return doc.data;
  if (doc.data && Array.isArray(doc.data.items)) return doc.data.items;
  if (doc.data && Array.isArray(doc.data.documents)) return doc.data.documents;
  const result = [];
  for (const v of Object.values(doc)) if (Array.isArray(v)) result.push(...v);
  return result;
}

function normalizeItem(it, i) {
  // Совместимость: basket.v1 документы (text, url, title, timestamp, extra.source, extra.category)
  // и легаси-записи (description, link, source, category, pubDate).
  const source = (it.extra && it.extra.source) || it.source || it.sourceUrl || 'Неизвестный источник';
  const category = (it.extra && it.extra.category) || it.category || 'news';
  const region = detectRegion(source, category);
  const coords = REGION_COORDS[region] || REGION_COORDS['world'];
  const regionMeta = REGION_LABELS[region] || REGION_LABELS['world'];
  const rawDate = it.timestamp || it.pubDate || it.published || it.date || null;
  const date = rawDate ? String(rawDate).slice(0, 10) : null;
  const title = it.title || it.name || (it.text ? String(it.text).slice(0, 120) : 'Без названия');
  const summary = it.description || it.summary || it.content || it.text || '';

  return {
    id: String(it.id || it.guid || `rss-${i}`),
    title,
    summary,
    url: it.url || it.link || null,
    source,
    category,
    region,
    regionLabel: regionMeta.label,
    color: regionMeta.color,
    date,
    timestamp: rawDate,
    lat: coords[0],
    lng: coords[1],
    category_: 'news',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region)   r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.source)   r = r.filter(x => String(x.source).toLowerCase().includes(String(query.source).toLowerCase()));
  if (query.category) r = r.filter(x => String(x.category).toLowerCase().includes(String(query.category).toLowerCase()));
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.title + ' ' + x.summary + ' ' + x.source).toLowerCase().includes(q));
  }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  const sortKey = query.sort;
  if (sortKey === 'date-desc') r.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  else if (sortKey === 'date-asc') r.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  else if (sortKey === 'title') r.sort((a, b) => a.title.localeCompare(b.title));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegion = {};
  const bySource = {};
  const byCategory = {};
  for (const r of rows) {
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_region: byRegion,
    top_sources: top(bySource, 15),
    top_categories: top(byCategory, 10),
    unique_sources: Object.keys(bySource).length,
    unique_regions: Object.keys(byRegion).length,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, title: r.title, source: r.source, category: r.category,
      region: r.region, regionLabel: r.regionLabel, date: r.date, url: r.url,
      color: r.color, category_: r.category_, icon: r.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(REGION_LABELS).map(([key, v]) => ({ key, ...v })),
    meta: { total: rows.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, title: r.title, source: r.source, region: r.region, category: r.category, date: r.date }));
}

function toCSV(rows) {
  const lines = ['id,title,source,category,region,date,url'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.title, r.source, r.category, r.region, r.date, r.url].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function timeline(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, count: 0, by_region: {} };
    byDate[r.date].count++;
    byDate[r.date].by_region[r.region] = (byDate[r.date].by_region[r.region] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/rss-feeds/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const rawItems = extractDocuments(doc);
    const all = rawItems.map(normalizeItem);

    const extra = {
      'X-Module': 'rss-feeds-api',
      'X-Module-Version': '3.0.0',
      'X-Module-Source': meta.source,
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, source: meta.source, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, 50);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const r of all) {
        if (!byRegion[r.region]) byRegion[r.region] = { label: r.regionLabel, color: r.color, count: 0, sources: {} };
        byRegion[r.region].count++;
        byRegion[r.region].sources[r.source] = (byRegion[r.region].sources[r.source] || 0) + 1;
      }
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/sources') {
      const bySource = {};
      for (const r of all) bySource[r.source] = (bySource[r.source] || 0) + 1;
      const top = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { sources: top, total: Object.keys(bySource).length }, extra);
    }
    if (sub === '/categories') {
      const byCategory = {};
      for (const r of all) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { categories: top, total: Object.keys(byCategory).length }, extra);
    }
    if (sub === '/timeline') {
      const tl = timeline(all);
      return sendJSON(res, 200, { timeline: tl, days: tl.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length, source: meta.source } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_articles: all.length, returned_articles: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
