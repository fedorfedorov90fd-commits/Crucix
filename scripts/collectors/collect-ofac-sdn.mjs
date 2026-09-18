#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX COLLECTOR: OFAC SDN
//  Сборщик списка санкций США (XML с treasury.gov).
//  Пишет в data/basket/ofac-sdn.json.
//  Правило 17.4: логи в logs/collectors/.
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const OUTPUT = join(BASKET_DIR, 'ofac-sdn.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-ofac-sdn.log');
const SDN_XML_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line);
  } catch {}
  console.log(msg);
}

function demoData() {
  return {
    lastUpdated: new Date().toISOString(),
    source: 'demo-fallback',
    entries: [
      { id: 'OFAC-DEMO-1', name: 'Demo Sanctioned Entity', type: 'organization', programs: ['SDGT'], addresses: [{ country: 'IR', address: 'Tehran' }], aliases: [], cryptoAddresses: [] },
      { id: 'OFAC-DEMO-2', name: 'Demo Vessel', type: 'vessel', programs: ['IRAN'], imo: 1234567, mmsi: 636012345, addresses: [], aliases: [] },
    ],
  };
}

function parseSDN(xml) {
  const entries = [];
  const parts = xml.split(/<Entity>/i).slice(1);
  for (const e of parts) {
    const entry = { id: '', name: '', type: 'organization', programs: [], addresses: [], aliases: [], cryptoAddresses: [] };
    const idM = e.match(/<ID[^>]*>([^<]+)<\/ID>/);
    if (idM) entry.id = `OFAC-${idM[1]}`;
    const n = e.match(/<Name[^>]*>([^<]+)<\/Name>/);
    if (n) entry.name = n[1];
    if (e.includes('<Individual>')) entry.type = 'person';
    else if (/VesselType/i.test(e)) entry.type = 'vessel';
    else if (/AircraftType/i.test(e)) entry.type = 'aircraft';
    for (const m of e.matchAll(/<Program[^>]*>([^<]+)<\/Program>/g)) entry.programs.push(m[1].trim());
    for (const m of e.matchAll(/<Address[^>]*>([\s\S]*?)<\/Address>/g)) {
      const ax = m[1];
      const country = ax.match(/<Country[^>]*>([^<]+)<\/Country>/);
      const line = ax.match(/<AddressLine[^>]*>([^<]+)<\/AddressLine>/);
      entry.addresses.push({ country: country ? country[1] : null, address: line ? line[1] : null });
    }
    for (const m of e.matchAll(/<AKA[^>]*>[\s\S]*?<LastName[^>]*>([^<]+)<\/LastName>/g)) entry.aliases.push(m[1]);
    const imo = e.match(/<IMO[^>]*>([^<]+)<\/IMO>/);
    if (imo) entry.imo = parseInt(imo[1], 10);
    if (entry.name) entries.push(entry);
  }
  return entries;
}

async function collect() {
  log('Загрузка списка OFAC SDN');
  let data, source = 'treasury.gov';
  try {
    const r = await fetch(SDN_XML_URL, { signal: AbortSignal.timeout(90000), headers: { 'User-Agent': 'Crucix/1.0 OSINT' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const entries = parseSDN(xml);
    log(`Распарсено ${entries.length} записей`);
    data = { lastUpdated: new Date().toISOString(), source, entries };
  } catch (e) {
    log(`Ошибка: ${e.message}. Демо-данные.`);
    data = demoData();
    source = 'demo-fallback';
  }

  if (!existsSync(BASKET_DIR)) mkdirSync(BASKET_DIR, { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  const byType = {};
  for (const e of data.entries) byType[e.type] = (byType[e.type] || 0) + 1;
  log(`Сохранено в ${OUTPUT}: ${data.entries.length} записей, ${JSON.stringify(byType)}`);
}

collect().catch(e => { log(`Фатально: ${e.message}`); process.exit(1); });
