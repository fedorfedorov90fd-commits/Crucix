/**
 * server/pages.mjs — УПРАВЛЕНИЕ СТРАНИЦАМИ
 *
 * Извлечено из server.mjs v12.0 (ULTIMATE EDITION)
 * Содержит: маршруты страниц, поиск файлов
 */

import { join } from 'path';
import { fileExists } from './utils.mjs';
import { loadPageRoutes, loadPages } from './loader.mjs';

const PAGE_ROUTES = loadPageRoutes();
const PAGES = loadPages();

export function getPageFile(pathname) {
    const cleanPath = pathname.replace('.html', '');
    return PAGE_ROUTES[cleanPath] || PAGE_ROUTES[pathname] || null;
}

export function getPageById(id) {
    const page = PAGES.find(p => p.id === id);
    return page ? page.file : null;
}

export function getAllPages() {
    return PAGES;
}

export function getAllRoutes() {
    return PAGE_ROUTES;
}

export function getDashboardPages() {
    return PAGES.filter(p => p.id.startsWith('dashboard-'));
}

export function getMainPages() {
    return PAGES.filter(p => !p.id.startsWith('dashboard-'));
}

export default {
    getPageFile,
    getPageById,
    getAllPages,
    getAllRoutes,
    getDashboardPages,
    getMainPages
};
