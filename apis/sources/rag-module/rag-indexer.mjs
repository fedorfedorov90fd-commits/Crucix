#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';

const BASKET_PATH = process.env.CRUCIX_BASKET_PATH || '/home/ta8_/Рабочий стол/Crucix/data/basket/';
const DATA_DIR = join(dirname(process.argv[1]), 'rag_data');
const VECTORS_FILE = join(DATA_DIR, 'vectors.json');

if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

export function readBasket(basketPath) {
    if (!existsSync(basketPath)) {
        console.error(`❌ Корзина не найдена: ${basketPath}`);
        return [];
    }

    const files = readdirSync(basketPath);
    const results = [];

    for (const file of files) {
        const filePath = join(basketPath, file);
        const ext = extname(file);
        if (ext !== '.json') continue;

        try {
            const content = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const records = Array.isArray(data) ? data : [data];
            
            results.push({
                fileName: file,
                source: basename(file, '.json'),
                records: records,
                size: content.length
            });
        } catch (error) {
            console.warn(`⚠️ Не удалось прочитать ${file}:`, error.message);
        }
    }

    return results;
}

export function getBasketStats(basketPath) {
    if (!existsSync(basketPath)) {
        return { error: 'Корзина не найдена', path: basketPath };
    }

    const files = readdirSync(basketPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    let totalSize = 0;
    let totalRecords = 0;
    const sources = [];

    for (const file of jsonFiles) {
        const filePath = join(basketPath, file);
        const stats = statSync(filePath);
        totalSize += stats.size;
        
        try {
            const content = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const count = Array.isArray(data) ? data.length : 1;
            totalRecords += count;
            sources.push({
                name: basename(file, '.json'),
                count,
                size: stats.size
            });
        } catch (error) {
            // Пропускаем
        }
    }

    return {
        path: basketPath,
        fileCount: jsonFiles.length,
        totalSize: totalSize,
        totalSizeHuman: formatBytes(totalSize),
        totalRecords,
        sources: sources.sort((a, b) => b.count - a.count)
    };
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
}

function extractText(record) {
    const fields = ['title', 'name', 'description', 'content', 'summary', 'text', 'body', 'message', 'location', 'country', 'event_type', 'category', 'source'];
    let text = '';
    for (const field of fields) {
        if (record[field]) {
            text += ' ' + record[field];
        }
    }
    if (!text.trim()) {
        text = JSON.stringify(record);
    }
    return text.trim();
}

export function searchInBasket(basketPath, query, limit = 20) {
    const basket = readBasket(basketPath);
    const queryLower = query.toLowerCase();
    const results = [];

    for (const item of basket) {
        for (const record of item.records) {
            const searchable = [
                record.title,
                record.name,
                record.description,
                record.content,
                record.location,
                record.country,
                record.event_type,
                record.source,
                JSON.stringify(record)
            ].filter(Boolean).join(' ').toLowerCase();

            if (searchable.includes(queryLower)) {
                results.push({
                    ...record,
                    source: item.source,
                    fileName: item.fileName,
                    relevance: calculateRelevance(searchable, queryLower)
                });
            }
            if (results.length >= limit * 3) break;
        }
        if (results.length >= limit * 3) break;
    }

    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, limit);
}

function calculateRelevance(text, query) {
    const words = query.split(/\s+/);
    let matches = 0;
    for (const word of words) {
        if (word.length > 2 && text.includes(word)) {
            matches++;
        }
    }
    return words.length > 0 ? matches / words.length : 0;
}

export function getRelevantData(basketPath, query, limit = 30) {
    const searchResults = searchInBasket(basketPath, query, limit);
    return searchResults.map(item => ({
        source: item.source || 'unknown',
        title: item.title || item.name || 'Без названия',
        description: item.description || item.content || '',
        location: item.location || item.country || '',
        date: item.date || item.timestamp || '',
        data: item,
        relevance: item.relevance || 0
    }));
}

function generateVectors(basketData) {
    const vectors = [];
    let totalRecords = 0;

    for (const item of basketData) {
        for (const record of item.records) {
            const text = extractText(record);
            if (!text) continue;

            const hash = createHash('sha256').update(text).digest('hex');
            const embedding = Array.from(hash.slice(0, 64)).map(c => parseInt(c, 16) / 16);

            vectors.push({
                id: `${item.source}_${totalRecords}`,
                source: item.source,
                fileName: item.fileName,
                text: text,
                embedding: embedding,
                metadata: {
                    title: record.title || record.name || '',
                    location: record.location || record.country || '',
                    date: record.date || record.timestamp || '',
                    ...record
                }
            });
            totalRecords++;
        }
    }

    return vectors;
}

function main() {
    console.log('📊 Индексация корзины Crucix...');
    console.log(`📂 Путь: ${BASKET_PATH}`);
    
    const basketData = readBasket(BASKET_PATH);
    console.log(`📄 Найдено JSON-файлов: ${basketData.length}`);
    
    if (basketData.length === 0) {
        console.error('❌ Нет данных для индексации.');
        process.exit(1);
    }

    console.log('🔄 Генерация векторов...');
    const vectors = generateVectors(basketData);
    console.log(`📊 Сгенерировано векторов: ${vectors.length}`);

    writeFileSync(VECTORS_FILE, JSON.stringify(vectors, null, 2));
    console.log(`✅ Векторы сохранены в: ${VECTORS_FILE}`);

    const sources = {};
    for (const v of vectors) {
        sources[v.source] = (sources[v.source] || 0) + 1;
    }
    console.log('\n📋 Статистика по источникам:');
    for (const [source, count] of Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`   ${source}: ${count} записей`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
