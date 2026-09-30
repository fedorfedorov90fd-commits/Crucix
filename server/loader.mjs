/**
 * server/loader.mjs — ЗАГРУЗЧИК МОДУЛЕЙ
 *
 * Извлечено из server.mjs v12.0 (ULTIMATE EDITION)
 * Содержит: загрузку модулей из modules.json, обработку ошибок, создание заглушек
 */

import { createStub } from './utils.mjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = __dirname;

export function loadJSON(file) {
    const fullPath = join(SERVER_DIR, file);
    if (!existsSync(fullPath)) return {};
    try {
        return JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch {
        return {};
    }
}

export async function loadModule(modulePath) {
    try {
        const extensions = ['.mjs', '.js'];
        for (const ext of extensions) {
            try {
                const fullPath = join(SERVER_DIR, '..', modulePath + ext);
                const module = await import(`file://${fullPath}`);
                console.log(`  ✅ Загружен: ${modulePath}${ext}`);
                return module;
            } catch (e) {}
        }
        console.warn(`  ⚠️ Модуль не найден: ${modulePath}`);
        return null;
    } catch (e) {
        console.warn(`  ⚠️ Ошибка загрузки ${modulePath}:`, e.message);
        return null;
    }
}

export async function loadAllModules() {
    const handlers = {};
    const modules = loadJSON('modules.json');

    if (!Array.isArray(modules) || modules.length === 0) {
        console.warn('⚠️ modules.json пуст или не найден');
        return handlers;
    }

    console.log(`📦 Загрузка ${modules.length} модулей...`);

    for (const entry of modules) {
        const module = await loadModule(entry.path);
        if (module) {
            handlers[entry.id] = module.default || module;
        } else {
            handlers[entry.id] = createStub(entry.id);
        }
    }

    console.log('  ✅ Все модули загружены\n');
    return handlers;
}

export function getHandler(handlers, moduleId, handlerName, apiName) {
    const module = handlers[moduleId];
    if (module && module[handlerName]) {
        return module[handlerName];
    }
    console.warn(`  ⚠️ Обработчик ${handlerName} не найден в ${apiName || moduleId}`);
    return createStub(apiName || moduleId);
}

export function loadPageRoutes() {
    return loadJSON('routes-pages.json');
}

export function loadAPIRoutes() {
    return loadJSON('routes-api.json');
}

export function loadPages() {
    return loadJSON('pages.json');
}

export default {
    loadAllModules,
    loadModule,
    loadJSON,
    getHandler,
    loadPageRoutes,
    loadAPIRoutes,
    loadPages
};
