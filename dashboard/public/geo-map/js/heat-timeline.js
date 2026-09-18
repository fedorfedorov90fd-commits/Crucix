/* ============================================================
   HEAT-TIMELINE.JS — Тепловая карта, временная шкала
   ============================================================ */

console.log('🌡️ HEAT-TIMELINE.JS загружен');

// ============================================================
// ТЕПЛОВАЯ КАРТА
// ============================================================

function toggleHeat() {
    window.heatEnabled = !window.heatEnabled;
    document.getElementById('btn-heat').classList.toggle('active', window.heatEnabled);

    if (window.heatLayer) {
        map.removeLayer(window.heatLayer);
        window.heatLayer = null;
    }

    if (window.heatEnabled && window.markerData.length > 0) {
        const heatData = window.markerData.slice(0, 500).map(m => [m.lat, m.lng, 1.0]);
        window.heatLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            minOpacity: 0.3,
            gradient: {
                0.0: '#22c55e',
                0.3: '#eab308',
                0.6: '#f97316',
                0.9: '#ef4444'
            }
        }).addTo(map);
        showNotification('🌡️ Тепловая карта включена');
    } else if (!window.heatEnabled) {
        showNotification('🌡️ Тепловая карта выключена');
    } else {
        showNotification('❌ Нет данных');
    }
}

// ============================================================
// ВРЕМЕННАЯ ШКАЛА
// ============================================================

function toggleTimeline() {
    window.timelineEnabled = !window.timelineEnabled;
    document.getElementById('btn-timeline').classList.toggle('active', window.timelineEnabled);

    const panel = document.getElementById('timeline-panel');
    if (window.timelineEnabled) {
        panel.classList.add('active');
        buildTimeline();
        showNotification('📅 Хронология включена');
    } else {
        panel.classList.remove('active');
        showNotification('📅 Хронология выключена');
    }
}

function buildTimeline() {
    const track = document.getElementById('timeline-track');
    const dateLabel = document.getElementById('timeline-date');

    if (window.markerData.length === 0) {
        track.innerHTML = '<div style="color:#555;font-size:10px;text-align:center;padding:6px;">Нет данных</div>';
        dateLabel.textContent = '—';
        return;
    }

    const grouped = {};
    for (const m of window.markerData.slice(0, 200)) {
        const date = new Date(m.timestamp || Date.now());
        const key = date.toLocaleDateString('ru-RU');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    }

    const keys = Object.keys(grouped).sort();
    if (keys.length === 0) {
        track.innerHTML = '<div style="color:#555;font-size:10px;text-align:center;padding:6px;">Нет данных</div>';
        dateLabel.textContent = '—';
        return;
    }

    let maxCount = 0;
    for (const key of keys) {
        if (grouped[key].length > maxCount) maxCount = grouped[key].length;
    }

    let html = '';
    for (const key of keys) {
        const count = grouped[key].length;
        const height = maxCount > 0 ? Math.max(3, (count / maxCount) * 14) : 3;
        const color = count > 5 ? '#ef4444' : count > 3 ? '#f97316' : count > 1 ? '#eab308' : '#22c55e';
        html += `<div class="timeline-bar" style="height:${height}px;background:${color};" title="${key}: ${count} событий"></div>`;
    }

    track.innerHTML = html;
    dateLabel.textContent = keys.length > 0 ? `${keys[0]} — ${keys[keys.length-1]}` : '—';
}
