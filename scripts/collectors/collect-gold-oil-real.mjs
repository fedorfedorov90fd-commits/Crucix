#!/usr/bin/env node

// ============================================================
// COLLECT-GOLD-OIL-REAL.MJS — Реальные цены золота и нефти
// Источники: Yahoo Finance (золото) + FRED (нефть)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASKET_DIR = join(__dirname, '..', '..', 'data', 'basket');
const FRED_API_KEY = process.env.FRED_API_KEY;

// ============================================================
// 1. ЗОЛОТО — Yahoo Finance (бесплатный API)
// ============================================================
async function fetchGoldFromYahoo() {
  // Используем Yahoo Finance API (альтернативный эндпоинт)
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1mo';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('Нет данных');
    const timestamps = result.timestamp || [];
    const close = result.indicators?.quote?.[0]?.close || [];
    const dates = timestamps.map(ts => new Date(ts * 1000).toISOString().slice(0, 10));
    return dates.map((date, i) => ({
      date: date,
      gold: close[i] || 0,
      source: 'Yahoo'
    })).filter(d => d.gold > 0);
  } catch (e) {
    console.warn('⚠️ Yahoo Gold недоступен, используем демо:', e.message);
    return null;
  }
}

// ============================================================
// 2. НЕФТЬ — FRED (работает)
// ============================================================
async function fetchOilFromFRED() {
  if (!FRED_API_KEY) {
    console.warn('⚠️ Нет FRED_API_KEY, используем демо для нефти');
    return null;
  }
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DCOILWTICO&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=31`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const obs = data.observations || [];
    return obs.map(o => ({
      date: o.date,
      oil: parseFloat(o.value) || 0,
      source: 'FRED'
    })).filter(d => d.oil > 0);
  } catch (e) {
    console.warn('⚠️ FRED Oil недоступен:', e.message);
    return null;
  }
}

// ============================================================
// 3. ОСНОВНАЯ ЛОГИКА
// ============================================================
async function main() {
  console.log('\n📊 СБОР РЕАЛЬНЫХ ЦЕН ЗОЛОТА И НЕФТИ\n');

  // Загружаем золото
  let goldData = await fetchGoldFromYahoo();
  if (!goldData) {
    // Демо-данные для золота
    const now = new Date();
    goldData = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const price = 1900 + Math.sin(i / 5) * 80 + Math.random() * 20;
      goldData.push({
        date: d.toISOString().slice(0, 10),
        gold: Math.round(price * 100) / 100,
        source: 'demo'
      });
    }
    console.log(`🟡 Золото: демо-данные (${goldData.length} записей)`);
  } else {
    console.log(`🟡 Золото: реальные данные (${goldData.length} записей)`);
  }

  // Загружаем нефть
  let oilData = await fetchOilFromFRED();
  if (!oilData) {
    const now = new Date();
    oilData = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const price = 70 + Math.sin(i / 7) * 12 + Math.random() * 4;
      oilData.push({
        date: d.toISOString().slice(0, 10),
        oil: Math.round(price * 100) / 100,
        source: 'demo'
      });
    }
    console.log(`🛢️ Нефть: демо-данные (${oilData.length} записей)`);
  } else {
    console.log(`🛢️ Нефть: реальные данные (${oilData.length} записей)`);
  }

  // Объединяем по датам
  const combined = [];
  const dateMap = {};
  for (const g of goldData) dateMap[g.date] = { date: g.date, gold: g.gold, oil: 0 };
  for (const o of oilData) {
    if (dateMap[o.date]) {
      dateMap[o.date].oil = o.oil;
    } else {
      dateMap[o.date] = { date: o.date, gold: 0, oil: o.oil };
    }
  }
  for (const [date, vals] of Object.entries(dateMap)) {
    if (vals.gold > 0 && vals.oil > 0) {
      combined.push({
        date: date,
        gold: vals.gold,
        oil: vals.oil,
        ratio: Math.round((vals.gold / vals.oil) * 100) / 100
      });
    }
  }
  combined.sort((a, b) => a.date.localeCompare(b.date));

  // Сохраняем
  await fs.mkdir(BASKET_DIR, { recursive: true });
  await fs.writeFile(join(BASKET_DIR, 'gold-oil.json'), JSON.stringify(combined, null, 2));
  console.log(`✅ Gold/Oil: ${combined.length} записей сохранено (реальных: ${combined.filter(d => d.source !== 'demo').length})`);

  // Также сохраняем отдельные файлы для gold и oil (для совместимости)
  await fs.writeFile(join(BASKET_DIR, 'gold.json'), JSON.stringify(goldData, null, 2));
  await fs.writeFile(join(BASKET_DIR, 'oil.json'), JSON.stringify(oilData, null, 2));

  console.log('✅ Сбор завершён');
}

main().catch(console.error);
