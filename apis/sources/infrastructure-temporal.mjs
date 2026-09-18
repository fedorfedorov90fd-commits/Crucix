// infrastructure-temporal.mjs
// Crucix Infrastructure — Layer 1: Temporal Decay

export class TemporalDecay {
  constructor(options = {}) {
    this.halfLifeDays = options.halfLifeDays ?? 30;
    this.maxAgeDays = options.maxAgeDays ?? 365;
    this.minWeight = options.minWeight ?? 0.01;
    this.decayType = options.decayType ?? 'exponential';
  }

  weight(eventDate, refDate = new Date()) {
    const event = new Date(eventDate);
    const ref = new Date(refDate);
    if (isNaN(event.getTime()) || isNaN(ref.getTime())) return 0;

    const ageDays = (ref - event) / (1000 * 60 * 60 * 24);
    if (ageDays < 0) return 1;
    if (ageDays > this.maxAgeDays) return 0;

    switch (this.decayType) {
      case 'exponential': return this._exponentialDecay(ageDays);
      case 'linear': return this._linearDecay(ageDays);
      case 'step': return this._stepDecay(ageDays);
      default: return this._exponentialDecay(ageDays);
    }
  }

  _exponentialDecay(ageDays) {
    const lambda = Math.LN2 / this.halfLifeDays;
    const w = Math.exp(-lambda * ageDays);
    return Math.max(w, this.minWeight);
  }

  _linearDecay(ageDays) {
    const w = 1 - ageDays / this.maxAgeDays;
    return Math.max(w, 0);
  }

  _stepDecay(ageDays) {
    if (ageDays <= this.halfLifeDays) return 1;
    if (ageDays <= this.halfLifeDays * 2) return 0.5;
    if (ageDays <= this.halfLifeDays * 4) return 0.25;
    return 0;
  }

  aggregate(events, severityFn = () => 1, refDate = new Date()) {
    if (!events || events.length === 0) return 0;

    const weights = events.map((e) => {
      const date = e.event_date || e.date || e.timestamp || e.time;
      const w = this.weight(date, refDate);
      const sev = severityFn(e);
      return w * sev;
    });

    const sum = weights.reduce((a, b) => a + b, 0);
    const max = Math.max(...weights);
    return Math.min((sum * 0.6 + max * 0.4), 1);
  }

  filterRecent(events, maxAgeDays = null, refDate = new Date()) {
    const maxAge = maxAgeDays ?? this.maxAgeDays;
    return events.filter((e) => {
      const date = e.event_date || e.date || e.timestamp || e.time;
      const event = new Date(date);
      const ageDays = (refDate - event) / (1000 * 60 * 60 * 24);
      return ageDays >= 0 && ageDays <= maxAge;
    });
  }

  getWindowedWeights(refDate = new Date()) {
    return {
      w7: this.weight(new Date(refDate.getTime() - 7 * 86400000), refDate),
      w30: this.weight(new Date(refDate.getTime() - 30 * 86400000), refDate),
      w90: this.weight(new Date(refDate.getTime() - 90 * 86400000), refDate),
      w180: this.weight(new Date(refDate.getTime() - 180 * 86400000), refDate),
      w365: this.weight(new Date(refDate.getTime() - 365 * 86400000), refDate),
    };
  }
}
