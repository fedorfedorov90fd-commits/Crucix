// ============================================================
// INIT.JS — Запуск Forecast Map (v2.0)
// ============================================================
// Защита от преждевременного window.map: проверяем наличие
// addLayer, а не только факт существования объекта.
// ============================================================

console.log('INIT.JS загружен (Forecast Map v2.0)');

let currentLayer = 'all';

function isLeafletMap(obj) {
    return obj && typeof obj.addLayer === 'function' && typeof obj.invalidateSize === 'function';
}

async function loadData() {
    try {
        if (typeof window.showNotification === 'function') {
            window.showNotification('⏳ Загрузка прогнозной карты...');
        }

        var countries = window.ALL_COUNTRIES || [];
        var ccEl = document.getElementById('countries-count');
        if (ccEl && countries.length > 0) {
            ccEl.textContent = '🌍 ' + countries.length + ' стран';
        }

        if (window.allLayers && window.allLayers.length > 0) {
            console.log('[loadData] Слоёв: ' + window.allLayers.length);
            if (typeof window.renderLayerPanel === 'function') {
                window.renderLayerPanel(window.allLayers);
            }
        }

        if (typeof window.generateAllMarkers === 'function') {
            window.generateAllMarkers();
        }

        if (typeof window.calculateSSI === 'function') {
            window.calculateSSI();
        }

        if (typeof window.loadCountryBoundaries === 'function') {
            await window.loadCountryBoundaries();
        }

        if (typeof window.ForecastMap !== 'undefined' && window.ForecastMap.init) {
            window.ForecastMap.init();
            console.log('[loadData] ForecastMap.init() вызван');
        }

        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';

        if (isLeafletMap(window.map)) {
            setTimeout(function() {
                if (isLeafletMap(window.map)) window.map.invalidateSize();
            }, 500);
        }

        var now = new Date().toLocaleTimeString('ru-RU');
        var updateText = document.getElementById('update-text');
        if (updateText) updateText.textContent = now;

        if (typeof window.showNotification === 'function') {
            window.showNotification('✅ Прогнозная карта загружена');
        }
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        var overlay2 = document.getElementById('loading-overlay');
        if (overlay2) overlay2.innerHTML = '<div class="text" style="color:#ef4444;">ОШИБКА: ' + e.message + '</div>';
    }
}

function initMap() {
    // Защита: если window.map уже существует И является Leaflet-объектом
    if (isLeafletMap(window.map)) {
        setTimeout(function() {
            if (isLeafletMap(window.map)) window.map.invalidateSize();
        }, 300);
        loadData();
        return;
    }

    // Проверка Leaflet
    if (typeof L === 'undefined' || typeof L.map !== 'function') {
        console.error('[initMap] Leaflet не загружен');
        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.innerHTML = '<div class="text" style="color:#ef4444;">Leaflet не загружен</div>';
        return;
    }

    // Проверка DOM-элемента
    var mapEl = document.getElementById('map');
    if (!mapEl) {
        console.error('[initMap] Элемент #map не найден');
        return;
    }

    // Создаём Leaflet-карту
    try {
        window.map = L.map('map', {
            center: [30, 20],
            zoom: 2.5,
            zoomControl: true,
            minZoom: 1.5,
            maxZoom: 10,
            zoomSnap: 0.2,
            zoomDelta: 0.25,
            wheelPxPerZoomLevel: 120,
            bounceAtZoomLimits: false
        });
        console.log('[initMap] Leaflet-карта создана, addLayer=' + (typeof window.map.addLayer));

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
            opacity: 0.9
        }).addTo(window.map);
    } catch (e) {
        console.error('[initMap] Ошибка создания карты: ' + e.message);
        return;
    }

    var toggleBtn = document.getElementById('panel-toggle-btn');
    if (toggleBtn) toggleBtn.classList.add('visible');

    // Дать Leaflet инициализироваться, потом загружать данные
    setTimeout(function() {
        if (isLeafletMap(window.map)) {
            window.map.invalidateSize();
        }
        loadData();
    }, 100);

    var savedLayer = localStorage.getItem('crucix-active-layer');
    if (savedLayer && savedLayer !== 'all') {
        setTimeout(function() {
            if (typeof window.loadLayer === 'function') {
                window.loadLayer(savedLayer);
            }
        }, 2500);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var savedLang = localStorage.getItem('crucix-lang') || 'ru';

    var select = document.getElementById('refresh-interval');
    if (select) {
        var savedInterval = localStorage.getItem('crucix-refresh-interval');
        if (savedInterval) select.value = savedInterval;
        if (typeof window.startAutoRefresh === 'function') {
            window.startAutoRefresh(parseInt(select.value));
        }
        select.addEventListener('change', function() {
            var val = parseInt(this.value);
            localStorage.setItem('crucix-refresh-interval', this.value);
            if (typeof window.startAutoRefresh === 'function') window.startAutoRefresh(val);
        });
    }

    if (typeof L !== 'undefined') {
        initMap();
    } else {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.innerHTML = '<div class="text" style="color:#ef4444;">Leaflet не загружен</div>';
    }
});

window.loadData = loadData;
window.initMap = initMap;

if (typeof window.updateCII === 'function') {
    window.updateCII();
    setInterval(window.updateCII, 5 * 60 * 1000);
} else {
    console.warn('updateCII не найдена — CII отключён');
}

console.log('INIT.JS готов (Forecast Map v2.0)');
