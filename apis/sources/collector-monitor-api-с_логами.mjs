// ============================================================
// collector-monitor-api.mjs — Мониторинг сборщиков (v3.4)
// ============================================================
// Добавлено: перезапуск сборщиков, управление выделением
// ============================================================

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');
const CONFIG_DIR = join(PROJECT_ROOT, 'data', 'config');
const SETTINGS_FILE = join(CONFIG_DIR, 'monitor-settings.json');

// ============================================================
// ОЖИДАЕМОЕ КОЛИЧЕСТВО ЗАПИСЕЙ
// ============================================================

const EXPECTED_COUNTS = {
    'vix': 200, 'bdi': 200, 'gold-oil-ratio': 200, 'inflation': 100,
    'unemployment': 80, 'pmi': 80, 'recession': 80, 'dxy': 200,
    'tips': 200, 'ovx': 200, 'hy-spread': 200, 'war-preparation': 100,
    'consumer-confidence': 80, 'nuclear-monitor': 80, 'social-unrest': 80,
    'copper-gold': 200, 'viirs': 100, 'uranium': 100, 'sp500-vix': 200,
    'crypto-fear': 100, 'oil-gas': 100, 'gold-silver': 200,
    'happiness': 50, 'big-mac': 50, 'big-mac-alt': 50,
    'big-mac-main': 50, 'debt-gdp': 80, 'vxx': 200, 'happiness-alt': 50
};

// ============================================================
// НАСТРОЙКИ
// ============================================================

const DEFAULT_SETTINGS = {
    maxLogSizeMB: 100,
    autoCleanup: true,
    cleanupInterval: 3600000,
    lastCleanup: null
};

async function loadSettings() {
    try {
        const content = await fs.readFile(SETTINGS_FILE, 'utf8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

async function saveSettings(settings) {
    try {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('[Monitor] Ошибка сохранения настроек:', e);
    }
}

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

async function getFolderSize(dir) {
    let size = 0;
    try {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const stat = await fs.stat(join(dir, file));
            if (stat.isDirectory()) {
                size += await getFolderSize(join(dir, file));
            } else {
                size += stat.size;
            }
        }
    } catch {}
    return size;
}

async function getLogsSize() {
    return await getFolderSize(LOGS_DIR);
}

async function cleanupLogs(maxSizeMB) {
    try {
        const files = await fs.readdir(LOGS_DIR);
        const logFiles = files.filter(f => f.endsWith('.log') || f.endsWith('.txt'));
        const fileStats = await Promise.all(
            logFiles.map(async (f) => {
                const stat = await fs.stat(join(LOGS_DIR, f));
                return { name: f, mtime: stat.mtime, size: stat.size };
            })
        );
        fileStats.sort((a, b) => a.mtime - b.mtime);
        let currentSize = await getLogsSize();
        const maxBytes = maxSizeMB * 1024 * 1024;
        const deleted = [];
        for (const file of fileStats) {
            if (currentSize <= maxBytes) break;
            const filePath = join(LOGS_DIR, file.name);
            await fs.unlink(filePath);
            currentSize -= file.size;
            deleted.push(file.name);
        }
        return { deleted, deletedCount: deleted.length, currentSizeMB: Math.round(currentSize / (1024 * 1024 * 10)) / 10 };
    } catch (e) {
        console.error('[Monitor] Ошибка очистки логов:', e);
        throw e;
    }
}

async function clearAllLogs() {
    try {
        const files = await fs.readdir(LOGS_DIR);
        const deleted = [];
        for (const file of files) {
            const filePath = join(LOGS_DIR, file);
            const stat = await fs.stat(filePath);
            if (stat.isFile() && (file.endsWith('.log') || file.endsWith('.txt'))) {
                await fs.unlink(filePath);
                deleted.push(file);
            }
        }
        return { deleted, count: deleted.length };
    } catch (e) {
        console.error('[Monitor] Ошибка удаления логов:', e);
        throw e;
    }
}

async function clearHistory() {
    try {
        const historyPath = join(CONFIG_DIR, 'monitor-history.json');
        if (existsSync(historyPath)) {
            await fs.unlink(historyPath);
            return { success: true, message: 'История удалена' };
        }
        return { success: true, message: 'История не найдена' };
    } catch (e) {
        console.error('[Monitor] Ошибка удаления истории:', e);
        throw e;
    }
}

// ============================================================
// ФУНКЦИИ ПЕРЕЗАПУСКА
// ============================================================

async function restartCollector(name) {
    const scriptPath = join(SCRIPTS_DIR, `collect-${name}.mjs`);
    if (!existsSync(scriptPath)) {
        return { success: false, error: `Скрипт ${name} не найден` };
    }

    try {
        // Запускаем сборщик в фоновом режиме
        const child = spawn('node', [scriptPath], {
            detached: true,
            stdio: 'ignore',
            cwd: PROJECT_ROOT
        });
        child.unref();

        return {
            success: true,
            message: `Сборщик ${name} запущен`,
            pid: child.pid
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function restartCollectorsByStatus(status) {
    const collectorStatus = await getCollectorStatus();
    const targets = collectorStatus.filter(s => s.status === status);
    const results = [];

    for (const target of targets) {
        const result = await restartCollector(target.name);
        results.push({ name: target.name, ...result });
    }

    return {
        total: targets.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
    };
}

async function restartAllCollectors() {
    const collectorStatus = await getCollectorStatus();
    const targets = collectorStatus.filter(s => s.status !== 'inactive');
    const results = [];

    for (const target of targets) {
        const result = await restartCollector(target.name);
        results.push({ name: target.name, ...result });
    }

    return {
        total: targets.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
    };
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

        let count = 0, status = 'unknown', ageHours = 0, lastRun = null;
        let size = 0, errorCount = 0, hasData = false, isRecent = false, hasExpected = false;

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            if (Array.isArray(data)) count = data.length;
            else if (data.data && Array.isArray(data.data)) count = data.data.length;
            else if (data.features && Array.isArray(data.features)) count = data.features.length;
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

        try {
            const logContent = await fs.readFile(logPath, 'utf8');
            errorCount = (logContent.match(/❌|ERROR|Ошибка|failed|Error:|Failed:/gi) || []).length;
        } catch {
            errorCount = 0;
        }

        const expected = EXPECTED_COUNTS[name] || 50;
        hasExpected = count >= expected * 0.5;

        if (!hasData && errorCount === 0) status = 'inactive';
        else if (!hasData && errorCount > 0) status = 'error';
        else if (hasData && !isRecent && errorCount > 3) status = 'error';
        else if (hasData && !isRecent) status = 'warning';
        else if (hasData && errorCount > 10) status = 'warning';
        else if (hasData && errorCount <= 10) status = 'ok';
        else status = 'unknown';

        const mode = detectMode(name);
        results.push({
            name, file, status, mode, count, expected, hasExpected,
            ageHours, size, errorCount, hasData, isRecent,
            lastRun: lastRun ? lastRun.toISOString() : null
        });
    }

    const order = { error: 0, warning: 1, unknown: 2, ok: 3, inactive: 4 };
    results.sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5));
    return results;
}

// ============================================================
// ОБРАБОТЧИКИ API — МОНИТОРИНГ
// ============================================================

export async function handleCollectorMonitorStatus(req, res) {
    try {
        const status = await getCollectorStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: status, total: status.length, timestamp: new Date().toISOString() }));
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
        let log = '', totalLines = 0;
        try {
            const content = await fs.readFile(logPath, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            totalLines = lines.length;
            log = lines.slice(-linesCount).join('\n');
        } catch {
            log = '❌ Лог не найден';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, name, log, totalLines, timestamp: new Date().toISOString() }));
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
        res.end(JSON.stringify({ success: true, data: collectors, total: collectors.length, timestamp: new Date().toISOString() }));
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
        const report = { timestamp: new Date().toISOString(), collectors: [] };
        for (const f of collectorLogs) {
            const name = f.replace('collect-', '').replace('.log', '');
            const logPath = join(LOGS_DIR, f);
            const parsed = parseLogErrorsSync(logPath);
            if (parsed.errorCount > 0) {
                report.collectors.push({ name, errorCount: parsed.errorCount, totalLines: parsed.total, lastError: parsed.lastError, errors: parsed.errors.slice(-10) });
            }
        }
        report.collectors.sort((a, b) => b.errorCount - a.errorCount);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: report, totalCollectors: collectorLogs.length, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[CollectorMonitor] Ошибка сбора ошибок:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

// ============================================================
// ОБРАБОТЧИКИ API — ОЧИСТКА
// ============================================================

export async function handleCleanupLogs(req, res) {
    try {
        const result = await clearAllLogs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка очистки логов:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleClearHistory(req, res) {
    try {
        const result = await clearHistory();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка очистки истории:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleAutoCleanup(req, res) {
    try {
        const settings = await loadSettings();
        const maxSizeMB = parseInt(req.url.searchParams.get('maxMB') || settings.maxLogSizeMB, 10);
        const size = await getLogsSize();
        const sizeMB = Math.round(size / (1024 * 1024 * 10)) / 10;
        let result = { sizeMB, maxSizeMB, cleaned: false, deleted: [] };
        if (sizeMB > maxSizeMB) {
            result = await cleanupLogs(maxSizeMB);
            result.sizeMB = sizeMB;
            result.maxSizeMB = maxSizeMB;
            result.cleaned = true;
            settings.lastCleanup = new Date().toISOString();
            await saveSettings(settings);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка автоочистки:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleGetSettings(req, res) {
    try {
        const settings = await loadSettings();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: settings, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка получения настроек:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleSetSettings(req, res) {
    try {
        const body = await new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => resolve(data));
        });
        const newSettings = JSON.parse(body);
        const current = await loadSettings();
        const merged = { ...current, ...newSettings };
        await saveSettings(merged);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: merged, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка сохранения настроек:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

// ============================================================
// ОБРАБОТЧИКИ API — ПЕРЕЗАПУСК
// ============================================================

export async function handleRestartCollector(req, res, url) {
    try {
        const name = url.searchParams.get('name');
        if (!name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Имя сборщика не указано' }));
            return;
        }
        const result = await restartCollector(name);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка перезапуска:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleRestartBatch(req, res) {
    try {
        const body = await new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => resolve(data));
        });
        const { names } = JSON.parse(body);
        if (!names || !Array.isArray(names) || names.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Список имён пуст' }));
            return;
        }
        const results = [];
        for (const name of names) {
            const result = await restartCollector(name);
            results.push({ name, ...result });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                total: names.length,
                success: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            },
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('[Monitor] Ошибка пакетного перезапуска:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleRestartByStatus(req, res, url) {
    try {
        const status = url.searchParams.get('status') || 'warning';
        const result = await restartCollectorsByStatus(status);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка перезапуска по статусу:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export async function handleRestartAll(req, res) {
    try {
        const result = await restartAllCollectors();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }));
    } catch (error) {
        console.error('[Monitor] Ошибка перезапуска всех:', error);
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

    console.log(`[CollectorMonitor] Запрос: ${pathname}`);

    // Мониторинг
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

    // Очистка
    if (pathname === '/api/collector-monitor/cleanup/logs') {
        return await handleCleanupLogs(req, res);
    }
    if (pathname === '/api/collector-monitor/cleanup/history') {
        return await handleClearHistory(req, res);
    }
    if (pathname === '/api/collector-monitor/cleanup/auto') {
        return await handleAutoCleanup(req, res);
    }
    if (pathname === '/api/collector-monitor/settings') {
        return await handleGetSettings(req, res);
    }
    if (pathname === '/api/collector-monitor/settings/set') {
        return await handleSetSettings(req, res);
    }

    // Перезапуск
    if (pathname === '/api/collector/restart') {
        return await handleRestartCollector(req, res, url);
    }
    if (pathname === '/api/collector/restart/batch') {
        return await handleRestartBatch(req, res);
    }
    if (pathname === '/api/collector/restart/status') {
        return await handleRestartByStatus(req, res, url);
    }
    if (pathname === '/api/collector/restart/all') {
        return await handleRestartAll(req, res);
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
    handleCleanupLogs,
    handleClearHistory,
    handleAutoCleanup,
    handleGetSettings,
    handleSetSettings,
    handleRestartCollector,
    handleRestartBatch,
    handleRestartByStatus,
    handleRestartAll,
    getCollectorStatus,
    cleanupLogs,
    clearAllLogs,
    clearHistory,
    getLogsSize,
    restartCollector,
    restartCollectorsByStatus,
    restartAllCollectors
};
