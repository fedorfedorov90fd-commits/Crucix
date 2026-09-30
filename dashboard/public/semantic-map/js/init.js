console.log('🚀 INIT.JS загружен (' + (window.CrucixMap?.mapType || 'unknown') + ')');

if (typeof window.Logger === 'undefined') {
    window.Logger = {
        info: function(msg) { console.log('[INFO] ' + msg); },
        warn: function(msg) { console.warn('[WARN] ' + msg); },
        error: function(msg) { console.error('[ERROR] ' + msg); },
        debug: function(msg) { if (window.CrucixConfig?.debug) console.log('[DEBUG] ' + msg); }
    };
}

var currentLayer = 'all';

async function loadData() {
    try {
        showNotification('⏳ Загрузка данных...');

        var countries = window.ALL_COUNTRIES || [];
        if (countries.length > 0) {
            var el = document.getElementById('countries-count');
            if (el) el.textContent = '🌍 ' + countries.length + ' стран';
        }

        if (window.allLayers && window.allLayers.length > 0) {
            Logger.info('Layers: ' + window.allLayers.length);
            var lc = document.getElementById('layer-count');
            if (lc) lc.textContent = window.allLayers.length;
            if (typeof renderLayerPanel === 'function') {
                renderLayerPanel(window.allLayers);
            }
        }

        if (typeof generateAllMarkers === 'function') {
            generateAllMarkers();
        }

        var markers = window.markerData || [];
        var mc = document.getElementById('marker-count');
        if (mc) mc.textContent = markers.length;

        if (typeof updateMarkers === 'function') {
            if (currentLayer === 'all') updateMarkers(markers);
            else updateMarkers(markers.filter(function(m) { return m.layer === currentLayer; }));
        }

        if (typeof calculateSSI === 'function') {
            calculateSSI();
        }

        if (typeof loadCountryBoundaries === 'function') {
            await loadCountryBoundaries();
        }

        if (window.SemanticMap && typeof window.SemanticMap.init === 'function') {
            Logger.info('Initializing SemanticMap orchestrator');
            window.SemanticMap.init();
        }

        if (typeof window.updateCII === 'function') {
            try { window.updateCII(); } catch (e) { console.warn('[init] CII:', e.message); }
        }

        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
        if (window.leafletMap) setTimeout(function() { window.leafletMap.invalidateSize(); }, 500);

        showNotification('✅ Данные загружены');

    } catch (e) {
        console.error('❌ Ошибка загрузки:', e);
        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.innerHTML = '<div style="color:#ef4444;">❌ ' + e.message + '</div>';
        showNotification('❌ Ошибка загрузки');
    }
}

function initMap() {
    if (window.leafletMap && typeof window.leafletMap.invalidateSize === 'function') {
        setTimeout(function() { window.leafletMap.invalidateSize(); }, 300);
        loadData();
        return;
    }

    window.leafletMap = L.map('crucix-map', {
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
    }).addTo(window.leafletMap);

    var tb = document.getElementById('panel-toggle-btn');
    if (tb) tb.classList.add('visible');

    loadData();
}

document.addEventListener('DOMContentLoaded', function() {
    var savedLang = localStorage.getItem('crucix-lang') || 'ru';
    if (typeof setLanguage === 'function') setLanguage(savedLang);

    var select = document.getElementById('refresh-interval');
    var btn = document.getElementById('refresh-now-btn');

    if (select) {
        var si = localStorage.getItem('crucix-refresh-interval');
        if (si) select.value = si;
        select.addEventListener('change', function() {
            var v = parseInt(this.value);
            localStorage.setItem('crucix-refresh-interval', this.value);
            if (typeof startAutoRefresh === 'function') startAutoRefresh(v);
        });
    }
    if (btn && typeof refreshMapData === 'function') {
        btn.addEventListener('click', function() {
            if (window._autoRefreshPaused) return;
            refreshMapData();
        });
    }

    if (typeof L !== 'undefined') initMap();
    else {
        var o = document.getElementById('loading-overlay');
        if (o) o.innerHTML = '<div style="color:#ef4444;">❌ Leaflet не загружен</div>';
    }
});

window.loadData = loadData;
window.initMap = initMap;
window.currentLayer = currentLayer;

if (typeof window.updateCII === 'function') {
    setInterval(function() {
        if (window._autoRefreshPaused) return;
        window.updateCII();
    }, 5 * 60 * 1000);
}

console.log('✅ INIT.JS готов');
