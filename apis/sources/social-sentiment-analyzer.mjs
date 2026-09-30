export default class SocialSentimentAnalyzer {
  constructor(opts = {}) { this.posts = []; this.lexicon = opts.lexicon || this._defaultLexicon(); }
  add(post) { this.posts.push({ ...post, added: Date.now() }); return this; }
  score(text) {
    if (!text) return 0;
    const words = String(text).toLowerCase().split(/\s+/);
    let score = 0;
    for (const w of words) {
      if (this.lexicon.positive.has(w)) score += 1;
      if (this.lexicon.negative.has(w)) score -= 1;
    }
    const denom = words.length || 1;
    return Math.max(Math.min(score / denom * 5, 1), -1);
  }
  aggregate(region) {
    const subset = region ? this.posts.filter(p => p.region === region) : this.posts;
    if (subset.length === 0) return { region: region || 'GLOBAL', count: 0, avgSentiment: 0, level: 'neutral' };
    const scores = subset.map(p => this.score(p.text || p.title || ''));
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
    return { region: region || 'GLOBAL', count: subset.length, avgSentiment: Math.round(avg * 100) / 100, level: avg > 0.2 ? 'positive' : avg < -0.2 ? 'negative' : 'neutral' };
  }
  _defaultLexicon() {
    return {
      positive: new Set(['peace', 'agreement', 'growth', 'success', 'cooperation', 'progress', 'breakthrough', 'deal', 'recovery', 'stable']),
      negative: new Set(['war', 'attack', 'crisis', 'conflict', 'sanctions', 'protest', 'collapse', 'threat', 'strike', 'violence', 'tension']),
    };
  }
  getAll() { return [...new Set(this.posts.map(p => p.region))].map(r => this.aggregate(r)); }
}
