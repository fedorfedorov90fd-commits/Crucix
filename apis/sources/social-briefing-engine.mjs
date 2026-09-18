// Crucix — SocialBriefingEngine (класс-вычислитель)
// Генерация брифов через локальный LLM (Ollama).
// Три формата: daily, alert, summary.

const FORMAT_PROMPTS = {
  daily: `Write a concise daily intelligence briefing (3-5 paragraphs).
Highlight the 3 most significant developments.
Include risk level and key watch items for the next 24 hours.
Tone: professional, factual, no speculation.`,

  alert: `Write an urgent flash alert (2-3 sentences).
State what happened, where, and immediate implications.
Tone: direct, no hedging.`,

  summary: `Write a weekly strategic summary (5-8 paragraphs).
Cover escalation trends, market impacts, and forward-looking analysis.
Group by region. Tone: analytical, structured.`,
};

export default class SocialBriefingEngine {
  constructor(opts = {}) {
    this.endpoint = opts.endpoint ?? 'http://localhost:11434/api/generate';
    this.model = opts.model ?? 'llama3.1:8b';
    this.maxTokens = opts.maxTokens ?? 2048;
    this.temperature = opts.temperature ?? 0.5;
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.history = [];
    this.maxHistory = opts.maxHistory ?? 200;
  }

  async generate(request) {
    const systemPrompt = FORMAT_PROMPTS[request.format] || FORMAT_PROMPTS.daily;
    const userPrompt = this._buildPrompt(request.data || {});

    try {
      const raw = await this._callOllama(systemPrompt, userPrompt);
      const brief = {
        id: `brief_${request.format}_${Date.now()}`,
        format: request.format,
        text: raw,
        provider: 'ollama',
        timestamp: Date.now(),
        metadata: this._extractMeta(request.data || {}),
      };
      this.history.push(brief);
      if (this.history.length > this.maxHistory) this.history.shift();
      return brief;
    } catch (err) {
      return this._degradedBrief(request, err);
    }
  }

  _buildPrompt(data) {
    const parts = [];
    if (data.clusters?.length > 0) {
      parts.push(`\nTop news clusters (${data.clusters.length}):`);
      for (const c of data.clusters.slice(0, 10)) {
        parts.push(`- "${c.topTitle}" (${c.size} items, ${c.sourceCount} sources, ${c.ageHours}h old)`);
      }
    }
    if (data.escalations?.length > 0) {
      parts.push(`\nConflict escalations:`);
      for (const e of data.escalations.slice(0, 5)) {
        parts.push(`- ${e.conflictId}: level ${e.currentLevel} (${e.currentLevelLabel}), ${e.trajectory}, next-level risk: ${(e.nextLevelRisk * 100).toFixed(0)}%`);
      }
    }
    if (data.risks?.length > 0) {
      parts.push(`\nRegional risks:`);
      for (const r of data.risks.slice(0, 5)) {
        parts.push(`- ${r.regionId || r.region}: ${r.score}/100 (${r.level})`);
      }
    }
    if (data.chokepoints?.length > 0) {
      parts.push(`\nChokepoint risks:`);
      for (const cp of data.chokepoints.slice(0, 5)) {
        parts.push(`- ${cp.name}: ${cp.riskScore}/100 (${cp.riskLevel})`);
      }
    }
    if (data.markets) {
      parts.push(`\nMarkets: composite score ${data.markets.score}/100 (${data.markets.level})`);
    }
    if (data.customContext) {
      parts.push(`\nAdditional context: ${data.customContext}`);
    }
    return parts.join('\n');
  }

  _extractMeta(data) {
    return {
      clusterCount: data.clusters?.length || 0,
      escalationCount: data.escalations?.length || 0,
      riskCount: data.risks?.length || 0,
      chokepointCount: data.chokepoints?.length || 0,
      marketScore: data.markets?.score || null,
    };
  }

  async _callOllama(system, user) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: this.model,
          prompt: `${system}\n\n${user}`,
          stream: false,
          options: { temperature: this.temperature, num_predict: this.maxTokens },
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const d = await res.json();
      return d.response;
    } finally {
      clearTimeout(timer);
    }
  }

  _degradedBrief(request, error) {
    const d = request.data || {};
    const lines = [];
    if (request.format === 'alert') {
      const top = d.escalations?.[0] || d.risks?.[0];
      lines.push(top
        ? `Alert: ${top.conflictId || top.regionId} — risk ${top.score || top.currentLevel}/100. AI provider unavailable (${error?.message || 'unknown'}).`
        : 'Alert: insufficient data for alert generation.');
    } else {
      lines.push(`Briefing (${request.format.toUpperCase()}) — auto-generated summary (AI degraded).`);
      if (d.clusters?.length > 0) lines.push(`Top clusters: ${d.clusters.slice(0, 3).map(c => `"${c.topTitle}"`).join('; ')}`);
      if (d.escalations?.length > 0) lines.push(`Escalations: ${d.escalations.slice(0, 3).map(e => `${e.conflictId} L${e.currentLevel}`).join(', ')}`);
      if (d.risks?.length > 0) lines.push(`Risk areas: ${d.risks.slice(0, 3).map(r => `${r.regionId || r.region} ${r.score}`).join(', ')}`);
    }
    return {
      id: `brief_${request.format}_${Date.now()}`,
      format: request.format,
      text: lines.join('\n'),
      provider: 'degraded',
      timestamp: Date.now(),
      metadata: this._extractMeta(d),
      error: error?.message,
    };
  }

  getHistory(n = 20, format) {
    let result = this.history;
    if (format) result = result.filter(b => b.format === format);
    return result.slice(-n);
  }
}
