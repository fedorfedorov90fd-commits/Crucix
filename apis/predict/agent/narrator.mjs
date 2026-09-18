// apis/predict/agent/narrator.mjs
// Narrator — формирование ответа оператору на естественном языке.
//
// Назначение:
//   Принимает результаты tool-вызовов и формирует структурированный
//   человеко-читаемый ответ. Два режима:
//     1. LLM-режим: LLM получает результаты и формулирует ответ.
//     2. Template-режим: детерминированные шаблоны по типу tool.
//
// Narrator умеет:
//   - Извлекать ключевые сигналы из результатов.
//   - Определять confidence (high/moderate/low).
//   - Объяснять причинно-следственные связи.
//   - Формировать структурированный ответ (summary + details + рекомендация).
//
// Выход:
//   { text, sections, confidence, sources, recommendation, metrics }
//
// Версия: 8.0.0

import { OllamaClient } from './agent_core.mjs';

// ═══════════════════════════════════════════════════
// NARRATOR PROMPT
// ═══════════════════════════════════════════════════

const NARRATOR_SYSTEM = `Ты — аналитик Crucix. Твоя задача — сформулировать ответ оператору
на основе результатов работы прогностических модулей.

Правила:
1. НЕ выдумывай числа. Используй ТОЛЬКО те данные, что в tool_results.
2. Если tool упал (ok=false) — упомяни это кратко, не делай вид что данные есть.
3. Если модули согласны — отражай confidence как high.
4. Если модули противоречат — confidence moderate или low, объясни разногласие.
5. Обязательно в конце дай конкретную рекомендацию (что делать / на что смотреть).
6. Отвечай структурированно: краткий вывод, затем детали, затем рекомендация.
7. Не пиши длинных абзацев. Максимум 200 слов.
8. Отвечай на русском.`;

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function isFiniteNum(x) { return typeof x === 'number' && Number.isFinite(x); }

function safeStr(x, max = 200) {
  if (x === null || x === undefined) return '';
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ═══════════════════════════════════════════════════
// ИЗВЛЕЧЕНИЕ СИГНАЛОВ ИЗ РЕЗУЛЬТАТОВ
// ═══════════════════════════════════════════════════

/**
 * Извлечение ключевых сигналов из результата tool.
 * Возвращает { signals: [...], summary: string, confidence: 'high'|'moderate'|'low' }
 */
function extractSignals(toolName, result) {
  if (!result || typeof result !== 'object') {
    return { signals: [], summary: 'Нет данных', confidence: 'low' };
  }

  const signals = [];
  let confidence = 'moderate';

  switch (toolName) {

    // ═══ V6.0 ═══
    case 'neural_causal_discovery': {
      signals.push(`Обнаружено ${result.nEdges || 0} причинных связей`);
      signals.push(`Ацикличен: ${result.isAcyclic ? 'да' : 'нет'}`);
      if (result.discoveredEdges?.length) {
        const top = result.discoveredEdges[0];
        signals.push(`Сильнейшая: ${top.from}→${top.to} (w=${top.weight?.toFixed(3)})`);
      }
      confidence = result.nEdges >= 3 ? 'moderate' : 'low';
      break;
    }

    case 'continual_learning': {
      signals.push(`Loss: ${result.lossBefore} → ${result.lossAfter}`);
      signals.push(`Forgetting delta: ${result.forgettingDelta ?? 'N/A'}`);
      if (result.prediction) signals.push(`Предсказание: ${result.prediction.class}`);
      confidence = Math.abs(result.forgettingDelta || 0) < 0.1 ? 'moderate' : 'low';
      break;
    }

    case 'causal_rl': {
      signals.push(`Reward: ${result.training?.avgReward}`);
      signals.push(`Улучшение vs random: ${result.evaluation?.improvementPct}%`);
      signals.push(`Рекомендация: ${result.recommendedAction}`);
      confidence = (result.evaluation?.improvementPct || 0) > 5 ? 'moderate' : 'low';
      break;
    }

    case 'quantum_hypergraph': {
      signals.push(`Гиперрёбер: ${result.hypergraph?.nHyperedges || 0}`);
      signals.push(`Ацикличен: ${result.hypergraph?.isAcyclic ? 'да' : 'нет'}`);
      confidence = (result.hypergraph?.nHyperedges || 0) > 2 ? 'moderate' : 'low';
      break;
    }

    case 'zk_federated': {
      signals.push(`Узлов: ${result.nNodes}, раундов: ${result.rounds}`);
      signals.push(`Loss: ${result.training?.initialLoss} → ${result.training?.finalLoss}`);
      signals.push(`Privacy spent: ${result.privacy?.privacySpent}`);
      confidence = 'moderate';
      break;
    }

    // ═══ CATALOG ═══
    case 'mcmc': {
      if (result.changePoint) {
        signals.push(`Change point P=${result.changePoint.probability}`);
      }
      if (result.hierarchicalBetaBinomial?.topRiskyRegions?.[0]) {
        const top = result.hierarchicalBetaBinomial.topRiskyRegions[0];
        signals.push(`Топ-риск: ${top.id} (posterior=${top.posteriorMean})`);
      }
      confidence = 'moderate';
      break;
    }

    case 'physics_inspired': {
      signals.push(`SOC: ${result.soc?.criticality?.regime || 'N/A'}`);
      signals.push(`Percolation: ${result.percolation?.regime || 'N/A'}`);
      signals.push(`Catastrophe: ${result.catastrophe?.regime || 'N/A'}`);
      if (result.catastrophe?.bistable) signals.push('⚠ Бистабильность');
      confidence = result.catastrophe?.regime === 'bistable' ? 'high' : 'moderate';
      break;
    }

    case 'automl': {
      signals.push(`Лучшая модель: ${result.bestModel}`);
      signals.push(`Score: ${result.bestScore?.toFixed(6)}`);
      confidence = 'moderate';
      break;
    }

    case 'anomaly_detection': {
      signals.push(`Аномалий: ${result.summary?.nAnomalies || 0} (${(result.summary?.anomalyRate * 100)?.toFixed(1)}%)`);
      signals.push(`Последний sweep: ${result.lastSweep?.isAnomaly ? 'АНОМАЛЕН' : 'нормален'} (${result.lastSweep?.votes}/5)`);
      if (result.explanation?.topDeviations?.length) {
        const d = result.explanation.topDeviations[0];
        signals.push(`Отклонение: ${d.feature} (z=${d.zScore})`);
      }
      confidence = result.lastSweep?.isAnomaly ? 'high' : 'moderate';
      break;
    }

    case 'graph_sage': {
      signals.push(`Узлов: ${result.nNodes || 0}, рёбер: ${result.nEdges || 0}`);
      confidence = 'moderate';
      break;
    }

    case 'actor_critic': {
      signals.push(`Policy improvement: ${result.improvement}`);
      confidence = 'moderate';
      break;
    }

    // ═══ V7.0 ═══
    case 'world_model': {
      signals.push(`Recon error: ${result.quality?.avgReconError} (${result.quality?.reconQuality})`);
      if (result.imagination?.trend?.tension) {
        signals.push(`Tension trend: ${result.imagination.trend.tension.delta}`);
      }
      signals.push(`Direction: ${result.direction}`);
      confidence = result.direction && result.quality?.reconQuality !== 'poor' ? 'moderate' : 'low';
      break;
    }

    case 'neural_ode': {
      signals.push(`Direction: ${result.forecast?.direction}`);
      signals.push(`Initial rate: ${result.forecast?.initialRate}`);
      if (result.counterfactual) {
        signals.push(`Counterfactual magnitude: ${result.counterfactual.diffMagnitude}`);
      }
      confidence = 'moderate';
      break;
    }

    case 'dreamer': {
      signals.push(`Best action: ${result.bestAction?.name}`);
      signals.push(`Return: ${result.finalRollout?.totalReturn}`);
      signals.push(`Improvement: ${result.evaluation?.improvementPct}%`);
      confidence = (result.evaluation?.improvementPct || 0) > 0 ? 'moderate' : 'low';
      break;
    }

    case 'continuous_causal': {
      if (result.ate?.perVar) {
        const effects = Object.entries(result.ate.perVar)
          .filter(([name]) => name !== Object.keys(result.ate.intervention)[0])
          .map(([name, d]) => `${name}: ${d.ate}`)
          .join(', ');
        signals.push(`ATE: ${effects}`);
      }
      signals.push(`DAG рёбер: ${result.dag?.nEdges}`);
      confidence = 'moderate';
      break;
    }

    case 'simulation_engine': {
      signals.push(`Модулей активно: ${result.activeModules}/${result.totalModules}`);
      signals.push(`Консенсус: ${result.synthesis?.consensus?.direction} (${Math.round((result.synthesis?.consensus?.agreement || 0) * 100)}%)`);
      signals.push(`Confidence: ${result.synthesis?.confidence} (${result.synthesis?.confidenceLevel})`);
      confidence = result.synthesis?.confidenceLevel || 'low';
      break;
    }

    // ═══ BASE ═══
    case 'engine_full': {
      signals.push(`Top risk: ${result.topRisks?.[0]?.name || 'N/A'}`);
      confidence = 'moderate';
      break;
    }

    case 'regime_shift': {
      signals.push(`Regime shift: ${result.regimeShiftDetected ? 'ДА' : 'нет'}`);
      confidence = result.regimeShiftDetected ? 'high' : 'moderate';
      break;
    }

    default:
      signals.push('Результат получен');
      confidence = 'moderate';
  }

  return {
    signals,
    summary: signals.join('. '),
    confidence,
  };
}

/**
 * Агрегация confidence из нескольких tools.
 */
function aggregateConfidence(confidences) {
  if (confidences.length === 0) return 'low';
  const weights = { high: 3, moderate: 2, low: 1 };
  const sum = confidences.reduce((s, c) => s + (weights[c] || 1), 0);
  const avg = sum / confidences.length;
  if (avg >= 2.7) return 'high';
  if (avg >= 1.7) return 'moderate';
  return 'low';
}

// ═══════════════════════════════════════════════════
// TEMPLATE-BASED NARRATOR
// ═══════════════════════════════════════════════════

/**
 * Сборка ответа по шаблонам без LLM.
 * Работает всегда, даже если LLM недоступен.
 */
function templateNarrate(query, plan, executions) {
  const sections = [];

  // Заголовок
  sections.push(`Запрос: ${query}`);

  // План
  if (plan.length > 0) {
    sections.push('');
    sections.push(`Выбранные модули (${plan.length}):`);
    for (const step of plan) {
      sections.push(`  • ${step.tool} — ${step.reason || 'анализ'}`);
    }
  }

  // Результаты
  const successful = executions.filter(e => e.ok);
  const failed = executions.filter(e => !e.ok);
  const allConfidences = [];
  const allSignals = [];

  if (successful.length > 0) {
    sections.push('');
    sections.push(`Результаты (${successful.length}/${executions.length} модулей):`);

    for (const exec of successful) {
      const { signals, confidence } = extractSignals(exec.tool, exec.result);
      allConfidences.push(confidence);
      allSignals.push({ tool: exec.tool, signals, confidence });

      sections.push('');
      sections.push(`[${exec.tool}] confidence=${confidence}`);
      for (const s of signals) sections.push(`  ${s}`);
    }
  }

  if (failed.length > 0) {
    sections.push('');
    sections.push(`Упавшие модули (${failed.length}):`);
    for (const exec of failed) {
      sections.push(`  ✗ ${exec.tool}: ${exec.error || 'unknown error'}`);
    }
  }

  // Итоговая рекомендация
  const aggregate = aggregateConfidence(allConfidences);
  sections.push('');
  sections.push(`Итоговый confidence: ${aggregate}`);

  let recommendation = 'Продолжить мониторинг.';
  if (allSignals.some(s => s.tool === 'anomaly_detection' && s.signals.some(x => x.includes('АНОМАЛЕН')))) {
    recommendation = '⚠ Обнаружена аномалия — углубить анализ через continuous_causal + neural_ode.';
  } else if (allSignals.some(s => s.tool === 'simulation_engine' && s.signals.some(x => x.includes('escalation')))) {
    recommendation = '⚠ Тренд эскалации — рекомендуется action analysis через dreamer.';
  } else if (allSignals.some(s => s.tool === 'physics_inspired' && s.signals.some(x => x.includes('Бистабильность')))) {
    recommendation = '⚠ Система в бистабильном режиме — риск скачка. Углубить через mcmc change-point.';
  } else if (aggregate === 'high') {
    recommendation = 'Данные согласованы, прогноз устойчив.';
  } else if (aggregate === 'low') {
    recommendation = 'Низкая уверенность — рекомендуется запросить дополнительные модули.';
  }

  sections.push('');
  sections.push(`Рекомендация: ${recommendation}`);

  return {
    text: sections.join('\n'),
    sections,
    confidence: aggregate,
    recommendation,
    signals: allSignals,
  };
}

// ═══════════════════════════════════════════════════
// LLM-BASED NARRATOR
// ═══════════════════════════════════════════════════

function buildLLMPrompt(query, plan, executions) {
  const successful = executions.filter(e => e.ok);
  const failed = executions.filter(e => !e.ok);

  let context = `Запрос оператора: ${query}\n\n`;

  context += `План (${plan.length} шагов):\n`;
  for (const step of plan) {
    context += `- ${step.tool}: ${step.reason || 'анализ'}\n`;
  }
  context += '\n';

  context += `Результаты (${successful.length} успешных, ${failed.length} упавших):\n\n`;

  for (const exec of successful) {
    context += `[${exec.tool}]\n`;
    // Компактно передаём результат — только ключевые поля
    const compact = JSON.stringify(exec.result, (k, v) => {
      if (typeof v === 'string' && v.length > 300) return v.slice(0, 300) + '...';
      if (Array.isArray(v) && v.length > 10) return v.slice(0, 10).concat(['...']);
      return v;
    }).slice(0, 2000);
    context += `  ${compact}\n\n`;
  }

  if (failed.length > 0) {
    context += `Упавшие модули:\n`;
    for (const exec of failed) {
      context += `- ${exec.tool}: ${exec.error}\n`;
    }
  }

  context += `\nСформулируй ответ оператору (максимум 200 слов). ` +
    `Структура: краткий вывод → детали по модулям → рекомендация. ` +
    `Отрази confidence (high/moderate/low).`;

  return context;
}

async function llmNarrate(query, plan, executions, options = {}) {
  const llm = new OllamaClient({
    url: options.ollamaUrl,
    model: options.model,
    timeoutMs: options.llmTimeoutMs || 30_000,
  });

  const available = await llm.check();
  if (!available) {
    return { text: null, error: 'llm_unavailable', fallback: true };
  }

  const prompt = NARRATOR_SYSTEM + '\n\n' + buildLLMPrompt(query, plan, executions);

  try {
    const result = await llm.generate(prompt, {
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens || 512,
    });
    return {
      text: result.text,
      stats: { evalCount: result.evalCount, duration: result.totalDuration },
      fallback: false,
    };
  } catch (e) {
    return { text: null, error: e.message, fallback: true };
  }
}

// ═══════════════════════════════════════════════════
// MAIN NARRATE
// ═══════════════════════════════════════════════════

/**
 * Сформировать ответ оператору.
 *
 * @param {Object} input — { query, plan, executions, reasoning }
 * @param {Object} options — { useLLM: boolean, ollamaUrl, model }
 * @returns {Object} — { text, sections, confidence, recommendation, source: 'llm'|'template' }
 */
async function narrate(input, options = {}) {
  const { query, plan = [], executions = [] } = input;
  const useLLM = options.useLLM !== false;

  // 1. Сначала template (базовый вариант, всегда работает)
  const templateResult = templateNarrate(query, plan, executions);

  // 2. Если LLM включён — пробуем улучшить
  if (useLLM) {
    try {
      const llmResult = await llmNarrate(query, plan, executions, options);
      if (llmResult.text && !llmResult.fallback) {
        return {
          text: llmResult.text,
          sections: templateResult.sections, // секции всё равно отдаём
          confidence: templateResult.confidence,
          recommendation: templateResult.recommendation,
          signals: templateResult.signals,
          source: 'llm',
          llmStats: llmResult.stats,
        };
      }
      // Fallback на template
      return {
        ...templateResult,
        source: 'template',
        llmError: llmResult.error || 'llm_fallback',
      };
    } catch (e) {
      return {
        ...templateResult,
        source: 'template',
        llmError: e.message,
      };
    }
  }

  return {
    ...templateResult,
    source: 'template',
  };
}

// ═══════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════

export {
  narrate,
  extractSignals,
  aggregateConfidence,
  templateNarrate,
  llmNarrate,
  NARRATOR_SYSTEM,
};
