// ═══════════════════════════════════════════════════════════════
//  CRUCIX AI ANALYST CONTEXT v1.0.0
//  Сборка контекста из активных слоёв для LLM.
//  Читает из корзины. Отправляет промпт в Ollama (llama3.1).
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.1:8b';

const SOURCE_PRIORITY = {
  critical:  ['acled','gdelt','firms','usgs','nuclear-monitor','cyber-attacks'],
  high:      ['ofac-sdn','dark-fleet','war-preparation','social-unrest'],
  elevated:  ['noaa','viirs','sanctions','infrastructure'],
  standard:  ['vix','dxy','oil-gas','gold-silver','inflation','unemployment','pmi'],
  low:       ['happiness','big-mac','google-trends','consumer-confidence'],
};

const FILE_MAP = {
  'acled':'acled.json','gdelt':'gdelt.json','firms':'firms.json','usgs':'usgs.json',
  'noaa':'noaa.json','viirs':'viirs.json','vix':'vix.json','dxy':'dxy.json',
  'oil-gas':'oil-gas.json','gold-silver':'gold-silver.json','inflation':'inflation.json',
  'unemployment':'unemployment.json','pmi':'pmi.json','nuclear-monitor':'nuclear-monitor.json',
  'war-preparation':'war-preparation.json','social-unrest':'social-unrest.json',
  'sanctions':'sanctions-pressure.json','cyber-attacks':'cyber-attack-monitor.json',
  'dark-fleet':'dark-fleet.json','ofac-sdn':'ofac-sdn.json',
};

export class AIAnalystContext {
  constructor(basketDir, options = {}) {
    this.basketDir = basketDir || join(process.cwd(), 'data', 'basket');
    this.maxTokens = options.maxTokens || 8000;
    this.maxItemsPerSource = options.maxItemsPerSource || 15;
    this.ollamaUrl = options.ollamaUrl || DEFAULT_OLLAMA_URL;
    this.ollamaModel = options.ollamaModel || DEFAULT_OLLAMA_MODEL;
  }

  _sortByPriority(layers) {
    const order = ['critical','high','elevated','standard','low'];
    const ranked = layers.map(l => {
      for (let i = 0; i < order.length; i++) {
        if ((SOURCE_PRIORITY[order[i]] || []).some(src => String(l).toLowerCase().includes(src))) return { l, p: i };
      }
      return { l, p: 3 };
    });
    ranked.sort((a, b) => a.p - b.p);
    return ranked.map(r => r.l);
  }

  _loadLayerData(layer, viewport) {
    const fname = FILE_MAP[layer] || `${layer}.json`;
    const path = join(this.basketDir, fname);
    if (!existsSync(path)) return [];
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      let recs = raw.records || raw.events || raw.data || raw;
      if (!Array.isArray(recs)) recs = [recs];
      if (viewport && recs[0]?.lat && recs[0]?.lon) {
        recs = recs.filter(r => r.lat >= viewport.south && r.lat <= viewport.north && r.lon >= viewport.west && r.lon <= viewport.east);
      }
      return recs.slice(0, this.maxItemsPerSource);
    } catch { return []; }
  }

  _formatSection(layer, data) {
    if (!data.length) return null;
    const lines = [`### ${layer.toUpperCase()} (${data.length})`];
    for (const item of data) {
      const parts = [];
      if (item.title) parts.push(String(item.title).slice(0, 200));
      if (item.summary) parts.push(String(item.summary).slice(0, 200));
      if (item.eventType) parts.push(`type: ${item.eventType}`);
      if (item.country) parts.push(`country: ${item.country}`);
      if (item.severity) parts.push(`sev: ${item.severity}`);
      if (item.value !== undefined) parts.push(`value: ${item.value}`);
      lines.push(`- ${parts.join(' | ')}`);
    }
    return lines.join('\n');
  }

  buildContext({ activeLayers = [], viewport = null } = {}) {
    const sections = [];
    let chars = 0;
    const limit = this.maxTokens * 4;
    const sorted = this._sortByPriority(activeLayers);
    for (const layer of sorted) {
      if (chars > limit) break;
      const data = this._loadLayerData(layer, viewport);
      if (!data.length) continue;
      const section = this._formatSection(layer, data);
      if (section && chars + section.length < limit) {
        sections.push(section);
        chars += section.length;
      }
    }
    return {
      sections, totalChars: chars,
      estimatedTokens: Math.ceil(chars / 4),
      layers: sorted,
      timestamp: new Date().toISOString(),
    };
  }

  buildPrompt(context, question = null) {
    const system = 'Ты аналитик. Анализируй операционные данные из нескольких источников. Выделяй паттерны, аномалии, риски. Отвечай кратко и структурированно.';
    const data = context.sections.join('\n\n');
    const prompt = question
      ? `${data}\n\nВОПРОС: ${question}\n\nАНАЛИЗ:`
      : `${data}\n\nСформируй краткий операционный отчёт с ключевыми выводами, оценкой риска и рекомендованными действиями.`;
    return { system, prompt };
  }

  async analyze(context, question = null) {
    const { system, prompt } = this.buildPrompt(context, question);
    try {
      const resp = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: { temperature: 0.3, top_p: 0.9, num_predict: 800 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!resp.ok) return { error: `Ollama HTTP ${resp.status}` };
      const data = await resp.json();
      return {
        analysis: data.message?.content || '',
        model: this.ollamaModel,
        tokensUsed: data.eval_count || 0,
        context: { layers: context.layers, estimatedTokens: context.estimatedTokens },
      };
    } catch (e) {
      return { error: e.message, analysis: null };
    }
  }

  exportText(context) {
    return `CRUCIX AI ANALYST CONTEXT\nGenerated: ${context.timestamp}\nLayers: ${context.layers.join(', ')}\nEstimated tokens: ${context.estimatedTokens}\n${'='.repeat(60)}\n${context.sections.join('\n\n')}`;
  }

  getStats() {
    let basketFiles = 0;
    try { basketFiles = readdirSync(this.basketDir).filter(f => f.endsWith('.json')).length; } catch {}
    return { basketFiles, maxTokens: this.maxTokens, maxItemsPerSource: this.maxItemsPerSource, ollamaUrl: this.ollamaUrl, ollamaModel: this.ollamaModel };
  }
}

let _instance = null;
export function getAIAnalystContext(basketDir, options) {
  if (!_instance) _instance = new AIAnalystContext(basketDir, options);
  return _instance;
}
export function resetAIAnalystContext() { _instance = null; }
