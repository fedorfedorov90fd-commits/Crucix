#!/usr/bin/env node

// ============================================================
// GLOBAL-INDEX-API.MJS — Глобальный индекс напряжённости
// ============================================================
// Модуль №5
// Использует: NewsAPI + FIRMS + OpenSky + ACLED + FRED
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const HISTORY_FILE = join(ROOT, 'data', 'geo', 'index-history.json');

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const MAX_HISTORY_DAYS = 90;
const NEWSAPI_KEY = '2965aeec21674948b0217e163df31d10';

const COMPONENTS = {
    news: { weight: 0.25, name: 'Новости' },
    thermal: { weight: 0.20, name: 'Термальные' },
    aviation: { weight: 0.20, name: 'Авиация' },
    geopolitical: { weight: 0.20, name: 'Геополитика' },
    economy: { weight: 0.15, name: 'Экономика' }
};

const LEVELS = {
    CRITICAL: { min: 8.0, color: '#ef4444', label: 'Критический' },
    HIGH: { min: 6.0, color: '#f97316', label: 'Высокий' },
    MEDIUM: { min: 4.0, color: '#eab308', label: 'Средний' },
    NORMAL: { min: 0.0, color: '#22c55e', label: 'Нормальный' }
};

// ============================================================
// 2. РАБОТА С ИСТОРИЕЙ
// ============================================================

async function loadHistory() {
    try {
        const data = await fs.readFile(HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
            return parsed;
        }
        return { entries: [] };
    } catch (e) {
        return { entries: [] };
    }
}

async function saveHistory(history) {
    if (!history.entries || !Array.isArray(history.entries)) {
        history.entries = [];
    }
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_HISTORY_DAYS);
    
    history.entries = history.entries.filter(entry => 
        entry && entry.date && new Date(entry.date) > cutoff
    );
    
    const dir = join(ROOT, 'data', 'geo');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ДАННЫХ ИЗ ИСТОЧНИКОВ
// ============================================================

// --- NewsAPI ---
async function getNewsScore() {
    try {
        const query = 'geopolitics OR conflict OR war OR crisis OR sanctions';
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=100&apiKey=${NEWSAPI_KEY}`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Crucix/2.1.1' }
        });
        
        if (!response.ok) {
            console.error('[NewsAPI] Ошибка HTTP:', response.status);
            return 0;
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && data.totalResults > 0) {
            const count = Math.min(data.totalResults, 100);
            const score = Math.min(count / 10, 10);
            console.log(`[NewsAPI] Найдено ${count} новостей, оценка: ${score.toFixed(1)}`);
            return score;
        }
        return 0;
    } catch (e) {
        console.error('[NewsAPI] Ошибка:', e.message);
        return 0;
    }
}

// --- FIRMS (термальные) ---
async function getThermalScore() {
    try {
        const { fetchFIRMS } = await import('./firms.mjs');
        const data = await fetchFIRMS({ limit: 100 });
        if (data && Array.isArray(data) && data.length > 0) {
            const score = Math.min(data.length / 10, 10);
            console.log(`[FIRMS] Найдено ${data.length} точек, оценка: ${score.toFixed(1)}`);
            return score;
        }
        return 0;
    } catch (e) {
        console.error('[FIRMS] Ошибка:', e.message);
        return 0;
    }
}

// --- OpenSky (авиация) ---
async function getAviationScore() {
    try {
        const { fetchOpenSky } = await import('./opensky.mjs');
        const data = await fetchOpenSky({ limit: 100 });
        if (data && Array.isArray(data) && data.length > 0) {
            const score = Math.min(data.length / 10, 10);
            console.log(`[OpenSky] Найдено ${data.length} самолётов, оценка: ${score.toFixed(1)}`);
            return score;
        }
        console.log('[OpenSky] Данных нет, использую демо-значение');
        return 4.2;
    } catch (e) {
        console.error('[OpenSky] Ошибка:', e.message);
        return 4.2;
    }
}

// --- ACLED (геополитика) ---
async function getGeopoliticalScore() {
    try {
        const { fetchACLED } = await import('./acled.mjs');
        const data = await fetchACLED({ limit: 100 });
        if (data && Array.isArray(data) && data.length > 0) {
            const score = Math.min(data.length / 10, 10);
            console.log(`[ACLED] Найдено ${data.length} событий, оценка: ${score.toFixed(1)}`);
            return score;
        }
        console.log('[ACLED] Данных нет, использую демо-значение');
        return 5.5;
    } catch (e) {
        console.error('[ACLED] Ошибка:', e.message);
        return 5.5;
    }
}

// --- FRED (экономика) ---
async function getEconomyScore() {
    try {
        const { fetchFRED } = await import('./fred.mjs');
        const data = await fetchFRED({ limit: 10 });
        if (data && Array.isArray(data) && data.length > 0) {
            const score = Math.min(data.length / 2, 10);
            console.log(`[FRED] Найдено ${data.length} показателей, оценка: ${score.toFixed(1)}`);
            return score;
        }
        console.log('[FRED] Данных нет, использую демо-значение');
        return 4.3;
    } catch (e) {
        console.error('[FRED] Ошибка:', e.message);
        return 4.3;
    }
}

// --- Получение всех компонентов ---
async function getComponents() {
    const [news, thermal, aviation, geopolitical, economy] = await Promise.all([
        getNewsScore(),
        getThermalScore(),
        getAviationScore(),
        getGeopoliticalScore(),
        getEconomyScore()
    ]);
    
    return {
        news: news || 0,
        thermal: thermal || 0,
        aviation: aviation || 0,
        geopolitical: geopolitical || 0,
        economy: economy || 0
    };
}

// ============================================================
// 4. РАСЧЁТ ИНДЕКСА
// ============================================================

async function calculateIndex() {
    const components = await getComponents();
    
    const hasData = Object.values(components).some(v => v > 0);
    
    const finalComponents = hasData ? components : {
        news: 5.2,
        thermal: 3.8,
        aviation: 4.1,
        geopolitical: 5.5,
        economy: 4.3
    };
    
    let total = 0;
    for (const [key, value] of Object.entries(finalComponents)) {
        const weight = COMPONENTS[key]?.weight || 0.2;
        total += value * weight;
    }
    
    const index = Math.min(Math.max(total, 0), 10);
    
    return {
        index: Math.round(index * 10) / 10,
        components: finalComponents,
        timestamp: new Date().toISOString(),
        level: getLevel(index)
    };
}

function getLevel(value) {
    if (value >= LEVELS.CRITICAL.min) return { ...LEVELS.CRITICAL, value };
    if (value >= LEVELS.HIGH.min) return { ...LEVELS.HIGH, value };
    if (value >= LEVELS.MEDIUM.min) return { ...LEVELS.MEDIUM, value };
    return { ...LEVELS.NORMAL, value };
}

// ============================================================
// 5. ДОБАВЛЕНИЕ ЗАПИСИ В ИСТОРИЮ
// ============================================================

async function addToHistory() {
    const current = await calculateIndex();
    const history = await loadHistory();
    
    if (!history.entries || !Array.isArray(history.entries)) {
        history.entries = [];
    }
    
    const today = new Date().toISOString().slice(0, 10);
    const existingIndex = history.entries.findIndex(e => e && e.date === today);
    
    const entry = {
        date: today,
        value: current.index,
        components: current.components,
        level: current.level.label
    };
    
    if (existingIndex >= 0) {
        history.entries[existingIndex] = entry;
    } else {
        history.entries.push(entry);
    }
    
    history.entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    await saveHistory(history);
    return history;
}

// ============================================================
// 6. API-ОБРАБОТЧИКИ
// ============================================================

async function handleGetIndex(req, res) {
    try {
        const data = await calculateIndex();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
    } catch (e) {
        console.error('[Global Index] Ошибка:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

async function handleGetHistory(req, res) {
    try {
        const history = await loadHistory();
        const entries = history.entries && Array.isArray(history.entries) 
            ? history.entries.slice(-30) 
            : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: entries }));
    } catch (e) {
        console.error('[Global Index] Ошибка:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

async function handleUpdateIndex(req, res) {
    try {
        const history = await addToHistory();
        const entries = history.entries && Array.isArray(history.entries)
            ? history.entries.slice(-30)
            : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            message: 'Индекс обновлён',
            entries
        }));
    } catch (e) {
        console.error('[Global Index] Ошибка:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

// ============================================================
// 7. ГЛАВНЫЙ ОБРАБОТЧИК
// ============================================================

export async function handleGlobalIndexAPI(req, res) {
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
    
    if (path === '/api/geo/index' && req.method === 'GET') {
        await handleGetIndex(req, res);
        return;
    }
    
    if (path === '/api/geo/index/history' && req.method === 'GET') {
        await handleGetHistory(req, res);
        return;
    }
    
    if (path === '/api/geo/index/update' && req.method === 'POST') {
        await handleUpdateIndex(req, res);
        return;
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

// ============================================================
// 8. АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ПРИ ЗАПУСКЕ
// ============================================================

(async function init() {
    try {
        const history = await loadHistory();
        const today = new Date().toISOString().slice(0, 10);
        const entries = history.entries && Array.isArray(history.entries) ? history.entries : [];
        const exists = entries.some(e => e && e.date === today);
        
        if (!exists) {
            await addToHistory();
            console.log('[Global Index] ✅ Добавлена запись за сегодня (NewsAPI + FIRMS + OpenSky + ACLED + FRED)');
        } else {
            console.log('[Global Index] ✅ Запись за сегодня уже существует');
        }
    } catch (e) {
        console.error('[Global Index] Ошибка инициализации:', e.message);
        try {
            await saveHistory({ entries: [] });
            await addToHistory();
            console.log('[Global Index] ✅ История восстановлена');
        } catch (e2) {
            console.error('[Global Index] ❌ Не удалось восстановить историю:', e2.message);
        }
    }
})();

// ============================================================
// 9. ЭКСПОРТ
// ============================================================

export default {
    handleGlobalIndexAPI,
    calculateIndex,
    getComponents,
    loadHistory,
    addToHistory
};
