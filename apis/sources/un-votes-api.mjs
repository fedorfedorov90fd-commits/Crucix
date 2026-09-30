/**
 * apis/sources/un-votes-api.mjs — API-МОДУЛЬ: ГОЛОСОВАНИЯ ООН
 *
 * КОНТРАКТ CRUCIX v2.
 * Версия 1.0.0. Принят 23.09.2026.
 *
 * ИСТОЧНИК: data/basket/un-votes.json — схема crucix.basket.v1.
 * Сборщик: scripts/collectors/collect-un-votes.mjs.
 *
 * Роль: отдаёт ideal points стран ООН (ось "запад ↔ остальные") для
 * choropleth-карты. Положительные значения = западный блок, отрицательные = другой.
 *
 * Форматы: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * Фильтры: ?iso3=, ?min=, ?max=, ?session=, ?top=, ?limit=.
 *
 * Эндпоинты:
 *   GET /               — корень (json по умолчанию)
 *   GET /stats          — агрегированная статистика
 *   GET /series         — временной ряд среднего ideal point
 *   GET /latest         — только последняя сессия
 *   GET /status         — health-check
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'un-votes.json');

export const route  = '/api/layers/un-votes';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '🗳️',
  color: '#4a90d9',
  vizType: 'choropleth',
  source: 'basket/un-votes.json',
  collector: 'collect-un-votes.mjs',
  cache: 3600,
  description: 'Голосования ГА ООН (ideal points, Erik Voeten dataset) — ось запад↔остальные',
  unit: 'ideal_point',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Module': 'un-votes-api',
    'X-Module-Version': '1.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
  });
  res.end(JSON.stringify(obj));
}

function sendText(res, code, text, ct) {
  res.writeHead(code, {
    'Content-Type': ct,
    'X-Module': 'un-votes-api',
    'X-Module-Version': '1.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
  });
  res.end(text);
}

async function loadData() {
  const raw = await fs.readFile(BASKET_FILE, 'utf8');
  const d = JSON.parse(raw);
  if (!d || d.schema !== 'crucix.basket.v1') {
    const err = new Error('unrecognized_basket_format');
    err.statusCode = 500;
    throw err;
  }
  return d;
}


const ISO3_COORDS = {USA:[-95.7,37.1],ISR:[35.2,31.5],GBR:[-1.5,53.0],FRA:[2.2,46.2],AUS:[133.8,-25.3],CAN:[-106.3,56.1],CSK:[15.5,49.8],FSM:[171.0,7.1],CZE:[15.5,49.8],HUN:[19.5,47.2],LTU:[23.9,55.2],UKR:[31.2,48.9],DEU:[10.5,51.2],POL:[19.1,52.0],LVA:[24.9,56.9],ROU:[24.9,45.9],EST:[25.5,58.6],DNK:[9.5,56.3],ALB:[20.2,41.2],BGR:[25.5,42.7],SVK:[19.7,48.7],ESP:[-3.7,40.5],BEL:[4.5,50.6],ITA:[12.6,41.9],LUX:[6.1,49.8],NLD:[5.3,52.1],HRV:[15.2,45.1],PRT:[-8.2,39.4],MNE:[19.4,42.7],GRC:[22.0,39.0],MCO:[7.4,43.7],MKD:[21.7,41.6],SVN:[14.5,46.1],MHL:[171.0,7.1],ISL:[-19.0,64.9],NOR:[8.5,60.5],GEO:[43.4,42.3],FIN:[25.7,61.9],SWE:[18.0,60.1],TWN:[121.0,23.7],KOR:[127.8,36.0],AUT:[14.6,47.5],CHE:[8.2,46.8],IRL:[-8.2,53.4],SMR:[12.5,43.9],AND:[1.6,42.5],BIH:[17.7,44.3],MLT:[14.4,35.9],CYP:[33.0,35.1],NZL:[174.9,-40.9],LIE:[9.6,47.2],JPN:[138.3,36.2],MDA:[29.0,47.4],TUR:[35.2,38.9],YUG:[21.0,44.0],LBR:[-9.4,6.4],NRU:[166.9,-0.5],BRA:[-51.9,-14.2],HTI:[-72.3,18.9],PLW:[134.5,7.5],ARM:[45.0,40.1],RUS:[100.0,61.5],TON:[-175.2,-21.2],GTM:[-90.2,15.7],PNG:[144.3,-6.3],HND:[-86.2,14.6],SSD:[31.0,7.0],COL:[-72.0,4.6],CMR:[12.4,7.4],VUT:[167.0,-16.4],WSM:[172.1,-13.2],CAF:[20.9,6.6],KIR:[173.0,1.4],TGO:[0.8,8.6],MEX:[-102.6,23.6],PAN:[-80.8,8.5],TUV:[179.2,-7.5],ARG:[-63.6,-38.4],SLB:[159.6,-8.9],PAK:[69.3,30.4],RWA:[29.9,-1.9],GHA:[-1.0,7.9],MLI:[-3.9,17.6],FJI:[178.0,-17.7],PRK:[127.0,40.3],CRI:[-83.8,9.7],CIV:[-5.5,7.5],IND:[78.9,20.6],PER:[-75.0,-9.2],BLR:[27.9,53.7],PRY:[-58.4,-23.4],DMA:[-61.4,15.4],SWZ:[31.5,-26.5],BLZ:[-88.5,17.2],CHL:[-71.5,-35.7],GUY:[-58.9,4.9],BRB:[-59.5,13.2],UZB:[64.7,41.4],CPV:[-23.5,16.0],LSO:[28.2,-29.6],BHS:[-76.0,25.0],DOM:[-70.7,18.7],ZAF:[22.9,-30.6],CHN:[104.2,35.9],TLS:[125.7,-8.9],BWA:[24.6,-22.3],SLV:[-88.9,13.7],NGA:[8.0,9.1],ZWE:[29.2,-19.0],MWI:[34.3,-13.2],URY:[-55.8,-32.5],SYC:[55.5,-4.7],PHL:[121.8,12.9],ECU:[-78.2,-1.8],SAU:[45.1,23.9],ETH:[40.5,9.1],KEN:[37.9,0.0],DJI:[42.6,11.8],SGP:[103.8,1.3],KNA:[-62.7,17.4],JAM:[-77.3,18.1],GNB:[-15.2,12.0],BFA:[-1.6,12.2],NAM:[18.0,-22.9],TTO:[-61.3,10.7],LCA:[-61.0,13.9],THA:[100.9,15.9],COD:[23.6,-2.9],STP:[6.7,0.2],ZMB:[27.8,-13.1],BEN:[2.3,9.3],MUS:[57.6,-20.3],SEN:[-14.5,14.5],GRD:[-61.7,12.1],BTN:[90.4,27.5],GMB:[-15.3,13.4],GNQ:[10.0,1.6],ATG:[-61.8,17.1],COM:[43.4,-11.6],BHR:[50.6,26.1],MDV:[73.2,3.2],MDG:[46.9,-18.8],TCD:[18.7,15.5],MNG:[103.8,46.9],AFG:[67.0,33.9],SLE:[-11.8,8.5],KAZ:[66.9,48.0],BGD:[90.4,23.7],SOM:[46.2,5.2],AGO:[17.9,-11.2],TJK:[71.3,38.9],DDR:[13.4,52.5],NER:[8.1,17.6],NPL:[84.1,28.4],MAR:[-7.1,31.8],MOZ:[35.5,-18.7],VCT:[-61.2,13.2],TZA:[34.9,-6.4],LKA:[80.8,7.9],SUR:[-56.0,3.9],GAB:[11.8,-0.8],ARE:[53.8,23.4],MMR:[95.9,21.9],AZE:[47.6,40.1],ERI:[39.8,15.2],MYS:[101.7,4.2],KGZ:[74.8,41.2],TUN:[9.5,33.9],YEM:[48.5,15.6],COG:[15.8,-0.7],JOR:[36.2,31.0],GIN:[-9.7,9.9],YAR:[48.5,15.6],TKM:[59.4,41.4],QAT:[51.2,25.4],LBY:[17.2,26.3],BRN:[114.7,4.5],VNM:[108.3,14.1],KWT:[47.5,29.3],UGA:[32.3,1.4],BOL:[-63.6,-16.3],IDN:[113.9,-0.8],LAO:[102.5,19.9],MRT:[-10.9,21.0],IRQ:[43.7,33.2],OMN:[56.0,21.5],DZA:[1.7,28.0],EGY:[30.8,26.8],BDI:[29.9,-3.4],SDN:[30.0,12.9],LBN:[35.5,33.9],KHM:[104.9,12.6],NIC:[-85.2,12.9],CUB:[-77.8,21.5],IRN:[53.7,32.4],VEN:[-66.6,6.4],SYR:[38.9,34.8]};

function toFeatureCollection(data, options = {}) {
  let regions = [...(data.regions || [])];
  if (options.iso3) regions = regions.filter(r => String(r.region).toLowerCase().includes(options.iso3.toLowerCase()));
  if (options.min != null) regions = regions.filter(r => r.value >= options.min);
  if (options.max != null) regions = regions.filter(r => r.value <= options.max);
  regions.sort((a, b) => b.value - a.value);
  if (options.top) regions = regions.slice(0, options.top);
  if (options.limit) regions = regions.slice(0, options.limit);

  // Диапазон ideal point для нормализации цвета
  const values = regions.map(r => r.value).filter(Number.isFinite);
  const minVal = values.length ? Math.min(...values) : -3;
  const maxVal = values.length ? Math.max(...values) : 3;

  const features = regions.map(r => ({
    type: 'Feature',
    geometry: ISO3_COORDS[r.region] ? { type: 'Point', coordinates: ISO3_COORDS[r.region] } : null, // choropleth — заливка полигонов по свойствам
    properties: {
      iso3: r.region,
      country: r.country || null,
      value: r.value,
      session: r.session,
      n_votes: r.n_votes,
      state_abb: r.state_abb || null,
      block: r.value > 0.5 ? 'west' : r.value < -0.5 ? 'other' : 'neutral',
      min: minVal,
      max: maxVal,
      issuer: 'US-OFAC',
      source: 'Voeten-UNGA',
    },
  }));

  return {
    type: 'FeatureCollection',
    metadata: {
      module: 'un-votes-api',
      source: 'Erik Voeten UNGA Ideal Points',
      latest_session: data.latest_session,
      total_countries: regions.length,
      min_value: minVal,
      max_value: maxVal,
      generated_at: new Date().toISOString(),
    },
    features,
  };
}

function toStats(data) {
  const regions = data.regions || [];
  const series = data.series || [];
  const values = regions.map(r => r.value).filter(Number.isFinite);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const west = regions.filter(r => r.value > 0.5).length;
  const other = regions.filter(r => r.value < -0.5).length;
  const neutral = regions.length - west - other;
  const top10 = [...regions].sort((a, b) => b.value - a.value).slice(0, 10);
  const bottom10 = [...regions].sort((a, b) => a.value - b.value).slice(0, 10);
  return {
    module: 'un-votes-api',
    source: 'Erik Voeten UNGA Ideal Points',
    latest_session: data.latest_session,
    total_countries: regions.length,
    total_sessions: series.length,
    mean_ideal_point: Math.round(mean * 10000) / 10000,
    blocks: { west, other, neutral },
    top_west: top10.map(r => ({ iso3: r.region, country: r.country, value: r.value })),
    top_other: bottom10.map(r => ({ iso3: r.region, country: r.country, value: r.value })),
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
        module: 'un-votes-api',
        version: '1.0.0',
        status: 'ok',
        basket_file: 'data/basket/un-votes.json',
      });
    }

    let data;
    try {
      data = await loadData();
    } catch (e) {
      return sendJSON(res, 503, {
        error: 'no_data',
        message: e.message,
        hint: 'run scripts/collectors/collect-un-votes.mjs && node scripts/warehouse/managerbasket.mjs',
      });
    }

    if (path.endsWith('/stats')) {
      return sendJSON(res, 200, toStats(data));
    }

    if (path.endsWith('/series')) {
      const session = parseInt(query.session, 10);
      let series = data.series || [];
      if (Number.isFinite(session)) series = series.filter(s => s.session === session);
      return sendJSON(res, 200, {
        module: 'un-votes-api',
        series,
        total: series.length,
      });
    }

    if (path.endsWith('/latest')) {
      const latestSession = data.latest_session;
      const regions = (data.regions || []).filter(r => r.session === latestSession);
      return sendJSON(res, 200, toFeatureCollection({ ...data, regions }, {
        top: parseInt(query.top, 10) || 0,
        limit: parseInt(query.limit, 10) || 0,
      }));
    }

    const format = (query.format || 'json').toLowerCase();

    if (format === 'csv') {
      const rows = [...(data.regions || [])].sort((a, b) => b.value - a.value);
      const csv = ['iso3,country,session,ideal_point,n_votes', ...rows.map(r =>
        `"${r.region}","${(r.country || '').replace(/"/g, '""')}",${r.session},${r.value},${r.n_votes}`
      )].join('\n');
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }

    if (format === 'series') {
      return sendJSON(res, 200, { module: 'un-votes-api', series: data.series });
    }

    if (format === 'stats') {
      return sendJSON(res, 200, toStats(data));
    }

    if (format === 'raw') {
      return sendJSON(res, 200, data);
    }

    // json (по умолчанию)
    const fc = toFeatureCollection(data, {
      iso3: query.iso3,
      min: query.min != null ? parseFloat(query.min) : null,
      max: query.max != null ? parseFloat(query.max) : null,
      top: parseInt(query.top, 10) || 0,
      limit: parseInt(query.limit, 10) || 0,
    });
    fc.series = data.series;
    fc.stats = toStats(data);
    return sendJSON(res, 200, fc);

  } catch (e) {
    const code = e.statusCode || 500;
    return sendJSON(res, code, { error: 'internal_error', message: e.message });
  }
}
