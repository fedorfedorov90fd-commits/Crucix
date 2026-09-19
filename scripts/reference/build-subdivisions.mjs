#!/usr/bin/env node
/**
 * scripts/reference/build-subdivisions.mjs
 * Генератор data/reference/subdivisions.json из table-subdivisions.mjs.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SUBDIVISIONS } from './table-subdivisions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'data', 'reference', 'subdivisions.json');

function normalizeKey(s) {
  return String(s).trim().toLowerCase();
}

async function main() {
  const t0 = Date.now();
  const by_name_lower = {};
  const by_country = {};

  for (const [code, info] of Object.entries(SUBDIVISIONS)) {
    if (info.name_en) by_name_lower[normalizeKey(info.name_en)] = code;
    if (info.name_local) by_name_lower[normalizeKey(info.name_local)] = code;
    if (info.name_ru) by_name_lower[normalizeKey(info.name_ru)] = code;
    if (info.country) {
      if (!by_country[info.country]) by_country[info.country] = [];
      by_country[info.country].push(code);
    }
  }

  const output = {
    schema: 'crucix.subdivisions.v1',
    generated_at: new Date().toISOString(),
    source: 'ISO 3166-2 + manual curation',
    count: Object.keys(SUBDIVISIONS).length,
    subdivisions: SUBDIVISIONS,
    indexes: { by_name_lower, by_country }
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(output, null, 2), 'utf-8');

  const ms = Date.now() - t0;
  console.log(`[build-subdivisions] OK за ${ms}мс`);
  console.log(`  subdivisions: ${output.count}`);
  console.log(`  by_name_lower: ${Object.keys(by_name_lower).length}`);
  console.log(`  by_country: ${Object.keys(by_country).length}`);
}

main().catch((e) => { console.error('[build-subdivisions] FAIL:', e); process.exit(1); });
