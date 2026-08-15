// USGS Earthquake Hazards Program — global seismic activity
// No auth required. Real-time GeoJSON feeds, updated every minute.
// Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

import { fetchWithRetry } from '../utils/fetch.mjs';

// Rolling 24h feed of M2.5+ quakes worldwide (small, fast, good signal).
const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

function mapQuake(f) {
  const [lon, lat, depth] = f.geometry?.coordinates || [];
  const p = f.properties || {};
  return {
    id: f.id,
    mag: typeof p.mag === 'number' ? +p.mag.toFixed(1) : null,
    place: (p.place || '').substring(0, 90),
    time: p.time ? new Date(p.time).toISOString() : null,
    depth: typeof depth === 'number' ? +depth.toFixed(1) : null,
    tsunami: p.tsunami === 1,
    felt: p.felt || 0,
    url: p.url || null,
    lat: typeof lat === 'number' ? +lat.toFixed(3) : null,
    lon: typeof lon === 'number' ? +lon.toFixed(3) : null,
  };
}

// Great-circle distance in km (haversine).
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get earthquakes feed
export async function fetchQuakes() {
  try {
    const response = await fetchWithRetry(FEED_URL, { timeout: 10000 });
    if (!response || !response.ok) {
      return { error: `USGS API error: ${response ? response.status : 'no response'}`, quakes: [] };
    }
    const data = await response.json();
    const features = data.features || [];
    return {
      quakes: features.map(mapQuake),
      count: features.length,
      metadata: data.metadata || {}
    };
  } catch (error) {
    console.error('[USGS] Ошибка:', error.message);
    return { error: error.message, quakes: [] };
  }
}

// HTTP handler for API
export async function handleUSGSApi(req, res) {
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
    // --- GET /api/usgs/status ---
    if (path === '/api/usgs/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'USGS',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // --- GET /api/usgs/quakes ---
    if (path === '/api/usgs/quakes') {
      const result = await fetchQuakes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        ...result
      }));
      return;
    }

    // --- GET /api/usgs/nearby?lat=X&lon=Y&radius=Z ---
    if (path === '/api/usgs/nearby') {
      const params = new URLSearchParams(url.search);
      const lat = parseFloat(params.get('lat'));
      const lon = parseFloat(params.get('lon'));
      const radius = parseFloat(params.get('radius')) || 500;

      if (isNaN(lat) || isNaN(lon)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'lat and lon required' }));
        return;
      }

      const result = await fetchQuakes();
      if (result.error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
        return;
      }

      const nearby = result.quakes.filter(q => {
        return q.lat !== null && q.lon !== null &&
               haversineKm(lat, lon, q.lat, q.lon) <= radius;
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        total: nearby.length,
        quakes: nearby,
        radius: radius,
        center: { lat, lon }
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[USGS API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

export default { handleUSGSApi, fetchQuakes, haversineKm };
