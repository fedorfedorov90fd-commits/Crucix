/**
 * server/pages.mjs — РЕЕСТР СТРАНИЦ
 *
 * Поддерживает два формата routes-pages.json:
 *   1. Массив объектов: [{id, route, file}, ...]  — текущий формат
 *   2. Словарь:         {"/route": "file", ...}    — legacy-формат
 *
 * FIX (2026-09-30):
 *   Раньше getPageFile() обращался с PAGE_ROUTES как со словарём,
 *   но routes-pages.json с недавних пор — массив объектов.
 *   Из-за этого маршруты типа /network-map, где file = ".../index.html"
 *   (путь к директории с index.html), не резолвились → сервер падал
 *   с EISDIR при попытке readFile() на директорию.
 */

import { loadPageRoutes, loadPages } from './loader.mjs';

const PAGE_ROUTES = loadPageRoutes();
const PAGES = loadPages();

// ---------- Нормализация в два индекса ----------
// byRoute: { "/network-map": "network-map/index.html" }  ← путь ОТНОСИТЕЛЬНО PUBLIC_DIR
// byId:    { "network-map": "network-map/index.html" }
//
// ВАЖНО: server.mjs всегда делает join(PUBLIC_DIR, pageFile), поэтому
// getPageFile() должен возвращать путь ОТНОСИТЕЛЬНО PUBLIC_DIR.
// В routes-pages.json поле "file" хранится как полный путь от корня проекта
// ("dashboard/public/network-map/index.html"), поэтому здесь мы срезаем
// префикс "dashboard/public/" (или "public/") и приводим к относительному пути.
const byRoute = {};
const byId = {};

// Префиксы, которые нужно убрать из file
const PUBLIC_PREFIXES = [
    'dashboard/public/',
    'dashboard\\public\\',
    'public/',
    'public\\',
    './public/',
    './'
];

function normalizeFile(file) {
    if (typeof file !== 'string' || !file) return file;
    let result = file;
    for (const prefix of PUBLIC_PREFIXES) {
        if (result.startsWith(prefix)) {
            result = result.slice(prefix.length);
            break;
        }
    }
    // Убираем ведущие слеши
    result = result.replace(/^[\\/]+/, '');
    return result;
}

if (Array.isArray(PAGE_ROUTES)) {
    for (const item of PAGE_ROUTES) {
        if (!item || typeof item !== 'object') continue;
        const route = item.route || (item.id ? '/' + item.id : null);
        const file = normalizeFile(item.file);
        if (route && file) byRoute[route] = file;
        if (item.id && file) byId[item.id] = file;
    }
} else if (PAGE_ROUTES && typeof PAGE_ROUTES === 'object') {
    // legacy-формат: ключ — уже route или id
    for (const [key, file] of Object.entries(PAGE_ROUTES)) {
        if (typeof file !== 'string') continue;
        const norm = normalizeFile(file);
        byRoute[key] = norm;
        if (key.startsWith('/')) {
            byId[key.slice(1)] = norm;
        } else {
            byId[key] = norm;
            byRoute['/' + key] = norm;
        }
    }
}

// ---------- Публичный API ----------

export function getPageFile(pathname) {
    if (!pathname) return null;

    // 1. Точное совпадение по route
    if (byRoute[pathname]) return byRoute[pathname];

    // 2. Без .html на конце
    const cleanPath = pathname.replace(/\.html?$/i, '');
    if (byRoute[cleanPath]) return byRoute[cleanPath];

    // 3. С завершающим слешем
    const noSlash = pathname.replace(/\/$/, '');
    if (byRoute[noSlash]) return byRoute[noSlash];

    // 4. По id (без ведущего слеша)
    const id = pathname.replace(/^\//, '').replace(/\.html?$/i, '').replace(/\/$/, '');
    if (byId[id]) return byId[id];

    // 5. Не нашли — null
    return null;
}

export function getPageById(id) {
    if (Array.isArray(PAGES)) {
        const page = PAGES.find(p => p && p.id === id);
        return page ? page.file : null;
    }
    if (PAGES && typeof PAGES === 'object') {
        return PAGES[id] || null;
    }
    return null;
}

export function getAllPages() {
    return PAGES;
}

export function getAllRoutes() {
    // Возвращаем словарь {route: file} для совместимости
    return byRoute;
}

export function getDashboardPages() {
    if (Array.isArray(PAGES)) {
        return PAGES.filter(p => p && typeof p.id === 'string' && p.id.startsWith('dashboard-'));
    }
    return [];
}

export function getMainPages() {
    if (Array.isArray(PAGES)) {
        return PAGES.filter(p => p && typeof p.id === 'string' && !p.id.startsWith('dashboard-'));
    }
    return [];
}

export default {
    getPageFile,
    getPageById,
    getAllPages,
    getAllRoutes,
    getDashboardPages,
    getMainPages
};
