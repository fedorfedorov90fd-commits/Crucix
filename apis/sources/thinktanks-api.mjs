/**
 * apis/sources/thinktanks-api.mjs — API-МОДУЛЬ: АНАЛИТИЧЕСКИЕ ЦЕНТРЫ И ПРОГНОЗЫ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/thinktanks.json — { centers:[...], reports:[...], predictions:[...] }
 *           ИЛИ fallback встроенный (10 центров + 8 отчётов + 4 прогноза).
 * Сборщик: scripts/collectors/collect-thinktanks.mjs.
 *
 * Аналитические центры (RAND, CSIS, IISS, Chatham House, CFR, Brookings,
 * Carnegie, SWP, RUSI, ISW) и их прогнозные отчёты о геополитике,
 * безопасности, экономике, ядерной политике.
 *
 * Точка центра:
 *   { id, name, country, city, founded, focus:[], website, lat, lng, active }
 *
 * Отчёт:
 *   { id, center, title, date, region, summary, keyPoints:[], confidence, severity, tags:[], url }
 *
 * Прогноз:
 *   { id, center, title, date, prediction, confidence, timeframe, region }
 *
 * ФОРМАТЫ: json (FC + series + stats + reports + predictions), csv, series, stats, raw, report, text.
 * ФИЛЬТРЫ: ?center=, ?region=, ?severity=, ?focus=, ?country=, ?q=, ?min_confidence=, ?since=, ?limit=, ?top=, ?sort=.
 *
 * ОСНОВНЫЕ ПОДПУТИ:
 *   /                          — сводка (FC + centers + reports + predictions)
 *   /stats /status /health     — метрики и состояние
 *   /config /filter-presets    — конфигурация и пресеты
 *   /centers /centers/:id      — центры
 *   /reports /reports/:id      — отчёты
 *   /report/:id                — алиас для /reports/:id
 *   /predictions /prediction/:id — прогнозы
 *   /summary /regions          — сводка и регионы
 *   /top /bottom               — топы
 *   /by-center /by-region /by-severity /by-focus /by-country — группировки
 *   /critical /high-confidence — по severity и confidence
 *   /recent /latest            — свежие
 *   /search /compare           — поиск и сравнение
 *   /timeline /trends          — динамика
 *   /export /reset-cache       — сервис
 *   /featurecollection /render — GeoJSON и рендер
 *   /builtin                   — встроенный fallback
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'thinktanks.json');

export const route  = '/api/layers/thinktanks';
export const method = 'GET';

export const meta = {
  category: 'intelligence',
  icon: '🏛️',
  color: '#8b5cf6',
  vizType: 'marker',
  source: 'basket/thinktanks.json',
  collector: 'collect-thinktanks.mjs',
  cache: 600,
  description: 'Аналитические центры мира и их прогнозные отчёты (RAND, CSIS, IISS, CFR, Brookings)',
  unit: 'reports',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const SEVERITY_META = {
  critical: { color: '#dc2626', label: 'Критический',  severity: 4 },
  high:     { color: '#f97316', label: 'Высокий',       severity: 3 },
  medium:   { color: '#eab308', label: 'Средний',       severity: 2 },
  low:      { color: '#22c55e', label: 'Низкий',        severity: 1 },
  unknown:  { color: '#64748b', label: 'Неизвестно',    severity: 0 },
};

const FOCUS_META = {
  military:    { color: '#dc2626', label: 'Военные исследования' },
  geopolitics: { color: '#8b5cf6', label: 'Геополитика' },
  economy:     { color: '#eab308', label: 'Экономика' },
  security:    { color: '#0ea5e9', label: 'Безопасность' },
  nuclear:     { color: '#be123c', label: 'Ядерная политика' },
  defence:     { color: '#7c2d12', label: 'Оборона' },
  strategy:    { color: '#a855f7', label: 'Стратегия' },
  foreign:     { color: '#3b82f6', label: 'Внешняя политика' },
  technology:  { color: '#22c55e', label: 'Технологии' },
  environment: { color: '#16a34a', label: 'Экология' },
};

const REGION_COORDS = {
  'global':       [0.0, 0.0],
  'ukraine':      [48.4, 31.2],
  'middle-east':  [31.0, 40.0],
  'europe':       [50.0, 15.0],
  'asia-pacific': [10.0, 110.0],
  'africa':       [0.0, 20.0],
  'americas':     [-15.0, -60.0],
  'russia-cis':   [61.5, 105.0],
  'south-asia':   [20.0, 78.0],
  'arctic':       [75.0, 0.0],
};

// 10 центров с координатами
const BUILTIN_CENTERS = [
  { id: 'rand',       name: 'RAND Corporation',           country: 'США',        city: 'Santa Monica, CA', lat: 34.0195, lng: -118.4912, founded: 1948, focus: ['strategy','security','technology'], website: 'https://www.rand.org',  active: true },
  { id: 'csis',       name: 'CSIS',                       country: 'США',        city: 'Washington, DC',   lat: 38.9072, lng: -77.0369,   founded: 1962, focus: ['geopolitics','security','economy'], website: 'https://www.csis.org', active: true },
  { id: 'iiss',       name: 'IISS',                       country: 'Великобритания', city: 'London',      lat: 51.5074, lng: -0.1278,    founded: 1958, focus: ['military','defence','strategy'], website: 'https://www.iiss.org', active: true },
  { id: 'chatham',    name: 'Chatham House',              country: 'Великобритания', city: 'London',      lat: 51.5074, lng: -0.1278,    founded: 1920, focus: ['geopolitics','foreign','economy'], website: 'https://www.chathamhouse.org', active: true },
  { id: 'cfr',        name: 'Council on Foreign Relations',country: 'США',       city: 'New York, NY',     lat: 40.7128, lng: -74.0060,   founded: 1921, focus: ['foreign','geopolitics','security'], website: 'https://www.cfr.org', active: true },
  { id: 'brookings',  name: 'Brookings Institution',      country: 'США',        city: 'Washington, DC',   lat: 38.9072, lng: -77.0369,   founded: 1916, focus: ['economy','geopolitics','foreign'], website: 'https://www.brookings.edu', active: true },
  { id: 'carnegie',   name: 'Carnegie Endowment',         country: 'США / Россия', city: 'Washington, DC / Moscow', lat: 38.9072, lng: -77.0369, founded: 1910, focus: ['nuclear','foreign','geopolitics'], website: 'https://carnegieendowment.org', active: true },
  { id: 'swp',        name: 'SWP',                        country: 'Германия',   city: 'Berlin',           lat: 52.5200, lng: 13.4050,    founded: 1962, focus: ['geopolitics','security','europe'], website: 'https://www.swp-berlin.org', active: true },
  { id: 'rusi',       name: 'RUSI',                       country: 'Великобритания', city: 'London',      lat: 51.5074, lng: -0.1278,    founded: 1831, focus: ['defence','security','military'], website: 'https://www.rusi.org', active: true },
  { id: 'isw',        name: 'ISW',                        country: 'США',        city: 'Washington, DC',   lat: 38.9072, lng: -77.0369,   founded: 2007, focus: ['military','geopolitics','security'], website: 'https://www.understandingwar.org', active: true },
];

// 8 демо-отчётов
const BUILTIN_REPORTS = [
  { id: 'rpt-001', center: 'isw',      title: 'Russian Offensive Campaign Assessment', date: '2026-08-13', region: 'ukraine',      summary: 'Russia continues offensive operations in Donetsk Oblast. Ukrainian forces maintain defensive positions.',       keyPoints: ['Russian advances in Donetsk','Ukrainian counterattacks','Stalemate on frontlines'], confidence: 85, severity: 'high',     tags: ['military','ukraine','russia'],     url: 'https://www.understandingwar.org' },
  { id: 'rpt-002', center: 'rand',     title: 'Middle East Conflict Dynamics',       date: '2026-08-12', region: 'middle-east',  summary: 'Escalation risks in the Persian Gulf. Iran-US tensions remain high.',                                          keyPoints: ['Iran-US tensions','Gulf security','Energy market risks'],                        confidence: 75, severity: 'high',     tags: ['middle-east','iran','energy'],     url: 'https://www.rand.org' },
  { id: 'rpt-003', center: 'iiss',     title: 'Military Balance 2026',                date: '2026-08-10', region: 'global',       summary: 'Global military spending continues to rise. China and Russia increase defence budgets significantly.',        keyPoints: ['Military spending growth','Arms race','Strategic shifts'],                       confidence: 90, severity: 'medium',   tags: ['military','global','strategy'],    url: 'https://www.iiss.org' },
  { id: 'rpt-004', center: 'chatham',  title: 'Europe Security After Ukraine',        date: '2026-08-11', region: 'europe',       summary: 'NATO expansion and European security architecture. Challenges in the post-war era.',                          keyPoints: ['NATO expansion','European defence','Russian relations'],                         confidence: 80, severity: 'medium',   tags: ['europe','nato','security'],        url: 'https://www.chathamhouse.org' },
  { id: 'rpt-005', center: 'cfr',      title: 'South China Sea Strategic Update',     date: '2026-08-09', region: 'asia-pacific', summary: 'Increased Chinese military presence in the South China Sea. US-Philippines cooperation intensifies.',         keyPoints: ['China military expansion','US alliances','Regional tensions'],                    confidence: 85, severity: 'high',     tags: ['asia-pacific','china','maritime'], url: 'https://www.cfr.org' },
  { id: 'rpt-006', center: 'carnegie', title: 'Nuclear Risk Assessment',             date: '2026-08-08', region: 'global',       summary: 'Nuclear proliferation risks increase. Iran and North Korea nuclear programs advance.',                        keyPoints: ['Nuclear proliferation','Iran nuclear program','North Korea'],                     confidence: 70, severity: 'critical', tags: ['nuclear','iran','north-korea'],    url: 'https://carnegieendowment.org' },
  { id: 'rpt-007', center: 'brookings',title: 'Global Economic Outlook',              date: '2026-08-07', region: 'global',       summary: 'Inflation concerns persist. Central banks maintain high interest rates.',                                     keyPoints: ['Inflation','Interest rates','Economic slowdown'],                                confidence: 75, severity: 'medium',   tags: ['economy','global','inflation'],    url: 'https://www.brookings.edu' },
  { id: 'rpt-008', center: 'swp',      title: 'EU Strategic Autonomy',                date: '2026-08-06', region: 'europe',       summary: 'European defence integration progresses. New security initiatives emerge.',                                    keyPoints: ['EU defence','Strategic autonomy','Transatlantic relations'],                    confidence: 70, severity: 'medium',   tags: ['europe','eu','defence'],           url: 'https://www.swp-berlin.org' },
];

const BUILTIN_PREDICTIONS = [
  { id: 'pred-001', center: 'rand',     title: 'Iran-Israel Escalation Risk',   date: '2026-08-14', prediction: 'Probability of direct Iran-Israel conflict increased to 65% in next 60 days', confidence: 78, timeframe: '60 days', region: 'middle-east' },
  { id: 'pred-002', center: 'isw',      title: 'Ukraine War Outlook',            date: '2026-08-14', prediction: 'Stalemate continues through autumn. No major territorial changes expected.',   confidence: 82, timeframe: '3 months', region: 'ukraine' },
  { id: 'pred-003', center: 'cfr',      title: 'US-China Relations',             date: '2026-08-13', prediction: 'US-China tensions remain elevated. Risk of incident in South China Sea.',      confidence: 70, timeframe: '30 days', region: 'asia-pacific' },
  { id: 'pred-004', center: 'carnegie', title: 'Nuclear Proliferation',          date: '2026-08-13', prediction: 'Iran nuclear program moves closer to weapons capability. Diplomatic window narrowing.', confidence: 65, timeframe: '90 days', region: 'global' },
];

const FILTER_PRESETS = [
  { id: 'all',          label: 'Все отчёты',             params: {} },
  { id: 'critical',     label: 'Критические',            params: { severity: 'critical' } },
  { id: 'high-conf',    label: 'Высокая уверенность',    params: { min_confidence: 80 } },
  { id: 'ukraine',      label: 'Украина',                params: { region: 'ukraine' } },
  { id: 'middle-east',  label: 'Ближний Восток',         params: { region: 'middle-east' } },
  { id: 'asia',         label: 'Азия-Пацифика',          params: { region: 'asia-pacific' } },
  { id: 'nuclear',      label: 'Ядерная тематика',       params: { focus: 'nuclear' } },
];

// ============================================================
//  IN-MEMORY КЭШ
// ============================================================

const _cache = new Map();
const CACHE_TTL = 120_000;
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
      err.hint = 'run scripts/collectors/collect-thinktanks.mjs';
      err.fallback = { centers: BUILTIN_CENTERS, reports: BUILTIN_REPORTS, predictions: BUILTIN_PREDICTIONS };
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractDoc(doc) {
  if (Array.isArray(doc)) return { centers: [], reports: doc, predictions: [], meta: null };
  if (!doc || typeof doc !== 'object') return { centers: [], reports: [], predictions: [], meta: null };
  return {
    centers: Array.isArray(doc.centers) ? doc.centers : [],
    reports: Array.isArray(doc.reports) ? doc.reports : (Array.isArray(doc.data) ? doc.data : []),
    predictions: Array.isArray(doc.predictions) ? doc.predictions : [],
    meta: doc.meta || null,
  };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeCenter(c, i) {
  const lat = Number(c.lat ?? c.latitude);
  const lng = Number(c.lng ?? c.lon ?? c.longitude);
  return {
    id: String(c.id || c.slug || `center-${i}`),
    name: c.name || `Center ${i}`,
    country: c.country || null,
    city: c.city || null,
    founded: c.founded || null,
    focus: Array.isArray(c.focus) ? c.focus : [],
    website: c.website || null,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    active: c.active !== false,
  };
}

function normalizeReport(r, i) {
  const sev = String(r.severity || 'unknown').toLowerCase();
  const sevMeta = SEVERITY_META[sev] || SEVERITY_META.unknown;
  const confidence = Number(r.confidence);
  const date = String(r.date || r.timestamp || '').slice(0, 10) || null;
  const region = String(r.region || 'global').toLowerCase();
  const coords = REGION_COORDS[region] || REGION_COORDS.global;
  return {
    id: String(r.id || `rpt-${i}`),
    center: String(r.center || 'unknown'),
    title: r.title || 'Untitled',
    date,
    region,
    regionLat: coords[0],
    regionLng: coords[1],
    summary: r.summary || '',
    keyPoints: Array.isArray(r.keyPoints) ? r.keyPoints : [],
    confidence: Number.isFinite(confidence) ? confidence : null,
    severity: sev,
    severityLabel: sevMeta.label,
    severityColor: sevMeta.color,
    severityValue: sevMeta.severity,
    tags: Array.isArray(r.tags) ? r.tags : [],
    url: r.url || null,
    category_: 'intelligence',
    icon: meta.icon,
  };
}

function normalizePrediction(p, i) {
  const confidence = Number(p.confidence);
  const region = String(p.region || 'global').toLowerCase();
  const coords = REGION_COORDS[region] || REGION_COORDS.global;
  return {
    id: String(p.id || `pred-${i}`),
    center: String(p.center || 'unknown'),
    title: p.title || 'Untitled prediction',
    date: String(p.date || p.timestamp || '').slice(0, 10) || null,
    prediction: p.prediction || p.summary || '',
    confidence: Number.isFinite(confidence) ? confidence : null,
    timeframe: p.timeframe || null,
    region,
    regionLat: coords[0],
    regionLng: coords[1],
    category_: 'intelligence',
    icon: '🔮',
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.center)   r = r.filter(x => String(x.center).toLowerCase() === String(query.center).toLowerCase());
  if (query.region)   r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.focus) {
    const f = String(query.focus).toLowerCase();
    r = r.filter(x => x.tags.some(t => String(t).toLowerCase().includes(f)));
  }
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.title + ' ' + (x.summary || '') + ' ' + x.tags.join(' ')).toLowerCase().includes(q));
  }
  if (query.min_confidence != null) { const n = Number(query.min_confidence); if (Number.isFinite(n)) r = r.filter(x => x.confidence != null && x.confidence >= n); }
  if (query.max_confidence != null) { const n = Number(query.max_confidence); if (Number.isFinite(n)) r = r.filter(x => x.confidence != null && x.confidence <= n); }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));

  const sortKey = query.sort || 'date-desc';
  if (sortKey === 'date-desc')      r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'date-asc')  r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'confidence-desc') r.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
  else if (sortKey === 'confidence-asc')  r.sort((a, b) => (a.confidence ?? 1e9) - (b.confidence ?? 1e9));
  else if (sortKey === 'severity-desc')   r.sort((a, b) => (b.severityValue ?? 0) - (a.severityValue ?? 0));
  else if (sortKey === 'title')     r.sort((a, b) => a.title.localeCompare(b.title));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(reports, predictions, centers) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const byCenter = {};
  const byRegion = {};
  const byFocus = {};
  const confidences = [];

  for (const r of reports) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byCenter[r.center] = (byCenter[r.center] || 0) + 1;
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    for (const t of r.tags) byFocus[t] = (byFocus[t] || 0) + 1;
    if (r.confidence != null) confidences.push(r.confidence);
  }

  const top = (obj, n = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  const avgConf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

  return {
    centers_count: centers.length,
    reports_count: reports.length,
    predictions_count: predictions.length,
    total_items: reports.length + predictions.length,
    by_severity: bySeverity,
    by_center: byCenter,
    by_region: byRegion,
    by_focus: byFocus,
    top_centers: top(byCenter, 15),
    top_regions: top(byRegion, 10),
    top_focus: top(byFocus, 10),
    avg_confidence: avgConf != null ? Number(avgConf.toFixed(1)) : null,
  };
}

function computeSummary(reports) {
  if (!reports.length) return null;
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const byRegion = {};
  for (const r of reports) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const confidences = reports.map(r => r.confidence).filter(Number.isFinite);
  const avgConf = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null;
  return {
    totalReports: reports.length,
    bySeverity,
    byRegion,
    avgConfidence: avgConf,
    lastUpdate: new Date().toISOString(),
  };
}

function computeRegions(reports) {
  const regions = {};
  for (const r of reports) {
    if (!regions[r.region]) regions[r.region] = { total: 0, reports: [] };
    regions[r.region].total++;
    regions[r.region].reports.push({ id: r.id, title: r.title, center: r.center, severity: r.severity, date: r.date });
  }
  return Object.entries(regions).map(([key, value]) => ({
    name: key,
    coords: REGION_COORDS[key] || REGION_COORDS.global,
    ...value,
  }));
}

function computeTimeline(reports) {
  const byDate = {};
  for (const r of reports) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, count: 0, by_severity: {} };
    byDate[r.date].count++;
    byDate[r.date].by_severity[r.severity] = (byDate[r.date].by_severity[r.severity] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function toReport(centers, reports, predictions, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  THINKTANKS REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Центров: ${stats.centers_count}`);
  lines.push(`Отчётов: ${stats.reports_count}`);
  lines.push(`Прогнозов: ${stats.predictions_count}`);
  lines.push('');
  lines.push('SEVERITY отчётов:');
  for (const [k, v] of Object.entries(stats.by_severity)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  lines.push('ТОП-5 центров по числу отчётов:');
  for (const c of stats.top_centers.slice(0, 5)) lines.push(`  ${String(c.count).padStart(3)}  ${c.name}`);
  lines.push('');
  lines.push('ТОП-5 регионов:');
  for (const r of stats.top_regions.slice(0, 5)) lines.push(`  ${String(r.count).padStart(3)}  ${r.name}`);
  lines.push('');
  lines.push('ПОСЛЕДНИЕ 5 ОТЧЁТОВ:');
  for (const r of reports.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5)) {
    lines.push(`  ${r.date}  [${r.severity}]  ${r.title.slice(0, 60)}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(reports, centers) {
  const features = [];
  for (const c of centers) {
    if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id, name: c.name, kind: 'center',
          country: c.country, city: c.city, founded: c.founded,
          focus: c.focus, website: c.website, active: c.active,
          icon: meta.icon,
        },
      });
    }
  }
  for (const r of reports) {
    if (Number.isFinite(r.regionLat) && Number.isFinite(r.regionLng)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.regionLng, r.regionLat] },
        properties: {
          id: `${r.id}-region`, kind: 'report',
          report_id: r.id, title: r.title, center: r.center,
          severity: r.severity, severityColor: r.severityColor,
          confidence: r.confidence, date: r.date, region: r.region,
          icon: '📄',
        },
      });
    }
  }
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      severity: Object.entries(SEVERITY_META).map(([k, v]) => ({ key: k, ...v })),
      focus: Object.entries(FOCUS_META).map(([k, v]) => ({ key: k, ...v })),
    },
    meta: { centers: centers.length, reports: reports.length, features: features.length },
  };
}

function toSeries(reports) {
  return reports.map(r => ({
    id: r.id, title: r.title, center: r.center, date: r.date,
    region: r.region, severity: r.severity, confidence: r.confidence,
    tags: r.tags, url: r.url,
  }));
}

function toCSV(reports) {
  const lines = ['id,title,center,date,region,severity,confidence,tags'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of reports) {
    lines.push([r.id, r.title, r.center, r.date, r.region, r.severity, r.confidence, r.tags.join('|')].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(reports, centers) {
  const centerMarkers = centers
    .filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map(c => ({
      id: c.id, lat: c.lat, lng: c.lng,
      color: '#8b5cf6', icon: meta.icon, radius: 10,
      properties: { name: c.name, country: c.country, focus: c.focus, website: c.website },
    }));
  const reportMarkers = reports
    .filter(r => Number.isFinite(r.regionLat) && Number.isFinite(r.regionLng))
    .map(r => ({
      id: r.id, lat: r.regionLat, lng: r.regionLng,
      color: r.severityColor, icon: '📄',
      radius: r.severity === 'critical' ? 12 : (r.severity === 'high' ? 9 : 6),
      properties: { title: r.title, center: r.center, severity: r.severity, confidence: r.confidence, date: r.date },
    }));
  return {
    centerMarkers,
    reportMarkers,
    legend: {
      severity: Object.entries(SEVERITY_META).map(([k, v]) => ({ key: k, ...v })),
      focus: Object.entries(FOCUS_META).map(([k, v]) => ({ key: k, ...v })),
    },
    filterable: ['center', 'region', 'severity', 'focus', 'min_confidence', 'since', 'sort'],
    totals: { centers: centerMarkers.length, reports: reportMarkers.length },
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/thinktanks/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'thinktanks-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    let doc = null;
    let usedFallback = false;
    try { doc = await loadData(); }
    catch (e) {
      if (e.statusCode === 503 && e.fallback) {
        doc = e.fallback;
        usedFallback = true;
      } else if (e.statusCode === 503 && (sub === '/health' || sub === '/status')) {
        return sendJSON(res, 200, {
          status: 'degraded', basket_available: false, hint: e.hint,
          generated_at: new Date().toISOString(),
        }, extra);
      } else {
        throw e;
      }
    }

    // ---- Не-basket эндпоинты ----

    if (sub === '/config') {
      return sendJSON(res, 200, {
        severity: Object.entries(SEVERITY_META).map(([k, v]) => ({ key: k, ...v })),
        focus: Object.entries(FOCUS_META).map(([k, v]) => ({ key: k, ...v })),
        region_coords: REGION_COORDS,
        filter_presets: FILTER_PRESETS,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

    if (sub === '/builtin') {
      const centers = BUILTIN_CENTERS.map(normalizeCenter);
      const reports = BUILTIN_REPORTS.map(normalizeReport);
      const predictions = BUILTIN_PREDICTIONS.map(normalizePrediction);
      const fc = toFeatureCollection(reports, centers);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        centers,
        reports,
        predictions,
        stats: computeStats(reports, predictions, centers),
        summary: computeSummary(reports),
        meta: { source: 'builtin', generated_at: new Date().toISOString() },
      }, extra);
    }

    // ---- Basket-зависимые ----

    const { centers: rawCenters, reports: rawReports, predictions: rawPredictions, meta: srcMeta } = extractDoc(doc);
    const centers = rawCenters.map(normalizeCenter);
    const reports = rawReports.map(normalizeReport);
    const predictions = rawPredictions.map(normalizePrediction);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        basket_available: !usedFallback,
        fallback: usedFallback,
        centers: centers.length, reports: reports.length, predictions: predictions.length,
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(reports, predictions, centers), fallback: usedFallback, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online',
        centers: centers.length, reports: reports.length, predictions: predictions.length,
        fallback: usedFallback,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/centers') {
      return sendJSON(res, 200, { centers, count: centers.length }, extra);
    }
    if (sub.startsWith('/centers/')) {
      const id = decodeURIComponent(sub.slice('/centers/'.length));
      const center = centers.find(c => c.id === id);
      if (!center) return sendJSON(res, 404, { error: 'center_not_found', id }, extra);
      const centerReports = reports.filter(r => r.center === id);
      return sendJSON(res, 200, { center, reports: centerReports, reports_count: centerReports.length }, extra);
    }
    if (sub === '/reports') {
      const rows = applyFilters(reports, query);
      return sendJSON(res, 200, { reports: rows, count: rows.length, total: reports.length }, extra);
    }
    if (sub.startsWith('/reports/') || sub.startsWith('/report/')) {
      const id = decodeURIComponent(sub.replace(/^\/(reports|report)\//, ''));
      const report = reports.find(r => r.id === id);
      if (!report) return sendJSON(res, 404, { error: 'report_not_found', id }, extra);
      const center = centers.find(c => c.id === report.center) || null;
      return sendJSON(res, 200, { report: { ...report, center_info: center } }, extra);
    }
    if (sub === '/predictions') {
      return sendJSON(res, 200, { predictions, count: predictions.length }, extra);
    }
    if (sub.startsWith('/prediction/')) {
      const id = decodeURIComponent(sub.slice('/prediction/'.length));
      const prediction = predictions.find(p => p.id === id);
      if (!prediction) return sendJSON(res, 404, { error: 'prediction_not_found', id }, extra);
      return sendJSON(res, 200, { prediction }, extra);
    }
    if (sub === '/summary') {
      return sendJSON(res, 200, { summary: computeSummary(reports) }, extra);
    }
    if (sub === '/regions') {
      const regions = computeRegions(reports);
      return sendJSON(res, 200, { regions, count: regions.length }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = reports.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = reports.slice().sort((a, b) => (a.confidence ?? 1e9) - (b.confidence ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/by-center') {
      const byCenter = {};
      for (const r of reports) {
        if (!byCenter[r.center]) byCenter[r.center] = { center: r.center, count: 0, reports: [] };
        byCenter[r.center].count++;
        byCenter[r.center].reports.push(r.id);
      }
      return sendJSON(res, 200, { centers: Object.values(byCenter), total: Object.keys(byCenter).length }, extra);
    }
    if (sub === '/by-region') {
      const byRegion = {};
      for (const r of reports) {
        if (!byRegion[r.region]) byRegion[r.region] = { region: r.region, coords: [r.regionLat, r.regionLng], count: 0, reports: [] };
        byRegion[r.region].count++;
        byRegion[r.region].reports.push(r.id);
      }
      return sendJSON(res, 200, { regions: Object.values(byRegion), total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/by-severity') {
      const bySeverity = {};
      for (const r of reports) {
        if (!bySeverity[r.severity]) bySeverity[r.severity] = { name: r.severity, label: r.severityLabel, color: r.severityColor, severity: r.severityValue, count: 0 };
        bySeverity[r.severity].count++;
      }
      return sendJSON(res, 200, { severities: Object.values(bySeverity), total: Object.keys(bySeverity).length }, extra);
    }
    if (sub === '/by-focus') {
      const byFocus = {};
      for (const r of reports) {
        for (const t of r.tags) {
          if (!byFocus[t]) byFocus[t] = { name: t, count: 0, reports: [] };
          byFocus[t].count++;
          byFocus[t].reports.push(r.id);
        }
      }
      return sendJSON(res, 200, { focus: Object.values(byFocus).sort((a, b) => b.count - a.count), total: Object.keys(byFocus).length }, extra);
    }
    if (sub === '/by-country') {
      const byCountry = {};
      for (const c of centers) {
        const country = c.country || 'unknown';
        if (!byCountry[country]) byCountry[country] = { country, count: 0, centers: [] };
        byCountry[country].count++;
        byCountry[country].centers.push(c.id);
      }
      return sendJSON(res, 200, { countries: Object.values(byCountry).sort((a, b) => b.count - a.count), total: Object.keys(byCountry).length }, extra);
    }
    if (sub === '/critical') {
      const rows = reports.filter(r => r.severity === 'critical');
      return sendJSON(res, 200, { critical: rows, count: rows.length }, extra);
    }
    if (sub === '/high-confidence') {
      const rows = reports.filter(r => r.confidence != null && r.confidence >= 80);
      return sendJSON(res, 200, { high_confidence: rows, count: rows.length }, extra);
    }
    if (sub === '/recent') {
      const since = query.since || '30d';
      const t = new Date(since).getTime();
      const sinceDate = Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : since.slice(0, 10);
      const rows = reports.filter(r => r.date && r.date >= sinceDate).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return sendJSON(res, 200, { recent: rows, count: rows.length, since: sinceDate }, extra);
    }
    if (sub === '/latest') {
      const latest = reports.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 20);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = reports.filter(r => (r.title + ' ' + r.summary + ' ' + r.tags.join(' ')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => reports.find(r => r.id === id)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(reports);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const stats = computeStats(reports, predictions, centers);
      const trends = {
        top_centers: stats.top_centers,
        top_regions: stats.top_regions,
        top_focus: stats.top_focus,
        by_severity: stats.by_severity,
        avg_confidence: stats.avg_confidence,
      };
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(reports, predictions, centers);
      const report = toReport(centers, reports, predictions, stats);
      return sendText(res, 200, report, 'text/plain; charset=utf-8');
    }
    if (sub === '/reset-cache') {
      const before = _cache.size;
      cacheClear();
      return sendJSON(res, 200, { cleared: before, now: _cache.size }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(reports, query);
      return sendJSON(res, 200, toFeatureCollection(rows, centers), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(reports, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows, centers) }, extra);
    }

    const rows = applyFilters(reports, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, src_meta: srcMeta, fallback: usedFallback }, extra);

    const fc = toFeatureCollection(rows, centers);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        fallback: usedFallback,
        total_reports: reports.length, returned_reports: rows.length,
        centers_count: centers.length, predictions_count: predictions.length,
        src_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      centers,
      series: toSeries(rows),
      predictions,
      stats: computeStats(rows, predictions, centers),
      summary: computeSummary(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e2) {}
  }
}
