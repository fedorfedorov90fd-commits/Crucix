console.log('ssi.js загружен');
function calculateSSI() {
    var markers = window.markerData || [];
    var ssi = markers.length > 0 ? Math.round((markers.length / 100) * 50) : 0;
    window.SSI_VALUE = ssi;
    var el = document.getElementById('ssi-value');
    if (el) el.textContent = ssi;
}
window.calculateSSI = calculateSSI;
console.log('ssi.js готов');
