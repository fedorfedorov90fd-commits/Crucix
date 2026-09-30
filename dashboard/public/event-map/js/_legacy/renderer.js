// ============================================================
// RENDERER.JS — Отрисовка слоёв на карте
// ============================================================

console.log('🎨 RENDERER.JS загружен');

let markerLayer = L.layerGroup();
let choroplethLayer = L.layerGroup();

function initRenderer(map) {
    window.map = map;
    markerLayer.addTo(map);
    choroplethLayer.addTo(map);
}

function updateMarkers(markers) {
    markerLayer.clearLayers();
    if (!markers || markers.length === 0) {
        console.log('📭 Нет маркеров для отображения');
        return;
    }

    markers.forEach(m => {
        const lat = m.lat || m.latitude || 0;
        const lng = m.lng || m.lon || m.longitude || 0;
        if (lat === 0 && lng === 0) return;

        let color = '#4d6bfe';
        if (m.status === 'critical' || m.status === 'high' || m.severity === 'critical') color = '#ef4444';
        else if (m.status === 'medium' || m.severity === 'high') color = '#f59e0b';

        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            opacity: 0.8,
            fillOpacity: 0.7
        });

        const popup = `
            <div style="min-width: 140px;">
                <div style="font-weight: 600;">${m.name || 'Событие'}</div>
                <div style="color: #666; font-size: 12px;">${m.description || ''}</div>
                <div style="color: #888; font-size: 11px;">${m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}</div>
            </div>
        `;
        marker.bindPopup(popup);
        marker.addTo(markerLayer);
    });

    console.log(`📍 Отображено маркеров: ${markers.length}`);
}

function applyChoropleth(data) {
    choroplethLayer.clearLayers();
    if (!data || !data.features || data.features.length === 0) {
        console.log('📭 Нет данных для хороплета');
        return;
    }

    data.features.forEach(f => {
        const coords = f.geometry?.coordinates || [0, 0];
        const lat = coords[1] || 0;
        const lng = coords[0] || 0;
        if (lat === 0 && lng === 0) return;

        const value = f.properties?.value || 0;
        const color = value > 0.7 ? '#ef4444' : value > 0.4 ? '#f59e0b' : '#4d6bfe';

        const marker = L.circleMarker([lat, lng], {
            radius: 12,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            opacity: 0.8,
            fillOpacity: 0.5
        });

        const popup = `
            <div style="min-width: 140px;">
                <div style="font-weight: 600;">${f.properties?.label || 'Значение'}</div>
                <div style="color: #888; font-size: 12px;">${value.toFixed(2)}</div>
            </div>
        `;
        marker.bindPopup(popup);
        marker.addTo(choroplethLayer);
    });

    console.log(`🎨 Закрашено областей: ${data.features.length}`);
}

function updateLegend() {
    // Легенда динамически обновляется
}

// Экспорт
window.initRenderer = initRenderer;
window.updateMarkers = updateMarkers;
window.applyChoropleth = applyChoropleth;
window.updateLegend = updateLegend;

console.log('✅ RENDERER.JS готов');
