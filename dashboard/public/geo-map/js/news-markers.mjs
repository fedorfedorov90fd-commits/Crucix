// news-markers.mjs — маркеры новостей на карте

export async function addNewsMarkers(map) {
    const res = await fetch('/api/gdelt');
    const data = await res.json();

    const newsLayer = L.layerGroup();

    data.slice(0, 50).forEach(item => {
        if (!item.lat || !item.lon) return;

        const marker = L.marker([item.lat, item.lon], {
            icon: L.divIcon({
                html: '📰',
                className: 'news-marker',
                iconSize: [24, 24]
            })
        });

        marker.bindPopup(`
            <div style="max-width:300px;">
                <b>${item.title || 'Новость'}</b><br>
                <span style="color:#6b7a99;font-size:12px;">${item.source || '—'}</span><br>
                <a href="${item.url}" target="_blank" style="color:#4f9eff;">Подробнее →</a>
            </div>
        `);

        newsLayer.addLayer(marker);
    });

    newsLayer.addTo(map);
    return newsLayer;
}
