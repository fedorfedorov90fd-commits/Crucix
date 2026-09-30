/**
 * server/static.mjs — РАЗДАЧА СТАТИКИ
 *
 * Извлечено из server.mjs v12.0 (ULTIMATE EDITION)
 * Содержит: раздачу статических файлов, поиск страниц, 404
 */

import { join } from 'path';
import { fileExists, serveStatic, generate404Page } from './utils.mjs';
import { getPageFile } from './pages.mjs';

export async function handleStatic(req, res, pathname, publicDir) {
    // === GEO-MAP ===
    if (pathname.startsWith('/geo-map/')) {
        const filePath = join(publicDir, pathname);
        if (await fileExists(filePath)) {
            return await serveStatic(req, res, filePath);
        }
        return false;
    }

    // === СТРАНИЦЫ ИЗ РЕЕСТРА ===
    const pageFile = getPageFile(pathname);
    if (pageFile) {
        const fullPath = join(publicDir, pageFile);
        if (await fileExists(fullPath)) {
            return await serveStatic(req, res, fullPath);
        }
    }

    // === CSS/JS/IMAGES ===
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/') ||
        pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) {
        const fullPath = join(publicDir, pathname);
        if (await fileExists(fullPath)) {
            return await serveStatic(req, res, fullPath);
        }
    }

    // === /lib/ ===
    if (pathname.startsWith('/lib/')) {
        const fullPath = join(publicDir, pathname);
        if (await fileExists(fullPath)) {
            return await serveStatic(req, res, fullPath);
        }
    }

    // === ПРЯМОЙ ФАЙЛ ===
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

export default {
    handleStatic,
    serve404
};
