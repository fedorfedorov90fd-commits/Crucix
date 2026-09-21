#!/usr/bin/env node
// Crucix Analyzer: QualityReport v2.0.1
// Файл: /home/ta8_/Рабочий стол/Crucix/scripts/analyzers/quality-report.mjs
// Читает: data/basket/*.json (basket.v1) + data/warehouse/manifest.json + data/warehouse/quality.json
// Пишет: data/warehouse/reports/quality-<timestamp>.json
//
// Назначение: аудит качества данных в корзине и складе Crucix.
//
// История версий:
//   v2.0.0 (21.09.2026): переписан, ROOT через fileURLToPath, DATA_DIR корректен.
//     Ошибка: группировка manifest по полю status, которого НЕТ. В manifest есть
//     поле quality (ok/warning/error), не status.
//   v2.0.1 (21.09.2026): правильная группировка manifest по quality, добавлены
//     агрегаты из quality.json (сумма total_records, средний completeness,
//     unmapped_count>0, max age_hours, топ-источники).

import { readFile, readdir, mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');
const BASKET_DIR = join(DATA_DIR, 'basket');
const WAREHOUSE_DIR = join(DATA_DIR, 'warehouse');
const MANIFEST_FILE = join(WAREHOUSE_DIR, 'manifest.json');
const QUALITY_FILE = join(WAREHOUSE_DIR, 'quality.json');
const REPORTS_DIR = join(WAREHOUSE_DIR, 'reports');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { return fallback; }
}

async function listBasket() {
  try { return (await readdir(BASKET_DIR)).filter(f => f.endsWith('.json')); }
  catch (e) { return []; }
}

async function analyzeBasket() {
  const files = await listBasket();
  let withMeta = 0, withDocuments = 0, withSeries = 0, withPoints = 0, withRegions = 0;
  for (const f of files) {
    const d = await readJson(join(BASKET_DIR, f), null);
    if (!d) continue;
    if (d.schema === 'crucix.basket.v1' && d.meta) withMeta++;
    if (Array.isArray(d.documents) && d.documents.length > 0) withDocuments++;
    if (Array.isArray(d.series) && d.series.length > 0) withSeries++;
    if (Array.isArray(d.points) && d.points.length > 0) withPoints++;
    if (Array.isArray(d.regions) && d.regions.length > 0) withRegions++;
  }
  const total = files.length;
  const coverage = total > 0 ? ((withMeta / total) * 100).toFixed(1) : '0.0';
  return { total, withMeta, withDocuments, withSeries, withPoints, withRegions, coverage };
}

async function analyzeManifest() {
  const m = await readJson(MANIFEST_FILE, null);
  if (!m || !m.items) return { total: 0, by_quality: {}, note: 'manifest.json пуст или отсутствует' };
  const items = Object.values(m.items);
  const by_quality = items.reduce((acc, it) => {
    const q = it.quality || 'none';
    acc[q] = (acc[q] || 0) + 1;
    return acc;
  }, {});
  return { total: items.length, by_quality };
}

async function analyzeQuality() {
  const q = await readJson(QUALITY_FILE, null);
  if (!q || !q.items) return { total: 0, note: 'quality.json отсутствует или пуст' };
  const items = Object.values(q.items);
  let totalRecords = 0, sumCompleteness = 0, unmappedGt0 = 0, maxAgeHours = 0;
  const top = [];
  for (const it of items) {
    const rec = it.total_records || 0;
    totalRecords += rec;
    sumCompleteness += it.completeness || 0;
    if ((it.unmapped_count || 0) > 0) unmappedGt0++;
    if ((it.age_hours || 0) > maxAgeHours) maxAgeHours = it.age_hours || 0;
    top.push({ id: it.id, records: rec });
  }
  top.sort((a, b) => b.records - a.records);
  const avgCompleteness = items.length > 0 ? (sumCompleteness / items.length).toFixed(4) : '0';
  return {
    total: items.length,
    total_records: totalRecords,
    avg_completeness: avgCompleteness,
    unmapped_gt0: unmappedGt0,
    max_age_hours: maxAgeHours,
    top_10_by_records: top.slice(0, 10)
  };
}

async function main() {
  const t0 = Date.now();
  const now = new Date().toISOString();

  const basket = await analyzeBasket();
  const manifest = await analyzeManifest();
  const quality = await analyzeQuality();

  const summary = {
    basket_files: basket.total,
    basket_with_meta: basket.withMeta,
    basket_coverage_pct: basket.coverage,
    basket_with_documents: basket.withDocuments,
    manifest_total: manifest.total,
    quality_total_records: quality.total_records,
    quality_avg_completeness: quality.avg_completeness,
    quality_unmapped_gt0: quality.unmapped_gt0,
    quality_max_age_hours: quality.max_age_hours
  };

  const report = {
    _meta: {
      id: 'quality-report',
      category: 'audit',
      version: '2.0.1',
      schema_version: '2.0.1',
      generated_at: now,
      duration_ms: Date.now() - t0,
      source: 'basket + warehouse/manifest + warehouse/quality'
    },
    data: { basket, manifest, quality, summary }
  };

  await mkdir(REPORTS_DIR, { recursive: true });
  const stamp = now.slice(0, 19).replace(/:/g, '-');
  const reportFile = join(REPORTS_DIR, 'quality-' + stamp + '.json');
  await writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('════════════════════════════════════════════');
  console.log('Crucix QualityReport v2.0.1 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Basket-файлов: ' + basket.total);
  console.log('  с meta (basket.v1): ' + basket.withMeta + ' (coverage ' + basket.coverage + '%)');
  console.log('  с documents: ' + basket.withDocuments);
  console.log('  с series: ' + basket.withSeries);
  console.log('  с points: ' + basket.withPoints);
  console.log('  с regions: ' + basket.withRegions);
  console.log('');
  console.log('Manifest записей: ' + manifest.total);
  for (const [k, v] of Object.entries(manifest.by_quality || {})) {
    console.log('  quality=' + k + ': ' + v);
  }
  console.log('');
  console.log('Quality записей: ' + quality.total);
  console.log('  всего записей: ' + quality.total_records);
  console.log('  средний completeness: ' + quality.avg_completeness);
  console.log('  unmapped_count>0: ' + quality.unmapped_gt0);
  console.log('  max age_hours: ' + quality.max_age_hours);
  console.log('  топ-5 по записям:');
  for (const t of (quality.top_10_by_records || []).slice(0, 5)) {
    console.log('    ' + t.id + ': ' + t.records);
  }
  console.log('');
  console.log('Файл отчёта: ' + reportFile);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
