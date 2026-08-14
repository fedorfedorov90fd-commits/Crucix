#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №10: ВОЕННАЯ АВИАЦИЯ С ДЕТЕКТОРОМ АНОМАЛИЙ
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ============================================================
// 1. ДЕМО-ДАННЫЕ
// ============================================================

const DEMO_FLIGHTS = [
    // Военные рейсы
    {
        id: 'fl-001',
        callsign: 'RCH123',
        aircraft: 'C-17 Globemaster',
        type: 'military',
        origin: 'Ramstein AB',
        destination: 'Incirlik AB',
        lat: 40.5,
        lng: 28.5,
        altitude: 32000,
        speed: 480,
        heading: 120,
        squawk: '1234',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-002',
        callsign: 'NATO01',
        aircraft: 'E-3 Sentry (AWACS)',
        type: 'military',
        origin: 'Geilenkirchen AB',
        destination: 'Patrol Area',
        lat: 42.0,
        lng: 25.0,
        altitude: 29000,
        speed: 350,
        heading: 90,
        squawk: '5678',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-003',
        callsign: 'VIPER21',
        aircraft: 'F-16 Fighting Falcon',
        type: 'military',
        origin: 'Aviano AB',
        destination: 'Combat Air Patrol',
        lat: 44.5,
        lng: 22.0,
        altitude: 18000,
        speed: 520,
        heading: 270,
        squawk: '3456',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-004',
        callsign: 'XXXXXX',
        aircraft: 'Unknown (No Squawk)',
        type: 'unknown',
        origin: 'Unknown',
        destination: 'Unknown',
        lat: 39.0,
        lng: 26.0,
        altitude: 8500,
        speed: 380,
        heading: 330,
        squawk: '0000',
        status: 'active',
        anomaly: 'no_transponder',
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-005',
        callsign: 'FALCON11',
        aircraft: 'F-35 Lightning II',
        type: 'military',
        origin: 'Lakenheath AB',
        destination: 'Patrol Area',
        lat: 43.5,
        lng: 20.0,
        altitude: 22000,
        speed: 560,
        heading: 150,
        squawk: '7890',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-006',
        callsign: 'HERCULES',
        aircraft: 'C-130 Hercules',
        type: 'military',
        origin: 'Papa AB',
        destination: 'Kecskemét AB',
        lat: 46.0,
        lng: 24.0,
        altitude: 25000,
        speed: 320,
        heading: 60,
        squawk: '2345',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    // Гражданские рейсы (для фона)
    {
        id: 'fl-007',
        callsign: 'THY123',
        aircraft: 'Boeing 737-800',
        type: 'civilian',
        origin: 'Istanbul',
        destination: 'London',
        lat: 41.0,
        lng: 27.0,
        altitude: 35000,
        speed: 490,
        heading: 280,
        squawk: '1234',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-008',
        callsign: 'AAL456',
        aircraft: 'Boeing 777-300ER',
        type: 'civilian',
        origin: 'New York',
        destination: 'Paris',
        lat: 48.0,
        lng: -30.0,
        altitude: 37000,
        speed: 520,
        heading: 60,
        squawk: '5678',
        status: 'active',
        anomaly: null,
        timestamp: new Date().toISOString()
    },
    // Аномалии
    {
        id: 'fl-009',
        callsign: 'GHOST1',
        aircraft: 'Unknown',
        type: 'unknown',
        origin: 'Unknown',
        destination: 'Unknown',
        lat: 47.0,
        lng: 35.0,
        altitude: 12000,
        speed: 420,
        heading: 45,
        squawk: '0000',
        status: 'active',
        anomaly: 'no_transponder',
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-010',
        callsign: 'LOWFLY',
        aircraft: 'Su-27',
        type: 'military',
        origin: 'Unknown',
        destination: 'Unknown',
        lat: 46.5,
        lng: 32.0,
        altitude: 1500,
        speed: 480,
        heading: 180,
        squawk: '4321',
        status: 'active',
        anomaly: 'low_altitude',
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-011',
        callsign: 'FASTJET',
        aircraft: 'MiG-31',
        type: 'military',
        origin: 'Unknown',
        destination: 'Unknown',
        lat: 48.0,
        lng: 30.0,
        altitude: 40000,
        speed: 850,
        heading: 270,
        squawk: '8765',
        status: 'active',
        anomaly: 'high_speed',
        timestamp: new Date().toISOString()
    },
    {
        id: 'fl-012',
        callsign: 'BORDER1',
        aircraft: 'Unknown',
        type: 'unknown',
        origin: 'Unknown',
        destination: 'Unknown',
        lat: 49.0,
        lng: 26.0,
        altitude: 18000,
        speed: 360,
        heading: 90,
        squawk: '0000',
        status: 'active',
        anomaly: 'border_incursion',
        timestamp: new Date().toISOString()
    }
];

// ============================================================
// 2. АНАЛИЗ АНОМАЛИЙ
// ============================================================

function detectAnomalies(flights) {
    const anomalies = [];
    const zones = {
        'conflict': [
            { lat: 47.5, lng: 34.5, radius: 2 },  // Ukraine
            { lat: 45.3, lng: 36.5, radius: 1.5 }, // Crimea
            { lat: 33.0, lng: 44.0, radius: 2 },   // Iraq
            { lat: 35.0, lng: 38.0, radius: 2 },   // Syria
            { lat: 32.0, lng: 35.0, radius: 1.5 }, // Israel
            { lat: 30.0, lng: 48.0, radius: 1.5 }, // Iran
            { lat: 38.0, lng: 127.0, radius: 1 }   // Korea
        ],
        'restricted': [
            { lat: 47.5, lng: 34.5, radius: 1.5 }, // Zaporizhzhia NPP
            { lat: 51.0, lng: 2.0, radius: 0.5 }    // UK airspace
        ]
    };

    const anomalyTypes = {
        'no_transponder': {
            label: 'Нет транспондера',
            severity: 'high',
            icon: '🚫'
        },
        'low_altitude': {
            label: 'Низкая высота',
            severity: 'medium',
            icon: '⬇️'
        },
        'high_speed': {
            label: 'Высокая скорость',
            severity: 'high',
            icon: '⚡'
        },
        'border_incursion': {
            label: 'Вторжение в зону',
            severity: 'critical',
            icon: '🚨'
        },
        'no_callsign': {
            label: 'Нет позывного',
            severity: 'medium',
            icon: '❓'
        },
        'unusual_heading': {
            label: 'Необычный курс',
            severity: 'medium',
            icon: '🔄'
        }
    };

    for (const flight of flights) {
        const anomalies_found = [];

        // 1. Нет транспондера
        if (flight.squawk === '0000') {
            anomalies_found.push('no_transponder');
        }

        // 2. Низкая высота (для военных)
        if (flight.type === 'military' && flight.altitude < 5000) {
            anomalies_found.push('low_altitude');
        }

        // 3. Высокая скорость (для военных)
        if (flight.type === 'military' && flight.speed > 700) {
            anomalies_found.push('high_speed');
        }

        // 4. В зоне конфликта
        for (const zone of zones.conflict) {
            const dist = Math.sqrt(
                Math.pow(flight.lat - zone.lat, 2) +
                Math.pow(flight.lng - zone.lng, 2)
            );
            if (dist < zone.radius && flight.type === 'military') {
                anomalies_found.push('border_incursion');
                break;
            }
        }

        // 5. Нет позывного
        if (flight.callsign === 'Unknown' || flight.callsign === 'XXXXXX') {
            anomalies_found.push('no_callsign');
        }

        // Если есть аномалии — добавляем
        if (anomalies_found.length > 0) {
            const firstAnomaly = anomalies_found[0];
            anomalies.push({
                id: `anomaly-${Date.now()}-${flight.id}`,
                flightId: flight.id,
                callsign: flight.callsign,
                aircraft: flight.aircraft,
                type: firstAnomaly,
                label: anomalyTypes[firstAnomaly]?.label || firstAnomaly,
                severity: anomalyTypes[firstAnomaly]?.severity || 'medium',
                icon: anomalyTypes[firstAnomaly]?.icon || '⚠️',
                lat: flight.lat,
                lng: flight.lng,
                altitude: flight.altitude,
                speed: flight.speed,
                detectedAt: new Date().toISOString(),
                allAnomalies: anomalies_found
            });
        }
    }

    return anomalies;
}

// ============================================================
// 3. СТАТИСТИКА
// ============================================================

function getStats(flights, anomalies) {
    const total = flights.length;
    const military = flights.filter(f => f.type === 'military').length;
    const civilian = flights.filter(f => f.type === 'civilian').length;
    const unknown = flights.filter(f => f.type === 'unknown').length;
    const anomalyCount = anomalies.length;

    const bySeverity = {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length
    };

    const byType = {};
    for (const a of anomalies) {
        if (!byType[a.type]) byType[a.type] = 0;
        byType[a.type]++;
    }

    return {
        total,
        military,
        civilian,
        unknown,
        anomalies: anomalyCount,
        bySeverity,
        byType,
        timestamp: new Date().toISOString()
    };
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleAviationAPI(req, res) {
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
        // Генерируем обновлённые данные
        const flights = DEMO_FLIGHTS.map(f => ({
            ...f,
            timestamp: new Date().toISOString()
        }));

        const anomalies = detectAnomalies(flights);
        const stats = getStats(flights, anomalies);

        // --- GET /api/aviation/status ---
        if (path === '/api/aviation/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                status: 'online',
                version: '1.0',
                sources: ['OpenSky (demo)', 'ADSB Exchange (demo)'],
                totalFlights: flights.length,
                anomalies: anomalies.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/aviation/flights ---
        if (path === '/api/aviation/flights') {
            const params = new URLSearchParams(url.search);
            const type = params.get('type');
            let filtered = flights;

            if (type && type !== 'all') {
                filtered = flights.filter(f => f.type === type);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: filtered.length,
                flights: filtered,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/aviation/flight/:id ---
        if (path.startsWith('/api/aviation/flight/')) {
            const id = path.split('/').pop();
            const flight = flights.find(f => f.id === id);

            if (!flight) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Рейс не найден' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                flight: flight,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/aviation/anomalies ---
        if (path === '/api/aviation/anomalies') {
            const params = new URLSearchParams(url.search);
            const severity = params.get('severity');
            let filtered = anomalies;

            if (severity && severity !== 'all') {
                filtered = anomalies.filter(a => a.severity === severity);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: filtered.length,
                anomalies: filtered,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/aviation/hotspots ---
        if (path === '/api/aviation/hotspots') {
            // Группируем рейсы по зонам
            const hotspots = [
                { id: 'hotspot-001', name: 'Восточная Европа', lat: 47.5, lng: 34.5, count: 4, severity: 'high' },
                { id: 'hotspot-002', name: 'Ближний Восток', lat: 33.0, lng: 44.0, count: 3, severity: 'critical' },
                { id: 'hotspot-003', name: 'Балканы', lat: 44.5, lng: 22.0, count: 2, severity: 'medium' },
                { id: 'hotspot-004', name: 'Чёрное море', lat: 43.0, lng: 30.0, count: 2, severity: 'medium' }
            ];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                hotspots: hotspots,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/aviation/stats ---
        if (path === '/api/aviation/stats') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[Aviation API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleAviationAPI };
