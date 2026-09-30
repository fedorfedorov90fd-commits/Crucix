// ============================================================
// NETWORK-MAP.JS — Оркестратор Network Map
// ============================================================
// Загружает слой через API, конвертирует в граф, отображает.
// Если API вернул пустоту — использует demo-данные.
// ============================================================

console.log('🎯 NETWORK-MAP.JS загружен');

window.NetworkMap = {
    currentLayer: null,
    graphData: null,

    init: function() {
        console.log('[NetworkMap] Инициализация...');
        var svg = document.getElementById('graph-svg');
        if (!svg) {
            console.error('[NetworkMap] SVG #graph-svg не найден');
            return;
        }
        if (window.GraphView && window.GraphView.init) {
            window.GraphView.init(svg);
        }
        if (window.GraphPanel && window.GraphPanel.renderLegend) {
            window.GraphPanel.renderLegend();
        }
        if (window.GraphPanel && window.GraphPanel.updateControls) {
            window.GraphPanel.updateControls();
        }
        console.log('[NetworkMap] Готов');
    },

    loadLayer: function(layerId) {
        var self = this;
        self.currentLayer = layerId;

        // UI: подсветка активного слоя
        document.querySelectorAll('.layer-item').forEach(function(el) {
            el.classList.toggle('active', el.getAttribute('data-id') === layerId);
        });

        var route = (window.NetworkMapConfig && window.NetworkMapConfig.apiRoutes)
            ? window.NetworkMapConfig.apiRoutes[layerId]
            : null;

        if (route) {
            fetch(route)
                .then(function(r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function(data) {
                    var graph = window.NetworkAdapter.convert(data, layerId);
                    // Если конвертация дала пустой граф — используем demo
                    if (!graph || !graph.nodes || graph.nodes.length === 0) {
                        console.warn('[NetworkMap] API пустой для ' + layerId + ', demo');
                        graph = window.NetworkAdapter.generateDemo(layerId);
                    }
                    self.graphData = graph;
                    window.GraphView.setData(graph, layerId);
                    self._updateStats(graph);
                })
                .catch(function(err) {
                    console.warn('[NetworkMap] API недоступен для ' + layerId + ', demo:', err.message);
                    var demo = window.NetworkAdapter.generateDemo(layerId);
                    self.graphData = demo;
                    window.GraphView.setData(demo, layerId);
                    self._updateStats(demo);
                });
        } else {
            var demo = window.NetworkAdapter.generateDemo(layerId);
            self.graphData = demo;
            window.GraphView.setData(demo, layerId);
            self._updateStats(demo);
        }
    },

    _updateStats: function(graph) {
        if (!graph || !graph.nodes) return;
        var centrality = window.Relations.degreeCentrality(graph);
        var components = window.Relations.findComponents(graph);
        var keys = Object.keys(centrality);
        var maxNode = keys.reduce(function(a, b) {
            return centrality[a] > centrality[b] ? a : b;
        }, keys[0] || '—');
        console.log(
            '[NetworkMap] Узлов: ' + graph.nodes.length +
            ' Связей: ' + graph.edges.length +
            ' Компонент: ' + components.length +
            ' Центральный: ' + maxNode
        );
    }
};

console.log('✅ NETWORK-MAP.JS готов');
