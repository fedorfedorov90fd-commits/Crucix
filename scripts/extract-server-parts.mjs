#!/usr/bin/env node

/**
 * extract-server-parts.mjs — АВТОМАТИЧЕСКОЕ ИЗВЛЕЧЕНИЕ
 * Разбирает объединённый server.mjs на компоненты
 *
 * ВЕРСИЯ 2.0 — ИСПРАВЛЕННАЯ
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SERVER_FILE = join(ROOT_DIR, 'server.mjs');
const SERVER_DIR = join(ROOT_DIR, 'server');

// Читаем исходный файл
console.log('🔍 Парсинг server.mjs...\n');
const content = readFileSync(SERVER_FILE, 'utf8');

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ — ПОИСК МАРШРУТА ДЛЯ ОБРАБОТЧИКА
// ============================================================

function findRouteForHandler(content, handlerName) {
    // Ищем в секции API маршрутов
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Ищем if (pathname.startsWith('/api/...')) { await handleXXX
        const match = line.match(/if\s*\(\s*pathname\.startsWith\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)\s*\{\s*await\s*(\w+)/);
        if (match && match[2] === handlerName) {
            return match[1];
        }
        // Ищем if (pathname === '/api/...') { await handleXXX
        const matchExact = line.match(/if\s*\(\s*pathname\s*===\s*['"]([^'"]+)['"]\s*\)\s*\{\s*await\s*(\w+)/);
        if (matchExact && matchExact[2] === handlerName) {
            return matchExact[1];
        }
    }
    return null;
}

// ============================================================
// 1. ИЗВЛЕЧЕНИЕ ВСЕХ МОДУЛЕЙ (mod_*)
// ============================================================

console.log('📦 Извлечение модулей...');

const modRegex = /const (mod_\w+) = await safeImport\(['"]([^'"]+)['"]\)/g;
const modules = [];
let match;
while ((match = modRegex.exec(content)) !== null) {
    const name = match[1];
    const path = match[2];
    const id = name.replace('mod_', '');
    modules.push({ id, path, original: name });
}

console.log(`  Найдено модулей: ${modules.length}`);

// ============================================================
// 2. ИЗВЛЕЧЕНИЕ ВСЕХ ОБРАБОТЧИКОВ (handle*)
// ============================================================

console.log('🔧 Извлечение обработчиков...');

// Ищем const handle* = getHandler(...)
const handlerRegex = /const (handle\w+) = getHandler\(mod_(\w+),\s*['"](\w+)['"]/g;
const handlers = [];
while ((match = handlerRegex.exec(content)) !== null) {
    const handlerName = match[1];
    const modId = match[2];
    const handlerType = match[3];
    const route = findRouteForHandler(content, handlerName);
    handlers.push({
        handler: handlerName,
        module: modId,
        type: handlerType,
        route: route || `/${handlerName.toLowerCase()}`
    });
}

console.log(`  Найдено обработчиков: ${handlers.length}`);

// ============================================================
// 3. ИЗВЛЕЧЕНИЕ ВСЕХ СТРАНИЦ (PAGE_ROUTES)
// ============================================================

console.log('📄 Извлечение страниц...');

const pageRegex = /'(\/[^']+)':\s*'([^']+)'/g;
const pages = [];
while ((match = pageRegex.exec(content)) !== null) {
    pages.push({ route: match[1], file: match[2] });
}

console.log(`  Найдено страниц: ${pages.length}`);

// ============================================================
// 4. ИЗВЛЕЧЕНИЕ MIME-ТИПОВ
// ============================================================

console.log('📁 Извлечение MIME-типов...');

const mimeStart = content.indexOf('const MIME_TYPES = {');
const mimeEnd = content.indexOf('};', mimeStart) + 2;
const mimeBlock = content.substring(mimeStart, mimeEnd);

// ============================================================
// 5. СОЗДАНИЕ ФАЙЛОВ В ПАПКЕ server/
// ============================================================

console.log('\n📁 Создание файлов в server/...');

mkdirSync(SERVER_DIR, { recursive: true });

// 5.1 modules.json
const modulesJson = modules.map(m => ({
    id: m.id,
    path: m.path
}));
writeFileSync(
    join(SERVER_DIR, 'modules.json'),
    JSON.stringify(modulesJson, null, 2)
);
console.log(`  ✅ modules.json (${modulesJson.length} модулей)`);

// 5.2 routes-api.json (извлечение маршрутов из handleAPI)
console.log('  🔍 Извлечение API маршрутов из handleAPI...');

const apiRoutes = {};
// Ищем все if (pathname.startsWith(...)) { await handleXXX }
const routeRegex = /if\s*\(\s*pathname\.startsWith\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)\s*\{\s*await\s*(handle\w+)/g;
while ((match = routeRegex.exec(content)) !== null) {
    const route = match[1];
    const handler = match[2];
    // Ищем модуль для этого обработчика
    for (const h of handlers) {
        if (h.handler === handler) {
            apiRoutes[route] = h.module;
            break;
        }
    }
}

// Точные совпадения
const exactRouteRegex = /if\s*\(\s*pathname\s*===\s*['"]([^'"]+)['"]\s*\)\s*\{\s*await\s*(handle\w+)/g;
while ((match = exactRouteRegex.exec(content)) !== null) {
    const route = match[1];
    const handler = match[2];
    for (const h of handlers) {
        if (h.handler === handler) {
            apiRoutes[route] = h.module;
            break;
        }
    }
}

writeFileSync(
    join(SERVER_DIR, 'routes-api.json'),
    JSON.stringify(apiRoutes, null, 2)
);
console.log(`  ✅ routes-api.json (${Object.keys(apiRoutes).length} маршрутов)`);

// 5.3 pages.json
const pagesJson = pages.map(p => ({
    id: p.route.replace(/^\//, '') || 'index',
    file: p.file
}));
writeFileSync(
    join(SERVER_DIR, 'pages.json'),
    JSON.stringify(pagesJson, null, 2)
);
console.log(`  ✅ pages.json (${pagesJson.length} страниц)`);

// 5.4 routes-pages.json
const routesPages = {};
for (const p of pages) {
    routesPages[p.route] = p.file;
}
writeFileSync(
    join(SERVER_DIR, 'routes-pages.json'),
    JSON.stringify(routesPages, null, 2)
);
console.log(`  ✅ routes-pages.json (${Object.keys(routesPages).length} маршрутов)`);

// 5.5 config.mjs
const configContent = `/**
 * server/config.mjs — НАСТРОЙКИ (извлечено из объединённого server.mjs)
 */

export const PORT = process.env.PORT || 3117;

${mimeBlock}

export default { PORT, MIME_TYPES };
`;
writeFileSync(join(SERVER_DIR, 'config.mjs'), configContent);
console.log(`  ✅ config.mjs`);

// 5.6 utils.mjs
const utilsContent = `/**
 * server/utils.mjs — УТИЛИТЫ
 */

import { promises as fs } from 'fs';
import { MIME_TYPES } from './config.mjs';

export function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return true;
}

export function sendError(res, message, statusCode = 500) {
    return sendJSON(res, { error: message, status: statusCode }, statusCode);
}

export function createStub(apiName) {
    return async (req, res) => {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: \`API "\${apiName}" временно недоступен\`,
            status: 501,
            timestamp: new Date().toISOString()
        }));
    };
}

export async function fileExists(filePath) {
    try { await fs.access(filePath); return true; } catch { return false; }
}

export async function serveStatic(req, res, filePath) {
    try {
        const ext = filePath.split('.').pop();
        const mimeType = MIME_TYPES['.' + ext] || 'application/octet-stream';
        const content = await fs.readFile(filePath);
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
        return true;
    } catch {
        return false;
    }
}

export function generate404Page() {
    return \`<!DOCTYPE html>
<html><head><title>404 — Crucix</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh}.container{text-align:center}h1{font-size:72px;margin:0;color:#2196f3;font-weight:700}p{font-size:20px;color:#888;margin:16px 0 24px}a{color:#2196f3;text-decoration:none;font-size:16px;padding:10px 30px;border:1px solid #2196f3;border-radius:6px}a:hover{opacity:.7;background:rgba(33,150,243,.1)}</style>
</head><body><div class="container"><h1>404</h1><p>Страница не найдена</p><a href="/">← Вернуться на главную</a></div></body></html>\`;
}
`;
writeFileSync(join(SERVER_DIR, 'utils.mjs'), utilsContent);
console.log(`  ✅ utils.mjs`);

// 5.7 loader.mjs
const loaderContent = `/**
 * server/loader.mjs — ЗАГРУЗЧИК
 */

import { createStub } from './utils.mjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = __dirname;

export function loadJSON(file) {
    const fullPath = join(SERVER_DIR, file);
    if (!existsSync(fullPath)) return {};
    try {
        return JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch {
        return {};
    }
}

export async function loadModule(modulePath) {
    try {
        const fullPath = join(SERVER_DIR, '..', modulePath);
        const module = await import(\`file://\${fullPath}\`);
        return module;
    } catch (e) {
        console.warn(\`⚠️ Не удалось загрузить \${modulePath}:\`, e.message);
        return null;
    }
}

export async function loadAllModules() {
    const handlers = {};
    const modules = loadJSON('modules.json');

    if (!Array.isArray(modules) || modules.length === 0) {
        console.warn('⚠️ modules.json пуст или не найден');
        return handlers;
    }

    for (const entry of modules) {
        const module = await loadModule(entry.path);
        if (module) {
            handlers[entry.id] = module.default || module;
            console.log(\`  ✅ Загружен: \${entry.id}\`);
        } else {
            handlers[entry.id] = createStub(entry.id);
        }
    }

    return handlers;
}

export function loadPageRoutes() {
    return loadJSON('routes-pages.json');
}

export function loadAPIRoutes() {
    return loadJSON('routes-api.json');
}

export function loadPages() {
    return loadJSON('pages.json');
}
`;
writeFileSync(join(SERVER_DIR, 'loader.mjs'), loaderContent);
console.log(`  ✅ loader.mjs`);

// 5.8 router.mjs
const routerContent = `/**
 * server/router.mjs — РОУТЕР
 */

import { sendError } from './utils.mjs';
import { loadAPIRoutes } from './loader.mjs';

const API_ROUTES = loadAPIRoutes();

export async function handleAPI(req, res, pathname, handlers) {
    // Сначала точные совпадения
    for (const [route, handlerId] of Object.entries(API_ROUTES)) {
        if (pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) {
            const handler = handlers[handlerId];
            if (handler) {
                await handler(req, res);
                return true;
            }
            sendError(res, \`Handler "\${handlerId}" не найден\`, 501);
            return true;
        }
    }

    return false;
}
`;
writeFileSync(join(SERVER_DIR, 'router.mjs'), routerContent);
console.log(`  ✅ router.mjs`);

// 5.9 static.mjs
const staticContent = `/**
 * server/static.mjs — СТАТИКА
 */

import { join } from 'path';
import { fileExists, serveStatic, generate404Page } from './utils.mjs';
import { loadPageRoutes, loadPages } from './loader.mjs';

const PAGE_ROUTES = loadPageRoutes();
const PAGES = loadPages();

export async function handleStatic(req, res, pathname, publicDir) {
    // GEO-MAP
    if (pathname.startsWith('/geo-map/')) {
        const filePath = join(publicDir, pathname);
        if (await fileExists(filePath)) {
            return await serveStatic(req, res, filePath);
        }
        return false;
    }

    // Страницы из реестра
    const cleanPath = pathname.replace('.html', '');
    const pageFile = PAGE_ROUTES[cleanPath] || PAGE_ROUTES[pathname];
    if (pageFile) {
        const fullPath = join(publicDir, pageFile);
        if (await fileExists(fullPath)) {
            return await serveStatic(req, res, fullPath);
        }
    }

    // CSS/JS/Images
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/') ||
        pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) {
        const fullPath = join(publicDir, pathname);
        if (await fileExists(fullPath)) {
            return await serveStatic(req, res, fullPath);
        }
    }

    // Прямой файл
    const fullPath = join(publicDir, pathname);
    if (await fileExists(fullPath)) {
        return await serveStatic(req, res, fullPath);
    }

    return false;
}

export function serve404(res) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(generate404Page());
}
`;
writeFileSync(join(SERVER_DIR, 'static.mjs'), staticContent);
console.log(`  ✅ static.mjs`);

// 5.10 api.mjs (пустой, для расширения)
const apiContent = `/**
 * server/api.mjs — ДОПОЛНИТЕЛЬНЫЕ API МАРШРУТЫ
 *
 * Сюда можно добавлять кастомные обработчики
 */

export async function handleCustomAPI(req, res, pathname, handlers) {
    // Добавляй свои маршруты здесь
    return false;
}
`;
writeFileSync(join(SERVER_DIR, 'api.mjs'), apiContent);
console.log(`  ✅ api.mjs`);

console.log('\n' + '='.repeat(50));
console.log('✅ ГОТОВО!');
console.log('='.repeat(50));
console.log(`📁 Все файлы сохранены в: ${SERVER_DIR}`);
console.log(`📊 Модулей: ${modules.length}`);
console.log(`📊 Страниц: ${pages.length}`);
console.log(`📊 Обработчиков: ${handlers.length}`);
console.log(`📊 API маршрутов: ${Object.keys(apiRoutes).length}`);
console.log('='.repeat(50));
console.log('✨ Теперь можно использовать портабельную структуру!');
