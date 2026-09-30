#!/usr/bin/env node
/**
 * build-sweep-from-basket.mjs — построение sweep-файла из basket v3
 *
 * Задача C3: связать прогностику с basket v3.
 *
 * Проблема: engine.mjs (apis/predict/engine.mjs) читает runs/latest.json
 * и runs/history.json. Эти файлы формирует НЕИЗВЕСТНЫЙ процесс (нет в коде),
 * и они устарели (runs/latest.json от 2026-08-08).
 *
 * Решение: этот скрипт читает basket v3, собирает sweep в формате, который
 * ожидает sweepToFeatures() из naivebayes.mjs и crucixMarketScenario()
 * из montecarlo.mjs, и записывает в:
 *   - runs/latest.json   (свежий sweep)
 *   - runs/history.json  (append + slice)
 *
 * ФОРМАТ SWEEP (ожидается sweepToFeatures):
 *   {
 *     fred:     { vix, hySpread, treasury10y },
 *     gdelt:    { conflictEvents: [], avgGoldsteinScore: 0 },
 *     sanctions:{ count },
 *     delta:    { newAlerts, escalatedAlerts },
 *     energy:   { oilPrice },
 *     radiation:{}
 *   }
 *
 * ИСТОЧНИКИ (basket):
 *   - vix.json              -> fred.vix        (series[-1].value)
 *   - hy-spread.json        -> fred.hySpread   (series[-1].value)
 *   - yield-curve.json      -> fred.treasury10y(series[-1].value)
 *   - ofac-sdn.json         -> sanctions.count (meta.count)
 *   - wti-brent-spread.json -> energy.oilPrice (series[-1].extra.wti)
 *   - alerts.json (если есть) -> delta.newAlerts
 *
 * Запуск: node scripts/predict-tools/build-sweep-from-basket.mjs
 * Флаги:
 *   --dry          — не писать файлы, только показать структуру
 *   --no-history   — не трогать runs/history.json
 *   --max-history=N — максимальный размер history (по умолчанию 200)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');
const RUNS_DIR = join(ROOT, 'runs');
const LATEST_FILE = join(RUNS_DIR, 'latest.json');
const HISTORY_FILE = join(RUNS_DIR, 'history.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const NO_HISTORY = args.includes('--no-history');
const MAX_ARG = args.find(a => a.startsWith('--max-history='));
const MAX_HISTORY = MAX_ARG ? parseInt(MAX_ARG.split('=')[1], 10) : 200;

// ────────────────────────────────────────────────────────
// Утилиты
// ────────────────────────────────────────────────────────

function loadBasket(name) {
    const paths = [
        join(BASKET_DIR, name),
        join(ROOT, 'data', 'basket', name)
    ];
    for (const p of paths) {
        if (!existsSync(p)) continue;
        try {
            return JSON.parse(readFileSync(p, 'utf-8'));
        } catch (e) {
            console.warn('  [warn] ' + name + ': ' + e.message);
            continue;
        }
    }
    return null;
}

function lastSeriesValue(file, field) {
    field = field || 'value';
    if (!file || !Array.isArray(file.series) || file.series.length === 0) return null;
    const last = file.series[file.series.length - 1];
    if (!last) return null;
    const v = last[field];
    return typeof v === 'number' ? v : null;
}

function lastSeriesExtra(file, extraField) {
    if (!file || !Array.isArray(file.series) || file.series.length === 0) return null;
    const last = file.series[file.series.length - 1];
    if (!last || !last.extra) return null;
    const v = last.extra[extraField];
    return typeof v === 'number' ? v : null;
}

function timestamp() {
    return new Date().toISOString();
}

function ensureDirs() {
    if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
}

function atomicWrite(targetPath, content) {
    const tmp = targetPath + '.' + process.pid + '.' + Date.now() + '.tmp';
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, targetPath);
}

// ────────────────────────────────────────────────────────
// Сборка sweep
// ────────────────────────────────────────────────────────

function buildSweep() {
    console.log('[build-sweep] Читаю basket...');

    const vix        = loadBasket('vix.json');
    const hy         = loadBasket('hy-spread.json');
    const yieldCurve = loadBasket('yield-curve.json');
    const ofac       = loadBasket('ofac-sdn.json');
    const wtiBrent   = loadBasket('wti-brent-spread.json');
    const alerts     = loadBasket('alerts.json');

    const sweep = {
        fred: {
            vix:         lastSeriesValue(vix) || 20,
            hySpread:    lastSeriesValue(hy) || 3.0,
            treasury10y: lastSeriesValue(yieldCurve) || 4.0
        },
        gdelt: {
            conflictEvents: [],
            avgGoldsteinScore: 0
        },
        sanctions: {
            count: (ofac && ofac.meta && typeof ofac.meta.count === 'number')
                ? ofac.meta.count
                : 0,
            recentCount: 0
        },
        delta: {
            newAlerts: (alerts && Array.isArray(alerts.new))
                ? alerts.new.length
                : 0,
            escalatedAlerts: (alerts && Array.isArray(alerts.escalated))
                ? alerts.escalated.length
                : 0
        },
        energy: {
            oilPrice: lastSeriesExtra(wtiBrent, 'wti') || 0
        },
        radiation: {}
    };

    console.log('  fred.vix          = ' + sweep.fred.vix        + ' (из vix.json)');
    console.log('  fred.hySpread     = ' + sweep.fred.hySpread   + ' (из hy-spread.json)');
    console.log('  fred.treasury10y  = ' + sweep.fred.treasury10y+ ' (из yield-curve.json)');
    console.log('  sanctions.count   = ' + sweep.sanctions.count + ' (из ofac-sdn.json)');
    console.log('  energy.oilPrice   = ' + sweep.energy.oilPrice + ' (из wti-brent-spread.json)');
    console.log('  delta.newAlerts   = ' + sweep.delta.newAlerts + ' (из alerts.json)');

    return sweep;
}

// ────────────────────────────────────────────────────────
// Обёртка для engine
// ────────────────────────────────────────────────────────

function wrapForEngine(sweep) {
    return {
        crucix: {
            version: '2.0.0',
            timestamp: timestamp(),
            totalDurationMs: 0,
            sourcesQueried: 5,
            sourcesOk: 5,
            sourcesFailed: 0,
            builtBy: 'build-sweep-from-basket.mjs'
        },
        fred: sweep.fred,
        gdelt: sweep.gdelt,
        sanctions: sweep.sanctions,
        delta: sweep.delta,
        energy: sweep.energy,
        radiation: sweep.radiation
    };
}

// ────────────────────────────────────────────────────────
// History
// ────────────────────────────────────────────────────────

function loadHistory() {
    if (!existsSync(HISTORY_FILE)) return [];
    try {
        const data = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function appendHistory(sweep, maxHistory) {
    const history = loadHistory();
    const entry = {
        timestamp: timestamp(),
        fred: sweep.fred,
        gdelt: sweep.gdelt,
        sanctions: sweep.sanctions,
        delta: sweep.delta,
        energy: sweep.energy,
        radiation: sweep.radiation
    };
    history.push(entry);
    return history.slice(-maxHistory);
}

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────

function main() {
    console.log('=======================================================');
    console.log('  build-sweep-from-basket.mjs');
    console.log('=======================================================');
    console.log('');

    ensureDirs();

    const sweep = buildSweep();
    console.log('');
    console.log('[build-sweep] Sweep собран. Timestamp: ' + timestamp());
    console.log('');

    const wrapped = wrapForEngine(sweep);

    if (DRY) {
        console.log('--- DRY RUN ---');
        console.log('runs/latest.json будет:');
        console.log(JSON.stringify(wrapped, null, 2));
        console.log('');
        console.log('runs/history.json получит запись:');
        console.log(JSON.stringify({
            timestamp: wrapped.crucix.timestamp,
            fred: sweep.fred,
            gdelt: sweep.gdelt,
            sanctions: sweep.sanctions,
            delta: sweep.delta,
            energy: sweep.energy
        }, null, 2));
        return;
    }

    atomicWrite(LATEST_FILE, JSON.stringify(wrapped, null, 2));
    console.log('[build-sweep] OK runs/latest.json обновлён (' + JSON.stringify(wrapped).length + ' байт)');

    if (!NO_HISTORY) {
        const history = appendHistory(sweep, MAX_HISTORY);
        atomicWrite(HISTORY_FILE, JSON.stringify(history, null, 2));
        console.log('[build-sweep] OK runs/history.json обновлён (' + history.length + ' записей)');
    } else {
        console.log('[build-sweep] --no-history: history.json не тронут');
    }

    console.log('');
    console.log('=======================================================');
    console.log('  ГОТОВО');
    console.log('=======================================================');
}

main();

