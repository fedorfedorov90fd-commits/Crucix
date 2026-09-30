// ============================================================
// SSI.JS — Strategic Stress Index (автономная копия)
// ============================================================
console.log('🔮 SSI.JS загружен (Forecast Map)');

function calculateSSI() {
    var countries = window.ALL_COUNTRIES || [];
    var totalStress = 0;
    var critical = 0;
    countries.forEach(function(c) {
        var stress = c.stress || 0;
        totalStress += stress;
        if (stress > 70) critical++;
    });
    var avg = countries.length > 0 ? totalStress / countries.length : 0;
    console.log('[SSI] Средний стресс: ' + avg.toFixed(2) + ', критических: ' + critical);
    window.ssiData = { average: avg, critical: critical, total: countries.length };
}

window.calculateSSI = calculateSSI;
console.log('✅ SSI.JS готов');