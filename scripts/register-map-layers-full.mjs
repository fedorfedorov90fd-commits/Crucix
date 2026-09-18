import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODULES_PATH = join(__dirname, '../server/modules.json');
const ROUTES_PATH = join(__dirname, '../server/routes-api.json');

const LAYERS = [
    { id: 'map-layer-economy', path: './apis/sources/map-layer-economy', route: '/api/layers/map-layer-economy' },
    { id: 'map-layer-energy', path: './apis/sources/map-layer-energy', route: '/api/layers/map-layer-energy' },
    { id: 'map-layer-cyber', path: './apis/sources/map-layer-cyber', route: '/api/layers/map-layer-cyber' },
    { id: 'map-layer-social', path: './apis/sources/map-layer-social', route: '/api/layers/map-layer-social' },
    { id: 'map-layer-sanctions', path: './apis/sources/map-layer-sanctions', route: '/api/layers/map-layer-sanctions' },
    { id: 'map-layer-military-zones', path: './apis/sources/map-layer-military-zones', route: '/api/layers/map-layer-military-zones' }
];

async function register() {
    // Регистрация в modules.json
    let modulesData = [];
    try {
        modulesData = JSON.parse(await readFile(MODULES_PATH, 'utf-8'));
    } catch (_) {
        modulesData = [];
    }

    for (const layer of LAYERS) {
        if (!modulesData.some(m => m.id === layer.id)) {
            modulesData.push({ id: layer.id, path: layer.path });
            console.log(`✅ Добавлен в modules.json: ${layer.id}`);
        }
    }
    await writeFile(MODULES_PATH, JSON.stringify(modulesData, null, 2));

    // Регистрация в routes-api.json
    let routesData = { routes: [] };
    try {
        const content = await readFile(ROUTES_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.routes) {
            routesData = parsed;
        } else if (Array.isArray(parsed)) {
            routesData.routes = parsed;
        } else {
            routesData.routes = [];
        }
    } catch (_) {
        routesData.routes = [];
    }

    for (const layer of LAYERS) {
        if (!routesData.routes.some(r => r.path === layer.route)) {
            routesData.routes.push({
                path: layer.route,
                module: layer.id,
                method: 'GET'
            });
            console.log(`✅ Добавлен в routes-api.json: ${layer.route}`);
        }
    }
    await writeFile(ROUTES_PATH, JSON.stringify(routesData, null, 2));

    console.log('✅ Все слои зарегистрированы');
}

register().catch(console.error);
