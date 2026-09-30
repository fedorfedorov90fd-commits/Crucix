// ============================================================
// TOPBAR.JS — 1-й блок: кнопки управления
// ============================================================

export function renderTopbar() {
    // Топбар уже есть в HTML — здесь только функции для кнопок
}

export function copyAllData() {
    const timestamp = new Date().toLocaleString();
    let report = '=== CRUCIX — ГЕОПОЛИТИЧЕСКАЯ КАРТА ===\n';
    report += 'Дата: ' + timestamp + '\n';
    report += 'URL: ' + window.location.href + '\n\n';

    // Здесь будет полный снапшот (получаем данные из глобальных переменных)
    // Функция будет расширена позже

    navigator.clipboard.writeText(report).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = '✅ Скопировано!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 КОПИРОВАТЬ';
            btn.classList.remove('copied');
        }, 3000);
        showNotification('✅ Данные скопированы');
    });
}

export function openHelp() {
    const pageId = window.location.pathname.replace(/^\/+/, "").replace(/\.html$/, "") || "jarvis";
    const lang = localStorage.getItem('crucix-lang') || 'ru';
    const helpFile = `/data/help/${lang}/${pageId}.txt`;
    fetch(helpFile).then(res => res.text()).then(text => {
        alert(text || "Справка не найдена");
    }).catch(() => alert("Справка не найдена"));
}

export function setLanguage(lang) {
    localStorage.setItem('crucix-lang', lang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    showNotification('🌐 Язык: ' + lang.toUpperCase());
}

export function toggleHeat() {
    // Будет реализовано в markers.js
    window._toggleHeat && window._toggleHeat();
}

export function toggleTimeline() {
    // Будет реализовано в markers.js
    window._toggleTimeline && window._toggleTimeline();
}

export function exportPDF() {
    // Будет реализовано позже
}

function showNotification(msg) {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// Делаем функции доступными глобально для onclick в HTML
window.copyAllData = copyAllData;
window.openHelp = openHelp;
window.setLanguage = setLanguage;
window.toggleHeat = toggleHeat;
window.toggleTimeline = toggleTimeline;
window.exportPDF = exportPDF;
