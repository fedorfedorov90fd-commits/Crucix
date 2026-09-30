// ============================================================
// CII.JS — Country Instability Index с fallback
// ============================================================
// Основной путь: fetch('/api/cii-api') — серверный расчёт.
// Fallback: если API недоступен → вычисляем локально из
// window.ALL_COUNTRIES через весовую формулу.
// ============================================================

console.log('📊 CII.JS загружен (с fallback)');

const CII_WEIGHTS = {
    critical: 100,
    'pre-war': 80,
    high: 70,
    medium: 40,
    normal: 10,
    low: 10
};

const CII_COLORS = {
    critical: '#ff3b3b',
    'pre-war': '#ff8800',
    high: '#f59e0b',
    medium: '#eab308',
    normal: '#4a9eff',
    low: '#22c55e'
};

async function updateCII() {
    try {
        const resp = await fetch('/api/cii-api');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();

        if (!data.countries) throw new Error('no countries in response');

        updateCIIPanel(data);
        updateCountryColors(data.countries);
        updateLegend(data.countries);
        console.log('✅ CII обновлён (API):', data.total, 'стран');

    } catch (e) {
        console.warn('[CII] API недоступен → fallback:', e.message);
        updateCIIFromLocal();
    }
}

// ============================================================
// FALLBACK: локальный расчёт
// ============================================================
function updateCIIFromLocal() {
    const countries = window.ALL_COUNTRIES || [];
    if (countries.length === 0) {
        console.warn('[CII] Fallback: нет локальных стран');
        return;
    }

    // Взвешенная формула: CII_i = weight_i / max_weight * 100
    const maxWeight = 100;
    const localCountries = countries.map(c => {
        const weight = CII_WEIGHTS[c.status] || 40;
        const score = Math.round((weight / maxWeight) * 100);
        return {
            country: c.name,
            score: score,
            level: c.status || 'medium',
            color: CII_COLORS[c.status] || '#eab308'
        };
    }).sort((a, b) => b.score - a.score);

    const globalScore = localCountries.reduce((s, c) => s + c.score, 0) / localCountries.length;

    updateCIIPanel({
        countries: localCountries,
        total: localCountries.length,
        global: Math.round(globalScore),
        timestamp: new Date().toISOString(),
        source: 'local'
    });
    updateCountryColors(localCountries);
    updateLegend(localCountries);

    console.log('✅ CII обновлён (fallback):', localCountries.length, 'стран, global=' + globalScore.toFixed(1));
}

// ============================================================
// UI PANEL
// ============================================================
function updateCIIPanel(data) {
    let panel = document.getElementById('cii-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'cii-panel';
        panel.className = 'cii-panel';
        const stats = document.getElementById('stats');
        if (stats && stats.parentNode) {
            stats.parentNode.insertBefore(panel, stats.nextSibling);
        } else {
            document.body.appendChild(panel);
        }
    }

    const top5 = (data.countries || []).slice(0, 5);
    const globalScore = data.global ??
        (data.countries || []).reduce((s, c) => s + c.score, 0) / Math.max(data.countries?.length, 1);

    panel.innerHTML = `
        <div class="cii-header">
            <span class="cii-title">📊 CII — Индекс нестабильности</span>
            <span class="cii-global">Глобальный: ${Math.round(globalScore)}%</span>
        </div>
        <div class="cii-bar">
            <div class="cii-fill" style="width:${Math.round(globalScore)}%;background:${getCIIColor(globalScore)};"></div>
        </div>
        <div class="cii-top5">
            ${top5.map(c => `
                <div class="cii-country" style="border-left:3px solid ${c.color || getCIIColor(c.score)};">
                    <span class="cii-name">${c.country}</span>
                    <span class="cii-score" style="color:${c.color || getCIIColor(c.score)};">${c.score}%</span>
                    <span class="cii-level">${c.level || ''}</span>
                </div>
            `).join('')}
        </div>
        <div class="cii-timestamp">
            ${data.source === 'local' ? '⚡ Локальный расчёт' : 'Обновлено'}: ${new Date(data.timestamp || Date.now()).toLocaleString()}
        </div>
    `;
}

function updateCountryColors(countries) {
    const colorMap = {};
    for (const c of countries) colorMap[c.country] = c.color || getCIIColor(c.score);

    if (window.currentGeoJsonLayer) {
        window.currentGeoJsonLayer.eachLayer(layer => {
            const name = layer.feature?.properties?.name;
            if (!name) return;
            // Ищем совпадение по русскому или английскому имени
            const nameRu = window.COUNTRY_NAME_MAP?.[name] || name;
            const color = colorMap[name] || colorMap[nameRu];
            if (color) {
                layer.setStyle({ fillColor: color, fillOpacity: 0.6 });
            }
        });
    }
}

function updateLegend(countries) {
    const legend = document.getElementById('cii-legend') || document.getElementById('legend-items');
    if (!legend) return;

    const levels = [
        { label: 'Критический', min: 80, color: '#ff3b3b' },
        { label: 'Высокий', min: 60, color: '#ff8800' },
        { label: 'Средний', min: 40, color: '#eab308' },
        { label: 'Нормальный', min: 20, color: '#4a9eff' },
        { label: 'Стабильный', min: 0, color: '#22c55e' }
    ];

    // Не перезаписываем легенду, если updateLegend уже определена в ssi.js
    if (typeof window.updateLegend === 'function' && legend.id === 'legend-items') {
        return; // ssi.js управляет этой легендой
    }

    legend.innerHTML = levels.map(l => `
        <div class="legend-item">
            <span class="legend-color" style="background:${l.color};"></span>
            <span>${l.label} (${l.min}+)</span>
        </div>
    `).join('');
}

function getCIIColor(score) {
    if (score >= 80) return '#ff3b3b';
    if (score >= 60) return '#ff8800';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#4a9eff';
    return '#22c55e';
}

window.updateCII = updateCII;
window.updateCIIFromLocal = updateCIIFromLocal;
window.updateCIIPanel = updateCIIPanel;
console.log('✅ CII.JS готов (API + fallback)');
