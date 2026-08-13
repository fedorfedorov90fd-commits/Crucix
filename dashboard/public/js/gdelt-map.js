// dashboard/public/js/gdelt-map.js
// Интеграция GDELT с картой

async function loadGDELTMarkers(map) {
    try {
        const response = await fetch('/api/gdelt/recent?hours=24&max=100');
        const data = await response.json();
        
        if (!data.success || !data.events) return;
        
        const markers = data.events.filter(e => e.coordinates);
        
        markers.forEach(event => {
            const marker = L.marker([event.coordinates.lat, event.coordinates.lon]);
            marker.bindPopup(`
                <b>${event.title}</b><br>
                ${event.description?.substring(0, 100) || ''}<br>
                <small>${event.source} | ${event.date}</small>
            `);
            marker.addTo(map);
        });
        
        console.log(`[GDELT] Добавлено ${markers.length} маркеров на карту`);
    } catch (error) {
        console.error('[GDELT] Ошибка загрузки маркеров:', error);
    }
}