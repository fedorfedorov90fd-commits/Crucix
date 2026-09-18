// ============================================================
// ROUTE EXPLORER — анализ маршрутов и узких мест
// Интегрирован в Crucix как API-модуль
// ============================================================

// Данные по узким местам (chokepoints)
const CHOKEPOINTS = {
  'hormuz_strait': {
    name: 'Ормузский пролив',
    lat: 26.5, lng: 56.0,
    risk: 'high',
    traffic: 'high',
    countries: ['IR', 'AE', 'SA', 'OM'],
    incidents: 3
  },
  'suez': {
    name: 'Суэцкий канал',
    lat: 30.0, lng: 32.5,
    risk: 'medium',
    traffic: 'very_high',
    countries: ['EG'],
    incidents: 1
  },
  'malacca_strait': {
    name: 'Малаккский пролив',
    lat: 2.0, lng: 102.0,
    risk: 'medium',
    traffic: 'very_high',
    countries: ['MY', 'ID', 'SG'],
    incidents: 2
  },
  'bab_el_mandeb': {
    name: 'Баб-эль-Мандеб',
    lat: 13.0, lng: 43.5,
    risk: 'high',
    traffic: 'medium',
    countries: ['YE', 'DJ', 'ER'],
    incidents: 4
  },
  'panama_canal': {
    name: 'Панамский канал',
    lat: 9.0, lng: -79.5,
    risk: 'low',
    traffic: 'medium',
    countries: ['PA'],
    incidents: 0
  }
};

// Альтернативные маршруты
const ROUTES = {
  'hormuz_strait': {
    name: 'Ормузский пролив',
    alternatives: [
      { name: 'Вокруг Африки', distance_extra: '30%', time_extra: '10 дней', cost_extra: '20%' },
      { name: 'Через Суэцкий канал', distance_extra: '15%', time_extra: '5 дней', cost_extra: '10%' }
    ]
  },
  'suez': {
    name: 'Суэцкий канал',
    alternatives: [
      { name: 'Вокруг Африки', distance_extra: '40%', time_extra: '14 дней', cost_extra: '25%' }
    ]
  },
  'bab_el_mandeb': {
    name: 'Баб-эль-Мандеб',
    alternatives: [
      { name: 'Вокруг Африки', distance_extra: '50%', time_extra: '18 дней', cost_extra: '30%' }
    ]
  }
};

export async function handleRouteExplorer(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/route-explorer/chokepoints — список узких мест
  if (pathname === '/api/route-explorer/chokepoints' || pathname === '/api/route-explorer/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      count: Object.keys(CHOKEPOINTS).length,
      data: CHOKEPOINTS
    }));
    return true;
  }

  // GET /api/route-explorer/alternatives/:id — альтернативы для узкого места
  if (pathname.startsWith('/api/route-explorer/alternatives/')) {
    const id = pathname.replace('/api/route-explorer/alternatives/', '');
    const route = ROUTES[id];
    if (route) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        id: id,
        data: route
      }));
      return true;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Маршрут "${id}" не найден` }));
      return true;
    }
  }

  // GET /api/route-explorer/risk — анализ рисков по регионам
  if (pathname === '/api/route-explorer/risk') {
    const riskData = {
      timestamp: new Date().toISOString(),
      regions: [
        { name: 'Ормузский пролив', risk: 'high', score: 82 },
        { name: 'Баб-эль-Мандеб', risk: 'high', score: 78 },
        { name: 'Суэцкий канал', risk: 'medium', score: 55 },
        { name: 'Малаккский пролив', risk: 'medium', score: 48 },
        { name: 'Панамский канал', risk: 'low', score: 22 }
      ],
      global_risk_score: 57,
      alert: 'HIGH_ALERT'
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(riskData));
    return true;
  }

  // POST /api/route-explorer/route — построение маршрута
  if (pathname === '/api/route-explorer/route' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { from, to, avoid } = data;

        // Простейшая логика построения маршрута
        const route = {
          from: from || 'unknown',
          to: to || 'unknown',
          avoid: avoid || [],
          distance: 1234,
          time: 48,
          chokepoints: ['hormuz_strait', 'suez'],
          risk_score: 65,
          recommendation: 'Рассмотрите альтернативный маршрут через мыс Доброй Надежды'
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', route }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Неверный JSON' }));
      }
    });
    return true;
  }

  // GET /api/route-explorer/status — статус модуля
  if (pathname === '/api/route-explorer/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      module: 'route-explorer',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      chokepoints: Object.keys(CHOKEPOINTS).length
    }));
    return true;
  }

  return false;
}

export default { handleRouteExplorer };
