// ============================================================
// MAPS-CONFIG.JS — фильтр слоёв по типу карты (5 карт Crucix)
// v1.0.0 — 27.09.2026
// Читает window.CrucixMap.mapType и оставляет в window.allLayers
// только те слои, которые относятся к этой карте.
// Загружается ПОСЛЕ layers.js, ПЕРЕД init.js.
// ============================================================

console.log('[maps-config] старт');

// ------------------------------------------------------------
// 1. РЕЕСТР КАТЕГОРИЙ ПО КАРТАМ
//    Каждая карта = набор категорий из DEMO_LAYERS.
//    Слои могут попадать в несколько карт — это нормально.
// ------------------------------------------------------------

const MAP_TYPES = {
  // Event Map — точечные события (маркеры)
  events: [
    'military',
    'geopolitical',
    'cyber',
    'space',
    'health',
    'energy',
    'transport',
    'ecological',
    'news',
    'threats'
  ],
  // Metrics Map — числовые индикаторы (хороплет)
  metrics: [
    'economics',
    'finance',
    'esg'
  ],
  // Semantic Map — NLP, тональность, сущности
  meanings: [
    'semantic',
    'ai',
    'intelligence'
  ],
  // Network Map — граф связей, потоки
  relations: [
    'flow',
    'social'
  ],
  // Forecast Map — прогнозы, детекторы, раннее предупреждение
  forecasts: [
    'forecast',
    'detector',
    'threats'
  ]
};

// ------------------------------------------------------------
// 2. ДОПОЛНИТЕЛЬНЫЙ ФИЛЬТР ПО ID (точные совпадения)
//    Для тех слоёв, которые категориями не разделяются.
// ------------------------------------------------------------

const ID_WHITELIST = {
  events: [
    'timeline', 'animations', 'export-map',
    'conflict-zones', 'exercises', 'military-bases', 'military-exercises',
    'notam', 'nuclear-monitor', 'gps-jamming',
    'acled', 'gdelt-geo', 'social-unrest',
    'air-quality', 'climate', 'earthquakes', 'fires', 'firms', 'floods',
    'forests', 'noaa', 'ocean', 'safecast', 'thermal', 'usgs-eco',
    'viirs', 'agriculture', 'drought', 'volcanoes', 'wildfires',
    'botnets', 'cisa-cyber', 'cve-cyber', 'cyber-attacks', 'darkweb',
    'ddos', 'malware', 'phishing', 'ransomware',
    'aurora', 'oneweb', 'satellites', 'space-data', 'space-debris',
    'starlink', 'spaceports',
    'bbc', 'gdelt-news', 'google-trends', 'interfax', 'ria', 'rss', 'tass',
    'who', 'covid', 'healthcare', 'epidemics',
    'energy-grid', 'eia', 'nuclear', 'renewable', 'oil-gas', 'pipelines',
    'power-grid', 'oil-energy',
    'aviation', 'opensky-transport', 'ships', 'shipping-lanes',
    'shipping-route', 'ports', 'ports-maritime', 'railways', 'highways',
    'maritime', 'cables_34', 'datacenters', 'exchanges',
    'undersea-cables', 'dark-ships', 'fleet', 'internet', 'mobile'
  ],
  metrics: [
    'inflation', 'unemployment', 'gdp', 'pmi', 'recession',
    'trade-balance', 'fred', 'bls', 'comtrade', 'debt-gdp',
    'consumer-confidence',
    'vix', 'vxx', 'dxy', 'tips', 'ovx', 'hy-spread', 'bdi',
    'copper-gold', 'gold-oil', 'gold-silver', 'crypto-fear',
    'sp500-vix', 'yield-curve',
    'big-mac', 'big-mac-alt', 'big-mac-main', 'uranium',
    'gold-price', 'oil-price', 'heatmap-risk',
    'happiness', 'happiness-alt',
    'population', 'refugees', 'urbanization', 'humanitarian',
    'education', 'freedom', 'hdi', 'inequality', 'poverty',
    'press-freedom',
    'country-instability', 'resilience-index'
  ],
  meanings: [
    'hackernews', 'mediacloud', 'reddit', 'gdelt',
    'crucix-media-narrative'
  ],
  relations: [
    'crucix-cyber-nodes', 'crucix-cyber-links',
    'crucix-trade-routes', 'crucix-population-flow',
    'crucix-refugees', 'crucix-social-unrest',
    'crucix-border-crossings', 'crucix-fin-flows',
    'crucix-crypto-trace', 'crucix-shell-companies',
    'crucix-banking'
  ],
  forecasts: [
    'ssi', 'anomalies', 'predict',
    'cyber-attacks-threat', 'ddos-threat', 'malware-threat',
    'phishing-threat', 'ransomware-threat', 'cve-threat',
    'botnets-threat',
    'war-preparation',
    'crucix-anomalies-geo', 'crucix-pattern-life'
  ]
};

// ------------------------------------------------------------
// 3. ФИЛЬТР
//    Возвращает массив слоёв, подходящих под mapType.
// ------------------------------------------------------------

function filterLayersForMap(mapType, allLayers) {
  if (!allLayers || !Array.isArray(allLayers)) return [];
  if (!MAP_TYPES[mapType]) {
    console.warn('[maps-config] неизвестный mapType:', mapType, '— возвращаю все слои');
    return allLayers.slice();
  }

  const cats = MAP_TYPES[mapType];
  const ids = ID_WHITELIST[mapType] || [];
  const idsSet = new Set(ids);

  const filtered = allLayers.filter(function(layer) {
    if (!layer) return false;
    if (idsSet.has(layer.id)) return true;
    if (layer.category && cats.indexOf(layer.category) !== -1) return true;
    return false;
  });

  return filtered;
}

// ------------------------------------------------------------
// 4. ПРИМЕНЕНИЕ К window.allLayers
//    Запускается сразу — layers.js уже загружен (он выше в <head>).
// ------------------------------------------------------------

function applyMapFilter() {
  if (!window.CrucixMap || !window.CrucixMap.mapType) {
    console.warn('[maps-config] window.CrucixMap не найден — фильтр не применён');
    return;
  }
  if (!window.allLayers || !Array.isArray(window.allLayers)) {
    console.warn('[maps-config] window.allLayers не найден — фильтр не применён');
    return;
  }

  const mapType = window.CrucixMap.mapType;
  const before = window.allLayers.length;
  const filtered = filterLayersForMap(mapType, window.allLayers);

  // Сохраняем полный список в отдельное поле — понадобится,
  // если понадобится вернуть все слои обратно.
  window.allLayersFull = window.allLayers.slice();
  window.allLayers = filtered;

  console.log('[maps-config] ' + mapType + ': ' + filtered.length + ' из ' + before + ' слоёв');

  // Обновим счётчик в панели (init.js прочитает это)
  const countEl = document.getElementById('layer-count');
  if (countEl) countEl.textContent = filtered.length;
}

// Применяем сразу (DOM уже частично построен — <head> выполняется)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyMapFilter);
} else {
  applyMapFilter();
}

// Экспорт для отладки
window.filterLayersForMap = filterLayersForMap;
window.MAP_TYPES = MAP_TYPES;
window.ID_WHITELIST = ID_WHITELIST;

console.log('[maps-config] готов');
