// ============================================================
// UNIQUE INDICATORS — "Пицца Пентагона" и "Такси в Лэнгли"
// Уникальные/косвенные индикаторы для Crucix
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_PATH = '/home/ta8_/Рабочий стол/Crucix/data/basket/';

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function loadBasketFile(filename) {
    const filePath = join(BASKET_PATH, filename);
    if (!existsSync(filePath)) return null;
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

function getCurrentValue(data) {
    if (!data || !data.length) return null;
    return data[data.length - 1];
}

function getStatus(value, thresholds) {
    if (value === null || value === undefined) return 'unknown';
    if (thresholds.critical && value >= thresholds.critical) return 'critical';
    if (thresholds.warning && value >= thresholds.warning) return 'warning';
    return 'normal';
}

// ============================================================
// 2. API-ОБРАБОТЧИК
// ============================================================

export async function handleUniqueIndicators(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // === ПИЦЦА ПЕНТАГОНА ===
    if (pathname === '/api/unique/pentagon-pizza' || pathname === '/api/unique/pentagon-pizza/' ||
        pathname === '/api/indirect/pentagon-pizza' || pathname === '/api/indirect/pentagon-pizza/') {
        const data = loadBasketFile('pentagon-pizza.json');
        const current = getCurrentValue(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            indicator: 'pentagon-pizza',
            name: 'Индекс "Пицца Пентагона"',
            description: 'Рост заказов пиццы в районе Пентагона — признак подготовки к операции',
            current: current || null,
            history: data || [],
            timestamp: new Date().toISOString(),
            source: 'Google Maps / Yelp',
            location: {
                name: 'Пентагон, Арлингтон, Вирджиния',
                lat: 38.8719,
                lon: -77.0563,
                radius: '5 км'
            },
            thresholds: {
                normal: '< 50',
                warning: '50-100',
                critical: '> 100'
            }
        }));
        return true;
    }

    // === ТАКСИ В ЛЭНГЛИ ===
    if (pathname === '/api/unique/langley-taxis' || pathname === '/api/unique/langley-taxis/' ||
        pathname === '/api/indirect/langley-taxis' || pathname === '/api/indirect/langley-taxis/') {
        const data = loadBasketFile('langley-taxis.json');
        const current = getCurrentValue(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            indicator: 'langley-taxis',
            name: 'Индекс "Такси в Лэнгли"',
            description: 'Рост заказов такси в районе штаб-квартиры ЦРУ — признак экстренного совещания',
            current: current || null,
            history: data || [],
            timestamp: new Date().toISOString(),
            source: 'Uber / Lyft / Google Maps',
            location: {
                name: 'Лэнгли, Вирджиния (штаб-квартира ЦРУ)',
                lat: 38.9519,
                lon: -77.1467,
                radius: '5 км'
            },
            thresholds: {
                normal: '< 20',
                warning: '20-50',
                critical: '> 50'
            }
        }));
        return true;
    }

    // === СТАТУС МОДУЛЯ ===
    if (pathname === '/api/unique/status' || pathname === '/api/unique/' ||
        pathname === '/api/indirect/status' || pathname === '/api/indirect/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            module: 'unique-indicators',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            indicators: [
                { id: 'pentagon-pizza', name: 'Индекс "Пицца Пентагона"', active: true },
                { id: 'langley-taxis', name: 'Индекс "Такси в Лэнгли"', active: true }
            ]
        }));
        return true;
    }

    // === ОБЪЕДИНЁННЫЙ ДАШБОРД ===
    if (pathname === '/api/unique/all' || pathname === '/api/indirect/all') {
        const pizza = loadBasketFile('pentagon-pizza.json');
        const taxis = loadBasketFile('langley-taxis.json');
        const pizzaCurrent = getCurrentValue(pizza);
        const taxiCurrent = getCurrentValue(taxis);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            indicators: {
                'pentagon-pizza': {
                    name: 'Индекс "Пицца Пентагона"',
                    subtitle: 'активность вокруг Пентагона',
                    value: pizzaCurrent?.value || null,
                    status: getStatus(pizzaCurrent?.value, { normal: 50, warning: 50, critical: 100 }),
                    trend: pizzaCurrent?.trend || 'stable',
                    lastUpdate: pizzaCurrent?.timestamp || null,
                    thresholds: { normal: '< 50', warning: '50-100', critical: '> 100' }
                },
                'langley-taxis': {
                    name: 'Индекс "Такси в Лэнгли"',
                    subtitle: 'активность вокруг ЦРУ',
                    value: taxiCurrent?.value || null,
                    status: getStatus(taxiCurrent?.value, { normal: 20, warning: 20, critical: 50 }),
                    trend: taxiCurrent?.trend || 'stable',
                    lastUpdate: taxiCurrent?.timestamp || null,
                    thresholds: { normal: '< 20', warning: '20-50', critical: '> 50' }
                }
            }
        }));
        return true;
    }

    return false;
}

export default { handleUniqueIndicators };
