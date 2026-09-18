/* ============================================================
   LOGGER.JS — Профессиональная система логирования
   Версия 1.0 — Визуальная панель + localStorage + экспорт
   ============================================================ */

console.log('📋 LOGGER.JS загружен');

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const LOGGER_CONFIG = {
    maxLogs: 500,
    maxStorageSize: 1024 * 1024,
    autoSaveInterval: 30000,
    exportChunkSize: 200 * 1024,
    logLevels: ['debug', 'info', 'warn', 'error', 'success']
};

// ============================================================
// КЛАСС ЛОГГЕРА
// ============================================================

class CrucixLogger {
    constructor() {
        this.logs = [];
        this.sessionId = this.generateSessionId();
        this.startTime = new Date();
        this.isPanelVisible = false;
        this.isInitialized = false;
        this.currentFilter = 'all';

        this.loadFromStorage();
        this.interceptConsole();
        this.createPanel();

        setInterval(() => this.autoSave(), LOGGER_CONFIG.autoSaveInterval);

        console.log('📋 Логгер инициализирован, сессия:', this.sessionId);
        this.info('Логгер запущен', { sessionId: this.sessionId });
    }

    generateSessionId() {
        const date = new Date();
        const d = date.toISOString().slice(0, 10).replace(/-/g, '');
        const t = date.toISOString().slice(11, 19).replace(/:/g, '');
        const r = Math.random().toString(36).slice(2, 6);
        return `CRUCIX-${d}-${t}-${r}`;
    }

    interceptConsole() {
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };

        const self = this;

        console.log = function(...args) {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            self.addLog('info', msg, { from: 'console.log' });
            originalConsole.log.apply(console, args);
        };

        console.info = function(...args) {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            self.addLog('info', msg, { from: 'console.info' });
            originalConsole.info.apply(console, args);
        };

        console.warn = function(...args) {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            self.addLog('warn', msg, { from: 'console.warn' });
            originalConsole.warn.apply(console, args);
        };

        console.error = function(...args) {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            self.addLog('error', msg, { from: 'console.error' });
            originalConsole.error.apply(console, args);
        };

        console.debug = function(...args) {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            self.addLog('debug', msg, { from: 'console.debug' });
            originalConsole.debug.apply(console, args);
        };

        window.addEventListener('error', function(e) {
            self.addLog('error', e.message || 'Ошибка', {
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack
            });
        });

        window.addEventListener('unhandledrejection', function(e) {
            self.addLog('error', 'Unhandled Promise Rejection', {
                reason: e.reason,
                promise: e.promise
            });
        });
    }

    addLog(level, message, data = null) {
        const entry = {
            id: this.logs.length + 1,
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            data: data,
            sessionId: this.sessionId,
            timeSinceStart: Date.now() - this.startTime.getTime()
        };

        this.logs.push(entry);

        if (this.logs.length > LOGGER_CONFIG.maxLogs) {
            this.logs = this.logs.slice(-LOGGER_CONFIG.maxLogs);
        }

        this.updatePanel();
        this.saveToStorage();
    }

    debug(msg, data) { this.addLog('debug', msg, data); }
    info(msg, data) { this.addLog('info', msg, data); }
    warn(msg, data) { this.addLog('warn', msg, data); }
    error(msg, data) { this.addLog('error', msg, data); }
    success(msg, data) { this.addLog('success', msg, data); }

    saveToStorage() {
        try {
            const data = {
                sessionId: this.sessionId,
                startTime: this.startTime.toISOString(),
                logs: this.logs.slice(-100)
            };
            const json = JSON.stringify(data);
            if (json.length < LOGGER_CONFIG.maxStorageSize) {
                localStorage.setItem('crucix-logs', json);
                localStorage.setItem('crucix-logs-last-update', new Date().toISOString());
            }
        } catch (e) {
            console.warn('⚠️ Не удалось сохранить логи в localStorage:', e);
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem('crucix-logs');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.logs && Array.isArray(data.logs)) {
                    this.logs = data.logs;
                    console.log('📋 Загружено логов из localStorage:', this.logs.length);
                }
            }
        } catch (e) {
            console.warn('⚠️ Не удалось загрузить логи из localStorage:', e);
        }
    }

    autoSave() {
        this.saveToStorage();
        const el = document.getElementById('logger-last-update');
        if (el) {
            el.textContent = 'Обновлено: ' + new Date().toLocaleTimeString();
        }
    }

    createPanel() {
        const old = document.getElementById('logger-panel');
        if (old) old.remove();

        const panel = document.createElement('div');
        panel.id = 'logger-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 420px;
            max-height: 50vh;
            background: rgba(10, 10, 20, 0.92);
            border: 1px solid rgba(91, 192, 248, 0.2);
            border-radius: 8px;
            backdrop-filter: blur(12px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            z-index: 100000;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: monospace;
            font-size: 11px;
            color: #c8d0d8;
            resize: both;
            min-width: 300px;
            min-height: 200px;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            background: rgba(91, 192, 248, 0.08);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            flex-shrink: 0;
            cursor: move;
        `;
        header.innerHTML = `
            <span style="font-weight:600;font-size:11px;color:#5bc0f8;">
                📋 Лог-панель
                <span id="logger-count" style="font-weight:400;color:#666;font-size:10px;margin-left:6px;">0</span>
            </span>
            <span id="logger-last-update" style="font-size:8px;color:#666;">—</span>
            <div>
                <button id="logger-clear" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.2);color:#ef4444;border-radius:3px;padding:0 6px;font-size:9px;cursor:pointer;margin-right:4px;">✕</button>
                <button id="logger-toggle" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);color:#888;border-radius:3px;padding:0 6px;font-size:9px;cursor:pointer;">_</button>
                <button id="logger-close" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);color:#888;border-radius:3px;padding:0 6px;font-size:9px;cursor:pointer;">✕</button>
            </div>
        `;
        panel.appendChild(header);

        const filters = document.createElement('div');
        filters.style.cssText = `
            display: flex;
            gap: 3px;
            padding: 4px 10px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            flex-shrink: 0;
            flex-wrap: wrap;
        `;
        const levels = ['all', 'debug', 'info', 'warn', 'error', 'success'];
        filters.innerHTML = levels.map(l =>
            `<button class="logger-filter" data-level="${l}" style="background:${l === 'all' ? 'rgba(91,192,248,0.15)' : 'transparent'};border:1px solid ${l === 'all' ? 'rgba(91,192,248,0.3)' : 'rgba(255,255,255,0.06)'};color:${l === 'all' ? '#5bc0f8' : '#666'};border-radius:3px;padding:1px 8px;font-size:8px;cursor:pointer;font-family:inherit;">${l.toUpperCase()}</button>`
        ).join('');
        panel.appendChild(filters);

        const container = document.createElement('div');
        container.id = 'logger-container';
        container.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 4px 10px;
            min-height: 100px;
            max-height: calc(50vh - 100px);
        `;
        panel.appendChild(container);

        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex;
            gap: 6px;
            padding: 4px 10px;
            border-top: 1px solid rgba(255,255,255,0.04);
            flex-shrink: 0;
            flex-wrap: wrap;
        `;
        footer.innerHTML = `
            <button id="logger-export" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.2);color:#22c55e;border-radius:3px;padding:2px 8px;font-size:9px;cursor:pointer;">📤 Экспорт .txt</button>
            <button id="logger-snapshot" style="background:rgba(91,192,248,0.12);border:1px solid rgba(91,192,248,0.2);color:#5bc0f8;border-radius:3px;padding:2px 8px;font-size:9px;cursor:pointer;">📸 Снапшот</button>
            <button id="logger-copy" style="background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.2);color:#a78bfa;border-radius:3px;padding:2px 8px;font-size:9px;cursor:pointer;">📋 Копировать</button>
            <span style="font-size:8px;color:#4a5a6a;align-self:center;margin-left:auto;" id="logger-status">Готов</span>
        `;
        panel.appendChild(footer);

        document.body.appendChild(panel);

        document.querySelectorAll('.logger-filter').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.logger-filter').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.borderColor = 'rgba(255,255,255,0.06)';
                    b.style.color = '#666';
                });
                btn.style.background = 'rgba(91,192,248,0.15)';
                btn.style.borderColor = 'rgba(91,192,248,0.3)';
                btn.style.color = '#5bc0f8';
                this.currentFilter = btn.dataset.level;
                this.updatePanel();
            };
        });
        this.currentFilter = 'all';

        document.getElementById('logger-clear').onclick = () => {
            this.logs = [];
            this.updatePanel();
            this.saveToStorage();
            this.info('Логи очищены');
        };

        let isMinimized = false;
        document.getElementById('logger-toggle').onclick = () => {
            isMinimized = !isMinimized;
            container.style.display = isMinimized ? 'none' : 'block';
            filters.style.display = isMinimized ? 'none' : 'flex';
            footer.style.display = isMinimized ? 'none' : 'flex';
            document.getElementById('logger-toggle').textContent = isMinimized ? '□' : '_';
        };

        document.getElementById('logger-close').onclick = () => {
            this.hidePanel();
        };

        document.getElementById('logger-export').onclick = () => {
            this.exportLogs();
        };

        document.getElementById('logger-snapshot').onclick = () => {
            this.exportSnapshot();
        };

        document.getElementById('logger-copy').onclick = () => {
            this.copyLogs();
        };

        let isDragging = false;
        let dragStartX, dragStartY, panelStartX, panelStartY;

        header.onmousedown = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            panelStartX = rect.left;
            panelStartY = rect.top;
            document.body.style.userSelect = 'none';
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            panel.style.left = (panelStartX + dx) + 'px';
            panel.style.top = (panelStartY + dy) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        };

        document.onmouseup = () => {
            isDragging = false;
            document.body.style.userSelect = '';
        };

        this.isInitialized = true;
        this.info('Лог-панель создана');
        this.updatePanel();
    }

    updatePanel() {
        const container = document.getElementById('logger-container');
        if (!container) return;

        const countEl = document.getElementById('logger-count');
        if (countEl) countEl.textContent = this.logs.length;

        let filtered = this.logs;
        if (this.currentFilter && this.currentFilter !== 'all') {
            filtered = filtered.filter(l => l.level === this.currentFilter);
        }

        const display = filtered.slice(-100);

        const levelColors = {
            debug: '#666',
            info: '#5bc0f8',
            warn: '#ffd700',
            error: '#ef4444',
            success: '#22c55e'
        };

        const levelIcons = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            success: '✅'
        };

        container.innerHTML = display.map(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const color = levelColors[entry.level] || '#666';
            const icon = levelIcons[entry.level] || '📌';
            const msg = entry.message.length > 200 ? entry.message.slice(0, 200) + '...' : entry.message;

            return `
                <div style="display:flex;gap:6px;padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:10px;font-family:monospace;">
                    <span style="color:#4a5a6a;min-width:60px;font-size:8px;">${time}</span>
                    <span style="color:${color};min-width:60px;">${icon} ${entry.level.toUpperCase()}</span>
                    <span style="color:#c8d0d8;flex:1;word-break:break-word;">${msg}</span>
                </div>
            `;
        }).join('');

        if (display.length === 0) {
            container.innerHTML = `
                <div style="color:#4a5a6a;text-align:center;padding:20px;font-size:11px;">
                    Нет записей
                </div>
            `;
        }

        container.scrollTop = container.scrollHeight;
    }

    showPanel() {
        const panel = document.getElementById('logger-panel');
        if (panel) panel.style.display = 'flex';
        this.isPanelVisible = true;
    }

    hidePanel() {
        const panel = document.getElementById('logger-panel');
        if (panel) panel.style.display = 'none';
        this.isPanelVisible = false;
    }

    togglePanel() {
        if (this.isPanelVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }

    exportLogs() {
        this.info('Экспорт логов...');
        const content = this.formatLogsForExport();
        const sizeKB = Math.round(content.length / 1024);

        if (content.length > LOGGER_CONFIG.exportChunkSize) {
            const parts = this.splitContent(content, LOGGER_CONFIG.exportChunkSize);
            this.downloadParts(parts, 'logs');
            this.info(`Логи разбиты на ${parts.length} частей (${sizeKB} KB)`);
            this.success(`Экспортировано ${parts.length} файлов`);
        } else {
            this.downloadFile(content, 'logs', 'txt');
            this.success(`Логи экспортированы (${sizeKB} KB)`);
        }
    }

    exportSnapshot() {
        this.info('Создание снапшота страницы...');
        const snapshot = this.generateSnapshot();
        const sizeKB = Math.round(snapshot.length / 1024);

        if (snapshot.length > LOGGER_CONFIG.exportChunkSize) {
            const parts = this.splitContent(snapshot, LOGGER_CONFIG.exportChunkSize);
            this.downloadParts(parts, 'snapshot');
            this.info(`Снапшот разбит на ${parts.length} частей (${sizeKB} KB)`);
            this.success(`Создано ${parts.length} файлов снапшота`);
        } else {
            this.downloadFile(snapshot, 'snapshot', 'txt');
            this.success(`Снапшот создан (${sizeKB} KB)`);
        }
    }

    copyLogs() {
        const content = this.formatLogsForExport();
        navigator.clipboard.writeText(content).then(() => {
            this.success('Логи скопированы в буфер обмена (' + Math.round(content.length / 1024) + ' KB)');
        }).catch(() => {
            this.error('Не удалось скопировать логи');
        });
    }

    formatLogsForExport() {
        const header = `=== CRUCIX — ЛОГИ ===\n`;
        const meta = `Сессия: ${this.sessionId}\n`;
        const start = `Начало: ${this.startTime.toISOString()}\n`;
        const count = `Всего записей: ${this.logs.length}\n`;
        const separator = '\n' + '='.repeat(60) + '\n\n';

        let body = '';
        for (const entry of this.logs) {
            const time = new Date(entry.timestamp).toLocaleString();
            const data = entry.data ? ' | ' + JSON.stringify(entry.data) : '';
            body += `[${time}] [${entry.level.toUpperCase()}] ${entry.message}${data}\n`;
        }

        const footer = `\n--- CRUCIX OSINT TERMINAL ---\n`;
        const url = `🌐 ${window.location.origin}/geo-map\n`;

        return header + meta + start + count + separator + body + footer + url;
    }

    generateSnapshot() {
        const timestamp = new Date().toISOString();

        let report = `=== CRUCIX — ПОЛНЫЙ СНАПШОТ СТРАНИЦЫ ===\n`;
        report += `Дата: ${timestamp}\n`;
        report += `URL: ${window.location.href}\n`;
        report += `Размер окна: ${window.innerWidth}×${window.innerHeight}\n`;
        report += `Сессия: ${this.sessionId}\n\n`;

        report += `--- DOM ЭЛЕМЕНТЫ (${document.querySelectorAll('*').length}) ---\n`;
        const allElements = document.querySelectorAll('*');
        let elementIndex = 0;
        for (const el of allElements) {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
            if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            const computed = window.getComputedStyle(el);

            let text = '';
            for (const node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    text += node.textContent.trim();
                }
            }
            if (!text && el.textContent) text = el.textContent.trim().slice(0, 100);
            if (!text && !el.id && !el.className) continue;

            let selector = el.tagName.toLowerCase();
            if (el.id) selector += '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.split(' ').filter(c => c).join('.');
                if (classes) selector += '.' + classes;
            }

            report += `\n[${++elementIndex}] ${selector}\n`;
            report += `  Текст: ${text || '—'}\n`;
            report += `  Координаты: ${Math.round(rect.left)},${Math.round(rect.top)} (${Math.round(rect.width)}×${Math.round(rect.height)})\n`;
            report += `  Цвет: ${computed.color || '—'}\n`;
            report += `  Фон: ${computed.backgroundColor || '—'}\n`;
            report += `  Шрифт: ${computed.fontSize || '—'} ${computed.fontWeight || '—'}\n`;
        }

        report += `\n--- ДАННЫЕ КАРТЫ ---\n`;
        if (typeof map !== 'undefined' && map) {
            const center = map.getCenter();
            const zoom = map.getZoom();
            report += `Центр: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}\n`;
            report += `Масштаб: ${zoom}\n`;
            const bounds = map.getBounds();
            report += `Границы: SW(${bounds.getSouthWest().lat.toFixed(4)}, ${bounds.getSouthWest().lng.toFixed(4)}) NE(${bounds.getNorthEast().lat.toFixed(4)}, ${bounds.getNorthEast().lng.toFixed(4)})\n`;
        }

        report += `\n--- МАРКЕРЫ (${typeof markerData !== 'undefined' && markerData ? markerData.length : 0}) ---\n`;
        if (typeof markerData !== 'undefined' && markerData && markerData.length > 0) {
            const show = Math.min(markerData.length, 100);
            for (let i = 0; i < show; i++) {
                const m = markerData[i];
                report += `  ${m.title || 'Событие'} — ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)} [${m.layer || '—'}]\n`;
            }
            if (markerData.length > show) {
                report += `  ... и ещё ${markerData.length - show} маркеров\n`;
            }
        }

        report += `\n--- СЛОИ (${typeof allLayers !== 'undefined' && allLayers ? allLayers.length : 0}) ---\n`;
        if (typeof allLayers !== 'undefined' && allLayers && allLayers.length > 0) {
            for (const layer of allLayers) {
                const count = (typeof layerCache !== 'undefined' && layerCache[layer.id]) ? layerCache[layer.id].length : 0;
                const active = (typeof activeLayerIds !== 'undefined' && activeLayerIds.has(layer.id)) ? ' ✅' : '';
                report += `  ${layer.number || '00'} ${layer.name} (${layer.category || 'other'}) — ${count} маркеров${active}\n`;
            }
        }

        report += `\n--- СТРАНЫ (${typeof ALL_COUNTRIES !== 'undefined' && ALL_COUNTRIES ? ALL_COUNTRIES.length : 0}) ---\n`;
        if (typeof ALL_COUNTRIES !== 'undefined' && ALL_COUNTRIES && ALL_COUNTRIES.length > 0) {
            const groups = {};
            for (const c of ALL_COUNTRIES) {
                const status = c.status || 'unknown';
                if (!groups[status]) groups[status] = [];
                groups[status].push(c.name);
            }
            for (const [status, names] of Object.entries(groups)) {
                const emoji = status === 'critical' ? '🔴' :
                    status === 'pre-war' ? '🟠' :
                    status === 'high' ? '🟠' :
                    status === 'medium' ? '🟡' :
                    status === 'low' ? '🟢' : '⚪';
                report += `${emoji} ${status.toUpperCase()}: ${names.length}\n`;
                if (names.length <= 20) {
                    report += `   ${names.join(', ')}\n`;
                }
            }
        }

        const ssiLabel = document.getElementById('ssi-label');
        report += `\n--- SSI ---\n`;
        report += `Индекс напряжённости: ${ssiLabel ? ssiLabel.textContent : '0%'}\n`;

        const markerCount = document.getElementById('marker-count');
        const countriesCount = document.getElementById('countries-count');
        report += `\n--- СТАТИСТИКА СТРАНИЦЫ ---\n`;
        report += `Элементов DOM: ${elementIndex}\n`;
        report += `Маркеров на карте: ${markerCount ? markerCount.textContent : '0'}\n`;
        report += `Стран на карте: ${countriesCount ? countriesCount.textContent : '0'}\n`;

        const footer = `\n--- CRUCIX OSINT TERMINAL ---\n`;
        const url = `🌐 ${window.location.origin}/geo-map\n`;

        return report + footer + url;
    }

    splitContent(content, maxSize) {
        const parts = [];
        let current = '';
        const lines = content.split('\n');

        for (const line of lines) {
            if ((current + line + '\n').length > maxSize) {
                parts.push(current);
                current = '';
            }
            current += line + '\n';
        }

        if (current) parts.push(current);

        return parts.map((p, i) => ({
            content: p,
            index: i + 1,
            total: parts.length
        }));
    }

    downloadFile(content, name, ext) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crucix-${name}-${this.sessionId}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    downloadParts(parts, name) {
        for (const part of parts) {
            const content = `=== CRUCIX — ${name.toUpperCase()} (часть ${part.index}/${part.total}) ===\n\n${part.content}`;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crucix-${name}-part${part.index}-of-${part.total}-${this.sessionId}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

let crucixLogger = null;

function initLogger() {
    if (!crucixLogger) {
        crucixLogger = new CrucixLogger();
        console.log('📋 Логгер инициализирован');
    }
    return crucixLogger;
}

// Экспорт в глобальную область

window.crucixLogger = crucixLogger;
window.CrucixLogger = CrucixLogger;


export { CrucixLogger, initLogger };