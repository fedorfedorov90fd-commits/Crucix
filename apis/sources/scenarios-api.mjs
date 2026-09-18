/**
 * apis/sources/scenarios-api.mjs — SERVICE-МОДУЛЬ: СИМУЛЯТОР СЦЕНАРИЕВ «ЧТО-ЕСЛИ»
 *
 * КОНТРАКТ CRUCIX v2 (Service, мультиметодный).
 * ИСТОЧНИК: data/basket/scenarios.json — { presets:[...], baseIndex?, parameterWeights? }.
 * Сборщик: scripts/collectors/collect-scenarios.mjs.
 * PERSIST: data/persist/scenarios-history.json — история запусков (LIFO, до 500 записей).
 *
 * Симулятор геополитических / экономических / кибер / природных / технологических
 * сценариев «что-если»: интерактивный Service-инструмент с полным покрытием
 * GET-интроспекции и POST-запуска. Не слой карты — сценарии не имеют координат.
 *
 * ENDPOINTS (GET):
 *   /                    — сводка (presets + series + stats + history_stats + latest)
 *   /stats               — статистика пресетов + статистика истории
 *   /status              — health-check
 *   /presets             — все пресеты сценариев
 *   /presets/:id         — конкретный пресет
 *   /categories          — группировка по категориям
 *   /severity            — группировка по уровням серьёзности
 *   /latest              — последние запуски
 *   /history             — полная история (persist)
 *   /history/:id         — конкретный запуск по id
 *   /compare?ids=a,b,c   — сравнение (GET-форма)
 *   /weights             — веса параметров
 *   /base-index          — базовый глобальный индекс
 *   /parameters          — список параметров и их смысл
 *   /regimes             — режимы/уровни и их пороги
 *   /timeline            — динамика запусков по дням
 *
 * ENDPOINTS (POST):
 *   /run                 — запуск сценария (body: { presetId? , params? , label? })
 *   /compare             — сравнение (body: { ids:[...] })
 *   /reset-history       — сброс истории (body: { confirm: true })
 *   /bulk-run            — пакетный запуск (body: { scenarios:[...] })
 *
 * ФОРМАТЫ: json, csv, series, stats, raw, history.
 * ФИЛЬТРЫ: ?category=, ?severity=, ?q=, ?min_impact=, ?max_impact=, ?top=, ?limit=, ?since=, ?until=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'scenarios.json');
const PERSIST_DIR  = join(PROJECT_ROOT, 'data', 'persist');
const HISTORY_FILE = join(PERSIST_DIR, 'scenarios-history.json');

export const route   = '/api/services/scenarios';
export const methods = ['GET', 'POST'];

export const meta = {
  service: true,
  description: 'Симулятор сценариев «что-если»: военные, экономические, кибер, природные, технологические. GET-интроспекция + POST-запуск (run / bulk-run / compare / reset-history). Persist истории в data/persist/scenarios-history.json.',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  FALLBACK (используется если basket недоступен)
// ============================================================

const FALLBACK_PRESETS = [
  { id: 'preset-001', name: 'Военная эскалация', description: 'Усиление военного конфликта в регионе',
    category: 'military', severity: 'high',
    parameters: { militaryActivity: 8, economicImpact: 6, diplomaticTension: 9, humanitarianImpact: 7, globalIndexImpact: 25 } },
  { id: 'preset-002', name: 'Дипломатическое урегулирование', description: 'Подписание мирного договора',
    category: 'diplomatic', severity: 'positive',
    parameters: { militaryActivity: 2, economicImpact: 3, diplomaticTension: 2, humanitarianImpact: 3, globalIndexImpact: -15 } },
  { id: 'preset-003', name: 'Экономический кризис', description: 'Обвал рынков, рост инфляции',
    category: 'economic', severity: 'high',
    parameters: { militaryActivity: 4, economicImpact: 9, diplomaticTension: 6, humanitarianImpact: 8, globalIndexImpact: 35 } },
  { id: 'preset-004', name: 'Крупная кибератака', description: 'Атака на критическую инфраструктуру',
    category: 'cyber', severity: 'high',
    parameters: { militaryActivity: 3, economicImpact: 7, diplomaticTension: 8, humanitarianImpact: 5, globalIndexImpact: 20 } },
  { id: 'preset-005', name: 'Природная катастрофа', description: 'Землетрясение, наводнение, пандемия',
    category: 'natural', severity: 'medium',
    parameters: { militaryActivity: 2, economicImpact: 6, diplomaticTension: 4, humanitarianImpact: 9, globalIndexImpact: 12 } },
  { id: 'preset-006', name: 'Технологический прорыв', description: 'Прорыв в энергетике или AI',
    category: 'technology', severity: 'positive',
    parameters: { militaryActivity: 3, economicImpact: 8, diplomaticTension: 5, humanitarianImpact: 6, globalIndexImpact: -8 } },
  { id: 'preset-007', name: 'Пандемия нового патогена', description: 'Быстрое распространение, карантины, обвал торговли',
    category: 'natural', severity: 'critical',
    parameters: { militaryActivity: 2, economicImpact: 9, diplomaticTension: 6, humanitarianImpact: 10, globalIndexImpact: 42 } },
  { id: 'preset-008', name: 'Обострение на Тайване', description: 'Военно-морская блокада, санкции, разрыв цепочек поставок',
    category: 'military', severity: 'critical',
    parameters: { militaryActivity: 10, economicImpact: 9, diplomaticTension: 10, humanitarianImpact: 6, globalIndexImpact: 45 } },
  { id: 'preset-009', name: 'Массовый сбой энергосистемы', description: 'Каскадный отказ электроэнергии в нескольких странах',
    category: 'technology', severity: 'high',
    parameters: { militaryActivity: 2, economicImpact: 8, diplomaticTension: 5, humanitarianImpact: 7, globalIndexImpact: 24 } },
  { id: 'preset-010', name: 'Санкции против крупной экономики', description: 'Пакет ограничений, эмбарго, заморозка активов',
    category: 'economic', severity: 'high',
    parameters: { militaryActivity: 3, economicImpact: 8, diplomaticTension: 9, humanitarianImpact: 5, globalIndexImpact: 28 } },
];

const CATEGORY_COLORS = {
  military:   '#dc2626',
  diplomatic: '#22c55e',
  economic:   '#eab308',
  cyber:      '#0891b2',
  natural:    '#16a34a',
  technology: '#8b5cf6',
  other:      '#64748b',
};

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#84cc16',
  positive: '#22c55e',
  unknown:  '#64748b',
};

const DEFAULT_PARAM_WEIGHTS = {
  militaryActivity:   0.30,
  economicImpact:     0.25,
  diplomaticTension:  0.25,
  humanitarianImpact: 0.20,
};

const PARAM_MEANING = {
  militaryActivity:   'Интенсивность военных действий (0-10)',
  economicImpact:     'Экономический ущерб (0-10)',
  diplomaticTension:  'Дипломатическая напряжённость (0-10)',
  humanitarianImpact: 'Гуманитарные последствия (0-10)',
};

const LEVEL_THRESHOLDS = [
  { level: 'critical', min: 70, label: 'Критический' },
  { level: 'high',     min: 50, label: 'Высокий' },
  { level: 'medium',   min: 30, label: 'Средний' },
  { level: 'low',      min: 0,  label: 'Низкий' },
];

// ============================================================
//  ЗАГРУЗКА BASKET
// ============================================================

async function loadBasket() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-scenarios.mjs';
      err.fallback = { presets: FALLBACK_PRESETS, baseIndex: 37, paramWeights: DEFAULT_PARAM_WEIGHTS };
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let presets = null;
  let baseIndex = null;
  let paramWeights = null;

  if (Array.isArray(parsed)) presets = parsed;
  else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.presets)) presets = parsed.presets;
    else if (Array.isArray(parsed.data)) presets = parsed.data;
    if (parsed.baseIndex != null) baseIndex = Number(parsed.baseIndex);
    if (parsed.parameterWeights && typeof parsed.parameterWeights === 'object') paramWeights = parsed.parameterWeights;
  }

  if (!presets) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }
  return {
    presets,
    baseIndex: Number.isFinite(baseIndex) ? baseIndex : 37,
    paramWeights: paramWeights || DEFAULT_PARAM_WEIGHTS,
  };
}

// ============================================================
//  ИСТОРИЯ ЗАПУСКОВ (PERSIST)
// ============================================================

async function loadHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.history)) return parsed.history;
    return [];
  } catch { return []; }
}

async function saveHistory(history) {
  try {
    await fs.mkdir(PERSIST_DIR, { recursive: true });
    const payload = {
      updated_at: new Date().toISOString(),
      count: history.length,
      history,
    };
    await fs.writeFile(HISTORY_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {}
}

async function appendHistory(entry) {
  const history = await loadHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, 500);
  await saveHistory(trimmed);
  return trimmed.length;
}

async function clearHistory() {
  await saveHistory([]);
}

// ============================================================
//  НОРМАЛИЗАЦИЯ ПРЕСЕТА
// ============================================================

function normalizePreset(p, i) {
  const id = String(p.id || `preset-${String(i + 1).padStart(3, '0')}`);
  const category = String(p.category || 'other').toLowerCase();
  const severity = String(p.severity || 'unknown').toLowerCase();
  const catColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  const sevColor = SEVERITY_COLORS[severity] || SEVERITY_COLORS.unknown;
  const params = (p.parameters && typeof p.parameters === 'object') ? p.parameters : {};

  return {
    id,
    name: p.name || `Пресет ${i + 1}`,
    description: p.description || null,
    category,
    categoryColor: catColor,
    severity,
    severityColor: sevColor,
    parameters: params,
    globalIndexImpact: Number.isFinite(Number(params.globalIndexImpact)) ? Number(params.globalIndexImpact) : 0,
  };
}

// ============================================================
//  РАСЧЁТ СЦЕНАРИЯ
// ============================================================

function getLevel(newIndex) {
  for (const t of LEVEL_THRESHOLDS) {
    if (newIndex >= t.min) return { level: t.level, color: SEVERITY_COLORS[t.level] || SEVERITY_COLORS.unknown };
  }
  return { level: 'low', color: SEVERITY_COLORS.low };
}

function computeImpactFromParams(params, weights) {
  let impact = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const v = Number(params[key]);
    if (Number.isFinite(v)) impact += (Math.max(0, Math.min(10, v)) / 10) * weight * 40;
  }
  return Math.round(impact);
}

function computeScenarioImpact(params, presetId, presets, baseIndex, paramWeights) {
  let impact = 0;
  let source = 'params';
  if (presetId) {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      impact = preset.globalIndexImpact || 0;
      source = 'preset';
    }
  } else {
    impact = computeImpactFromParams(params, paramWeights);
  }
  const newIndex = Math.max(0, Math.min(100, baseIndex + impact));
  const lv = getLevel(newIndex);
  return {
    baseIndex,
    newIndex,
    impact,
    level: lv.level,
    levelColor: lv.color,
    impact_source: source,
    direction: impact > 0 ? 'up' : (impact < 0 ? 'down' : 'flat'),
  };
}

function buildSummary(params, preset, impact) {
  const dir = impact > 0 ? 'повышение' : (impact < 0 ? 'снижение' : 'без изменений');
  const abs = Math.abs(impact);
  let magnitude = '';
  if (abs > 20) magnitude = ' (значительное изменение)';
  else if (abs > 10) magnitude = ' (умеренное изменение)';
  else if (abs > 0) magnitude = ' (незначительное изменение)';
  const base = preset ? `Сценарий "${preset.name}": ` : 'Ручной сценарий: ';
  return `${base}${dir} глобального индекса на ${abs} пунктов${magnitude}`;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(presets) {
  const byCategory = {};
  const bySeverity = {};
  const impacts = [];
  let positiveCount = 0, negativeCount = 0, zeroCount = 0;

  for (const p of presets) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
    if (Number.isFinite(p.globalIndexImpact)) {
      impacts.push(p.globalIndexImpact);
      if (p.globalIndexImpact > 0) positiveCount++;
      else if (p.globalIndexImpact < 0) negativeCount++;
      else zeroCount++;
    }
  }

  const top = (obj, n = 10) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  const meanImpact = impacts.length ? impacts.reduce((a, b) => a + b, 0) / impacts.length : null;

  return {
    count: presets.length,
    by_category: byCategory,
    by_severity: bySeverity,
    top_categories: top(byCategory, 10),
    top_severities: top(bySeverity, 10),
    impact: impacts.length ? {
      min: Math.min(...impacts),
      max: Math.max(...impacts),
      mean: Number(meanImpact.toFixed(2)),
      positive: positiveCount,
      negative: negativeCount,
      flat: zeroCount,
    } : null,
  };
}

function computeHistoryStats(history) {
  if (!history.length) {
    return { count: 0, by_level: {}, by_preset: {}, latest_at: null, oldest_at: null };
  }
  const byLevel = {};
  const byPreset = {};
  for (const h of history) {
    byLevel[h.level] = (byLevel[h.level] || 0) + 1;
    if (h.presetId) byPreset[h.presetId] = (byPreset[h.presetId] || 0) + 1;
  }
  const timestamps = history.map(h => h.timestamp).filter(Boolean).sort();
  return {
    count: history.length,
    by_level: byLevel,
    by_preset: byPreset,
    latest_at: timestamps.slice(-1)[0] || null,
    oldest_at: timestamps[0] || null,
  };
}

function computeTimeline(history) {
  const byDate = {};
  for (const h of history) {
    if (!h.timestamp) continue;
    const date = String(h.timestamp).slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, count: 0, by_level: {} };
    byDate[date].count++;
    byDate[date].by_level[h.level] = (byDate[date].by_level[h.level] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(presets, query) {
  let r = presets.slice();
  if (query.category) r = r.filter(x => x.category === String(query.category).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.description || '')).toLowerCase().includes(s));
  }
  if (query.min_impact != null) { const n = Number(query.min_impact); if (Number.isFinite(n)) r = r.filter(x => x.globalIndexImpact >= n); }
  if (query.max_impact != null) { const n = Number(query.max_impact); if (Number.isFinite(n)) r = r.filter(x => x.globalIndexImpact <= n); }
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function filterHistory(history, query) {
  let r = history.slice();
  if (query.presetId) r = r.filter(h => h.presetId === String(query.presetId));
  if (query.level)    r = r.filter(h => h.level === String(query.level));
  if (query.since)    r = r.filter(h => !h.timestamp || String(h.timestamp) >= String(query.since));
  if (query.until)    r = r.filter(h => !h.timestamp || String(h.timestamp) <= String(query.until));
  if (query.limit)    { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  BODY-ЧТЕНИЕ
// ============================================================

function readBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let buf = '', size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      buf += c;
    });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); }
      catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toSeries(presets) {
  return presets.map(p => ({
    id: p.id, name: p.name, category: p.category, severity: p.severity,
    impact: p.globalIndexImpact, categoryColor: p.categoryColor, severityColor: p.severityColor,
  }));
}

function toCSV(presets) {
  const lines = ['id,name,category,severity,impact'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const p of presets) lines.push([p.id, p.name, p.category, p.severity, p.globalIndexImpact].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function historyToCSV(history) {
  const lines = ['id,timestamp,presetId,presetName,level,impact,newIndex,summary'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const h of history) {
    lines.push([h.id, h.timestamp, h.presetId, h.presetName, h.level, h.impact, h.newIndex, h.summary].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const urlObj = new URL(req.url, 'http://x');
  const sub = urlObj.pathname.replace(/^\/api\/services\/scenarios/, '') || '/';
  const query = Object.fromEntries(urlObj.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'scenarios',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  let presets = [];
  let baseIndex = 37;
  let paramWeights = DEFAULT_PARAM_WEIGHTS;
  let usedFallback = false;

  try {
    const basket = await loadBasket();
    presets = basket.presets.map(normalizePreset);
    baseIndex = basket.baseIndex;
    paramWeights = basket.paramWeights;
  } catch (e) {
    if (e.statusCode === 503 && e.fallback) {
      presets = e.fallback.presets.map(normalizePreset);
      baseIndex = e.fallback.baseIndex;
      paramWeights = e.fallback.paramWeights;
      usedFallback = true;
    } else {
      const status = e.statusCode || 500;
      const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
      if (e.hint) payload.hint = e.hint;
      return sendJSON(res, status, payload, extra);
    }
  }

  try {
    // ============================================================
    //  POST-ЭНДПОИНТЫ
    // ============================================================

    if (req.method === 'POST') {
      if (sub === '/run' || sub === '/' || sub === '') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }

        const presetId = body.presetId || null;
        const params = body.params || {};
        const label = body.label || null;
        const preset = presetId ? presets.find(p => p.id === presetId) : null;
        if (presetId && !preset) return sendJSON(res, 404, { error: 'preset_not_found', presetId }, extra);

        const calc = computeScenarioImpact(params, presetId, presets, baseIndex, paramWeights);
        const summary = buildSummary(params, preset, calc.impact);

        const result = {
          id: `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          presetId,
          presetName: preset?.name || null,
          label,
          baseIndex: calc.baseIndex,
          newIndex: calc.newIndex,
          impact: calc.impact,
          direction: calc.direction,
          impact_source: calc.impact_source,
          level: calc.level,
          levelColor: calc.levelColor,
          params,
          summary,
        };

        const total = await appendHistory(result);
        return sendJSON(res, 200, { success: true, scenario: result, history_total: total }, extra);
      }

      if (sub === '/compare') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }
        const ids = Array.isArray(body.ids) ? body.ids : [];
        const history = await loadHistory();
        const results = ids.map(id => history.find(h => h.id === id)).filter(Boolean);
        const diffs = [];
        for (let i = 1; i < results.length; i++) {
          const a = results[i - 1], b = results[i];
          diffs.push({
            from: a.id, to: b.id,
            impact_diff: (b.impact || 0) - (a.impact || 0),
            index_diff: (b.newIndex || 0) - (a.newIndex || 0),
          });
        }
        return sendJSON(res, 200, { success: true, count: results.length, results, diffs }, extra);
      }

      if (sub === '/reset-history') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }
        if (body.confirm !== true) return sendJSON(res, 400, { error: 'confirmation_required', hint: 'send {"confirm": true}' }, extra);
        await clearHistory();
        return sendJSON(res, 200, { success: true, history_total: 0 }, extra);
      }

      if (sub === '/bulk-run') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }
        const list = Array.isArray(body.scenarios) ? body.scenarios : [];
        if (!list.length) return sendJSON(res, 400, { error: 'field_required: scenarios[]' }, extra);
        if (list.length > 100) return sendJSON(res, 400, { error: 'too_many_scenarios', max: 100, got: list.length }, extra);

        const results = [];
        for (const item of list) {
          const presetId = item.presetId || null;
          const params = item.params || {};
          const preset = presetId ? presets.find(p => p.id === presetId) : null;
          if (presetId && !preset) {
            results.push({ error: 'preset_not_found', presetId });
            continue;
          }
          const calc = computeScenarioImpact(params, presetId, presets, baseIndex, paramWeights);
          const entry = {
            id: `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            presetId,
            presetName: preset?.name || null,
            label: item.label || null,
            baseIndex: calc.baseIndex,
            newIndex: calc.newIndex,
            impact: calc.impact,
            direction: calc.direction,
            impact_source: calc.impact_source,
            level: calc.level,
            levelColor: calc.levelColor,
            params,
            summary: buildSummary(params, preset, calc.impact),
          };
          await appendHistory(entry);
          results.push(entry);
        }
        return sendJSON(res, 200, { success: true, count: results.length, results }, extra);
      }

      return sendJSON(res, 404, { error: 'post_endpoint_not_found', path: sub, available: ['/run', '/compare', '/reset-history', '/bulk-run'] }, extra);
    }

    // ============================================================
    //  GET-ЭНДПОИНТЫ
    // ============================================================

    if (sub === '/stats' || format === 'stats') {
      const history = await loadHistory();
      return sendJSON(res, 200, {
        presets_stats: computeStats(presets),
        history_stats: computeHistoryStats(history),
        fallback: usedFallback,
      }, extra);
    }
    if (sub === '/status') {
      const history = await loadHistory();
      return sendJSON(res, 200, {
        status: 'online',
        presets: presets.length,
        history_count: history.length,
        fallback: usedFallback,
        base_index: baseIndex,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/presets') {
      const rows = applyFilters(presets, query);
      return sendJSON(res, 200, { presets: rows, count: rows.length, total: presets.length }, extra);
    }
    if (sub.startsWith('/presets/')) {
      const id = decodeURIComponent(sub.slice('/presets/'.length));
      const preset = presets.find(p => p.id === id);
      if (!preset) return sendJSON(res, 404, { error: 'preset_not_found', id }, extra);
      return sendJSON(res, 200, { preset }, extra);
    }
    if (sub === '/categories') {
      const byCategory = {};
      for (const p of presets) {
        if (!byCategory[p.category]) byCategory[p.category] = { name: p.category, color: p.categoryColor, count: 0, presets: [] };
        byCategory[p.category].count++;
        byCategory[p.category].presets.push(p.id);
      }
      return sendJSON(res, 200, { categories: Object.values(byCategory), total: Object.keys(byCategory).length }, extra);
    }
    if (sub === '/severity') {
      const bySeverity = {};
      for (const p of presets) {
        if (!bySeverity[p.severity]) bySeverity[p.severity] = { name: p.severity, color: p.severityColor, count: 0 };
        bySeverity[p.severity].count++;
      }
      return sendJSON(res, 200, { severities: Object.values(bySeverity), total: Object.keys(bySeverity).length }, extra);
    }
    if (sub === '/latest') {
      const history = await loadHistory();
      const latest = history.slice(0, 20);
      return sendJSON(res, 200, { latest, count: latest.length, total: history.length }, extra);
    }
    if (sub === '/history') {
      const history = await loadHistory();
      const filtered = filterHistory(history, query);
      if (format === 'csv') return sendText(res, 200, historyToCSV(filtered), 'text/csv; charset=utf-8');
      return sendJSON(res, 200, { history: filtered, count: filtered.length, total: history.length }, extra);
    }
    if (sub.startsWith('/history/')) {
      const id = decodeURIComponent(sub.slice('/history/'.length));
      const history = await loadHistory();
      const entry = history.find(h => h.id === id);
      if (!entry) return sendJSON(res, 404, { error: 'history_entry_not_found', id }, extra);
      return sendJSON(res, 200, { entry }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const history = await loadHistory();
      const results = ids.map(id => history.find(h => h.id === id)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/weights') {
      return sendJSON(res, 200, { weights: paramWeights, meaning: PARAM_MEANING }, extra);
    }
    if (sub === '/base-index') {
      return sendJSON(res, 200, { baseIndex, source: usedFallback ? 'fallback' : 'basket' }, extra);
    }
    if (sub === '/parameters') {
      return sendJSON(res, 200, { parameters: PARAM_MEANING, weights: paramWeights }, extra);
    }
    if (sub === '/regimes') {
      return sendJSON(res, 200, { thresholds: LEVEL_THRESHOLDS, colors: SEVERITY_COLORS }, extra);
    }
    if (sub === '/timeline') {
      const history = await loadHistory();
      const timeline = computeTimeline(history);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }

    const rows = applyFilters(presets, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'history') {
      const history = await loadHistory();
      return sendJSON(res, 200, { history, count: history.length }, extra);
    }
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, baseIndex, fallback: usedFallback }, extra);

    const history = await loadHistory();
    return sendJSON(res, 200, {
      service: 'scenarios',
      presets: rows,
      series: toSeries(rows),
      stats: computeStats(rows),
      history_stats: computeHistoryStats(history),
      latest: history.slice(0, 5),
      meta: {
        source: 'basket/scenarios.json',
        total_presets: presets.length,
        returned_presets: rows.length,
        base_index: baseIndex,
        fallback: usedFallback,
        history_count: history.length,
        generated_at: new Date().toISOString(),
      },
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
