// Crucix — AINewsSynthesis (класс-вычислитель)
// Синтез новостей через локальный LLM (Ollama) с fallback на деградацию.
// Не делает fetch к внешним источникам — читает данные из переданного массива.

export default class AINewsSynthesis {
  constructor(opts = {}) {
    this.endpoint = opts.endpoint ?? 'http://localhost:11434/api/generate';
    this.model = opts.model ?? 'llama3.1:8b';
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.maxTokens = opts.maxTokens ?? 1024;
  }

  async synthesize(news, opts = {}) {
    if (!Array.isArray(news) || news.length === 0) {
      return this._emptyResult();
    }
    const prompt = this._buildPrompt(news, opts);
    try {
      const text = await this._callOllama(prompt);
      return {
        synthesis: text,
        provider: 'ollama',
        newsCount: news.length,
        timestamp: Date.now(),
      };
    } catch (e) {
      return this._degraded(news, e);
    }
  }

  _buildPrompt(news, opts) {
    const head = news.slice(0, 30).map((n, i) => `${i + 1}. ${n.title || n.name || 'Untitled'}`).join('\n');
    return `Проанализируй ${news.length} новостей. Сгруппируй по темам, выдели 3 главных события, дай краткий аналитический вывод.\n\nНовости:\n${head}\n\nОтвет на русском, деловой стиль.`;
  }

  async _callOllama(prompt) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.5, num_predict: this.maxTokens },
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const d = await res.json();
      return d.response;
    } finally {
      clearTimeout(timer);
    }
  }

  _degraded(news, error) {
    const titles = news.slice(0, 5).map(n => n.title || n.name || '').filter(Boolean);
    return {
      synthesis: `[AI degraded: ${error.message}] Автосводка: ${news.length} новостей, ключевые: ${titles.join('; ')}`,
      provider: 'degraded',
      newsCount: news.length,
      timestamp: Date.now(),
      error: error.message,
    };
  }

  _emptyResult() {
    return {
      synthesis: '',
      provider: 'empty',
      newsCount: 0,
      timestamp: Date.now(),
    };
  }
}
