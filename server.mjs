#!/usr/bin/env node
/**
 * server.mjs — СТАРТОВЫЙ ФАЙЛ CRUCIX SERVER v14.0
 *
 * ПЕРЕД СТАРТОМ:
 *   1. Пересборка реестра (node server/build-registry.mjs)
 *   2. Валидация контракта (node scripts/lint-contract.mjs) — если хоть один модуль
 *      нарушает контракт, сервер НЕ поднимается (exit 1).
 *
 * Затем:
 *   - HTTP-сервер на PORT (по умолчанию 3117)
 *   - Статика из dashboard/public
 *   - API через ./server/router.mjs (handleAPI)
 *   - Страничные маршруты через ./server/pages.mjs
 */

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt':  'text/plain; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff2':'font/woff2',
    '.map':  'application/json',
};

// ============================================================
//  PRESTART: РЕЕСТР + ВАЛИДАЦИЯ КОНТРАКТА
// ============================================================

function prestartBuildRegistry() {
    console.log('[prestart] Пересборка реестра...');
    try {
        const out = execSync('node server/build-registry.mjs', { encoding: 'utf8', cwd: __dirname });
        const tail = out.trim().split('\n').slice(-5).join('\n');
        console.log(tail);
    } catch (e) {
        console.error('[prestart] ОШИБКА сборки реестра:');
        console.error(e.stdout || e.message);
        process.exit(1);
    }
}

function prestartLintContract() {
    const strict = process.env.LINT_STRICT === '1';
    console.log('[prestart] Валидация контракта модулей' + (strict ? ' (STRICT)' : ' (ratchet: warn-only)') + '...');
    try {
        const out = execSync('node scripts/lint-contract.mjs --quiet', { encoding: 'utf8', cwd: __dirname });
        const last = out.trim().split('\n').slice(-1)[0] || '';
        console.log('[prestart] ' + last);
    } catch (e) {
        const report = (e.stdout || '').trim();
        const lines = report.split('\n');
        const summaryLine = lines.find(l => l.includes('НАРУШЕНИЙ')) || lines[lines.length - 2] || '';
        if (strict) {
            console.error('');
            console.error('================================================================');
            console.error('  ❌ СТАРТ ПРЕРВАН: модули нарушают контракт CRUCIX v2 (STRICT)');
            console.error('================================================================');
            console.error(report);
            console.error('Запусти автомиграцию: node scripts/migrate-to-contract.mjs --all');
            console.error('================================================================');
            process.exit(1);
        } else {
            console.warn('');
            console.warn('================================================================');
            console.warn('  ⚠️  WARN: часть модулей ещё не в контракте — сервер продолжит работу');
            console.warn('      (ratchet-режим: новые модули проверяются, старые устраняются постепенно)');
            console.warn('      Для строгого режима: LINT_STRICT=1 node server.mjs');
            console.warn('================================================================');
            console.warn('  ' + (summaryLine.trim() || 'отчёт lint выше'));
            console.warn('================================================================');
        }
    }
}

prestartBuildRegistry();
prestartLintContract();

// ============================================================
//  ПОДКЛЮЧЕНИЕ РОУТЕРОВ
// ============================================================

const { handleAPI, initRouter } = await import('./server/router.mjs');
const { getPageFile, getAllRoutes } = await import('./server/pages.mjs');

// ============================================================
//  СЕРВЕР
// ============================================================

function runDescriptionGenerator() {
    console.log('[Startup] Запуск генератора описаний...');
    exec('node scripts/generate-descriptions.mjs', (error, stdout) => {
        if (error) { console.warn('[Startup] Генератор описаний: ошибка', error.message); return; }
        if (stdout) {
            const lines = stdout.trim().split('\n');
            const last = lines[lines.length - 1];
            if (last) console.log('[Startup]', last);
        }
    });
}

console.log('📄 Загружено маршрутов страниц:', Object.keys(getAllRoutes()).length);

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
        const handled = await handleAPI(req, res, pathname);
        if (handled) return;
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'api_not_found', path: pathname }));
        return;
    }

    const staticExts = ['.js', '.css', '.mjs', '.json', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff2', '.map'];
    const ext = extname(pathname);
    if (staticExts.includes(ext)) {
        const fullPath = join(PUBLIC_DIR, pathname);
        try {
            const content = await fs.readFile(fullPath);
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            res.end(content);
            return;
        } catch (err) {}
    }

    let pageFile = getPageFile(pathname);
    let fullPath;

    if (pageFile) {
        if (!pageFile.endsWith('.html') && !pageFile.endsWith('.htm')) pageFile += '.html';
        fullPath = join(PUBLIC_DIR, pageFile);
    } else {
        let filePath = pathname;
        if (filePath.endsWith('/')) filePath += 'index.html';
        fullPath = join(PUBLIC_DIR, filePath);
    }

    try {
        const content = await fs.readFile(fullPath);
        const ext2 = extname(fullPath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext2] || 'application/octet-stream' });
        res.end(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 — Страница не найдена</h1>');
        } else {
            console.error('Ошибка:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
        }
    }
});

// ═══════════════════════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ РОУТЕРА: загрузка реестра, подписка на изменения
// ═══════════════════════════════════════════════════════════
try {
    await initRouter();
} catch (e) {
    console.error('[server] ОШИБКА инициализации роутера:', e.message);
    console.error(e.stack);
    process.exit(1);
}

server.listen(PORT, () => {
    console.log('============================================================');
    console.log('  🚀 CRUCIX SERVER v14.0 (PRESTART LINT + MODULAR ROUTER)');
    console.log('  📡 Порт:', PORT);
    console.log('  🌐 URL: http://localhost:' + PORT);
    console.log('============================================================');
    console.log('  ✅ Реестр: /api/registry/');
    console.log('  ✅ Страница: /registry');
    console.log('============================================================');
    console.log('  🎉 СЕРВЕР ГОТОВ');
    console.log('============================================================');
    runDescriptionGenerator();
});
