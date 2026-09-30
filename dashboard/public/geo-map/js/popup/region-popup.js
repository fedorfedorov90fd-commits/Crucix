// Всплывающие окна с деталями по регионам
// При клике на карту показывает: конфликты, военная активность, новости

import { fetchJSON } from '../core.js';

export function initRegionPopup(map) {
    // Обработчик клика по карте
    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;

        // Загружаем данные по координатам
        const [conflicts, notams, gdelt] = await Promise.all([
            fetchJSON(`/api/acled?lat=${lat}&lng=${lng}&radius=100000`),
            fetchJSON(`/api/notam?lat=${lat}&lng=${lng}&radius=100000`),
            fetchJSON(`/api/gdelt?lat=${lat}&lng=${lng}&radius=100000`)
        ]);

        // Формируем содержимое поп-апа
        const content = `
            <div style="min-width:280px;max-width:400px;font-family:monospace;font-size:13px;">
                <div style="font-weight:bold;font-size:15px;margin-bottom:8px;color:#4f9eff;">
                    📍 ${lat.toFixed(2)}, ${lng.toFixed(2)}
                </div>
                <div style="border-bottom:1px solid #2a3447;padding:6px 0;display:flex;justify-content:space-between;">
                    <span>🔴 Конфликты (ACLED)</span>
                    <span style="color:#ff3b3b;">${conflicts?.length || 0}</span>
                </div>
                <div style="border-bottom:1px solid #2a3447;padding:6px 0;display:flex;justify-content:space-between;">
                    <span>🟠 Военная активность (NOTAM)</span>
                    <span style="color:#ff8800;">${notams?.length || 0}</span>
                </div>
                <div style="border-bottom:1px solid #2a3447;padding:6px 0;display:flex;justify-content:space-between;">
                    <span>📰 Новости (GDELT)</span>
                    <span style="color:#4a9eff;">${gdelt?.length || 0}</span>
                </div>
                <div style="border-bottom:1px solid #2a3447;padding:6px 0;display:flex;justify-content:space-between;">
                    <span>🔵 Детектор тишины</span>
                    <span style="color:${gdelt?.length < 3 ? '#ff8800' : '#00d4aa'};">
                        ${gdelt?.length < 3 ? '⚠️ АКТИВЕН' : 'Норма'}
                    </span>
                </div>
                <div style="margin-top:8px;font-size:11px;color:#6b7a99;">
                    🖱️ Кликните для деталей →
                    <a href="/geo-map?lat=${lat}&lng=${lng}" style="color:#4f9eff;">подробнее</a>
                </div>
            </div>
        `;

        L.popup()
            .setLatLng([lat, lng])
            .setContent(content)
            .openOn(map);
    });
}
