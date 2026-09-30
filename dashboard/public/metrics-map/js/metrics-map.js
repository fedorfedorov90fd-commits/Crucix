// ============================================================
// METRICS-MAP.JS — Оркестратор Metrics Map (автономный, v1.4)
// ============================================================
// v1.4: устранён дубликат fetchWithTimeout (был определён 2 раза).
//       renderMarkerFallback принимает внешний markerAccumulator
//       (для параллельной загрузки без race condition).
// v1.3: добавлен fetchWithTimeout (8 сек) — сервер может висеть.
// v1.2: удалён мёртвый параметр activeLayersRef из 4 сигнатур.
// v1.1: добавлен маршрут marker → loadMarkerLayer → renderMarkerFallback.
// ============================================================

console.log('🎯 METRICS-MAP.JS загружен (v1.4)');

window.MetricsMap = {

    initialized: false,

    init: function() {
        if (this.initialized) {
            console.log('[MetricsMap] Уже инициализирован');
            return;
        }
        this.initialized = true;
        console.log('[MetricsMap] Инициализация оркестратора');
        console.log('[MetricsMap] Слоёв:', (window.allLayers || []).length);
        console.log('[MetricsMap] Series-модулей:', (window.SERIES_MODULES || []).length);

        const stats = { choropleth: 0, series: 0, marker: 0, other: 0 };
        for (const layer of (window.allLayers || [])) {
            const vt = layer.vizType || 'choropleth';
            if (stats[vt] !== undefined) stats[vt]++;
            else stats.other++;
        }
        console.log('[MetricsMap] Распределение:', stats);
    },

    /**
     * fetch с таймаутом через AbortController.
     * Единственное определение (в v1.3 было два подряд — дубликат).
     */
    fetchWithTimeout: async function(url, ms) {
        ms = ms || 8000;
        const controller = new AbortController();
        const timer = setTimeout(function() { controller.abort(); }, ms);
        try {
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            return resp;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    },

    /**
     * Перехват loadLayer() из layers.js.
     * Decision tree по vizType: choropleth | series | marker.
     *
     * @param {string} layerId — id слоя
     * @param {Array} markerAccumulator — опциональный внешний массив
     *   для сбора маркеров (при параллельной загрузке). Если передан,
     *   renderMarkerFallback пишет маркеры ТУДА, а не в window.markerData.
     */
    interceptLoad: async function(layerId, markerAccumulator) {
        const layer = (window.allLayers || []).find(l => l.id === layerId);
        if (!layer) return false;

        const vizType = layer.vizType || 'choropleth';

        if (vizType === 'series') {
            return await this.loadSeriesLayer(layer);
        }
        if (vizType === 'choropleth') {
            return await this.loadChoroplethLayer(layer);
        }
        if (vizType === 'marker') {
            return await this.loadMarkerLayer(layer, markerAccumulator);
        }
        return false;
    },

    /**
     * Загрузка series-слоя. При 404 → fallback.
     */
    loadSeriesLayer: async function(layer) {
        try {
            const url = this.resolveApiUrl(layer.id);
            if (!url) {
                console.warn(`[MetricsMap] Нет URL для ${layer.id} → fallback`);
                return this.renderFallback(layer);
            }

            const resp = await this.fetchWithTimeout(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const seriesData = await resp.json();

            const converted = window.SeriesAdapter.convert(
                layer.id, seriesData, window.ALL_COUNTRIES
            );
            if (!converted) {
                console.warn(`[MetricsMap] Адаптер не смог обработать ${layer.id} → fallback`);
                return this.renderFallback(layer);
            }

            const choroplethData = {
                features: converted.features.map(f => ({
                    name: f.name,
                    value: f.value,
                    properties: { name: f.name, value: f.value }
                })),
                breaks: converted.breaks,
                palette: converted.palette,
                method: converted.method,
                gvf: converted.gvf
            };

            if (typeof window.applyChoropleth === 'function') {
                window.applyChoropleth(choroplethData, {
                    method: converted.method,
                    palette: converted.palette,
                    manualBreaks: converted.breaks,
                    numClasses: converted.breaks.length - 1
                });
            }

            window.layerCache = window.layerCache || {};
            window.layerCache[layer.id] = converted.features;

            if (typeof window.showNotification === 'function') {
                window.showNotification(
                    `✅ ${layer.id}: ${converted.features.length} стран, GVF=${converted.gvf.toFixed(3)}`
                );
            }

            console.log(`[MetricsMap] Series → choropleth: ${layer.id}, GVF=${converted.gvf.toFixed(4)}`);
            return true;

        } catch (err) {
            console.warn(`[MetricsMap] ${layer.id}: series API недоступен (${err.message}) → fallback`);
            return this.renderFallback(layer);
        }
    },

    /**
     * Загрузка choropleth-слоя. При 404 → fallback.
     */
    loadChoroplethLayer: async function(layer) {
        try {
            const url = this.resolveApiUrl(layer.id) || `/api/layers/${layer.id}/featurecollection`;
            const resp = await this.fetchWithTimeout(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                console.warn(`[MetricsMap] ${layer.id}: пусто → fallback`);
                return this.renderFallback(layer);
            }

            const config = window.getLayerConfig ? window.getLayerConfig(layer.id) : {};
            if (typeof window.applyChoropleth === 'function') {
                window.applyChoropleth(data, {
                    method: config.method || 'jenks',
                    palette: config.palette || 'Blues',
                    manualBreaks: config.manualBreaks,
                    numClasses: 5
                });
            }

            window.layerCache = window.layerCache || {};
            window.layerCache[layer.id] = data.features;

            if (typeof window.showNotification === 'function') {
                window.showNotification(`✅ ${layer.id}: ${data.features.length} объектов`);
            }
            return true;

        } catch (err) {
            console.warn(`[MetricsMap] ${layer.id}: choropleth API недоступен (${err.message}) → fallback`);
            return this.renderFallback(layer);
        }
    },

    /**
     * Загрузка marker-слоя. При 404 → marker-fallback.
     * markerAccumulator — если передан, маркеры пишутся туда, не в window.
     */
    loadMarkerLayer: async function(layer, markerAccumulator) {
        try {
            const url = this.resolveApiUrl(layer.id) || `/api/layers/${layer.id}`;
            const resp = await this.fetchWithTimeout(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                console.warn(`[MetricsMap] ${layer.id}: пусто → marker-fallback`);
                return this.renderMarkerFallback(layer, markerAccumulator);
            }

            return false;

        } catch (err) {
            console.warn(`[MetricsMap] ${layer.id}: marker API недоступен (${err.message}) → marker-fallback`);
            return this.renderMarkerFallback(layer, markerAccumulator);
        }
    },

    /**
     * АВТОНОМНЫЙ FALLBACK — choropleth по 90 странам без API.
     */
    renderFallback: function(layer) {
        const countries = window.ALL_COUNTRIES || [];
        if (countries.length === 0) {
            console.warn(`[MetricsMap] ${layer.id}: нет стран для fallback`);
            return false;
        }

        const seed = layer.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const rand = (i) => {
            const x = Math.sin(seed + i * 12.9898) * 43758.5453;
            return x - Math.floor(x);
        };

        const STATUS_BASE = {
            'critical': 85,
            'pre-war': 72,
            'high': 62,
            'medium': 42,
            'normal': 22,
            'low': 18
        };

        const features = countries.map((c, i) => {
            const base = STATUS_BASE[c.status] || 40;
            const noise = (rand(i) - 0.5) * 25;
            const value = Math.max(0, Math.min(100, base + noise));
            return {
                name: c.name,
                value: value,
                properties: {
                    name: c.name,
                    value: value,
                    status: c.status
                }
            };
        });

        const config = window.getLayerConfig ? window.getLayerConfig(layer.id) : {};
        const values = features.map(f => f.value);

        let breaks;
        const numClasses = 5;
        const method = config.method || 'jenks';

        if (method === 'manual' && config.manualBreaks) {
            breaks = config.manualBreaks.slice();
        } else if (typeof window.jenksBreaks === 'function') {
            breaks = window.jenksBreaks(values, numClasses);
        } else {
            const sorted = values.slice().sort((a, b) => a - b);
            breaks = [];
            for (let i = 0; i <= numClasses; i++) {
                breaks.push(sorted[Math.min(Math.floor(i * sorted.length / numClasses), sorted.length - 1)]);
            }
        }

        const paletteName = config.palette || 'Blues';
        let palette = null;
        if (typeof window.getColorPalette === 'function') {
            palette = window.getColorPalette(paletteName);
        }

        if (typeof window.applyChoropleth === 'function') {
            window.applyChoropleth({
                features: features,
                breaks: breaks,
                palette: palette,
                method: 'fallback',
                gvf: 0.85
            }, {
                method: method,
                palette: paletteName,
                manualBreaks: config.manualBreaks,
                numClasses: numClasses,
                id: layer.id,
                name: layer.name
            });
        }

        window.layerCache = window.layerCache || {};
        window.layerCache[layer.id] = features;

        if (typeof window.showNotification === 'function') {
            window.showNotification(
                `⚡ ${layer.id}: автономный fallback (${features.length} стран, ${method})`
            );
        }

        console.log(`[MetricsMap] Fallback: ${layer.id} → ${features.length} стран, method=${method}, palette=${paletteName}`);
        return true;
    },

    /**
     * АВТОНОМНЫЙ FALLBACK — маркеры по 90 странам без API.
     * 2 маркера на страну (180 маркеров на слой).
     *
     * @param {Object} layer — конфигурация слоя
     * @param {Array} markerAccumulator — если передан, маркеры пишутся
     *   в него (не в window.markerData). Это критично для параллельной
     *   загрузки: без аккумулятора 5 параллельных marker-слоёв
     *   перезаписывают друг друга через lost update.
     */
    renderMarkerFallback: function(layer, markerAccumulator) {
        const countries = window.ALL_COUNTRIES || [];
        if (countries.length === 0) {
            console.warn(`[MetricsMap] ${layer.id}: нет стран для marker-fallback`);
            return false;
        }

        const seed = layer.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const rand = (i) => {
            const x = Math.sin(seed + i * 12.9898) * 43758.5453;
            return x - Math.floor(x);
        };

        const markers = [];
        let idx = 0;
        for (const c of countries) {
            for (let k = 0; k < 2; k++) {
                idx++;
                const latOffset = (rand(idx) - 0.5) * 10;
                const lngOffset = (rand(idx + 1000) - 0.5) * 10;
                markers.push({
                    id: `${layer.id}-${c.id || idx}-${k}`,
                    lat: (c.lat || 0) + latOffset,
                    lng: (c.lng || 0) + lngOffset,
                    countryName: c.name,
                    title: `${layer.name} #${idx}`,
                    layer: layer.id,
                    status: c.status,
                    color: layer.color || '#4a5a6a',
                    date: new Date().toISOString(),
                    severity: 3
                });
            }
        }

        window.layerCache = window.layerCache || {};
        window.layerCache[layer.id] = markers;

        // ★ v1.4: если передан аккумулятор — пишем туда, не в window.
        // Это устраняет race condition при параллельной загрузке.
        if (markerAccumulator && Array.isArray(markerAccumulator)) {
            for (const m of markers) markerAccumulator.push(m);
            // window.markerData НЕ трогаем — координатор merge-ит сам.
        } else {
            // Одиночный вызов (не через параллельный батч) — старый путь.
            window.markerData = window.markerData || [];
            window.markerData = window.markerData.concat(markers);
            window.allMarkers = window.markerData.slice();

            const countEl = document.getElementById('marker-count');
            if (countEl) countEl.textContent = window.markerData.length;

            if (typeof window.updateMarkers === 'function') {
                window.updateMarkers(window.markerData);
            }
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification(`⚡ ${layer.id}: marker fallback (${markers.length} маркеров)`);
        }
        console.log(`[MetricsMap] Marker Fallback: ${layer.id} → ${markers.length} маркеров`);
        return true;
    },

    /**
     * Разрешение URL API по ID модуля.
     */
    resolveApiUrl: function(layerId) {
        const routes = {
            'business-optimism-api':    '/api/layers/business-optimism',
            'consumer-expectations-api':'/api/layers/consumer-expectations',
            'pmi-api':                  '/api/layers/pmi',
            'recession-api':            '/api/layers/recession',
            'copper-gold-ratio-api':    '/api/layers/copper-gold-ratio',
            'hy-spread-api':            '/api/layers/hy-spread',
            'ovx-api':                  '/api/layers/ovx',
            'rublev-dubai-api':         '/api/layers/rublev-dubai',
            'sp500-vix-api':            '/api/layers/sp500-vix',
            'vxx-api':                  '/api/layers/vxx',
            'yield-curve-api':          '/api/layers/yield-curve',
            'crypto-fear-api':          '/api/layers/crypto-fear',
            'cyber-threat-index-api':   '/api/layers/cyber-threat-index',
            'wti-brent-spread-api':     '/api/layers/wti-brent-spread'
        };
        return routes[layerId] || null;
    },

    /**
     * Диагностика состояния оркестратора.
     */
    stats: function() {
        const layers = window.allLayers || [];
        const series = layers.filter(l => l.vizType === 'series');
        const choropleth = layers.filter(l => l.vizType === 'choropleth');
        const markers = layers.filter(l => l.vizType === 'marker');
        return {
            total: layers.length,
            series: series.length,
            choropleth: choropleth.length,
            marker: markers.length,
            initialized: this.initialized
        };
    }
};

console.log('✅ METRICS-MAP.JS готов (v1.4, fetchWithTimeout единственный, markerAccumulator)');
