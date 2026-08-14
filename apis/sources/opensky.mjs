#!/usr/bin/env node

// ============================================================
// OPENSKY — АВИАЦИОННЫЙ ТРЕКИНГ
// ============================================================
// Источник: OpenSky Network
// Данные: реальный трекинг самолётов в 6 горячих регионах
// Обновление: каждые 5-10 секунд
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const OPENSKY_API = 'https://opensky-network.org/api/states/all';

// Горячие регионы для мониторинга
const HOTSPOT_REGIONS = [
    { name: 'Ближний Восток', latMin: 25, latMax: 40, lngMin: 35, lngMax: 60 },
    { name: 'Украина', latMin: 44, latMax: 52, lngMin: 22, lngMax: 40 },
    { name: 'Южно-Китайское море', latMin: 10, latMax: 25, lngMin: 105, lngMax: 125 },
    { name: 'Тайваньский пролив', latMin: 20, latMax: 30, lngMin: 118, lngMax: 125 },
    { name: 'Корейский полуостров', latMin: 33, latMax: 43, lngMin: 124, lngMax: 132 },
    { name: 'Балтийский регион', latMin: 50, latMax: 60, lngMin: 18, lngMax: 30 }
];

// Военные префиксы позывных
const MILITARY_PREFIXES = [
    'RCH', 'GAF', 'PLF', 'CTM', 'RRR', 'RFR', 'NATO', 'SAM',
    'AF1', 'AF2', 'JANET', 'JENA', 'ANG', 'ARMY', 'NAVY',
    'COAST', 'GUARD', 'PAT', 'REACH', 'SPAR', 'VIPER', 'FURY'
];

// Военные ICAO-коды (первые символы)
const MILITARY_ICAO_PREFIXES = ['AE', 'ADF', 'AS', 'C2', 'E4'];

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получить данные о всех самолётах в реальном времени
 */
export async function fetchAircraft() {
    try {
        const response = await fetchWithRetry(OPENSKY_API, { timeout: 10000 });
        const data = await response.json();

        if (!data.states || data.states.length === 0) {
            console.log('[OpenSky] Данных о самолётах нет');
            return {
                success: true,
                count: 0,
                aircraft: [],
                hotspots: [],
                anomalies: [],
                summary: {
                    total: 0,
                    military: 0,
                    onGround: 0,
                    airborne: 0
                },
                timestamp: new Date().toISOString()
            };
        }

        // Обрабатываем данные
        const aircraft = data.states.map(s => parseAircraft(s));
        const hotspots = analyzeHotspots(aircraft);
        const anomalies = detectAnomalies(aircraft);
        const summary = getSummary(aircraft);

        console.log(`[OpenSky] Найдено ${aircraft.length} самолётов (${summary.military} военных)`);

        return {
            success: true,
            count: aircraft.length,
            aircraft: aircraft,
            hotspots: hotspots,
            anomalies: anomalies,
            summary: summary,
            source: 'OpenSky Network',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[OpenSky] Ошибка:', error.message);
        return {
            success: false,
            error: error.message,
            aircraft: [],
            hotspots: [],
            anomalies: [],
            summary: { total: 0, military: 0, onGround: 0, airborne: 0 },
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================================
// 3. ОБРАБОТКА ОДНОГО САМОЛЁТА
// ============================================================

function parseAircraft(state) {
    // Формат OpenSky: [icao24, callsign, origin, time, lastContact, lng, lat, alt, onGround, velocity, heading, ...]
    const [
        icao24,
        callsignRaw,
        originCountry,
        timePosition,
        lastContact,
        longitude,
        latitude,
        altitude,
        onGround,
        velocity,
        heading,
        verticalRate,
        sensors,
        baroAltitude,
        transponderCode,
        squawk
    ] = state;

    const callsign = callsignRaw?.trim() || null;
    const isMilitary = detectMilitary(icao24, callsign);

    return {
        icao24: icao24 || null,
        callsign: callsign,
        originCountry: originCountry || null,
        longitude: longitude !== null ? parseFloat(longitude) : null,
        latitude: latitude !== null ? parseFloat(latitude) : null,
        altitude: altitude !== null ? parseFloat(altitude) : null,
        velocity: velocity !== null ? parseFloat(velocity) : null,
        heading: heading !== null ? parseFloat(heading) : null,
        verticalRate: verticalRate !== null ? parseFloat(verticalRate) : null,
        onGround: onGround || false,
        baroAltitude: baroAltitude !== null ? parseFloat(baroAltitude) : null,
        transponderCode: transponderCode || null,
        squawk: squawk || null,
        isMilitary: isMilitary,
        lastContact: lastContact !== null ? new Date(lastContact * 1000).toISOString() : null
    };
}

// ============================================================
// 4. ОПРЕДЕЛЕНИЕ ВОЕННОГО БОРТА
// ============================================================

function detectMilitary(icao24, callsign) {
    if (!icao24 && !callsign) return false;

    // Проверка по ICAO-коду
    if (icao24) {
        const icaoUpper = icao24.toUpperCase();
        for (const prefix of MILITARY_ICAO_PREFIXES) {
            if (icaoUpper.startsWith(prefix)) return true;
        }
    }

    // Проверка по позывному
    if (callsign) {
        const callsignUpper = callsign.toUpperCase();
        for (const prefix of MILITARY_PREFIXES) {
            if (callsignUpper.startsWith(prefix)) return true;
        }
        // Военные позывные часто содержат 3-4 буквы
        if (/^[A-Z]{3,4}$/.test(callsignUpper) && callsignUpper.length <= 4) {
            return true;
        }
    }

    return false;
}

// ============================================================
// 5. АНАЛИЗ ГОРЯЧИХ ТОЧЕК (СКОПЛЕНИЯ САМОЛЁТОВ)
// ============================================================

function analyzeHotspots(aircraft) {
    const airborne = aircraft.filter(a => !a.onGround && a.latitude && a.longitude);
    
    if (airborne.length === 0) return [];

    const grid = {};
    const step = 0.5; // ~50 км

    for (const a of airborne) {
        const latKey = Math.round(a.latitude / step) * step;
        const lngKey = Math.round(a.longitude / step) * step;
        const key = `${latKey},${lngKey}`;
        
        if (!grid[key]) {
            grid[key] = {
                lat: latKey,
                lng: lngKey,
                count: 0,
                military: 0,
                aircraft: []
            };
        }
        grid[key].count++;
        if (a.isMilitary) grid[key].military++;
        grid[key].aircraft.push(a);
    }

    return Object.values(grid)
        .filter(cell => cell.count >= 5)
        .sort((a, b) => b.count - a.count)
        .map(cell => ({
            center: { lat: cell.lat, lng: cell.lng },
            count: cell.count,
            military: cell.military,
            intensity: cell.count > 20 ? 'critical' : cell.count > 10 ? 'high' : 'medium'
        }));
}

// ============================================================
// 6. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectAnomalies(aircraft) {
    const anomalies = [];
    const airborne = aircraft.filter(a => !a.onGround);

    // 1. Самолёты без позывного (скрытые)
    const noCallsign = airborne.filter(a => !a.callsign);
    if (noCallsign.length > 10) {
        anomalies.push({
            type: 'no_callsign',
            severity: 'high',
            count: noCallsign.length,
            description: `${noCallsign.length} самолётов без позывного`,
            examples: noCallsign.slice(0, 5).map(a => a.icao24).join(', ')
        });
    }

    // 2. Военные самолёты над горячими регионами
    const military = airborne.filter(a => a.isMilitary);
    if (military.length > 5) {
        anomalies.push({
            type: 'military_activity',
            severity: military.length > 15 ? 'critical' : 'high',
            count: military.length,
            description: `${military.length} военных бортов в воздухе`,
            examples: military.slice(0, 5).map(a => a.callsign || a.icao24).join(', ')
        });
    }

    // 3. Самолёты на нестандартной высоте
    const highAltitude = airborne.filter(a => a.altitude > 15000);
    if (highAltitude.length > 10) {
        anomalies.push({
            type: 'high_altitude',
            severity: 'medium',
            count: highAltitude.length,
            description: `${highAltitude.length} самолётов выше 15 км`,
            examples: highAltitude.slice(0, 5).map(a => `${a.callsign || a.icao24} (${Math.round(a.altitude)}м)`).join(', ')
        });
    }

    return anomalies;
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getSummary(aircraft) {
    const summary = {
        total: aircraft.length,
        military: aircraft.filter(a => a.isMilitary).length,
        onGround: aircraft.filter(a => a.onGround).length,
        airborne: aircraft.filter(a => !a.onGround).length,
        byCountry: {},
        byType: {
            commercial: 0,
            military: 0,
            unknown: 0
        }
    };

    for (const a of aircraft) {
        const country = a.originCountry || 'unknown';
        summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;
        
        if (a.isMilitary) {
            summary.byType.military++;
        } else if (a.originCountry) {
            summary.byType.commercial++;
        } else {
            summary.byType.unknown++;
        }
    }

    return summary;
}

// ============================================================
// 8. API-ОБРАБОТЧИК
// ============================================================

export async function handleOpenSkyApi(req, res) {
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
        // GET /api/opensky/aircraft — получить данные о самолётах
        if (path === '/api/opensky/aircraft' && req.method === 'GET') {
            const data = await fetchAircraft();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/opensky/anomalies — получить только аномалии
        if (path === '/api/opensky/anomalies' && req.method === 'GET') {
            const data = await fetchAircraft();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                anomalies: data.anomalies,
                timestamp: data.timestamp
            }));
            return;
        }

        // GET /api/opensky/status — статус модуля
        if (path === '/api/opensky/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'OpenSky',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[OpenSky API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 9. ЭКСПОРТ
// ============================================================

export default {
    fetchAircraft,
    handleOpenSkyApi,
    detectMilitary
};