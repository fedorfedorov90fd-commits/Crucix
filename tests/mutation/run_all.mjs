// tests/mutation/run_all.mjs
//
// Оркестратор мутационного тестирования Crucix.
//
// АРХИТЕКТУРА:
//   Не импортирует runMutationTests из младших файлов, а запускает каждый
//   набор как дочерний процесс (child_process.spawn) с env CRUCIX_MUTATION_JSON=1.
//   Это даёт:
//     - изоляцию (упавший набор не валит оркестратор);
//     - параллелизм (все 4 набора работают одновременно);
//     - отсутствие проблем с общим ESM-кэшем модулей;
//     - независимость от process.exit внутри младших файлов.
//
// ФУНКЦИОНАЛ:
//   1. Параллельный запуск 4 наборов.
//   2. Таймаут на набор (по умолчанию 60 сек, SIGKILL при превышении).
//   3. Взвешенное агрегирование через поле weight в SUITES.
//   4. Регрессионный трекинг: сравнение с runs/mutation/report.json
//      от прошлого запуска.
//   5. Два отчёта: runs/mutation/report.json и runs/mutation/report.md.
//   6. Порог через env CRUCIX_MUTATION_THRESHOLD (дефолт 0.70).
//   7. CLI: --suite=<name> для одного набора, --threshold=<число>.
//
// ЗАПУСК:
//   node tests/mutation/run_all.mjs
//   node tests/mutation/run_all.mjs --suite=coevolution
//   node tests/mutation/run_all.mjs --threshold=0.8
//   CRUCIX_MUTATION_THRESHOLD=0.75 node tests/mutation/run_all.mjs

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TESTS_MUTATION_DIR = __dirname;
const PROJECT_ROOT = join(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs', 'mutation');

// ─── КОНФИГУРАЦИЯ ─────────────────────────────────

const SUITES = [
  {
    name: 'MetaLearner',
    id: 'meta_learner',
    file: 'meta_learner.mutate.mjs',
    weight: 1.0,
  },
  {
    name: 'Hypergraph Contagion',
    id: 'hypergraph',
    file: 'hypergraph.mutate.mjs',
    weight: 1.0,
  },
  {
    name: 'Attention Dynamics',
    id: 'attention',
    file: 'attention.mutate.mjs',
    weight: 1.0,
  },
  {
    name: 'Adversarial Co-evolution',
    id: 'coevolution',
    file: 'coevolution.mutate.mjs',
    weight: 1.0,
  },
];

const DEFAULT_THRESHOLD = 0.70;
const DEFAULT_TIMEOUT_MS = 60000;

// ─── РАЗБОР CLI ───────────────────────────────────

function parseArgs(argv) {
  const opts = {
    threshold: null,
    suiteFilter: null,
  };
  for (const arg of argv) {
    if (arg.startsWith('--threshold=')) {
      const v = parseFloat(arg.slice('--threshold='.length));
      if (!isNaN(v) && v > 0 && v <= 1) opts.threshold = v;
    } else if (arg.startsWith('--suite=')) {
      opts.suiteFilter = arg.slice('--suite='.length);
    }
  }
  return opts;
}

const cliOpts = parseArgs(process.argv.slice(2));

const envThreshold = parseFloat(process.env.CRUCIX_MUTATION_THRESHOLD || '');
const THRESHOLD = cliOpts.threshold
  ?? ((envThreshold > 0 && envThreshold <= 1) ? envThreshold : DEFAULT_THRESHOLD);

// ─── ЗАПУСК ОДНОГО НАБОРА ─────────────────────────

function runSuite(suite) {
  return new Promise((resolve) => {
    const startMs = Date.now();
    const filePath = join(TESTS_MUTATION_DIR, suite.file);

    if (!existsSync(filePath)) {
      resolve({
        name: suite.name,
        id: suite.id,
        weight: suite.weight,
        status: 'missing',
        reason: `file not found: ${suite.file}`,
        elapsedMs: 0,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('node', [filePath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, CRUCIX_MUTATION_JSON: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch (e) {
        // ignore
      }
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({
        name: suite.name,
        id: suite.id,
        weight: suite.weight,
        status: 'crash',
        reason: `spawn error: ${e.message}`,
        elapsedMs: Date.now() - startMs,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        resolve({
          name: suite.name,
          id: suite.id,
          weight: suite.weight,
          status: 'timeout',
          reason: `exceeded ${DEFAULT_TIMEOUT_MS}ms`,
          elapsedMs: Date.now() - startMs,
        });
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve({
          name: suite.name,
          id: suite.id,
          weight: suite.weight,
          status: 'crash',
          reason: `empty stdout (exit code ${code})${stderr ? '; stderr: ' + stderr.slice(0, 200) : ''}`,
          elapsedMs: Date.now() - startMs,
        });
        return;
      }

      // Парсим последнюю строку stdout, начинающуюся с '{'
      const lines = trimmed.split('\n');
      let jsonLine = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i].trim();
        if (l.startsWith('{') && l.endsWith('}')) {
          jsonLine = l;
          break;
        }
      }

      if (!jsonLine) {
        resolve({
          name: suite.name,
          id: suite.id,
          weight: suite.weight,
          status: 'crash',
          reason: `no JSON line in stdout`,
          elapsedMs: Date.now() - startMs,
        });
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonLine);
      } catch (e) {
        resolve({
          name: suite.name,
          id: suite.id,
          weight: suite.weight,
          status: 'crash',
          reason: `JSON parse error: ${e.message}`,
          elapsedMs: Date.now() - startMs,
        });
        return;
      }

      if (parsed.crash) {
        resolve({
          name: suite.name,
          id: suite.id,
          weight: suite.weight,
          status: 'crash',
          reason: parsed.reason || 'suite reported crash',
          elapsedMs: Date.now() - startMs,
        });
        return;
      }

      resolve({
        name: suite.name,
        id: suite.id,
        weight: suite.weight,
        status: 'ok',
        killed: parsed.killed || 0,
        survived: parsed.survived || 0,
        errors: parsed.errors || 0,
        total: parsed.total || (parsed.killed || 0) + (parsed.survived || 0),
        score: typeof parsed.score === 'number' ? parsed.score : 0,
        details: parsed.details || [],
        elapsedMs: Date.now() - startMs,
      });
    });
  });
}

// ─── РЕГРЕССИОННЫЙ ТРЕКИНГ ────────────────────────

function loadPreviousReport() {
  const path = join(RUNS_DIR, 'report.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function compareWithPrevious(current, previous) {
  if (!previous || !previous.suites) return {};
  const map = {};
  for (const s of current) {
    if (s.status !== 'ok') continue;
    const prev = previous.suites.find(p => p.id === s.id && p.status === 'ok');
    if (!prev) {
      map[s.id] = { delta: null, trend: 'new' };
      continue;
    }
    const delta = s.score - prev.score;
    let trend = 'same';
    if (delta > 0.001) trend = 'up';
    else if (delta < -0.001) trend = 'down';
    map[s.id] = { delta, trend, prevScore: prev.score };
  }
  return map;
}

// ─── ФОРМАТТЕРЫ ───────────────────────────────────

function trendSymbol(trend) {
  if (trend === 'up') return '^';
  if (trend === 'down') return 'v';
  if (trend === 'same') return '=';
  if (trend === 'new') return '*';
  return ' ';
}

function bar(score, width = 20) {
  const filled = Math.round(score * width);
  return '#'.repeat(filled) + '.'.repeat(width - filled);
}

function statusLabel(s) {
  if (s.status === 'ok') {
    return s.score >= THRESHOLD ? 'OK  ' : 'FAIL';
  }
  if (s.status === 'timeout') return 'TIME';
  if (s.status === 'missing') return 'MISS';
  return 'CRSH';
}

function printConsoleReport(results, overall, threshold, regressions) {
  console.log('');
  console.log('+======================================================+');
  console.log('|  Mutation Testing -- All Modules                     |');
  console.log('+======================================================+');
  console.log('');

  for (const r of results) {
    const label = statusLabel(r);
    const trend = regressions[r.id] ? trendSymbol(regressions[r.id].trend) : ' ';
    if (r.status === 'ok') {
      console.log(`  [${label}] ${trend} ${r.name.padEnd(26)} ${bar(r.score)} ${(r.score * 100).toFixed(1).padStart(5)}%  (${r.killed}/${r.total}) ${r.elapsedMs}ms`);
    } else {
      console.log(`  [${label}] ${trend} ${r.name.padEnd(26)} -- ${r.reason}`);
    }
  }

  console.log('');
  console.log('+======================================================+');
  console.log(`  OVERALL:  ${(overall * 100).toFixed(1)}%`);
  console.log(`  THRESHOLD: ${(threshold * 100).toFixed(1)}%`);
  console.log('+======================================================+');
  console.log('');

  const downs = Object.entries(regressions).filter(([, v]) => v.trend === 'down');
  if (downs.length > 0) {
    console.log('  Регрессии относительно прошлого запуска:');
    for (const [id, v] of downs) {
      console.log(`    - ${id}: ${(v.prevScore * 100).toFixed(1)}% -> ${((v.prevScore + v.delta) * 100).toFixed(1)}%`);
    }
    console.log('');
  }
}

function buildMarkdownReport(results, overall, threshold, regressions, timestamp) {
  const lines = [];
  lines.push('# Mutation Testing Report');
  lines.push('');
  lines.push(`Дата: ${timestamp}`);
  lines.push(`Overall: **${(overall * 100).toFixed(1)}%** (порог ${(threshold * 100).toFixed(1)}%)`);
  lines.push('');
  lines.push('## По наборам');
  lines.push('');
  lines.push('| Набор | Статус | Score | Killed | Total | Время | Trend |');
  lines.push('|-------|--------|-------|--------|-------|-------|-------|');
  for (const r of results) {
    const trend = regressions[r.id] ? regressions[r.id].trend : '-';
    if (r.status === 'ok') {
      lines.push(`| ${r.name} | ${r.score >= threshold ? 'OK' : 'FAIL'} | ${(r.score * 100).toFixed(1)}% | ${r.killed} | ${r.total} | ${r.elapsedMs}ms | ${trend} |`);
    } else {
      lines.push(`| ${r.name} | ${r.status} | - | - | - | ${r.elapsedMs}ms | - |`);
    }
  }
  lines.push('');
  lines.push('## Выжившие мутации');
  lines.push('');
  for (const r of results) {
    if (r.status !== 'ok' || !Array.isArray(r.details)) continue;
    const survived = r.details.filter(d => d && d.killed === false);
    if (survived.length === 0) continue;
    lines.push(`### ${r.name}`);
    lines.push('');
    for (const s of survived) {
      lines.push(`- ${s.name || 'unknown'}${s.error ? ' (error: ' + s.error + ')' : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── ГЛАВНАЯ ФУНКЦИЯ ──────────────────────────────

async function runAll() {
  const previousReport = loadPreviousReport();

  const suites = cliOpts.suiteFilter
    ? SUITES.filter(s => s.id === cliOpts.suiteFilter || s.name.toLowerCase().includes(cliOpts.suiteFilter.toLowerCase()))
    : SUITES;

  if (suites.length === 0) {
    console.error(`Нет наборов, соответствующих фильтру: ${cliOpts.suiteFilter}`);
    console.error(`Доступные: ${SUITES.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  const results = await Promise.all(suites.map(runSuite));

  let killedSum = 0;
  let totalSum = 0;
  let hasCrash = false;

  for (const r of results) {
    if (r.status !== 'ok') {
      hasCrash = true;
      continue;
    }
    killedSum += r.killed * r.weight;
    totalSum += r.total * r.weight;
  }

  const overall = totalSum > 0 ? killedSum / totalSum : 0;

  const regressions = compareWithPrevious(results, previousReport);

  printConsoleReport(results, overall, THRESHOLD, regressions);

  if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });

  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    overall,
    threshold: THRESHOLD,
    hasCrash,
    suites: results.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      weight: r.weight,
      killed: r.killed,
      survived: r.survived,
      errors: r.errors,
      total: r.total,
      score: r.score,
      elapsedMs: r.elapsedMs,
      reason: r.reason,
      details: r.details,
    })),
  };

  writeFileSync(join(RUNS_DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(RUNS_DIR, 'report.md'), buildMarkdownReport(results, overall, THRESHOLD, regressions, timestamp) + '\n');

  console.log(`  Отчёт: runs/mutation/report.json`);
  console.log(`  Отчёт: runs/mutation/report.md`);
  console.log('');

  const passed = overall >= THRESHOLD && !hasCrash;
  if (passed) {
    console.log('  PASSED');
    process.exit(0);
  } else {
    if (hasCrash) {
      console.error('  FAILED: один или несколько наборов упали или не найдены');
    } else {
      console.error(`  FAILED: overall ниже порога (${(overall * 100).toFixed(1)}% < ${(THRESHOLD * 100).toFixed(1)}%)`);
    }
    process.exit(1);
  }
}

// ─── CLI RUNNER ───────────────────────────────────

const isDirectRun = (() => {
  if (typeof process === 'undefined' || !process.argv) return false;
  const argv1 = process.argv[1] || '';
  return argv1.endsWith('run_all.mjs');
})();

if (isDirectRun) {
  runAll().catch((e) => {
    console.error('Orchestrator crash:', e);
    process.exit(1);
  });
}

export { runAll, SUITES, THRESHOLD };
