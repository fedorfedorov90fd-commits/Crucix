// apis/predict/engine_v7_patch.mjs
// Engine v7.0 Integration Patch
//
// Назначение:
//   Подключить Simulation Engine v7.0 к конвейеру engine.mjs как фазу U.
//
// Архитектура:
//   Фаза U (v7.0 simulation):
//     - World Model + Neural ODE + Dreamer + Continuous Causal
//     - Синтезатор: consensus, confidence, answers
//
// Принципы:
//   - Timeout 180 секунд (4 модуля последовательно = долго)
//   - Circuit breaker (3 падения → 5 запусков пропуска)
//   - Snapshot extension: snapshot.v7_extensions
//
// Версия: 1.0.0

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATCH_VERSION = '1.0.0';

// ═══════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════

class CircuitBreaker {
  constructor(threshold = 3, cooldown = 5) {
    this.threshold = threshold;
    this.cooldown = cooldown;
    this.failures = new Map();
  }

  canRun(moduleName) {
    const entry = this.failures.get(moduleName);
    if (!entry) return true;
    if (entry.circuitOpenUntil > 0) {
      entry.circuitOpenUntil--;
      return false;
    }
    return true;
  }

  recordFailure(moduleName) {
    const entry = this.failures.get(moduleName) || { count: 0, circuitOpenUntil: 0 };
    entry.count++;
    if (entry.count >= this.threshold) {
      entry.circuitOpenUntil = this.cooldown;
      entry.count = 0;
    }
    this.failures.set(moduleName, entry);
  }

  recordSuccess(moduleName) {
    this.failures.delete(moduleName);
  }

  getStatus(moduleName) {
    const entry = this.failures.get(moduleName);
    if (!entry) return { circuitOpen: false, failures: 0 };
    return { circuitOpen: entry.circuitOpenUntil > 0, failures: entry.count };
  }
}

const globalBreaker = new CircuitBreaker(3, 5);

// ═══════════════════════════════════════════════════
// TIMEOUT WRAPPER
// ═══════════════════════════════════════════════════

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label}: timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// ═══════════════════════════════════════════════════
// ФАЗА U — v7.0 SIMULATION
// ═══════════════════════════════════════════════════

/**
 * Запуск Simulation Engine v7.0.
 *
 * @param {Array} history — sweep'ы
 * @param {Object} options — { disabled, modules, horizon, interventions }
 * @returns {Object} — { ok, module, result, elapsedMs }
 */
export async function runV7Phase(history, options = {}) {
  const moduleName = 'simulation_engine_v7';

  if (!globalBreaker.canRun(moduleName)) {
    return {
      name: moduleName,
      ok: false,
      skipped: true,
      reason: 'circuit_open',
    };
  }

  if (!history || history.length < 30) {
    return {
      name: moduleName,
      ok: false,
      skipped: true,
      reason: 'insufficient_history',
      actual: history?.length ?? 0,
      minimumRequired: 30,
    };
  }

  const t0 = Date.now();
  const timeoutMs = options.timeoutMs || 180_000; // 3 минуты

  try {
    const mod = await import('./v7/simulation_engine.mjs');
    const fn = mod.crucixSimulationEngine;
    if (typeof fn !== 'function') {
      throw new Error('crucixSimulationEngine not exported from v7/simulation_engine.mjs');
    }

    // Параметры по умолчанию — компактные для production
    const engineOptions = {
      horizon: options.horizon || 12,
      interventions: options.interventions || null,
      modules: options.modules || {
        worldModel: { vaeEpochs: 3, rnnEpochs: 2, latentDim: 8, hiddenDim: 16 },
        neuralODE: { epochs: 3, hiddenDim: 16 },
        dreamer: { trainSteps: 10, horizon: 8 },
        continuousCausal: { epochs: 3, hiddenDim: 16 },
      },
      disabled: options.disabled || [],
    };

    const result = await withTimeout(
      fn(history, engineOptions),
      timeoutMs,
      moduleName
    );

    globalBreaker.recordSuccess(moduleName);

    return {
      name: moduleName,
      ok: true,
      elapsedMs: Date.now() - t0,
      result,
    };
  } catch (e) {
    globalBreaker.recordFailure(moduleName);
    return {
      name: moduleName,
      ok: false,
      error: e.message,
      elapsedMs: Date.now() - t0,
    };
  }
}

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИЯ В SNAPSHOT
// ═══════════════════════════════════════════════════

/**
 * Применение результата фазы U к snapshot engine.
 *
 * Добавляет:
 *   - snapshot.v7_extensions { version, elapsedMs, available, synthesis, answers }
 *   - Расширяет explanation.reasoning_steps
 *   - Расширяет summary
 */
export function applyV7ToSnapshot(snapshot, v7Phase) {
  if (!snapshot) return snapshot;

  const result = v7Phase?.result;

  snapshot.v7_extensions = {
    version: PATCH_VERSION,
    ok: v7Phase?.ok ?? false,
    elapsedMs: v7Phase?.elapsedMs ?? 0,
    skipped: v7Phase?.skipped ?? false,
    reason: v7Phase?.reason ?? null,
    error: v7Phase?.error ?? null,
  };

  if (!v7Phase?.ok || !result) {
    // Если v7 упал — просто фиксируем факт
    return snapshot;
  }

  // Основные данные
  snapshot.v7_extensions.available = result.available;
  snapshot.v7_extensions.version_internal = result.version;
  snapshot.v7_extensions.nSweeps = result.nSweeps;
  snapshot.v7_extensions.horizon = result.horizon;
  snapshot.v7_extensions.horizonHours = result.horizonHours;

  // Статус модулей внутри v7
  snapshot.v7_extensions.moduleStatus = result.moduleStatus;
  snapshot.v7_extensions.activeModules = result.activeModules;
  snapshot.v7_extensions.totalModules = result.totalModules;

  // Синтез
  snapshot.v7_extensions.synthesis = result.synthesis;

  // Ответы на вопросы
  snapshot.v7_extensions.answers = result.answers;

  // Интерпретация
  snapshot.v7_extensions.interpretation = result.interpretation;

  // Расширяем explanation
  if (!snapshot.explanation) snapshot.explanation = { reasoning_steps: [], summary: '' };
  if (!snapshot.explanation.reasoning_steps) snapshot.explanation.reasoning_steps = [];

  if (result.synthesis?.reasoningSteps) {
    for (const step of result.synthesis.reasoningSteps) {
      snapshot.explanation.reasoning_steps.push({
        module: `v7_${step.module}`,
        signal: step.signal,
        text: step.text,
        weight: step.weight,
      });
    }
  }

  // Расширяем summary
  if (result.synthesis) {
    snapshot.explanation.summary += ` Фаза U (v7.0): ${result.activeModules}/${result.totalModules} модулей, ` +
      `консенсус ${result.synthesis.consensus?.direction} (${Math.round((result.synthesis.consensus?.agreement ?? 0) * 100)}%), ` +
      `confidence ${result.synthesis.confidence} (${result.synthesis.confidenceLevel}).`;
  }

  return snapshot;
}

// ═══════════════════════════════════════════════════
// HEALTHCHECK
// ═══════════════════════════════════════════════════

export function healthcheck() {
  const v7Files = [
    'v7/world_model.mjs',
    'v7/neural_ode.mjs',
    'v7/dreamer.mjs',
    'v7/continuous_causal.mjs',
    'v7/simulation_engine.mjs',
  ];

  return {
    version: PATCH_VERSION,
    v7Files: v7Files.map(f => ({
      name: f,
      exists: existsSync(join(__dirname, f)),
    })),
    circuitStatus: globalBreaker.getStatus('simulation_engine_v7'),
  };
}

export { CircuitBreaker, PATCH_VERSION };
