// tests/mutation/run_all.original.mjs
//
// ОРИГИНАЛЬНАЯ версия оркестратора мутационных тестов из 6части.txt
// (строки 2235-2750). Сохранена для истории и сверки.
//
// Рабочая версия -- run_all.mjs (потолочная, 470 строк, spawn-архитектура).
// Этот файл НЕ используется в CI и не вызывается из других модулей.
//
// Причина разделения: в оригинале был архитектурный дефект -- внутренний
// process.exit(1) в младших наборах при score < 0.7 убивал весь оркестратор
// (например, coevolution с 66.7% валил run_all.mjs до расчёта overall).
// Потолочная версия решила это через child_process.spawn.

// tests/mutation/run_all.mjs
// Оркестратор всех mutation-тестов

import { runMutationTests as metaLearner } from './meta_learner.mutate.mjs';
import { runMutationTests as hypergraph } from './hypergraph.mutate.mjs';
import { runMutationTests as attention } from './attention.mutate.mjs';
import { runMutationTests as coevolution } from './coevolution.mutate.mjs';

const SUITES = [
  { name: 'MetaLearner', run: metaLearner, weight: 1.0 },
  { name: 'Hypergraph Contagion', run: hypergraph, weight: 1.0 },
  { name: 'Attention Dynamics', run: attention, weight: 1.0 },
  { name: 'Adversarial Co-evolution', run: coevolution, weight: 1.0 },
];

async function runAll() {
  console.log('');
  console.log('+======================================================+');
  console.log('|  Mutation Testing -- All Modules (v3.0)              |');
  console.log('+======================================================+');

  const results = [];
  let totalKilled = 0, totalSurvived = 0;

  for (const suite of SUITES) {
    console.log(`\n> ${suite.name}`);
    try {
      const result = await suite.run();
      results.push({ name: suite.name, ...result });
      totalKilled += result.killed;
      totalSurvived += result.survived;
    } catch (e) {
      console.error(`  x Suite crashed: ${e.message}`);
      results.push({ name: suite.name, crashed: true, error: e.message });
    }
  }

  console.log('');
  console.log('+======================================================+');
  console.log('|  SUMMARY                                             |');
  console.log('+======================================================+');
  console.log('');

  for (const r of results) {
    if (r.crashed) {
      console.log(`  x ${r.name.padEnd(30)} CRASHED`);
      continue;
    }
    const score = r.killed / (r.killed + r.survived);
    const status = score >= 0.7 ? 'OK' : 'FAIL';
    const bar = '#'.repeat(Math.round(score * 20)) + '.'.repeat(20 - Math.round(score * 20));
    console.log(`  [${status}] ${r.name.padEnd(28)} ${bar} ${(score * 100).toFixed(1).padStart(5)}% (${r.killed}/${r.killed + r.survived})`);
  }

  const overall = totalKilled / (totalKilled + totalSurvived);
  console.log('');
  console.log(`  OVERALL: ${(overall * 100).toFixed(1)}% (${totalKilled}/${totalKilled + totalSurvived})`);
  console.log(`  TARGET:  70%`);
  console.log('');

  if (overall < 0.7) {
    console.error('  FAILED: overall mutation score below 70%');
    process.exit(1);
  }
  console.log('  PASSED');
}

if (process.argv[1] && process.argv[1].endsWith('run_all.mjs')) {
  runAll().catch(e => {
    console.error('Crash:', e);
    process.exit(1);
  });
}

export { runAll };
