#!/usr/bin/env node

// ============================================================
// SHIPS — МОРСКОЙ ТРЕКИНГ (AIS)
// ============================================================
// Источник: AISStream / MarineTraffic (бесплатный API)
// Данные: позиции судов в реальном времени, порты
// Обновление: каждые 5-10 минут
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// AISStream API (бесплатный, нужен ключ)
const AISSTREAM_API = 'https://api.aisstream.io/v1';

// Горячие регионы для мониторинга (порты)
const HOTSPOT_REGIONS = [
    { name: 'Сингапур', lat: 1.3521, lng: 103.8198, radius: 2 },
    { name: 'Шанхай', lat: 30.6189, lng: 121.9874, radius: 2 },
    { name: 'Роттердам', lat: 51.9225, lng: 4.4792, radius: 1.5 },
    { name: 'Хьюстон', lat: 29.7604, lng: -95.3698, radius: 1.5 },
    { name: 'Одесса', lat: 46.4825, lng: 30.7233, radius: 1 },
    { name: 'Мариуполь', lat: 47.0975, lng: 37.5433, radius: 0.5 },
    { name: 'Стамбул', lat: 41.0082, lng: 28.9784, radius: 1 },
    { name: 'Дубай', lat: 25.2048, lng: 55.2708, radius: 1.5 },
    { name: 'Лос-Анджелес', lat: 33.7289, lng: -118.2336, radius: 1.5 },
    { name: 'Гонконг', lat: 22.3193, lng: 114.1694, radius: 1.5 }
];

// Типы судов
const VESSEL_TYPES = {
    'Cargo': 'Грузовое',
    'Tanker': 'Танкер',
    'Passenger': 'Пассажирское',
    'Fishing': 'Рыболовецкое',
    'Military': 'Военное',
    'Pleasure': 'Прогулочное',
    'Tug': 'Буксир',
    'Unknown': 'Неизвестно'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получить данные о судах в реальном времени
 * 
 * @param {Object} options
 * @param {number} options.lat - Широта центра
 * @param {number} options.lng - Долгота центра
 * @param {number} options.radius - Радиус в градусах
 * @param {string} options.type - Тип судна (опционально)
 * @returns {Promise<Object>} Данные о судах
 */
export async function fetchShips(options = {}) {
    const {
        lat = null,
        lng = null,
        radius = 5,
        type = null
    } = options;

    const apiKey = process.env.AISSTREAM_API_KEY || '';

    // Проверка API ключа
    if (!apiKey) {
        console.warn('[Ships] API ключ не найден. Установите AISSTREAM_API_KEY в .env');
        return getDemoData();
    }

    try {
        console.log('[Ships] Запрос данных о судах...');

        // Если заданы координаты — запрашиваем по области
        if (lat !== null && lng !== null) {
            const url = `${AISSTREAM_API}/vessels?lat=${lat}&lng=${lng}&radius=${radius}`;
            const response = await fetchWithRetry(url, {
                headers: { 'x-api-key': apiKey }
            }, 3, 10000);
            const data = await response.json();
            const vessels = data.vessels || [];
            
            return {
                success: true,
                count: vessels.length,
                vessels: vessels.map(v => parseVessel(v)),
                hotspots: analyzeHotspots(vessels),
                anomalies: detectAnomalies(vessels),
                summary: getSummary(vessels),
                source: 'AISStream',
                timestamp: new Date().toISOString()
            };
        }

        // Если координат нет — загружаем по горячим регионам
        const allVessels = [];
        for (const region of HOTSPOT_REGIONS) {
            try {
                const url = `${AISSTREAM_API}/vessels?lat=${region.lat}&lng=${region.lng}&radius=${region.radius}`;
                const response = await fetchWithRetry(url, {
                    headers: { 'x-api-key': apiKey }
                }, 2, 8000);
                const data = await response.json();
                
                if (data.vessels) {
                    allVessels.push(...data.vessels);
                }
            } catch (e) {
                console.warn(`[Ships] Ошибка в регионе ${region.name}:`, e.message);
            }
        }

        // Убираем дубликаты по MMSI
        const uniqueVessels = [];
        const seen = new Set();
        for (const v of allVessels) {
            if (!seen.has(v.mmsi)) {
                seen.add(v.mmsi);
                uniqueVessels.push(v);
            }
        }

        // Фильтр по типу
        let filtered = uniqueVessels;
        if (type) {
            filtered = uniqueVessels.filter(v => v.ship_type === type);
        }

        console.log(`[Ships] Найдено ${filtered.length} судов`);

        return {
            success: true,
            count: filtered.length,
            vessels: filtered.map(v => parseVessel(v)),
            hotspots: analyzeHotspots(filtered),
            anomalies: detectAnomalies(filtered),
            summary: getSummary(filtered),
            source: 'AISStream',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[Ships] Ошибка:', error.message);
        console.warn('[Ships] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ОБРАБОТКА ОДНОГО СУДНА
// ============================================================

function parseVessel(vessel) {
    return {
        id: vessel.mmsi || `ship_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mmsi: vessel.mmsi || null,
        name: vessel.name || 'Неизвестно',
        type: vessel.ship_type || 'Unknown',
        typeLabel: VESSEL_TYPES[vessel.ship_type] || 'Неизвестно',
        lat: vessel.lat || null,
        lng: vessel.lng || null,
        speed: vessel.speed || 0,
        heading: vessel.heading || 0,
        course: vessel.course || 0,
        destination: vessel.destination || null,
        eta: vessel.eta || null,
        length: vessel.length || null,
        width: vessel.width || null,
        draught: vessel.draught || null,
        callSign: vessel.callSign || null,
        flag: vessel.flag || null,
        status: vessel.status || 'Under way',
        lastUpdate: vessel.timestamp || new Date().toISOString(),
        isDark: detectDarkShip(vessel)
    };
}

// ============================================================
// 4. ДЕТЕКТОР "ТЁМНЫХ" СУДОВ
// ============================================================

function detectDarkShip(vessel) {
    // Признаки "тёмного" судна:
    // 1. Выключенный AIS (нет позиции)
    // 2. Странный маршрут
    // 3. Изменение названия
    // 4. Нет назначения
    
    let score = 0;
    const reasons = [];

    if (!vessel.name || vessel.name === 'Unknown' || vessel.name === '---') {
        score += 0.3;
        reasons.push('Нет названия');
    }
    if (!vessel.destination || vessel.destination === '---') {
        score += 0.2;
        reasons.push('Нет назначения');
    }
    if (vessel.speed < 0.5 && vessel.status === 'Under way') {
        score += 0.2;
        reasons.push('Стоит с включенным двигателем');
    }
    if (!vessel.flag || vessel.flag === '---') {
        score += 0.15;
        reasons.push('Нет флага');
    }
    if (!vessel.callSign || vessel.callSign === '---') {
        score += 0.15;
        reasons.push('Нет позывного');
    }

    return {
        isDark: score > 0.5,
        score: Math.round(score * 100),
        reasons: reasons
    };
}

// ============================================================
// 5. АНАЛИЗ ГОРЯЧИХ ТОЧЕК (ПОРТОВАЯ АКТИВНОСТЬ)
// ============================================================

function analyzeHotspots(vessels) {
    if (!vessels || vessels.length === 0) return [];

    const portActivity = {};

    for (const v of vessels) {
        if (!v.destination || v.destination === '---') continue;
        
        const port = v.destination;
        if (!portActivity[port]) {
            portActivity[port] = {
                name: port,
                count: 0,
                types: {}
            };
        }
        portActivity[port].count++;
        
        const type = v.ship_type || 'Unknown';
        portActivity[port].types[type] = (portActivity[port].types[type] || 0) + 1;
    }

    return Object.values(portActivity)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(p => ({
            port: p.name,
            vessels: p.count,
            types: p.types,
            intensity: p.count > 10 ? 'critical' : p.count > 5 ? 'high' : 'medium'
        }));
}

// ============================================================
// 6. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectAnomalies(vessels) {
    const anomalies = [];

    // 1. "Тёмные" суда
    const darkShips = vessels.filter(v => detectDarkShip(v).isDark);
    if (darkShips.length > 3) {
        anomalies.push({
            type: 'dark_ships',
            severity: 'high',
            count: darkShips.length,
            description: `Обнаружено ${darkShips.length} "тёмных" судов`,
            examples: darkShips.slice(0, 5).map(v => v.name || v.mmsi).join(', ')
        });
    }

    // 2. Суда в запрещённых зонах
    const restrictedZones = [
        { name: 'Черное море', latMin: 42, latMax: 47, lngMin: 28, lngMax: 40 },
        { name: 'Ормузский пролив', latMin: 26, latMax: 27.5, lngMin: 55, lngMax: 57 },
        { name: 'Тайваньский пролив', latMin: 22, latMax: 26, lngMin: 119, lngMax: 122 }
    ];

    for (const zone of restrictedZones) {
        const inZone = vessels.filter(v => 
            v.lat >= zone.latMin && v.lat <= zone.latMax &&
            v.lng >= zone.lngMin && v.lng <= zone.lngMax
        );
        if (inZone.length > 5) {
            anomalies.push({
                type: 'restricted_zone',
                severity: 'critical',
                count: inZone.length,
                description: `${inZone.length} судов в зоне: ${zone.name}`,
                examples: inZone.slice(0, 5).map(v => v.name || v.mmsi).join(', ')
            });
        }
    }

    // 3. Необычная скорость (слишком медленно или слишком быстро)
    const highSpeed = vessels.filter(v => v.speed > 30);
    if (highSpeed.length > 2) {
        anomalies.push({
            type: 'high_speed',
            severity: 'medium',
            count: highSpeed.length,
            description: `${highSpeed.length} судов с аномальной скоростью (>30 узлов)`,
            examples: highSpeed.slice(0, 3).map(v => `${v.name || v.mmsi} (${v.speed} узлов)`).join(', ')
        });
    }

    return anomalies;
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getSummary(vessels) {
    const summary = {
        total: vessels.length,
        byType: {},
        byFlag: {},
        darkShips: 0,
        averageSpeed: 0,
        totalSpeed: 0
    };

    if (vessels.length === 0) return summary;

    for (const v of vessels) {
        const type = v.ship_type || 'Unknown';
        summary.byType[type] = (summary.byType[type] || 0) + 1;

        const flag = v.flag || 'Unknown';
        summary.byFlag[flag] = (summary.byFlag[flag] || 0) + 1;

        if (detectDarkShip(v).isDark) summary.darkShips++;

        summary.totalSpeed += v.speed || 0;
    }

    summary.averageSpeed = Math.round((summary.totalSpeed / vessels.length) * 10) / 10;

    return summary;
}

// ============================================================
// 8. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const demoTimestamp = new Date().toISOString();

    const demoVessels = [
        { mmsi: '123456789', name: 'Ever Given', type: 'Cargo', lat: 30.5, lng: 32.0, speed: 8.5, heading: 180, destination: 'Port Said', flag: 'Panama', callSign: '3ECU4', status: 'Under way', length: 400, width: 59, draught: 15.2 },
        { mmsi: '987654321', name: 'MSC Oscar', type: 'Cargo', lat: 25.3, lng: 55.5, speed: 12.3, heading: 90, destination: 'Dubai', flag: 'Liberia', callSign: 'A8JX7', status: 'Under way', length: 395, width: 59, draught: 14.5 },
        { mmsi: '456789123', name: 'Tanker-1', type: 'Tanker', lat: 26.5, lng: 56.0, speed: 6.2, heading: 270, destination: 'Oman', flag: 'Marshall Islands', callSign: 'V7XX2', status: 'Under way', length: 330, width: 60, draught: 20.0 },
        { mmsi: '789123456', name: 'Fishing-1', type: 'Fishing', lat: 30.0, lng: 33.0, speed: 3.1, heading: 45, destination: '---', flag: 'Egypt', callSign: '---', status: 'Under way', length: 25, width: 8, draught: 2.5 },
        { mmsi: '321654987', name: 'DarkShip-1', type: 'Unknown', lat: 30.8, lng: 31.5, speed: 2.0, heading: 0, destination: '---', flag: '---', callSign: '---', status: 'Under way', length: 100, width: 20, draught: 8.0 },
        { mmsi: '654987321', name: 'Container-1', type: 'Cargo', lat: 22.5, lng: 120.0, speed: 15.8, heading: 135, destination: 'Kaohsiung', flag: 'Taiwan', callSign: 'BLXR9', status: 'Under way', length: 366, width: 48, draught: 12.8 },
        { mmsi: '147258369', name: 'Oil-Tanker', type: 'Tanker', lat: 26.0, lng: 56.5, speed: 7.5, heading: 180, destination: 'Fujairah', flag: 'Liberia', callSign: '5LZQ3', status: 'Under way', length: 332, width: 58, draught: 19.5 },
        { mmsi: '258369147', name: 'Cruise-1', type: 'Passenger', lat: 25.0, lng: 58.0, speed: 14.2, heading: 90, destination: 'Muscat', flag: 'Bahamas', callSign: 'C6ES4', status: 'Under way', length: 315, width: 36, draught: 8.5 },
        { mmsi: '369147258', name: 'DarkShip-2', type: 'Unknown', lat: 30.5, lng: 32.5, speed: 1.5, heading: 0, destination: '---', flag: '---', callSign: '---', status: 'At anchor', length: 80, width: 15, draught: 6.0 },
        { mmsi: '741852963', name: 'Tug-1', type: 'Tug', lat: 31.0, lng: 32.0, speed: 4.5, heading: 45, destination: 'Port Said', flag: 'Egypt', callSign: '6ADS3', status: 'Under way', length: 35, width: 12, draught: 3.2 },
        { mmsi: '852963741', name: 'Military-1', type: 'Military', lat: 28.5, lng: 56.0, speed: 18.0, heading: 270, destination: '---', flag: 'US', callSign: 'N/A', status: 'Under way', length: 150, width: 20, draught: 7.0 },
        { mmsi: '963741852', name: 'LNG-Carrier', type: 'Tanker', lat: 25.8, lng: 57.0, speed: 10.2, heading: 180, destination: 'Qatar', flag: 'Qatar', callSign: 'A7DL8', status: 'Under way', length: 345, width: 55, draught: 18.0 }
    ];

    const summary = {
        total: demoVessels.length,
        byType: { Cargo: 3, Tanker: 3, Fishing: 1, Passenger: 1, Tug: 1, Military: 1, Unknown: 2 },
        byFlag: { Panama: 1, Liberia: 2, 'Marshall Islands': 1, Egypt: 2, Taiwan: 1, Bahamas: 1, US: 1, Qatar: 1, Unknown: 2 },
        darkShips: 2,
        averageSpeed: 8.6
    };

    const hotspots = [
        { port: 'Port Said', vessels: 3, types: { Cargo: 1, Fishing: 1, Tug: 1 }, intensity: 'medium' },
        { port: 'Dubai', vessels: 2, types: { Cargo: 1, Tanker: 1 }, intensity: 'medium' },
        { port: 'Oman', vessels: 1, types: { Tanker: 1 }, intensity: 'low' }
    ];

    const anomalies = [
        { type: 'dark_ships', severity: 'high', count: 2, description: 'Обнаружено 2 "тёмных" судов', examples: 'DarkShip-1, DarkShip-2' },
        { type: 'restricted_zone', severity: 'critical', count: 3, description: '3 судов в зоне: Черное море', examples: 'Ever Given, DarkShip-1, Tug-1' }
    ];

    return {
        success: true,
        count: demoVessels.length,
        vessels: demoVessels,
        hotspots: hotspots,
        anomalies: anomalies,
        summary: summary,
        source: 'DEMO (AISStream)',
        timestamp: demoTimestamp,
        isDemo: true
    };
}

// ============================================================
// 9. API-ОБРАБОТЧИК
// ============================================================

export async function handleShipsApi(req, res) {
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
        // GET /api/ships/vessels — получить данные о судах
        if (path === '/api/ships/vessels' && req.method === 'GET') {
            const params = url.searchParams;
            const lat = parseFloat(params.get('lat')) || null;
            const lng = parseFloat(params.get('lng')) || null;
            const radius = parseFloat(params.get('radius')) || 5;
            const type = params.get('type') || null;

            const data = await fetchShips({ lat, lng, radius, type });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/ships/anomalies — получить аномалии
        if (path === '/api/ships/anomalies' && req.method === 'GET') {
            const data = await fetchShips();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                anomalies: data.anomalies,
                timestamp: data.timestamp
            }));
            return;
        }

        // GET /api/ships/hotspots — получить горячие точки (порты)
        if (path === '/api/ships/hotspots' && req.method === 'GET') {
            const data = await fetchShips();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                hotspots: data.hotspots,
                timestamp: data.timestamp
            }));
            return;
        }

        // GET /api/ships/status — статус модуля
        if (path === '/api/ships/status' && req.method === 'GET') {
            const apiKey = process.env.AISSTREAM_API_KEY || '';

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'Ships',
                status: apiKey ? 'active' : 'demo',
                apiKeySet: !!apiKey,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Ships API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 10. ЭКСПОРТ
// ============================================================

export default {
    fetchShips,
    handleShipsApi,
    detectDarkShip
};