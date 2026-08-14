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

// Geo API (карта)
import { handleGeoAPI } from './apis/sources/geo-markers-api.mjs';

// News API (внутренний)
import { handleNewsAPI as handleNewsInternal } from './apis/sources/news-api.mjs';

// NewsAPI (внешний источник)
import { handleNewsAPI as handleNewsAPIExternal } from './apis/sources/newsapi.mjs';

// NewsAPI Basket Integration
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';

// AI API
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';
import { handleAIAnalyzerAPI } from './apis/sources/ai-news-analyzer.mjs';

// Basket API (корзина данных)
import { handleBasketAPI } from './apis/sources/basket-api.mjs';

// Storage API (хранение)
import { handleStorageAPI } from './apis/sources/storage-api.mjs';

// Global Index API (Модуль №5)
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';

// Historical Analysis API (Модуль №6)
import { handleHistoricalAnalysisAPI } from './apis/sources/historical-analysis-api.mjs';

// Correlation API (Модуль №7)
import { handleCorrelationAPI } from './apis/sources/correlation-api.mjs';

// Infrastructure API (Модуль №8)
import { handleInfrastructureAPI } from './apis/sources/infrastructure-api.mjs';

// OFAC API (санкционный мониторинг)
import { handleOFACApi } from './apis/sources/ofac.mjs';

// EIA API (энергетический мониторинг)
import { handleEIAAPI } from './apis/sources/eia.mjs';

// WHO API (здравоохранение)
import { handleWHOAPI } from './apis/sources/who.mjs';

// CISA-KEV API (киберугрозы)
import { handleCISAKEVAPI } from './apis/sources/cisa-kev.mjs';

// NOAA API (погода и океан)
import { handleNOAAAPI } from './apis/sources/noaa.mjs';

// Space API (космический мониторинг)
import { handleSpaceAPI } from './apis/sources/space.mjs';

// Comtrade API (торговая статистика ООН)
import { handleComtradeAPI } from './apis/sources/comtrade.mjs';

// EPA API (экологический мониторинг)
import { handleEPAAPI } from './apis/sources/epa.mjs';

// GSCPI API (цепи поставок)
import { handleGSCPIAPI } from './apis/sources/gscpi.mjs';

// TASS API (новости ТАСС)
import { handleTASSAPI } from './apis/sources/tass.mjs';

// OpenSanctions API (санкционные списки)
import { handleOpenSanctionsAPI } from './apis/sources/opensanctions.mjs';

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

  // 3. Если запрос на панель (jarvis.html)
  if (pathname === '/jarvis' || pathname === '/jarvis.html') {
    const jarvis = join(PUBLIC_DIR, 'jarvis.html');
    try {
      await fs.access(jarvis);
      return jarvis;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 4. Если запрос на RSS-ленту
  if (pathname === '/rss-feed' || pathname === '/rss-feed.html') {
    const rssFeed = join(PUBLIC_DIR, 'rss-feed.html');
    try {
      await fs.access(rssFeed);
      return rssFeed;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 5. Если запрос на RSS-дашборд
  if (pathname === '/rss-dashboard' || pathname === '/rss-dashboard.html') {
    const rssDashboard = join(PUBLIC_DIR, 'rss-dashboard.html');
    try {
      await fs.access(rssDashboard);
      return rssDashboard;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 6. Если запрос на AI-чат
  if (pathname === '/ai-chat' || pathname === '/ai-chat.html') {
    const aiChat = join(PUBLIC_DIR, 'ai-chat.html');
    try {
      await fs.access(aiChat);
      return aiChat;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 7. Если запрос на геополитическую карту
  if (pathname === '/geo-map' || pathname === '/geo-map.html') {
    const geoMap = join(PUBLIC_DIR, 'geo-map.html');
    try {
      await fs.access(geoMap);
      return geoMap;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 8. Если запрос на корзину
  if (pathname === '/basket' || pathname === '/basket.html') {
    const basket = join(PUBLIC_DIR, 'basket.html');
    try {
      await fs.access(basket);
      return basket;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 9. Если запрос на инструмент "Сетка"
  if (pathname === '/grid-tool' || pathname === '/grid-tool.html') {
    const gridTool = join(PUBLIC_DIR, 'grid-tool.html');
    try {
      await fs.access(gridTool);
      return gridTool;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 10. Если запрос на глобальный индекс (Модуль №5)
  if (pathname === '/global-index' || pathname === '/global-index.html') {
    const globalIndex = join(PUBLIC_DIR, 'global-index.html');
    try {
      await fs.access(globalIndex);
      return globalIndex;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 11. Если запрос на исторический анализ (Модуль №6)
  if (pathname === '/historical-analysis' || pathname === '/historical-analysis.html') {
    const historicalAnalysis = join(PUBLIC_DIR, 'historical-analysis.html');
    try {
      await fs.access(historicalAnalysis);
      return historicalAnalysis;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 12. Если запрос на кросс-корреляцию (Модуль №7)
  if (pathname === '/correlation' || pathname === '/correlation.html') {
    const correlation = join(PUBLIC_DIR, 'correlation.html');
    try {
      await fs.access(correlation);
      return correlation;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 13. Если запрос на критическую инфраструктуру (Модуль №8)
  if (pathname === '/infrastructure' || pathname === '/infrastructure.html') {
    const infrastructure = join(PUBLIC_DIR, 'infrastructure.html');
    try {
      await fs.access(infrastructure);
      return infrastructure;
    } catch (e) {
      // Ищем дальше
    }
  }

  // 14. Если файл начинается с /css/ или /js/ — ищем в public
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
// 4. ОСНОВНЫЙ ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // ============================================================
  // 4.1. CORS
  // ============================================================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
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
  // 4.3. GEO API (геополитическая карта)
  // ============================================================
  if (pathname.startsWith('/api/geo/')) {
    await handleGeoAPI(req, res);
    return;
  }

  // ============================================================
  // 4.4. NEWS API (внутренний)
  // ============================================================
  if (pathname.startsWith('/api/news/')) {
    await handleNewsInternal(req, res);
    return;
  }

  // ============================================================
  // 4.5. NEWSAPI (внешний источник)
  // ============================================================
  if (pathname.startsWith('/api/newsapi/basket')) {
    await handleNewsAPIBasket(req, res);
    return;
  }
  if (pathname.startsWith('/api/newsapi/')) {
    await handleNewsAPIExternal(req, res);
    return;
  }

  // ============================================================
  // 4.6. AI API
  // ============================================================
  if (pathname.startsWith('/api/ai/chat')) {
    await handleAIChatAPI(req, res);
    return;
  }
  if (pathname.startsWith('/api/ai/rate')) {
    await handleAIRatingAPI(req, res);
    return;
  }
  if (pathname.startsWith('/api/ai/analyze')) {
    await handleAIAnalyzerAPI(req, res);
    return;
  }

  // ============================================================
  // 4.7. BASKET API (корзина данных)
  // ============================================================
  if (pathname.startsWith('/api/basket/')) {
    await handleBasketAPI(req, res);
    return;
  }

  // ============================================================
  // 4.8. STORAGE API (хранение)
  // ============================================================
  if (pathname.startsWith('/api/storage/')) {
    await handleStorageAPI(req, res);
    return;
  }

  // ============================================================
  // 4.9. GLOBAL INDEX API (Модуль №5)
  // ============================================================
  if (pathname.startsWith('/api/geo/index')) {
    await handleGlobalIndexAPI(req, res);
    return;
  }

  // ============================================================
  // 4.10. HISTORICAL ANALYSIS API (Модуль №6)
  // ============================================================
  if (pathname.startsWith('/api/analysis/')) {
    await handleHistoricalAnalysisAPI(req, res);
    return;
  }

  // ============================================================
  // 4.11. CORRELATION API (Модуль №7)
  // ============================================================
  if (pathname.startsWith('/api/correlation/')) {
    await handleCorrelationAPI(req, res);
    return;
  }

  // ============================================================
  // 4.12. INFRASTRUCTURE API (Модуль №8)
  // ============================================================
  if (pathname.startsWith('/api/infrastructure/')) {
    await handleInfrastructureAPI(req, res);
    return;
  }

  // ============================================================
  // 4.13. OFAC API (санкционный мониторинг)
  // ============================================================
  if (pathname.startsWith('/api/ofac/')) {
    await handleOFACApi(req, res);
    return;
  }

  // ============================================================
  // 4.14. EIA API (энергетический мониторинг)
  // ============================================================
  if (pathname.startsWith('/api/eia/')) {
    await handleEIAAPI(req, res);
    return;
  }

  // ============================================================
  // 4.15. WHO API (здравоохранение)
  // ============================================================
  if (pathname.startsWith('/api/who/')) {
    await handleWHOAPI(req, res);
    return;
  }

  // ============================================================
  // 4.16. CISA-KEV API (киберугрозы)
  // ============================================================
  if (pathname.startsWith('/api/cisa/')) {
    await handleCISAKEVAPI(req, res);
    return;
  }

  // ============================================================
  // 4.17. NOAA API (погода и океан)
  // ============================================================
  if (pathname.startsWith('/api/noaa/')) {
    await handleNOAAAPI(req, res);
    return;
  }

  // ============================================================
  // 4.18. Space API (космический мониторинг)
  // ============================================================
  if (pathname.startsWith('/api/space/')) {
    await handleSpaceAPI(req, res);
    return;
  }

  // ============================================================
  // 4.19. Comtrade API (торговая статистика ООН)
  // ============================================================
  if (pathname.startsWith('/api/comtrade/')) {
    await handleComtradeAPI(req, res);
    return;
  }

  // ============================================================
  // 4.20. EPA API (экологический мониторинг)
  // ============================================================
  if (pathname.startsWith('/api/epa/')) {
    await handleEPAAPI(req, res);
    return;
  }

  // ============================================================
  // 4.21. GSCPI API (цепи поставок)
  // ============================================================
  if (pathname.startsWith('/api/gscpi/')) {
    await handleGSCPIAPI(req, res);
    return;
  }

  // ============================================================
  // 4.22. TASS API (новости ТАСС)
  // ============================================================
  if (pathname.startsWith('/api/tass/')) {
    await handleTASSAPI(req, res);
    return;
  }

  // ============================================================
  // 4.23. OpenSanctions API (санкционные списки)
  // ============================================================
  if (pathname.startsWith('/api/opensanctions/')) {
    await handleOpenSanctionsAPI(req, res);
    return;
  }

  // ============================================================
  // 4.24. Статические файлы
  // ============================================================
  const filePath = await findStaticFile(pathname);

  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // ============================================================
  // 4.25. 404 — Страница не найдена
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
  console.log(`  - Интерфейс: http://localhost:${PORT}/jarvis`);
  console.log(`  - RSS-лента: http://localhost:${PORT}/rss-feed`);
  console.log(`  - RSS-дашборд: http://localhost:${PORT}/rss-dashboard`);
  console.log(`  - AI-чат: http://localhost:${PORT}/ai-chat`);
  console.log(`  - Геокарта: http://localhost:${PORT}/geo-map`);
  console.log(`  - Корзина: http://localhost:${PORT}/basket`);
  console.log(`  - Сетка: http://localhost:${PORT}/grid-tool`);
  console.log(`  - Глобальный индекс: http://localhost:${PORT}/global-index`);
  console.log(`  - Исторический анализ: http://localhost:${PORT}/historical-analysis`);
  console.log(`  - Кросс-корреляция: http://localhost:${PORT}/correlation`);
  console.log(`  - Инфраструктура: http://localhost:${PORT}/infrastructure`);
  console.log(`========================================`);
  console.log(`  API:`);
  console.log(`  - /api/rss/* — RSS`);
  console.log(`  - /api/geo/* — Геополитика`);
  console.log(`  - /api/news/* — Новости (внутренние)`);
  console.log(`  - /api/newsapi/* — NewsAPI (внешний)`);
  console.log(`  - /api/ai/* — AI`);
  console.log(`  - /api/basket/* — Корзина`);
  console.log(`  - /api/storage/* — Хранение`);
  console.log(`  - /api/geo/index — Глобальный индекс`);
  console.log(`  - /api/analysis/* — Исторический анализ`);
  console.log(`  - /api/correlation/* — Кросс-корреляция`);
  console.log(`  - /api/infrastructure/* — Инфраструктура`);
  console.log(`  - /api/ofac/* — Санкции (OFAC)`);
  console.log(`  - /api/eia/* — Энергетика (EIA)`);
  console.log(`  - /api/who/* — Здравоохранение (WHO)`);
  console.log(`  - /api/cisa/* — Киберугрозы (CISA-KEV)`);
  console.log(`  - /api/noaa/* — Погода и океан (NOAA)`);
  console.log(`  - /api/space/* — Космический мониторинг (Space)`);
  console.log(`  - /api/comtrade/* — Торговая статистика (Comtrade)`);
  console.log(`  - /api/epa/* — Экологический мониторинг (EPA)`);
  console.log(`  - /api/gscpi/* — Цепи поставок (GSCPI)`);
  console.log(`  - /api/tass/* — Новости ТАСС (TASS)`);
  console.log(`  - /api/opensanctions/* — Санкционные списки (OpenSanctions)`);
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
