#!/usr/bin/env node

// ============================================================
// GEO-MARKERS-API — Геополитические маркеры
// ============================================================
// Данные: статусы стран, маркеры новостей, координаты
// Версия: 2.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'geo');

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// Статусы стран (из data/geo/country-status.json)
// critical — красный (война, кризис)
// high — оранжевый (высокая напряжённость)
// medium — жёлтый (средняя напряжённость)
// normal — зелёный (нормальный)

// ============================================================
// 2. ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadCountryStatus() {
  try {
    const file = join(DATA_DIR, 'country-status.json');
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.warn('[Geo API] Не удалось загрузить country-status.json, использую демо');
    return getDemoStatus();
  }
}

async function loadCountryCoords() {
  try {
    const file = join(DATA_DIR, 'country-coords.json');
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.warn('[Geo API] Не удалось загрузить country-coords.json, использую демо');
    return getDemoCoords();
  }
}

async function loadMarkers() {
  try {
    const file = join(DATA_DIR, 'markers.json');
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.warn('[Geo API] Не удалось загрузить markers.json, использую демо');
    return [];
  }
}

// ============================================================
// 3. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoStatus() {
  return {
    Ukraine: 'critical',
    Russia: 'high',
    USA: 'normal',
    China: 'medium',
    India: 'medium',
    Iran: 'critical',
    Israel: 'critical',
    Syria: 'critical',
    Yemen: 'critical',
    Sudan: 'critical',
    Palestine: 'critical',
    'North Korea': 'critical',
    'South Korea': 'high',
    Japan: 'high',
    Turkey: 'high',
    Poland: 'high',
    Germany: 'medium',
    France: 'medium',
    UK: 'medium',
    Italy: 'medium',
    Spain: 'medium',
    Brazil: 'medium',
    Argentina: 'medium',
    Mexico: 'high',
    Canada: 'normal',
    Australia: 'normal',
    'New Zealand': 'normal',
    Singapore: 'normal',
    Taiwan: 'normal',
    Thailand: 'medium',
    Vietnam: 'medium',
    Indonesia: 'medium',
    Malaysia: 'medium',
    Philippines: 'medium',
    Egypt: 'high',
    Algeria: 'high',
    Morocco: 'high',
    Tunisia: 'high',
    Nigeria: 'high',
    'South Africa': 'medium',
    Kenya: 'medium',
    Tanzania: 'medium',
    Uganda: 'medium',
    Ethiopia: 'critical',
    Somalia: 'critical',
    'South Sudan': 'critical',
    Mali: 'critical',
    Niger: 'critical',
    Libya: 'critical',
    'Central African Republic': 'critical',
    'Democratic Republic of the Congo': 'critical',
    Afghanistan: 'critical',
    Pakistan: 'high',
    Iraq: 'critical',
    Lebanon: 'critical',
    Jordan: 'medium',
    'Saudi Arabia': 'medium',
    UAE: 'medium',
    Qatar: 'medium',
    Kuwait: 'medium',
    Oman: 'medium',
    Bahrain: 'medium',
    Belarus: 'high',
    Kazakhstan: 'high',
    Uzbekistan: 'high',
    Turkmenistan: 'high',
    Kyrgyzstan: 'high',
    Tajikistan: 'high',
    Mongolia: 'high',
    Armenia: 'high',
    Azerbaijan: 'high',
    Georgia: 'high',
    Moldova: 'high',
    Serbia: 'high',
    Kosovo: 'high',
    'Bosnia and Herzegovina': 'medium',
    Albania: 'medium',
    Greece: 'medium',
    Bulgaria: 'medium',
    Romania: 'medium',
    Hungary: 'medium',
    Czechia: 'medium',
    Slovakia: 'medium',
    Slovenia: 'medium',
    Croatia: 'medium',
    'North Macedonia': 'medium',
    Montenegro: 'medium',
    Cyprus: 'medium',
    Malta: 'medium',
    Estonia: 'medium',
    Latvia: 'medium',
    Lithuania: 'medium',
    Finland: 'medium',
    Sweden: 'medium',
    Norway: 'medium',
    Denmark: 'medium',
    Iceland: 'medium',
    Ireland: 'medium',
    Portugal: 'medium',
    Netherlands: 'medium',
    Belgium: 'medium',
    Luxembourg: 'medium',
    Switzerland: 'medium',
    Austria: 'medium',
    'Vatican City': 'medium',
    Monaco: 'medium',
    Liechtenstein: 'medium',
    Andorra: 'medium',
    'San Marino': 'medium',
    'Costa Rica': 'medium',
    Panama: 'medium',
    Guatemala: 'medium',
    Honduras: 'medium',
    Nicaragua: 'medium',
    'El Salvador': 'medium',
    Belize: 'medium',
    Guyana: 'medium',
    Suriname: 'medium',
    Ecuador: 'medium',
    Peru: 'medium',
    Chile: 'medium',
    Colombia: 'high',
    Venezuela: 'high',
    Bolivia: 'medium',
    Paraguay: 'medium',
    Uruguay: 'medium',
    Cuba: 'medium',
    Haiti: 'medium',
    'Dominican Republic': 'medium',
    Jamaica: 'medium',
    Bahamas: 'medium',
    Barbados: 'medium',
    Trinidad: 'medium',
    Nepal: 'high',
    Bangladesh: 'high',
    'Sri Lanka': 'high',
    Myanmar: 'critical',
    Cambodia: 'high',
    Laos: 'high',
    Brunei: 'normal',
    'Papua New Guinea': 'normal',
    Fiji: 'normal',
    'Solomon Islands': 'normal',
    Vanuatu: 'normal',
    'New Caledonia': 'normal',
    Samoa: 'normal',
    Tonga: 'normal',
    'Marshall Islands': 'normal',
    Palau: 'normal',
    Micronesia: 'normal',
    'Sao Tome and Principe': 'normal',
    'Cape Verde': 'normal',
    Seychelles: 'normal',
    Mauritius: 'normal',
    Maldives: 'normal',
    'Antigua and Barbuda': 'normal',
    'Saint Kitts and Nevis': 'normal',
    'Saint Lucia': 'normal',
    Grenada: 'normal',
    'Saint Vincent and the Grenadines': 'normal',
    Dominica: 'normal'
  };
}

function getDemoCoords() {
  return {
    Ukraine: { lat: 49.0, lon: 32.0 },
    Russia: { lat: 61.0, lon: 90.0 },
    USA: { lat: 39.8, lon: -98.6 },
    China: { lat: 35.0, lon: 105.0 },
    India: { lat: 21.0, lon: 78.0 },
    Iran: { lat: 32.0, lon: 53.0 },
    Israel: { lat: 31.0, lon: 34.8 },
    Syria: { lat: 35.0, lon: 38.0 },
    Yemen: { lat: 15.5, lon: 48.0 },
    Sudan: { lat: 15.0, lon: 30.0 },
    'North Korea': { lat: 40.0, lon: 127.0 },
    'South Korea': { lat: 37.0, lon: 127.5 },
    Japan: { lat: 36.0, lon: 138.0 },
    Turkey: { lat: 39.0, lon: 35.0 },
    Poland: { lat: 52.0, lon: 20.0 },
    Germany: { lat: 51.0, lon: 10.0 },
    France: { lat: 47.0, lon: 2.0 },
    UK: { lat: 55.0, lon: -3.0 },
    Italy: { lat: 42.0, lon: 12.5 },
    Spain: { lat: 40.0, lon: -4.0 },
    Brazil: { lat: -14.0, lon: -52.0 },
    Argentina: { lat: -35.0, lon: -64.0 },
    Mexico: { lat: 23.0, lon: -102.0 },
    Canada: { lat: 56.0, lon: -106.0 },
    Australia: { lat: -25.0, lon: 134.0 },
    Egypt: { lat: 27.0, lon: 30.0 },
    Nigeria: { lat: 10.0, lon: 8.0 },
    'South Africa': { lat: -30.0, lon: 25.0 },
    Ethiopia: { lat: 9.0, lon: 40.0 },
    Somalia: { lat: 6.0, lon: 47.0 },
    Afghanistan: { lat: 34.0, lon: 67.0 },
    Pakistan: { lat: 30.0, lon: 70.0 },
    Iraq: { lat: 33.0, lon: 44.0 },
    Lebanon: { lat: 34.0, lon: 36.0 },
    'Saudi Arabia': { lat: 24.0, lon: 45.0 },
    UAE: { lat: 24.0, lon: 54.0 },
    Qatar: { lat: 25.3, lon: 51.2 },
    Kuwait: { lat: 29.3, lon: 47.9 },
    Oman: { lat: 21.0, lon: 57.0 },
    Belarus: { lat: 53.0, lon: 28.0 },
    Kazakhstan: { lat: 48.0, lon: 68.0 },
    Uzbekistan: { lat: 41.0, lon: 64.0 },
    Turkmenistan: { lat: 39.0, lon: 60.0 },
    Armenia: { lat: 40.0, lon: 45.0 },
    Azerbaijan: { lat: 40.5, lon: 47.5 },
    Georgia: { lat: 42.0, lon: 43.5 },
    Moldova: { lat: 47.0, lon: 28.5 },
    Serbia: { lat: 44.0, lon: 21.0 },
    Greece: { lat: 39.0, lon: 22.0 },
    Bulgaria: { lat: 43.0, lon: 25.0 },
    Romania: { lat: 46.0, lon: 25.0 },
    Hungary: { lat: 47.0, lon: 19.0 },
    Czechia: { lat: 50.0, lon: 14.5 },
    Slovakia: { lat: 48.7, lon: 19.5 },
    Slovenia: { lat: 46.0, lon: 15.0 },
    Croatia: { lat: 45.0, lon: 15.5 },
    'North Macedonia': { lat: 41.6, lon: 21.7 },
    Montenegro: { lat: 42.4, lon: 19.3 },
    Cyprus: { lat: 35.0, lon: 33.0 },
    Malta: { lat: 35.9, lon: 14.5 },
    Estonia: { lat: 59.0, lon: 26.0 },
    Latvia: { lat: 57.0, lon: 25.0 },
    Lithuania: { lat: 55.0, lon: 24.0 },
    Finland: { lat: 64.0, lon: 26.0 },
    Sweden: { lat: 60.0, lon: 15.0 },
    Norway: { lat: 62.0, lon: 10.0 },
    Denmark: { lat: 56.0, lon: 10.0 },
    Iceland: { lat: 65.0, lon: -18.0 },
    Ireland: { lat: 53.0, lon: -8.0 },
    Portugal: { lat: 39.5, lon: -8.0 },
    Netherlands: { lat: 52.3, lon: 5.3 },
    Belgium: { lat: 50.8, lon: 4.0 },
    Luxembourg: { lat: 49.8, lon: 6.1 },
    Switzerland: { lat: 46.8, lon: 8.2 },
    Austria: { lat: 47.5, lon: 14.0 },
    Colombia: { lat: 4.0, lon: -73.0 },
    Venezuela: { lat: 8.0, lon: -66.0 },
    Peru: { lat: -10.0, lon: -76.0 },
    Chile: { lat: -30.0, lon: -71.0 },
    Bolivia: { lat: -17.0, lon: -65.0 },
    Paraguay: { lat: -23.0, lon: -58.0 },
    Uruguay: { lat: -32.5, lon: -56.0 },
    Ecuador: { lat: -1.0, lon: -78.0 },
    'Costa Rica': { lat: 10.0, lon: -84.0 },
    Panama: { lat: 8.0, lon: -80.0 },
    Guatemala: { lat: 15.5, lon: -90.3 },
    Honduras: { lat: 15.0, lon: -86.5 },
    Nicaragua: { lat: 13.0, lon: -85.0 },
    'El Salvador': { lat: 13.8, lon: -88.9 },
    Cuba: { lat: 22.0, lon: -79.0 },
    Haiti: { lat: 19.0, lon: -72.4 },
    'Dominican Republic': { lat: 19.0, lon: -70.7 },
    Jamaica: { lat: 18.1, lon: -77.3 },
    Bahamas: { lat: 25.0, lon: -77.0 },
    Barbados: { lat: 13.1, lon: -59.5 },
    'New Zealand': { lat: -41.0, lon: 174.0 },
    Singapore: { lat: 1.3, lon: 103.8 },
    Taiwan: { lat: 23.6, lon: 121.0 },
    Thailand: { lat: 15.0, lon: 101.0 },
    Vietnam: { lat: 16.0, lon: 108.0 },
    Indonesia: { lat: -5.0, lon: 120.0 },
    Malaysia: { lat: 3.0, lon: 102.0 },
    Philippines: { lat: 13.0, lon: 122.0 },
    'Papua New Guinea': { lat: -6.0, lon: 147.0 },
    Fiji: { lat: -18.0, lon: 178.0 },
    'Solomon Islands': { lat: -9.5, lon: 160.0 },
    Vanuatu: { lat: -16.0, lon: 167.0 },
    Samoa: { lat: -13.8, lon: -172.0 },
    Tonga: { lat: -21.0, lon: -175.0 },
    'Marshall Islands': { lat: 7.1, lon: 171.1 },
    Palau: { lat: 7.5, lon: 134.6 },
    Micronesia: { lat: 6.9, lon: 158.2 },
    'Seychelles': { lat: -4.6, lon: 55.5 },
    Mauritius: { lat: -20.2, lon: 57.5 },
    Maldives: { lat: 3.2, lon: 73.0 },
    'Cape Verde': { lat: 16.0, lon: -24.0 },
    'Sao Tome and Principe': { lat: 0.2, lon: 6.6 },
    'Antigua and Barbuda': { lat: 17.1, lon: -61.8 },
    'Saint Kitts and Nevis': { lat: 17.3, lon: -62.7 },
    'Saint Lucia': { lat: 13.9, lon: -61.0 },
    Grenada: { lat: 12.1, lon: -61.7 },
    'Saint Vincent and the Grenadines': { lat: 13.2, lon: -61.2 },
    Dominica: { lat: 15.4, lon: -61.3 }
  };
}

// ============================================================
// 4. ОСНОВНАЯ ФУНКЦИЯ — ПОЛУЧИТЬ ВСЕ ГЕО-ДАННЫЕ
// ============================================================

export async function getGeoData() {
  const [status, coords, markers] = await Promise.all([
    loadCountryStatus(),
    loadCountryCoords(),
    loadMarkers()
  ]);

  return {
    success: true,
    countries: Object.keys(status).map(name => ({
      name: name,
      status: status[name] || 'normal',
      lat: coords[name]?.lat || 0,
      lon: coords[name]?.lon || 0
    })),
    markers: markers,
    timestamp: new Date().toISOString()
  };
}

// ============================================================
// 5. API-ОБРАБОТЧИК
// ============================================================

export async function handleGeoAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /api/geo/status — статусы стран
    if (path === '/api/geo/status' && req.method === 'GET') {
      const status = await loadCountryStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status }));
      return;
    }

    // GET /api/geo/coords — координаты стран
    if (path === '/api/geo/coords' && req.method === 'GET') {
      const coords = await loadCountryCoords();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, coords }));
      return;
    }

    // GET /api/geo/markers — маркеры новостей
    if (path === '/api/geo/markers' && req.method === 'GET') {
      const markers = await loadMarkers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, markers }));
      return;
    }

    // GET /api/geo/all — все данные (статус + координаты + маркеры)
    if (path === '/api/geo/all' && req.method === 'GET') {
      const data = await getGeoData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // GET /api/geo/status — статус модуля (для совместимости)
    if (path === '/api/geo/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'Geo-Markers',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Geo API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

// ============================================================
// 6. ЭКСПОРТЫ ДЛЯ СОВМЕСТИМОСТИ
// ============================================================

export default {
  getGeoData,
  handleGeoAPI,
  loadCountryStatus,
  loadCountryCoords,
  loadMarkers
};
