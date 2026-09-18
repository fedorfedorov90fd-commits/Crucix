/**
 * apis/sources/cyber-apt-api.mjs — API-МОДУЛЬ: APT-ГРУППЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/cyber-apt.json — [{ id, name, aliases[], country, sponsors[], target_sectors[], target_regions[], mitre_id, first_seen, last_seen, active, severity, techniques[], malware[], description }] ИЛИ { groups:[...] } ИЛИ { data:[...] }.
 * Сборщик: scripts/collectors/collect-cyber-apt.mjs.
 *
 * Реестр APT-групп: атрибуция по стране-спонсору, цели (секторы, регионы),
 * техники MITRE ATT&CK, используемое ПО, уровень опасности, статус активности.
 * Геокоординаты — по стране-спонсору из встроенного справочника.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?sector=, ?region=, ?severity=, ?malware=, ?technique=, ?active=, ?q=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats              — агрегированная статистика
 *   GET /status             — health-check
 *   GET /active             — только активные группы
 *   GET /critical           — только critical + high
 *   GET /countries          — группировка по странам
 *   GET /sectors            — группировка по целевым секторам
 *   GET /regions            — группировка по целевым регионам
 *   GET /malware            — сводка по используемому ПО
 *   GET /techniques         — сводка по техникам MITRE
 *   GET /featurecollection  — чистый GeoJSON
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'cyber-apt.json');

export const route  = '/api/layers/cyber-apt';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🎯',
  color: '#dc2626',
  vizType: 'marker',
  source: 'basket/cyber-apt.json',
  collector: 'collect-cyber-apt.mjs',
  cache: 600,
  description: 'Реестр APT-групп: атрибуция, спонсоры, цели, техники MITRE ATT&CK',
  unit: 'groups',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const COUNTRY_COORDS = {
  'Russia': [61.5, 105], 'Россия': [61.5, 105], 'RUS': [61.5, 105],
  'China': [34.9, 105.2], 'Китай': [34.9, 105.2], 'CHN': [34.9, 105.2],
  'Iran': [32.4, 53.7], 'Иран': [32.4, 53.7], 'IRN': [32.4, 53.7],
  'North Korea': [40.3, 127.5], 'КНДР': [40.3, 127.5], 'DPRK': [40.3, 127.5],
  'USA': [39.7, -98.8], 'United States': [39.7, -98.8], 'США': [39.7, -98.8],
  'Israel': [31.0, 34.9], 'Израиль': [31.0, 34.9],
  'India': [20.8, 78.5], 'Индия': [20.8, 78.5],
  'Pakistan': [30.4, 69.3], 'Пакистан': [30.4, 69.3],
  'Vietnam': [14.1, 108.3], 'Вьетнам': [14.1, 108.3],
  'Turkey': [38.9, 35.2], 'Турция': [38.9, 35.2],
  'Lebanon': [33.9, 35.9], 'Ливан': [33.9, 35.9],
  'UAE': [23.4, 53.8], 'ОАЭ': [23.4, 53.8],
  'Syria': [34.8, 38.9], 'Сирия': [34.8, 38.9],
  'Belarus': [53.7, 27.9], 'Беларусь': [53.7, 27.9],
  'Ukraine': [48.4, 31.2], 'Украина': [48.4, 31.2],
  'Unknown': [0, 0], 'Неизвестно': [0, 0],
};

const SEVERITY_META = {
  critical: { color: '#dc2626', label: 'Критический', weight: 4 },
  high:     { color: '#f97316', label: 'Высокий',      weight: 3 },
  medium:   { color: '#eab308', label: 'Средний',      weight: 2 },
  low:      { color: '#22c55e', label: 'Низкий',       weight: 1 },
  unknown:  { color: '#64748b', label: 'Неизвестно',   weight: 0 },
};

function severityOf(s) {
  const k = String(s || '').toLowerCase();
  return SEVERITY_META[k] || SEVERITY_META.unknown;
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-cyber-apt.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.groups)) arr = parsed.groups;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format: ожидалось [...] или { groups: [...] }'); err.statusCode = 500; throw err; }
  return arr;
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeGroup(g, i) {
  const country = g.country || g.sponsor || g.attribution || 'Unknown';
  const coords = COUNTRY_COORDS[country] || COUNTRY_COORDS['Unknown'];
  const sev = severityOf(g.severity);
  return {
    id: String(g.id || g.mitre_id || `apt-${i}`),
    name: String(g.name || g.alias || `APT-${i}`),
    aliases: Array.isArray(g.aliases) ? g.aliases : (g.alias ? [g.alias] : []),
    country,
    sponsors: Array.isArray(g.sponsors) ? g.sponsors : (g.sponsor ? [g.sponsor] : []),
    target_sectors: Array.isArray(g.target_sectors) ? g.target_sectors : (g.sectors || []),
    target_regions: Array.isArray(g.target_regions) ? g.target_regions : (g.regions || []),
    mitre_id: g.mitre_id || g.mitreId || null,
    first_seen: String(g.first_seen || g.firstSeen || '').slice(0, 10) || null,
    last_seen:  String(g.last_seen  || g.lastSeen  || '').slice(0, 10) || null,
    active: !!(g.active ?? true),
    severity: String(g.severity || 'unknown').toLowerCase(),
    severityLabel: sev.label,
    color: sev.color,
    weight: sev.weight,
    techniques: Array.isArray(g.techniques) ? g.techniques : [],
    malware: Array.isArray(g.malware) ? g.malware : [],
    description: g.description || null,
    lat: coords[0],
    lng: coords[1],
    category: 'cyber',
    icon: '🎯',
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country)  r = r.filter(x => String(x.country).toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.sector)   r = r.filter(x => x.target_sectors.some(s => String(s).toLowerCase().includes(String(query.sector).toLowerCase())));
  if (query.region)   r = r.filter(x => x.target_regions.some(s => String(s).toLowerCase().includes(String(query.region).toLowerCase())));
  if (query.malware)  r = r.filter(x => x.malware.some(m => String(m).toLowerCase().includes(String(query.malware).toLowerCase())));
  if (query.technique)r = r.filter(x => x.techniques.some(t => String(t).toLowerCase().includes(String(query.technique).toLowerCase())));
  if (query.active === '1' || query.active === 'true')  r = r.filter(x => x.active);
  if (query.active === '0' || query.active === 'false') r = r.filter(x => !x.active);
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + x.aliases.join(' ') + ' ' + (x.description || '')).toLowerCase().includes(s));
  }
  // Сортировка
  const sortKey = query.sort || null;
  if (sortKey === 'severity') r.sort((a, b) => b.weight - a.weight);
  else if (sortKey === 'name')     r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'country')  r.sort((a, b) => a.country.localeCompare(b.country));
  else if (sortKey === 'activity') r.sort((a, b) => (b.last_seen || '').localeCompare(a.last_seen || ''));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const byCountry = {};
  const bySector = {};
  const byRegion = {};
  const byMalware = {};
  const byTechnique = {};
  let activeCount = 0;

  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.active) activeCount++;
    for (const s of r.target_sectors) bySector[s] = (bySector[s] || 0) + 1;
    for (const reg of r.target_regions) byRegion[reg] = (byRegion[reg] || 0) + 1;
    for (const m of r.malware) byMalware[m] = (byMalware[m] || 0) + 1;
    for (const t of r.techniques) byTechnique[t] = (byTechnique[t] || 0) + 1;
  }

  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    count: rows.length,
    active: activeCount,
    inactive: rows.length - activeCount,
    by_severity: bySeverity,
    top_countries: top(byCountry, 10),
    top_sectors: top(bySector, 10),
    top_regions: top(byRegion, 10),
    top_malware: top(byMalware, 15),
    top_techniques: top(byTechnique, 15),
    unique_malware: Object.keys(byMalware).length,
    unique_techniques: Object.keys(byTechnique).length,
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
      id: r.id, name: r.name, country: r.country,
      aliases: r.aliases, mitre_id: r.mitre_id,
      severity: r.severity, severityLabel: r.severityLabel,
      active: r.active, color: r.color,
      target_sectors: r.target_sectors, target_regions: r.target_regions,
      techniques_count: r.techniques.length, malware_count: r.malware.length,
      first_seen: r.first_seen, last_seen: r.last_seen,
      category: r.category, icon: r.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(SEVERITY_META).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, name: r.name, country: r.country, severity: r.severity,
    active: r.active, techniques: r.techniques.length, malware: r.malware.length,
    first_seen: r.first_seen, last_seen: r.last_seen,
  }));
}

function toCSV(rows) {
  const lines = ['id,name,country,severity,active,mitre_id,sectors_count,techniques_count,malware_count,first_seen,last_seen,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) {
    lines.push([r.id, r.name, r.country, r.severity, r.active, r.mitre_id,
                r.target_sectors.length, r.techniques.length, r.malware.length,
                r.first_seen, r.last_seen, r.lat, r.lng].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

// ============================================================
//  СЛУЖЕБНЫЕ ПОДПУТИ
// ============================================================

function groupBy(rows, keyFn) {
  const groups = {};
  for (const r of rows) {
    const keys = keyFn(r);
    for (const k of keys) {
      if (!k) continue;
      if (!groups[k]) groups[k] = [];
      groups[k].push({ id: r.id, name: r.name, severity: r.severity, country: r.country });
    }
  }
  return groups;
}

function malwareSummary(rows) {
  const map = {};
  for (const r of rows) {
    for (const m of r.malware) {
      if (!map[m]) map[m] = { name: m, groups: [], count: 0 };
      map[m].groups.push(r.name);
      map[m].count++;
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

function techniqueSummary(rows) {
  const map = {};
  for (const r of rows) {
    for (const t of r.techniques) {
      const key = String(t);
      if (!map[key]) map[key] = { name: key, groups: [], count: 0 };
      map[key].groups.push(r.name);
      map[key].count++;
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/cyber-apt/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const rawArr = await loadData();
    const all = rawArr.map(normalizeGroup);
    const extra = {
      'X-Module': 'cyber-apt-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/active') {
      const active = all.filter(g => g.active);
      return sendJSON(res, 200, { groups: active, total: active.length }, extra);
    }
    if (sub === '/critical') {
      const crit = all.filter(g => g.severity === 'critical' || g.severity === 'high');
      return sendJSON(res, 200, { groups: crit, total: crit.length }, extra);
    }
    if (sub === '/countries') {
      return sendJSON(res, 200, { countries: groupBy(all, r => [r.country]) }, extra);
    }
    if (sub === '/sectors') {
      return sendJSON(res, 200, { sectors: groupBy(all, r => r.target_sectors) }, extra);
    }
    if (sub === '/regions') {
      return sendJSON(res, 200, { regions: groupBy(all, r => r.target_regions) }, extra);
    }
    if (sub === '/malware') {
      return sendJSON(res, 200, { malware: malwareSummary(all), total: malwareSummary(all).length }, extra);
    }
    if (sub === '/techniques') {
      return sendJSON(res, 200, { techniques: techniqueSummary(all), total: techniqueSummary(all).length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_groups: all.length, returned_groups: rows.length,
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
