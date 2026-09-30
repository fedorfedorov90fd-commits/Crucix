/**
 * temporal-analysis.mjs — Временной анализ событий
 *
 * Выявляет тренды, сезонность, аномалии во времени
 * Аналог Crucix: анализ временных рядов и прогнозирование
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';

/**
 * Анализ временного ряда для слоя
 */
export function analyzeTemporal(layerId, options = {}) {
  const { interval = 'day', periods = 30, forecast = 7 } = options;

  // Загружаем данные
  const data = loadLayerData(layerId);
  if (!data || data.length === 0) {
    return { success: false, error: 'Нет данных для анализа' };
  }

  // Извлекаем временные метки
  const timestamps = [];
  const values = [];

  for (const item of data) {
    const date = new Date(item.date || item.timestamp || item.time);
    if (!isNaN(date.getTime())) {
      timestamps.push(date);
      values.push({
        date: date,
        value: item.value || item.count || item.intensity || 1,
        data: item
      });
    }
  }

  if (timestamps.length < 2) {
    return { success: false, error: 'Недостаточно данных для анализа' };
  }

  // Сортируем по времени
  timestamps.sort((a, b) => a - b);
  values.sort((a, b) => a.date - b.date);

  // Агрегация по интервалу
  const aggregated = aggregateByInterval(values, interval);

  // Вычисление тренда
  const trend = calculateTrend(aggregated);

  // Поиск сезонности
  const seasonality = detectSeasonality(aggregated);

  // Поиск аномалий
  const anomalies = detectAnomalies(aggregated);

  // Прогнозирование
  const prediction = forecastData(aggregated, forecast);

  return {
    success: true,
    layerId,
    stats: {
      totalPoints: values.length,
      dateRange: {
        from: timestamps[0].toISOString(),
        to: timestamps[timestamps.length - 1].toISOString()
      }
    },
    aggregated: aggregated.slice(-periods),
    trend: trend,
    seasonality: seasonality,
    anomalies: anomalies,
    prediction: prediction
  };
}

/**
 * Загрузка данных слоя
 */
function loadLayerData(layerId) {
  const files = readdirSync(BASKET_DIR);
  const pattern = new RegExp(`^${layerId}[.-]`);
  for (const file of files) {
    if (pattern.test(file)) {
      try {
        const data = readFileSync(join(BASKET_DIR, file), 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : (parsed.data || []);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Агрегация по интервалу
 */
function aggregateByInterval(values, interval) {
  const grouped = {};

  for (const v of values) {
    let key;
    const date = v.date;
    switch (interval) {
      case 'hour': key = date.toISOString().slice(0, 13); break;
      case 'day': key = date.toISOString().slice(0, 10); break;
      case 'week':
        const week = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / 604800000);
        key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
        break;
      case 'month': key = date.toISOString().slice(0, 7); break;
      case 'year': key = date.toISOString().slice(0, 4); break;
      default: key = date.toISOString().slice(0, 10);
    }

    if (!grouped[key]) {
      grouped[key] = { period: key, count: 0, sum: 0, avg: 0, values: [] };
    }
    grouped[key].count++;
    grouped[key].sum += v.value;
    grouped[key].values.push(v.value);
  }

  const result = Object.values(grouped);
  for (const g of result) {
    g.avg = g.sum / g.count;
    g.min = Math.min(...g.values);
    g.max = Math.max(...g.values);
  }

  result.sort((a, b) => a.period.localeCompare(b.period));
  return result;
}

/**
 * Вычисление тренда (линейная регрессия)
 */
function calculateTrend(data) {
  if (data.length < 2) return { slope: 0, intercept: 0, direction: 'stable' };

  const n = data.length;
  const indices = data.map((_, i) => i);
  const values = data.map(d => d.avg);

  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((a, b, i) => a + b * values[i], 0);
  const sumX2 = indices.reduce((a, b) => a + b * b, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  let direction = 'stable';
  if (slope > 0.1) direction = 'increasing';
  else if (slope < -0.1) direction = 'decreasing';

  return { slope, intercept, direction };
}

/**
 * Обнаружение сезонности
 */
function detectSeasonality(data) {
  if (data.length < 7) return { hasSeasonality: false };

  // Проверка на недельную сезонность (7 дней)
  const weekly = [];
  for (let i = 0; i < data.length; i++) {
    const dayOfWeek = new Date(data[i].period).getDay();
    weekly.push(dayOfWeek);
  }

  // Проверка на повторяемость паттернов
  let patternDetected = false;
  const firstWeek = data.slice(0, 7).map(d => d.avg);

  for (let i = 7; i < data.length - 7; i += 7) {
    const week = data.slice(i, i + 7).map(d => d.avg);
    let similarity = 0;
    for (let j = 0; j < Math.min(firstWeek.length, week.length); j++) {
      similarity += Math.abs(firstWeek[j] - week[j]);
    }
    similarity /= Math.min(firstWeek.length, week.length);
    if (similarity < 0.3) {
      patternDetected = true;
      break;
    }
  }

  return {
    hasSeasonality: patternDetected,
    period: patternDetected ? 'weekly' : null,
    confidence: patternDetected ? 0.6 : 0
  };
}

/**
 * Обнаружение аномалий
 */
function detectAnomalies(data) {
  if (data.length < 3) return [];

  const values = data.map(d => d.avg);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);

  const anomalies = [];
  const threshold = 2.5;

  for (let i = 0; i < data.length; i++) {
    const zScore = Math.abs((data[i].avg - mean) / (std || 1));
    if (zScore > threshold) {
      anomalies.push({
        period: data[i].period,
        value: data[i].avg,
        zScore: zScore,
        severity: zScore > 4 ? 'critical' : 'warning'
      });
    }
  }

  return anomalies;
}

/**
 * Прогнозирование (простое скользящее среднее)
 */
function forecastData(data, periods) {
  if (data.length < 3) {
    return { success: false, error: 'Недостаточно данных для прогноза' };
  }

  const values = data.map(d => d.avg);
  const lastValues = values.slice(-5);
  const avgChange = lastValues.reduce((a, b, i, arr) => {
    if (i === 0) return 0;
    return a + (b - arr[i-1]);
  }, 0) / (lastValues.length - 1);

  const lastPeriod = data[data.length - 1];
  const lastDate = new Date(lastPeriod.period);

  const forecast = [];
  for (let i = 0; i < periods; i++) {
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + i + 1);
    const value = lastPeriod.avg + avgChange * (i + 1);
    forecast.push({
      period: nextDate.toISOString().slice(0, 10),
      predicted: Math.max(0, value),
      confidence: 1 - (i / periods) * 0.5
    });
  }

  return {
    method: 'linear_trend',
    periods: forecast.length,
    data: forecast
  };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/temporal/analyze/:layerId', method: 'GET', handler: analyzeTemporal }
];

export default {
  analyzeTemporal,
  endpoints
};
