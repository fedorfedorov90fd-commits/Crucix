// apis/sources/smartscroll-local/processing/dedup.mjs
// Four-level deduplication:
// 1. Exact content hash
// 2. Entity signature match (Jaccard on entities >= threshold)
// 3. Shingles + Jaccard on bodies
// 4. TF-IDF cosine similarity on titles + bodies

export class Deduplicator {
  constructor(threshold = 0.75) {
    this.threshold = threshold;
    this.entityThreshold = 0.7;
    this.cosineThreshold = 0.6;
  }

  deduplicate(newEvents, existingEvents = []) {
    const existingHashes = new Set();
    for (const e of existingEvents) {
      existingHashes.add(this._contentHash(e));
    }

    const seen = new Set();
    const unique = [];

    for (const event of newEvents) {
      const hash = this._contentHash(event);
      if (existingHashes.has(hash) || seen.has(hash)) {
        continue;
      }

      let isDup = false;

      // Level 2: entity signature (fast filter)
      for (const existing of [...existingEvents, ...unique]) {
        if (this._entitySignature(event, existing) >= this.entityThreshold) {
          if (this._titlesSimilar(event, existing) || this._bodiesSimilar(event, existing)) {
            isDup = true;
            break;
          }
        }
      }
      if (isDup) continue;

      // Level 3: shingles Jaccard
      for (const existing of [...existingEvents, ...unique]) {
        if (this._jaccardSimilarity(event.body, existing.body) >= this.threshold) {
          isDup = true;
          break;
        }
      }
      if (isDup) continue;

      // Level 4: cosine similarity on titles + bodies
      for (const existing of [...existingEvents, ...unique]) {
        const combined = this._cosineSimilarity(
          event.title + ' ' + event.body,
          existing.title + ' ' + existing.body
        );
        if (combined >= this.cosineThreshold) {
          isDup = true;
          break;
        }
      }
      if (isDup) continue;

      seen.add(hash);
      unique.push(event);
    }

    return unique;
  }

  _contentHash(event) {
    const normalized = `${event.title.toLowerCase().trim()}:${(event.body || '').slice(0, 500).toLowerCase().trim()}`;
    let h = 0;
    for (let i = 0; i < normalized.length; i++) {
      h = ((h << 5) - h) + normalized.charCodeAt(i);
      h |= 0;
    }
    return `ch_${Math.abs(h).toString(36)}`;
  }

  _entitySignature(a, b) {
    const setA = new Set((a.entities || []).map(x => String(x).toLowerCase()));
    const setB = new Set((b.entities || []).map(x => String(x).toLowerCase()));
    if (setA.size === 0 || setB.size === 0) return 0;
    let inter = 0;
    for (const x of setA) if (setB.has(x)) inter++;
    return inter / (setA.size + setB.size - inter);
  }

  _titlesSimilar(a, b) {
    if (!a.title || !b.title) return false;
    const wordsA = new Set(a.title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return false;
    let inter = 0;
    for (const w of wordsA) if (wordsB.has(w)) inter++;
    const sim = inter / (wordsA.size + wordsB.size - inter);
    return sim >= 0.5;
  }

  _bodiesSimilar(a, b) {
    if (!a.body || !b.body) return false;
    return this._jaccardSimilarity(a.body, b.body) >= 0.5;
  }

  _shingles(text, k = 4) {
    const words = (text || '').toLowerCase().split(/\s+/).filter(w => w.length > 1);
    if (words.length < k) return new Set([words.join(' ')]);
    const sh = new Set();
    for (let i = 0; i <= words.length - k; i++) {
      sh.add(words.slice(i, i + k).join(' '));
    }
    return sh;
  }

  _jaccardSimilarity(textA, textB) {
    const shA = this._shingles(textA);
    const shB = this._shingles(textB);
    if (shA.size === 0 || shB.size === 0) return 0;
    let inter = 0;
    for (const s of shA) if (shB.has(s)) inter++;
    return inter / (shA.size + shB.size - inter);
  }

  _cosineSimilarity(textA, textB) {
    const tokA = this._tokenize(textA);
    const tokB = this._tokenize(textB);
    if (tokA.length === 0 || tokB.length === 0) return 0;

    const mapA = new Map();
    const mapB = new Map();
    for (const t of tokA) mapA.set(t, (mapA.get(t) || 0) + 1);
    for (const t of tokB) mapB.set(t, (mapB.get(t) || 0) + 1);

    let dot = 0, magA = 0, magB = 0;
    for (const [t, cA] of mapA) {
      magA += cA * cA;
      const cB = mapB.get(t);
      if (cB) dot += cA * cB;
    }
    for (const cB of mapB.values()) magB += cB * cB;

    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  _tokenize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  _levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }
}
