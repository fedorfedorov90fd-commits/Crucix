// ============================================================
// COPY-DATA.JS — Копирование данных (расширенная версия ~500 КБ)
// ============================================================

console.log('📋 COPY-DATA.JS загружен (расширенная версия)');

function copyAllData() {
    const timestamp = new Date().toLocaleString();
    const url = window.location.href;
    const windowSize = `${window.innerWidth}×${window.innerHeight}`;
    const pageTitle = document.title || 'Геополитическая карта';

    // ---- 1. ДАННЫЕ КАРТЫ ----
    const mapData = collectMapData();

    // ---- 2. СТРАНЫ, СЛОИ, МАРКЕРЫ (все 1301) ----
    const countries = window.ALL_COUNTRIES || [];
    const layers = window.allLayers || [];
    const markers = window.markerData || [];
    const currentLayer = window.currentLayer || 'all';
    const ssi = document.getElementById('ssi-label')?.textContent || '0%';
    const activeIds = window.activeLayerIds || new Set();

    // ---- 3. DOM-СЛЕПОК (первые 50 элементов) ----
    const elements = collectDOMSnapshot(50);

    // ---- 4. ФОРМИРОВАНИЕ ОТЧЁТА ----
    let report = '=== CRUCIX — ГЕОПОЛИТИЧЕСКАЯ КАРТА (расширенный дамп) ===\n';
    report += `Дата: ${timestamp}\n`;
    report += `URL: ${url}\n`;
    report += `Размер окна: ${windowSize}\n`;
    report += `Заголовок: ${pageTitle}\n\n`;

    // --- Статистика ---
    report += '--- СТАТИСТИКА ---\n';
    report += `Стран: ${countries.length}\n`;
    report += `Событий всего: ${markers.length}\n`;
    report += `Активный слой: ${currentLayer}\n`;
    report += `Всего слоев: ${layers.length}\n`;
    report += `SSI: ${ssi}\n\n`;

    // --- Страны по статусам ---
    report += '--- ВСЕ СТРАНЫ ПО СТАТУСАМ ---\n';
    const groups = { critical: [], 'pre-war': [], high: [], medium: [], normal: [], low: [] };
    for (const c of countries) {
        const status = c.status || 'low';
        if (!groups[status]) groups[status] = [];
        groups[status].push(c.name);
    }
    const emojis = { critical: '🔴', 'pre-war': '🟠', high: '🟠', medium: '🟡', normal: '🟢', low: '🟢' };
    for (const [status, names] of Object.entries(groups)) {
        if (names.length) {
            report += `${emojis[status] || '⚪'} ${status.toUpperCase()} (${names.length}): ${names.join(', ')}\n`;
        }
    }
    report += '\n';

    // --- Все слои ---
    report += '--- ВСЕ СЛОИ (' + layers.length + ' шт.) ---\n';
    for (const layer of layers) {
        const count = window.layerCache?.[layer.id]?.length || 0;
        const active = (activeIds.has(layer.id) || layer.id === currentLayer) ? ' ✅ АКТИВЕН' : '';
        report += `  ${layer.number || '00'} ${layer.name} (${layer.category}) — ${count} маркеров${active}\n`;
    }
    report += '\n';

    // --- Все маркеры (1301) с кратким описанием ---
    report += `--- ВСЕ МАРКЕРЫ (${markers.length} шт.) ---\n`;
    for (const m of markers) {
        const lat = m.lat !== undefined ? m.lat.toFixed(4) : '?';
        const lng = m.lng !== undefined ? m.lng.toFixed(4) : '?';
        const name = m.title || m.name || 'Событие';
        const status = m.status || 'medium';
        const layer = m.layer || 'all';
        const summary = m.summary || m.description || '';
        const shortSummary = summary.length > 60 ? summary.slice(0, 60) + '…' : summary;
        report += `  ${name} (${status}) — ${lat}, ${lng} [${layer}]`;
        if (shortSummary) report += ` — ${shortSummary}`;
        report += '\n';
    }
    report += '\n';

    // --- Координаты карты ---
    if (mapData) {
        report += mapData;
    }

    // --- Активные слои ---
    report += '--- АКТИВНЫЕ СЛОИ (ID) ---\n';
    if (activeIds.size > 0) {
        for (const id of activeIds) {
            if (id === 'all') continue;
            const layer = layers.find(l => l.id === id);
            if (layer) {
                report += `  ${layer.name} (${layer.id})\n`;
            } else {
                report += `  ${id}\n`;
            }
        }
    } else {
        report += '  Нет активных слоёв\n';
    }
    report += '\n';

    // --- Мета-теги ---
    const metas = document.querySelectorAll('meta');
    if (metas.length > 0) {
        report += '--- META-ТЕГИ ---\n';
        for (const m of metas) {
            const name = m.getAttribute('name') || m.getAttribute('property') || '?';
            const content = m.getAttribute('content') || '';
            if (content) report += `  ${name}: ${content.slice(0, 150)}\n`;
        }
        report += '\n';
    }

    // --- DOM-Слепок (первые 50 элементов) ---
    if (elements.length > 0) {
        report += `--- DOM-СЛЕПОК (первые ${elements.length} элементов) ---\n`;
        for (const el of elements) {
            report += `\n[${el.index}] ${el.selector}\n`;
            report += `  Текст: ${el.text || '—'}\n`;
            report += `  Координаты: X=${el.coords.x} Y=${el.coords.y} (ширина=${el.coords.width} высота=${el.coords.height})\n`;
            report += `  Цвет: ${el.styles.color || '—'}\n`;
            report += `  Фон: ${el.styles.backgroundColor || '—'}\n`;
            report += `  Шрифт: ${el.styles.fontFamily || '—'} размер=${el.styles.fontSize || '—'} вес=${el.styles.fontWeight || '—'}\n`;
            report += `  Отступы: ${el.styles.padding || '—'}\n`;
            report += `  Граница: ${el.styles.border || '—'}\n`;
            report += `  Скругление: ${el.styles.borderRadius || '—'}\n`;
            report += `  Тень: ${el.styles.boxShadow || '—'}\n`;
            report += `  Display: ${el.styles.display || '—'}\n`;
            report += `  Position: ${el.styles.position || '—'} top=${el.styles.top || '—'} left=${el.styles.left || '—'}\n`;
            report += `  Размер: ${el.styles.width || '—'}×${el.styles.height || '—'}\n`;
            report += `  Прозрачность: ${el.styles.opacity || '—'}\n`;
            report += `  Z-индекс: ${el.styles.zIndex || '—'}\n`;
            report += `  Transform: ${el.styles.transform || '—'}\n`;
        }
    }

    report += '\n--- CRUCIX OSINT TERMINAL ---\n';
    report += '🌐 ' + window.location.origin + '/geo-map';

    const sizeKB = Math.round(report.length / 1024);

    navigator.clipboard.writeText(report).then(() => {
        const btn = document.getElementById('copy-btn');
        if (btn) {
            btn.textContent = '✅ ' + sizeKB + ' KB';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '📋 КОПИРОВАТЬ';
                btn.classList.remove('copied');
            }, 3000);
        }
        showNotification('✅ ' + sizeKB + ' KB данных скопировано');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = report;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('✅ Данные скопированы (' + sizeKB + ' KB)');
    });
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function collectMapData() {
    const map = window.map;
    if (!map) return '';

    let data = '--- КООРДИНАТЫ КАРТЫ ---\n';
    try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        data += `Центр: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}\n`;
        data += `Масштаб: ${zoom}\n`;
        const bounds = map.getBounds();
        data += `Границы: ${bounds.getSouthWest().lat.toFixed(4)}, ${bounds.getSouthWest().lng.toFixed(4)} — ${bounds.getNorthEast().lat.toFixed(4)}, ${bounds.getNorthEast().lng.toFixed(4)}\n\n`;
    } catch (e) {}

    return data;
}

function collectDOMSnapshot(limit = 50) {
    const result = [];
    let index = 0;
    const excludeIds = ['copy-btn', 'notification'];

    document.querySelectorAll('*').forEach(el => {
        if (excludeIds.includes(el.id)) return;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
        if (el.tagName === 'HTML' || el.tagName === 'BODY') return;

        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);

        if (rect.width === 0 && rect.height === 0) return;
        if (computed.display === 'none') return;

        let textContent = '';
        for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                textContent += node.textContent.trim();
            }
        }
        if (!textContent && el.textContent) {
            textContent = el.textContent.trim().slice(0, 200);
        }
        if (!textContent && !el.id && !el.className) return;

        let selector = el.tagName.toLowerCase();
        if (el.id) selector += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(c => c).join('.');
            if (classes) selector += '.' + classes;
        }

        result.push({
            index: ++index,
            selector: selector,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: el.className || null,
            text: textContent || null,
            coords: {
                x: Math.round(rect.left + window.pageXOffset),
                y: Math.round(rect.top + window.pageYOffset),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            styles: {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                padding: computed.padding,
                margin: computed.margin,
                border: computed.border,
                borderRadius: computed.borderRadius,
                boxShadow: computed.boxShadow,
                display: computed.display,
                position: computed.position,
                top: computed.top,
                left: computed.left,
                width: computed.width,
                height: computed.height,
                opacity: computed.opacity,
                zIndex: computed.zIndex,
                transform: computed.transform
            }
        });

        if (result.length >= limit) return; // остановить сбор, если достигнут лимит
    });

    return result;
}

function showNotification(msg) {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

window.copyAllData = copyAllData;
console.log('✅ COPY-DATA.JS загружен (расширенная версия)');
