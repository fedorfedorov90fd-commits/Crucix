/**
 * CRUCIX — Open Source Intelligence Terminal
 * Главный сервер
 * Версия: 2.1.1
 * Порт: 3117
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'url';

// ============================================================
// ИМПОРТЫ API-МОДУЛЕЙ
// ============================================================

// RSS
import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';

// Новости
import { handleNewsAPI } from './apis/sources/news-api.mjs';

// Корзина
import { handleBasketAPI } from './apis/sources/basket-api.mjs';

// AI
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';
import { handleAIAnalyzer } from './apis/sources/ai-news-analyzer.mjs';

// Хранилище
import { handleStorageAPI } from './apis/sources/storage-api.mjs';

// Геополитика
import { handleGeoMarkersAPI } from './apis/sources/geo-markers-api.mjs';

// Глобальный индекс (Модуль №5)
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';

// Исторический анализ (Модуль №6)
import { handleHistoricalAnalysisAPI } from './apis/sources/historical-analysis-api.mjs';

// События для шкалы (Модуль №6, профессиональный)
import { handleAnalysisEventsAPI } from './apis/sources/analysis-events-api.mjs';

// NewsAPI
import { handleNewsAPI as handleNewsAPIProxy } from './apis/sources/newsapi.mjs';
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';

// ============================================================
// КОНСТАНТЫ
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3117;
const PUBLIC_DIR = path.join(__dirname, 'dashboard/public');

// MIME-типы
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf'
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Отправить HTML-страницу
 */
async function sendHTML(res, filePath, statusCode = 200) {
    try {
        const fullPath = path.join(PUBLIC_DIR, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        res.writeHead(statusCode, { 'Content-Type': 'text/html' });
        res.end(content);
    } catch (error) {
        console.error(`[Server] Ошибка отправки HTML: ${error.message}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 — Страница не найдена</h1>');
    }
}

/**
 * Отправить статический файл
 */
async function sendStaticFile(res, filePath) {
    try {
        const fullPath = path.join(PUBLIC_DIR, filePath);
        const content = await fs.readFile(fullPath);
        const ext = path.extname(filePath);
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    } catch (error) {
        console.error(`[Server] Ошибка отправки статики: ${error.message}`);
        res.writeHead(404);
        res.end();
    }
}

/**
 * Логирование запросов
 */
function logRequest(req, pathname) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${pathname}`);
}

// ============================================================
// ОСНОВНОЙ ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================

const server = http.createServer(async (req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';
    const method = req.method || 'GET';

    // Логируем запрос
    logRequest(req, pathname);

    // ============================================================
    // CORS (для всех ответов)
    // ============================================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ============================================================
    // МАРШРУТЫ API
    // ============================================================

    // --- RSS ---
    if (pathname.startsWith('/api/rss/')) {
        await handleRSSAPI(req, res);
        return;
    }

    // --- Новости ---
    if (pathname.startsWith('/api/news/')) {
        await handleNewsAPI(req, res);
        return;
    }

    // --- Корзина ---
    if (pathname.startsWith('/api/basket')) {
        await handleBasketAPI(req, res);
        return;
    }

    // --- AI Чат ---
    if (pathname.startsWith('/api/ai/chat')) {
        await handleAIChatAPI(req, res);
        return;
    }

    // --- AI Рейтинг ---
    if (pathname.startsWith('/api/ai/rate')) {
        await handleAIRatingAPI(req, res);
        return;
    }

    // --- AI Анализатор ---
    if (pathname.startsWith('/api/ai/analyze')) {
        await handleAIAnalyzer(req, res);
        return;
    }

    // --- Хранилище ---
    if (pathname.startsWith('/api/storage/')) {
        await handleStorageAPI(req, res);
        return;
    }

    // --- Геополитика ---
    if (pathname.startsWith('/api/geo/')) {
        await handleGeoMarkersAPI(req, res);
        return;
    }

    // --- Глобальный индекс (Модуль №5) ---
    if (pathname.startsWith('/api/geo/index')) {
        await handleGlobalIndexAPI(req, res);
        return;
    }

    // --- Исторический анализ (Модуль №6) ---
    if (pathname.startsWith('/api/analysis/')) {
        // Сначала проверяем events (более конкретный путь)
        if (pathname === '/api/analysis/events') {
            await handleAnalysisEventsAPI(req, res);
            return;
        }
        // Остальные пути analysis
        await handleHistoricalAnalysisAPI(req, res);
        return;
    }

    // --- NewsAPI ---
    if (pathname.startsWith('/api/newsapi/')) {
        if (pathname === '/api/newsapi/basket') {
            await handleNewsAPIBasket(req, res);
        } else {
            await handleNewsAPIProxy(req, res);
        }
        return;
    }

    // ============================================================
    // МАРШРУТЫ СТРАНИЦ
    // ============================================================

    // --- Главная ---
    if (pathname === '/' || pathname === '/jarvis') {
        await sendHTML(res, 'jarvis.html');
        return;
    }

    // --- RSS Лента ---
    if (pathname === '/rss-feed') {
        await sendHTML(res, 'rss-feed.html');
        return;
    }

    // --- RSS Управление ---
    if (pathname === '/rss-dashboard') {
        await sendHTML(res, 'rss-dashboard.html');
        return;
    }

    // --- AI Чат ---
    if (pathname === '/ai-chat') {
        await sendHTML(res, 'ai-chat.html');
        return;
    }

    // --- Геополитическая карта ---
    if (pathname === '/geo-map') {
        await sendHTML(res, 'geo-map.html');
        return;
    }

    // --- Корзина ---
    if (pathname === '/basket') {
        await sendHTML(res, 'basket.html');
        return;
    }

    // --- Инструмент "Сетка" ---
    if (pathname === '/grid-tool') {
        await sendHTML(res, 'grid-tool.html');
        return;
    }

    // --- Глобальный индекс (Модуль №5) ---
    if (pathname === '/global-index') {
        await sendHTML(res, 'global-index.html');
        return;
    }

    // --- Исторический анализ (Модуль №6) ---
    if (pathname === '/historical-analysis') {
        await sendHTML(res, 'historical-analysis.html');
        return;
    }

    // ============================================================
    // СТАТИЧЕСКИЕ ФАЙЛЫ
    // ============================================================

    if (pathname.startsWith('/css/')) {
        await sendStaticFile(res, pathname);
        return;
    }

    if (pathname.startsWith('/js/')) {
        await sendStaticFile(res, pathname);
        return;
    }

    if (pathname.startsWith('/images/')) {
        await sendStaticFile(res, pathname);
        return;
    }

    if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ============================================================
    // 404 — НЕ НАЙДЕНО
    // ============================================================

    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 — Страница не найдена</title></head>
        <body style="background:#0a0e17;color:#e0e0e0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;flex-direction:column;">
            <h1 style="font-size:72px;margin:0;background:linear-gradient(135deg,#ff6b6b,#4ecdc4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">404</h1>
            <p style="font-size:20px;color:#8899aa;">Страница не найдена</p>
            <a href="/" style="color:#4ecdc4;text-decoration:none;margin-top:20px;padding:10px 30px;border:1px solid #4ecdc4;border-radius:6px;">← На главную</a>
        </body>
        </html>
    `);
});

// ============================================================
// ЗАПУСК СЕРВЕРА
// ============================================================

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║   🧠  CRUCIX — Open Source Intelligence Terminal       ║');
    console.log('║                                                          ║');
    console.log('║   Версия: 2.1.1                                         ║');
    console.log('║   Порт:   ' + PORT + '                                          ║');
    console.log('║                                                          ║');
    console.log('║   🌐  http://localhost:' + PORT + '/                            ║');
    console.log('║                                                          ║');
    console.log('║   📋  Доступные страницы:                               ║');
    console.log('║   ├─ /              — Главная (JARVIS)                  ║');
    console.log('║   ├─ /rss-feed      — RSS лента                        ║');
    console.log('║   ├─ /rss-dashboard — Управление RSS                   ║');
    console.log('║   ├─ /ai-chat       — AI помощник                      ║');
    console.log('║   ├─ /geo-map       — Геополитическая карта            ║');
    console.log('║   ├─ /basket        — Корзина данных                   ║');
    console.log('║   ├─ /grid-tool     — Инструмент "Сетка"               ║');
    console.log('║   ├─ /global-index  — Глобальный индекс (Модуль №5)    ║');
    console.log('║   └─ /historical-analysis — Исторический анализ (Модуль №6) ║');
    console.log('║                                                          ║');
    console.log('║   📡  API-эндпоинты:                                   ║');
    console.log('║   ├─ /api/rss/*            — RSS управление            ║');
    console.log('║   ├─ /api/news/*           — Новости                   ║');
    console.log('║   ├─ /api/basket/*         — Корзина                   ║');
    console.log('║   ├─ /api/ai/*             — AI (чат/рейтинг/анализ)  ║');
    console.log('║   ├─ /api/geo/*            — Геополитика               ║');
    console.log('║   ├─ /api/geo/index        — Глобальный индекс         ║');
    console.log('║   ├─ /api/analysis/*       — Исторический анализ       ║');
    console.log('║   ├─ /api/analysis/events  — События (проф. шкала)    ║');
    console.log('║   └─ /api/newsapi/*        — NewsAPI                   ║');
    console.log('║                                                          ║');
    console.log('║   ✅  Сервер запущен и готов к работе!                 ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});

// ============================================================
// ОБРАБОТКА ОШИБОК
// ============================================================

process.on('uncaughtException', (error) => {
    console.error('[Server] Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[Server] Необработанный reject:', reason);
});

// ============================================================
// ЭКСПОРТ (для тестов)
// ============================================================

export default server;
