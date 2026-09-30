// popups.mjs — всплывающие окна с деталями по регионам

// === Данные из корзины ===
async function getData(source, params = {}) {
    const res = await fetch(`/api/basket/${source}?${new URLSearchParams(params)}`);
    return res.json();
}

// === Попап при клике на регион ===
export async function showRegionPopup(lat, lon, regionName) {
    const [conflicts, news, notams] = await Promise.all([
        getData('acled', { lat, lon, radius: 100 }),
        getData('gdelt', { lat, lon, radius: 100 }),
        getData('notam', { lat, lon, radius: 100 })
    ]);

    const html = `
        <div style="background:#0a0e17;color:#e0e6f0;padding:16px;border-radius:8px;max-width:400px;font-family:monospace;">
            <h3 style="margin:0 0 8px;color:#4f9eff;">${regionName}</h3>
            <div style="border-bottom:1px solid #2a3447;padding:8px 0;">
                <div style="display:flex;justify-content:space-between;">
                    <span>🔴 Конфликты (24ч)</span>
                    <span style="color:#ff3b3b;">${conflicts.length}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span>🟠 Военная активность</span>
                    <span style="color:#ff8800;">${notams.length}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span>📰 Новости (24ч)</span>
                    <span style="color:#4a9eff;">${news.length}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span>🔵 Детектор тишины</span>
                    <span style="color:#00d4aa;">${news.length < 3 ? '⚠️ АКТИВЕН' : 'Норма'}</span>
                </div>
            </div>
            <div style="margin-top:8px;">
                <div style="font-size:11px;color:#6b7a99;">Последние события:</div>
                ${conflicts.slice(0, 3).map(c =>
                    `<div style="font-size:12px;padding:2px 0;">• ${c.event_type}: ${c.actor1 || '—'}</div>`
                ).join('')}
            </div>
            <div style="margin-top:8px;font-size:11px;color:#6b7a99;">
                🖱️ Кликните для деталей → <a href="/geo-map?region=${regionName}" style="color:#4f9eff;">подробнее</a>
            </div>
        </div>
    `;

    return html;
}
