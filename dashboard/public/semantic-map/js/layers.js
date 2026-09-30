// ============================================================
// LAYERS.JS — 35 СЛОЁВ ДЛЯ КАРТЫ "meanings" (Semantic Map)
// ============================================================
// Этот файл содержит ТОЛЬКО слои Semantic Map.
// Фильтр по mapType встроён на этапе сборки — в рантайме фильтрация не нужна.
// Принцип автономии R3: только свои слои, 0 ссылок на другие карты.
// ============================================================

console.log('📚 LAYERS.JS загружен (35 слоёв, карта: meanings)');

const DEMO_LAYERS = [
    // === 1. БАЗОВЫЕ СЛОИ (intelligence) — 3 слоя ===
    { id: "timeline", name: "⏳ Временная шкала", color: "#44aaff", icon: "⏳", category: "intelligence", vizType: "marker" },
    { id: "animations", name: "🎬 Анимация изменений", color: "#ff66ff", icon: "🎬", category: "intelligence", vizType: "marker" },
    { id: "export-map", name: "📤 Экспорт карты", color: "#00cc88", icon: "📤", category: "intelligence", vizType: "marker" },

    // === 2. РАЗВЕДКА (intelligence) — 12 слоёв ===
    { id: 'crucix-radar', name: '🎯 Радиолокационная разведка', color: '#ff4400', icon: '📡', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-satellite-recon', name: '🛰️ Спутниковая разведка', color: '#4444ff', icon: '🛰️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-sigint', name: '📻 Радиоразведка (SIGINT)', color: '#ff00aa', icon: '📻', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-humint', name: '👤 Агентурная разведка', color: '#880044', icon: '🕵️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-osint', name: '🌐 Открытые источники (OSINT)', color: '#0088ff', icon: '🌐', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-imint', name: '📸 Видеоразведка (IMINT)', color: '#ff8800', icon: '📸', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-masint', name: '🔬 Измерительная разведка', color: '#aa00ff', icon: '🔬', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-geoint', name: '🗺️ Геопространственная разведка', color: '#0044aa', icon: '🗺️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-electronic-warfare', name: '⚡ Радиоэлектронная борьба', color: '#ff2200', icon: '⚡', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-drone-recon', name: '🛩️ Разведка БПЛА', color: '#ff6600', icon: '🛩️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-communication-intercept', name: '📡 Перехват коммуникаций', color: '#ff00ff', icon: '📡', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-pattern-life', name: '📊 Шаблоны поведения', color: '#4466ff', icon: '📊', category: 'intelligence', vizType: 'sentiment', crucix: true },

    // === 3. СЕМАНТИКА (semantic) — 7 базовых слоёв ===
    { id: 'sentiment-analysis', name: '💬 Анализ тональности', color: '#ff44aa', icon: '💬', category: 'semantic', vizType: 'sentiment' },
    { id: 'entity-extraction-base', name: '🏷️ Извлечение сущностей', color: '#44ccaa', icon: '🏷️', category: 'semantic', vizType: 'marker' },
    { id: 'topic-modeling', name: '📌 Тематическое моделирование', color: '#aa66ff', icon: '📌', category: 'semantic', vizType: 'cluster' },
    { id: 'narrative-tracking', name: '📝 Отслеживание нарративов', color: '#ffaa44', icon: '📝', category: 'semantic', vizType: 'sentiment' },
    { id: 'ai-content-detection', name: '🤖 Детекция AI-контента', color: '#6644ff', icon: '🤖', category: 'semantic', vizType: 'marker' },
    { id: 'ai-synthesis-base', name: '🔄 AI-синтез данных', color: '#4466cc', icon: '🔄', category: 'semantic', vizType: 'cluster' },
    { id: 'ml-anomaly-detection', name: '⚠️ ML-аномалии в текстах', color: '#ff4400', icon: '⚠️', category: 'semantic', vizType: 'marker' },

    // === 4. НОВЫЕ API-МОДУЛИ (semantic) — 7 слоёв ===
    { id: 'adaptive-news-clustering-api', route: '/api/layers/adaptive-news-clustering', name: 'Адаптивная кластеризация новостей', category: 'semantic', color: '#8b5cf6', icon: '📰', vizType: 'cluster' },
    { id: 'ai-news-synthesis-api', route: '/api/layers/ai-news-synthesis', name: 'AI-синтез новостей', category: 'semantic', color: '#6366f1', icon: '🤖', vizType: 'cluster' },
    { id: 'entity-extraction-api', route: '/api/layers/entity-extraction', name: 'Извлечение сущностей (NER)', category: 'semantic', color: '#14b8a6', icon: '🏷️', vizType: 'marker' },
    { id: 'multi-source-corroboration-api', route: '/api/layers/multi-source-corroboration', name: 'Кросс-подтверждение источников', category: 'semantic', color: '#0ea5e9', icon: '✓', vizType: 'credibility' },
    { id: 'social-sentiment-analyzer-api', route: '/api/layers/social-sentiment-analyzer', name: 'Тональность социальных медиа', category: 'semantic', color: '#ec4899', icon: '💬', vizType: 'sentiment' },
    { id: 'source-credibility-api', route: '/api/layers/source-credibility', name: 'Достоверность источников', category: 'semantic', color: '#f59e0b', icon: '🔍', vizType: 'credibility' },
    { id: 'narrative-splitter-api', route: '/api/layers/narrative-splitter', name: 'Сверка нарративов', category: 'semantic', color: '#f97316', icon: '📝', vizType: 'sentiment' },

    // === 5. SPECIALIST — 3 слоя ===
    { id: 'narrative-drift-api', route: '/api/layers/narrative-drift', name: 'Дрейф нарративов', category: 'specialist', color: '#f97316', icon: '📈', vizType: 'sentiment' },
    { id: 'deception-index-api', route: '/api/layers/deception-index', name: 'Индекс обмана', category: 'specialist', color: '#dc2626', icon: '🎭', vizType: 'credibility' },
    { id: 'indirect-indicators-api', route: '/api/layers/indirect-indicators', name: 'Косвенные индикаторы', category: 'specialist', color: '#0891b2', icon: '🔍', vizType: 'marker' },

    // === 6. OTHER — 3 слоя ===
    { id: 'analysis-events-api', route: '/api/layers/analysis-events', name: 'События анализа', category: 'other', color: '#0891b2', icon: '📊', vizType: 'marker' },
    { id: 'historical-analysis-api', route: '/api/layers/historical-analysis', name: 'Исторический анализ', category: 'other', color: '#0d9488', icon: '📜', vizType: 'marker' },
    { id: 'reports-api', route: '/api/layers/reports', name: 'Аналитические отчёты', category: 'other', color: '#475569', icon: '📋', vizType: 'marker' }
];

window.allLayers = DEMO_LAYERS;

// ============================================================
// LAYER OVERRIDES — конфигурация визуализации по слоям
// ============================================================
window.LAYER_OVERRIDES = {
    'crucix-pattern-life': { vizType: 'sentiment', palette: 'RdYlGn5', method: 'jenks', classes: 5, description: 'Шаблоны поведения: отклонение от нормы' },
    'sentiment-analysis': { vizType: 'sentiment', palette: 'RdYlGn5', method: 'manual', breaks: [-0.6, -0.2, 0.2, 0.6] },
    'social-sentiment-analyzer-api': { vizType: 'sentiment', palette: 'RdYlGn5', method: 'manual', breaks: [-0.6, -0.2, 0.2, 0.6] },
    'narrative-tracking': { vizType: 'sentiment', palette: 'RdYlGn5', method: 'jenks', classes: 5 },
    'narrative-splitter-api': { vizType: 'sentiment', palette: 'RdYlGn5', method: 'jenks', classes: 5 },
    'narrative-drift-api': { vizType: 'sentiment', palette: 'RdYlGn5', method: 'jenks', classes: 5, description: 'Расхождение слов и действий: отрицательные = дрейф' },
    'source-credibility-api': { vizType: 'credibility', palette: 'OrRd5', method: 'quantile', classes: 5 },
    'multi-source-corroboration-api': { vizType: 'credibility', palette: 'YlOrRd5', method: 'quantile', classes: 5 },
    'deception-index-api': { vizType: 'credibility', palette: 'OrRd5', method: 'jenks', classes: 5, description: 'Индекс обмана: 0 = честно, 100 = обман' },
    'adaptive-news-clustering-api': { vizType: 'cluster', palette: 'Set1', method: 'categorical' },
    'ai-news-synthesis-api': { vizType: 'cluster', palette: 'Pastel1', method: 'categorical' },
    'topic-modeling': { vizType: 'cluster', palette: 'Pastel1', method: 'categorical' },
    'ai-synthesis-base': { vizType: 'cluster', palette: 'Pastel1', method: 'categorical' }
};

// ============================================================
// РЕНДЕРИНГ ПАНЕЛИ СЛОЁВ
// ============================================================

function renderLayerPanel(layers) {
    var list = document.getElementById('layer-list');
    var panel = document.getElementById('layer-panel');

    // Если есть layer-list — рендерим туда (новый формат blocks/)
    if (list) {
        list.innerHTML = '';
        var count = 0;

        // Кнопка "ВСЕ"
        var allDiv = document.createElement('div');
        allDiv.className = 'layer-category';
        allDiv.innerHTML = '<div class="layer-category-header" onclick="loadLayer(\'all\')">🌍 ВСЕ СЛОИ <span class="badge">' + layers.length + '</span></div>';
        list.appendChild(allDiv);

        // Группировка по категориям
        var categories = {};
        var catIcons = { military: '⚔️', financial: '💰', ecological: '🌿', intelligence: '🔍', semantic: '🧠', ai: '🤖', specialist: '🔬', other: '📌', infrastructure: '🏗️', social: '👥', space: '🚀', cyber: '💻', news: '📰', energy: '⛽', maritime: '🚢', transport: '🚛', health: '🏥', economic: '📊' };
        var catNames = { military: 'Военные', financial: 'Финансы', ecological: 'Экология', intelligence: 'Разведка', semantic: 'Семантика', ai: 'AI', specialist: 'Специальные', other: 'Другие', infrastructure: 'Инфраструктура', social: 'Социальные', space: 'Космос', cyber: 'Кибер', news: 'Новости', energy: 'Энергетика', maritime: 'Морские', transport: 'Транспорт', health: 'Здоровье', economic: 'Экономика' };

        for (var i = 0; i < layers.length; i++) {
            var cat = layers[i].category || 'other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(layers[i]);
        }

        var sortedCats = Object.keys(categories).sort(function(a, b) { return categories[b].length - categories[a].length; });

        for (var ci = 0; ci < sortedCats.length; ci++) {
            var cat = sortedCats[ci];
            var items = categories[cat];

            var catDiv = document.createElement('div');
            catDiv.className = 'layer-category';
            catDiv.dataset.category = cat;

            var header = document.createElement('div');
            header.className = 'layer-category-header';
            header.innerHTML = '<span class="arrow open">▶</span> ' + (catIcons[cat] || '📌') + ' ' + (catNames[cat] || cat) + ' <span class="badge">' + items.length + '</span>';
            catDiv.appendChild(header);

            var grid = document.createElement('div');
            grid.className = 'layer-grid';
            grid.id = 'grid-' + cat;

            for (var j = 0; j < items.length; j++) {
                var layer = items[j];
                var btn = document.createElement('button');
                btn.className = 'layer-btn';
                btn.dataset.layerId = layer.id;
                btn.dataset.category = cat;
                btn.innerHTML = '<span class="dot" style="background:' + (layer.color || '#4a5a6a') + '"></span><span class="icon">' + (layer.icon || '📍') + '</span><span class="name">' + layer.name + '</span>';
                btn.onclick = (function(id) { return function() { loadLayer(id); }; })(layer.id);
                grid.appendChild(btn);
                count++;
            }

            catDiv.appendChild(grid);
            list.appendChild(catDiv);
        }

        var countEl = document.getElementById('layer-count');
        if (countEl) countEl.textContent = count;
        console.log('[layers.js] Панель слоёв: ' + count + ' слоёв');
        return;
    }

    // Fallback: рендер в #layer-panel (старый формат)
    if (!panel) { console.warn('layer-panel и layer-list не найдены'); return; }
    panel.innerHTML = '';
    var cats = {};
    for (var k = 0; k < layers.length; k++) {
        var c = layers[k].category || 'other';
        if (!cats[c]) cats[c] = [];
        cats[c].push(layers[k]);
    }
    var html = '';
    for (var catKey in cats) {
        if (!cats.hasOwnProperty(catKey)) continue;
        html += '<div class="layer-category"><h3>' + (catNames[catKey] || catKey) + '</h3>';
        for (var m = 0; m < cats[catKey].length; m++) {
            var lyr = cats[catKey][m];
            var vizIcon = { sentiment: '🎨', credibility: '✓', cluster: '🔗', marker: '📍' }[lyr.vizType] || '📍';
            html += '<label class="layer-item" data-id="' + lyr.id + '"><input type="checkbox" onchange="toggleLayer(\'' + lyr.id + '\')"><span class="layer-icon">' + lyr.icon + '</span><span class="layer-name">' + lyr.name + '</span><span class="layer-viz">' + vizIcon + '</span></label>';
        }
        html += '</div>';
    }
    panel.innerHTML = html;
    var countEl2 = document.getElementById('layer-count');
    if (countEl2) countEl2.textContent = layers.length;
    console.log('[layers.js] Панель слоёв (fallback): ' + layers.length + ' слоёв');
}

// ============================================================
// ВКЛ/ВЫКЛ СЛОЁВ
// ============================================================

window.activeLayerIds = [];
window.layerCache = {};
window.currentLayer = 'all';

function toggleLayer(layerId) {
    var idx = window.activeLayerIds.indexOf(layerId);
    if (idx !== -1) {
        window.activeLayerIds.splice(idx, 1);
        if (window.layerCache[layerId]) {
            window.layerCache[layerId] = null;
        }
    } else {
        window.activeLayerIds.push(layerId);
        if (typeof loadLayer === 'function') {
            loadLayer(layerId);
        }
    }
    updateMapLayers();
}

function loadLayer(layerId) {
    // Делегирование оркестратору
    if (typeof window.SemanticMap !== 'undefined' && window.SemanticMap.loadLayer) {
        return window.SemanticMap.loadLayer(layerId);
    }

    console.log('[layers.js] loadLayer:', layerId);

    // Обновляем активную кнопку
    document.querySelectorAll('.layer-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.layerId === layerId);
    });
    window.currentLayer = layerId;
    localStorage.setItem('crucix-active-layer', layerId);

    if (layerId === 'all') {
        if (typeof generateAllMarkers === 'function') generateAllMarkers();
        if (typeof updateMarkers === 'function') {
            updateMarkers(window.markerData || []);
        }
        if (typeof window.showNotification === 'function') {
            window.showNotification('🌍 Все слои — ' + (window.markerData || []).length + ' маркеров');
        }
        return;
    }

    var layer = (window.allLayers || []).find(function(l) { return l.id === layerId; });
    if (!layer) {
        console.warn('[layers.js] Слой не найден:', layerId);
        return;
    }

    // Если есть route — грузим через API
    if (layer.route) {
        fetch(layer.route)
            .then(function(r) { return r.ok ? r.json() : Promise.reject('HTTP ' + r.status); })
            .then(function(data) {
                window.layerCache[layerId] = data;
                var markers = data.features || data.markers || data || [];
                if (typeof updateMarkers === 'function') updateMarkers(markers);
                if (typeof window.showNotification === 'function') {
                    window.showNotification('✅ ' + layer.name + ' — загружено');
                }
            })
            .catch(function(err) {
                console.warn('[layers.js] Ошибка загрузки слоя', layerId, err);
                if (typeof window.showNotification === 'function') {
                    window.showNotification('⚠️ Слой ' + layerId + ': данные недоступны (демо-режим)');
                }
                // Fallback: генерируем демо-маркеры
                if (typeof generateAllMarkers === 'function') generateAllMarkers();
                if (typeof updateMarkers === 'function') {
                    var demo = (window.markerData || []).filter(function(m) { return m.layer === layerId; });
                    if (demo.length > 0) updateMarkers(demo);
                    else updateMarkers(window.markerData || []);
                }
            });
    } else {
        // Слой без route — демо-маркеры
        if (typeof generateAllMarkers === 'function') generateAllMarkers();
        if (typeof updateMarkers === 'function') {
            var filtered = (window.markerData || []).filter(function(m) { return m.layer === layerId; });
            updateMarkers(filtered.length > 0 ? filtered : (window.markerData || []));
        }
        if (typeof window.showNotification === 'function') {
            window.showNotification('📍 ' + layer.name + ' — демо-режим');
        }
    }
}

function updateMapLayers() {
    var ids = (window.activeLayerIds || []).slice();
    if (ids.length === 0) {
        if (typeof updateMarkers === 'function') updateMarkers(window.markerData || []);
    } else {
        var all = [];
        for (var i = 0; i < ids.length; i++) {
            if (window.layerCache && window.layerCache[ids[i]]) {
                all = all.concat(window.layerCache[ids[i]]);
            }
        }
        if (all.length === 0) all = window.markerData || [];
        if (typeof updateMarkers === 'function') updateMarkers(all);
    }
    if (typeof window.showNotification === 'function') {
        window.showNotification('Активных слоёв: ' + ids.length);
    }
}

// ============================================================
// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
// ============================================================

window.renderLayerPanel = renderLayerPanel;
window.toggleLayer = toggleLayer;
window.loadLayer = loadLayer;
window.updateMapLayers = updateMapLayers;

console.log('✅ layers.js: ' + DEMO_LAYERS.length + ' слоёв');
