/**
 * apis/sources/currents-api.mjs — API-МОДУЛЬ: НОВОСТНОЙ АГРЕГАТОР CURRENTS
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/currents.json — { articles:[...], meta?, source? } ИЛИ [...] .
 * Сборщик: scripts/collectors/collect-currents.mjs.
 *
 * Агрегатор новостей (тип Currents API): статьи из множества источников,
 * с классификацией по регионам, категориям, ключевым словам, тональности.
 * Регион определяет координаты на карте (REGION_COORDS).
 *
 * Статья:
 *   { id, title, description?, url?, source, category?, region?, published?, author?,
 *     keywords?:[], image?, sentiment?: number(-1..1), language?, lat?, lng? }
 *
 * ФОРМАТЫ: json (FC + series + stats + timeline), csv, series, stats, raw, rss, report.
 * ФИЛЬТРЫ: ?source=, ?category=, ?region=, ?keyword=, ?q=, ?since=, ?until=, ?sentiment=,
 *          ?language=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                       — сводка
 *   GET /stats                  — агрегированная статистика
 *   GET /status                 — health-check
 *   GET /health                 — расширенный health
 *   GET /config                 — конфигурация (категории, регионы, цвета)
 *   GET /count                  — только числа
 *   GET /articles               — все статьи
 *   GET /articles/:id           — конкретная статья
 *   GET /latest                 — последние 50
 *   GET /recent?since=          — свежие после даты
 *   GET /top?n=N                — топ по важности
 *   GET /search?q=              — текстовый поиск
 *   GET /sources                — группировка по источникам
 *   GET /sources/:name          — статьи конкретного источника
 *   GET /categories             — группировка по категориям
 *   GET /categories/:name       — статьи конкретной категории
 *   GET /regions                — группировка по регионам
 *   GET /regions/:name          — статьи конкретного региона
 *   GET /keywords               — топ ключевых слов
 *   GET /timeline               — динамика по дням
 *   GET /trends                 — топ источников/категорий по периодам
 *   GET /sentiment-summary      — распределение по тональности
 *   GET /positive               — позитивные (sentiment > 0.3)
 *   GET /negative               — негативные (sentiment < -0.3)
 *   GET /neutral                — нейтральные
 *   GET /dedup                  — дубликаты (по title)
 *   GET /compare?ids=a,b,c      — сравнение статей
 *   GET /filter-presets         — готовые фильтры для UI
 *   GET /export                 — экспорт-отчёт (text)
 *   GET /reset-cache            — сброс кэша
 *   GET /featurecollection      — чистый GeoJSON
 *   GET /render                 — рендер-конфиг
 *   GET /rss                    — RSS 2.0 экспорт
 *   GET /builtin                — встроенный fallback (10 статей)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'currents.json');

export const route  = '/api/layers/currents';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📰',
  color: '#0ea5e9',
  vizType: 'marker',
  source: 'basket/currents.json',
  collector: 'collect-currents.mjs',
  cache: 300,
  description: 'Новостной агрегатор Currents: статьи, источники, регионы, категории, тональность',
  unit: 'articles',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const CATEGORY_META = {
  politics:        { color: '#dc2626', label: 'Политика' },
  economy:         { color: '#eab308', label: 'Экономика' },
  military:        { color: '#7c2d12', label: 'Военные действия' },
  cyber:           { color: '#0891b2', label: 'Кибербезопасность' },
  science:         { color: '#8b5cf6', label: 'Наука' },
  technology:      { color: '#0ea5e9', label: 'Технологии' },
  health:          { color: '#16a34a', label: 'Здоровье' },
  environment:     { color: '#22c55e', label: 'Экология' },
  energy:          { color: '#f97316', label: 'Энергетика' },
  disaster:        { color: '#be123c', label: 'Катастрофы' },
  business:        { color: '#0891b2', label: 'Бизнес' },
  sports:          { color: '#84cc16', label: 'Спорт' },
  culture:         { color: '#a855f7', label: 'Культура' },
  other:           { color: '#64748b', label: 'Прочее' },
};

const CATEGORY_KEYWORDS = {
  politics:    ['election','government','president','parliament','minister','diplomat','policy','vote','politics','политик','президент','правительство','выборы','министр'],
  economy:     ['market','inflation','gdp','economy','trade','stock','finance','investor','economy','экономик','рынок','инфляция','ввп','биржа'],
  military:    ['military','war','attack','defense','army','missile','combat','troops','военн','война','атак','оборон','армия','удар'],
  cyber:       ['cyber','hack','breach','malware','ransomware','cve','vulnerability','кибер','хакер','уязвим','взлом','малвар'],
  science:     ['research','study','science','discovery','experiment','наук','исследован','открыт','эксперимент'],
  technology:  ['technology','ai','robot','software','startup','chip','gpu','технолог','робот','софт','стартап'],
  health:      ['health','disease','virus','pandemic','vaccine','hospital','covid','здоров','болезн','вирус','вакцин','пандем'],
  environment: ['climate','environment','pollution','carbon','emission','green','эколог','климат','загрязнен','выброс'],
  energy:      ['oil','gas','energy','pipeline','opec','refinery','renewable','нефт','газ','энерг','трубопровод','опек'],
  disaster:    ['earthquake','flood','hurricane','wildfire','disaster','tsunami','catastrophe','землетряс','наводнен','ураган','пожар','катастроф','цунами'],
  business:    ['company','business','merger','acquisition','profit','revenue','bankruptcy','компан','бизнес','слиян','прибыл','банкрот'],
  sports:      ['sport','football','soccer','basketball','tennis','olympic','champion','спорт','футбол','олимп','чемпион'],
  culture:     ['culture','art','music','film','festival','museum','культур','искусств','музык','кино','фестивал','музе'],
};

const REGION_COORDS = {
  'europe':         [50.0, 15.0],
  'us':             [39.7, -98.8],
  'asia-pacific':   [10.0, 110.0],
  'middle-east':    [31.0, 40.0],
  'africa':         [0.0, 20.0],
  'latin-america':  [-15.0, -60.0],
  'russia-cis':     [61.5, 105.0],
  'south-asia':     [20.0, 78.0],
  'global':         [0.0, 0.0],
};

const REGION_LABELS = {
  'europe':         { label: 'Европа',                 color: '#3b82f6' },
  'us':             { label: 'США',                    color: '#dc2626' },
  'asia-pacific':   { label: 'Азия-Тихоокеанский',     color: '#f97316' },
  'middle-east':    { label: 'Ближний Восток',         color: '#eab308' },
  'africa':         { label: 'Африка',                 color: '#22c55e' },
  'latin-america':  { label: 'Латинская Америка',      color: '#84cc16' },
  'russia-cis':     { label: 'Россия/СНГ',             color: '#a855f7' },
  'south-asia':     { label: 'Южная Азия',             color: '#06b6d4' },
  'global':         { label: 'Глобально',              color: '#64748b' },
};

const SOURCE_REGION_HINTS = {
  // Россия/СНГ
  'tass': 'russia-cis', 'ria': 'russia-cis', 'interfax': 'russia-cis',
  'kommersant': 'russia-cis', 'vedomosti': 'russia-cis', 'sputnik': 'russia-cis',
  'lenta': 'russia-cis', 'rbc': 'russia-cis', 'moscow-times': 'russia-cis',
  // США
  'cnn': 'us', 'fox': 'us', 'nytimes': 'us', 'washingtonpost': 'us',
  'wsj': 'us', 'bloomberg': 'us', 'reuters': 'us', 'ap': 'us', 'npr': 'us',
  'politico': 'us', 'axios': 'us', 'thehill': 'us', 'usatoday': 'us',
  // Европа
  'guardian': 'europe', 'bbc': 'europe', 'skynews': 'europe',
  'economist': 'europe', 'ft': 'europe', 'france24': 'europe',
  'lemonde': 'europe', 'spiegel': 'europe', 'bild': 'europe',
  'faz': 'europe', 'euronews': 'europe', 'euobserver': 'europe',
  // Азия
  'scmp': 'asia-pacific', 'nikkei': 'asia-pacific', 'asahi': 'asia-pacific',
  'straitstimes': 'asia-pacific', 'japantimes': 'asia-pacific',
  'koreatimes': 'asia-pacific', 'globaltimes': 'asia-pacific',
  // Ближний Восток
  'aljazeera': 'middle-east', 'haaretz': 'middle-east', 'jpost': 'middle-east',
  'timesofisrael': 'middle-east', 'arabnews': 'middle-east',
  // Африка
  'africanews': 'africa', 'mailguardian': 'africa', 'nation': 'africa',
  // Латинская Америка
  'mercopress': 'latin-america', 'batimes': 'latin-america',
};

const FILTER_PRESETS = [
  { id: 'all',       label: 'Все статьи',              params: {} },
  { id: 'latest',    label: 'Последние 50',            params: { sort: 'date-desc', limit: 50 } },
  { id: 'cyber',     label: 'Кибербезопасность',       params: { category: 'cyber' } },
  { id: 'military',  label: 'Военные действия',        params: { category: 'military' } },
  { id: 'economy',   label: 'Экономика',               params: { category: 'economy' } },
  { id: 'positive',  label: 'Позитивные',              params: { sentiment: 'positive' } },
  { id: 'negative',  label: 'Негативные',              params: { sentiment: 'negative' } },
  { id: 'middle-east', label: 'Ближний Восток',        params: { region: 'middle-east' } },
  { id: 'europe',    label: 'Европа',                  params: { region: 'europe' } },
];

// ============================================================
//  ВСТРОЕННЫЙ FALLBACK (10 демо-статей)
// ============================================================

const BUILTIN_ARTICLES = [
  { id: 'currents-001', title: 'Крупная кибератака на энергосеть Европы',        description: 'Массовое отключение электроэнергии в нескольких странах ЕС', source: 'Reuters',  category: 'cyber',       region: 'europe',       published: '2026-09-13T10:15:00Z', sentiment: -0.7, keywords: ['cyber','energy','europe'],     language: 'en' },
  { id: 'currents-002', title: 'Новые санкции против российской нефти',          description: 'ЕС согласовал очередной пакет ограничений',              source: 'Bloomberg', category: 'economy',    region: 'russia-cis',   published: '2026-09-13T08:30:00Z', sentiment: -0.4, keywords: ['sanctions','oil','russia'],     language: 'en' },
  { id: 'currents-003', title: 'Переговоры по Тайваню возобновились',            description: 'Дипломатическая встреча высокого уровня',                 source: 'SCMP',      category: 'politics',   region: 'asia-pacific', published: '2026-09-13T06:00:00Z', sentiment:  0.5, keywords: ['taiwan','diplomacy','china'],   language: 'en' },
  { id: 'currents-004', title: 'Крупное землетрясение в Тихом океане',           description: 'Магнитуда 7.2, объявлено предупреждение о цунами',        source: 'AP',        category: 'disaster',   region: 'asia-pacific', published: '2026-09-12T22:45:00Z', sentiment: -0.9, keywords: ['earthquake','tsunami','pacific'], language: 'en' },
  { id: 'currents-005', title: 'Прорыв в области квантовых вычислений',          description: 'Новый кубит с рекордной стабильностью',                   source: 'Nature',    category: 'science',    region: 'global',       published: '2026-09-12T18:00:00Z', sentiment:  0.8, keywords: ['quantum','science','breakthrough'], language: 'en' },
  { id: 'currents-006', title: 'Протесты в столице Аргентины',                    description: 'Массовые демонстрации против экономической политики',     source: 'MercoPress',category: 'politics',   region: 'latin-america', published: '2026-09-12T15:30:00Z', sentiment: -0.6, keywords: ['protest','argentina','economy'], language: 'en' },
  { id: 'currents-007', title: 'Обострение на Ближнем Востоке',                   description: 'Ракетный обмен между двумя сторонами конфликта',          source: 'Aljazeera', category: 'military',   region: 'middle-east',  published: '2026-09-12T12:00:00Z', sentiment: -0.85, keywords: ['conflict','missiles','middle-east'], language: 'en' },
  { id: 'currents-008', title: 'Новая вакцина против малярии одобрена ВОЗ',      description: 'Массовая вакцинация начнётся в 2027',                     source: 'WHO',       category: 'health',     region: 'africa',       published: '2026-09-11T20:00:00Z', sentiment:  0.9, keywords: ['health','vaccine','africa'],     language: 'en' },
  { id: 'currents-009', title: 'Meta выпустила новую модель ИИ',                  description: 'Модель превосходит предыдущую по всем бенчмаркам',        source: 'TechCrunch',category: 'technology', region: 'us',           published: '2026-09-11T16:15:00Z', sentiment:  0.6, keywords: ['ai','meta','technology'],       language: 'en' },
  { id: 'currents-010', title: 'Пожар в Калифорнии распространяется',             description: 'Более 20 тысяч гектаров в огне, идёт эвакуация',           source: 'CNN',       category: 'disaster',   region: 'us',           published: '2026-09-11T09:00:00Z', sentiment: -0.7, keywords: ['wildfire','california','evacuation'], language: 'en' },
];

// ============================================================
//  IN-MEMORY КЭШ
// ============================================================

const _cache = new Map();
const CACHE_TTL = 60_000;
function cacheGet(key) {
  const item = _cache.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) { _cache.delete(key); return null; }
  return item.value;
}
function cachePut(key, value) { _cache.set(key, { value, expires: Date.now() + CACHE_TTL }); }
function cacheClear() { _cache.clear(); return _cache.size; }

// ============================================================
//  ЗАГРУЗКА BASKET
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-currents.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractArticles(doc) {
  if (Array.isArray(doc)) return { articles: doc, source: null, meta: null };
  if (!doc || typeof doc !== 'object') return { articles: [], source: null, meta: null };
  if (Array.isArray(doc.articles)) return { articles: doc.articles, source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.data))     return { articles: doc.data,     source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.items))    return { articles: doc.items,    source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.news))     return { articles: doc.news,     source: doc.source || null, meta: doc.meta || null };
  return { articles: [], source: null, meta: null };
}

// ============================================================
//  КЛАССИФИКАТОРЫ
// ============================================================

function detectCategory(article) {
  if (article.category && CATEGORY_META[String(article.category).toLowerCase()]) {
    return String(article.category).toLowerCase();
  }
  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const w of words) {
      if (text.includes(w)) return cat;
    }
  }
  return 'other';
}

function detectRegion(article) {
  if (article.region && REGION_COORDS[String(article.region).toLowerCase()]) {
    return String(article.region).toLowerCase();
  }
  const sourceKey = String(article.source || '').toLowerCase().replace(/[^a-z]/g, '');
  for (const [hint, region] of Object.entries(SOURCE_REGION_HINTS)) {
    if (sourceKey.includes(hint)) return region;
  }
  return 'global';
}

function normalizeSentiment(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(Math.max(-1, Math.min(1, n)).toFixed(2));
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeArticle(a, i) {
  const id = String(a.id || a.guid || `currents-${i}`);
  const title = a.title || a.headline || `Статья ${i}`;
  const source = a.source?.name || a.source || 'Неизвестный источник';
  const category = detectCategory(a);
  const region = detectRegion(a);
  const coords = REGION_COORDS[region] || REGION_COORDS['global'];
  const regionMeta = REGION_LABELS[region] || REGION_LABELS['global'];
  const catMeta = CATEGORY_META[category] || CATEGORY_META.other;

  const rawDate = a.published || a.publishedAt || a.date || a.timestamp || null;
  const published = rawDate ? String(rawDate) : null;
  const date = published ? published.slice(0, 10) : null;

  let lat = Number(a.lat ?? a.latitude);
  let lng = Number(a.lng ?? a.lon ?? a.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = coords[0]; lng = coords[1];
  }

  const sentiment = normalizeSentiment(a.sentiment);

  return {
    id,
    title,
    description: a.description || a.summary || '',
    url: a.url || a.link || null,
    source,
    author: a.author || a.byline || null,
    category,
    categoryColor: catMeta.color,
    categoryLabel: catMeta.label,
    region,
    regionLabel: regionMeta.label,
    regionColor: regionMeta.color,
    published,
    date,
    keywords: Array.isArray(a.keywords) ? a.keywords : (Array.isArray(a.tags) ? a.tags : []),
    image: a.image || a.imageUrl || null,
    language: a.language || a.lang || null,
    sentiment,
    sentimentLabel: sentiment == null ? 'unknown' : (sentiment > 0.3 ? 'positive' : (sentiment < -0.3 ? 'negative' : 'neutral')),
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    category_: 'news',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.source)   r = r.filter(x => String(x.source).toLowerCase().includes(String(query.source).toLowerCase()));
  if (query.category) r = r.filter(x => x.category === String(query.category).toLowerCase());
  if (query.region)   r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.language) r = r.filter(x => String(x.language || '').toLowerCase() === String(query.language).toLowerCase());
  if (query.keyword)  {
    const k = String(query.keyword).toLowerCase();
    r = r.filter(x => x.keywords.some(kw => String(kw).toLowerCase().includes(k)));
  }
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.title + ' ' + x.description + ' ' + x.source).toLowerCase().includes(q));
  }
  if (query.sentiment) {
    const s = String(query.sentiment).toLowerCase();
    r = r.filter(x => x.sentimentLabel === s);
  }
  if (query.min_sentiment != null) { const n = Number(query.min_sentiment); if (Number.isFinite(n)) r = r.filter(x => x.sentiment != null && x.sentiment >= n); }
  if (query.max_sentiment != null) { const n = Number(query.max_sentiment); if (Number.isFinite(n)) r = r.filter(x => x.sentiment != null && x.sentiment <= n); }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));

  const sortKey = query.sort || 'date-desc';
  if (sortKey === 'date-desc')       r.sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));
  else if (sortKey === 'date-asc')   r.sort((a, b) => String(a.published || '').localeCompare(String(b.published || '')));
  else if (sortKey === 'title')      r.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortKey === 'source')     r.sort((a, b) => String(a.source).localeCompare(String(b.source)));
  else if (sortKey === 'sentiment-desc') r.sort((a, b) => (b.sentiment ?? 0) - (a.sentiment ?? 0));
  else if (sortKey === 'sentiment-asc')  r.sort((a, b) => (a.sentiment ?? 0) - (b.sentiment ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byCategory = {};
  const byRegion = {};
  const bySource = {};
  const bySentimentLabel = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
  const sentiments = [];
  const dates = [];

  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    bySentimentLabel[r.sentimentLabel] = (bySentimentLabel[r.sentimentLabel] || 0) + 1;
    if (r.sentiment != null) sentiments.push(r.sentiment);
    if (r.date) dates.push(r.date);
  }

  const top = (obj, n = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  const sentimentStats = sentiments.length ? {
    mean: Number((sentiments.reduce((a, b) => a + b, 0) / sentiments.length).toFixed(3)),
    min: Number(Math.min(...sentiments).toFixed(2)),
    max: Number(Math.max(...sentiments).toFixed(2)),
    positive_count: sentiments.filter(v => v > 0.3).length,
    negative_count: sentiments.filter(v => v < -0.3).length,
    neutral_count: sentiments.filter(v => v >= -0.3 && v <= 0.3).length,
  } : null;

  return {
    count: rows.length,
    with_coords: rows.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng)).length,
    with_sentiment: sentiments.length,
    by_category: byCategory,
    by_region: byRegion,
    by_sentiment_label: bySentimentLabel,
    top_sources: top(bySource, 15),
    top_categories: top(byCategory, 10),
    top_regions: top(byRegion, 10),
    sentiment: sentimentStats,
    date_from: dates.sort()[0] || null,
    date_to: dates.sort().slice(-1)[0] || null,
  };
}

function computeTimeline(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, count: 0, by_category: {}, by_region: {} };
    byDate[r.date].count++;
    byDate[r.date].by_category[r.category] = (byDate[r.date].by_category[r.category] || 0) + 1;
    byDate[r.date].by_region[r.region] = (byDate[r.date].by_region[r.region] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function computeKeywords(rows, topN = 30) {
  const counter = {};
  for (const r of rows) {
    for (const k of r.keywords) {
      const key = String(k).toLowerCase();
      if (!key) continue;
      counter[key] = (counter[key] || 0) + 1;
    }
  }
  return Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({ name, count }));
}

function findDuplicates(rows) {
  const groups = {};
  for (const r of rows) {
    const key = String(r.title || '').toLowerCase().trim().replace(/[^a-zа-яё0-9 ]/g, '').slice(0, 80);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r.id);
  }
  return Object.entries(groups).filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids, count: ids.length }));
}

function toReport(rows, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  CURRENTS REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего статей: ${rows.length}`);
  lines.push(`С координатами: ${stats.with_coords}`);
  lines.push(`С тональностью: ${stats.with_sentiment}`);
  lines.push('');
  lines.push(`Тональность — mean: ${stats.sentiment?.mean ?? 'n/a'}  positive: ${stats.sentiment?.positive_count ?? 0}  negative: ${stats.sentiment?.negative_count ?? 0}  neutral: ${stats.sentiment?.neutral_count ?? 0}`);
  lines.push('');
  lines.push('ТОП-10 источников:');
  for (const s of stats.top_sources.slice(0, 10)) lines.push(`  ${String(s.count).padStart(4)}  ${s.name}`);
  lines.push('');
  lines.push('ТОП-10 категорий:');
  for (const c of stats.top_categories.slice(0, 10)) lines.push(`  ${String(c.count).padStart(4)}  ${c.name}`);
  lines.push('');
  lines.push('ТОП-10 регионов:');
  for (const r of stats.top_regions.slice(0, 10)) lines.push(`  ${String(r.count).padStart(4)}  ${r.name}`);
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, title: r.title, description: r.description, url: r.url,
        source: r.source, author: r.author,
        category: r.category, categoryLabel: r.categoryLabel, categoryColor: r.categoryColor,
        region: r.region, regionLabel: r.regionLabel, regionColor: r.regionColor,
        published: r.published, date: r.date,
        keywords: r.keywords, language: r.language, image: r.image,
        sentiment: r.sentiment, sentimentLabel: r.sentimentLabel,
        category_: r.category_, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      categories: Object.entries(CATEGORY_META).map(([key, def]) => ({ key, ...def })),
      regions: Object.entries(REGION_LABELS).map(([key, def]) => ({ key, ...def })),
    },
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, title: r.title, source: r.source,
    category: r.category, region: r.region,
    published: r.published, date: r.date,
    sentiment: r.sentiment, language: r.language,
  }));
}

function toCSV(rows) {
  const lines = ['id,title,source,category,region,published,date,sentiment,sentiment_label,language,url'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) {
    lines.push([r.id, r.title, r.source, r.category, r.region, r.published, r.date, r.sentiment, r.sentimentLabel, r.language, r.url].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRSS(rows, channelTitle = 'Crucix Currents', channelLink = 'http://localhost:3117') {
  const items = rows.slice(0, 100).map(r => {
    const link = r.url || `${channelLink}/article/${r.id}`;
    const pubDate = r.published || new Date().toISOString();
    return [
      '    <item>',
      `      <title>${escapeXml(r.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(r.id)}</guid>`,
      r.description ? `      <description>${escapeXml(r.description)}</description>` : '',
      `      <pubDate>${new Date(pubDate).toUTCString()}</pubDate>`,
      r.category ? `      <category>${escapeXml(r.category)}</category>` : '',
      r.source ? `      <source url="${escapeXml(link)}">${escapeXml(r.source)}</source>` : '',
      '    </item>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>Crucix news aggregator</description>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');
}

function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRenderConfig(rows) {
  const markers = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      id: r.id, lat: r.lat, lng: r.lng,
      color: r.regionColor,
      icon: r.icon,
      properties: {
        title: r.title, source: r.source,
        category: r.category, region: r.region,
        sentiment: r.sentiment, sentimentLabel: r.sentimentLabel,
        published: r.published, url: r.url,
      },
    }));
  return {
    markers,
    legend: {
      categories: Object.entries(CATEGORY_META).map(([key, def]) => ({ key, ...def })),
      regions: Object.entries(REGION_LABELS).map(([key, def]) => ({ key, ...def })),
    },
    filterable: ['source', 'category', 'region', 'keyword', 'sentiment', 'language', 'since', 'until', 'sort'],
    totals: { markers: markers.length },
  };
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/currents/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'currents-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ---- Не-basket эндпоинты ----

    if (sub === '/builtin') {
      const rows = BUILTIN_ARTICLES.map(normalizeArticle);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        meta: { source: 'builtin', count: rows.length, generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/config') {
      return sendJSON(res, 200, {
        categories: Object.entries(CATEGORY_META).map(([k, v]) => ({ key: k, ...v })),
        regions: Object.entries(REGION_LABELS).map(([k, v]) => ({ key: k, ...v })),
        filter_presets: FILTER_PRESETS,
        source_hints: Object.keys(SOURCE_REGION_HINTS).length,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

    // ---- Basket-зависимые ----

    let doc;
    try { doc = await loadData(); }
    catch (e) {
      if (e.statusCode === 503 && (sub === '/health' || sub === '/status')) {
        return sendJSON(res, 200, {
          status: 'degraded', basket_available: false, hint: e.hint,
          generated_at: new Date().toISOString(),
        }, extra);
      }
      throw e;
    }

    const { articles: rawArr, source, meta: srcMeta } = extractArticles(doc);
    const all = rawArr.map(normalizeArticle);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        basket_available: true,
        articles: all.length,
        sources: new Set(all.map(r => r.source)).size,
        regions: new Set(all.map(r => r.region)).size,
        categories: new Set(all.map(r => r.category)).size,
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }

    if (sub === '/count') {
      const counts = {
        total: all.length,
        by_category: {},
        by_region: {},
        by_sentiment_label: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
        sources: new Set(all.map(r => r.source)).size,
      };
      for (const r of all) {
        counts.by_category[r.category] = (counts.by_category[r.category] || 0) + 1;
        counts.by_region[r.region] = (counts.by_region[r.region] || 0) + 1;
        counts.by_sentiment_label[r.sentimentLabel] = (counts.by_sentiment_label[r.sentimentLabel] || 0) + 1;
      }
      return sendJSON(res, 200, { counts }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online', articles: all.length, source,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/articles') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { articles: rows, count: rows.length, total: all.length }, extra);
    }
    if (sub.startsWith('/articles/')) {
      const id = decodeURIComponent(sub.slice('/articles/'.length));
      const article = all.find(r => r.id === id);
      if (!article) return sendJSON(res, 404, { error: 'article_not_found', id }, extra);
      return sendJSON(res, 200, { article }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice().sort((a, b) => String(b.published || '').localeCompare(String(a.published || ''))).slice(0, 50);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
    }
    if (sub === '/recent') {
      const since = query.since || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const rows = all.filter(r => r.date && r.date >= since.slice(0, 10))
        .sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));
      return sendJSON(res, 200, { recent: rows, count: rows.length, since }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 20;
      const rows = all.slice().sort((a, b) => String(b.published || '').localeCompare(String(a.published || ''))).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(r => (r.title + ' ' + r.description + ' ' + r.source + ' ' + r.keywords.join(' ')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/sources') {
      const bySource = {};
      for (const r of all) {
        if (!bySource[r.source]) bySource[r.source] = { name: r.source, count: 0, categories: {}, regions: {} };
        bySource[r.source].count++;
        bySource[r.source].categories[r.category] = (bySource[r.source].categories[r.category] || 0) + 1;
        bySource[r.source].regions[r.region] = (bySource[r.source].regions[r.region] || 0) + 1;
      }
      const sources = Object.values(bySource).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { sources, total: sources.length }, extra);
    }
    if (sub.startsWith('/sources/')) {
      const name = decodeURIComponent(sub.slice('/sources/'.length));
      const rows = all.filter(r => String(r.source).toLowerCase() === name.toLowerCase());
      if (!rows.length) return sendJSON(res, 404, { error: 'source_not_found', name }, extra);
      return sendJSON(res, 200, { source: name, articles: rows, count: rows.length }, extra);
    }
    if (sub === '/categories') {
      const byCategory = {};
      for (const r of all) {
        if (!byCategory[r.category]) byCategory[r.category] = { name: r.category, label: r.categoryLabel, color: r.categoryColor, count: 0, sources: {} };
        byCategory[r.category].count++;
        byCategory[r.category].sources[r.source] = (byCategory[r.category].sources[r.source] || 0) + 1;
      }
      return sendJSON(res, 200, { categories: Object.values(byCategory), total: Object.keys(byCategory).length }, extra);
    }
    if (sub.startsWith('/categories/')) {
      const name = decodeURIComponent(sub.slice('/categories/'.length));
      const rows = all.filter(r => r.category === name.toLowerCase());
      if (!rows.length) return sendJSON(res, 404, { error: 'category_not_found', name }, extra);
      return sendJSON(res, 200, { category: name, articles: rows, count: rows.length }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const r of all) {
        if (!byRegion[r.region]) byRegion[r.region] = { name: r.region, label: r.regionLabel, color: r.regionColor, count: 0, coords: [r.lat, r.lng] };
        byRegion[r.region].count++;
      }
      return sendJSON(res, 200, { regions: Object.values(byRegion), total: Object.keys(byRegion).length }, extra);
    }
    if (sub.startsWith('/regions/')) {
      const name = decodeURIComponent(sub.slice('/regions/'.length));
      const rows = all.filter(r => r.region === name.toLowerCase());
      if (!rows.length) return sendJSON(res, 404, { error: 'region_not_found', name }, extra);
      return sendJSON(res, 200, { region: name, articles: rows, count: rows.length }, extra);
    }
    if (sub === '/keywords') {
      const topN = parseInt(query.top, 10) || 30;
      const keywords = computeKeywords(all, topN);
      return sendJSON(res, 200, { keywords, top: topN }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(all);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const trends = {
        top_sources: computeStats(all).top_sources.slice(0, 20),
        top_categories: computeStats(all).top_categories.slice(0, 10),
        top_regions: computeStats(all).top_regions.slice(0, 10),
      };
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/sentiment-summary') {
      const stats = computeStats(all);
      return sendJSON(res, 200, { sentiment: stats.sentiment, by_label: stats.by_sentiment_label }, extra);
    }
    if (sub === '/positive') {
      const rows = all.filter(r => r.sentiment != null && r.sentiment > 0.3);
      return sendJSON(res, 200, { positive: rows, count: rows.length }, extra);
    }
    if (sub === '/negative') {
      const rows = all.filter(r => r.sentiment != null && r.sentiment < -0.3);
      return sendJSON(res, 200, { negative: rows, count: rows.length }, extra);
    }
    if (sub === '/neutral') {
      const rows = all.filter(r => r.sentiment != null && r.sentiment >= -0.3 && r.sentiment <= 0.3);
      return sendJSON(res, 200, { neutral: rows, count: rows.length }, extra);
    }
    if (sub === '/dedup') {
      const groups = findDuplicates(all);
      return sendJSON(res, 200, { duplicate_groups: groups, count: groups.length }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(r => r.id === id)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(all);
      const report = toReport(all, stats);
      return sendText(res, 200, report, 'text/plain; charset=utf-8');
    }
    if (sub === '/reset-cache') {
      const before = _cache.size;
      cacheClear();
      return sendJSON(res, 200, { cleared: before, now: _cache.size }, extra);
    }
    if (sub === '/rss' || format === 'rss') {
      const rows = applyFilters(all, query);
      const xml = toRSS(rows);
      return sendText(res, 200, xml, 'application/rss+xml; charset=utf-8');
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_articles: all.length,
        returned_articles: rows.length,
        upstream_source: source,
        upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      timeline: computeTimeline(rows).slice(0, 30),
      latest: rows.slice().sort((a, b) => String(b.published || '').localeCompare(String(a.published || ''))).slice(0, 5),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
