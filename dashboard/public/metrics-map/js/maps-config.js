// ============================================================
// MAPS-CONFIG.JS — Конфигурация Metrics Map
// ============================================================
// Ответственность: MAP_TYPES, COLOR_SCHEMES, LAYER_CLASSIFICATION,
// CHOROPLETH_DEFAULTS. Никакой логики рендеринга (SRP).
// ============================================================

console.log('⚙️ MAPS-CONFIG.JS загружен (metrics)');

// ============================================================
// 1. КАРТЫ И ИХ КАТЕГОРИИ
// ============================================================

window.MAP_TYPES = {
    metrics: [
        'economics', 'finance', 'esg', 'cyber', 'energy',
        'health', 'social', 'geopolitical', 'military',
        'threats', 'intelligence', 'news', 'other'
    ]
};

// ============================================================
// 2. КЛАССИФИКАЦИЯ CHOROPLETH ПО УМОЛЧАНИЮ
// ============================================================
// Cowan 2001: 5 классов = 4±1 чанка рабочей памяти.

window.CHOROPLETH_DEFAULTS = Object.freeze({
    numClasses: 5,
    method: 'jenks',
    palette: 'Blues',
    gvfThreshold: 0.7
});

// ============================================================
// 3. ПАЛИТРЫ COLORBREWER (Brewer 2005)
// ============================================================

window.COLOR_SCHEMES = {
    sequential: {
        Blues:    ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"],
        YlOrRd:   ["#ffffcc", "#fed976", "#fd8d3c", "#f03b20", "#bd0026"],
        Greens:   ["#f7fcf5", "#bae4b3", "#74c476", "#238b45", "#00441b"],
        Oranges:  ["#fff5eb", "#fdd0a2", "#fd8d3c", "#d94701", "#7f2704"],
        Purples:  ["#f1eef6", "#bdc9e1", "#756bb1", "#54278f", "#2d004b"],
        BuPu:     ["#edf8fb", "#b3cde3", "#8c96c6", "#88419d", "#4d004b"],
        OrRd:     ["#fff7ec", "#fee8c8", "#fdbb84", "#fc8d59", "#e34a33"]
    },
    diverging: {
        RdYlGn5:  ["#d73027", "#fc8d59", "#fee08b", "#91cf60", "#1a9850"],
        RdBu5:    ["#ca0020", "#f4a582", "#f7f7f7", "#92c5de", "#0571b0"],
        BrBG5:    ["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"],
        PiYG5:    ["#d01c8b", "#f1b6da", "#f7f7f7", "#b8e186", "#4dac26"]
    }
};

// ============================================================
// 4. КЛАССИФИКАЦИЯ СЛОЁВ — ПЕРЕОПРЕДЕЛЕНИЯ
// ============================================================
// Правило: если у слоя есть доменный порог (например, ISM 50 для PMI),
// используем manual breaks — домен важнее статистической оптимальности.

window.LAYER_CLASSIFICATION = {
    // ---- ECONOMICS ----
    'inflation': {
        method: 'jenks', palette: 'OrRd',
        rationale: 'Инфляция не имеет доменного порога — Jenks оптимален'
    },
    'unemployment': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Безработица — стандартный Jenks'
    },
    'gdp': {
        method: 'jenks', palette: 'Greens',
        rationale: 'ВВП — плавная шкала, Jenks'
    },
    'pmi': {
        method: 'manual', palette: 'RdYlGn5',
        manualBreaks: [42, 47, 53, 58],
        rationale: 'ISM 50 = граница сжатия/расширения, домен важнее GVF'
    },
    'recession': {
        method: 'manual', palette: 'YlOrRd',
        manualBreaks: [20, 40, 60, 80],
        rationale: 'Пороги уверенности 20/40/60/80'
    },
    'trade-balance': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Торговый баланс — diverging (профицит/дефицит)'
    },
    'debt-gdp': {
        method: 'jenks', palette: 'OrRd',
        rationale: 'Долг/ВВП — sequential (выше = хуже)'
    },
    'consumer-confidence': {
        method: 'jenks', palette: 'RdYlGn5',
        rationale: 'Доверие — diverging (пессимизм/оптимизм)'
    },
    'business-optimism-api': {
        method: 'jenks', palette: 'RdYlGn5',
        rationale: 'Оптимизм — diverging'
    },
    'consumer-expectations-api': {
        method: 'jenks', palette: 'RdYlGn5',
        rationale: 'Ожидания — diverging'
    },
    'pmi-api': {
        method: 'manual', palette: 'RdYlGn5',
        manualBreaks: [42, 47, 53, 58],
        rationale: 'ISM 50 = доменный порог (как pmi)'
    },
    'recession-api': {
        method: 'manual', palette: 'YlOrRd',
        manualBreaks: [20, 40, 60, 80],
        rationale: 'Пороги уверенности (как recession)'
    },

    // ---- FINANCE ----
    'dxy': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'DXY — diverging (risk-on/risk-off)'
    },
    'tips': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Реальные ставки — diverging'
    },
    'hy-spread': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'HY спреды — стресс, sequential'
    },
    'copper-gold': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Медь/золото — опережающий индикатор, diverging'
    },
    'gold-oil': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Золото/нефть — diverging'
    },
    'gold-silver': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Золото/серебро — diverging'
    },
    'yield-curve': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Кривая доходности — инверсия = красный, diverging'
    },
    'big-mac': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Биг-Мак — недо/переоценка, diverging'
    },
    'big-mac-alt': { method: 'jenks', palette: 'RdBu5' },
    'big-mac-main': { method: 'jenks', palette: 'RdBu5' },
    'uranium': {
        method: 'jenks', palette: 'Purples',
        rationale: 'Цена урана — sequential'
    },
    'copper-gold-ratio-api': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Опережающий индикатор — diverging'
    },
    'hy-spread-api': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Стресс-индикатор'
    },
    'ovx-api': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Волатильность нефти = стресс'
    },
    'rublev-dubai-api': {
        method: 'jenks', palette: 'RdYlGn5',
        rationale: 'Реальный курс — diverging'
    },
    'sp500-vix-api': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Risk-on/risk-off — diverging'
    },
    'vxx-api': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Стресс-индикатор'
    },
    'yield-curve-api': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Инверсия = красный'
    },
    'crypto-fear-api': {
        method: 'jenks', palette: 'RdYlGn5',
        rationale: 'Крипто-страх — diverging (fear/greed)'
    },

    // ---- GEOPOLITICAL ----
    'social-unrest': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Социальная напряжённость = стресс'
    },
    'corruption': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Коррупция — sequential (выше = хуже)'
    },
    'democracy': {
        method: 'jenks', palette: 'RdYlGn5',
        rationale: 'Демократия — diverging'
    },
    'country-instability': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Нестабильность — sequential'
    },
    'resilience-index': {
        method: 'jenks', palette: 'Greens',
        rationale: 'Устойчивость — sequential (выше = лучше)'
    },
    'strategic-risk-composite': {
        method: 'manual', palette: 'YlOrRd',
        manualBreaks: [20, 40, 60, 80],
        rationale: 'Композитный риск — 4 порога'
    },

    // ---- ESG ----
    'happiness': { method: 'jenks', palette: 'RdYlGn5' },
    'happiness-alt': { method: 'jenks', palette: 'RdYlGn5' },
    'population': { method: 'jenks', palette: 'Purples' },
    'refugees': { method: 'jenks', palette: 'OrRd' },
    'urbanization': { method: 'jenks', palette: 'Blues' },
    'who': { method: 'jenks', palette: 'Greens' },
    'covid': { method: 'jenks', palette: 'YlOrRd' },
    'hdi': { method: 'jenks', palette: 'Greens' },

    // ---- HEALTH ----
    'who-health': { method: 'jenks', palette: 'Greens' },
    'covid-health': { method: 'jenks', palette: 'YlOrRd' },
    'healthcare-health': { method: 'jenks', palette: 'Greens' },

    // ---- CYBER ----
    'cve-cyber': {
        method: 'jenks', palette: 'YlOrRd',
        rationale: 'Уязвимости = угроза'
    },
    'cyber-threat-index-api': {
        method: 'jenks', palette: 'OrRd',
        rationale: 'Киберугрозы = стресс'
    },

    // ---- ENERGY ----
    'eia': { method: 'jenks', palette: 'Oranges' },
    'nuclear': { method: 'jenks', palette: 'Purples' },
    'renewable': { method: 'jenks', palette: 'Greens' },
    'oil-gas': { method: 'jenks', palette: 'Oranges' },
    'wti-brent-spread-api': {
        method: 'jenks', palette: 'RdBu5',
        rationale: 'Спред — diverging (напряжение)'
    },

    // ---- MILITARY ----
    'military-spending': {
        method: 'jenks', palette: 'OrRd',
        rationale: 'Расходы = стресс'
    },
    'war-preparation': {
        method: 'manual', palette: 'YlOrRd',
        manualBreaks: [20, 40, 60, 80],
        rationale: 'Подготовка — 4 порога'
    },

    // ---- THREATS ----
    'cve-threat': { method: 'jenks', palette: 'OrRd' },

    // ---- OTHER ----
    'internet': { method: 'jenks', palette: 'Blues' },
    'mobile': { method: 'jenks', palette: 'Blues' },
    'google-trends': { method: 'jenks', palette: 'OrRd' },

    // ---- INTELLIGENCE ----
    'crucix-pattern-life': { method: 'jenks', palette: 'BuPu' },

    // ---- SOCIAL ----
    'crucix-population-flow': { method: 'jenks', palette: 'Oranges' },
    'crucix-refugees': { method: 'jenks', palette: 'OrRd' },
    'crucix-phone-activity': { method: 'jenks', palette: 'Blues' },

    // ---- FINANCE / CRUCIX ----
    'crucix-banking': { method: 'jenks', palette: 'Greens' }
};

// ============================================================
// 5. API-МОДУЛИ (series → choropleth)
// ============================================================

window.SERIES_MODULES = [
    'business-optimism-api', 'consumer-expectations-api',
    'pmi-api', 'recession-api',
    'copper-gold-ratio-api', 'hy-spread-api', 'ovx-api',
    'rublev-dubai-api', 'sp500-vix-api', 'vxx-api',
    'yield-curve-api', 'crypto-fear-api',
    'cyber-threat-index-api', 'wti-brent-spread-api'
];

// ============================================================
// 6. API ДЛЯ ДРУГИХ МОДУЛЕЙ
// ============================================================

window.getLayerConfig = function(layerId) {
    return window.LAYER_CLASSIFICATION[layerId] || {
        method: window.CHOROPLETH_DEFAULTS.method,
        palette: window.CHOROPLETH_DEFAULTS.palette,
        rationale: 'default'
    };
};

window.getColorPalette = function(name) {
    if (window.COLOR_SCHEMES.sequential[name]) return window.COLOR_SCHEMES.sequential[name];
    if (window.COLOR_SCHEMES.diverging[name]) return window.COLOR_SCHEMES.diverging[name];
    return window.COLOR_SCHEMES.sequential.Blues;
};

console.log('✅ MAPS-CONFIG.JS готов (' +
    Object.keys(window.LAYER_CLASSIFICATION).length + ' переопределений, ' +
    window.SERIES_MODULES.length + ' API-модулей)');
