// ============================================================
// CII.JS — Country Instability Index (автономная копия)
// ============================================================
console.log('🔮 CII.JS загружен (Forecast Map)');

function updateCII() {
    var countries = window.ALL_COUNTRIES || [];
    var instable = 0;
    countries.forEach(function(c) {
        if (c.status === 'critical' || c.status === 'pre-war') instable++;
    });
    var index = countries.length > 0 ? (instable / countries.length * 100) : 0;
    console.log('[CII] Индекс нестабильности: ' + index.toFixed(1) + '%');
    window.ciiData = { index: index, instable: instable, total: countries.length };
}

window.updateCII = updateCII;
console.log('✅ CII.JS готов');