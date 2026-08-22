#!/usr/bin/env node
// ============================================================
// COLLECT-DAILY-REPORT.MJS — Генератор ежедневных отчетов
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const REPORTS_DIR = join(__dirname, '..', 'data', 'reports');

async function loadData(filename) {
    try {
        const path = join(BASKET_DIR, filename);
        const data = await fs.readFile(path, 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

function calculateStats(data, key) {
    if (!data || data.length === 0) return null;
    const values = data.map(d => d[key]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return null;
    const current = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : current;
    return {
        current: current,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        change: ((current - prev) / (prev || 1)) * 100
    };
}

function getStatus(value, thresholds) {
    if (!thresholds || value === undefined || value === null) {
        return { status: 'unknown', color: '#888', label: 'Нет данных' };
    }
    for (const t of thresholds) {
        if (t.condition(value)) {
            return { status: t.status, color: t.color, label: t.label };
        }
    }
    return { status: 'normal', color: '#4ade80', label: 'Нормально' };
}

async function generateDailyReport() {
    console.log('[REPORT] 📡 Генерация ежедневного отчета...');

    const [notam, gps, trends, vix, yieldData, goldOil, copperGold, bdi, viirs, uranium] = await Promise.all([
        loadData('notam.json'),
        loadData('gps-jamming.json'),
        loadData('google-trends.json'),
        loadData('vix.json'),
        loadData('yield-curve.json'),
        loadData('gold-oil-ratio.json'),
        loadData('copper-gold.json'),
        loadData('bdi.json'),
        loadData('viirs.json'),
        loadData('uranium.json')
    ]);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const vixStats = calculateStats(vix, 'value');
    const yieldStats = calculateStats(yieldData, 'spread');
    const goldOilStats = calculateStats(goldOil, 'ratio');
    const copperGoldStats = calculateStats(copperGold, 'ratio');
    const bdiStats = calculateStats(bdi, 'value');
    const viirsStats = calculateStats(viirs, 'brightness');
    const uraniumStats = calculateStats(uranium, 'price');

    const report = {
        date: dateStr,
        timestamp: now.toISOString(),
        summary: { total_critical: 0, total_warning: 0, total_normal: 0 },
        indicators: {
            notam: { count: notam.length, critical: notam.filter(d => d.severity === 'critical' || d.intensity === 'critical').length, high: notam.filter(d => d.severity === 'high' || d.intensity === 'high').length },
            gps: { count: gps.length, critical: gps.filter(d => d.intensity === 'critical').length, high: gps.filter(d => d.intensity === 'high').length },
            trends: { count: trends.length, critical: trends.filter(d => d.intensity === 'critical').length, high: trends.filter(d => d.intensity === 'high').length },
            vix: { current: vixStats?.current || null, min: vixStats?.min || null, max: vixStats?.max || null, avg: vixStats?.avg || null, change: vixStats?.change || 0, status: getStatus(vixStats?.current, [{ condition: v => v > 30, status: 'critical', color: '#ef4444', label: 'Высокий страх' }, { condition: v => v > 20, status: 'warning', color: '#f59e0b', label: 'Средний страх' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) },
            yield_curve: { current: yieldStats?.current || null, min: yieldStats?.min || null, max: yieldStats?.max || null, avg: yieldStats?.avg || null, change: yieldStats?.change || 0, status: getStatus(yieldStats?.current, [{ condition: v => v < 0, status: 'critical', color: '#ef4444', label: 'Инверсия' }, { condition: v => v < 0.5, status: 'warning', color: '#f59e0b', label: 'Предупреждение' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) },
            gold_oil: { current: goldOilStats?.current || null, min: goldOilStats?.min || null, max: goldOilStats?.max || null, avg: goldOilStats?.avg || null, change: goldOilStats?.change || 0, status: getStatus(goldOilStats?.current, [{ condition: v => v > 25, status: 'critical', color: '#ef4444', label: 'Высокий риск' }, { condition: v => v > 20, status: 'warning', color: '#f59e0b', label: 'Средний риск' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) },
            copper_gold: { current: copperGoldStats?.current || null, min: copperGoldStats?.min || null, max: copperGoldStats?.max || null, avg: copperGoldStats?.avg || null, change: copperGoldStats?.change || 0, status: getStatus(copperGoldStats?.current, [{ condition: v => v < 11, status: 'critical', color: '#ef4444', label: 'Рецессия' }, { condition: v => v < 13, status: 'warning', color: '#f59e0b', label: 'Предупреждение' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) },
            bdi: { current: bdiStats?.current || null, min: bdiStats?.min || null, max: bdiStats?.max || null, avg: bdiStats?.avg || null, change: bdiStats?.change || 0, status: getStatus(bdiStats?.current, [{ condition: v => v < 1400, status: 'critical', color: '#ef4444', label: 'Спад торговли' }, { condition: v => v < 1800, status: 'warning', color: '#f59e0b', label: 'Предупреждение' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) },
            viirs: { current: viirsStats?.current || null, min: viirsStats?.min || null, max: viirsStats?.max || null, avg: viirsStats?.avg || null, change: viirsStats?.change || 0, status: getStatus(viirsStats?.current, [{ condition: v => v < 40, status: 'critical', color: '#ef4444', label: 'Темно (кризис)' }, { condition: v => v < 55, status: 'warning', color: '#f59e0b', label: 'Снижение' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) },
            uranium: { current: uraniumStats?.current || null, min: uraniumStats?.min || null, max: uraniumStats?.max || null, avg: uraniumStats?.avg || null, change: uraniumStats?.change || 0, status: getStatus(uraniumStats?.current, [{ condition: v => v > 70, status: 'critical', color: '#ef4444', label: 'Высокий спрос' }, { condition: v => v > 50, status: 'warning', color: '#f59e0b', label: 'Средний спрос' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Нормально' }]) }
        }
    };

    // Считаем сводку
    const statuses = [
        report.indicators.vix.status,
        report.indicators.yield_curve.status,
        report.indicators.gold_oil.status,
        report.indicators.copper_gold.status,
        report.indicators.bdi.status,
        report.indicators.viirs.status,
        report.indicators.uranium.status
    ];
    for (const s of statuses) {
        if (s?.status === 'critical') report.summary.total_critical++;
        else if (s?.status === 'warning') report.summary.total_warning++;
        else if (s?.status === 'normal') report.summary.total_normal++;
    }

    try {
        await fs.mkdir(REPORTS_DIR, { recursive: true });
        const reportPath = join(REPORTS_DIR, `daily-report-${dateStr}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(`[REPORT] ✅ Отчет сохранен: ${reportPath}`);
        console.log(`[REPORT] 📊 Критических: ${report.summary.total_critical}, Предупреждений: ${report.summary.total_warning}, Нормальных: ${report.summary.total_normal}`);
        return report;
    } catch (error) {
        console.error(`[REPORT] ❌ Ошибка сохранения:`, error.message);
        return null;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    generateDailyReport().catch(console.error);
}

export { generateDailyReport };
