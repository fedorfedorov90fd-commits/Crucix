// apis/predict/workers/montecarlo_worker.mjs
// Web Worker для параллельного Monte Carlo и матричных операций

import { parentPort } from 'node:worker_threads';

function gaussianRandom(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function triangularRandom(min, mode, max) {
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function runMonteCarlo({ initialState, variables, transition, iterations, horizon, outcome }) {
  const outcomes = {};
  const trajectories = [];
  const finalStates = [];

  for (let i = 0; i < iterations; i++) {
    let state = { ...initialState };
    const trajectory = [{ step: 0, ...state }];

    for (let step = 1; step <= horizon; step++) {
      const draws = {};
      for (const v of variables) {
        let params = v.params;
        if (v.dependsOn) params = v.dependsOn(state, params);

        switch (v.distribution) {
          case 'normal':
            draws[v.name] = gaussianRandom(params.mean, params.std);
            break;
          case 'triangular':
            draws[v.name] = triangularRandom(params.min, params.mode, params.max);
            break;
          case 'uniform':
            draws[v.name] = params.min + Math.random() * (params.max - params.min);
            break;
          case 'bernoulli':
            draws[v.name] = Math.random() < params.p ? 1 : 0;
            break;
        }
      }

      state = transition(state, draws, step);
      trajectory.push({ step, ...state });
    }

    const result = outcome(state);
    outcomes[result] = (outcomes[result] || 0) + 1;
    if (trajectories.length < 5) trajectories.push(trajectory);
    if (finalStates.length < 100) finalStates.push(state);
  }

  return { outcomes, iterations, sampleTrajectories: trajectories, finalStates };
}

function matrixMultiply(A, B) {
  const n = A.length, m = A[0].length, p = B[0].length;
  const C = Array.from({ length: n }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < p; j++) C[i][j] += aik * B[k][j];
    }
  }
  return C;
}

parentPort.on('message', (task) => {
  const t0 = Date.now();

  try {
    let result;

    switch (task.action) {
      case 'montecarlo':
        result = runMonteCarlo(task.payload);
        break;

      case 'matrix_multiply':
        result = matrixMultiply(task.payload.A, task.payload.B);
        break;

      case 'ping':
        result = { pong: true, workerTime: Date.now() };
        break;

      case 'batch_montecarlo':
        result = task.payload.configs.map(c => runMonteCarlo(c));
        break;

      default:
        throw new Error(`Unknown action: ${task.action}`);
    }

    parentPort.postMessage({
      taskId: task.taskId,
      result,
      durationMs: Date.now() - t0,
    });
  } catch (e) {
    parentPort.postMessage({
      taskId: task.taskId,
      error: e.message,
      durationMs: Date.now() - t0,
    });
  }
});
