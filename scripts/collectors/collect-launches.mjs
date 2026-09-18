#!/usr/bin/env node
// collect-launches.mjs — космические запуски (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  const r = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=list');
  const d = await r.json();
  const launches = (d.results || []).map(l => ({
    id: l.id, name: l.name, net: l.net, status: l.status?.abbrev,
    provider: l.launch_service_provider?.name,
    pad: l.pad?.name, location: l.pad?.location?.name,
  }));
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'launches-upcoming.json'), JSON.stringify({ source: 'LaunchLibrary2', updated: new Date().toISOString(), count: launches.length, launches }, null, 2));
  console.log(`[Launches] ${launches.length} предстоящих запусков`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
