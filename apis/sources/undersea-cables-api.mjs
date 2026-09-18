/**
 * apis/sources/undersea-cables-api.mjs — API-МОДУЛЬ: ПОДВОДНЫЕ КАБЕЛИ СВЯЗИ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/undersea-cables.json — [{ id, name, lat, lng, severity, timestamp }]
 *           ИЛИ расширенный формат с landing_points и capacity_tbps.
 * Сборщик: scripts/collectors/collect-undersea-cables.mjs.
 *
 * Подводные кабели связи — критическая инфраструктура: маршруты, обрывы,
 * саботаж, геополитические риски. 95%+ международного интернет-трафика.
 *
 * Типы: transatlantic, transpacific, africa-europe, asia-europe, americas, regional.
 * Severity: critical / high / medium / low / unknown.
 * Status: active / construction / damaged / retired / unknown.
 *
 * ФОРМАТЫ: json (FC + series + stats + chokepoints), csv, series, stats, raw, report, text.
 * ФИЛЬТРЫ: ?region=, ?type=, ?severity=, ?owner=, ?status=, ?q=, ?min_capacity=, ?max_capacity=, ?min_length=, ?bbox=, ?limit=, ?top=, ?sort=.
 *
 * ОСНОВНЫЕ ПОДПУТИ:
 *   /                       — сводка (FC + series + stats + chokepoints)
 *   /stats /status /health  — метрики и состояние
 *   /config /filter-presets — конфигурация и пресеты
 *   /cables /cables/:id     — кабели
 *   /top /bottom            — топы
 *   /by-region /by-type /by-severity /by-owner — группировки
 *   /critical /damaged      — по severity/status
 *   /chokepoints            — узлы (Суэц, Малакка, Баб-эль-Мандеб, Гибралтар, Тайвань, Лусон, Зондский, Босфор, Датские, Панама)
 *   /landing-points         — точки высадки
 *   /capacity /length       — распределения
 *   /search /bbox /compare  — поиск и сравнение
 *   /timeline /trends       — динамика
 *   /export /reset-cache    — сервис
 *   /featurecollection /render — GeoJSON и рендер
 *   /builtin                — встроенный fallback (12 кабелей)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'undersea-cables.json');

export const route  = '/api/layers/undersea-cables';
export const method = 'GET';

export const meta = {
  category: 'infrastructure',
  icon: '🌊',
  color: '#00ccff',
  vizType: 'marker',
  source: 'basket/undersea-cables.json',
  collector: 'collect-undersea-cables.mjs',
  cache: 300,
  description: 'Подводные кабели связи: маршруты, пропускная способность, обрывы, геополитические риски',
  unit: 'cables',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const TYPE_META = {
  transatlantic:  { color: '#3b82f6', label: 'Трансатлантический',  icon: '🌎' },
  transpacific:   { color: '#0ea5e9', label: 'Транстихоокеанский',   icon: '🌏' },
  'africa-europe':{ color: '#f59e0b', label: 'Африка-Европа',        icon: '🌍' },
  'asia-europe':  { color: '#a855f7', label: 'Азия-Европа',          icon: '🌐' },
  americas:       { color: '#22c55e', label: 'Межамериканский',      icon: '🌎' },
  regional:       { color: '#8b5cf6', label: 'Региональный',         icon: '🌊' },
  unknown:        { color: '#64748b', label: 'Неизвестно',           icon: '🌊' },
};

const SEVERITY_META = {
  critical: { color: '#dc2626', label: 'Критический (обрыв/диверсия)', severity: 4 },
  high:     { color: '#f97316', label: 'Высокий',                       severity: 3 },
  medium:   { color: '#eab308', label: 'Средний',                       severity: 2 },
  low:      { color: '#22c55e', label: 'Норма',                         severity: 1 },
  unknown:  { color: '#64748b', label: 'Неизвестно',                    severity: 0 },
};

const STATUS_META = {
  active:       { color: '#22c55e', label: 'Активен' },
  construction: { color: '#0ea5e9', label: 'В строительстве' },
  damaged:      { color: '#f97316', label: 'Повреждён' },
  retired:      { color: '#64748b', label: 'Выведен из эксплуатации' },
  unknown:      { color: '#94a3b8', label: 'Неизвестно' },
};

const CHOKEPOINTS = [
  { id: 'suez',          name: 'Суэцкий канал',           lat: 30.5,  lng: 32.5,   traffic_pct: 17, severity: 'critical' },
  { id: 'malacca',       name: 'Малаккский пролив',       lat: 1.5,   lng: 102.5,  traffic_pct: 15, severity: 'critical' },
  { id: 'bab-el-mandeb', name: 'Баб-эль-Мандебский',      lat: 12.6,  lng: 43.4,   traffic_pct: 12, severity: 'critical' },
  { id: 'gibraltar',     name: 'Гибралтарский пролив',    lat: 36.0,  lng: -5.0,   traffic_pct: 10, severity: 'high' },
  { id: 'taiwan',        name: 'Тайваньский пролив',      lat: 24.5,  lng: 119.5,  traffic_pct: 9,  severity: 'critical' },
  { id: 'luzon',         name: 'Лусонский пролив',        lat: 20.5,  lng: 121.0,  traffic_pct: 8,  severity: 'high' },
  { id: 'sunda',         name: 'Зондский пролив',         lat: -6.0,  lng: 105.5,  traffic_pct: 6,  severity: 'medium' },
  { id: 'bosphorus',     name: 'Босфор',                  lat: 41.1,  lng: 29.0,   traffic_pct: 4,  severity: 'high' },
  { id: 'danish-straits',name: 'Датские проливы',         lat: 56.0,  lng: 11.0,   traffic_pct: 3,  severity: 'medium' },
  { id: 'panama',        name: 'Панамский канал',         lat: 9.1,   lng: -79.7,  traffic_pct: 5,  severity: 'high' },
];

const BUILTIN_CABLES = [
  { id: 'marea',           name: 'Marea',                 type: 'transatlantic', length_km: 6600,  capacity_tbps: 160, rfs_year: 2018, owners: ['Microsoft','Meta'],           landing_points: [{name:'Virginia Beach',country:'US',lat:36.85,lng:-75.98},{name:'Bilbao',country:'Spain',lat:43.26,lng:-2.93}], status: 'active', region: 'atlantic', severity: 'low' },
  { id: 'dunant',          name: 'Dunant',                type: 'transatlantic', length_km: 6600,  capacity_tbps: 250, rfs_year: 2020, owners: ['Google'],                    landing_points: [{name:'Virginia Beach',country:'US',lat:36.85,lng:-75.98},{name:'Saint-Hilaire-de-Riez',country:'France',lat:46.72,lng:-1.94}], status: 'active', region: 'atlantic', severity: 'low' },
  { id: 'grace-hopper',    name: 'Grace Hopper',          type: 'transatlantic', length_km: 6000,  capacity_tbps: 350, rfs_year: 2022, owners: ['Google'],                    landing_points: [{name:'New York',country:'US',lat:40.71,lng:-74.01},{name:'Bude',country:'UK',lat:50.83,lng:-4.55},{name:'Bilbao',country:'Spain',lat:43.26,lng:-2.93}], status: 'active', region: 'atlantic', severity: 'low' },
  { id: '2africa',         name: '2Africa',               type: 'africa-europe', length_km: 45000, capacity_tbps: 180, rfs_year: 2024, owners: ['Meta','Vodafone','Orange','China Mobile'], landing_points: [{name:'Port Said',country:'Egypt',lat:31.26,lng:32.30},{name:'Mombasa',country:'Kenya',lat:-4.04,lng:39.67},{name:'Cape Town',country:'South Africa',lat:-33.92,lng:18.42},{name:'Barcelona',country:'Spain',lat:41.39,lng:2.17}], status: 'construction', region: 'africa', severity: 'low' },
  { id: 'sea-me-we-5',     name: 'SEA-ME-WE 5',           type: 'asia-europe',   length_km: 20000, capacity_tbps: 24,  rfs_year: 2016, owners: ['Orange','Telecom Italia','Singtel'], landing_points: [{name:'Marseille',country:'France',lat:43.30,lng:5.37},{name:'Catania',country:'Italy',lat:37.50,lng:15.08},{name:'Port Said',country:'Egypt',lat:31.26,lng:32.30},{name:'Mumbai',country:'India',lat:19.07,lng:72.87},{name:'Singapore',country:'Singapore',lat:1.29,lng:103.85}], status: 'active', region: 'asia-europe', severity: 'medium' },
  { id: 'aae-1',           name: 'AAE-1',                 type: 'asia-europe',   length_km: 25000, capacity_tbps: 40,  rfs_year: 2017, owners: ['China Unicom','Telecom Egypt','Ooredoo'], landing_points: [{name:'Hong Kong',country:'Hong Kong',lat:22.32,lng:114.17},{name:'Bangkok',country:'Thailand',lat:13.75,lng:100.50},{name:'Mumbai',country:'India',lat:19.07,lng:72.87},{name:'Port Said',country:'Egypt',lat:31.26,lng:32.30},{name:'Marseille',country:'France',lat:43.30,lng:5.37}], status: 'active', region: 'asia-europe', severity: 'medium' },
  { id: 'jupiter',         name: 'Jupiter',               type: 'transpacific',  length_km: 14000, capacity_tbps: 60,  rfs_year: 2020, owners: ['Amazon','Meta','SoftBank','NTT'], landing_points: [{name:'Los Angeles',country:'US',lat:34.05,lng:-118.24},{name:'Maruyama',country:'Japan',lat:35.00,lng:139.99},{name:'Daet',country:'Philippines',lat:14.11,lng:122.95}], status: 'active', region: 'pacific', severity: 'low' },
  { id: 'honomoana',       name: 'Honomoana',             type: 'transpacific',  length_km: 15000, capacity_tbps: 200, rfs_year: 2026, owners: ['Google','Meta'],              landing_points: [{name:'Los Angeles',country:'US',lat:34.05,lng:-118.24},{name:'Hawaii',country:'US',lat:21.30,lng:-157.85},{name:'Sydney',country:'Australia',lat:-33.87,lng:151.21}], status: 'construction', region: 'pacific', severity: 'low' },
  { id: 'new-cable',       name: 'New Cross Pacific',     type: 'transpacific',  length_km: 13000, capacity_tbps: 80,  rfs_year: 2018, owners: ['China Telecom','China Mobile','China Unicom'], landing_points: [{name:'Chongming',country:'China',lat:31.62,lng:121.40},{name:'Busan',country:'South Korea',lat:35.10,lng:129.04},{name:'Maruyama',country:'Japan',lat:35.00,lng:139.99},{name:'Hillsboro',country:'US',lat:45.52,lng:-122.99}], status: 'active', region: 'pacific', severity: 'high' },
  { id: 'curie',           name: 'Curie',                 type: 'americas',      length_km: 10400, capacity_tbps: 72,  rfs_year: 2019, owners: ['Google'],                    landing_points: [{name:'Los Angeles',country:'US',lat:34.05,lng:-118.24},{name:'Valparaiso',country:'Chile',lat:-33.05,lng:-71.62}], status: 'active', region: 'americas', severity: 'low' },
  { id: 'monet',           name: 'Monet',                 type: 'americas',      length_km: 10500, capacity_tbps: 60,  rfs_year: 2017, owners: ['Google','Algar','Antel'],      landing_points: [{name:'Boca Raton',country:'US',lat:26.36,lng:-80.08},{name:'Santos',country:'Brazil',lat:-23.96,lng:-46.33}], status: 'active', region: 'americas', severity: 'low' },
  { id: 'south-atlantic-3',name: 'SACS',                  type: 'transatlantic', length_km: 6200,  capacity_tbps: 40,  rfs_year: 2018, owners: ['Angola Cables'],             landing_points: [{name:'Luanda',country:'Angola',lat:-8.83,lng:13.23},{name:'Fortaleza',country:'Brazil',lat:-3.73,lng:-38.53}], status: 'active', region: 'atlantic', severity: 'low' },
];

const FILTER_PRESETS = [
  { id: 'all',        label: 'Все кабели',           params: {} },
  { id: 'critical',   label: 'Критические',           params: { severity: 'critical' } },
  { id: 'damaged',    label: 'Повреждённые',          params: { status: 'damaged' } },
  { id: 'transatl',   label: 'Трансатлантические',    params: { type: 'transatlantic' } },
  { id: 'transpac',   label: 'Транстихоокеанские',    params: { type: 'transpacific' } },
  { id: 'high-cap',   label: 'Мощные (> 100 Tbps)',   params: { min_capacity: 100 } },
  { id: 'active',     label: 'Активные',              params: { status: 'active' } },
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
      err.hint = 'run scripts/collectors/collect-undersea-cables.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractCables(doc) {
  if (Array.isArray(doc)) return { cables: doc, meta: null };
  if (!doc || typeof doc !== 'object') return { cables: [], meta: null };
  if (Array.isArray(doc.cables)) return { cables: doc.cables, meta: doc.meta || null };
  if (Array.isArray(doc.data))   return { cables: doc.data,   meta: doc.meta || null };
  if (Array.isArray(doc.items))  return { cables: doc.items,  meta: doc.meta || null };
  return { cables: [], meta: null };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function severityToStatus(sev) {
  const s = String(sev || '').toLowerCase();
  if (s === 'critical') return 'damaged';
  if (s === 'high') return 'active';
  return 'active';
}

function normalizeCable(c, i) {
  const id = String(c.id || c.slug || `cable-${i}`);
  const name = c.name || id;
  const lat = Number(c.lat ?? c.latitude);
  const lng = Number(c.lng ?? c.lon ?? c.longitude);
  const length = Number(c.length_km ?? c.length);
  const capacity = Number(c.capacity_tbps ?? c.capacity);
  const type = String(c.type || c.cable_type || 'unknown').toLowerCase();
  const severity = String(c.severity || 'low').toLowerCase();
  const status = String(c.status || severityToStatus(severity)).toLowerCase();

  const typeMeta = TYPE_META[type] || TYPE_META.unknown;
  const sevMeta = SEVERITY_META[severity] || SEVERITY_META.unknown;
  const statMeta = STATUS_META[status] || STATUS_META.unknown;

  let chokepoint = null, chokepointDist = Infinity;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    for (const ck of CHOKEPOINTS) {
      const d = Math.sqrt((lat - ck.lat) ** 2 + (lng - ck.lng) ** 2);
      if (d < chokepointDist && d < 5) { chokepoint = ck; chokepointDist = d; }
    }
  }

  const landingPoints = Array.isArray(c.landing_points)
    ? c.landing_points.map(lp => ({
        name: lp.name || null,
        country: lp.country || null,
        lat: Number.isFinite(Number(lp.lat)) ? Number(Number(lp.lat).toFixed(4)) : null,
        lng: Number.isFinite(Number(lp.lng)) ? Number(Number(lp.lng).toFixed(4)) : null,
      }))
    : [];

  return {
    id, name, type,
    typeLabel: typeMeta.label, typeColor: typeMeta.color, typeIcon: typeMeta.icon,
    length_km: Number.isFinite(length) && length > 0 ? Math.round(length) : null,
    capacity_tbps: Number.isFinite(capacity) && capacity > 0 ? Number(capacity.toFixed(1)) : null,
    rfs_year: c.rfs_year || c.rfs || null,
    owners: Array.isArray(c.owners) ? c.owners : (c.owner ? [c.owner] : []),
    landing_points: landingPoints,
    landing_count: landingPoints.length,
    status,
    statusLabel: statMeta.label, statusColor: statMeta.color,
    severity,
    severityLabel: sevMeta.label, severityColor: sevMeta.color, severityValue: sevMeta.severity,
    region: c.region || null,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    chokepoint: chokepoint ? chokepoint.id : null,
    chokepointName: chokepoint ? chokepoint.name : null,
    notes: c.notes || null,
    timestamp: c.timestamp || null,
    category_: 'infrastructure',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function inBbox(c, w, s, e, n) {
  return c.lat != null && c.lng != null && c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e;
}

function applyFilters(cables, query) {
  let r = cables.slice();
  if (query.region)     r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.type)       r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.severity)   r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.status)     r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.owner)      r = r.filter(x => x.owners.some(o => String(o).toLowerCase().includes(String(query.owner).toLowerCase())));
  if (query.chokepoint) r = r.filter(x => x.chokepoint === String(query.chokepoint).toLowerCase());
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.region || '') + ' ' + x.owners.join(' ')).toLowerCase().includes(q));
  }
  if (query.min_capacity != null) { const n = Number(query.min_capacity); if (Number.isFinite(n)) r = r.filter(x => x.capacity_tbps != null && x.capacity_tbps >= n); }
  if (query.max_capacity != null) { const n = Number(query.max_capacity); if (Number.isFinite(n)) r = r.filter(x => x.capacity_tbps != null && x.capacity_tbps <= n); }
  if (query.min_length != null) { const n = Number(query.min_length); if (Number.isFinite(n)) r = r.filter(x => x.length_km != null && x.length_km >= n); }
  if (query.bbox) {
    const [w, s, e, n] = String(query.bbox).split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) r = r.filter(x => inBbox(x, w, s, e, n));
  }

  const sortKey = query.sort || 'capacity-desc';
  if (sortKey === 'capacity-desc')     r.sort((a, b) => (b.capacity_tbps ?? -1) - (a.capacity_tbps ?? -1));
  else if (sortKey === 'capacity-asc') r.sort((a, b) => (a.capacity_tbps ?? 1e9) - (b.capacity_tbps ?? 1e9));
  else if (sortKey === 'length-desc')  r.sort((a, b) => (b.length_km ?? -1) - (a.length_km ?? -1));
  else if (sortKey === 'length-asc')   r.sort((a, b) => (a.length_km ?? 1e9) - (b.length_km ?? 1e9));
  else if (sortKey === 'name')         r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'severity')     r.sort((a, b) => (b.severityValue ?? 0) - (a.severityValue ?? 0));
  else if (sortKey === 'year-desc')    r.sort((a, b) => (b.rfs_year ?? 0) - (a.rfs_year ?? 0));
  else if (sortKey === 'year-asc')     r.sort((a, b) => (a.rfs_year ?? 9999) - (b.rfs_year ?? 9999));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(cables) {
  const byType = {};
  const byRegion = {};
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const byStatus = {};
  const owners = {};
  let totalLength = 0, totalCapacity = 0;

  for (const c of cables) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    if (c.region) byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    for (const o of c.owners) owners[o] = (owners[o] || 0) + 1;
    if (c.length_km != null) totalLength += c.length_km;
    if (c.capacity_tbps != null) totalCapacity += c.capacity_tbps;
  }

  const top = (obj, n = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    count: cables.length,
    with_coords: cables.filter(c => c.lat != null && c.lng != null).length,
    with_chokepoint: cables.filter(c => c.chokepoint).length,
    total_length_km: totalLength,
    total_capacity_tbps: Number(totalCapacity.toFixed(1)),
    avg_capacity_tbps: cables.length ? Number((totalCapacity / cables.length).toFixed(1)) : 0,
    by_type: byType,
    by_region: byRegion,
    by_severity: bySeverity,
    by_status: byStatus,
    top_owners: top(owners, 15),
    top_types: top(byType, 10),
    top_regions: top(byRegion, 10),
  };
}

function computeChokepoints(cables) {
  return CHOKEPOINTS.map(c => {
    const near = cables.filter(x => x.chokepoint === c.id);
    const totalCapacity = near.reduce((s, x) => s + (x.capacity_tbps ?? 0), 0);
    return {
      ...c,
      cables_count: near.length,
      total_capacity_tbps: Number(totalCapacity.toFixed(1)),
      cables: near.map(x => ({ id: x.id, name: x.name, capacity_tbps: x.capacity_tbps, severity: x.severity })),
    };
  });
}

function computeCapacityDistribution(cables) {
  const buckets = [
    { min: 0,   max: 20,  label: '< 20 Tbps',    color: '#22c55e' },
    { min: 20,  max: 50,  label: '20-50 Tbps',   color: '#84cc16' },
    { min: 50,  max: 100, label: '50-100 Tbps',  color: '#eab308' },
    { min: 100, max: 200, label: '100-200 Tbps', color: '#f97316' },
    { min: 200, max: Infinity, label: '> 200 Tbps', color: '#dc2626' },
  ];
  return buckets.map(b => {
    const items = cables.filter(c => c.capacity_tbps != null && c.capacity_tbps >= b.min && c.capacity_tbps < b.max);
    return { label: b.label, range: [b.min, b.max === Infinity ? 'inf' : b.max], color: b.color, count: items.length, cables: items.map(x => x.id) };
  }).filter(b => b.count > 0);
}

function computeLengthDistribution(cables) {
  const buckets = [
    { min: 0,     max: 2000,   label: '< 2000 km',      color: '#22c55e' },
    { min: 2000,  max: 6000,   label: '2000-6000 km',   color: '#84cc16' },
    { min: 6000,  max: 12000,  label: '6000-12000 km',  color: '#eab308' },
    { min: 12000, max: 20000,  label: '12000-20000 km', color: '#f97316' },
    { min: 20000, max: Infinity, label: '> 20000 km',   color: '#dc2626' },
  ];
  return buckets.map(b => {
    const items = cables.filter(c => c.length_km != null && c.length_km >= b.min && c.length_km < b.max);
    return { label: b.label, range: [b.min, b.max === Infinity ? 'inf' : b.max], color: b.color, count: items.length, cables: items.map(x => x.id) };
  }).filter(b => b.count > 0);
}

function computeAllLandingPoints(cables) {
  const points = [];
  for (const c of cables) {
    for (const lp of c.landing_points) {
      if (!lp.name) continue;
      points.push({ cable_id: c.id, cable_name: c.name, name: lp.name, country: lp.country, lat: lp.lat, lng: lp.lng });
    }
  }
  return points;
}

function computeTimeline(cables) {
  const byDate = {};
  for (const c of cables) {
    if (!c.timestamp) continue;
    const date = String(c.timestamp).slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, count: 0, by_severity: {} };
    byDate[date].count++;
    byDate[date].by_severity[c.severity] = (byDate[date].by_severity[c.severity] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function toReport(cables, stats, chokepoints) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  UNDERSEA CABLES REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего кабелей: ${stats.count}`);
  lines.push(`С координатами: ${stats.with_coords}`);
  lines.push(`Привязаны к chokepoint: ${stats.with_chokepoint}`);
  lines.push('');
  lines.push(`Общая длина: ${stats.total_length_km.toLocaleString()} км`);
  lines.push(`Общая пропускная способность: ${stats.total_capacity_tbps} Tbps`);
  lines.push(`Средняя пропускная: ${stats.avg_capacity_tbps} Tbps`);
  lines.push('');
  lines.push('SEVERITY:');
  for (const [k, v] of Object.entries(stats.by_severity)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  lines.push('ТИПЫ:');
  for (const [k, v] of Object.entries(stats.by_type)) lines.push(`  ${k.padEnd(16)} ${v}`);
  lines.push('');
  lines.push('CHOKEPOINTS (кабельные узлы):');
  for (const c of chokepoints) {
    lines.push(`  ${c.name.padEnd(28)} ${String(c.cables_count).padStart(3)} кабелей, ${c.total_capacity_tbps} Tbps`);
  }
  lines.push('');
  lines.push('ТОП-10 по capacity:');
  for (const c of cables.slice().sort((a, b) => (b.capacity_tbps ?? 0) - (a.capacity_tbps ?? 0)).slice(0, 10)) {
    lines.push(`  ${String(c.capacity_tbps).padStart(6)} Tbps  ${c.name.padEnd(24)} ${c.severity}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(cables) {
  const features = [];
  for (const c of cables) {
    const points = c.landing_points.filter(lp => Number.isFinite(lp.lat) && Number.isFinite(lp.lng));
    if (points.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: points.map(lp => [lp.lng, lp.lat]) },
        properties: {
          id: c.id, name: c.name, kind: 'line',
          type: c.type, typeLabel: c.typeLabel, typeColor: c.typeColor,
          capacity_tbps: c.capacity_tbps, length_km: c.length_km, rfs_year: c.rfs_year,
          severity: c.severity, severityColor: c.severityColor,
          status: c.status, statusColor: c.statusColor,
          owners: c.owners, region: c.region, chokepoint: c.chokepointName,
          category_: c.category_, icon: c.icon,
        },
      });
    }
    if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: `${c.id}-point`, name: c.name, kind: 'point',
          type: c.type, typeLabel: c.typeLabel, typeColor: c.typeColor,
          severity: c.severity, severityColor: c.severityColor,
          status: c.status, statusColor: c.statusColor,
          capacity_tbps: c.capacity_tbps, length_km: c.length_km,
          category_: c.category_, icon: c.icon,
        },
      });
    }
    for (const lp of points) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lp.lng, lp.lat] },
        properties: {
          id: `${c.id}-lp-${lp.name}`, name: lp.name, kind: 'landing',
          country: lp.country, cable_id: c.id, cable_name: c.name,
          type: c.type, typeColor: c.typeColor,
          severity: c.severity, severityColor: c.severityColor,
          icon: '📍',
        },
      });
    }
  }
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      types: Object.entries(TYPE_META).map(([k, v]) => ({ key: k, ...v })),
      severity: Object.entries(SEVERITY_META).map(([k, v]) => ({ key: k, ...v })),
      status: Object.entries(STATUS_META).map(([k, v]) => ({ key: k, ...v })),
    },
    meta: { total: cables.length, features: features.length },
  };
}

function toSeries(cables) {
  return cables.map(c => ({
    id: c.id, name: c.name, type: c.type, region: c.region,
    length_km: c.length_km, capacity_tbps: c.capacity_tbps, rfs_year: c.rfs_year,
    status: c.status, severity: c.severity, owners: c.owners,
    landing_count: c.landing_count, chokepoint: c.chokepoint,
  }));
}

function toCSV(cables) {
  const lines = ['id,name,type,region,length_km,capacity_tbps,rfs_year,status,severity,landing_count,owners,chokepoint,lat,lng'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const c of cables) {
    lines.push([c.id, c.name, c.type, c.region, c.length_km, c.capacity_tbps, c.rfs_year, c.status, c.severity, c.landing_count, c.owners.join('|'), c.chokepoint, c.lat, c.lng].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(cables, chokepoints) {
  const markers = cables
    .filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map(c => ({
      id: c.id, lat: c.lat, lng: c.lng,
      color: c.severityColor, icon: c.typeIcon,
      radius: c.severity === 'critical' ? 12 : (c.severity === 'high' ? 9 : 6),
      properties: { name: c.name, type: c.type, capacity_tbps: c.capacity_tbps, status: c.status, severity: c.severity, owners: c.owners },
    }));
  const chokepointMarkers = chokepoints.map(c => ({
    id: `chk-${c.id}`, lat: c.lat, lng: c.lng,
    color: '#dc2626', icon: '⚠️', radius: 15,
    properties: { name: c.name, traffic_pct: c.traffic_pct, cables_count: c.cables_count },
  }));
  return {
    markers,
    chokepoints: chokepointMarkers,
    legend: {
      types: Object.entries(TYPE_META).map(([k, v]) => ({ key: k, ...v })),
      severity: Object.entries(SEVERITY_META).map(([k, v]) => ({ key: k, ...v })),
    },
    filterable: ['region', 'type', 'severity', 'status', 'owner', 'chokepoint', 'min_capacity', 'bbox', 'sort'],
    totals: { markers: markers.length, chokepoints: chokepointMarkers.length },
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/undersea-cables/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'undersea-cables-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    if (sub === '/builtin') {
      const rows = BUILTIN_CABLES.map(normalizeCable);
      const chokepoints = computeChokepoints(rows);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        chokepoints,
        landing_points: computeAllLandingPoints(rows).slice(0, 50),
        meta: { source: 'builtin', count: rows.length, generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/config') {
      return sendJSON(res, 200, {
        types: Object.entries(TYPE_META).map(([k, v]) => ({ key: k, ...v })),
        severity: Object.entries(SEVERITY_META).map(([k, v]) => ({ key: k, ...v })),
        statuses: Object.entries(STATUS_META).map(([k, v]) => ({ key: k, ...v })),
        chokepoints: CHOKEPOINTS,
        filter_presets: FILTER_PRESETS,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

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

    const { cables: rawArr, meta: srcMeta } = extractCables(doc);
    const all = rawArr.map(normalizeCable);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online', basket_available: true, cables: all.length,
        cache_size: _cache.size, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/count') {
      const stats = computeStats(all);
      return sendJSON(res, 200, {
        total: stats.count, by_severity: stats.by_severity, by_status: stats.by_status,
        total_capacity_tbps: stats.total_capacity_tbps, with_chokepoint: stats.with_chokepoint,
      }, extra);
    }
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online', cables: all.length, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/cables') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { cables: rows, count: rows.length, total: all.length }, extra);
    }
    if (sub.startsWith('/cables/')) {
      const id = decodeURIComponent(sub.slice('/cables/'.length));
      const cable = all.find(c => c.id === id);
      if (!cable) return sendJSON(res, 404, { error: 'cable_not_found', id }, extra);
      return sendJSON(res, 200, { cable }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.capacity_tbps ?? 0) - (a.capacity_tbps ?? 0)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.capacity_tbps ?? 1e9) - (b.capacity_tbps ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/by-region') {
      const byRegion = {};
      for (const c of all) {
        const r = c.region || 'unknown';
        if (!byRegion[r]) byRegion[r] = { region: r, count: 0, total_capacity_tbps: 0, total_length_km: 0, cables: [] };
        byRegion[r].count++;
        if (c.capacity_tbps != null) byRegion[r].total_capacity_tbps += c.capacity_tbps;
        if (c.length_km != null) byRegion[r].total_length_km += c.length_km;
        byRegion[r].cables.push(c.id);
      }
      return sendJSON(res, 200, { regions: Object.values(byRegion), total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/by-type') {
      const byType = {};
      for (const c of all) {
        if (!byType[c.type]) byType[c.type] = { name: c.type, label: c.typeLabel, color: c.typeColor, icon: c.typeIcon, count: 0, total_capacity_tbps: 0, cables: [] };
        byType[c.type].count++;
        if (c.capacity_tbps != null) byType[c.type].total_capacity_tbps += c.capacity_tbps;
        byType[c.type].cables.push(c.id);
      }
      return sendJSON(res, 200, { types: Object.values(byType), total: Object.keys(byType).length }, extra);
    }
    if (sub === '/by-severity') {
      const bySeverity = {};
      for (const c of all) {
        if (!bySeverity[c.severity]) bySeverity[c.severity] = { name: c.severity, label: c.severityLabel, color: c.severityColor, severity: c.severityValue, count: 0, cables: [] };
        bySeverity[c.severity].count++;
        bySeverity[c.severity].cables.push(c.id);
      }
      return sendJSON(res, 200, { severities: Object.values(bySeverity), total: Object.keys(bySeverity).length }, extra);
    }
    if (sub === '/by-owner') {
      const owners = {};
      for (const c of all) {
        for (const o of c.owners) {
          if (!owners[o]) owners[o] = { name: o, count: 0, cables: [] };
          owners[o].count++;
          owners[o].cables.push(c.id);
        }
      }
      const result = Object.values(owners).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { owners: result, total: result.length }, extra);
    }
    if (sub === '/critical') {
      const rows = all.filter(c => c.severity === 'critical');
      return sendJSON(res, 200, { critical: rows, count: rows.length }, extra);
    }
    if (sub === '/damaged') {
      const rows = all.filter(c => c.status === 'damaged' || c.severity === 'critical' || c.severity === 'high');
      return sendJSON(res, 200, { damaged: rows, count: rows.length }, extra);
    }
    if (sub === '/chokepoints') {
      const chokepoints = computeChokepoints(all);
      return sendJSON(res, 200, { chokepoints, count: chokepoints.length }, extra);
    }
    if (sub === '/landing-points') {
      const points = computeAllLandingPoints(all);
      const limit = parseInt(query.limit, 10) || 200;
      return sendJSON(res, 200, { landing_points: points.slice(0, limit), count: points.length }, extra);
    }
    if (sub === '/capacity') {
      const distribution = computeCapacityDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/length') {
      const distribution = computeLengthDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(c => (c.name + ' ' + (c.region || '') + ' ' + c.owners.join(' ')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/bbox') {
      const w = Number(query.w), s = Number(query.s), e = Number(query.e), n = Number(query.n);
      if (![w, s, e, n].every(Number.isFinite)) return sendJSON(res, 400, { error: 'field_required: w,s,e,n' }, extra);
      const rows = all.filter(c => inBbox(c, w, s, e, n));
      return sendJSON(res, 200, { bbox: [w, s, e, n], cables: rows, count: rows.length }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(c => c.id === id)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(all);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const trends = {
        top_capacity: all.slice().sort((a, b) => (b.capacity_tbps ?? 0) - (a.capacity_tbps ?? 0)).slice(0, 10).map(c => ({ name: c.name, capacity_tbps: c.capacity_tbps })),
        top_length: all.slice().sort((a, b) => (b.length_km ?? 0) - (a.length_km ?? 0)).slice(0, 10).map(c => ({ name: c.name, length_km: c.length_km })),
        by_severity: computeStats(all).by_severity,
        by_status: computeStats(all).by_status,
      };
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(all);
      const chokepoints = computeChokepoints(all);
      const report = toReport(all, stats, chokepoints);
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
      const chokepoints = computeChokepoints(rows);
      return sendJSON(res, 200, { render: toRenderConfig(rows, chokepoints) }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    const chokepoints = computeChokepoints(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_cables: all.length, returned_cables: rows.length,
        upstream_meta: srcMeta, generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      chokepoints,
      landing_points: computeAllLandingPoints(rows).slice(0, 30),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e2) {}
  }
}
