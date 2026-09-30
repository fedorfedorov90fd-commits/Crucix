#!/usr/bin/env node
/**
 * run-all.mjs — оркестратор анализаторов Crucix
 * Версия 1.0.1. Синтез 21.09.2026.
 *
 * СИНТЕЗ ИЗ ДУБЛЕЙ:
 *   - scripts/analyzers/run-all-дубль.mjs (158 строк, компактная версия)
 *   - scripts/analysis/run-all-дубль.mjs (296 строк, полная версия)
 *   Взят полный набор комментариев зависимостей из полной версии,
 *   вся функциональность обоих — сохранена.
 *
 * Запускает 51 аналитический анализатор в правильном порядке
 * с учётом зависимостей. Пропускает 15 служебных.
 *
 * Порядок:
 *   Уровень 0 (базовые):   46 анализаторов — читают только basket/reference
 *   Уровень 1 (производные): 7 — deception-index, signal-aggregator,
 *                              social-briefing-engine, risk-signal-aggregator,
 *                              supply-chain-resilience, strategic-risk-composite,
 *                              ai-forecasts
 *   Уровень 2 (агрегат):    1 — convergence-engine (читает всё)
 *
 * Служебные (пропускаются): alert-dispatcher, cache-manager, cli-analytics,
 *   config-validator, crucix-doctor, dashboard-indicators, event-deduplicator,
 *   langgraph-orchestrator, mcp-server, module-registration-controller,
 *   progressive-disclosure, rate-limiter, reference-data-provider,
 *   snapshot-system, watchdog.
 *
 * Портабельный: все пути через import.meta.url.
 *
 * Запуск:
 *   node scripts/analyzers/run-all.mjs
 *   node scripts/analyzers/run-all.mjs --level=0      (только базовые)
 *   node scripts/analyzers/run-all.mjs --only=deception-index
 *   node scripts/analyzers/run-all.mjs --dry-run
 */

import { spawn } from 'child_process';
import { writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYZERS = join(ROOT, 'scripts', 'analyzers');
const LOGS_DIR = join(ROOT, 'logs', 'analyzers');
const REPORT_FILE = join(LOGS_DIR, 'last-run.json');

// ─── Классификация анализаторов ───

// Уровень 0: базовые (читают только basket/reference)
const LEVEL_0 = [
  'adaptive-news-clustering',
  'ai-news-synthesis',
  'arms-transfer-tracker',
  'baseline-alerting',
  'central-bank-predictor',
  'conflict-escalation-tracker',
  'country-instability',
  'cross-stream-correlation',
  'cyber-attack-monitor',
  'data-discrepancy',
  'derived-market-analytics',
  'diplomatic-tracker',
  'energy-market-intelligence',
  'entity-extraction',
  'etf-flow-analysis',
  'focal-point-detection',
  'food-security-monitor',
  'fx-reserves-monitor',
  'geo-convergence',
  'logistics-anomalies',
  'market-composite',
  'migration-flow-tracker',
  'multi-source-corroboration',
  'narrative-drift',
  'pizza-index',
  'political-stability-monitor',
  'prediction-markets',
  'resilience-index',
  'route-explorer',
  'rss-convergence',
  'sanctions-pressure',
  'satellite-analyzer',
  'scenario-simulation-engine',
  'silence-patterns',
  'social-sentiment-analyzer',
  'source-coordination',
  'source-credibility',
  'stablecoin-monitor',
  'supply-chain-cascade-engine',
  'surge-detection',
  'tanker-fleet-monitor',
  'threat-classification',
  'tick-data-analyzer',
];

// Уровень 1: зависят от уровня 0
const LEVEL_1 = [
  'strategic-risk-composite',      // ← resilience-index, country-instability
  'ai-forecasts',                  // ← strategic-risk-composite
  'deception-index',               // ← narrative-drift, data-discrepancy, logistics-anomalies, source-coordination, silence-patterns
  'signal-aggregator',             // ← cross-stream-correlation, geo-convergence, country-instability, threat-classification, market-composite
  'risk-signal-aggregator',        // ← по _meta.sources
  'social-briefing-engine',        // ← adaptive-news-clustering, conflict-escalation-tracker, strategic-risk-composite, market-composite
  'supply-chain-resilience',       // ← по _meta.sources
];

// Уровень 2: зависят от всего
const LEVEL_2 = [
  'convergence-engine',            // ← все категории аналитики
];

// Служебные — НЕ запускаются
const SERVICE = [
  'alert-dispatcher',
  'cache-manager',
  'cli-analytics',
  'config-validator',
  'crucix-doctor',
  'dashboard-indicators',
  'event-deduplicator',
  'langgraph-orchestrator',
  'mcp-server',
  'module-registration-controller',
  'progressive-disclosure',
  'rate-limiter',
  'reference-data-provider',
  'snapshot-system',
  'watchdog',
];

// ─── Разбор CLI-аргументов ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY = args.find(a => a.startsWith('--only='))?.slice(7) || null;
const LEVEL_FILTER = args.find(a => a.startsWith('--level='))?.slice(8) || null;

// ─── Утилиты ───
async function ensureLogsDir() {
  try { await mkdir(LOGS_DIR, { recursive: true }); } catch (e) {}
}

async function fileExists(path) {
  try { await stat(path); return true; } catch (e) { return false; }
}

function ts() { return new Date().toISOString(); }

// Запуск одного анализатора через spawn
function runAnalyzer(name) {
  return new Promise((resolve) => {
    const scriptPath = join(ANALYZERS, name + '.mjs');
    const startedAt = Date.now();
    const child = spawn('node', [scriptPath], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      resolve({
        name,
        exitCode: code,
        durationMs,
        ok: code === 0,
        stdoutTail: stdout.split('\n').slice(-5).join('\n'),
        stderrTail: stderr.split('\n').slice(-5).join('\n'),
        errorMessage: code !== 0 ? (stderr.split('\n').find(l => l.trim()) || 'unknown') : null,
      });
    });

    child.on('error', (err) => {
      resolve({
        name,
        exitCode: -1,
        durationMs: Date.now() - startedAt,
        ok: false,
        stdoutTail: '',
        stderrTail: '',
        errorMessage: err.message,
      });
    });
  });
}

// ─── Основной цикл ───
async function runLevel(levelName, list, results) {
  console.log('\n\u25b8 ' + levelName + ': ' + list.length + ' анализаторов');
  for (const name of list) {
    if (ONLY && name !== ONLY) continue;

    const filePath = join(ANALYZERS, name + '.mjs');
    if (!(await fileExists(filePath))) {
      console.log('  \u2717 ' + name + ' — ФАЙЛ НЕ НАЙДЕН');
      results.push({ name, ok: false, errorMessage: 'file_not_found', level: levelName });
      continue;
    }

    if (DRY_RUN) {
      console.log('  \u23f5 ' + name + ' (dry-run)');
      results.push({ name, ok: true, dryRun: true, level: levelName });
      continue;
    }

    process.stdout.write('  \u23f5 ' + name + ' ... ');
    const r = await runAnalyzer(name);
    r.level = levelName;
    results.push(r);

    if (r.ok) {
      console.log('\u2713 ' + r.durationMs + 'ms');
    } else {
      console.log('\u2717 ' + r.durationMs + 'ms — ' + r.errorMessage);
    }
  }
}

async function main() {
  await ensureLogsDir();

  const t0 = Date.now();
  console.log('═══════════════════════════════════════════════════');
  console.log('Crucix Analyzers Orchestrator v1.0.1 (синтез)');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ROOT: ' + ROOT);
  console.log('  Режим: ' + (DRY_RUN ? 'dry-run' : 'полный прогон'));
  if (ONLY) console.log('  Только: ' + ONLY);
  if (LEVEL_FILTER) console.log('  Уровень: ' + LEVEL_FILTER);
  console.log('  Всего: ' + (LEVEL_0.length + LEVEL_1.length + LEVEL_2.length) + ' анализаторов');
  console.log('  Служебных (пропуск): ' + SERVICE.length);

  const results = [];

  if (!LEVEL_FILTER || LEVEL_FILTER === '0') {
    await runLevel('Уровень 0 (базовые)', LEVEL_0, results);
  }
  if (!LEVEL_FILTER || LEVEL_FILTER === '1') {
    await runLevel('Уровень 1 (производные)', LEVEL_1, results);
  }
  if (!LEVEL_FILTER || LEVEL_FILTER === '2') {
    await runLevel('Уровень 2 (агрегат)', LEVEL_2, results);
  }

  const totalMs = Date.now() - t0;
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('ИТОГ');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Всего запущено: ' + results.length);
  console.log('  Успешно: ' + ok);
  console.log('  Провалено: ' + fail);
  console.log('  Общее время: ' + (totalMs / 1000).toFixed(1) + 'с');

  if (fail > 0) {
    console.log('\n  Провалившиеся:');
    for (const r of results.filter(x => !x.ok)) {
      console.log('    \u2717 ' + r.name + ' — ' + (r.errorMessage || 'unknown'));
    }
  }

  const report = {
    generatedAt: ts(),
    totalMs,
    total: results.length,
    ok,
    fail,
    dryRun: DRY_RUN,
    levelFilter: LEVEL_FILTER,
    only: ONLY,
    results: results.map(r => ({
      name: r.name,
      level: r.level,
      ok: r.ok,
      durationMs: r.durationMs ?? null,
      errorMessage: r.errorMessage ?? null,
    })),
  };

  if (!DRY_RUN) {
    await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
    console.log('\n  Отчёт: ' + REPORT_FILE);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(2);
});
