/**
 * apis/sources/sanctions-directional-api.mjs — API-МОДУЛЬ: НАПРАВЛЕННЫЕ САНКЦИИ
 *
 * КОНТРАКТ CRUCIX v2.
 * Версия 1.0.0. Принят 23.09.2026.
 *
 * ИСТОЧНИК: data/basket/ofac-sdn.json — { lastUpdated, source, entries: [{ id, name, type, programs[], addresses[{country}], ... }] }.
 * Сборщик: scripts/collectors/collect-ofac-sdn.mjs.
 *
 * Роль: извлекает НАПРАВЛЕННЫЕ санкции США (issuer=OFAC) по странам и программам.
 * Различает direction (кто на кого), в отличие от простого countMentions.
 *
 * Форматы: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * Фильтры: ?country=, ?program=, ?min=, ?limit=, ?top=.
 *
 * Эндпоинты:
 *   GET /                — корень (json по умолчанию)
 *   GET /stats           — агрегированная статистика
 *   GET /by-country      — только по странам
 *   GET /by-program      — только по программам
 *   GET /status          — health-check
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'ofac-sdn.json');

export const route  = '/api/layers/sanctions-directional';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '⚖️',
  color: '#8b0000',
  vizType: 'choropleth',
  source: 'basket/ofac-sdn.json',
  collector: 'collect-ofac-sdn.mjs',
  cache: 3600,
  description: 'Направленные санкции США (OFAC) по странам и программам — issuer=США',
  unit: 'records',
};

const COUNTRY_COORDS = {
  'Russia': [61.5, 105], 'Iran': [32.0, 53.0], 'China': [35.0, 105.0],
  'Mexico': [23.6, -102.6], 'United Arab Emirates': [24.0, 54.0],
  'Colombia': [4.0, -72.0], 'Lebanon': [33.8, 35.8], 'Turkey': [39.0, 35.0],
  'Syria': [35.0, 38.0], 'Pakistan': [30.0, 70.0], 'Belarus': [53.7, 27.9],
  'Ukraine': [49.0, 32.0], 'Venezuela': [8.0, -66.0], 'Korea, North': [40.0, 127.0],
  'Iraq': [33.0, 44.0], 'United Kingdom': [54.0, -2.0], 'Burma': [21.0, 96.0],
  'Yemen': [15.5, 47.5], 'India': [22.0, 79.0], 'Germany': [51.0, 10.5],
  'Cuba': [22.0, -79.0], 'Libya': [27.0, 17.0], 'Somalia': [6.0, 48.0],
  'Sudan': [15.0, 30.0], 'South Sudan': [7.0, 30.0], 'Afghanistan': [34.0, 66.0],
  'Democratic Republic of the Congo': [-3.0, 23.0], 'Zimbabwe': [-19.0, 29.0],
  'Nicaragua': [12.9, -85.2], 'Haiti': [19.0, -72.3], 'Honduras': [15.0, -86.5],
  'Guatemala': [15.5, -90.3], 'Serbia': [44.0, 21.0], 'Bosnia and Herzegovina': [44.0, 18.0],
  'Montenegro': [42.7, 19.3], 'Moldova': [47.0, 29.0], 'Georgia': [42.0, 43.5],
  'Kazakhstan': [48.0, 68.0], 'Saudi Arabia': [24.0, 45.0], 'Qatar': [25.3, 51.2],
  'Kuwait': [29.3, 47.5], 'Bahrain': [26.0, 50.5], 'Oman': [21.0, 57.0],
  'Jordan': [31.0, 36.0], 'Egypt': [26.0, 30.0], 'Tunisia': [34.0, 9.0],
  'Morocco': [32.0, -5.0], 'Algeria': [28.0, 3.0], 'Nigeria': [10.0, 8.0],
  'Kenya': [1.0, 38.0], 'Ethiopia': [8.0, 38.0], 'Eritrea': [15.0, 39.0],
  'Djibouti': [11.5, 43.0], 'Mali': [17.0, -4.0], 'Niger': [16.0, 8.0],
  'Chad': [15.0, 19.0], 'Central African Republic': [7.0, 21.0],
  'Cote d Ivoire': [7.5, -5.5], 'Guinea': [11.0, -10.0], 'Liberia': [6.5, -9.5],
  'Sierra Leone': [8.5, -11.5], 'Burkina Faso': [13.0, -2.0], 'Benin': [9.3, 2.3],
  'Togo': [8.0, 1.2], 'Ghana': [8.0, -1.0], 'Senegal': [14.0, -14.0],
  'Gambia': [13.4, -15.3], 'Guinea-Bissau': [12.0, -15.0], 'Mauritania': [20.0, -12.0],
  'Cape Verde': [16.0, -24.0], 'Sao Tome and Principe': [1.0, 7.0],
  'Angola': [-12.5, 18.5], 'Namibia': [-22.0, 17.0], 'Botswana': [-22.0, 24.0],
  'Zambia': [-15.0, 30.0], 'Malawi': [-13.5, 34.0], 'Mozambique': [-18.5, 35.0],
  'Madagascar': [-20.0, 47.0], 'Mauritius': [-20.3, 57.6], 'Comoros': [-12.0, 44.0],
  'Seychelles': [-4.6, 55.5], 'Tanzania': [-6.0, 35.0], 'Uganda': [1.0, 32.0],
  'Rwanda': [-2.0, 30.0], 'Burundi': [-3.4, 29.9], 'South Africa': [-29.0, 24.0],
  'Lesotho': [-29.5, 28.5], 'Swaziland': [-26.5, 31.5], 'Gabon': [-1.0, 11.8],
  'Equatorial Guinea': [1.7, 10.3], 'Cameroon': [6.0, 12.0],
  'Republic of the Congo': [-1.0, 15.0], 'Congo': [-1.0, 15.0],
  'Cambodia': [13.0, 105.0], 'Laos': [18.0, 105.0], 'Vietnam': [16.0, 106.0],
  'Thailand': [15.0, 101.0], 'Malaysia': [2.5, 112.5], 'Singapore': [1.4, 103.8],
  'Indonesia': [-2.0, 118.0], 'Philippines': [13.0, 122.0], 'Brunei': [4.5, 114.7],
  'Japan': [36.0, 138.0], 'Korea, South': [36.5, 127.8], 'Taiwan': [23.7, 121.0],
  'Hong Kong': [22.3, 114.2], 'Macau': [22.2, 113.5], 'Mongolia': [46.0, 105.0],
  'Nepal': [28.0, 84.0], 'Bhutan': [27.5, 90.5], 'Bangladesh': [24.0, 90.0],
  'Sri Lanka': [7.0, 81.0], 'Maldives': [3.2, 73.2], 'Australia': [-25.0, 134.0],
  'New Zealand': [-41.0, 174.0], 'Papua New Guinea': [-6.0, 147.0],
  'Fiji': [-18.0, 178.0], 'Canada': [60.0, -95.0], 'Greenland': [72.0, -40.0],
  'Bermuda': [32.3, -64.8], 'Panama': [9.0, -80.0], 'Costa Rica': [10.0, -84.0],
  'Belize': [17.2, -88.5], 'El Salvador': [13.8, -88.9], 'Jamaica': [18.1, -77.3],
  'Bahamas': [24.3, -76.0], 'Dominican Republic': [19.0, -70.7],
  'Trinidad and Tobago': [11.0, -61.0], 'Barbados': [13.2, -59.5],
  'Guyana': [5.0, -59.0], 'Suriname': [4.0, -56.0], 'Uruguay': [-33.0, -56.0],
  'Paraguay': [-23.0, -58.0], 'Bolivia': [-17.0, -65.0], 'Peru': [-10.0, -76.0],
  'Ecuador': [-2.0, -77.5], 'Chile': [-30.0, -71.0], 'Argentina': [-34.0, -64.0],
  'Brazil': [-10.0, -55.0],
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'X-Module': 'sanctions-directional-api', 'X-Module-Version': '1.0.0', 'Cache-Control': `public, max-age=${meta.cache}` });
  res.end(JSON.stringify(obj));
}

function sendText(res, code, text, ct) {
  res.writeHead(code, { 'Content-Type': ct, 'X-Module': 'sanctions-directional-api', 'X-Module-Version': '1.0.0', 'Cache-Control': `public, max-age=${meta.cache}` });
  res.end(text);
}

async function loadData() {
  const raw = await fs.readFile(BASKET_FILE, 'utf8');
  const d = JSON.parse(raw);
  if (!d || !Array.isArray(d.entries)) {
    const err = new Error('unrecognized_basket_format: ожидался объект с массивом entries');
    err.statusCode = 500;
    throw err;
  }
  return d;
}

function aggregate(entries) {
  const byCountry = {};
  const byProgram = {};
  const byType = {};

  for (const e of entries) {
    const recCountries = new Set();
    for (const a of (e.addresses || [])) {
      if (a.country) recCountries.add(a.country);
    }
    const recPrograms = e.programs || [];
    const recType = e.type || 'unknown';

    byType[recType] = (byType[recType] || 0) + 1;

    for (const p of recPrograms) {
      if (!byProgram[p]) byProgram[p] = { count: 0, countries: {} };
      byProgram[p].count++;
      for (const c of recCountries) {
        byProgram[p].countries[c] = (byProgram[p].countries[c] || 0) + 1;
      }
    }

    for (const c of recCountries) {
      if (!byCountry[c]) byCountry[c] = { count: 0, programs: {}, types: {} };
      byCountry[c].count++;
      byCountry[c].types[recType] = (byCountry[c].types[recType] || 0) + 1;
      for (const p of recPrograms) {
        byCountry[c].programs[p] = (byCountry[c].programs[p] || 0) + 1;
      }
    }
  }

  return { byCountry, byProgram, byType, total: entries.length };
}

function toFeatureCollection(agg, options = {}) {
  const { minCount = 0, limit = 0, top = 0 } = options;
  let items = Object.entries(agg.byCountry).filter(([_, v]) => v.count >= minCount);
  items.sort((a, b) => b[1].count - a[1].count);
  if (top > 0) items = items.slice(0, top);
  if (limit > 0) items = items.slice(0, limit);

  const features = items.map(([country, data]) => {
    const coords = COUNTRY_COORDS[country] || null;
    return {
      type: 'Feature',
      geometry: coords ? { type: 'Point', coordinates: [coords[1], coords[0]] } : null,
      properties: {
        name: country,
        count: data.count,
        programs_count: Object.keys(data.programs).length,
        top_programs: Object.entries(data.programs).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${v}`),
        types: data.types,
        issuer: 'US-OFAC',
      },
    };
  });

  return {
    type: 'FeatureCollection',
    metadata: {
      module: 'sanctions-directional-api',
      issuer: 'US-OFAC',
      total_records: agg.total,
      total_countries: Object.keys(agg.byCountry).length,
      total_programs: Object.keys(agg.byProgram).length,
      generated_at: new Date().toISOString(),
    },
    features,
  };
}

function toStats(agg) {
  const topCountries = Object.entries(agg.byCountry)
    .sort((a,b)=>b[1].count-a[1].count)
    .slice(0, 20)
    .map(([c,v])=>({ country: c, count: v.count }));
  const topPrograms = Object.entries(agg.byProgram)
    .sort((a,b)=>b[1].count-a[1].count)
    .slice(0, 20)
    .map(([p,v])=>({ program: p, count: v.count }));
  return {
    module: 'sanctions-directional-api',
    issuer: 'US-OFAC',
    total: agg.total,
    by_type: agg.byType,
    total_countries: Object.keys(agg.byCountry).length,
    total_programs: Object.keys(agg.byProgram).length,
    top_countries: topCountries,
    top_programs: topPrograms,
    generated_at: new Date().toISOString(),
  };
}

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    if (path.endsWith('/status')) {
      return sendJSON(res, 200, {
        module: 'sanctions-directional-api',
        version: '1.0.0',
        status: 'ok',
        basket_file: 'data/basket/ofac-sdn.json',
        issuer: 'US-OFAC',
      });
    }

    let data;
    try {
      data = await loadData();
    } catch (e) {
      return sendJSON(res, 503, { error: 'no_data', message: e.message, hint: 'run scripts/collectors/collect-ofac-sdn.mjs' });
    }

    const agg = aggregate(data.entries);

    if (path.endsWith('/stats')) {
      return sendJSON(res, 200, toStats(agg));
    }

    if (path.endsWith('/by-country')) {
      const fc = toFeatureCollection(agg, {
        minCount: parseInt(query.min) || 0,
        limit: parseInt(query.limit) || 0,
        top: parseInt(query.top) || 0,
      });
      return sendJSON(res, 200, fc);
    }

    if (path.endsWith('/by-program')) {
      const programs = Object.entries(agg.byProgram)
        .sort((a,b)=>b[1].count-a[1].count)
        .map(([name, d]) => ({
          program: name,
          count: d.count,
          top_countries: Object.entries(d.countries)
            .sort((a,b)=>b[1]-a[1])
            .slice(0, 5)
            .map(([c,v])=>({ country: c, count: v })),
        }));
      const limit = parseInt(query.limit) || 0;
      return sendJSON(res, 200, {
        module: 'sanctions-directional-api',
        issuer: 'US-OFAC',
        total_programs: programs.length,
        programs: limit > 0 ? programs.slice(0, limit) : programs,
      });
    }

    const format = (query.format || 'json').toLowerCase();

    if (format === 'csv') {
      const rows = Object.entries(agg.byCountry).sort((a,b)=>b[1].count-a[1].count);
      const csv = ['country,count,top_program', ...rows.map(([c,d]) => {
        const topProg = Object.entries(d.programs).sort((a,b)=>b[1]-a[1])[0];
        return `"${c}",${d.count},"${topProg ? topProg[0] : ''}"`;
      })].join('\n');
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }

    if (format === 'series') {
      const series = Object.entries(agg.byCountry)
        .sort((a,b)=>b[1].count-a[1].count)
        .map(([c,v])=>({ date: null, country: c, value: v.count }));
      return sendJSON(res, 200, { module: 'sanctions-directional-api', series });
    }

    if (format === 'stats') {
      return sendJSON(res, 200, toStats(agg));
    }

    if (format === 'raw') {
      return sendJSON(res, 200, {
        module: 'sanctions-directional-api',
        total: agg.total,
        byCountry: agg.byCountry,
        byProgram: agg.byProgram,
        byType: agg.byType,
      });
    }

    const fc = toFeatureCollection(agg, {
      minCount: parseInt(query.min) || 0,
      limit: parseInt(query.limit) || 0,
      top: parseInt(query.top) || 0,
    });

    if (query.country) {
      fc.features = fc.features.filter(f => f.properties.name.toLowerCase().includes(query.country.toLowerCase()));
      fc.metadata.filter_country = query.country;
    }
    if (query.program) {
      fc.features = fc.features.filter(f => Object.keys(agg.byCountry[f.properties.name]?.programs || {}).some(p => p.toLowerCase().includes(query.program.toLowerCase())));
      fc.metadata.filter_program = query.program;
    }

    fc.series = Object.entries(agg.byCountry)
      .sort((a,b)=>b[1].count-a[1].count)
      .slice(0, 30)
      .map(([c,v])=>({ date: null, country: c, value: v.count }));
    fc.stats = toStats(agg);

    return sendJSON(res, 200, fc);

  } catch (e) {
    const code = e.statusCode || 500;
    return sendJSON(res, code, { error: 'internal_error', message: e.message });
  }
}
