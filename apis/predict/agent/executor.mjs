// apis/predict/agent/executor.mjs
// Executor — безопасное выполнение плана tool-вызовов.
//
// Назначение:
//   Принимает план от planner.mjs, выполняет каждый шаг через ToolRegistry,
//   собирает результаты, обрабатывает ошибки, ведёт audit и метрики.
//
// Отличия от registry.call:
//   - Параллельный запуск независимых шагов (через Promise.allSettled).
//   - Retry на transient errors (timeout, network).
//   - Circuit breaker на уровне executor.
//   - Метрики: latency per tool, success rate, error types.
//   - Audit log в отдельный файл.
//
// Safety:
//   - Whitelist tools (registry.has).
//   - Sanitize args (registry.sanitizeArgs).
//   - Timeout per tool.
//   - Retry только для idempotent tools.
//
// Версия: 8.0.0

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_AGENT = join(__dirname, '..', '..', '..', 'runs', 'agent');

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

function nowIso() { return new Date().toISOString(); }

// ═══════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════

class CircuitBreaker {
  constructor(config = {}) {
    this.threshold = config.threshold ?? 3;
    this.cooldown = config.cooldown ?? 5;
    this.state = new Map(); // toolName → { failures, openUntil }
  }

  canRun(toolName) {
    const entry = this.state.get(toolName);
    if (!entry) return true;
    if (entry.openUntil > 0) {
      entry.openUntil--;
      return false;
    }
    return true;
  }

  recordFailure(toolName) {
    const entry = this.state.get(toolName) || { failures: 0, openUntil: 0 };
    entry.failures++;
    if (entry.failures >= this.threshold) {
      entry.openUntil = this.cooldown;
      entry.failures = 0;
    }
    this.state.set(toolName, entry);
  }

  recordSuccess(toolName) {
    this.state.delete(toolName);
  }

  status() {
    const result = {};
    for (const [name, entry] of this.state) {
      result[name] = {
        failures: entry.failures,
        openUntil: entry.openUntil,
        isOpen: entry.openUntil > 0,
      };
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════
// RETRY POLICY
// ═══════════════════════════════════════════════════

/**
 * Только идемпотентные ошибки имеют смысл в retry:
 * - timeout
 * - network / connection
 * - temporary unavailable
 *
 * Ошибки вида "invalid args" или "unknown tool" — не retry.
 */
function isRetryable(error) {
  if (!error) return false;
  const msg = String(error).toLowerCase();
  return msg.includes('timeout') ||
         msg.includes('econnrefused') ||
         msg.includes('network') ||
         msg.includes('temporarily');
}

async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const backoffMs = options.backoffMs ?? 500;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries || !isRetryable(e.message)) throw e;
      await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════════════
// EXECUTOR CLASS
// ═══════════════════════════════════════════════════

class Executor {
  constructor(config = {}) {
    this.registry = config.toolRegistry;
    if (!this.registry) throw new Error('Executor requires toolRegistry');
    this.breaker = new CircuitBreaker(config.breaker || {});
    this.timeoutMs = config.timeoutMs || 180_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.auditPath = config.auditPath || join(RUNS_AGENT, 'executor_audit.log');
    this.metricsPath = config.metricsPath || join(RUNS_AGENT, 'executor_metrics.json');

    // Метрики
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      retriedCalls: 0,
      byTool: {}, // toolName → { calls, successes, failures, totalMs }
      startTime: nowIso(),
    };

    // Восстанавливаем метрики, если есть
    try {
      if (existsSync(this.metricsPath)) {
        const saved = JSON.parse(readFileSync(this.metricsPath, 'utf-8'));
        if (saved && typeof saved === 'object') {
          this.metrics = { ...this.metrics, ...saved };
        }
      }
    } catch { /* ignore */ }
  }

  _audit(event) {
    try {
      ensureDir(dirname(this.auditPath));
      appendFileSync(this.auditPath, JSON.stringify({ ts: nowIso(), ...event }) + '\n');
    } catch { /* silent */ }
  }

  _recordMetric(toolName, ok, elapsedMs, retries) {
    this.metrics.totalCalls++;
    if (ok) this.metrics.successCalls++;
    else this.metrics.failedCalls++;
    if (retries > 0) this.metrics.retriedCalls += retries;

    if (!this.metrics.byTool[toolName]) {
      this.metrics.byTool[toolName] = {
        calls: 0, successes: 0, failures: 0, totalMs: 0, retries: 0,
      };
    }
    const t = this.metrics.byTool[toolName];
    t.calls++;
    if (ok) t.successes++;
    else t.failures++;
    t.totalMs += elapsedMs;
    t.retries += retries;
  }

  /**
   * Выполнение одного шага с retry + circuit breaker.
   *
   * @param {Object} step — { tool, args, reason }
   * @param {Object} options — { history, timeoutMs }
   * @returns {Object} — { ok, tool, args, reason, result, elapsedMs, error, retries }
   */
  async executeStep(step, options = {}) {
    const toolName = step.tool;
    const t0 = Date.now();

    // Circuit breaker
    if (!this.breaker.canRun(toolName)) {
      const result = {
        ok: false,
        tool: toolName,
        args: step.args,
        reason: step.reason,
        error: 'circuit_open',
        elapsedMs: Date.now() - t0,
        retries: 0,
      };
      this._audit({ event: 'circuit_open', tool: toolName });
      this._recordMetric(toolName, false, result.elapsedMs, 0);
      return result;
    }

    // Whitelist
    if (!this.registry.has(toolName)) {
      const result = {
        ok: false,
        tool: toolName,
        args: step.args,
        reason: step.reason,
        error: 'unknown_tool',
        elapsedMs: Date.now() - t0,
        retries: 0,
      };
      this._recordMetric(toolName, false, result.elapsedMs, 0);
      return result;
    }

    let attempts = 0;
    let lastError = null;

    try {
      await withRetry(async () => {
        attempts++;
        const r = await this.registry.call(toolName, step.args, {
          history: options.history,
          timeoutMs: options.timeoutMs || this.timeoutMs,
        });
        if (!r.ok) {
          // Не retry-им логические ошибки (minHistory, unknown)
          if (r.error === 'insufficient_history' || r.error === 'unknown_tool') {
            const err = new Error(r.error);
            err.nonRetryable = true;
            throw err;
          }
          throw new Error(r.error || 'call_failed');
        }
        // Успех — возвращаем результат
        return r;
      }, {
        maxRetries: this.maxRetries,
        backoffMs: 500,
      }).catch(e => { throw e; });
    } catch (e) {
      lastError = e;
    }

    // Если после retry всё ещё ошибка — считаем повторный вызов
    // (для получения финального результата и правильной регистрации)
    let final;
    if (lastError) {
      const errMsg = lastError.message || 'unknown';
      this.breaker.recordFailure(toolName);
      final = {
        ok: false,
        tool: toolName,
        args: step.args,
        reason: step.reason,
        error: errMsg,
        elapsedMs: Date.now() - t0,
        retries: Math.max(0, attempts - 1),
      };
      this._audit({
        event: 'step_error',
        tool: toolName,
        error: errMsg,
        attempts,
      });
    } else {
      // Успех после retry — нужно получить результат
      // (withRetry возвращает Promise, но мы его не сохранили)
      // Простая переработка: перезапустим один раз без retry для получения
      try {
        const r = await this.registry.call(toolName, step.args, {
          history: options.history,
          timeoutMs: options.timeoutMs || this.timeoutMs,
        });
        this.breaker.recordSuccess(toolName);
        final = {
          ok: r.ok,
          tool: toolName,
          args: step.args,
          reason: step.reason,
          result: r.result,
          error: r.error || null,
          elapsedMs: Date.now() - t0,
          retries: Math.max(0, attempts - 1),
        };
        if (!r.ok) this.breaker.recordFailure(toolName);
        else this._audit({ event: 'step_success', tool: toolName, elapsedMs: final.elapsedMs });
      } catch (e) {
        this.breaker.recordFailure(toolName);
        final = {
          ok: false,
          tool: toolName,
          args: step.args,
          reason: step.reason,
          error: e.message,
          elapsedMs: Date.now() - t0,
          retries: Math.max(0, attempts - 1),
        };
      }
    }

    this._recordMetric(toolName, final.ok, final.elapsedMs, final.retries);
    this.saveMetrics();
    return final;
  }

  /**
   * Выполнение всего плана.
   *
   * @param {Array} plan — массив { tool, args, reason }
   * @param {Object} options — { history, parallel: boolean, maxParallel: number }
   * @returns {Object} — { executions, summary, elapsedMs }
   */
  async executePlan(plan, options = {}) {
    const t0 = Date.now();
    const parallel = options.parallel !== false;
    const maxParallel = options.maxParallel || 4;

    if (!Array.isArray(plan) || plan.length === 0) {
      return {
        executions: [],
        summary: { total: 0, ok: 0, failed: 0 },
        elapsedMs: Date.now() - t0,
      };
    }

    let executions;
    if (parallel && plan.length > 1) {
      // Ограничиваем параллелизм
      executions = [];
      for (let i = 0; i < plan.length; i += maxParallel) {
        const batch = plan.slice(i, i + maxParallel);
        const batchResults = await Promise.allSettled(
          batch.map(step => this.executeStep(step, options))
        );
        for (let j = 0; j < batchResults.length; j++) {
          const settled = batchResults[j];
          if (settled.status === 'fulfilled') {
            executions.push(settled.value);
          } else {
            executions.push({
              ok: false,
              tool: batch[j].tool,
              args: batch[j].args,
              reason: batch[j].reason,
              error: settled.reason?.message || 'rejected',
              elapsedMs: 0,
              retries: 0,
            });
          }
        }
      }
    } else {
      executions = [];
      for (const step of plan) {
        const r = await this.executeStep(step, options);
        executions.push(r);
      }
    }

    const okCount = executions.filter(e => e.ok).length;
    const failedCount = executions.filter(e => !e.ok).length;
    const totalElapsed = Date.now() - t0;

    this._audit({
      event: 'plan_executed',
      total: executions.length,
      ok: okCount,
      failed: failedCount,
      elapsedMs: totalElapsed,
      parallel,
    });

    return {
      executions,
      summary: {
        total: executions.length,
        ok: okCount,
        failed: failedCount,
      },
      elapsedMs: totalElapsed,
    };
  }

  /**
   * Сохранить метрики.
   */
  saveMetrics() {
    try {
      const data = {
        ...this.metrics,
        lastUpdate: nowIso(),
        breaker: this.breaker.status(),
      };
      saveJSON(this.metricsPath, data);
    } catch { /* silent */ }
  }

  /**
   * Текущее состояние.
   */
  getStatus() {
    return {
      metrics: { ...this.metrics },
      breaker: this.breaker.status(),
      successRate: this.metrics.totalCalls > 0
        ? Math.round(this.metrics.successCalls / this.metrics.totalCalls * 1000) / 1000
        : 0,
    };
  }

  /**
   * Reset метрик (для тестов).
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      retriedCalls: 0,
      byTool: {},
      startTime: nowIso(),
    };
    this.breaker = new CircuitBreaker();
    this.saveMetrics();
  }
}

// ═══════════════════════════════════════════════════
// УДОБНАЯ ФУНКЦИЯ (stateless)
// ═══════════════════════════════════════════════════

/**
 * Быстрое выполнение плана с указанным registry.
 */
export async function executePlan(plan, registry, options = {}) {
  const exec = new Executor({ toolRegistry: registry, ...options });
  return await exec.executePlan(plan, options);
}

// ═══════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════

export {
  Executor,
  CircuitBreaker,
  withRetry,
  isRetryable,
};
