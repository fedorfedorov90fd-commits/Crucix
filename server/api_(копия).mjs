/**
 * server/api.mjs — ДОПОЛНИТЕЛЬНЫЕ API-ОБРАБОТЧИКИ (МОДУЛЬНАЯ ВЕРСИЯ)
 * Добавлен обработчик /api/registry/ 04.09.2026
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendError(res, message, statusCode = 500) {
    sendJSON(res, { error: message, status: statusCode }, statusCode);
}

// ============================================================
// ОБРАБОТЧИК РЕЕСТРА (ПОЛНОСТЬЮ РАБОЧИЙ)
// ============================================================

export async function handleRegistryAPI(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // Если запрос на /api/registry/ — отдаём данные
        if (pathname === '/api/registry/' || pathname === '/api/registry') {
            // Сканируем папки проекта
            const apisDir = join(PROJECT_ROOT, 'apis/sources');
            const pagesDir = join(PROJECT_ROOT, 'dashboard/public');
            const collectorsDir = join(PROJECT_ROOT, 'scripts/collectors');
            const helpDir = join(PROJECT_ROOT, 'data/help/ru');

            // Фильтр личных файлов
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

            // Сканируем API
            let apiFiles = [];
            try {
                const files = await fs.readdir(apisDir);
                apiFiles = files
                    .filter(f => f.endsWith('.mjs'))
                    .filter(isOfficial)
                    .map(f => f.replace('.mjs', ''));
            } catch (e) {
                console.error('Ошибка сканирования API:', e.message);
            }

            // Сканируем страницы
            let pageFiles = [];
            try {
                const files = await fs.readdir(pagesDir);
                pageFiles = files
                    .filter(f => f.endsWith('.html'))
                    .filter(isOfficial)
                    .map(f => f.replace('.html', ''));
            } catch (e) {
                console.error('Ошибка сканирования страниц:', e.message);
            }

            // Сканируем сборщики
            let collectorFiles = [];
            try {
                const files = await fs.readdir(collectorsDir);
                collectorFiles = files
                    .filter(f => f.endsWith('.mjs'))
                    .filter(isOfficial)
                    .map(f => f.replace('.mjs', ''));
            } catch (e) {
                console.error('Ошибка сканирования сборщиков:', e.message);
            }

            // Сканируем справки
            let helpFiles = [];
            try {
                const files = await fs.readdir(helpDir);
                helpFiles = files
                    .filter(f => f.endsWith('.txt'))
                    .filter(isOfficial)
                    .map(f => f.replace('.txt', ''));
            } catch (e) {
                console.error('Ошибка сканирования справок:', e.message);
            }

            // Формируем ответ
            const data = {
                timestamp: new Date().toISOString(),
                api: {
                    total: apiFiles.length,
                    list: apiFiles
                },
                pages: {
                    total: pageFiles.length,
                    list: pageFiles
                },
                collectors: {
                    total: collectorFiles.length,
                    list: collectorFiles
                },
                help: {
                    total: helpFiles.length,
                    list: helpFiles
                },
                stats: {
                    total_components: apiFiles.length + pageFiles.length + collectorFiles.length,
                    total_with_help: helpFiles.length
                }
            };

            sendJSON(res, { success: true, data: data });
            return;
        }

        // Если запрос на /api/registry/status — отдаём краткий статус
        if (pathname === '/api/registry/status') {
            const apisDir = join(PROJECT_ROOT, 'apis/sources');
            const pagesDir = join(PROJECT_ROOT, 'dashboard/public');
            const collectorsDir = join(PROJECT_ROOT, 'scripts/collectors');

            let apiCount = 0, pageCount = 0, collectorCount = 0;
            try {
                apiCount = (await fs.readdir(apisDir)).filter(f => f.endsWith('.mjs') && !f.includes('(копия)')).length;
            } catch (e) {}
            try {
                pageCount = (await fs.readdir(pagesDir)).filter(f => f.endsWith('.html') && !f.includes('(копия)')).length;
            } catch (e) {}
            try {
                collectorCount = (await fs.readdir(collectorsDir)).filter(f => f.endsWith('.mjs') && !f.includes('(копия)')).length;
            } catch (e) {}

            sendJSON(res, {
                success: true,
                status: 'online',
                api: apiCount,
                pages: pageCount,
                collectors: collectorCount,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Если ничего не подошло — 404
        sendError(res, 'Registry endpoint not found', 404);
    } catch (error) {
        console.error('[Registry API] Ошибка:', error);
        sendError(res, 'Internal server error: ' + error.message, 500);
    }
}

// ============================================================
// ЭКСПОРТ ВСЕХ ОБРАБОТЧИКОВ (ДЛЯ СОВМЕСТИМОСТИ)
// ============================================================

export default {
    handleRegistryAPI
};
