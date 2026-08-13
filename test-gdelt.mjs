#!/usr/bin/env node
// test-gdelt.mjs

import { getRecentEvents, getEventsViaSearch, getGeoEvents } from './apis/sources/gdelt.mjs';

async function test() {
    console.log('=== ТЕСТИРОВАНИЕ GDELT API (альтернативные эндпоинты) ===\n');

    // 1. Проверка через Search API
    console.log('1. Search API (query: "Ukraine")...');
    const searchEvents = await getEventsViaSearch('Ukraine', 24, 5);
    console.log(`   Найдено: ${searchEvents.length}`);
    if (searchEvents.length > 0) {
        console.log('   Первое:', searchEvents[0].title);
        console.log('   Источник:', searchEvents[0].source);
    }

    // 2. Проверка через GeoFeed
    console.log('\n2. GeoFeed API...');
    const geoEvents = await getGeoEvents(24, 5);
    console.log(`   Найдено: ${geoEvents.length}`);
    if (geoEvents.length > 0) {
        console.log('   Первое:', geoEvents[0].title);
        console.log('   Координаты:', geoEvents[0].coordinates);
    }

    // 3. Проверка через Doc API
    console.log('\n3. Doc API...');
    const docEvents = await getRecentEvents(24, 5);
    console.log(`   Найдено: ${docEvents.length}`);

    console.log('\n✅ Тест завершён!');
}

test().catch(console.error);
