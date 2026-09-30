// ═══════════════════════════════════════════════════════════════
//  CRUCIX RECON TOOLKIT v1.0.0
//  Обёртка над sidecar-сервером на порту 3121.
//  DNS, WHOIS, SSL, port scan, banner grab. Без fetch напрямую в интернет.
//  Все сетевые операции выполняет sidecar. Toolkit — только клиент.
// ═══════════════════════════════════════════════════════════════

const SIDECAR_URL = process.env.CRUCIX_SIDECAR_URL || 'http://127.0.0.1:3121';
const DEFAULT_TIMEOUT = 15000;

async function sidecar(endpoint, params = {}) {
  const url = new URL(`${SIDECAR_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return { error: `Sidecar HTTP ${resp.status}`, status: resp.status };
    return await resp.json();
  } catch (e) {
    return { error: e.message, type: e.code || 'UNKNOWN' };
  }
}

export class ReconToolkit {
  constructor(options = {}) {
    this.sidecarUrl = options.sidecarUrl || SIDECAR_URL;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT;
    this.cache = new Map();
    this.cacheTtlMs = Number.isFinite(options.cacheTtlMs) ? options.cacheTtlMs : 3600000;
  }

  _cacheKey(prefix, params) {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  _getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  _setCached(key, value) {
    this.cache.set(key, { value, expires: Date.now() + this.cacheTtlMs });
  }

  async dns(domain) {
    const key = this._cacheKey('dns', { domain });
    const cached = this._getCached(key);
    if (cached) return cached;
    const result = await sidecar('/dns', { domain });
    if (!result.error) this._setCached(key, result);
    return result;
  }

  async whois(domain) {
    const key = this._cacheKey('whois', { domain });
    const cached = this._getCached(key);
    if (cached) return cached;
    const result = await sidecar('/whois', { domain });
    if (!result.error) this._setCached(key, result);
    return result;
  }

  async ssl(host, port = 443) {
    const key = this._cacheKey('ssl', { host, port });
    const cached = this._getCached(key);
    if (cached) return cached;
    const result = await sidecar('/ssl', { host, port });
    if (!result.error) this._setCached(key, result);
    return result;
  }

  async portScan(host, ports) {
    const portStr = Array.isArray(ports) ? ports.join(',') : String(ports || '21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,5900,6379,8080,8443,9200,27017');
    const key = this._cacheKey('portscan', { host, portStr });
    const cached = this._getCached(key);
    if (cached) return cached;
    const result = await sidecar('/portscan', { host, ports: portStr });
    if (!result.error) this._setCached(key, result);
    return result;
  }

  async banner(host, port) {
    const key = this._cacheKey('banner', { host, port });
    const cached = this._getCached(key);
    if (cached) return cached;
    const result = await sidecar('/banner', { host, port });
    if (!result.error) this._setCached(key, result);
    return result;
  }

  async health() {
    return sidecar('/health');
  }

  clearCache() { this.cache.clear(); }

  getStats() {
    return {
      sidecarUrl: this.sidecarUrl,
      cacheSize: this.cache.size,
      cacheTtlMs: this.cacheTtlMs,
      timeoutMs: this.timeoutMs,
    };
  }
}

let _instance = null;
export function getReconToolkit(options) {
  if (!_instance) _instance = new ReconToolkit(options);
  return _instance;
}
export function resetReconToolkit() { _instance = null; }
