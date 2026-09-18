#!/usr/bin/env node
// Crucix Analyzer: ConflictEscalationTracker v1.0.0
// Читает: data/basket/acled.json
// Пишет: data/analytics/forecast/conflict-escalation-tracker.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ConflictEscalationTracker from '../../apis/sources/conflict-escalation-tracker.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'forecast');
const OUT_FILE = join(OUT_DIR, 'conflict-escalation-tracker.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

// Маппинг конфликтов
const KNOWN_CONFLICTS = {
  'ukraine': { region: 'Eastern Europe', country: 'UKR' },
  'russia-ukraine': { region: 'Eastern Europe', country: 'UKR' },
  'gaza': { region: 'Middle East', country: 'PSE' },
  'israel-gaza': { region: 'Middle East', country: 'ISR' },
  'sudan': { region: 'East Africa', country: 'SDN' },
  'myanmar': { region: 'Southeast Asia', country: 'MMR' },
  'syria': { region: 'Middle East', country: 'SYR' },
  'yemen': { region: 'Middle East', country: 'YEM' },
  'sahel': { region: 'West Africa', country: 'MLI' },
  'mali': { region: 'West Africa', country: 'MLI' },
  'nigeria': { region: 'West Africa', country: 'NGA' },
  'drc': { region: 'Central Africa', country: 'COD' },
  'haiti': { region: 'Americas', country: 'HTI' },
  'taiwan': { region: 'Asia', country: 'TWN' },
};

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const events = acled.events || (Array.isArray(acled) ? acled : []);

  // Группируем события по conflictId (на основе country/region)
  const groups = new Map();
  for (const ev of events) {
    const key = (ev.conflictId || ev.country || ev.region || 'unknown').toLowerCase();
    if (!groups.has(key)) groups.set(key, { events: [], fatalities: 0, civilians: 0 });
    const g = groups.get(key);
    g.events.push(ev);
    g.fatalities += ev.fatalities || 0;
    if (ev.civilian_targeting || ev.event_type === 'Violence against civilians') {
      g.civilians += ev.fatalities || 0;
    }
  }

  const cet = new ConflictEscalationTracker();
  const conflicts = [];

  for (const [key, g] of groups.entries()) {
    const meta = KNOWN_CONFLICTS[key] || { region: 'Unknown', country: null };
    const input = {
      conflictId: key,
      region: meta.region,
      country: meta.country,
      fatalities: g.fatalities,
      events: g.events.length,
      civilianCasualties: g.civilians,
      geographicSpreadKm: 500,
    };
    try {
      const r = cet.compute(input);
      conflicts.push(r);
    } catch (e) {
      conflicts.push({ conflictId: key, error: e.message });
    }
  }

  conflicts.sort((a, b) => (b.intensity || 0) - (a.intensity || 0));

  const payload = {
    _meta: {
      id: 'conflict-escalation-tracker',
      category: 'forecast',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['acled'],
      calculator: 'ConflictEscalationTracker',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      description: 'Отслеживание эскалации конфликтов: 6-уровневая шкала, тренды интенсивности, прогноз следующего уровня.',
    },
    data: {
      conflicts,
      total: conflicts.length,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('ConflictEscalationTracker v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Конфликтов обработано:', conflicts.length);
  console.log('');
  console.log('Топ-5 по интенсивности:');
  for (const c of conflicts.slice(0, 5)) {
    console.log(`  ${c.conflictId}: intensity=${c.intensity}, level=${c.currentLevel} (${c.currentLevelLabel}), trajectory=${c.trajectory}, nextLevelRisk=${c.nextLevelRisk}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
