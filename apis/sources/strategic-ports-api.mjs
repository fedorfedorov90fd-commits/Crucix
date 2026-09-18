/**
 * apis/sources/strategic-ports-api.mjs — API-МОДУЛЬ: СТРАТЕГИЧЕСКИЕ МОРСКИЕ ПОРТЫ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/strategic-ports.json — [{ id, name, country, lat, lng, type, capacity_teu?, throughput?, strategic_importance?, risk_level?, status?, region?, operator?, notes?, vessels_count? }]
 *           ИЛИ fallback data/basket/ports.json — [{ id, name, lat, lng, severity, timestamp }]
 *           ИЛИ fallback внутренний (20 крупнейших портов мира).
 * Сборщик: scripts/collectors/collect-strategic-ports.mjs.
 *
 * Стратегические морские порты мира: глобальные логистические узлы,
 * узкие места (chokepoints) мировой торговли, риск-классификация.
 *
 * Классификация:
 *   - strategic_importance: critical / high / medium / low
 *   - risk_level: severe / high / moderate / low
 *   - type: container / oil / gas / bulk / mixed / naval / fishing
 *
 * ФОРМАТЫ: json (FC + series + stats + chokepoints), csv, series, stats, raw, report.
 * ФИЛЬТРЫ: ?country=, ?region=, ?type=, ?importance=, ?risk=, ?chokepoint=, ?q=, ?bbox=, ?min_capacity=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                       — сводка
 *   GET /stats                  — агрегированная статистика
 *   GET /status                 — health-check
 *   GET /health                 — расширенный health
 *   GET /config                 — конфигурация (типы, важности, риски, chokepoints)
 *   GET /count                  — только числа
 *   GET /ports                  — все порты
 *   GET /ports/:id              — конкретный порт
 *   GET /top?n=N                — топ-N по throughput
 *   GET /bottom?n=N             — антитоп по throughput
 *   GET /by-country             — группировка по странам
 *   GET /by-region              — группировка по регионам
 *   GET /by-type                — группировка по типам
 *   GET /by-importance          — группировка по важности
 *   GET /by-risk                — группировка по риску
 *   GET /strategic              — только critical/high важности
 *   GET /chokepoints            — узкие места (Суэц, Босфор, Ормуз, Малакка, Баб-эль-Мандеб, Панама, Гибралтар)
 *   GET /hotspots               — порты с высоким риском в горячих зонах
 *   GET /risk                   — порты с risk_level >= high
 *   GET /capacity               — распределение по TEU
 *   GET /throughput             — распределение по throughput
 *   GET /search?q=              — текстовый поиск
 *   GET /bbox?w=&s=&e=&n=       — порты в bbox
 *   GET /compare?ids=a,b,c      — сравнение портов
 *   GET /timeline               — динамика по timestamp
 *   GET /trends                 — тренды (7 vs 7 по timestamp)
 *   GET /anomalies              — аномалии (по severity)
 *   GET /filter-presets         — готовые фильтры
 *   GET /export                 — текстовый отчёт
 *   GET /reset-cache            — сброс кэша
 *   GET /featurecollection      — чистый GeoJSON
 *   GET /render                 — рендер-конфиг
 *   GET /builtin                — встроенный fallback (20 портов)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'strategic-ports.json');
const FALLBACK_FILE = join(PROJECT_ROOT, 'data', 'basket', 'ports.json');

export const route  = '/api/layers/strategic-ports';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '⚓',
  color: '#0891b2',
  vizType: 'marker',
  source: 'basket/strategic-ports.json',
  collector: 'collect-strategic-ports.mjs',
  cache: 300,
  description: 'Стратегические морские порты и chokepoints: логистические узлы, риски, узкие места мировой торговли',
  unit: 'ports',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const IMPORTANCE_META = {
  critical: { color: '#dc2626', label: 'Критическая важность', severity: 4 },
  high:     { color: '#f97316', label: 'Высокая важность',     severity: 3 },
  medium:   { color: '#eab308', label: 'Средняя важность',     severity: 2 },
  low:      { color: '#22c55e', label: 'Низкая важность',      severity: 1 },
  unknown:  { color: '#64748b', label: 'Неизвестно',           severity: 0 },
};

const RISK_META = {
  severe:   { color: '#dc2626', label: 'Острый риск',      severity: 4 },
  high:     { color: '#f97316', label: 'Высокий риск',     severity: 3 },
  moderate: { color: '#eab308', label: 'Умеренный риск',   severity: 2 },
  low:      { color: '#22c55e', label: 'Низкий риск',      severity: 1 },
  unknown:  { color: '#64748b', label: 'Неизвестно',       severity: 0 },
};

const TYPE_META = {
  container: { color: '#0ea5e9', icon: '📦', label: 'Контейнерный' },
  oil:       { color: '#f97316', icon: '🛢️', label: 'Нефтяной' },
  gas:       { color: '#06b6d4', icon: '🔥', label: 'Газовый' },
  bulk:      { color: '#a855f7', icon: '⛏️', label: 'Навалочный' },
  mixed:     { color: '#8b5cf6', icon: '🚢', label: 'Смешанный' },
  naval:     { color: '#dc2626', icon: '⚔️', label: 'Военно-морской' },
  fishing:   { color: '#22c55e', icon: '🎣', label: 'Рыболовный' },
  unknown:   { color: '#64748b', icon: '⚓', label: 'Неизвестно' },
};

// Узкие места мировой торговли
const CHOKEPOINTS = [
  { id: 'suez',          name: 'Суэцкий канал',           lat: 30.5,  lng: 32.5,   near_ports: ['portsaid', 'suez'],       traffic_pct: 12, severity: 'critical' },
  { id: 'bosphorus',     name: 'Босфор',                  lat: 41.1,  lng: 29.0,   near_ports: ['istanbul', 'odessa'],     traffic_pct: 3,  severity: 'high' },
  { id: 'hormuz',        name: 'Ормузский пролив',        lat: 26.5,  lng: 56.0,   near_ports: ['jebel-ali', 'fujairah'],  traffic_pct: 20, severity: 'critical' },
  { id: 'malacca',       name: 'Малаккский пролив',       lat: 1.5,   lng: 102.5,  near_ports: ['singapore', 'port-klang'], traffic_pct: 25, severity: 'critical' },
  { id: 'bab-el-mandeb', name: 'Баб-эль-Мандебский',      lat: 12.6,  lng: 43.4,   near_ports: ['djibouti', 'aden'],       traffic_pct: 8,  severity: 'critical' },
  { id: 'panama',        name: 'Панамский канал',         lat: 9.1,   lng: -79.7,  near_ports: ['balboa', 'colon'],        traffic_pct: 5,  severity: 'high' },
  { id: 'gibraltar',     name: 'Гибралтарский пролив',    lat: 36.0,  lng: -5.0,   near_ports: ['algeciras', 'tangier'],   traffic_pct: 10, severity: 'high' },
  { id: 'taiwan-strait', name: 'Тайваньский пролив',      lat: 24.5,  lng: 119.5,  near_ports: ['kaohsiung', 'xiamen'],    traffic_pct: 7,  severity: 'high' },
  { id: 'danish-straits',name: 'Датские проливы',         lat: 56.0,  lng: 11.0,   near_ports: ['copenhagen', 'gothenburg'], traffic_pct: 4, severity: 'medium' },
  { id: 'korea-strait',  name: 'Корейский пролив',        lat: 34.5,  lng: 129.0,  near_ports: ['busan', 'kitakyushu'],    traffic_pct: 5,  severity: 'medium' },
];

// 20 крупнейших стратегических портов мира
const BUILTIN_PORTS = [
  { id: 'shanghai',    name: 'Port of Shanghai',       country: 'Китай',         region: 'aziya',         lat: 31.23, lng: 121.47,  type: 'container', capacity_teu: 47000000, throughput: 47, importance: 'critical', risk: 'moderate' },
  { id: 'singapore',   name: 'Port of Singapore',      country: 'Сингапур',      region: 'aziya',         lat: 1.29,  lng: 103.85,  type: 'container', capacity_teu: 39000000, throughput: 39, importance: 'critical', risk: 'low' },
  { id: 'ningbo',      name: 'Port of Ningbo-Zhoushan',country: 'Китай',         region: 'aziya',         lat: 29.87, lng: 121.55,  type: 'bulk',      capacity_teu: 33000000, throughput: 33, importance: 'critical', risk: 'moderate' },
  { id: 'shenzhen',    name: 'Port of Shenzhen',       country: 'Китай',         region: 'aziya',         lat: 22.50, lng: 114.05,  type: 'container', capacity_teu: 30000000, throughput: 30, importance: 'critical', risk: 'moderate' },
  { id: 'guangzhou',   name: 'Port of Guangzhou',      country: 'Китай',         region: 'aziya',         lat: 22.75, lng: 113.60,  type: 'container', capacity_teu: 25000000, throughput: 25, importance: 'high',     risk: 'moderate' },
  { id: 'busan',       name: 'Port of Busan',          country: 'Южная Корея',   region: 'aziya',         lat: 35.10, lng: 129.04,  type: 'container', capacity_teu: 22000000, throughput: 22, importance: 'high',     risk: 'low' },
  { id: 'rotterdam',   name: 'Port of Rotterdam',      country: 'Нидерланды',    region: 'evropa',        lat: 51.95, lng: 4.14,    type: 'mixed',     capacity_teu: 15000000, throughput: 15, importance: 'critical', risk: 'low' },
  { id: 'jebel-ali',   name: 'Jebel Ali',              country: 'ОАЭ',           region: 'blizhny-vostok', lat: 25.00, lng: 55.06,  type: 'container', capacity_teu: 14500000, throughput: 14.5, importance: 'critical', risk: 'high' },
  { id: 'qingdao',     name: 'Port of Qingdao',        country: 'Китай',         region: 'aziya',         lat: 36.07, lng: 120.32,  type: 'container', capacity_teu: 13000000, throughput: 13, importance: 'high',     risk: 'moderate' },
  { id: 'hongkong',    name: 'Port of Hong Kong',      country: 'Гонконг',       region: 'aziya',         lat: 22.32, lng: 114.17,  type: 'container', capacity_teu: 12000000, throughput: 12, importance: 'high',     risk: 'moderate' },
  { id: 'antwerp',     name: 'Port of Antwerp-Bruges', country: 'Бельгия',       region: 'evropa',        lat: 51.26, lng: 4.40,    type: 'mixed',     capacity_teu: 13500000, throughput: 13.5, importance: 'high',     risk: 'low' },
  { id: 'hamburg',     name: 'Port of Hamburg',        country: 'Германия',      region: 'evropa',        lat: 53.54, lng: 9.94,    type: 'mixed',     capacity_teu: 8300000,  throughput: 8.3,  importance: 'high',     risk: 'low' },
  { id: 'losangeles',  name: 'Port of Los Angeles',    country: 'США',           region: 'amerika',       lat: 33.74, lng: -118.27, type: 'container', capacity_teu: 9900000,  throughput: 9.9,  importance: 'critical', risk: 'low' },
  { id: 'longbeach',   name: 'Port of Long Beach',     country: 'США',           region: 'amerika',       lat: 33.75, lng: -118.19, type: 'container', capacity_teu: 9100000,  throughput: 9.1,  importance: 'high',     risk: 'low' },
  { id: 'tanjung',     name: 'Tanjung Pelepas',        country: 'Малайзия',      region: 'aziya',         lat: 1.36,  lng: 103.55,  type: 'container', capacity_teu: 10500000, throughput: 10.5, importance: 'high',     risk: 'low' },
  { id: 'kaohsiung',   name: 'Port of Kaohsiung',      country: 'Тайвань',       region: 'aziya',         lat: 22.62, lng: 120.28,  type: 'container', capacity_teu: 9900000,  throughput: 9.9,  importance: 'critical', risk: 'severe' },
  { id: 'novorossiysk',name: 'Новороссийск',           country: 'Россия',        region: 'vostochnaya-evropa', lat: 44.72, lng: 37.78, type: 'oil',   capacity_teu: 500000,   throughput: 5,    importance: 'high',     risk: 'high' },
  { id: 'vladivostok', name: 'Владивосток',            country: 'Россия',        region: 'aziya',         lat: 43.12, lng: 131.89,  type: 'mixed',     capacity_teu: 800000,   throughput: 1.2,  importance: 'medium',   risk: 'moderate' },
  { id: 'sevastopol',  name: 'Севастополь',            country: 'Россия',        region: 'vostochnaya-evropa', lat: 44.62, lng: 33.53, type: 'naval', capacity_teu: 0,     throughput: 0.5,  importance: 'high',     risk: 'severe' },
  { id: 'portsaid',    name: 'Port Said',              country: 'Египет',        region: 'afrika',        lat: 31.26, lng: 32.30,   type: 'mixed',     capacity_teu: 4000000,  throughput: 4,    importance: 'critical', risk: 'high' },
];

const FILTER_PRESETS = [
  { id: 'all',        label: 'Все порты',                params: {} },
  { id: 'critical',   label: 'Критические',              params: { importance: 'critical' } },
  { id: 'strategic',  label: 'Стратегические (critical/high)', params: { importance: 'high' } },
  { id: 'high-risk',  label: 'Высокий риск',             params: { risk: 'high' } },
  { id: 'oil',        label: 'Нефтяные',                 params: { type: 'oil' } },
  { id: 'container',  label: 'Контейнерные',             params: { type: 'container' } },
  { id: 'naval',      label: 'Военно-морские',           params: { type: 'naval' } },
  { id: 'chokepoints',label: 'Рядом с chokepoint',       params: {} },
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

async function loadBasket() {
  try {
    const raw = await fs.readFile(BASKET_FILE, 'utf8');
    return { data: JSON.parse(raw), source: 'strategic-ports.json' };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // Пробуем fallback на ports.json (автогенератор)
    try {
      const raw2 = await fs.readFile(FALLBACK_FILE, 'utf8');
      return { data: JSON.parse(raw2), source: 'ports.json (fallback)' };
    } catch (e2) {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-strategic-ports.mjs';
      throw err;
    }
  }
}

function extractPorts(doc) {
  if (Array.isArray(doc)) return { ports: doc, meta: null };
  if (!doc || typeof doc !== 'object') return { ports: [], meta: null };
  if (Array.isArray(doc.ports))  return { ports: doc.ports,  meta: doc.meta || null };
  if (Array.isArray(doc.data))   return { ports: doc.data,   meta: doc.meta || null };
  if (Array.isArray(doc.items))  return { ports: doc.items,  meta: doc.meta || null };
  return { ports: [], meta: null };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function severityToRisk(sev) {
  const s = String(sev || '').toLowerCase();
  if (s === 'critical') return 'severe';
  if (s === 'high')     return 'high';
  if (s === 'medium')   return 'moderate';
  if (s === 'low')      return 'low';
  return 'unknown';
}

function normalizePort(p, i) {
  const id = String(p.id || p.slug || `port-${i}`);
  const lat = Number(p.lat ?? p.latitude);
  const lng = Number(p.lng ?? p.lon ?? p.longitude);
  const throughput = Number(p.throughput);
  const capacity = Number(p.capacity_teu ?? p.capacity);
  const importance = String(p.importance ?? p.strategic_importance ?? 'unknown').toLowerCase();
  const risk = String(p.risk ?? p.risk_level ?? severityToRisk(p.severity)).toLowerCase();
  const type = String(p.type || 'unknown').toLowerCase();

  const impMeta = IMPORTANCE_META[importance] || IMPORTANCE_META.unknown;
  const riskMeta = RISK_META[risk] || RISK_META.unknown;
  const typeMeta = TYPE_META[type] || TYPE_META.unknown;

  // Ближайший chokepoint (по расстоянию)
  let chokepoint = null, chokepointDist = Infinity;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    for (const c of CHOKEPOINTS) {
      const d = Math.sqrt((lat - c.lat) ** 2 + (lng - c.lng) ** 2);
      if (d < chokepointDist && d < 5) { chokepoint = c; chokepointDist = d; }
    }
  }

  return {
    id,
    name: p.name || id,
    country: p.country || null,
    region: p.region || null,
    type,
    typeLabel: typeMeta.label,
    typeColor: typeMeta.color,
    typeIcon: typeMeta.icon,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    throughput: Number.isFinite(throughput) ? Number(throughput.toFixed(2)) : null,
    capacity_teu: Number.isFinite(capacity) && capacity > 0 ? Math.round(capacity) : null,
    importance,
    importanceLabel: impMeta.label,
    importanceColor: impMeta.color,
    importanceSeverity: impMeta.severity,
    risk,
    riskLabel: riskMeta.label,
    riskColor: riskMeta.color,
    riskSeverity: riskMeta.severity,
    chokepoint: chokepoint ? chokepoint.id : null,
    chokepointName: chokepoint ? chokepoint.name : null,
    operator: p.operator || null,
    notes: p.notes || null,
    timestamp: p.timestamp || null,
    category_: 'transport',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function inBbox(p, w, s, e, n) {
  return p.lat != null && p.lng != null && p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e;
}

function applyFilters(ports, query) {
  let r = ports.slice();
  if (query.country)    r = r.filter(x => String(x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.region)     r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.type)       r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.importance) r = r.filter(x => x.importance === String(query.importance).toLowerCase());
  if (query.risk)       r = r.filter(x => x.risk === String(query.risk).toLowerCase());
  if (query.chokepoint) r = r.filter(x => x.chokepoint === String(query.chokepoint).toLowerCase());
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.country || '') + ' ' + (x.region || '')).toLowerCase().includes(q));
  }
  if (query.min_capacity != null) { const n = Number(query.min_capacity); if (Number.isFinite(n)) r = r.filter(x => x.capacity_teu != null && x.capacity_teu >= n); }
  if (query.max_capacity != null) { const n = Number(query.max_capacity); if (Number.isFinite(n)) r = r.filter(x => x.capacity_teu != null && x.capacity_teu <= n); }
  if (query.min_throughput != null) { const n = Number(query.min_throughput); if (Number.isFinite(n)) r = r.filter(x => x.throughput != null && x.throughput >= n); }
  if (query.bbox) {
    const [w, s, e, n] = String(query.bbox).split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) r = r.filter(x => inBbox(x, w, s, e, n));
  }

  const sortKey = query.sort || 'throughput-desc';
  if (sortKey === 'throughput-desc') r.sort((a, b) => (b.throughput ?? -1) - (a.throughput ?? -1));
  else if (sortKey === 'throughput-asc') r.sort((a, b) => (a.throughput ?? 1e9) - (b.throughput ?? 1e9));
  else if (sortKey === 'capacity-desc') r.sort((a, b) => (b.capacity_teu ?? -1) - (a.capacity_teu ?? -1));
  else if (sortKey === 'capacity-asc')  r.sort((a, b) => (a.capacity_teu ?? 1e12) - (b.capacity_teu ?? 1e12));
  else if (sortKey === 'name')          r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'risk')          r.sort((a, b) => (b.riskSeverity ?? 0) - (a.riskSeverity ?? 0));
  else if (sortKey === 'importance')    r.sort((a, b) => (b.importanceSeverity ?? 0) - (a.importanceSeverity ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(ports) {
  const byImportance = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const byRisk = { severe: 0, high: 0, moderate: 0, low: 0, unknown: 0 };
  const byType = {};
  const byCountry = {};
  const byRegion = {};
  let totalThroughput = 0, totalCapacity = 0;

  for (const p of ports) {
    byImportance[p.importance] = (byImportance[p.importance] || 0) + 1;
    byRisk[p.risk] = (byRisk[p.risk] || 0) + 1;
    byType[p.type] = (byType[p.type] || 0) + 1;
    if (p.country) byCountry[p.country] = (byCountry[p.country] || 0) + 1;
    if (p.region) byRegion[p.region] = (byRegion[p.region] || 0) + 1;
    if (p.throughput != null) totalThroughput += p.throughput;
    if (p.capacity_teu != null) totalCapacity += p.capacity_teu;
  }

  const top = (obj, n = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    count: ports.length,
    with_coords: ports.filter(p => p.lat != null && p.lng != null).length,
    with_chokepoint: ports.filter(p => p.chokepoint).length,
    total_throughput: Number(totalThroughput.toFixed(2)),
    total_capacity_teu: totalCapacity,
    by_importance: byImportance,
    by_risk: byRisk,
    by_type: byType,
    top_countries: top(byCountry, 15),
    top_regions: top(byRegion, 10),
    top_types: top(byType, 10),
  };
}

function computeByCountry(ports) {
  const map = {};
  for (const p of ports) {
    const c = p.country || 'unknown';
    if (!map[c]) map[c] = { country: c, count: 0, total_throughput: 0, total_capacity: 0, importance_max: 'unknown', ports: [] };
    map[c].count++;
    if (p.throughput != null) map[c].total_throughput += p.throughput;
    if (p.capacity_teu != null) map[c].total_capacity += p.capacity_teu;
    if ((p.importanceSeverity ?? 0) > (IMPORTANCE_META[map[c].importance_max]?.severity ?? 0)) map[c].importance_max = p.importance;
    map[c].ports.push(p.id);
  }
  return Object.values(map).map(c => ({
    ...c,
    total_throughput: Number(c.total_throughput.toFixed(2)),
  })).sort((a, b) => b.count - a.count);
}

function computeByRegion(ports) {
  const map = {};
  for (const p of ports) {
    const r = p.region || 'unknown';
    if (!map[r]) map[r] = { region: r, count: 0, total_throughput: 0, top_ports: [] };
    map[r].count++;
    if (p.throughput != null) map[r].total_throughput += p.throughput;
    if (map[r].top_ports.length < 10) map[r].top_ports.push(p.id);
  }
  return Object.values(map).map(r => ({
    ...r,
    total_throughput: Number(r.total_throughput.toFixed(2)),
  })).sort((a, b) => b.count - a.count);
}

function computeChokepoints(ports) {
  return CHOKEPOINTS.map(c => {
    const near = ports.filter(p => p.chokepoint === c.id);
    const avgRisk = near.length ? near.reduce((s, p) => s + (p.riskSeverity ?? 0), 0) / near.length : 0;
    return {
      ...c,
      ports_count: near.length,
      ports: near.map(p => ({ id: p.id, name: p.name, risk: p.risk, importance: p.importance })),
      avg_risk_severity: Number(avgRisk.toFixed(2)),
    };
  });
}

function computeRiskHotspots(ports) {
  return ports
    .filter(p => p.risk === 'severe' || p.risk === 'high')
    .sort((a, b) => (b.riskSeverity ?? 0) - (a.riskSeverity ?? 0) || (b.importanceSeverity ?? 0) - (a.importanceSeverity ?? 0));
}

function computeCapacityDistribution(ports) {
  const buckets = [
    { min: 0, max: 1000000, label: '< 1M TEU', color: '#22c55e' },
    { min: 1000000, max: 5000000, label: '1-5M TEU', color: '#84cc16' },
    { min: 5000000, max: 15000000, label: '5-15M TEU', color: '#eab308' },
    { min: 15000000, max: 30000000, label: '15-30M TEU', color: '#f97316' },
    { min: 30000000, max: Infinity, label: '> 30M TEU', color: '#dc2626' },
  ];
  return buckets.map(b => {
    const items = ports.filter(p => p.capacity_teu != null && p.capacity_teu >= b.min && p.capacity_teu < b.max);
    return { label: b.label, range: [b.min, b.max === Infinity ? 'inf' : b.max], color: b.color, count: items.length, ports: items.map(p => p.id) };
  }).filter(b => b.count > 0);
}

function computeTimeline(ports) {
  const byDate = {};
  for (const p of ports) {
    if (!p.timestamp) continue;
    const date = String(p.timestamp).slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, count: 0, by_importance: {}, by_risk: {} };
    byDate[date].count++;
    byDate[date].by_importance[p.importance] = (byDate[date].by_importance[p.importance] || 0) + 1;
    byDate[date].by_risk[p.risk] = (byDate[date].by_risk[p.risk] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function toReport(ports, stats, chokepoints) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  STRATEGIC PORTS REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего портов: ${stats.count}`);
  lines.push(`С координатами: ${stats.with_coords}`);
  lines.push(`С привязкой к chokepoint: ${stats.with_chokepoint}`);
  lines.push('');
  lines.push(`Total throughput: ${stats.total_throughput} MT`);
  lines.push(`Total capacity: ${stats.total_capacity_teu.toLocaleString()} TEU`);
  lines.push('');
  lines.push('ВАЖНОСТЬ:');
  for (const [k, v] of Object.entries(stats.by_importance)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  lines.push('РИСК:');
  for (const [k, v] of Object.entries(stats.by_risk)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  lines.push('CHOKEPOINTS:');
  for (const c of chokepoints) {
    lines.push(`  ${c.name.padEnd(28)} ${String(c.ports_count).padStart(3)} портов, риск ${c.avg_risk_severity}, ${c.traffic_pct}% трафика`);
  }
  lines.push('');
  lines.push('ТОП-10 по throughput:');
  for (const p of ports.slice().sort((a, b) => (b.throughput ?? 0) - (a.throughput ?? 0)).slice(0, 10)) {
    lines.push(`  ${String(p.throughput).padStart(6)} MT  ${p.name.padEnd(28)} ${p.importance}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(ports) {
  const features = ports
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id, name: p.name, country: p.country, region: p.region,
        type: p.type, typeLabel: p.typeLabel, typeColor: p.typeColor, typeIcon: p.typeIcon,
        throughput: p.throughput, capacity_teu: p.capacity_teu,
        importance: p.importance, importanceLabel: p.importanceLabel, importanceColor: p.importanceColor,
        risk: p.risk, riskLabel: p.riskLabel, riskColor: p.riskColor,
        chokepoint: p.chokepoint, chokepointName: p.chokepointName,
        operator: p.operator, notes: p.notes,
        category_: p.category_, icon: p.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      importance: Object.entries(IMPORTANCE_META).map(([k, v]) => ({ key: k, ...v })),
      risk: Object.entries(RISK_META).map(([k, v]) => ({ key: k, ...v })),
      types: Object.entries(TYPE_META).map(([k, v]) => ({ key: k, ...v })),
    },
    meta: { total: ports.length, mapped: features.length, unmapped: ports.length - features.length },
  };
}

function toSeries(ports) {
  return ports.map(p => ({
    id: p.id, name: p.name, country: p.country, region: p.region,
    type: p.type, throughput: p.throughput, capacity_teu: p.capacity_teu,
    importance: p.importance, risk: p.risk, chokepoint: p.chokepoint,
  }));
}

function toCSV(ports) {
  const lines = ['id,name,country,region,type,throughput,capacity_teu,importance,risk,chokepoint,lat,lng'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const p of ports) {
    lines.push([p.id, p.name, p.country, p.region, p.type, p.throughput, p.capacity_teu, p.importance, p.risk, p.chokepoint, p.lat, p.lng].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(ports, chokepoints) {
  const markers = ports
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map(p => ({
      id: p.id, lat: p.lat, lng: p.lng,
      color: p.importanceColor, icon: p.typeIcon,
      radius: p.importance === 'critical' ? 12 : (p.importance === 'high' ? 9 : 6),
      properties: {
        name: p.name, country: p.country, type: p.type,
        throughput: p.throughput, importance: p.importance, risk: p.risk,
        chokepoint: p.chokepointName,
      },
    }));
  const chokepointMarkers = chokepoints.map(c => ({
    id: `chk-${c.id}`, lat: c.lat, lng: c.lng,
    color: '#dc2626', icon: '⚠️', radius: 15,
    properties: { name: c.name, traffic_pct: c.traffic_pct, severity: c.severity },
  }));
  return {
    markers,
    chokepoints: chokepointMarkers,
    legend: {
      importance: Object.entries(IMPORTANCE_META).map(([k, v]) => ({ key: k, ...v })),
      risk: Object.entries(RISK_META).map(([k, v]) => ({ key: k, ...v })),
    },
    filterable: ['country', 'region', 'type', 'importance', 'risk', 'chokepoint', 'min_capacity', 'bbox', 'sort'],
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/strategic-ports/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'strategic-ports-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ---- Не-basket эндпоинты ----

    if (sub === '/builtin') {
      const rows = BUILTIN_PORTS.map(normalizePort);
      const chokepoints = computeChokepoints(rows);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        chokepoints,
        meta: { source: 'builtin', count: rows.length, generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/config') {
      return sendJSON(res, 200, {
        importance: Object.entries(IMPORTANCE_META).map(([k, v]) => ({ key: k, ...v })),
        risk: Object.entries(RISK_META).map(([k, v]) => ({ key: k, ...v })),
        types: Object.entries(TYPE_META).map(([k, v]) => ({ key: k, ...v })),
        chokepoints: CHOKEPOINTS,
        filter_presets: FILTER_PRESETS,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

    // ---- Basket-зависимые ----

    let doc;
    try { doc = await loadBasket(); }
    catch (e) {
      if (e.statusCode === 503 && (sub === '/health' || sub === '/status')) {
        return sendJSON(res, 200, {
          status: 'degraded', basket_available: false, hint: e.hint,
          generated_at: new Date().toISOString(),
        }, extra);
      }
      throw e;
    }

    const { ports: rawArr, meta: srcMeta } = extractPorts(doc.data);
    const source = doc.source;
    const all = rawArr.map(normalizePort);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online', basket_available: true, ports: all.length,
        source, cache_size: _cache.size, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/count') {
      const stats = computeStats(all);
      return sendJSON(res, 200, {
        total: stats.count,
        by_importance: stats.by_importance,
        by_risk: stats.by_risk,
        with_chokepoint: stats.with_chokepoint,
      }, extra);
    }
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online', ports: all.length, source,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/ports') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { ports: rows, count: rows.length, total: all.length }, extra);
    }
    if (sub.startsWith('/ports/')) {
      const id = decodeURIComponent(sub.slice('/ports/'.length));
      const port = all.find(p => p.id === id);
      if (!port) return sendJSON(res, 404, { error: 'port_not_found', id }, extra);
      return sendJSON(res, 200, { port }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.throughput ?? 0) - (a.throughput ?? 0)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.throughput ?? 1e9) - (b.throughput ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/by-country') {
      const byCountry = computeByCountry(all);
      return sendJSON(res, 200, { countries: byCountry, total: byCountry.length }, extra);
    }
    if (sub === '/by-region') {
      const byRegion = computeByRegion(all);
      return sendJSON(res, 200, { regions: byRegion, total: byRegion.length }, extra);
    }
    if (sub === '/by-type') {
      const byType = {};
      for (const p of all) {
        if (!byType[p.type]) byType[p.type] = { name: p.type, label: p.typeLabel, color: p.typeColor, icon: p.typeIcon, count: 0, ports: [] };
        byType[p.type].count++;
        byType[p.type].ports.push(p.id);
      }
      return sendJSON(res, 200, { types: Object.values(byType), total: Object.keys(byType).length }, extra);
    }
    if (sub === '/by-importance') {
      const byImportance = {};
      for (const p of all) {
        if (!byImportance[p.importance]) byImportance[p.importance] = { name: p.importance, label: p.importanceLabel, color: p.importanceColor, severity: p.importanceSeverity, count: 0 };
        byImportance[p.importance].count++;
      }
      return sendJSON(res, 200, { importance: Object.values(byImportance), total: Object.keys(byImportance).length }, extra);
    }
    if (sub === '/by-risk') {
      const byRisk = {};
      for (const p of all) {
        if (!byRisk[p.risk]) byRisk[p.risk] = { name: p.risk, label: p.riskLabel, color: p.riskColor, severity: p.riskSeverity, count: 0 };
        byRisk[p.risk].count++;
      }
      return sendJSON(res, 200, { risk: Object.values(byRisk), total: Object.keys(byRisk).length }, extra);
    }
    if (sub === '/strategic') {
      const rows = all.filter(p => p.importance === 'critical' || p.importance === 'high');
      return sendJSON(res, 200, { strategic: rows, count: rows.length }, extra);
    }
    if (sub === '/chokepoints') {
      const chokepoints = computeChokepoints(all);
      return sendJSON(res, 200, { chokepoints, count: chokepoints.length }, extra);
    }
    if (sub === '/hotspots') {
      const rows = computeRiskHotspots(all);
      return sendJSON(res, 200, { hotspots: rows, count: rows.length }, extra);
    }
    if (sub === '/risk') {
      const rows = all.filter(p => p.risk === 'severe' || p.risk === 'high');
      return sendJSON(res, 200, { high_risk: rows, count: rows.length }, extra);
    }
    if (sub === '/capacity') {
      const distribution = computeCapacityDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/throughput') {
      const items = all.filter(p => p.throughput != null)
        .sort((a, b) => b.throughput - a.throughput)
        .map(p => ({ id: p.id, name: p.name, throughput: p.throughput }));
      return sendJSON(res, 200, { throughput: items, count: items.length }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(p => (p.name + ' ' + (p.country || '') + ' ' + (p.region || '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/bbox') {
      const w = Number(query.w), s = Number(query.s), e = Number(query.e), n = Number(query.n);
      if (![w, s, e, n].every(Number.isFinite)) return sendJSON(res, 400, { error: 'field_required: w,s,e,n' }, extra);
      const rows = all.filter(p => inBbox(p, w, s, e, n));
      return sendJSON(res, 200, { bbox: [w, s, e, n], ports: rows, count: rows.length }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(p => p.id === id)).filter(Boolean);
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
        top_throughput: all.slice().sort((a, b) => (b.throughput ?? 0) - (a.throughput ?? 0)).slice(0, 10).map(p => ({ name: p.name, throughput: p.throughput })),
        top_capacity: all.slice().sort((a, b) => (b.capacity_teu ?? 0) - (a.capacity_teu ?? 0)).slice(0, 10).map(p => ({ name: p.name, capacity_teu: p.capacity_teu })),
        by_risk: computeStats(all).by_risk,
        by_importance: computeStats(all).by_importance,
      };
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/anomalies') {
      const rows = all.filter(p => p.riskSeverity >= 3 || p.importanceSeverity >= 4);
      return sendJSON(res, 200, { anomalies: rows, count: rows.length, note: 'Порты с высоким риском или критической важностью' }, extra);
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
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    const chokepoints = computeChokepoints(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_ports: all.length, returned_ports: rows.length,
        upstream_source: source, upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      chokepoints,
      hotspots: computeRiskHotspots(rows).slice(0, 5),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e2) {}
  }
}
