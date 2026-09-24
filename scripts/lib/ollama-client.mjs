// Универсальный клиент для Ollama API
// Используется сборщиками Crucix для классификации/суммаризации/генерации

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

export const MODELS = {
  fast: 'llama3.2:latest',
  reasoning: 'deepseek-r1:1.5b',
  heavy: 'deepseek-r1:7b',
};

export async function generate({
  model = MODELS.fast,
  prompt,
  system,
  format,
  options = {},
  timeoutMs = 300000,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        repeat_penalty: 1.3,
        repeat_last_n: 128,
        num_ctx: 4096,
        ...options,
      },
    };
    if (system) body.system = system;
    if (format) body.format = format;

    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      text: data.response || '',
      model: data.model,
      totalMs: Math.round((data.total_duration || 0) / 1e6),
      evalCount: data.eval_count || 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function classify({ text, categories, model = MODELS.fast } = {}) {
  const list = categories.join(', ');
  const sys = 'Ты классификатор текстов. Отвечай ТОЛЬКО валидным JSON без пояснений.';
  const prompt = `Категории: ${list}

Текст: ${text}

Верни JSON: {"category": "<одна из категорий>", "confidence": <0.0-1.0>, "reason": "<кратко>"}`;

  const out = await generate({
    model,
    prompt,
    system: sys,
    format: 'json',
    options: { temperature: 0.1 },
  });

  try {
    return JSON.parse(out.text);
  } catch (e) {
    return { category: 'other', confidence: 0, reason: `parse error: ${e.message}` };
  }
}

export async function health() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, models: data.models.map(m => m.name) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
