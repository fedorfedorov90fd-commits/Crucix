// ============================================================
// GRAPH-PANEL.JS — Панель слоёв и легенда (Network Map)
// ============================================================
// Рендерит слои в #layer-grid (сетка 2 колонки).
// Категории — .layer-category / .layer-category-header / .layer-item.
// Легенда — 4 формы узлов в #legend.
// Управление — слайдеры и кнопки в #graph-controls.
// ============================================================

console.log('🎛️ GRAPH-PANEL.JS загружен');

window.GraphPanel = {

    // ------------------------------------------------------------
    // Рендер панели слоёв в #layer-grid
    // ------------------------------------------------------------
    renderLayerPanel: function(layers) {
        var grid = document.getElementById('layer-grid');
        if (!grid) {
            console.warn('[GraphPanel] #layer-grid не найден');
            return;
        }
        grid.innerHTML = '';

        // Группировка по категориям
        var categories = {};
        var catOrder = ['flow', 'social', 'other'];
        var catNames = {
            flow: '💸 Потоки',
            social: '👥 Социальные',
            other: '📌 Другие'
        };

        for (var i = 0; i < layers.length; i++) {
            var c = layers[i].category || 'other';
            if (!categories[c]) categories[c] = [];
            categories[c].push(layers[i]);
        }

        var activeLayer = (window.NetworkMap && window.NetworkMap.currentLayer) || null;

        // Все слои + категории
        var allItems = [];
        for (var k = 0; k < catOrder.length; k++) {
            var cat = catOrder[k];
            if (categories[cat]) {
                allItems.push({ type: 'category', name: cat, items: categories[cat] });
            }
        }
        // Прочие категории, если появятся
        for (var catKey in categories) {
            if (catOrder.indexOf(catKey) === -1) {
                allItems.push({ type: 'category', name: catKey, items: categories[catKey] });
            }
        }

        var html = '';

        for (var ai = 0; ai < allItems.length; ai++) {
            var group = allItems[ai];
            var groupName = catNames[group.name] || group.name;
            html += '<div class="layer-category" data-category="' + group.name + '">';
            html += '<div class="layer-category-header" onclick="window.GraphPanel._toggleCategory(this)">';
            html += '<span class="arrow open">▶</span> ';
            html += groupName + ' <span class="badge">' + group.items.length + '</span>';
            html += '</div>';
            html += '<div class="layer-grid-inner">';

            for (var j = 0; j < group.items.length; j++) {
                var l = group.items[j];
                var isActive = (l.id === activeLayer) ? ' active' : '';
                html += '<div class="layer-item' + isActive + '" data-id="' + l.id + '" data-category="' + group.name + '" onclick="window.NetworkMap.loadLayer(\'' + l.id + '\')">';
                html += '<span class="layer-icon" style="color:' + (l.color || '#58a6ff') + '">' + (l.icon || '●') + '</span>';
                html += '<span class="layer-name">' + (l.name || l.id) + '</span>';
                html += '</div>';
            }

            html += '</div>';
            html += '</div>';
        }

        grid.innerHTML = html;

        var countEl = document.getElementById('layer-count');
        if (countEl) countEl.textContent = layers.length;

        console.log('[GraphPanel] Отрендерено слоёв: ' + layers.length);
    },

    // ------------------------------------------------------------
    // Свернуть/развернуть категорию
    // ------------------------------------------------------------
    _toggleCategory: function(headerEl) {
        var catDiv = headerEl.parentElement;
        if (!catDiv) return;
        var inner = catDiv.querySelector('.layer-grid-inner');
        if (!inner) return;
        var isHidden = inner.style.display === 'none';
        inner.style.display = isHidden ? '' : 'none';
        var arrow = headerEl.querySelector('.arrow');
        if (arrow) arrow.classList.toggle('open', isHidden);
    },

    // ------------------------------------------------------------
    // Легенда форм узлов
    // ------------------------------------------------------------
    renderLegend: function() {
        var legend = document.getElementById('legend');
        if (!legend) return;

        var types = (window.NetworkMapConfig || {}).nodeTypes || {};
        var html = '<h3>Типы узлов</h3>';

        var mapping = [
            { key: 'country',      label: 'Страна',       shape: 'circle' },
            { key: 'organization', label: 'Организация',  shape: 'square' },
            { key: 'event',        label: 'Событие',      shape: 'triangle' },
            { key: 'financial',    label: 'Финансы',      shape: 'diamond' }
        ];

        for (var i = 0; i < mapping.length; i++) {
            var m = mapping[i];
            var t = types[m.key] || {};
            var color = t.color || '#58a6ff';
            html += '<div class="legend-item">';
            html += '<span class="legend-swatch ' + m.shape + '" style="background:' + color + '"></span>';
            html += '<span>' + m.label + '</span>';
            html += '</div>';
        }

        // Дополнительные типы, если есть
        for (var key in types) {
            if (['country', 'organization', 'event', 'financial'].indexOf(key) !== -1) continue;
            var tc = types[key] || {};
            html += '<div class="legend-item">';
            html += '<span class="legend-swatch circle" style="background:' + (tc.color || '#888') + '"></span>';
            html += '<span>' + key + '</span>';
            html += '</div>';
        }

        legend.innerHTML = html;
    },

    // ------------------------------------------------------------
    // Слайдеры и кнопки управления графом
    // ------------------------------------------------------------
    updateControls: function() {
        var mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;

        // Если уже создан — не дублируем
        if (document.getElementById('graph-controls')) {
            this._bindControls();
            return;
        }

        // Создаём панель управления
        var controls = document.createElement('div');
        controls.id = 'graph-controls';
        controls.className = 'graph-controls';
        controls.innerHTML =
            '<input type="text" id="node-search" class="node-search" placeholder="🔍 Поиск узла...">' +
            '<div class="path-row">' +
                '<input type="text" id="path-from" class="path-input" placeholder="От...">' +
                '<input type="text" id="path-to" class="path-input" placeholder="До...">' +
                '<button class="btn btn-sm" id="path-btn" title="Подсветить путь">→</button>' +
            '</div>' +
            '<div class="controls-row">' +
                '<button class="btn" id="reset-graph-btn">🔄 Сброс</button>' +
                '<button class="btn" id="zoom-in-btn">🔍+</button>' +
                '<button class="btn" id="zoom-out-btn">🔍−</button>' +
            '</div>' +
            '<div class="controls-row">' +
                '<button class="btn" id="export-svg-btn" title="Скачать SVG">💾 SVG</button>' +
                '<button class="btn" id="export-png-btn" title="Скачать PNG">🖼️ PNG</button>' +
            '</div>' +
            '<div class="controls-row">' +
                '<button class="btn" id="toggle-communities-btn" title="Показать сообщества (Louvain)">🎨 Сообщества</button>' +
            '</div>' +
            '<div class="controls-row">' +
                '<button class="btn" id="toggle-metric-btn" title="Размер узла по метрике">📊 Метрики</button>' +
                '<span id="metric-label" style="font-size:10px;color:#8b949e;padding-left:6px;"></span>' +
            '</div>' +
            '<label class="slider-label">Force: <span id="force-val">80</span></label>' +
            '<input type="range" id="force-slider" min="10" max="200" value="80">' +
            '<label class="slider-label">Distance: <span id="distance-val">100</span></label>' +
            '<input type="range" id="distance-slider" min="20" max="300" value="100">';

        mapContainer.appendChild(controls);
        this._bindControls();
    },

    _bindControls: function() {
        var self = this;
        var forceSlider = document.getElementById('force-slider');
        var distSlider = document.getElementById('distance-slider');
        var forceVal = document.getElementById('force-val');
        var distVal = document.getElementById('distance-val');

        if (forceSlider && !forceSlider._bound) {
            forceSlider._bound = true;
            forceSlider.addEventListener('input', function() {
                if (forceVal) forceVal.textContent = this.value;
                if (window.GraphView && window.GraphView.setConfig) {
                    window.GraphView.setConfig('charge', -parseInt(this.value, 10) * 4);
                }
            });
            forceSlider.addEventListener('change', function() {
                if (window.GraphView && window.GraphView.reset) {
                    window.GraphView.reset();
                }
            });
        }

        if (distSlider && !distSlider._bound) {
            distSlider._bound = true;
            distSlider.addEventListener('input', function() {
                if (distVal) distVal.textContent = this.value;
                if (window.GraphView && window.GraphView.setConfig) {
                    window.GraphView.setConfig('distance', parseInt(this.value, 10));
                }
            });
            distSlider.addEventListener('change', function() {
                if (window.GraphView && window.GraphView.reset) {
                    window.GraphView.reset();
                }
            });
        }

        var resetBtn = document.getElementById('reset-graph-btn');
        if (resetBtn && !resetBtn._bound) {
            resetBtn._bound = true;
            resetBtn.addEventListener('click', function() {
                if (window.GraphView && window.GraphView.reset) {
                    window.GraphView.reset();
                }
            });
        }

        var zIn = document.getElementById('zoom-in-btn');
        if (zIn && !zIn._bound) {
            zIn._bound = true;
            zIn.addEventListener('click', function() {
                if (window.GraphView && window.GraphView.zoom) {
                    window.GraphView.zoom(1.3);
                }
            });
        }

        var zOut = document.getElementById('zoom-out-btn');
        if (zOut && !zOut._bound) {
            zOut._bound = true;
            zOut.addEventListener('click', function() {
                if (window.GraphView && window.GraphView.zoom) {
                    window.GraphView.zoom(0.77);
                }
            });
        }

        // Поиск узла
        var searchInput = document.getElementById('node-search');
        if (searchInput && !searchInput._bound) {
            searchInput._bound = true;
            searchInput.addEventListener('input', function() {
                if (window.GraphView && window.GraphView.searchNode) {
                    var n = window.GraphView.searchNode(this.value);
                    var el = document.getElementById('node-search');
                    if (el && this.value) {
                        el.style.borderColor = n > 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)';
                    } else if (el) {
                        el.style.borderColor = '';
                    }
                }
            });
        }

        // Подсветка пути
        var pathBtn = document.getElementById('path-btn');
        if (pathBtn && !pathBtn._bound) {
            pathBtn._bound = true;
            pathBtn.addEventListener('click', function() {
                var fromEl = document.getElementById('path-from');
                var toEl = document.getElementById('path-to');
                if (!fromEl || !toEl) return;
                var from = fromEl.value.trim();
                var to = toEl.value.trim();
                if (!from || !to) {
                    if (window.showNotification) window.showNotification('⚠️ Введите От и До');
                    return;
                }
                var path = window.GraphView.highlightPath(from, to);
                if (path) {
                    if (window.showNotification) window.showNotification('✅ Путь: ' + path.join(' → '));
                    console.log('[Path]', path);
                } else {
                    if (window.showNotification) window.showNotification('❌ Путь не найден');
                }
            });
        }

        // Экспорт SVG
        var svgBtn = document.getElementById('export-svg-btn');
        if (svgBtn && !svgBtn._bound) {
            svgBtn._bound = true;
            svgBtn.addEventListener('click', function() {
                if (window.GraphView && window.GraphView.exportSVG) {
                    var size = window.GraphView.exportSVG();
                    if (window.showNotification && size) {
                        window.showNotification('✅ SVG экспортирован');
                    }
                }
            });
        }

        // Экспорт PNG
        var pngBtn = document.getElementById('export-png-btn');
        if (pngBtn && !pngBtn._bound) {
            pngBtn._bound = true;
            pngBtn.addEventListener('click', function() {
                if (window.GraphView && window.GraphView.exportPNG) {
                    window.GraphView.exportPNG();
                }
            });
        }

        // Переключатель сообществ Louvain
        var commBtn = document.getElementById('toggle-communities-btn');
        if (commBtn && !commBtn._bound) {
            commBtn._bound = true;
            commBtn.addEventListener('click', function() {
                if (!window.GraphView || !window.GraphView.toggleCommunities) return;
                var result = window.GraphView.toggleCommunities();
                var showing = window.GraphView.isShowingCommunities();
                commBtn.style.background = showing ?
                    'rgba(88, 166, 255, 0.2)' : '';
                commBtn.style.borderColor = showing ?
                    'rgba(88, 166, 255, 0.5)' : '';
                if (result) {
                    if (window.renderCommunityLegend) {
                        window.renderCommunityLegend(result.communities);
                    }
                    if (window.showNotification) {
                        window.showNotification('🎨 Сообществ: ' + result.numCommunities +
                            ' (Q=' + result.modularity.toFixed(2) + ')');
                    }
                } else {
                    if (window.clearCommunityLegend) {
                        window.clearCommunityLegend();
                    }
                    if (window.showNotification) {
                        window.showNotification('Цвета по типам узлов');
                    }
                }
            });
        }

        // Переключатель метрики (размер узла)
        var metricBtn = document.getElementById('toggle-metric-btn');
        var metricLabel = document.getElementById('metric-label');
        var METRIC_NAMES = {
            degree: 'Degree',
            betweenness: 'Betweenness',
            closeness: 'Closeness',
            pagerank: 'PageRank',
            eigenvector: 'Eigenvector'
        };
        if (metricBtn && !metricBtn._bound) {
            metricBtn._bound = true;
            metricBtn.addEventListener('click', function() {
                if (!window.GraphView || !window.GraphView.cycleMetric) return;
                var result = window.GraphView.cycleMetric();
                var cur = window.GraphView.getCurrentMetric();
                if (result) {
                    metricBtn.style.background = 'rgba(167, 139, 250, 0.2)';
                    metricBtn.style.borderColor = 'rgba(167, 139, 250, 0.5)';
                    if (metricLabel) {
                        metricLabel.textContent = METRIC_NAMES[result.metric] +
                            ' (' + result.minV.toFixed(2) + '–' + result.maxV.toFixed(2) + ')';
                    }
                    if (window.showNotification) {
                        window.showNotification('📊 Размер по ' + METRIC_NAMES[result.metric]);
                    }
                } else {
                    metricBtn.style.background = '';
                    metricBtn.style.borderColor = '';
                    if (metricLabel) metricLabel.textContent = '';
                    if (window.showNotification) {
                        window.showNotification('📊 Размер по типу узла');
                    }
                }
            });
        }
    }
};

console.log('✅ GRAPH-PANEL.JS готов');


// ============================================================
// ЛЕГЕНДА СООБЩЕСТВ (Louvain) — глобальные функции
// ============================================================
(function() {
    function renderCommunityLegend(communities) {
        var container = document.getElementById('legend');
        if (!container) return;

        var oldBlock = document.getElementById('legend-communities');
        if (oldBlock) oldBlock.remove();

        if (!communities) return;

        var groups = {};
        for (var id in communities) {
            var c = communities[id];
            if (!groups[c]) groups[c] = [];
            groups[c].push(id);
        }

        var block = document.createElement('div');
        block.id = 'legend-communities';
        block.style.marginTop = '12px';
        block.style.paddingTop = '10px';
        block.style.borderTop = '1px solid rgba(255,255,255,0.08)';

        var title = document.createElement('h3');
        title.textContent = 'Сообщества (Louvain)';
        title.style.margin = '0 0 8px 0';
        title.style.fontSize = '11px';
        title.style.color = '#e8f0f8';
        block.appendChild(title);

        var palette = (window.GraphView && window.GraphView.LOUVAIN_PALETTE) || [
            '#58a6ff', '#3fb950', '#f0883e', '#a371f7',
            '#f85149', '#e3b341', '#56d4dd', '#db61a2',
            '#7ee787', '#ffa657'
        ];

        var keys = Object.keys(groups).map(Number).sort(function(a, b) { return a - b; });
        for (var i = 0; i < keys.length; i++) {
            var cid = keys[i];
            var members = groups[cid];
            var color = palette[cid % palette.length];

            var item = document.createElement('div');
            item.className = 'legend-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '6px';
            item.style.padding = '2px 0';
            item.style.fontSize = '10px';
            item.style.color = '#c0d0e0';

            var swatch = document.createElement('span');
            swatch.style.display = 'inline-block';
            swatch.style.width = '12px';
            swatch.style.height = '12px';
            swatch.style.borderRadius = '50%';
            swatch.style.background = color;
            swatch.style.flexShrink = '0';
            item.appendChild(swatch);

            var label = document.createElement('span');
            label.textContent = 'Сообщество ' + cid + ' (' + members.length + ')';
            item.appendChild(label);

            block.appendChild(item);
        }

        container.appendChild(block);
    }

    function clearCommunityLegend() {
        var old = document.getElementById('legend-communities');
        if (old) old.remove();
    }

    window.renderCommunityLegend = renderCommunityLegend;
    window.clearCommunityLegend = clearCommunityLegend;
    console.log('✅ Легенда сообществ готова (renderCommunityLegend, clearCommunityLegend)');
})();


// ============================================================
// СТИЛИ ПОПАПА УЗЛА — инжектим в <head>
// ============================================================
(function() {
    if (document.getElementById('node-popup-styles')) return;
    var style = document.createElement('style');
    style.id = 'node-popup-styles';
    style.textContent = [
        '.node-popup {',
        '  position: fixed;',
        '  top: 80px;',
        '  right: 20px;',
        '  width: 320px;',
        '  max-height: 70vh;',
        '  overflow-y: auto;',
        '  background: rgba(10, 10, 30, 0.96);',
        '  border: 1px solid rgba(91, 192, 248, 0.3);',
        '  border-radius: 8px;',
        '  padding: 14px 16px;',
        '  color: #c8d0d8;',
        '  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;',
        '  font-size: 12px;',
        '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);',
        '  z-index: 10000;',
        '  display: none;',
        '}',
        '.node-popup-header {',
        '  display: flex;',
        '  justify-content: space-between;',
        '  align-items: flex-start;',
        '  margin-bottom: 6px;',
        '  gap: 8px;',
        '}',
        '.node-popup-title {',
        '  font-size: 14px;',
        '  font-weight: 600;',
        '  color: #e8f0f8;',
        '  line-height: 1.3;',
        '}',
        '.node-popup-close {',
        '  background: rgba(255, 255, 255, 0.06);',
        '  border: none;',
        '  color: #8b949e;',
        '  width: 22px;',
        '  height: 22px;',
        '  border-radius: 4px;',
        '  cursor: pointer;',
        '  font-size: 12px;',
        '  flex-shrink: 0;',
        '}',
        '.node-popup-close:hover { background: rgba(239, 68, 68, 0.2); color: #f85149; }',
        '.node-popup-id {',
        '  font-family: monospace;',
        '  font-size: 10px;',
        '  color: #6a7a8a;',
        '  margin-bottom: 8px;',
        '}',
        '.node-popup-meta {',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 4px;',
        '  margin-bottom: 10px;',
        '  padding-bottom: 10px;',
        '  border-bottom: 1px solid rgba(255, 255, 255, 0.08);',
        '  font-size: 11px;',
        '}',
        '.comm-dot {',
        '  display: inline-block;',
        '  width: 9px;',
        '  height: 9px;',
        '  border-radius: 50%;',
        '  margin-right: 5px;',
        '  vertical-align: middle;',
        '}',
        '.node-popup-metrics {',
        '  width: 100%;',
        '  border-collapse: collapse;',
        '  margin-bottom: 10px;',
        '}',
        '.node-popup-metrics td {',
        '  padding: 3px 0;',
        '  font-size: 11px;',
        '}',
        '.node-popup-metrics td:first-child {',
        '  color: #8b949e;',
        '  width: 45%;',
        '}',
        '.node-popup-metrics td:last-child {',
        '  color: #5bc0f8;',
        '  font-family: monospace;',
        '  text-align: right;',
        '}',
        '.node-popup-neighbors {',
        '  font-size: 10px;',
        '  color: #8b949e;',
        '  margin-bottom: 10px;',
        '  padding: 8px 0;',
        '  border-top: 1px solid rgba(255, 255, 255, 0.06);',
        '  line-height: 1.5;',
        '  word-break: break-word;',
        '}',
        '.node-popup-footer {',
        '  display: flex;',
        '  gap: 6px;',
        '}',
        '.node-popup-footer .btn {',
        '  flex: 1;',
        '  padding: 5px 10px;',
        '  font-size: 11px;',
        '}'
    ].join('\n');
    document.head.appendChild(style);
    console.log('✅ Стили попапа узла добавлены');
})();


// ============================================================
// HEAT-ЛЕГЕНДА — в правом нижнем углу под основной
// ============================================================
(function() {
    function renderHeatmapLegend(result) {
        var container = document.getElementById('legend');
        if (!container || !result) return;

        var old = document.getElementById('legend-heatmap');
        if (old) old.remove();

        var block = document.createElement('div');
        block.id = 'legend-heatmap';
        block.style.marginTop = '12px';
        block.style.paddingTop = '10px';
        block.style.borderTop = '1px solid rgba(255,255,255,0.08)';

        var title = document.createElement('h3');
        title.textContent = '🌡️ ' + (result.metricName || 'Heatmap');
        title.style.margin = '0 0 8px 0';
        title.style.fontSize = '11px';
        title.style.color = '#e8f0f8';
        block.appendChild(title);

        var range = document.createElement('div');
        range.style.fontSize = '10px';
        range.style.color = '#8b949e';
        range.style.marginBottom = '6px';
        range.textContent = result.min.toFixed(2) + ' — ' + result.max.toFixed(2);
        block.appendChild(range);

        for (var i = 0; i < result.colors.length; i++) {
            var item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '6px';
            item.style.padding = '2px 0';
            item.style.fontSize = '10px';
            item.style.color = '#c0d0e0';

            var swatch = document.createElement('span');
            swatch.style.display = 'inline-block';
            swatch.style.width = '14px';
            swatch.style.height = '12px';
            swatch.style.borderRadius = '2px';
            swatch.style.background = result.colors[i];
            swatch.style.flexShrink = '0';
            item.appendChild(swatch);

            var lo = result.min + (result.max - result.min) * (i / 5);
            var hi = result.min + (result.max - result.min) * ((i + 1) / 5);

            var label = document.createElement('span');
            label.textContent = lo.toFixed(2) + ' – ' + hi.toFixed(2);
            item.appendChild(label);

            block.appendChild(item);
        }

        container.appendChild(block);
    }

    function clearHeatmapLegend() {
        var old = document.getElementById('legend-heatmap');
        if (old) old.remove();
    }

    window.renderHeatmapLegend = renderHeatmapLegend;
    window.clearHeatmapLegend = clearHeatmapLegend;
    console.log('✅ Heat-легенда готова (renderHeatmapLegend, clearHeatmapLegend)');
})();

