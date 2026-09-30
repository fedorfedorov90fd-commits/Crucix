#!/usr/bin/env node

// ============================================================
// COLLECT-ALL.MJS — Запуск всех сборщиков данных
// Запуск: node scripts/collect-all.mjs
// ============================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const __dirname = process.cwd();

// Сборщики, которые нужно пропустить (если есть проблемы)
const SKIP = [
    'collect-all.mjs',
    'collect-test.mjs',
    'collect-daily-report.mjs',
    'collect-celestrak.mjs',
    'collect-feeds.mjs',          // зависает (много RSS)
    'collect-rest-countries.mjs',
    'collect-worldbank.mjs',
    'collect-trading-economics.mjs',
    'collect-openmeteo.mjs',
    'collect-rss-extra.mjs'
];

async function getCollectors() {
    const scriptsDir = path.join(__dirname, 'scripts');
    const files = await fs.readdir(scriptsDir);
    return files
        .filter(f => f.startsWith('collect-') && f.endsWith('.mjs'))
        .filter(f => !SKIP.includes(f))
        .sort();
}

async function runCollector(file) {
    const fullPath = path.join(__dirname, 'scripts', file);
    const start = Date.now();
    try {
        console.log(`\n📡 Запуск: ${file}...`);
        const { stdout, stderr } = await execAsync(`node "${fullPath}"`, {
            timeout: 30000 // 30 секунд на сборщик
        });
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        if (stdout) console.log(stdout.trim());
        if (stderr) console.warn(stderr.trim());
        console.log(`✅ ${file} — завершён за ${elapsed}с`);
        return { file, status: 'ok', elapsed };
    } catch (error) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        if (error.code === 'ETIMEDOUT' || error.killed) {
            console.error(`⏰ ${file} — превышен таймаут (30с)`);
        } else {
            console.error(`❌ ${file} — ошибка: ${error.message} (${elapsed}с)`);
        }
        return { file, status: 'error', error: error.message, elapsed };
    }
}

async function main() {
    console.log('\n🚀 ЗАПУСК ВСЕХ СБОРЩИКОВ CRUCIX\n');
    console.log('═'.repeat(50));

    const collectors = await getCollectors();
    console.log(`📋 Найдено сборщиков: ${collectors.length}\n`);

    let ok = 0, fail = 0, timeout = 0;
    const results = [];

    for (const file of collectors) {
        const result = await runCollector(file);
        results.push(result);
        if (result.status === 'ok') ok++;
        else if (result.error && result.error.includes('таймаут')) timeout++;
        else fail++;
    }

    console.log('\n' + '═'.repeat(50));
    console.log('\n📊 ИТОГОВЫЙ ОТЧЁТ:');
    console.log(`  ✅ Успешно: ${ok}`);
    console.log(`  ⏰ Таймаут: ${timeout}`);
    console.log(`  ❌ Ошибок: ${fail}`);
    console.log(`  📡 Всего: ${collectors.length}`);

    if (fail > 0 || timeout > 0) {
        console.log('\n⚠️ Проблемные сборщики:');
        for (const r of results) {
            if (r.status !== 'ok') {
                console.log(`   - ${r.file}: ${r.error || 'таймаут'}`);
            }
        }
    }

    console.log('\n✅ Все сборщики обработаны.');
}

main().catch(console.error);
