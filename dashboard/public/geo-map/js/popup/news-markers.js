// Маркеры новостей на карте
// Показывает последние новости как маркеры 📰

import { fetchJSON } from '../core.js';

export async function addNewsMarkers(map) {
    try {
        const news = await fetchJSON('/api/gdelt?limit=100');
        if (!news || news.length === 0) return;

        const newsLayer = L.layerGroup();

        for (const item of news) {
            if (!item.lat || !item.lon) continue;

            const marker = L.marker([item.lat, item.lon], {
                icon: L.divIcon({
                    html: '📰',
                    className: 'news-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            });

            marker.bindPopup(`
                <div style="max-width:280px;">
                    <b>${item.title || 'Новость'}</b><br>
                    <span style="color:#6b7a99;font-size:11px;">${item.source || '—'}</span><br>
                    <a href="${item.url || '#'}" target="_blank" style="color:#4f9eff;">Подробнее →</a>
                </div>
            `);

            newsLayer.addLayer(marker);
        }

        map.addLayer(newsLayer);

        // Добавляем кнопку для включения/выключения новостей
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleNews';
        toggleBtn.textContent = '📰 Новости';
        toggleBtn.style.cssText = `
            position: absolute; bottom: 20px; right: 20px; z-index: 1000;
            background: #131826; color: #e0e6f0; border: 1px solid #2a3447;
            padding: 8px 14px; border-radius: 6px; cursor: pointer;
            font-family: monospace; font-size: 12px; backdrop-filter: blur(8px);
        `;

        let visible = true;
        toggleBtn.onclick = () => {
            visible = !visible;
            toggleBtn.textContent = visible ? '📰 Новости' : '📰 Новости (скрыто)';
            if (visible) map.addLayer(newsLayer);
            else map.removeLayer(newsLayer);
        };

        document.getElementById('map-container')?.appendChild(toggleBtn);
    } catch (e) {
        console.warn('News markers error:', e);
    }
}
