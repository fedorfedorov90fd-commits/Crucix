// ============================================================
// HEAT-TIMELINE.JS — Тепловая хронология (автономная копия)
// ============================================================
console.log('🔮 HEAT-TIMELINE.JS загружен (Forecast Map)');

function initHeatTimeline() {
    var container = document.getElementById('heat-timeline');
    if (!container) return;
    container.innerHTML = '<div class="timeline-track"><div class="timeline-progress" style="width:100%;"></div></div>';
    console.log('[HeatTimeline] Инициализирован');
}

window.initHeatTimeline = initHeatTimeline;
console.log('✅ HEAT-TIMELINE.JS готов');