// apis/predict/workers/example_parallel.mjs
// Пример: параллельный Monte Carlo + параллельное обучение моделей

import { getWorkerPool } from './pool.mjs';

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log('  Пример: параллельные вычисления');
  console.log('════════════════════════════════════════════════');

  const pool = getWorkerPool();

  console.log('\n[1] Monte Carlo с 4 воркерами...');

  const mcConfig = {
    initialState: { vix: 22, conflictLevel: 5, hySpread: 3.2 },
    variables: [
      { name: 'vixShock', distribution: 'normal', params: { mean: 0, std: 2 } },
      { name: 'conflictShock', distribution: 'triangular', params: { min: -2, mode: 0, max: 5 } },
      { name: 'spreadShock', distribution: 'normal', params: { mean: 0, std: 0.3 } },
    ],
    transition: (state, draws) => ({
      vix: Math.max(10, state.vix + draws.vixShock),
      conflictLevel: Math.max(0, state.conflictLevel + draws.conflictShock),
      hySpread: Math.max(0.5, state.hySpread + draws.spreadShock),
    }),
    horizon: 5,
    outcome: (state) => {
      if (state.vix > 35 || state.hySpread > 6) return 'crisis';
      if (state.vix > 25 || state.conflictLevel > 10) return 'escalation';
      if (state.vix < 18 && state.hySpread < 3) return 'stable';
      return 'unstable';
    },
  };

  const t0 = Date.now();
  const mc = await pool.monteCarloParallel(mcConfig, 100000);
  const seqTime = Date.now() - t0;

  console.log('  Вероятности:', JSON.stringify(mc.probabilities, null, 4));
  console.log(`  Итераций: ${mc.iterations}`);
  console.log(`  Время (параллельно): ${seqTime}ms`);
  console.log(`  Воркеров: ${mc.workersUsed}`);

  console.log('\n[2] Параллельное обучение 3 моделей...');

  const X = Array.from({ length: 200 }, () =>
    Array.from({ length: 10 }, () => Math.random() * 2 - 1)
  );
  const y = X.map(row => [row[0] * 2 + row[1] - row[2] * 0.5 + Math.random() * 0.1]);

  const t1 = Date.now();
  const [mlpResult, gbmResult, rfResult] = await Promise.all([
    pool.run('train_mlp', { X, y, layers: [10, 32, 16, 1], epochs: 50, lr: 0.01 }),
    pool.run('train_gbm', { X, y, nEstimators: 100, maxDepth: 4, learningRate: 0.1 }),
    pool.run('train_rf', { X, y, nEstimators: 100, maxDepth: 8 }),
  ]);
  const parallelTime = Date.now() - t1;

  console.log(`  MLP: loss=${mlpResult.result.finalLoss.toFixed(6)} (${mlpResult.durationMs}ms)`);
  console.log(`  GBM: preds=${gbmResult.result.predictions.map(p => p.toFixed(2)).join(', ')} (${gbmResult.durationMs}ms)`);
  console.log(`  RF:  preds=${rfResult.result.predictions.map(p => p.toFixed(2)).join(', ')} (${rfResult.durationMs}ms)`);
  console.log(`  Общее время (параллельно): ${parallelTime}ms`);

  console.log('\n[3] Параллельная кросс-валидация (5-fold × 3 модели)...');

  const t2 = Date.now();
  const cvResults = await pool.runAll([
    { action: 'cross_validate', payload: { X, y, folds: 5, modelConfig: { layers: [10, 32, 1], epochs: 20 } } },
    { action: 'cross_validate', payload: { X, y, folds: 5, modelConfig: { layers: [10, 64, 32, 1], epochs: 20 } } },
    { action: 'cross_validate', payload: { X, y, folds: 5, modelConfig: { layers: [10, 128, 64, 1], epochs: 20 } } },
  ]);
  const cvTime = Date.now() - t2;

  cvResults.forEach((r, i) => {
    console.log(`  Модель ${i + 1}: mean=${r.result.meanScore.toFixed(6)}, std=${r.result.stdScore.toFixed(6)} (${r.durationMs}ms)`);
  });
  console.log(`  Общее время: ${cvTime}ms`);

  console.log('\n[Статистика пула]');
  console.log(JSON.stringify(pool.stats(), null, 2));

  await pool.terminate();
  console.log('\n✓ Все воркеры завершены');
}

main().catch(e => {
  console.error('Ошибка:', e);
  process.exit(1);
});
