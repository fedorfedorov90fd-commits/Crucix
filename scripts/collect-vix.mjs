#!/usr/bin/env node
// ============================================================
// COLLECT-VIX.MJS — Сборщик данных индекса VIX (РЕАЛЬНЫЙ)
// ============================================================
// Собирает реальные данные индекса волатильности VIX
// Источник: Yahoo Finance (бесплатно, без ключа)
// Сохраняет в: data/basket/vix.json
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'vix.json');

// ============================================================
// 1. ЗАГРУЗКА СУЩЕСТВУЮЩИХ ДАННЫХ (чтобы не потерять историю)
// ============================================================

async function loadExistingData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// ============================================================
// 2. ПОЛУЧЕНИЕ РЕАЛЬНЫХ ДАННЫХ ИЗ YAHOO FINANCE
// ============================================================

async function fetchVIXFromYahoo() {
    try {
        // Yahoo Finance API (бесплатный, без ключа)
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1mo';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const result = data.chart.result[0];
        
        if (!result) {
            throw new Error('Нет данных от Yahoo Finance');
        }
        
        const timestamps = result.timestamp || [];
        const quotes = result.indicators.quote[0] || {};
        const closes = quotes.close || [];
        
        // Формируем массив данных
        const newData = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] !== null && closes[i] !== undefined) {
                const date = new Date(timestamps[i] * 1000);
                const dateStr = date.toISOString().split('T')[0];
                
                // Вычисляем изменение
                let change = 0;
                if (i > 0 && closes[i-1] !== null) {
                    change = Math.round((closes[i] - closes[i-1]) * 100) / 100;
                }
                
                newData.push({
                    date: dateStr,
                    value: Math.round(closes[i] * 100) / 100,
                    change: change
                });
            }
        }
        
        console.log(`[VIX] ✅ Получено ${newData.length} записей из Yahoo Finance`);
        return newData;
        
    } catch (error) {
        console.error(`[VIX] ❌ Ошибка получения данных:`, error.message);
        return null;
    }
}

// ============================================================
// 3. ОБЪЕДИНЕНИЕ С СУЩЕСТВУЮЩИМИ ДАННЫМИ
// ============================================================

function mergeData(existing, newData) {
    if (!newData || newData.length === 0) {
        return existing;
    }
    
    // Создаем карту существующих дат
    const existingDates = new Set(existing.map(d => d.date));
    
    // Добавляем только новые записи
    const merged = [...existing];
    for (const item of newData) {
        if (!existingDates.has(item.date)) {
            merged.push(item);
        }
    }
    
    // Сортируем по дате
    merged.sort((a, b) => a.date.localeCompare(b.date));
    
    return merged;
}

// ============================================================
// 4. СОХРАНЕНИЕ В КОРЗИНУ
// ============================================================

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[VIX] ✅ Сохранено ${data.length} записей в корзину`);
        return true;
    } catch (error) {
        console.error(`[VIX] ❌ Ошибка сохранения:`, error.message);
        return false;
    }
}

// ============================================================
// 5. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

async function collectVIX() {
    console.log('[VIX] 📡 Начинаем сбор реальных данных...');
    
    // Загружаем существующие данные
    const existing = await loadExistingData();
    console.log(`[VIX] 📊 Существующих записей: ${existing.length}`);
    
    // Получаем новые данные
    const newData = await fetchVIXFromYahoo();
    
    if (newData && newData.length > 0) {
        // Объединяем
        const merged = mergeData(existing, newData);
        await saveToBasket(merged);
        console.log(`[VIX] ✅ Сбор завершен. Всего: ${merged.length} записей`);
        return merged;
    } else {
        console.log('[VIX] ⚠️ Новых данных нет, используем существующие');
        return existing;
    }
}

// ============================================================
// 6. ЗАПУСК
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
    collectVIX().catch(console.error);
}

export { collectVIX, fetchVIXFromYahoo, mergeData };
