/**
 * apis/sources/shipping-api.mjs — API-МОДУЛЬ: МОРСКОЙ ТРЕКИНГ И ДЕТЕКТОР ТЁМНЫХ СУДОВ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/shipping.json — [{ id, name, type, status, mmsi, imo, flag, lat, lng, speed, heading, destination, ais, lastAIS, darkDetected?, suspicious? }] ИЛИ { vessels:[...] } ИЛИ { data:[...] }.
 * Сборщик: scripts/collectors/collect-shipping.mjs.
 *
 * Морской трекинг: AIS-данные судов, детектор «тёмных» судов (без AIS),
 * хотспоты (Суэц, Босфор, Ормуз, Чёрное море, Гибралтар, Малакка, Панама,
 * Баб-эль-Мандеб, Тайвань, Балтика), статистика по типам и флагам.
 *
 * Судно:
 *   { id, name, type, status, mmsi, imo?, flag, lat, lng, speed, heading,
 *     destination, ais, lastAIS, darkDetected?, suspicious? }
 *
 * Статусы:
 *   normal     — норм (AIS работает)
 *   dark       — тёмное (AIS отключён)
 *   suspicious — подозрительное (санкции, необычный маршрут)
 *
 * ФОРМАТЫ: json (FC + series + stats + hotspots), csv, dark, series, stats, raw, report.
 * ФИЛЬТРЫ: ?type=, ?status=, ?flag=, ?ais=, ?min_speed=, ?max_speed=, ?q=, ?bbox=,
 *          ?destination=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                          — сводка
 *   GET /stats                     — агрегированная статистика
 *   GET /status                    — health-check
 *   GET /health                    — расширенный health
 *   GET /config                    — конфигурация (типы, статусы, хотспоты)
 *   GET /count                     — только числа
 *   GET /vessels                   — все суда
 *   GET /vessels/:id               — конкретное судно
 *   GET /latest                    — последние по lastAIS
 *   GET /recent?since=             — свежие обновления
 *   GET /search?q=                 — поиск по имени/MMSI/destination
 *   GET /dark                      — только тёмные + причина
 *   GET /suspicious                — только подозрительные
 *   GET /hotspots                  — горячие точки (10 штук)
 *   GET /hotspots/trending         — топ хотспотов по количеству тёмных
 *   GET /types                     — группировка по типам
 *   GET /types/:type               — суда конкретного типа
 *   GET /flags                     — группировка по флагам
 *   GET /flags/trending            — топ флагов по количеству тёмных
 *   GET /ais-tracks                — суда с треками (lastAIS)
 *   GET /bbox?w=&s=&e=&n=          — суда в bbox
 *   GET /timeline                  — динамика по lastAIS (дни)
 *   GET /trends                    — тренды (типы, флаги, dark%)
 *   GET /compare?ids=a,b,c         — сравнение судов
 *   GET /bulk-compare?ids=...      — пакетное сравнение
 *   GET /filter-presets            — готовые фильтры для UI
 *   GET /export                    — текстовый отчёт
 *   GET /reset-cache               — сброс кэша
 *   GET /featurecollection         — чистый GeoJSON
 *   GET /render                    — рендер-конфиг
 *   GET /builtin                   — встроенный fallback (12 судов)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'shipping.json');

export const route  = '/api/layers/shipping';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '🚢',
  color: '#0891b2',
  vizType: 'marker',
  source: 'basket/shipping.json',
  collector: 'collect-shipping.mjs',
  cache: 300,
  description: 'Морской трекинг: AIS-суда, детектор тёмных судов, хотспоты (Суэц/Босфор/Ормуз/Малакка/Баб-эль-Мандеб)',
  unit: 'vessels',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const STATUS_META = {
  normal:     { color: '#22c55e', label: 'Норма',              severity: 1 },
  dark:       { color: '#dc2626', label: 'Тёмное (нет AIS)',   severity: 3 },
  suspicious: { color: '#f97316', label: 'Подозрительное',     severity: 2 },
  unknown:    { color: '#64748b', label: 'Неизвестно',         severity: 0 },
};

const TYPE_META = {
  cargo:     { color: '#0891b2', icon: '📦', label: 'Грузовое' },
  container: { color: '#0ea5e9', icon: '📦', label: 'Контейнеровоз' },
  tanker:    { color: '#f97316', icon: '🛢️', label: 'Танкер' },
  passenger: { color: '#8b5cf6', icon: '🚢', label: 'Пассажирское' },
  fishing:   { color: '#eab308', icon: '🎣', label: 'Рыболовное' },
  military:  { color: '#dc2626', icon: '⚓', label: 'Военное' },
  tugs:      { color: '#22c55e', icon: '🚤', label: 'Буксиры' },
  pleasure:  { color: '#a855f7', icon: '⛵', label: 'Прогулочное' },
  dredging:  { color: '#16a34a', icon: '⚒️', label: 'Дноуглубительное' },
  unknown:   { color: '#64748b', icon: '🚢', label: 'Неизвестно' },
};

const HOTSPOTS = [
  { id: 'suez',          name: 'Суэцкий канал',           lat: 30.0,  lng: 32.5,   bbox: [29, 31, 32, 33],           severity: 'high' },
  { id: 'bosphorus',     name: 'Босфор',                  lat: 41.1,  lng: 29.0,   bbox: [40.5, 41.5, 28.5, 29.5],   severity: 'medium' },
  { id: 'hormuz',        name: 'Ормузский пролив',        lat: 26.5,  lng: 56.0,   bbox: [26, 27, 55, 57],           severity: 'critical' },
  { id: 'black-sea',     name: 'Чёрное море',             lat: 44.0,  lng: 30.0,   bbox: [43, 45, 28, 32],           severity: 'high' },
  { id: 'gibraltar',     name: 'Гибралтарский пролив',    lat: 36.0,  lng: -5.0,   bbox: [35.5, 36.5, -6, -4],       severity: 'medium' },
  { id: 'malacca',       name: 'Малаккский пролив',       lat: 1.5,   lng: 102.5,  bbox: [1, 2, 101, 104],           severity: 'high' },
  { id: 'panama',        name: 'Панамский канал',         lat: 9.1,   lng: -79.7,  bbox: [8.5, 9.5, -80.5, -79],     severity: 'medium' },
  { id: 'bab-el-mandeb', name: 'Баб-эль-Мандебский',      lat: 12.6,  lng: 43.4,   bbox: [12, 13.5, 42.5, 44],       severity: 'critical' },
  { id: 'taiwan',        name: 'Тайваньский пролив',      lat: 24.5,  lng: 119.5,  bbox: [22, 26, 117, 122],         severity: 'critical' },
  { id: 'baltic',        name: 'Балтийское море',         lat: 58.0,  lng: 20.0,   bbox: [54, 62, 10, 30],           severity: 'high' },
  { id: 'red-sea',       name: 'Красное море',            lat: 20.0,  lng: 38.0,   bbox: [15, 25, 32, 44],           severity: 'high' },
  { id: 'south-china',   name: 'Южно-Китайское море',     lat: 15.0,  lng: 115.0,  bbox: [5, 25, 105, 125],          severity: 'high' },
];

const FILTER_PRESETS = [
  { id: 'all',         label: 'Все суда',                 params: {} },
  { id: 'dark',        label: 'Тёмные (без AIS)',         params: { status: 'dark' } },
  { id: 'suspicious',  label: 'Подозрительные',           params: { status: 'suspicious' } },
  { id: 'tankers',     label: 'Танкеры',                  params: { type: 'tanker' } },
  { id: 'cargo',       label: 'Грузовые',                 params: { type: 'cargo' } },
  { id: 'military',    label: 'Военные',                  params: { type: 'military' } },
  { id: 'slow',        label: 'Медленные (<5 узлов)',     params: { max_speed: 5 } },
  { id: 'fast',        label: 'Быстрые (>15 узлов)',      params: { min_speed: 15 } },
  { id: 'no-destination', label: 'Без назначения',        params: { destination: 'unknown' } },
];

// ============================================================
//  ВСТРОЕННЫЙ FALLBACK (12 судов)
// ============================================================

const BUILTIN_VESSELS = [
  { id: 'vsl-001', name: 'EVER GIVEN',        type: 'cargo',     status: 'normal',     mmsi: '353136000', flag: 'Panama',    lat: 30.5, lng: 32.5,  speed: 12.5, heading: 270, destination: 'Rotterdam',   ais: true },
  { id: 'vsl-002', name: 'MSC OSCAR',         type: 'container', status: 'normal',     mmsi: '255806000', flag: 'Portugal',  lat: 36.0, lng: -5.0,  speed: 18.2, heading: 45,  destination: 'Algeciras',   ais: true },
  { id: 'vsl-003', name: 'TANKER PRIDE',      type: 'tanker',    status: 'normal',     mmsi: '311000123', flag: 'Bahamas',   lat: 26.0, lng: 55.0,  speed: 8.5,  heading: 180, destination: 'Fujairah',    ais: true },
  { id: 'vsl-004', name: 'DARK SHADOW',       type: 'unknown',   status: 'dark',       mmsi: '000000000', flag: 'Unknown',   lat: 34.0, lng: 24.0,  speed: 6.8,  heading: 90,  destination: 'Unknown',     ais: false, darkDetected: '2026-08-14T12:00:00Z' },
  { id: 'vsl-005', name: 'GHOST FREIGHTER',   type: 'cargo',     status: 'dark',       mmsi: '000000001', flag: 'Unknown',   lat: 38.0, lng: 22.0,  speed: 4.2,  heading: 135, destination: 'Unknown',     ais: false, darkDetected: '2026-08-14T10:30:00Z' },
  { id: 'vsl-006', name: 'STEALTH CARGO',     type: 'cargo',     status: 'dark',       mmsi: '000000002', flag: 'Unknown',   lat: 42.0, lng: 29.0,  speed: 9.1,  heading: 45,  destination: 'Unknown',     ais: false, darkDetected: '2026-08-14T08:15:00Z' },
  { id: 'vsl-007', name: 'NIGHT RUNNER',      type: 'fishing',   status: 'dark',       mmsi: '000000003', flag: 'Unknown',   lat: 44.0, lng: 31.0,  speed: 2.5,  heading: 270, destination: 'Unknown',     ais: false, darkDetected: '2026-08-14T06:00:00Z' },
  { id: 'vsl-008', name: 'SUSPECT TANKER',    type: 'tanker',    status: 'suspicious', mmsi: '212345678', flag: 'Malta',     lat: 32.0, lng: 33.5,  speed: 3.2,  heading: 225, destination: 'Unknown',     ais: true,  suspicious: 'Санкционный груз' },
  { id: 'vsl-009', name: 'BALTIC CARRIER',    type: 'cargo',     status: 'normal',     mmsi: '209765432', flag: 'Cyprus',    lat: 54.5, lng: 18.5,  speed: 10.5, heading: 320, destination: 'Gdansk',      ais: true },
  { id: 'vsl-010', name: 'MEDITERRANEAN STAR',type: 'passenger', status: 'normal',     mmsi: '247123456', flag: 'Italy',     lat: 37.5, lng: 12.5,  speed: 22.0, heading: 180, destination: 'Palermo',     ais: true },
  { id: 'vsl-011', name: 'SUSPECT CARGO',     type: 'cargo',     status: 'suspicious', mmsi: '311654321', flag: 'Liberia',   lat: 40.0, lng: 26.0,  speed: 5.8,  heading: 90,  destination: 'Unknown',     ais: true,  suspicious: 'Необычный маршрут' },
  { id: 'vsl-012', name: 'DARK FISHER',       type: 'fishing',   status: 'dark',       mmsi: '000000004', flag: 'Unknown',   lat: 46.0, lng: 30.5,  speed: 1.2,  heading: 150, destination: 'Unknown',     ais: false, darkDetected: '2026-08-14T04:30:00Z' },
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
      err.hint = 'run scripts/collectors/collect-shipping.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractVessels(doc) {
  if (Array.isArray(doc)) return { vessels: doc, source: null, meta: null };
  if (!doc || typeof doc !== 'object') return { vessels: [], source: null, meta: null };
  if (Array.isArray(doc.vessels)) return { vessels: doc.vessels, source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.data))    return { vessels: doc.data,    source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.items))   return { vessels: doc.items,   source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.ships))   return { vessels: doc.ships,   source: doc.source || null, meta: doc.meta || null };
  return { vessels: [], source: null, meta: null };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeVessel(v, i) {
  const lat = Number(v.lat ?? v.latitude);
  const lng = Number(v.lng ?? v.lon ?? v.longitude);
  const speed = Number(v.speed ?? v.sog);
  const heading = Number(v.heading ?? v.cog);
  const status = String(v.status || (v.ais === false ? 'dark' : 'normal')).toLowerCase();
  const type = String(v.type || 'unknown').toLowerCase();
  const st = STATUS_META[status] || STATUS_META.unknown;
  const tp = TYPE_META[type] || TYPE_META.unknown;
  const ais = v.ais !== false && status !== 'dark';

  return {
    id: String(v.id || v.mmsi || `vsl-${i}`),
    name: v.name || `Vessel ${i}`,
    type,
    typeLabel: tp.label,
    typeColor: tp.color,
    typeIcon: tp.icon,
    status,
    statusLabel: st.label,
    statusColor: st.color,
    severity: st.severity,
    mmsi: v.mmsi || null,
    imo: v.imo || null,
    flag: v.flag || 'Unknown',
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    speed: Number.isFinite(speed) ? Number(speed.toFixed(2)) : null,
    heading: Number.isFinite(heading) ? Number(heading.toFixed(1)) : null,
    destination: v.destination || null,
    ais,
    last_ais: v.lastAIS || v.last_ais || null,
    dark_detected: v.darkDetected || v.dark_detected || null,
    suspicious_reason: v.suspicious || null,
    category: 'transport',
    icon: meta.icon,
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function darkReason(v) {
  const reasons = [];
  if (!v.ais) reasons.push('AIS отключён');
  if (v.flag === 'Unknown') reasons.push('Флаг неизвестен');
  if (v.destination === 'Unknown' || !v.destination) reasons.push('Пункт назначения неизвестен');
  if (v.speed != null && v.speed < 2 && v.type !== 'fishing') reasons.push('Аномально низкая скорость');
  if (v.status === 'suspicious') reasons.push('Подозрительное поведение');
  return reasons.length ? reasons.join(', ') : 'Неизвестная причина';
}

function inBbox(v, w, s, e, n) {
  return v.lat != null && v.lng != null && v.lat >= s && v.lat <= n && v.lng >= w && v.lng <= e;
}

function computeHotspots(vessels) {
  return HOTSPOTS.map(h => {
    const [s, n, w, e] = h.bbox;
    const inZone = vessels.filter(v => inBbox(v, w, s, e, n));
    const darkCount = inZone.filter(v => v.status === 'dark' || !v.ais).length;
    const suspiciousCount = inZone.filter(v => v.status === 'suspicious').length;
    const typeCount = {};
    for (const v of inZone) typeCount[v.type] = (typeCount[v.type] || 0) + 1;
    return {
      id: h.id, name: h.name, lat: h.lat, lng: h.lng, severity: h.severity,
      bbox: h.bbox,
      count: inZone.length,
      dark_count: darkCount,
      suspicious_count: suspiciousCount,
      dark_percentage: inZone.length ? Number((darkCount / inZone.length * 100).toFixed(1)) : 0,
      by_type: typeCount,
    };
  });
}

function computeTrends(vessels) {
  const byType = {};
  const byFlag = {};
  const byStatus = { normal: 0, dark: 0, suspicious: 0, unknown: 0 };
  let total = 0, dark = 0, susp = 0;
  for (const v of vessels) {
    byType[v.type] = (byType[v.type] || 0) + 1;
    byFlag[v.flag] = (byFlag[v.flag] || 0) + 1;
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    total++;
    if (v.status === 'dark' || !v.ais) dark++;
    if (v.status === 'suspicious') susp++;
  }
  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    total,
    dark,
    suspicious: susp,
    dark_percentage: total ? Number((dark / total * 100).toFixed(1)) : 0,
    suspicious_percentage: total ? Number((susp / total * 100).toFixed(1)) : 0,
    top_types: top(byType, 10),
    top_flags: top(byFlag, 15),
    by_status: byStatus,
  };
}

function computeTimeline(vessels) {
  const byDate = {};
  for (const v of vessels) {
    const ref = v.last_ais || v.dark_detected;
    if (!ref) continue;
    const date = String(ref).slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, count: 0, dark: 0, suspicious: 0, by_type: {} };
    byDate[date].count++;
    if (v.status === 'dark' || !v.ais) byDate[date].dark++;
    if (v.status === 'suspicious') byDate[date].suspicious++;
    byDate[date].by_type[v.type] = (byDate[date].by_type[v.type] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function computeStats(vessels) {
  const byStatus = { normal: 0, dark: 0, suspicious: 0, unknown: 0 };
  const byType = {};
  const byFlag = {};
  let darkCount = 0, suspCount = 0, withCoords = 0;

  for (const v of vessels) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    byType[v.type] = (byType[v.type] || 0) + 1;
    byFlag[v.flag] = (byFlag[v.flag] || 0) + 1;
    if (v.status === 'dark' || !v.ais) darkCount++;
    if (v.status === 'suspicious') suspCount++;
    if (v.lat != null && v.lng != null) withCoords++;
  }

  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    count: vessels.length,
    with_position: withCoords,
    dark: darkCount,
    suspicious: suspCount,
    dark_percentage: vessels.length ? Number((darkCount / vessels.length * 100).toFixed(1)) : 0,
    suspicious_percentage: vessels.length ? Number((suspCount / vessels.length * 100).toFixed(1)) : 0,
    by_status: byStatus,
    by_type: byType,
    top_flags: top(byFlag, 15),
    top_types: top(byType, 10),
  };
}

function findDuplicates(vessels) {
  const groups = {};
  for (const v of vessels) {
    const key = `${v.mmsi || ''}|${v.imo || ''}|${v.name}`.toLowerCase().trim();
    if (!key || key === '||') continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(v.id);
  }
  return Object.entries(groups).filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids, count: ids.length }));
}

function toReport(vessels, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  SHIPPING REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего судов: ${vessels.length}`);
  lines.push(`Тёмных: ${stats.dark} (${stats.dark_percentage}%)`);
  lines.push(`Подозрительных: ${stats.suspicious} (${stats.suspicious_percentage}%)`);
  lines.push('');
  lines.push('ТОП-10 флагов:');
  for (const f of stats.top_flags.slice(0, 10)) lines.push(`  ${String(f.count).padStart(4)}  ${f.name}`);
  lines.push('');
  lines.push('ТОП-10 типов:');
  for (const t of stats.top_types.slice(0, 10)) lines.push(`  ${String(t.count).padStart(4)}  ${t.name}`);
  lines.push('');
  lines.push('ТЁМНЫЕ СУДА:');
  for (const v of vessels.filter(v => v.status === 'dark' || !v.ais).slice(0, 10)) {
    lines.push(`  ${v.name.padEnd(24)}  ${String(v.lat).padStart(8)}  ${String(v.lng).padStart(9)}  ${darkReason(v)}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(vessels, query) {
  let r = vessels.slice();
  if (query.type)        r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.status)      r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.flag)        r = r.filter(x => String(x.flag).toLowerCase().includes(String(query.flag).toLowerCase()));
  if (query.destination) r = r.filter(x => String(x.destination || '').toLowerCase().includes(String(query.destination).toLowerCase()));
  if (query.ais === 'true')  r = r.filter(x => x.ais === true);
  if (query.ais === 'false') r = r.filter(x => x.ais === false);
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.mmsi || '') + ' ' + (x.imo || '') + ' ' + (x.destination || '')).toLowerCase().includes(s));
  }
  if (query.min_speed != null) { const n = Number(query.min_speed); if (Number.isFinite(n)) r = r.filter(x => x.speed != null && x.speed >= n); }
  if (query.max_speed != null) { const n = Number(query.max_speed); if (Number.isFinite(n)) r = r.filter(x => x.speed != null && x.speed <= n); }
  if (query.bbox) {
    const [w, s, e, n] = String(query.bbox).split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) r = r.filter(x => inBbox(x, w, s, e, n));
  }

  const sortKey = query.sort || null;
  if (sortKey === 'speed-desc')    r.sort((a, b) => (b.speed ?? -1) - (a.speed ?? -1));
  else if (sortKey === 'speed-asc') r.sort((a, b) => (a.speed ?? 999) - (b.speed ?? 999));
  else if (sortKey === 'name')      r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'flag')      r.sort((a, b) => String(a.flag).localeCompare(String(b.flag)));
  else if (sortKey === 'type')      r.sort((a, b) => a.type.localeCompare(b.type));
  else if (sortKey === 'status')    r.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));
  else if (sortKey === 'date-desc') r.sort((a, b) => String(b.last_ais || b.dark_detected || '').localeCompare(String(a.last_ais || a.dark_detected || '')));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(vessels) {
  const features = vessels
    .filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map(v => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id, name: v.name, mmsi: v.mmsi, imo: v.imo, flag: v.flag,
        type: v.type, typeLabel: v.typeLabel, typeColor: v.typeColor, typeIcon: v.typeIcon,
        status: v.status, statusLabel: v.statusLabel, statusColor: v.statusColor, severity: v.severity,
        speed: v.speed, heading: v.heading, destination: v.destination,
        ais: v.ais, dark_detected: v.dark_detected, suspicious_reason: v.suspicious_reason,
        category: v.category, icon: v.icon,
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
    legend: {
      statuses: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
      types: Object.entries(TYPE_META).map(([key, def]) => ({ key, ...def })),
    },
    meta: { total: vessels.length, mapped: features.length, unmapped: vessels.length - features.length },
  };
}

function toSeries(vessels) {
  return vessels.map(v => ({
    id: v.id, name: v.name, type: v.type, status: v.status,
    flag: v.flag, lat: v.lat, lng: v.lng, speed: v.speed, heading: v.heading,
    destination: v.destination, ais: v.ais,
  }));
}

function toCSV(vessels) {
  const lines = ['id,name,mmsi,imo,type,status,flag,lat,lng,speed,heading,destination,ais'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const v of vessels) {
    lines.push([v.id, v.name, v.mmsi, v.imo, v.type, v.status, v.flag, v.lat, v.lng, v.speed, v.heading, v.destination, v.ais].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toDarkCSV(vessels) {
  const lines = ['id,name,flag,lat,lng,speed,destination,dark_reason'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const v of vessels) {
    lines.push([v.id, v.name, v.flag, v.lat, v.lng, v.speed, v.destination, darkReason(v)].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(vessels) {
  const markers = vessels
    .filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map(v => ({
      id: v.id, lat: v.lat, lng: v.lng,
      color: v.statusColor, icon: v.typeIcon,
      radius: v.status === 'dark' ? 12 : (v.status === 'suspicious' ? 9 : 6),
      properties: {
        name: v.name, status: v.status, type: v.type, flag: v.flag,
        speed: v.speed, destination: v.destination, mmsi: v.mmsi,
      },
    }));
  const hotspots = computeHotspots(vessels);
  return {
    markers,
    hotspots,
    legend: {
      statuses: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
      types: Object.entries(TYPE_META).map(([key, def]) => ({ key, ...def })),
    },
    filterable: ['type', 'status', 'flag', 'ais', 'min_speed', 'max_speed', 'destination', 'bbox', 'sort'],
    totals: { markers: markers.length, hotspots: hotspots.length },
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/shipping/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'shipping-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ---- Не-basket эндпоинты ----

    if (sub === '/builtin') {
      const rows = BUILTIN_VESSELS.map(normalizeVessel);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        hotspots: computeHotspots(rows),
        meta: { source: 'builtin', count: rows.length, generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/config') {
      return sendJSON(res, 200, {
        statuses: Object.entries(STATUS_META).map(([k, v]) => ({ key: k, ...v })),
        types: Object.entries(TYPE_META).map(([k, v]) => ({ key: k, ...v })),
        hotspots: HOTSPOTS,
        filter_presets: FILTER_PRESETS,
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

    const { vessels: rawArr, source, meta: srcMeta } = extractVessels(doc);
    const all = rawArr.map(normalizeVessel);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        basket_available: true,
        vessels: all.length,
        dark: all.filter(v => v.status === 'dark' || !v.ais).length,
        suspicious: all.filter(v => v.status === 'suspicious').length,
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }

    if (sub === '/count') {
      const stats = computeStats(all);
      return sendJSON(res, 200, {
        total: stats.count,
        dark: stats.dark,
        suspicious: stats.suspicious,
        by_status: stats.by_status,
        by_type: stats.by_type,
      }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online', count: all.length,
        dark: all.filter(v => !v.ais).length,
        source, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/vessels') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { vessels: rows, count: rows.length, total: all.length }, extra);
    }
    if (sub.startsWith('/vessels/')) {
      const id = decodeURIComponent(sub.slice('/vessels/'.length));
      const vessel = all.find(v => v.id === id);
      if (!vessel) return sendJSON(res, 404, { error: 'vessel_not_found', id }, extra);
      return sendJSON(res, 200, { vessel, dark_reason: vessel.status === 'dark' ? darkReason(vessel) : null }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice().filter(v => v.last_ais).sort((a, b) => String(b.last_ais).localeCompare(String(a.last_ais))).slice(0, 50);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
    }
    if (sub === '/recent') {
      const since = query.since || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const rows = all.filter(v => (v.last_ais || v.dark_detected) && String(v.last_ais || v.dark_detected).slice(0, 10) >= since.slice(0, 10))
        .sort((a, b) => String(b.last_ais || b.dark_detected || '').localeCompare(String(a.last_ais || a.dark_detected || '')));
      return sendJSON(res, 200, { recent: rows, count: rows.length, since }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(v => (v.name + ' ' + (v.mmsi || '') + ' ' + (v.imo || '') + ' ' + (v.destination || '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/dark') {
      const dark = all.filter(v => v.status === 'dark' || !v.ais).map(v => ({ ...v, dark_reason: darkReason(v) }));
      if (format === 'csv') return sendText(res, 200, toDarkCSV(dark), 'text/csv; charset=utf-8');
      return sendJSON(res, 200, { dark, count: dark.length }, extra);
    }
    if (sub === '/suspicious') {
      const susp = all.filter(v => v.status === 'suspicious');
      return sendJSON(res, 200, { suspicious: susp, count: susp.length }, extra);
    }
    if (sub === '/hotspots') {
      const hotspots = computeHotspots(all);
      return sendJSON(res, 200, { hotspots, count: hotspots.length }, extra);
    }
    if (sub === '/hotspots/trending') {
      const hotspots = computeHotspots(all)
        .filter(h => h.dark_count > 0)
        .sort((a, b) => b.dark_count - a.dark_count || b.dark_percentage - a.dark_percentage);
      return sendJSON(res, 200, { trending: hotspots, count: hotspots.length }, extra);
    }
    if (sub === '/types') {
      const byType = {};
      for (const v of all) {
        if (!byType[v.type]) byType[v.type] = { name: v.type, label: v.typeLabel, color: v.typeColor, icon: v.typeIcon, count: 0 };
        byType[v.type].count++;
      }
      return sendJSON(res, 200, { types: Object.values(byType), total: Object.keys(byType).length }, extra);
    }
    if (sub.startsWith('/types/')) {
      const name = decodeURIComponent(sub.slice('/types/'.length)).toLowerCase();
      const rows = all.filter(v => v.type === name);
      if (!rows.length) return sendJSON(res, 404, { error: 'type_not_found', name }, extra);
      return sendJSON(res, 200, { type: name, vessels: rows, count: rows.length }, extra);
    }
    if (sub === '/flags') {
      const byFlag = {};
      for (const v of all) byFlag[v.flag] = (byFlag[v.flag] || 0) + 1;
      const flags = Object.entries(byFlag).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { flags, total: flags.length }, extra);
    }
    if (sub === '/flags/trending') {
      const byFlag = {};
      for (const v of all) {
        if (v.status === 'dark' || v.status === 'suspicious' || !v.ais) {
          if (!byFlag[v.flag]) byFlag[v.flag] = { name: v.flag, dark: 0, suspicious: 0, total: 0 };
          byFlag[v.flag].total++;
          if (v.status === 'dark' || !v.ais) byFlag[v.flag].dark++;
          if (v.status === 'suspicious') byFlag[v.flag].suspicious++;
        }
      }
      const flags = Object.values(byFlag).sort((a, b) => (b.dark + b.suspicious) - (a.dark + a.suspicious));
      return sendJSON(res, 200, { trending: flags, total: flags.length }, extra);
    }
    if (sub === '/ais-tracks') {
      const rows = all.filter(v => v.ais && v.last_ais)
        .map(v => ({ id: v.id, name: v.name, lat: v.lat, lng: v.lng, last_ais: v.last_ais, speed: v.speed, heading: v.heading }))
        .sort((a, b) => String(b.last_ais).localeCompare(String(a.last_ais)));
      return sendJSON(res, 200, { tracks: rows, count: rows.length }, extra);
    }
    if (sub === '/bbox') {
      const w = Number(query.w), s = Number(query.s), e = Number(query.e), n = Number(query.n);
      if (![w, s, e, n].every(Number.isFinite)) return sendJSON(res, 400, { error: 'field_required: w,s,e,n' }, extra);
      const rows = all.filter(v => inBbox(v, w, s, e, n));
      return sendJSON(res, 200, { bbox: [w, s, e, n], vessels: rows, count: rows.length }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(all);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const trends = computeTrends(all);
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(v => v.id === id)).filter(Boolean);
      const diffs = [];
      for (let i = 1; i < results.length; i++) {
        const a = results[i - 1], b = results[i];
        diffs.push({
          from: a.id, to: b.id,
          speed_diff: (b.speed ?? 0) - (a.speed ?? 0),
          lat_diff: (b.lat ?? 0) - (a.lat ?? 0),
          lng_diff: (b.lng ?? 0) - (a.lng ?? 0),
        });
      }
      return sendJSON(res, 200, { count: results.length, results, diffs }, extra);
    }
    if (sub === '/bulk-compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(v => v.id === id)).filter(Boolean);
      const summary = {
        total: results.length,
        dark: results.filter(v => v.status === 'dark' || !v.ais).length,
        suspicious: results.filter(v => v.status === 'suspicious').length,
        avg_speed: results.length ? Number((results.reduce((s, v) => s + (v.speed ?? 0), 0) / results.length).toFixed(2)) : 0,
        by_flag: results.reduce((acc, v) => { acc[v.flag] = (acc[v.flag] || 0) + 1; return acc; }, {}),
      };
      return sendJSON(res, 200, { results, summary }, extra);
    }
    if (sub === '/dedup') {
      const groups = findDuplicates(all);
      return sendJSON(res, 200, { duplicate_groups: groups, count: groups.length }, extra);
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
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')  return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'dark') return sendText(res, 200, toDarkCSV(rows.filter(v => !v.ais)), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_vessels: all.length, returned_vessels: rows.length,
        upstream_source: source, upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      hotspots: computeHotspots(rows),
      trends: computeTrends(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
