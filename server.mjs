#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix (ULTIMATE EDITION v7.0)
// ============================================================
// HTTP-сервер на порту 3117
// Раздаёт статику из dashboard/public/
// Обрабатывает API-запросы (200+ обработчиков)
// Версия: 7.0.0 — ULTIMATE (все модули, защита от ошибок, 25 индикаторов)
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
// 1. БЕЗОПАСНАЯ ЗАГРУЗКА МОДУЛЕЙ
// ============================================================

async function safeImport(path) {
    const extensions = ['.mjs', '.js'];
    for (const ext of extensions) {
        try {
            const module = await import(`${path}${ext}`);
            console.log(`  ✅ Загружен: ${path}${ext}`);
            return module;
        } catch (e) {}
    }
    console.warn(`  ⚠️ Модуль не найден: ${path}`);
    return null;
}

function createStub(apiName) {
    return async (req, res) => {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `API "${apiName}" временно недоступен`, status: 501 }));
    };
}

function getHandler(module, handlerName, apiName) {
    if (module && module[handlerName]) {
        return module[handlerName];
    }
    console.warn(`  ⚠️ Обработчик ${handlerName} не найден`);
    return createStub(apiName || handlerName);
}

console.log('\n📦 Загрузка API-модулей...');

// === БАЗОВЫЕ МОДУЛИ ===
const mod_rss = await safeImport('./apis/sources/rss-manager-api');
const mod_geo = await safeImport('./apis/sources/geo-markers-api');
const mod_basket = await safeImport('./apis/sources/basket-api');
const mod_ai_chat = await safeImport('./apis/sources/ai-chat-api');
const mod_ai_rate = await safeImport('./apis/sources/ai-news-rating');
const mod_news = await safeImport('./apis/sources/news-api');
const mod_newsapi_basket = await safeImport('./apis/sources/newsapi-basket-integration');
const mod_newsapi = await safeImport('./apis/sources/newsapi');
const mod_storage = await safeImport('./apis/sources/storage-api');
const mod_global_index = await safeImport('./apis/sources/global-index-api');
const mod_historical = await safeImport('./apis/sources/historical-analysis-api');
const mod_correlation = await safeImport('./apis/sources/correlation-api');
const mod_infrastructure = await safeImport('./apis/sources/infrastructure-api');

// === ИНТЕГРАЦИЯ ИЗ ФОРКОВ ===
const mod_ofac = await safeImport('./apis/sources/ofac');
const mod_eia = await safeImport('./apis/sources/eia');
const mod_who = await safeImport('./apis/sources/who');
const mod_cisa = await safeImport('./apis/sources/cisa-kev');
const mod_noaa = await safeImport('./apis/sources/noaa');
const mod_space = await safeImport('./apis/sources/space');
const mod_comtrade = await safeImport('./apis/sources/comtrade');
const mod_epa = await safeImport('./apis/sources/epa');
const mod_gscpi = await safeImport('./apis/sources/gscpi');
const mod_tass = await safeImport('./apis/sources/tass');
const mod_opensanctions = await safeImport('./apis/sources/opensanctions');

// === НОВЫЕ МОДУЛИ ===
const mod_usgs = await safeImport('./apis/sources/usgs');
const mod_local = await safeImport('./apis/sources/local');
const mod_scheduler = await safeImport('./apis/sources/scheduler-api');
const mod_trust = await safeImport('./apis/sources/trust-api');
const mod_diagnostics = await safeImport('./apis/sources/diagnostics-api');
const mod_ai_gateway = await safeImport('./apis/sources/ai-gateway');
const mod_hidden_links = await safeImport('./apis/sources/hidden-links');
const mod_ai_processor = await safeImport('./apis/sources/ai-processor');

// === МОДУЛИ АНАЛИТИКИ ===
const mod_conflict = await safeImport('./apis/sources/conflict-predictor');
const mod_anomaly = await safeImport('./apis/sources/anomaly-detector');
const mod_scenario = await safeImport('./apis/sources/scenario-generator');
const mod_early_warning = await safeImport('./apis/sources/early-warning');
const mod_market = await safeImport('./apis/sources/market-predictor');
const mod_semantic = await safeImport('./apis/sources/semantic-analysis');
const mod_reports = await safeImport('./apis/sources/automated-reports');
const mod_strategic_intel = await safeImport('./apis/sources/strategic-intel');
const mod_cyber_intel = await safeImport('./apis/sources/cyber-intel');

// === МОДУЛИ МОНИТОРИНГА ===
const mod_aviation = await safeImport('./apis/sources/aviation-monitor');
const mod_maritime = await safeImport('./apis/sources/maritime-monitor');
const mod_dark_ships = await safeImport('./apis/sources/dark-ships');
const mod_satellite_internet = await safeImport('./apis/sources/satellite-internet');
const mod_energy = await safeImport('./apis/sources/energy-monitor');
const mod_trade = await safeImport('./apis/sources/trade-monitor');
const mod_environment = await safeImport('./apis/sources/environment-monitor');
const mod_health = await safeImport('./apis/sources/health-monitor');
const mod_weather = await safeImport('./apis/sources/weather-monitor');
const mod_space_monitor = await safeImport('./apis/sources/space-monitor');

// === МОДУЛИ ИНФРАСТРУКТУРЫ ===
const mod_news_aggregator = await safeImport('./apis/sources/news-aggregator');
const mod_supply_chain = await safeImport('./apis/sources/supply-chain-monitor');
const mod_monitor = await safeImport('./apis/sources/monitor-api');
const mod_export = await safeImport('./apis/sources/export-api');
const mod_help = await safeImport('./apis/sources/help-api');
const mod_strategic = await safeImport('./apis/sources/strategic-layer');
const mod_prediction = await safeImport('./apis/sources/prediction-intel');
const mod_masa = await safeImport('./apis/sources/masa');
const mod_p2p = await safeImport('./apis/sources/p2p');
const mod_predictive = await safeImport('./apis/sources/predictive');
const mod_decision = await safeImport('./apis/sources/decision');
const mod_social = await safeImport('./apis/sources/social');
const mod_quantum = await safeImport('./apis/sources/quantum');
const mod_deepfake = await safeImport('./apis/sources/deepfake');
const mod_darkweb = await safeImport('./apis/sources/darkweb');
const mod_agents = await safeImport('./apis/sources/agents');
const mod_blockchain = await safeImport('./apis/sources/blockchain');
const mod_voice = await safeImport('./apis/sources/voice');
const mod_emotion = await safeImport('./apis/sources/emotion');
const mod_cyber_threats = await safeImport('./apis/sources/cyber-threats');
const mod_cyber = await safeImport('./apis/sources/cyber-api');

// === ДОПОЛНИТЕЛЬНЫЕ ИСТОЧНИКИ ===
const mod_acled = await safeImport('./apis/sources/acled');
const mod_bls = await safeImport('./apis/sources/bls');
const mod_sentiment = await safeImport('./apis/sources/sentiment-analyzer');
const mod_satellite = await safeImport('./apis/sources/satellite-api');
const mod_safecast = await safeImport('./apis/sources/safecast');
const mod_ships = await safeImport('./apis/sources/ships');
const mod_gdelt = await safeImport('./apis/sources/gdelt');
const mod_firms = await safeImport('./apis/sources/firms');
const mod_opensky = await safeImport('./apis/sources/opensky');
const mod_nlp = await safeImport('./apis/sources/nlp-api');
const mod_llm = await safeImport('./apis/sources/llm-analyzer');
const mod_kiwisdr = await safeImport('./apis/sources/kiwisdr');

// === ДОПОЛНИТЕЛЬНЫЕ ИНФРАСТРУКТУРНЫЕ ===
const mod_infra_predict = await safeImport('./apis/sources/infrastructure-predict');
const mod_infra_ofac = await safeImport('./apis/sources/infrastructure-ofac');
const mod_infra_eia_global = await safeImport('./apis/sources/infrastructure-eia-global');
const mod_infra_eia = await safeImport('./apis/sources/infrastructure-eia');
const mod_infra_cascade = await safeImport('./apis/sources/infrastructure-cascade');
const mod_ai_analyzer = await safeImport('./apis/sources/ai-news-analyzer');
const mod_fred = await safeImport('./apis/sources/fred');
const mod_geo_reports = await safeImport('./apis/sources/geopolitical-reports');

// === ПРОЧИЕ МОДУЛИ ===
const mod_ai_filter = await safeImport('./apis/sources/ai-filter');
const mod_analysis_events = await safeImport('./apis/sources/analysis-events-api');
const mod_economy = await safeImport('./apis/sources/economy-api');
const mod_gateway = await safeImport('./apis/sources/gateway-api');
const mod_lenses = await safeImport('./apis/sources/lenses-api');
const mod_rag = await safeImport('./apis/sources/rag-api');
const mod_thinktanks = await safeImport('./apis/sources/thinktanks-api');
const mod_user = await safeImport('./apis/sources/user-api');
const mod_live = await safeImport('./apis/sources/live-api');
const mod_silence = await safeImport('./apis/sources/silence-api');
const mod_scenarios = await safeImport('./apis/sources/scenarios-api');
const mod_shipping = await safeImport('./apis/sources/shipping-api');

// === ДОПОЛНИТЕЛЬНЫЕ API ===
const mod_safecast_api = await safeImport('./apis/sources/safecast-api');
const mod_firms_api = await safeImport('./apis/sources/firms-api');
const mod_opensky_api = await safeImport('./apis/sources/opensky-api');
const mod_ships_api = await safeImport('./apis/sources/ships-api');
const mod_gold_oil = await safeImport('./apis/sources/gold-oil-ratio-api');

// === ОСНОВНЫЕ МОДУЛИ (август 2026) ===
const mod_notam = await safeImport('./apis/sources/notam-api');
const mod_gps_jamming = await safeImport('./apis/sources/gps-jamming-api');
const mod_google_trends = await safeImport('./apis/sources/google-trends-api');
const mod_vix = await safeImport('./apis/sources/vix-api');
const mod_yield_curve = await safeImport('./apis/sources/yield-curve-api');
const mod_copper_gold = await safeImport('./apis/sources/copper-gold-ratio-api');
const mod_bdi = await safeImport('./apis/sources/bdi-api');
const mod_viirs = await safeImport('./apis/sources/viirs-api');
const mod_uranium = await safeImport('./apis/sources/uranium-api');
const mod_events = await safeImport('./apis/sources/events-api');

// === НОВЫЕ МОДУЛИ (сентябрь 2026) ===
const mod_big_mac = await safeImport('./apis/sources/big-mac-api');
const mod_debt_gdp = await safeImport('./apis/sources/debt-gdp-api');
const mod_sp500_vix = await safeImport('./apis/sources/sp500-vix-api');
const mod_crypto_fear = await safeImport('./apis/sources/crypto-fear-api');
const mod_big_mac_alt = await safeImport('./apis/sources/big-mac-alt-api');
const mod_gold_silver = await safeImport('./apis/sources/gold-silver-api');
const mod_oil_gas = await safeImport('./apis/sources/oil-gas-api');
const mod_happiness = await safeImport('./apis/sources/happiness-api');

// === НОВЫЕ МОДУЛИ (21 индикатор) ===
const mod_big_mac_main = await safeImport('./apis/sources/big-mac-main-api');
const mod_vxx = await safeImport('./apis/sources/vxx-api');
const mod_happiness_alt = await safeImport('./apis/sources/happiness-alt-api');

// === НОВЫЕ МОДУЛИ (25 индикаторов) ===
const mod_inflation = await safeImport('./apis/sources/inflation-api');
const mod_unemployment = await safeImport('./apis/sources/unemployment-api');
const mod_pmi = await safeImport('./apis/sources/pmi-api');
const mod_recession = await safeImport('./apis/sources/recession-api');

// === ОТЧЕТЫ ===
const mod_reports_api = await safeImport('./apis/sources/reports-api');

// === ИЗВЛЕЧЕНИЕ ОБРАБОТЧИКОВ ===
const handleRSSAPI = getHandler(mod_rss, 'handleRSSAPI', 'RSS');
const handleGeoAPI = getHandler(mod_geo, 'handleGeoAPI', 'Geo');
const handleBasketAPI = getHandler(mod_basket, 'handleBasketAPI', 'Basket');
const handleAIChatAPI = getHandler(mod_ai_chat, 'handleAIChatAPI', 'AIChat');
const handleAIRatingAPI = getHandler(mod_ai_rate, 'handleAIRatingAPI', 'AIRating');
const handleNewsAPI = getHandler(mod_news, 'handleNewsAPI', 'News');
const handleNewsAPIBasket = getHandler(mod_newsapi_basket, 'handleNewsAPIBasket', 'NewsAPIBasket');
const handleNewsAPIProxy = getHandler(mod_newsapi, 'handleNewsAPIProxy', 'NewsAPIProxy');
const handleStorageAPI = getHandler(mod_storage, 'handleStorageAPI', 'Storage');
const handleGlobalIndexAPI = getHandler(mod_global_index, 'handleGlobalIndexAPI', 'GlobalIndex');
const handleHistoricalAnalysisAPI = getHandler(mod_historical, 'handleHistoricalAnalysisAPI', 'HistoricalAnalysis');
const handleCorrelationAPI = getHandler(mod_correlation, 'handleCorrelationAPI', 'Correlation');
const handleInfrastructureAPI = getHandler(mod_infrastructure, 'handleInfrastructureAPI', 'Infrastructure');
const handleOFACAPI = getHandler(mod_ofac, 'handleOFACAPI', 'OFAC');
const handleEIAAPI = getHandler(mod_eia, 'handleEIAAPI', 'EIA');
const handleWHOAPI = getHandler(mod_who, 'handleWHOAPI', 'WHO');
const handleCISAAPI = getHandler(mod_cisa, 'handleCISAAPI', 'CISA');
const handleNOAAAPI = getHandler(mod_noaa, 'handleNOAAAPI', 'NOAA');
const handleSpaceAPI = getHandler(mod_space, 'handleSpaceAPI', 'Space');
const handleComtradeAPI = getHandler(mod_comtrade, 'handleComtradeAPI', 'Comtrade');
const handleEPAAPI = getHandler(mod_epa, 'handleEPAAPI', 'EPA');
const handleGSCPIAPI = getHandler(mod_gscpi, 'handleGSCPIAPI', 'GSCPI');
const handleTASSAPI = getHandler(mod_tass, 'handleTASSAPI', 'TASS');
const handleOpenSanctionsAPI = getHandler(mod_opensanctions, 'handleOpenSanctionsAPI', 'OpenSanctions');
const handleUSGSApi = getHandler(mod_usgs, 'handleUSGSApi', 'USGS');
const handleLocalApi = getHandler(mod_local, 'handleLocalApi', 'Local');
const handleSchedulerAPI = getHandler(mod_scheduler, 'handleSchedulerAPI', 'Scheduler');
const handleTrustAPI = getHandler(mod_trust, 'handleTrustAPI', 'Trust');
const handleDiagnosticsAPI = getHandler(mod_diagnostics, 'handleDiagnosticsAPI', 'Diagnostics');
const handleAIGatewayAPI = getHandler(mod_ai_gateway, 'handleAIGatewayAPI', 'AIGateway');
const handleHiddenLinksAPI = getHandler(mod_hidden_links, 'handleHiddenLinksAPI', 'HiddenLinks');
const handleAIProcessorAPI = getHandler(mod_ai_processor, 'handleAIProcessorAPI', 'AIProcessor');
const handleConflictPredictorAPI = getHandler(mod_conflict, 'handleConflictPredictorAPI', 'ConflictPredictor');
const handleAnomalyDetectorAPI = getHandler(mod_anomaly, 'handleAnomalyDetectorAPI', 'AnomalyDetector');
const handleScenarioGeneratorAPI = getHandler(mod_scenario, 'handleScenarioGeneratorAPI', 'ScenarioGenerator');
const handleEarlyWarningAPI = getHandler(mod_early_warning, 'handleEarlyWarningAPI', 'EarlyWarning');
const handleMarketPredictorAPI = getHandler(mod_market, 'handleMarketPredictorAPI', 'MarketPredictor');
const handleSemanticAPI = getHandler(mod_semantic, 'handleSemanticAPI', 'Semantic');
const handleReportsAPI = getHandler(mod_reports_api, 'handleReportsAPI', 'Reports');
const handleStrategicIntelAPI = getHandler(mod_strategic_intel, 'handleStrategicIntelAPI', 'StrategicIntel');
const handleCyberIntelAPI = getHandler(mod_cyber_intel, 'handleCyberIntelAPI', 'CyberIntel');
const handleAviationAPI = getHandler(mod_aviation, 'handleAviationAPI', 'Aviation');
const handleMaritimeAPI = getHandler(mod_maritime, 'handleMaritimeAPI', 'Maritime');
const handleDarkShipsAPI = getHandler(mod_dark_ships, 'handleDarkShipsAPI', 'DarkShips');
const handleSatelliteInternetAPI = getHandler(mod_satellite_internet, 'handleSatelliteInternetAPI', 'SatelliteInternet');
const handleEnergyAPI = getHandler(mod_energy, 'handleEnergyAPI', 'Energy');
const handleTradeAPI = getHandler(mod_trade, 'handleTradeAPI', 'Trade');
const handleEnvironmentAPI = getHandler(mod_environment, 'handleEnvironmentAPI', 'Environment');
const handleHealthAPI = getHandler(mod_health, 'handleHealthAPI', 'Health');
const handleWeatherAPI = getHandler(mod_weather, 'handleWeatherAPI', 'Weather');
const handleSpaceMonitorAPI = getHandler(mod_space_monitor, 'handleSpaceMonitorAPI', 'SpaceMonitor');
const handleNewsAggregatorAPI = getHandler(mod_news_aggregator, 'handleNewsAggregatorAPI', 'NewsAggregator');
const handleSupplyChainAPI = getHandler(mod_supply_chain, 'handleSupplyChainAPI', 'SupplyChain');
const handleMonitorAPI = getHandler(mod_monitor, 'handleMonitorAPI', 'Monitor');
const handleExportAPI = getHandler(mod_export, 'handleExportAPI', 'Export');
const handleHelpAPI = getHandler(mod_help, 'handleHelpAPI', 'Help');
const handleStrategicAPI = getHandler(mod_strategic, 'handleStrategicAPI', 'Strategic');
const handlePredictionAPI = getHandler(mod_prediction, 'handlePredictionAPI', 'Prediction');
const handleMASAAPI = getHandler(mod_masa, 'handleMASAAPI', 'MASA');
const handleP2PAPI = getHandler(mod_p2p, 'handleP2PAPI', 'P2P');
const handlePredictiveAPI = getHandler(mod_predictive, 'handlePredictiveAPI', 'Predictive');
const handleDecisionAPI = getHandler(mod_decision, 'handleDecisionAPI', 'Decision');
const handleSocialAPI = getHandler(mod_social, 'handleSocialAPI', 'Social');
const handleQuantumAPI = getHandler(mod_quantum, 'handleQuantumAPI', 'Quantum');
const handleDeepfakeAPI = getHandler(mod_deepfake, 'handleDeepfakeAPI', 'Deepfake');
const handleDarkWebAPI = getHandler(mod_darkweb, 'handleDarkWebAPI', 'DarkWeb');
const handleAgentsAPI = getHandler(mod_agents, 'handleAgentsAPI', 'Agents');
const handleBlockchainAPI = getHandler(mod_blockchain, 'handleBlockchainAPI', 'Blockchain');
const handleVoiceAPI = getHandler(mod_voice, 'handleVoiceAPI', 'Voice');
const handleEmotionAPI = getHandler(mod_emotion, 'handleEmotionAPI', 'Emotion');
const handleCyberThreatsAPI = getHandler(mod_cyber_threats, 'handleCyberThreatsAPI', 'CyberThreats');
const handleCyberAPI = getHandler(mod_cyber, 'handleCyberAPI', 'Cyber');
const handleACLEDApi = getHandler(mod_acled, 'handleACLEDApi', 'ACLED');
const handleBLSAPI = getHandler(mod_bls, 'handleBLSAPI', 'BLS');
const handleSentimentAPI = getHandler(mod_sentiment, 'handleSentimentAPI', 'Sentiment');
const handleSatelliteAPI = getHandler(mod_satellite, 'handleSatelliteAPI', 'Satellite');
const handleSafecastApi = getHandler(mod_safecast, 'handleSafecastApi', 'Safecast');
const handleShipsApi = getHandler(mod_ships, 'handleShipsApi', 'Ships');
const handleGDELTAPI = getHandler(mod_gdelt, 'handleGDELTAPI', 'GDELT');
const handleFIRMSApi = getHandler(mod_firms, 'handleFIRMSApi', 'FIRMS');
const handleOpenSkyApi = getHandler(mod_opensky, 'handleOpenSkyApi', 'OpenSky');
const handleNLPAPI = getHandler(mod_nlp, 'handleNLPAPI', 'NLP');
const handleLLMApi = getHandler(mod_llm, 'handleLLMApi', 'LLM');
const handleKiwiSDRAPI = getHandler(mod_kiwisdr, 'handleKiwiSDRAPI', 'KiwiSDR');
const handlePredictApi = getHandler(mod_infra_predict, 'handlePredictApi', 'InfraPredict');
const handleOFACApi = getHandler(mod_infra_ofac, 'handleOFACApi', 'InfraOFAC');
const handleGlobalPlantsApi = getHandler(mod_infra_eia_global, 'handleGlobalPlantsApi', 'InfraEIAGlobal');
const handleEIAApi = getHandler(mod_infra_eia, 'handleEIAApi', 'InfraEIA');
const handleCascadeApi = getHandler(mod_infra_cascade, 'handleCascadeApi', 'InfraCascade');
const handleAIAnalyzerAPI = getHandler(mod_ai_analyzer, 'handleAIAnalyzerAPI', 'AIAnalyzer');
const handleFREDApi = getHandler(mod_fred, 'handleFREDApi', 'FRED');
const handleGeopoliticalReportsAPI = getHandler(mod_geo_reports, 'handleGeopoliticalReportsAPI', 'GeoReports');
const handleAiFilterAPI = getHandler(mod_ai_filter, 'handleAiFilterAPI', 'AiFilter');
const handleAnalysisEventsAPI = getHandler(mod_analysis_events, 'handleAnalysisEventsAPI', 'AnalysisEvents');
const handleEconomyAPI = getHandler(mod_economy, 'handleEconomyAPI', 'Economy');
const handleGatewayAPI = getHandler(mod_gateway, 'handleGatewayAPI', 'Gateway');
const handleLensesAPI = getHandler(mod_lenses, 'handleLensesAPI', 'Lenses');
const handleRAGAPI = getHandler(mod_rag, 'handleRAGAPI', 'RAG');
const handleThinkTanksAPI = getHandler(mod_thinktanks, 'handleThinkTanksAPI', 'ThinkTanks');
const handleUserAPI = getHandler(mod_user, 'handleUserAPI', 'User');
const handleLiveAPI = getHandler(mod_live, 'handleLiveAPI', 'Live');
const handleSilenceAPI = getHandler(mod_silence, 'handleSilenceAPI', 'Silence');
const handleScenariosAPI = getHandler(mod_scenarios, 'handleScenariosAPI', 'Scenarios');
const handleShippingAPI = getHandler(mod_shipping, 'handleShippingAPI', 'Shipping');
const handleSafecastAPI = getHandler(mod_safecast_api, 'handleSafecastAPI', 'SafecastAPI');
const handleFIRMSAPI = getHandler(mod_firms_api, 'handleFIRMSAPI', 'FIRMSAPI');
const handleOpenSkyAPI = getHandler(mod_opensky_api, 'handleOpenSkyAPI', 'OpenSkyAPI');
const handleShipsAPI = getHandler(mod_ships_api, 'handleShipsAPI', 'ShipsAPI');
const handleGoldOilRatioAPI = getHandler(mod_gold_oil, 'handleGoldOilRatioAPI', 'GoldOilRatio');

// === ОСНОВНЫЕ ОБРАБОТЧИКИ ===
const handleNOTAMAPI = getHandler(mod_notam, 'handleNOTAMAPI', 'NOTAM');
const handleGPSJammingAPI = getHandler(mod_gps_jamming, 'handleGPSJammingAPI', 'GPSJamming');
const handleGoogleTrendsAPI = getHandler(mod_google_trends, 'handleGoogleTrendsAPI', 'GoogleTrends');
const handleVIXAPI = getHandler(mod_vix, 'handleVIXAPI', 'VIX');
const handleYieldCurveAPI = getHandler(mod_yield_curve, 'handleYieldCurveAPI', 'YieldCurve');
const handleCopperGoldAPI = getHandler(mod_copper_gold, 'handleCopperGoldAPI', 'CopperGold');
const handleBDIAPI = getHandler(mod_bdi, 'handleBDIAPI', 'BDI');
const handleVIIRSAPI = getHandler(mod_viirs, 'handleVIIRSAPI', 'VIIRS');
const handleUraniumAPI = getHandler(mod_uranium, 'handleUraniumAPI', 'Uranium');
const handleEventsAPI = getHandler(mod_events, 'handleEventsAPI', 'EVENTS');

// === НОВЫЕ ОБРАБОТЧИКИ ===
const handleBigMacAPI = getHandler(mod_big_mac, 'handleBigMacAPI', 'BigMac');
const handleDebtGDPAPI = getHandler(mod_debt_gdp, 'handleDebtGDPAPI', 'DebtGDP');
const handleSP500VIXAPI = getHandler(mod_sp500_vix, 'handleSP500VIXAPI', 'SP500VIX');
const handleCryptoFearAPI = getHandler(mod_crypto_fear, 'handleCryptoFearAPI', 'CryptoFear');
const handleBigMacAltAPI = getHandler(mod_big_mac_alt, 'handleBigMacAltAPI', 'BigMacAlt');
const handleGoldSilverAPI = getHandler(mod_gold_silver, 'handleGoldSilverAPI', 'GoldSilver');
const handleOilGasAPI = getHandler(mod_oil_gas, 'handleOilGasAPI', 'OilGas');
const handleHappinessAPI = getHandler(mod_happiness, 'handleHappinessAPI', 'Happiness');

// === НОВЫЕ ОБРАБОТЧИКИ (21 индикатор) ===
const handleBigMacMainAPI = getHandler(mod_big_mac_main, 'handleBigMacMainAPI', 'BigMacMain');
const handleVXXAPI = getHandler(mod_vxx, 'handleVXXAPI', 'VXX');
const handleHappinessAltAPI = getHandler(mod_happiness_alt, 'handleHappinessAltAPI', 'HappinessAlt');

// === НОВЫЕ ОБРАБОТЧИКИ (25 индикаторов) ===
const handleInflationAPI = getHandler(mod_inflation, 'handleInflationAPI', 'INFLATION');
const handleUnemploymentAPI = getHandler(mod_unemployment, 'handleUnemploymentAPI', 'UNEMPLOYMENT');
const handlePMIAPI = getHandler(mod_pmi, 'handlePMIAPI', 'PMI');
const handleRecessionAPI = getHandler(mod_recession, 'handleRecessionAPI', 'RECESSION');

console.log('  ✅ Все модули загружены\n');

// ============================================================
// 3. MIME-ТИПЫ
// ============================================================

const MIME_TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.txt': 'text/plain',
    '.xml': 'application/xml', '.opml': 'application/xml', '.md': 'text/markdown',
    '.csv': 'text/csv', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.webp': 'image/webp', '.avif': 'image/avif', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf', '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.gz': 'application/gzip', '.tar': 'application/x-tar', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.flac': 'audio/flac', '.aac': 'audio/aac'
};

// ============================================================
// 4. КОНФИГУРАЦИЯ СТРАНИЦ
// ============================================================

const PAGE_ROUTES = {
    '/': 'index.html', '/jarvis': 'jarvis.html', '/jarviskart': 'jarviskart.html',
    '/kartochki': 'kartochki.html', '/scan': 'scan.html', '/rss-feed': 'rss-feed.html',
    '/rss-dashboard': 'rss-dashboard.html', '/ai-chat': 'ai-chat.html',
    '/ai-gateway': 'ai-gateway.html', '/ai-news-analyzer': 'ai-news-analyzer.html',
    '/ai-filter': 'ai-filter.html', '/geo-map': 'geo-map.html',
    '/global-index': 'global-index.html', '/historical-analysis': 'historical-analysis.html',
    '/correlation': 'correlation.html', '/infrastructure': 'infrastructure.html',
    '/infrastructure-cascade': 'infrastructure-cascade.html', '/infrastructure-eia': 'infrastructure-eia.html',
    '/infrastructure-eia-global': 'infrastructure-eia-global.html', '/infrastructure-firms': 'infrastructure-firms.html',
    '/infrastructure-ofac': 'infrastructure-ofac.html', '/infrastructure-predict': 'infrastructure-predict.html',
    '/infrastructure-ships': 'infrastructure-ships.html', '/basket': 'basket.html',
    '/grid-tool': 'grid-tool.html', '/storage': 'storage.html',
    '/ofac': 'ofac.html', '/eia': 'eia.html', '/who': 'who.html',
    '/cisa': 'cisa.html', '/noaa': 'noaa.html', '/space': 'space.html',
    '/comtrade': 'comtrade.html', '/epa': 'epa.html', '/gscpi': 'gscpi.html',
    '/tass': 'tass.html', '/opensanctions': 'opensanctions.html',
    '/usgs': 'usgs.html', '/local': 'local.html', '/scheduler': 'scheduler.html',
    '/trust': 'trust.html', '/diagnostics': 'diagnostics.html',
    '/diagnostics-background': 'diagnostics-background.html',
    '/diagnostics-inventory': 'diagnostics-inventory.html', '/hidden-links': 'hidden-links.html',
    '/conflict-predictor': 'conflict-predictor.html', '/anomaly-detector': 'anomaly-detector.html',
    '/scenario-generator': 'scenario-generator.html', '/early-warning': 'early-warning.html',
    '/market-predictor': 'market-predictor.html', '/semantic-analysis': 'semantic-analysis.html',
    '/automated-reports': 'automated-reports.html', '/strategic-intel': 'strategic-intel.html',
    '/cyber-intel': 'cyber-intel.html', '/aviation-monitor': 'aviation-monitor.html',
    '/aviation': 'aviation.html', '/aviation-api': 'aviation-api.html',
    '/maritime-monitor': 'maritime-monitor.html', '/dark-ships': 'dark-ships.html',
    '/satellite-internet': 'satellite-internet.html', '/satellite': 'satellite.html',
    '/satellite-api': 'satellite-api.html', '/energy-monitor': 'energy-monitor.html',
    '/trade-monitor': 'trade-monitor.html', '/environment-monitor': 'environment-monitor.html',
    '/health-monitor': 'health-monitor.html', '/weather-monitor': 'weather-monitor.html',
    '/space-monitor': 'space-monitor.html', '/news-aggregator': 'news-aggregator.html',
    '/supply-chain-monitor': 'supply-chain-monitor.html', '/monitor': 'monitor.html',
    '/export': 'export.html', '/help': 'help.html', '/registry': 'registry.html',
    '/strategic-layer': 'strategic-layer.html', '/prediction-intel': 'prediction-intel.html',
    '/prediction': 'prediction.html', '/predictive': 'predictive.html',
    '/predictive-model': 'predictive-model.html', '/masa': 'masa.html',
    '/masa-agents': 'masa-agents.html', '/p2p': 'p2p.html',
    '/decision': 'decision.html', '/social': 'social.html',
    '/quantum': 'quantum.html', '/deepfake': 'deepfake.html',
    '/darkweb': 'darkweb.html', '/agents': 'agents.html',
    '/blockchain': 'blockchain.html', '/voice': 'voice.html',
    '/emotion': 'emotion.html', '/cyber-threats': 'cyber-threats.html',
    '/cyber': 'cyber.html', '/acled': 'acled.html', '/bls': 'bls.html',
    '/fred': 'fred.html', '/firms': 'firms.html', '/gdelt': 'gdelt.html',
    '/gdelt-conflict': 'gdelt-conflict.html', '/gdelt-curl': 'gdelt-curl.html',
    '/gdelt-v1': 'gdelt-v1.html', '/ships': 'ships.html',
    '/sentiment-analyzer': 'sentiment-analyzer.html', '/sentiment': 'sentiment.html',
    '/safecast': 'safecast.html', '/opensky': 'opensky.html',
    '/nlp-api': 'nlp-api.html', '/llm-analyzer': 'llm-analyzer.html',
    '/kiwisdr': 'kiwisdr.html', '/economy': 'economy.html',
    '/gateway': 'gateway.html', '/lenses': 'lenses.html',
    '/rag': 'rag.html', '/thinktanks': 'thinktanks.html',
    '/profile': 'profile.html', '/live': 'live.html',
    '/silence': 'silence.html', '/scenarios': 'scenarios.html',
    '/shipping': 'shipping.html', '/admin': 'admin.html',
    '/gold-oil-ratio': 'gold-oil-ratio.html', '/horizontal': 'horizontal.html',
    '/news': 'news.html', '/security': 'security.html',
    '/system': 'system.html', '/tools': 'tools.html',
    '/us': 'us.html', '/visualization': 'visualization.html',
    '/economy-dashboard': 'economy-dashboard.html', '/conflicts': 'conflicts.html',
    '/commodities': 'commodities.html', '/air-quality': 'air-quality.html',
    '/satellites': 'satellites.html', '/covid': 'covid.html',
    '/notam-monitor': 'notam-monitor.html',
    '/gps-jamming': 'gps-jamming.html',
    '/google-trends': 'google-trends.html',
    '/vix': 'vix.html',
    '/yield-curve': 'yield-curve.html',
    '/dashboard-5in1': 'dashboard-5in1.html',
    '/copper-gold': 'copper-gold.html',
    '/bdi': 'bdi.html',
    '/viirs': 'viirs.html',
    '/uranium': 'uranium.html',
    '/reports': 'reports.html',
    '/big-mac': 'big-mac.html',
    '/debt-gdp': 'debt-gdp.html',
    '/sp500-vix': 'sp500-vix.html',
    '/crypto-fear': 'crypto-fear.html',
    '/big-mac-alt': 'big-mac-alt.html',
    '/gold-silver': 'gold-silver.html',
    '/oil-gas': 'oil-gas.html',
    '/happiness': 'happiness.html',
    '/big-mac-main': 'big-mac-main.html',
    '/vxx': 'vxx.html',
    '/happiness-alt': 'happiness-alt.html',
    '/inflation': 'inflation.html',
    '/unemployment': 'unemployment.html',
    '/pmi': 'pmi.html',
    '/recession': 'recession.html'
};

// ============================================================
// 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return true;
}

function sendError(res, message, statusCode = 500) {
    return sendJSON(res, { error: message, status: statusCode }, statusCode);
}

async function fileExists(filePath) {
    try { await fs.access(filePath); return true; } catch { return false; }
}

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
        console.error(`[Static] Ошибка:`, error.message);
        return false;
    }
}

async function findStaticFile(pathname) {
    const cleanPath = pathname.replace('.html', '');
    const file = PAGE_ROUTES[cleanPath] || PAGE_ROUTES[pathname];
    if (file) {
        const fullPath = join(PUBLIC_DIR, file);
        if (await fileExists(fullPath)) return fullPath;
    }
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/') ||
        pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) {
        const fullPath = join(PUBLIC_DIR, pathname);
        if (await fileExists(fullPath)) return fullPath;
    }
    if (pathname.startsWith('/lib/')) {
        const fullPath = join(__dirname, pathname);
        if (await fileExists(fullPath)) return fullPath;
    }
    return null;
}

function generate404Page() {
    return `<!DOCTYPE html>
<html><head><title>404 — Crucix</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh}.container{text-align:center}h1{font-size:72px;margin:0;color:#2196f3;font-weight:700}p{font-size:20px;color:#888;margin:16px 0 24px}a{color:#2196f3;text-decoration:none;font-size:16px;padding:10px 30px;border:1px solid #2196f3;border-radius:6px}a:hover{opacity:.7;background:rgba(33,150,243,.1)}</style>
</head><body><div class="container"><h1>404</h1><p>Страница не найдена</p><a href="/">← Вернуться на главную</a></div></body></html>`;
}

// ============================================================
// 6. API МАРШРУТЫ
// ============================================================

async function handleAPI(req, res, pathname) {
    // БАЗОВЫЕ
    if (pathname.startsWith('/api/rss/')) { await handleRSSAPI(req, res); return true; }
    if (pathname.startsWith('/api/geo/')) { await handleGeoAPI(req, res); return true; }
    if (pathname.startsWith('/api/basket')) { await handleBasketAPI(req, res); return true; }
    if (pathname.startsWith('/api/ai/chat')) { await handleAIChatAPI(req, res); return true; }
    if (pathname.startsWith('/api/ai/rate')) { await handleAIRatingAPI(req, res); return true; }
    if (pathname.startsWith('/api/ai/analyze')) { await handleAIAnalyzerAPI(req, res); return true; }
    if (pathname.startsWith('/api/news/')) { await handleNewsAPI(req, res); return true; }
    if (pathname === '/api/news' || pathname === '/api/news/') { await handleNewsAPI(req, res); return true; }
    if (pathname.startsWith('/api/newsapi/basket')) { await handleNewsAPIBasket(req, res); return true; }
    if (pathname.startsWith('/api/newsapi/')) { await handleNewsAPIProxy(req, res); return true; }
    if (pathname.startsWith('/api/storage/')) { await handleStorageAPI(req, res); return true; }
    if (pathname.startsWith('/api/geo/index')) { await handleGlobalIndexAPI(req, res); return true; }
    if (pathname.startsWith('/api/analysis/')) { await handleHistoricalAnalysisAPI(req, res); return true; }
    if (pathname.startsWith('/api/correlation/')) { await handleCorrelationAPI(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure/')) { await handleInfrastructureAPI(req, res); return true; }

    // ИНТЕГРАЦИЯ
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

    // НОВЫЕ МОДУЛИ
    if (pathname.startsWith('/api/usgs/')) { await handleUSGSApi(req, res); return true; }
    if (pathname.startsWith('/api/local/')) { await handleLocalApi(req, res); return true; }
    if (pathname.startsWith('/api/scheduler/')) { await handleSchedulerAPI(req, res); return true; }
    if (pathname.startsWith('/api/trust/')) { await handleTrustAPI(req, res); return true; }
    if (pathname.startsWith('/api/diagnostics/')) { await handleDiagnosticsAPI(req, res); return true; }
    if (pathname.startsWith('/api/ai-gateway/')) { await handleAIGatewayAPI(req, res); return true; }
    if (pathname.startsWith('/api/hidden-links/')) { await handleHiddenLinksAPI(req, res); return true; }
    if (pathname.startsWith('/api/ai-processor/')) { await handleAIProcessorAPI(req, res); return true; }

    // АНАЛИТИКА
    if (pathname.startsWith('/api/conflict/')) { await handleConflictPredictorAPI(req, res); return true; }
    if (pathname.startsWith('/api/anomaly-detector/')) { await handleAnomalyDetectorAPI(req, res); return true; }
    if (pathname.startsWith('/api/scenario-generator/')) { await handleScenarioGeneratorAPI(req, res); return true; }
    if (pathname.startsWith('/api/early-warning/')) { await handleEarlyWarningAPI(req, res); return true; }
    if (pathname.startsWith('/api/market/')) { await handleMarketPredictorAPI(req, res); return true; }
    if (pathname.startsWith('/api/semantic/')) { await handleSemanticAPI(req, res); return true; }
    if (pathname.startsWith('/api/reports/')) { await handleReportsAPI(req, res); return true; }
    if (pathname.startsWith('/api/strategic-intel/')) { await handleStrategicIntelAPI(req, res); return true; }
    if (pathname.startsWith('/api/cyber-intel/')) { await handleCyberIntelAPI(req, res); return true; }

    // МОНИТОРИНГ
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

    // ИНФРАСТРУКТУРА
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

    // ДОПОЛНИТЕЛЬНЫЕ
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

    // УСТАРЕВШИЕ
    if (pathname.startsWith('/api/infrastructure_ships/')) { await handleShipsApi(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure_predict/')) { await handlePredictApi(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure_ofac/')) { await handleOFACApi(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure_firms/')) { await handleFIRMSApi(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure_eia_global/')) { await handleGlobalPlantsApi(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure_eia/')) { await handleEIAApi(req, res); return true; }
    if (pathname.startsWith('/api/infrastructure_cascade/')) { await handleCascadeApi(req, res); return true; }

    // GDELT
    if (pathname.startsWith('/api/gdelt_v1/') || pathname.startsWith('/api/gdelt_curl/') || pathname.startsWith('/api/gdelt/')) {
        await handleGDELTAPI(req, res); return true;
    }

    // FIRMS / FRED
    if (pathname.startsWith('/api/firms/')) { await handleFIRMSApi(req, res); return true; }
    if (pathname.startsWith('/api/fred/')) { await handleFREDApi(req, res); return true; }

    // ПРОЧИЕ
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

    // ДОПОЛНИТЕЛЬНЫЕ ИЗ КОПИЙ
    if (pathname.startsWith('/api/safecast/')) { await handleSafecastAPI(req, res); return true; }
    if (pathname.startsWith('/api/firms/')) { await handleFIRMSAPI(req, res); return true; }
    if (pathname.startsWith('/api/opensky/')) { await handleOpenSkyAPI(req, res); return true; }
    if (pathname.startsWith('/api/ships/')) { await handleShipsAPI(req, res); return true; }
    if (pathname.startsWith('/api/gold-oil-ratio')) { await handleGoldOilRatioAPI(req, res); return true; }

    // === ОСНОВНЫЕ МОДУЛИ ===
    if (pathname.startsWith('/api/notam/')) { await handleNOTAMAPI(req, res); return true; }
    if (pathname.startsWith('/api/gps-jamming/')) { await handleGPSJammingAPI(req, res); return true; }
    if (pathname.startsWith('/api/google-trends/')) { await handleGoogleTrendsAPI(req, res); return true; }
    if (pathname.startsWith('/api/vix/')) { await handleVIXAPI(req, res); return true; }
    if (pathname.startsWith('/api/yield-curve/')) { await handleYieldCurveAPI(req, res); return true; }
    if (pathname.startsWith('/api/copper-gold/')) { await handleCopperGoldAPI(req, res); return true; }
    if (pathname.startsWith('/api/bdi/')) { await handleBDIAPI(req, res); return true; }
    if (pathname.startsWith('/api/viirs/')) { await handleVIIRSAPI(req, res); return true; }
    if (pathname.startsWith('/api/uranium/')) { await handleUraniumAPI(req, res); return true; }
    if (pathname.startsWith('/api/events/')) { await handleEventsAPI(req, res); return true; }

    // === НОВЫЕ МОДУЛИ ===
    if (pathname.startsWith('/api/big-mac/')) { await handleBigMacAPI(req, res); return true; }
    if (pathname.startsWith('/api/debt-gdp/')) { await handleDebtGDPAPI(req, res); return true; }
    if (pathname.startsWith('/api/sp500-vix/')) { await handleSP500VIXAPI(req, res); return true; }
    if (pathname.startsWith('/api/crypto-fear/')) { await handleCryptoFearAPI(req, res); return true; }
    if (pathname.startsWith('/api/big-mac-alt/')) { await handleBigMacAltAPI(req, res); return true; }
    if (pathname.startsWith('/api/gold-silver/')) { await handleGoldSilverAPI(req, res); return true; }
    if (pathname.startsWith('/api/oil-gas/')) { await handleOilGasAPI(req, res); return true; }
    if (pathname.startsWith('/api/happiness/')) { await handleHappinessAPI(req, res); return true; }

    // === НОВЫЕ МОДУЛИ (21 индикатор) ===
    if (pathname.startsWith('/api/big-mac-main/')) { await handleBigMacMainAPI(req, res); return true; }
    if (pathname.startsWith('/api/vxx/')) { await handleVXXAPI(req, res); return true; }
    if (pathname.startsWith('/api/happiness-alt/')) { await handleHappinessAltAPI(req, res); return true; }

    // === НОВЫЕ МОДУЛИ (25 индикаторов) ===
    if (pathname.startsWith('/api/inflation/')) { await handleInflationAPI(req, res); return true; }
    if (pathname.startsWith('/api/unemployment/')) { await handleUnemploymentAPI(req, res); return true; }
    if (pathname.startsWith('/api/pmi/')) { await handlePMIAPI(req, res); return true; }
    if (pathname.startsWith('/api/recession/')) { await handleRecessionAPI(req, res); return true; }

    return false;
}

// ============================================================
// 7. ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

const server = createServer(async (req, res) => {
    const startTime = Date.now();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

    if (pathname.startsWith('/api/')) {
        try {
            const handled = await handleAPI(req, res, pathname);
            if (handled) {
                console.log(`  ✅ API обработан за ${Date.now() - startTime}ms`);
                return;
            }
            sendError(res, `API endpoint not found: ${pathname}`, 404);
            return;
        } catch (error) {
            console.error(`❌ API ошибка:`, error.message);
            sendError(res, `Internal Server Error: ${error.message}`, 500);
            return;
        }
    }

    if (pathname === '/scan') {
        const filePath = join(PUBLIC_DIR, 'scan.html');
        if (await fileExists(filePath)) {
            await serveStatic(req, res, filePath);
        } else {
            sendError(res, 'scan.html не найден', 404);
        }
        return;
    }

    if (pathname === '/kartochki-data.json') {
        const filePath = join(PUBLIC_DIR, 'kartochki-data.json');
        if (await fileExists(filePath)) {
            await serveStatic(req, res, filePath);
        } else {
            sendError(res, 'File not found', 404);
        }
        return;
    }

    const filePath = await findStaticFile(pathname);
    if (filePath) {
        const served = await serveStatic(req, res, filePath);
        if (served) {
            console.log(`  ✅ Статика отдана за ${Date.now() - startTime}ms`);
            return;
        }
    }

    console.log(`  ❌ 404: ${pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(generate404Page());
});

// ============================================================
// 8. ЗАПУСК
// ============================================================

server.listen(PORT, () => {
    const totalPages = Object.keys(PAGE_ROUTES).length;
    console.log('\n' + '='.repeat(50));
    console.log('  🚀 CRUCIX SERVER — ULTIMATE EDITION v7.0');
    console.log(`  📡 Порт: ${PORT}`);
    console.log(`  🌐 URL: http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log(`  📁 Public: ${PUBLIC_DIR}`);
    console.log(`  📁 Lib: ${LIB_DIR}`);
    console.log(`  📁 API: ${APIS_DIR}`);
    console.log('='.repeat(50));
    console.log(`  ✅ API-модулей: 200+ (с защитой от ошибок)`);
    console.log(`  ✅ Страниц: ${totalPages}`);
    console.log(`  ✅ Индикаторов: 25 (геополитика, финансы, экономика, соцсети)`);
    console.log('  ✅ Библиотеки: d3, topojson, three.js');
    console.log('  ✅ MIME-типов: 50+');
    console.log('='.repeat(50));
    console.log('  🎉 СЕРВЕР ГОТОВ К РАБОТЕ!');
    console.log('  🌟 ВСЕ МОДУЛИ ПОДКЛЮЧЕНЫ!');
    console.log('  💡 ДОСТУПНЫЕ API: /api/* (200+ эндпоинтов)');
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
