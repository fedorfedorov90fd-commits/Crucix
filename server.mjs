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
// 1. ИМПОРТ API-МОДУЛЕЙ (ТОЛЬКО РАБОЧИЕ)
// ============================================================

// RSS API
import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';

// Геополитическая карта
import { handleGeoAPI } from './apis/sources/geo-markers-api.mjs';

// Корзина данных
import { handleBasketAPI } from './apis/sources/basket-api.mjs';

// AI Чат
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';

// AI Оценка новостей
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';

// Новости
import { handleNewsAPI } from './apis/sources/news-api.mjs';

// NewsAPI (внешний)
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';

// Хранилище
import { handleStorageAPI } from './apis/sources/storage-api.mjs';

// Глобальный индекс (Модуль №5)
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';

// Исторический анализ (Модуль №6)
import { handleHistoricalAnalysisAPI } from './apis/sources/historical-analysis-api.mjs';

// Кросс-корреляция (Модуль №7)
import { handleCorrelationAPI } from './apis/sources/correlation-api.mjs';

// Критическая инфраструктура (Модуль №8)
import { handleInfrastructureAPI } from './apis/sources/infrastructure-api.mjs';

// USGS (землетрясения) — Модуль №20
import { handleUSGSApi } from './apis/sources/usgs.mjs';

// LOCAL (локальный сбор) — Модуль №21
import { handleLocalApi } from './apis/sources/local.mjs';

// Планировщик задач — Модуль №24
import { handleSchedulerAPI } from './apis/sources/scheduler-api.mjs';

// Доверие к источникам — Модуль №25
import { handleTrustAPI } from './apis/sources/trust-api.mjs';

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
  // 1. Прямой путь в public
  const direct = join(PUBLIC_DIR, pathname);
  try {
    await fs.access(direct);
    return direct;
  } catch (e) {
    // Ищем дальше
  }

  // 2. Если запрос на корень — index.html
  if (pathname === '/' || pathname === '') {
    const index = join(PUBLIC_DIR, 'index.html');
    try {
      await fs.access(index);
      return index;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 3. jarvis.html (оригинальный авторский интерфейс)
  if (pathname === '/jarvis' || pathname === '/jarvis.html') {
    const jarvis = join(PUBLIC_DIR, 'jarvis.html');
    try {
      await fs.access(jarvis);
      return jarvis;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 4. jarviskart.html (новая страница с карточками модулей)
  if (pathname === '/jarviskart' || pathname === '/jarviskart.html') {
    const jarviskart = join(PUBLIC_DIR, 'jarviskart.html');
    try {
      await fs.access(jarviskart);
      return jarviskart;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 5. rss-feed.html
  if (pathname === '/rss-feed' || pathname === '/rss-feed.html') {
    const rssFeed = join(PUBLIC_DIR, 'rss-feed.html');
    try {
      await fs.access(rssFeed);
      return rssFeed;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 6. rss-dashboard.html
  if (pathname === '/rss-dashboard' || pathname === '/rss-dashboard.html') {
    const rssDash = join(PUBLIC_DIR, 'rss-dashboard.html');
    try {
      await fs.access(rssDash);
      return rssDash;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 7. ai-chat.html
  if (pathname === '/ai-chat' || pathname === '/ai-chat.html') {
    const aiChat = join(PUBLIC_DIR, 'ai-chat.html');
    try {
      await fs.access(aiChat);
      return aiChat;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 8. geo-map.html
  if (pathname === '/geo-map' || pathname === '/geo-map.html') {
    const geoMap = join(PUBLIC_DIR, 'geo-map.html');
    try {
      await fs.access(geoMap);
      return geoMap;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 9. basket.html
  if (pathname === '/basket' || pathname === '/basket.html') {
    const basket = join(PUBLIC_DIR, 'basket.html');
    try {
      await fs.access(basket);
      return basket;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 10. grid-tool.html
  if (pathname === '/grid-tool' || pathname === '/grid-tool.html') {
    const gridTool = join(PUBLIC_DIR, 'grid-tool.html');
    try {
      await fs.access(gridTool);
      return gridTool;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 11. global-index.html
  if (pathname === '/global-index' || pathname === '/global-index.html') {
    const globalIndex = join(PUBLIC_DIR, 'global-index.html');
    try {
      await fs.access(globalIndex);
      return globalIndex;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 12. historical-analysis.html
  if (pathname === '/historical-analysis' || pathname === '/historical-analysis.html') {
    const histAnalysis = join(PUBLIC_DIR, 'historical-analysis.html');
    try {
      await fs.access(histAnalysis);
      return histAnalysis;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 13. correlation.html
  if (pathname === '/correlation' || pathname === '/correlation.html') {
    const correlation = join(PUBLIC_DIR, 'correlation.html');
    try {
      await fs.access(correlation);
      return correlation;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 14. infrastructure.html
  if (pathname === '/infrastructure' || pathname === '/infrastructure.html') {
    const infra = join(PUBLIC_DIR, 'infrastructure.html');
    try {
      await fs.access(infra);
      return infra;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 15. usgs.html
  if (pathname === '/usgs' || pathname === '/usgs.html') {
    const usgs = join(PUBLIC_DIR, 'usgs.html');
    try {
      await fs.access(usgs);
      return usgs;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 16. local.html
  if (pathname === '/local' || pathname === '/local.html') {
    const local = join(PUBLIC_DIR, 'local.html');
    try {
      await fs.access(local);
      return local;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 17. scheduler.html
  if (pathname === '/scheduler' || pathname === '/scheduler.html') {
    const scheduler = join(PUBLIC_DIR, 'scheduler.html');
    try {
      await fs.access(scheduler);
      return scheduler;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 18. trust.html
  if (pathname === '/trust' || pathname === '/trust.html') {
    const trust = join(PUBLIC_DIR, 'trust.html');
    try {
      await fs.access(trust);
      return trust;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 19. /css/ /js/ /images/
  if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
    const file = join(PUBLIC_DIR, pathname);
    try {
      await fs.access(file);
      return file;
    } catch (e) {
      // Ищем дальше
    }
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
  // 4.1. RSS API
  // ============================================================
  if (pathname.startsWith('/api/rss/')) {
    await handleRSSAPI(req, res);
    return;
  }

  // ============================================================
  // 4.2. Геополитическая карта
  // ============================================================
  if (pathname.startsWith('/api/geo/')) {
    await handleGeoAPI(req, res);
    return;
  }

  // ============================================================
  // 4.3. Корзина данных
  // ============================================================
  if (pathname.startsWith('/api/basket/')) {
    await handleBasketAPI(req, res);
    return;
  }

  // ============================================================
  // 4.4. AI Чат
  // ============================================================
  if (pathname.startsWith('/api/ai/chat')) {
    await handleAIChatAPI(req, res);
    return;
  }

  // ============================================================
  // 4.5. AI Оценка новостей
  // ============================================================
  if (pathname.startsWith('/api/ai/rate')) {
    await handleAIRatingAPI(req, res);
    return;
  }

  // ============================================================
  // 4.6. Новости
  // ============================================================
  if (pathname.startsWith('/api/news/')) {
    await handleNewsAPI(req, res);
    return;
  }

  // ============================================================
  // 4.7. NewsAPI (внешний)
  // ============================================================
  if (pathname.startsWith('/api/newsapi/')) {
    await handleNewsAPIBasket(req, res);
    return;
  }

  // ============================================================
  // 4.8. Хранилище
  // ============================================================
  if (pathname.startsWith('/api/storage/')) {
    await handleStorageAPI(req, res);
    return;
  }

  // ============================================================
  // 4.9. Глобальный индекс (Модуль №5)
  // ============================================================
  if (pathname.startsWith('/api/geo/index')) {
    await handleGlobalIndexAPI(req, res);
    return;
  }

  // ============================================================
  // 4.10. Исторический анализ (Модуль №6)
  // ============================================================
  if (pathname.startsWith('/api/analysis/')) {
    await handleHistoricalAnalysisAPI(req, res);
    return;
  }

  // ============================================================
  // 4.11. Кросс-корреляция (Модуль №7)
  // ============================================================
  if (pathname.startsWith('/api/correlation/')) {
    await handleCorrelationAPI(req, res);
    return;
  }

  // ============================================================
  // 4.12. Критическая инфраструктура (Модуль №8)
  // ============================================================
  if (pathname.startsWith('/api/infrastructure/')) {
    await handleInfrastructureAPI(req, res);
    return;
  }

  // ============================================================
  // 4.13. USGS (землетрясения) — Модуль №20
  // ============================================================
  if (pathname.startsWith('/api/usgs/')) {
    await handleUSGSApi(req, res);
    return;
  }

  // ============================================================
  // 4.14. LOCAL (локальный сбор) — Модуль №21
  // ============================================================
  if (pathname.startsWith('/api/local/')) {
    await handleLocalApi(req, res);
    return;
  }

  // ============================================================
  // 4.15. Планировщик задач — Модуль №24
  // ============================================================
  if (pathname.startsWith('/api/scheduler/')) {
    await handleSchedulerAPI(req, res);
    return;
  }

  // ============================================================
  // 4.16. Доверие к источникам — Модуль №25
  // ============================================================
  if (pathname.startsWith('/api/trust/')) {
    await handleTrustAPI(req, res);
    return;
  }

  // ============================================================
  // 4.17. Другие API (заглушка)
  // ============================================================
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'API не найден' }));
    return;
  }

  // ============================================================
  // 4.18. Статические файлы
  // ============================================================
  const filePath = await findStaticFile(pathname);

  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // ============================================================
  // 4.19. 404
  // ============================================================
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
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
    </html>
  `);
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
  console.log(`  - Оригинальный интерфейс: http://localhost:${PORT}/jarvis`);
  console.log(`  - Карточки модулей: http://localhost:${PORT}/jarviskart ⭐ НОВАЯ`);
  console.log(`  - RSS-лента: http://localhost:${PORT}/rss-feed`);
  console.log(`  - RSS-управление: http://localhost:${PORT}/rss-dashboard`);
  console.log(`  - AI Чат: http://localhost:${PORT}/ai-chat`);
  console.log(`  - Гео-карта: http://localhost:${PORT}/geo-map`);
  console.log(`  - Корзина: http://localhost:${PORT}/basket`);
  console.log(`  - Глобальный индекс: http://localhost:${PORT}/global-index`);
  console.log(`  - Исторический анализ: http://localhost:${PORT}/historical-analysis`);
  console.log(`  - Кросс-корреляция: http://localhost:${PORT}/correlation`);
  console.log(`  - Инфраструктура: http://localhost:${PORT}/infrastructure`);
  console.log(`  - USGS (землетрясения): http://localhost:${PORT}/usgs`);
  console.log(`  - LOCAL (локальный): http://localhost:${PORT}/local`);
  console.log(`  - Планировщик задач: http://localhost:${PORT}/scheduler`);
  console.log(`  - Доверие к источникам: http://localhost:${PORT}/trust`);
  console.log(`========================================`);
  console.log(`  API префиксы:`);
  console.log(`  - /api/rss/*          — управление RSS`);
  console.log(`  - /api/geo/*          — геополитика`);
  console.log(`  - /api/basket/*       — корзина данных`);
  console.log(`  - /api/ai/*           — AI (чат, оценка)`);
  console.log(`  - /api/news/*         — новости`);
  console.log(`  - /api/newsapi/*      — NewsAPI (внешний)`);
  console.log(`  - /api/storage/*      — хранение`);
  console.log(`  - /api/analysis/*     — исторический анализ`);
  console.log(`  - /api/correlation/*  — кросс-корреляция`);
  console.log(`  - /api/infrastructure/* — инфраструктура`);
  console.log(`  - /api/usgs/*         — землетрясения (USGS)`);
  console.log(`  - /api/local/*        — локальный сбор`);
  console.log(`  - /api/scheduler/*    — планировщик задач (Модуль №24)`);
  console.log(`  - /api/trust/*        — доверие к источникам (Модуль №25)`);
  console.log(`========================================`);
  console.log(`  🎉 ВСЕ 25 МОДУЛЕЙ ГОТОВЫ!`);
  console.log(`  🌟 Crucix полностью завершён!`);
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

// ============================================================
// 7. ЭКСПОРТ
// ============================================================

export default server;
