#!/usr/bin/env node
// collect-iss.mjs — позиция МКС (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
  const d = await r.json();
  const out = {
    source: 'WhereTheISSAt',
    updated: new Date().toISOString(),
    iss: {
      lat: d.latitude, lng: d.longitude,
      altitude: d.altitude, velocity: d.velocity,
      visibility: d.visibility, timestamp: d.timestamp,
    },
  };
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'iss-live.json'), JSON.stringify(out, null, 2));
  console.log(`[ISS] lat=${d.latitude}, lng=${d.longitude}, alt=${d.altitude}km`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
