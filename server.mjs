#!/usr/bin/env node

// ============================================================
// SERVER.MJS — Главный сервер Crucix
// ============================================================
// HTTP-сервер на порту 3117
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

// Военная авиация (Модуль №10)
import { handleAviationAPI } from './apis/sources/aviation-api.mjs';

// Морской трекинг (Модуль №11)
import { handleShippingAPI } from './apis/sources/shipping-api.mjs';

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

async function sendHTML(res, filePath, statusCode = 200) {
    try {
        const fullPath = join(PUBLIC_DIR, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        res.writeHead(statusCode, { 'Content-Type': 'text/html' });
        res.end(content);
    } catch (error) {
        console.error(`[Server] Ошибка отправки HTML: ${error.message}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 — Страница не найдена</h1>`);
    }
}

async function sendStaticFile(res, filePath) {
    try {
        const fullPath = join(PUBLIC_DIR, filePath);
        const content = await fs.readFile(fullPath);
        const ext = extname(filePath);
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    } catch (error) {
        res.writeHead(404);
        res.end();
    }
}

function logRequest(req, pathname) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);
}

// ============================================================
// 4. ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    logRequest(req, pathname);

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

    // --- AI ---
    if (pathname.startsWith('/api/ai/chat')) {
        await handleAIChatAPI(req, res);
        return;
    }
    if (pathname.startsWith('/api/ai/rate')) {
        await handleAIRatingAPI(req, res);
        return;
    }
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

    // --- Критическая инфраструктура (Модуль №8) ---
    if (pathname.startsWith('/api/infrastructure/eia/')) {
        await handleEIAApi(req, res);
        return;
    }
    if (pathname.startsWith('/api/infrastructure/firms/')) {
        await handleFIRMSApi(req, res);
        return;
    }
    if (pathname.startsWith('/api/infrastructure/ofac/')) {
        await handleOFACApi(req, res);
        return;
    }
    if (pathname.startsWith('/api/infrastructure/ships/')) {
        await handleShipsApi(req, res);
        return;
    }
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

    // --- Военная авиация (Модуль №10) ---
    if (pathname.startsWith('/api/aviation/')) {
        await handleAviationAPI(req, res);
        return;
    }

    // --- Морской трекинг (Модуль №11) ---
    if (pathname.startsWith('/api/shipping/')) {
        await handleShippingAPI(req, res);
        return;
    }

    // ============================================================
    // МАРШРУТЫ СТРАНИЦ
    // ============================================================

    if (pathname === '/' || pathname === '/jarvis') {
        await sendHTML(res, 'jarvis.html');
        return;
    }
    if (pathname === '/rss-feed' || pathname === '/rss-feed.html') {
        await sendHTML(res, 'rss-feed.html');
        return;
    }
    if (pathname === '/rss-dashboard' || pathname === '/rss-dashboard.html') {
        await sendHTML(res, 'rss-dashboard.html');
        return;
    }
    if (pathname === '/ai-chat' || pathname === '/ai-chat.html') {
        await sendHTML(res, 'ai-chat.html');
        return;
    }
    if (pathname === '/geo-map' || pathname === '/geo-map.html') {
        await sendHTML(res, 'geo-map.html');
        return;
    }
    if (pathname === '/basket' || pathname === '/basket.html') {
        await sendHTML(res, 'basket.html');
        return;
    }
    if (pathname === '/grid-tool' || pathname === '/grid-tool.html') {
        await sendHTML(res, 'grid-tool.html');
        return;
    }
    if (pathname === '/global-index' || pathname === '/global-index.html') {
        await sendHTML(res, 'global-index.html');
        return;
    }
    if (pathname === '/historical-analysis' || pathname === '/historical-analysis.html') {
        await sendHTML(res, 'historical-analysis.html');
        return;
    }
    if (pathname === '/correlation' || pathname === '/correlation.html') {
        await sendHTML(res, 'correlation.html');
        return;
    }
    if (pathname === '/infrastructure' || pathname === '/infrastructure.html') {
        await sendHTML(res, 'infrastructure.html');
        return;
    }
    if (pathname === '/satellite' || pathname === '/satellite.html') {
        await sendHTML(res, 'satellite.html');
        return;
    }
    if (pathname === '/aviation' || pathname === '/aviation.html') {
        await sendHTML(res, 'aviation.html');
        return;
    }
    if (pathname === '/shipping' || pathname === '/shipping.html') {
        await sendHTML(res, 'shipping.html');
        return;
    }

    // ============================================================
    // СТАТИЧЕСКИЕ ФАЙЛЫ
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
    // 404
    // ============================================================

    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`<h1>404 — Страница не найдена</h1>`);
});

// ============================================================
// 5. ЗАПУСК
// ============================================================

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║   🧠  CRUCIX — Open Source Intelligence Terminal                        ║');
    console.log('║   Версия: 2.1.2                                                          ║');
    console.log('║   Порт:   ' + PORT + '                                                           ║');
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
    console.log('║   ├─ /satellite           — Спутниковый мониторинг (Модуль №9)         ║');
    console.log('║   ├─ /aviation            — Военная авиация (Модуль №10)               ║');
    console.log('║   └─ /shipping            — Морской трекинг (Модуль №11)               ║');
    console.log('║                                                                          ║');
    console.log('║   📡  API-ЭНДПОИНТЫ:                                                     ║');
    console.log('║   ├─ /api/rss/*            — RSS управление                             ║');
    console.log('║   ├─ /api/news/*           — Новости                                    ║');
    console.log('║   ├─ /api/basket/*         — Корзина                                    ║');
    console.log('║   ├─ /api/ai/*             — AI                                         ║');
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
    console.log('║   ├─ /api/aviation/*       — Военная авиация (Модуль №10)               ║');
    console.log('║   ├─ /api/shipping/*       — Морской трекинг (Модуль №11)               ║');
    console.log('║   └─ /api/newsapi/*        — NewsAPI                                    ║');
    console.log('║                                                                          ║');
    console.log('║   ✅  Сервер запущен и готов к работе!                                  ║');
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

process.on('SIGINT', () => {
    console.log('\n🛑 Сервер остановлен');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Сервер остановлен (SIGTERM)');
    process.exit(0);
});

export default server;
