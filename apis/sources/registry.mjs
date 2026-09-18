// ============================================================
// REGISTRY.MJS — Логика сбора данных для реестра
// ============================================================

import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__dirname, '..', '..');

export function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export async function getFileInfo(filePath) {
    try {
        const stat = await fs.stat(filePath);
        return {
            size: stat.size,
            sizeFormatted: formatSize(stat.size),
            mtime: stat.mtime.toISOString(),
            mtimeFormatted: stat.mtime.toLocaleString('ru-RU')
        };
    } catch {
        return { size: 0, sizeFormatted: '0 B', mtime: null, mtimeFormatted: '—' };
    }
}

export async function scanDirectory(dir, extensions, filterFn) {
    const results = [];
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            if (!file.isFile()) continue;
            const ext = extname(file.name).toLowerCase();
            if (!extensions.includes(ext)) continue;
            if (filterFn && !filterFn(file.name)) continue;
            const fullPath = join(dir, file.name);
            const info = await getFileInfo(fullPath);
            results.push({ name: file.name, path: fullPath, ...info });
        }
    } catch (e) {
        console.warn('[Registry] Не удалось просканировать:', dir, e.message);
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function collectRegistry() {
    const timestamp = new Date().toISOString();

    const pagesDir = join(PROJECT_ROOT, 'dashboard', 'public');
    const pages = await scanDirectory(pagesDir, ['.html'], (name) => {
        return !name.startsWith('_') && name !== 'index.html' && !name.includes('template');
    });

    const apiDir = join(PROJECT_ROOT, 'apis', 'sources');
    const apiFiles = await scanDirectory(apiDir, ['.mjs', '.js']);

    const scriptsDir = join(PROJECT_ROOT, 'scripts');
    const allScripts = await scanDirectory(scriptsDir, ['.mjs', '.js', '.sh']);
    const collectors = allScripts.filter(f => f.name.startsWith('collect-'));
    const scripts = allScripts.filter(f => !f.name.startsWith('collect-'));

    const basketDir = join(PROJECT_ROOT, 'data', 'basket');
    const basket = await scanDirectory(basketDir, ['.json']);

    const summary = {
        totalPages: pages.length,
        totalAPI: apiFiles.length,
        totalCollectors: collectors.length,
        totalScripts: scripts.length,
        totalBasket: basket.length,
        total: pages.length + apiFiles.length + collectors.length + scripts.length + basket.length
    };

    return {
        timestamp,
        summary,
        pages: pages.map(p => ({
            name: p.name,
            url: '/' + p.name.replace(/\.html$/, ''),
            size: p.size,
            sizeFormatted: p.sizeFormatted,
            mtime: p.mtime,
            mtimeFormatted: p.mtimeFormatted
        })),
        api: apiFiles.map(a => ({
            name: a.name,
            url: '/api/' + a.name.replace(/-(?:api|module)\.mjs$/, '').replace(/\.mjs$/, ''),
            size: a.size,
            sizeFormatted: a.sizeFormatted,
            mtime: a.mtime,
            mtimeFormatted: a.mtimeFormatted
        })),
        collectors: collectors.map(c => ({
            name: c.name,
            source: c.name.replace(/^collect-/, '').replace(/\.mjs$/, '').toUpperCase(),
            size: c.size,
            sizeFormatted: c.sizeFormatted,
            mtime: c.mtime,
            mtimeFormatted: c.mtimeFormatted
        })),
        scripts: scripts.map(s => ({
            name: s.name,
            path: s.path.replace(PROJECT_ROOT + '/', ''),
            size: s.size,
            sizeFormatted: s.sizeFormatted,
            mtime: s.mtime,
            mtimeFormatted: s.mtimeFormatted
        })),
        basket: basket.map(b => ({
            name: b.name,
            size: b.size,
            sizeFormatted: b.sizeFormatted,
            mtime: b.mtime,
            mtimeFormatted: b.mtimeFormatted
        }))
    };
}

export default { collectRegistry, scanDirectory, getFileInfo, formatSize, PROJECT_ROOT };
