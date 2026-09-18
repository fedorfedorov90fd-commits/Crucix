// apis/predict/narrative_unified.mjs
// Объединение обычного нарративного анализа (SIR/SEIR) с детекцией
// информационной войны.
//
// Базовый narrative.mjs даёт "что распространяется".
// narrative_warfare.mjs даёт "кто распространяет и скоординированно ли".
// Вместе: полная картина информационного поля.
//
// Внутренний модуль (контракт Тип B):
//   export const meta = { id, name, layer, category, description, version, depends, exports }
//   export function crucixUnifiedNarrative(latest, history, options)
//
// Никаких route / methods / handler — это не HTTP-эндпоинт.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { crucixNarrativeAnalysis } from './narrative.mjs';
import { crucixNarrativeWarfare, computeNarrativeConfidence } from './narrative_warfare.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolveSafe(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs', 'predictions');

function resolveSafe(base, ...segments) {
  return join(base, ...segments);
}

export const meta = {
  id: 'narrative_unified',
  name: 'Объединённый нарративный анализ',
  layer: 8,
  category: 'information',
  description: 'SIR/SEIR-прогноз распространения нарратива + детекция скоординированных кампаний + оценка достоверности через независимые источники',
  version: '1.0.0',
  depends: ['narrative', 'narrative_warfare', 'temporal_causal'],
  exports: ['crucixUnifiedNarrative', 'classifyNarrativeThreat'],
};

// ─── ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ─────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJSON(filepath, fallback) {
  try {
    if (!existsSync(filepath)) return fallback;
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.warn(`[narrative_unified] loadJSON ${filepath}: ${e.message}`);
    return fallback;
  }
}

// ─── ГЛАВНАЯ ФУНКЦИЯ ─────────────────────────────────

/**
 * Unified Narrative Analysis:
 *   1. Извлекаем нарративы (topic modeling) — через narrative.mjs
 *   2. Для каждого нарратива: SIR/SEIR-прогноз распространения
 *   3. Проверяем: не является ли нарратив частью скоординированной кампании
 *   4. Оцениваем достоверность через независимые источники
 *   5. Строим мост к многослойному причинному графу (INFO → FINANCE)
 *
 * @param {object} latest — текущий sweep
 * @param {Array} history — история sweep-ов
 * @param {object} options — резерв под будущие опции
 * @returns {object} unified narrative analysis
 */
export function crucixUnifiedNarrative(latest, history, options = {}) {
  const startTime = Date.now();

  // 1. Базовый нарративный анализ
  let baseNarrative = null;
  try {
    baseNarrative = crucixNarrativeAnalysis(latest, history);
  } catch (e) {
    console.warn(`[narrative_unified] base narrative failed: ${e.message}`);
    baseNarrative = { narratives: [], forecasts: [], narrativeCount: 0 };
  }

  // 2. Детекция информационной войны
  let warfare = null;
  try {
    warfare = crucixNarrativeWarfare(latest, history);
  } catch (e) {
    console.warn(`[narrative_unified] warfare failed: ${e.message}`);
    warfare = { available: false, campaigns: [], campaignsDetected: 0, threatLevel: 0 };
  }

  // 3. Обогащение каждого нарратива
  const rawEvents = Array.isArray(latest?.gdelt?.rawEvents) ? latest.gdelt.rawEvents : [];
  const enrichedNarratives = (baseNarrative.narratives || []).map(narrative => {
    const keywords = Array.isArray(narrative.keywords) ? narrative.keywords : [];

    // Матчинг с известными кампаниями
    const matchingCampaign = (warfare.campaigns || []).find(campaign => {
      const sampleTexts = Array.isArray(campaign.sampleTexts) ? campaign.sampleTexts : [];
      return keywords.some(kw =>
        sampleTexts.some(text =>
          typeof text === 'string' &&
          text.toLowerCase().includes(String(kw).toLowerCase())
        )
      );
    }) || null;

    // Посты, относящиеся к нарративу
    const narrativePosts = rawEvents
      .filter(e => {
        const summary = (e?.summary || '').toLowerCase();
        return keywords.some(kw => summary.includes(String(kw).toLowerCase()));
      })
      .map(e => ({
        text: e.summary,
        source: e.sourceUrl || e.domain || 'unknown',
      }));

    // Достоверность через независимые источники
    let confidence;
    if (narrativePosts.length > 0) {
      try {
        confidence = computeNarrativeConfidence(narrativePosts);
      } catch (e) {
        confidence = { confidence: 0.5, level: 'unknown', independentSources: 0, propagandaSources: 0 };
      }
    } else {
      confidence = { confidence: 0.5, level: 'unknown', independentSources: 0, propagandaSources: 0 };
    }

    // SIR-прогноз
    const sirForecast = (baseNarrative.forecasts || [])
      .find(f => f?.narrative?.id === narrative.id)?.sirForecast || null;

    // Классификация происхождения
    let originType = 'organic';
    if (matchingCampaign && matchingCampaign.suspicionScore > 0.6) {
      originType = 'coordinated_campaign';
    } else if (matchingCampaign && matchingCampaign.suspicionScore > 0.4) {
      originType = 'suspicious_coordination';
    }

    // Оценка угрозы
    const spreadFactor = sirForecast?.willSpread ? 0.4 : 0.1;
    const suspicionFactor = matchingCampaign?.suspicionScore || 0;
    const lowConfidenceFactor = confidence.confidence < 0.4 ? 0.3 : 0;
    const threatLevel = Math.min(1, spreadFactor + suspicionFactor * 0.5 + lowConfidenceFactor);

    return {
      ...narrative,
      originType,
      matchedCampaign: matchingCampaign ? {
        id: matchingCampaign.id,
        suspicionScore: matchingCampaign.suspicionScore,
        classification: matchingCampaign.classification,
        sourceCount: Array.isArray(matchingCampaign.sources) ? matchingCampaign.sources.length : 0,
      } : null,
      confidence: {
        value: confidence.confidence,
        level: confidence.level,
        independentSources: confidence.independentSources || 0,
        propagandaSources: confidence.propagandaSources || 0,
      },
      sirForecast,
      threatLevel,
      recommendation: classifyNarrativeThreat(originType, sirForecast, confidence),
    };
  });

  enrichedNarratives.sort((a, b) => b.threatLevel - a.threatLevel);

  const topCampaign = (warfare.campaigns && warfare.campaigns[0]) || null;

  const overallThreat = enrichedNarratives.length > 0
    ? enrichedNarratives.reduce((s, n) => s + n.threatLevel, 0) / enrichedNarratives.length
    : 0;

  // Мост к многослойному причинному графу
  const causalBridge = {
    infoLayerNodes: enrichedNarratives.slice(0, 5).map(n => ({
      narrative: (n.keywords && n.keywords[0]) || 'unknown',
      threatLevel: n.threatLevel,
      originType: n.originType,
      financialImpact: n.sirForecast?.willSpread
        ? Math.min(0.8, n.threatLevel * 0.7 + 0.2)
        : n.threatLevel * 0.3,
    })),
    interpretation: overallThreat > 0.6
      ? 'Высокая информационная угроза. Нарративы распространяются, часть — скоординированно. Возможно влияние на финансовый слой.'
      : overallThreat > 0.4
        ? 'Средняя информационная угроза. Требуется мониторинг.'
        : 'Информационное поле стабильно.',
  };

  const result = {
    module: 'narrative_unified',
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - startTime,

    narratives: enrichedNarratives.slice(0, 10),
    campaigns: warfare.campaigns || [],
    topCampaign,

    narrativeCount: enrichedNarratives.length,
    coordinatedCampaignsCount: enrichedNarratives.filter(n => n.originType === 'coordinated_campaign').length,
    organicNarrativesCount: enrichedNarratives.filter(n => n.originType === 'organic').length,
    overallThreat,

    causalBridge,

    assessments: {
      threatLevel: overallThreat > 0.6 ? 'КРИТИЧНО'
        : overallThreat > 0.4 ? 'ВЫСОКО'
        : overallThreat > 0.2 ? 'СРЕДНЕ' : 'НИЗКО',
      description: causalBridge.interpretation,
    },

    warfareAvailable: warfare.available === true,
    baseNarrativeAvailable: !!(baseNarrative && baseNarrative.narratives),
  };

  // Сохранение
  try {
    ensureDir(RUNS_DIR);
    writeFileSync(
      join(RUNS_DIR, 'narrative_unified.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.warn(`[narrative_unified] save failed: ${e.message}`);
  }

  return result;
}

/**
 * Классификация угрозы нарратива по комбинации происхождения,
 * прогноза распространения и достоверности источников.
 */
export function classifyNarrativeThreat(originType, sirForecast, confidence) {
  if (originType === 'coordinated_campaign' && sirForecast?.willSpread) {
    return 'КРИТИЧНО: скоординированная кампания активно распространяется. Требуется противодействие.';
  }
  if (originType === 'coordinated_campaign' && !sirForecast?.willSpread) {
    return 'ВЫСОКО: обнаружена кампания, но распространение сдерживается.';
  }
  if (originType === 'suspicious_coordination' && sirForecast?.willSpread) {
    return 'ВНИМАНИЕ: признаки координации + активное распространение. Мониторинг усилен.';
  }
  if ((confidence?.confidence ?? 1) < 0.3) {
    return 'Недостоверный нарратив. Не подтверждён независимыми источниками.';
  }
  return 'Органический нарратив. Стандартный мониторинг.';
}

export default crucixUnifiedNarrative;
