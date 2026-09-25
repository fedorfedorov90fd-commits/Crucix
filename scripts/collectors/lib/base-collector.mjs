// scripts/collectors/lib/base-collector.mjs
// Базовый класс для всех коллекторов SmartScroll.

export class BaseCollector {
  constructor(source) {
    this.url = source.url || '';
    this.channel = source.channel || '';
    this.name = source.name || 'unnamed';
    this.category = source.category || 'general';
    this.enabled = source.enabled !== false;
    this.timeoutMs = source.timeout_ms || 15000;
  }

  async collect() {
    throw new Error(`${this.constructor.name}.collect() not implemented`);
  }

  hashId(input) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) - h) + input.charCodeAt(i);
      h |= 0;
    }
    return `${this.name}_${Math.abs(h).toString(36)}`;
  }

  async _fetch(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
