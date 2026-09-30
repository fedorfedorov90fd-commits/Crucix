// ============================================================
// INIT.JS — Запуск Metrics Map (автономная версия)
// ============================================================
// Версия: 1.1 (2026-09-28)
// ИЗМЕНЕНИЯ против 1.0:
//  - Убран setTimeout(loadLayer(saved), 2000) — вызывал второй
//    параллельный поток загрузки, пересекавшийся с enableAllLayers.
//  - startAutoRefresh НЕ вызывается автоматически при загрузке
//    (только по кнопке или изменению select).
//  - setInterval(updateCII, 5 min) обёрнут в проверку
//    window._autoRefreshPaused — не мешает enableAllLayers.
//  - Остальной функционал сохранён полностью.
// ============================================================

console.log('🚀 INIT.JS загружен (' + (window.CrucixMap?.mapType || 'unknown') + ')');

// Shim: если logger.js не определил window.Logger — создаём заглушку
if (typeof window.Logger === 'undefined') {
    window.Logger = {
        info:  function(msg) { console.log('[INFO] ' + msg); },
        warn:  function(msg) { console.warn('[WARN] ' + msg); },
        error: function(msg) { console.error('[ERROR] ' + msg); },
        debug: function(msg) { if (window.CrucixConfig?.debug) console.log('[DEBUG] ' + msg); }
    };
}


var currentLayer = 'all';

async function loadData() {
    try {
        showNotification('⏳ Загрузка данных...');

        // 1. Страны
        const countries = window.ALL_COUNTRIES || [];
        if (countries.length > 0) {
            const el = document.getElementById('countries-count');
            if (el) el.textContent = '🌍 ' + countries.length + ' ' +
                (window.LANG_DATA?.[currentLang]?.countries || 'стран');
        }

        // 2. Слои
        if (window.allLayers && window.allLayers.length > 0) {
            Logger.info('Layers: ' + window.allLayers.length);
            if (typeof renderLayerPanel === 'function') {
                renderLayerPanel(window.allLayers);
            }
        }

        // 3. Маркеры
        if (typeof generateAllMarkers === 'function') {
            generateAllMarkers();
        }

        const markers = window.markerData || [];
        if (typeof updateMarkers === 'function') {
            if (currentLayer === 'all') updateMarkers(markers);
            else updateMarkers(markers.filter(m => m.layer === currentLayer));
        }

        // 4. SSI
        if (typeof calculateSSI === 'function') {
            calculateSSI();
        }

        // 5. Границы стран (локальный world.geojson)
        if (typeof loadCountryBoundaries === 'function') {
            await loadCountryBoundaries();
        }

        // 6. ★★★ ИНИЦИАЛИЗАЦИЯ METRICS MAP (оркестратор) ★★★
        if (window.MetricsMap && typeof window.MetricsMap.init === 'function') {
            Logger.info('Initializing MetricsMap orchestrator');
            window.MetricsMap.init();
        }

        // 7. CII (с fallback)
        if (typeof window.updateCII === 'function') {
            try {
                window.updateCII();
            } catch (e) {
                console.warn('[init] CII ошибка:', e.message);
            }
        }

        // 8. Скрыть оверлей
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
        if (window.map) setTimeout(() => window.map.invalidateSize(), 500);

        const now = new Date().toLocaleTimeString();
        const ut = document.getElementById('update-text');
        if (ut) ut.textContent = now;

        showNotification('✅ Данные загружены');

    } catch (e) {
        console.error('❌ Ошибка загрузки:', e);
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.innerHTML =
            '<div style="color:#ef4444;">❌ ' + e.message + '</div>';
        showNotification('❌ Ошибка загрузки');
    }
}

function initMap() {
    if (window.map) {
        setTimeout(() => window.map.invalidateSize(), 300);
        loadData();
        return;
    }

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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
        opacity: 0.9
    }).addTo(window.map);

    const tb = document.getElementById('panel-toggle-btn');
    if (tb) tb.classList.add('visible');

    loadData();

    // ★ v1.1: УБРАН setTimeout(loadLayer(saved), 2000).
    // Причина: параллельный поток загрузки последнего слоя
    // пересекался с enableAllLayers и вызывал обрыв цикла
    // на середине (сбрасывал _enableAllInProgress и перезаписывал
    // layerCache). Пользователь сам выберет слой кликом.
    //
    // Если нужно восстановить последний слой — делать это вручную:
    //   const saved = localStorage.getItem('crucix-active-layer');
    //   if (saved && saved !== 'all' && typeof loadLayer === 'function') {
    //       loadLayer(saved);
    //   }
}

document.addEventListener('DOMContentLoaded', function() {
    const savedLang = localStorage.getItem('crucix-lang') || 'ru';
    if (typeof setLanguage === 'function') setLanguage(savedLang);

    const select = document.getElementById('refresh-interval');
    const btn = document.getElementById('refresh-now-btn');

    // ★ v1.1: startAutoRefresh НЕ вызывается автоматически.
    // Причина: второй таймер пересекался с enableAllLayers.
    // Применение восстановлено только по явному изменению select.
    if (select) {
        const si = localStorage.getItem('crucix-refresh-interval');
        if (si) select.value = si;
        // Автозапуск отключён намеренно — только по изменению select:
        // if (typeof startAutoRefresh === 'function') {
        //     startAutoRefresh(parseInt(select.value));
        // }
        select.addEventListener('change', function() {
            const v = parseInt(this.value);
            localStorage.setItem('crucix-refresh-interval', this.value);
            if (typeof startAutoRefresh === 'function') startAutoRefresh(v);
        });
    }
    if (btn && typeof refreshMapData === 'function') {
        btn.addEventListener('click', function() {
            // ★ v1.1: ручное обновление тоже проверяет паузу
            if (window._autoRefreshPaused) {
                console.log('[refresh-now] Пауза (enableAllLayers)');
                return;
            }
            refreshMapData();
        });
    }

    if (typeof L !== 'undefined') initMap();
    else {
        const o = document.getElementById('loading-overlay');
        if (o) o.innerHTML = '<div style="color:#ef4444;">❌ Leaflet не загружен</div>';
    }
});

window.loadData = loadData;
window.initMap = initMap;

// ★ v1.1: setInterval(updateCII) с проверкой паузы.
if (typeof window.updateCII === 'function') {
    setInterval(function() {
        if (window._autoRefreshPaused) {
            console.log('[updateCII interval] Пауза (enableAllLayers)');
            return;
        }
        window.updateCII();
    }, 5 * 60 * 1000);
}

console.log('✅ INIT.JS готов (версия 1.1)');
