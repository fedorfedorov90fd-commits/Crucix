// ============================================================
// REFRESH.JS — Автообновление (автономная копия)
// ============================================================
console.log('🔮 REFRESH.JS загружен (Forecast Map)');

var refreshTimer = null;

function startAutoRefresh(interval) {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (interval > 0) {
        refreshTimer = setInterval(function() {
            if (typeof window.loadData === 'function') {
                console.log('[Refresh] Автообновление...');
                window.loadData();
            }
        }, interval);
        console.log('[Refresh] Интервал: ' + (interval / 1000) + ' сек');
    } else {
        console.log('[Refresh] Автообновление выключено');
    }
}

function refreshMapData() {
    console.log('[Refresh] Ручное обновление');
    if (typeof window.loadData === 'function') {
        window.loadData();
    }
}

window.startAutoRefresh = startAutoRefresh;
window.refreshMapData = refreshMapData;
console.log('✅ REFRESH.JS готов');