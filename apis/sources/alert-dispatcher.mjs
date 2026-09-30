// Crucix — AlertDispatcher
// Маршрутизация алертов по каналам с приоритетами.

export default class AlertDispatcher {
  constructor() {
    this.channels = new Map();
    this.rules = [];
    this.dispatched = [];
  }
  registerChannel(name, handler) {
    this.channels.set(name, { name, handler, dispatched: 0 });
    return this;
  }
  addRule(rule) {
    // rule = { matches: (alert) => bool, channels: ['telegram', 'log'] }
    this.rules.push({ ...rule, added: Date.now() });
    return this;
  }
  async dispatch(alert) {
    const matched = this.rules.filter(r => r.matches(alert));
    const channels = new Set();
    for (const r of matched) for (const c of r.channels) channels.add(c);
    const results = [];
    for (const ch of channels) {
      const channel = this.channels.get(ch);
      if (!channel) continue;
      try {
        await channel.handler(alert);
        channel.dispatched++;
        results.push({ channel: ch, status: 'ok' });
      } catch (e) {
        results.push({ channel: ch, status: 'error', error: e.message });
      }
    }
    this.dispatched.push({ alert, results, timestamp: Date.now() });
    return results;
  }
  stats() {
    return {
      channels: this.channels.size,
      rules: this.rules.length,
      totalDispatched: this.dispatched.length,
    };
  }
}
