#!/usr/bin/env node

// ============================================================
// GLOBAL-INDEX-API.MJS — Глобальный индекс напряжённости
// ============================================================
// Рассчитывает единый индекс 0-100 на основе:
// - RSS-новостей (количество + тональность)
// - Термальных детекций (FIRMS)
// - Авиационной активности (OpenSky)
// - Геополитических маркеров
// - Экономических индикаторов (VIX, HY Spread, GSCPI)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');
const INDEX_HISTORY_FILE = join(DATA_DIR, 'geo', 'index-history.json');

// ============================================================
// 1. ЗАГРУЗКА ДАННЫХ
// ============================================================

// Загрузить RSS-новости за сегодня
async function loadNewsData() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const newsFile = join(DATA_DIR, 'raw', `news-${today}.json`);
    const data = await fs.readFile(newsFile, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Загрузить термальные детекции (из последнего отчёта)
async function loadThermalData() {
  try {
    const thermalFile = join(DATA_DIR, 'thermal', 'latest.json');
    const data = await fs.readFile(thermalFile, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { total: 0, night: 0, highIntensity: 0 };
  }
}

// Загрузить геополитические маркеры
async function loadGeoMarkers() {
  try {
    const markersFile = join(DATA_DIR, 'geo', 'markers.json');
    const data = await fs.readFile(markersFile, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Загрузить экономические индикаторы
async function loadEconomicData() {
  try {
    // Используем данные из существующих источников
    const ecoFile = join(DATA_DIR, 'economic', 'latest.json');
    const data = await fs.readFile(ecoFile, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // Заглушка с текущими данными из интерфейса
    return {
      vix: 24.54,
      hySpread: 3.16,
      gscpi: 0.49,
      usdIndex: 120.9,
      unemployment: 4.3,
      cpi: 326.785
    };
  }
}

// Загрузить историю индекса
async function loadIndexHistory() {
  try {
    const data = await fs.readFile(INDEX_HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Сохранить историю индекса
async function saveIndexHistory(history) {
  await fs.mkdir(join(DATA_DIR, 'geo'), { recursive: true });
  await fs.writeFile(INDEX_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ============================================================
// 2. РАСЧЁТ КОМПОНЕНТОВ
// ============================================================

// Компонент 1: Новости (0-100)
function calculateNewsScore(news) {
  if (!news || news.length === 0) return 50; // нейтральное значение

  const today = new Date().toISOString().slice(0, 10);
  const todayNews = news.filter(n => n.date && n.date.startsWith(today));
  const count = todayNews.length;

  // Количество новостей: 0 = 0, 50+ = 100
  const countScore = Math.min(count / 50 * 100, 100);

  // Тональность: средняя AI-оценка (если есть)
  let avgRating = 0;
  let rated = 0;
  for (const n of todayNews) {
    if (n.aiRating !== undefined) {
      avgRating += n.aiRating;
      rated++;
    }
  }
  if (rated > 0) {
    avgRating = avgRating / rated; // 0-10
  } else {
    avgRating = 5; // нейтрально
  }

  // Тональность: 0 = 0, 10 = 100
  const toneScore = (avgRating / 10) * 100;

  // Итог: 60% количество, 40% тональность
  return countScore * 0.6 + toneScore * 0.4;
}

// Компонент 2: Термальные детекции (0-100)
function calculateThermalScore(thermal) {
  if (!thermal) return 30;

  const total = thermal.total || 0;
  const night = thermal.night || 0;
  const high = thermal.highIntensity || 0;

  // Количество: 0 = 0, 10000+ = 100
  const countScore = Math.min(total / 10000 * 100, 100);

  // Ночные: 0 = 0, 2000+ = 100
  const nightScore = Math.min(night / 2000 * 100, 100);

  // Высокая интенсивность: 0 = 0, 100+ = 100
  const highScore = Math.min(high / 100 * 100, 100);

  // Итог: 40% количество, 35% ночные, 25% интенсивность
  return countScore * 0.4 + nightScore * 0.35 + highScore * 0.25;
}

// Компонент 3: Авиационная активность (0-100)
function calculateAviationScore() {
  // Пока используем данные из интерфейса (10 театров, 1292 самолёта)
  // В будущем — из OpenSky API
  const theaters = 10;
  const aircraft = 1292;

  // Театры: 0 = 0, 15+ = 100
  const theaterScore = Math.min(theaters / 15 * 100, 100);

  // Самолёты: 0 = 0, 3000+ = 100
  const aircraftScore = Math.min(aircraft / 3000 * 100, 100);

  return theaterScore * 0.5 + aircraftScore * 0.5;
}

// Компонент 4: Геополитические маркеры (0-100)
function calculateGeoScore(markers) {
  if (!markers || markers.length === 0) return 30;

  // Считаем маркеры по статусам
  let critical = 0;
  let high = 0;
  let medium = 0;

  for (const m of markers) {
    const status = m.status || 'normal';
    if (status === 'critical') critical++;
    else if (status === 'high') high++;
    else if (status === 'medium') medium++;
  }

  const total = markers.length;
  if (total === 0) return 30;

  // Вес: critical = 3, high = 2, medium = 1
  const weightedScore = (critical * 3 + high * 2 + medium * 1) / total;
  // 0 = 0, 3 = 100
  return (weightedScore / 3) * 100;
}

// Компонент 5: Экономика (0-100)
function calculateEconomyScore(economy) {
  if (!economy) return 40;

  const vix = economy.vix || 20;
  const hySpread = economy.hySpread || 2.5;
  const gscpi = economy.gscpi || 0;

  // VIX: 10 = 0, 40+ = 100
  const vixScore = Math.min(Math.max((vix - 10) / 30 * 100, 0), 100);

  // HY Spread: 1 = 0, 5+ = 100
  const hyScore = Math.min(Math.max((hySpread - 1) / 4 * 100, 0), 100);

  // GSCPI: -1 = 0, 2+ = 100
  const gscpiScore = Math.min(Math.max((gscpi + 1) / 3 * 100, 0), 100);

  // Итог: 40% VIX, 35% HY Spread, 25% GSCPI
  return vixScore * 0.4 + hyScore * 0.35 + gscpiScore * 0.25;
}

// ============================================================
// 3. РАСЧЁТ ОБЩЕГО ИНДЕКСА
// ============================================================

async function calculateGlobalIndex() {
  // Загружаем все данные
  const news = await loadNewsData();
  const thermal = await loadThermalData();
  const markers = await loadGeoMarkers();
  const economy = await loadEconomicData();

  // Рассчитываем компоненты
  const newsScore = calculateNewsScore(news);
  const thermalScore = calculateThermalScore(thermal);
  const aviationScore = calculateAviationScore();
  const geoScore = calculateGeoScore(markers);
  const economyScore = calculateEconomyScore(economy);

  // Итоговый индекс (веса)
  const index =
    newsScore * 0.30 +
    thermalScore * 0.20 +
    aviationScore * 0.15 +
    geoScore * 0.20 +
    economyScore * 0.15;

  // Округляем до целого
  const roundedIndex = Math.round(index);

  // Загружаем существующую историю
  let history = await loadIndexHistory();

  // Проверяем, есть ли уже запись за сегодня (чтобы избежать дубликатов)
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const existingToday = history.find(h => {
    const hDate = new Date(h.date);
    return hDate.toISOString().slice(0, 10) === today;
  });

  // Если запись за сегодня есть — удаляем её (обновляем)
  if (existingToday) {
    history = history.filter(h => {
      const hDate = new Date(h.date);
      return hDate.toISOString().slice(0, 10) !== today;
    });
  }

  // Тренд (сравниваем с предыдущим значением)
  let trend = 'stable';
  if (history.length > 0) {
    const prev = history[history.length - 1].index;
    if (roundedIndex > prev + 2) trend = 'up';
    else if (roundedIndex < prev - 2) trend = 'down';
  }

  // Уровень
  let level = 'normal';
  if (roundedIndex >= 70) level = 'critical';
  else if (roundedIndex >= 50) level = 'high';
  else if (roundedIndex >= 30) level = 'medium';

  // Создаём новую запись (ВСЕГДА с английскими ключами!)
  const newEntry = {
    date: now.toISOString(),
    index: roundedIndex,
    components: {
      news: Math.round(newsScore),
      thermal: Math.round(thermalScore),
      aviation: Math.round(aviationScore),
      geo: Math.round(geoScore),
      economy: Math.round(economyScore)
    },
    level: level
  };

  // Добавляем в историю
  history.push(newEntry);

  // Оставляем только последние 90 дней
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const filtered = history.filter(h => new Date(h.date) > ninetyDaysAgo);
  await saveIndexHistory(filtered);

  return {
    index: roundedIndex,
    level: level,
    trend: trend,
    components: {
      news: Math.round(newsScore),
      thermal: Math.round(thermalScore),
      aviation: Math.round(aviationScore),
      geo: Math.round(geoScore),
      economy: Math.round(economyScore)
    },
    history: filtered.slice(-30), // последние 30 дней для графика
    timestamp: now.toISOString()
  };
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleGlobalIndexAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Получить текущий индекс
  if (path === '/api/geo/index' && req.method === 'GET') {
    try {
      const result = await calculateGlobalIndex();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (e) {
      console.error('[GlobalIndex] Ошибка:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Получить историю
  if (path === '/api/geo/index/history' && req.method === 'GET') {
    try {
      const history = await loadIndexHistory();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleGlobalIndexAPI, calculateGlobalIndex };
