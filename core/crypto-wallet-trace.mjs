// ═══════════════════════════════════════════════════════════════
//  CRUCIX CRYPTO WALLET TRACE v1.0.0
//  Классификация кошельков, OFAC-проверка (из корзины), flow graph.
//  Без fetch() в интернет. Данные — из data/basket/.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');
const OFAC_FILE = join(BASKET_DIR, 'ofac-sdn.json');
let ofacCache = null;
let ofacCacheTime = 0;

function loadOFAC() {
  if (ofacCache && Date.now() - ofacCacheTime < 600000) return ofacCache;
  if (!existsSync(OFAC_FILE)) { ofacCache = { entries: [] }; ofacCacheTime = Date.now(); return ofacCache; }
  try {
    ofacCache = JSON.parse(readFileSync(OFAC_FILE, 'utf-8'));
    ofacCacheTime = Date.now();
  } catch { ofacCache = { entries: [] }; ofacCacheTime = Date.now(); }
  return ofacCache;
}

export class CryptoWalletTrace {
  constructor() {
    this.traces = new Map();
    this.flowGraph = new Map();
  }

  registerTrace(address, chain, rawTransactions = []) {
    const trace = {
      address, chain,
      txCount: rawTransactions.length,
      transactions: rawTransactions,
      classifiedAt: new Date().toISOString(),
    };
    trace.classification = this._classify(trace);
    trace.ofacFlagged = this._ofacCheck(address);
    trace.cluster = this._getCluster(address);
    trace.riskScore = this._risk(trace);
    this.traces.set(`${chain}:${address}`, trace);
    this._buildFlow(trace);
    return trace;
  }

  _buildFlow(trace) {
    const key = `${trace.chain}:${trace.address}`;
    if (!this.flowGraph.has(key)) this.flowGraph.set(key, { incoming: new Set(), outgoing: new Set() });
    const node = this.flowGraph.get(key);
    for (const tx of (trace.transactions || [])) {
      if (tx.from && tx.from !== trace.address) node.incoming.add(tx.from);
      if (tx.to && tx.to !== trace.address) node.outgoing.add(tx.to);
    }
  }

  _classify(trace) {
    const n = trace.transactions?.length || 0;
    if (n === 0) return 'empty';
    if (n > 1000) return 'high_activity';
    const incoming = (trace.transactions || []).filter(t => t.to === trace.address).length;
    const outgoing = (trace.transactions || []).filter(t => t.from === trace.address).length;
    if (incoming > outgoing * 3 && incoming > 20) return 'exchange_like';
    if (outgoing > incoming * 3) return 'dispersal';
    const errors = (trace.transactions || []).filter(t => t.isError).length;
    if (errors > n * 0.3) return 'suspicious';
    return 'standard';
  }

  _ofacCheck(address) {
    const ofac = loadOFAC();
    if (!Array.isArray(ofac.entries)) return false;
    const low = String(address).toLowerCase();
    return ofac.entries.some(e => (e.cryptoAddresses || []).some(c => String(c.address).toLowerCase() === low));
  }

  _getCluster(address) {
    const cluster = new Set([address]);
    for (const [k, flow] of this.flowGraph) {
      const [, addr] = k.split(':');
      if (addr === address) {
        for (const out of flow.outgoing) {
          const outKey = Array.from(this.flowGraph.keys()).find(kk => kk.endsWith(`:${out}`));
          if (!outKey) continue;
          const outFlow = this.flowGraph.get(outKey);
          if (outFlow && outFlow.outgoing.size === 1 && outFlow.incoming.size === 1) cluster.add(out);
        }
      }
    }
    return [...cluster];
  }

  _risk(trace) {
    let s = 0;
    if (trace.ofacFlagged) s += 80;
    if (trace.classification === 'suspicious') s += 30;
    if (trace.classification === 'high_activity') s += 10;
    if (trace.cluster && trace.cluster.length > 5) s += 15;
    return Math.min(100, s);
  }

  ofacSearch(query, { limit = 50 } = {}) {
    const ofac = loadOFAC();
    const q = String(query || '').toLowerCase().trim();
    if (!q) return { query, total: 0, results: [] };
    const results = (ofac.entries || []).filter(e => {
      if (e.name?.toLowerCase().includes(q)) return true;
      if ((e.aliases || []).some(a => String(a).toLowerCase().includes(q))) return true;
      if ((e.cryptoAddresses || []).some(c => String(c.address).toLowerCase().includes(q))) return true;
      if (e.imo && String(e.imo) === q) return true;
      if (e.mmsi && String(e.mmsi) === q) return true;
      return false;
    }).slice(0, limit);
    return { query, total: results.length, results };
  }

  getFlowGraph(address, chain = 'btc', depth = 2) {
    const key = `${chain}:${address}`;
    const nodes = new Set([key]);
    const edges = [];
    const visited = new Set();
    const explore = (k, d) => {
      if (d <= 0 || visited.has(k)) return;
      visited.add(k);
      const flow = this.flowGraph.get(k);
      if (!flow) return;
      for (const t of flow.outgoing) {
        const tk = Array.from(this.flowGraph.keys()).find(kk => kk.endsWith(`:${t}`)) || `${chain}:${t}`;
        nodes.add(tk); edges.push({ from: k, to: tk, direction: 'out' }); explore(tk, d - 1);
      }
      for (const t of flow.incoming) {
        const tk = Array.from(this.flowGraph.keys()).find(kk => kk.endsWith(`:${t}`)) || `${chain}:${t}`;
        nodes.add(tk); edges.push({ from: tk, to: k, direction: 'in' }); explore(tk, d - 1);
      }
    };
    explore(key, depth);
    return { nodes: [...nodes], edges };
  }

  getStats() {
    const byChain = {};
    for (const key of this.traces.keys()) {
      const chain = key.split(':')[0];
      byChain[chain] = (byChain[chain] || 0) + 1;
    }
    return { tracedWallets: this.traces.size, flowGraphNodes: this.flowGraph.size, byChain, ofacEntries: (loadOFAC().entries || []).length };
  }
}

let _instance = null;
export function getCryptoWalletTrace() {
  if (!_instance) _instance = new CryptoWalletTrace();
  return _instance;
}
export function resetCryptoWalletTrace() { _instance = null; }
