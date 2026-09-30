// ============================================================
// INIT.JS — Запуск с загрузкой из API (исправленная версия)
// ============================================================

console.log('🚀 INIT.JS загружен');

let currentLayer = 'all';

// ============================================================
// ЗАГРУЗКА ВСЕХ ДАННЫХ
// ============================================================

async function loadData() {
    try {
        showNotification('⏳ Загрузка данных...');

        const countries = window.ALL_COUNTRIES || [];
        if (countries.length > 0) {
            console.log('[loadData] Загружено стран:', countries.length);
            document.getElementById('countries-count').textContent =
                '🌍 ' + countries.length + ' ' + (window.LANG_DATA?.[currentLang]?.countries || 'стран');
        } else {
            console.warn('[loadData] Нет данных стран, используем запасные');
            window.ALL_COUNTRIES = [
                { id: 'russia', name: 'Россия', status: 'pre-war', color: '#f97316', lat: 61.5, lng: 105 },
                { id: 'ukraine', name: 'Украина', status: 'critical', color: '#ef4444', lat: 48.4, lng: 31.2 },
                { id: 'usa', name: 'США', status: 'low', color: '#22c55e', lat: 39.7, lng: -98.8 }
            ];
            window.countryData = window.ALL_COUNTRIES.reduce((acc, c) => {
                acc[c.id] = c;
                return acc;
            }, {});
            document.getElementById('countries-count').textContent = '🌍 ' + window.ALL_COUNTRIES.length + ' стран';
        }

        // Загружаем слои из layers.js (window.allLayers → renderLayerPanel)
        if (window.allLayers && window.allLayers.length > 0) {
            console.log('[loadData] Слои из window.allLayers:', window.allLayers.length);
            if (typeof renderLayerPanel === 'function') {
                renderLayerPanel(window.allLayers);
            } else {
                console.warn('[loadData] renderLayerPanel не найдена');
            }
        } else {
            console.warn('[loadData] window.allLayers пуст — слои не загружены');
        }
        if (typeof generateAllMarkers === 'function') {
            generateAllMarkers();
        } else {
            console.warn('[loadData] generateAllMarkers не определена');
            window.markerData = [];
            window.allMarkers = [];
        }

        const markers = window.markerData || [];
        if (typeof updateMarkers === 'function') {
            if (currentLayer === 'all') {
                updateMarkers(markers);
            } else {
                const filtered = markers.filter(m => m.layer === currentLayer);
                updateMarkers(filtered.length > 0 ? filtered : markers);
            }
        } else {
            console.warn('[loadData] updateMarkers не определена');
        }

        if (typeof calculateSSI === 'function') {
            calculateSSI();
        }

        if (typeof loadCountryBoundaries === 'function') {
            await loadCountryBoundaries();
        } else {
            console.warn('[loadData] loadCountryBoundaries не определена, пропускаем');
        }

        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
        if (window.map) setTimeout(() => window.map.invalidateSize(), 500);

        const now = new Date().toLocaleTimeString();
        const updateText = document.getElementById('update-text');
        if (updateText) updateText.textContent = now;

        showNotification('✅ Данные загружены');

    } catch (e) {
        console.error('❌ Ошибка загрузки данных:', e);
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.innerHTML = '<div class="text" style="color:#ef4444;">❌ ОШИБКА: ' + e.message + '</div>';
        showNotification('❌ Ошибка загрузки данных');
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ КАРТЫ (с уменьшенным шагом масштабирования)
// ============================================================

function initMap() {
    if (window.map) {
        console.log('[initMap] Карта уже существует, используем её');
        setTimeout(() => window.map.invalidateSize(), 300);
        loadData();
        return;
    }

    // ★ ИСПРАВЛЕНИЕ: уменьшаем шаг масштабирования с 1 до 0.2
    // zoomSnap: 0.2 — плавное масштабирование
    // wheelPxPerZoomLevel: 120 — чувствительность колеса мыши
    window.map = L.map('map', {
        center: [30, 20],
        zoom: 2.5,
        zoomControl: true,
        minZoom: 1.5,
        maxZoom: 10,
        zoomSnap: 0.2,           // ★ шаг масштабирования 0.2 (было 1)
        zoomDelta: 0.25,         // ★ шаг при клике на +/- (было 1)
        wheelPxPerZoomLevel: 120, // ★ чувствительность колеса
        bounceAtZoomLimits: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        opacity: 0.9
    }).addTo(window.map);

    const toggleBtn = document.getElementById('panel-toggle-btn');
    if (toggleBtn) toggleBtn.classList.add('visible');

    loadData();

    const savedLayer = localStorage.getItem('crucix-active-layer');
    if (savedLayer && savedLayer !== 'all') {
        setTimeout(() => {
            if (typeof loadLayer === 'function') {
                loadLayer(savedLayer);
            }
        }, 2000);
    }
}

// ============================================================
// ЗАПУСК
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    const savedLang = localStorage.getItem('crucix-lang') || 'ru';
    if (typeof setLanguage === 'function') {
        setLanguage(savedLang);
    } else {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === savedLang);
        });
    }

    const select = document.getElementById('refresh-interval');
    const btn = document.getElementById('refresh-now-btn');
    if (select) {
        const savedInterval = localStorage.getItem('crucix-refresh-interval');
        if (savedInterval) select.value = savedInterval;
        if (typeof startAutoRefresh === 'function') {
            startAutoRefresh(parseInt(select.value));
        }
        select.addEventListener('change', function() {
            const val = parseInt(this.value);
            localStorage.setItem('crucix-refresh-interval', this.value);
            if (typeof startAutoRefresh === 'function') {
                startAutoRefresh(val);
                showNotification('🔄 Интервал: ' + (val === 0 ? 'выключен' : formatInterval(val)));
            }
        });
    }
    if (btn && typeof refreshMapData === 'function') {
        btn.addEventListener('click', function() {
            refreshMapData();
        });
    }

    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        copyBtn.textContent = window.LANG_DATA?.[currentLang]?.copy || '📋 КОПИРОВАТЬ';
    }

    if (typeof L !== 'undefined') {
        initMap();
    } else {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.innerHTML = '<div class="text" style="color:#ef4444;">❌ ОШИБКА: Leaflet не загружен</div>';
    }
});

window.loadData = loadData;
window.initMap = initMap;
// Инициализация CII (через window, без import — совместимо с оконной архитектурой)
if (typeof window.updateCII === 'function') {
    window.updateCII();
    setInterval(window.updateCII, 5 * 60 * 1000);
} else {
    console.warn("⚠️ updateCII не найдена в window — CII отключён");
}
