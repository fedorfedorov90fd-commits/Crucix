// apis/predict/workers/pool.mjs
// Пул Web Workers для параллельных вычислений
//
// Использует worker_threads из Node.js, чтобы задействовать все ядра.
// Автоматически балансирует нагрузку между воркерами.

import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const N_CPUS = cpus().length;
const DEFAULT_POOL_SIZE = Math.max(1, Math.min(N_CPUS - 1, 8));

class WorkerPool {
  constructor({ size = DEFAULT_POOL_SIZE, scriptPath = null } = {}) {
    this.size = size;
    this.scriptPath = scriptPath || join(__dirname, 'montecarlo_worker.mjs');
    this.workers = [];
    this.queue = [];
    this.taskId = 0;
    this.pendingTasks = new Map();

    this._stats = {
      tasksCompleted: 0,
      tasksPending: 0,
      totalTimeMs: 0,
      startedAt: Date.now(),
    };

    this._initWorkers();
  }

  _initWorkers() {
    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(this.scriptPath);
      const workerInfo = {
        worker,
        busy: false,
        currentTask: null,
        id: i,
        tasksDone: 0,
      };

      worker.on('message', (msg) => this._handleMessage(workerInfo, msg));
      worker.on('error', (err) => this._handleError(workerInfo, err));
      worker.on('exit', (code) => {
        if (code !== 0) console.error(`[pool] Worker ${i} exited with code ${code}`);
      });

      this.workers.push(workerInfo);
    }

    console.log(`[pool] Инициализировано ${this.size} воркеров (доступно ядер: ${N_CPUS})`);
  }

  run(action, payload) {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskId;
      this.pendingTasks.set(taskId, { resolve, reject, action });

      const task = { taskId, action, payload };

      const freeWorker = this.workers.find(w => !w.busy);
      if (freeWorker) {
        this._dispatch(freeWorker, task);
      } else {
        this.queue.push(task);
        this._stats.tasksPending++;
      }
    });
  }

  _dispatch(workerInfo, task) {
    workerInfo.busy = true;
    workerInfo.currentTask = task.taskId;
    const t0 = Date.now();
    this.pendingTasks.get(task.taskId).startedAt = t0;
    workerInfo.worker.postMessage(task);
  }

  _handleMessage(workerInfo, msg) {
    const { taskId, result, error, durationMs } = msg;
    const pending = this.pendingTasks.get(taskId);

    workerInfo.busy = false;
    workerInfo.currentTask = null;
    workerInfo.tasksDone++;

    if (pending) {
      const duration = durationMs || (Date.now() - (pending.startedAt || Date.now()));
      this._stats.tasksCompleted++;
      this._stats.totalTimeMs += duration;

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve({ result, durationMs: duration, workerId: workerInfo.id });
      }
      this.pendingTasks.delete(taskId);
    }

    if (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      this._stats.tasksPending--;
      this._dispatch(workerInfo, nextTask);
    }
  }

  _handleError(workerInfo, err) {
    const taskId = workerInfo.currentTask;
    if (taskId && this.pendingTasks.has(taskId)) {
      const pending = this.pendingTasks.get(taskId);
      pending.reject(err);
      this.pendingTasks.delete(taskId);
    }
    workerInfo.busy = false;
    workerInfo.currentTask = null;
  }

  async runAll(tasks) {
    return Promise.all(tasks.map(t => this.run(t.action, t.payload)));
  }

  async mapReduce(items, mapAction, reduceFn) {
    const tasks = items.map(item => ({ action: mapAction, payload: item }));
    const results = await this.runAll(tasks);
    return results.map(r => r.result).reduce(reduceFn);
  }

  async monteCarloParallel(config, totalIterations = 10000) {
    const nWorkers = this.size;
    const iterationsPerWorker = Math.ceil(totalIterations / nWorkers);

    const tasks = [];
    for (let i = 0; i < nWorkers; i++) {
      tasks.push({
        action: 'montecarlo',
        payload: { ...config, iterations: iterationsPerWorker },
      });
    }

    const results = await this.runAll(tasks);

    const mergedOutcomes = {};
    let totalIters = 0;
    const allTrajectories = [];

    for (const { result } of results) {
      for (const [outcome, count] of Object.entries(result.outcomes || {})) {
        mergedOutcomes[outcome] = (mergedOutcomes[outcome] || 0) + count;
      }
      totalIters += result.iterations;
      allTrajectories.push(...(result.sampleTrajectories || []).slice(0, 2));
    }

    const probabilities = {};
    for (const [outcome, count] of Object.entries(mergedOutcomes)) {
      probabilities[outcome] = count / totalIters;
    }

    return {
      probabilities,
      iterations: totalIters,
      sampleTrajectories: allTrajectories.slice(0, 10),
      workersUsed: nWorkers,
    };
  }

  stats() {
    return {
      ...this._stats,
      poolSize: this.size,
      queueLength: this.queue.length,
      pendingTasks: this.pendingTasks.size,
      avgTaskTimeMs: this._stats.tasksCompleted > 0
        ? (this._stats.totalTimeMs / this._stats.tasksCompleted).toFixed(2)
        : 0,
      uptimeSeconds: ((Date.now() - this._stats.startedAt) / 1000).toFixed(1),
      workerStats: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        tasksDone: w.tasksDone,
      })),
    };
  }

  async terminate() {
    await Promise.all(this.workers.map(w => w.worker.terminate()));
    this.workers = [];
  }
}

let _poolInstance = null;

export function getWorkerPool(options = {}) {
  if (!_poolInstance) {
    _poolInstance = new WorkerPool(options);
  }
  return _poolInstance;
}

export function resetWorkerPool() {
  if (_poolInstance) {
    _poolInstance.terminate();
    _poolInstance = null;
  }
}

export { WorkerPool, N_CPUS, DEFAULT_POOL_SIZE };

export async function parallelMonteCarlo(config, totalIterations = 10000) {
  const pool = getWorkerPool();
  return pool.monteCarloParallel(config, totalIterations);
}

export async function parallelMatrixMultiply(matrices) {
  const pool = getWorkerPool();
  return pool.runAll(
    matrices.map(m => ({
      action: 'matrix_multiply',
      payload: { A: m.A, B: m.B },
    }))
  );
}
