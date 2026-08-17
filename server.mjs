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
import { handleBasketAPI } from './apis/sources/basket-api.mjs';
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';
import { handleNewsAPI } from './apis/sources/news-api.mjs';
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';
import { handleNewsAPIProxy } from './apis/sources/newsapi.mjs';
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
import { handleAIProcessorAPI } from './apis/sources/ai-processor.mjs';
import { handleConflictPredictorAPI } from './apis/sources/conflict-predictor.mjs';
import { handleAnomalyDetectorAPI } from './apis/sources/anomaly-detector.mjs';
import { handleScenarioGeneratorAPI } from './apis/sources/scenario-generator.mjs';
import { handleEarlyWarningAPI } from './apis/sources/early-warning.mjs';
import { handleMarketPredictorAPI } from './apis/sources/market-predictor.mjs';
import { handleSemanticAPI } from './apis/sources/semantic-analysis.mjs';
import { handleReportsAPI } from './apis/sources/automated-reports.mjs';
import { handleStrategicIntelAPI } from './apis/sources/strategic-intel.mjs';
import { handleCyberIntelAPI } from './apis/sources/cyber-intel.mjs';
import { handleAviationAPI } from './apis/sources/aviation-monitor.mjs';
import { handleMaritimeAPI } from './apis/sources/maritime-monitor.mjs';
import { handleDarkShipsAPI } from './apis/sources/dark-ships.mjs';
import { handleSatelliteInternetAPI } from './apis/sources/satellite-internet.mjs';
import { handleEnergyAPI } from './apis/sources/energy-monitor.mjs';
import { handleTradeAPI } from './apis/sources/trade-monitor.mjs';
import { handleEnvironmentAPI } from './apis/sources/environment-monitor.mjs';
import { handleHealthAPI } from './apis/sources/health-monitor.mjs';
import { handleWeatherAPI } from './apis/sources/weather-monitor.mjs';
import { handleSpaceMonitorAPI } from './apis/sources/space-monitor.mjs';
import { handleNewsAggregatorAPI } from './apis/sources/news-aggregator.mjs';
import { handleSupplyChainAPI } from './apis/sources/supply-chain-monitor.mjs';
import { handleMonitorAPI } from './apis/sources/monitor-api.mjs';
import { handleExportAPI } from './apis/sources/export-api.mjs';
import { handleHelpAPI } from './apis/sources/help-api.mjs';
import { handleStrategicAPI } from './apis/sources/strategic-layer.mjs';
import { handlePredictionAPI } from './apis/sources/prediction-intel.mjs';
import { handleMASAAPI } from './apis/sources/masa.mjs';
import { handleP2PAPI } from './apis/sources/p2p.mjs';
import { handlePredictiveAPI } from './apis/sources/predictive.mjs';
import { handleDecisionAPI } from './apis/sources/decision.mjs';

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
// 3. ОБРАБОТЧИК СТАТИЧЕСКИХ ФАЙЛОВ
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
    '/conflict-predictor': 'conflict-predictor.html',
    '/anomaly-detector': 'anomaly-detector.html',
    '/scenario-generator': 'scenario-generator.html',
    '/semantic-analysis': 'semantic-analysis.html',
    '/automated-reports': 'automated-reports.html',
    '/strategic-intel': 'strategic-intel.html',
    '/cyber-intel': 'cyber-intel.html',
    '/aviation-monitor': 'aviation-monitor.html',
    '/maritime-monitor': 'maritime-monitor.html',
    '/dark-ships': 'dark-ships.html',
    '/satellite-internet': 'satellite-internet.html',
    '/energy-monitor': 'energy-monitor.html',
    '/trade-monitor': 'trade-monitor.html',
    '/environment-monitor': 'environment-monitor.html',
    '/health-monitor': 'health-monitor.html',
    '/weather-monitor': 'weather-monitor.html',
    '/space-monitor': 'space-monitor.html',
    '/news-aggregator': 'news-aggregator.html',
    '/supply-chain-monitor': 'supply-chain-monitor.html',
    '/monitor': 'monitor.html',
    '/export': 'export.html',
    '/help': 'help.html',
    '/strategic-layer': 'strategic-layer.html',
    '/prediction-intel': 'prediction-intel.html',
    '/masa': 'masa.html',
    '/p2p': 'p2p.html',
    '/predictive': 'predictive.html',
    '/decision': 'decision.html'
  };

  const cleanPath = pathname.replace('.html', '');
  const file = pages[cleanPath] || pages[pathname];
  if (file) {
    const fullPath = join(PUBLIC_DIR, file);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
    const fullPath = join(PUBLIC_DIR, pathname);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  return null;
}

// ============================================================
// 4. ОСНОВНОЙ ОБРАБОТЧИК ЗАПРОСОВ
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

  // ============================================================
  // API маршруты
  // ============================================================

  if (pathname.startsWith('/api/rss/')) { await handleRSSAPI(req, res); return; }
  if (pathname.startsWith('/api/geo/')) { await handleGeoAPI(req, res); return; }
  if (pathname.startsWith('/api/basket')) { await handleBasketAPI(req, res); return; }
  if (pathname.startsWith('/api/ai/chat')) { await handleAIChatAPI(req, res); return; }
  if (pathname.startsWith('/api/ai/rate')) { await handleAIRatingAPI(req, res); return; }
  if (pathname.startsWith('/api/news/')) { await handleNewsAPI(req, res); return; }
  if (pathname.startsWith('/api/newsapi/basket')) { await handleNewsAPIBasket(req, res); return; }
  if (pathname.startsWith('/api/newsapi/')) { await handleNewsAPIProxy(req, res); return; }
  if (pathname.startsWith('/api/storage/')) { await handleStorageAPI(req, res); return; }
  if (pathname.startsWith('/api/geo/index')) { await handleGlobalIndexAPI(req, res); return; }
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
  if (pathname.startsWith('/api/ai-processor/')) { await handleAIProcessorAPI(req, res); return; }
  if (pathname.startsWith('/api/conflict/')) { await handleConflictPredictorAPI(req, res); return; }
  if (pathname.startsWith('/api/anomaly-detector/')) { await handleAnomalyDetectorAPI(req, res); return; }
  if (pathname.startsWith('/api/scenario-generator/')) { await handleScenarioGeneratorAPI(req, res); return; }
  if (pathname.startsWith('/api/early-warning/')) { await handleEarlyWarningAPI(req, res); return; }
  if (pathname.startsWith('/api/market/')) { await handleMarketPredictorAPI(req, res); return; }
  if (pathname.startsWith('/api/semantic/')) { await handleSemanticAPI(req, res); return; }
  if (pathname.startsWith('/api/reports/')) { await handleReportsAPI(req, res); return; }
  if (pathname.startsWith('/api/strategic-intel/')) { await handleStrategicIntelAPI(req, res); return; }
  if (pathname.startsWith('/api/cyber-intel/')) { await handleCyberIntelAPI(req, res); return; }
  if (pathname.startsWith('/api/aviation/')) { await handleAviationAPI(req, res); return; }
  if (pathname.startsWith('/api/maritime/')) { await handleMaritimeAPI(req, res); return; }
  if (pathname.startsWith('/api/dark-ships/')) { await handleDarkShipsAPI(req, res); return; }
  if (pathname.startsWith('/api/satellite-internet/')) { await handleSatelliteInternetAPI(req, res); return; }
  if (pathname.startsWith('/api/energy/')) { await handleEnergyAPI(req, res); return; }
  if (pathname.startsWith('/api/trade/')) { await handleTradeAPI(req, res); return; }
  if (pathname.startsWith('/api/environment/')) { await handleEnvironmentAPI(req, res); return; }
  if (pathname.startsWith('/api/health/')) { await handleHealthAPI(req, res); return; }
  if (pathname.startsWith('/api/weather/')) { await handleWeatherAPI(req, res); return; }
  if (pathname.startsWith('/api/space-monitor/')) { await handleSpaceMonitorAPI(req, res); return; }
  if (pathname.startsWith('/api/news-aggregator/')) { await handleNewsAggregatorAPI(req, res); return; }
  if (pathname.startsWith('/api/supply-chain/')) { await handleSupplyChainAPI(req, res); return; }
  if (pathname.startsWith('/api/monitor/')) { await handleMonitorAPI(req, res); return; }
  if (pathname.startsWith('/api/export/')) { await handleExportAPI(req, res); return; }
  if (pathname.startsWith('/api/help/')) { await handleHelpAPI(req, res); return; }
  if (pathname.startsWith('/api/strategic/')) { await handleStrategicAPI(req, res); return; }
  if (pathname.startsWith('/api/prediction/')) { await handlePredictionAPI(req, res); return; }
  if (pathname.startsWith('/api/masa/')) { await handleMASAAPI(req, res); return; }
  if (pathname.startsWith('/api/p2p/')) { await handleP2PAPI(req, res); return; }
  if (pathname.startsWith('/api/predictive/')) { await handlePredictiveAPI(req, res); return; }
  if (pathname.startsWith('/api/decision/')) { await handleDecisionAPI(req, res); return; }

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

server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  🚀 Crucix Server запущен`);
  console.log(`  📡 Порт: ${PORT}`);
  console.log(`  🌐 URL: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`  📋 СТРАНИЦ (49):`);
  console.log(`  /  Главная`);
  console.log(`  /jarvis  Интерфейс`);
  console.log(`  /rss-feed  RSS лента`);
  console.log(`  /ai-chat  AI чат`);
  console.log(`  /geo-map  Карта`);
  console.log(`  /basket  Корзина`);
  console.log(`  /grid-tool  Сетка`);
  console.log(`  /global-index  Индекс`);
  console.log(`  /historical-analysis  Анализ`);
  console.log(`  /correlation  Корреляция`);
  console.log(`  /infrastructure  Инфраструктура`);
  console.log(`  /usgs  Землетрясения`);
  console.log(`  /local  Локальный`);
  console.log(`  /scheduler  Планировщик`);
  console.log(`  /trust  Доверие`);
  console.log(`  /diagnostics  Диагностика`);
  console.log(`  /ai-gateway  AI Gateway`);
  console.log(`  /hidden-links  Скрытые связи ⭐`);
  console.log(`  /market-predictor  Рыночный прогноз ⭐`);
  console.log(`  /early-warning  Раннее предупреждение ⭐`);
  console.log(`  /conflict-predictor  Прогнозирование конфликтов ⭐`);
  console.log(`  /anomaly-detector  Детектор аномалий ⭐`);
  console.log(`  /scenario-generator  Генератор сценариев ⭐`);
  console.log(`  /semantic-analysis  Семантический анализ ⭐`);
  console.log(`  /automated-reports  Автоматические отчёты ⭐`);
  console.log(`  /strategic-intel  Стратегическая разведка ⭐`);
  console.log(`  /cyber-intel  Киберинтеллект ⭐`);
  console.log(`  /aviation-monitor  Мониторинг авиации ⭐`);
  console.log(`  /maritime-monitor  Морской мониторинг ⭐`);
  console.log(`  /dark-ships  Тёмные суда ⭐`);
  console.log(`  /satellite-internet  Спутниковый интернет ⭐`);
  console.log(`  /energy-monitor  Мониторинг энергетики ⭐`);
  console.log(`  /trade-monitor  Мониторинг торговли ⭐`);
  console.log(`  /environment-monitor  Мониторинг экологии ⭐`);
  console.log(`  /health-monitor  Мониторинг здравоохранения ⭐`);
  console.log(`  /weather-monitor  Мониторинг погоды ⭐`);
  console.log(`  /space-monitor  Мониторинг космоса ⭐`);
  console.log(`  /news-aggregator  Новостной агрегатор ⭐`);
  console.log(`  /supply-chain-monitor  Цепи поставок ⭐`);
  console.log(`  /monitor  Центр мониторинга ⭐`);
  console.log(`  /export  Экспорт данных ⭐`);
  console.log(`  /help  Справка ⭐`);
  console.log(`  /strategic-layer  Стратегический слой ⭐`);
  console.log(`  /prediction-intel  Прогнозный интеллект ⭐`);
  console.log(`  /masa  Мульти-агентный анализ ⭐`);
  console.log(`  /p2p  P2P-обмен данными ⭐`);
  console.log(`  /predictive  Прогнозная модель ⭐`);
  console.log(`  /decision  ДАШБОРД РЕШЕНИЙ ⭐ НОВЫЙ!`);
  console.log(`========================================`);
  console.log(`  🧠 AI-процессор: BASIC`);
  console.log(`  🌟 Модулей: 59/59 (100%) ✅`);
  console.log(`========================================`);
});

process.on('SIGINT', () => { console.log('\n🛑 Сервер остановлен'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 Сервер остановлен'); process.exit(0); });

export default server;
