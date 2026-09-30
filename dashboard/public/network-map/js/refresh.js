// refresh.js — Автообновление (локальный)
console.log('🔄 REFRESH.JS (network-map) загружен');

var refreshTimer = null;

window.startAutoRefresh = function(interval) {
    if (refreshTimer) clearInterval(refreshTimer);
    if (interval === 0) return;
    refreshTimer = setInterval(function() {
        if (window.NetworkMap && window.NetworkMap.currentLayer) {
            console.log('[Refresh] Обновление слоя:', window.NetworkMap.currentLayer);
            window.NetworkMap.loadLayer(window.NetworkMap.currentLayer);
        }
    }, interval);
};

window.refreshMapData = function() {
    if (window.NetworkMap && window.NetworkMap.currentLayer) {
        window.NetworkMap.loadLayer(window.NetworkMap.currentLayer);
        showNotification('🔄 Данные обновлены');
    }
};
