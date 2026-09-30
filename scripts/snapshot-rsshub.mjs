#!/usr/bin/env node
/**
 * snapshot-rsshub.mjs — снимок rsshub.json в исторический архив
 *
 * Запускается по cron каждые 60 минут.
 * 1. Запускает collect-rsshub.mjs (обновляет data/basket/rsshub.json)
 * 2. Копирует свежий rsshub.json в data/analytics/rss-history/rsshub-<timestamp>.json
 * 3. Обновляет index.json — список снимков
 * 4. Обрезает архив до MAX_SNAPSHOTS последних
 *
 * Флаги:
 *   --skip-collect   — не запускать коллектор, только архивировать текущий rsshub.json
 *   --max=N          — сколько снимков держать (по умолчанию 168 = 7 дней × 24 часа)
 *   --dry            — показать, что будет сделано, без записи
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET = join(ROOT, 'data', 'basket', 'rsshub.json');
const HISTORY_DIR = join(ROOT, 'data', 'analytics', 'rss-history');
const INDEX_FILE = join(HISTORY_DIR, 'index.json');
const LOGS_DIR = join(ROOT, 'logs', 'rss-history');
const COLLECTOR = join(ROOT, 'scripts', 'collectors', 'collect-rsshub.mjs');

const args = process.argv.slice(2);
const SKIP_COLLECT = args.includes('--skip-collect');
const DRY = args.includes('--dry');
const MAX_ARG = args.find(a => a.startsWith('--max='));
const MAX_SNAPSHOTS = MAX_ARG ? parseInt(MAX_ARG.split('=')[1], 10) : 168;

function log(msg) {
    const ts = new Date().toISOString();
    const line = '[' + ts + '] ' + msg;
    console.log(line);
}

function ensureDirs() {
    if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

function timestamp() {
    return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
}

// ─── Шаг 1: запустить коллектор ───
function runCollector() {
    if (SKIP_COLLECT) {
        log('Пропускаю сбор (--skip-collect)');
        return true;
    }
    if (!existsSync(COLLECTOR)) {
        log('ОШИБКА: не найден ' + COLLECTOR);
        return false;
    }
    log('Запускаю collect-rsshub.mjs...');
    try {
        execSync('node "' + COLLECTOR + '"', { cwd: ROOT, stdio: 'inherit' });
        log('Коллектор завершён');
        return true;
    } catch (e) {
        log('ОШИБКА коллектора: ' + e.message);
        return false;
    }
}

// ─── Шаг 2: скопировать снимок ───
function makeSnapshot() {
    if (!existsSync(BASKET)) {
        log('ОШИБКА: не найден ' + BASKET);
        return null;
    }
    const ts = timestamp();
    const snapshotName = 'rsshub-' + ts + '.json';
    const snapshotPath = join(HISTORY_DIR, snapshotName);

    if (DRY) {
        log('DRY-RUN: сохранил бы ' + snapshotName);
        return snapshotName;
    }

    copyFileSync(BASKET, snapshotPath);

    // Мета снимка
    let meta = { items: 0, collectedAt: null };
    try {
        const data = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
        const items = data.items || data.data || [];
        meta.items = items.length;
        meta.collectedAt = data.collectedAt || null;
    } catch {}

    const size = statSync(snapshotPath).size;
    log('✓ Снимок сохранён: ' + snapshotName + ' (' + meta.items + ' items, ' + Math.round(size / 1024) + ' KB)');
    return snapshotName;
}

// ─── Шаг 3: обновить index.json ───
function updateIndex() {
    const files = readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('rsshub-') && f.endsWith('.json'))
        .sort();

    const entries = [];
    for (const f of files) {
        try {
            const p = join(HISTORY_DIR, f);
            const data = JSON.parse(readFileSync(p, 'utf-8'));
            const items = data.items || data.data || [];
            entries.push({
                file: f,
                size: statSync(p).size,
                items: items.length,
                collectedAt: data.collectedAt || null,
                sources: data.sources || null,
                success: data.success || null
            });
        } catch (e) {
            entries.push({ file: f, error: e.message });
        }
    }

    const index = {
        updatedAt: new Date().toISOString(),
        total_snapshots: entries.length,
        max_snapshots: MAX_SNAPSHOTS,
        oldest: entries[0]?.collectedAt || null,
        newest: entries[entries.length - 1]?.collectedAt || null,
        entries
    };

    if (!DRY) {
        writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
    }
    log('Индекс обновлён: ' + entries.length + ' снимков');
    return entries;
}

// ─── Шаг 4: обрезать архив ───
function trimArchive() {
    const files = readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('rsshub-') && f.endsWith('.json'))
        .sort();

    if (files.length <= MAX_SNAPSHOTS) {
        log('Обрезка не нужна: ' + files.length + ' <= ' + MAX_SNAPSHOTS);
        return;
    }

    const toDelete = files.slice(0, files.length - MAX_SNAPSHOTS);
    log('Обрезаю: удалю ' + toDelete.length + ' старых снимков');
    for (const f of toDelete) {
        if (!DRY) {
            unlinkSync(join(HISTORY_DIR, f));
        }
    }
}

// ─── Логирование в файл ───
function writeLog(status, details) {
    const ts = timestamp();
    const logPath = join(LOGS_DIR, 'snapshot-' + ts + '.log');
    const lines = [
        'snapshot-rsshub.mjs',
        'timestamp: ' + new Date().toISOString(),
        'status: ' + status,
        'skip_collect: ' + SKIP_COLLECT,
        'dry: ' + DRY,
        'max_snapshots: ' + MAX_SNAPSHOTS,
        'details: ' + JSON.stringify(details, null, 2)
    ];
    if (!DRY) {
        try { writeFileSync(logPath, lines.join('\n'), 'utf-8'); } catch {}
    }
}

// ─── MAIN ───
function main() {
    log('═══ snapshot-rsshub.mjs ═══');
    log('ROOT: ' + ROOT);
    log('HISTORY_DIR: ' + HISTORY_DIR);
    log('MAX_SNAPSHOTS: ' + MAX_SNAPSHOTS);
    log('');

    ensureDirs();

    const collectorOk = runCollector();
    if (!collectorOk) {
        log('Коллектор не прошёл, но пробую заархивировать текущий basket');
    }

    const snapshot = makeSnapshot();
    if (!snapshot) {
        writeLog('failed_no_basket', {});
        process.exit(1);
    }

    const entries = updateIndex();
    trimArchive();

    log('');
    log('Итого снимков в архиве: ' + entries.length);
    log('Самый старый: ' + (entries[0]?.collectedAt || '—'));
    log('Самый свежий: ' + (entries[entries.length - 1]?.collectedAt || '—'));

    writeLog('ok', { snapshot, total: entries.length });
}

main();
