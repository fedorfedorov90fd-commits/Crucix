#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function updateModules() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🔄 Начинаю обновление...`);

    const modules = [
        { name: 'Global Index', endpoint: '/api/geo/index/update', method: 'POST' },
        { name: 'NewsAPI Basket', endpoint: '/api/newsapi/basket?action=collect&q=Ukraine+OR+Russia+OR+Iran&max=20', method: 'GET' },
        { name: 'FRED Economy', endpoint: '/api/fred/economy', method: 'GET' }
    ];

    let success = 0;
    let fail = 0;

    for (const mod of modules) {
        try {
            const cmd = `curl -s -X ${mod.method} "http://localhost:3117${mod.endpoint}"`;
            const { stdout } = await execAsync(cmd, { timeout: 30000 });
            const data = JSON.parse(stdout);
            if (data.success || data.success === undefined) {
                console.log(`   ✅ ${mod.name}: успешно`);
                success++;
            } else {
                console.log(`   ❌ ${mod.name}: ошибка API`);
                fail++;
            }
        } catch (e) {
            console.log(`   ❌ ${mod.name}: ${e.message}`);
            fail++;
        }
    }

    console.log(`[${timestamp}] ✅ Обновление завершено: ${success} успешно, ${fail} ошибок`);
}

updateModules().catch(console.error);
