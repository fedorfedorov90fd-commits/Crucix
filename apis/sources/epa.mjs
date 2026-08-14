#!/usr/bin/env node

// ============================================================
// EPA — МОНИТОРИНГ ЭКОЛОГИИ И ОКРУЖАЮЩЕЙ СРЕДЫ
// ============================================================
// Источник: U.S. Environmental Protection Agency (EPA)
// Данные: качество воздуха, выбросы, экологические показатели
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// EPA API Endpoints
const EPA_AIR_QUALITY = 'https://www.epa.gov/air-quality/api';
const EPA_AQI_API = 'https://www.airnowapi.org/aq/observation/zipCode/current';

// Категории загрязнения
const POLLUTANT_TYPES = {
    PM25: 'PM2.5 (Мелкие частицы)',
    PM10: 'PM10 (Крупные частицы)',
    OZONE: 'O3 (Озон)',
    NO2: 'NO2 (Диоксид азота)',
    SO2: 'SO2 (Диоксид серы)',
    CO: 'CO (Угарный газ)',
    LEAD: 'Pb (Свинец)',
    VOC: 'VOC (Летучие органические вещества)'
};

// Уровни качества воздуха (AQI)
const AQI_LEVELS = {
    GOOD: 'Хороший',
    MODERATE: 'Умеренный',
    UNHEALTHY_SENSITIVE: 'Вредный для чувствительных групп',
    UNHEALTHY: 'Вредный',
    VERY_UNHEALTHY: 'Очень вредный',
    HAZARDOUS: 'Опасный'
};

// Уровни опасности
const SEVERITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    NORMAL: 'normal'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchEnvironmentalData(options = {}) {
    const {
        zipCode = null,
        state = null,
        pollutant = null,
        limit = 50
    } = options;

    try {
        console.log('[EPA] Запрос экологических данных...');

        // Получаем данные
        let airQuality = [];
        let emissions = [];

        try {
            airQuality = await fetchAirQuality(zipCode, state);
        } catch (e) {
            console.warn('[EPA] Ошибка при получении качества воздуха:', e.message);
        }

        try {
            emissions = await fetchEmissionsData(state);
        } catch (e) {
            console.warn('[EPA] Ошибка при получении данных о выбросах:', e.message);
        }

        // Объединяем данные
        let allData = [...airQuality, ...emissions];

        // Если данных нет — используем демо
        if (allData.length === 0) {
            console.log('[EPA] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Фильтр по типу загрязнения
        if (pollutant) {
            allData = allData.filter(d =>
                d.pollutant?.toLowerCase().includes(pollutant.toLowerCase()) ||
                d.name?.toLowerCase().includes(pollutant.toLowerCase())
            );
        }

        // Сортируем по дате (новые сверху)
        allData.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Статистика
        const summary = getEnvironmentalSummary(allData);
        const alerts = detectEnvironmentalAlerts(allData);

        console.log(`[EPA] Получено ${allData.length} записей`);

        return {
            success: true,
            count: allData.length,
            data: allData.slice(0, limit),
            summary: summary,
            alerts: alerts,
            source: 'EPA (Environmental Protection Agency)',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[EPA] Ошибка:', error.message);
        console.warn('[EPA] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ КАЧЕСТВА ВОЗДУХА
// ============================================================

async function fetchAirQuality(zipCode, state) {
    try {
        // Формируем URL для запроса AQI
        let url;
        if (zipCode) {
            url = `${EPA_AQI_API}?zipCode=${zipCode}&format=application/json&api_key=DEMO`;
        } else if (state) {
            url = `${EPA_AQI_API}?state=${state}&format=application/json&api_key=DEMO`;
        } else {
            url = `${EPA_AQI_API}?format=application/json&api_key=DEMO`;
        }

        const response = await fetchWithRetry(url, { timeout: 10000 });
        const text = await response.text();

        if (!text.trim().startsWith('[')) {
            console.warn('[EPA] API вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.length > 0) {
            return data.map(item => ({
                id: `aqi-${item.zipCode || Date.now()}`,
                name: item.areaName || 'Unknown',
                location: item.city || item.state || 'Unknown',
                aqi: parseInt(item.aqi) || 0,
                aqiLevel: getAQILevel(parseInt(item.aqi) || 0),
                pollutant: item.pollutant || 'O3',
                pollutantType: detectPollutantType(item.pollutant),
                date: item.dateObserved || new Date().toISOString(),
                source: 'EPA AirNow',
                status: 'active'
            }));
        }
        return [];
    } catch (e) {
        console.warn('[EPA] Не удалось получить качество воздуха:', e.message);
        return [];
    }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ ДАННЫХ О ВЫБРОСАХ
// ============================================================

async function fetchEmissionsData(state) {
    try {
        // Имитация получения данных о выбросах
        // В реальности здесь был бы API EPA для выбросов
        return [];
    } catch (e) {
        console.warn('[EPA] Не удалось получить данные о выбросах:', e.message);
        return [];
    }
}

// ============================================================
// 5. ОПРЕДЕЛЕНИЕ УРОВНЯ AQI
// ============================================================

function getAQILevel(aqi) {
    if (aqi <= 50) return AQI_LEVELS.GOOD;
    if (aqi <= 100) return AQI_LEVELS.MODERATE;
    if (aqi <= 150) return AQI_LEVELS.UNHEALTHY_SENSITIVE;
    if (aqi <= 200) return AQI_LEVELS.UNHEALTHY;
    if (aqi <= 300) return AQI_LEVELS.VERY_UNHEALTHY;
    return AQI_LEVELS.HAZARDOUS;
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ ТИПА ЗАГРЯЗНЕНИЯ
// ============================================================

function detectPollutantType(pollutant) {
    if (!pollutant) return POLLUTANT_TYPES.PM25;

    const p = pollutant.toUpperCase();
    if (p.includes('PM2.5') || p.includes('PM25')) return POLLUTANT_TYPES.PM25;
    if (p.includes('PM10')) return POLLUTANT_TYPES.PM10;
    if (p.includes('O3') || p.includes('OZONE')) return POLLUTANT_TYPES.OZONE;
    if (p.includes('NO2')) return POLLUTANT_TYPES.NO2;
    if (p.includes('SO2')) return POLLUTANT_TYPES.SO2;
    if (p.includes('CO')) return POLLUTANT_TYPES.CO;
    if (p.includes('PB') || p.includes('LEAD')) return POLLUTANT_TYPES.LEAD;
    if (p.includes('VOC')) return POLLUTANT_TYPES.VOC;

    return POLLUTANT_TYPES.PM25;
}

// ============================================================
// 7. ОПРЕДЕЛЕНИЕ УРОВНЯ ОПАСНОСТИ
// ============================================================

function detectEnvironmentalSeverity(aqi) {
    if (aqi > 300) return SEVERITY.CRITICAL;
    if (aqi > 200) return SEVERITY.HIGH;
    if (aqi > 150) return SEVERITY.MEDIUM;
    if (aqi > 100) return SEVERITY.LOW;
    return SEVERITY.NORMAL;
}

// ============================================================
// 8. СТАТИСТИКА
// ============================================================

function getEnvironmentalSummary(data) {
    const summary = {
        total: data.length,
        averageAQI: 0,
        byPollutant: {},
        byLocation: {},
        byAQILevel: {},
        good: 0,
        moderate: 0,
        unhealthy: 0,
        veryUnhealthy: 0,
        hazardous: 0,
        highRiskCount: 0
    };

    let totalAQI = 0;
    let countAQI = 0;

    for (const d of data) {
        // По типам загрязнения
        const type = d.pollutantType || 'Unknown';
        summary.byPollutant[type] = (summary.byPollutant[type] || 0) + 1;

        // По локациям
        const location = d.location || 'Unknown';
        summary.byLocation[location] = (summary.byLocation[location] || 0) + 1;

        // По уровням AQI
        const level = d.aqiLevel || 'Unknown';
        summary.byAQILevel[level] = (summary.byAQILevel[level] || 0) + 1;

        // Считаем категории
        if (d.aqiLevel === AQI_LEVELS.GOOD) summary.good++;
        if (d.aqiLevel === AQI_LEVELS.MODERATE) summary.moderate++;
        if (d.aqiLevel === AQI_LEVELS.UNHEALTHY || d.aqiLevel === AQI_LEVELS.UNHEALTHY_SENSITIVE) summary.unhealthy++;
        if (d.aqiLevel === AQI_LEVELS.VERY_UNHEALTHY) summary.veryUnhealthy++;
        if (d.aqiLevel === AQI_LEVELS.HAZARDOUS) summary.hazardous++;

        // Высокий риск
        if (d.aqi > 150) summary.highRiskCount++;

        // Средний AQI
        if (d.aqi) {
            totalAQI += d.aqi;
            countAQI++;
        }
    }

    summary.averageAQI = countAQI > 0 ? Math.round(totalAQI / countAQI) : 0;

    return summary;
}

// ============================================================
// 9. ДЕТЕКТОР ЭКОЛОГИЧЕСКИХ АНОМАЛИЙ
// ============================================================

function detectEnvironmentalAlerts(data) {
    const alerts = [];

    // 1. Опасный уровень AQI
    const hazardous = data.filter(d => d.aqi > 300);
    if (hazardous.length > 0) {
        alerts.push({
            type: 'hazardous_air_quality',
            severity: SEVERITY.CRITICAL,
            count: hazardous.length,
            description: `${hazardous.length} локаций с опасным качеством воздуха (AQI > 300)`,
            examples: hazardous.slice(0, 3).map(d => `${d.location} (AQI: ${d.aqi})`).join(', ')
        });
    }

    // 2. Очень вредный уровень AQI
    const veryUnhealthy = data.filter(d => d.aqi > 200 && d.aqi <= 300);
    if (veryUnhealthy.length > 0) {
        alerts.push({
            type: 'very_unhealthy_air',
            severity: SEVERITY.HIGH,
            count: veryUnhealthy.length,
            description: `${veryUnhealthy.length} локаций с очень вредным качеством воздуха (AQI 200-300)`,
            examples: veryUnhealthy.slice(0, 3).map(d => `${d.location} (AQI: ${d.aqi})`).join(', ')
        });
    }

    // 3. Высокий уровень озона
    const ozoneHigh = data.filter(d =>
        d.pollutantType === POLLUTANT_TYPES.OZONE && d.aqi > 150
    );
    if (ozoneHigh.length > 0) {
        alerts.push({
            type: 'high_ozone',
            severity: SEVERITY.MEDIUM,
            count: ozoneHigh.length,
            description: `${ozoneHigh.length} локаций с высоким уровнем озона`,
            examples: ozoneHigh.slice(0, 3).map(d => `${d.location} (O3: ${d.aqi})`).join(', ')
        });
    }

    // 4. Высокий уровень PM2.5
    const pm25High = data.filter(d =>
        d.pollutantType === POLLUTANT_TYPES.PM25 && d.aqi > 150
    );
    if (pm25High.length > 0) {
        alerts.push({
            type: 'high_pm25',
            severity: SEVERITY.MEDIUM,
            count: pm25High.length,
            description: `${pm25High.length} локаций с высоким уровнем PM2.5`,
            examples: pm25High.slice(0, 3).map(d => `${d.location} (PM2.5: ${d.aqi})`).join(', ')
        });
    }

    return alerts;
}

// ============================================================
// 10. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const data = [];

    const cities = [
        { name: 'New York', state: 'NY', aqi: 45, pollutant: 'PM2.5' },
        { name: 'Los Angeles', state: 'CA', aqi: 85, pollutant: 'O3' },
        { name: 'Chicago', state: 'IL', aqi: 62, pollutant: 'PM2.5' },
        { name: 'Houston', state: 'TX', aqi: 95, pollutant: 'O3' },
        { name: 'Phoenix', state: 'AZ', aqi: 120, pollutant: 'PM10' },
        { name: 'Philadelphia', state: 'PA', aqi: 55, pollutant: 'PM2.5' },
        { name: 'San Antonio', state: 'TX', aqi: 78, pollutant: 'O3' },
        { name: 'San Diego', state: 'CA', aqi: 48, pollutant: 'PM2.5' },
        { name: 'Dallas', state: 'TX', aqi: 88, pollutant: 'O3' },
        { name: 'San Jose', state: 'CA', aqi: 35, pollutant: 'PM2.5' },
        { name: 'Austin', state: 'TX', aqi: 72, pollutant: 'PM10' },
        { name: 'Jacksonville', state: 'FL', aqi: 42, pollutant: 'PM2.5' },
        { name: 'Fort Worth', state: 'TX', aqi: 91, pollutant: 'O3' },
        { name: 'Columbus', state: 'OH', aqi: 58, pollutant: 'PM2.5' },
        { name: 'Charlotte', state: 'NC', aqi: 65, pollutant: 'PM2.5' },
        { name: 'San Francisco', state: 'CA', aqi: 38, pollutant: 'PM2.5' },
        { name: 'Indianapolis', state: 'IN', aqi: 52, pollutant: 'PM2.5' },
        { name: 'Seattle', state: 'WA', aqi: 32, pollutant: 'PM2.5' },
        { name: 'Denver', state: 'CO', aqi: 75, pollutant: 'PM10' },
        { name: 'Washington DC', state: 'DC', aqi: 48, pollutant: 'PM2.5' }
    ];

    for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        const date = new Date(now);
        date.setHours(date.getHours() - i * 3);

        // Немного случайности в AQI
        const aqi = city.aqi + Math.floor(Math.random() * 20 - 10);

        data.push({
            id: `aqi-${i}`,
            name: city.name,
            location: `${city.name}, ${city.state}`,
            aqi: Math.max(0, aqi),
            aqiLevel: getAQILevel(Math.max(0, aqi)),
            pollutant: city.pollutant,
            pollutantType: detectPollutantType(city.pollutant),
            date: date.toISOString(),
            source: 'EPA (DEMO)',
            status: 'active'
        });
    }

    // Добавляем несколько опасных значений для демонстрации
    const dangerZones = [
        { name: 'Delhi', state: 'IN', aqi: 420, pollutant: 'PM2.5' },
        { name: 'Beijing', state: 'CN', aqi: 280, pollutant: 'PM2.5' },
        { name: 'Karachi', state: 'PK', aqi: 215, pollutant: 'PM10' },
        { name: 'Mumbai', state: 'IN', aqi: 190, pollutant: 'PM2.5' },
        { name: 'Shanghai', state: 'CN', aqi: 165, pollutant: 'PM2.5' }
    ];

    for (const dz of dangerZones) {
        const date = new Date(now);
        date.setHours(date.getHours() - 1);

        data.push({
            id: `aqi-danger-${Date.now()}`,
            name: dz.name,
            location: `${dz.name}, ${dz.state}`,
            aqi: dz.aqi,
            aqiLevel: getAQILevel(dz.aqi),
            pollutant: dz.pollutant,
            pollutantType: detectPollutantType(dz.pollutant),
            date: date.toISOString(),
            source: 'EPA (DEMO)',
            status: 'active'
        });
    }

    const summary = getEnvironmentalSummary(data);
    const alerts = detectEnvironmentalAlerts(data);

    console.log(`[EPA] Сгенерировано ${data.length} демо-записей`);

    return {
        success: true,
        count: data.length,
        data: data,
        summary: summary,
        alerts: alerts,
        source: 'EPA (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 11. API-ОБРАБОТЧИК
// ============================================================

export async function handleEPAAPI(req, res) {
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
        // GET /api/epa/data — получить экологические данные
        if (path === '/api/epa/data' && req.method === 'GET') {
            const params = url.searchParams;
            const zipCode = params.get('zip') || null;
            const state = params.get('state') || null;
            const pollutant = params.get('pollutant') || null;
            const limit = parseInt(params.get('limit')) || 50;

            const data = await fetchEnvironmentalData({ zipCode, state, pollutant, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/epa/status — статус модуля
        if (path === '/api/epa/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'EPA',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[EPA API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 12. ЭКСПОРТ
// ============================================================

export default {
    fetchEnvironmentalData,
    handleEPAAPI,
    getEnvironmentalSummary,
    detectEnvironmentalAlerts
};