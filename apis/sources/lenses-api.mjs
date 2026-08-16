#!/usr/bin/env node

// ============================================================
// LENSES-API.MJS — Тематические линзы (Модуль №20)
// ============================================================

const DEMO_LENSES = [
  { id: 'geopolitics', name: '🌍 Геополитика', description: 'Фокус на геополитических событиях и аналитике', modules: ['geo-map', 'global-index', 'early-warning'] },
  { id: 'economy', name: '📊 Экономика', description: 'Мониторинг финансовых рынков и экономических показателей', modules: ['market-predictor', 'correlation', 'basket'] },
  { id: 'security', name: '🛡️ Безопасность', description: 'Отслеживание угроз и критической инфраструктуры', modules: ['trust', 'infrastructure', 'scheduler'] },
  { id: 'tech', name: '💻 Технологии', description: 'Космос, ИИ, кибербезопасность', modules: ['ai-chat', 'ai-gateway', 'hidden-links'] }
];

// ============================================================
// 2. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleLensesAPI(req, res) {
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
    // GET /api/lenses/status
    // ============================================================
    if (path === '/api/lenses/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'lenses',
        status: 'online',
        lenses: DEMO_LENSES.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/lenses/list
    // ============================================================
    if (path === '/api/lenses/list' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, lenses: DEMO_LENSES }));
      return;
    }

    // ============================================================
    // GET /api/lenses/current
    // ============================================================
    if (path === '/api/lenses/current' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, current: DEMO_LENSES[0] }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Lenses API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleLensesAPI };
