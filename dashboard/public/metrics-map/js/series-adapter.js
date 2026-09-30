// ============================================================
// SERIES-ADAPTER.JS — series → choropleth
// ============================================================
// 14 модулей series (глобальные финансовые индикаторы)
// преобразуются в choropleth через spatial proxy (Tobler 1970).
// ============================================================

console.log('🔀 SERIES-ADAPTER.JS загружен (14 модулей)');

// ============================================================
// 1. SPATIAL PROXY — карты весов стран
// ============================================================

const SPATIAL_PROXIES = {
    copper_producers: {
        'Chile': 1.0, 'Peru': 0.85, 'China': 0.7, 'USA': 0.65, 'Australia': 0.6,
        'Russia': 0.55, 'Congo': 0.5, 'Zambia': 0.4, 'Mexico': 0.35, 'Canada': 0.3
    },
    oil_producers: {
        'USA': 1.0, 'Saudi Arabia': 0.95, 'Russia': 0.9, 'Canada': 0.85,
        'Iran': 0.75, 'Iraq': 0.7, 'UAE': 0.65, 'Kuwait': 0.6, 'Brazil': 0.55,
        'Nigeria': 0.5, 'Venezuela': 0.45, 'Norway': 0.4, 'Kazakhstan': 0.35
    },
    financial_centers: {
        'USA': 1.0, 'United Kingdom': 0.95, 'Japan': 0.85, 'China': 0.8,
        'Switzerland': 0.75, 'Singapore': 0.7, 'Hong Kong': 0.65,
        'Germany': 0.6, 'France': 0.55, 'Luxembourg': 0.5
    },
    developed_markets: {
        'USA': 1.0, 'Germany': 0.9, 'Japan': 0.9, 'United Kingdom': 0.85,
        'France': 0.8, 'Canada': 0.75, 'Australia': 0.7, 'Switzerland': 0.7,
        'Netherlands': 0.65, 'Sweden': 0.6, 'Norway': 0.55, 'Denmark': 0.5,
        'Finland': 0.45, 'Austria': 0.4, 'Belgium': 0.4, 'Ireland': 0.35
    },
    crypto_adoption: {
        'USA': 1.0, 'Nigeria': 0.9, 'Vietnam': 0.85, 'India': 0.8, 'Turkey': 0.75,
        'Brazil': 0.7, 'Philippines': 0.65, 'Indonesia': 0.6,
        'Argentina': 0.55, 'Thailand': 0.5, 'South Africa': 0.45, 'Russia': 0.4,
        'Ukraine': 0.35, 'Pakistan': 0.3
    },
    us_market: {
        'USA': 1.0
    },
    all_countries: null // спец. случай — распределяем равномерно
};

// ============================================================
// 2. ТРАНСФОРМАЦИИ
// ============================================================

const TRANSFORMS = {
    weighted_value: function(globalValue, weight) {
        return globalValue * weight;
    },

    stress_indicator: function(globalValue, weight) {
        // Высокий стресс → больше значение
        return globalValue * weight;
    },

    ratio_indicator: function(globalValue, weight) {
        // Risk-on/risk-off: положительный ratio = risk-on
        return globalValue * weight;
    },

    yield_curve_signal: function(globalValue, weight) {
        // Инверсия (отрицательный spread) → красный
        return globalValue * weight;
    },

    sentiment_indicator: function(globalValue, weight) {
        return globalValue * weight;
    },

    spread_indicator: function(globalValue, weight) {
        // Расширение спреда = напряжение
        return globalValue * weight;
    }
};

// ============================================================
// 3. КОНФИГУРАЦИЯ МОДУЛЕЙ
// ============================================================

const MODULE_CONFIG = {
    'business-optimism-api':       { proxy: 'us_market',        transform: 'weighted_value',     range: [30, 70] },
    'consumer-expectations-api':   { proxy: 'us_market',        transform: 'weighted_value',     range: [60, 120] },
    'pmi-api':                     { proxy: 'all_countries',    transform: 'weighted_value',     range: [40, 60] },
    'recession-api':               { proxy: 'developed_markets', transform: 'stress_indicator',   range: [0, 100] },
    'copper-gold-ratio-api':       { proxy: 'copper_producers', transform: 'ratio_indicator',    range: [0.5, 2.0] },
    'hy-spread-api':               { proxy: 'us_market',        transform: 'stress_indicator',   range: [200, 800] },
    'ovx-api':                     { proxy: 'oil_producers',    transform: 'stress_indicator',   range: [20, 80] },
    'rublev-dubai-api':            { proxy: 'all_countries',    transform: 'weighted_value',     range: [50, 150] },
    'sp500-vix-api':               { proxy: 'financial_centers', transform: 'ratio_indicator',   range: [20, 100] },
    'vxx-api':                     { proxy: 'financial_centers', transform: 'stress_indicator',  range: [10, 60] },
    'yield-curve-api':             { proxy: 'developed_markets', transform: 'yield_curve_signal', range: [-2, 3] },
    'crypto-fear-api':             { proxy: 'crypto_adoption',  transform: 'sentiment_indicator', range: [0, 100] },
    'cyber-threat-index-api':      { proxy: 'all_countries',    transform: 'stress_indicator',   range: [0, 100] },
    'wti-brent-spread-api':        { proxy: 'oil_producers',    transform: 'spread_indicator',   range: [-5, 15] }
};

// ============================================================
// 4. CLASSIFICATION (Jenks, Quantile, Equal, SD, Manual)
// ============================================================

function jenksBreaks(values, numClasses) {
    const data = values.slice().sort((a, b) => a - b);
    const n = data.length;
    const k = numClasses;

    if (n <= k) {
        return data.slice(0, k + 1);
    }

    // Матрицы динамического программирования
    const mat1 = Array(n + 1).fill(0).map(() => Array(k + 1).fill(0));
    const mat2 = Array(n + 1).fill(0).map(() => Array(k + 1).fill(0));

    // Инициализация
    for (let i = 1; i <= k; i++) {
        mat1[1][i] = 1;
        mat2[1][i] = 0;
        for (let j = 2; j <= n; j++) {
            mat2[j][i] = Infinity;
        }
    }

    let v = 0;
    for (let l = 2; l <= n; l++) {
        let s1 = 0;
        let s2 = 0;
        let w = 0;
        for (let m = 1; m <= l; m++) {
            const i3 = l - m + 1;
            const val = data[i3 - 1];
            s2 += val * val;
            s1 += val;
            w++;
            v = s2 - (s1 * s1) / w;
            const i4 = i3 - 1;
            if (i4 !== 0) {
                for (let j = 2; j <= k; j++) {
                    if (mat2[l][j] >= (v + mat2[i4][j - 1])) {
                        mat1[l][j] = i3;
                        mat2[l][j] = v + mat2[i4][j - 1];
                    }
                }
            }
        }
        mat1[l][1] = 1;
        mat2[l][1] = v;
    }

    const breaks = Array(k + 1).fill(0);
    breaks[k] = data[n - 1];
    breaks[0] = data[0];

    let kk = n;
    for (let j = k; j >= 2; j--) {
        const id = mat1[kk][j] - 2;
        breaks[j - 1] = data[id];
        kk = mat1[kk][j] - 1;
    }

    return breaks;
}

function quantileBreaks(values, numClasses) {
    const data = values.slice().sort((a, b) => a - b);
    const breaks = [];
    for (let i = 0; i <= numClasses; i++) {
        const idx = Math.min(Math.floor(i * data.length / numClasses), data.length - 1);
        breaks.push(data[idx]);
    }
    return breaks;
}

function equalIntervalBreaks(values, numClasses) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / numClasses;
    const breaks = [];
    for (let i = 0; i <= numClasses; i++) {
        breaks.push(min + step * i);
    }
    return breaks;
}

function standardDeviationBreaks(values, numClasses) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    if (numClasses === 5) {
        return [mean - 1.5 * sd, mean - 0.5 * sd, mean + 0.5 * sd, mean + 1.5 * sd];
    }
    return [mean - sd, mean, mean + sd];
}

function computeGVF(values, breaks) {
    if (!values || values.length === 0 || !breaks || breaks.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sdam = values.reduce((s, v) => s + (v - mean) ** 2, 0);
    if (sdam === 0) return 1;

    let sdcm = 0;
    for (let i = 0; i < breaks.length - 1; i++) {
        const cls = values.filter(v => v >= breaks[i] && v < breaks[i + 1]);
        if (cls.length === 0) continue;
        const cm = cls.reduce((s, v) => s + v, 0) / cls.length;
        sdcm += cls.reduce((s, v) => s + (v - cm) ** 2, 0);
    }
    return (sdam - sdcm) / sdam;
}

// ============================================================
// 5. CONVERT — главная функция
// ============================================================

window.SeriesAdapter = {
    SPATIAL_PROXIES,
    TRANSFORMS,
    MODULE_CONFIG,
    classify: { jenksBreaks, quantileBreaks, equalIntervalBreaks, standardDeviationBreaks },
    computeGVF,

    /**
     * Преобразует series-данные в choropleth-features.
     * @param {string} layerId — ID модуля (например 'pmi-api')
     * @param {object} seriesData — { value, timestamp, ... }
     * @param {array} countries — массив window.ALL_COUNTRIES
     * @returns {object} — { features: [{name, value}], breaks, palette, gvf, method }
     */
    convert: function(layerId, seriesData, countries) {
        const config = MODULE_CONFIG[layerId];
        if (!config) {
            console.warn(`[SeriesAdapter] Нет конфигурации для ${layerId}`);
            return null;
        }

        const globalValue = seriesData?.value ?? seriesData?.series?.[0]?.value ?? 0;
        const proxy = SPATIAL_PROXIES[config.proxy];
        const transform = TRANSFORMS[config.transform];

        if (!transform) {
            console.warn(`[SeriesAdapter] Нет трансформации ${config.transform}`);
            return null;
        }

        // Формируем features по странам
        const features = [];
        const allCountries = countries || window.ALL_COUNTRIES || [];

        if (config.proxy === 'all_countries') {
            // Распределяем равномерно, с небольшим шумом по региону
            for (const c of allCountries) {
                const noise = 0.9 + Math.random() * 0.2; // ±10% вариация
                features.push({
                    name: c.name,
                    value: transform(globalValue, noise),
                    lat: c.lat,
                    lng: c.lng
                });
            }
        } else {
            // Только страны из proxy
            for (const [countryName, weight] of Object.entries(proxy)) {
                const country = allCountries.find(c =>
                    c.name === countryName || c.name === translateName(countryName)
                );
                if (country) {
                    features.push({
                        name: country.name,
                        value: transform(globalValue, weight),
                        lat: country.lat,
                        lng: country.lng
                    });
                }
            }
        }

        if (features.length === 0) {
            console.warn(`[SeriesAdapter] Нет features для ${layerId}`);
            return null;
        }

        // Классификация
        const values = features.map(f => f.value);
        const configCls = window.getLayerConfig ? window.getLayerConfig(layerId) : {};
        const numClasses = window.CHOROPLETH_DEFAULTS?.numClasses || 5;
        const method = configCls.method || 'jenks';

        let breaks;
        if (method === 'jenks')           breaks = jenksBreaks(values, numClasses);
        else if (method === 'quantile')   breaks = quantileBreaks(values, numClasses);
        else if (method === 'equal')      breaks = equalIntervalBreaks(values, numClasses);
        else if (method === 'sd')         breaks = standardDeviationBreaks(values, numClasses);
        else if (method === 'manual' && configCls.manualBreaks) breaks = configCls.manualBreaks;
        else                              breaks = jenksBreaks(values, numClasses);

        const gvf = computeGVF(values, breaks);
        const paletteName = configCls.palette || 'Blues';
        const palette = window.getColorPalette ? window.getColorPalette(paletteName) : null;

        return {
            features,
            breaks,
            palette,
            paletteName,
            method,
            gvf,
            globalValue,
            proxy: config.proxy,
            transform: config.transform
        };
    }
};

// ============================================================
// 6. ХЕЛПЕР: перевод названий стран
// ============================================================

function translateName(en) {
    const map = {
        'United States': 'США', 'United Kingdom': 'Великобритания',
        'Russia': 'Россия', 'China': 'Китай', 'Germany': 'Германия',
        'France': 'Франция', 'Japan': 'Япония', 'South Korea': 'Южная Корея',
        'North Korea': 'Северная Корея', 'Saudi Arabia': 'Саудовская Аравия',
        'South Africa': 'ЮАР', 'Vietnam': 'Вьетнам', 'Philippines': 'Филиппины',
        'Indonesia': 'Индонезия', 'Turkey': 'Турция', 'Iran': 'Иран',
        'Iraq': 'Ирак', 'Ukraine': 'Украина', 'Poland': 'Польша',
        'Netherlands': 'Нидерланды', 'Sweden': 'Швеция', 'Norway': 'Норвегия',
        'Denmark': 'Дания', 'Finland': 'Финляндия', 'Austria': 'Австрия',
        'Belgium': 'Бельгия', 'Ireland': 'Ирландия', 'Switzerland': 'Швейцария',
        'Singapore': 'Сингапур', 'Hong Kong': 'Гонконг', 'Luxembourg': 'Люксембург',
        'Congo': 'ДР Конго', 'Zambia': 'Замбия', 'Kazakhstan': 'Казахстан',
        'Venezuela': 'Венесуэла', 'Argentina': 'Аргентина', 'Thailand': 'Таиланд',
        'Pakistan': 'Пакистан', 'India': 'Индия', 'Brazil': 'Бразилия',
        'Chile': 'Чили', 'Peru': 'Перу', 'Mexico': 'Мексика', 'Canada': 'Канада',
        'Australia': 'Австралия', 'Egypt': 'Египет', 'Kuwait': 'Кувейт',
        'UAE': 'ОАЭ'
    };
    return map[en] || en;
}

console.log('✅ SERIES-ADAPTER.JS готов (' + Object.keys(MODULE_CONFIG).length + ' модулей)');
