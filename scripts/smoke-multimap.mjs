#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX SMOKE MULTIMAP
//  Проверка всех ключевых модулей в одном прогоне.
//  Запуск: node scripts/smoke-multimap.mjs
// ═══════════════════════════════════════════════════════════════

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const results = [];
async function test(name, fn) {
  try {
    const r = await fn();
    results.push({ name, ok: true, note: typeof r === 'string' ? r : JSON.stringify(r) });
  } catch (e) {
    results.push({ name, ok: false, note: e.message });
  }
}

async function main() {
  console.log('[smoke] Старт');

  await test('EntityGraph + EntityModelEngine', async () => {
    const { EntityGraph, NODE_TYPES, EDGE_TYPES } = await import(join(ROOT, 'core', 'entity-graph-engine.mjs'));
    const { EntityModelEngine } = await import(join(ROOT, 'core', 'entity-model-engine.mjs'));
    const g = new EntityGraph();
    const m = new EntityModelEngine(g);
    g.addNode({ id: 'a', type: NODE_TYPES.COUNTRY, label: 'A', lat: 1, lon: 2 });
    g.addNode({ id: 'b', type: NODE_TYPES.COUNTRY, label: 'B', lat: 3, lon: 4 });
    g.addEdge({ from: 'a', to: 'b', type: EDGE_TYPES.CONFLICTS_WITH });
    const d = m.buildDossier('a');
    return { nodes: g.nodes.size, edges: g.edges.size, risk: d.riskScore };
  });

  await test('LivingDossier', async () => {
    const { EntityGraph } = await import(join(ROOT, 'core', 'entity-graph-engine.mjs'));
    const { EntityModelEngine } = await import(join(ROOT, 'core', 'entity-model-engine.mjs'));
    const { LivingDossier } = await import(join(ROOT, 'core', 'living-dossier.mjs'));
    const g = new EntityGraph();
    const m = new EntityModelEngine(g);
    const ld = new LivingDossier(m, g, { ttlMs: 60000 });
    g.addNode({ id: 'a', type: 'country', label: 'A', lat: 1, lon: 2 });
    ld.get('a');
    const st = ld.getStats();
    ld.shutdown();
    return { cached: st.cached };
  });

  await test('GeoTimeTimeline', async () => {
    const { EntityGraph } = await import(join(ROOT, 'core', 'entity-graph-engine.mjs'));
    const { GeoTimeTimeline } = await import(join(ROOT, 'core', 'geotime-timeline.mjs'));
    const g = new EntityGraph();
    const tl = new GeoTimeTimeline(g);
    g.addNode({ id: 'v', type: 'vessel', label: 'V', lat: 50, lon: 30 });
    const n = g.getNode('v');
    n.addObservation({ timestamp: '2026-09-12T10:00:00Z', lat: 50, lon: 30, source: 's' });
    n.addObservation({ timestamp: '2026-09-12T11:00:00Z', lat: 50.1, lon: 30.1, source: 's' });
    const t = tl.buildTrack('v');
    return { points: t.points.length, stops: t.stops.length };
  });

  await test('TargetWorkbench', async () => {
    const { EntityGraph, NODE_TYPES } = await import(join(ROOT, 'core', 'entity-graph-engine.mjs'));
    const { EntityModelEngine } = await import(join(ROOT, 'core', 'entity-model-engine.mjs'));
    const { TargetWorkbench } = await import(join(ROOT, 'core', 'target-workbench.mjs'));
    const g = new EntityGraph();
    const m = new EntityModelEngine(g);
    const tw = new TargetWorkbench(g, m);
    g.addNode({ id: 't1', type: NODE_TYPES.APT, label: 'T', lat: 1, lon: 2 });
    tw.addTarget('t1');
    return { targets: tw.getStats().totalTargets };
  });

  await test('GaiaMapLinker', async () => {
    const { EntityGraph, NODE_TYPES } = await import(join(ROOT, 'core', 'entity-graph-engine.mjs'));
    const { GaiaMapLinker } = await import(join(ROOT, 'core', 'gaia-map-linker.mjs'));
    const g = new EntityGraph();
    g.addNode({ id: 'a', type: NODE_TYPES.COUNTRY, label: 'A', lat: 50, lon: 30 });
    g.addNode({ id: 'b', type: NODE_TYPES.COUNTRY, label: 'B', lat: 50.5, lon: 30.5 });
    const gaia = new GaiaMapLinker(g);
    const nb = gaia.findNeighbors(50, 30, 200);
    return { neighbors: nb.length };
  });

  await test('IntelFeed', async () => {
    const { IntelFeed } = await import(join(ROOT, 'core', 'intel-feed.mjs'));
    const f = new IntelFeed({ persistPath: null });
    f.add({ title: 'Test', source: 'test' });
    return { items: f.getStats().total };
  });

  await test('TelegramOSINTLayer', async () => {
    const { TelegramOSINTLayer } = await import(join(ROOT, 'core', 'telegram-osint-layer.mjs'));
    const tl = new TelegramOSINTLayer();
    const m = tl.processMessage({ text: 'Взрыв в Москве 55.7558, 37.6173 срочно', channel: 't' });
    return { geo: !!m.geo, type: m.messageType };
  });

  await test('CryptoWalletTrace', async () => {
    const { CryptoWalletTrace } = await import(join(ROOT, 'core', 'crypto-wallet-trace.mjs'));
    const ct = new CryptoWalletTrace();
    ct.registerTrace('addr', 'btc', []);
    return { wallets: ct.getStats().tracedWallets };
  });

  await test('DeepLinkEncoder', async () => {
    const { DeepLinkEncoder } = await import(join(ROOT, 'core', 'deep-link-encoder.mjs'));
    const e = new DeepLinkEncoder();
    const h = e.encode({ maps: [{ preset: 'worldmonitor', center: [10, 20], zoom: 3 }] });
    const d = e.decode(h);
    return { preset: d.maps[0].preset };
  });

  await test('PresetEngine', async () => {
    const { PresetEngine } = await import(join(ROOT, 'core', 'preset-engine.mjs'));
    const e = new PresetEngine(join(ROOT, 'data', 'persist', 'presets'));
    return { presets: e.getAll().length };
  });

  await test('AIAnalystContext (без Ollama)', async () => {
    const { AIAnalystContext } = await import(join(ROOT, 'core', 'ai-analyst-context.mjs'));
    const ctx = new AIAnalystContext(join(ROOT, 'data', 'basket'));
    const c = ctx.buildContext({ activeLayers: [] });
    return { sections: c.sections.length };
  });

  let ok = 0, fail = 0;
  for (const r of results) {
    if (r.ok) ok++; else fail++;
    console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.name} — ${r.note}`);
  }
  console.log(`[smoke] Итог: OK ${ok}, FAIL ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('[smoke] Фатально:', e); process.exit(1); });
