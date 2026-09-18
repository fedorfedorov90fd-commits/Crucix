#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

async function generateDescriptions() {
    console.log('[Gen-Descriptions] Начинаем генерацию описаний...');

    // Загружаем существующие описания
    const descPath = join(PROJECT_ROOT, 'data/registry/registry-descriptions.json');
    let descData = { descriptions: {} };
    try {
        const content = await fs.readFile(descPath, 'utf-8');
        descData = JSON.parse(content);
    } catch (e) {
        console.log('[Gen-Descriptions] Создаём новый файл описаний');
        descData = { meta: { version: '1.0' }, descriptions: {} };
    }

    // Сканируем страницы
    const pagesDir = join(PROJECT_ROOT, 'dashboard/public');
    const pages = await fs.readdir(pagesDir);
    const pageFiles = pages.filter(f => f.endsWith('.html') && !f.startsWith('_'));

    // Сканируем API
    const apiDir = join(PROJECT_ROOT, 'apis/sources');
    const apiFiles = await fs.readdir(apiDir);
    const apiModules = apiFiles.filter(f => f.endsWith('.mjs') || f.endsWith('.js'));

    // Сканируем сборщики
    const collectorsDir = join(PROJECT_ROOT, 'scripts/collectors');
    let collectorFiles = [];
    try {
        collectorFiles = await fs.readdir(collectorsDir);
    } catch (e) { /* папка может отсутствовать */ }

    // Сканируем скрипты
    const scriptsDir = join(PROJECT_ROOT, 'scripts');
    const scriptFiles = await fs.readdir(scriptsDir);
    const scriptItems = scriptFiles.filter(f => !f.startsWith('collect') && !f.includes('collectors'));

    // Генерируем описания для страниц
    for (const file of pageFiles) {
        const key = file.replace(/\.html$/, '');
        if (!descData.descriptions[key]) {
            // Извлекаем имя из файла
            const name = key.replace(/[-_]/g, ' ').replace(/\(.*\)/g, '').trim();
            descData.descriptions[key] = name.length > 20 ? name.slice(0, 20) + '…' : name;
        }
    }

    // Генерируем описания для API
    for (const file of apiModules) {
        const key = file.replace(/\.(mjs|js)$/, '');
        if (!descData.descriptions[key]) {
            const name = key.replace(/[-_]/g, ' ').replace(/\(.*\)/g, '').trim();
            descData.descriptions[key] = name.length > 20 ? name.slice(0, 20) + '…' : name;
        }
    }

    // Генерируем описания для сборщиков
    for (const file of collectorFiles) {
        const key = file.replace(/\.(mjs|js)$/, '');
        if (!descData.descriptions[key]) {
            const name = key.replace(/^collect-/, '').replace(/[-_]/g, ' ').trim();
            descData.descriptions[key] = 'Сборщик: ' + (name.length > 15 ? name.slice(0, 15) + '…' : name);
        }
    }

    // Генерируем описания для скриптов
    for (const file of scriptItems) {
        if (file === 'collectors' || file.startsWith('.')) continue;
        const key = file.replace(/\.(mjs|js|sh)$/, '');
        if (!descData.descriptions[key]) {
            const name = key.replace(/[-_]/g, ' ').replace(/\(.*\)/g, '').trim();
            descData.descriptions[key] = name.length > 20 ? name.slice(0, 20) + '…' : name;
        }
    }

    // Обновляем метаданные
    descData.meta = {
        version: '1.0',
        last_updated: new Date().toISOString(),
        total_entries: Object.keys(descData.descriptions).length
    };

    // Сохраняем
    await fs.writeFile(descPath, JSON.stringify(descData, null, 2), 'utf-8');
    console.log(`[Gen-Descriptions] ✅ Сохранено ${Object.keys(descData.descriptions).length} описаний`);
    console.log(`[Gen-Descriptions] 📁 Файл: ${descPath}`);
}

generateDescriptions().catch(console.error);
