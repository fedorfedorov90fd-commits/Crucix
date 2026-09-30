console.log('cii.js загружен');
function updateCII() {
    var countries = window.ALL_COUNTRIES || [];
    var cii = countries.length > 0 ? Math.round((countries.length / 200) * 100) : 0;
    window.CII_VALUE = cii;
    var el = document.getElementById('cii-value');
    if (el) el.textContent = cii;
}
window.updateCII = updateCII;
console.log('cii.js готов');
