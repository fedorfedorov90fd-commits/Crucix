console.log('markers.js загружен');
window.markerData = [];
window.allMarkers = [];
window.markerCluster = null;

function generateAllMarkers() {
    window.markerData = [];
    var layers = window.allLayers || [];
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var count = 2 + Math.floor(Math.random() * 3);
        for (var j = 0; j < count; j++) {
            var lat = (Math.random() - 0.5) * 120;
            var lng = (Math.random() - 0.5) * 340;
            window.markerData.push({
                lat: lat, lng: lng,
                layer: layer.id,
                name: layer.name,
                color: layer.color || '#888',
                icon: layer.icon || '',
                title: (layer.name || layer.id) + ' #' + (j + 1)
            });
        }
    }
    console.log('[markers] Сгенерировано: ' + window.markerData.length + ' маркеров');
}

function updateMarkers(markers) {
    var map = window.leafletMap;
    if (!map) { console.warn('[markers] map не готов'); return; }
    if (window.markerCluster) {
        window.markerCluster.clearLayers();
    } else {
        window.markerCluster = L.markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true, showCoverageOnHover: false });
        map.addLayer(window.markerCluster);
    }
    window.allMarkers = [];
    if (!markers || markers.length === 0) {
        console.log('[markers] Нет маркеров');
        return;
    }
    for (var i = 0; i < markers.length; i++) {
        var m = markers[i];
        if (m.lat == null || m.lng == null) continue;
        var marker = L.marker([m.lat, m.lng]);
        var popup = '<div style="min-width:180px;"><b>' + (m.title || m.name || 'Событие') + '</b><br><span style="color:' + (m.color || '#888') + ';">\u25cf</span> <small>' + (m.layer || '') + '</small></div>';
        marker.bindPopup(popup);
        window.allMarkers.push(marker);
        window.markerCluster.addLayer(marker);
    }
    console.log('[markers] Отображено: ' + window.allMarkers.length + ' маркеров');
}

window.generateAllMarkers = generateAllMarkers;
window.updateMarkers = updateMarkers;
console.log('markers.js готов');
