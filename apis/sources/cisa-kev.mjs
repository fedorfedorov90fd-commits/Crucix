#!/usr/bin/env node

// ============================================================
// CISA-KEV — МОНИТОРИНГ КИБЕРУГРОЗ
// ============================================================
// Источник: CISA Known Exploited Vulnerabilities Catalog
// Данные: уязвимости, которые активно эксплуатируются
// Версия: 2.0 (профессиональная)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// CISA KEV API (JSON)
const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

// Уровни критичности
const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// Категории уязвимостей
const CATEGORIES = {
  RCE: 'Удалённое выполнение кода',
  PRIVILEGE_ESCALATION: 'Повышение привилегий',
  DOS: 'Отказ в обслуживании',
  INFORMATION_DISCLOSURE: 'Раскрытие информации',
  AUTH_BYPASS: 'Обход аутентификации',
  CROSS_SITE: 'Межсайтовый скриптинг',
  SQL_INJECTION: 'SQL-инъекция',
  OTHER: 'Другое'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchVulnerabilities(options = {}) {
  const {
    vendor = null,
    product = null,
    severity = null,
    limit = 100,
    days = 30
  } = options;

  try {
    console.log('[CISA-KEV] Запрос данных об уязвимостях...');

    // Получаем данные из CISA
    let vulnerabilities = await fetchCISAKEV();

    // Если данных нет — используем демо
    if (vulnerabilities.length === 0) {
      console.log('[CISA-KEV] Реальные данные недоступны, использую демо-данные');
      return getDemoData();
    }

    // Фильтр по вендору
    if (vendor) {
      vulnerabilities = vulnerabilities.filter(v => 
        v.vendor?.toLowerCase().includes(vendor.toLowerCase())
      );
    }

    // Фильтр по продукту
    if (product) {
      vulnerabilities = vulnerabilities.filter(v => 
        v.product?.toLowerCase().includes(product.toLowerCase())
      );
    }

    // Фильтр по критичности
    if (severity) {
      vulnerabilities = vulnerabilities.filter(v => v.severity === severity);
    }

    // Сортируем по дате добавления (новые сверху)
    vulnerabilities.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    // Статистика
    const summary = getVulnerabilitySummary(vulnerabilities);
    const alerts = detectVulnerabilityAlerts(vulnerabilities);

    console.log(`[CISA-KEV] Получено ${vulnerabilities.length} уязвимостей`);

    return {
      success: true,
      count: vulnerabilities.length,
      data: vulnerabilities.slice(0, limit),
      summary: summary,
      alerts: alerts,
      source: 'CISA KEV (Known Exploited Vulnerabilities)',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[CISA-KEV] Ошибка:', error.message);
    console.warn('[CISA-KEV] Использую демо-данные');
    return getDemoData();
  }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ДАННЫХ ИЗ CISA KEV
// ============================================================

async function fetchCISAKEV() {
  try {
    const response = await fetchWithRetry(CISA_KEV_URL, { timeout: 15000 });
    const text = await response.text();
    
    // Проверяем, что это JSON
    if (!text.trim().startsWith('{')) {
      console.warn('[CISA-KEV] API вернул не JSON, пропускаем');
      return [];
    }
    
    const data = JSON.parse(text);

    if (data && data.vulnerabilities) {
      return data.vulnerabilities.map(item => ({
        id: item.cveID || `cve-${Date.now()}`,
        cve: item.cveID || 'Unknown',
        title: `${item.vendor || 'Unknown'} ${item.product || ''} ${item.cveID || ''}`.trim(),
        vendor: item.vendor || 'Unknown',
        product: item.product || 'Unknown',
        description: item.shortDescription || 'Нет описания',
        severity: detectSeverity(item),
        category: detectCategory(item),
        dateAdded: item.dateAdded || new Date().toISOString().slice(0,10),
        dueDate: item.dueDate || '',
        requiredAction: item.requiredAction || 'Apply updates',
        notes: item.notes || '',
        source: 'CISA',
        status: 'active'
      }));
    }
    return [];
  } catch (e) {
    console.warn('[CISA-KEV] Не удалось получить данные:', e.message);
    return [];
  }
}

// ============================================================
// 4. ОПРЕДЕЛЕНИЕ КРИТИЧНОСТИ
// ============================================================

function detectSeverity(item) {
  if (!item) return SEVERITY.MEDIUM;

  // CISA KEV уже содержит только критичные уязвимости,
  // но мы добавим свою градацию

  const desc = (item.shortDescription || '').toLowerCase();
  const product = (item.product || '').toLowerCase();
  const vendor = (item.vendor || '').toLowerCase();

  // Критические
  const criticalKeywords = ['critical', 'remote code execution', 'rce', 'zero-day', '0-day'];
  for (const word of criticalKeywords) {
    if (desc.includes(word) || product.includes(word)) {
      return SEVERITY.CRITICAL;
    }
  }

  // Высокие
  const highKeywords = ['elevation of privilege', 'privilege escalation', 'auth bypass', 'buffer overflow'];
  for (const word of highKeywords) {
    if (desc.includes(word)) {
      return SEVERITY.HIGH;
    }
  }

  // Средние
  const mediumKeywords = ['denial of service', 'dos', 'information disclosure', 'xss'];
  for (const word of mediumKeywords) {
    if (desc.includes(word)) {
      return SEVERITY.MEDIUM;
    }
  }

  return SEVERITY.LOW;
}

// ============================================================
// 5. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ
// ============================================================

function detectCategory(item) {
  if (!item) return CATEGORIES.OTHER;

  const desc = (item.shortDescription || '').toLowerCase();
  const product = (item.product || '').toLowerCase();

  if (desc.includes('remote code execution') || desc.includes('rce') || desc.includes('code execution')) {
    return CATEGORIES.RCE;
  }
  if (desc.includes('privilege escalation') || desc.includes('elevation of privilege')) {
    return CATEGORIES.PRIVILEGE_ESCALATION;
  }
  if (desc.includes('denial of service') || desc.includes('dos')) {
    return CATEGORIES.DOS;
  }
  if (desc.includes('information disclosure') || desc.includes('exposure')) {
    return CATEGORIES.INFORMATION_DISCLOSURE;
  }
  if (desc.includes('auth bypass') || desc.includes('authentication')) {
    return CATEGORIES.AUTH_BYPASS;
  }
  if (desc.includes('cross-site') || desc.includes('xss')) {
    return CATEGORIES.CROSS_SITE;
  }
  if (desc.includes('sql') || desc.includes('injection')) {
    return CATEGORIES.SQL_INJECTION;
  }

  return CATEGORIES.OTHER;
}

// ============================================================
// 6. СТАТИСТИКА
// ============================================================

function getVulnerabilitySummary(data) {
  const summary = {
    total: data.length,
    bySeverity: {},
    byCategory: {},
    byVendor: {},
    byProduct: {},
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    recentCount: 0 // за последние 30 дней
  };

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const d of data) {
    // По критичности
    const sev = d.severity || 'unknown';
    summary.bySeverity[sev] = (summary.bySeverity[sev] || 0) + 1;
    if (sev === 'critical') summary.criticalCount++;
    if (sev === 'high') summary.highCount++;
    if (sev === 'medium') summary.mediumCount++;
    if (sev === 'low') summary.lowCount++;

    // По категории
    const cat = d.category || 'Unknown';
    summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;

    // По вендору
    const vendor = d.vendor || 'Unknown';
    summary.byVendor[vendor] = (summary.byVendor[vendor] || 0) + 1;

    // По продукту
    const product = d.product || 'Unknown';
    summary.byProduct[product] = (summary.byProduct[product] || 0) + 1;

    // Недавние
    const dateAdded = new Date(d.dateAdded);
    if (dateAdded >= thirtyDaysAgo) {
      summary.recentCount++;
    }
  }

  return summary;
}

// ============================================================
// 7. ДЕТЕКТОР ОПАСНЫХ СИТУАЦИЙ
// ============================================================

function detectVulnerabilityAlerts(data) {
  const alerts = [];

  // 1. Критические уязвимости
  const critical = data.filter(d => d.severity === SEVERITY.CRITICAL);
  if (critical.length > 0) {
    alerts.push({
      type: 'critical_vulnerabilities',
      severity: 'critical',
      count: critical.length,
      description: `Обнаружено ${critical.length} критических уязвимостей`,
      examples: critical.slice(0, 3).map(d => d.cve).join(', ')
    });
  }

  // 2. Новые уязвимости за последние 7 дней
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recent = data.filter(d => {
    const dateAdded = new Date(d.dateAdded);
    return dateAdded >= sevenDaysAgo;
  });

  if (recent.length > 0) {
    alerts.push({
      type: 'recent_vulnerabilities',
      severity: recent.length > 5 ? 'high' : 'medium',
      count: recent.length,
      description: `${recent.length} новых уязвимостей за 7 дней`,
      examples: recent.slice(0, 3).map(d => d.cve).join(', ')
    });
  }

  // 3. Уязвимости с истекающим сроком
  const expiring = data.filter(d => {
    if (!d.dueDate) return false;
    const due = new Date(d.dueDate);
    return (due - now) < 7 * 24 * 60 * 60 * 1000;
  });

  if (expiring.length > 0) {
    alerts.push({
      type: 'expiring_vulnerabilities',
      severity: 'high',
      count: expiring.length,
      description: `${expiring.length} уязвимостей с истекающим сроком`,
      examples: expiring.slice(0, 3).map(d => d.cve).join(', ')
    });
  }

  // 4. Топ-вендоры с уязвимостями
  const vendorCount = {};
  for (const d of data) {
    const vendor = d.vendor || 'Unknown';
    vendorCount[vendor] = (vendorCount[vendor] || 0) + 1;
  }

  const sortedVendors = Object.entries(vendorCount).sort((a, b) => b[1] - a[1]);
  if (sortedVendors.length > 0 && sortedVendors[0][1] > 3) {
    alerts.push({
      type: 'vendor_risk',
      severity: 'medium',
      count: sortedVendors[0][1],
      description: `${sortedVendors[0][0]} имеет ${sortedVendors[0][1]} уязвимостей`,
      examples: sortedVendors.slice(0, 3).map(([v, c]) => `${v} (${c})`).join(', ')
    });
  }

  return alerts;
}

// ============================================================
// 8. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
  const now = new Date();
  const data = [];

  const demoVulnerabilities = [
    { cve: 'CVE-2024-12345', vendor: 'Microsoft', product: 'Windows', severity: 'critical', category: 'RCE' },
    { cve: 'CVE-2024-67890', vendor: 'Microsoft', product: 'Exchange', severity: 'critical', category: 'RCE' },
    { cve: 'CVE-2024-11111', vendor: 'Adobe', product: 'Acrobat', severity: 'high', category: 'RCE' },
    { cve: 'CVE-2024-22222', vendor: 'Google', product: 'Chrome', severity: 'critical', category: 'RCE' },
    { cve: 'CVE-2024-33333', vendor: 'Apple', product: 'iOS', severity: 'high', category: 'Privilege Escalation' },
    { cve: 'CVE-2024-44444', vendor: 'Linux', product: 'Kernel', severity: 'critical', category: 'Privilege Escalation' },
    { cve: 'CVE-2024-55555', vendor: 'Apache', product: 'Log4j', severity: 'critical', category: 'RCE' },
    { cve: 'CVE-2024-66666', vendor: 'Oracle', product: 'WebLogic', severity: 'high', category: 'RCE' },
    { cve: 'CVE-2024-77777', vendor: 'VMware', product: 'vCenter', severity: 'critical', category: 'RCE' },
    { cve: 'CVE-2024-88888', vendor: 'Cisco', product: 'IOS', severity: 'high', category: 'DoS' },
    { cve: 'CVE-2024-99999', vendor: 'Fortinet', product: 'FortiOS', severity: 'critical', category: 'Auth Bypass' },
    { cve: 'CVE-2024-10101', vendor: 'Microsoft', product: 'Azure', severity: 'medium', category: 'Information Disclosure' },
    { cve: 'CVE-2024-20202', vendor: 'Google', product: 'Android', severity: 'critical', category: 'RCE' },
    { cve: 'CVE-2024-30303', vendor: 'Adobe', product: 'Reader', severity: 'high', category: 'RCE' },
    { cve: 'CVE-2024-40404', vendor: 'Microsoft', product: 'SQL Server', severity: 'high', category: 'SQL Injection' }
  ];

  for (let i = 0; i < demoVulnerabilities.length; i++) {
    const v = demoVulnerabilities[i];
    const date = new Date(now);
    date.setDate(date.getDate() - i * 3);

    const due = new Date(date);
    due.setDate(due.getDate() + 30);

    data.push({
      id: `cisa-${i}`,
      cve: v.cve,
      title: `${v.vendor} ${v.product}: ${v.cve}`,
      vendor: v.vendor,
      product: v.product,
      description: `Известная эксплуатируемая уязвимость в ${v.product} от ${v.vendor}`,
      severity: v.severity,
      category: v.category,
      dateAdded: date.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      requiredAction: 'Apply updates as per vendor guidance',
      notes: 'Actively exploited in the wild',
      source: 'CISA (DEMO)',
      status: 'active'
    });
  }

  // Добавляем свежую уязвимость
  data.unshift({
    id: 'cisa-recent',
    cve: 'CVE-2026-12345',
    title: 'Microsoft Windows: Zero-day RCE',
    vendor: 'Microsoft',
    product: 'Windows',
    description: 'Критическая уязвимость удалённого выполнения кода в Windows',
    severity: 'critical',
    category: 'RCE',
    dateAdded: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    requiredAction: 'Apply emergency updates',
    notes: 'Zero-day vulnerability actively exploited',
    source: 'CISA (DEMO)',
    status: 'active'
  });

  const summary = getVulnerabilitySummary(data);
  const alerts = detectVulnerabilityAlerts(data);

  console.log(`[CISA-KEV] Сгенерировано ${data.length} демо-записей`);

  return {
    success: true,
    count: data.length,
    data: data,
    summary: summary,
    alerts: alerts,
    source: 'CISA KEV (DEMO)',
    timestamp: new Date().toISOString(),
    isDemo: true
  };
}

// ============================================================
// 9. API-ОБРАБОТЧИК
// ============================================================

export async function handleCISAKEVAPI(req, res) {
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
    // GET /api/cisa/data — получить данные об уязвимостях
    if (path === '/api/cisa/data' && req.method === 'GET') {
      const params = url.searchParams;
      const vendor = params.get('vendor') || null;
      const product = params.get('product') || null;
      const severity = params.get('severity') || null;
      const limit = parseInt(params.get('limit')) || 100;

      const data = await fetchVulnerabilities({ vendor, product, severity, limit });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // GET /api/cisa/status — статус модуля
    if (path === '/api/cisa/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'CISA-KEV',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[CISA-KEV API] Ошибка:', error);
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
  fetchVulnerabilities,
  handleCISAKEVAPI,
  getVulnerabilitySummary,
  detectVulnerabilityAlerts
};