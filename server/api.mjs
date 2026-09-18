/**
 * server/api.mjs — ПОЛНЫЙ API-РОУТЕР
 * Поддерживает динамическую загрузку модулей из modules.json
 */

import { loadModule } from './loader.mjs';
import { sendJSON, sendError } from './utils.mjs';

// ============================================================
// ОСНОВНОЙ ОБРАБОТЧИК API
// ============================================================

export async function handleAPI(req, res, handlers = {}) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`  📡 API запрос: ${pathname}`);

    // === Обработчик /api/registry/ ===
    if (pathname === '/api/registry/' || pathname === '/api/registry') {
        return handleRegistryAPI(req, res);
    }
    if (pathname === '/api/registry/status') {
        return handleRegistryStatus(req, res);
    }

    // === Динамические API-маршруты ===
    const routes = loadAPIRoutes();
    const route = routes.routes ? routes.routes.find(r => r.path === pathname) : null;
    if (!route) {
        sendError(res, `API не найден: ${pathname}`, 404);
        return;
    }

    try {
        const handler = handlers[route.module];
        if (!handler) {
            console.warn(`  ⚠️ Модуль ${route.module} не загружен, пытаемся загрузить...`);
            const module = await loadModule(route.module);
            if (module) {
                handlers[route.module] = module.default || module;
            } else {
                sendError(res, `Модуль ${route.module} не найден`, 404);
                return;
            }
        }

        const moduleHandler = handlers[route.module];
        if (typeof moduleHandler !== 'function') {
            sendError(res, `Модуль ${route.module} не экспортирует обработчик`, 500);
            return;
        }

        await moduleHandler(req, res);
    } catch (err) {
        console.error(`Ошибка в модуле ${route.module}:`, err);
        sendError(res, `Ошибка модуля ${route.module}: ${err.message}`, 500);
    }
}

// ============================================================
// ОБРАБОТЧИК РЕЕСТРА
// ============================================================

export async function handleRegistryAPI(req, res) {
    try {
        const apisDir = new URL('../apis/sources', import.meta.url).pathname;
        const pagesDir = new URL('../dashboard/public', import.meta.url).pathname;
        const collectorsDir = new URL('../scripts/collectors', import.meta.url).pathname;

        const { readdir } = await import('fs/promises');
        const isOfficial = (name) => {
            if (name.includes('(копия)')) return false;
            if (name.includes('(кбитыйя)')) return false;
            if (name.startsWith('=')) return false;
            if (name.startsWith('1') || name.startsWith('2')) return false;
            if (name.includes(' ')) return false;
            if (name.includes('_')) return false;
            if (name.includes('.')) return false;
            return true;
        };

        let apiFiles = [], pageFiles = [], collectorFiles = [];
        try {
            const files = await readdir(apisDir);
            apiFiles = files.filter(f => f.endsWith('.mjs') && isOfficial(f)).map(f => f.replace('.mjs', ''));
        } catch (e) {}
        try {
            const files = await readdir(pagesDir);
            pageFiles = files.filter(f => f.endsWith('.html') && isOfficial(f)).map(f => f.replace('.html', ''));
        } catch (e) {}
        try {
            const files = await readdir(collectorsDir);
            collectorFiles = files.filter(f => f.endsWith('.mjs') && isOfficial(f)).map(f => f.replace('.mjs', ''));
        } catch (e) {}

        const data = {
            timestamp: new Date().toISOString(),
            api: { total: apiFiles.length, list: apiFiles },
            pages: { total: pageFiles.length, list: pageFiles },
            collectors: { total: collectorFiles.length, list: collectorFiles },
            stats: {
                total_components: apiFiles.length + pageFiles.length + collectorFiles.length
            }
        };
        sendJSON(res, { success: true, data });
    } catch (err) {
        sendError(res, `Registry error: ${err.message}`, 500);
    }
}

export async function handleRegistryStatus(req, res) {
    sendJSON(res, {
        success: true,
        status: 'online',
        timestamp: new Date().toISOString()
    });
}

// ============================================================
// ЗАГРУЗЧИК МАРШРУТОВ
// ============================================================

function loadAPIRoutes() {
    const { readFileSync, existsSync } = require('fs');
    const { join } = require('path');
    const { dirname } = require('path');
    const __dirname = dirname(new URL(import.meta.url).pathname);
    const file = join(__dirname, 'routes-api.json');
    if (!existsSync(file)) return { routes: [] };
    try {
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        if (data.routes) return data;
        return { routes: data };
    } catch {
        return { routes: [] };
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export default {
    handleAPI,
    handleRegistryAPI,
    handleRegistryStatus
};
