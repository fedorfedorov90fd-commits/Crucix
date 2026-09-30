// ============================================================
// COPY-DATA.JS — Обёртка (реализация в topbar.js)
// ============================================================
// Кнопка 📋 КОПИРОВАТЬ вызывает window.copyAllData(),
// которая определена в topbar.js. Этот файл оставлен для
// совместимости с порядком загрузки скриптов в index.html.
// ============================================================

console.log('COPY-DATA.JS загружен (Forecast Map, обёртка)');

if (typeof window.copyAllData !== 'function') {
    window.copyAllData = function() {
        console.warn('[copyAllData] topbar.js ещё не загружен');
    };
}

console.log('COPY-DATA.JS готов');
