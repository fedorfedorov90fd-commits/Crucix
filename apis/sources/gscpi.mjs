#!/usr/bin/env node

// ============================================================
// GSCPI — ИНДЕКС ДАВЛЕНИЯ В ЦЕПЯХ ПОСТАВОК
// ============================================================
// Источник: Global Supply Chain Pressure Index (Federal Reserve)
// Данные: давление в цепях поставок, задержки, логистика
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// FRED API для GSCPI
const FRED_API = 'https://api.stlouisfed.org/fred/series';
const GSCPI_SERIES_ID = 'GSCPI';

// Альтернативные источники
const BALTIC_DRY_INDEX = 'https://www.balticexchange.com/data/index';

// Уровни давления
const PRESSURE_LEVELS = {
    VERY_HIGH: 'Очень высокое',
    HIGH: 'Высокое',
    MODERATE: 'Умеренное',
    LOW: 'Низкое',
    NORMAL: 'Нормальное'
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

export async function fetchSupplyChainData(options = {}) {
    const {
        days = 90,
        limit = 100
    } = options;

    try {
        console.log('[GSCPI] Запрос данных о цепях поставок...');

        // Получаем данные
        let gscpiData = [];
        let shippingData = [];

        try {
            gscpiData = await fetchGSCPI();
        } catch (e) {
            console.warn('[GSCPI] Ошибка при получении GSCPI:', e.message);
        }

        try {
            shippingData = await fetchShippingIndicators();
        } catch (e) {
            console.warn('[GSCPI] Ошибка при получении данных о доставке:', e.message);
        }

        // Объединяем данные
        let allData = [...gscpiData, ...shippingData];

        // Если данных нет — используем демо
        if (allData.length === 0) {
            console.log('[GSCPI] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Сортируем по дате (новые сверху)
        allData.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Ограничиваем количество
        if (allData.length > limit) {
            allData = allData.slice(0, limit);
        }

        // Статистика
        const summary = getSupplyChainSummary(allData);
        const alerts = detectSupplyChainAlerts(allData);

        console.log(`[GSCPI] Получено ${allData.length} записей`);

        return {
            success: true,
            count: allData.length,
            data: allData,
            summary: summary,
            alerts: alerts,
            source: 'FRED GSCPI + Shipping Indicators',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[GSCPI] Ошибка:', error.message);
        console.warn('[GSCPI] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ GSCPI ИЗ FRED
// ============================================================

async function fetchGSCPI() {
    try {
        // FRED API требует API ключ, но мы используем публичный доступ
        // В реальности нужно получить ключ на fred.stlouisfed.org
        const url = `${FRED_API}/observations?series_id=${GSCPI_SERIES_ID}&limit=100&sort_order=desc&api_key=DEMO`;

        const response = await fetchWithRetry(url, { timeout: 15000 });
        const text = await response.text();

        if (!text.trim().startsWith('{')) {
            console.warn('[GSCPI] FRED вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.observations) {
            return data.observations.map(item => ({
                id: `gscpi-${item.date}`,
                name: 'GSCPI',
                value: parseFloat(item.value) || 0,
                date: item.date || new Date().toISOString().slice(0, 10),
                source: 'FRED',
                type: 'Index',
                status: 'active'
            }));
        }
        return [];
    } catch (e) {
        console.warn('[GSCPI] Не удалось получить GSCPI:', e.message);
        return [];
    }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ ДАННЫХ О ДОСТАВКЕ
// ============================================================

async function fetchShippingIndicators() {
    try {
        // Имитация получения данных о доставке
        // В реальности здесь были бы API Baltic Exchange и других
        return [];
    } catch (e) {
        console.warn('[GSCPI] Не удалось получить данные о доставке:', e.message);
        return [];
    }
}

// ============================================================
// 5. ОПРЕДЕЛЕНИЕ УРОВНЯ ДАВЛЕНИЯ
// ============================================================

function getPressureLevel(value) {
    if (value >= 2.0) return PRESSURE_LEVELS.VERY_HIGH;
    if (value >= 1.0) return PRESSURE_LEVELS.HIGH;
    if (value >= 0.3) return PRESSURE_LEVELS.MODERATE;
    if (value >= -0.3) return PRESSURE_LEVELS.NORMAL;
    return PRESSURE_LEVELS.LOW;
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ УРОВНЯ ОПАСНОСТИ
// ============================================================

function detectSupplyChainSeverity(value) {
    if (value >= 2.5) return SEVERITY.CRITICAL;
    if (value >= 1.5) return SEVERITY.HIGH;
    if (value >= 0.5) return SEVERITY.MEDIUM;
    if (value >= -0.5) return SEVERITY.LOW;
    return SEVERITY.NORMAL;
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getSupplyChainSummary(data) {
    const summary = {
        total: data.length,
        currentValue: 0,
        average: 0,
        max: 0,
        min: 0,
        trend: 'stable',
        byType: {},
        pressureLevels: {
            veryHigh: 0,
            high: 0,
            moderate: 0,
            low: 0,
            normal: 0
        },
        criticalCount: 0,
        highCount: 0
    };

    let sum = 0;
    let count = 0;
    let max = -Infinity;
    let min = Infinity;

    // Последнее значение (самое новое)
    if (data.length > 0) {
        summary.currentValue = data[0].value || 0;
    }

    for (const d of data) {
        // По типам
        const type = d.type || 'Unknown';
        summary.byType[type] = (summary.byType[type] || 0) + 1;

        // По уровням давления
        const level = getPressureLevel(d.value);
        if (level === PRESSURE_LEVELS.VERY_HIGH) summary.pressureLevels.veryHigh++;
        if (level === PRESSURE_LEVELS.HIGH) summary.pressureLevels.high++;
        if (level === PRESSURE_LEVELS.MODERATE) summary.pressureLevels.moderate++;
        if (level === PRESSURE_LEVELS.LOW) summary.pressureLevels.low++;
        if (level === PRESSURE_LEVELS.NORMAL) summary.pressureLevels.normal++;

        // Считаем статистику
        if (d.value !== undefined && d.value !== null) {
            sum += d.value;
            count++;
            if (d.value > max) max = d.value;
            if (d.value < min) min = d.value;
        }

        // Критические и высокие значения
        const severity = detectSupplyChainSeverity(d.value);
        if (severity === SEVERITY.CRITICAL) summary.criticalCount++;
        if (severity === SEVERITY.HIGH) summary.highCount++;
    }

    summary.average = count > 0 ? sum / count : 0;
    summary.max = max !== -Infinity ? max : 0;
    summary.min = min !== Infinity ? min : 0;

    // Определяем тренд (сравниваем последние 3 значения)
    if (data.length >= 3) {
        const recent = data.slice(0, 3).map(d => d.value);
        const avg1 = (recent[0] + recent[1]) / 2;
        const avg2 = (recent[1] + recent[2]) / 2;
        if (avg1 > avg2 * 1.05) summary.trend = 'rising';
        else if (avg1 < avg2 * 0.95) summary.trend = 'falling';
        else summary.trend = 'stable';
    }

    return summary;
}

// ============================================================
// 8. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectSupplyChainAlerts(data) {
    const alerts = [];

    if (data.length === 0) return alerts;

    // 1. Текущее значение критическое
    const current = data[0];
    if (current.value >= 2.5) {
        alerts.push({
            type: 'critical_pressure',
            severity: SEVERITY.CRITICAL,
            value: current.value,
            description: `Критическое давление в цепях поставок: ${current.value.toFixed(2)}`,
            date: current.date
        });
    }

    // 2. Резкий рост за последние 7 дней
    if (data.length >= 7) {
        const recent = data.slice(0, 7).map(d => d.value);
        const oldest = recent[recent.length - 1];
        const newest = recent[0];
        const change = ((newest - oldest) / oldest) * 100;

        if (change > 20) {
            alerts.push({
                type: 'sharp_increase',
                severity: SEVERITY.HIGH,
                change: change.toFixed(1),
                description: `Резкий рост давления в цепях поставок: +${change.toFixed(1)}% за 7 дней`,
                date: new Date().toISOString()
            });
        }
    }

    // 3. Высокое давление в течение длительного времени
    if (data.length >= 30) {
        const highValues = data.slice(0, 30).filter(d => d.value > 1.0);
        if (highValues.length > 20) {
            alerts.push({
                type: 'prolonged_pressure',
                severity: SEVERITY.HIGH,
                count: highValues.length,
                description: `Высокое давление в цепях поставок в течение ${highValues.length} из 30 дней`,
                date: new Date().toISOString()
            });
        }
    }

    return alerts;
}

// ============================================================
// 9. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const data = [];

    // Генерируем 90 дней данных GSCPI
    const baseValues = [
        0.82, 0.75, 0.68, 0.63, 0.59, 0.55, 0.52, 0.48, 0.45, 0.42,
        0.38, 0.35, 0.32, 0.28, 0.25, 0.22, 0.18, 0.15, 0.12, 0.08,
        0.05, 0.02, -0.02, -0.05, -0.08, -0.12, -0.15, -0.18, -0.22, -0.25,
        -0.28, -0.32, -0.35, -0.38, -0.42, -0.45, -0.48, -0.52, -0.55, -0.59,
        -0.63, -0.68, -0.75, -0.82, -0.88, -0.95, -1.02, -1.08, -1.15, -1.22,
        -1.28, -1.35, -1.42, -1.48, -1.55, -1.62, -1.68, -1.75, -1.82, -1.88,
        -1.92, -1.95, -1.98, -2.02, -2.05, -2.08, -2.12, -2.15, -2.18, -2.22,
        -2.25, -2.28, -2.32, -2.35, -2.38, -2.42, -2.45, -2.48, -2.52, -2.55,
        -2.58, -2.62, -2.65, -2.68, -2.72, -2.75, -2.78, -2.82, -2.85, -2.88
    ];

    // Добавляем недавний рост (последние 30 дней)
    const recentGrowth = [
        -2.88, -2.85, -2.82, -2.78, -2.75, -2.72, -2.68, -2.65, -2.62, -2.58,
        -2.55, -2.52, -2.48, -2.45, -2.42, -2.38, -2.35, -2.32, -2.28, -2.25,
        -2.22, -2.18, -2.15, -2.12, -2.08, -2.05, -2.02, -1.98, -1.95, -1.92,
        -1.88, -1.82, -1.75, -1.68, -1.62, -1.55, -1.48, -1.42, -1.35, -1.28,
        -1.22, -1.15, -1.08, -1.02, -0.95, -0.88, -0.82, -0.75, -0.68, -0.63,
        -0.59, -0.55, -0.52, -0.48, -0.45, -0.42, -0.38, -0.35, -0.32, -0.28,
        -0.25, -0.22, -0.18, -0.15, -0.12, -0.08, -0.05, -0.02, 0.02, 0.05,
        0.08, 0.12, 0.15, 0.18, 0.22, 0.25, 0.28, 0.32, 0.35, 0.38,
        0.42, 0.45, 0.48, 0.52, 0.55, 0.59, 0.63, 0.68, 0.75, 0.82
    ];

    const allValues = [...baseValues.slice(0, 30), ...recentGrowth];

    for (let i = 0; i < allValues.length && i < 90; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (allValues.length - 1 - i));

        const value = allValues[i] || 0;

        data.push({
            id: `gscpi-${date.toISOString().slice(0, 10)}`,
            name: 'GSCPI',
            value: Math.round(value * 100) / 100,
            date: date.toISOString().slice(0, 10),
            source: 'FRED (DEMO)',
            type: 'Index',
            status: 'active'
        });
    }

    // Добавляем данные о доставке (дополнительный слой)
    const shippingIndicators = [
        { name: 'Baltic Dry Index', value: 2100, date: new Date(now).toISOString().slice(0, 10) },
        { name: 'Freightos Baltic Index', value: 1850, date: new Date(now).toISOString().slice(0, 10) },
        { name: 'Port Congestion Index', value: 75, date: new Date(now).toISOString().slice(0, 10) }
    ];

    for (const si of shippingIndicators) {
        data.push({
            id: `shipping-${Date.now()}-${Math.random()}`,
            name: si.name,
            value: si.value,
            date: si.date,
            source: 'DEMO',
            type: 'Shipping',
            status: 'active'
        });
    }

    // Сортируем по дате (новые сверху)
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    const summary = getSupplyChainSummary(data);
    const alerts = detectSupplyChainAlerts(data);

    console.log(`[GSCPI] Сгенерировано ${data.length} демо-записей`);

    return {
        success: true,
        count: data.length,
        data: data,
        summary: summary,
        alerts: alerts,
        source: 'FRED GSCPI (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 10. API-ОБРАБОТЧИК
// ============================================================

export async function handleGSCPIAPI(req, res) {
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
        // GET /api/gscpi/data — получить данные о цепях поставок
        if (path === '/api/gscpi/data' && req.method === 'GET') {
            const params = url.searchParams;
            const days = parseInt(params.get('days')) || 90;
            const limit = parseInt(params.get('limit')) || 100;

            const data = await fetchSupplyChainData({ days, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/gscpi/status — статус модуля
        if (path === '/api/gscpi/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'GSCPI',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[GSCPI API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 11. ЭКСПОРТ
// ============================================================

export default {
    fetchSupplyChainData,
    handleGSCPIAPI,
    getSupplyChainSummary,
    detectSupplyChainAlerts
};