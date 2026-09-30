// ============================================================
// FORECAST-ADAPTER.JS — Адаптер вероятностных данных → choropleth
// ============================================================
// Синтез из forecast-adapter.js + forecast-map-adapter.js.
// Вобрано: Jenks (Fisher 1958, Jenks 1963), GVF (Jenks 1963),
//          Cressie 1993 (probabilistic spatial forecasting),
//          Munzner 2014 (Position + Color divergent),
//          Cowan 2001 (5 классов = 4±1 чанк рабочей памяти),
//          proxyMaps из forecast-map-adapter.js.
//
// Key difference: probability + confidence → fill color + opacity.
// ============================================================

console.log('FORECAST-ADAPTER.JS загружен (синтез v2.0)');

const ForecastAdapter = (function() {

    // ============================================================
    // КЛАССИФИКАЦИЯ: Manual breaks (доменные пороги)
    // ============================================================
    function classifyManual(values, breaks) {
        var classes = new Array(values.length).fill(0);
        for (var i = 0; i < values.length; i++) {
            var v = values[i];
            for (var j = 0; j < breaks.length; j++) {
                if (v >= breaks[j]) classes[i] = j + 1;
            }
        }
        return classes;
    }

    // ============================================================
    // КЛАССИФИКАЦИЯ: Jenks Natural Breaks (DP, O(k·n²))
    // Fisher 1958, Jenks 1963
    // ============================================================
    function classifyJenks(values, numClasses) {
        numClasses = numClasses || 5;
        if (values.length < numClasses) {
            return values.map(function(v, i) { return Math.min(i, numClasses - 1); });
        }

        var sorted = values.slice().sort(function(a, b) { return a - b; });
        var n = sorted.length;

        var sdcm = [];
        for (var i = 0; i <= n; i++) {
            sdcm.push(new Array(n + 1).fill(0));
        }

        for (var l = 1; l <= n; l++) {
            var sum = 0, sumSq = 0;
            for (var m = 1; m <= l; m++) {
                var val = sorted[m - 1];
                sum += val;
                sumSq += val * val;
                var variance = sumSq - (sum * sum) / m;
                sdcm[m][l] = (m > 1) ? variance : 0;
            }
        }

        var best = [];
        for (var i2 = 0; i2 <= n; i2++) best.push(new Array(numClasses + 1).fill(Infinity));
        best[0][0] = 0;

        for (var k = 1; k <= numClasses; k++) {
            for (var end = 1; end <= n; end++) {
                for (var start = k - 1; start < end; start++) {
                    var cost = best[start][k - 1] + sdcm[start + 1][end];
                    if (cost < best[end][k]) {
                        best[end][k] = cost;
                    }
                }
            }
        }

        var classes = new Array(n).fill(0);
        var end2 = n, cls = numClasses;
        while (cls > 1) {
            var bestStart = cls - 1, minCost = Infinity;
            for (var start2 = cls - 1; start2 < end2; start2++) {
                var cost2 = best[start2][cls - 1] + sdcm[start2 + 1][end2];
                if (cost2 < minCost) { minCost = cost2; bestStart = start2; }
            }
            for (var idx = bestStart; idx < end2; idx++) classes[idx] = cls - 1;
            end2 = bestStart;
            cls--;
        }

        var result = new Array(values.length);
        var indexedValues = values.map(function(v, i) { return { val: v, idx: i }; });
        indexedValues.sort(function(a, b) { return a.val - b.val; });
        for (var i3 = 0; i3 < n; i3++) {
            result[indexedValues[i3].idx] = classes[i3];
        }
        return result;
    }

    // ============================================================
    // GVF (Goodness of Variable Fit) — Jenks 1963
    // GVF = (SDAM - SDCM) / SDAM, порог > 0.7
    // ============================================================
    function computeGVF(values, classes) {
        var mean = values.reduce(function(a, b) { return a + b; }, 0) / values.length;
        var sdam = values.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0);

        var sdcm = 0;
        var maxClass = Math.max.apply(null, classes);
        for (var c = 0; c <= maxClass; c++) {
            var groupValues = values.filter(function(v, i) { return classes[i] === c; });
            if (groupValues.length === 0) continue;
            var groupMean = groupValues.reduce(function(a, b) { return a + b; }, 0) / groupValues.length;
            sdcm += groupValues.reduce(function(s, v) { return s + (v - groupMean) * (v - groupMean); }, 0);
        }

        return sdam === 0 ? 1 : (sdam - sdcm) / sdam;
    }

    // ============================================================
    // ПРЕОБРАЗОВАНИЕ: probability data → choropleth GeoJSON
    // ============================================================
    function convertToChoropleth(apiData, config) {
        if (!apiData || !apiData.values || apiData.values.length === 0) {
            console.warn('[ForecastAdapter] Нет данных');
            return null;
        }

        var palette = window.getColorPalette ? window.getColorPalette(config.palette) : COLOR_SCHEMES[config.palette];
        var breaks = config.breaks || [20, 40, 60, 80];
        var method = config.method || 'manual';

        var values = apiData.values.map(function(v) { return v.probability; });
        var classes;
        if (method === 'manual') {
            classes = classifyManual(values, breaks);
        } else {
            classes = classifyJenks(values, 5);
        }

        var gvf = computeGVF(values, classes);
        console.log('[ForecastAdapter] GVF = ' + gvf.toFixed(4) + (gvf >= 0.7 ? ' OK' : ' BELOW 0.7'));

        var features = apiData.values.map(function(v, i) {
            var cls = classes[i];
            var color = palette[cls] || palette[0];
            var confidence = v.confidence !== undefined ? v.confidence : 0.7;
            var fillOpacity = 0.4 + 0.5 * Math.min(Math.max(confidence, 0), 1);

            return {
                name: v.country,
                value: v.probability,
                confidence: confidence,
                horizon_days: v.horizon_days || 30,
                properties: {
                    name: v.country,
                    value: v.probability,
                    class: cls,
                    fillColor: color,
                    fillOpacity: fillOpacity,
                    confidence: confidence,
                    horizon: v.horizon_days || 30
                }
            };
        });

        return {
            type: 'FeatureCollection',
            features: features,
            metadata: {
                method: method,
                breaks: breaks,
                palette: config.palette,
                gvf: gvf,
                classes: 5
            }
        };
    }

    // ============================================================
    // КАРТА ПРОКСИ: country → probability (для AI-прогнозов)
    // ============================================================
    var PROXY_MAPS = {
        'ai-forecasts-api': {
            type: 'economic_weight',
            countries: {
                'США': 1.0, 'Китай': 0.95, 'Германия': 0.8, 'Япония': 0.75,
                'Великобритания': 0.7, 'Франция': 0.65, 'Индия': 0.6, 'Канада': 0.55,
                'Италия': 0.5, 'Бразилия': 0.45, 'Южная Корея': 0.5, 'Австралия': 0.45,
                'Россия': 0.55, 'Турция': 0.4, 'Мексика': 0.4, 'Индонезия': 0.35
            },
            transform: 'probability_weighted'
        },
        'central-bank-predictor-api': {
            type: 'developed_markets',
            countries: {
                'США': 1.0, 'Евросоюз': 0.9, 'Япония': 0.85, 'Великобритания': 0.8,
                'Канада': 0.75, 'Австралия': 0.7, 'Швейцария': 0.65, 'Швеция': 0.55,
                'Норвегия': 0.5, 'Новая Зеландия': 0.45
            },
            transform: 'probability_weighted'
        },
        'social-briefing-api': {
            type: 'country_risk',
            countries: {
                'Россия': 0.85, 'Украина': 0.95, 'Беларусь': 0.75, 'Иран': 0.8,
                'Сирия': 0.95, 'Афганистан': 0.9, 'Мьянма': 0.85, 'Судан': 0.9,
                'Венесуэла': 0.85, 'Гаити': 0.9, 'Йемен': 0.95, 'Эфиопия': 0.8
            },
            transform: 'risk_indicator'
        },
        'social-briefing-engine-api': {
            type: 'country_risk_extended',
            countries: {
                'Россия': 0.85, 'Украина': 0.95, 'Тайвань': 0.6, 'Израиль': 0.7,
                'Палестина': 0.95, 'Ливан': 0.85, 'Ирак': 0.8, 'Пакистан': 0.75,
                'Нигерия': 0.7, 'Мали': 0.85, 'Сомали': 0.9, 'Ливия': 0.85
            },
            transform: 'risk_indicator'
        }
    };

    // ============================================================
    // ТРАНСФОРМАЦИИ
    // ============================================================
    function applyTransform(globalValue, weight, transformType) {
        switch (transformType) {
            case 'probability_weighted':
                return Math.min(100, globalValue * weight);
            case 'risk_indicator':
                return Math.min(100, globalValue * weight);
            default:
                return globalValue;
        }
    }

    // ============================================================
    // ГЕНЕРАЦИЯ: API series → spatial data
    // ============================================================
    function generateFromSeries(apiResponse, layerId) {
        var proxy = PROXY_MAPS[layerId];
        if (!proxy) {
            console.warn('[ForecastAdapter] Нет proxy для ' + layerId);
            return null;
        }

        var globalValue = 50;
        var confidence = 0.7;
        var horizonDays = 30;

        if (apiResponse && typeof apiResponse === 'object') {
            if (apiResponse.value !== undefined) globalValue = apiResponse.value;
            if (apiResponse.probability !== undefined) globalValue = apiResponse.probability;
            if (apiResponse.confidence !== undefined) confidence = apiResponse.confidence;
            if (apiResponse.horizon_days !== undefined) horizonDays = apiResponse.horizon_days;
        }

        var values = [];
        Object.keys(proxy.countries).forEach(function(country) {
            var weight = proxy.countries[country];
            var prob = applyTransform(globalValue, weight, proxy.transform);
            values.push({
                country: country,
                probability: prob,
                confidence: confidence,
                horizon_days: horizonDays
            });
        });

        return { values: values };
    }

    // ============================================================
    // СОВМЕСТИМОСТЬ: convert (старый API из forecast-map-adapter.js)
    // ============================================================
    function convert(layerId, seriesData) {
        return generateFromSeries(seriesData, layerId);
    }

    return {
        convertToChoropleth: convertToChoropleth,
        generateFromSeries: generateFromSeries,
        classifyManual: classifyManual,
        classifyJenks: classifyJenks,
        computeGVF: computeGVF,
        convert: convert
    };
})();

window.ForecastAdapter = ForecastAdapter;
console.log('FORECAST-ADAPTER.JS готов (4 proxy, 2 трансформации, 5 методов)');
