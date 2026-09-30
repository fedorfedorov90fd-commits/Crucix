console.log('refresh.js загружен');
var refreshTimer = null;
function startAutoRefresh(seconds) {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (seconds > 0) {
        refreshTimer = setInterval(function() {
            if (typeof refreshMapData === 'function') refreshMapData();
        }, seconds * 1000);
    }
}
function refreshMapData() {
    console.log('[refresh] Обновление данных...');
    if (typeof generateAllMarkers === 'function') generateAllMarkers();
    if (typeof updateMarkers === 'function') updateMarkers(window.markerData || []);
    if (typeof calculateSSI === 'function') calculateSSI();
    if (typeof updateCII === 'function') updateCII();
    var el = document.getElementById('update-text');
    if (el) el.textContent = new Date().toLocaleTimeString();
}
window.startAutoRefresh = startAutoRefresh;
window.refreshMapData = refreshMapData;
console.log('refresh.js готов');
