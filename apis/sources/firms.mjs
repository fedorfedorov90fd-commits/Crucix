#!/usr/bin/env node

// ============================================================
// FIRMS — ПОЖАРЫ И ТЕПЛОВЫЕ АНОМАЛИИ
// ============================================================
// Источник: NASA FIRMS (Fire Information for Resource Management System)
// Данные: спутниковые снимки MODIS и VIIRS
// Обновление: каждые 3 часа
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const FIRMS_API = 'https://firms.modaps.eosdis.nasa.gov/api/area';
const API_KEY = process.env.FIRMS_MAP_KEY || '';

// Пороги интенсивности пожара (FRP — Fire Radiative Power, МВт)
const INTENSITY_THRESHOLDS = {
    CRITICAL: 100,
    HIGH: 50,
    MEDIUM: 10,
    LOW: 0
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получить данные о пожарах за последние N дней
 * 
 * @param {Object} options
 * @param {number} options.lat - Широта центра (по умолчанию 0)
 * @param {number} options.lng - Долгота центра (по умолчанию 0)
 * @param {number} options.radius - Радиус в градусах (по умолчанию 10)
 * @param {number} options.days - Количество дней (по умолчанию 1)
 * @param {string} options.satellite - Спутник: 'VIIRS' или 'MODIS' (по умолчанию 'VIIRS')
 * @returns {Promise<Object>} Данные о пожарах
 */
export async function fetchFires(options = {}) {
    const {
        lat = 0,
        lng = 0,
        radius = 10,
        days = 1,
        satellite = 'VIIRS'
    } = options;

    // Проверка API ключа
    if (!API_KEY) {
        console.warn('[FIRMS] API ключ не найден. Установите FIRMS_MAP_KEY в .env');
        return getDemoData();
    }

    try {
        // Формируем URL для запроса
        const url = `${FIRMS_API}/c6/${API_KEY}/geojson/${satellite}/${lat}/${lng}/${radius}/${days}`;
        
        console.log(`[FIRMS] Запрос данных за ${days} день(ей), радиус ${radius}°`);

        const response = await fetchWithRetry(url, { timeout: 15000 });
        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            console.log('[FIRMS] Пожаров не обнаружено');
            return {
                success: true,
                count: 0,
                fires: [],
                hotspots: [],
                summary: {
                    total: 0,
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0
                },
                timestamp: new Date().toISOString()
            };
        }

        // Обрабатываем данные
        const fires = data.features.map(f => parseFire(f));
        const hotspots = analyzeHotspots(data.features);
        const summary = getSummary(fires);

        console.log(`[FIRMS] Найдено ${fires.length} пожаров`);

        return {
            success: true,
            count: fires.length,
            fires: fires,
            hotspots: hotspots,
            summary: summary,
            source: 'NASA FIRMS',
            satellite: satellite,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[FIRMS] Ошибка:', error.message);
        
        // При ошибке возвращаем демо-данные
        console.warn('[FIRMS] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ОБРАБОТКА ОДНОГО ПОЖАРА
// ============================================================

function parseFire(feature) {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0];
    
    const frp = parseFloat(props.frp) || 0;
    
    return {
        id: feature.id || `fire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        lat: coords[1] || 0,
        lng: coords[0] || 0,
        frp: frp,
        confidence: props.confidence || 'unknown',
        date: props.acq_date || null,
        time: props.acq_time || null,
        satellite: props.satellite || 'unknown',
        instrument: props.instrument || 'unknown',
        dayNight: props.daynight || 'D',
        intensity: getIntensity(frp),
        brightness: parseFloat(props.brightness) || null,
        scan: parseFloat(props.scan) || null,
        track: parseFloat(props.track) || null
    };
}

// ============================================================
// 4. ОПРЕДЕЛЕНИЕ ИНТЕНСИВНОСТИ
// ============================================================

function getIntensity(frp) {
    if (frp >= INTENSITY_THRESHOLDS.CRITICAL) return 'critical';
    if (frp >= INTENSITY_THRESHOLDS.HIGH) return 'high';
    if (frp >= INTENSITY_THRESHOLDS.MEDIUM) return 'medium';
    return 'low';
}

// ============================================================
// 5. АНАЛИЗ ГОРЯЧИХ ТОЧЕК (КЛАСТЕРИЗАЦИЯ)
// ============================================================

function analyzeHotspots(features) {
    if (!features || features.length === 0) return [];

    const clusters = [];
    const used = new Set();

    for (let i = 0; i < features.length; i++) {
        if (used.has(i)) continue;

        const cluster = [features[i]];
        used.add(i);
        const f1 = features[i];
        const coords1 = f1.geometry?.coordinates || [0, 0];

        for (let j = i + 1; j < features.length; j++) {
            if (used.has(j)) continue;
            const f2 = features[j];
            const coords2 = f2.geometry?.coordinates || [0, 0];
            
            const dist = calculateDistance(
                coords1[1], coords1[0],
                coords2[1], coords2[0]
            );
            
            if (dist < 0.1) { // ~10 км
                cluster.push(features[j]);
                used.add(j);
            }
        }

        const frpValues = cluster.map(f => parseFloat(f.properties?.frp) || 0);
        const avgLat = cluster.reduce((s, f) => s + (f.geometry?.coordinates[1] || 0), 0) / cluster.length;
        const avgLng = cluster.reduce((s, f) => s + (f.geometry?.coordinates[0] || 0), 0) / cluster.length;

        clusters.push({
            count: cluster.length,
            center: { lat: avgLat, lng: avgLng },
            maxFrp: Math.max(...frpValues),
            totalFrp: frpValues.reduce((a, b) => a + b, 0),
            avgFrp: frpValues.reduce((a, b) => a + b, 0) / frpValues.length,
            intensity: getIntensity(Math.max(...frpValues))
        });
    }

    return clusters.sort((a, b) => b.totalFrp - a.totalFrp);
}

// ============================================================
// 6. РАСЧЁТ РАССТОЯНИЯ (ГАВЕРСИНУС)
// ============================================================

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getSummary(fires) {
    const summary = {
        total: fires.length,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        avgFrp: 0,
        maxFrp: 0,
        bySatellite: {}
    };

    if (fires.length === 0) return summary;

    let totalFrp = 0;

    for (const fire of fires) {
        summary[fire.intensity] = (summary[fire.intensity] || 0) + 1;
        totalFrp += fire.frp;
        if (fire.frp > summary.maxFrp) summary.maxFrp = fire.frp;

        const sat = fire.satellite || 'unknown';
        summary.bySatellite[sat] = (summary.bySatellite[sat] || 0) + 1;
    }

    summary.avgFrp = Math.round((totalFrp / fires.length) * 10) / 10;

    return summary;
}

// ============================================================
// 8. ДЕМО-ДАННЫЕ (ДЛЯ ТЕСТИРОВАНИЯ)
// ============================================================

function getDemoData() {
    const demoTimestamp = new Date().toISOString();
    
    const demoFires = [
        { id: 'demo-1', lat: 47.5122, lng: 34.8347, frp: 85.3, intensity: 'high', confidence: 'high', date: '2026-08-14', satellite: 'VIIRS' },
        { id: 'demo-2', lat: 47.4850, lng: 34.8050, frp: 45.6, intensity: 'medium', confidence: 'medium', date: '2026-08-14', satellite: 'VIIRS' },
        { id: 'demo-3', lat: 47.5320, lng: 34.8620, frp: 12.3, intensity: 'medium', confidence: 'low', date: '2026-08-14', satellite: 'MODIS' },
        { id: 'demo-4', lat: 45.3084, lng: 36.4968, frp: 68.7, intensity: 'high', confidence: 'high', date: '2026-08-14', satellite: 'VIIRS' },
        { id: 'demo-5', lat: 46.7750, lng: 33.3669, frp: 92.1, intensity: 'high', confidence: 'high', date: '2026-08-14', satellite: 'VIIRS' },
        { id: 'demo-6', lat: 49.5000, lng: 30.5000, frp: 35.4, intensity: 'medium', confidence: 'medium', date: '2026-08-14', satellite: 'VIIRS' },
        { id: 'demo-7', lat: 35.0380, lng: -85.0560, frp: 5.2, intensity: 'low', confidence: 'low', date: '2026-08-13', satellite: 'MODIS' },
        { id: 'demo-8', lat: 36.0160, lng: -114.7380, frp: 2.1, intensity: 'low', confidence: 'low', date: '2026-08-13', satellite: 'MODIS' }
    ];

    const hotspots = [
        { count: 3, center: { lat: 47.509, lng: 34.834 }, maxFrp: 85.3, totalFrp: 143.2, avgFrp: 47.7, intensity: 'high' },
        { count: 1, center: { lat: 45.308, lng: 36.497 }, maxFrp: 68.7, totalFrp: 68.7, avgFrp: 68.7, intensity: 'high' },
        { count: 1, center: { lat: 46.775, lng: 33.367 }, maxFrp: 92.1, totalFrp: 92.1, avgFrp: 92.1, intensity: 'high' },
        { count: 1, center: { lat: 49.500, lng: 30.500 }, maxFrp: 35.4, totalFrp: 35.4, avgFrp: 35.4, intensity: 'medium' }
    ];

    return {
        success: true,
        count: demoFires.length,
        fires: demoFires,
        hotspots: hotspots,
        summary: {
            total: demoFires.length,
            critical: 0,
            high: 3,
            medium: 3,
            low: 2,
            avgFrp: 43.3,
            maxFrp: 92.1,
            bySatellite: { VIIRS: 5, MODIS: 3 }
        },
        source: 'DEMO (NASA FIRMS)',
        satellite: 'VIIRS + MODIS',
        timestamp: demoTimestamp,
        isDemo: true
    };
}

// ============================================================
// 9. API-ОБРАБОТЧИК
// ============================================================

export async function handleFIRMSApi(req, res) {
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
        // GET /api/firms/fires — получить данные о пожарах
        if (path === '/api/firms/fires' && req.method === 'GET') {
            const params = url.searchParams;
            const lat = parseFloat(params.get('lat')) || 0;
            const lng = parseFloat(params.get('lng')) || 0;
            const radius = parseFloat(params.get('radius')) || 10;
            const days = parseInt(params.get('days')) || 1;
            const satellite = params.get('satellite') || 'VIIRS';

            const data = await fetchFires({ lat, lng, radius, days, satellite });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/firms/status — статус модуля
        if (path === '/api/firms/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'FIRMS',
                status: API_KEY ? 'active' : 'demo',
                apiKeySet: !!API_KEY,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[FIRMS API] Ошибка:', error);
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
    fetchFires,
    handleFIRMSApi,
    getDemoData
};