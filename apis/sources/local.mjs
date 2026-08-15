// Local-area intelligence aggregator — a "zoom-in" on the operator's home turf.
// Simplified version with safe imports and graceful degradation.

import { fetchWithRetry } from '../utils/fetch.mjs';
import { fetchQuakes, haversineKm } from './usgs.mjs';

const NWS_BASE = 'https://api.weather.gov';
const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

// Convert a center + radius (km) into a lat/lon bounding box.
function bboxFor(lat, lon, radiusKm) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    south: +(lat - dLat).toFixed(3),
    north: +(lat + dLat).toFixed(3),
    west: +(lon - dLon).toFixed(3),
    east: +(lon + dLon).toFixed(3),
  };
}

// Get NWS alerts for a point (simplified)
async function fetchNWSAlerts(lat, lon) {
  try {
    const url = `${NWS_BASE}/alerts/active?point=${lat},${lon}&limit=10`;
    const response = await fetchWithRetry(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'crucix-local/1.0', 'Accept': 'application/geo+json' }
    });
    if (!response || !response.ok) return { alerts: [], count: 0 };
    const data = await response.json();
    const features = data.features || [];
    return {
      alerts: features.map(f => ({
        id: f.id,
        headline: f.properties?.headline || 'Weather Alert',
        description: f.properties?.description || '',
        severity: f.properties?.severity || 'Unknown',
        area: f.properties?.areaDesc || '',
        effective: f.properties?.effective || null,
        expires: f.properties?.expires || null
      })),
      count: features.length
    };
  } catch (e) {
    return { alerts: [], count: 0, error: e.message };
  }
}

// Get FIRMS fires (graceful degradation)
async function fetchFires(bbox, apiKey) {
  if (!apiKey) {
    return { fires: [], count: 0, error: 'FIRMS_MAP_KEY not set' };
  }
  try {
    const url = `${FIRMS_BASE}/${apiKey}/VIIRS_NOAA20_NRT/${bbox.west},${bbox.south},${bbox.east},${bbox.north}/1`;
    const response = await fetchWithRetry(url, { timeout: 10000 });
    if (!response || !response.ok) return { fires: [], count: 0 };
    const text = await response.text();
    const lines = text.split('\n').filter(l => l.trim());
    const fires = [];
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 5) {
        fires.push({
          lat: parseFloat(parts[1]) || 0,
          lon: parseFloat(parts[0]) || 0,
          confidence: parts[4] || 'Unknown',
          date: parts[2] || ''
        });
      }
    }
    return { fires, count: fires.length };
  } catch (e) {
    return { fires: [], count: 0, error: e.message };
  }
}

// HTTP handler for API
export async function handleLocalApi(req, res) {
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
    // --- GET /api/local/status ---
    if (path === '/api/local/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'Local',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // --- GET /api/local/feed ---
    if (path === '/api/local/feed') {
      const params = new URLSearchParams(url.search);
      const lat = parseFloat(params.get('lat')) || 55.7558; // Moscow default
      const lon = parseFloat(params.get('lon')) || 37.6173;
      const radius = parseFloat(params.get('radius')) || 50;

      const bbox = bboxFor(lat, lon, radius);

      // Parallel fetch all feeds
      const [alerts, quakes, fires] = await Promise.all([
        fetchNWSAlerts(lat, lon),
        fetchQuakes(),
        fetchFires(bbox, process.env.FIRMS_MAP_KEY)
      ]);

      // Filter quakes by radius
      const nearbyQuakes = quakes.quakes?.filter(q => {
        return q.lat !== null && q.lon !== null &&
               haversineKm(lat, lon, q.lat, q.lon) <= radius;
      }) || [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        center: { lat, lon },
        radius: radius,
        alerts: {
          count: alerts.count || 0,
          items: alerts.alerts || []
        },
        quakes: {
          count: nearbyQuakes.length,
          items: nearbyQuakes.slice(0, 20)
        },
        fires: {
          count: fires.count || 0,
          items: fires.fires?.slice(0, 20) || []
        },
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Local API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

export default { handleLocalApi };
