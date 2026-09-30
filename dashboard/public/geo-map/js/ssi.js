// ============================================================
// SSI.JS — Индекс напряжённости
// ============================================================

console.log('📊 SSI.JS загружен');

function calculateSSI() {
    const countries = window.ALL_COUNTRIES || [];
    const total = countries.length;
    if (total === 0) return;
    let score = 0;
    for (const c of countries) {
        if (c.status === 'critical') score += 100;
        else if (c.status === 'pre-war') score += 80;
        else if (c.status === 'high') score += 70;
        else if (c.status === 'medium') score += 40;
        else if (c.status === 'normal' || c.status === 'low') score += 10;
    }
    const clamped = Math.min(Math.max(Math.round(score / total), 0), 100);
    document.getElementById('ssi-fill').style.width = clamped + '%';
    const label = document.getElementById('ssi-label');
    label.textContent = clamped + '%';
    label.style.color = clamped > 80 ? '#ef4444' : clamped > 60 ? '#f97316' : clamped > 40 ? '#eab308' : '#22c55e';
}

function updateLegend() {
    const legendDiv = document.getElementById('legend-items');
    if (!legendDiv) return;

    const statuses = [
        { key: 'critical', label: 'Критический', color: '#ef4444' },
        { key: 'pre-war', label: 'Предвоенный', color: '#f97316' },
        { key: 'high', label: 'Высокий', color: '#f59e0b' },
        { key: 'medium', label: 'Средний', color: '#eab308' },
        { key: 'normal', label: 'Нормальный', color: '#22c55e' }
    ];

    let html = '';
    for (const s of statuses) {
        html += '<div class="legend-item"><span class="legend-color" style="background:' + s.color + ';"></span><span>' + s.label + '</span></div>';
    }

    // Активные слои
    const activeIds = window.activeLayerIds || new Set();
    if (activeIds.size > 0) {
        let hasLayers = false;
        let layerHtml = '';
        for (const id of activeIds) {
            if (id === 'all') continue;
            const layer = (window.allLayers || []).find(l => l.id === id);
            if (layer) {
                hasLayers = true;
                const count = window.layerCache && window.layerCache[id] ? window.layerCache[id].length : 0;
                layerHtml += '<div class="legend-item"><span class="legend-color" style="background:' + (layer.color || '#4a5a6a') + ';"></span><span>' + layer.name + '</span><span class="legend-count">(' + count + ')</span></div>';
            }
        }
        if (hasLayers) {
            html += '<div style="border-top:1px solid rgba(255,255,255,0.06);margin:4px 0;padding-top:4px;"></div>';
            html += layerHtml;
        }
    }

    legendDiv.innerHTML = html;
}

window.calculateSSI = calculateSSI;
window.updateLegend = updateLegend;

console.log('✅ SSI.JS загружен');
