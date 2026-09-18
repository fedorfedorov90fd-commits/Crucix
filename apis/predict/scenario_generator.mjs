// apis/predict/scenario_generator.mjs
// Слой 6: LLM Scenario Generator — генерация сценариев развития событий.
//
// Компоненты:
//   1. LLMProvider — обёртка над функцией chat провайдера LLM.
//   2. ScenarioGenerator — генерирует 5-10 сценариев через LLM,
//      либо через детерминированный fallback при отсутствии LLM.
//   3. generateCascadingTree — дерево под-сценариев для топ-3 сценариев.
//
// Ключевая особенность:
//   Модуль работает ДАЖЕ БЕЗ LLM — через _fallbackScenarios.
//   Это критично для надёжности и портабельности.
//
// Формат сценария:
//   { id, name, description, probability, triggers[], consequences[],
//     horizonHours, severity }
//
// Контракт 2 (внутренний predict-модуль):
//   - Нет route (не HTTP-эндпоинт).
//   - Есть meta (описание, категория, версия, зависимости).
//   - Экспорт именованных функций и классов. Никаких дефолтных экспортов.
//   - try/catch с параметром.
//
// Портабельность:
//   Все пути строятся относительно файла через import.meta.url.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// ─── МЕТАДАННЫЕ МОДУЛЯ ──────────────────────────────────────────

export const meta = {
  id: 'scenario_generator',
  name: 'Генератор сценариев на LLM (LLM Scenario Generator)',
  layer: 6,
  category: 'scenario',
  description: 'Генерация 5-10 правдоподобных сценариев развития событий через LLM с детерминированным fallback. Cascading Scenario Tree.',
  version: '2.0.0',
  depends: [],
  exports: [
    'LLMProvider',
    'ScenarioGenerator',
    'crucixScenarioGeneration',
  ],
};

// ─── LLM PROVIDER INTERFACE ────────────────────────────────────

export class LLMProvider {
  constructor(chatFn) {
    this.chat = chatFn;
  }
}

// ─── SCENARIO GENERATOR ────────────────────────────────────────

export class ScenarioGenerator {
  constructor(config = {}) {
    this.llm = config.llm;
    this.nScenarios = config.nScenarios || 7;
    this.horizonHours = config.horizonHours || 168;
    this.temperature = config.temperature || 0.8;
  }

  /**
   * Генерация сценариев на основе текущего состояния.
   * @param {Object} latest — текущий sweep
   * @param {Object} context — дополнительный контекст
   * @returns {Promise<Array>} — сценарии
   */
  async generate(latest, context = {}) {
    if (!this.llm || typeof this.llm.chat !== 'function') {
      return this._fallbackScenarios(latest);
    }

    const stateDescription = this._describeState(latest, context);

    const prompt = `Ты — аналитик-футуролог. На основе текущего состояния системы сгенерируй ${this.nScenarios} различных сценариев развития событий на горизонте ${this.horizonHours} часов.

ТЕКУЩЕЕ СОСТОЯНИЕ:
${stateDescription}

ТРЕБОВАНИЯ К СЦЕНАРИЯМ:
1. Каждый сценарий должен быть правдоподобным и обоснованным
2. Сценарии должны покрывать спектр: от позитивного до критического
3. Включай маловероятные, но важные сценарии (tail risks)
4. Для каждого сценария укажи: название, описание, вероятность (0.0-1.0), ключевые триггеры, ожидаемые последствия, горизонт.

ОТВЕТ ФОРМАТ (строго JSON):
{
  "scenarios": [
    {
      "id": "scenario_1",
      "name": "Название",
      "description": "Описание",
      "probability": 0.25,
      "triggers": ["триггер1", "триггер2"],
      "consequences": ["последствие1", "последствие2"],
      "horizonHours": 72,
      "severity": "low|medium|high|critical"
    }
  ]
}`;

    let response;
    try {
      response = await this.llm.chat([
        { role: 'system', content: 'Ты — аналитик-футуролог. Отвечай строго в формате JSON.' },
        { role: 'user', content: prompt },
      ]);
    } catch (e) {
      console.error('[scenario_generator] LLM error:', e.message);
      return this._fallbackScenarios(latest);
    }

    let parsed;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch (e) {
      console.warn('[scenario_generator] JSON parse failed, using fallback:', e.message);
      return this._fallbackScenarios(latest);
    }

    const scenarios = (parsed.scenarios || []).slice(0, this.nScenarios);
    const totalProb = scenarios.reduce((s, sc) => s + (sc.probability || 0), 0);
    if (totalProb > 0) {
      for (const sc of scenarios) {
        sc.probability = (sc.probability || 0) / totalProb;
      }
    }
    return scenarios;
  }

  _describeState(latest, context) {
    const lines = [];
    if (latest.fred) {
      lines.push(`VIX: ${latest.fred.vix || 'n/a'}`);
      lines.push(`HY-спред: ${latest.fred.hySpread || 'n/a'}`);
      lines.push(`10Y Treasury: ${latest.fred.treasury10y || 'n/a'}`);
    }
    if (latest.gdelt) {
      lines.push(`Конфликтных событий: ${latest.gdelt.conflictEvents?.length || 0}`);
      lines.push(`Goldstein score: ${latest.gdelt.avgGoldsteinScore || 'n/a'}`);
    }
    if (latest.sanctions) {
      lines.push(`Санкций: ${latest.sanctions.count || 0}`);
    }
    if (latest.radiation) {
      const maxCpm = Math.max(...Object.values(latest.radiation).map(s => s.cpm || 0));
      lines.push(`Макс. радиация: ${maxCpm} CPM`);
    }
    if (latest.energy) {
      lines.push(`Нефть: $${latest.energy.oilPrice || 'n/a'}`);
    }
    if (context.topRisks) {
      lines.push('');
      lines.push('Топ-риски (прогноз):');
      for (const r of context.topRisks.slice(0, 3)) {
        lines.push(`- ${r.name}: ${(r.probability * 100).toFixed(0)}%`);
      }
    }
    return lines.join('\n');
  }

  _fallbackScenarios(latest) {
    const vix = latest.fred?.vix || 20;
    const conflicts = latest.gdelt?.conflictEvents?.length || 0;
    const scenarios = [];

    if (vix > 25 || conflicts > 10) {
      scenarios.push(
        { id: 'escalation',   name: 'Эскалация',           description: 'Продолжение роста напряжённости', probability: 0.40, severity: 'high',     horizonHours: 72,  triggers: ['рост VIX', 'конфликты'], consequences: ['усиление санкций', 'обвал рынков'] },
        { id: 'deescalation', name: 'Деэскалация',         description: 'Дипломатическое разрешение',       probability: 0.20, severity: 'low',      horizonHours: 168, triggers: ['переговоры'], consequences: ['снижение VIX'] },
        { id: 'crisis',       name: 'Кризис',              description: 'Резкое ухудшение ситуации',        probability: 0.25, severity: 'critical', horizonHours: 48,  triggers: ['шок'],       consequences: ['паника', 'обвал'] },
        { id: 'stable',       name: 'Стагнация',           description: 'Ситуация напряжённая, без изменений', probability: 0.15, severity: 'medium', horizonHours: 168, triggers: [], consequences: [] },
      );
    } else {
      scenarios.push(
        { id: 'stable',           name: 'Стабильность',            description: 'Состояние сохраняется',            probability: 0.50, severity: 'low',      horizonHours: 168, triggers: [], consequences: [] },
        { id: 'gradual_worsening', name: 'Постепенное ухудшение',   description: 'Медленный рост напряжённости',    probability: 0.30, severity: 'medium',   horizonHours: 168, triggers: ['постепенный рост'], consequences: ['рост VIX'] },
        { id: 'sudden_crisis',    name: 'Внезапный кризис',        description: 'Шоковое событие',                 probability: 0.15, severity: 'high',     horizonHours: 48,  triggers: ['шок'], consequences: ['паника'] },
        { id: 'improvement',      name: 'Улучшение',               description: 'Позитивное развитие',             probability: 0.05, severity: 'low',      horizonHours: 168, triggers: [], consequences: [] },
      );
    }
    return scenarios;
  }

  /**
   * Cascading Scenario Tree: для топ-3 сценариев — под-сценарии.
   */
  async generateCascadingTree(latest, context = {}, depth = 2) {
    const rootScenarios = await this.generate(latest, context);
    const tree = { root: rootScenarios, branches: {} };

    if (depth < 2 || !this.llm || typeof this.llm.chat !== 'function') return tree;

    for (const scenario of rootScenarios.slice(0, 3)) {
      const subPrompt = `Сценарий "${scenario.name}" реализовался: ${scenario.description}.

Сгенерируй 3 варианта развития этого сценария (под-сценария) на следующие ${scenario.horizonHours} часов.
Для каждого: название, описание, вероятность (нормализованная до 1 в сумме), последствия.

Формат ответа — JSON: { "scenarios": [...] }`;

      try {
        const response = await this.llm.chat([
          { role: 'system', content: 'Аналитик-футуролог. JSON only.' },
          { role: 'user', content: subPrompt },
        ]);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        const subScenarios = parsed.scenarios || [];
        const total = subScenarios.reduce((s, sc) => s + (sc.probability || 0), 0);
        if (total > 0) {
          for (const sub of subScenarios) sub.probability /= total;
        }
        tree.branches[scenario.id] = subScenarios;
      } catch (e) {
        console.warn(`[scenario_generator] Sub-scenarios for ${scenario.id} failed:`, e.message);
      }
    }

    return tree;
  }
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────────────────

export async function crucixScenarioGeneration(latest, context = {}) {
  const generator = new ScenarioGenerator({
    llm: context.llmProvider || null,
    nScenarios: 7,
    horizonHours: 168,
  });

  const scenarios = await generator.generate(latest, context);

  let tree = null;
  if (context.llmProvider && context.cascading !== false) {
    try {
      tree = await generator.generateCascadingTree(latest, context, 2);
    } catch (e) {
      console.warn('[scenario_generator] Cascade failed:', e.message);
    }
  }

  const result = {
    module: 'scenario_generator',
    scenarioCount: scenarios.length,
    scenarios: scenarios.sort((a, b) => b.probability - a.probability),
    cascadingTree: tree,
    topScenario: scenarios[0] || null,
    expectedSeverity: scenarios.reduce((s, sc) => {
      const weight = { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 }[sc.severity] || 0.5;
      return s + sc.probability * weight;
    }, 0),
    usedLLM: Boolean(context.llmProvider),
    timestamp: new Date().toISOString(),
  };

  if (!existsSync(PRED_DIR)) {
    try { mkdirSync(PRED_DIR, { recursive: true }); }
    catch (e) { console.warn('[scenario_generator] Не удалось создать PRED_DIR:', e.message); }
  }
  try {
    writeFileSync(
      join(PRED_DIR, `scenarios_${Date.now()}.json`),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.warn('[scenario_generator] Не удалось сохранить результат:', e.message);
  }

  return result;
}
