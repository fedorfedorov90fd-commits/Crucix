// ============================================================
// collector-monitor-api.mjs — Мониторинг сборщиков (v3.1)
// ============================================================
// Исправлено: resolveProjectRoot — синхронная версия
// ============================================================

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// ОПРЕДЕЛЕНИЕ КОРНЯ ПРОЕКТА (синхронно)
// ============================================================

function resolveProjectRoot() {
    let current = __dirname;
    while (current !== '/') {
        const testPath = join(current, 'data', 'basket');
        if (existsSync(testPath)) {
            return current;
        }
        current = dirname(current);
    }
    return join(__dirname, '..', '..');
}

const PROJECT_ROOT = resolveProjectRoot();
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function safeReaddir(dir) {
    try {
        return await fs.readdir(dir);
    } catch {
        return [];
    }
}

function detectMode(collectorName) {
    const scriptPath = join(SCRIPTS_DIR, `collect-${collectorName}.mjs`);
    try {
        const content = require('fs').readFileSync(scriptPath, 'utf8');
        if (/demo|test|mock|sample/i.test(content) && !/real|production|live/i.test(content)) {
            return 'demo';
        }
        return 'real';
    } catch {
        return 'inactive';
    }
}

function parseLogErrorsSync(logPath) {
    try {
        const content = require('fs').readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        const errorLines = lines.filter(line =>
            /\[ERROR\]|\[WARN\]|\[FAIL\]|\[ERR\]|Error:|Failed:|❌|Ошибка/i.test(line)
        );
        return {
            total: lines.length,
            errors: errorLines,
            lastError: errorLines.length > 0 ? errorLines[errorLines.length - 1] : null,
            errorCount: errorLines.length
        };
    } catch {
        return { total: 0, errors: [], lastError: null, errorCount: 0 };
    }
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА — СТАТУСЫ
// ============================================================

async function getCollectorStatus() {
    const results = [];
    const files = await safeReaddir(BASKET_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'daily-briefing-cache.json');

    for (const file of jsonFiles) {
        const name = file.replace('.json', '');
        const filePath = join(BASKET_DIR, file);
        const logPath = join(LOGS_DIR, `collect-${name}.log`);

        let count = 0;
        let status = 'unknown';
        let ageHours = 0;
        let lastRun = null;
        let size = 0;
        let errorCount = 0;
        let hasData = false;
        let isRecent = false;

        // Читаем данные
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                count = data.length;
            } else if (data.data && Array.isArray(data.data)) {
                count = data.data.length;
            } else if (data.features && Array.isArray(data.features)) {
                count = data.features.length;
            }
            hasData = count > 0;

            const stat = await fs.stat(filePath);
            size = stat.size;
            const age = Date.now() - stat.mtime.getTime();
            ageHours = Math.round(age / 3600000 * 10) / 10;
            isRecent = ageHours < 24;
            lastRun = stat.mtime;
        } catch {
            count = 0;
            hasData = false;
        }

        // Проверяем логи на ошибки
        try {
            const logContent = await fs.readFile(logPath, 'utf8');
            errorCount = (logContent.match(/❌|ERROR|Ошибка|failed|Error:|Failed:/gi) || []).length;
        } catch {
            errorCount = 0;
        }

        // Определяем статус
        if (!hasData && errorCount === 0) {
            status = 'inactive';
        } else if (!hasData && errorCount > 0) {
            status = 'error';
        } else if (hasData && !isRecent && errorCount > 3) {
            status = 'error';
        } else if (hasData && !isRecent) {
            status = 'warning';
        } else if (hasData && errorCount > 10) {
            status = 'warning';
        } else if (hasData && errorCount <= 10) {
            status = 'ok';
        } else {
            status = 'unknown';
        }

        // Определяем режим работы
        const mode = detectMode(name);

        results.push({
            name,
            file,
            status,
            mode,
            count,
            expected: 50,
            ageHours,
            size,
            errorCount,
            hasData,
            isRecent,
            lastRun: lastRun ? lastRun.toISOString() : null
        });
    }

    // Сортируем: ошибки → предупреждения → неизвестно → OK → неактивные
    const order = { error: 0, warning: 1, unknown: 2, ok: 3, inactive: 4 };
    results.sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5));

    return results;
}

// ============================================================
// ОБРАБОТЧИКИ API
// ============================================================

export async function handleCollectorMonitorStatus(req, res) {
    try {
        const status = await getCollectorStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: status,
            total: status.length,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('[CollectorMonitor] Ошибка получения статусов:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleCollectorMonitorSummary(req, res) {
    try {
        const status = await getCollectorStatus();
        const summary = {
            total: status.length,
            ok: status.filter(s => s.status === 'ok').length,
            warning: status.filter(s => s.status === 'warning').length,
            error: status.filter(s => s.status === 'error').length,
            unknown: status.filter(s => s.status === 'unknown').length,
            inactive: status.filter(s => s.status === 'inactive').length,
            timestamp: new Date().toISOString()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: summary }));
    } catch (error) {
        console.error('[CollectorMonitor] Ошибка получения сводки:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleCollectorLogs(req, res, url) {
    try {
        const pathParts = url.pathname.split('/').filter(Boolean);
        const name = pathParts[pathParts.length - 1];

        if (!name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Имя сборщика не указано' }));
            return;
        }

        const linesCount = parseInt(url.searchParams.get('lines') || '100', 10);
        const logPath = join(LOGS_DIR, `collect-${name}.log`);

        let log = '';
        let totalLines = 0;

        try {
            const content = await fs.readFile(logPath, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            totalLines = lines.length;
            log = lines.slice(-linesCount).join('\n');
        } catch {
            log = '❌ Лог не найден';
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            name: name,
            log: log,
            totalLines: totalLines,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('[CollectorMonitor] Ошибка получения лога:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleCollectorMonitorScan(req, res) {
    try {
        const files = await safeReaddir(SCRIPTS_DIR);
        const collectorFiles = files.filter(f => f.startsWith('collect-') && f.endsWith('.mjs'));

        const collectors = collectorFiles.map(f => {
            const name = f.replace('collect-', '').replace('.mjs', '');
            const mode = detectMode(name);
            return { name, mode, file: f };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: collectors,
            total: collectors.length,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('[CollectorMonitor] Ошибка сканирования:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleCollectorMonitorErrors(req, res) {
    try {
        const logFiles = await safeReaddir(LOGS_DIR);
        const collectorLogs = logFiles.filter(f => f.startsWith('collect-') && f.endsWith('.log'));

        const report = {
            timestamp: new Date().toISOString(),
            collectors: []
        };

        for (const f of collectorLogs) {
            const name = f.replace('collect-', '').replace('.log', '');
            const logPath = join(LOGS_DIR, f);
            const parsed = parseLogErrorsSync(logPath);

            if (parsed.errorCount > 0) {
                report.collectors.push({
                    name: name,
                    errorCount: parsed.errorCount,
                    totalLines: parsed.total,
                    lastError: parsed.lastError,
                    errors: parsed.errors.slice(-10)
                });
            }
        }

        report.collectors.sort((a, b) => b.errorCount - a.errorCount);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: report,
            totalCollectors: collectorLogs.length,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('[CollectorMonitor] Ошибка сбора ошибок:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

// ============================================================
// ОСНОВНОЙ РОУТЕР
// ============================================================

export async function handleCollectorMonitor(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/api/collector-monitor/status') {
        return await handleCollectorMonitorStatus(req, res);
    }
    if (pathname === '/api/collector-monitor/summary') {
        return await handleCollectorMonitorSummary(req, res);
    }
    if (pathname === '/api/collector-monitor/scan') {
        return await handleCollectorMonitorScan(req, res);
    }
    if (pathname === '/api/collector-monitor/errors') {
        return await handleCollectorMonitorErrors(req, res);
    }
    if (pathname.startsWith('/api/collector/logs/')) {
        return await handleCollectorLogs(req, res, url);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    return true;
}

// ============================================================
// ЭКСПОРТЫ
// ============================================================

export default {
    handleCollectorMonitor,
    handleCollectorMonitorStatus,
    handleCollectorMonitorSummary,
    handleCollectorMonitorScan,
    handleCollectorMonitorErrors,
    handleCollectorLogs,
    getCollectorStatus
};
