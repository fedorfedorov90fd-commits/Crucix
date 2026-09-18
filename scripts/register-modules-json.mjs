import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MODULES_PATH = join(__dirname, '../server/modules.json');

const NEW_MODULES = [
    { id: 'map-layer-economy', path: './apis/sources/map-layer-economy' },
    { id: 'map-layer-energy', path: './apis/sources/map-layer-energy' },
    { id: 'map-layer-cyber', path: './apis/sources/map-layer-cyber' },
    { id: 'map-layer-social', path: './apis/sources/map-layer-social' },
    { id: 'map-layer-sanctions', path: './apis/sources/map-layer-sanctions' },
    { id: 'map-layer-military-zones', path: './apis/sources/map-layer-military-zones' }
];

async function register() {
    try {
        const content = await readFile(MODULES_PATH, 'utf-8');
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
            console.error('❌ modules.json не является массивом');
            return;
        }
        let added = 0;
        for (const mod of NEW_MODULES) {
            const exists = data.some(m => m.id === mod.id);
            if (!exists) {
                data.push(mod);
                added++;
                console.log(`✅ Добавлен модуль: ${mod.id}`);
            } else {
                console.log(`⏩ Уже есть: ${mod.id}`);
            }
        }
        if (added > 0) {
            await writeFile(MODULES_PATH, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`📁 Сохранено: ${MODULES_PATH}`);
            console.log(`✅ Добавлено ${added} модулей`);
        } else {
            console.log('ℹ️ Все модули уже зарегистрированы');
        }
    } catch (err) {
        console.error('❌ Ошибка:', err);
    }
}

register();
