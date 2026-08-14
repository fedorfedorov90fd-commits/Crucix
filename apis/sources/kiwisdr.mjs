#!/usr/bin/env node

// ============================================================
// KIIWISDR — РАДИОМОНИТОРИНГ
// ============================================================
// Источник: KiwiSDR API
// Данные: доступные SDR-приёмники по всему миру
// Обновление: ежедневно
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const KIIWISDR_API = 'https://kiwisdr.com/public';

// Горячие регионы для мониторинга
const REGIONS = [
    { name: 'Ближний Восток', lat: 30, lng: 45, radius: 20 },
    { name: 'Украина', lat: 49, lng: 31, radius: 10 },
    { name: 'Южно-Китайское море', lat: 18, lng: 114, radius: 15 },
    { name: 'Балтийский регион', lat: 55, lng: 24, radius: 10 }
];

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchSDR() {
    try {
        console.log('[KiwiSDR] Запрос данных о SDR-приёмниках...');

        const receivers = [];

        for (const region of REGIONS) {
            try {
                const data = await fetchRegionSDR(region);
                receivers.push(...data);
            } catch (e) {
                console.warn(`[KiwiSDR] Ошибка для региона ${region.name}:`, e.message);
            }
        }

        // Убираем дубликаты
        const unique = [];
        const seen = new Set();
        for (const r of receivers) {
            if (!seen.has(r.id)) {
                seen.add(r.id);
                unique.push(r);
            }
        }

        const summary = getSDRSummary(unique);

        console.log(`[KiwiSDR] Найдено ${unique.length} приёмников`);

        return {
            success: true,
            count: unique.length,
            receivers: unique.slice(0, 50),
            summary: summary,
            source: 'KiwiSDR',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[KiwiSDR] Ошибка:', error.message);
        return getDemoSDR();
    }
}

// ============================================================
// 3. ЗАПРОС ПО РЕГИОНУ
// ============================================================

async function fetchRegionSDR(region) {
    try {
        const url = `${KIIWISDR_API}/?lat=${region.lat}&lng=${region.lng}&radius=${region.radius}`;
        const response = await fetchWithRetry(url, { timeout: 10000 });
        const text = await response.text();

        // Простой парсинг HTML (в реальности лучше использовать API)
        const receivers = [];
        const matches = text.match(/<div class="receiver">([\s\S]*?)<\/div>/g) || [];

        for (const match of matches) {
            const nameMatch = match.match(/<h3>(.*?)<\/h3>/);
            const latMatch = match.match(/lat: (\d+\.\d+)/);
            const lngMatch = match.match(/lng: (\d+\.\d+)/);
            const statusMatch = match.match(/status.*?(\w+)/);

            if (nameMatch) {
                receivers.push({
                    id: `kiwi-${receivers.length + 1}`,
                    name: nameMatch[1] || 'Unknown',
                    lat: latMatch ? parseFloat(latMatch[1]) : null,
                    lng: lngMatch ? parseFloat(lngMatch[1]) : null,
                    status: statusMatch ? statusMatch[1] : 'unknown',
                    region: region.name,
                    url: 'https://kiwisdr.com/public'
                });
            }
        }

        return receivers;
    } catch (error) {
        console.warn(`[KiwiSDR] Ошибка парсинга:`, error.message);
        return getDemoReceivers(region);
    }
}

// ============================================================
// 4. ДЕМО-ДАННЫЕ ДЛЯ РЕГИОНА
// ============================================================

function getDemoReceivers(region) {
    const names = ['SDR-1', 'SDR-2', 'SDR-3', 'RX-001', 'RX-002'];
    const statuses = ['online', 'online', 'offline', 'online', 'online'];

    return names.map((name, i) => ({
        id: `demo-${region.name}-${i}`,
        name: `${name} (${region.name})`,
        lat: region.lat + (Math.random() - 0.5) * 2,
        lng: region.lng + (Math.random() - 0.5) * 2,
        status: statuses[i % statuses.length],
        region: region.name,
        url: 'https://kiwisdr.com/public',
        isDemo: true
    }));
}

// ============================================================
// 5. СТАТИСТИКА
// ============================================================

function getSDRSummary(receivers) {
    const summary = {
        total: receivers.length,
        byRegion: {},
        byStatus: { online: 0, offline: 0, unknown: 0 }
    };

    for (const r of receivers) {
        const region = r.region || 'unknown';
        summary.byRegion[region] = (summary.byRegion[region] || 0) + 1;

        const status = r.status || 'unknown';
        if (summary.byStatus[status] !== undefined) {
            summary.byStatus[status]++;
        }
    }

    return summary;
}

// ============================================================
// 6. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoSDR() {
    const receivers = [];
    const regions = ['Ближний Восток', 'Украина', 'Южно-Китайское море', 'Балтийский регион'];
    const statuses = ['online', 'online', 'offline', 'online', 'online'];

    for (let i = 0; i < 15; i++) {
        const region = regions[i % regions.length];
        receivers.push({
            id: `demo-sdr-${i}`,
            name: `SDR-${i + 1} (${region})`,
            lat: 30 + (Math.random() - 0.5) * 20,
            lng: 45 + (Math.random() - 0.5) * 20,
            status: statuses[i % statuses.length],
            region: region,
            url: 'https://kiwisdr.com/public',
            isDemo: true
        });
    }

    return {
        success: true,
        count: receivers.length,
        receivers: receivers,
        summary: getSDRSummary(receivers),
        source: 'DEMO (KiwiSDR)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 7. API-ОБРАБОТЧИК
// ============================================================

export async function handleKiwiSDRApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        if (path === '/api/kiwisdr/receivers' && req.method === 'GET') {
            const data = await fetchSDR();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        if (path === '/api/kiwisdr/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'KiwiSDR',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[KiwiSDR API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default {
    fetchSDR,
    handleKiwiSDRApi
};
