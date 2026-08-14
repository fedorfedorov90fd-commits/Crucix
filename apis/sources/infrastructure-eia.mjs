#!/usr/bin/env node

// ============================================================
// EIA — ЭНЕРГЕТИЧЕСКАЯ ИНФОРМАЦИОННАЯ АДМИНИСТРАЦИЯ США
// ============================================================
// Реальная интеграция с API EIA
// API-ключ: tX3NjITQvfF486UoJyWfmEnVHBPRcn8luVKwMED6
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Загружаем .env
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const CACHE_DIR = join(ROOT, 'data', 'infrastructure', 'cache');
const EIA_CACHE = join(CACHE_DIR, 'eia_cache.json');

// API-ключ из .env или напрямую
const EIA_API_KEY = process.env.EIA_API_KEY || 'tX3NjITQvfF486UoJyWfmEnVHBPRcn8luVKwMED6';
const EIA_API_URL = 'https://api.eia.gov/v2';

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {}
}

async function loadCache() {
    try {
        const data = await fs.readFile(EIA_CACHE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { data: [], lastUpdate: null };
    }
}

async function saveCache(cacheData) {
    await ensureDir(CACHE_DIR);
    await fs.writeFile(EIA_CACHE, JSON.stringify(cacheData, null, 2));
}

function isCacheValid(timestamp, maxAge = 86400) { // 24 часа
    return Date.now() - timestamp < maxAge * 1000;
}

function normalizePlantType(type) {
    const types = {
        'Nuclear': 'nuclear_power_plant',
        'Coal': 'coal_power_plant',
        'Natural Gas': 'gas_power_plant',
        'Gas': 'gas_power_plant',
        'Hydro': 'hydro_power_plant',
        'Wind': 'wind_power_plant',
        'Solar': 'solar_power_plant',
        'Geothermal': 'geothermal_power_plant',
        'Biomass': 'biomass_power_plant',
        'Oil': 'oil_power_plant',
        'Other': 'other_power_plant'
    };
    return types[type] || 'power_plant';
}

function determineStatus(plant) {
    if (plant.operational === false) return 'critical';
    if (plant.outages && plant.outages.length > 0) return 'warning';
    if (plant.capacity && plant.capacity > 0) return 'normal';
    return 'warning';
}

function calculateVulnerability(plant) {
    let score = 3;

    if (plant.yearBuilt) {
        const age = new Date().getFullYear() - plant.yearBuilt;
        if (age > 50) score += 2;
        else if (age > 30) score += 1;
    }

    if (plant.capacity > 1000) score += 1.5;
    else if (plant.capacity > 500) score += 1;
    else if (plant.capacity > 100) score += 0.5;

    if (plant.type === 'Nuclear') score += 2;
    else if (plant.type === 'Coal') score += 1;
    else if (plant.type === 'Gas') score += 0.5;

    if (!plant.operational) score += 2;
    if (plant.sanctions) score += 1;

    return Math.min(10, Math.round(score * 10) / 10);
}

// ============================================================
// 2. ЗАПРОС К РЕАЛЬНОМУ API EIA
// ============================================================

async function fetchRealEIAPlants() {
    console.log('[EIA] Запрос к реальному API...');

    try {
        // Запрос к EIA API для получения данных об электростанциях
        const url = `${EIA_API_URL}/electricity/plant-data/data/?api_key=${EIA_API_KEY}&facets[plantState][]=US&length=500`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Crucix-Infrastructure/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`EIA API ошибка: ${response.status}`);
        }

        const data = await response.json();

        if (!data.response || !data.response.data) {
            throw new Error('Неверный формат ответа EIA');
        }

        // Преобразуем в единый формат
        const plants = data.response.data.map(item => ({
            id: `eia-${item.plantId || item.plantCode || Date.now()}`,
            name: item.plantName || 'Неизвестная станция',
            type: normalizePlantType(item.primaryFuel || item.fuelType || 'Other'),
            layer: 'energy',
            country: 'США',
            coordinates: {
                lat: parseFloat(item.latitude) || 0,
                lng: parseFloat(item.longitude) || 0
            },
            status: determineStatus(item),
            statusReason: item.statusReason || '',
            capacity: parseFloat(item.capacity) || 0,
            unit: 'MW',
            owner: item.owner || 'Неизвестно',
            operational: item.operational !== false,
            vulnerability: calculateVulnerability(item),
            risks: [],
            cascade: [],
            sanctions: false,
            yearBuilt: item.yearBuilt || null,
            source: 'EIA (real)',
            lastUpdate: new Date().toISOString()
        }));

        // Фильтруем объекты с корректными координатами
        const validPlants = plants.filter(p =>
            p.coordinates.lat !== 0 && p.coordinates.lng !== 0
        );

        // Сохраняем в кэш
        await saveCache({
            data: validPlants,
            lastUpdate: Date.now()
        });

        console.log(`[EIA] Загружено ${validPlants.length} электростанций из реального API`);
        return validPlants;

    } catch (error) {
        console.error('[EIA] Ошибка запроса к API:', error.message);
        // При ошибке возвращаем тестовые данные
        return getTestData();
    }
}

// ============================================================
// 3. ТЕСТОВЫЕ ДАННЫЕ (FALLBACK)
// ============================================================

function getTestData() {
    return [
        {
            id: 'eia-test-001',
            name: 'АЭС Пало-Верде (тест)',
            type: 'nuclear_power_plant',
            layer: 'energy',
            country: 'США',
            coordinates: { lat: 33.389, lng: -112.865 },
            status: 'normal',
            capacity: 3937,
            unit: 'MW',
            owner: 'Arizona Public Service',
            operational: true,
            vulnerability: 6.5,
            source: 'EIA (test)',
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'eia-test-002',
            name: 'АЭС Секвойя (тест)',
            type: 'nuclear_power_plant',
            layer: 'energy',
            country: 'США',
            coordinates: { lat: 35.038, lng: -85.056 },
            status: 'warning',
            capacity: 2339,
            unit: 'MW',
            owner: 'TVA',
            operational: true,
            vulnerability: 7.8,
            source: 'EIA (test)',
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'eia-test-003',
            name: 'ГЭС Гувер (тест)',
            type: 'hydro_power_plant',
            layer: 'energy',
            country: 'США',
            coordinates: { lat: 36.016, lng: -114.738 },
            status: 'warning',
            capacity: 2080,
            unit: 'MW',
            owner: 'US Bureau of Reclamation',
            operational: true,
            vulnerability: 7.2,
            source: 'EIA (test)',
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'eia-test-004',
            name: 'ТЭС Дрезден (тест)',
            type: 'coal_power_plant',
            layer: 'energy',
            country: 'США',
            coordinates: { lat: 41.389, lng: -88.261 },
            status: 'critical',
            capacity: 0,
            unit: 'MW',
            owner: 'Exelon',
            operational: false,
            vulnerability: 8.5,
            source: 'EIA (test)',
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'eia-test-005',
            name: 'ВЭС Роузмаунт (тест)',
            type: 'wind_power_plant',
            layer: 'energy',
            country: 'США',
            coordinates: { lat: 44.5, lng: -92.5 },
            status: 'normal',
            capacity: 400,
            unit: 'MW',
            owner: 'Xcel Energy',
            operational: true,
            vulnerability: 2.5,
            source: 'EIA (test)',
            lastUpdate: new Date().toISOString()
        }
    ];
}

// ============================================================
// 4. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchEIAPlants() {
    // Проверяем кэш
    const cache = await loadCache();
    if (cache.data.length > 0 && isCacheValid(cache.lastUpdate)) {
        console.log('[EIA] Использую кэшированные данные');
        return cache.data;
    }

    // Пытаемся получить реальные данные
    try {
        return await fetchRealEIAPlants();
    } catch (error) {
        console.error('[EIA] Ошибка получения реальных данных:', error.message);
        return getTestData();
    }
}

// ============================================================
// 5. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleEIAApi(req, res) {
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
        if (path === '/api/infrastructure/eia/plants') {
            const plants = await fetchEIAPlants();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: plants.length,
                plants: plants,
                source: plants[0]?.source || 'EIA',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (path === '/api/infrastructure/eia/status') {
            const plants = await fetchEIAPlants();
            const stats = {
                total: plants.length,
                nuclear: plants.filter(p => p.type === 'nuclear_power_plant').length,
                hydro: plants.filter(p => p.type === 'hydro_power_plant').length,
                coal: plants.filter(p => p.type === 'coal_power_plant').length,
                gas: plants.filter(p => p.type === 'gas_power_plant').length,
                renewable: plants.filter(p => p.type === 'wind_power_plant' || p.type === 'solar_power_plant').length,
                critical: plants.filter(p => p.status === 'critical').length,
                warning: plants.filter(p => p.status === 'warning').length,
                normal: plants.filter(p => p.status === 'normal').length
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats,
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
// 6. ЭКСПОРТ
// ============================================================

export default {
    handleEIAApi,
    fetchEIAPlants
};
