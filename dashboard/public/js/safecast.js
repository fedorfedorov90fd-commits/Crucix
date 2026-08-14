// ============================================================
// SAFECAST — РАДИАЦИОННЫЙ МОНИТОРИНГ
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
        showNotification('⏳ Загрузка данных...');
        const response = await fetch('/api/safecast/radiation');
        const data = await response.json();
        
        console.log('[Safecast] Ответ API:', data);
        
        if (data.success) {
            currentData = data;
            renderStats(data);
            renderSites(data);
            renderAnomalies(data);
            renderMap(data);
            showNotification(`✅ Загружено ${data.sites?.length || 0} локаций`);
        } else {
            showNotification('❌ Ошибка: ' + (data.error || 'неизвестная ошибка'));
        }
    } catch (e) {
        console.error('[Safecast] Ошибка:', e);
        showNotification('❌ Ошибка соединения: ' + e.message);
    }
}

// ============================================================
// 5. РЕНДЕРИНГ СТАТИСТИКИ
// ============================================================
function renderStats(data) {
    const s = data.summary || {};
    document.getElementById('stat-total').textContent = s.total || 0;
    document.getElementById('stat-critical').textContent = s.byLevel?.critical || 0;
    document.getElementById('stat-average').textContent = s.average || '—';
    document.getElementById('stat-max').textContent = s.max || '—';
    document.getElementById('stat-max-site').textContent = s.maxSite || '';
}

// ============================================================
// 6. РЕНДЕРИНГ СПИСКА ЛОКАЦИЙ
// ============================================================
function renderSites(data) {
    const container = document.getElementById('sites-grid');
    const sites = data.sites || [];
    if (!sites.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Нет данных</div>';
        return;
    }
    const labels = {
        normal: '🟢 Нормальный',
        elevated: '🟡 Повышенный',
        high: '🟠 Высокий',
        critical: '🔴 Критический',
        unknown: '⚪ Неизвестно'
    };
    let html = '';
    for (const site of sites) {
        const val = site.reading !== null ? site.reading.toFixed(1) : '—';
        const cls = site.level || 'unknown';
        html += `
            <div class="site-card">
                <div class="info">
                    <span class="name">${site.name}</span>
                    <span class="details">${labels[cls] || 'Неизвестно'}</span>
                    <span class="details" style="font-size:11px;color:#444;">${site.source || 'Safecast'}</span>
                </div>
                <div class="reading ${cls}">${val}<span class="unit"> CPM</span></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// 7. РЕНДЕРИНГ АНОМАЛИЙ
// ============================================================
function renderAnomalies(data) {
    const container = document.getElementById('anomalies-list');
    const anomalies = data.anomalies || [];
    if (!anomalies.length) {
        container.innerHTML = '<div style="color:#666;padding:8px 0;">Аномалий не обнаружено</div>';
        return;
    }
    let html = '';
    for (const a of anomalies) {
        html += `
            <div class="anomaly-item">
                <span class="site">${a.site || a.name || 'Неизвестно'}</span>
                <span class="reading">${a.reading || 0} CPM</span>
                <span class="desc">${a.description || ''}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// 8. РЕНДЕРИНГ КАРТЫ
// ============================================================
function renderMap(data) {
    const sites = data.sites || [];
    if (!sites.length) return;
    const container = document.getElementById('radiation-map');
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
        normal: '#22c55e',
        elevated: '#eab308',
        high: '#f97316',
        critical: '#ef4444',
        unknown: '#666'
    };
    const bounds = [];
    for (const site of sites) {
        if (!site.lat || !site.lng) continue;
        const color = colors[site.level] || '#666';
        const reading = site.reading !== null ? site.reading.toFixed(1) + ' CPM' : 'Нет данных';
        const icon = L.divIcon({
            className: 'radiation-marker',
            html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 20px ${color}40;"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
        bounds.push([site.lat, site.lng]);
        marker.bindTooltip(`
            <div style="background:rgba(10,10,20,0.95);color:#c8d0d8;padding:8px;border-radius:4px;font-size:12px;max-width:250px;">
                <strong style="color:#e8f0f8;">${site.name}</strong><br>
                <span style="color:${color};">${reading}</span>
            </div>
        `, { direction: 'top', offset: [0, -10] });
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
}

// ============================================================
// 9. КОПИРОВАНИЕ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
    copyPageData();
});

function copyPageData() {
    let text = `=== Радиационный мониторинг (Safecast) ===\n`;
    text += `Дата: ${new Date().toLocaleString()}\n\n`;
    
    const statElements = document.querySelectorAll('.stat-card');
    for (const el of statElements) {
        const label = el.querySelector('.stat-label')?.textContent || '';
        const value = el.querySelector('.stat-value')?.textContent || '—';
        const sub = el.querySelector('.stat-sub')?.textContent || '';
        text += `${label}: ${value} ${sub}\n`;
    }
    text += '\n';
    
    const cards = document.querySelectorAll('.site-card');
    if (cards.length > 0) {
        text += '--- ЛОКАЦИИ ---\n';
        for (const card of cards) {
            const name = card.querySelector('.name')?.textContent || 'Неизвестно';
            const reading = card.querySelector('.reading')?.textContent?.trim() || '—';
            const details = card.querySelector('.details')?.textContent || '';
            text += `${name}: ${reading} (${details})\n`;
        }
        text += '\n';
    }
    
    if (cards.length === 0) {
        text += 'Данные на странице отсутствуют.\n\n';
    }
    
    if (currentData) {
        text += '--- JSON ДАННЫЕ ---\n';
        text += JSON.stringify(currentData, null, 2);
    } else {
        text += '--- JSON ДАННЫЕ ---\n';
        text += 'Данные ещё не загружены.';
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Все данные скопированы');
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
// 10. ЭКСПОРТ
// ============================================================
document.getElementById('export-json').addEventListener('click', () => {
    if (!currentData) { showNotification('⏳ Данные не загружены'); return; }
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'safecast_data.json');
});

document.getElementById('export-csv').addEventListener('click', () => {
    if (!currentData?.sites) { showNotification('⏳ Данные не загружены'); return; }
    let csv = 'Название,Показатель,Уровень\n';
    for (const site of currentData.sites) {
        const val = site.reading !== null ? site.reading.toFixed(1) : '—';
        csv += `${site.name},${val},${site.level || 'unknown'}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'safecast_data.csv');
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
// 11. ЗАПУСК
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setInterval(loadData, 5 * 60 * 1000);
});
