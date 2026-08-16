#!/usr/bin/env node

// ============================================================
// SILENCE-API.MJS — Детектор информационной тишины (Модуль №18)
// ============================================================

const DEMO_REGIONS = [
  { id: 'middle-east', name: 'Ближний Восток', status: 'silence', drop: 87, baseline: 47, current: 6 },
  { id: 'ukraine', name: 'Украина', status: 'normal', drop: 12, baseline: 52, current: 46 },
  { id: 'russia', name: 'Россия', status: 'normal', drop: 8, baseline: 89, current: 82 },
  { id: 'usa', name: 'США', status: 'normal', drop: 5, baseline: 234, current: 222 },
  { id: 'europe', name: 'Европа', status: 'warning', drop: 45, baseline: 156, current: 86 },
  { id: 'africa', name: 'Африка', status: 'silence', drop: 72, baseline: 43, current: 12 },
  { id: 'asia', name: 'Азия', status: 'normal', drop: 15, baseline: 178, current: 151 }
];

// ============================================================
// 2. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleSilenceAPI(req, res) {
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
    // ============================================================
    // GET /api/silence/status
    // ============================================================
    if (path === '/api/silence/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'silence',
        status: 'online',
        regions: DEMO_REGIONS.length,
        alerts: DEMO_REGIONS.filter(r => r.status === 'silence' || r.status === 'warning').length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/silence/regions
    // ============================================================
    if (path === '/api/silence/regions' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, regions: DEMO_REGIONS }));
      return;
    }

    // ============================================================
    // GET /api/silence/alerts
    // ============================================================
    if (path === '/api/silence/alerts' && req.method === 'GET') {
      const alerts = DEMO_REGIONS.filter(r => r.status === 'silence' || r.status === 'warning');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, alerts }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Silence API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleSilenceAPI };
