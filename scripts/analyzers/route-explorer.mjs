#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import RouteExplorer from '../../apis/sources/route-explorer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const INFRA = join(ROOT, 'data', 'infrastructure');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'flow');
const OUT_FILE = join(OUT_DIR, 'route-explorer.json');

async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const objects = await readJson(join(INFRA, 'objects.json'), { objects: [] });
  const rx = new RouteExplorer();

  for (const obj of objects.objects || []) {
    if (obj.type === 'seaport' && obj.coordinates) {
      rx.addPort({ id: obj.id, name: obj.name, lat: obj.coordinates.lat, lng: obj.coordinates.lng });
    }
    if (obj.type === 'chokepoint' && obj.coordinates) {
      rx.addChokepoint({ id: obj.id, name: obj.name, lat: obj.coordinates.lat, lng: obj.coordinates.lng });
    }
  }

  const ports = rx.listPorts();
  const choke = rx.listChokepoints();

  // Считаем альтернативные маршруты для ключевых пар
  const routes = [];
  const mainPairs = [
    ['port-shanghai', 'port-la'],
    ['port-singapore', 'port-rotterdam'],
    ['port-rotterdam', 'port-newyork'],
  ];
  for (const [from, to] of mainPairs) {
    const cmp = rx.compareAlternatives(from, to, choke.map(c => c.id));
    if (cmp.alternatives.length > 0) routes.push(cmp);
  }

  const payload = {
    _meta: { id: 'route-explorer', category: 'flow', version: '1.0.0', schema_version: '1.0.0', sources: ['infrastructure/objects'], calculator: 'RouteExplorer', updated_at: now, period: 'latest', duration_ms: Date.now() - t0, checksum: '', stats: { ports: ports.length, chokepoints: choke.length, routes: routes.length }, description: 'Анализ альтернативных морских маршрутов с учётом чокпоинтов.' },
    data: { ports, chokepoints: choke, routes, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('RouteExplorer v1.0.0');
  console.log('  Портов:', ports.length);
  console.log('  Чокпоинтов:', choke.length);
  console.log('  Маршрутов:', routes.length);
  for (const r of routes.slice(0, 3)) {
    console.log(`  ${r.from} → ${r.to}: fastest=${r.fastest}`);
  }
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
