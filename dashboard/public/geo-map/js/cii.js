// CII (Country Instability Index) — модуль для карты
// Аналог Crucix, но лучше

async function updateCII() {
    try {
        const response = await fetch('/api/cii-api');
        const data = await response.json();

        if (!data.countries) return;

        // Обновляем панель
        updateCIIPanel(data);

        // Обновляем цвета стран на карте
        updateCountryColors(data.countries);

        // Добавляем легенду
        updateLegend(data.countries);

        console.log('✅ CII обновлён:', data.total, 'стран');
    } catch (e) {
        console.warn('CII error:', e);
    }
}

function updateCIIPanel(data) {
    const panel = document.getElementById('cii-panel');
    if (!panel) return;

    // Находим топ-5 стран с самым высоким CII
    const top5 = data.countries.slice(0, 5);

    const globalScore = data.countries.reduce((sum, c) => sum + c.score, 0) / data.countries.length;

    panel.innerHTML = `
        <div class="cii-panel">
            <div class="cii-header">
                <span class="cii-title">📊 CII — Индекс нестабильности</span>
                <span class="cii-global">Глобальный: ${Math.round(globalScore)}%</span>
            </div>
            <div class="cii-bar">
                <div class="cii-fill" style="width: ${Math.round(globalScore)}%;
                     background: ${getCIIColor(globalScore)};"></div>
            </div>
            <div class="cii-top5">
                ${top5.map(c => `
                    <div class="cii-country" style="border-left: 3px solid ${c.color};">
                        <span class="cii-name">${c.country}</span>
                        <span class="cii-score" style="color: ${c.color};">${c.score}%</span>
                        <span class="cii-level">${c.level}</span>
                    </div>
                `).join('')}
            </div>
            <div class="cii-timestamp">
                Обновлено: ${new Date(data.timestamp).toLocaleString()}
            </div>
        </div>
    `;
}

function updateCountryColors(countries) {
    // Обновляем цвета стран на карте
    const countryMap = {};
    for (const c of countries) {
        countryMap[c.country] = c.color;
    }

    // Применяем цвета к GeoJSON
    if (window.countryLayer) {
        window.countryLayer.eachLayer(layer => {
            const countryName = layer.feature?.properties?.name;
            if (countryName && countryMap[countryName]) {
                layer.setStyle({
                    fillColor: countryMap[countryName],
                    fillOpacity: 0.6
                });
            }
        });
    }
}

function updateLegend(countries) {
    const legend = document.getElementById('cii-legend');
    if (!legend) return;

    const levels = [
        { label: 'Критический', min: 80, color: '#ff3b3b' },
        { label: 'Высокий', min: 60, color: '#ff8800' },
        { label: 'Средний', min: 40, color: '#ffcc00' },
        { label: 'Нормальный', min: 20, color: '#4a9eff' },
        { label: 'Стабильный', min: 0, color: '#22c55e' }
    ];

    legend.innerHTML = levels.map(l => `
        <div class="legend-item">
            <span class="legend-color" style="background: ${l.color};"></span>
            <span>${l.label} (${l.min}+)</span>
        </div>
    `).join('');
}

function getCIIColor(score) {
    if (score >= 80) return '#ff3b3b';
    if (score >= 60) return '#ff8800';
    if (score >= 40) return '#ffcc00';
    if (score >= 20) return '#4a9eff';
    return '#22c55e';
}

// Экспорт в window для совместимости с оконной архитектурой проекта
window.updateCII = updateCII;
window.updateCIIPanel = updateCIIPanel;
console.log("✅ CII.JS загружен");
