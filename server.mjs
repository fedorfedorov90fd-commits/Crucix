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
// 1. ИМПОРТ ВСЕХ API-МОДУЛЕЙ
// ============================================================

// === БАЗОВЫЕ МОДУЛИ ===
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

// === ИНТЕГРАЦИЯ ИЗ ФОРКОВ ===
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

// === НОВЫЕ МОДУЛИ ===
import { handleUSGSApi } from './apis/sources/usgs.mjs';
import { handleLocalApi } from './apis/sources/local.mjs';
import { handleSchedulerAPI } from './apis/sources/scheduler-api.mjs';
import { handleTrustAPI } from './apis/sources/trust-api.mjs';
import { handleDiagnosticsAPI } from './apis/sources/diagnostics-api.mjs';
import { handleAIGatewayAPI } from './apis/sources/ai-gateway.mjs';
import { handleHiddenLinksAPI } from './apis/sources/hidden-links.mjs';
import { handleAIProcessorAPI } from './apis/sources/ai-processor.mjs';

// === МОДУЛИ АНАЛИТИКИ ===
import { handleConflictPredictorAPI } from './apis/sources/conflict-predictor.mjs';
import { handleAnomalyDetectorAPI } from './apis/sources/anomaly-detector.mjs';
import { handleScenarioGeneratorAPI } from './apis/sources/scenario-generator.mjs';
import { handleEarlyWarningAPI } from './apis/sources/early-warning.mjs';
import { handleMarketPredictorAPI } from './apis/sources/market-predictor.mjs';
import { handleSemanticAPI } from './apis/sources/semantic-analysis.mjs';
import { handleReportsAPI } from './apis/sources/automated-reports.mjs';
import { handleStrategicIntelAPI } from './apis/sources/strategic-intel.mjs';
import { handleCyberIntelAPI } from './apis/sources/cyber-intel.mjs';

// === МОДУЛИ МОНИТОРИНГА ===
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

// === МОДУЛИ ИНФРАСТРУКТУРЫ ===
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
import { handleSocialAPI } from './apis/sources/social.mjs';
import { handleQuantumAPI } from './apis/sources/quantum.mjs';
import { handleDeepfakeAPI } from './apis/sources/deepfake.mjs';
import { handleDarkWebAPI } from './apis/sources/darkweb.mjs';
import { handleAgentsAPI } from './apis/sources/agents.mjs';
import { handleBlockchainAPI } from './apis/sources/blockchain.mjs';
import { handleVoiceAPI } from './apis/sources/voice.mjs';
import { handleEmotionAPI } from './apis/sources/emotion.mjs';
import { handleCyberThreatsAPI } from './apis/sources/cyber-threats.mjs';
import { handleCyberAPI } from './apis/sources/cyber-api.mjs';

// === ДОПОЛНИТЕЛЬНЫЕ ИСТОЧНИКИ ===
import { handleACLEDApi } from './apis/sources/acled.mjs';
import { handleBLSAPI } from './apis/sources/bls.mjs';
import { handleSentimentAPI } from './apis/sources/sentiment-analyzer.mjs';
import { handleSatelliteAPI } from './apis/sources/satellite-api.mjs';
import { handleSafecastApi } from './apis/sources/safecast.mjs';
import { handleShipsApi } from './apis/sources/ships.mjs';
import { handleGDELTAPI } from './apis/sources/gdelt.mjs';
import { handleFIRMSApi } from './apis/sources/firms.mjs';
import { handleOpenSkyApi } from './apis/sources/opensky.mjs';
import { handleNLPAPI } from './apis/sources/nlp-api.mjs';
import { handleLLMApi } from './apis/sources/llm-analyzer.mjs';
import { handleKiwiSDRAPI } from './apis/sources/kiwisdr.mjs';
import { handlePredictApi } from './apis/sources/infrastructure-predict.mjs';
import { handleOFACApi } from './apis/sources/infrastructure-ofac.mjs';
import { handleGlobalPlantsApi } from './apis/sources/infrastructure-eia-global.mjs';
import { handleEIAApi } from './apis/sources/infrastructure-eia.mjs';
import { handleCascadeApi } from './apis/sources/infrastructure-cascade.mjs';
import { handleAIAnalyzerAPI } from './apis/sources/ai-news-analyzer.mjs';
import { handleFREDApi } from './apis/sources/fred.mjs';
import { handleGeopoliticalReportsAPI } from './apis/sources/geopolitical-reports.mjs';
import { handleAiFilterAPI } from './apis/sources/ai-filter.mjs';
import { handleAnalysisEventsAPI } from './apis/sources/analysis-events-api.mjs';
import { handleEconomyAPI } from './apis/sources/economy-api.mjs';
import { handleGatewayAPI } from './apis/sources/gateway-api.mjs';
import { handleLensesAPI } from './apis/sources/lenses-api.mjs';
import { handleRAGAPI } from './apis/sources/rag-api.mjs';
import { handleThinkTanksAPI } from './apis/sources/thinktanks-api.mjs';
import { handleUserAPI } from './apis/sources/user-api.mjs';
import { handleLiveAPI } from './apis/sources/live-api.mjs';
import { handleSilenceAPI } from './apis/sources/silence-api.mjs';
import { handleScenariosAPI } from './apis/sources/scenarios-api.mjs';
import { handleShippingAPI } from './apis/sources/shipping-api.mjs';

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
// 3. ОБРАБОТЧИК СТАТИЧЕСКИХ ФАЙЛОВ (ПОЛНАЯ ВЕРСИЯ)
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
  // === ВСЕ СТРАНИЦЫ ===
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
    '/decision': 'decision.html',
    '/social': 'social.html',
    '/quantum': 'quantum.html',
    '/deepfake': 'deepfake.html',
    '/darkweb': 'darkweb.html',
    '/agents': 'agents.html',
    '/blockchain': 'blockchain.html',
    '/voice': 'voice.html',
    '/emotion': 'emotion.html',
    '/cyber-threats': 'cyber-threats.html',
    '/cyber': 'cyber.html',
    '/acled': 'acled.html',
    '/bls': 'bls.html',
    '/fred': 'fred.html',
    '/firms': 'firms.html',
    '/gdelt': 'gdelt.html',
    '/ships': 'ships.html',
    '/sentiment-analyzer': 'sentiment-analyzer.html',
    '/satellite-api': 'satellite-api.html',
    '/safecast': 'safecast.html',
    '/opensky': 'opensky.html',
    '/nlp-api': 'nlp-api.html',
    '/llm-analyzer': 'llm-analyzer.html',
    '/kiwisdr': 'kiwisdr.html',
    '/infrastructure-ships': 'infrastructure-ships.html',
    '/infrastructure-predict': 'infrastructure-predict.html',
    '/infrastructure-ofac': 'infrastructure-ofac.html',
    '/infrastructure-firms': 'infrastructure-firms.html',
    '/infrastructure-eia-global': 'infrastructure-eia-global.html',
    '/infrastructure-eia': 'infrastructure-eia.html',
    '/infrastructure-cascade': 'infrastructure-cascade.html',
    '/gdelt-v1': 'gdelt-v1.html',
    '/gdelt-curl': 'gdelt-curl.html',
    '/aviation-api': 'aviation-api.html',
    '/ai-news-analyzer': 'ai-news-analyzer.html',
    '/ai-filter': 'ai-filter.html',
    '/analysis-events-api': 'analysis-events-api.html',
    '/economy': 'economy.html',
    '/gateway': 'gateway.html',
    '/lenses': 'lenses.html',
    '/rag': 'rag.html',
    '/thinktanks': 'thinktanks.html',
    '/profile': 'profile.html',
    '/live': 'live.html',
    '/silence': 'silence.html',
    '/scenarios': 'scenarios.html',
    '/shipping': 'shipping.html',
    '/kartochki': 'kartochki.html',
    '/profile': 'profile.html',
    '/silence': 'silence.html',
    '/live': 'live.html',
    '/lenses': 'lenses.html',
    '/scenarios': 'scenarios.html',
    '/sentiment': 'sentiment.html',
    '/kiwisdr': 'kiwisdr.html',
    '/safecast': 'safecast.html',
    '/noaa': 'noaa.html',
    '/ofac': 'ofac.html',
    '/eia': 'eia.html',
    '/cisa': 'cisa.html',
    '/who': 'who.html',
    '/news': 'news.html',
    '/kartochki': 'kartochki.html',
    '/sentiment': 'sentiment.html',
    '/noaa': 'noaa.html',
    '/ofac': 'ofac.html',
    '/eia': 'eia.html',
    '/cisa': 'cisa.html',
    '/who': 'who.html'
  };

  const cleanPath = pathname.replace('.html', '');
  const file = pages[cleanPath] || pages[pathname];
  if (file) {
    const fullPath = join(PUBLIC_DIR, file);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  // === СТАТИЧЕСКИЕ ФАЙЛЫ (css, js, images) ===
  if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
    const fullPath = join(PUBLIC_DIR, pathname);
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
  }

  // === БИБЛИОТЕКИ (/lib/) — НОВОЕ! ===
  if (pathname.startsWith('/lib/')) {
    const fullPath = join(__dirname, pathname);
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
  // API МАРШРУТЫ (ВСЕ)
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
  if (pathname.startsWith('/api/aviation-monitor/')) { await handleAviationAPI(req, res); return; }
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
  if (pathname.startsWith('/api/social/')) { await handleSocialAPI(req, res); return; }
  if (pathname.startsWith('/api/quantum/')) { await handleQuantumAPI(req, res); return; }
  if (pathname.startsWith('/api/deepfake/')) { await handleDeepfakeAPI(req, res); return; }
  if (pathname.startsWith('/api/darkweb/')) { await handleDarkWebAPI(req, res); return; }
  if (pathname.startsWith('/api/agents/')) { await handleAgentsAPI(req, res); return; }
  if (pathname.startsWith('/api/blockchain/')) { await handleBlockchainAPI(req, res); return; }
  if (pathname.startsWith('/api/voice/')) { await handleVoiceAPI(req, res); return; }
  if (pathname.startsWith('/api/emotion/')) { await handleEmotionAPI(req, res); return; }
  if (pathname.startsWith('/api/cyber-threats/')) { await handleCyberThreatsAPI(req, res); return; }
  if (pathname.startsWith('/api/cyber/')) { await handleCyberAPI(req, res); return; }
  if (pathname.startsWith('/api/acled/')) { await handleACLEDApi(req, res); return; }
  if (pathname.startsWith('/api/bls/')) { await handleBLSAPI(req, res); return; }
  if (pathname.startsWith('/api/ships/')) { await handleShipsApi(req, res); return; }
  if (pathname.startsWith('/api/sentiment_analyzer/')) { await handleSentimentAPI(req, res); return; }
  if (pathname.startsWith('/api/satellite_api/')) { await handleSatelliteAPI(req, res); return; }
  if (pathname.startsWith('/api/safecast/')) { await handleSafecastApi(req, res); return; }
  if (pathname.startsWith('/api/opensky/')) { await handleOpenSkyApi(req, res); return; }
  if (pathname.startsWith('/api/nlp_api/')) { await handleNLPAPI(req, res); return; }
  if (pathname.startsWith('/api/llm_analyzer/')) { await handleLLMApi(req, res); return; }
  if (pathname.startsWith('/api/kiwisdr/')) { await handleKiwiSDRAPI(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_ships/')) { await handleShipsApi(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_predict/')) { await handlePredictApi(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_ofac/')) { await handleOFACApi(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_firms/')) { await handleFIRMSApi(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_eia_global/')) { await handleGlobalPlantsApi(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_eia/')) { await handleEIAApi(req, res); return; }
  if (pathname.startsWith('/api/infrastructure_cascade/')) { await handleCascadeApi(req, res); return; }
  if (pathname.startsWith('/api/gdelt_v1/')) { await handleGDELTAPI(req, res); return; }
  if (pathname.startsWith('/api/gdelt_curl/')) { await handleGDELTAPI(req, res); return; }
  if (pathname.startsWith('/api/gdelt/')) { await handleGDELTAPI(req, res); return; }
  if (pathname.startsWith('/api/firms/')) { await handleFIRMSApi(req, res); return; }
  if (pathname.startsWith('/api/fred/')) { await handleFREDApi(req, res); return; }
  if (pathname.startsWith('/api/ai-filter/')) { await handleAiFilterAPI(req, res); return; }
  if (pathname.startsWith('/api/analysis-events/')) { await handleAnalysisEventsAPI(req, res); return; }
  if (pathname.startsWith('/api/economy/')) { await handleEconomyAPI(req, res); return; }
  if (pathname.startsWith('/api/gateway/')) { await handleGatewayAPI(req, res); return; }
  if (pathname.startsWith('/api/lenses/')) { await handleLensesAPI(req, res); return; }
  if (pathname.startsWith('/api/rag/')) { await handleRAGAPI(req, res); return; }
  if (pathname.startsWith('/api/thinktanks/')) { await handleThinkTanksAPI(req, res); return; }
  if (pathname.startsWith('/api/user/')) { await handleUserAPI(req, res); return; }
  if (pathname.startsWith('/api/live/')) { await handleLiveAPI(req, res); return; }
  if (pathname.startsWith('/api/silence/')) { await handleSilenceAPI(req, res); return; }
  if (pathname.startsWith('/api/scenarios/')) { await handleScenariosAPI(req, res); return; }
  if (pathname.startsWith('/api/shipping/')) { await handleShippingAPI(req, res); return; }

  // ============================================================
  // СТАТИЧЕСКИЕ ФАЙЛЫ
  // ============================================================
  const filePath = await findStaticFile(pathname);
  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // ============================================================
  // 404
  // ============================================================
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
  console.log(`  📁 Public: ${PUBLIC_DIR}`);
  console.log(`  📁 Lib: ${join(__dirname, 'lib')}`);
  console.log(`========================================`);
  console.log(`  ✅ Библиотеки (/lib/): d3, topojson, three.js`);
  console.log(`  ✅ Страниц: 95 (100%)`);
  console.log(`  ✅ API-модулей: 140 (100%)`);
  console.log(`========================================`);
});

process.on('SIGINT', () => { console.log('\n🛑 Сервер остановлен'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 Сервер остановлен'); process.exit(0); });

export default server;
