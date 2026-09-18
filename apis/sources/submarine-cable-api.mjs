/**
 * apis/sources/submarine-cable-api.mjs — API-МОДУЛЬ: ПОДВОДНЫЕ КАБЕЛИ
 *
 * КОНТРАКТ CRUCIX v2 (Layer, read-only).
 * ИСТОЧНИК: data/basket/submarine-cable.json — массив объектов:
 *   { label, value, country, lat, lng, from?, to?, capacity?, status?, length_km?, depth_m?, owner?, rfs? }
 * Сборщик: scripts/collectors/collect-undersea-cables.mjs.
 *
 * Подводные кабели связи — критическая интернет-инфраструктура.
 * Уязвимы к диверсиям, якорным повреждениям, геомагнитным бурям.
 * ~99% межконтинентального интернет-трафика идёт по этим кабелям.
 *
 * АНАЛИТИКА:
 *   - Топология: from/to endpoints, landing stations
 *   - Уязвимость: SPOF (single point of failure), chokepoints
 *   - Резервирование: redundancy groups
 *   - Ёмкость: Tbps, fiber pairs, wavelength channels
 *   - Глубина: shelf/slope/abyssal/hadal
 *   - Регионы: Atlantic/Pacific/Indian/Mediterranean/Arctic/Baltic
 *   - Владельцы: консорциумы, операторы
 *   - RFS: ready for service
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET /                      — сводка (FC + series + stats + analysis)
 *   GET /status                — health-check
 *   GET /cables                — список кабелей (?region=, ?country=, ?status=, ?q=)
 *   GET /cables/:id            — конкретный кабель
 *   GET /featurecollection     — чистый GeoJSON
 *   GET /regions               — группировка по регионам
 *   GET /countries             — группировка по странам
 *   GET /status-distribution   — по статусам (active/degraded/outage/...)
 *   GET /capacity              — по ёмкости (Tbps)
 *   GET /length                — по длине (км)
 *   GET /depth                 — по глубине (метры)
 *   GET /stats                 — расширенная статистика
 *   GET /owners                — операторы и консорциумы
 *   GET /chokepoints           — кабели в стратегических проливах
 *   GET /vulnerable            — уязвимые кабели (SPOF)
 *   GET /redundancy            — группы резервирования
 *   GET /landing-stations      — точки высадки
 *   GET /timeline              — динамика по RFS
 *   GET /search?q=             — полнотекстовый поиск
 *   GET /latest                — последние добавленные
 *   GET /render                — рендер-конфиг
 *
 * ФОРМАТЫ: json (FC+series+stats+analysis), csv, series, stats, raw, geojson, markdown.
 * ФИЛЬТРЫ: ?region=, ?country=, ?status=, ?owner=, ?q=, ?min_capacity=, ?min_length=,
 *          ?max_depth=, ?limit=, ?top=, ?sort=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(PROJECT_ROOT, 'data', 'basket', 'submarine-cable.json');

export const route  = '/api/layers/submarine-cable';
export const method = 'GET';

export const meta = {
  category: 'infrastructure',
  icon: '🌊',
  color: '#00ccff',
  vizType: 'marker',
  source: 'basket/submarine-cable.json',
  collector: 'collect-undersea-cables.mjs',
  cache: 3600,
  description: 'Подводные кабели связи — критическая интернет-инфраструктура (топология, уязвимость, ёмкость, резервирование)',
  unit: 'cables',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const REGION_META = {
  atlantic:       { color: '#0ea5e9', label: 'Атлантика',        icon: '🌊' },
  pacific:        { color: '#0891b2', label: 'Тихий океан',       icon: '🌊' },
  indian:         { color: '#06b6d4', label: 'Индийский океан',   icon: '🌊' },
  mediterranean:  { color: '#22d3ee', label: 'Средиземное море',  icon: '🌊' },
  arctic:         { color: '#67e8f9', label: 'Арктика',           icon: '❄️' },
  baltic:         { color: '#06b6d4', label: 'Балтика',           icon: '🌊' },
  'red-sea':      { color: '#dc2626', label: 'Красное море',      icon: '🌊' },
  'black-sea':    { color: '#7c2d12', label: 'Чёрное море',       icon: '🌊' },
  'south-china':  { color: '#eab308', label: 'Южно-Китайское',    icon: '🌊' },
  global:         { color: '#64748b', label: 'Глобальный',        icon: '🌐' },
};

const STATUS_META = {
  active:       { color: '#22c55e', weight: 5, label: 'Активен' },
  degraded:     { color: '#eab308', weight: 4, label: 'Деградация' },
  outage:       { color: '#dc2626', weight: 5, label: 'Авария' },
  construction: { color: '#f97316', weight: 3, label: 'Строительство' },
  planned:      { color: '#8b5cf6', weight: 2, label: 'Планируется' },
  retired:      { color: '#64748b', weight: 1, label: 'Выведен' },
  unknown:      { color: '#94a3b8', weight: 0, label: 'Неизвестно' },
};

const CAPACITY_TIERS = [
  { key: 'mega',   min: 200, color: '#dc2626', label: 'Мега (>200 Tbps)' },
  { key: 'high',   min: 100, color: '#f97316', label: 'Высокая (100-200)' },
  { key: 'medium', min: 40,  color: '#eab308', label: 'Средняя (40-100)' },
  { key: 'low',    min: 10,  color: '#84cc16', label: 'Малая (10-40)' },
  { key: 'tiny',   min: 0,   color: '#22c55e', label: 'Очень малая (<10)' },
];

const LENGTH_TIERS = [
  { key: 'transoceanic', min: 10000, color: '#dc2626', label: 'Трансокеанский (>10000 км)' },
  { key: 'long',         min: 5000,  color: '#f97316', label: 'Длинный (5000-10000)' },
  { key: 'medium',       min: 2000,  color: '#eab308', label: 'Средний (2000-5000)' },
  { key: 'short',        min: 500,   color: '#84cc16', label: 'Короткий (500-2000)' },
  { key: 'very-short',   min: 0,     color: '#22c55e', label: 'Очень короткий (<500)' },
];

const DEPTH_TIERS = [
  { key: 'hadal',   min: 6000, color: '#7c3aed', label: 'Хадальная (>6000 м)' },
  { key: 'abyssal', min: 4000, color: '#0891b2', label: 'Абиссальная (4000-6000)' },
  { key: 'slope',   min: 200,  color: '#0ea5e9', label: 'Склон (200-4000)' },
  { key: 'shelf',   min: 0,    color: '#22c55e', label: 'Шельф (<200)' },
];

/**
 * Стратегические узкие места (chokepoints). Кабели, проходящие через bbox,
 * считаются уязвимыми в этих зонах.
 */
const CHOKEPOINTS = [
  { id: 'suez',        name: 'Суэцкий канал',           lat: 30.0, lng: 32.5, bbox: [29, 31, 32, 33] },
  { id: 'bab-el-mandeb', name: 'Баб-эль-Мандеб',        lat: 12.6, lng: 43.4, bbox: [12, 13.5, 42.5, 44] },
  { id: 'hormuz',      name: 'Ормузский пролив',        lat: 26.5, lng: 56.0, bbox: [26, 27, 55, 57] },
  { id: 'malacca',     name: 'Малаккский пролив',       lat: 1.5,  lng: 102.5, bbox: [1, 2, 101, 104] },
  { id: 'gibraltar',   name: 'Гибралтарский пролив',    lat: 36.0, lng: -5.0, bbox: [35.5, 36.5, -6, -4] },
  { id: 'bosphorus',   name: 'Босфор',                  lat: 41.1, lng: 29.0, bbox: [40.5, 41.5, 28.5, 29.5] },
  { id: 'taiwan',      name: 'Тайваньский пролив',      lat: 24.5, lng: 119.5, bbox: [22, 26, 117, 122] },
  { id: 'south-china', name: 'Южно-Китайское море',     lat: 12.0, lng: 115.0, bbox: [5, 20, 105, 120] },
  { id: 'panama',      name: 'Панамский канал',         lat: 9.1,  lng: -79.7, bbox: [8.5, 9.5, -80.5, -79] },
  { id: 'luzon',       name: 'Лусонский пролив',        lat: 20.5, lng: 121.0, bbox: [19, 22, 120, 122] },
];

/**
 * Крупные landing stations (точки высадки) — известные хабы, через которые
 * идёт большинство кабелей.
 */
const LANDING_STATIONS = [
  { id: 'fortaleza',  name: 'Fortaleza',        country: 'Brazil',       lat: -3.73,  lng: -38.52 },
  { id: 'miami',      name: 'Miami',            country: 'USA',          lat: 25.77,  lng: -80.19 },
  { id: 'new-york',   name: 'New York',         country: 'USA',          lat: 40.71,  lng: -74.00 },
  { id: 'mumbai',     name: 'Mumbai',           country: 'India',        lat: 19.07,  lng: 72.87 },
  { id: 'chennai',    name: 'Chennai',          country: 'India',        lat: 13.08,  lng: 80.27 },
  { id: 'singapore',  name: 'Singapore',        country: 'Singapore',    lat: 1.35,   lng: 103.82 },
  { id: 'hong-kong',  name: 'Hong Kong',        country: 'China',        lat: 22.32,  lng: 114.17 },
  { id: 'tokyo',      name: 'Tokyo',            country: 'Japan',        lat: 35.68,  lng: 139.69 },
  { id: 'sydney',     name: 'Sydney',           country: 'Australia',    lat: -33.87, lng: 151.21 },
  { id: 'perth',      name: 'Perth',            country: 'Australia',    lat: -31.95, lng: 115.86 },
  { id: 'dubai',      name: 'Dubai',            country: 'UAE',          lat: 25.20,  lng: 55.27 },
  { id: 'fujairah',   name: 'Fujairah',         country: 'UAE',          lat: 25.12,  lng: 56.33 },
  { id: 'cairo',      name: 'Alexandria',       country: 'Egypt',        lat: 31.20,  lng: 29.92 },
  { id: 'marseille',  name: 'Marseille',        country: 'France',       lat: 43.30,  lng: 5.37 },
  { id: 'lisbon',     name: 'Lisbon',           country: 'Portugal',     lat: 38.72,  lng: -9.14 },
  { id: 'bude',       name: 'Bude',             country: 'UK',           lat: 50.83,  lng: -4.54 },
  { id: 'helsinki',   name: 'Helsinki',         country: 'Finland',      lat: 60.17,  lng: 24.94 },
  { id: 'stockholm',  name: 'Stockholm',        country: 'Sweden',       lat: 59.33,  lng: 18.07 },
  { id: 'svalbard',   name: 'Svalbard',         country: 'Norway',       lat: 78.22,  lng: 15.65 },
  { id: 'cape-town',  name: 'Cape Town',        country: 'South Africa', lat: -33.92, lng: 18.42 },
  { id: 'lagos',      name: 'Lagos',            country: 'Nigeria',      lat: 6.52,   lng: 3.38 },
  { id: 'mombasa',    name: 'Mombasa',          country: 'Kenya',        lat: -4.05,  lng: 39.66 },
  { id: 'djibouti',   name: 'Djibouti',         country: 'Djibouti',     lat: 11.59,  lng: 43.15 },
];

// ============================================================
//  УТИЛИТЫ
// ============================================================

function shortHash(s) {
  return createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
}

function tierOf(value, tiers) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  for (const t of tiers) if (n >= t.min) return t;
  return tiers[tiers.length - 1];
}

function detectRegion(lat, lng, country) {
  // Приблизительная классификация по координатам
  if (lat > 66) return 'arctic';
  if (lat > 50 && lng > 5 && lng < 30) return 'baltic';
  if (lat > 30 && lat < 46 && lng > -6 && lng < 36) return 'mediterranean';
  if (lat > 12 && lat < 30 && lng > 32 && lng < 45) return 'red-sea';
  if (lat > 40 && lat < 47 && lng > 27 && lng < 42) return 'black-sea';
  if (lat > 0 && lat < 25 && lng > 105 && lng < 122) return 'south-china';
  if (lng > -80 && lng < 20 && lat > -60 && lat < 70) return 'atlantic';
  if (lng > 100 || lng < -100) return 'pacific';
  if (lng > 20 && lng < 100 && lat < 30) return 'indian';
  return 'global';
}

function inBbox(lat, lng, bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  const [s, n, w, e] = bbox;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return '0';
  if (n < 1024) return `${n}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadCables() {
  const result = await loadWithFallback({
    basketFile: BASKET_FILE,
    fallbackData: [],
    hint: 'запустите scripts/collectors/collect-undersea-cables.mjs',
  });

  let arr = result.data;
  if (!Array.isArray(arr)) {
    if (arr && arr.type === 'FeatureCollection' && Array.isArray(arr.features)) arr = arr.features;
    else if (arr && Array.isArray(arr.cables)) arr = arr.cables;
    else if (arr && Array.isArray(arr.data))   arr = arr.data;
    else arr = [];
  }
  return { arr, source: result.source, hint: result.hint, error: result.error };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeCable(r, i) {
  // GeoJSON Feature
  if (r && r.type === 'Feature') {
    const coords = r.geometry?.coordinates || [0, 0];
    const p = r.properties || {};
    return buildCable({
      id: p.id || r.id,
      label: p.label || p.name || `Cable ${i}`,
      value: p.value ?? p.length ?? 1,
      country: p.country,
      lat: Number(coords[1]),
      lng: Number(coords[0]),
      from: p.from, to: p.to,
      capacity: p.capacity,
      status: p.status,
      length_km: p.length_km,
      depth_m: p.depth_m,
      owner: p.owner || p.operator,
      rfs: p.rfs || p.rfs_date,
      fiber_pairs: p.fiber_pairs,
    }, i);
  }
  // Плоский объект
  return buildCable({
    id: r.id,
    label: r.label || r.name,
    value: r.value ?? r.length ?? 1,
    country: r.country,
    lat: r.lat ?? r.latitude,
    lng: r.lng ?? r.lon ?? r.longitude,
    from: r.from, to: r.to,
    capacity: r.capacity,
    status: r.status,
    length_km: r.length_km,
    depth_m: r.depth_m ?? r.depth,
    owner: r.owner || r.operator,
    rfs: r.rfs || r.rfs_date,
    fiber_pairs: r.fiber_pairs,
  }, i);
}

function buildCable(input, i) {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const capacity = input.capacity != null ? Number(input.capacity) : null;
  const length_km = input.length_km != null ? Number(input.length_km) : null;
  const depth_m = input.depth_m != null ? Number(input.depth_m) : null;
  const statusKey = String(input.status || 'active').toLowerCase();
  const statusMeta = STATUS_META[statusKey] || STATUS_META.unknown;
  const capacityTier = capacity != null ? tierOf(capacity, CAPACITY_TIERS) : null;
  const lengthTier = length_km != null ? tierOf(length_km, LENGTH_TIERS) : null;
  const depthTier = depth_m != null ? tierOf(depth_m, DEPTH_TIERS) : null;
  const region = detectRegion(lat, lng, input.country);

  const id = String(input.id || shortHash(input.label || i));

  return {
    id,
    label: input.label || `Кабель ${i}`,
    value: Number(input.value) || 1,
    country: input.country || 'Global',
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    from: input.from || null,
    to: input.to || null,
    capacity: capacity != null ? Number(capacity.toFixed(1)) : null,
    capacityTier: capacityTier ? capacityTier.key : null,
    capacityColor: capacityTier ? capacityTier.color : '#64748b',
    status: statusKey,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    statusWeight: statusMeta.weight,
    length_km: length_km != null ? Number(length_km.toFixed(1)) : null,
    lengthTier: lengthTier ? lengthTier.key : null,
    lengthColor: lengthTier ? lengthTier.color : '#64748b',
    depth_m: depth_m != null ? Number(depth_m) : null,
    depthTier: depthTier ? depthTier.key : null,
    depthColor: depthTier ? depthTier.color : '#64748b',
    owner: input.owner || 'Неизвестно',
    rfs: input.rfs ? String(input.rfs).slice(0, 10) : null,
    fiber_pairs: input.fiber_pairs != null ? Number(input.fiber_pairs) : null,
    region,
    regionLabel: REGION_META[region]?.label || region,
    regionColor: REGION_META[region]?.color || '#64748b',
    regionIcon: REGION_META[region]?.icon || '🌐',
    category: 'infrastructure',
    icon: meta.icon,
  };
}

// ============================================================
//  АНАЛИТИКА — CHOKEPOINTS
// ============================================================

function detectChokepoints(cables) {
  const results = [];
  for (const cp of CHOKEPOINTS) {
    const passing = cables.filter(c => c.lat != null && c.lng != null && inBbox(c.lat, c.lng, cp.bbox));
    results.push({
      ...cp,
      cables_count: passing.length,
      cables: passing.map(c => ({ id: c.id, label: c.label, status: c.status, capacity: c.capacity })),
    });
  }
  return results.filter(cp => cp.cables_count > 0);
}

// ============================================================
//  АНАЛИТИКА — VULNERABLE (SPOF)
// ============================================================

function detectVulnerable(cables) {
  // Кабели, которые единственные в своём регионе (нет резервного)
  const byRegion = {};
  for (const c of cables) {
    if (!byRegion[c.region]) byRegion[c.region] = [];
    byRegion[c.region].push(c);
  }

  const vulnerable = [];
  for (const [region, list] of Object.entries(byRegion)) {
    if (list.length === 1) {
      const c = list[0];
      vulnerable.push({
        id: c.id, label: c.label, region, country: c.country,
        reason: 'single_cable_in_region',
        severity: 'critical',
        capacity: c.capacity, status: c.status,
      });
    }
    // Кабели в статусе outage/degraded тоже уязвимы
    for (const c of list) {
      if (c.status === 'outage') {
        vulnerable.push({
          id: c.id, label: c.label, region, country: c.country,
          reason: 'outage_status',
          severity: 'critical',
          capacity: c.capacity, status: c.status,
        });
      } else if (c.status === 'degraded') {
        vulnerable.push({
          id: c.id, label: c.label, region, country: c.country,
          reason: 'degraded_status',
          severity: 'high',
          capacity: c.capacity, status: c.status,
        });
      }
    }
  }
  return vulnerable;
}

// ============================================================
//  АНАЛИТИКА — REDUNDANCY
// ============================================================

function detectRedundancyGroups(cables) {
  // Группы по региону с 2+ кабелями = есть резервирование
  const byRegion = {};
  for (const c of cables) {
    if (!byRegion[c.region]) byRegion[c.region] = [];
    byRegion[c.region].push(c);
  }
  const groups = [];
  for (const [region, list] of Object.entries(byRegion)) {
    if (list.length >= 2) {
      groups.push({
        region,
        regionLabel: REGION_META[region]?.label || region,
        cables_count: list.length,
        total_capacity: list.reduce((s, c) => s + (c.capacity || 0), 0),
        cables: list.map(c => ({ id: c.id, label: c.label, capacity: c.capacity, status: c.status })),
        redundancy_level: list.length >= 3 ? 'high' : 'medium',
      });
    }
  }
  return groups;
}

// ============================================================
//  АНАЛИТИКА — LANDING STATIONS
// ============================================================

function findNearbyLandingStations(cables, radiusKm = 500) {
  const results = [];
  for (const ls of LANDING_STATIONS) {
    const nearby = cables.filter(c => {
      if (c.lat == null || c.lng == null) return false;
      const d = haversine(c.lat, c.lng, ls.lat, ls.lng);
      return d <= radiusKm;
    });
    if (nearby.length > 0) {
      results.push({
        ...ls,
        cables_count: nearby.length,
        cables: nearby.map(c => ({ id: c.id, label: c.label })),
      });
    }
  }
  return results.sort((a, b) => b.cables_count - a.cables_count);
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(cables, query) {
  let r = cables.slice();
  if (query.region)   r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.country)  { const c = String(query.country).toLowerCase(); r = r.filter(x => String(x.country).toLowerCase().includes(c)); }
  if (query.status)   r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.owner)    { const o = String(query.owner).toLowerCase(); r = r.filter(x => String(x.owner).toLowerCase().includes(o)); }
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.label + ' ' + x.country + ' ' + (x.from || '') + ' ' + (x.to || '') + ' ' + x.owner).toLowerCase().includes(s));
  }
  if (query.min_capacity != null) { const n = Number(query.min_capacity); if (Number.isFinite(n)) r = r.filter(x => x.capacity != null && x.capacity >= n); }
  if (query.min_length != null)   { const n = Number(query.min_length);   if (Number.isFinite(n)) r = r.filter(x => x.length_km != null && x.length_km >= n); }
  if (query.max_depth != null)    { const n = Number(query.max_depth);    if (Number.isFinite(n)) r = r.filter(x => x.depth_m != null && x.depth_m <= n); }

  const sortKey = query.sort;
  if (sortKey === 'capacity-desc') r.sort((a, b) => (b.capacity ?? -1) - (a.capacity ?? -1));
  else if (sortKey === 'capacity-asc') r.sort((a, b) => (a.capacity ?? Infinity) - (b.capacity ?? Infinity));
  else if (sortKey === 'length-desc') r.sort((a, b) => (b.length_km ?? -1) - (a.length_km ?? -1));
  else if (sortKey === 'length-asc')  r.sort((a, b) => (a.length_km ?? Infinity) - (b.length_km ?? Infinity));
  else if (sortKey === 'depth-desc')  r.sort((a, b) => (b.depth_m ?? -1) - (a.depth_m ?? -1));
  else if (sortKey === 'label')       r.sort((a, b) => a.label.localeCompare(b.label));
  else if (sortKey === 'status')      r.sort((a, b) => b.statusWeight - a.statusWeight);

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(cables) {
  const byRegion = {};
  const byStatus = {};
  const byCountry = {};
  const byOwner = {};
  const byCapacityTier = {};
  const byLengthTier = {};
  const byDepthTier = {};
  const capacities = [];
  const lengths = [];
  const depths = [];

  for (const c of cables) {
    byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byCountry[c.country] = (byCountry[c.country] || 0) + 1;
    if (c.owner) byOwner[c.owner] = (byOwner[c.owner] || 0) + 1;
    if (c.capacityTier) byCapacityTier[c.capacityTier] = (byCapacityTier[c.capacityTier] || 0) + 1;
    if (c.lengthTier) byLengthTier[c.lengthTier] = (byLengthTier[c.lengthTier] || 0) + 1;
    if (c.depthTier) byDepthTier[c.depthTier] = (byDepthTier[c.depthTier] || 0) + 1;
    if (c.capacity != null) capacities.push(c.capacity);
    if (c.length_km != null) lengths.push(c.length_km);
    if (c.depth_m != null) depths.push(c.depth_m);
  }

  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const mean = arr => arr.length ? sum(arr) / arr.length : null;
  const median = arr => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s.length % 2 === 0 ? (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : s[Math.floor(s.length / 2)];
  };

  return {
    total: cables.length,
    with_capacity: capacities.length,
    with_length: lengths.length,
    with_depth: depths.length,
    unique_regions: Object.keys(byRegion).length,
    unique_countries: Object.keys(byCountry).length,
    unique_owners: Object.keys(byOwner).length,
    capacity: capacities.length ? {
      total: Number(sum(capacities).toFixed(1)),
      mean: Number(mean(capacities).toFixed(1)),
      median: Number(median(capacities).toFixed(1)),
      min: Math.min(...capacities),
      max: Math.max(...capacities),
    } : null,
    length_km: lengths.length ? {
      total: Math.round(sum(lengths)),
      mean: Math.round(mean(lengths)),
      median: Math.round(median(lengths)),
      min: Math.round(Math.min(...lengths)),
      max: Math.round(Math.max(...lengths)),
    } : null,
    depth_m: depths.length ? {
      mean: Math.round(mean(depths)),
      max: Math.round(Math.max(...depths)),
      min: Math.round(Math.min(...depths)),
    } : null,
    by_region: byRegion,
    by_status: byStatus,
    by_capacity_tier: byCapacityTier,
    by_length_tier: byLengthTier,
    by_depth_tier: byDepthTier,
    top_countries: top(byCountry, 15),
    top_owners: top(byOwner, 15),
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(cables) {
  const features = cables
    .filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id, label: c.label, country: c.country,
        region: c.region, regionLabel: c.regionLabel,
        status: c.status, statusLabel: c.statusLabel, statusColor: c.statusColor,
        capacity: c.capacity, capacityTier: c.capacityTier, capacityColor: c.capacityColor,
        length_km: c.length_km, lengthTier: c.lengthTier,
        depth_m: c.depth_m, depthTier: c.depthTier,
        owner: c.owner, rfs: c.rfs, fiber_pairs: c.fiber_pairs,
        from: c.from, to: c.to,
        category: c.category, icon: c.icon,
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
    legend: {
      statuses: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
      regions: Object.entries(REGION_META).map(([key, def]) => ({ key, ...def })),
      capacity_tiers: CAPACITY_TIERS,
      length_tiers: LENGTH_TIERS,
      depth_tiers: DEPTH_TIERS,
    },
    meta: { total: cables.length, mapped: features.length, unmapped: cables.length - features.length },
  };
}

function toSeries(cables) {
  return cables.map(c => ({
    id: c.id, label: c.label, country: c.country, region: c.region,
    status: c.status, capacity: c.capacity, length_km: c.length_km,
    depth_m: c.depth_m, owner: c.owner, lat: c.lat, lng: c.lng,
  }));
}

function toCSV(cables) {
  const lines = ['id,label,country,region,status,capacity_tbps,length_km,depth_m,owner,from,to,lat,lng'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const c of cables) {
    lines.push([c.id, c.label, c.country, c.region, c.status, c.capacity, c.length_km, c.depth_m, c.owner, c.from, c.to, c.lat, c.lng].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toMarkdown(cables, title = 'Подводные кабели Crucix') {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`_Сгенерировано: ${new Date().toISOString()}_`);
  lines.push('');
  lines.push(`**Всего кабелей:** ${cables.length}`);
  lines.push('');
  lines.push('| ID | Название | Страна | Регион | Статус | Ёмкость | Длина |');
  lines.push('|----|----------|--------|--------|--------|---------|-------|');
  for (const c of cables.slice(0, 200)) {
    lines.push(`| ${c.id} | ${c.label} | ${c.country} | ${c.regionLabel} | ${c.statusLabel} | ${c.capacity ?? '—'} | ${c.length_km ?? '—'} |`);
  }
  return lines.join('\n') + '\n';
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
    'X-Module': 'submarine-cable-api',
    'X-Module-Version': '2.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/submarine-cable/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Загрузка с локальным try/catch
    let loaded;
    try { loaded = await loadCables(); }
    catch (e) {
      return sendJSON(res, e.statusCode || 500, { success: false, error: 'load_error', message: e.message, hint: e.hint || null }, extra);
    }

    const { arr: raw, source: dataSource, hint } = loaded;
    const all = raw.map(normalizeCable);

    // ============================================================
    //  /status
    // ============================================================
    if (sub === '/status') {
      return sendJSON(res, 200, {
        success: true,
        module: 'submarine-cable',
        status: 'online',
        cables: all.length,
        with_capacity: all.filter(c => c.capacity != null).length,
        with_length: all.filter(c => c.length_km != null).length,
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
        timestamp: new Date().toISOString(),
      }, extra);
    }

    // ============================================================
    //  /cables — список
    // ============================================================
    if (sub === '/cables') {
      const rows = applyFilters(all, query);
      if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
      if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), count: rows.length }, extra);
      if (format === 'raw') return sendJSON(res, 200, { data: rows, total: all.length }, extra);
      if (format === 'geojson') return sendJSON(res, 200, toFeatureCollection(rows), extra);
      if (format === 'markdown') return sendText(res, 200, toMarkdown(rows), 'text/markdown; charset=utf-8');
      return sendJSON(res, 200, { success: true, cables: rows, count: rows.length, total: all.length }, extra);
    }

    if (sub.startsWith('/cables/')) {
      const id = decodeURIComponent(sub.slice('/cables/'.length));
      const cable = all.find(c => c.id === id);
      if (!cable) return sendJSON(res, 404, { success: false, error: 'cable_not_found', id }, extra);
      // Найти чокепойнты, в которых кабель проходит
      const inChokepoints = CHOKEPOINTS.filter(cp => cable.lat != null && cable.lng != null && inBbox(cable.lat, cable.lng, cp.bbox));
      const nearbyLS = LANDING_STATIONS.filter(ls => cable.lat != null && cable.lng != null && haversine(cable.lat, cable.lng, ls.lat, ls.lng) <= 500);
      return sendJSON(res, 200, {
        success: true,
        cable,
        chokepoints: inChokepoints.map(cp => ({ id: cp.id, name: cp.name })),
        nearby_landing_stations: nearbyLS.map(ls => ({ id: ls.id, name: ls.name, country: ls.country })),
      }, extra);
    }

    // ============================================================
    //  /featurecollection
    // ============================================================
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    // ============================================================
    //  /regions
    // ============================================================
    if (sub === '/regions') {
      const byRegion = {};
      for (const c of all) {
        if (!byRegion[c.region]) byRegion[c.region] = { region: c.region, label: c.regionLabel, color: c.regionColor, icon: c.regionIcon, count: 0, cables: [], capacity_total: 0 };
        byRegion[c.region].count++;
        byRegion[c.region].capacity_total += c.capacity || 0;
        byRegion[c.region].cables.push({ id: c.id, label: c.label, status: c.status });
      }
      const regions = Object.values(byRegion).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, regions, total: regions.length }, extra);
    }

    // ============================================================
    //  /countries
    // ============================================================
    if (sub === '/countries') {
      const byCountry = {};
      for (const c of all) {
        if (!byCountry[c.country]) byCountry[c.country] = { country: c.country, count: 0, cables: [], capacity_total: 0 };
        byCountry[c.country].count++;
        byCountry[c.country].capacity_total += c.capacity || 0;
        byCountry[c.country].cables.push({ id: c.id, label: c.label });
      }
      const countries = Object.values(byCountry).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, countries, total: countries.length }, extra);
    }

    // ============================================================
    //  /status-distribution
    // ============================================================
    if (sub === '/status-distribution') {
      const byStatus = {};
      for (const c of all) {
        if (!byStatus[c.status]) byStatus[c.status] = { status: c.status, label: c.statusLabel, color: c.statusColor, weight: c.statusWeight, count: 0 };
        byStatus[c.status].count++;
      }
      const distribution = Object.values(byStatus).sort((a, b) => b.weight - a.weight);
      return sendJSON(res, 200, { success: true, distribution, total: distribution.length }, extra);
    }

    // ============================================================
    //  /capacity — по ёмкости
    // ============================================================
    if (sub === '/capacity') {
      const withCap = all.filter(c => c.capacity != null);
      const top = withCap.slice().sort((a, b) => b.capacity - a.capacity).slice(0, 20);
      const byTier = {};
      for (const c of withCap) {
        byTier[c.capacityTier] = (byTier[c.capacityTier] || 0) + 1;
      }
      return sendJSON(res, 200, {
        success: true,
        with_capacity: withCap.length,
        by_tier: byTier,
        tiers_meta: CAPACITY_TIERS,
        top_cables: top.map(c => ({ id: c.id, label: c.label, capacity: c.capacity, region: c.region })),
      }, extra);
    }

    // ============================================================
    //  /length — по длине
    // ============================================================
    if (sub === '/length') {
      const withLen = all.filter(c => c.length_km != null);
      const top = withLen.slice().sort((a, b) => b.length_km - a.length_km).slice(0, 20);
      const byTier = {};
      for (const c of withLen) byTier[c.lengthTier] = (byTier[c.lengthTier] || 0) + 1;
      const total = withLen.reduce((s, c) => s + c.length_km, 0);
      return sendJSON(res, 200, {
        success: true,
        with_length: withLen.length,
        total_km: Math.round(total),
        by_tier: byTier,
        tiers_meta: LENGTH_TIERS,
        top_cables: top.map(c => ({ id: c.id, label: c.label, length_km: c.length_km })),
      }, extra);
    }

    // ============================================================
    //  /depth — по глубине
    // ============================================================
    if (sub === '/depth') {
      const withDepth = all.filter(c => c.depth_m != null);
      const top = withDepth.slice().sort((a, b) => b.depth_m - a.depth_m).slice(0, 20);
      const byTier = {};
      for (const c of withDepth) byTier[c.depthTier] = (byTier[c.depthTier] || 0) + 1;
      return sendJSON(res, 200, {
        success: true,
        with_depth: withDepth.length,
        by_tier: byTier,
        tiers_meta: DEPTH_TIERS,
        max_depth: withDepth.length ? Math.max(...withDepth.map(c => c.depth_m)) : null,
        deepest_cables: top.map(c => ({ id: c.id, label: c.label, depth_m: c.depth_m })),
      }, extra);
    }

    // ============================================================
    //  /stats
    // ============================================================
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, {
        success: true,
        stats: computeStats(all),
        analysis: {
          chokepoints_count: detectChokepoints(all).length,
          vulnerable_count: detectVulnerable(all).length,
          redundancy_groups_count: detectRedundancyGroups(all).length,
          landing_stations_active: findNearbyLandingStations(all, 500).length,
        },
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
      }, extra);
    }

    // ============================================================
    //  /owners
    // ============================================================
    if (sub === '/owners') {
      const byOwner = {};
      for (const c of all) {
        if (!byOwner[c.owner]) byOwner[c.owner] = { owner: c.owner, count: 0, total_capacity: 0, cables: [] };
        byOwner[c.owner].count++;
        byOwner[c.owner].total_capacity += c.capacity || 0;
        byOwner[c.owner].cables.push({ id: c.id, label: c.label });
      }
      const owners = Object.values(byOwner).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, owners, total: owners.length }, extra);
    }

    // ============================================================
    //  /chokepoints
    // ============================================================
    if (sub === '/chokepoints') {
      const chokepoints = detectChokepoints(all);
      return sendJSON(res, 200, {
        success: true,
        chokepoints,
        total_active: chokepoints.length,
        total_defined: CHOKEPOINTS.length,
      }, extra);
    }

    // ============================================================
    //  /vulnerable — SPOF
    // ============================================================
    if (sub === '/vulnerable') {
      const vulnerable = detectVulnerable(all);
      return sendJSON(res, 200, {
        success: true,
        vulnerable,
        total: vulnerable.length,
        critical: vulnerable.filter(v => v.severity === 'critical').length,
        high: vulnerable.filter(v => v.severity === 'high').length,
      }, extra);
    }

    // ============================================================
    //  /redundancy
    // ============================================================
    if (sub === '/redundancy') {
      const groups = detectRedundancyGroups(all);
      return sendJSON(res, 200, {
        success: true,
        redundancy_groups: groups,
        total: groups.length,
        regions_with_redundancy: groups.length,
      }, extra);
    }

    // ============================================================
    //  /landing-stations
    // ============================================================
    if (sub === '/landing-stations') {
      const radius = Number(query.radius) || 500;
      const stations = findNearbyLandingStations(all, radius);
      return sendJSON(res, 200, {
        success: true,
        stations,
        total: stations.length,
        radius_km: radius,
        defined_total: LANDING_STATIONS.length,
      }, extra);
    }

    // ============================================================
    //  /timeline — по RFS
    // ============================================================
    if (sub === '/timeline') {
      const byYear = {};
      for (const c of all) {
        if (!c.rfs) continue;
        const year = c.rfs.slice(0, 4);
        if (!byYear[year]) byYear[year] = { year, count: 0, cables: [] };
        byYear[year].count++;
        byYear[year].cables.push({ id: c.id, label: c.label });
      }
      const timeline = Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year));
      return sendJSON(res, 200, { success: true, timeline, count: timeline.length }, extra);
    }

    // ============================================================
    //  /search
    // ============================================================
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase().trim();
      if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: q' }, extra);
      const results = all.filter(c =>
        (c.label + ' ' + c.country + ' ' + c.owner + ' ' + (c.from || '') + ' ' + (c.to || '')).toLowerCase().includes(q)
      );
      return sendJSON(res, 200, { success: true, query: q, count: results.length, results }, extra);
    }

    // ============================================================
    //  /latest
    // ============================================================
    if (sub === '/latest') {
      const n = parseInt(query.n, 10) || 20;
      const sorted = all.slice().sort((a, b) => String(b.rfs || '').localeCompare(String(a.rfs || '')));
      return sendJSON(res, 200, { latest: sorted.slice(0, n), count: Math.min(n, all.length) }, extra);
    }

    // ============================================================
    //  /render
    // ============================================================
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, {
        render: {
          type: 'map',
          markers: rows.filter(c => c.lat != null).map(c => ({
            id: c.id, lat: c.lat, lng: c.lng,
            color: c.statusColor, icon: meta.icon,
            popup: { label: c.label, country: c.country, status: c.statusLabel, capacity: c.capacity, length_km: c.length_km },
          })),
          chokepoints: detectChokepoints(rows).map(cp => ({
            id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, bbox: cp.bbox,
            cables_count: cp.cables_count,
          })),
          landing_stations: findNearbyLandingStations(rows, 500),
          legend: {
            statuses: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
            regions: Object.entries(REGION_META).map(([key, def]) => ({ key, ...def })),
          },
          stats: computeStats(rows),
        },
      }, extra);
    }

    // ============================================================
    //  Корень — сводка
    // ============================================================
    const rows = applyFilters(all, query);

    if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), count: rows.length }, extra);
    if (format === 'geojson') return sendJSON(res, 200, toFeatureCollection(rows), extra);
    if (format === 'markdown') return sendText(res, 200, toMarkdown(rows), 'text/markdown; charset=utf-8');
    if (format === 'raw') return sendJSON(res, 200, { data: rows, total: all.length, source: dataSource }, extra);

    const fc = toFeatureCollection(rows);
    const stats = computeStats(rows);
    const analysis = {
      chokepoints: detectChokepoints(rows),
      vulnerable: detectVulnerable(rows),
      redundancy_groups: detectRedundancyGroups(rows),
      landing_stations: findNearbyLandingStations(rows, 500).slice(0, 20),
    };

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_cables: all.length, returned_cables: rows.length,
        data_source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats,
      analysis,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
