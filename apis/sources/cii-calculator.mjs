#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

// ============================================================
// МАППИНГ НАЗВАНИЙ СТРАН (из GeoJSON -> нормализованные ключи)
// ============================================================
const COUNTRY_ALIASES = {
  // США — все возможные варианты
  'United States': 'usa',
  'United States of America': 'usa',
  'USA': 'usa',
  'usa': 'usa',
  'united-states': 'usa',
  'united states': 'usa',
  'united-states-of-america': 'usa',

  // Россия
  'Russia': 'russia',
  'Russian Federation': 'russia',

  // Украина
  'Ukraine': 'ukraine',

  // Китай
  'China': 'china',
  "People's Republic of China": 'china',

  // Великобритания
  'United Kingdom': 'uk',
  'Great Britain': 'uk',

  // Остальные страны
  'France': 'france',
  'Germany': 'germany',
  'India': 'india',
  'Japan': 'japan',
  'South Korea': 'south-korea',
  'Republic of Korea': 'south-korea',
  'North Korea': 'north-korea',
  "Democratic People's Republic of Korea": 'north-korea',
  'Iran': 'iran',
  'Islamic Republic of Iran': 'iran',
  'Israel': 'israel',
  'Turkey': 'turkey',
  'Saudi Arabia': 'saudi-arabia',
  'Egypt': 'egypt',
  'Pakistan': 'pakistan',
  'Afghanistan': 'afghanistan',
  'Iraq': 'iraq',
  'Syria': 'syria',
  'Yemen': 'yemen',
  'Somalia': 'somalia',
  'Ethiopia': 'ethiopia',
  'Sudan': 'sudan',
  'Libya': 'libya',
  'Myanmar': 'myanmar',
  'Venezuela': 'venezuela',
  'Colombia': 'colombia',
  'Nigeria': 'nigeria',
  'Kenya': 'kenya',
  'Morocco': 'morocco',
  'Algeria': 'algeria',
  'Tunisia': 'tunisia',
  'Australia': 'australia',
  'Canada': 'canada',
  'Mexico': 'mexico',
  'Brazil': 'brazil',
  'Argentina': 'argentina',
  'Chile': 'chile',
  'Peru': 'peru',
  'South Africa': 'south-africa',
  'Indonesia': 'indonesia',
  'Thailand': 'thailand',
  'Vietnam': 'vietnam',
  'Philippines': 'philippines',
  'Malaysia': 'malaysia',
  'Singapore': 'singapore',
  'UAE': 'uae',
  'United Arab Emirates': 'uae',
  'Qatar': 'qatar',
  'Oman': 'oman',
  'Kuwait': 'kuwait',
  'Bahrain': 'bahrain',
  'Jordan': 'jordan',
  'Lebanon': 'lebanon',
  'Armenia': 'armenia',
  'Azerbaijan': 'azerbaijan',
  'Georgia': 'georgia',
  'Kazakhstan': 'kazakhstan',
  'Uzbekistan': 'uzbekistan',
  'Turkmenistan': 'turkmenistan',
  'Kyrgyzstan': 'kyrgyzstan',
  'Tajikistan': 'tajikistan',
  'Mongolia': 'mongolia',
  'Nepal': 'nepal',
  'Bangladesh': 'bangladesh',
  'Sri Lanka': 'sri-lanka',
  'Cambodia': 'cambodia',
  'Laos': 'laos',
  'New Zealand': 'new-zealand',
  'Poland': 'poland',
  'Lithuania': 'lithuania',
  'Latvia': 'latvia',
  'Estonia': 'estonia',
  'Switzerland': 'switzerland',
  'Norway': 'norway',
  'Sweden': 'sweden',
  'Finland': 'finland',
  'Ireland': 'ireland',
  'Portugal': 'portugal',
  'Spain': 'spain',
  'Italy': 'italy',
  'Greece': 'greece',
  'Angola': 'angola',
  'Benin': 'benin',
  'Botswana': 'botswana',
  'Burkina Faso': 'burkina-faso',
  'Burundi': 'burundi',
  'Cameroon': 'cameroon',
  'Cape Verde': 'cape-verde',
  'Central African Republic': 'central-african-republic',
  'Chad': 'chad',
  'Comoros': 'comoros',
  'Congo': 'congo',
  'Democratic Republic of the Congo': 'drc',
  'Djibouti': 'djibouti',
  'Equatorial Guinea': 'equatorial-guinea',
  'Eritrea': 'eritrea',
  'Eswatini': 'eswatini',
  'Gabon': 'gabon',
  'Gambia': 'gambia',
  'Ghana': 'ghana',
  'Guinea': 'guinea',
  'Guinea-Bissau': 'guinea-bissau',
  'Ivory Coast': 'ivory-coast',
  'Lesotho': 'lesotho',
  'Liberia': 'liberia',
  'Madagascar': 'madagascar',
  'Malawi': 'malawi',
  'Mali': 'mali',
  'Mauritania': 'mauritania',
  'Mauritius': 'mauritius',
  'Mozambique': 'mozambique',
  'Namibia': 'namibia',
  'Niger': 'niger',
  'Rwanda': 'rwanda',
  'Sao Tome and Principe': 'sao-tome',
  'Senegal': 'senegal',
  'Seychelles': 'seychelles',
  'Sierra Leone': 'sierra-leone',
  'Tanzania': 'tanzania',
  'Togo': 'togo',
  'Uganda': 'uganda',
  'Zambia': 'zambia',
  'Zimbabwe': 'zimbabwe'
};

// ============================================================
// БАЗОВЫЙ РИСК СТРАН (медленно меняющийся фактор)
// ============================================================
const BASE_RISK = {
  // ===== КРИТИЧЕСКИЙ РИСК (100-80) — полномасштабная война =====
  'ukraine': 95,        // 🔴 Красный — война
  'palestine': 92,      // 🔴 Красный — война
  'syria': 88,          // 🔴 Красный — гражданская война
  'yemen': 85,          // 🔴 Красный — гражданская война
  'sudan': 82,          // 🔴 Красный — гражданская война

  // ===== ПРЕДВОЕННЫЙ / ВЫСОКИЙ РИСК (79-60) =====
  'russia': 75,         // 🟠 Оранжевый — СВО, высокая напряжённость
  'north-korea': 72,    // 🟠 Оранжевый — постоянная угроза
  'afghanistan': 70,    // 🟠 Оранжевый — нестабильность
  'iraq': 68,           // 🟠 Оранжевый
  'lebanon': 65,        // 🟠 Оранжевый
  'myanmar': 62,        // 🟠 Оранжевый
  'libya': 60,          // 🟠 Оранжевый

  // ===== ВЫСОКИЙ РИСК (59-45) =====
  'iran': 55,           // 🟠 Оранжевый — прокси-войны
  'venezuela': 52,      // 🟠 Оранжевый
  'ethiopia': 50,       // 🟠 Оранжевый
  'pakistan': 48,       // 🟠 Оранжевый
  'nigeria': 46,        // 🟠 Оранжевый
  'colombia': 45,       // 🟠 Оранжевый

  // ===== СРЕДНИЙ РИСК (44-25) =====
  'armenia': 40,        // 🟡 Жёлтый
  'azerbaijan': 38,     // 🟡 Жёлтый
  'turkey': 36,         // 🟡 Жёлтый
  'egypt': 34,          // 🟡 Жёлтый
  'saudi-arabia': 32,   // 🟡 Жёлтый
  'china': 30,          // 🟡 Жёлтый
  'india': 28,          // 🟡 Жёлтый
  'brazil': 26,         // 🟡 Жёлтый
  'mexico': 25,         // 🟡 Жёлтый

  // ===== НИЗКИЙ РИСК (24-10) =====
  'japan': 22,          // 🟢 Зелёный
  'south-korea': 24,    // 🟢 Зелёный
  'israel': 30,         // 🟡 Жёлтый (но с учётом событий станет выше)
  'usa': 18,            // 🟢 Зелёный
  'uk': 20,             // 🟢 Зелёный
  'france': 19,         // 🟢 Зелёный
  'germany': 17,        // 🟢 Зелёный
  'canada': 14,         // 🟢 Зелёный
  'australia': 12,      // 🟢 Зелёный
  'new-zealand': 10,    // 🟢 Зелёный
  'uae': 15,            // 🟢 Зелёный
  'qatar': 13,          // 🟢 Зелёный
  'oman': 12,           // 🟢 Зелёный
  'kuwait': 14,         // 🟢 Зелёный
  'bahrain': 15,        // 🟢 Зелёный
  'jordan': 16,         // 🟢 Зелёный
  'switzerland': 8,     // 🟢 Зелёный
  'norway': 9,          // 🟢 Зелёный
  'sweden': 10,         // 🟢 Зелёный
  'finland': 11,        // 🟢 Зелёный
  'ireland': 9,         // 🟢 Зелёный
  'portugal': 10,       // 🟢 Зелёный
  'singapore': 7,       // 🟢 Зелёный

  // ===== МИНИМАЛЬНЫЙ РИСК (9-0) =====
  'iceland': 4,
  'luxembourg': 5,
  'denmark': 6,
  'netherlands': 7,

  // Другие страны (по умолчанию)
  'default': 30
};

// ============================================================
// ФУНКЦИЯ ПОЛУЧЕНИЯ ДАННЫХ ИЗ ВНЕШНИХ ИСТОЧНИКОВ
// ============================================================
async function fetchExternalData() {
  const results = {
    conflicts: {},   // ACLED — бои, жертвы
    protests: {},    // Протесты, беспорядки
    news: {},        // Новостные сигналы
    security: {}     // Военная активность (NOTAM, GPS, суда)
  };

  try {
    // 1. ACLED (конфликты) — через твой API
    const acledRes = await fetch('http://localhost:3117/api/acled/');
    if (acledRes.ok) {
      const data = await acledRes.json();
      if (data.success && data.data) {
        for (const item of data.data) {
          let country = item.country || 'unknown';
       // Нормализуем через алиасы
       country = COUNTRY_ALIASES[country] || country.toLowerCase().replace(/\s+/g, '-');
          if (!results.conflicts[country]) results.conflicts[country] = [];
          results.conflicts[country].push({
            severity: item.severity || 'medium',
            fatalities: item.fatalities || 0,
            timestamp: item.timestamp || Date.now()
          });
        }
      }
    }
  } catch (e) { console.warn('[CII] ACLED:', e.message); }

  try {
    // 2. NOTAM (военная активность)
    const notamRes = await fetch('http://localhost:3117/api/notam/');
    if (notamRes.ok) {
      const data = await notamRes.json();
      if (data.success && data.data) {
        for (const item of data.data) {
          let country = item.region || 'unknown';
country = COUNTRY_ALIASES[country] || country.toLowerCase().replace(/\s+/g, '-');
          if (!results.security[country]) results.security[country] = [];
          results.security[country].push({
            severity: item.severity || 'medium',
            type: 'notam'
          });
        }
      }
    }
  } catch (e) { console.warn('[CII] NOTAM:', e.message); }

  try {
    // 3. GPS-глушение
    const gpsRes = await fetch('http://localhost:3117/api/gps-jamming/');
    if (gpsRes.ok) {
      const data = await gpsRes.json();
      if (data.success && data.data) {
        for (const item of data.data) {
          let country = item.region || 'unknown';
country = COUNTRY_ALIASES[country] || country.toLowerCase().replace(/\s+/g, '-');
          if (!results.security[country]) results.security[country] = [];
          results.security[country].push({
            severity: item.severity || 'medium',
            type: 'gps-jamming'
          });
        }
      }
    }
  } catch (e) { console.warn('[CII] GPS:', e.message); }

  return results;
}

// ============================================================
// РАСЧЁТ CII (Country Instability Index)
// ============================================================
function calculateCII(country, baseRisk, externalData) {
  // 1. Базовый риск (40% веса)
  const base = (baseRisk || 30) * 0.7;

  // 2. Событийный балл (60% веса)
  let eventScore = 0;
  let totalWeight = 0;

  // 2a. Конфликты (30% от событийного балла = 18% от общего)
  const conflicts = externalData.conflicts?.[country] || [];
  const conflictWeight = 30;
  let conflictScore = 0;
  for (const c of conflicts) {
    const severity = c.severity === 'critical' ? 100 :
                     c.severity === 'high' ? 80 :
                     c.severity === 'medium' ? 50 : 20;
    const fatalitiesFactor = Math.min(c.fatalities || 0, 10) / 10 * 30;
    conflictScore = Math.max(conflictScore, severity + fatalitiesFactor);
  }
  conflictScore = Math.min(conflictScore, 100);
  eventScore += conflictScore * conflictWeight;
  totalWeight += conflictWeight;

  // 2b. Новостной шум (25% от событийного = 15% от общего)
  const newsCount = (externalData.news?.[country] || []).length;
  const newsWeight = 25;
  let newsScore = Math.min(newsCount * 5, 100);
  eventScore += newsScore * newsWeight;
  totalWeight += newsWeight;

  // 2c. Нестабильность (протесты) (25% от событийного = 15% от общего)
  const protests = (externalData.protests?.[country] || []).length;
  const protestWeight = 25;
  let protestScore = Math.min(protests * 8, 100);
  eventScore += protestScore * protestWeight;
  totalWeight += protestWeight;

  // 2d. Безопасность (военная активность) (20% от событийного = 12% от общего)
  const securityEvents = (externalData.security?.[country] || []).length;
  const securityWeight = 20;
  let securityScore = Math.min(securityEvents * 10, 100);
  eventScore += securityScore * securityWeight;
  totalWeight += securityWeight;

  // Нормализуем событийный балл
  const normalizedEventScore = totalWeight > 0 ? (eventScore / totalWeight) : 0;

  // 3. Итоговый CII
  let cii = base + (normalizedEventScore * 0.3);

  // Ограничиваем 0-100
  return Math.min(Math.max(Math.round(cii), 0), 100);
}

// ============================================================
// МАППИНГ CII -> СТАТУС
// ============================================================
function ciiToStatus(cii) {
  if (cii >= 65) return 'critical';   // было 80
  if (cii >= 50) return 'pre-war';    // было 60
  if (cii >= 35) return 'high';       // было 45
  if (cii >= 20) return 'medium';     // было 25
  return 'low';
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ — РАСЧЁТ СТАТУСОВ ДЛЯ ВСЕХ СТРАН
// ============================================================
export async function calculateAllStatuses() {
  try {
    // 1. Получаем данные из внешних источников
    const externalData = await fetchExternalData();

    // 2. Получаем список стран из GeoJSON
    const geojsonPath = path.join(DATA_DIR, 'geo/world.geojson');
    let countries = [];
    try {
      const geojson = JSON.parse(await fs.readFile(geojsonPath, 'utf8'));
      if (geojson.features) {
        countries = geojson.features.map(f => f.properties?.name || '');
      }
    } catch (e) {
      console.warn('[CII] GeoJSON не найден, используем базовый список');
      countries = Object.keys(BASE_RISK);
    }

    // 3. Для каждой страны рассчитываем CII
    const result = {};
    for (const country of countries) {
      if (!country || country === 'Antarctica') continue;

      // Нормализуем имя через алиасы
      const normalized = COUNTRY_ALIASES[country] || country
        .replace(/[^a-z\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();

      const baseRisk = BASE_RISK[normalized] || BASE_RISK.default || 30;
      const cii = calculateCII(normalized, baseRisk, externalData);
      const status = ciiToStatus(cii);

      // Красивое имя для отображения
      const displayName = country;

      result[normalized] = {
        name: displayName,
        status: status,
        cii: cii,
        baseRisk: baseRisk
      };
    }

    return result;
  } catch (e) {
    console.error('[CII] Ошибка:', e);
    return null;
  }
}

// ============================================================
// API ОБРАБОТЧИК
// ============================================================
export async function handleCIIAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/api/cii/status') {
    try {
      const statuses = await calculateAllStatuses();
      if (statuses) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          status: { countries: statuses },
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Ошибка расчёта CII' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return true;
  }

  // Если роут не найден
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Not found' }));
  return false;
}
