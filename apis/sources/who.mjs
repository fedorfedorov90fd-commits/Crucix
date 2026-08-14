#!/usr/bin/env node

// ============================================================
// WHO — МОНИТОРИНГ ЗДРАВООХРАНЕНИЯ
// ============================================================
// Источник: Всемирная организация здравоохранения (WHO)
// Данные: вспышки заболеваний, эпидемии, статистика
// Версия: 2.1 (исправлена работа с демо-данными)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// WHO Disease Outbreak News (DON) API
const WHO_API_URL = 'https://www.who.int/api/news/don';
const WHO_DISEASES_URL = 'https://www.who.int/api/diseases';
const WHO_EMERGENCIES_URL = 'https://www.who.int/api/emergencies';

// Категории
const CATEGORIES = {
  OUTBREAK: 'Вспышка заболевания',
  EPIDEMIC: 'Эпидемия',
  PANDEMIC: 'Пандемия',
  ALERT: 'Предупреждение',
  UPDATE: 'Обновление ситуации',
  EMERGENCY: 'Чрезвычайная ситуация'
};

// Уровни опасности
const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchHealthData(options = {}) {
  const {
    disease = null,
    country = null,
    limit = 50,
    severity = null
  } = options;

  try {
    console.log('[WHO] Запрос данных здравоохранения...');

    // Получаем данные из всех источников
    let outbreaks = [];
    let emergencies = [];
    let diseases = [];

    try {
      outbreaks = await fetchOutbreaks();
    } catch (e) {
      console.warn('[WHO] Ошибка при получении вспышек:', e.message);
    }

    try {
      emergencies = await fetchEmergencies();
    } catch (e) {
      console.warn('[WHO] Ошибка при получении ЧС:', e.message);
    }

    try {
      diseases = await fetchDiseaseList();
    } catch (e) {
      console.warn('[WHO] Ошибка при получении списка заболеваний:', e.message);
    }

    // Объединяем все данные
    let allData = [...outbreaks, ...emergencies];

    // Если данных нет — используем демо
    if (allData.length === 0) {
      console.log('[WHO] Реальные данные недоступны, использую демо-данные');
      return getDemoData();
    }

    // Фильтр по заболеванию
    if (disease) {
      allData = allData.filter(d =>
        d.disease?.toLowerCase().includes(disease.toLowerCase()) ||
        d.title?.toLowerCase().includes(disease.toLowerCase())
      );
    }

    // Фильтр по стране
    if (country) {
      allData = allData.filter(d =>
        d.country?.toLowerCase().includes(country.toLowerCase()) ||
        d.location?.toLowerCase().includes(country.toLowerCase())
      );
    }

    // Фильтр по уровню опасности
    if (severity) {
      allData = allData.filter(d => d.severity === severity);
    }

    // Сортируем по дате (новые сверху)
    allData.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Статистика
    const summary = getHealthSummary(allData);
    const alerts = detectHealthAlerts(allData);

    console.log(`[WHO] Получено ${allData.length} записей`);

    return {
      success: true,
      count: allData.length,
      data: allData.slice(0, limit),
      summary: summary,
      alerts: alerts,
      diseases: diseases,
      source: 'WHO (World Health Organization)',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[WHO] Ошибка:', error.message);
    console.warn('[WHO] Использую демо-данные');
    return getDemoData();
  }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ВСПЫШЕК ЗАБОЛЕВАНИЙ
// ============================================================

async function fetchOutbreaks() {
  try {
    const response = await fetchWithRetry(WHO_API_URL, { timeout: 10000 });
    const text = await response.text();

    // Проверяем, что это JSON
    if (!text.trim().startsWith('{')) {
      console.warn('[WHO] API вернул не JSON, пропускаем');
      return [];
    }

    const data = JSON.parse(text);

    if (data && data.data) {
      return data.data.map(item => ({
        id: `who-${item.id || Date.now()}`,
        title: item.title || 'Без названия',
        description: item.description || '',
        disease: item.disease || 'Unknown',
        country: item.country || 'Unknown',
        location: item.location || '',
        category: CATEGORIES.OUTBREAK,
        severity: detectSeverity(item),
        date: item.published || new Date().toISOString(),
        source: 'WHO',
        url: item.url || '',
        status: item.status || 'active'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[WHO] Не удалось получить вспышки:', e.message);
    return [];
  }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ
// ============================================================

async function fetchEmergencies() {
  try {
    const response = await fetchWithRetry(WHO_EMERGENCIES_URL, { timeout: 10000 });
    const text = await response.text();

    if (!text.trim().startsWith('{')) {
      console.warn('[WHO] API emergencies вернул не JSON, пропускаем');
      return [];
    }

    const data = JSON.parse(text);

    if (data && data.data) {
      return data.data.map(item => ({
        id: `who-emerg-${item.id || Date.now()}`,
        title: item.title || 'Чрезвычайная ситуация',
        description: item.description || '',
        disease: item.disease || 'Unknown',
        country: item.country || 'Unknown',
        location: item.location || '',
        category: CATEGORIES.EMERGENCY,
        severity: SEVERITY.HIGH,
        date: item.published || new Date().toISOString(),
        source: 'WHO',
        url: item.url || '',
        status: item.status || 'active'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[WHO] Не удалось получить ЧС:', e.message);
    return [];
  }
}

// ============================================================
// 5. ПОЛУЧЕНИЕ СПИСКА ЗАБОЛЕВАНИЙ
// ============================================================

async function fetchDiseaseList() {
  try {
    const response = await fetchWithRetry(WHO_DISEASES_URL, { timeout: 10000 });
    const text = await response.text();

    if (!text.trim().startsWith('{')) {
      console.warn('[WHO] API diseases вернул не JSON, пропускаем');
      return [];
    }

    const data = JSON.parse(text);

    if (data && data.data) {
      return data.data.map(item => ({
        id: item.id,
        name: item.name || 'Unknown',
        category: item.category || 'Инфекционное',
        description: item.description || '',
        severity: item.severity || SEVERITY.MEDIUM
      }));
    }
    return [];
  } catch (e) {
    console.warn('[WHO] Не удалось получить список заболеваний:', e.message);
    return [];
  }
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ УРОВНЯ ОПАСНОСТИ
// ============================================================

function detectSeverity(item) {
  if (!item) return SEVERITY.MEDIUM;

  const title = item.title?.toLowerCase() || '';
  const desc = item.description?.toLowerCase() || '';

  const criticalKeywords = ['pandemic', 'critical', 'emergency', 'outbreak', 'epidemic', 'ebola', 'marburg'];
  const highKeywords = ['severe', 'high risk', 'transmission', 'death', 'fatal'];
  const mediumKeywords = ['cases', 'reported', 'confirmed', 'suspected'];

  for (const word of criticalKeywords) {
    if (title.includes(word) || desc.includes(word)) return SEVERITY.CRITICAL;
  }

  for (const word of highKeywords) {
    if (title.includes(word) || desc.includes(word)) return SEVERITY.HIGH;
  }

  for (const word of mediumKeywords) {
    if (title.includes(word) || desc.includes(word)) return SEVERITY.MEDIUM;
  }

  return SEVERITY.LOW;
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getHealthSummary(data) {
  const summary = {
    total: data.length,
    byCategory: {},
    bySeverity: {},
    byCountry: {},
    active: 0
  };

  for (const d of data) {
    const cat = d.category || 'Unknown';
    summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;

    const sev = d.severity || 'unknown';
    summary.bySeverity[sev] = (summary.bySeverity[sev] || 0) + 1;

    const country = d.country || 'Unknown';
    summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;

    if (d.status === 'active') summary.active++;
  }

  return summary;
}

// ============================================================
// 8. ДЕТЕКТОР ОПАСНЫХ СИТУАЦИЙ
// ============================================================

function detectHealthAlerts(data) {
  const alerts = [];

  // 1. Критические события
  const critical = data.filter(d => d.severity === SEVERITY.CRITICAL);
  if (critical.length > 0) {
    alerts.push({
      type: 'critical_events',
      severity: 'high',
      count: critical.length,
      description: `Обнаружено ${critical.length} критических событий`,
      examples: critical.slice(0, 3).map(d => d.title).join(', ')
    });
  }

  // 2. Новые вспышки за последние 7 дней
  const now = new Date();
  const recent = data.filter(d => {
    const date = new Date(d.date);
    return (now - date) < 7 * 24 * 60 * 60 * 1000;
  });

  if (recent.length > 3) {
    alerts.push({
      type: 'new_outbreaks',
      severity: recent.length > 10 ? 'high' : 'medium',
      count: recent.length,
      description: `${recent.length} новых событий за 7 дней`,
      examples: recent.slice(0, 3).map(d => d.title).join(', ')
    });
  }

  // 3. Заболевания с высоким уровнем
  const highSeverity = data.filter(d => d.severity === SEVERITY.HIGH);
  if (highSeverity.length > 0) {
    alerts.push({
      type: 'high_severity_diseases',
      severity: 'medium',
      count: highSeverity.length,
      description: `${highSeverity.length} заболеваний с высоким уровнем опасности`,
      examples: highSeverity.slice(0, 3).map(d => d.disease || d.title).join(', ')
    });
  }

  return alerts;
}

// ============================================================
// 9. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
  const now = new Date();
  const data = [];

  const diseases = [
    { name: 'COVID-19', country: 'Global', severity: SEVERITY.MEDIUM, category: CATEGORIES.OUTBREAK },
    { name: 'MPOX', country: 'Multiple', severity: SEVERITY.HIGH, category: CATEGORIES.OUTBREAK },
    { name: 'Ebola', country: 'DRC', severity: SEVERITY.CRITICAL, category: CATEGORIES.EPIDEMIC },
    { name: 'Cholera', country: 'Nigeria', severity: SEVERITY.MEDIUM, category: CATEGORIES.OUTBREAK },
    { name: 'Dengue', country: 'Brazil', severity: SEVERITY.MEDIUM, category: CATEGORIES.OUTBREAK },
    { name: 'Flu (H5N1)', country: 'Vietnam', severity: SEVERITY.HIGH, category: CATEGORIES.ALERT },
    { name: 'Polio', country: 'Pakistan', severity: SEVERITY.HIGH, category: CATEGORIES.UPDATE },
    { name: 'Measles', country: 'India', severity: SEVERITY.MEDIUM, category: CATEGORIES.OUTBREAK },
    { name: 'Marburg', country: 'Equatorial Guinea', severity: SEVERITY.CRITICAL, category: CATEGORIES.ALERT },
    { name: 'Zika', country: 'Brazil', severity: SEVERITY.MEDIUM, category: CATEGORIES.OUTBREAK }
  ];

  const descriptions = [
    'Зарегистрирована новая вспышка заболевания. Рекомендуется мониторинг.',
    'Эпидемиологическая ситуация ухудшается. Приняты меры контроля.',
    'Обнаружены новые случаи заболевания в регионе. Проводится расследование.',
    'ВОЗ объявила о чрезвычайной ситуации в связи с распространением болезни.',
    'Обновление данных по заболеванию. Количество случаев растёт.'
  ];

  for (let i = 0; i < diseases.length; i++) {
    const disease = diseases[i];
    const date = new Date(now);
    date.setDate(date.getDate() - i * 3);

    data.push({
      id: `demo-${i}`,
      title: `${disease.name}: ${disease.category} в ${disease.country}`,
      description: descriptions[i % descriptions.length],
      disease: disease.name,
      country: disease.country,
      location: disease.country,
      category: disease.category,
      severity: disease.severity,
      date: date.toISOString(),
      source: 'WHO (DEMO)',
      url: '#',
      status: i % 3 === 0 ? 'active' : 'resolved'
    });
  }

  // Добавляем свежее событие
  data.unshift({
    id: 'demo-recent',
    title: 'ВОЗ: Новая вспышка заболевания в Африке',
    description: 'ВОЗ сообщает о новой вспышке заболевания в Африке. Проводятся меры контроля.',
    disease: 'Unknown',
    country: 'Africa',
    location: 'Africa',
    category: CATEGORIES.ALERT,
    severity: SEVERITY.HIGH,
    date: new Date().toISOString(),
    source: 'WHO (DEMO)',
    url: '#',
    status: 'active'
  });

  const summary = getHealthSummary(data);
  const alerts = detectHealthAlerts(data);

  console.log(`[WHO] Сгенерировано ${data.length} демо-записей`);

  return {
    success: true,
    count: data.length,
    data: data,
    summary: summary,
    alerts: alerts,
    diseases: diseases,
    source: 'WHO (DEMO)',
    timestamp: new Date().toISOString(),
    isDemo: true
  };
}

// ============================================================
// 10. API-ОБРАБОТЧИК
// ============================================================

export async function handleWHOAPI(req, res) {
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
    // GET /api/who/data — получить данные здравоохранения
    if (path === '/api/who/data' && req.method === 'GET') {
      const params = url.searchParams;
      const disease = params.get('disease') || null;
      const country = params.get('country') || null;
      const limit = parseInt(params.get('limit')) || 50;

      const data = await fetchHealthData({ disease, country, limit });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // GET /api/who/status — статус модуля
    if (path === '/api/who/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'WHO',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[WHO API] Ошибка:', error);
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
  fetchHealthData,
  handleWHOAPI,
  getHealthSummary,
  detectHealthAlerts
};
