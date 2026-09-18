// ============================================================
// MARKERS.JS — ОТОБРАЖЕНИЕ МАРКЕРОВ
// ============================================================

console.log('📍 MARKERS.JS загружен');

// ============================================================
// ГЕНЕРАЦИЯ МАРКЕРОВ ДЛЯ СЛОЯ
// ============================================================

function generateMarkersForLayer(layer) {
    const result = [];
    const count = layer.markers || 0;
    if (count === 0) return result;
    const countries = window.ALL_COUNTRIES || [];
    if (countries.length === 0) return result;

    for (let i = 0; i < Math.min(count, 30); i++) {
        const country = countries[Math.floor(Math.random() * countries.length)];
        if (!country) continue;
        const latOffset = (Math.random() - 0.5) * 15;
        const lngOffset = (Math.random() - 0.5) * 15;
        result.push({
            id: layer.id + '-' + i,
            lat: country.lat + latOffset,
            lng: country.lng + lngOffset,
            countryName: country.name,
            title: layer.name + ' #' + (i + 1),
            color: layer.color || '#4a5a6a',
            layer: layer.id,
            status: country.status || 'low',
            summary: 'Событие из слоя ' + layer.name + '.',
            date: new Date().toISOString()
        });
    }
    return result;
}

function generateAllMarkers() {
    const all = [];
    const layers = window.allLayers || [];
    for (const layer of layers) {
        const markers = generateMarkersForLayer(layer);
        if (markers.length > 0) {
            window.layerCache[layer.id] = markers;
            all.push(...markers);
        }
    }
    window.markerData = all;
    window.allMarkers = all;
    return all;
}

// ============================================================
// ОТОБРАЖЕНИЕ МАРКЕРОВ НА КАРТЕ
// ============================================================

function updateMarkers(markers) {
    const map = window.map;
    if (!map) {
        console.warn('⚠️ Карта не инициализирована');
        return;
    }

    // Удаляем старый слой
    if (window.markersLayer) {
        try { map.removeLayer(window.markersLayer); } catch(e) {}
        window.markersLayer = null;
    }

    if (!markers || markers.length === 0) {
        document.getElementById('marker-count').textContent = '0';
        return;
    }

    const group = L.layerGroup();
    const displayMarkers = markers.slice(0, 500);
    const statusColors = {
        critical: '#ef4444',
        'pre-war': '#f97316',
        high: '#f59e0b',
        medium: '#eab308',
        low: '#22c55e',
        normal: '#22c55e'
    };

    let count = 0;
    for (const item of displayMarkers) {
        if (!item.lat || !item.lng) continue;
        if (item.lat === 0 && item.lng === 0) continue;
        const color = statusColors[item.status] || item.color || '#3b82f6';
        const size = item.status === 'critical' ? 14 :
            item.status === 'pre-war' ? 12 :
            item.status === 'high' ? 11 : 10;

        const icon = L.divIcon({
            className: 'event-marker',
            html: '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;">' +
                '<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:' + color + ';border-radius:50%;border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 16px ' + color + '60;animation:pulse 2s infinite;"></div>' +
                '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:' + (size/3.5) + 'px;height:' + (size/3.5) + 'px;background:#fff;border-radius:50%;opacity:0.5;"></div>' +
                '</div>',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });

        const popup = '<div style="padding:4px 0;">' +
            '<strong style="color:#e8f0f8;font-size:13px;">' + (item.title || 'Событие') + '</strong><br>' +
            '<span style="color:' + color + ';font-weight:600;font-size:12px;">' + (item.status ? item.status.toUpperCase() : '—') + '</span>' +
            '<div style="color:#666;font-size:10px;margin-top:2px;">' + (item.countryName || '—') + '</div>' +
            '<div style="color:#4a5a6a;font-size:9px;margin-top:1px;">Слой: ' + (item.layer || 'all') + '</div>' +
            '<div style="color:#4a5a6a;font-size:8px;margin-top:2px;">' + (item.date ? new Date(item.date).toLocaleString() : '') + '</div>' +
            '</div>';

        const marker = L.marker([item.lat, item.lng], { icon: icon });
        marker.bindPopup(popup);
        marker.addTo(group);
        count++;
    }

    group.addTo(map);
    window.markersLayer = group;
    document.getElementById('marker-count').textContent = markers.length;
    console.log('📍 Отображается маркеров:', count, 'из', markers.length);
}

// Экспорт
window.generateMarkersForLayer = generateMarkersForLayer;
window.generateAllMarkers = generateAllMarkers;
window.updateMarkers = updateMarkers;

console.log('✅ MARKERS.JS загружен');
