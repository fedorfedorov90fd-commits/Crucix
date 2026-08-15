#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix
// ============================================================
// HTTP-сервер на порту 3117
// ============================================================

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');

// ============================================================
// 1. ИМПОРТ API-МОДУЛЕЙ
// ============================================================

import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';
import { handleGeoAPI } from './apis/sources/geo-markers-api.mjs';
import { handleNewsAPI as handleNewsInternal } from './apis/sources/news-api.mjs';
import { handleNewsAPIProxy as handleNewsAPIExternal } from './apis/sources/newsapi.mjs';
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';
import { handleAIAnalyzerAPI } from './apis/sources/ai-news-analyzer.mjs';
import { handleBasketAPI } from './apis/sources/basket-api.mjs';
import { handleStorageAPI } from './apis/sources/storage-api.mjs';
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';
import { handleHistoricalAnalysisAPI } from './apis/sources/historical-analysis-api.mjs';
import { handleCorrelationAPI } from './apis/sources/correlation-api.mjs';
import { handleInfrastructureAPI } from './apis/sources/infrastructure-api.mjs';
import { handleOFACApi } from './apis/sources/ofac.mjs';
import { handleEIAAPI } from './apis/sources/eia.mjs';
import { handleWHOAPI } from './apis/sources/who.mjs';
import { handleCISAKEVAPI } from './apis/sources/cisa-kev.mjs';
import { handleNOAAAPI } from './apis/sources/noaa.mjs';
import { handleSpaceAPI } from './apis/sources/space.mjs';
import { handleComtradeAPI } from './apis/sources/comtrade.mjs';
import { handleEPAAPI } from './apis/sources/epa.mjs';
import { handleGSCPIAPI } from './apis/sources/gscpi.mjs';
import { handleTASSAPI } from './apis/sources/tass.mjs';
import { handleOpenSanctionsAPI } from './apis/sources/opensanctions.mjs';
import { handleUSGSApi } from './apis/sources/usgs.mjs';
import { handleLocalApi } from './apis/sources/local.mjs';

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

  // 3. Специальные страницы (полный список)
  const pages = [
    'jarvis',
    'rss-feed',
    'rss-dashboard',
    'ai-chat',
    'geo-map',
    'basket',
    'grid-tool',
    'global-index',
    'historical-analysis',
    'correlation',
    'infrastructure',
    'usgs',
    'local'
  ];

  for (const page of pages) {
    if (pathname === `/${page}` || pathname === `/${page}.html`) {
      const file = join(PUBLIC_DIR, `${page}.html`);
      try {
        await fs.access(file);
        return file;
      } catch (e) {
        // Ищем дальше
      }
    }
  }

  // 4. Файлы в подпапках
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
  // 4.2. API МАРШРУТЫ
  // ============================================================

  // RSS
  if (pathname.startsWith('/api/rss/')) {
    await handleRSSAPI(req, res);
    return;
  }

  // Геополитика
  if (pathname.startsWith('/api/geo/')) {
    await handleGeoAPI(req, res);
    return;
  }

  // Новости (внутренние)
  if (pathname.startsWith('/api/news/')) {
    await handleNewsInternal(req, res);
    return;
  }

  // NewsAPI Basket
  if (pathname.startsWith('/api/newsapi/basket')) {
    await handleNewsAPIBasket(req, res);
    return;
  }

  // NewsAPI (внешний)
  if (pathname.startsWith('/api/newsapi/')) {
    await handleNewsAPIExternal(req, res);
    return;
  }

  // AI
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

  // Корзина
  if (pathname.startsWith('/api/basket/')) {
    await handleBasketAPI(req, res);
    return;
  }

  // Хранение
  if (pathname.startsWith('/api/storage/')) {
    await handleStorageAPI(req, res);
    return;
  }

  // Глобальный индекс (Модуль №5)
  if (pathname.startsWith('/api/geo/index')) {
    await handleGlobalIndexAPI(req, res);
    return;
  }

  // Исторический анализ (Модуль №6)
  if (pathname.startsWith('/api/analysis/')) {
    await handleHistoricalAnalysisAPI(req, res);
    return;
  }

  // Кросс-корреляция (Модуль №7)
  if (pathname.startsWith('/api/correlation/')) {
    await handleCorrelationAPI(req, res);
    return;
  }

  // Инфраструктура (Модуль №8)
  if (pathname.startsWith('/api/infrastructure/')) {
    await handleInfrastructureAPI(req, res);
    return;
  }

  // OFAC (санкции)
  if (pathname.startsWith('/api/ofac/')) {
    await handleOFACApi(req, res);
    return;
  }

  // EIA (энергетика)
  if (pathname.startsWith('/api/eia/')) {
    await handleEIAAPI(req, res);
    return;
  }

  // WHO (здравоохранение)
  if (pathname.startsWith('/api/who/')) {
    await handleWHOAPI(req, res);
    return;
  }

  // CISA-KEV (киберугрозы)
  if (pathname.startsWith('/api/cisa/')) {
    await handleCISAKEVAPI(req, res);
    return;
  }

  // NOAA (погода)
  if (pathname.startsWith('/api/noaa/')) {
    await handleNOAAAPI(req, res);
    return;
  }

  // Space (космос)
  if (pathname.startsWith('/api/space/')) {
    await handleSpaceAPI(req, res);
    return;
  }

  // Comtrade (торговля)
  if (pathname.startsWith('/api/comtrade/')) {
    await handleComtradeAPI(req, res);
    return;
  }

  // EPA (экология)
  if (pathname.startsWith('/api/epa/')) {
    await handleEPAAPI(req, res);
    return;
  }

  // GSCPI (цепи поставок)
  if (pathname.startsWith('/api/gscpi/')) {
    await handleGSCPIAPI(req, res);
    return;
  }

  // TASS (новости)
  if (pathname.startsWith('/api/tass/')) {
    await handleTASSAPI(req, res);
    return;
  }

  // OpenSanctions
  if (pathname.startsWith('/api/opensanctions/')) {
    await handleOpenSanctionsAPI(req, res);
    return;
  }

  // USGS (землетрясения) — НОВЫЙ!
  if (pathname.startsWith('/api/usgs/')) {
    await handleUSGSApi(req, res);
    return;
  }

  // LOCAL (локальный сбор) — НОВЫЙ!
  if (pathname.startsWith('/api/local/')) {
    await handleLocalApi(req, res);
    return;
  }

  // ============================================================
  // 4.3. СТАТИЧЕСКИЕ ФАЙЛЫ
  // ============================================================

  const filePath = await findStaticFile(pathname);
  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // ============================================================
  // 4.4. 404
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
  console.log(`  - USGS (землетрясения): http://localhost:${PORT}/usgs (НОВЫЙ!)`);
  console.log(`  - LOCAL (локальный мониторинг): http://localhost:${PORT}/local (НОВЫЙ!)`);
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
  console.log(`  - /api/usgs/* — Землетрясения (USGS) (НОВЫЙ!)`);
  console.log(`  - /api/local/* — Локальный сбор данных (НОВЫЙ!)`);
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
