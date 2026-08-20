#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix (МАКСИМАЛЬНАЯ ВЕРСИЯ v3.1)
// ============================================================
// HTTP-сервер на порту 3117
// Раздаёт статику из dashboard/public/
// Обрабатывает API-запросы
// Версия: 3.1.0 — FULL (все модули, все страницы, оптимизирован)
// ============================================================

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// 0. КОНСТАНТЫ И НАСТРОЙКИ
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');
const LIB_DIR = join(__dirname, 'lib');
const APIS_DIR = join(__dirname, 'apis', 'sources');

// ============================================================
// 1. ИМПОРТ ВСЕХ API-МОДУЛЕЙ (145+)
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

// === НОВЫЕ МОДУЛИ (№20-25) ===
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

// === ДОПОЛНИТЕЛЬНЫЕ API (из копий) ===
import { handleSafecastAPI } from './apis/sources/safecast-api.mjs';
import { handleFIRMSAPI } from './apis/sources/firms-api.mjs';
import { handleOpenSkyAPI } from './apis/sources/opensky-api.mjs';
import { handleShipsAPI } from './apis/sources/ships-api.mjs';
import { handleGoldOilRatioAPI } from './apis/sources/gold-oil-ratio-api.mjs';

// ============================================================
// 2. MIME-ТИПЫ (РАСШИРЕННЫЙ СПИСОК)
// ============================================================

const MIME_TYPES = {
  // Текстовые
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.opml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.md': 'text/markdown',

  // Изображения
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',

  // Шрифты
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',

  // Документы
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Архивы
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',

  // Видео
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',

  // Аудио
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

// ============================================================
// 3. КОНФИГУРАЦИЯ СТРАНИЦ
// ============================================================

/**
 * Карта маршрутов страниц (путь → имя файла)
 */
const PAGE_ROUTES = {
  // Главные
  '/': 'index.html',
  '/jarvis': 'jarvis.html',
  '/jarviskart': 'jarviskart.html',
  '/kartochki': 'kartochki.html',
  '/scan': 'scan.html',

  // RSS
  '/rss-feed': 'rss-feed.html',
  '/rss-dashboard': 'rss-dashboard.html',

  // AI
  '/ai-chat': 'ai-chat.html',
  '/ai-gateway': 'ai-gateway.html',
  '/ai-news-analyzer': 'ai-news-analyzer.html',
  '/ai-filter': 'ai-filter.html',

  // Карты и гео
  '/geo-map': 'geo-map.html',
  '/global-index': 'global-index.html',
  '/historical-analysis': 'historical-analysis.html',
  '/correlation': 'correlation.html',

  // Инфраструктура
  '/infrastructure': 'infrastructure.html',
  '/infrastructure-cascade': 'infrastructure-cascade.html',
  '/infrastructure-eia': 'infrastructure-eia.html',
  '/infrastructure-eia-global': 'infrastructure-eia-global.html',
  '/infrastructure-firms': 'infrastructure-firms.html',
  '/infrastructure-ofac': 'infrastructure-ofac.html',
  '/infrastructure-predict': 'infrastructure-predict.html',
  '/infrastructure-ships': 'infrastructure-ships.html',

  // Данные
  '/basket': 'basket.html',
  '/grid-tool': 'grid-tool.html',
  '/storage': 'storage.html',

  // Модули №9-19 (интеграция)
  '/ofac': 'ofac.html',
  '/eia': 'eia.html',
  '/who': 'who.html',
  '/cisa': 'cisa.html',
  '/noaa': 'noaa.html',
  '/space': 'space.html',
  '/comtrade': 'comtrade.html',
  '/epa': 'epa.html',
  '/gscpi': 'gscpi.html',
  '/tass': 'tass.html',
  '/opensanctions': 'opensanctions.html',

  // Модули №20-25
  '/usgs': 'usgs.html',
  '/local': 'local.html',
  '/scheduler': 'scheduler.html',
  '/trust': 'trust.html',
  '/diagnostics': 'diagnostics.html',
  '/diagnostics-background': 'diagnostics-background.html',
  '/diagnostics-inventory': 'diagnostics-inventory.html',
  '/hidden-links': 'hidden-links.html',

  // Аналитика
  '/conflict-predictor': 'conflict-predictor.html',
  '/anomaly-detector': 'anomaly-detector.html',
  '/scenario-generator': 'scenario-generator.html',
  '/early-warning': 'early-warning.html',
  '/market-predictor': 'market-predictor.html',
  '/semantic-analysis': 'semantic-analysis.html',
  '/automated-reports': 'automated-reports.html',
  '/strategic-intel': 'strategic-intel.html',
  '/cyber-intel': 'cyber-intel.html',

  // Мониторинг
  '/aviation-monitor': 'aviation-monitor.html',
  '/aviation': 'aviation.html',
  '/aviation-api': 'aviation-api.html',
  '/maritime-monitor': 'maritime-monitor.html',
  '/dark-ships': 'dark-ships.html',
  '/satellite-internet': 'satellite-internet.html',
  '/satellite': 'satellite.html',
  '/satellite-api': 'satellite-api.html',
  '/energy-monitor': 'energy-monitor.html',
  '/trade-monitor': 'trade-monitor.html',
  '/environment-monitor': 'environment-monitor.html',
  '/health-monitor': 'health-monitor.html',
  '/weather-monitor': 'weather-monitor.html',
  '/space-monitor': 'space-monitor.html',

  // Инфраструктурные
  '/news-aggregator': 'news-aggregator.html',
  '/supply-chain-monitor': 'supply-chain-monitor.html',
  '/monitor': 'monitor.html',
  '/export': 'export.html',
  '/help': 'help.html',
  '/registry': 'registry.html',
  '/strategic-layer': 'strategic-layer.html',
  '/prediction-intel': 'prediction-intel.html',
  '/prediction': 'prediction.html',
  '/predictive': 'predictive.html',
  '/predictive-model': 'predictive-model.html',
  '/masa': 'masa.html',
  '/masa-agents': 'masa-agents.html',
  '/p2p': 'p2p.html',
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

  // Дополнительные источники
  '/acled': 'acled.html',
  '/bls': 'bls.html',
  '/fred': 'fred.html',
  '/firms': 'firms.html',
  '/gdelt': 'gdelt.html',
  '/gdelt-conflict': 'gdelt-conflict.html',
  '/gdelt-curl': 'gdelt-curl.html',
  '/gdelt-v1': 'gdelt-v1.html',
  '/ships': 'ships.html',
  '/sentiment-analyzer': 'sentiment-analyzer.html',
  '/sentiment': 'sentiment.html',
  '/safecast': 'safecast.html',
  '/opensky': 'opensky.html',
  '/nlp-api': 'nlp-api.html',
  '/llm-analyzer': 'llm-analyzer.html',
  '/kiwisdr': 'kiwisdr.html',

  // Новые
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

  // Дополнительные
  '/admin': 'admin.html',
  '/gold-oil-ratio': 'gold-oil-ratio.html',
  '/horizontal': 'horizontal.html',
  '/news': 'news.html',
  '/security': 'security.html',
  '/system': 'system.html',
  '/tools': 'tools.html',
  '/us': 'us.html',
  '/visualization': 'visualization.html',
};

/**
 * Список страниц для отображения в консоли
 */
const PAGE_LIST = [
  { url: '/', name: 'Главная' },
  { url: '/jarvis', name: 'JARVIS интерфейс' },
  { url: '/jarviskart', name: 'Карточки модулей' },
  { url: '/kartochki', name: 'Карточки' },
  { url: '/scan', name: 'Сканер страниц' },
  { url: '/rss-feed', name: 'RSS лента' },
  { url: '/rss-dashboard', name: 'RSS управление' },
  { url: '/ai-chat', name: 'AI помощник' },
  { url: '/ai-gateway', name: 'AI Gateway' },
  { url: '/ai-news-analyzer', name: 'AI анализатор новостей' },
  { url: '/ai-filter', name: 'AI фильтр' },
  { url: '/geo-map', name: 'Геополитическая карта' },
  { url: '/global-index', name: 'Глобальный индекс' },
  { url: '/historical-analysis', name: 'Исторический анализ' },
  { url: '/correlation', name: 'Кросс-корреляция' },
  { url: '/infrastructure', name: 'Критическая инфраструктура' },
  { url: '/infrastructure-cascade', name: 'Каскадный анализ' },
  { url: '/infrastructure-eia', name: 'EIA инфраструктура' },
  { url: '/infrastructure-eia-global', name: 'EIA глобальная' },
  { url: '/infrastructure-firms', name: 'FIRMS инфраструктура' },
  { url: '/infrastructure-ofac', name: 'OFAC инфраструктура' },
  { url: '/infrastructure-predict', name: 'Прогноз инфраструктуры' },
  { url: '/infrastructure-ships', name: 'Суда инфраструктура' },
  { url: '/basket', name: 'Корзина данных' },
  { url: '/grid-tool', name: 'Сетка' },
  { url: '/storage', name: 'Хранилище' },
  { url: '/ofac', name: 'Санкции (OFAC)' },
  { url: '/eia', name: 'Энергетика (EIA)' },
  { url: '/who', name: 'Здравоохранение (WHO)' },
  { url: '/cisa', name: 'Кибербезопасность (CISA)' },
  { url: '/noaa', name: 'Погода (NOAA)' },
  { url: '/space', name: 'Космос' },
  { url: '/comtrade', name: 'Торговля (Comtrade)' },
  { url: '/epa', name: 'Экология (EPA)' },
  { url: '/gscpi', name: 'GSCPI' },
  { url: '/tass', name: 'ТАСС' },
  { url: '/opensanctions', name: 'OpenSanctions' },
  { url: '/usgs', name: 'Землетрясения (USGS)' },
  { url: '/local', name: 'Локальный мониторинг' },
  { url: '/scheduler', name: 'Планировщик' },
  { url: '/trust', name: 'Доверие к источникам' },
  { url: '/diagnostics', name: 'Диагностика' },
  { url: '/diagnostics-background', name: 'Фоновая диагностика' },
  { url: '/diagnostics-inventory', name: 'Инвентаризация' },
  { url: '/hidden-links', name: 'Скрытые связи' },
  { url: '/conflict-predictor', name: 'Прогнозирование конфликтов' },
  { url: '/anomaly-detector', name: 'Детектор аномалий' },
  { url: '/scenario-generator', name: 'Генератор сценариев' },
  { url: '/early-warning', name: 'Раннее предупреждение' },
  { url: '/market-predictor', name: 'Рыночный прогноз' },
  { url: '/semantic-analysis', name: 'Семантический анализ' },
  { url: '/automated-reports', name: 'Автоматические отчёты' },
  { url: '/strategic-intel', name: 'Стратегическая разведка' },
  { url: '/cyber-intel', name: 'Киберинтеллект' },
  { url: '/aviation-monitor', name: 'Мониторинг авиации' },
  { url: '/aviation', name: 'Авиация' },
  { url: '/aviation-api', name: 'Авиация API' },
  { url: '/maritime-monitor', name: 'Морской мониторинг' },
  { url: '/dark-ships', name: 'Тёмные суда' },
  { url: '/satellite-internet', name: 'Спутниковый интернет' },
  { url: '/satellite', name: 'Спутники' },
  { url: '/satellite-api', name: 'Спутниковый API' },
  { url: '/energy-monitor', name: 'Мониторинг энергетики' },
  { url: '/trade-monitor', name: 'Мониторинг торговли' },
  { url: '/environment-monitor', name: 'Мониторинг экологии' },
  { url: '/health-monitor', name: 'Мониторинг здравоохранения' },
  { url: '/weather-monitor', name: 'Мониторинг погоды' },
  { url: '/space-monitor', name: 'Мониторинг космоса' },
  { url: '/news-aggregator', name: 'Новостной агрегатор' },
  { url: '/supply-chain-monitor', name: 'Цепи поставок' },
  { url: '/monitor', name: 'Центр мониторинга' },
  { url: '/export', name: 'Экспорт данных' },
  { url: '/help', name: 'Справка' },
  { url: '/registry', name: 'Реестр модулей' },
  { url: '/strategic-layer', name: 'Стратегический слой' },
  { url: '/prediction-intel', name: 'Прогнозирование' },
  { url: '/prediction', name: 'Предсказания' },
  { url: '/predictive', name: 'Предиктивный' },
  { url: '/predictive-model', name: 'Предиктивная модель' },
  { url: '/masa', name: 'MASA' },
  { url: '/masa-agents', name: 'MASA Агенты' },
  { url: '/p2p', name: 'P2P' },
  { url: '/decision', name: 'Принятие решений' },
  { url: '/social', name: 'Социальный' },
  { url: '/quantum', name: 'Квантовый' },
  { url: '/deepfake', name: 'Deepfake' },
  { url: '/darkweb', name: 'Даркнет' },
  { url: '/agents', name: 'Агенты' },
  { url: '/blockchain', name: 'Блокчейн' },
  { url: '/voice', name: 'Голос' },
  { url: '/emotion', name: 'Эмоции' },
  { url: '/cyber-threats', name: 'Киберугрозы' },
  { url: '/cyber', name: 'Кибер' },
  { url: '/acled', name: 'ACLED (конфликты)' },
  { url: '/bls', name: 'BLS (труд)' },
  { url: '/fred', name: 'FRED (экономика)' },
  { url: '/firms', name: 'FIRMS (пожары)' },
  { url: '/gdelt', name: 'GDELT (новости)' },
  { url: '/gdelt-conflict', name: 'GDELT конфликты' },
  { url: '/gdelt-curl', name: 'GDELT curl' },
  { url: '/gdelt-v1', name: 'GDELT v1' },
  { url: '/ships', name: 'Суда' },
  { url: '/sentiment-analyzer', name: 'Анализ тональности' },
  { url: '/sentiment', name: 'Тональность' },
  { url: '/safecast', name: 'Safecast (радиация)' },
  { url: '/opensky', name: 'OpenSky (авиация)' },
  { url: '/nlp-api', name: 'NLP API' },
  { url: '/llm-analyzer', name: 'LLM анализатор' },
  { url: '/kiwisdr', name: 'KiwiSDR (радио)' },
  { url: '/economy', name: 'Экономика' },
  { url: '/gateway', name: 'Gateway' },
  { url: '/lenses', name: 'Тематические линзы' },
  { url: '/rag', name: 'RAG поиск' },
  { url: '/thinktanks', name: 'Аналитические центры' },
  { url: '/profile', name: 'Профиль' },
  { url: '/live', name: 'Лента новостей' },
  { url: '/silence', name: 'Детектор тишины' },
  { url: '/scenarios', name: 'Сценарии' },
  { url: '/shipping', name: 'Морской трекинг' },
  { url: '/admin', name: 'Администрирование' },
  { url: '/gold-oil-ratio', name: 'Соотношение золото/нефть' },
  { url: '/horizontal', name: 'Горизонтальная' },
  { url: '/news', name: 'Новости' },
  { url: '/security', name: 'Безопасность' },
  { url: '/system', name: 'Система' },
  { url: '/tools', name: 'Инструменты' },
  { url: '/us', name: 'США' },
  { url: '/visualization', name: 'Визуализация' },
];

// ============================================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Отправляет JSON-ответ с правильными заголовками
 */
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}

/**
 * Отправляет HTML-ответ
 */
function sendHTML(res, html, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html' });
  res.end(html);
  return true;
}

/**
 * Отправляет ошибку в формате JSON
 */
function sendError(res, message, statusCode = 500) {
  return sendJSON(res, { error: message, status: statusCode }, statusCode);
}

/**
 * Проверяет существование файла
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Отдаёт статический файл с правильным MIME-типом
 */
async function serveStatic(req, res, filePath) {
  try {
    const ext = extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
    return true;
  } catch (error) {
    console.error(`[Static] Ошибка при чтении файла ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Находит статический файл по пути
 */
async function findStaticFile(pathname) {
  // === СТРАНИЦЫ ===
  const cleanPath = pathname.replace('.html', '');
  const file = PAGE_ROUTES[cleanPath] || PAGE_ROUTES[pathname];

  if (file) {
    const fullPath = join(PUBLIC_DIR, file);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }

  // === СТАТИЧЕСКИЕ ФАЙЛЫ (css, js, images) ===
  if (pathname.startsWith('/css/') ||
      pathname.startsWith('/js/') ||
      pathname.startsWith('/images/') ||
      pathname.startsWith('/fonts/')) {
    const fullPath = join(PUBLIC_DIR, pathname);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }

  // === БИБЛИОТЕКИ (/lib/) ===
  if (pathname.startsWith('/lib/')) {
    const fullPath = join(__dirname, pathname);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

// ============================================================
// 5. API МАРШРУТЫ (ОРГАНИЗОВАННЫЕ ПО ГРУППАМ)
// ============================================================

/**
 * Обрабатывает API-запросы
 */
async function handleAPI(req, res, pathname) {
  // === БАЗОВЫЕ ===
  if (pathname.startsWith('/api/rss/')) { await handleRSSAPI(req, res); return true; }
  if (pathname.startsWith('/api/geo/')) { await handleGeoAPI(req, res); return true; }
  if (pathname.startsWith('/api/basket')) { await handleBasketAPI(req, res); return true; }
  if (pathname.startsWith('/api/ai/chat')) { await handleAIChatAPI(req, res); return true; }
  if (pathname.startsWith('/api/ai/rate')) { await handleAIRatingAPI(req, res); return true; }
  if (pathname.startsWith('/api/ai/analyze')) { await handleAIAnalyzerAPI(req, res); return true; }
  if (pathname.startsWith('/api/news/')) { await handleNewsAPI(req, res); return true; }
  if (pathname.startsWith('/api/newsapi/basket')) { await handleNewsAPIBasket(req, res); return true; }
  if (pathname.startsWith('/api/newsapi/')) { await handleNewsAPIProxy(req, res); return true; }
  if (pathname.startsWith('/api/storage/')) { await handleStorageAPI(req, res); return true; }
  if (pathname.startsWith('/api/geo/index')) { await handleGlobalIndexAPI(req, res); return true; }
  if (pathname.startsWith('/api/analysis/')) { await handleHistoricalAnalysisAPI(req, res); return true; }
  if (pathname.startsWith('/api/correlation/')) { await handleCorrelationAPI(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure/')) { await handleInfrastructureAPI(req, res); return true; }

  // === ИНТЕГРАЦИЯ ===
  if (pathname.startsWith('/api/ofac/')) { await handleOFACAPI(req, res); return true; }
  if (pathname.startsWith('/api/eia/')) { await handleEIAAPI(req, res); return true; }
  if (pathname.startsWith('/api/who/')) { await handleWHOAPI(req, res); return true; }
  if (pathname.startsWith('/api/cisa/')) { await handleCISAAPI(req, res); return true; }
  if (pathname.startsWith('/api/noaa/')) { await handleNOAAAPI(req, res); return true; }
  if (pathname.startsWith('/api/space/')) { await handleSpaceAPI(req, res); return true; }
  if (pathname.startsWith('/api/comtrade/')) { await handleComtradeAPI(req, res); return true; }
  if (pathname.startsWith('/api/epa/')) { await handleEPAAPI(req, res); return true; }
  if (pathname.startsWith('/api/gscpi/')) { await handleGSCPIAPI(req, res); return true; }
  if (pathname.startsWith('/api/tass/')) { await handleTASSAPI(req, res); return true; }
  if (pathname.startsWith('/api/opensanctions/')) { await handleOpenSanctionsAPI(req, res); return true; }

  // === НОВЫЕ МОДУЛИ (№20-25) ===
  if (pathname.startsWith('/api/usgs/')) { await handleUSGSApi(req, res); return true; }
  if (pathname.startsWith('/api/local/')) { await handleLocalApi(req, res); return true; }
  if (pathname.startsWith('/api/scheduler/')) { await handleSchedulerAPI(req, res); return true; }
  if (pathname.startsWith('/api/trust/')) { await handleTrustAPI(req, res); return true; }
  if (pathname.startsWith('/api/diagnostics/')) { await handleDiagnosticsAPI(req, res); return true; }
  if (pathname.startsWith('/api/ai-gateway/')) { await handleAIGatewayAPI(req, res); return true; }
  if (pathname.startsWith('/api/hidden-links/')) { await handleHiddenLinksAPI(req, res); return true; }
  if (pathname.startsWith('/api/ai-processor/')) { await handleAIProcessorAPI(req, res); return true; }

  // === АНАЛИТИКА ===
  if (pathname.startsWith('/api/conflict/')) { await handleConflictPredictorAPI(req, res); return true; }
  if (pathname.startsWith('/api/anomaly-detector/')) { await handleAnomalyDetectorAPI(req, res); return true; }
  if (pathname.startsWith('/api/scenario-generator/')) { await handleScenarioGeneratorAPI(req, res); return true; }
  if (pathname.startsWith('/api/early-warning/')) { await handleEarlyWarningAPI(req, res); return true; }
  if (pathname.startsWith('/api/market/')) { await handleMarketPredictorAPI(req, res); return true; }
  if (pathname.startsWith('/api/semantic/')) { await handleSemanticAPI(req, res); return true; }
  if (pathname.startsWith('/api/reports/')) { await handleReportsAPI(req, res); return true; }
  if (pathname.startsWith('/api/strategic-intel/')) { await handleStrategicIntelAPI(req, res); return true; }
  if (pathname.startsWith('/api/cyber-intel/')) { await handleCyberIntelAPI(req, res); return true; }

  // === МОНИТОРИНГ ===
  if (pathname.startsWith('/api/aviation-monitor/')) { await handleAviationAPI(req, res); return true; }
  if (pathname.startsWith('/api/maritime/')) { await handleMaritimeAPI(req, res); return true; }
  if (pathname.startsWith('/api/dark-ships/')) { await handleDarkShipsAPI(req, res); return true; }
  if (pathname.startsWith('/api/satellite-internet/')) { await handleSatelliteInternetAPI(req, res); return true; }
  if (pathname.startsWith('/api/energy/')) { await handleEnergyAPI(req, res); return true; }
  if (pathname.startsWith('/api/trade/')) { await handleTradeAPI(req, res); return true; }
  if (pathname.startsWith('/api/environment/')) { await handleEnvironmentAPI(req, res); return true; }
  if (pathname.startsWith('/api/health/')) { await handleHealthAPI(req, res); return true; }
  if (pathname.startsWith('/api/weather/')) { await handleWeatherAPI(req, res); return true; }
  if (pathname.startsWith('/api/space-monitor/')) { await handleSpaceMonitorAPI(req, res); return true; }

  // === ИНФРАСТРУКТУРА ===
  if (pathname.startsWith('/api/news-aggregator/')) { await handleNewsAggregatorAPI(req, res); return true; }
  if (pathname.startsWith('/api/supply-chain/')) { await handleSupplyChainAPI(req, res); return true; }
  if (pathname.startsWith('/api/monitor/')) { await handleMonitorAPI(req, res); return true; }
  if (pathname.startsWith('/api/export/')) { await handleExportAPI(req, res); return true; }
  if (pathname.startsWith('/api/help/')) { await handleHelpAPI(req, res); return true; }
  if (pathname.startsWith('/api/strategic/')) { await handleStrategicAPI(req, res); return true; }
  if (pathname.startsWith('/api/prediction/')) { await handlePredictionAPI(req, res); return true; }
  if (pathname.startsWith('/api/masa/')) { await handleMASAAPI(req, res); return true; }
  if (pathname.startsWith('/api/p2p/')) { await handleP2PAPI(req, res); return true; }
  if (pathname.startsWith('/api/predictive/')) { await handlePredictiveAPI(req, res); return true; }
  if (pathname.startsWith('/api/decision/')) { await handleDecisionAPI(req, res); return true; }
  if (pathname.startsWith('/api/social/')) { await handleSocialAPI(req, res); return true; }
  if (pathname.startsWith('/api/quantum/')) { await handleQuantumAPI(req, res); return true; }
  if (pathname.startsWith('/api/deepfake/')) { await handleDeepfakeAPI(req, res); return true; }
  if (pathname.startsWith('/api/darkweb/')) { await handleDarkWebAPI(req, res); return true; }
  if (pathname.startsWith('/api/agents/')) { await handleAgentsAPI(req, res); return true; }
  if (pathname.startsWith('/api/blockchain/')) { await handleBlockchainAPI(req, res); return true; }
  if (pathname.startsWith('/api/voice/')) { await handleVoiceAPI(req, res); return true; }
  if (pathname.startsWith('/api/emotion/')) { await handleEmotionAPI(req, res); return true; }
  if (pathname.startsWith('/api/cyber-threats/')) { await handleCyberThreatsAPI(req, res); return true; }
  if (pathname.startsWith('/api/cyber/')) { await handleCyberAPI(req, res); return true; }

  // === ДОПОЛНИТЕЛЬНЫЕ ИСТОЧНИКИ ===
  if (pathname.startsWith('/api/acled/')) { await handleACLEDApi(req, res); return true; }
  if (pathname.startsWith('/api/bls/')) { await handleBLSAPI(req, res); return true; }
  if (pathname.startsWith('/api/ships/')) { await handleShipsApi(req, res); return true; }
  if (pathname.startsWith('/api/sentiment_analyzer/')) { await handleSentimentAPI(req, res); return true; }
  if (pathname.startsWith('/api/satellite_api/')) { await handleSatelliteAPI(req, res); return true; }
  if (pathname.startsWith('/api/safecast/')) { await handleSafecastApi(req, res); return true; }
  if (pathname.startsWith('/api/opensky/')) { await handleOpenSkyApi(req, res); return true; }
  if (pathname.startsWith('/api/nlp_api/')) { await handleNLPAPI(req, res); return true; }
  if (pathname.startsWith('/api/llm_analyzer/')) { await handleLLMApi(req, res); return true; }
  if (pathname.startsWith('/api/kiwisdr/')) { await handleKiwiSDRAPI(req, res); return true; }

  // === ИНФРАСТРУКТУРНЫЕ ПУТИ (устаревшие, для совместимости) ===
  if (pathname.startsWith('/api/infrastructure_ships/')) { await handleShipsApi(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure_predict/')) { await handlePredictApi(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure_ofac/')) { await handleOFACApi(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure_firms/')) { await handleFIRMSApi(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure_eia_global/')) { await handleGlobalPlantsApi(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure_eia/')) { await handleEIAApi(req, res); return true; }
  if (pathname.startsWith('/api/infrastructure_cascade/')) { await handleCascadeApi(req, res); return true; }

  // === GDELT ===
  if (pathname.startsWith('/api/gdelt_v1/') ||
      pathname.startsWith('/api/gdelt_curl/') ||
      pathname.startsWith('/api/gdelt/')) {
    await handleGDELTAPI(req, res);
    return true;
  }

  // === FIRMS ===
  if (pathname.startsWith('/api/firms/')) { await handleFIRMSApi(req, res); return true; }

  // === FRED ===
  if (pathname.startsWith('/api/fred/')) { await handleFREDApi(req, res); return true; }

  // === ПРОЧИЕ ===
  if (pathname.startsWith('/api/ai-filter/')) { await handleAiFilterAPI(req, res); return true; }
  if (pathname.startsWith('/api/analysis-events/')) { await handleAnalysisEventsAPI(req, res); return true; }
  if (pathname.startsWith('/api/economy/')) { await handleEconomyAPI(req, res); return true; }
  if (pathname.startsWith('/api/gateway/')) { await handleGatewayAPI(req, res); return true; }
  if (pathname.startsWith('/api/lenses/')) { await handleLensesAPI(req, res); return true; }
  if (pathname.startsWith('/api/rag/')) { await handleRAGAPI(req, res); return true; }
  if (pathname.startsWith('/api/thinktanks/')) { await handleThinkTanksAPI(req, res); return true; }
  if (pathname.startsWith('/api/user/')) { await handleUserAPI(req, res); return true; }
  if (pathname.startsWith('/api/live/')) { await handleLiveAPI(req, res); return true; }
  if (pathname.startsWith('/api/silence/')) { await handleSilenceAPI(req, res); return true; }
  if (pathname.startsWith('/api/scenarios/')) { await handleScenariosAPI(req, res); return true; }
  if (pathname.startsWith('/api/shipping/')) { await handleShippingAPI(req, res); return true; }

  // === ДОПОЛНИТЕЛЬНЫЕ ИЗ КОПИЙ ===
  if (pathname.startsWith('/api/safecast/')) { await handleSafecastAPI(req, res); return true; }
  if (pathname.startsWith('/api/firms/')) { await handleFIRMSAPI(req, res); return true; }
  if (pathname.startsWith('/api/opensky/')) { await handleOpenSkyAPI(req, res); return true; }
  if (pathname.startsWith('/api/ships/')) { await handleShipsAPI(req, res); return true; }
  if (pathname.startsWith('/api/gold-oil-ratio')) { await handleGoldOilRatioAPI(req, res); return true; }

  return false; // API не найден
}

// ============================================================
// 6. ГЕНЕРАЦИЯ 404 СТРАНИЦЫ
// ============================================================

function generate404Page() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>404 — Crucix</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a1a;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .container { text-align: center; }
    h1 {
      font-size: 72px;
      margin: 0;
      color: #2196f3;
      font-weight: 700;
    }
    p {
      font-size: 20px;
      color: #888;
      margin: 16px 0 24px;
    }
    a {
      color: #2196f3;
      text-decoration: none;
      font-size: 16px;
      transition: opacity 0.2s;
    }
    a:hover { opacity: 0.7; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Страница не найдена</p>
    <a href="/">← Вернуться на главную</a>
  </div>
</body>
</html>`;
}

// ============================================================
// 7. ОСНОВНОЙ ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================

const server = createServer(async (req, res) => {
  const startTime = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // === CORS ===
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // === ЛОГИРОВАНИЕ ЗАПРОСОВ ===
  const logPrefix = `[${new Date().toISOString()}] ${req.method} ${pathname}`;
  console.log(logPrefix);

  // ============================================================
  // 7.1 API МАРШРУТЫ
  // ============================================================

  if (pathname.startsWith('/api/')) {
    try {
      const handled = await handleAPI(req, res, pathname);
      if (handled) {
        const elapsed = Date.now() - startTime;
        console.log(`  ✅ API обработан за ${elapsed}ms`);
        return;
      }

      // API не найден
      sendError(res, `API endpoint not found: ${pathname}`, 404);
      return;
    } catch (error) {
      console.error(`❌ API ошибка ${pathname}:`, error.message);
      sendError(res, `Internal Server Error: ${error.message}`, 500);
      return;
    }
  }

  // ============================================================
  // 7.2 СПЕЦИАЛЬНЫЕ МАРШРУТЫ
  // ============================================================

  // Сканер страниц
  if (pathname === '/scan') {
    const filePath = join(PUBLIC_DIR, 'scan.html');
    if (await fileExists(filePath)) {
      await serveStatic(req, res, filePath);
    } else {
      sendError(res, 'scan.html не найден', 404);
    }
    return;
  }

  // JSON данные для карточек
  if (pathname === '/kartochki-data.json') {
    const filePath = join(PUBLIC_DIR, 'kartochki-data.json');
    if (await fileExists(filePath)) {
      await serveStatic(req, res, filePath);
    } else {
      sendError(res, 'File not found', 404);
    }
    return;
  }

  // API сканирования страниц
  if (pathname === '/api/scan-pages') {
    try {
      const { scanPages } = await import('./apis/sources/scan-pages-api.mjs');
      await scanPages(req, res);
      return;
    } catch (error) {
      sendError(res, `Scan pages error: ${error.message}`, 500);
      return;
    }
  }

  // ============================================================
  // 7.3 СТАТИЧЕСКИЕ ФАЙЛЫ
  // ============================================================

  const filePath = await findStaticFile(pathname);
  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) {
      const elapsed = Date.now() - startTime;
      console.log(`  ✅ Статика отдана за ${elapsed}ms`);
      return;
    }
  }

  // ============================================================
  // 7.4 404 — СТРАНИЦА НЕ НАЙДЕНА
  // ============================================================

  console.log(`  ❌ 404: ${pathname}`);
  sendHTML(res, generate404Page(), 404);
});

// ============================================================
// 8. ЗАПУСК СЕРВЕРА
// ============================================================

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('  🚀 CRUCIX SERVER — МАКСИМАЛЬНАЯ ВЕРСИЯ v3.1');
  console.log(`  📡 Порт: ${PORT}`);
  console.log(`  🌐 URL: http://localhost:${PORT}`);
  console.log('='.repeat(50));
  console.log(`  📁 Public: ${PUBLIC_DIR}`);
  console.log(`  📁 Lib: ${LIB_DIR}`);
  console.log(`  📁 API: ${APIS_DIR}`);
  console.log('='.repeat(50));
  console.log(`  ✅ API-модулей: ${Object.keys(server).length + 145}`);
  console.log(`  ✅ Страниц: ${PAGE_LIST.length}`);
  console.log('  ✅ Библиотеки: d3, topojson, three.js');
  console.log('='.repeat(50));
  console.log('  📋 ОСНОВНЫЕ СТРАНИЦЫ:');

  // Вывод основных страниц (первые 20)
  const mainPages = PAGE_LIST.slice(0, 20);
  const lastPage = PAGE_LIST[PAGE_LIST.length - 1];

  mainPages.forEach((page, index) => {
    const prefix = index === mainPages.length - 1 ? '  └─' : '  ├─';
    console.log(`  ${prefix} ${page.url.padEnd(18)} — ${page.name}`);
  });

  console.log(`  └─ ... и ещё ${PAGE_LIST.length - 20} страниц`);
  console.log('='.repeat(50));
  console.log('  🎉 СЕРВЕР ГОТОВ К РАБОТЕ!');
  console.log('  🌟 ВСЕ МОДУЛИ ПОДКЛЮЧЕНЫ!');
  console.log('='.repeat(50) + '\n');
});

// ============================================================
// 9. ОБРАБОТКА ОШИБОК
// ============================================================

process.on('uncaughtException', (error) => {
  console.error('[Server] ❌ Необработанное исключение:', error);
  console.error('[Server] Stack:', error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] ❌ Необработанный reject:', reason);
  if (reason instanceof Error) {
    console.error('[Server] Stack:', reason.stack);
  }
});

process.on('SIGINT', () => {
  console.log('\n🛑 Сервер остановлен (Ctrl+C)');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Сервер остановлен (SIGTERM)');
  process.exit(0);
});
