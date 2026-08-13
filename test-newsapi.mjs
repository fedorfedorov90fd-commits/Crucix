#!/usr/bin/env node
// test-newsapi.mjs

import { searchNews, getTopNews } from './apis/sources/newsapi.mjs';

async function test() {
    console.log('=== ТЕСТИРОВАНИЕ NEWSAPI ===\n');
    
    // 1. Поиск
    console.log('1. Поиск "Ukraine"...');
    const searchResults = await searchNews('Ukraine', 5);
    console.log(`   Найдено: ${searchResults.length}`);
    if (searchResults.length > 0) {
        console.log('   Первая:', searchResults[0].title);
        console.log('   Источник:', searchResults[0].source);
    }
    
    // 2. Топ-новости
    console.log('\n2. Топ-новости США...');
    const topResults = await getTopNews('us', 5);
    console.log(`   Найдено: ${topResults.length}`);
    if (topResults.length > 0) {
        console.log('   Первая:', topResults[0].title);
    }
    
    console.log('\n✅ Тест завершён!');
}

test().catch(console.error);