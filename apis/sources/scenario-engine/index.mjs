// ============================================================
// SCENARIO ENGINE — движок моделирования сценариев "Что-если"
// Интегрирован в Crucix как API-модуль
// ============================================================

// Предустановленные сценарии
const SCENARIOS = [
  {
    id: 'conflict',
    name: 'Конфликт',
    description: 'Эскалация военного конфликта в регионе',
    impact: {
      economy: 'high',
      military: 'critical',
      humanitarian: 'high',
      energy: 'medium'
    },
    affectedCountries: ['UA', 'RU', 'PL', 'DE', 'TR'],
    probability: 0.4,
    severity: 'high'
  },
  {
    id: 'sanctions',
    name: 'Санкции',
    description: 'Введение экономических санкций против страны',
    impact: {
      economy: 'critical',
      trade: 'high',
      energy: 'medium',
      humanitarian: 'low'
    },
    affectedCountries: ['RU', 'IR', 'CN'],
    probability: 0.6,
    severity: 'medium'
  },
  {
    id: 'energy_crisis',
    name: 'Энергетический кризис',
    description: 'Резкий рост цен на энергоносители',
    impact: {
      economy: 'critical',
      energy: 'critical',
      trade: 'high',
      humanitarian: 'medium'
    },
    affectedCountries: ['EU', 'US', 'CN', 'IN'],
    probability: 0.3,
    severity: 'high'
  },
  {
    id: 'climate_disaster',
    name: 'Климатическая катастрофа',
    description: 'Масштабное природное бедствие',
    impact: {
      humanitarian: 'critical',
      economy: 'high',
      environment: 'critical'
    },
    affectedCountries: ['US', 'CN', 'IN', 'BR'],
    probability: 0.2,
    severity: 'medium'
  }
];

export async function handleScenarioEngine(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/scenario-engine/list — список сценариев
  if (pathname === '/api/scenario-engine/list' || pathname === '/api/scenario-engine/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      count: SCENARIOS.length,
      data: SCENARIOS
    }));
    return true;
  }

  // GET /api/scenario-engine/run/:id — запуск сценария
  if (pathname.startsWith('/api/scenario-engine/run/')) {
    const id = pathname.replace('/api/scenario-engine/run/', '');
    const scenario = SCENARIOS.find(s => s.id === id);

    if (scenario) {
      // Имитация выполнения сценария
      const result = {
        id: scenario.id,
        name: scenario.name,
        status: 'running',
        progress: Math.floor(Math.random() * 100),
        timestamp: new Date().toISOString(),
        prediction: {
          success: Math.random() > 0.3,
          impact_score: Math.floor(Math.random() * 100),
          time_frame: '3-6 месяцев'
        },
        affectedCountries: scenario.affectedCountries,
        impact: scenario.impact
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Сценарий "${id}" не найден` }));
      return true;
    }
  }

  // POST /api/scenario-engine/create — создание сценария
  if (pathname === '/api/scenario-engine/create' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const newScenario = {
          id: `custom_${Date.now()}`,
          name: data.name || 'Пользовательский сценарий',
          description: data.description || '',
          impact: data.impact || {},
          affectedCountries: data.affectedCountries || [],
          probability: data.probability || 0.5,
          severity: data.severity || 'medium',
          created: new Date().toISOString()
        };
        SCENARIOS.push(newScenario);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', data: newScenario }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Неверный JSON' }));
      }
    });
    return true;
  }

  // GET /api/scenario-engine/status — статус модуля
  if (pathname === '/api/scenario-engine/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      module: 'scenario-engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      scenarios: SCENARIOS.length
    }));
    return true;
  }

  return false;
}

export default { handleScenarioEngine };
