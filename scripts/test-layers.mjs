#!/usr/bin/env node

// ============================================================
// TEST-LAYERS.MJS — Тестирование слоёв с учётом типа визуализации
// Запуск: node scripts/test-layers.mjs
// ============================================================

const BASE_URL = 'http://localhost:3117';
const LAYERS_API = '/api/layers';

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function testLayer(layerId) {
    const url = `${BASE_URL}/api/layers/${layerId}`;
    const data = await fetchJSON(url);
    if (!data || !data.success) {
        return { layerId, status: '❌', error: 'API не отвечает или success=false' };
    }

    const features = data.data?.features || [];
    if (!Array.isArray(features) || features.length === 0) {
        return { layerId, status: '⚠️', error: 'Нет features (пусто)' };
    }

    const vizType = data.meta?.visualizationType || 'marker';
    let hasData = false;

    if (vizType === 'choropleth') {
        // Для choropleth проверяем наличие country и value
        for (const f of features) {
            const props = f.properties || {};
            if (props.name || props.country) {
                hasData = true;
                break;
            }
        }
        if (!hasData) {
            return { layerId, status: '⚠️', error: 'Нет данных по странам (choropleth)' };
        }
        return { layerId, status: '✅', count: features.length, vizType: 'choropleth' };
    } else {
        // Для маркеров проверяем координаты
        let hasCoords = false;
        for (const f of features) {
            // Проверяем geometry.coordinates
            if (f.geometry && f.geometry.coordinates && f.geometry.coordinates.length >= 2) {
                const lng = f.geometry.coordinates[0];
                const lat = f.geometry.coordinates[1];
                if (lat !== 0 && lng !== 0) {
                    hasCoords = true;
                    break;
                }
            }
            // Проверяем плоские lat/lng
            if (f.lat !== undefined && f.lng !== undefined) {
                if (f.lat !== 0 && f.lng !== 0) {
                    hasCoords = true;
                    break;
                }
            }
            // Проверяем latitude/longitude
            if (f.latitude !== undefined && f.longitude !== undefined) {
                if (f.latitude !== 0 && f.longitude !== 0) {
                    hasCoords = true;
                    break;
                }
            }
            // Проверяем properties
            const props = f.properties || {};
            if (props.lat !== undefined && props.lng !== undefined) {
                if (props.lat !== 0 && props.lng !== 0) {
                    hasCoords = true;
                    break;
                }
            }
        }
        if (!hasCoords) {
            return { layerId, status: '⚠️', error: 'Нет координат в данных' };
        }
        return { layerId, status: '✅', count: features.length, vizType: 'marker' };
    }
}

async function main() {
    console.log('\n🧪 ТЕСТИРОВАНИЕ СЛОЁВ CRUCIX (с учётом choropleth)\n');
    console.log('Загрузка списка слоёв...');
    const layersData = await fetchJSON(`${BASE_URL}${LAYERS_API}`);
    if (!layersData || !layersData.success) {
        console.error('❌ Не удалось получить список слоёв');
        process.exit(1);
    }
    const layers = layersData.layers || [];
    console.log(`Найдено слоёв: ${layers.length}\n`);

    let passed = 0, failed = 0, warning = 0;
    const results = [];

    for (const layer of layers) {
        const result = await testLayer(layer.id);
        results.push(result);
        if (result.status === '✅') passed++;
        else if (result.status === '⚠️') warning++;
        else failed++;
        const vizLabel = result.vizType === 'choropleth' ? '🌍' : '📍';
        console.log(`  ${result.status} ${vizLabel} ${layer.id} (${layer.name})${result.count ? ` — ${result.count} записей` : ''} ${result.error || ''}`);
    }

    console.log('\n📊 ИТОГ:');
    console.log(`  ✅ Работают: ${passed}`);
    console.log(`  ⚠️ Предупреждения: ${warning}`);
    console.log(`  ❌ Ошибки: ${failed}`);
    console.log(`  Всего слоёв: ${layers.length}`);

    if (failed > 0) {
        console.log('\n❌ Слои с ошибками:');
        for (const r of results) {
            if (r.status === '❌') {
                console.log(`   - ${r.layerId}: ${r.error}`);
            }
        }
    }
    if (warning > 0) {
        console.log('\n⚠️ Слои с предупреждениями:');
        for (const r of results) {
            if (r.status === '⚠️') {
                console.log(`   - ${r.layerId}: ${r.error}`);
            }
        }
    }
    console.log('\n✅ Тестирование завершено.');
}

main().catch(console.error);
