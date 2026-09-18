/* ============================================================
   REFRESH.JS — Автообновление
   ============================================================ */

console.log('🔄 REFRESH.JS загружен');

// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (для автообновления)
// ============================================================
let refreshIntervalId = null;
let countdownIntervalId = null;
let refreshCountdown = 0;

// ============================================================
// АВТООБНОВЛЕНИЕ
// ============================================================

function startAutoRefresh(intervalMs) {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    const dot = document.getElementById('status-dot');

    if (intervalMs === 0) {
        document.getElementById('refresh-timer').textContent = '❌';
        document.getElementById('update-text').textContent = LANG_DATA[currentLang]?.off || 'Выкл';
        if (dot) { dot.className = 'status-dot off'; }
        return;
    }

    refreshCountdown = Math.floor(intervalMs / 1000);
    updateTimerDisplay();
    if (dot) { dot.className = 'status-dot active'; }

    countdownIntervalId = setInterval(() => {
        refreshCountdown--;
        if (refreshCountdown <= 0) {
            refreshCountdown = Math.floor(intervalMs / 1000);
            refreshMapData();
        }
        updateTimerDisplay();
    }, 1000);

    refreshIntervalId = setInterval(() => {
        refreshMapData();
    }, intervalMs);

    document.getElementById('update-text').textContent = 'каждые ' + formatInterval(intervalMs);
}

function updateTimerDisplay() {
    const mins = Math.floor(refreshCountdown / 60);
    const secs = refreshCountdown % 60;
    document.getElementById('refresh-timer').textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function formatInterval(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins > 0) return mins + ' ' + (LANG_DATA[currentLang]?.min || 'мин');
    return secs + ' ' + (LANG_DATA[currentLang]?.sec || 'сек');
}

function refreshMapData() {
    showNotification('🔄 Обновление данных...');
    const currentMode = mapMode;
    loadData().then(() => {
        mapMode = currentMode;
        const btn = document.getElementById('btn-mode');
        if (mapMode === 'bigmac') {
            btn.textContent = '🍔 Биг-Мак';
            btn.classList.add('active');
        } else {
            btn.textContent = '📊 CII';
            btn.classList.remove('active');
        }
        refreshMapDisplay();
        showNotification('✅ Данные обновлены');
    });
}

// Экспорт в глобальную область
window.startAutoRefresh = startAutoRefresh;
window.refreshMapData = refreshMapData;
