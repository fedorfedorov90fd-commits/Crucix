/**
 * register-map-layers.mjs
 * Автоматическая регистрация 6 новых слоёв в routes-api.json
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROUTES_API_PATH = join(__dirname, '../server/routes-api.json');

const NEW_ROUTES = [
    { path: '/api/layers/map-layer-economy', module: 'map-layer-economy', method: 'GET' },
    { path: '/api/layers/map-layer-energy', module: 'map-layer-energy', method: 'GET' },
    { path: '/api/layers/map-layer-cyber', module: 'map-layer-cyber', method: 'GET' },
    { path: '/api/layers/map-layer-social', module: 'map-layer-social', method: 'GET' },
    { path: '/api/layers/map-layer-sanctions', module: 'map-layer-sanctions', method: 'GET' },
    { path: '/api/layers/map-layer-military-zones', module: 'map-layer-military-zones', method: 'GET' }
];

async function registerRoutes() {
    try {
        // Читаем текущий реестр
        let routes = [];
        try {
            const content = await readFile(ROUTES_API_PATH, 'utf-8');
            routes = JSON.parse(content);
            if (!Array.isArray(routes)) routes = [];
        } catch (err) {
            console.log('📄 Файл routes-api.json не найден, создаём новый');
        }

        // Добавляем новые маршруты, если их нет
        let added = 0;
        for (const route of NEW_ROUTES) {
            const exists = routes.some(r => r.path === route.path);
            if (!exists) {
                routes.push(route);
                added++;
                console.log(`✅ Добавлен: ${route.path}`);
            } else {
                console.log(`⏭️ Уже существует: ${route.path}`);
            }
        }

        if (added === 0) {
            console.log('ℹ️ Все маршруты уже зарегистрированы');
            return;
        }

        // Сохраняем
        await writeFile(ROUTES_API_PATH, JSON.stringify(routes, null, 2), 'utf-8');
        console.log(`📁 Сохранено: ${ROUTES_API_PATH}`);
        console.log(`✅ Добавлено ${added} новых маршрутов`);

    } catch (err) {
        console.error('❌ Ошибка регистрации:', err);
    }
}

registerRoutes();
