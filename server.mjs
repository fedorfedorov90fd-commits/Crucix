#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix
// ============================================================
// HTTP-сервер на порту 3117
// Раздаёт статику из dashboard/public/
// Обрабатывает API-запросы
// Версия: 2.1.2
// ============================================================

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');

// ============================================================
// 1. ИМПОРТ API-МОДУЛЕЙ
// ============================================================

// RSS API
import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';

// Новости
import { handleNewsAPI } from './apis/sources/news-api.mjs';

// Корзина
import { handleBasketAPI } from './apis/sources/basket-api.mjs';

// AI Чат
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';

// AI Рейтинг
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';

// AI Анализатор
import { handleAIAnalyzerAPI } from './apis/sources/ai-news-analyzer.mjs';

// Хранилище
import { handleStorageAPI } from './apis/sources/storage-api.mjs';

// Геополитика
import { handleGeoAPI } from './apis/sources/geo-markers-api.mjs';

// Глобальный индекс (Модуль №5)
import { handleGlobalIndexAPI } from './apis/sources/global-index-api.mjs';

// Исторический анализ (Модуль №6)
import { handleHistoricalAnalysisAPI } from './apis/sources/historical-analysis-api.mjs';

// Кросс-корреляция (Модуль №7)
import { handleCorrelationAPI } from './apis/sources/correlation-api.mjs';

// Критическая инфраструктура (Модуль №8)
import { handleInfrastructureAPI } from './apis/sources/infrastructure-api.mjs';

// Критическая инфраструктура — EIA (энергетика)
import { handleEIAApi } from './apis/sources/infrastructure-eia.mjs';

// Критическая инфраструктура — FIRMS (пожары)
import { handleFIRMSApi } from './apis/sources/infrastructure-firms.mjs';

// Критическая инфраструктура — OFAC (санкции)
import { handleOFACApi } from './apis/sources/infrastructure-ofac.mjs';

// Критическая инфраструктура — Ships (порты)
import { handleShipsApi } from './apis/sources/infrastructure-ships.mjs';

// NewsAPI
import { handleNewsAPIProxy } from './apis/sources/newsapi.mjs';
import { handleNewsAPIBasket } from './apis/sources/newsapi-basket-integration.mjs';

// Спутниковый мониторинг (Модуль №9)
import { handleSatelliteAPI } from './apis/sources/satellite-api.mjs';

// ============================================================
// 2. MIME-ТИПЫ
// ============================================================

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
    '.opml': 'application/xml',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
};

// ============================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Отправить HTML-страницу
 */
async function sendHTML(res, filePath, statusCode = 200) {
    try {
        const fullPath = join(PUBLIC_DIR, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        res.writeHead(statusCode, { 'Content-Type': 'text/html' });
        res.end(content);
    } catch (error) {
        console.error(`[Server] Ошибка отправки HTML: ${error.message}`);
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
    }
}

/**
 * Отправить статический файл
 */
async function sendStaticFile(res, filePath) {
    try {
        const fullPath = join(PUBLIC_DIR, filePath);
        const content = await fs.readFile(fullPath);
        const ext = extname(filePath);
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
// 4. ОСНОВНОЙ ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // Логируем запрос
    logRequest(req, pathname);

    // ============================================================
    // 4.1. CORS (для всех ответов)
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
    // 4.2. МАРШРУТЫ API
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
        await handleAIAnalyzerAPI(req, res);
        return;
    }

    // --- Хранилище ---
    if (pathname.startsWith('/api/storage/')) {
        await handleStorageAPI(req, res);
        return;
    }

    // --- Геополитика ---
    if (pathname.startsWith('/api/geo/')) {
        await handleGeoAPI(req, res);
        return;
    }

    // --- Глобальный индекс (Модуль №5) ---
    if (pathname.startsWith('/api/geo/index')) {
        await handleGlobalIndexAPI(req, res);
        return;
    }

    // --- Исторический анализ (Модуль №6) ---
    if (pathname.startsWith('/api/analysis/')) {
        await handleHistoricalAnalysisAPI(req, res);
        return;
    }

    // --- Кросс-корреляция (Модуль №7) ---
    if (pathname.startsWith('/api/correlation/')) {
        await handleCorrelationAPI(req, res);
        return;
    }

    // --- Критическая инфраструктура — EIA (энергетика) ---
    if (pathname.startsWith('/api/infrastructure/eia/')) {
        await handleEIAApi(req, res);
        return;
    }

    // --- Критическая инфраструктура — FIRMS (пожары) ---
    if (pathname.startsWith('/api/infrastructure/firms/')) {
        await handleFIRMSApi(req, res);
        return;
    }

    // --- Критическая инфраструктура — OFAC (санкции) ---
    if (pathname.startsWith('/api/infrastructure/ofac/')) {
        await handleOFACApi(req, res);
        return;
    }

    // --- Критическая инфраструктура — Ships (порты) ---
    if (pathname.startsWith('/api/infrastructure/ships/')) {
        await handleShipsApi(req, res);
        return;
    }

    // --- Критическая инфраструктура (Модуль №8) - основной API ---
    if (pathname.startsWith('/api/infrastructure/')) {
        await handleInfrastructureAPI(req, res);
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

    // --- Спутниковый мониторинг (Модуль №9) ---
    if (pathname.startsWith('/api/satellite/')) {
        await handleSatelliteAPI(req, res);
        return;
    }

    // ============================================================
    // 4.3. МАРШРУТЫ СТРАНИЦ
    // ============================================================

    // --- Главная ---
    if (pathname === '/' || pathname === '/jarvis') {
        await sendHTML(res, 'jarvis.html');
        return;
    }

    // --- RSS Лента ---
    if (pathname === '/rss-feed' || pathname === '/rss-feed.html') {
        await sendHTML(res, 'rss-feed.html');
        return;
    }

    // --- RSS Управление ---
    if (pathname === '/rss-dashboard' || pathname === '/rss-dashboard.html') {
        await sendHTML(res, 'rss-dashboard.html');
        return;
    }

    // --- AI Чат ---
    if (pathname === '/ai-chat' || pathname === '/ai-chat.html') {
        await sendHTML(res, 'ai-chat.html');
        return;
    }

    // --- Геополитическая карта ---
    if (pathname === '/geo-map' || pathname === '/geo-map.html') {
        await sendHTML(res, 'geo-map.html');
        return;
    }

    // --- Корзина ---
    if (pathname === '/basket' || pathname === '/basket.html') {
        await sendHTML(res, 'basket.html');
        return;
    }

    // --- Инструмент "Сетка" ---
    if (pathname === '/grid-tool' || pathname === '/grid-tool.html') {
        await sendHTML(res, 'grid-tool.html');
        return;
    }

    // --- Глобальный индекс (Модуль №5) ---
    if (pathname === '/global-index' || pathname === '/global-index.html') {
        await sendHTML(res, 'global-index.html');
        return;
    }

    // --- Исторический анализ (Модуль №6) ---
    if (pathname === '/historical-analysis' || pathname === '/historical-analysis.html') {
        await sendHTML(res, 'historical-analysis.html');
        return;
    }

    // --- Кросс-корреляция (Модуль №7) ---
    if (pathname === '/correlation' || pathname === '/correlation.html') {
        await sendHTML(res, 'correlation.html');
        return;
    }

    // --- Критическая инфраструктура (Модуль №8) ---
    if (pathname === '/infrastructure' || pathname === '/infrastructure.html') {
        await sendHTML(res, 'infrastructure.html');
        return;
    }

    // --- Спутниковый мониторинг (Модуль №9) ---
    if (pathname === '/satellite' || pathname === '/satellite.html') {
        await sendHTML(res, 'satellite.html');
        return;
    }

    // ============================================================
    // 4.4. СТАТИЧЕСКИЕ ФАЙЛЫ
    // ============================================================

    if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
        await sendStaticFile(res, pathname);
        return;
    }

    if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ============================================================
    // 4.5. 404 — НЕ НАЙДЕНО
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
// 5. ЗАПУСК СЕРВЕРА
// ============================================================

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                          ║');
    console.log('║   🧠  CRUCIX — Open Source Intelligence Terminal                        ║');
    console.log('║                                                                          ║');
    console.log('║   Версия: 2.1.2                                                          ║');
    console.log('║   Порт:   ' + PORT + '                                                           ║');
    console.log('║                                                                          ║');
    console.log('║   🌐  http://localhost:' + PORT + '/                                     ║');
    console.log('║                                                                          ║');
    console.log('║   📋  ДОСТУПНЫЕ СТРАНИЦЫ:                                                ║');
    console.log('║   ├─ /                    — Главная (JARVIS)                            ║');
    console.log('║   ├─ /rss-feed            — RSS лента                                  ║');
    console.log('║   ├─ /rss-dashboard       — Управление RSS                             ║');
    console.log('║   ├─ /ai-chat             — AI помощник                                ║');
    console.log('║   ├─ /geo-map             — Геополитическая карта                      ║');
    console.log('║   ├─ /basket              — Корзина данных                             ║');
    console.log('║   ├─ /grid-tool           — Инструмент "Сетка"                         ║');
    console.log('║   ├─ /global-index        — Глобальный индекс (Модуль №5)              ║');
    console.log('║   ├─ /historical-analysis — Исторический анализ (Модуль №6)            ║');
    console.log('║   ├─ /correlation         — Кросс-корреляция (Модуль №7)               ║');
    console.log('║   ├─ /infrastructure      — Критическая инфраструктура (Модуль №8)     ║');
    console.log('║   └─ /satellite           — Спутниковый мониторинг (Модуль №9)         ║');
    console.log('║                                                                          ║');
    console.log('║   📡  API-ЭНДПОИНТЫ:                                                     ║');
    console.log('║   ├─ /api/rss/*            — RSS управление                             ║');
    console.log('║   ├─ /api/news/*           — Новости                                    ║');
    console.log('║   ├─ /api/basket/*         — Корзина                                    ║');
    console.log('║   ├─ /api/ai/*             — AI (чат/рейтинг/анализ)                   ║');
    console.log('║   ├─ /api/geo/*            — Геополитика                                ║');
    console.log('║   ├─ /api/geo/index        — Глобальный индекс (Модуль №5)              ║');
    console.log('║   ├─ /api/analysis/*       — Исторический анализ (Модуль №6)            ║');
    console.log('║   ├─ /api/correlation/*    — Кросс-корреляция (Модуль №7)               ║');
    console.log('║   ├─ /api/infrastructure/* — Критическая инфраструктура (Модуль №8)     ║');
    console.log('║   │   ├─ /api/infrastructure/eia/*    — Энергетика (EIA)               ║');
    console.log('║   │   ├─ /api/infrastructure/firms/*  — Пожары (FIRMS)                 ║');
    console.log('║   │   ├─ /api/infrastructure/ofac/*   — Санкции (OFAC)                 ║');
    console.log('║   │   └─ /api/infrastructure/ships/*  — Порты (Ships)                  ║');
    console.log('║   ├─ /api/satellite/*      — Спутниковый мониторинг (Модуль №9)         ║');
    console.log('║   └─ /api/newsapi/*        — NewsAPI                                    ║');
    console.log('║                                                                          ║');
    console.log('║   ✅  Сервер запущен и готов к работе!                                  ║');
    console.log('║                                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
});

// ============================================================
// 6. ОБРАБОТКА ОШИБОК
// ============================================================

process.on('uncaughtException', (error) => {
    console.error('[Server] Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[Server] Необработанный reject:', reason);
});

// ============================================================
// 7. ОБРАБОТКА ЗАВЕРШЕНИЯ
// ============================================================

process.on('SIGINT', () => {
    console.log('\n🛑 Сервер остановлен (Ctrl+C)');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Сервер остановлен (SIGTERM)');
    process.exit(0);
});

// ============================================================
// 8. ЭКСПОРТ (для тестов)
// ============================================================

export default server;
