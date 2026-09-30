console.log('TOPBAR.JS загружен');
function openHelp() { window.open('/help', '_blank'); }
function setLanguage(lang) {
    localStorage.setItem('crucix-lang', lang);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    if (typeof showNotification === 'function') showNotification('Язык: ' + lang.toUpperCase());
}
function toggleHeat() { if (window._toggleHeat) window._toggleHeat(); }
function toggleTimeline() {
    var panel = document.getElementById('timeline-panel');
    if (panel) panel.classList.toggle('active');
}
function exportPDF() { showNotification('PDF export недоступен'); }
function goToDashboard(name) { window.location.href = '/dashboard-' + name; }
window.openHelp = openHelp;
window.setLanguage = setLanguage;
window.toggleHeat = toggleHeat;
window.toggleTimeline = toggleTimeline;
window.exportPDF = exportPDF;
window.goToDashboard = goToDashboard;
console.log('TOPBAR.JS готов');
