// ============================================================
// FORECAST-MAP.JS — Оркестратор Forecast Map (v3.3)
// ============================================================
// Канал: Position + Color intensity + Transparency (Munzner 2014)
// Fallback: детерминированный seed (Cressie 1993)
// opacity = 0.4 + 0.5 * confidence
// Защита fetch: AbortController (таймаут 8000 мс)
// v3.3: window.loadLayer создаётся всегда (был баг: не перехватывался)
// ============================================================

console.log('FORECAST-MAP.JS загружен (v3.3)');

const ForecastMap = (function() {
    var loadedLayers = new Set();
    var initialized = false;
    var FETCH_TIMEOUT_MS = 8000;

    // ------------------------------------------------------------
    // fetchWithTimeout
    // ------------------------------------------------------------
    async function fetchWithTimeout(url, ms) {
        ms = ms || FETCH_TIMEOUT_MS;
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, ms);
        try {
            var response = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            return response;
        } catch (e) {
            clearTimeout(timer);
            throw e;
        }
    }

    // ------------------------------------------------------------
    // seed от layer.id
    // ------------------------------------------------------------
    function seedFromId(id) {
        return id.split('').reduce(function(s, c) { return s + c.charCodeAt(0); }, 0);
    }

    var statusBase = { 'critical': 82, 'pre-war': 70, 'high': 55, 'medium': 38, 'normal': 18 };

    // ------------------------------------------------------------
    // FALLBACK
    // ------------------------------------------------------------
    function renderFallback(layer) {
        var countries = window.ALL_COUNTRIES || [];
        if (countries.length === 0) { console.warn('[ForecastMap] Нет стран'); return; }

        var config = layer.choroplethConfig || layer.probabilityConfig ||
            (window.getLayerConfig ? window.getLayerConfig(layer.id) : { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5' });
        var palette = window.getColorPalette ? window.getColorPalette(config.palette) : ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'];
        var breaks = config.breaks || [20, 40, 60, 80];
        var horizon = config.horizon_default || 30;
        var seed = seedFromId(layer.id);

        var values = [];
        for (var i = 0; i < countries.length; i++) {
            var c = countries[i];
            var x = Math.sin(seed + i * 12.9898) * 43758.5453;
            var noise = x - Math.floor(x);
            var base = statusBase[c.status] || 40;
            var probability = Math.min(100, Math.max(0, base + (noise - 0.5) * 30));
            var confidence = 0.45 + noise * 0.45;
            values.push({ country: c.name, probability: probability, confidence: confidence, horizon_days: horizon });
        }

        var probs = values.map(function(v) { return v.probability; });
        var classes;
        if (config.method === 'manual' && breaks) {
            classes = ForecastAdapter.classifyManual(probs, breaks);
        } else {
            classes = ForecastAdapter.classifyJenks(probs, 5);
        }
        var gvf = ForecastAdapter.computeGVF(probs, classes);
        console.log('[ForecastMap] GVF=' + gvf.toFixed(4) + (gvf >= 0.7 ? ' OK' : ' BELOW 0.7'));

        var features = values.map(function(v, i) {
            var cls = classes[i];
            var fillOpacity = 0.4 + 0.5 * v.confidence;
            return {
                name: v.country,
                value: v.probability,
                confidence: v.confidence,
                horizon_days: v.horizon_days,
                properties: {
                    name: v.country, value: v.probability, class: cls,
                    fillColor: palette[cls] || palette[0],
                    fillOpacity: fillOpacity,
                    confidence: v.confidence, horizon: v.horizon_days
                }
            };
        });

        var data = { type: 'FeatureCollection', features: features,
            metadata: { method: config.method || 'manual', breaks: breaks,
                palette: config.palette, gvf: gvf, classes: 5, fallback: true } };

        if (window.applyChoropleth) window.applyChoropleth(data, layer);
        loadedLayers.add(layer.id);
        if (!window.layerCache) window.layerCache = {};
        window.layerCache[layer.id] = features;
        updateLegend(layer, config, data);
        console.log('[ForecastMap] ' + layer.id + ': fallback (' + features.length + ' стран)');
        if (window.showNotification) window.showNotification(layer.id + ': автономный режим', 'warn');
    }

    // ------------------------------------------------------------
    // ЗАГРУЗКА СЛОЯ
    // ------------------------------------------------------------
    async function loadLayerData(layerId) {
        var layer = (window.allLayers || []).find(function(l) { return l.id === layerId; });
        if (!layer) { console.warn('[ForecastMap] Слой не найден: ' + layerId); return; }

        window.currentLayer = layerId;
        console.log('[ForecastMap] Загрузка: ' + layerId + ' (vizType=' + layer.vizType + ')');

        var route = layer.route || ('/api/layers/' + layer.id);
        var config = layer.choroplethConfig || layer.probabilityConfig ||
            (window.getLayerConfig ? window.getLayerConfig(layer.id) : { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5' });

        try {
            var response = await fetchWithTimeout(route);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var apiData = await response.json();

            if (apiData.features && apiData.features.length > 0) {
                if (window.applyChoropleth) window.applyChoropleth(apiData, layer);
                loadedLayers.add(layer.id);
                updateLegend(layer, config, apiData);
                console.log('[ForecastMap] ' + layer.id + ': API (' + apiData.features.length + ' features)');
                return;
            }

            if (apiData.values || apiData.value !== undefined) {
                if (!apiData.values) {
                    apiData = ForecastAdapter.generateFromSeries(apiData, layer.id);
                }
                if (apiData && apiData.values) {
                    var choroplethData = ForecastAdapter.convertToChoropleth(apiData, config);
                    if (choroplethData && window.applyChoropleth) window.applyChoropleth(choroplethData, layer);
                    loadedLayers.add(layer.id);
                    updateLegend(layer, config, choroplethData);
                    console.log('[ForecastMap] ' + layerId + ': API -> adapter');
                    return;
                }
            }
            throw new Error('неподдерживаемый формат');
        } catch (e) {
            console.warn('[ForecastMap] ' + layer.id + ': API недоступен (' + e.message + ') -> fallback');
            renderFallback(layer);
        }
    }

    // ------------------------------------------------------------
    // ЛЕГЕНДА
    // ------------------------------------------------------------
    function updateLegend(layer, config, data) {
        var container = document.getElementById('choropleth-legend') || document.getElementById('legend-container');
        if (!container) return;
        var palette = window.getColorPalette ? window.getColorPalette(config.palette) : ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'];
        var breaks = config.breaks || [20, 40, 60, 80];
        var gvf = data && data.metadata ? data.metadata.gvf : null;
        var isFallback = data && data.metadata && data.metadata.fallback;

        var html = '<div class="legend">';
        html += '<div class="legend-title">' + (layer.icon || '') + ' ' + layer.name + '</div>';
        if (isFallback) html += '<div class="legend-method" style="color:#f59e0b;">Автономный режим</div>';
        html += '<div class="legend-method">Метод: ' + (config.method || 'manual') + '</div>';

        var labels = ['0-' + breaks[0]];
        for (var i = 0; i < breaks.length - 1; i++) labels.push(breaks[i] + '-' + breaks[i + 1]);
        labels.push(breaks[breaks.length - 1] + '+');

        html += '<div class="legend-classes">';
        for (var j = 0; j < palette.length; j++) {
            html += '<div class="legend-swatch"><span class="swatch" style="background:' + palette[j] + ';"></span><span class="label">' + labels[j] + '</span></div>';
        }
        html += '</div>';
        if (gvf !== null) {
            var gvfColor = gvf >= 0.7 ? '#22c55e' : '#ef4444';
            html += '<div class="legend-gvf" style="color:' + gvfColor + ';">GVF: ' + gvf.toFixed(4) + '</div>';
        }
        html += '<div class="legend-opacity">Прозрачность = confidence (0.4-0.9)</div>';
        html += '</div>';
        container.innerHTML = html;
        container.style.display = 'block';
    }

    // ------------------------------------------------------------
    // INIT — v3.3: создаёт window.loadLayer ВСЕГДА
    // ------------------------------------------------------------
    function init() {
        if (initialized) return;
        initialized = true;

        // ВСЕГДА создаём window.loadLayer — обёртку над loadLayerData
        window.loadLayer = function(id) {
            console.log('[ForecastMap] window.loadLayer вызван: ' + id);
            if (!window.activeLayerIds) window.activeLayerIds = new Set();
            window.activeLayerIds.add(id);
            loadLayerData(id);
        };
        window._forecastLayerHooked = true;

        // Обновляем счётчик активных в панели слоёв
        try {
            var countEl = document.getElementById('active-layers-count');
            if (countEl) {
                var n = (window.activeLayerIds ? window.activeLayerIds.size : 0);
                countEl.textContent = n + ' активных';
            }
        } catch (e) {}

        console.log('[ForecastMap] init(): window.loadLayer установлен');
    }

    function removeLayerData(layerId) {
        loadedLayers.delete(layerId);
        if (window.activeLayerIds) window.activeLayerIds.delete(layerId);
        if (window.layerCache) delete window.layerCache[layerId];
        var container = document.getElementById('choropleth-legend') || document.getElementById('legend-container');
        if (container) container.innerHTML = '';
        if (window.resetChoropleth) window.resetChoropleth();
    }

    return {
        init: init,
        loadLayerData: loadLayerData,
        removeLayerData: removeLayerData,
        loadLayerWithAdapter: loadLayerData,
        renderFallback: renderFallback
    };
})();

window.ForecastMap = ForecastMap;
console.log('FORECAST-MAP.JS готов (v3.3, loadLayer установлен)');
