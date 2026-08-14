#!/usr/bin/env node

// ============================================================
// EIA — ЭНЕРГЕТИЧЕСКИЙ МОНИТОРИНГ
// ============================================================
// Источник: U.S. Energy Information Administration (EIA)
// Данные: нефть, газ, электричество, уголь
// Обновление: ежедневно
// Версия: 2.1 (исправлена работа с демо-данными)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// EIA API (бесплатный ключ можно получить на eia.gov)
const EIA_API_KEY = process.env.EIA_API_KEY || 'DEMO';
const EIA_BASE_URL = 'https://api.eia.gov/v2';

// Основные серии данных
const SERIES = {
  WTI: 'PET.RWTC.D',
  BRENT: 'PET.RBRTE.D',
  CRUDE_INVENTORY: 'PET.WCRSTUS1.W',
  NATURAL_GAS_PRICE: 'NG.RNGWHHD.D',
  NATURAL_GAS_STORAGE: 'NG.NW2_EPG0_SWO_R48_BCF.W',
  ELECTRICITY_PRICE: 'ELEC.PRICE.US.AVG',
  COAL_PRICE: 'COAL.PRICE.US.AVG'
};

const CATEGORIES = {
  OIL: 'Нефть',
  GAS: 'Природный газ',
  ELECTRICITY: 'Электричество',
  COAL: 'Уголь',
  RENEWABLES: 'Возобновляемая энергия'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchEnergyData(options = {}) {
  const {
    category = null,
    limit = 50,
    days = 30
  } = options;

  try {
    console.log('[EIA] Запрос энергетических данных...');

    // Пытаемся получить реальные данные
    let oilData = await fetchOilData();
    let gasData = await fetchGasData();
    let electricityData = await fetchElectricityData();
    let coalData = await fetchCoalData();

    // Если все данные пустые — используем демо
    if (oilData.length === 0 && gasData.length === 0 &&
        electricityData.length === 0 && coalData.length === 0) {
      console.log('[EIA] Реальные данные недоступны, использую демо-данные');
      return getDemoData();
    }

    // Объединяем все данные
    let allData = [...oilData, ...gasData, ...electricityData, ...coalData];

    // Фильтр по категории
    if (category) {
      allData = allData.filter(d => d.category === category);
    }

    // Сортируем по дате (новые сверху)
    allData.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Статистика
    const summary = getEnergySummary(allData);
    const anomalies = detectEnergyAnomalies(allData);

    console.log(`[EIA] Получено ${allData.length} записей`);

    return {
      success: true,
      count: allData.length,
      data: allData.slice(0, limit),
      summary: summary,
      anomalies: anomalies,
      source: 'EIA (U.S. Energy Information Administration)',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[EIA] Ошибка:', error.message);
    console.warn('[EIA] Использую демо-данные');
    return getDemoData();
  }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ДАННЫХ ПО НЕФТИ
// ============================================================

async function fetchOilData() {
  try {
    if (EIA_API_KEY === 'DEMO') return [];
    const url = `${EIA_BASE_URL}/petroleum/data?api_key=${EIA_API_KEY}&limit=50`;
    const response = await fetchWithRetry(url, { timeout: 10000 });
    const data = await response.json();

    if (data.response && data.response.data) {
      return data.response.data.map(item => ({
        id: `oil-${item.period}`,
        category: CATEGORIES.OIL,
        series: item.series || 'WTI',
        value: parseFloat(item.value) || 0,
        unit: '$/bbl',
        date: item.period || new Date().toISOString(),
        source: 'EIA'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[EIA] Не удалось получить данные по нефти:', e.message);
    return [];
  }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ ДАННЫХ ПО ГАЗУ
// ============================================================

async function fetchGasData() {
  try {
    if (EIA_API_KEY === 'DEMO') return [];
    const url = `${EIA_BASE_URL}/natural-gas/data?api_key=${EIA_API_KEY}&limit=50`;
    const response = await fetchWithRetry(url, { timeout: 10000 });
    const data = await response.json();

    if (data.response && data.response.data) {
      return data.response.data.map(item => ({
        id: `gas-${item.period}`,
        category: CATEGORIES.GAS,
        series: 'Henry Hub',
        value: parseFloat(item.value) || 0,
        unit: '$/MMBtu',
        date: item.period || new Date().toISOString(),
        source: 'EIA'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[EIA] Не удалось получить данные по газу:', e.message);
    return [];
  }
}

// ============================================================
// 5. ПОЛУЧЕНИЕ ДАННЫХ ПО ЭЛЕКТРИЧЕСТВУ
// ============================================================

async function fetchElectricityData() {
  try {
    if (EIA_API_KEY === 'DEMO') return [];
    const url = `${EIA_BASE_URL}/electricity/data?api_key=${EIA_API_KEY}&limit=50`;
    const response = await fetchWithRetry(url, { timeout: 10000 });
    const data = await response.json();

    if (data.response && data.response.data) {
      return data.response.data.map(item => ({
        id: `elec-${item.period}`,
        category: CATEGORIES.ELECTRICITY,
        series: 'US Average',
        value: parseFloat(item.value) || 0,
        unit: '¢/kWh',
        date: item.period || new Date().toISOString(),
        source: 'EIA'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[EIA] Не удалось получить данные по электричеству:', e.message);
    return [];
  }
}

// ============================================================
// 6. ПОЛУЧЕНИЕ ДАННЫХ ПО УГЛЮ
// ============================================================

async function fetchCoalData() {
  try {
    if (EIA_API_KEY === 'DEMO') return [];
    const url = `${EIA_BASE_URL}/coal/data?api_key=${EIA_API_KEY}&limit=50`;
    const response = await fetchWithRetry(url, { timeout: 10000 });
    const data = await response.json();

    if (data.response && data.response.data) {
      return data.response.data.map(item => ({
        id: `coal-${item.period}`,
        category: CATEGORIES.COAL,
        series: 'US Average',
        value: parseFloat(item.value) || 0,
        unit: '$/short ton',
        date: item.period || new Date().toISOString(),
        source: 'EIA'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[EIA] Не удалось получить данные по углю:', e.message);
    return [];
  }
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getEnergySummary(data) {
  const summary = {
    total: data.length,
    byCategory: {},
    latest: {},
    averages: {}
  };

  for (const d of data) {
    const cat = d.category || 'Unknown';
    summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
  }

  const latestByCategory = {};
  for (const d of data) {
    const cat = d.category || 'Unknown';
    if (!latestByCategory[cat] || new Date(d.date) > new Date(latestByCategory[cat].date)) {
      latestByCategory[cat] = d;
    }
  }
  summary.latest = latestByCategory;

  const avgByCategory = {};
  const countByCategory = {};
  for (const d of data) {
    const cat = d.category || 'Unknown';
    avgByCategory[cat] = (avgByCategory[cat] || 0) + (d.value || 0);
    countByCategory[cat] = (countByCategory[cat] || 0) + 1;
  }
  for (const cat of Object.keys(avgByCategory)) {
    summary.averages[cat] = avgByCategory[cat] / countByCategory[cat];
  }

  return summary;
}

// ============================================================
// 8. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectEnergyAnomalies(data) {
  const anomalies = [];

  const byCategory = {};
  for (const d of data) {
    const cat = d.category || 'Unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(d);
  }

  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length < 5) continue;

    const values = items.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);

    for (const item of items) {
      if (Math.abs(item.value - mean) > 2 * std && std > 0) {
        anomalies.push({
          type: 'price_spike',
          severity: Math.abs(item.value - mean) / std > 3 ? 'high' : 'medium',
          category: category,
          value: item.value,
          mean: mean,
          deviation: ((item.value - mean) / mean * 100).toFixed(1),
          date: item.date,
          description: `${category}: ${item.value} ${item.unit} (отклонение ${((item.value - mean) / mean * 100).toFixed(1)}%)`
        });
      }
    }
  }

  return anomalies;
}

// ============================================================
// 9. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
  const now = new Date();
  const data = [];

  const categories = [
    { name: CATEGORIES.OIL, unit: '$/bbl', base: 75, volatility: 5 },
    { name: CATEGORIES.GAS, unit: '$/MMBtu', base: 3.5, volatility: 0.5 },
    { name: CATEGORIES.ELECTRICITY, unit: '¢/kWh', base: 15, volatility: 1 },
    { name: CATEGORIES.COAL, unit: '$/short ton', base: 45, volatility: 3 }
  ];

  for (const cat of categories) {
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const trend = Math.sin(i / 10) * cat.volatility;
      const noise = (Math.random() - 0.5) * cat.volatility * 0.5;
      const value = cat.base + trend + noise;

      data.push({
        id: `${cat.name}-${date.toISOString().slice(0,10)}`,
        category: cat.name,
        series: 'US Average',
        value: Math.round(value * 100) / 100,
        unit: cat.unit,
        date: date.toISOString(),
        source: 'EIA (DEMO)'
      });
    }
  }

  // Аномалии для демонстрации
  data.push({
    id: 'oil-anomaly-1',
    category: CATEGORIES.OIL,
    series: 'WTI',
    value: 112.06,
    unit: '$/bbl',
    date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'EIA (DEMO)'
  });

  data.push({
    id: 'gas-anomaly-1',
    category: CATEGORIES.GAS,
    series: 'Henry Hub',
    value: 6.8,
    unit: '$/MMBtu',
    date: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'EIA (DEMO)'
  });

  const summary = getEnergySummary(data);
  const anomalies = detectEnergyAnomalies(data);

  console.log(`[EIA] Сгенерировано ${data.length} демо-записей`);

  return {
    success: true,
    count: data.length,
    data: data,
    summary: summary,
    anomalies: anomalies,
    source: 'EIA (DEMO)',
    timestamp: new Date().toISOString(),
    isDemo: true
  };
}

// ============================================================
// 10. API-ОБРАБОТЧИК
// ============================================================

export async function handleEIAAPI(req, res) {
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
    // GET /api/eia/data — получить энергетические данные
    if (path === '/api/eia/data' && req.method === 'GET') {
      const params = url.searchParams;
      const category = params.get('category') || null;
      const limit = parseInt(params.get('limit')) || 50;

      const data = await fetchEnergyData({ category, limit });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // GET /api/eia/status — статус модуля
    if (path === '/api/eia/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'EIA',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[EIA API] Ошибка:', error);
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
  fetchEnergyData,
  handleEIAAPI,
  getEnergySummary,
  detectEnergyAnomalies
};
