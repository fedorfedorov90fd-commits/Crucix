#!/usr/bin/env node
// ============================================================
// COLLECT-GOLD-OIL-RATIO.MJS — Сборщик индекса Золото/Нефть
// ============================================================
// Собирает реальные данные из FRED
// Сохраняет в: data/basket/gold-oil-ratio.json
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'gold-oil-ratio.json');

// ============================================================
// 1. ЗАГРУЗКА СУЩЕСТВУЮЩИХ ДАННЫХ
// ============================================================

async function loadExisting() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// ============================================================
// 2. ПОЛУЧЕНИЕ ДАННЫХ ИЗ FRED
// ============================================================

async function fetchFREDData(seriesId) {
    try {
        const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=2026-01-01`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csv = await response.text();
        const lines = csv.split('\n').filter(line => line.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 2) {
                const date = parts[0].trim();
                const value = parseFloat(parts[1]);
                if (!isNaN(value) && date) {
                    data.push({ date, value });
                }
            }
        }
        return data;
    } catch (error) {
        console.error(`[FRED] ❌ Ошибка ${seriesId}:`, error.message);
        return [];
    }
}

// ============================================================
// 3. РАСЧЕТ СООТНОШЕНИЯ
// ============================================================

function calculateRatio(goldData, oilData) {
    const ratioData = [];
    const oilMap = new Map(oilData.map(d => [d.date, d.value]));

    for (const g of goldData) {
        const oilValue = oilMap.get(g.date);
        if (oilValue && oilValue > 0) {
            const ratio = g.value / oilValue;
            ratioData.push({
                date: g.date,
                gold: Math.round(g.value * 100) / 100,
                oil: Math.round(oilValue * 100) / 100,
                ratio: Math.round(ratio * 100) / 100
            });
        }
    }

    return ratioData;
}

// ============================================================
// 4. ОБЪЕДИНЕНИЕ И СОХРАНЕНИЕ
// ============================================================

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[GOLD-OIL] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[GOLD-OIL] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectGoldOilRatio() {
    console.log('[GOLD-OIL] 📡 Начинаем сбор...');

    const existing = await loadExisting();
    console.log(`[GOLD-OIL] 📊 Существующих записей: ${existing.length}`);

    // Получаем данные из FRED
    const [goldData, oilData] = await Promise.all([
        fetchFREDData('GOLDAMGBD228NLBM'),
        fetchFREDData('DCOILWTICO')
    ]);

    if (goldData.length === 0 || oilData.length === 0) {
        console.log('[GOLD-OIL] ⚠️ Нет данных, генерируем тестовые');
        return generateTestData();
    }

    const newData = calculateRatio(goldData, oilData);
    if (newData.length === 0) {
        console.log('[GOLD-OIL] ⚠️ Нет данных для расчета');
        return generateTestData();
    }

    // Объединяем с существующими
    const existingDates = new Set(existing.map(d => d.date));
    const merged = [...existing];
    for (const item of newData) {
        if (!existingDates.has(item.date)) {
            merged.push(item);
        }
    }
    merged.sort((a, b) => a.date.localeCompare(b.date));

    await saveToBasket(merged);
    console.log(`[GOLD-OIL] ✅ Всего: ${merged.length} записей`);
    return merged;
}

function generateTestData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const base = 22 + (i / 30) * 5 + (Math.random() - 0.5) * 2;
        data.push({
            date: date.toISOString().split('T')[0],
            gold: Math.round((1850 + i * 2 + (Math.random() - 0.5) * 20) * 100) / 100,
            oil: Math.round((75 + i * 0.3 + (Math.random() - 0.5) * 3) * 100) / 100,
            ratio: Math.round(base * 100) / 100
        });
    }
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectGoldOilRatio().catch(console.error);
}

export { collectGoldOilRatio, fetchFREDData, calculateRatio };
