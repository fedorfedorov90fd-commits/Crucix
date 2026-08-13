#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix
// ============================================================
// HTTP-сервер на порту 3117
// Раздаёт статику из dashboard/public/
// Обрабатывает API-запросы
// ============================================================

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');

// ============================================================
// 1. ИМПОРТ API-МОДУЛЕЙ
// ============================================================

// RSS API
import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';

// Basket API (корзина данных)
import { handleBasketAPI } from './apis/sources/basket-api.mjs';

// News API
import { handleNewsAPI } from './apis/sources/news-api.mjs';

// AI Rating API
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';

// AI Chat API
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';

// Storage API
import { handleStorageAPI } from './apis/sources/storage-api.mjs';

// Geo Markers API
import { handleGeoMarkersAPI } from './apis/sources/geo-markers-api.mjs';

// NewsAPI (альтернатива GDELT)
import { handleNewsAPI as handleNewsAPIAlt } from './apis/sources/newsapi.mjs';

// NewsAPI Basket (сбор и добавление в корзину)
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';

// AI Analyzer (анализ новостей в корзине)
import { handleAIAnalyzer } from './apis/sources/ai-news-analyzer.mjs';

// Global Index API (НОВОЕ!)
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';

// ============================================================
// 2. MIME-ТИПЫ
// ============================================================

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.opml': 'application/xml',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// ============================================================
// 3. ОБРАБОТЧИК СТАТИЧЕСКИХ ФАЙЛОВ
// ============================================================

async function serveStatic(req, res, filePath) {
  try {
    const ext = extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(content);
    return true;
  } catch (e) {
    return false;
  }
}

async function findStaticFile(pathname) {
  // Прямой путь в public
  const direct = join(PUBLIC_DIR, pathname);
  try {
    await fs.access(direct);
    return direct;
  } catch (e) {}

  // Если запрос на корень — index.html
  if (pathname === '/' || pathname === '') {
    const index = join(PUBLIC_DIR, 'index.html');
    try {
      await fs.access(index);
      return index;
    } catch (e) {}
  }

  // Специальные страницы
  const pages = ['jarvis', 'rss-feed', 'rss-dashboard', 'ai-chat', 'geo-map', 'basket', 'grid-tool', 'global-index'];
  for (const page of pages) {
    if (pathname === `/${page}` || pathname === `/${page}.html`) {
      const file = join(PUBLIC_DIR, `${page}.html`);
      try {
        await fs.access(file);
        return file;
      } catch (e) {}
    }
  }

  // Файлы в подпапках
  if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
    const file = join(PUBLIC_DIR, pathname);
    try {
      await fs.access(file);
      return file;
    } catch (e) {}
  }

  return null;
}

// ============================================================
// 4. ОСНОВНОЙ ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ============================================================
  // 4.1. Global Index API (НОВОЕ! — должно быть ПЕРВЫМ, чтобы не перехватывалось /api/geo/markers)
  // ============================================================
  if (pathname.startsWith('/api/geo/index')) {
    await handleGlobalIndexAPI(req, res);
    return;
  }

  // ============================================================
  // 4.2. RSS API
  // ============================================================
  if (pathname.startsWith('/api/rss/')) {
    await handleRSSAPI(req, res);
    return;
  }

  // ============================================================
  // 4.3. Basket API (корзина данных)
  // ============================================================
  if (pathname.startsWith('/api/basket')) {
    await handleBasketAPI(req, res);
    return;
  }

  // ============================================================
  // 4.4. News API
  // ============================================================
  if (pathname.startsWith('/api/news/')) {
    await handleNewsAPI(req, res);
    return;
  }

  // ============================================================
  // 4.5. AI Rating API
  // ============================================================
  if (pathname.startsWith('/api/ai/rate')) {
    await handleAIRatingAPI(req, res);
    return;
  }

  // ============================================================
  // 4.6. AI Chat API
  // ============================================================
  if (pathname.startsWith('/api/ai/chat')) {
    await handleAIChatAPI(req, res);
    return;
  }

  // ============================================================
  // 4.7. Storage API
  // ============================================================
  if (pathname.startsWith('/api/storage/')) {
    await handleStorageAPI(req, res);
    return;
  }

  // ============================================================
  // 4.8. Geo Markers API (все остальные /api/geo/*)
  // ============================================================
  if (pathname.startsWith('/api/geo/')) {
    await handleGeoMarkersAPI(req, res);
    return;
  }

  // ============================================================
  // 4.9. NewsAPI Basket (сбор и добавление в корзину)
  // ============================================================
  if (pathname.startsWith('/api/newsapi/basket')) {
    await handleNewsAPIBasket(req, res);
    return;
  }

  // ============================================================
  // 4.10. NewsAPI (альтернатива GDELT)
  // ============================================================
  if (pathname.startsWith('/api/newsapi/')) {
    await handleNewsAPIAlt(req, res);
    return;
  }

  // ============================================================
  // 4.11. AI Analyzer (анализ новостей в корзине)
  // ============================================================
  if (pathname.startsWith('/api/ai/analyze/')) {
    await handleAIAnalyzer(req, res);
    return;
  }

  // ============================================================
  // 4.12. Другие API
  // ============================================================
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'API не найден' }));
    return;
  }

  // ============================================================
  // 4.13. Статические файлы
  // ============================================================
  const filePath = await findStaticFile(pathname);
  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // ============================================================
  // 4.14. 404
  // ============================================================
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html>
<html>
<head><title>404 — Crucix</title></head>
<body style="background:#0a0a1a;color:#e0e0e0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h1 style="font-size:72px;margin:0;color:#2196f3;">404</h1>
    <p style="font-size:20px;color:#888;">Страница не найдена</p>
    <p style="color:#555;margin-top:20px;">
      <a href="/" style="color:#2196f3;text-decoration:none;">← Вернуться на главную</a>
    </p>
  </div>
</body>
</html>`);
});

// ============================================================
// 5. ЗАПУСК СЕРВЕРА
// ============================================================

server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  🚀 Crucix Server запущен`);
  console.log(`  📡 Порт: ${PORT}`);
  console.log(`  🌐 URL: http://localhost:${PORT}`);
  console.log(`  📁 Public: ${PUBLIC_DIR}`);
  console.log(`========================================`);
  console.log(`  Доступные страницы:`);
  console.log(`  - Главная: http://localhost:${PORT}/`);
  console.log(`  - Интерфейс: http://localhost:${PORT}/jarvis`);
  console.log(`  - RSS-лента: http://localhost:${PORT}/rss-feed`);
  console.log(`  - RSS управление: http://localhost:${PORT}/rss-dashboard`);
  console.log(`  - AI Чат: http://localhost:${PORT}/ai-chat`);
  console.log(`  - Геокарта: http://localhost:${PORT}/geo-map`);
  console.log(`  - Корзина: http://localhost:${PORT}/basket`);
  console.log(`  - Сетка: http://localhost:${PORT}/grid-tool`);
  console.log(`  - Глобальный индекс: http://localhost:${PORT}/global-index (НОВОЕ!)`);
  console.log(`========================================`);
  console.log(`  API:`);
  console.log(`  - /api/rss/*   — управление RSS`);
  console.log(`  - /api/news/*  — новости`);
  console.log(`  - /api/basket   — корзина данных`);
  console.log(`  - /api/ai/rate — AI оценка новостей`);
  console.log(`  - /api/ai/chat — AI чат помощник`);
  console.log(`  - /api/ai/analyze — AI анализ новостей в корзине`);
  console.log(`  - /api/storage/* — управление хранением`);
  console.log(`  - /api/geo/*   — геополитические маркеры`);
  console.log(`  - /api/geo/index — ГЛОБАЛЬНЫЙ ИНДЕКС (НОВОЕ!)`);
  console.log(`  - /api/geo/index/history — ИСТОРИЯ ИНДЕКСА (НОВОЕ!)`);
  console.log(`  - /api/newsapi/basket — сбор NewsAPI в корзину`);
  console.log(`  - /api/newsapi/* — NewsAPI (альтернатива GDELT)`);
  console.log(`========================================`);
});

// ============================================================
// 6. ОБРАБОТКА ЗАВЕРШЕНИЯ
// ============================================================

process.on('SIGINT', () => {
  console.log('\n🛑 Сервер остановлен');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Сервер остановлен (SIGTERM)');
  process.exit(0);
});

export default server;