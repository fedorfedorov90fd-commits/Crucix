#!/usr/bin/env node
/**
 * Crucix Collector: daily-report (АГРЕГАТОР).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * ВНИМАНИЕ: это НЕ классический сборщик. Он агрегирует данные из basket
 * (notam, gps-jamming, google-trends, vix, yield-curve, gold-oil и т.д.)
 * в один отчёт и сдаёт его через saveRaw как catalog-снапшот.
 *
 * Логически это анализатор, а не сборщик. Живёт в collect/ для совместимости.
 * После ревизии будет перенесён в scripts/analyzers/.
 *
 * Формат: {date, timestamp, summary, indicators: {...}} → catalog (объект-снапшот).
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

async function loadData(filename) {
  try {
    const path = join(BASKET_DIR, filename);
    const data = JSON.parse(await readFile(path, 'utf8'));
    // Basket v1 → читаем points+series; legacy → массив
    if (Array.isArray(data)) return data;
    if (data && data.schema === 'crucix.basket.v1') {
      return [...(data.points || []), ...(data.series || [])];
    }
    return [];
  } catch { return []; }
}

function calculateStats(data, key) {
  if (!data || data.length === 0) return null;
  const values = data.map(d => d[key]).filter(v => v !== undefined && v !== null);
  if (values.length === 0) return null;
  const current = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : current;
  return {
    current,
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
    if (t.condition(value)) return { status: t.status, color: t.color, label: t.label };
  }
  return { status: 'normal', color: '#4ade80', label: 'Нормально' };
}

export async function generateDailyReport() {
  const [notam, gps, trends, vix, yieldData, goldOil, copperGold, bdi, viirs, uranium] = await Promise.all([
    loadData('notam.json'), loadData('gps-jamming.json'), loadData('google-trends.json'),
    loadData('vix.json'), loadData('yield-curve.json'), loadData('gold-oil-basket.json'),
    loadData('copper-gold.json'), loadData('bdi.json'), loadData('viirs.json'), loadData('uranium.json')
  ]);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const vixStats = calculateStats(vix, 'value');
  const yieldStats = calculateStats(yieldData, 'spread');
  const goldOilStats = calculateStats(goldOil, 'value');
  const copperGoldStats = calculateStats(copperGold, 'value');
  const bdiStats = calculateStats(bdi, 'value');
  const viirsStats = calculateStats(viirs, 'brightness');
  const uraniumStats = calculateStats(uranium, 'price');

  const report = {
    date: dateStr,
    timestamp: now.toISOString(),
    summary: { total_critical: 0, total_warning: 0, total_normal: 0 },
    indicators: {
      notam: { count: notam.length, critical: notam.filter(d => d.severity === 'critical' || d.intensity === 'critical').length },
      gps: { count: gps.length, critical: gps.filter(d => d.intensity === 'critical').length },
      trends: { count: trends.length, critical: trends.filter(d => d.intensity === 'critical').length },
      vix: { current: vixStats?.current || null, status: getStatus(vixStats?.current, [{ condition: v => v > 30, status: 'critical', color: '#ef4444', label: 'Высокий страх' }, { condition: v => v > 20, status: 'warning', color: '#f59e0b', label: 'Средний' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Норма' }]) },
      yield_curve: { current: yieldStats?.current || null, status: getStatus(yieldStats?.current, [{ condition: v => v < 0, status: 'critical', color: '#ef4444', label: 'Инверсия' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Норма' }]) },
      gold_oil: { current: goldOilStats?.current || null, status: getStatus(goldOilStats?.current, [{ condition: v => v > 25, status: 'critical', color: '#ef4444', label: 'Высокий риск' }, { condition: v => v > 20, status: 'warning', color: '#f59e0b', label: 'Средний' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Норма' }]) },
      bdi: { current: bdiStats?.current || null, status: getStatus(bdiStats?.current, [{ condition: v => v < 1400, status: 'critical', color: '#ef4444', label: 'Спад' }, { condition: v => v >= 0, status: 'normal', color: '#4ade80', label: 'Норма' }]) }
    }
  };

  for (const s of Object.values(report.indicators)) {
    if (s.status?.status === 'critical') report.summary.total_critical++;
    else if (s.status?.status === 'warning') report.summary.total_warning++;
    else if (s.status?.status === 'normal') report.summary.total_normal++;
  }

  const result = await saveRaw('daily-report', report, {
    collector: 'collect-daily-report.mjs',
    source: 'Crucix daily aggregate',
    source_url: 'local://daily-report',
    license: 'proprietary',
    format_hint: 'catalog',
    value_unit: 'count',
    granularity: 'snapshot',
    record_count: 1,
    notes: `Отчёт за ${dateStr}, критических ${report.summary.total_critical}`,
    backwardCompat: true
  });

  console.log(`[REPORT] OK отчёт за ${dateStr} → ${result.raw_file}`);
  console.log(`[REPORT] Критических: ${report.summary.total_critical}, предупреждений: ${report.summary.total_warning}, норм: ${report.summary.total_normal}`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDailyReport().catch((e) => { console.error('[REPORT] FATAL:', e.message); process.exit(1); });
}
