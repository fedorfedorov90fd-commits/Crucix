// apis/predict/agent/agent_core.mjs
// Agent Core — LLM-планировщик над детерминированным ядром Crucix.
//
// Архитектурная позиция:
//   Agent НЕ переписывает engine.mjs и модули. Agent вызывает их
//   как API и планирует, что именно запускать под конкретный запрос.
//
// Три уровня системы:
//   1. Детерминированное ядро (engine.mjs + 45 модулей + 16 новых) — работает всегда.
//   2. Agent Core (этот файл) — LLM-планировщик, который читает snapshot,
//      выбирает модули, вызывает их, формирует ответ.
//   3. Chat UI (dashboard) — интерфейс оператора.
//
// Agent НЕ ходит в сеть напрямую и НЕ имеет доступа к файловой системе
// за пределами runs/agent/. Все вызовы — через явные tools с whitelist.
//
// LLM-бэкенды:
//   - Ollama (localhost:11434) — основная локальная модель (7B).
//   - Fallback: детерминированный планировщик без LLM.
//
// Теоретическая основа:
//   - Yao, S., et al. (2022). "ReAct: Synergizing Reasoning and Acting
//     in Language Models". ICLR 2023.
//   - Schick, T., et al. (2023). "Toolformer: Language Models Can Teach
//     Themselves to Use Tools". NeurIPS.
//   - Wang, L., et al. (2023). "Plan-and-Solve Prompting". ACL.
//
// Версия: 8.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = join(__dirname, '..', '..', '..', 'runs', 'agent');
const AUDIT_LOG = join(AGENT_DIR, 'audit.log');

// ═══════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════

const AGENT_VERSION = '8.0.0';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_STEPS = 8;

// System prompt — задаёт роль агента и правила
const SYSTEM_PROMPT = `Ты — прогностический AI-агент системы Crucix.

Твоя роль:
- Ты НЕ предсказываешь сам. У тебя есть 61 детерминированный модуль (модели, науки, методы).
- Твоя задача — выбрать ПРАВИЛЬНЫЕ модули под запрос оператора и объяснить их выводы.
- Ты вызываешь модули через tools. Каждый tool возвращает структурированный результат.

Правила:
1. НЕ выдумывай числа. Если нужно число — вызывай tool.
2. Если запрос требует counterfactual (что-если) — используй continuous_causal.
3. Если нужна симуляция будущего — используй simulation_engine или world_model.
4. Если нужно объяснение — используй explainability.
5. Если нужна политика действий — используй dreamer или causal_rl.
6. Если данных мало — скажи оператору прямо.
7. ВСЕГДА завершай ответ конкретной рекомендацией или ответом на вопрос.
8. Если не уверен — отражай confidence в ответе (high/moderate/low).

Формат твоего вывода:
- Сначала reasoning (какие модули и почему).
- Потом tool calls.
- Потом финальный ответ оператору.

Ты работаешь с локальной LLM. Отвечай на русском.`;

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

function shortHash(s) {
  return createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
}

function nowIso() {
  return new Date().toISOString();
}

// ═══════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════

class AuditLog {
  constructor(path = AUDIT_LOG) {
    this.path = path;
    ensureDir(dirname(path));
  }

  record(event) {
    const line = JSON.stringify({ ts: nowIso(), ...event }) + '\n';
    try { appendFileSync(this.path, line); } catch (e) { /* silent */ }
  }

  readRecent(limit = 50) {
    try {
      if (!existsSync(this.path)) return [];
      const lines = readFileSync(this.path, 'utf-8').trim().split('\n');
      return lines.slice(-limit).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }
}

// ═══════════════════════════════════════════════════
// OLLAMA CLIENT
// ═══════════════════════════════════════════════════

class OllamaClient {
  constructor(config = {}) {
    this.url = config.url || DEFAULT_OLLAMA_URL;
    this.model = config.model || DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.available = null;
  }

  async check() {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${this.url}/api/tags`, { signal: controller.signal });
      clearTimeout(t);
      this.available = resp.ok;
      return this.available;
    } catch {
      this.available = false;
      return false;
    }
  }

  async generate(prompt, options = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await fetch(`${this.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: options.model || this.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.2,
            num_predict: options.maxTokens || 1024,
          },
        }),
      });
      clearTimeout(t);
      if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
      const json = await resp.json();
      return {
        text: json.response || '',
        done: json.done ?? true,
        evalCount: json.eval_count ?? 0,
        totalDuration: json.total_duration ?? 0,
      };
    } catch (e) {
      clearTimeout(t);
      throw new Error(`Ollama generate failed: ${e.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════
// DETERMINISTIC FALLBACK PLANNER
// ═══════════════════════════════════════════════════
//
// Если Ollama недоступен — простой keyword-based планировщик.
// Он покрывает ~80% типичных запросов оператора.

class FallbackPlanner {
  constructor(toolRegistry) {
    this.registry = toolRegistry;
  }

  plan(query) {
    const q = query.toLowerCase();
    const plan = [];

    // Counterfactual / что-если
    if (q.includes('что если') || q.includes('что было бы') || q.includes('counterfactual')) {
      plan.push({ tool: 'continuous_causal', args: {}, reason: 'запрос counterfactual' });
    }

    // Симуляция / будущее
    if (q.includes('через') && (q.includes('час') || q.includes('дн'))) {
      plan.push({ tool: 'simulation_engine', args: { horizon: 12 }, reason: 'прогноз на время' });
    }

    // Аномалии
    if (q.includes('аномал') || q.includes('отклонени') || q.includes('странн')) {
      plan.push({ tool: 'anomaly_detection', args: {}, reason: 'поиск аномалий' });
    }

    // Политика / действие
    if (q.includes('действ') || q.includes('политик') || q.includes('что делать')) {
      plan.push({ tool: 'dreamer', args: {}, reason: 'оптимальная политика' });
    }

    // Причинность
    if (q.includes('причин') || q.includes('влияет') || q.includes('почему')) {
      plan.push({ tool: 'neural_causal_discovery', args: {}, reason: 'причинная структура' });
    }

    // Базовая сводка (если ничего не нашли)
    if (plan.length === 0) {
      plan.push({ tool: 'simulation_engine', args: { horizon: 8 }, reason: 'общая сводка' });
      plan.push({ tool: 'anomaly_detection', args: {}, reason: 'проверка аномалий' });
    }

    return {
      plan,
      reasoning: 'Fallback planner (без LLM): выбраны модули по ключевым словам',
      mode: 'fallback',
    };
  }
}

// ═══════════════════════════════════════════════════
// AGENT CORE
// ═══════════════════════════════════════════════════

class AgentCore {
  constructor(config = {}) {
    this.llm = new OllamaClient({
      url: config.ollamaUrl,
      model: config.model,
      timeoutMs: config.llmTimeoutMs,
    });
    this.registry = config.toolRegistry || null;
    this.fallback = this.registry ? new FallbackPlanner(this.registry) : null;
    this.audit = new AuditLog(config.auditLog);
    this.maxSteps = config.maxSteps || DEFAULT_MAX_STEPS;
    this.sessionId = shortHash(Date.now() + Math.random());
  }

  /**
   * Проверка доступности LLM.
   */
  async check() {
    return await this.llm.check();
  }

  /**
   * Собрать контекст: snapshot + последние answers.
   */
  buildContext(options = {}) {
    const snapshot = options.snapshot || loadJSON(
      join(__dirname, '..', '..', '..', 'runs', 'predictions', 'latest_forecast.json'),
      null
    );

    const context = {
      hasSnapshot: !!snapshot,
      timestamp: snapshot?.timestamp || null,
      topRisks: snapshot?.topRisks || [],
      v6Summary: snapshot?.v6_extensions ? {
        okCount: snapshot.v6_extensions.okCount,
        totalModules: snapshot.v6_extensions.totalModules,
      } : null,
      catalogSummary: snapshot?.catalog_extensions ? {
        okCount: snapshot.catalog_extensions.okCount,
        totalModules: snapshot.catalog_extensions.totalModules,
      } : null,
      v7Summary: snapshot?.v7_extensions ? {
        activeModules: snapshot.v7_extensions.activeModules,
        totalModules: snapshot.v7_extensions.totalModules,
        consensus: snapshot.v7_extensions.synthesis?.consensus,
        confidence: snapshot.v7_extensions.synthesis?.confidence,
      } : null,
      explanation: snapshot?.explanation?.summary || null,
    };

    return { snapshot, context };
  }

  /**
   * Сформировать prompt для LLM.
   */
  buildPrompt(query, context, availableTools) {
    const toolsList = availableTools.map(t => {
      return `- ${t.name}: ${t.description}\n  args: ${JSON.stringify(t.argsSchema || {})}`;
    }).join('\n');

    const contextStr = context.hasSnapshot
      ? `Текущее состояние системы:
- Timestamp: ${context.timestamp}
- Top risks: ${context.topRisks.slice(0, 3).map(r => `${r.name} (${(r.probability * 100).toFixed(1)}%)`).join(', ') || 'нет'}
- v6.0: ${context.v6Summary?.okCount || 0}/${context.v6Summary?.totalModules || 0} модулей OK
- Каталог: ${context.catalogSummary?.okCount || 0}/${context.catalogSummary?.totalModules || 0} модулей OK
- v7.0: ${context.v7Summary?.activeModules || 0}/${context.v7Summary?.totalModules || 0} активны
- Консенсус v7: ${context.v7Summary?.consensus?.direction || 'неизвестно'} (agreement=${context.v7Summary?.consensus?.agreement || 0})
- Confidence v7: ${context.v7Summary?.confidence || 0}
- Сводка: ${context.explanation || 'нет'}`
      : 'Snapshot отсутствует. Система не запускалась.';

    return `${SYSTEM_PROMPT}

${contextStr}

Доступные tools:
${toolsList}

Запрос оператора: ${query}

Твой план (в формате JSON, одним блоком):
{
  "reasoning": "краткое объяснение почему выбраны эти tools",
  "plan": [
    { "tool": "имя_модуля", "args": { ... }, "reason": "зачем" },
    ...
  ]
}

Отвечай ТОЛЬКО JSON. Максимум ${this.maxSteps} steps.`;
  }

  /**
   * Распарсить ответ LLM в план.
   * LLM может вернуть markdown-обёртку (```json ... ```) — чистим.
   */
  parsePlan(text) {
    if (!text) return null;

    // Убираем markdown code fences
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Ищем JSON-блок
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.plan || !Array.isArray(parsed.plan)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Основной метод: принять запрос, вернуть план.
   */
  async plan(query, options = {}) {
    const t0 = Date.now();
    const { snapshot, context } = this.buildContext(options);

    const toolsList = this.registry ? this.registry.listAll() : [];
    if (toolsList.length === 0) {
      return {
        mode: 'error',
        error: 'Tool registry пуст',
        plan: [],
        elapsedMs: Date.now() - t0,
      };
    }

    const sessionId = options.sessionId || this.sessionId;
    this.audit.record({
      event: 'plan_start',
      sessionId,
      query: query.slice(0, 200),
      hasSnapshot: context.hasSnapshot,
      toolsAvailable: toolsList.length,
    });

    // Проверяем LLM
    const llmAvailable = await this.check();
    if (!llmAvailable) {
      this.audit.record({ event: 'llm_unavailable', sessionId });
      const fbPlan = this.fallback.plan(query);
      return {
        mode: 'fallback',
        reasoning: fbPlan.reasoning,
        plan: fbPlan.plan,
        llmAvailable: false,
        elapsedMs: Date.now() - t0,
      };
    }

    // Формируем prompt и спрашиваем LLM
    const prompt = this.buildPrompt(query, context, toolsList);

    let llmResult;
    try {
      llmResult = await this.llm.generate(prompt, {
        maxTokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.2,
      });
    } catch (e) {
      this.audit.record({
        event: 'llm_error',
        sessionId,
        error: e.message,
      });
      const fbPlan = this.fallback.plan(query);
      return {
        mode: 'fallback',
        reasoning: `LLM ошибка: ${e.message}. Fallback: ${fbPlan.reasoning}`,
        plan: fbPlan.plan,
        llmAvailable: true,
        llmError: e.message,
        elapsedMs: Date.now() - t0,
      };
    }

    // Парсим план
    const parsed = this.parsePlan(llmResult.text);
    if (!parsed) {
      this.audit.record({
        event: 'plan_parse_failed',
        sessionId,
        rawText: llmResult.text.slice(0, 500),
      });
      const fbPlan = this.fallback.plan(query);
      return {
        mode: 'fallback',
        reasoning: 'Не удалось распарсить ответ LLM. Fallback.',
        plan: fbPlan.plan,
        llmAvailable: true,
        rawLLMText: llmResult.text.slice(0, 500),
        elapsedMs: Date.now() - t0,
      };
    }

    // Валидация плана через registry (whitelist)
    const validatedPlan = [];
    const rejected = [];
    for (const step of parsed.plan.slice(0, this.maxSteps)) {
      if (!this.registry.has(step.tool)) {
        rejected.push({ tool: step.tool, reason: 'unknown_tool' });
        continue;
      }
      validatedPlan.push({
        tool: step.tool,
        args: this.registry.sanitizeArgs(step.tool, step.args || {}),
        reason: step.reason || '',
      });
    }

    this.audit.record({
      event: 'plan_success',
      sessionId,
      planSize: validatedPlan.length,
      rejectedCount: rejected.length,
      toolsUsed: validatedPlan.map(s => s.tool),
    });

    return {
      mode: 'llm',
      reasoning: parsed.reasoning || '',
      plan: validatedPlan,
      rejected,
      llmAvailable: true,
      llmStats: {
        evalCount: llmResult.evalCount,
        duration: llmResult.totalDuration,
      },
      elapsedMs: Date.now() - t0,
    };
  }

  /**
   * История решений (audit log).
   */
  history(limit = 20) {
    return this.audit.readRecent(limit);
  }

  /**
   * Сохранить результат сессии.
   */
  saveSession(data) {
    const sessionId = data.sessionId || this.sessionId;
    const fp = join(AGENT_DIR, `session_${sessionId}.json`);
    saveJSON(fp, data);
    return fp;
  }
}

// ═══════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════

export {
  AgentCore,
  OllamaClient,
  AuditLog,
  FallbackPlanner,
  SYSTEM_PROMPT,
  AGENT_VERSION,
};
