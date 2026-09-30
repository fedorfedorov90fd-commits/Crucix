// ============================================================
// EXTENSIONS INDEX — реестр всех расширений Crucix
// ============================================================

const EXTENSIONS = [
  {
    id: 'ais-tracker',
    name: 'AIS Tracker',
    description: 'Трекинг судов в реальном времени',
    path: '/api/ais-tracker/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'analytics',
    name: 'Analytics Engine',
    description: 'Аналитический движок на Python',
    path: '/api/analytics/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'daily-briefing',
    name: 'Daily Briefing',
    description: 'Ежедневный автоматический дайджест',
    path: '/api/daily-briefing/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'mcp-server',
    name: 'MCP Server',
    description: 'MCP-сервер для AI-агентов',
    path: '/api/mcp/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'rag',
    name: 'RAG Module',
    description: 'Retrieval-Augmented Generation — векторный поиск',
    path: '/api/rag/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'route-explorer',
    name: 'Route Explorer',
    description: 'Анализ маршрутов и узких мест',
    path: '/api/route-explorer/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'satellite-ext',
    name: 'Satellite Ext',
    description: 'Спутниковый мониторинг (STAC API)',
    path: '/api/satellite-ext/',
    status: 'active',
    version: '1.0.0'
  },
  {
    id: 'scenario-engine',
    name: 'Scenario Engine',
    description: 'Моделирование сценариев "Что-если"',
    path: '/api/scenario-engine/',
    status: 'active',
    version: '1.0.0'
  }
];

export async function handleExtensionsIndex(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/extensions/ — список всех расширений
  if (pathname === '/api/extensions/' || pathname === '/api/extensions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      count: EXTENSIONS.length,
      data: EXTENSIONS
    }));
    return true;
  }

  // GET /api/extensions/:id — детали расширения
  if (pathname.startsWith('/api/extensions/')) {
    const id = pathname.replace('/api/extensions/', '');
    const ext = EXTENSIONS.find(e => e.id === id);
    if (ext) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        data: ext
      }));
      return true;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Расширение "${id}" не найдено` }));
      return true;
    }
  }

  return false;
}

export default { handleExtensionsIndex };
