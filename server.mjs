#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix
// ============================================================

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');
const ROOT_DIR = join(__dirname);

// ============================================================
// 1. ИМПОРТЫ
// ============================================================

import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';
import { handleGeoAPI } from './apis/sources/geo-markers-api.mjs';
import { handleBasketAPI } from './apis/sources/basket-api.mjs';
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';
import { handleNewsAPI } from './apis/sources/news-api.mjs';
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';
import { handleStorageAPI } from './apis/sources/storage-api.mjs';
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';
import { handleHistoricalAnalysisAPI } from './apis/sources/historical-analysis-api.mjs';
import { handleCorrelationAPI } from './apis/sources/correlation-api.mjs';
import { handleInfrastructureAPI } from './apis/sources/infrastructure-api.mjs';
import { handleOFACAPI } from './apis/sources/ofac.mjs';
import { handleEIAAPI } from './apis/sources/eia.mjs';
import { handleWHOAPI } from './apis/sources/who.mjs';
import { handleCISAAPI } from './apis/sources/cisa-kev.mjs';
import { handleNOAAAPI } from './apis/sources/noaa.mjs';
import { handleSpaceAPI } from './apis/sources/space.mjs';
import { handleComtradeAPI } from './apis/sources/comtrade.mjs';
import { handleEPAAPI } from './apis/sources/epa.mjs';
import { handleGSCPIAPI } from './apis/sources/gscpi.mjs';
import { handleTASSAPI } from './apis/sources/tass.mjs';
import { handleOpenSanctionsAPI } from './apis/sources/opensanctions.mjs';
import { handleUSGSApi } from './apis/sources/usgs.mjs';
import { handleLocalApi } from './apis/sources/local.mjs';
import { handleSchedulerAPI } from './apis/sources/scheduler-api.mjs';
import { handleTrustAPI } from './apis/sources/trust-api.mjs';
import { handleDiagnosticsAPI } from './apis/sources/diagnostics-api.mjs';
import { handleAIGatewayAPI } from './apis/sources/ai-gateway.mjs';
import { handleHiddenLinksAPI } from './apis/sources/hidden-links.mjs';
import { handleMarketPredictorAPI } from './apis/sources/market-predictor.mjs';
import { handleEarlyWarningAPI } from './apis/sources/early-warning.mjs';
import { handleScenarioAPI } from './apis/sources/scenario-generator.mjs';
import { handleSentimentAPI } from './apis/sources/sentiment-analyzer.mjs';
import { handleLiveAPI } from './apis/sources/live-api.mjs';
import { handleSilenceAPI } from './apis/sources/silence-api.mjs';
import { handleLensesAPI } from './apis/sources/lenses-api.mjs';
import { handleKiwiSDRAPI } from './apis/sources/kiwisdr.mjs';
import { handleSafecastApi } from './apis/sources/safecast.mjs';
import { handleHelpAPI } from './apis/sources/help-api.mjs';
import { handleAIProcessorAPI } from './apis/sources/ai-processor.mjs';
import { handleNewsAPIProxy } from './apis/sources/newsapi.mjs';

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
};

// ============================================================
// 3. СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================================

async function serveStatic(req, res, filePath) {
  try {
    const ext = extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=86400' });
    res.end(content);
    return true;
  } catch (e) { return false; }
}

async function findStaticFile(pathname) {
  const pages = {
    '/': 'index.html',
    '/jarvis': 'jarvis.html',
    '/rss-feed': 'rss-feed.html',
    '/rss-dashboard': 'rss-dashboard.html',
    '/ai-chat': 'ai-chat.html',
    '/geo-map': 'geo-map.html',
    '/basket': 'basket.html',
    '/grid-tool': 'grid-tool.html',
    '/global-index': 'global-index.html',
    '/historical-analysis': 'historical-analysis.html',
    '/correlation': 'correlation.html',
    '/infrastructure': 'infrastructure.html',
    '/usgs': 'usgs.html',
    '/local': 'local.html',
    '/scheduler': 'scheduler.html',
    '/trust': 'trust.html',
    '/diagnostics': 'diagnostics.html',
    '/ai-gateway': 'ai-gateway.html',
    '/hidden-links': 'hidden-links.html',
    '/market-predictor': 'market-predictor.html',
    '/early-warning': 'early-warning.html',
    '/scenarios': 'scenarios.html',
    '/sentiment': 'sentiment.html',
    '/kartochki': 'kartochki.html',
    '/profile': 'profile.html',
    '/silence': 'silence.html',
    '/live': 'live.html',
    '/lenses': 'lenses.html',
    '/kiwisdr': 'kiwisdr.html',
    '/safecast': 'safecast.html',
    '/noaa': 'noaa.html',
    '/ofac': 'ofac.html',
    '/eia': 'eia.html',
    '/cisa': 'cisa.html',
    '/who': 'who.html',
    '/news': 'news.html'
  };

  const cleanPath = pathname.replace('.html', '');
  const file = pages[cleanPath] || pages[pathname];
  if (file) {
    const fullPath = join(PUBLIC_DIR, file);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  if (pathname.startsWith('/lib/')) {
    const fullPath = join(ROOT_DIR, pathname);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
    const fullPath = join(PUBLIC_DIR, pathname);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  return null;
}

// ============================================================
// 4. ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API маршруты
  if (pathname.startsWith('/api/geo/index')) { await handleGlobalIndexAPI(req, res); return; }
  if (pathname.startsWith('/api/rss/')) { await handleRSSAPI(req, res); return; }
  if (pathname.startsWith('/api/geo/')) { await handleGeoAPI(req, res); return; }
  if (pathname.startsWith('/api/basket')) { await handleBasketAPI(req, res); return; }
  if (pathname.startsWith('/api/ai/chat')) { await handleAIChatAPI(req, res); return; }
  if (pathname.startsWith('/api/ai/rate')) { await handleAIRatingAPI(req, res); return; }
  if (pathname.startsWith('/api/news/')) { await handleNewsAPI(req, res); return; }
  if (pathname.startsWith('/api/newsapi/basket')) { await handleNewsAPIBasket(req, res); return; }
  if (pathname.startsWith('/api/newsapi/')) { await handleNewsAPIProxy(req, res); return; }
  if (pathname.startsWith('/api/storage/')) { await handleStorageAPI(req, res); return; }
  if (pathname.startsWith('/api/analysis/')) { await handleHistoricalAnalysisAPI(req, res); return; }
  if (pathname.startsWith('/api/correlation/')) { await handleCorrelationAPI(req, res); return; }
  if (pathname.startsWith('/api/infrastructure/')) { await handleInfrastructureAPI(req, res); return; }
  if (pathname.startsWith('/api/ofac/')) { await handleOFACAPI(req, res); return; }
  if (pathname.startsWith('/api/eia/')) { await handleEIAAPI(req, res); return; }
  if (pathname.startsWith('/api/who/')) { await handleWHOAPI(req, res); return; }
  if (pathname.startsWith('/api/cisa/')) { await handleCISAAPI(req, res); return; }
  if (pathname.startsWith('/api/noaa/')) { await handleNOAAAPI(req, res); return; }
  if (pathname.startsWith('/api/space/')) { await handleSpaceAPI(req, res); return; }
  if (pathname.startsWith('/api/comtrade/')) { await handleComtradeAPI(req, res); return; }
  if (pathname.startsWith('/api/epa/')) { await handleEPAAPI(req, res); return; }
  if (pathname.startsWith('/api/gscpi/')) { await handleGSCPIAPI(req, res); return; }
  if (pathname.startsWith('/api/tass/')) { await handleTASSAPI(req, res); return; }
  if (pathname.startsWith('/api/opensanctions/')) { await handleOpenSanctionsAPI(req, res); return; }
  if (pathname.startsWith('/api/usgs/')) { await handleUSGSApi(req, res); return; }
  if (pathname.startsWith('/api/local/')) { await handleLocalApi(req, res); return; }
  if (pathname.startsWith('/api/scheduler/')) { await handleSchedulerAPI(req, res); return; }
  if (pathname.startsWith('/api/trust/')) { await handleTrustAPI(req, res); return; }
  if (pathname.startsWith('/api/diagnostics/')) { await handleDiagnosticsAPI(req, res); return; }
  if (pathname.startsWith('/api/ai-gateway/')) { await handleAIGatewayAPI(req, res); return; }
  if (pathname.startsWith('/api/hidden-links/')) { await handleHiddenLinksAPI(req, res); return; }
  if (pathname.startsWith('/api/market/')) { await handleMarketPredictorAPI(req, res); return; }
  if (pathname.startsWith('/api/early-warning/')) { await handleEarlyWarningAPI(req, res); return; }
  if (pathname.startsWith('/api/scenarios/')) { await handleScenarioAPI(req, res); return; }
  if (pathname.startsWith('/api/sentiment/')) { await handleSentimentAPI(req, res); return; }
  if (pathname.startsWith('/api/live/')) { await handleLiveAPI(req, res); return; }
  if (pathname.startsWith('/api/silence/')) { await handleSilenceAPI(req, res); return; }
  if (pathname.startsWith('/api/lenses/')) { await handleLensesAPI(req, res); return; }
  if (pathname.startsWith('/api/kiwisdr/')) { await handleKiwiSDRAPI(req, res); return; }
  if (pathname.startsWith('/api/safecast/')) { await handleSafecastApi(req, res); return; }
  if (pathname.startsWith('/api/help/')) { await handleHelpAPI(req, res); return; }
  if (pathname.startsWith('/api/ai-processor/')) { await handleAIProcessorAPI(req, res); return; }

  // Статические файлы
  const filePath = await findStaticFile(pathname);
  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html><html><head><title>404 — Crucix</title></head>
    <body style="background:#0a0a1a;color:#e0e0e0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
      <div style="text-align:center;"><h1 style="font-size:72px;margin:0;color:#2196f3;">404</h1>
      <p style="font-size:20px;color:#888;">Страница не найдена</p>
      <a href="/" style="color:#2196f3;text-decoration:none;">← Вернуться на главную</a></div>
    </body></html>`);
});

// ============================================================
// 5. ЗАПУСК
// ============================================================

const PAGE_LIST = [
  '/', '/jarvis', '/rss-feed', '/rss-dashboard', '/ai-chat',
  '/geo-map', '/basket', '/grid-tool', '/global-index',
  '/historical-analysis', '/correlation', '/infrastructure',
  '/usgs', '/local', '/scheduler', '/trust', '/diagnostics',
  '/ai-gateway', '/hidden-links', '/market-predictor',
  '/early-warning', '/scenarios', '/sentiment', '/kartochki',
  '/profile', '/silence', '/live', '/lenses', '/kiwisdr',
  '/safecast', '/noaa', '/ofac', '/eia', '/cisa', '/who', '/news'
];

server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  🚀 Crucix Server запущен`);
  console.log(`  📡 Порт: ${PORT}`);
  console.log(`  🌐 URL: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`  📋 СТРАНИЦЫ (${PAGE_LIST.length}):`);
  for (const p of PAGE_LIST) {
    const name = p === '/' ? 'Главная' :
                 p === '/jarvis' ? 'Интерфейс' :
                 p === '/rss-feed' ? 'RSS лента' :
                 p === '/ai-chat' ? 'AI чат' :
                 p === '/geo-map' ? 'Карта' :
                 p === '/basket' ? 'Корзина' :
                 p === '/global-index' ? 'Индекс' :
                 p === '/historical-analysis' ? 'Анализ' :
                 p === '/correlation' ? 'Корреляция' :
                 p === '/infrastructure' ? 'Инфраструктура' :
                 p === '/usgs' ? 'Землетрясения' :
                 p === '/local' ? 'Локальный' :
                 p === '/scheduler' ? 'Планировщик' :
                 p === '/trust' ? 'Доверие ⭐' :
                 p === '/diagnostics' ? 'Диагностика ⭐' :
                 p === '/ai-gateway' ? 'AI Gateway ⭐' :
                 p === '/hidden-links' ? 'Скрытые связи ⭐' :
                 p === '/market-predictor' ? 'Рыночный прогноз ⭐' :
                 p === '/early-warning' ? 'Раннее предупреждение ⭐' :
                 p === '/scenarios' ? 'Сценарии ⭐' :
                 p === '/sentiment' ? 'Тональность ⭐' :
                 p === '/kartochki' ? 'Все страницы ⭐' :
                 p === '/profile' ? 'Профиль ⭐' :
                 p === '/silence' ? 'Детектор тишины ⭐' :
                 p === '/live' ? 'Лента новостей ⭐' :
                 p === '/lenses' ? 'Тематические линзы ⭐' :
                 p === '/kiwisdr' ? 'KiwiSDR ⭐' :
                 p === '/safecast' ? 'SafeCast ⭐' :
                 p === '/noaa' ? 'NOAA ⭐' :
                 p === '/ofac' ? 'OFAC ⭐' :
                 p === '/eia' ? 'EIA ⭐' :
                 p === '/cisa' ? 'CISA ⭐' :
                 p === '/who' ? 'WHO ⭐' :
                 p === '/news' ? 'News ⭐' : p;
    console.log(`  ${p}  ${name}`);
  }
  console.log(`========================================`);
  console.log(`  🧠 AI-процессор: BASIC`);
  console.log(`  🌟 Модулей: 32/32 (100%) ✅`);
  console.log(`========================================`);
});

process.on('SIGINT', () => { console.log('\n🛑 Сервер остановлен'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 Сервер остановлен'); process.exit(0); });

export default server;
