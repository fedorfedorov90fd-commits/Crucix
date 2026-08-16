#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №9: СПУТНИКОВЫЙ МОНИТОРИНГ — API
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'satellite');

// ============================================================
// 1. ДАННЫЕ О СПУТНИКАХ (статические)
// ============================================================

const SATELLITES = {
  sentinel2: {
    name: 'Sentinel-2',
    provider: 'ESA',
    type: 'optical',
    resolution: '10m',
    bands: ['B2', 'B3', 'B4', 'B8'],
    status: 'active',
    lastPass: new Date().toISOString()
  },
  sentinel1: {
    name: 'Sentinel-1',
    provider: 'ESA',
    type: 'radar',
    resolution: '5m',
    bands: ['C-band'],
    status: 'active',
    lastPass: new Date().toISOString()
  },
  landsat9: {
    name: 'Landsat 9',
    provider: 'NASA/USGS',
    type: 'optical',
    resolution: '15m',
    bands: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
    status: 'active',
    lastPass: new Date().toISOString()
  },
  modis: {
    name: 'MODIS (Terra)',
    provider: 'NASA',
    type: 'optical',
    resolution: '250m',
    bands: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
    status: 'active',
    lastPass: new Date().toISOString()
  }
};

// ============================================================
// 2. ТЕСТОВЫЕ ДАННЫЕ (демо-снимки)
// ============================================================

const DEMO_IMAGES = [
  {
    id: 'img-001',
    satellite: 'sentinel2',
    date: '2026-08-10',
    coordinates: { lat: 47.5122, lng: 34.8347 },
    location: 'Запорожская АЭС, Украина',
    url: '/images/satellite/demo/zaporizhzhia-2026-08-10.jpg',
    thumbnail: '/images/satellite/demo/zaporizhzhia-thumb.jpg',
    cloudCover: 12,
    resolution: '10m',
    bands: ['B2', 'B3', 'B4']
  },
  {
    id: 'img-002',
    satellite: 'sentinel1',
    date: '2026-08-09',
    coordinates: { lat: 47.5122, lng: 34.8347 },
    location: 'Запорожская АЭС, Украина',
    url: '/images/satellite/demo/zaporizhzhia-radar-2026-08-09.jpg',
    thumbnail: '/images/satellite/demo/zaporizhzhia-radar-thumb.jpg',
    cloudCover: 0,
    resolution: '5m',
    bands: ['C-band']
  },
  {
    id: 'img-003',
    satellite: 'landsat9',
    date: '2026-08-08',
    coordinates: { lat: 35.0380, lng: -85.0560 },
    location: 'АЭС Секвойя, США',
    url: '/images/satellite/demo/sequoyah-2026-08-08.jpg',
    thumbnail: '/images/satellite/demo/sequoyah-thumb.jpg',
    cloudCover: 8,
    resolution: '15m',
    bands: ['B2', 'B3', 'B4', 'B5']
  },
  {
    id: 'img-004',
    satellite: 'sentinel2',
    date: '2026-08-07',
    coordinates: { lat: 36.0160, lng: -114.7380 },
    location: 'ГЭС Гувер, США',
    url: '/images/satellite/demo/hoover-2026-08-07.jpg',
    thumbnail: '/images/satellite/demo/hoover-thumb.jpg',
    cloudCover: 5,
    resolution: '10m',
    bands: ['B2', 'B3', 'B4']
  },
  {
    id: 'img-005',
    satellite: 'sentinel2',
    date: '2026-08-06',
    coordinates: { lat: 45.3084, lng: 36.4968 },
    location: 'Крымский мост',
    url: '/images/satellite/demo/crimean-bridge-2026-08-06.jpg',
    thumbnail: '/images/satellite/demo/crimean-bridge-thumb.jpg',
    cloudCover: 3,
    resolution: '10m',
    bands: ['B2', 'B3', 'B4']
  },
  {
    id: 'img-006',
    satellite: 'sentinel1',
    date: '2026-08-05',
    coordinates: { lat: 46.7750, lng: 33.3669 },
    location: 'Каховская ГЭС, Украина',
    url: '/images/satellite/demo/kakhovka-radar-2026-08-05.jpg',
    thumbnail: '/images/satellite/demo/kakhovka-radar-thumb.jpg',
    cloudCover: 0,
    resolution: '5m',
    bands: ['C-band']
  }
];

// ============================================================
// 3. ОРБИТАЛЬНЫЕ ДАННЫЕ (демо)
// ============================================================

const ORBIT_DATA = {
  starlink: { name: 'Starlink', count: 10119, altitude: 550, inclination: 53, type: 'LEO' },
  oneweb: { name: 'OneWeb', count: 651, altitude: 1200, inclination: 87.9, type: 'LEO' },
  iridium: { name: 'Iridium', count: 75, altitude: 780, inclination: 86.4, type: 'LEO' },
  gps: { name: 'GPS', count: 31, altitude: 20200, inclination: 55, type: 'MEO' },
  geo: { name: 'GEO Satellites', count: 542, altitude: 35786, inclination: 0, type: 'GEO' }
};

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

// GET /api/satellite/status — статус модуля
  if (path === '/api/satellite/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, module: 'satellite', status: 'online', timestamp: new Date().toISOString() }));
  }

export async function handleSatelliteAPI(req, res) {
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
    // --- GET /api/satellite/status ---
    if (path === '/api/satellite/status') {
      const status = Object.keys(SATELLITES).map(key => ({
        id: key,
        ...SATELLITES[key],
        imagesAvailable: DEMO_IMAGES.filter(img => img.satellite === key).length
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        satellites: status,
        totalImages: DEMO_IMAGES.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // --- GET /api/satellite/search ---
    if (path === '/api/satellite/search') {
      const params = new URLSearchParams(url.search);
      const lat = parseFloat(params.get('lat'));
      const lng = parseFloat(params.get('lng'));
      const date = params.get('date');
      const satellite = params.get('satellite');

      let results = [...DEMO_IMAGES];

      if (lat && lng) {
        results = results.filter(img => {
          const dist = Math.sqrt(
            Math.pow(img.coordinates.lat - lat, 2) +
            Math.pow(img.coordinates.lng - lng, 2)
          );
          return dist < 0.5;
        });
      }

      if (date) {
        results = results.filter(img => img.date === date);
      }

      if (satellite) {
        results = results.filter(img => img.satellite === satellite);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: results.length,
        images: results,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // --- GET /api/satellite/image/:id ---
    if (path.startsWith('/api/satellite/image/')) {
      const id = path.split('/').pop();
      const image = DEMO_IMAGES.find(img => img.id === id);

      if (!image) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Снимок не найден' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        image: image
      }));
      return;
    }

    // --- GET /api/satellite/compare ---
    if (path === '/api/satellite/compare') {
      const params = new URLSearchParams(url.search);
      const lat = parseFloat(params.get('lat'));
      const lng = parseFloat(params.get('lng'));
      const date1 = params.get('date1');
      const date2 = params.get('date2');

      let images = [...DEMO_IMAGES];

      if (lat && lng) {
        images = images.filter(img => {
          const dist = Math.sqrt(
            Math.pow(img.coordinates.lat - lat, 2) +
            Math.pow(img.coordinates.lng - lng, 2)
          );
          return dist < 0.5;
        });
      }

      const img1 = images.find(img => img.date === date1);
      const img2 = images.find(img => img.date === date2);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        before: img1 || null,
        after: img2 || null,
        hasComparison: !!(img1 && img2),
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // --- GET /api/satellite/orbits ---
    if (path === '/api/satellite/orbits') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        constellations: ORBIT_DATA,
        totalSatellites: Object.values(ORBIT_DATA).reduce((sum, c) => sum + c.count, 0),
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // --- GET /api/satellite/changes ---
    if (path === '/api/satellite/changes') {
      const params = new URLSearchParams(url.search);
      const lat = parseFloat(params.get('lat'));
      const lng = parseFloat(params.get('lng'));

      // Демо-детекция изменений
      const changes = [
        {
          id: 'change-001',
          location: 'Запорожская АЭС, Украина',
          coordinates: { lat: 47.5122, lng: 34.8347 },
          dateFrom: '2026-07-01',
          dateTo: '2026-08-10',
          type: 'construction',
          description: 'Новое строительство в 500м от станции',
          confidence: 78
        },
        {
          id: 'change-002',
          location: 'Крымский мост',
          coordinates: { lat: 45.3084, lng: 36.4968 },
          dateFrom: '2026-07-15',
          dateTo: '2026-08-06',
          type: 'damage',
          description: 'Повреждение на восточной части моста',
          confidence: 92
        },
        {
          id: 'change-003',
          location: 'Каховская ГЭС, Украина',
          coordinates: { lat: 46.7750, lng: 33.3669 },
          dateFrom: '2026-05-01',
          dateTo: '2026-08-05',
          type: 'destruction',
          description: 'Полное разрушение плотины',
          confidence: 95
        }
      ];

      let filtered = changes;
      if (lat && lng) {
        filtered = changes.filter(c => {
          const dist = Math.sqrt(
            Math.pow(c.coordinates.lat - lat, 2) +
            Math.pow(c.coordinates.lng - lng, 2)
          );
          return dist < 0.5;
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        changes: filtered,
        count: filtered.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // 404
  // ============================================================
  // GET /api/satellite/status — статус модуля
  // ============================================================
  if (path === '/api/satellite/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, module: 'satellite', status: 'online', timestamp: new Date().toISOString() }));
    return;
  }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Satellite API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

export default { handleSatelliteAPI };