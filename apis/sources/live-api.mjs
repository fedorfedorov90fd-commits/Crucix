#!/usr/bin/env node

// ============================================================
// LIVE-API.MJS — Лента живых новостных потоков (Модуль №19)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'live');
const FAVORITES_FILE = join(DATA_DIR, 'favorites.json');

// Демо-новости
const DEMO_NEWS = [
  { id: 'live-001', title: 'Иран нанёс ракетные удары по военным объектам Израиля', category: 'geopolitics', region: 'Ближний Восток', importance: 'critical', sentiment: -0.85, source: 'Reuters', time: '5 мин назад' },
  { id: 'live-002', title: 'США ввели новые санкции против Ирана', category: 'geopolitics', region: 'США', importance: 'high', sentiment: -0.65, source: 'AP', time: '15 мин назад' },
  { id: 'live-003', title: 'ЕС одобрил новый пакет помощи Украине на 50 млрд евро', category: 'politics', region: 'Европа', importance: 'high', sentiment: 0.45, source: 'Euronews', time: '32 мин назад' },
  { id: 'live-004', title: 'Нефть Brent превысила $110 за баррель', category: 'economy', region: 'Мир', importance: 'high', sentiment: -0.55, source: 'Bloomberg', time: '47 мин назад' },
  { id: 'live-005', title: 'Золото обновило исторический максимум — $2150 за унцию', category: 'economy', region: 'Мир', importance: 'medium', sentiment: 0.35, source: 'CNBC', time: '1 час назад' },
  { id: 'live-006', title: 'Байден подписал закон о бюджете на 2026 год', category: 'politics', region: 'США', importance: 'medium', sentiment: 0.25, source: 'NYT', time: '1.5 часа назад' },
  { id: 'live-007', title: 'Китай запустил новый спутник для мониторинга океана', category: 'technology', region: 'Китай', importance: 'low', sentiment: 0.65, source: 'Xinhua', time: '2 часа назад' },
  { id: 'live-008', title: 'Россия заявила о готовности к переговорам по Украине', category: 'diplomacy', region: 'Россия', importance: 'high', sentiment: 0.15, source: 'TASS', time: '2.5 часа назад' },
  { id: 'live-009', title: 'Землетрясение магнитудой 6.2 в Индонезии', category: 'disaster', region: 'Азия', importance: 'high', sentiment: -0.75, source: 'USGS', time: '3 часа назад' },
  { id: 'live-010', title: 'Индия стала третьей экономикой мира', category: 'economy', region: 'Индия', importance: 'medium', sentiment: 0.75, source: 'Times of India', time: '4 часа назад' },
  { id: 'live-011', title: 'ФРС сохранила ключевую ставку на уровне 5.5%', category: 'economy', region: 'США', importance: 'critical', sentiment: -0.35, source: 'WSJ', time: '5 часов назад' },
  { id: 'live-012', title: 'Европа готовится к зиме без российского газа', category: 'energy', region: 'Европа', importance: 'high', sentiment: -0.45, source: 'BBC', time: '6 часов назад' }
];

// ============================================================
// 2. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleLiveAPI(req, res) {
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
    // GET /api/live/status — статус модуля
    // ============================================================
    if (path === '/api/live/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'live',
        status: 'online',
        newsCount: DEMO_NEWS.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/live/feed — лента новостей
    // ============================================================
    if (path === '/api/live/feed' && req.method === 'GET') {
      const region = url.searchParams.get('region');
      const category = url.searchParams.get('category');
      const importance = url.searchParams.get('importance');

      let news = [...DEMO_NEWS];

      if (region) {
        news = news.filter(n => n.region === region);
      }
      if (category) {
        news = news.filter(n => n.category === category);
      }
      if (importance) {
        news = news.filter(n => n.importance === importance);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, news }));
      return;
    }

    // ============================================================
    // GET /api/live/categories — список категорий
    // ============================================================
    if (path === '/api/live/categories' && req.method === 'GET') {
      const categories = [...new Set(DEMO_NEWS.map(n => n.category))];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, categories }));
      return;
    }

    // ============================================================
    // GET /api/live/regions — список регионов
    // ============================================================
    if (path === '/api/live/regions' && req.method === 'GET') {
      const regions = [...new Set(DEMO_NEWS.map(n => n.region))];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, regions }));
      return;
    }

    // ============================================================
    // POST /api/live/favorite — избранное
    // ============================================================
    if (path === '/api/live/favorite' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Добавлено в избранное' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // GET /api/live/stats — статистика
    // ============================================================
    if (path === '/api/live/stats' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        stats: {
          total: DEMO_NEWS.length,
          categories: [...new Set(DEMO_NEWS.map(n => n.category))].length,
          regions: [...new Set(DEMO_NEWS.map(n => n.region))].length
        }
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Live API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleLiveAPI };
