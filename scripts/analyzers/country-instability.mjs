#!/usr/bin/env node
// Crucix Analyzer: CountryInstabilityIndex
// Читает: data/basket/, data/reference/
// Пишет: data/analytics/index/country-instability.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const REFERENCE = join(ROOT, 'data', 'reference');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'index');
const OUT_FILE = join(OUT_DIR, 'country-instability.json');

const W = { base: 0.4, disorder: 0.2, security: 0.2, info: 0.2 };
const WAR_FLOOR = 60;

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function computeCII(input) {
  const disorderRaw = input.protestCount + input.casualties * 5 + input.internetOutages * 3;
  const disorder = input.regime === 'democracy'
    ? Math.log10(disorderRaw + 1) * 25
    : disorderRaw * 0.8;
  const disorderScore = clamp(disorder, 0, 100);
  const securityRaw = input.militaryRaids + input.adActivity * 0.5 + input.foreignPresence * 20;
  const securityScore = clamp(securityRaw * 2, 0, 100);
  const mentionFactor = input.newsMentions * input.newsSeverity;
  const infoScore = clamp(Math.log10(mentionFactor + 1) * 30, 0, 100);
  let score =
    W.base * input.baseRisk +
    W.disorder * disorderScore +
    W.security * securityScore +
    W.info * infoScore;
  if (input.nearHotspot) score *= 1.15;
  if (input.atWar) score = Math.max(score, WAR_FLOOR);
  score = clamp(Math.round(score), 0, 100);
  return { score, components: { base: input.baseRisk, disorder: disorderScore, security: securityScore, info: infoScore } };
}

async function loadInputs() {
  const chars = await readJson(join(REFERENCE, 'country-characteristics.json'), { countries: {} });
  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const social = await readJson(join(BASKET, 'social-unrest.json'), []);
  const gdelt = await readJson(join(BASKET, 'gdelt.json'), { events: [] });

  const byCountry = {};
  for (const [code, c] of Object.entries(chars.countries || {})) {
    byCountry[code] = {
      countryCode: code, countryName: c.name, baseRisk: c.baseRisk,
      regime: c.regime, protestCount: 0, casualties: 0, internetOutages: 0,
      militaryRaids: 0, adActivity: 0, foreignPresence: 0,
      newsMentions: 0, newsSeverity: 0, atWar: false, nearHotspot: false,
    };
  }

  for (const ev of acled.events || []) {
    const code = ev.country;
    if (!code || !byCountry[code]) continue;
    if (ev.event_type === 'Protests') byCountry[code].protestCount += 1;
    if (ev.event_type === 'Battles') { byCountry[code].militaryRaids += 1; byCountry[code].atWar = true; }
    byCountry[code].casualties += ev.fatalities || 0;
  }
  for (const s of social || []) {
    const code = s.country;
    if (code && byCountry[code]) byCountry[code].protestCount += 1;
  }
  for (const ev of gdelt.events || []) {
    const code = ev.country;
    if (code && byCountry[code]) byCountry[code].newsMentions += 1;
  }
  return byCountry;
}

async function main() {
  const inputs = await loadInputs();
  const now = new Date().toISOString();
  const results = {};
  for (const [code, input] of Object.entries(inputs)) {
    const { score, components } = computeCII(input);
    results[code] = {
      countryCode: code, countryName: input.countryName,
      score, components, regime: input.regime,
      atWar: input.atWar, timestamp: now,
    };
  }
  const payload = {
    _meta: {
      id: 'country-instability', category: 'index', version: '1.0.0',
      schema_version: '1.0.0', sources: ['country-characteristics', 'acled', 'social-unrest', 'gdelt'],
      calculator: 'CountryInstabilityIndex', updated_at: now, period: 'manual', checksum: '',
    },
    data: { countries: results, total: Object.keys(results).length, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  const top = Object.values(results).sort((a, b) => b.score - a.score).slice(0, 10);
  console.log('Analyzer done.');
  console.log('Countries:', Object.keys(results).length);
  console.log('Top-10:');
  for (const t of top) console.log('  ', t.countryCode, t.score);
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
