#!/usr/bin/env node

// ============================================================
// GEO-MAP-DIAGNOSE.MJS — Диагностика геополитической карты
// ============================================================
// Запуск: node scripts/geo-map-diagnose.mjs
// ============================================================

import { promises as fs } from 'fs';
import { join } from 'path';
import http from 'http';

const PORT = 3117;
const HOST = 'localhost';
const BASKET_DIR = join(process.cwd(), 'data', 'basket');

// ============================================================
// 1. ЦВЕТА ДЛЯ ВЫВОДА
// ============================================================
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

function c(text, color) {
    return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

// ============================================================
// 2. HTTP ЗАПРОСЫ
// ============================================================
function fetchAPI(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: 'Ошибка парсинга JSON', raw: data });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

// ============================================================
// 3. ПРОВЕРКА ФАЙЛОВ В КОРЗИНЕ
// ============================================================
async function checkBasketFiles() {
    console.log(c('\n📁 1. ПРОВЕРКА ФАЙЛОВ В КОРЗИНЕ', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));

    try {
        const files = await fs.readdir(BASKET_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        console.log(`   Всего файлов: ${c(files.length, 'white')}`);
        console.log(`   JSON файлов: ${c(jsonFiles.length, 'white')}`);
        
        // Проверяем наличие ключевых слоев
        const criticalLayers = [
            'notam', 'gps-jamming', 'acled', 'vix', 'gold-oil', 
            'bdi', 'fires', 'earthquakes', 'noaa', 'ships',
            'war-preparation', 'nuclear-monitor', 'viirs'
        ];
        
        console.log(c('\n   Ключевые слои:', 'yellow'));
        for (const layer of criticalLayers) {
            const exists = jsonFiles.includes(`${layer}.json`);
            const icon = exists ? '✅' : '❌';
            const color = exists ? 'green' : 'red';
            console.log(`     ${icon} ${c(layer, color)} ${exists ? c('(найден)', 'dim') : c('(ОТСУТСТВУЕТ!)', 'red')}`);
        }
        
        return jsonFiles;
    } catch (err) {
        console.error(c(`   ❌ Ошибка: ${err.message}`, 'red'));
        return [];
    }
}

// ============================================================
// 4. ПРОВЕРКА API
// ============================================================
async function checkAPI() {
    console.log(c('\n🌐 2. ПРОВЕРКА API', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));

    try {
        // Проверяем список слоев
        const layersData = await fetchAPI('/api/layers');
        if (layersData.success) {
            console.log(`   ✅ /api/layers: ${c('200 OK', 'green')}`);
            console.log(`      Всего слоев: ${c(layersData.total || layersData.layers?.length || 0, 'white')}`);
            
            // Выводим категории
            const categories = {};
            for (const layer of (layersData.layers || [])) {
                const cat = layer.category || 'other';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(layer.id);
            }
            
            console.log(c('\n   Категории слоев:', 'yellow'));
            for (const [cat, ids] of Object.entries(categories)) {
                console.log(`     ${cat}: ${c(ids.length, 'white')} слоев`);
            }
        } else {
            console.log(`   ❌ /api/layers: ${c('ОШИБКА', 'red')}`);
        }
    } catch (err) {
        console.log(`   ❌ /api/layers: ${c(err.message, 'red')}`);
    }

    // Проверяем ключевые слои
    console.log(c('\n   Проверка ключевых слоев:', 'yellow'));
    const testLayers = ['notam', 'acled', 'vix', 'war-preparation'];
    for (const layer of testLayers) {
        try {
            const data = await fetchAPI(`/api/layers/${layer}`);
            if (data.success) {
                const count = data.data?.features?.length || 0;
                const icon = count > 0 ? '✅' : '⚠️';
                const color = count > 0 ? 'green' : 'yellow';
                console.log(`     ${icon} /api/layers/${layer}: ${c('200 OK', 'green')} — ${c(count, color)} маркеров`);
            } else {
                console.log(`     ❌ /api/layers/${layer}: ${c('ОШИБКА', 'red')}`);
            }
        } catch (err) {
            console.log(`     ❌ /api/layers/${layer}: ${c(err.message, 'red')}`);
        }
    }
}

// ============================================================
// 5. ПРОВЕРКА МАРКЕРОВ НА КАРТЕ
// ============================================================
async function checkMarkers() {
    console.log(c('\n📍 3. ПРОВЕРКА МАРКЕРОВ', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));

    try {
        const data = await fetchAPI('/api/geo/markers');
        if (data.success && data.markers) {
            const markers = data.markers;
            console.log(`   Всего маркеров: ${c(markers.length, 'white')}`);
            
            // Группируем по статусам
            const statuses = {};
            for (const m of markers) {
                const s = m.status || 'unknown';
                if (!statuses[s]) statuses[s] = [];
                statuses[s].push(m);
            }
            
            console.log(c('\n   Маркеры по статусам:', 'yellow'));
            const statusColors = {
                critical: 'red',
                'pre-war': 'magenta',
                high: 'yellow',
                medium: 'blue',
                low: 'green',
                unknown: 'dim'
            };
            for (const [status, items] of Object.entries(statuses)) {
                const color = statusColors[status] || 'white';
                console.log(`     ${c(status, color)}: ${c(items.length, 'white')}`);
            }
            
            // Проверяем наличие координат
            const invalid = markers.filter(m => !m.lat || !m.lng);
            if (invalid.length > 0) {
                console.log(c(`\n   ⚠️ Маркеров без координат: ${c(invalid.length, 'yellow')}`, 'yellow'));
            }
            
            return markers;
        } else {
            console.log(`   ❌ /api/geo/markers: ${c('ОШИБКА', 'red')}`);
        }
    } catch (err) {
        console.log(`   ❌ /api/geo/markers: ${c(err.message, 'red')}`);
    }
    return [];
}

// ============================================================
// 6. ПРОВЕРКА СТАТУСОВ СТРАН
// ============================================================
async function checkCountryStatus() {
    console.log(c('\n🌍 4. ПРОВЕРКА СТАТУСОВ СТРАН', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));

    try {
        const data = await fetchAPI('/api/geo/status');
        if (data.success && data.status && data.status.countries) {
            const countries = data.status.countries;
            console.log(`   Всего стран: ${c(Object.keys(countries).length, 'white')}`);
            
            // Группируем по статусам
            const statuses = {};
            for (const [id, country] of Object.entries(countries)) {
                const s = country.status || 'unknown';
                if (!statuses[s]) statuses[s] = [];
                statuses[s].push(country.name);
            }
            
            console.log(c('\n   Страны по статусам:', 'yellow'));
            const statusColors = {
                critical: 'red',
                'pre-war': 'magenta',
                high: 'yellow',
                medium: 'blue',
                low: 'green',
                unknown: 'dim'
            };
            for (const [status, items] of Object.entries(statuses)) {
                const color = statusColors[status] || 'white';
                console.log(`     ${c(status, color)}: ${c(items.length, 'white')}`);
                if (items.length <= 5) {
                    console.log(`       ${items.join(', ')}`);
                } else {
                    console.log(`       ${items.slice(0, 5).join(', ')} ... +${items.length - 5}`);
                }
            }
            
            return countries;
        } else {
            console.log(`   ❌ /api/geo/status: ${c('ОШИБКА', 'red')}`);
        }
    } catch (err) {
        console.log(`   ❌ /api/geo/status: ${c(err.message, 'red')}`);
    }
    return {};
}

// ============================================================
// 7. ПРОВЕРКА ФАЙЛА LAYER-MANAGER
// ============================================================
async function checkLayerManager() {
    console.log(c('\n📦 5. ПРОВЕРКА LAYER-MANAGER', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));

    const lmPath = join(process.cwd(), 'apis', 'layer-manager.mjs');
    try {
        const content = await fs.readFile(lmPath, 'utf-8');
        console.log(`   ✅ Файл существует: ${c(lmPath, 'dim')}`);
        
        // Проверяем наличие реестра
        if (content.includes('LAYER_REGISTRY')) {
            console.log(`   ✅ Реестр слоев найден`);
            
            // Считаем количество слоев
            const matches = content.match(/['"][a-zA-Z0-9-]+['"]:\s*\{/g);
            const count = matches ? matches.length : 0;
            console.log(`   📊 Слоев в реестре: ${c(count, 'white')}`);
        } else {
            console.log(`   ❌ LAYER_REGISTRY НЕ НАЙДЕН`);
        }
        
        return true;
    } catch (err) {
        console.log(`   ❌ Файл отсутствует: ${c(lmPath, 'red')}`);
        return false;
    }
}

// ============================================================
// 8. ПРОВЕРКА SSI (ИНДЕКС НАПРЯЖЕННОСТИ)
// ============================================================
async function checkSSI() {
    console.log(c('\n📊 6. ПРОВЕРКА SSI', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));

    try {
        const data = await fetchAPI('/api/geo/index');
        if (data.success) {
            console.log(`   ✅ /api/geo/index: ${c('200 OK', 'green')}`);
            console.log(`   Индекс: ${c(data.index || data.value || '—', 'white')}`);
            if (data.history) {
                console.log(`   История: ${c(data.history.length, 'white')} точек`);
            }
        } else {
            console.log(`   ❌ /api/geo/index: ${c('ОШИБКА', 'red')}`);
        }
    } catch (err) {
        console.log(`   ❌ /api/geo/index: ${c(err.message, 'red')}`);
    }
}

// ============================================================
// 9. ОБЩАЯ СТАТИСТИКА
// ============================================================
async function runDiagnostics() {
    console.log(c('\n' + '═'.repeat(70), 'cyan'));
    console.log(c('  🔍 ДИАГНОСТИКА ГЕОПОЛИТИЧЕСКОЙ КАРТЫ CRUCIX', 'bold'));
    console.log(c('  Версия: 1.0  |  Дата: ' + new Date().toLocaleString(), 'dim'));
    console.log(c('═'.repeat(70), 'cyan'));

    // Проверяем доступность сервера
    console.log(c('\n⚡ 0. ПРОВЕРКА СЕРВЕРА', 'cyan'));
    console.log(c('━'.repeat(60), 'dim'));
    try {
        await fetchAPI('/api/layers');
        console.log(`   ✅ Сервер доступен: ${c(`http://localhost:${PORT}`, 'green')}`);
    } catch (err) {
        console.log(c(`   ❌ Сервер НЕ ДОСТУПЕН: ${err.message}`, 'red'));
        console.log(c('   Запустите сервер: node server.mjs', 'yellow'));
        process.exit(1);
    }

    // Запускаем все проверки
    await checkBasketFiles();
    await checkAPI();
    await checkMarkers();
    await checkCountryStatus();
    await checkLayerManager();
    await checkSSI();

    // Итоговый вывод
    console.log(c('\n' + '═'.repeat(70), 'cyan'));
    console.log(c('  ✅ ДИАГНОСТИКА ЗАВЕРШЕНА', 'green'));
    console.log(c('═'.repeat(70), 'cyan'));
    console.log(c('\n  Для просмотра карты: http://localhost:3117/geo-map', 'dim'));
    console.log(c('  Для проверки слоев: http://localhost:3117/api/layers', 'dim'));
    console.log(c('  Для проверки конкретного слоя: http://localhost:3117/api/layers/notam', 'dim'));
    console.log('');
}

// ============================================================
// 10. ЗАПУСК
// ============================================================
runDiagnostics().catch(err => {
    console.error(c(`\n❌ КРИТИЧЕСКАЯ ОШИБКА: ${err.message}`, 'red'));
    console.error(err.stack);
    process.exit(1);
});

