// apis/sources/smartscroll-local/processing/summarizer.mjs
// Two-stage summarization:
// 1. Extractive (TF-IDF + MMR) - always available, no dependencies
// 2. Abstractive (Ollama local LLM) - optional, if enabled and reachable
// Falls back to extractive on LLM failure.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _config = null;
function getConfig() {
  if (_config) return _config;
  try {
    const path = process.env.SMARTSCROLL_CONFIG ||
      join(__dirname, '../../../../config/smartscroll.json');
    _config = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    _config = { local: { summarization: {} } };
  }
  return _config;
}

export class Summarizer {
  constructor(numSentences = 3, opts = {}) {
    this.numSentences = numSentences;
    this.abstractiveEnabled = opts.abstractiveEnabled ?? false;
    this.llmEndpoint = opts.llmEndpoint || 'http://localhost:11434/api/generate';
    this.llmModel = opts.llmModel || 'llama3.2';
    this.llmTimeoutMs = opts.llmTimeoutMs || 30000;
    this.maxTokensAbstractive = opts.maxTokensAbstractive || 256;
    this._llmChecked = false;
    this._llmAvailable = false;
  }

  /**
   * Summarize events. Returns extractive summary by default.
   * If abstractive is enabled AND LLM is reachable, uses LLM.
   */
  async summarizeAsync(events) {
    const extractive = this.summarize(events);
    if (!this.abstractiveEnabled) return extractive;

    const available = await this._checkLlm();
    if (!available) return extractive;

    try {
      const abstractive = await this._abstractive(events);
      if (abstractive && abstractive.length > 20) {
        return abstractive;
      }
    } catch (err) {
      console.warn(`[summarizer] abstractive failed: ${err.message}, using extractive`);
    }
    return extractive;
  }

  /**
   * Synchronous extractive summarization (TF-IDF + MMR).
   */
  summarize(events) {
    if (!events || events.length === 0) return '';
    if (events.length === 1) return events[0].title;

    const sentences = [];
    for (const ev of events) {
      if (ev.title) sentences.push(ev.title);
      const bodySentences = this._splitSentences(ev.body);
      for (const s of bodySentences) {
        if (s.length > 20 && !sentences.includes(s)) {
          sentences.push(s);
        }
      }
    }

    if (sentences.length <= this.numSentences) {
      return sentences.join(' ');
    }

    const tfidfScores = this._tfidf(sentences);
    const selected = this._mmrSelect(sentences, tfidfScores, this.numSentences);
    return selected.join(' ');
  }

  async _checkLlm() {
    if (this._llmChecked) return this._llmAvailable;
    this._llmChecked = true;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const baseUrl = this.llmEndpoint.replace('/api/generate', '');
      const res = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(timer);
      this._llmAvailable = res.ok;
    } catch {
      this._llmAvailable = false;
    }
    return this._llmAvailable;
  }

  async _abstractive(events) {
    const fullText = events
      .map(e => `${e.title}. ${e.body || ''}`)
      .join(' ')
      .slice(0, 4000);

    const prompt = `Summarize the following news events in 2-3 sentences. Reply with the summary only.\n\n${fullText}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.llmTimeoutMs);
    try {
      const res = await fetch(this.llmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.llmModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: this.maxTokensAbstractive,
          },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = await res.json();
      return (data.response || '').trim();
    } finally {
      clearTimeout(timer);
    }
  }

  _splitSentences(text) {
    return (text || '')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  _tfidf(sentences) {
    const docs = sentences.map(s =>
      s.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    );

    const N = docs.length;
    const df = new Map();
    for (const doc of docs) {
      const unique = new Set(doc);
      for (const word of unique) {
        df.set(word, (df.get(word) || 0) + 1);
      }
    }

    const scores = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const tf = new Map();
      for (const word of docs[i]) {
        tf.set(word, (tf.get(word) || 0) + 1);
      }
      let score = 0;
      for (const [word, count] of tf) {
        const idf = Math.log(N / (df.get(word) || 1));
        score += (count / docs[i].length) * idf;
      }
      scores[i] = score;
    }

    const maxScore = Math.max(...scores, 1);
    return scores.map(s => s / maxScore);
  }

  _mmrSelect(sentences, scores, k) {
    const selected = [];
    const remaining = new Set(sentences.map((_, i) => i));

    let bestIdx = 0;
    let bestScore = -1;
    for (const i of remaining) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIdx = i;
      }
    }
    selected.push(bestIdx);
    remaining.delete(bestIdx);

    const lambda = 0.7;

    while (selected.length < k && remaining.size > 0) {
      let bestMmr = -1;
      let bestJ = -1;

      for (const j of remaining) {
        const rel = scores[j];
        let maxSim = 0;
        for (const i of selected) {
          const sim = this._sentenceSimilarity(sentences[j], sentences[i]);
          if (sim > maxSim) maxSim = sim;
        }
        const mmr = lambda * rel - (1 - lambda) * maxSim;
        if (mmr > bestMmr) {
          bestMmr = mmr;
          bestJ = j;
        }
      }

      if (bestJ === -1) break;
      selected.push(bestJ);
      remaining.delete(bestJ);
    }

    selected.sort((a, b) => a - b);
    return selected.map(i => sentences[i]);
  }

  _sentenceSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let inter = 0;
    for (const w of wordsA) if (wordsB.has(w)) inter++;
    return inter / (wordsA.size + wordsB.size - inter);
  }
}
