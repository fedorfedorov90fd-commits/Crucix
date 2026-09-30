// apis/sources/smartscroll-local/index.mjs
// Source factory: external, local, or auto-switch.
// AutoSwitchSource delegates getMetrics() to local engine when available.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SmartScrollAdapter } from '../smartscroll.mjs';
import { SmartScrollLocalEngine } from './engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = process.env.SMARTSCROLL_CONFIG ||
  join(__dirname, '../../../config/smartscroll.json');
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

const MODE = config.mode || 'auto';

export function createSmartScrollSource() {
  if (MODE === 'external') {
    return new SmartScrollAdapter();
  }
  if (MODE === 'local') {
    return new SmartScrollLocalEngine(config);
  }
  const external = new SmartScrollAdapter();
  const local = new SmartScrollLocalEngine(config);
  return new AutoSwitchSource(external, local);
}

class AutoSwitchSource {
  constructor(external, local) {
    this.external = external;
    this.local = local;
    this.mode = 'auto';
    this.preferExternal = true;
    this.lastExternalFail = 0;
    this.failCooldownMs = 60000;
  }

  _shouldTryExternal() {
    if (!this.preferExternal) return false;
    return Date.now() - this.lastExternalFail > this.failCooldownMs;
  }

  async _try(method, ...args) {
    if (this._shouldTryExternal()) {
      try {
        return await this.external[method](...args);
      } catch (err) {
        console.warn(`[SmartScroll auto] external ${method} failed: ${err.message}, falling back to local`);
        this.lastExternalFail = Date.now();
      }
    }
    return this.local[method](...args);
  }

  async fetchStories(opts) { return this._try('fetchStories', opts); }
  async fetchStoryDetail(id) { return this._try('fetchStoryDetail', id); }
  async fetchTimeline(id) { return this._try('fetchTimeline', id); }

  async healthCheck() {
    const ext = await this.external.healthCheck().catch(() => ({ ok: false }));
    const loc = await this.local.healthCheck().catch(() => ({ ok: false }));
    return {
      ok: ext.ok || loc.ok,
      mode: this.mode,
      details: { external: ext, local: loc },
    };
  }

  /**
   * Per-stage timing metrics. Delegates to local engine.
   * Returns null if local engine does not implement metrics.
   */
  getMetrics() {
    if (this.local && typeof this.local.getMetrics === 'function') {
      return this.local.getMetrics();
    }
    return null;
  }
}

export { SmartScrollLocalEngine } from './engine.mjs';
export { SmartScrollAdapter } from '../smartscroll.mjs';
export { SmartScrollInterface } from '../smartscroll-interface.mjs';
