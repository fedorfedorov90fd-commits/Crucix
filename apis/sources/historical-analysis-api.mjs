/**
 * Модуль №6: Сравнительный исторический анализ
 * API для анализа истории индекса напряжённости
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_FILE = path.join(__dirname, '../../data/geo/index-history.json');
const DATA_DIR = path.join(__dirname, '../../data/geo');

// Убедимся, что папка существует
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Загрузить историю индекса
 */
function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            return [];
        }
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[HistoricalAnalysis] Ошибка загрузки истории:', error);
        return [];
    }
}

/**
 * Сохранить историю (для тестов)
 */
function saveHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch (error) {
        console.error('[HistoricalAnalysis] Ошибка сохранения истории:', error);
        return false;
    }
}

/**
 * Получить последние N записей
 */
function getLastN(history, n) {
    if (n <= 0 || n >= history.length) {
        return history;
    }
    return history.slice(-n);
}

/**
 * Рассчитать среднее значение индекса
 */
function calculateAverage(history) {
    if (history.length === 0) return 0;
    const sum = history.reduce((s, d) => s + d.index, 0);
    return sum / history.length;
}

/**
 * Рассчитать стандартное отклонение
 */
function calculateStdDev(history) {
    if (history.length === 0) return 0;
    const avg = calculateAverage(history);
    const squaredDiffs = history.map(d => Math.pow(d.index - avg, 2));
    const variance = squaredDiffs.reduce((s, d) => s + d, 0) / history.length;
    return Math.sqrt(variance);
}

/**
 * Найти аномалии (выбросы)
 * Аномалия = значение, отличающееся от среднего более чем на порог * stdDev
 */
function findAnomalies(history, threshold = 2) {
    if (history.length < 3) return [];

    const avg = calculateAverage(history);
    const stdDev = calculateStdDev(history);

    if (stdDev === 0) return [];

    return history
        .map((d, i) => ({
            ...d,
            index: i,
            diff: Math.abs(d.index - avg),
            isAnomaly: Math.abs(d.index - avg) > threshold * stdDev
        }))
        .filter(d => d.isAnomaly)
        .map(d => ({
            date: d.date,
            index: d.index,
            diff: d.diff,
            threshold: threshold * stdDev,
            components: d.components || {}
        }));
}

/**
 * Сравнить текущий индекс с периодом
 */
function compareWithPeriod(history, days) {
    if (history.length === 0) {
        return { error: 'Нет данных' };
    }

    const current = history[history.length - 1];
    const periodData = getLastN(history, days);

    if (periodData.length === 0) {
        return { error: 'Недостаточно данных для периода' };
    }

    const avg = calculateAverage(periodData);
    const diff = current.index - avg;
    const percent = avg !== 0 ? ((diff / avg) * 100) : 0;

    // Определяем статус
    let status = 'стабильно';
    if (diff > 2) status = '🔺 рост';
    else if (diff > 1) status = '📈 небольшой рост';
    else if (diff < -2) status = '🔻 падение';
    else if (diff < -1) status = '📉 небольшое падение';

    return {
        current: current.index,
        currentDate: current.date,
        period: days,
        periodStart: periodData[0]?.date || 'неизвестно',
        periodEnd: periodData[periodData.length - 1]?.date || 'неизвестно',
        average: avg,
        diff: diff,
        percent: percent.toFixed(1),
        status: status,
        dataCount: periodData.length,
        components: current.components || {}
    };
}

/**
 * Простой прогноз на основе линейной регрессии
 */
function predictTrend(history, days = 7) {
    if (history.length < 5) {
        return { error: 'Недостаточно данных для прогноза (нужно минимум 5 дней)' };
    }

    // Берём последние 30 дней для прогноза
    const data = getLastN(history, 30);
    if (data.length < 5) {
        return { error: 'Недостаточно данных для прогноза' };
    }

    // Линейная регрессия
    const n = data.length;
    const indices = data.map((_, i) => i);
    const values = data.map(d => d.index);

    const sumX = indices.reduce((s, x) => s + x, 0);
    const sumY = values.reduce((s, y) => s + y, 0);
    const sumXY = indices.reduce((s, x, i) => s + x * values[i], 0);
    const sumX2 = indices.reduce((s, x) => s + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Прогноз на days дней вперёд
    const predictions = [];
    const lastDate = new Date(data[data.length - 1].date);

    for (let i = 1; i <= days; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + i);
        const predValue = slope * (n + i) + intercept;
        predictions.push({
            date: nextDate.toISOString().split('T')[0],
            index: Math.max(0, Math.min(10, predValue)), // Ограничиваем 0-10
            trend: slope > 0 ? 'rising' : 'falling'
        });
    }

    return {
        predictions,
        slope: slope,
        intercept: intercept,
        lastValue: values[values.length - 1],
        trend: slope > 0.01 ? '📈 рост' : slope < -0.01 ? '📉 падение' : '➡️ стабильно',
        confidence: Math.min(80, Math.max(40, 80 - (days - 7) * 2)) // Уверенность падает с дальностью
    };
}

/**
 * Получить статистику по индексу
 */
function getStatistics(history) {
    if (history.length === 0) {
        return { error: 'Нет данных' };
    }

    const values = history.map(d => d.index);
    const avg = calculateAverage(history);
    const stdDev = calculateStdDev(history);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minDate = history.find(d => d.index === min)?.date || 'неизвестно';
    const maxDate = history.find(d => d.index === max)?.date || 'неизвестно';
    const latest = history[history.length - 1];
    const first = history[0];
    const totalChange = latest.index - first.index;
    const totalChangePercent = first.index !== 0 ? ((totalChange / first.index) * 100) : 0;

    // Находим аномалии
    const anomalies = findAnomalies(history);

    return {
        totalDays: history.length,
        average: avg,
        stdDev: stdDev,
        min: min,
        minDate: minDate,
        max: max,
        maxDate: maxDate,
        latest: latest.index,
        latestDate: latest.date,
        first: first.index,
        firstDate: first.date,
        totalChange: totalChange,
        totalChangePercent: totalChangePercent.toFixed(1),
        anomaliesCount: anomalies.length,
        anomalyDates: anomalies.map(a => a.date).slice(0, 10) // Топ 10
    };
}

/**
 * Получить данные для календарного графика (по месяцам)
 */
function getMonthlyData(history) {
    if (history.length === 0) return [];

    const monthly = {};
    history.forEach(d => {
        const month = d.date.substring(0, 7); // YYYY-MM
        if (!monthly[month]) {
            monthly[month] = { dates: [], values: [] };
        }
        monthly[month].dates.push(d.date);
        monthly[month].values.push(d.index);
    });

    return Object.keys(monthly).map(month => {
        const data = monthly[month];
        return {
            month: month,
            avg: data.values.reduce((s, v) => s + v, 0) / data.values.length,
            min: Math.min(...data.values),
            max: Math.max(...data.values),
            count: data.values.length,
            dates: data.dates
        };
    });
}

/**
 * ГЛАВНЫЙ ОБРАБОТЧИК API
 */
export async function handleHistoricalAnalysisAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Загружаем историю
    const history = loadHistory();

    if (history.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Нет данных в истории индекса',
            history: []
        }));
        return;
    }

    try {
        // --- ЭНДПОИНТЫ ---

        // 1. ВСЯ ИСТОРИЯ
        if (pathname === '/api/analysis/history') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                history: history,
                total: history.length,
                firstDate: history[0]?.date || null,
                lastDate: history[history.length - 1]?.date || null
            }));
            return;
        }

        // 2. СТАТИСТИКА
        if (pathname === '/api/analysis/statistics') {
            const stats = getStatistics(history);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats
            }));
            return;
        }

        // 3. СРАВНЕНИЕ С ПЕРИОДОМ
        if (pathname === '/api/analysis/compare') {
            const params = new URLSearchParams(url.search);
            const days = parseInt(params.get('days')) || 30;

            if (days < 1) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Количество дней должно быть больше 0'
                }));
                return;
            }

            const comparison = compareWithPeriod(history, days);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...comparison
            }));
            return;
        }

        // 4. АНОМАЛИИ
        if (pathname === '/api/analysis/anomalies') {
            const params = new URLSearchParams(url.search);
            const threshold = parseFloat(params.get('threshold')) || 2;

            const anomalies = findAnomalies(history, threshold);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                anomalies: anomalies,
                count: anomalies.length,
                threshold: threshold
            }));
            return;
        }

        // 5. ПРОГНОЗ
        if (pathname === '/api/analysis/predict') {
            const params = new URLSearchParams(url.search);
            const days = parseInt(params.get('days')) || 7;

            if (days < 1 || days > 30) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Прогноз возможен на 1-30 дней'
                }));
                return;
            }

            const prediction = predictTrend(history, days);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...prediction
            }));
            return;
        }

        // 6. МЕСЯЧНАЯ СТАТИСТИКА
        if (pathname === '/api/analysis/monthly') {
            const monthly = getMonthlyData(history);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                monthly: monthly
            }));
            return;
        }

        // 7. ЗНАЧЕНИЕ НА КОНКРЕТНУЮ ДАТУ
        if (pathname === '/api/analysis/date') {
            const params = new URLSearchParams(url.search);
            const date = params.get('date');

            if (!date) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Укажите дату в формате YYYY-MM-DD'
                }));
                return;
            }

            const entry = history.find(d => d.date === date);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                found: !!entry,
                data: entry || null
            }));
            return;
        }

        // 404 - неизвестный эндпоинт
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный эндпоинт'
        }));

    } catch (error) {
        console.error('[HistoricalAnalysis] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// Экспорт для server.mjs
export default {
    handleHistoricalAnalysisAPI
};
