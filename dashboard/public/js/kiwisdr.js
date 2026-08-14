// ============================================================
// KIIWISDR — РАДИОМОНИТОРИНГ
// ============================================================

let currentData = null;
let map = null;
let gridVisible = false;

// ============================================================
// 1. УВЕДОМЛЕНИЯ
// ============================================================
function showNotification(msg) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// ============================================================
// 2. ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
// ============================================================
let currentLang = localStorage.getItem('crucix-lang') || 'ru';

function switchLang(lang) {
    currentLang = lang;
    localStorage.setItem('crucix-lang', lang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    showNotification(`🌐 Язык: ${lang.toUpperCase()}`);
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
});

// ============================================================
// 3. КООРДИНАТНАЯ СЕТКА
// ============================================================
const gridEl = document.getElementById('coordinate-grid');
const coordsEl = document.getElementById('grid-coords');
const gridBtn = document.getElementById('grid-toggle');

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        toggleGrid();
    }
});

gridBtn.addEventListener('click', toggleGrid);

function toggleGrid() {
    gridVisible = !gridVisible;
    gridEl.classList.toggle('visible', gridVisible);
    coordsEl.classList.toggle('visible', gridVisible);
    gridBtn.classList.toggle('active', gridVisible);
    if (gridVisible) {
        showNotification('⊞ Сетка включена');
        document.addEventListener('mousemove', updateCoords);
    } else {
        showNotification('⊞ Сетка выключена');
        document.removeEventListener('mousemove', updateCoords);
    }
}

function updateCoords(e) {
    coordsEl.textContent = `X: ${e.clientX}  Y: ${e.clientY}`;
}

// ============================================================
// 4. ЗАГРУЗКА ДАННЫХ
// ============================================================
async function loadData() {
    try {
        const response = await fetch('/api/kiwisdr/receivers');
        const data = await response.json();
        if (data.success) {
            currentData = data;
            renderStats(data);
            renderReceivers(data);
            renderMap(data);
            showNotification(`✅ Загружено ${data.receivers?.length || 0} приёмников`);
        } else {
            showNotification('❌ Ошибка загрузки данных');
        }
    } catch (e) {
        console.error('[KiwiSDR] Ошибка:', e);
        showNotification('❌ Ошибка соединения');
    }
}

// ============================================================
// 5. РЕНДЕРИНГ СТАТИСТИКИ
// ============================================================
function renderStats(data) {
    const summary = data.summary || {};
    const byStatus = summary.byStatus || { online: 0, offline: 0, unknown: 0 };
    const byRegion = summary.byRegion || {};
    document.getElementById('stat-total').textContent = summary.total || 0;
    document.getElementById('stat-online').textContent = byStatus.online || 0;
    document.getElementById('stat-offline').textContent = byStatus.offline || 0;
    document.getElementById('stat-regions').textContent = Object.keys(byRegion).length || 0;
}

// ============================================================
// 6. РЕНДЕРИНГ ПРИЁМНИКОВ
// ============================================================
function renderReceivers(data) {
    const container = document.getElementById('receivers-grid');
    const receivers = data.receivers || [];
    if (!receivers.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Нет данных</div>';
        return;
    }
    let html = '';
    for (const r of receivers) {
        const statusClass = r.status || 'unknown';
        const statusLabel = statusClass === 'online' ? '🟢 Онлайн' :
                           statusClass === 'offline' ? '🔴 Офлайн' : '⚪ Неизвестно';
        html += `
            <div class="receiver-card">
                <div class="info">
                    <span class="name">${r.name || 'Безымянный'}</span>
                    <span class="details">${r.region || 'Неизвестно'} · ${r.lat?.toFixed(2) || '—'}°N, ${r.lng?.toFixed(2) || '—'}°E</span>
                </div>
                <span class="status ${statusClass}">${statusLabel}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// 7. РЕНДЕРИНГ КАРТЫ
// ============================================================
function renderMap(data) {
    const receivers = data.receivers || [];
    if (!receivers.length) return;
    const container = document.getElementById('sdr-map');
    if (map) { map.remove(); map = null; }
    map = L.map(container, {
        center: [30, 20],
        zoom: 2,
        zoomControl: false,
        attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    const colors = {
        online: '#22c55e',
        offline: '#ef4444',
        unknown: '#666'
    };
    const bounds = [];
    for (const r of receivers) {
        if (!r.lat || !r.lng) continue;
        const color = colors[r.status] || '#666';
        const icon = L.divIcon({
            className: 'sdr-marker',
            html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 15px ${color}40;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        const marker = L.marker([r.lat, r.lng], { icon }).addTo(map);
        bounds.push([r.lat, r.lng]);
        const statusLabel = r.status === 'online' ? '🟢 Онлайн' :
                           r.status === 'offline' ? '🔴 Офлайн' : '⚪ Неизвестно';
        marker.bindTooltip(`
            <div style="background:rgba(10,10,20,0.95);color:#c8d0d8;padding:8px;border-radius:4px;font-size:12px;max-width:250px;">
                <strong style="color:#e8f0f8;">${r.name || 'Безымянный'}</strong><br>
                <span style="color:${color};">${statusLabel}</span><br>
                <span style="color:#888;">${r.region || 'Неизвестно'}</span>
            </div>
        `, { direction: 'top', offset: [0, -10] });
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
}

// ============================================================
// 8. КОПИРОВАНИЕ ВСЕЙ СТРАНИЦЫ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
    copyPageData();
});

function copyPageData() {
    let text = `=== Радиомониторинг (KiwiSDR) ===\n`;
    text += `Дата: ${new Date().toLocaleString()}\n\n`;
    
    const statElements = document.querySelectorAll('.stat-card');
    for (const el of statElements) {
        const label = el.querySelector('.stat-label')?.textContent || '';
        const value = el.querySelector('.stat-value')?.textContent || '—';
        const sub = el.querySelector('.stat-sub')?.textContent || '';
        text += `${label}: ${value} ${sub}\n`;
    }
    text += '\n';
    
    const cards = document.querySelectorAll('.receiver-card');
    if (cards.length > 0) {
        text += '--- ПРИЁМНИКИ ---\n';
        for (const card of cards) {
            const name = card.querySelector('.name')?.textContent || 'Безымянный';
            const details = card.querySelector('.details')?.textContent || '';
            const status = card.querySelector('.status')?.textContent || 'unknown';
            text += `${name}: ${status} (${details})\n`;
        }
        text += '\n';
    }
    
    if (cards.length === 0) {
        text += 'Данные на странице отсутствуют или ещё не загружены.\n\n';
    }
    
    if (currentData) {
        text += '--- JSON ДАННЫЕ ---\n';
        text += JSON.stringify(currentData, null, 2);
    } else {
        text += '--- JSON ДАННЫЕ ---\n';
        text += 'Данные ещё не загружены.';
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Все данные скопированы в буфер обмена');
    }).catch(() => {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        showNotification('✅ Все данные скопированы');
    });
}

// ============================================================
// 9. ЭКСПОРТ
// ============================================================
document.getElementById('export-json').addEventListener('click', () => {
    if (!currentData) { showNotification('⏳ Данные не загружены'); return; }
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'kiwisdr_data.json');
});

document.getElementById('export-csv').addEventListener('click', () => {
    if (!currentData?.receivers) { showNotification('⏳ Данные не загружены'); return; }
    let csv = 'Название,Статус,Регион,Широта,Долгота\n';
    for (const r of currentData.receivers) {
        csv += `${r.name || 'Безымянный'},${r.status || 'unknown'},${r.region || ''},${r.lat || ''},${r.lng || ''}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'kiwisdr_data.csv');
});

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// 10. ЗАПУСК
// ============================================================
document.addEventListener('DOMContentLoaded', loadData);
setInterval(loadData, 5 * 60 * 1000);
