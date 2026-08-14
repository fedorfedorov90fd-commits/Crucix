#!/usr/bin/env node

// ============================================================
// КРОСС-КОРРЕЛЯЦИОННЫЙ АНАЛИЗАТОР — API
// Модуль №7
// Версия: 2.2
// Дата: 2026-08-13
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ============================================================
// 1. КОНФИГУРАЦИЯ ИСТОЧНИКОВ ДАННЫХ
// ============================================================

const SOURCES = {
  index: {
    id: 'index',
    name: 'Глобальный индекс',
    icon: '📊',
    description: 'Глобальный индекс напряжённости',
    files: [
      join(ROOT, 'data', 'geo', 'index-history.json')
    ],
    parse: function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || item.timestamp?.slice(0, 10) || '',
        value: parseFloat(item.value || item.index || 0)
      })).filter(item => item.date);
    }
  },

  news: {
    id: 'news',
    name: 'Новости (RSS)',
    icon: '📰',
    description: 'Новости из RSS-лент (ежедневные файлы)',
    files: function() {
      const rawDir = join(ROOT, 'data', 'raw');
      return rawDir;
    },
    parse: function(data) {
      let items = Array.isArray(data) ? data : [];

      if (!Array.isArray(items) && typeof items === 'object') {
        for (const key of ['items', 'news', 'feeds', 'articles', 'data']) {
          if (Array.isArray(items[key])) {
            items = items[key];
            break;
          }
        }
      }

      if (!Array.isArray(items)) return [];

      const daily = {};
      for (const item of items) {
        let date = '';

        // Парсим pubDate (формат: "Thu, 13 Aug 2026 17:56:55 +0300")
        if (item.pubDate) {
          try {
            const d = new Date(item.pubDate);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          } catch(e) {}
        }

        // Если не получилось — пробуем другие поля
        if (!date && item.date) {
          try {
            const d = new Date(item.date);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          } catch(e) {}
        }

        if (!date && item.collectedAt) {
          try {
            const d = new Date(item.collectedAt);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          } catch(e) {}
        }

        if (date) {
          daily[date] = (daily[date] || 0) + 1;
        }
      }

      return Object.entries(daily).map(([date, value]) => ({
        date: date,
        value: value
      })).sort((a, b) => a.date.localeCompare(b.date));
    }
  },

  basket: {
    id: 'basket',
    name: 'Новости (корзина)',
    icon: '📦',
    description: 'Новости из корзины данных',
    files: function() {
      const basketDir = join(ROOT, 'data', 'basket');
      return basketDir;
    },
    parse: function(data) {
      let items = Array.isArray(data) ? data : [];

      if (!Array.isArray(items) && typeof items === 'object') {
        for (const key of ['items', 'news', 'data']) {
          if (Array.isArray(items[key])) {
            items = items[key];
            break;
          }
        }
      }

      if (!Array.isArray(items)) return [];

      const daily = {};
      for (const item of items) {
        let date = '';

        if (item.date) {
          try {
            const d = new Date(item.date);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          } catch(e) {}
        }

        if (!date && item.collectedAt) {
          try {
            const d = new Date(item.collectedAt);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          } catch(e) {}
        }

        if (date) {
          daily[date] = (daily[date] || 0) + 1;
        }
      }

      return Object.entries(daily).map(([date, value]) => ({
        date: date,
        value: value
      })).sort((a, b) => a.date.localeCompare(b.date));
    }
  },

  events: {
    id: 'events',
    name: 'События',
    icon: '📌',
    description: 'События с корреляцией',
    files: [
      join(ROOT, 'data', 'analysis', 'events-cache.json')
    ],
    parse: function(data) {
      let events = [];

      if (Array.isArray(data)) {
        events = data;
      } else if (data.events && Array.isArray(data.events)) {
        events = data.events;
      } else if (data.data && Array.isArray(data.data)) {
        events = data.data;
      }

      const daily = {};
      for (const event of events) {
        let date = '';

        if (event.date) {
          try {
            const d = new Date(event.date);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          } catch(e) {}
        }

        if (date) {
          const value = parseFloat(event.correlation || event.impact || 1);
          daily[date] = (daily[date] || 0) + value;
        }
      }

      return Object.entries(daily).map(([date, value]) => ({
        date: date,
        value: Math.round(value * 100) / 100
      })).sort((a, b) => a.date.localeCompare(b.date));
    }
  },

  thermal: {
    id: 'thermal',
    name: 'Термальные (FIRMS)',
    icon: '🔥',
    description: 'Термальные аномалии из FIRMS',
    files: [
      join(ROOT, 'data', 'thermal', 'history.json')
    ],
    parse: function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || item.timestamp?.slice(0, 10) || '',
        value: parseFloat(item.value || item.detections || 0)
      })).filter(item => item.date);
    }
  },

  economy: {
    id: 'economy',
    name: 'Экономика (FRED)',
    icon: '💰',
    description: 'Экономические показатели из FRED',
    files: [
      join(ROOT, 'data', 'economy', 'history.json')
    ],
    parse: function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || item.timestamp?.slice(0, 10) || '',
        value: parseFloat(item.value || item.index || 0)
      })).filter(item => item.date);
    }
  },

  aviation: {
    id: 'aviation',
    name: 'Авиация (OpenSky)',
    icon: '✈️',
    description: 'Данные авиационного трафика',
    files: [
      join(ROOT, 'data', 'aviation', 'history.json')
    ],
    parse: function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || item.timestamp?.slice(0, 10) || '',
        value: parseFloat(item.value || item.flights || 0)
      })).filter(item => item.date);
    }
  },

  conflicts: {
    id: 'conflicts',
    name: 'Конфликты (ACLED)',
    icon: '⚔️',
    description: 'Данные о конфликтах из ACLED',
    files: [
      join(ROOT, 'data', 'conflicts', 'history.json')
    ],
    parse: function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || item.timestamp?.slice(0, 10) || '',
        value: parseFloat(item.value || item.events || 0)
      })).filter(item => item.date);
    }
  }
};

// ============================================================
// 2. ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadSourceData(sourceId) {
  const source = SOURCES[sourceId];
  if (!source) {
    console.error(`[Correlation] Источник ${sourceId} не найден`);
    return [];
  }

  let allData = [];
  let fileList = [];

  let filesConfig = source.files;
  if (typeof filesConfig === 'function') {
    const dir = filesConfig();
    if (typeof dir === 'string') {
      try {
        const entries = await fs.readdir(dir);
        fileList = entries
          .filter(f => f.endsWith('.json'))
          .map(f => join(dir, f))
          .sort();
        console.log(`[Correlation] Найдено ${fileList.length} файлов в ${dir}`);
      } catch (e) {
        console.error(`[Correlation] Ошибка чтения папки ${dir}:`, e.message);
        return [];
      }
    } else if (Array.isArray(dir)) {
      fileList = dir;
    }
  } else if (Array.isArray(filesConfig)) {
    fileList = filesConfig;
  }

  for (const file of fileList) {
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) continue;

      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);

      let parsed = source.parse(data, file);

      if (!Array.isArray(parsed) && typeof parsed === 'object') {
        for (const key of ['items', 'news', 'events', 'data', 'feeds', 'results']) {
          if (Array.isArray(parsed[key])) {
            parsed = parsed[key];
            break;
          }
        }
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(item => item.date);
        allData = allData.concat(valid);
        console.log(`[Correlation] Загружено ${valid.length} записей из ${file}`);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error(`[Correlation] Ошибка загрузки ${file}:`, e.message);
      }
    }
  }

  const aggregated = {};
  for (const item of allData) {
    const date = item.date;
    if (date) {
      aggregated[date] = (aggregated[date] || 0) + (item.value || 0);
    }
  }

  const result = Object.entries(aggregated)
    .map(([date, value]) => ({
      date: date,
      value: Math.round(value * 100) / 100
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`[Correlation] Источник ${sourceId}: ${result.length} дней данных (${result[0]?.date || '—'} — ${result[result.length-1]?.date || '—'})`);
  return result;
}

// ============================================================
// 3. СТАТИСТИЧЕСКИЕ ФУНКЦИИ
// ============================================================

function calculateCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

function findOptimalLag(x, y, maxLag = 7) {
  const results = [];

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let xShifted, yShifted;
    if (lag >= 0) {
      xShifted = x.slice(lag);
      yShifted = y.slice(0, y.length - lag);
    } else {
      xShifted = x.slice(0, x.length + lag);
      yShifted = y.slice(-lag);
    }
    const corr = calculateCorrelation(xShifted, yShifted);
    results.push({ lag, correlation: Math.round(corr * 10000) / 10000 });
  }

  const best = results.reduce((a, b) =>
    Math.abs(a.correlation) > Math.abs(b.correlation) ? a : b
  );

  return {
    bestLag: best.lag,
    bestCorrelation: Math.round(best.correlation * 10000) / 10000,
    all: results
  };
}

function interpretCorrelation(corr, lag) {
  const strength = Math.abs(corr);
  let label = '';
  if (strength >= 0.8) label = 'Очень сильная';
  else if (strength >= 0.6) label = 'Сильная';
  else if (strength >= 0.4) label = 'Средняя';
  else if (strength >= 0.2) label = 'Слабая';
  else label = 'Очень слабая';

  const direction = corr > 0 ? 'прямая' : 'обратная';
  let lagText = '';
  if (lag > 0) lagText = `(${lag} день назад)`;
  else if (lag < 0) lagText = `(на ${Math.abs(lag)} день вперед)`;
  else lagText = '(без задержки)';

  return `${label} ${direction} корреляция ${lagText}`;
}

// ============================================================
// 4. ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА
// ============================================================

async function analyzeCorrelation(source1, source2, days = 30) {
  console.log(`[Correlation] Анализ: ${source1} vs ${source2}, дней: ${days}`);

  const data1 = await loadSourceData(source1);
  const data2 = await loadSourceData(source2);

  if (!data1 || data1.length === 0) {
    return { error: `Нет данных для источника: ${source1}` };
  }
  if (!data2 || data2.length === 0) {
    return { error: `Нет данных для источника: ${source2}` };
  }

  const dates1 = data1.map(d => d.date);
  const dates2 = data2.map(d => d.date);
  const commonDates = dates1.filter(d => dates2.includes(d)).slice(-days);

  if (commonDates.length < 3) {
    return {
      error: `Недостаточно общих точек для анализа (найдено ${commonDates.length}, нужно минимум 3)`
    };
  }

  const dateMap1 = Object.fromEntries(data1.map(d => [d.date, d.value]));
  const dateMap2 = Object.fromEntries(data2.map(d => [d.date, d.value]));

  const values1 = commonDates.map(d => dateMap1[d] || 0);
  const values2 = commonDates.map(d => dateMap2[d] || 0);

  const corr = calculateCorrelation(values1, values2);
  const lagResult = findOptimalLag(values1, values2);

  console.log(`[Correlation] Результат: корреляция ${corr.toFixed(4)}, оптимальная задержка ${lagResult.bestLag}`);

  return {
    source1,
    source2,
    source1Name: SOURCES[source1]?.name || source1,
    source2Name: SOURCES[source2]?.name || source2,
    days: commonDates.length,
    dates: commonDates,
    values1: values1.map(v => Math.round(v * 100) / 100),
    values2: values2.map(v => Math.round(v * 100) / 100),
    correlation: Math.round(corr * 10000) / 10000,
    optimalLag: lagResult.bestLag,
    optimalCorrelation: lagResult.bestCorrelation,
    allLags: lagResult.all,
    interpretation: interpretCorrelation(corr, lagResult.bestLag),
    dataPoints: commonDates.length
  };
}

// ============================================================
// 5. КОРРЕЛЯЦИОННАЯ МАТРИЦА
// ============================================================

async function getCorrelationMatrix(days = 30) {
  const sourceIds = Object.keys(SOURCES);
  const matrix = {};
  const results = [];

  for (let i = 0; i < sourceIds.length; i++) {
    const s1 = sourceIds[i];
    matrix[s1] = {};
    for (let j = 0; j < sourceIds.length; j++) {
      const s2 = sourceIds[j];
      if (s1 === s2) {
        matrix[s1][s2] = 1;
      } else if (matrix[s2] && matrix[s2][s1] !== undefined) {
        matrix[s1][s2] = matrix[s2][s1];
      } else {
        const result = await analyzeCorrelation(s1, s2, days);
        if (!result.error) {
          matrix[s1][s2] = result.correlation;
          results.push({
            source1: s1,
            source2: s2,
            source1Name: SOURCES[s1]?.name || s1,
            source2Name: SOURCES[s2]?.name || s2,
            correlation: result.correlation,
            interpretation: result.interpretation
          });
        } else {
          matrix[s1][s2] = 0;
        }
      }
    }
  }

  return { matrix, results };
}

// ============================================================
// 6. ПОИСК АНОМАЛЬНЫХ КОРРЕЛЯЦИЙ
// ============================================================

async function findAnomalousCorrelations(threshold = 0.7, days = 30) {
  const sourceIds = Object.keys(SOURCES);
  const anomalies = [];

  for (let i = 0; i < sourceIds.length; i++) {
    for (let j = i + 1; j < sourceIds.length; j++) {
      const result = await analyzeCorrelation(sourceIds[i], sourceIds[j], days);

      if (!result.error && Math.abs(result.correlation) > threshold) {
        anomalies.push({
          source1: sourceIds[i],
          source2: sourceIds[j],
          source1Name: SOURCES[sourceIds[i]]?.name || sourceIds[i],
          source2Name: SOURCES[sourceIds[j]]?.name || sourceIds[j],
          correlation: result.correlation,
          optimalLag: result.optimalLag,
          optimalCorrelation: result.optimalCorrelation,
          interpretation: result.interpretation,
          date: new Date().toISOString()
        });
      }
    }
  }

  return anomalies;
}

// ============================================================
// 7. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleCorrelationAPI(req, res) {
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

  if (path === '/api/correlation/calculate' && req.method === 'GET') {
    const source1 = url.searchParams.get('source1') || 'index';
    const source2 = url.searchParams.get('source2') || 'news';
    const days = parseInt(url.searchParams.get('days')) || 30;

    const result = await analyzeCorrelation(source1, source2, days);

    if (result.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: result.error }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    }
    return;
  }

  if (path === '/api/correlation/matrix' && req.method === 'GET') {
    const days = parseInt(url.searchParams.get('days')) || 30;
    const result = await getCorrelationMatrix(days);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result, days }));
    return;
  }

  if (path === '/api/correlation/anomalies' && req.method === 'GET') {
    const threshold = parseFloat(url.searchParams.get('threshold')) || 0.7;
    const days = parseInt(url.searchParams.get('days')) || 30;

    const anomalies = await findAnomalousCorrelations(threshold, days);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, anomalies, threshold, days }));
    return;
  }

  if (path === '/api/correlation/sources' && req.method === 'GET') {
    const sources = Object.entries(SOURCES).map(([id, info]) => ({
      id,
      name: info.name,
      icon: info.icon,
      description: info.description || ''
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sources }));
    return;
  }

  if (path === '/api/correlation/status' && req.method === 'GET') {
    const status = {};
    for (const [id, source] of Object.entries(SOURCES)) {
      const data = await loadSourceData(id);
      status[id] = {
        name: source.name,
        icon: source.icon,
        count: data.length,
        firstDate: data.length > 0 ? data[0]?.date : null,
        lastDate: data.length > 0 ? data[data.length - 1]?.date : null
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, status }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

// ============================================================
// 8. ЭКСПОРТ
// ============================================================

export default {
  analyzeCorrelation,
  getCorrelationMatrix,
  findAnomalousCorrelations,
  handleCorrelationAPI,
  loadSourceData,
  SOURCES
};
