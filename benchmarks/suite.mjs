// benchmark/suite.mjs
// Бенчмарк-сюита: Crucix против классических baseline
//
// Сравниваем по метрикам:
//   - RMSE (Root Mean Squared Error)
//   - MAE (Mean Absolute Error)
//   - Brier Score (для вероятностных прогнозов)
//   - Hit Rate (процент правильных направлений)
//   - Sharpe-like ratio (accuracy/volatility)

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MLP } from '../apis/predict/models/neural.mjs';
import { GradientBoosting } from '../apis/predict/models/gbm.mjs';
import { RandomForest } from '../apis/predict/models/random_forest.mjs';
import { holtLinear, autoregression, forecastSeries } from '../apis/predict/timeseries.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, '..', 'runs');
const MEMORY_DIR = join(RUNS_DIR, 'memory');
const BENCHMARK_DIR = join(RUNS_DIR, 'benchmark');

function rmse(predictions, actual) {
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) sum += (predictions[i] - actual[i]) ** 2;
  return Math.sqrt(sum / predictions.length);
}

function mae(predictions, actual) {
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) sum += Math.abs(predictions[i] - actual[i]);
  return sum / predictions.length;
}

function brierScore(probabilities, outcomes) {
  let sum = 0;
  for (let i = 0; i < probabilities.length; i++) sum += (probabilities[i] - outcomes[i]) ** 2;
  return sum / probabilities.length;
}

function hitRate(predictions, actual) {
  let hits = 0;
  for (let i = 1; i < predictions.length; i++) {
    const predDir = Math.sign(predictions[i] - actual[i - 1]);
    const actualDir = Math.sign(actual[i] - actual[i - 1]);
    if (predDir === actualDir) hits++;
  }
  return hits / Math.max(predictions.length - 1, 1);
}

function sharpeLike(returns) {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  return std > 0 ? mean / std : 0;
}

function maxDrawdown(equityCurve) {
  let maxDD = 0;
  let peak = equityCurve[0];
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function loadHistory() {
  const history = [];
  try {
    const files = readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 2000);

    for (const file of files) {
      try {
        history.push(JSON.parse(readFileSync(join(MEMORY_DIR, file), 'utf-8')));
      } catch {}
    }
  } catch {}
  return history.reverse();
}

function extractSeries(history, getter) {
  return history.map(h => getter(h)).filter(v => v !== undefined && v !== null && !isNaN(v));
}

function naiveForecast(series, horizon = 1) {
  const predictions = [];
  for (let i = 0; i < series.length - horizon; i++) predictions.push(series[i]);
  return predictions;
}

function movingAverageForecast(series, window = 5) {
  const predictions = [];
  for (let i = window; i < series.length; i++) {
    const avg = series.slice(i - window, i).reduce((a, b) => a + b, 0) / window;
    predictions.push(avg);
  }
  return predictions;
}

function arima111(series) {
  const predictions = [];

  for (let i = 10; i < series.length; i++) {
    const slice = series.slice(0, i);
    const diff = [];
    for (let j = 1; j < slice.length; j++) diff.push(slice[j] - slice[j - 1]);

    if (diff.length < 5) {
      predictions.push(slice[slice.length - 1]);
      continue;
    }

    const meanDiff = diff.reduce((a, b) => a + b, 0) / diff.length;
    const centeredDiff = diff.map(d => d - meanDiff);

    let num = 0, den = 0;
    for (let j = 1; j < centeredDiff.length; j++) {
      num += centeredDiff[j] * centeredDiff[j - 1];
      den += centeredDiff[j - 1] ** 2;
    }
    const arCoeff = den > 0 ? num / den : 0;

    const lastDiff = diff[diff.length - 1];
    const nextDiff = meanDiff + arCoeff * (lastDiff - meanDiff);
    predictions.push(slice[slice.length - 1] + nextDiff);
  }

  return predictions;
}

function holtForecast(series) {
  const predictions = [];
  for (let i = 10; i < series.length; i++) {
    const slice = series.slice(0, i);
    const result = holtLinear(slice, 0.3, 0.1, 1);
    predictions.push(result.forecast[0]);
  }
  return predictions;
}

function randomWalkDrift(series) {
  const predictions = [];
  for (let i = 5; i < series.length; i++) {
    const slice = series.slice(0, i);
    const drift = (slice[slice.length - 1] - slice[0]) / slice.length;
    predictions.push(slice[slice.length - 1] + drift);
  }
  return predictions;
}

function arpForecast(series, p = 3) {
  const predictions = [];
  for (let i = p + 5; i < series.length; i++) {
    const slice = series.slice(0, i);
    const ar = autoregression(slice, p, 1);
    predictions.push(ar.forecast[0]);
  }
  return predictions;
}

function mlpForecast(X, y, { layers = [10, 32, 16, 1], epochs = 50 } = {}) {
  const n = X.length;
  const splitIdx = Math.floor(n * 0.8);

  const XTrain = X.slice(0, splitIdx);
  const yTrain = y.slice(0, splitIdx);
  const XTest = X.slice(splitIdx);
  const yTest = y.slice(splitIdx);

  const model = new MLP({ layers, activation: 'relu', outputActivation: 'linear' });
  model.fit(XTrain, yTrain, { epochs, batchSize: 16, lr: 0.01 });

  const predictions = model.predict(XTest).map(p => p[0]);
  return { predictions, actual: yTest, model };
}

function gbmForecast(X, y, { nEstimators = 100, maxDepth = 4 } = {}) {
  const n = X.length;
  const splitIdx = Math.floor(n * 0.8);

  const XTrain = X.slice(0, splitIdx);
  const yTrain = y.slice(0, splitIdx);
  const XTest = X.slice(splitIdx);
  const yTest = y.slice(splitIdx);

  const model = new GradientBoosting({ nEstimators, maxDepth, learningRate: 0.1 });
  model.fit(XTrain, yTrain);

  const predictions = model.predict(XTest);
  return { predictions, actual: yTest, model };
}

function rfForecast(X, y, { nEstimators = 100, maxDepth = 8 } = {}) {
  const n = X.length;
  const splitIdx = Math.floor(n * 0.8);

  const XTrain = X.slice(0, splitIdx);
  const yTrain = y.slice(0, splitIdx);
  const XTest = X.slice(splitIdx);
  const yTest = y.slice(splitIdx);

  const model = new RandomForest({ nEstimators, maxDepth });
  model.fit(XTrain, yTrain);

  const predictions = model.predict(XTest);
  return { predictions, actual: yTest, model };
}

async function runBenchmark({ target = 'vix' } = {}) {
  console.log('════════════════════════════════════════════════');
  console.log('  Crucix Benchmark Suite');
  console.log('════════════════════════════════════════════════');
  console.log('');

  const t0 = Date.now();
  const history = loadHistory();
  console.log(`Загружено sweep-записей: ${history.length}`);

  if (history.length < 50) {
    console.error('Недостаточно данных для бенчмарка (нужно ≥50)');
    return null;
  }

  const getters = {
    vix: h => h.fred?.vix,
    hySpread: h => h.fred?.hySpread,
    conflictCount: h => h.gdelt?.conflictEvents?.length,
    oilPrice: h => h.energy?.oilPrice,
    goldPrice: h => h.gold?.price,
  };

  const series = extractSeries(history, getters[target]);
  console.log(`Целевая переменная: ${target}`);
  console.log(`Длина ряда: ${series.length}`);
  console.log('');

  const results = {};

  console.log('[1/9] Naive (last value)...');
  const naivePreds = naiveForecast(series);
  const naiveActual = series.slice(1);
  results['Naive'] = {
    predictions: naivePreds,
    actual: naiveActual,
    rmse: rmse(naivePreds, naiveActual),
    mae: mae(naivePreds, naiveActual),
    hitRate: hitRate(naivePreds, naiveActual),
  };
  console.log(`  RMSE=${results['Naive'].rmse.toFixed(4)}, MAE=${results['Naive'].mae.toFixed(4)}, HitRate=${(results['Naive'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[2/9] Moving Average (5)...');
  const maPreds = movingAverageForecast(series, 5);
  const maActual = series.slice(5);
  results['Moving Average'] = {
    predictions: maPreds,
    actual: maActual,
    rmse: rmse(maPreds, maActual),
    mae: mae(maPreds, maActual),
    hitRate: hitRate(maPreds, maActual),
  };
  console.log(`  RMSE=${results['Moving Average'].rmse.toFixed(4)}, MAE=${results['Moving Average'].mae.toFixed(4)}, HitRate=${(results['Moving Average'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[3/9] ARIMA(1,1,1)...');
  const arimaPreds = arima111(series);
  const arimaActual = series.slice(10);
  results['ARIMA(1,1,1)'] = {
    predictions: arimaPreds,
    actual: arimaActual,
    rmse: rmse(arimaPreds, arimaActual),
    mae: mae(arimaPreds, arimaActual),
    hitRate: hitRate(arimaPreds, arimaActual),
  };
  console.log(`  RMSE=${results['ARIMA(1,1,1)'].rmse.toFixed(4)}, MAE=${results['ARIMA(1,1,1)'].mae.toFixed(4)}, HitRate=${(results['ARIMA(1,1,1)'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[4/9] Holt Linear (ETS)...');
  const holtPreds = holtForecast(series);
  const holtActual = series.slice(10);
  results['Holt Linear'] = {
    predictions: holtPreds,
    actual: holtActual,
    rmse: rmse(holtPreds, holtActual),
    mae: mae(holtPreds, holtActual),
    hitRate: hitRate(holtPreds, holtActual),
  };
  console.log(`  RMSE=${results['Holt Linear'].rmse.toFixed(4)}, MAE=${results['Holt Linear'].mae.toFixed(4)}, HitRate=${(results['Holt Linear'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[5/9] Random Walk with Drift...');
  const rwPreds = randomWalkDrift(series);
  const rwActual = series.slice(5);
  results['Random Walk Drift'] = {
    predictions: rwPreds,
    actual: rwActual,
    rmse: rmse(rwPreds, rwActual),
    mae: mae(rwPreds, rwActual),
    hitRate: hitRate(rwPreds, rwActual),
  };
  console.log(`  RMSE=${results['Random Walk Drift'].rmse.toFixed(4)}, MAE=${results['Random Walk Drift'].mae.toFixed(4)}, HitRate=${(results['Random Walk Drift'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[6/9] AR(3)...');
  const arPreds = arpForecast(series, 3);
  const arActual = series.slice(8);
  results['AR(3)'] = {
    predictions: arPreds,
    actual: arActual,
    rmse: rmse(arPreds, arActual),
    mae: mae(arPreds, arActual),
    hitRate: hitRate(arPreds, arActual),
  };
  console.log(`  RMSE=${results['AR(3)'].rmse.toFixed(4)}, MAE=${results['AR(3)'].mae.toFixed(4)}, HitRate=${(results['AR(3)'].hitRate * 100).toFixed(1)}%`);

  const X = [];
  const y = [];
  for (let i = 5; i < history.length - 1; i++) {
    const h = history[i];
    const next = history[i + 1];
    const targetValue = getters[target](next);
    if (targetValue === undefined) continue;

    X.push([
      h.fred?.vix || 20,
      h.fred?.hySpread || 3,
      h.fred?.treasury10y || 4,
      h.gdelt?.conflictEvents?.length || 0,
      h.sanctions?.count || 0,
      h.energy?.oilPrice || 70,
      h.gold?.price || 1900,
      h.dxy?.value || 100,
      h.radiation ? Math.max(...Object.values(h.radiation).map(s => s.cpm || 0)) : 0,
      h.delta?.newAlerts || 0,
    ]);
    y.push([targetValue]);
  }

  console.log('\n[7/9] MLP (10→32→16→1)...');
  const mlpResult = mlpForecast(X, y);
  results['MLP (Crucix)'] = {
    predictions: mlpResult.predictions,
    actual: mlpResult.actual.map(a => a[0]),
    rmse: rmse(mlpResult.predictions, mlpResult.actual.map(a => a[0])),
    mae: mae(mlpResult.predictions, mlpResult.actual.map(a => a[0])),
    hitRate: hitRate(mlpResult.predictions, mlpResult.actual.map(a => a[0])),
  };
  console.log(`  RMSE=${results['MLP (Crucix)'].rmse.toFixed(4)}, MAE=${results['MLP (Crucix)'].mae.toFixed(4)}, HitRate=${(results['MLP (Crucix)'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[8/9] Gradient Boosting (Crucix)...');
  const gbmResult = gbmForecast(X, y);
  results['GBM (Crucix)'] = {
    predictions: gbmResult.predictions,
    actual: gbmResult.actual.map(a => a[0]),
    rmse: rmse(gbmResult.predictions, gbmResult.actual.map(a => a[0])),
    mae: mae(gbmResult.predictions, gbmResult.actual.map(a => a[0])),
    hitRate: hitRate(gbmResult.predictions, gbmResult.actual.map(a => a[0])),
  };
  console.log(`  RMSE=${results['GBM (Crucix)'].rmse.toFixed(4)}, MAE=${results['GBM (Crucix)'].mae.toFixed(4)}, HitRate=${(results['GBM (Crucix)'].hitRate * 100).toFixed(1)}%`);

  console.log('\n[9/9] Random Forest (Crucix)...');
  const rfResult = rfForecast(X, y);
  results['RF (Crucix)'] = {
    predictions: rfResult.predictions,
    actual: rfResult.actual.map(a => a[0]),
    rmse: rmse(rfResult.predictions, rfResult.actual.map(a => a[0])),
    mae: mae(rfResult.predictions, rfResult.actual.map(a => a[0])),
    hitRate: hitRate(rfResult.predictions, rfResult.actual.map(a => a[0])),
  };
  console.log(`  RMSE=${results['RF (Crucix)'].rmse.toFixed(4)}, MAE=${results['RF (Crucix)'].mae.toFixed(4)}, HitRate=${(results['RF (Crucix)'].hitRate * 100).toFixed(1)}%`);

  console.log('\n════════════════════════════════════════════════');
  console.log('  ИТОГОВАЯ ТАБЛИЦА');
  console.log('════════════════════════════════════════════════');
  console.log('');
  console.log('| Модель              | RMSE     | MAE      | Hit Rate | Rank |');
  console.log('|---------------------|----------|----------|----------|------|');

  const sortedByRMSE = Object.entries(results).sort((a, b) => a[1].rmse - b[1].rmse);

  sortedByRMSE.forEach(([name, r], idx) => {
    console.log(`| ${name.padEnd(19)} | ${r.rmse.toFixed(4).padStart(8)} | ${r.mae.toFixed(4).padStart(8)} | ${(r.hitRate * 100).toFixed(1).padStart(7)}% | ${(idx + 1).toString().padStart(4)} |`);
  });

  const winner = sortedByRMSE[0];
  console.log('');
  console.log(`🏆 Лучшая модель: ${winner[0]} (RMSE=${winner[1].rmse.toFixed(4)})`);

  const crucixBest = sortedByRMSE.find(([name]) => name.includes('Crucix'));
  if (crucixBest && crucixBest[1].rmse < results['Naive'].rmse) {
    const improvement = ((results['Naive'].rmse - crucixBest[1].rmse) / results['Naive'].rmse * 100).toFixed(2);
    console.log(`📊 Crucix лучше Naive на ${improvement}%`);
  }

  const totalTime = Date.now() - t0;

  if (!existsSync(BENCHMARK_DIR)) mkdirSync(BENCHMARK_DIR, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    target,
    dataLength: series.length,
    durationMs: totalTime,
    results: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, {
        rmse: v.rmse,
        mae: v.mae,
        hitRate: v.hitRate,
      }])
    ),
    ranking: sortedByRMSE.map(([name, r], idx) => ({
      rank: idx + 1,
      model: name,
      rmse: r.rmse,
      mae: r.mae,
      hitRate: r.hitRate,
    })),
    winner: winner[0],
  };

  writeFileSync(join(BENCHMARK_DIR, `report_${target}_${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(`\nОтчёт сохранён: ${join(BENCHMARK_DIR, `report_${target}_${Date.now()}.json`)}`);

  return report;
}

if (process.argv[1] && process.argv[1].endsWith('suite.mjs')) {
  const target = process.argv[2] || 'vix';
  runBenchmark({ target }).catch(e => {
    console.error('Ошибка бенчмарка:', e);
    process.exit(1);
  });
}

export { runBenchmark, rmse, mae, hitRate, brierScore };
