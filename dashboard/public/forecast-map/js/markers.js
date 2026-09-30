// ============================================================
// MARKERS.JS — Маркеры для Forecast Map (автономная копия)
// ============================================================
console.log('🔮 MARKERS.JS загружен (Forecast Map)');

window.markerData = [];
window.allMarkers = [];
var markerCluster = null;

function generateAllMarkers() {
    window.markerData = [];
    var layers = window.allLayers || [];
    layers.forEach(function(layer) {
        if (layer.vizType === 'marker') {
            // Маркеры генерируются при загрузке слоя через API
            // Здесь только инициализация
        }
    });
    if (typeof updateMarkers === 'function') {
        updateMarkers(window.markerData);
    }
    console.log('[Forecast Map] Маркеры инициализированы');
}

function updateMarkers(markers) {
    if (!window.map) return;
    if (markerCluster) {
        window.map.removeLayer(markerCluster);
        markerCluster = null;
    }
    if (!markers || markers.length === 0) return;

    markerCluster = L.markerClusterGroup({ maxClusterRadius: 40 });
    markers.forEach(function(m) {
        if (m.lat && m.lng) {
            var marker = L.marker([m.lat, m.lng], {
                icon: L.divIcon({
                    className: 'forecast-marker',
                    html: '<div class="marker-icon" style="background:' + (m.color || '#ff4400') + ';">' + (m.icon || '⚠️') + '</div>',
                    iconSize: [30, 30], iconAnchor: [15, 15]
                })
            });
            if (m.description) marker.bindPopup(m.description);
            markerCluster.addLayer(marker);
        }
    });
    window.map.addLayer(markerCluster);
    console.log('[Forecast Map] Маркеров: ' + markers.length);
}

function removeLayer(layerId) {
    if (window.ForecastMap) {
        window.ForecastMap.removeLayerData(layerId);
    }
    window.markerData = window.markerData.filter(function(m) { return m.layer !== layerId; });
    updateMarkers(window.markerData);
}

window.generateAllMarkers = generateAllMarkers;
window.updateMarkers = updateMarkers;
window.removeLayer = removeLayer;
console.log('✅ MARKERS.JS готов (Forecast Map)');