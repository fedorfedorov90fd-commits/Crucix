// ============================================================
// INIT.JS — Запуск Network Map
// ============================================================
// Инициализирует SVG-граф, панель слоёв, легенду, аналитику.
// Убран баг window.map.invalidateSize() — в Network Map нет
// window.map, есть window.GraphView.
// ============================================================

console.log('🚀 INIT.JS (network-map) загружен');

async function loadData() {
    try {
        if (window.showNotification) {
            window.showNotification('⏳ Загрузка Network Map...');
        }

        // 1. Инициализация графа
        var svg = document.getElementById('graph-svg');
        if (!svg) {
            console.error('[init] SVG #graph-svg не найден');
            return;
        }
        if (window.GraphView && window.GraphView.init) {
            window.GraphView.init(svg);
            console.log('[init] GraphView инициализирован');
        } else {
            console.error('[init] window.GraphView не определён');
            return;
        }

        // 2. Панель слоёв
        if (window.allLayers && window.allLayers.length > 0) {
            console.log('[init] Слоёв: ' + window.allLayers.length);
            if (window.GraphPanel && window.GraphPanel.renderLayerPanel) {
                window.GraphPanel.renderLayerPanel(window.allLayers);
            }
            var lc = document.getElementById('layer-count');
            if (lc) lc.textContent = window.allLayers.length;
        }

        // 3. Легенда форм узлов
        if (window.GraphPanel && window.GraphPanel.renderLegend) {
            window.GraphPanel.renderLegend();
        }

        // 4. Панель управления (слайдеры, кнопки)
        if (window.GraphPanel && window.GraphPanel.updateControls) {
            window.GraphPanel.updateControls();
        }

        // 5. Обработчик поиска слоёв
        var searchInput = document.getElementById('layer-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                var q = this.value.toLowerCase().trim();
                document.querySelectorAll('#layer-grid .layer-item').forEach(function(el) {
                    var name = (el.textContent || '').toLowerCase();
                    var id = el.getAttribute('data-id') || '';
                    var match = !q || name.indexOf(q) !== -1 || id.toLowerCase().indexOf(q) !== -1;
                    el.style.display = match ? 'flex' : 'none';
                });
            });
        }

        // 6. Обработчик кнопки toggle-layer-panel
        var toggleBtn = document.getElementById('panel-toggle-btn');
        if (toggleBtn && !toggleBtn._bound) {
            toggleBtn._bound = true;
            toggleBtn.addEventListener('click', function() {
                if (window.toggleLayerPanel) window.toggleLayerPanel();
            });
        }

        // 7. Обработчик refresh
        var refreshSelect = document.getElementById('refresh-interval');
        if (refreshSelect) {
            var saved = localStorage.getItem('crucix-refresh-interval');
            if (saved) refreshSelect.value = saved;
            refreshSelect.addEventListener('change', function() {
                var v = parseInt(this.value, 10) || 0;
                localStorage.setItem('crucix-refresh-interval', String(v));
                if (window.startAutoRefresh) window.startAutoRefresh(v);
            });
        }
        var refreshNow = document.getElementById('refresh-now-btn');
        if (refreshNow) {
            refreshNow.addEventListener('click', function() {
                if (window.refreshMapData) window.refreshMapData();
                if (window.updateLastRefresh) window.updateLastRefresh();
            });
        }

        // 8. Загрузка слоя по умолчанию (первый из allLayers)
        if (window.allLayers && window.allLayers.length > 0 &&
            window.NetworkMap && window.NetworkMap.loadLayer) {
            window.NetworkMap.loadLayer(window.allLayers[0].id);
        }

        // 9. Скрыть overlay
        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';

        // 10. Обновить SSI и CII
        if (window.calculateSSI) window.calculateSSI();
        if (window.updateCII) window.updateCII();

        if (window.showNotification) {
            window.showNotification('✅ Network Map загружена');
        }
        if (window.updateLastRefresh) {
            window.updateLastRefresh();
        }

        console.log('[init] Загрузка завершена');
    } catch (e) {
        console.error('❌ Ошибка загрузки Network Map:', e);
        var ov = document.getElementById('loading-overlay');
        if (ov) {
            ov.innerHTML = '<div style="color:#f85149;">❌ ' + e.message + '</div>';
        }
        if (window.showNotification) {
            window.showNotification('❌ Ошибка загрузки');
        }
    }
}

function initApp() {
    if (window.CrucixLogger && window.CrucixLogger.info) {
        window.CrucixLogger.info('Network Map init');
    }
    loadData();
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

window.loadData = loadData;
window.initApp = initApp;

console.log('✅ INIT.JS (network-map) готов');
