// ============================================================
// SATELLITE — спутниковый мониторинг (STAC API)
// Интегрирован в Crucix как API-модуль
// ============================================================

// Данные по спутникам (заглушка — интеграция STAC API)
const SATELLITES = [
  { id: 'sentinel-2', name: 'Sentinel-2', provider: 'ESA', resolution: '10m', revisit: '5 дней' },
  { id: 'landsat-9', name: 'Landsat 9', provider: 'NASA', resolution: '15m', revisit: '16 дней' },
  { id: 'modis', name: 'MODIS', provider: 'NASA', resolution: '250m', revisit: '1 день' },
  { id: 'planet-scope', name: 'Planet Scope', provider: 'Planet', resolution: '3m', revisit: '1 день' },
  { id: 'sentinel-1', name: 'Sentinel-1', provider: 'ESA', resolution: '5m', revisit: '6 дней' },
  { id: 'viirs', name: 'VIIRS', provider: 'NASA', resolution: '375m', revisit: '1 день' }
];

export async function handleSatelliteExt(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/satellite-ext/list — список спутников
  if (pathname === '/api/satellite-ext/list' || pathname === '/api/satellite-ext/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      count: SATELLITES.length,
      data: SATELLITES
    }));
    return true;
  }

  // GET /api/satellite-ext/search — поиск снимков
  if (pathname === '/api/satellite-ext/search') {
    const lat = parseFloat(url.searchParams.get('lat')) || 0;
    const lon = parseFloat(url.searchParams.get('lon')) || 0;
    const radius = parseInt(url.searchParams.get('radius')) || 10;
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const satellite = url.searchParams.get('satellite') || 'all';

    // Имитация поиска снимков
    const images = [
      {
        id: `img_${Date.now()}_1`,
        satellite: 'sentinel-2',
        date: date,
        lat: lat,
        lon: lon,
        cloudCover: Math.floor(Math.random() * 40),
        url: `https://example.com/satellite/${Date.now()}_1.jpg`
      },
      {
        id: `img_${Date.now()}_2`,
        satellite: 'landsat-9',
        date: date,
        lat: lat + 0.1,
        lon: lon + 0.1,
        cloudCover: Math.floor(Math.random() * 30),
        url: `https://example.com/satellite/${Date.now()}_2.jpg`
      }
    ];

    const filtered = satellite === 'all' ? images : images.filter(i => i.satellite === satellite);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      query: { lat, lon, radius, date, satellite },
      count: filtered.length,
      data: filtered
    }));
    return true;
  }

  // GET /api/satellite-ext/coverage — зоны покрытия
  if (pathname === '/api/satellite-ext/coverage') {
    const coverage = {
      timestamp: new Date().toISOString(),
      zones: [
        { name: 'Северная Америка', satellites: ['sentinel-2', 'landsat-9', 'modis'] },
        { name: 'Европа', satellites: ['sentinel-2', 'sentinel-1'] },
        { name: 'Азия', satellites: ['sentinel-2', 'modis'] },
        { name: 'Африка', satellites: ['sentinel-2', 'modis'] },
        { name: 'Южная Америка', satellites: ['sentinel-2', 'landsat-9'] }
      ]
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(coverage));
    return true;
  }

  // GET /api/satellite-ext/status — статус модуля
  if (pathname === '/api/satellite-ext/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      module: 'satellite-ext',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      satellites: SATELLITES.length
    }));
    return true;
  }

  return false;
}

export default { handleSatelliteExt };
