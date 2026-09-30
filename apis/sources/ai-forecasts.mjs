// Crucix — AIForecasts
// Прогнозы через локальный LLM на основе анализаторов.

export default class AIForecasts {
  constructor(opts = {}) {
    this.endpoint = opts.endpoint ?? 'http://localhost:11434/api/generate';
    this.model = opts.model ?? 'llama3.1:8b';
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }
  async forecast(input) {
    const prompt = this._buildPrompt(input);
    try {
      const text = await this._call(prompt);
      return { forecast: text, provider: 'ollama', timestamp: Date.now() };
    } catch (e) {
      return this._degraded(input, e);
    }
  }
  _buildPrompt(input) {
    return `Проанализируй следующие данные и сделай вероятностный прогноз на 30 дней:\n${JSON.stringify(input, null, 2).slice(0, 3000)}\n\nОтвет: JSON с полями scenario, probability (0-1), rationale.`;
  }
  async _call(prompt) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ model: this.model, prompt, stream: false, options: { temperature: 0.4 } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return d.response;
    } finally { clearTimeout(timer); }
  }
  _degraded(input, e) {
    return { forecast: `[AI degraded: ${e.message}]`, provider: 'degraded', timestamp: Date.now(), error: e.message };
  }
}
