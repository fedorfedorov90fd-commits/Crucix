// apis/predict/agent/planner.mjs
// Planner — высокоуровневый API планирования запроса оператора.
//
// Назначение:
//   Связывает AgentCore (LLM) + ToolRegistry (whitelist) + Executor (вызовы).
//   Оператор делает запрос на естественном языке — Planner строит план и
//   возвращает структурированное решение.
//
// Три режима работы:
//   1. plan-only — только план, без выполнения (для отладки).
//   2. plan-and-execute — план + запуск tools + сбор результатов.
//   3. full-pipeline — план + запуск + narrator (готовый ответ оператору).
//
// Safety:
//   - Whitelist tools через ToolRegistry.
//   - Sanitize args (типы, defaults).
//   - Timeout per tool (180 сек).
//   - Audit log каждого решения.
//   - Fallback на детерминированный planner если LLM недоступен.
//
// Версия: 8.0.0

import { AgentCore } from './agent_core.mjs';
import { ToolRegistry, loadHistory } from './tool_registry.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch { return fallback; }
}

// ═══════════════════════════════════════════════════
// PLANNER CLASS
// ═══════════════════════════════════════════════════

class Planner {
  constructor(config = {}) {
    this.registry = config.toolRegistry || new ToolRegistry();
    this.agent = new AgentCore({
      ollamaUrl: config.ollamaUrl,
      model: config.model,
      toolRegistry: this.registry,
      maxSteps: config.maxSteps || 8,
      auditLog: config.auditLog,
    });
    this.sessionDir = config.sessionDir || RUNS_AGENT;
    this.history = null; // ленивая загрузка
  }

  /**
   * Ленивая загрузка истории (один раз).
   */
  getHistory() {
    if (!this.history) this.history = loadHistory();
    return this.history;
  }

  /**
   * Проверка готовности: LLM + история + snapshot.
   */
  async check() {
    const llmAvailable = await this.agent.check();
    const history = this.getHistory();
    const snapshotExists = existsSync(
      join(__dirname, '..', '..', '..', 'runs', 'predictions', 'latest_forecast.json')
    );
    return {
      llmAvailable,
      historyLength: history.length,
      snapshotExists,
      toolsCount: this.registry.stats().total,
      ready: history.length >= 20,
    };
  }

  // ═══════════════════════════════════════════════════
  // РЕЖИМ 1: PLAN-ONLY
  // ═══════════════════════════════════════════════════

  /**
   * Только план, без выполнения. Полезно для отладки.
   *
   * @param {string} query — запрос оператора
   * @param {Object} options — { sessionId, maxTokens, temperature }
   * @returns {Object} — { sessionId, query, mode, reasoning, plan, elapsedMs }
   */
  async plan(query, options = {}) {
    const sessionId = options.sessionId || this.agent.sessionId;
    const t0 = Date.now();

    const planResult = await this.agent.plan(query, {
      sessionId,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    return {
      sessionId,
      query,
      mode: planResult.mode,
      reasoning: planResult.reasoning,
      plan: planResult.plan,
      rejected: planResult.rejected || [],
      llmAvailable: planResult.llmAvailable,
      llmError: planResult.llmError || null,
      llmStats: planResult.llmStats || null,
      elapsedMs: Date.now() - t0,
    };
  }

  // ═══════════════════════════════════════════════════
  // РЕЖИМ 2: PLAN-AND-EXECUTE
  // ═══════════════════════════════════════════════════

  /**
   * План + выполнение tools. Не включает narrator.
   *
   * @param {string} query
   * @param {Object} options — { sessionId, timeoutMs, maxTokens, temperature }
   * @returns {Object} — { sessionId, query, mode, reasoning, plan, executions, elapsedMs }
   */
  async planAndExecute(query, options = {}) {
    const sessionId = options.sessionId || this.agent.sessionId;
    const t0 = Date.now();

    // 1. План
    const planResult = await this.plan(query, options);
    const executions = [];

    // 2. Выполнение каждого шага
    const history = this.getHistory();
    for (const step of planResult.plan) {
      const exec = await this.registry.call(step.tool, step.args, {
        history,
        timeoutMs: options.timeoutMs || 180_000,
      });
      exec.reason = step.reason;
      executions.push(exec);

      // Если tool упал — продолжаем с остальными (graceful degradation)
      if (!exec.ok) {
        this.agent.audit.record({
          event: 'step_error',
          sessionId,
          tool: step.tool,
          error: exec.error,
        });
      }
    }

    return {
      sessionId,
      query,
      mode: planResult.mode,
      reasoning: planResult.reasoning,
      plan: planResult.plan,
      rejected: planResult.rejected,
      executions,
      llmStats: planResult.llmStats,
      elapsedMs: Date.now() - t0,
    };
  }

  // ═══════════════════════════════════════════════════
  // РЕЖИМ 3: FULL-PIPELINE (с narrator)
  // ═══════════════════════════════════════════════════

  /**
   * Полный цикл: план + выполнение + narrator.
   * Возвращает готовый ответ оператору.
   *
   * @param {string} query
   * @param {Object} options — { sessionId, narrator, ... }
   * @returns {Object} — { sessionId, query, mode, answer, plan, executions, elapsedMs }
   */
  async fullPipeline(query, options = {}) {
    const sessionId = options.sessionId || this.agent.sessionId;
    const t0 = Date.now();

    // 1. План + выполнение
    const execResult = await this.planAndExecute(query, options);

    // 2. Narrator (если передан)
    let answer = null;
    let narratorStats = null;
    if (typeof options.narrator === 'function') {
      try {
        const narrResult = await options.narrator({
          query,
          plan: execResult.plan,
          reasoning: execResult.reasoning,
          executions: execResult.executions,
          mode: execResult.mode,
        });
        if (typeof narrResult === 'string') {
          answer = narrResult;
        } else if (narrResult && typeof narrResult === 'object') {
          answer = narrResult.text || narrResult.answer || null;
          narratorStats = narrResult.stats || null;
        }
      } catch (e) {
        answer = `Narrator упал: ${e.message}`;
      }
    }

    // 3. Сохранить сессию
    const sessionData = {
      sessionId,
      query,
      mode: execResult.mode,
      reasoning: execResult.reasoning,
      plan: execResult.plan,
      rejected: execResult.rejected,
      executions: execResult.executions.map(e => ({
        tool: e.tool,
        args: e.args,
        ok: e.ok,
        elapsedMs: e.elapsedMs,
        error: e.error || null,
        // Не сохраняем весь result — только его top-level keys и size
        resultKeys: e.ok && e.result ? Object.keys(e.result) : null,
        resultSize: e.ok && e.result ? JSON.stringify(e.result).length : 0,
      })),
      answer,
      narratorStats,
      elapsedMs: Date.now() - t0,
      ts: new Date().toISOString(),
    };

    const sessionFile = join(this.sessionDir, `session_${sessionId}.json`);
    saveJSON(sessionFile, sessionData);

    return {
      sessionId,
      query,
      mode: execResult.mode,
      reasoning: execResult.reasoning,
      plan: execResult.plan,
      rejected: execResult.rejected,
      executions: execResult.executions,
      answer,
      narratorStats,
      sessionFile,
      elapsedMs: Date.now() - t0,
    };
  }

  // ═══════════════════════════════════════════════════
  // ИСТОРИЯ И МЕТРИКИ
  // ═══════════════════════════════════════════════════

  /**
   * История последних сессий.
   */
  listSessions(limit = 20) {
    try {
      const dir = this.sessionDir;
      if (!existsSync(dir)) return [];
      const fs = require('fs');
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('session_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);
      return files.map(f => {
        const data = loadJSON(join(dir, f), null);
        if (!data) return null;
        return {
          file: f,
          sessionId: data.sessionId,
          query: data.query,
          mode: data.mode,
          planSize: data.plan?.length || 0,
          okCount: (data.executions || []).filter(e => e.ok).length,
          errorCount: (data.executions || []).filter(e => !e.ok).length,
          elapsedMs: data.elapsedMs,
          ts: data.ts,
        };
      }).filter(Boolean);
    } catch { return []; }
  }

  /**
   * Статистика агента.
   */
  stats() {
    const registryStats = this.registry.stats();
    const sessions = this.listSessions(100);
    const totalSessions = sessions.length;
    const totalPlanSize = sessions.reduce((s, x) => s + x.planSize, 0);
    const totalExecutions = sessions.reduce((s, x) => s + (x.okCount + x.errorCount), 0);
    const totalErrors = sessions.reduce((s, x) => s + x.errorCount, 0);
    return {
      registry: registryStats,
      sessions: {
        total: totalSessions,
        totalPlanSteps: totalPlanSize,
        avgPlanSize: totalSessions > 0 ? Math.round(totalPlanSize / totalSessions * 10) / 10 : 0,
        totalExecutions,
        totalErrors,
        errorRate: totalExecutions > 0 ? Math.round(totalErrors / totalExecutions * 1000) / 1000 : 0,
      },
      historyLength: this.getHistory().length,
    };
  }

  /**
   * Audit log агента.
   */
  history(limit = 50) {
    return this.agent.history(limit);
  }
}

// ═══════════════════════════════════════════════════
// УДОБНЫЕ ФУНКЦИИ (stateless API)
// ═══════════════════════════════════════════════════

/**
 * Быстрый план без сохранения состояния.
 */
export async function planQuery(query, options = {}) {
  const planner = new Planner(options);
  return await planner.plan(query, options);
}

/**
 * Быстрый план-и-выполнение.
 */
export async function executeQuery(query, options = {}) {
  const planner = new Planner(options);
  return await planner.planAndExecute(query, options);
}

/**
 * Полный цикл.
 */
export async function runAgentPipeline(query, options = {}) {
  const planner = new Planner(options);
  return await planner.fullPipeline(query, options);
}

// ═══════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════

export { Planner };
